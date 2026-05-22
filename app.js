/**
 * Google Antigravity - High-Fidelity WebGL GPGPU Particle Background
 * Recreated from the official Google Antigravity simulation engine.
 */

// Helper: Linear mapping function
function linearMap(val, inMin, inMax, outMin, outMax) {
  return ((val - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

// 1D Value Noise Class (used for smooth organic cursor drift)
class ValueNoise1D {
  constructor() {
    this.MAX_VERTICES = 256;
    this.MAX_VERTICES_MASK = this.MAX_VERTICES - 1;
    this.amplitude = 1;
    this.scale = 1;
    this.r = [];
    for (let e = 0; e < this.MAX_VERTICES; ++e) {
      this.r.push(Math.random());
    }
  }
  getVal(e) {
    const t = e * this.scale;
    const i = Math.floor(t);
    const r = t - i;
    const o = r * r * (3 - 2 * r);
    const s = i % this.MAX_VERTICES_MASK;
    const a = (s + 1) % this.MAX_VERTICES_MASK;
    const l = this.lerp(this.r[s], this.r[a], o);
    return l * this.amplitude;
  }
  lerp(e, t, i) {
    return e * (1 - i) + t * i;
  }
}

// Bridson's Algorithm for Poisson Disk Sampling (Even particle distribution)
class PoissonDiskSampling {
  constructor(options) {
    this.shape = options.shape;
    this.minDistance = options.minDistance;
    this.tries = options.tries || 30;
    this.width = this.shape[0];
    this.height = this.shape[1];
  }

  fill() {
    const r = this.minDistance;
    const cellSize = r / Math.sqrt(2);
    const gridWidth = Math.ceil(this.width / cellSize);
    const gridHeight = Math.ceil(this.height / cellSize);
    const grid = new Array(gridWidth * gridHeight).fill(null);

    const activeList = [];
    const points = [];

    // Add first random point
    const firstPoint = [Math.random() * this.width, Math.random() * this.height];
    points.push(firstPoint);
    activeList.push(firstPoint);

    const col = Math.floor(firstPoint[0] / cellSize);
    const row = Math.floor(firstPoint[1] / cellSize);
    grid[col + row * gridWidth] = firstPoint;

    while (activeList.length > 0) {
      const idx = Math.floor(Math.random() * activeList.length);
      const point = activeList[idx];
      let found = false;

      for (let i = 0; i < this.tries; i++) {
        const theta = Math.random() * Math.PI * 2;
        const dist = r + Math.random() * r;
        const newX = point[0] + Math.cos(theta) * dist;
        const newY = point[1] + Math.sin(theta) * dist;

        if (newX >= 0 && newX < this.width && newY >= 0 && newY < this.height) {
          const c = Math.floor(newX / cellSize);
          const g = Math.floor(newY / cellSize);

          let ok = true;
          for (let xo = -1; xo <= 1; xo++) {
            for (let yo = -1; yo <= 1; yo++) {
              const nc = c + xo;
              const nr = g + yo;
              if (nc >= 0 && nc < gridWidth && nr >= 0 && nr < gridHeight) {
                const neighbor = grid[nc + nr * gridWidth];
                if (neighbor) {
                  const d = Math.hypot(newX - neighbor[0], newY - neighbor[1]);
                  if (d < r) {
                    ok = false;
                  }
                }
              }
            }
          }

          if (ok) {
            const newPoint = [newX, newY];
            points.push(newPoint);
            activeList.push(newPoint);
            grid[c + g * gridWidth] = newPoint;
            found = true;
            break;
          }
        }
      }

      if (!found) {
        activeList.splice(idx, 1);
      }
    }

    return points;
  }
}

// 2D/3D/4D Simplex Noise GLSL definition
const SIMPLEX_NOISE_GLSL = `
  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  float permute(float x){return floor(mod(((x*34.0)+1.0)*x, 289.0));}

  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
  float taylorInvSqrt(float r){return 1.79284291400159 - 0.85373472095314 * r;}

  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
             -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
    + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
      dot(x12.zw,x12.zw)), 0.0);
    m = m*m ;
    m = m*m ;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  float snoise(vec3 v){
    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy) );
    vec3 x0 =   v - i + dot(i, C.xxx) ;

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );

    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1. + 3.0 * C.xxx;

    i = mod(i, 289.0 );
    vec4 p = permute( permute( permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

    float n_ = 1.0/7.0;
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z *ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                  dot(p2,x2), dot(p3,x3) ) );
  }

  vec4 grad4(float j, vec4 ip){
    const vec4 ones = vec4(1.0, 1.0, 1.0, -1.0);
    vec4 p,s;
    p.xyz = floor( fract (vec3(j) * ip.xyz) * 7.0) * ip.z - 1.0;
    p.w = 1.5 - dot(abs(p.xyz), ones.xyz);
    s = vec4(lessThan(p, vec4(0.0)));
    p.xyz = p.xyz + (s.xyz*2.0 - 1.0) * s.www;
    return p;
  }

  float snoise(vec4 v){
    const vec2  C = vec2( 0.138196601125010504,  // (5 - sqrt(5))/20
                          0.309016994374947451); // (sqrt(5) - 1)/4
    vec4 i  = floor(v + dot(v, C.yyyy) );
    vec4 x0 = v -   i + dot(i, C.xxxx);

    vec4 i0;
    vec3 isX = step( x0.yzw, x0.xxx );
    vec3 isYZ = step( x0.zww, x0.yyz );
    i0.x = isX.x + isX.y + isX.z;
    i0.yzw = 1.0 - isX;

    i0.y += isYZ.x + isYZ.y;
    i0.zw += 1.0 - isYZ.xy;

    i0.z += isYZ.z;
    i0.w += 1.0 - isYZ.z;

    vec4 i3 = clamp( i0, 0.0, 1.0 );
    vec4 i2 = clamp( i0-1.0, 0.0, 1.0 );
    vec4 i1 = clamp( i0-2.0, 0.0, 1.0 );

    vec4 x1 = x0 - i1 + 1.0 * C.xxxx;
    vec4 x2 = x0 - i2 + 2.0 * C.xxxx;
    vec4 x3 = x0 - i3 + 3.0 * C.xxxx;
    vec4 x4 = x0 - 1.0 + 4.0 * C.xxxx;

    i = mod(i, 289.0);
    float j0 = permute( permute( permute( permute(i.w) + i.z) + i.y) + i.x);
    vec4 j1 = permute( permute( permute( permute (
              i.w + vec4(i1.w, i2.w, i3.w, 1.0 ))
            + i.z + vec4(i1.z, i2.z, i3.z, 1.0 ))
            + i.y + vec4(i1.y, i2.y, i3.y, 1.0 ))
            + i.x + vec4(i1.x, i2.x, i3.x, 1.0 ));

    vec4 ip = vec4(1.0/294.0, 1.0/49.0, 1.0/7.0, 0.0) ;

    vec4 p0 = grad4(j0,   ip);
    vec4 p1 = grad4(j1.x, ip);
    vec4 p2 = grad4(j1.y, ip);
    vec4 p3 = grad4(j1.z, ip);
    vec4 p4 = grad4(j1.w, ip);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    p4 *= taylorInvSqrt(dot(p4,p4));

    vec3 m0 = max(0.6 - vec3(dot(x0,x0), dot(x1,x1), dot(x2,x2)), 0.0);
    vec2 m1 = max(0.6 - vec2(dot(x3,x3), dot(x4,x4)            ), 0.0);
    m0 = m0 * m0;
    m1 = m1 * m1;
    return 49.0 * ( dot(m0*m0, vec3( dot( p0, x0 ), dot( p1, x1 ), dot( p2, x2 )))
                + dot(m1*m1, vec2( dot( p3, x3 ), dot( p4, x4 ) ) ) ) ;
  }
`;

// Helper: Custom sRGB Transfer OETF definition to resolve shader binding errors
const SRGB_TRANSFER_GLSL = `
  vec4 sRGBTransferOETF( in vec4 value ) {
    return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, step( value.rgb, vec3( 0.0031308 ) ) ), value.a );
  }
`;

class AntigravityParticles {
  constructor(scene) {
    this.scene = scene;
    this.renderer = scene.renderer;
    this.gl = this.renderer.getContext();
    this.camera = scene.camera;
    this.lastTime = 0;
    this.everRendered = false;
    this.ringPos = new THREE.Vector2(0, 0);
    this.cursorPos = new THREE.Vector2(0, 0);
    this.colorScheme = scene.theme === "dark" ? 0 : 1;

    // Scale particles based on screen size
    const w = this.renderer.domElement.width;
    this.particleScale = (w / this.scene.pixelRatio / 2000.0) * this.scene.particlesScale;

    this.size = 256;
    this.length = this.size * this.size;

    this.createPoints();
    this.init();
  }

  createPoints() {
    const minDistance = linearMap(this.scene.density, 0, 300, 10, 2);
    const maxDistance = linearMap(this.scene.density, 0, 300, 11, 3);

    const sampler = new PoissonDiskSampling({
      shape: [500, 500],
      minDistance: minDistance,
      tries: 20
    });

    const t = sampler.fill();
    this.pointsData = [];
    for (let i = 0; i < t.length; i++) {
      this.pointsData.push(t[i][0] - 250, t[i][1] - 250);
    }
    this.count = Math.min(this.pointsData.length / 2, this.length);
  }

  createDataTexturePosition() {
    const e = new Float32Array(this.length * 4);
    for (let i = 0; i < this.count; i++) {
      const r = i * 4;
      e[r + 0] = this.pointsData[i * 2 + 0] * (1.0 / 250.0);
      e[r + 1] = this.pointsData[i * 2 + 1] * (1.0 / 250.0);
      e[r + 2] = 0.0;
      e[r + 3] = 0.0;
    }
    const t = new THREE.DataTexture(e, this.size, this.size, THREE.RGBAFormat, THREE.FloatType);
    t.needsUpdate = true;
    return t;
  }

  createRenderTarget() {
    return new THREE.WebGLRenderTarget(this.size, this.size, {
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      depthBuffer: false,
      stencilBuffer: false
    });
  }

  init() {
    this.posTex = this.createDataTexturePosition();
    this.rt1 = this.createRenderTarget();
    this.rt2 = this.createRenderTarget();

    this.renderer.setRenderTarget(this.rt1);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear();
    this.renderer.setRenderTarget(this.rt2);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear();
    this.renderer.setRenderTarget(null);

    this.noise = new ValueNoise1D();
    this.simScene = new THREE.Scene();
    this.simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // GPGPU Simulation Shader
    this.simMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uPosition: { value: this.posTex },
        uPosRefs: { value: this.posTex },
        uRingPos: { value: new THREE.Vector2(0, 0) },
        uRingRadius: { value: 0.2 },
        uDeltaTime: { value: 0.0 },
        uRingWidth: { value: 0.05 },
        uRingWidth2: { value: 0.015 },
        uRingDisplacement: { value: this.scene.ringDisplacement },
        uTime: { value: 0.0 }
      },
      vertexShader: `
        void main() {
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform sampler2D uPosition;
        uniform sampler2D uPosRefs;
        uniform vec2 uRingPos;
        uniform float uTime;
        uniform float uDeltaTime;
        uniform float uRingRadius;

        uniform float uRingWidth;
        uniform float uRingWidth2;
        uniform float uRingDisplacement;

        ${SIMPLEX_NOISE_GLSL}

        void main() {
          vec2 simTexCoords = gl_FragCoord.xy / vec2(256.0, 256.0);
          vec4 pFrame = texture2D(uPosition, simTexCoords);

          float scale = pFrame.z;
          float velocity = pFrame.w;
          vec2 refPos = texture2D(uPosRefs, simTexCoords).xy;

          float time = uTime * 0.5;
          vec2 curentPos = refPos;

          vec2 pos = pFrame.xy;
          pos *= 0.8;

          float dist = distance(curentPos.xy, uRingPos);
          float noise0 = snoise(vec3(curentPos.xy * 0.2 + vec2(18.4924, 72.9744), time * 0.5));
          float dist1 = distance(curentPos.xy + (noise0 * 0.005), uRingPos);

          float t = smoothstep(uRingRadius - (uRingWidth * 2.0), uRingRadius, dist) - smoothstep(uRingRadius, uRingRadius + uRingWidth, dist1);
          float t2 = smoothstep(uRingRadius - (uRingWidth2 * 2.0), uRingRadius, dist) - smoothstep(uRingRadius, uRingRadius + uRingWidth2, dist1);
          float t3 = smoothstep(uRingRadius + uRingWidth2, uRingRadius, dist);

          t = pow(t, 2.0);
          t2 = pow(t2, 3.0);

          t += t2 * 3.0;
          t += t3 * 0.4;
          t += snoise(vec3(curentPos.xy * 30.0 + vec2(11.4924, 12.9744), time * 0.5)) * t3 * 0.5;

          float nS = snoise(vec3(curentPos.xy * 2.0 + vec2(18.4924, 72.9744), time * 0.5));
          t += pow((nS + 1.5) * 0.5, 2.0) * 0.6;

          // Mid scale noise
          float noise1 = snoise(vec3(curentPos.xy * 4.0 + vec2(88.494, 32.4397), time * 0.35));
          float noise2 = snoise(vec3(curentPos.xy * 4.0 + vec2(50.904, 120.947), time * 0.35));

          // Close scale noise
          float noise3 = snoise(vec3(curentPos.xy * 20.0 + vec2(18.4924, 72.9744), time * 0.5));
          float noise4 = snoise(vec3(curentPos.xy * 20.0 + vec2(50.904, 120.947), time * 0.5));

          vec2 disp = vec2(noise1, noise2) * 0.03;
          disp += vec2(noise3, noise4) * 0.005;

          // Sin wave
          disp.x += sin((refPos.x * 20.0) + (time * 4.0)) * 0.02 * clamp(dist, 0.0, 1.0);
          disp.y += cos((refPos.y * 20.0) + (time * 3.0)) * 0.02 * clamp(dist, 0.0, 1.0);

          pos -= (uRingPos - (curentPos + disp)) * pow(t2, 0.75) * uRingDisplacement;

          // Add scale
          float scaleDiff = t - scale;
          scaleDiff *= 0.2;
          scale += scaleDiff;

          // Final position
          vec2 finalPos = curentPos + disp + (pos * 0.25);

          velocity *= 0.5;
          velocity += scale * 0.25;

          gl_FragColor = vec4(finalPos, scale, velocity);
        }
      `
    });

    const simQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.simMaterial);
    this.simScene.add(simQuad);

    // Render Geometry & Material
    const geom = new THREE.BufferGeometry();
    const uvs = new Float32Array(this.count * 2);
    const dummyPositions = new Float32Array(this.count * 3);
    const seeds = new Float32Array(this.count * 4);

    for (let s = 0; s < this.count; s++) {
      const a = s % this.size;
      const l = Math.floor(s / this.size);
      uvs[s * 2] = a / this.size;
      uvs[s * 2 + 1] = l / this.size;
    }
    for (let s = 0; s < this.count; s++) {
      seeds[s * 4] = Math.random();
      seeds[s * 4 + 1] = Math.random();
      seeds[s * 4 + 2] = Math.random();
      seeds[s * 4 + 3] = Math.random();
    }

    geom.setAttribute("position", new THREE.BufferAttribute(dummyPositions, 3));
    geom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geom.setAttribute("seeds", new THREE.BufferAttribute(seeds, 4));

    this.renderMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uPosition: { value: this.posTex },
        uTime: { value: 0.0 },
        uColor1: { value: new THREE.Color(this.scene.colorControls.color1) },
        uColor2: { value: new THREE.Color(this.scene.colorControls.color2) },
        uColor3: { value: new THREE.Color(this.scene.colorControls.color3) },
        uAlpha: { value: 1.0 },
        uRingPos: { value: new THREE.Vector2(0, 0) },
        uRez: { value: new THREE.Vector2(this.renderer.domElement.width, this.renderer.domElement.height) },
        uParticleScale: { value: this.particleScale },
        uPixelRatio: { value: this.scene.pixelRatio },
        uColorScheme: { value: this.colorScheme }
      },
      vertexShader: `
        precision highp float;
        attribute vec4 seeds;

        uniform sampler2D uPosition;
        uniform float uTime;
        uniform float uParticleScale;
        uniform float uPixelRatio;
        uniform int uColorScheme;

        varying vec4 vSeeds;
        varying float vVelocity;
        varying vec2 vLocalPos;
        varying vec2 vScreenPos;
        varying float vScale;

        void main() {
          vec4 pos = texture2D(uPosition, uv);
          vSeeds = seeds;

          vVelocity = pos.w;
          vScale = pos.z;
          vLocalPos = pos.xy;
          
          vec4 viewSpace = modelViewMatrix * vec4(vec3(pos.xy, 0.0), 1.0);
          gl_Position = projectionMatrix * viewSpace;
          vScreenPos = gl_Position.xy;

          gl_PointSize = ((vScale * 7.0) * (uPixelRatio * 0.5) * uParticleScale);
        }
      `,
      fragmentShader: `
        precision highp float;

        varying vec4 vSeeds;
        varying vec2 vScreenPos;
        varying vec2 vLocalPos;
        varying float vScale;
        varying float vVelocity;

        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform vec3 uColor3;

        uniform vec2 uRingPos;
        uniform vec2 uRez;

        uniform float uAlpha;
        uniform float uTime;

        uniform int uColorScheme;

        ${SIMPLEX_NOISE_GLSL}
        ${SRGB_TRANSFER_GLSL}

        #define PI 3.14159265358979323846

        // Rounded box signed distance field
        float sdRoundBox( in vec2 p, in vec2 b, in vec4 r ) {
          r.xy = (p.x > 0.0) ? r.xy : r.zw;
          r.x  = (p.y > 0.0) ? r.x  : r.y;
          vec2 q = abs(p) - b + r.x;
          return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r.x;
        }

        vec2 rotate(vec2 v, float a) {
          float s = sin(a);
          float c = cos(a);
          mat2 m = mat2(c, s, -s, c);
          return m * v;
        }

        void main() {
          float uBorderSize = 0.2;
          float ratio = uRez.x / uRez.y;

          // Multi-scale angle and color noise
          float noiseAngle = snoise(vec3(vLocalPos * 10.0 + vec2(18.4924, 72.9744), uTime * 0.85));
          float noiseColor = snoise(vec3(vLocalPos * 2.0 + vec2(74.664, 91.556), uTime * 0.5));
          noiseColor = (noiseColor + 1.0) * 0.5;

          // Tangential angle relative to the cursor ring position
          float angle = atan(vLocalPos.y - uRingPos.y, vLocalPos.x - uRingPos.x);

          vec2 uv = gl_PointCoord.xy;
          uv -= vec2(0.5);
          uv.y *= -1.0;
          uv = rotate(uv, -angle + (noiseAngle * 0.5));

          float h = 0.8;
          float progress = smoothstep(0.0, 0.75, pow(noiseColor, 2.0));
          vec3 col = mix(mix(uColor1, uColor2, progress/h), mix(uColor2, uColor3, (progress - h)/(1.0 - h)), step(h, progress));
          vec3 color = col;

          float dist = sqrt(dot(uv, uv));
          float rounded = sdRoundBox(uv, vec2(0.5, 0.2), vec4(0.25));
          rounded = smoothstep(0.1, 0.0, rounded);

          float a = uAlpha * rounded * smoothstep(0.1, 0.2, vScale);

          if (a < 0.01) {
            discard;
          }

          color = clamp(color, 0.0, 1.0);
          color = mix(color, color * clamp(vVelocity, 0.0, 1.0), float(uColorScheme));

          gl_FragColor = vec4(color, clamp(a, 0.0, 1.0));

          #ifdef SRGB_TRANSFER
            gl_FragColor = sRGBTransferOETF( gl_FragColor );
          #endif
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });

    this.mesh = new THREE.Points(geom, this.renderMaterial);
    this.mesh.position.set(0, 0, 0);
    this.mesh.scale.set(5, 5, 5);
    this.scene.scene.add(this.mesh);
  }

  resize() {
    const w = this.renderer.domElement.width;
    const h = this.renderer.domElement.height;
    this.particleScale = (w / this.scene.pixelRatio / 2000.0) * this.scene.particlesScale;

    this.renderMaterial.uniforms.uRez.value.set(w, h);
    this.renderMaterial.uniforms.uPixelRatio.value = this.scene.pixelRatio;
    this.renderMaterial.uniforms.uParticleScale.value = this.particleScale;
    this.renderMaterial.needsUpdate = true;
  }

  update() {
    const elapsed = this.scene.clock.getElapsedTime();
    const e = elapsed - this.lastTime;
    this.lastTime = elapsed;

    // Organic drift calculation
    const t = (this.noise.getVal(this.scene.time * 0.66 + 94.234) - 0.5) * 2.0;
    const i = (this.noise.getVal(this.scene.time * 0.75 + 21.028) - 0.5) * 2.0;

    if (this.scene.isIntersecting) {
      this.cursorPos.set(
        this.scene.intersectionPoint.x * 0.175 + t * 0.1,
        this.scene.intersectionPoint.y * 0.175 + i * 0.1
      );
      this.ringPos.set(
        this.ringPos.x + (this.cursorPos.x - this.ringPos.x) * 0.02,
        this.ringPos.y + (this.cursorPos.y - this.ringPos.y) * 0.02
      );
    } else {
      this.cursorPos.set(t * 0.2, i * 0.1);
      this.ringPos.set(
        this.ringPos.x + (this.cursorPos.x - this.ringPos.x) * 0.01,
        this.ringPos.y + (this.cursorPos.y - this.ringPos.y) * 0.01
      );
    }

    const w = this.renderer.domElement.width;
    this.particleScale = (w / this.scene.pixelRatio / 2000.0) * this.scene.particlesScale;

    // Set simulator uniforms & run simulation shader write-to-texture
    this.simMaterial.uniforms.uPosition.value = this.everRendered ? this.rt1.texture : this.posTex;
    this.simMaterial.uniforms.uTime.value = elapsed;
    this.simMaterial.uniforms.uDeltaTime.value = e;
    this.simMaterial.uniforms.uRingRadius.value = 0.175 + Math.sin(this.scene.time * 1.0) * 0.03 + Math.cos(this.scene.time * 3.0) * 0.02;
    this.simMaterial.uniforms.uRingPos.value = this.ringPos;
    this.simMaterial.uniforms.uRingWidth.value = this.scene.ringWidth;
    this.simMaterial.uniforms.uRingWidth2.value = this.scene.ringWidth2;
    this.simMaterial.uniforms.uRingDisplacement.value = this.scene.ringDisplacement;

    // Render to rt2
    this.renderer.setRenderTarget(this.rt2);
    this.renderer.render(this.simScene, this.simCamera);
    this.renderer.setRenderTarget(null);

    // Map simulated texture outputs back to the points render material
    this.renderMaterial.uniforms.uPosition.value = this.everRendered ? this.rt2.texture : this.posTex;
    this.renderMaterial.uniforms.uTime.value = elapsed;
    this.renderMaterial.uniforms.uRingPos.value = this.ringPos;
    this.renderMaterial.uniforms.uParticleScale.value = this.particleScale;
  }

  postRender() {
    const e = this.rt1;
    this.rt1 = this.rt2;
    this.rt2 = e;
    this.everRendered = true;
  }

  kill() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.rt1.dispose();
    this.rt2.dispose();
    this.posTex.dispose();
    this.simMaterial.dispose();
    this.renderMaterial.dispose();
  }
}

class AntigravityScene {
  constructor(options) {
    this.loaded = false;
    this.options = options || {};
    this.theme = options.theme || "light";
    this.interactive = options.interactive !== undefined ? options.interactive : true;

    this.pixelRatio = options.pixelRatio || window.devicePixelRatio;
    this.particlesScale = options.particlesScale || 1.0;
    this.density = options.density || 200;

    this.scene = new THREE.Scene();

    // Select default background based on theme (fully transparent canvas overlays better on style grids)
    this.canvas = options.canvas || document.getElementById("gravity-canvas");
    const container = options.container || document.body;
    this.canvas.width = container.clientWidth || window.innerWidth;
    this.canvas.height = container.clientHeight || window.innerHeight;

    // WebGLRenderer with float color buffer configs
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
      stencil: false,
      precision: "highp"
    });
    this.gl = this.renderer.getContext();
    this.renderer.extensions.get("EXT_color_buffer_float");
    this.renderer.setSize(this.canvas.width, this.canvas.height);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setClearColor(0x000000, 0);

    this.initCamera();

    // Projected virtual plane for cursor intersection raycasting
    this.raycastPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(12.5, 12.5),
      new THREE.MeshBasicMaterial({ color: 0xff0000, visible: false, side: THREE.DoubleSide })
    );
    this.scene.add(this.raycastPlane);

    this.clock = new THREE.Clock();
    this.time = 0.0;
    this.lastTime = 0.0;
    this.dt = 0.0;
    this.skipFrame = false;
    this.isPaused = false;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.intersectionPoint = new THREE.Vector3();
    this.isIntersecting = false;
    this.mouseIsOver = false;

    this.rawMouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    this.initScene();
    this.initEvents();

    this.loaded = true;
  }

  initCamera() {
    this.camera = new THREE.PerspectiveCamera(40, this.canvas.width / this.canvas.height, 0.1, 1000);
    this.camera.position.z = 3.1;
  }

  initScene() {
    this.colorControls = {
      color1: "#38BDF8",
      color2: "#1D4ED8",
      color3: "#7C3AED"
    };

    this.ringWidth = this.options.ringWidth !== undefined ? this.options.ringWidth : 0.006;
    this.ringWidth2 = this.options.ringWidth2 !== undefined ? this.options.ringWidth2 : 0.107;
    this.ringDisplacement = this.options.ringDisplacement !== undefined ? this.options.ringDisplacement : 0.62;

    this.initParticles();
  }

  initParticles() {
    this.particles = new AntigravityParticles(this);
  }

  initEvents() {
    window.addEventListener("resize", () => this.onWindowResize());

    window.addEventListener("mousemove", (e) => {
      this.rawMouse.x = e.clientX;
      this.rawMouse.y = e.clientY;
      this.mouseIsOver = true;
    });

    window.addEventListener("mouseleave", () => {
      this.mouseIsOver = false;
    });

    window.addEventListener("mouseenter", (e) => {
      this.rawMouse.x = e.clientX;
      this.rawMouse.y = e.clientY;
      this.mouseIsOver = true;
    });

    window.addEventListener("touchmove", (e) => {
      if (e.touches.length > 0) {
        this.rawMouse.x = e.touches[0].clientX;
        this.rawMouse.y = e.touches[0].clientY;
        this.mouseIsOver = true;
      }
    }, { passive: true });

    window.addEventListener("touchstart", (e) => {
      if (e.touches.length > 0) {
        this.rawMouse.x = e.touches[0].clientX;
        this.rawMouse.y = e.touches[0].clientY;
        this.mouseIsOver = true;
      }
    }, { passive: true });

    window.addEventListener("touchend", () => {
      this.mouseIsOver = false;
    });
  }

  onWindowResize() {
    const container = this.options.container || document.body;
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;

    this.canvas.width = w;
    this.canvas.height = h;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.particles) {
      this.particles.resize();
    }
  }

  preRender() {
    const elapsed = this.clock.getElapsedTime();
    this.dt = elapsed - this.lastTime;
    this.lastTime = elapsed;
    this.time += this.dt;

    if (this.particles) {
      this.particles.update();
    }

    if (this.interactive && !this.skipFrame) {
      const container = this.options.container || document.body;
      const t = this.canvas.getBoundingClientRect();
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;

      this.mouse.x = (this.rawMouse.x - t.left) * (w / t.width);
      this.mouse.y = (this.rawMouse.y - t.top) * (h / t.height);
      this.mouse.x = (this.mouse.x / w) * 2 - 1;
      this.mouse.y = -(this.mouse.y / h) * 2 + 1;

      if (this.mouse.x < -1 || this.mouse.x > 1 || this.mouse.y < -1 || this.mouse.y > 1) {
        this.mouseIsOver = false;
      } else {
        this.mouseIsOver = true;
      }
    }

    this.skipFrame = !this.skipFrame;
    if (this.skipFrame) return;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.raycastPlane);
    if (intersects.length > 0 && this.mouseIsOver) {
      this.intersectionPoint.copy(intersects[0].point);
      this.isIntersecting = true;
    } else {
      this.isIntersecting = false;
    }
  }

  render() {
    if (!this.loaded || this.isPaused) return;
    this.preRender();
    this.renderer.setRenderTarget(null);
    this.renderer.autoClear = false;
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.postRender();
  }

  postRender() {
    if (this.particles) {
      this.particles.postRender();
    }
  }

  stop() {
    this.isPaused = true;
    this.clock.stop();
  }

  resume() {
    this.isPaused = false;
    this.clock.start();
  }

  kill() {
    this.stop();
    if (this.raycastPlane) {
      this.scene.remove(this.raycastPlane);
      this.raycastPlane.geometry.dispose();
      this.raycastPlane.material.dispose();
    }
    if (this.particles) {
      this.scene.remove(this.particles.mesh);
      this.particles.kill();
    }
    this.renderer.dispose();
  }
}

// AngularJS Module, Controller and Directive Setup
angular.module('antigravityApp', [])
  .controller('AntigravityController', ['$scope', function ($scope) {
    $scope.title = "COMING SOON";
  }])
  .directive('antigravityCanvas', function () {
    return {
      restrict: 'A',
      link: function (scope, element, attrs) {
        const sceneInstance = new AntigravityScene({
          canvas: element[0],
          container: document.body,
          theme: "light",
          particlesScale: 0.59,
          density: 230,
          ringWidth: 0.006,
          ringWidth2: 0.107,
          ringDisplacement: 0.62,
          interactive: true
        });

        let animationFrameId;
        function loop() {
          animationFrameId = requestAnimationFrame(loop);
          sceneInstance.render();
        }
        loop();

        // Clean up resources on directive destroy
        scope.$on('$destroy', function () {
          if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
          }
          sceneInstance.kill();
        });
      }
    };
  });

