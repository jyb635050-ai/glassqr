import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { build, makeMatrix, pitch, STYLES } from './builder.js';
import { createTree, SEASONS, TREE_PALETTES } from './tree.js';
import { encodeAnim, videoSupported } from './exporter.js';
import { initLang, setLang, getLang, onLang, apply, t, keys } from './i18n.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const PRESETS = [
  { id: 'forest', code: '#14532d', base: '#ecfdf5' },
  { id: 'ink',    code: '#16171a', base: '#f5f5f7' },
  { id: 'ocean',  code: '#0b3a82', base: '#eaf3ff' },
  { id: 'sunset', code: '#8a2c0d', base: '#fff4e6' },
  { id: 'berry',  code: '#4c1d95', base: '#f5f0ff' },
  { id: 'night',  code: '#f2cf7e', base: '#101116' },
];
const ICONS = {
  cube: '<rect x="5" y="5" width="14" height="14" fill="currentColor"/>',
  dot: '<circle cx="12" cy="12" r="7.5" fill="currentColor"/>',
  rounded: '<rect x="4.5" y="4.5" width="15" height="15" rx="5" fill="currentColor"/>',
  skyline: '<path fill="currentColor" d="M3 21V12h5v9zM9.5 21V4h5v17zM16 21V9h5v12z"/>',
  pine: '<path fill="currentColor" d="M12 2l4.6 6.2h-2.4l4 5.6h-2.6l3.6 5H13.2V22h-2.4v-3.2H4.8l3.6-5H5.8l4-5.6H7.4z"/>',
  tree: '<path fill="currentColor" d="M12 2.5a7 7 0 0 1 1.3 13.88V22h-2.6v-5.62A7 7 0 0 1 12 2.5z"/>',
  crystal: '<path fill="currentColor" d="M12 2l6 6.5V17l-6 5-6-5V8.5z"/>',
  pyramid: '<path fill="currentColor" d="M8.5 6h7L21 19H3z"/>',
  bubble: '<path fill="currentColor" d="M3.5 17a8.5 8.5 0 0 1 17 0z"/>',
};

const state = {
  kind: 'tree', species: 'oak', season: 'spring', tpal: 0, flat: false,
  mode: 'link', text: 'https://example.com', ecl: 'H',
  style: 'pine', eye: 'rounded', preset: 0, code: PRESETS[0].code, base: PRESETS[0].base,
  mat: 'matte', size: 60, thick: 2, relief: 6, shape: 'rounded', auto: true,
};
let matrix = null, info = null, verdict = 'checking', lastError = null;

/* ---------------- three scene ---------------- */
const canvas = $('#view'), stage = $('#stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.6;

const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 5000);
camera.up.set(0, 0, 1);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.autoRotateSpeed = 0.9; controls.maxPolarAngle = Math.PI * 0.495;

const sun = new THREE.DirectionalLight(0xffffff, 1.9);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
const hemi = new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.35);
scene.add(sun, sun.target, hemi);

const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.22 }));
floor.receiveShadow = true; floor.position.z = -0.02; scene.add(floor);

const model = new THREE.Group(); scene.add(model);
const meshes = { base: new THREE.Mesh(), code: new THREE.Mesh(), accent: new THREE.Mesh() };
for (const k in meshes) { meshes[k].castShadow = true; meshes[k].receiveShadow = true; model.add(meshes[k]); }

const tree = createTree({ scene, camera, controls, renderer, sun, hemi });
let dirty = true, fitted = '';
function fit(force) {
  const tr = state.kind === 'tree', s = tr ? 60 : state.size;
  const key = state.kind + s + state.shape;
  if (!force && key === fitted) return;
  fitted = key;
  if (tr) controls.target.copy(tree.target); else controls.target.set(0, 0, state.thick);
  if (tr) camera.position.copy(tree.home); else camera.position.set(-s * 0.8, -s * 1.5, s * 1.25);
  camera.near = s / 100; camera.far = s * 40; camera.updateProjectionMatrix();
  sun.position.set(-s * 0.9, -s * 0.5, s * 1.7); sun.target.position.set(0, 0, 0);
  const sc = sun.shadow.camera; const sb = tr ? s * 1.25 : s; sc.left = sc.bottom = -sb; sc.right = sc.top = sb; sc.near = s * 0.2; sc.far = s * 5; sc.updateProjectionMatrix();
  floor.scale.setScalar(s * 8);
  controls.minDistance = s * 0.6; controls.maxDistance = s * 8;
  controls.update();
}

function makeMaterial(kind, color, isBase) {
  const c = new THREE.Color(color);
  if (kind === 'metal') return new THREE.MeshStandardMaterial({ color: c, metalness: 1, roughness: isBase ? 0.42 : 0.26 });
  if (kind === 'ceramic' || (kind === 'glass' && isBase)) return new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 });
  if (kind === 'glass') return new THREE.MeshPhysicalMaterial({
    color: c, roughness: 0.06, transmission: 0.82, ior: 1.5, thickness: (info?.p || 1) * 1.5,
    attenuationColor: c, attenuationDistance: (info?.p || 1) * 1.2, clearcoat: 1, clearcoatRoughness: 0.05,
  });
  return new THREE.MeshStandardMaterial({ color: c, metalness: 0, roughness: 0.72 });
}
function accentColor() { return new THREE.Color(state.code).lerp(new THREE.Color('#6b4a2b'), 0.55); }
function applyMaterials() {
  for (const k in meshes) meshes[k].material?.dispose?.();
  meshes.base.material = makeMaterial(state.mat, state.base, true);
  meshes.code.material = makeMaterial(state.mat, state.code, false);
  meshes.accent.material = makeMaterial(state.mat === 'glass' ? 'ceramic' : state.mat, accentColor(), false);
  dirty = true;
}

/* ---------------- build + verify ---------------- */
function rebuild() {
  lastError = null;
  const text = state.text.trim();
  if (!text) { matrix = null; lastError = 'empty'; }
  else { try { matrix = makeMatrix(text, state.ecl); } catch (e) { matrix = null; lastError = 'too_long'; } }
  const isTree = state.kind === 'tree';
  model.visible = !!matrix && !isTree; tree.setVisible(!!matrix && isTree);
  if (!isTree) { sun.intensity = 1.9; hemi.intensity = 0.35; controls.enabled = true; }
  if (matrix && isTree) {
    tree.build(matrix, text, state); info = { n: matrix.n, tree: true }; fit(false);
    verdict = decodeOK(tree.snapshotFlat()) ? 'ok' : 'bad';
  } else if (matrix) {
    const g = build(matrix, state);
    info = g.info;
    for (const k of ['base', 'code', 'accent']) { meshes[k].geometry?.dispose(); if (g[k]) meshes[k].geometry = g[k]; meshes[k].visible = !!g[k]; }
    applyMaterials(); fit(false);
    verdict = verify() ? 'ok' : 'bad';
  } else { info = null; verdict = 'none'; }
  dirty = true; paintStatus();
}
let timer = 0;
const schedule = () => { clearTimeout(timer); timer = setTimeout(rebuild, 70); };

// Render a flat-colour orthographic top view and decode it again.
const rt = new THREE.WebGLRenderTarget(640, 640);
const flat = { base: new THREE.MeshBasicMaterial(), code: new THREE.MeshBasicMaterial(), accent: new THREE.MeshBasicMaterial() };
function topPixels() {
  const S = 640, half = state.size / 2 * 1.08;
  const cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 4000);
  cam.up.set(0, 1, 0); cam.position.set(0, 0, 2000); cam.lookAt(0, 0, 0);
  const keep = {}; for (const k in meshes) keep[k] = meshes[k].material;
  flat.base.color.set(state.base); flat.code.color.set(state.code); flat.accent.color.set(state.code);
  for (const k in meshes) meshes[k].material = flat[k];
  const bg = scene.background; scene.background = new THREE.Color('#808080'); floor.visible = false;
  renderer.setRenderTarget(rt); renderer.render(scene, cam);
  const buf = new Uint8Array(S * S * 4); renderer.readRenderTargetPixels(rt, 0, 0, S, S, buf);
  renderer.setRenderTarget(null); scene.background = bg; floor.visible = true;
  for (const k in meshes) meshes[k].material = keep[k];
  const out = new Uint8ClampedArray(S * S * 4), row = S * 4;
  for (let y = 0; y < S; y++) out.set(buf.subarray((S - 1 - y) * row, (S - y) * row), y * row);
  return { data: out, S };
}
function decodeOK({ data, S }) {
  const res = window.jsQR(data, S, S);
  return !!res && res.data === state.text.trim();
}
function verify() { return decodeOK(state.kind === 'tree' ? tree.snapshotFlat() : topPixels()); }

function paintStatus() {
  const b = $('#badge'), msg = $('#msg');
  b.className = 'badge glass ' + (verdict === 'ok' ? 'ok' : verdict === 'bad' ? 'bad' : '');
  $('#badge-text').textContent = verdict === 'ok' ? t('ok') : verdict === 'bad' ? t('bad') : t(lastError || 'checking');
  $('#badge-info').textContent = info?.tree ? `${info.n}×${info.n}` : info ? `${info.n}×${info.n} · ${state.size}×${state.size}×${(info.height).toFixed(1)} mm` : '';
  $('#badge-info').hidden = !info;
  const kOk = state.kind === 'tree' ? 'tree_ok_hint' : 'ok_hint', kBad = state.kind === 'tree' ? 'tree_bad_hint' : 'bad_hint';
  b.title = verdict === 'ok' ? t(kOk) : verdict === 'bad' ? t(kBad) : '';
  if (lastError === 'too_long') { msg.textContent = t('too_long'); msg.className = 'msg err'; }
  else if (verdict === 'bad') { msg.textContent = t(kBad); msg.className = 'msg err'; }
  else if (imgNote) { msg.textContent = t(imgNote.key); msg.className = 'msg ' + imgNote.cls; }
  else { msg.textContent = verdict === 'ok' ? t(kOk) : ''; msg.className = 'msg'; }
}

/* ---------------- UI ---------------- */
function syncUI() {
  $$('.seg[data-key]').forEach(seg => seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === String(state[seg.dataset.key])))));
  $$('#styles .tile').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === state.style)));
  $$('#presets .sw').forEach((b, i) => b.setAttribute('aria-pressed', String(i === state.preset)));
  $$('input[type=range][data-key]').forEach(i => { i.value = state[i.dataset.key]; });
  $$('output[data-out]').forEach(o => { o.textContent = (+state[o.dataset.out]).toFixed(o.dataset.out === 'size' ? 0 : 1) + ' mm'; });
  $('#c-code').value = state.code; $('#c-base').value = state.base;
  if ($('#text').value !== state.text) $('#text').value = state.text;
  $('#pane-link').hidden = state.mode !== 'link'; $('#pane-image').hidden = state.mode !== 'image';
  $('#b-auto').setAttribute('aria-pressed', String(state.auto)); controls.autoRotate = state.auto;
  $$('[data-for]').forEach(el => { el.hidden = el.dataset.for !== state.kind; });
  const sp = TREE_PALETTES.map(p => p || SEASONS[state.season]);
  $$('#tpals .sw').forEach((b, i) => { b.style.setProperty('--a', sp[i].leaf[0]); b.style.setProperty('--b', sp[i].deep); b.setAttribute('aria-pressed', String(i === state.tpal)); });
  $('#b-flip').textContent = t(state.flat ? 'act_flip_tree' : 'act_flip_code');
  $('#hint').textContent = t(state.flat ? 'hint_code' : 'hint_tree');
  $$('#lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === getLang())));
}
function defaultRelief() {
  let n = 29; try { n = makeMatrix(state.text.trim() || 'x', state.ecl).n; } catch (e) {}
  const v = STYLES[state.style].k * pitch(n, state.size, state.shape);
  return Math.min(20, Math.max(0.4, Math.round(v * 10) / 10));
}
function set(key, value) {
  state[key] = value;
  if (key === 'style') state.relief = defaultRelief();
  if (key === 'kind') { state.flat = false; tree.reset(); fitted = ''; }
  if (key === 'flat') { tree.setFlat(value); syncUI(); dirty = true; return; }
  if (key === 'code' || key === 'base') state.preset = PRESETS.findIndex(p => p.code === state.code && p.base === state.base);
  if (key === 'text' || key === 'mode') imgNote = key === 'mode' ? imgNote : null;
  syncUI();
  if (key === 'mode' || key === 'auto') { dirty = true; return; }
  schedule();
}

$('#styles').innerHTML = Object.keys(STYLES).map(k =>
  `<button type="button" class="tile" data-v="${k}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg><span data-i18n="st_${k}"></span></button>`).join('');
$('#presets').innerHTML = PRESETS.map((p, i) =>
  `<button type="button" class="sw" data-i="${i}" style="--a:${p.code};--b:${p.base}" aria-label="${p.id}"></button>`).join('');

$('#tpals').innerHTML = TREE_PALETTES.map((p, i) => `<button type="button" class="sw" data-i="${i}" aria-label="leaf ${i}"></button>`).join('');
$('#tpals').addEventListener('click', e => { const b = e.target.closest('.sw'); if (b) set('tpal', +b.dataset.i); });
$('#b-flip').addEventListener('click', () => set('flat', !state.flat));
$$('.seg[data-key]').forEach(seg => seg.addEventListener('click', e => { const b = e.target.closest('button'); if (b) set(seg.dataset.key, b.dataset.v); }));
$('#styles').addEventListener('click', e => { const b = e.target.closest('.tile'); if (b) set('style', b.dataset.v); });
$('#presets').addEventListener('click', e => { const b = e.target.closest('.sw'); if (!b) return; const p = PRESETS[+b.dataset.i]; state.code = p.code; set('base', p.base); });
$$('input[type=range][data-key]').forEach(i => i.addEventListener('input', () => set(i.dataset.key, +i.value)));
$('#c-code').addEventListener('input', e => set('code', e.target.value));
$('#c-base').addEventListener('input', e => set('base', e.target.value));
$('#text').addEventListener('input', e => set('text', e.target.value));
$('#lang').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setLang(b.dataset.v); });
$('#theme').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('gq-theme', next); } catch (e) {}
});
onLang(() => { syncUI(); paintStatus(); });

/* image -> text */
let imgNote = null;
async function readImage(file) {
  let bmp;
  try { bmp = await createImageBitmap(file); } catch (e) { imgNote = { key: 'img_bad', cls: 'err' }; paintStatus(); return false; }
  let found = null;
  for (const max of [1400, 800, 420]) {
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(bmp, 0, 0, w, h);
    const r = window.jsQR(cx.getImageData(0, 0, w, h).data, w, h);
    if (r && r.data) { found = r.data; break; }
  }
  if (!found) { imgNote = { key: 'img_fail', cls: 'err' }; paintStatus(); return false; }
  state.text = found; imgNote = { key: 'img_ok', cls: 'ok' };
  syncUI(); schedule();
  return true;
}
$('#file').addEventListener('change', e => { const f = e.target.files[0]; if (f) readImage(f); e.target.value = ''; });
const drop = $('#drop');
['dragenter', 'dragover'].forEach(n => drop.addEventListener(n, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(n => drop.addEventListener(n, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) readImage(f); });
document.addEventListener('paste', e => {
  const it = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
  if (!it) return;
  e.preventDefault(); state.mode = 'image'; readImage(it.getAsFile());
});

/* view buttons */
let tween = null;
function flyTo(pos) {
  const from = camera.position.clone(), t0 = performance.now();
  tween = now => {
    const k = Math.min(1, (now - t0) / 480), e = 1 - Math.pow(1 - k, 3);
    camera.position.lerpVectors(from, pos, e); dirty = true;
    if (k >= 1) tween = null;
  };
}
$('#b-top').addEventListener('click', () => {
  set('auto', false);
  const d = state.size * 2.4; controls.target.set(0, 0, state.thick);
  flyTo(new THREE.Vector3(0, -d * 0.002, d));
});
$('#b-reset').addEventListener('click', () => {
  if (state.kind === 'tree') { if (state.flat) set('flat', false); else { controls.target.copy(tree.target); flyTo(tree.home.clone()); } return; }
  const s = state.size; controls.target.set(0, 0, state.thick); flyTo(new THREE.Vector3(-s * 0.8, -s * 1.5, s * 1.25)); });
$('#b-auto').addEventListener('click', () => set('auto', !state.auto));

/* export */
function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function renderPNG(px = 2400) {
  const size = renderer.getSize(new THREE.Vector2()), pr = renderer.getPixelRatio(), asp = camera.aspect, fov = camera.fov;
  renderer.setPixelRatio(1); renderer.setSize(px, px, false); camera.aspect = 1; camera.fov = 36; camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  const url = canvas.toDataURL('image/png');
  renderer.setPixelRatio(pr); renderer.setSize(size.x, size.y, false); camera.aspect = asp; camera.fov = fov; camera.updateProjectionMatrix(); dirty = true;
  return url;
}
function makeSTL() { model.updateMatrixWorld(true); return new STLExporter().parse(model, { binary: true }); }
/* animated export: GIF / MP4 / WebM, rendered frame by frame */
let exporting = false;
const AX = new THREE.Vector3(0, 0, 1);
function toast(text) { const el = $('#toast'); el.textContent = text; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 4200); }
async function exportAnim(format) {
  if (!matrix || exporting) return null;
  exporting = true;
  const isTree = state.kind === 'tree', gif = format === 'gif';
  const size = gif ? 480 : 1080, fps = gif ? 15 : 30, duration = isTree ? 6.4 : 4;
  const keep = { pos: camera.position.clone(), tgt: controls.target.clone(), asp: camera.aspect, fov: camera.fov, pr: renderer.getPixelRatio(), size: renderer.getSize(new THREE.Vector2()) };
  const base = isTree && tree.morph > 0 ? tree.home.clone() : keep.pos.clone(), off = keep.pos.clone().sub(keep.tgt);
  const dark = document.documentElement.dataset.theme === 'dark';
  const btn = $('#b-export'), label = () => t('act_export');
  renderer.setPixelRatio(1); renderer.setSize(size, size, false); camera.aspect = 1; camera.fov = 34; camera.updateProjectionMatrix();
  const renderAt = time => {
    if (isTree) {
      // sway out and back, leaves fall, hold the code, regrow: loops seamlessly
      const m = time < 2.6 ? 0 : time < 3.8 ? (time - 2.6) / 1.2 : time < 5.3 ? 1 : Math.max(0, 1 - (time - 5.3) / 1.1);
      const ang = time < 2.6 ? 0.62 * Math.sin(Math.PI * time / 2.6) : 0;
      tree.pose(m, time, ang, base);
    } else {
      camera.position.copy(keep.tgt).add(off.clone().applyAxisAngle(AX, Math.PI * 2 * time / duration)); camera.lookAt(keep.tgt);
    }
    renderer.render(scene, camera);
  };
  let blob = null;
  try {
    blob = await encodeAnim({ format, source: canvas, size, fps, duration, renderAt, bg: dark ? ['#101425', '#1a1030'] : ['#eaf1ff', '#fdeef4'],
      onProgress: k => { btn.textContent = `${t('ex_busy')} ${Math.round(k * 100)}%`; } });
  } catch (e) { toast(t(e.message === 'nosupport' ? 'ex_nosupport' : 'ex_fail')); console.error(e); }
  renderer.setPixelRatio(keep.pr); renderer.setSize(keep.size.x, keep.size.y, false);
  camera.position.copy(keep.pos); controls.target.copy(keep.tgt); camera.aspect = keep.asp; camera.fov = keep.fov; camera.updateProjectionMatrix(); controls.update();
  if (isTree) tree.unpose();
  btn.textContent = label(); exporting = false; dirty = true;
  return blob;
}
const fileBase = () => state.kind === 'tree' ? `glassqr-tree-${state.season}` : `glassqr-${state.style}`;
const menu = $('#menu');
$('#b-export').addEventListener('click', e => { e.stopPropagation(); if (!exporting) menu.hidden = !menu.hidden; });
document.addEventListener('click', e => { if (!menu.contains(e.target)) menu.hidden = true; });
menu.addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b || !matrix) return;
  menu.hidden = true;
  const f = b.dataset.f;
  if (f === 'png') { download(await (await fetch(renderPNG())).blob(), state.kind === 'tree' ? `glassqr-tree-${state.flat ? 'code' : state.season}.png` : `glassqr-${state.style}.png`); return; }
  if (f !== 'gif' && !videoSupported()) { toast(t('ex_nosupport')); return; }
  const blob = await exportAnim(f); if (blob) download(blob, `${fileBase()}.${f}`);
});
$('#b-stl').addEventListener('click', () => { if (!matrix || state.kind === 'tree') return; download(new Blob([makeSTL()], { type: 'model/stl' }), `glassqr-${state.style}-${state.size}mm.stl`); });

/* loop */
new ResizeObserver(() => {
  const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.fov = camera.aspect >= 1.25 ? 32 : THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(16)) * 1.25 / camera.aspect));
  camera.updateProjectionMatrix(); dirty = true;
}).observe(stage);
let down = null;
canvas.addEventListener('pointerdown', e => { tween = null; down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener('pointerup', e => {
  if (down && state.kind === 'tree' && matrix && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && performance.now() - down.t < 450) set('flat', !state.flat);
  down = null;
});
function tick(now) {
  requestAnimationFrame(tick);
  if (tween) tween(now);
  if (exporting) return;
  const tr = state.kind === 'tree' && tree.update(now);
  controls.autoRotate = state.auto && !(state.kind === 'tree' && (tree.morph > 0 || state.flat));
  if (controls.update() || dirty || tr) { dirty = false; renderer.render(scene, camera); }
}

/* boot */
initLang();
apply(document);
state.relief = defaultRelief();
syncUI(); rebuild(); fit(true);
requestAnimationFrame(tick);

// hook for automated checks
window.GQ = { exportAnim, tree, decodeOK, SEASONS, TREE_PALETTES, state, set, rebuild, verify, topPixels, makeSTL, renderPNG, readImage, STYLES, PRESETS, i18nKeys: keys, get verdict() { return verdict; }, get info() { return info; } };
