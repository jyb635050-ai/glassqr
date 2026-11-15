// Magic tree mode: the QR code is the ground, a tree grows on it, and on tap every leaf
// flies down onto a dark module so the flattened scene is the scannable code.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const S = 60, QUIET = 4;

export const SEASONS = {
  spring: { leaf: ['#f7a8bd', '#ffc6d3', '#f48aa8', '#fbd5de'], deep: '#7a1f3d', grass: ['#8fd16a', '#6fbf5a', '#a9df7f'], bark: '#6b4a36', plate: '#f6f2ea' },
  summer: { leaf: ['#58b060', '#7ccb6c', '#3f984e', '#9bdc7d'], deep: '#124a28', grass: ['#6dbb55', '#4fa448', '#8ad06c'], bark: '#5f4330', plate: '#f4f3e8' },
  autumn: { leaf: ['#f2a33a', '#e9772e', '#f6c84a', '#d9542b'], deep: '#74290a', grass: ['#c9b458', '#a8a14a', '#dcc56a'], bark: '#5a3d2b', plate: '#f7f1e4' },
  winter: { leaf: ['#eef5fb', '#d3e6f6', '#b4d2ec', '#ffffff'], deep: '#1b3658', grass: ['#eef4f8', '#dbe7ef', '#c9dbe8'], bark: '#5a4a44', plate: '#f3f5f8' },
};
// index 0 = follow the season
export const TREE_PALETTES = [
  null,
  { leaf: ['#b79af0', '#d2bdfa', '#9a78e6', '#e4d8fd'], deep: '#3b1d7a' },
  { leaf: ['#f0605a', '#f78b80', '#dd3f3f', '#fbb0a6'], deep: '#7a1414' },
  { leaf: ['#6fb1ff', '#9ccbff', '#4a93ee', '#c5e0ff'], deep: '#0b3a82' },
  { leaf: ['#4fc9b8', '#86e0d2', '#2fae9f', '#b7efe6'], deep: '#0c4f49' },
  { leaf: ['#f5c542', '#fadb7a', '#eaa91f', '#fdeaa8'], deep: '#6a4a05' },
];

const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const smooth = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const lerp = (a, b, k) => a + (b - a) * k;
const smoother = x => { x = Math.min(1, Math.max(0, x)); return x * x * x * (x * (x * 6 - 15) + 10); };
const Z = new THREE.Vector3(0, 0, 1), X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);

function childDir(dir, tilt, phi, up) {
  const u = new THREE.Vector3().crossVectors(dir, Math.abs(dir.z) < 0.9 ? Z : X).normalize();
  const v = new THREE.Vector3().crossVectors(dir, u);
  const d = dir.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(u, Math.cos(phi) * Math.sin(tilt)).addScaledVector(v, Math.sin(phi) * Math.sin(tilt));
  d.z += up; return d.normalize();
}

// returns { limbs:[[a,b,r1,r2]], anchors:[{p,r}], hang }
function grow(species, rand) {
  const limbs = [], anchors = [];
  const O = new THREE.Vector3();
  if (species === 'pine') {
    const top = new THREE.Vector3((rand() - 0.5) * S * 0.02, (rand() - 0.5) * S * 0.02, S * 0.86);
    limbs.push([O, top, S * 0.028, S * 0.004]);
    const levels = 8, a0 = rand() * 6.28;
    for (let i = 0; i < levels; i++) {
      const t = i / (levels - 1), z = lerp(S * 0.2, S * 0.78, t), len = S * lerp(0.3, 0.06, t), k = t < 0.6 ? 6 : 5;
      for (let j = 0; j < k; j++) {
        const a = a0 + i * 0.7 + j * 6.283 / k + (rand() - 0.5) * 0.3;
        const from = new THREE.Vector3(0, 0, z).lerp(top, 0).setZ(z);
        const to = new THREE.Vector3(Math.cos(a) * len, Math.sin(a) * len, z - len * 0.22);
        limbs.push([from, to, S * 0.008, S * 0.003]);
        anchors.push({ p: from.clone().lerp(to, 0.5), r: S * 0.05 }, { p: to, r: S * 0.045 });
      }
    }
    anchors.push({ p: top, r: S * 0.04 }, { p: top.clone().setZ(S * 0.8), r: S * 0.045 });
    return { limbs, anchors, hang: 0, zMin: S * 0.12 };
  }
  const willow = species === 'willow';
  const depth0 = 3;
  const rec = (pos, dir, len, rad, depth) => {
    const end = pos.clone().addScaledVector(dir, len);
    limbs.push([pos, end, rad, rad * 0.68]);
    if (depth === 0) { anchors.push({ p: end, r: S * (willow ? 0.04 : 0.088) }); return; }
    if (depth === 1 && !willow) anchors.push({ p: end, r: S * 0.07 });
    const k = depth === depth0 ? 3 : (rand() < 0.55 ? 3 : 2), phi0 = rand() * 6.283;
    for (let i = 0; i < k; i++) {
      const tilt = willow ? 0.75 + rand() * 0.4 : 0.5 + rand() * 0.45;
      const d = childDir(dir, tilt, phi0 + i * 6.283 / k + (rand() - 0.5) * 0.6, willow ? 0.18 : 0.26);
      rec(end, d, len * (0.68 + rand() * 0.12), rad * 0.62, depth - 1);
    }
  };
  const lean = new THREE.Vector3((rand() - 0.5) * 0.12, (rand() - 0.5) * 0.12, 1).normalize();
  rec(O, lean, S * (willow ? 0.32 : 0.25), S * 0.03, depth0);
  return { limbs, anchors, hang: willow ? S * 0.34 : 0, zMin: S * (willow ? 0.07 : 0.14) };
}

function limbGeo([a, b, r1, r2]) {
  const d = b.clone().sub(a), len = d.length();
  const g = new THREE.CylinderGeometry(r2, r1, len, 6);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, d.normalize()));
  const mid = a.clone().add(b).multiplyScalar(0.5); g.translate(mid.x, mid.y, mid.z);
  return g;
}

export function createTree({ scene, camera, controls, renderer, sun, hemi }) {
  const group = new THREE.Group(); group.visible = false; scene.add(group);
  const dummy = new THREE.Object3D(), col = new THREE.Color(), tumbleAxis = new THREE.Vector3(1, 1, 0).normalize();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const over = new THREE.Vector3(0, -0.03, S * 2.75), tgtTree = new THREE.Vector3(0, 0, S * 0.2), tgtFlat = new THREE.Vector3();
  const homeDefault = new THREE.Vector3(-S * 1.15, -S * 2.0, S * 1.3);
  let L = null, m = 0, goal = 0, home = homeDefault.clone(), last = 0, tileIdle = new THREE.Color(), deep = new THREE.Color();

  function clear() {
    group.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    group.clear(); L = null;
  }

  function build(matrix, text, opts) {
    clear();
    const { n, m: mat } = matrix, p = S / (n + 2 * QUIET), band = 2.6 * p;
    const se = SEASONS[opts.season] || SEASONS.spring, pal = TREE_PALETTES[opts.tpal] || se;
    const rand = mulberry(hash(text + '|' + opts.species));
    deep.set(pal.deep); tileIdle.set(se.plate).lerp(deep, 0.1);

    // plate (top at z = 0)
    const plate = new THREE.Mesh(new THREE.BoxGeometry(S + 2 * band, S + 2 * band, 2.2 * p).translate(0, 0, -1.1 * p),
      new THREE.MeshStandardMaterial({ color: se.plate, roughness: 0.92 }));
    plate.receiveShadow = true; group.add(plate);

    // tiles: one per dark module
    const dark = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (mat[r][c]) dark.push([(c - (n - 1) / 2) * p, ((n - 1) / 2 - r) * p]);
    const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(p * 1.004, p * 1.004, p * 0.25), new THREE.MeshStandardMaterial({ roughness: 0.88 }), dark.length);
    dark.forEach(([x, y], i) => { dummy.position.set(x, y, p * 0.125); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); tiles.setMatrixAt(i, dummy.matrix); });
    tiles.receiveShadow = true; group.add(tiles);

    // grass rim, outside the quiet zone
    const G = 340, blade = new THREE.ConeGeometry(0.5, 1, 4).rotateX(Math.PI / 2).translate(0, 0, 0.5);
    const grass = new THREE.InstancedMesh(blade, new THREE.MeshStandardMaterial({ roughness: 0.9 }), G);
    for (let i = 0; i < G; i++) {
      const along = (rand() - 0.5) * (S + 2 * band), off = S / 2 + band * (0.12 + 0.8 * rand()), side = i % 4;
      const x = side < 2 ? along : (side === 2 ? off : -off), y = side < 2 ? (side === 0 ? off : -off) : along;
      const w = p * (0.45 + rand() * 0.5);
      dummy.position.set(x, y, 0); dummy.rotation.set(0, 0, rand() * 6.28); dummy.scale.set(w, w, p * (0.7 + rand() * 1.9)); dummy.updateMatrix();
      grass.setMatrixAt(i, dummy.matrix); grass.setColorAt(i, col.set(se.grass[i % se.grass.length]));
    }
    grass.instanceColor.needsUpdate = true; group.add(grass);

    // woody skeleton
    const g = grow(opts.species, rand);
    const wood = new THREE.Mesh(mergeGeometries(g.limbs.map(limbGeo), false), new THREE.MeshStandardMaterial({ color: se.bark, roughness: 0.9 }));
    wood.castShadow = true; group.add(wood);

    // leaves: runs of k per dark module
    const D = dark.length, k = Math.max(1, Math.min(6, Math.floor(3400 / D))), N = D * k, ls = S / 34;
    const rest = new Float32Array(N * 3), tgt = new Float32Array(N * 3), delay = new Float32Array(N), phase = new Float32Array(N), cA = new Float32Array(N * 3);
    // shuffle module order so neighbouring leaves do not land on neighbouring modules
    const order = dark.map((_, i) => i); for (let i = D - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    for (let i = 0; i < N; i++) {
      const a = g.anchors[Math.floor(rand() * g.anchors.length)];
      let x, y, z;
      if (g.hang && rand() < 0.8) {
        x = a.p.x + (rand() - 0.5) * S * 0.07; y = a.p.y + (rand() - 0.5) * S * 0.07; z = a.p.z - rand() * g.hang;
      } else {
        const rr = a.r * Math.cbrt(rand()), th = rand() * 6.283, ph = Math.acos(2 * rand() - 1);
        x = a.p.x + rr * Math.sin(ph) * Math.cos(th); y = a.p.y + rr * Math.sin(ph) * Math.sin(th); z = a.p.z + rr * Math.cos(ph) * 0.85;
      }
      rest[i * 3] = Math.round(x / ls) * ls; rest[i * 3 + 1] = Math.round(y / ls) * ls; rest[i * 3 + 2] = Math.max(g.zMin, Math.round(z / ls) * ls);
      const d = dark[order[Math.floor(i / k)]];
      tgt[i * 3] = d[0]; tgt[i * 3 + 1] = d[1]; tgt[i * 3 + 2] = p * 0.4;
      delay[i] = rand() * 0.34; phase[i] = rand() * 6.283;
      col.set(pal.leaf[Math.floor(rand() * pal.leaf.length)]); cA[i * 3] = col.r; cA[i * 3 + 1] = col.g; cA[i * 3 + 2] = col.b;
    }
    const leaves = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.82 }), N);
    leaves.castShadow = true; leaves.receiveShadow = true; leaves.frustumCulled = false; leaves.setColorAt(0, col); group.add(leaves);

    L = { p, ls, N, rest, tgt, delay, phase, cA, leaves, tiles, wood, n };
    apply(m, 0, true);
  }

  // m: 0 = tree, 1 = flat code
  function apply(mm, time, colours) {
    if (!L) return;
    const { p, ls, N, rest, tgt, delay, phase, cA, leaves, tiles, wood } = L;
    const sway = reduce ? 0 : ls * 0.16;
    for (let i = 0; i < N; i++) {
      const e = smooth((mm - delay[i]) / 0.66), i3 = i * 3, arc = Math.sin(Math.PI * e), ph = phase[i];
      const w = (1 - e) * sway;
      dummy.position.set(
        lerp(rest[i3], tgt[i3], e) + Math.sin(time * 1.3 + ph) * w,
        lerp(rest[i3 + 1], tgt[i3 + 1], e) + Math.cos(time * 1.1 + ph * 1.7) * w,
        lerp(rest[i3 + 2], tgt[i3 + 2], e) + arc * S * 0.1 * (0.4 + (ph % 1)));
      const sxy = lerp(ls, p * 1.004, e);
      dummy.scale.set(sxy, sxy, lerp(ls, p * 0.3, e));
      dummy.quaternion.setFromAxisAngle(tumbleAxis, arc * (ph - 3.14) * 0.9);
      dummy.updateMatrix(); leaves.setMatrixAt(i, dummy.matrix);
      if (colours) { col.setRGB(cA[i3], cA[i3 + 1], cA[i3 + 2]).lerp(deep, e); leaves.setColorAt(i, col); }
    }
    leaves.instanceMatrix.needsUpdate = true;
    if (colours) leaves.instanceColor.needsUpdate = true;
    const em = smooth(mm);
    tiles.material.color.copy(tileIdle).lerp(deep, em);
    const ws = 1 - smooth(mm / 0.5); wood.visible = ws > 0.002; wood.scale.setScalar(Math.max(ws, 0.002));
    sun.intensity = lerp(1.9, 0.12, em); hemi.intensity = lerp(0.35, 1.25, em);
  }

  // Camera path from the orbit view to straight overhead, interpolated in spherical coordinates.
  // Distance, tilt and heading each ease on their own, and the heading settles on the nearest
  // quarter turn, so the code never swings round at the end of the move.
  function place(base, mm) {
    const e = smoother(mm), o = base.clone().sub(tgtTree), r0 = o.length();
    const p0 = Math.acos(Math.min(1, Math.max(-1, o.z / r0))), a0 = Math.atan2(o.y, o.x), Q = Math.PI / 2;
    const a1 = Math.round((a0 + Q) / Q) * Q - Q;
    const r = lerp(r0, over.length(), e), p = lerp(p0, 0.0008, e), a = lerp(a0, a1, e);
    controls.target.lerpVectors(tgtTree, tgtFlat, e);
    camera.position.set(controls.target.x + r * Math.sin(p) * Math.cos(a), controls.target.y + r * Math.sin(p) * Math.sin(a), controls.target.z + r * Math.cos(p));
  }

  function setFlat(flat) {
    if (flat && m === 0 && goal === 0) home.copy(camera.position);
    goal = flat ? 1 : 0;
  }
  function reset() { m = 0; goal = 0; home.copy(homeDefault); controls.enabled = true; apply(0, 0, true); }

  // advance the morph; returns true when a redraw is needed
  function update(now) {
    if (!L || !group.visible) { last = now; return false; }
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    const moving = m !== goal;
    if (moving) { m = goal > m ? Math.min(goal, m + dt / 1.4) : Math.max(goal, m - dt / 1.4); }
    if (m > 0 || moving) place(home, m);
    controls.enabled = m === 0;
    if (moving) { apply(m, now / 1000, true); return true; }
    if (m === 0 && !reduce) { apply(0, now / 1000, false); return true; }
    return false;
  }

  // Draw the real, lit, flattened scene from straight above and hand back its pixels.
  const snap = document.createElement('canvas'); snap.width = snap.height = 640;
  const sctx = snap.getContext('2d', { willReadFrequently: true });
  function snapshotFlat() {
    const keep = { pos: camera.position.clone(), tgt: controls.target.clone(), asp: camera.aspect, fov: camera.fov, pr: renderer.getPixelRatio(), size: renderer.getSize(new THREE.Vector2()) };
    apply(1, 0, true);
    camera.position.copy(over); camera.aspect = 1; camera.fov = 32; camera.updateProjectionMatrix(); camera.lookAt(0, 0, 0);
    renderer.setPixelRatio(1); renderer.setSize(640, 640, false); renderer.render(scene, camera);
    sctx.fillStyle = '#808080'; sctx.fillRect(0, 0, 640, 640); sctx.drawImage(renderer.domElement, 0, 0);
    renderer.setPixelRatio(keep.pr); renderer.setSize(keep.size.x, keep.size.y, false);
    camera.position.copy(keep.pos); controls.target.copy(keep.tgt); camera.aspect = keep.asp; camera.fov = keep.fov; camera.updateProjectionMatrix();
    controls.update(); apply(m, 0, true);
    return { data: sctx.getImageData(0, 0, 640, 640).data, S: 640 };
  }

  // deterministic pose for frame-by-frame export: mm = morph, ang = orbit offset around the tree
  function pose(mm, time, ang, base) {
    apply(mm, time, true);
    place((base || homeDefault).clone().applyAxisAngle(Z, ang), mm); camera.lookAt(controls.target);
  }
  function unpose() { apply(m, 0, true); }

  return {
    pose, unpose,
    build, update, setFlat, reset, snapshotFlat, clear,
    setVisible(v) { group.visible = v; },
    get morph() { return m; }, get home() { return homeDefault; }, target: tgtTree,
  };
}
