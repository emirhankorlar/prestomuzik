// Ana sayfa 3D sahnesi: PM logosu parçacıklardan oluşur, scroll ile ses dalgası
// arazisine ve ardından dönen bir plağa dönüşür. Çalan önizleme müziğine tepki verir.
import * as THREE from 'three';
import { player } from './player.js';
import { isTouch, reducedMotion } from './common.js';

const vertex = /* glsl */ `
  uniform float uTime, uMorph, uSize, uPixel, uBass, uMid, uLevel, uIntro;
  uniform vec2 uMouse;
  uniform float uLogoX;
  attribute vec3 aLogo;
  attribute vec3 aField;
  attribute vec3 aRing;
  attribute float aRand;
  varying float vRand;
  varying float vA;
  varying float vShape;

  vec3 hash3(float n) { return fract(sin(vec3(n, n + 1.7, n + 3.1)) * 43758.5453) * 2.0 - 1.0; }

  void main() {
    float t = uTime;

    // 1) logo
    vec3 logo = aLogo;
    logo.z += sin(t * 1.2 + aLogo.x * 1.7 + aLogo.y * 1.3) * 0.06;
    logo.xy *= 1.0 + uBass * 0.1;
    logo.z += uMid * aRand * 0.8;
    logo.x += uLogoX;
    vec2 d = logo.xy - uMouse;
    float md = length(d);
    float push = smoothstep(1.2, 0.0, md);
    logo.xy += normalize(d + 1e-4) * push * 0.5;
    logo.z += push * 0.9 * (aRand - 0.3);

    // 2) ses dalgası arazisi
    vec3 field = aField;
    float r = length(field.xz);
    float w = sin(field.x * 0.55 + t * 0.9) * 0.38
            + sin(field.z * 0.8 - t * 0.7) * 0.28
            + sin((field.x + field.z) * 0.35 + t * 0.5) * 0.4;
    w += sin(r * 1.5 - t * 3.0) * (0.1 + uBass * 1.1) * smoothstep(9.0, 0.0, r);
    field.y = w - 1.2;

    // 3) plak
    float ang = aRing.y + t * (0.1 + 0.12 / aRing.x);
    vec3 ring = vec3(cos(ang) * aRing.x, 0.0, sin(ang) * aRing.x);
    ring.y = sin(aRing.x * 7.0 - t * 2.5) * (0.03 + uMid * 0.5) + aRing.z * 0.04;

    float a = smoothstep(0.0, 1.0, clamp((uMorph - aRand * 0.4) / 0.6, 0.0, 1.0));
    float b = smoothstep(0.0, 1.0, clamp((uMorph - 1.0 - aRand * 0.4) / 0.6, 0.0, 1.0));
    vec3 p = mix(logo, field, a);
    p = mix(p, ring, b);
    p += hash3(aRand * 113.0) * (sin(a * 3.14159) + sin(b * 3.14159)) * 0.9;

    vec3 scatter = hash3(aRand * 57.0) * vec3(12.0, 7.0, 6.0);
    p = mix(scatter, p, uIntro);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (0.55 + aRand * 0.9) * (1.0 + uLevel * 0.9) * uPixel / -mv.z;
    vRand = aRand;
    vA = mix(1.0, 0.7, a);
    vShape = a;
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uColA, uColB, uFieldA, uFieldB;
  uniform float uFade;
  varying float vRand;
  varying float vA;
  varying float vShape;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float g = pow(smoothstep(0.5, 0.0, d), 1.7);
    // logo iki renkli (turuncu + beyaz), dalga ve plak vurgu renklerinde
    vec3 logoCol = mix(uColA, uColB, smoothstep(0.6, 0.72, vRand));
    vec3 fieldCol = mix(uFieldA, uFieldB, smoothstep(0.55, 1.0, vRand));
    vec3 col = mix(logoCol, fieldCol, vShape);
    col = mix(col, vec3(1.0, 0.93, 0.84), step(0.95, vRand) * 0.85);
    float k = g * vA * uFade;
    gl_FragColor = vec4(col * k * 1.5, k * 0.7); // önceden çarpılmış alfa, toplamalı
  }
`;

async function sampleLogo(url, res, height) {
  const img = new Image();
  img.src = url;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = c.height = res;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, res, res);
  const data = g.getImageData(0, 0, res, res).data;
  const pts = [];
  let minX = res, maxX = 0, minY = res, maxY = 0;
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      if (data[(y * res + x) * 4 + 3] > 140) {
        pts.push(x, y);
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
  }
  // logoyu ortala ve istenen yüksekliğe ölçekle
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, scale = height / (maxY - minY);
  const out = [];
  for (let i = 0; i < pts.length; i += 2) out.push((pts[i] - cx) * scale, -(pts[i + 1] - cy) * scale);
  out.halfW = ((maxX - minX) / 2) * scale;
  return out;
}

export async function initHeroScene(canvas, { logoUrl, colors = {}, logoScale = 1.1 }) {
  const mobile = innerWidth < 760;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0); // şeffaf: arkadaki stüdyo fotoğrafı görünsün

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);

  const logoH = 4.4 * Math.min(1.4, Math.max(0.6, logoScale));
  const logo2d = await sampleLogo(logoUrl, mobile ? 150 : 220, logoH);
  const layers = 2;
  const N = (logo2d.length / 2) * layers;

  const aLogo = new Float32Array(N * 3);
  const aField = new Float32Array(N * 3);
  const aRing = new Float32Array(N * 3);
  const aRand = new Float32Array(N);
  const cols = Math.ceil(Math.sqrt(N * 2.4));
  const rows = Math.ceil(N / cols);

  for (let i = 0; i < N; i++) {
    const s = (i % (logo2d.length / 2)) * 2;
    const layer = Math.floor(i / (logo2d.length / 2));
    aLogo[i * 3] = logo2d[s] + (Math.random() - 0.5) * 0.02;
    aLogo[i * 3 + 1] = logo2d[s + 1] + (Math.random() - 0.5) * 0.02;
    aLogo[i * 3 + 2] = (layer / (layers - 1) - 0.5) * 0.45 + (Math.random() - 0.5) * 0.12;

    // her parçacık için ızgarada rastgele bir hücre (karışık dağılım geçişi güzelleştirir)
    const gi = (i * 7919) % (cols * rows);
    aField[i * 3] = ((gi % cols) / (cols - 1) - 0.5) * 18;
    aField[i * 3 + 2] = (Math.floor(gi / cols) / (rows - 1) - 0.5) * 8;

    const groove = Math.floor(Math.random() * 46);
    aRing[i * 3] = 0.9 + groove * 0.055 + Math.random() * 0.02;
    aRing[i * 3 + 1] = Math.random() * Math.PI * 2;
    aRing[i * 3 + 2] = Math.random() - 0.5;

    aRand[i] = Math.random();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(aLogo, 3));
  geo.setAttribute('aLogo', new THREE.BufferAttribute(aLogo, 3));
  geo.setAttribute('aField', new THREE.BufferAttribute(aField, 3));
  geo.setAttribute('aRing', new THREE.BufferAttribute(aRing, 3));
  geo.setAttribute('aRand', new THREE.BufferAttribute(aRand, 1));

  const uniforms = {
    uTime: { value: 0 }, uMorph: { value: 0 }, uIntro: { value: reducedMotion ? 1 : 0 },
    uSize: { value: mobile ? 0.1 : 0.088 }, uPixel: { value: 0 },
    uBass: { value: 0 }, uMid: { value: 0 }, uLevel: { value: 0 },
    uMouse: { value: new THREE.Vector2(99, 99) }, uLogoX: { value: 0 },
    uColA: { value: new THREE.Color(colors.logo1 || '#ff8a1f') }, uColB: { value: new THREE.Color(colors.logo2 || '#ffffff') },
    uFieldA: { value: new THREE.Color(colors.accent || '#ff8a1f').lerp(new THREE.Color('#ffffff'), 0.15) },
    uFieldB: { value: new THREE.Color(colors.accent2 || '#ff3b2f') },
    uFade: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: vertex, fragmentShader: fragment, uniforms,
    transparent: true, depthWrite: false, blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  const group = new THREE.Group();
  group.add(points);
  scene.add(group);

  // arka plan tozu
  const dustN = mobile ? 300 : 700;
  const dust = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) { dust[i * 3] = (Math.random() - 0.5) * 30; dust[i * 3 + 1] = (Math.random() - 0.5) * 18; dust[i * 3 + 2] = -Math.random() * 20 - 2; }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dust, 3));
  const dustMat = new THREE.PointsMaterial({ color: new THREE.Color(colors.accent || '#ff8a1f').lerp(new THREE.Color('#ffffff'), 0.35), size: 0.04, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
  const dustPts = new THREE.Points(dustGeo, dustMat);
  scene.add(dustPts);

  // kamera durakları: logo → arazi → plak
  const shots = [
    { pos: new THREE.Vector3(0, 0, mobile ? 11.5 : 8.6), look: new THREE.Vector3(0, mobile ? -0.4 : -0.2, 0) },
    { pos: new THREE.Vector3(0, 1.4, 7.2), look: new THREE.Vector3(0, -1.3, 0) },
    { pos: new THREE.Vector3(0, 3.6, 5.6), look: new THREE.Vector3(0, 0.2, 0) },
  ];
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();

  const resize = () => {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    uniforms.uPixel.value = h * renderer.getPixelRatio() * 0.5;
    // geniş ekranda logo sağa kayar, başlıkla çakışmaz ve ekrandan taşmaz
    const halfW = Math.tan(THREE.MathUtils.degToRad(20)) * shots[0].pos.z * camera.aspect;
    uniforms.uLogoX.value = w / h > 1.25 ? Math.max(0, Math.min(halfW - logo2d.halfW - 0.8, (w / h) * 1.6)) : 0;
  };
  resize();
  addEventListener('resize', resize);

  const mouse = new THREE.Vector2(0, 0);
  let mouseActive = false;
  if (!isTouch) {
    addEventListener('pointermove', (e) => {
      mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      mouseActive = true;
    }, { passive: true });
  }

  const target = { morph: 0, fade: 1 };
  const smooth = { morph: 0, fade: 1, rx: 0, ry: 0 };
  const clock = new THREE.Clock();
  let introStart = performance.now() + 300;

  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t * t * (3 - 2 * t);

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    uniforms.uTime.value += dt;
    const lv = player.levels();
    uniforms.uBass.value = lerp(uniforms.uBass.value, lv.bass, 0.3);
    uniforms.uMid.value = lerp(uniforms.uMid.value, lv.mid, 0.3);
    uniforms.uLevel.value = lerp(uniforms.uLevel.value, lv.level, 0.3);

    if (uniforms.uIntro.value < 1) {
      const t = Math.min(1, Math.max(0, (performance.now() - introStart) / 2200));
      uniforms.uIntro.value = 1 - Math.pow(1 - t, 4);
    }

    smooth.morph = lerp(smooth.morph, target.morph, 0.06);
    smooth.fade = lerp(smooth.fade, target.fade, 0.08);
    uniforms.uMorph.value = smooth.morph;
    uniforms.uFade.value = smooth.fade;

    // kamera
    const m = smooth.morph;
    const seg = Math.min(1, Math.floor(m));
    const k = ease(Math.min(1, Math.max(0, m - seg)));
    camPos.lerpVectors(shots[seg].pos, shots[seg + 1].pos, k);
    camLook.lerpVectors(shots[seg].look, shots[seg + 1].look, k);
    camPos.x += smooth.ry * 0.8;
    camPos.y += smooth.rx * 0.5;
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    // fare: logo düzleminde itme + hafif sahne eğimi
    smooth.rx = lerp(smooth.rx, mouse.y, 0.05);
    smooth.ry = lerp(smooth.ry, mouse.x, 0.05);
    const logoW = Math.max(0, 1 - m * 2);
    if (mouseActive && logoW > 0) {
      const halfH = Math.tan(THREE.MathUtils.degToRad(20)) * camera.position.z;
      uniforms.uMouse.value.set(mouse.x * halfH * camera.aspect, mouse.y * halfH - shots[0].look.y);
    } else uniforms.uMouse.value.set(99, 99);

    group.rotation.y = lerp(0, Math.sin(uniforms.uTime.value * 0.3) * 0.18, logoW) + smooth.ry * 0.25 * logoW;
    group.rotation.x = Math.max(0, m - 1) * 0.15;
    dustPts.rotation.y = uniforms.uTime.value * 0.01;

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  frame();

  return {
    setTarget(morph, fade = 1) { target.morph = morph; target.fade = fade; },
    restartIntro() { introStart = performance.now(); uniforms.uIntro.value = 0; },
  };
}
