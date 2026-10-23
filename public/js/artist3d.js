// Sanatçı sayfası 3D sahnesi: sanatçı fotoğrafı bir plak kılıfında durur, arkasından plak kayarak çıkar.
// Şarkı çalarken plak 33 devirde döner, ortasında çalan parçanın kapağı görünür. Fotoğraf sabit kalır (dalga efekti yok).
import * as THREE from 'three';
import { player } from './player.js';
import { isTouch } from './common.js';

const sleeveFrag = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec2 uCrop;
  uniform vec3 uAccent;
  uniform float uTime, uIntro;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    if (vUv.y > uIntro * 1.2) discard;                              // giriş: alttan açılan perde
    vec2 uv = vUv;
    vec2 c = uv - 0.5;
    vec3 col = texture2D(uMap, (uv - 0.5) * uCrop + 0.5).rgb;
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, col * uAccent * 1.5, (1.0 - lum) * 0.18);       // gölgelerde hafif vurgu rengi
    col *= 1.0 - smoothstep(0.35, 0.75, length(c)) * 0.35;          // vinyet
    col += (hash(vUv * 900.0 + uTime) - 0.5) * 0.04;                // baskı grenli doku
    col = mix(col, vec3(0.08), step(0.494, max(abs(c.x), abs(c.y))) * 0.7);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const vinylFrag = /* glsl */ `
  uniform sampler2D uLabel;
  uniform float uRot;
  uniform vec3 uAccent;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;
    if (r > 1.0 || r < 0.025) discard;
    vec3 col;
    if (r < 0.34) {
      col = texture2D(uLabel, p / 0.34 + 0.5).rgb;
      col *= 1.0 - smoothstep(0.3, 0.34, r) * 0.5;
    } else {
      float a = atan(p.y, p.x) + uRot;                               // parlama ışığa göre sabit kalsın
      float groove = 0.5 + 0.5 * sin(r * 520.0);
      col = vec3(0.045 + groove * 0.025);
      col += (pow(abs(cos(a - 0.6)), 24.0) * 0.22 + pow(abs(cos(a + 2.2)), 40.0) * 0.12) * (0.6 + 0.4 * groove);
      col += uAccent * smoothstep(0.96, 1.0, r) * 0.15;
    }
    gl_FragColor = vec4(col, 1.0 - smoothstep(0.992, 1.0, r));
  }
`;

const glowFrag = /* glsl */ `
  uniform vec3 uAccent;
  uniform float uLevel, uOpacity;
  varying vec2 vUv;
  void main() {
    float g = pow(max(0.0, 1.0 - length(vUv - 0.5) * 2.0), 2.2);
    gl_FragColor = vec4(uAccent * g, g * (0.2 + uLevel * 0.9) * uOpacity);
  }
`;

const shadowFrag = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vec2 c = abs(vUv - 0.5) * 2.0;
    gl_FragColor = vec4(0.0, 0.0, 0.0, (1.0 - smoothstep(0.55, 1.0, max(c.x, c.y))) * 0.75);
  }
`;

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const loader = new THREE.TextureLoader();
const loadTex = (url) => new Promise((res) => loader.load(url, (t) => { t.anisotropy = 4; res(t); }, undefined, () => res(null)));
const cropFor = (t) => {
  if (!t?.image) return new THREE.Vector2(1, 1);
  const a = t.image.width / t.image.height;
  return a > 1 ? new THREE.Vector2(1 / a, 1) : new THREE.Vector2(1, a);
};

export async function initPortrait(canvas, { image, accent = '#ff8a1f', cover }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  const accentCol = new THREE.Color(accent);
  const [photo, label] = await Promise.all([loadTex(image), loadTex(cover || image)]);

  const S = 3.2;
  const group = new THREE.Group();
  scene.add(group);

  const glowU = { uAccent: { value: accentCol }, uLevel: { value: 0 }, uOpacity: { value: 1 } };
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: glowFrag, uniforms: glowU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  glow.position.set(0.6, 0, -0.6);
  group.add(glow);

  const vinylU = { uLabel: { value: label }, uRot: { value: 0 }, uAccent: { value: accentCol } };
  const vinyl = new THREE.Mesh(new THREE.PlaneGeometry(S * 0.94, S * 0.94), new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: vinylFrag, uniforms: vinylU, transparent: true,
  }));
  vinyl.position.z = -0.08;
  group.add(vinyl);

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(S * 1.25, S * 1.25), new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: shadowFrag, transparent: true, depthWrite: false,
  }));
  shadow.position.set(-0.12, -0.18, -0.04);
  group.add(shadow);

  const sleeveU = {
    uMap: { value: photo }, uCrop: { value: cropFor(photo) }, uAccent: { value: accentCol },
    uTime: { value: 0 }, uIntro: { value: 0 },
  };
  group.add(new THREE.Mesh(new THREE.PlaneGeometry(S, S), new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: sleeveFrag, uniforms: sleeveU })));

  // çalan parçanın kapağı plağın ortasına gelir
  let labelSrc = cover;
  player.on(async ({ track }) => {
    const src = track?.cover;
    if (!src || src === labelSrc) return;
    labelSrc = src;
    const t = await loadTex(src);
    if (t) vinylU.uLabel.value = t;
  });

  const base = { x: 0, y: 0, s: 1 };
  const layout = () => {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const wide = w / h > 1.1;
    const halfW = Math.tan(THREE.MathUtils.degToRad(17.5)) * camera.position.z * camera.aspect;
    base.s = wide ? 1 : Math.min(0.8, (halfW * 2 * 0.6) / S);
    base.x = wide ? Math.max(1.2, halfW - S * 0.5 - 2.7) : -0.3 * base.s;
    base.y = wide ? 0.1 : 1.15;
  };
  layout();
  addEventListener('resize', layout);

  const mouse = { x: 0, y: 0 };
  if (!isTouch) addEventListener('pointermove', (e) => { mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });

  const clock = new THREE.Clock();
  const t0 = performance.now();
  const lerp = (a, b, t) => a + (b - a) * t;
  let slide = 0, spin = 0;

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = (sleeveU.uTime.value += dt);
    const intro = Math.min(1, (performance.now() - t0) / 1400);
    sleeveU.uIntro.value = 1 - Math.pow(1 - intro, 3);

    const lv = player.levels();
    const playing = !player.audio.paused;
    glowU.uLevel.value = lerp(glowU.uLevel.value, lv.level, 0.2);

    // plak: çalarken dışarı kayar ve yavaşça döner
    slide = lerp(slide, intro < 1 ? 0 : playing ? 1 : 0.38, 0.05);
    spin = lerp(spin, playing ? 2.62 : 0.19, 0.03);
    vinyl.rotation.z -= spin * dt;
    vinylU.uRot.value = vinyl.rotation.z;
    vinyl.position.x = slide * S * 0.52;

    const sp = Math.min(1, scrollY / innerHeight);
    group.position.set(base.x, base.y + sp * 2.2 + Math.sin(t * 0.8) * 0.05, -sp * 1.5);
    group.scale.setScalar(base.s);
    group.rotation.y = lerp(group.rotation.y, -0.22 + mouse.x * 0.18, 0.06);
    group.rotation.x = lerp(group.rotation.x, mouse.y * 0.1 + sp * 0.3, 0.06);
    glowU.uOpacity.value = 1 - sp;
    canvas.style.opacity = String(Math.max(0, 1 - sp * 1.4)); // aşağıda metnin arkasında kalmasın

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  frame();
}
