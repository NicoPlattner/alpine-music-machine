export const leoPointVertexShader = `
  uniform sampler2D uVideoTex;
  uniform sampler2D uMaskTex;
  uniform vec3 uColorTint;
  uniform float uColorMix;
  uniform float uShadeMin;
  uniform float uDepthScale;
  uniform float uPointSize;
  uniform float uPixelRatio;
  uniform float uTime;
  uniform float uTrailDelay;
  uniform vec2 uMotion;
  uniform float uAudioBeat;
  uniform vec2 uMaskTexel;
  out vec3 vColor;
  out float vMask;

  void main() {
    vec4 videoColor = texture(uVideoTex, uv);
    float mask = texture(uMaskTex, uv).r;
    float edge = 0.0;
    edge = max(edge, abs(mask - texture(uMaskTex, uv + vec2(uMaskTexel.x, 0.0)).r));
    edge = max(edge, abs(mask - texture(uMaskTex, uv - vec2(uMaskTexel.x, 0.0)).r));
    edge = max(edge, abs(mask - texture(uMaskTex, uv + vec2(0.0, uMaskTexel.y)).r));
    edge = max(edge, abs(mask - texture(uMaskTex, uv - vec2(0.0, uMaskTexel.y)).r));
    float edgeFactor = smoothstep(0.015, 0.12, edge);
    float luminance = dot(videoColor.rgb, vec3(0.299, 0.587, 0.114));
    vec3 pos = position;
    pos.z += (luminance - 0.5) * uDepthScale;
    float seed = uv.x * 127.1 + uv.y * 311.7;
    float drift = uTrailDelay * length(uMotion);
    float phase = seed + uTime * (2.0 + uTrailDelay * 0.18);
    pos.x += uMotion.x * uTrailDelay * 6.5;
    pos.y += uMotion.y * uTrailDelay * 6.5;
    pos.z += sin(phase) * drift * 1.2;
    pos.x += sin(phase) * drift * 0.9;
    pos.y += cos(phase * 0.8) * drift * 0.9;
    pos.z += sin(phase * 1.7) * uAudioBeat * 0.55 * edgeFactor;
    pos.x += cos(phase * 0.7) * uAudioBeat * 0.2 * edgeFactor;
    pos.y += sin(phase * 0.9) * uAudioBeat * 0.2 * edgeFactor;
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = uPointSize * uPixelRatio * (4.0 / -mvPosition.z) * (1.0 + uTrailDelay * 0.035 + uAudioBeat * 0.22 * edgeFactor);
    vec3 baseColor = mix(videoColor.rgb, uColorTint, uColorMix);
    float shade = uShadeMin + luminance * (1.0 - uShadeMin);
    vColor = baseColor * shade * (1.0 + uTrailDelay * 0.035);
    vMask = mask;
  }
`

export const leoPointFragmentShader = `
  precision highp float;
  in vec3 vColor;
  in float vMask;
  uniform float uTrailOpacity;
  out vec4 fragColor;

  void main() {
    float edgeAlpha = smoothstep(0.12, 0.38, vMask);
    if (edgeAlpha <= 0.0) discard;
    vec2 c = gl_PointCoord - vec2(0.5);
    if (dot(c, c) > 0.25) discard;
    fragColor = vec4(vColor, uTrailOpacity * edgeAlpha);
  }
`

export const leoGlowVertexShader = `
  out vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const leoGlowFragmentShader = `
  precision highp float;
  in vec2 vUv;
  uniform sampler2D uMaskTex;
  uniform vec2 uMaskTexel;
  uniform float uOpacity;
  uniform float uBlurRadius;
  out vec4 fragColor;

  void main() {
    vec2 maskUv = vec2(1.0 - vUv.x, vUv.y);
    float sum = 0.0;
    float weightSum = 0.0;
    const int R = 4;
    for (int dx = -R; dx <= R; dx++) {
      for (int dy = -R; dy <= R; dy++) {
        vec2 offset = vec2(float(dx), float(dy));
        float weight = max(0.0, 1.0 - length(offset) / float(R + 1));
        sum += texture(uMaskTex, maskUv + offset * uMaskTexel * uBlurRadius).r * weight;
        weightSum += weight;
      }
    }
    float mask = sum / weightSum;
    float alpha = mask * uOpacity;
    if (alpha < 0.003) discard;
    fragColor = vec4(1.0, 1.0, 1.0, alpha);
  }
`
