import * as THREE from 'three'
import type { LeoAudioDriver } from './leoAudio'

const COLUMNS = 1350
const ROWS = 975
const POINT_SIZE = 1.2
const IMAGE_CONTRAST = 2.2
const WAVE_AMPLITUDE = 0.22
const WAVE_FREQUENCY = 1.6
const WAVE_SPEED = 0.3
const WAVE_FREQUENCY_2 = 0.9
const WAVE_SPEED_2 = 0.17
const PARALLAX_STRENGTH = 0.3

export const LEO_BACKGROUND_POINT_COUNT = COLUMNS * ROWS

export class LeoBackgroundRenderer {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(50, 1, 0.05, 50)
  private readonly texture: THREE.Texture
  private readonly geometry: THREE.BufferGeometry
  private readonly material: THREE.ShaderMaterial
  private readonly points: THREE.Points

  constructor(private readonly canvas: HTMLCanvasElement, source: HTMLImageElement, private readonly audio: LeoAudioDriver) {
    this.texture = new THREE.Texture(source)
    this.texture.needsUpdate = true
    this.texture.minFilter = THREE.LinearFilter
    this.texture.magFilter = THREE.LinearFilter
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setClearColor(0x000000, 1)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25))
    this.camera.position.set(0, 0, 2.4)
    this.geometry = this.createGeometry(source.naturalWidth / source.naturalHeight)
    this.material = this.createMaterial()
    this.points = new THREE.Points(this.geometry, this.material)
    this.scene.add(this.points)
  }

  resize(width: number, height: number) {
    if (!width || !height) return
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  render(timestamp: number) {
    this.audio.update()
    this.material.uniforms.uTime.value = timestamp / 1000
    this.material.uniforms.uAudioBeat.value = this.audio.signal.beat
    this.material.uniforms.uWaveLevel.value = this.audio.signal.level
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.scene.remove(this.points)
    this.geometry.dispose()
    this.material.dispose()
    this.texture.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
  }

  private createGeometry(aspect: number) {
    const positions = new Float32Array(COLUMNS * ROWS * 3)
    const uvs = new Float32Array(COLUMNS * ROWS * 2)
    const cameraDistance = 2.4
    const cameraFov = 50
    const viewportAspect = window.innerWidth / window.innerHeight
    const visibleHeight = 2 * cameraDistance * Math.tan(THREE.MathUtils.degToRad(cameraFov / 2))
    const worldHeight = Math.max(visibleHeight, visibleHeight * viewportAspect / aspect) * 1.04
    const worldWidth = worldHeight * aspect
    let index = 0
    for (let row = 0; row < ROWS; row += 1) {
      for (let column = 0; column < COLUMNS; column += 1) {
        const u = column / (COLUMNS - 1)
        const v = row / (ROWS - 1)
        positions[index * 3] = (u - 0.5) * worldWidth
        positions[index * 3 + 1] = (0.5 - v) * worldHeight
        positions[index * 3 + 2] = 0
        uvs[index * 2] = u
        uvs[index * 2 + 1] = 1 - v
        index += 1
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    return geometry
  }

  private createMaterial() {
    return new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        uTexture: { value: this.texture },
        uPointSize: { value: POINT_SIZE },
        uContrast: { value: IMAGE_CONTRAST },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.25) },
        uAudioBeat: { value: 0 },
        uWaveLevel: { value: 0 },
        uWaveAmplitude: { value: WAVE_AMPLITUDE },
        uTime: { value: 0 },
      },
      vertexShader: `
        uniform sampler2D uTexture;
        uniform float uPointSize;
        uniform float uContrast;
        uniform float uPixelRatio;
        uniform float uAudioBeat;
        uniform float uWaveLevel;
        uniform float uWaveAmplitude;
        uniform float uTime;
        out vec3 vColor;
        void main() {
          vec3 color = texture(uTexture, uv).rgb;
          color = clamp((color - 0.5) * uContrast + 0.5, 0.0, 1.0);
          vec3 position3d = position;
          float luminance = dot(color, vec3(0.299, 0.587, 0.114));
          position3d.z = (luminance - 0.5) * 0.18;
          float depthFactor = luminance - 0.5;
          float parallaxTime = uTime * (1.0 + depthFactor * ${PARALLAX_STRENGTH.toFixed(2)});
          float wave1 = sin(uv.x * ${WAVE_FREQUENCY.toFixed(2)} * 6.2831853 - parallaxTime * ${WAVE_SPEED.toFixed(2)});
          float wave2 = sin(uv.x * ${WAVE_FREQUENCY_2.toFixed(2)} * 6.2831853 - parallaxTime * ${WAVE_SPEED_2.toFixed(2)} + 1.7);
          float waveShape = wave1 * 0.65 + wave2 * 0.35;
          float amplitude = uWaveAmplitude * clamp(uWaveLevel * 2.5, 0.0, 1.0) * (0.5 + uAudioBeat * 0.7);
          position3d.y += waveShape * amplitude;
          position3d.z += waveShape * amplitude * 0.4;
          vec4 mvPosition = modelViewMatrix * vec4(position3d, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = uPointSize * uPixelRatio * (4.0 / -mvPosition.z) * (1.0 + uAudioBeat * 0.08);
          vColor = color;
        }
      `,
      fragmentShader: `
        precision highp float;
        in vec3 vColor;
        out vec4 fragColor;
        void main() {
          vec2 point = gl_PointCoord - vec2(0.5);
          if (dot(point, point) > 0.25) discard;
          fragColor = vec4(vColor, 1.0);
        }
      `,
    })
  }
}
