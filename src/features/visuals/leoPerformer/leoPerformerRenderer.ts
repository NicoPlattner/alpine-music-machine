import * as THREE from 'three'
import { leoGlowFragmentShader, leoGlowVertexShader, leoPointFragmentShader, leoPointVertexShader } from './leoPerformerShaders'
import type { LeoAudioSignal } from './leoAudio'

export const LEO_POINT_COLUMNS = 390
export const LEO_POINT_ROWS = 285
export const LEO_POINT_COUNT = LEO_POINT_COLUMNS * LEO_POINT_ROWS
export const LEO_POINT_SIZE = 2.3
export const LEO_DEPTH_SCALE = 0.5
export const LEO_CAMERA_FOV = 50
export const LEO_DEMO_CAMERA_Z = 2.4
export const LEO_ZOOM = 0.9
export const LEO_Y_OFFSET = -0.12
export const LEO_TRAIL_LAYERS = 9
export const LEO_GLOW_OPACITY = 0.6
export const LEO_GLOW_BLUR_RADIUS = 3.5
export const LEO_MAX_PIXEL_RATIO = 1.25

export interface LeoRenderMetrics {
  framesRendered: number
  renderFps: number
  canvasWidth: number
  canvasHeight: number
  sourceWidth: number
  sourceHeight: number
  maskForegroundRatio: number
  cameraZ: number
}

export class LeoPerformerRenderer {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(LEO_CAMERA_FOV, 1, 0.05, 50)
  private readonly videoTexture: THREE.CanvasTexture
  private readonly maskTexture: THREE.CanvasTexture
  private readonly pointMaterial: THREE.ShaderMaterial
  private readonly pointGeometry: THREE.BufferGeometry
  private readonly group = new THREE.Group()
  private readonly trailMaterials: THREE.ShaderMaterial[] = []
  private readonly glowGeometry: THREE.PlaneGeometry
  private readonly glowMaterial: THREE.ShaderMaterial
  private readonly alphaCanvas = document.createElement('canvas')
  private readonly alphaContext: CanvasRenderingContext2D | null
  private framesRendered = 0
  private fpsFrames = 0
  private renderFps = 0
  private fpsStartedAt = performance.now()
  private maskForegroundRatio = 0
  private lastMaskCheckAt = 0

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly videoSource: HTMLCanvasElement,
    private readonly maskSource: HTMLCanvasElement,
    private readonly audioSignal: LeoAudioSignal,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setClearColor(0x000000, 0)
    this.scene.background = null

    this.videoTexture = new THREE.CanvasTexture(videoSource)
    this.videoTexture.minFilter = THREE.LinearFilter
    this.videoTexture.magFilter = THREE.LinearFilter
    this.videoTexture.generateMipmaps = false
    this.maskTexture = new THREE.CanvasTexture(maskSource)
    this.maskTexture.minFilter = THREE.LinearFilter
    this.maskTexture.magFilter = THREE.LinearFilter
    this.maskTexture.generateMipmaps = false

    this.pointMaterial = this.createPointMaterial()
    this.pointGeometry = this.createPointGeometry(videoSource.width / Math.max(1, videoSource.height))
    this.glowGeometry = new THREE.PlaneGeometry(2 * videoSource.width / Math.max(1, videoSource.height), 2)
    this.glowMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uMaskTex: { value: this.maskTexture },
        uMaskTexel: { value: new THREE.Vector2(1 / Math.max(1, maskSource.width), 1 / Math.max(1, maskSource.height)) },
        uOpacity: { value: LEO_GLOW_OPACITY },
        uBlurRadius: { value: LEO_GLOW_BLUR_RADIUS },
      },
      vertexShader: leoGlowVertexShader,
      fragmentShader: leoGlowFragmentShader,
    })
    const glow = new THREE.Mesh(this.glowGeometry, this.glowMaterial)
    glow.position.z = -0.08
    glow.renderOrder = -1
    this.group.add(glow)

    for (let index = 0; index < LEO_TRAIL_LAYERS; index += 1) {
      const material = index === 0 ? this.pointMaterial : this.pointMaterial.clone()
      material.uniforms.uTrailDelay.value = index * 1.15
      material.uniforms.uTrailOpacity.value = index === 0 ? 1 : 0.24 / index
      this.trailMaterials.push(material)
      this.group.add(new THREE.Points(this.pointGeometry, material))
    }
    this.group.position.y = LEO_Y_OFFSET
    this.group.scale.setScalar(LEO_ZOOM)
    this.scene.add(this.group)
    this.alphaCanvas.width = 64
    this.alphaCanvas.height = 36
    this.alphaContext = this.alphaCanvas.getContext('2d', { willReadFrequently: true })
  }

  resize(width: number, height: number) {
    if (!width || !height) return
    const pixelRatio = Math.min(window.devicePixelRatio || 1, LEO_MAX_PIXEL_RATIO)
    this.renderer.setPixelRatio(pixelRatio)
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.position.z = LEO_DEMO_CAMERA_Z
    this.camera.updateProjectionMatrix()
    this.group.position.x = 0
    this.group.position.y = LEO_Y_OFFSET
    for (const material of this.trailMaterials) material.uniforms.uPixelRatio.value = pixelRatio
  }

  render(timestamp: number) {
    this.videoTexture.needsUpdate = true
    this.maskTexture.needsUpdate = true
    const elapsedSeconds = timestamp / 1000
    for (const material of this.trailMaterials) {
      material.uniforms.uTime.value = elapsedSeconds
      material.uniforms.uAudioBeat.value = this.audioSignal.beat
    }
    this.renderer.render(this.scene, this.camera)
    this.framesRendered += 1
    this.fpsFrames += 1
    const fpsElapsed = timestamp - this.fpsStartedAt
    if (fpsElapsed >= 1000) {
      this.renderFps = Math.round(this.fpsFrames * 1000 / fpsElapsed)
      this.fpsFrames = 0
      this.fpsStartedAt = timestamp
    }
    if (timestamp - this.lastMaskCheckAt >= 500) {
      this.lastMaskCheckAt = timestamp
      this.maskForegroundRatio = this.measureMaskForeground()
    }
  }

  getMetrics(): LeoRenderMetrics {
    return {
      framesRendered: this.framesRendered,
      renderFps: this.renderFps,
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
      sourceWidth: this.videoSource.width,
      sourceHeight: this.videoSource.height,
      maskForegroundRatio: this.maskForegroundRatio,
      cameraZ: this.camera.position.z,
    }
  }

  dispose() {
    this.scene.remove(this.group)
    this.pointGeometry.dispose()
    for (const material of this.trailMaterials) material.dispose()
    this.glowGeometry.dispose()
    this.glowMaterial.dispose()
    this.videoTexture.dispose()
    this.maskTexture.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
  }

  private createPointMaterial() {
    return new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        uVideoTex: { value: this.videoTexture },
        uMaskTex: { value: this.maskTexture },
        uColorTint: { value: new THREE.Color(0xf5afce) },
        uColorMix: { value: 1 },
        uShadeMin: { value: 0.45 },
        uDepthScale: { value: LEO_DEPTH_SCALE },
        uPointSize: { value: LEO_POINT_SIZE },
        uPixelRatio: { value: 1 },
        uTime: { value: 0 },
        uTrailDelay: { value: 0 },
        uTrailOpacity: { value: 1 },
        uMotion: { value: new THREE.Vector2() },
        uAudioBeat: { value: 0 },
        uMaskTexel: { value: new THREE.Vector2(1 / Math.max(1, this.maskSource.width), 1 / Math.max(1, this.maskSource.height)) },
      },
      vertexShader: leoPointVertexShader,
      fragmentShader: leoPointFragmentShader,
      transparent: true,
      depthWrite: false,
    })
  }

  private createPointGeometry(aspect: number) {
    const positions = new Float32Array(LEO_POINT_COUNT * 3)
    const uvs = new Float32Array(LEO_POINT_COUNT * 2)
    const worldHeight = 2
    const worldWidth = worldHeight * aspect
    let index = 0
    for (let row = 0; row < LEO_POINT_ROWS; row += 1) {
      for (let column = 0; column < LEO_POINT_COLUMNS; column += 1) {
        const u = column / (LEO_POINT_COLUMNS - 1)
        const v = row / (LEO_POINT_ROWS - 1)
        positions[index * 3] = (u - 0.5) * worldWidth
        positions[index * 3 + 1] = (0.5 - v) * worldHeight
        positions[index * 3 + 2] = 0
        uvs[index * 2] = 1 - u
        uvs[index * 2 + 1] = 1 - v
        index += 1
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    return geometry
  }

  private measureMaskForeground() {
    if (!this.alphaContext || !this.maskSource.width || !this.maskSource.height) return 0
    this.alphaContext.drawImage(this.maskSource, 0, 0, this.alphaCanvas.width, this.alphaCanvas.height)
    const pixels = this.alphaContext.getImageData(0, 0, this.alphaCanvas.width, this.alphaCanvas.height).data
    let foreground = 0
    for (let offset = 0; offset < pixels.length; offset += 4) {
      if (pixels[offset] >= 31) foreground += 1
    }
    return foreground / (pixels.length / 4)
  }
}
