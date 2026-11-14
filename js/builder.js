// QR matrix -> 3D geometry. Everything is built Z-up in millimetres, base sitting on z = 0.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const MARGIN = 3; // quiet zone, in modules

// k = default relief height in module widths; tall = finder corners stay lower than the modules
export const STYLES = {
  cube:    { k: 0.7 },
  dot:     { k: 0.7 },
  rounded: { k: 0.8 },
  skyline: { k: 3.0, tall: true },
  pine:    { k: 3.6, tall: true },
  tree:    { k: 3.0, tall: true },
  crystal: { k: 2.6, tall: true },
  pyramid: { k: 1.2 },
  bubble:  { k: 0.9 },
};

export function makeMatrix(text, ecl = 'H') {
  const q = window.qrcode;
  q.stringToBytes = q.stringToBytesFuncs['UTF-8'];
  const qr = q(0, ecl);
  qr.addData(text, 'Byte');
  qr.make(); // throws when the data does not fit
  const n = qr.getModuleCount();
  const m = [];
  for (let r = 0; r < n; r++) { const row = []; for (let c = 0; c < n; c++) row.push(qr.isDark(r, c)); m.push(row); }
  return { n, m };
}

// module pitch for a given overall size and base shape
export function pitch(n, size, shape) {
  return shape === 'circle' ? size / (n * Math.SQRT2 + 3) : size / (n + 2 * MARGIN);
}

const HALF = Math.PI / 2;
const ni = g => (g.index ? g.toNonIndexed() : g);
const rnd = (r, c, s = 0) => {
  let h = Math.imul(r + 1, 73856093) ^ Math.imul(c + 1, 19349663) ^ Math.imul(s + 1, 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
// cylinder / cone standing on z0, axis along Z
function cyl(rTop, rBot, h, seg, z0, theta = 0) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, false, theta);
  g.rotateX(HALF); g.translate(0, 0, z0 + h / 2);
  return ni(g);
}
function box(w, h, z0) { const g = new THREE.BoxGeometry(w, w, h); g.translate(0, 0, z0 + h / 2); return ni(g); }

function roundRect(path, cx, cy, w, r) {
  const x = cx - w / 2, y = cy - w / 2;
  if (r <= 1e-6) { path.moveTo(x, y); path.lineTo(x + w, y); path.lineTo(x + w, y + w); path.lineTo(x, y + w); path.closePath(); return path; }
  path.moveTo(x + r, y); path.lineTo(x + w - r, y);
  path.absarc(x + w - r, y + r, r, -HALF, 0, false); path.lineTo(x + w, y + w - r);
  path.absarc(x + w - r, y + w - r, r, 0, HALF, false); path.lineTo(x + r, y + w);
  path.absarc(x + r, y + w - r, r, HALF, Math.PI, false); path.lineTo(x, y + r);
  path.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return path;
}
function outline(kind, cx, cy, w, rr, Cls = THREE.Shape) {
  const p = new Cls();
  if (kind === 'circle') { p.absarc(cx, cy, w / 2, 0, Math.PI * 2, false); return p; }
  return roundRect(p, cx, cy, w, kind === 'rounded' ? rr : 0);
}
function extrude(shape, depth, z0) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 20 });
  g.translate(0, 0, z0);
  return g;
}

// one module of the given style, centred on the origin, standing on z0. Returns { main:[], accent:[] }
function moduleGeo(style, p, h, z0, r, c) {
  const v = rnd(r, c), main = [], accent = [];
  switch (style) {
    case 'dot': main.push(cyl(p * 0.47, p * 0.47, h, 20, z0)); break;
    case 'rounded': {
      const g = new RoundedBoxGeometry(p * 0.94, p * 0.94, h, 3, Math.min(p * 0.24, h * 0.45));
      g.translate(0, 0, z0 + h / 2); main.push(ni(g)); break;
    }
    case 'skyline': main.push(box(p * 0.96, h * (0.3 + 0.7 * v), z0)); break;
    case 'pine': {
      const H = h * (0.7 + 0.45 * v);
      accent.push(cyl(p * 0.13, p * 0.15, H * 0.24, 8, z0));
      main.push(cyl(0, p * 0.5, H * 0.46, 10, z0 + H * 0.18));
      main.push(cyl(0, p * 0.4, H * 0.42, 10, z0 + H * 0.40));
      main.push(cyl(0, p * 0.29, H * 0.36, 10, z0 + H * 0.64));
      break;
    }
    case 'tree': {
      const H = h * (0.7 + 0.45 * v);
      accent.push(cyl(p * 0.11, p * 0.14, H * 0.5, 8, z0));
      const g = new THREE.IcosahedronGeometry(1, 1);
      g.rotateZ(v * 6.283); g.scale(p * 0.52, p * 0.52, H * 0.36); g.translate(0, 0, z0 + H * 0.64);
      main.push(ni(g)); break;
    }
    case 'crystal': {
      const H = h * (0.6 + 0.6 * v), R = p * 0.56, a = v * 1.047;
      main.push(cyl(R, R, H * 0.62, 6, z0, a));
      main.push(cyl(0, R, H * 0.38, 6, z0 + H * 0.62, a));
      break;
    }
    case 'pyramid': main.push(cyl(p * 0.26 * Math.SQRT2, p * 0.5 * Math.SQRT2, h, 4, z0, Math.PI / 4)); break;
    case 'bubble': {
      const R = p * 0.48;
      const dome = new THREE.SphereGeometry(R, 16, 8, 0, Math.PI * 2, 0, HALF);
      dome.rotateX(HALF); dome.scale(1, 1, h / R); dome.translate(0, 0, z0);
      const cap = new THREE.CircleGeometry(R, 16); cap.rotateX(Math.PI); cap.translate(0, 0, z0);
      main.push(ni(dome), ni(cap)); break;
    }
    default: main.push(box(p, h, z0));
  }
  return { main, accent };
}

const isFinder = (r, c, n) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
// centres of the 5x5 alignment patterns (drawn solid, like the finder corners, so readers can lock on)
function alignCentres(n) {
  const v = (n - 17) / 4; if (v < 2) return [];
  const num = Math.floor(v / 7) + 2, step = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (num * 2 - 2)) * 2;
  const pos = [6]; for (let i = 0, q = n - 7; i < num - 1; i++, q -= step) pos.splice(1, 0, q);
  const out = [];
  for (const r of pos) for (const c of pos) if (!isFinder(r, c, n) && !isFinder(r - 2, c - 2, n) && !isFinder(r + 2, c + 2, n) && !isFinder(r - 2, c + 2, n) && !isFinder(r + 2, c - 2, n)) out.push([r, c]);
  return out;
}

/**
 * opts: { style, eye, size, thick, relief, shape }
 * returns { base, code, accent|null, info }
 */
export function build(matrix, opts) {
  const { n, m } = matrix;
  const { style, eye, size, thick, relief, shape } = opts;
  const p = pitch(n, size, shape);
  const z0 = thick;
  const X = c => (c - (n - 1) / 2) * p, Y = r => ((n - 1) / 2 - r) * p;

  // base plate
  const base = extrude(outline(shape, 0, 0, size, Math.min(size * 0.12, MARGIN * p * 3)), thick, 0);

  const main = [], accent = [];
  const aligns = alignCentres(n);
  const inAlign = (r, c) => aligns.some(([ar, ac]) => Math.abs(r - ar) <= 2 && Math.abs(c - ac) <= 2);
  // data modules
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!m[r][c] || isFinder(r, c, n) || inAlign(r, c)) continue;
    const g = moduleGeo(style, p, relief, z0, r, c);
    const x = X(c), y = Y(r);
    g.main.forEach(q => { q.translate(x, y, 0); main.push(q); });
    g.accent.forEach(q => { q.translate(x, y, 0); accent.push(q); });
  }
  // finder corners: ring (7p, 5p hole) + centre (3p)
  const hf = STYLES[style]?.tall ? Math.max(relief * 0.42, Math.min(relief, p * 0.8)) : relief;
  for (const [fr, fc] of [[3, 3], [3, n - 4], [n - 4, 3]]) {
    const cx = X(fc), cy = Y(fr);
    const ring = outline(eye, cx, cy, 7 * p, 1.9 * p);
    ring.holes.push(outline(eye, cx, cy, 5 * p, 1.15 * p, THREE.Path));
    main.push(extrude(ring, hf, z0));
    main.push(extrude(outline(eye, cx, cy, 3 * p, 0.85 * p), hf, z0));
  }
  // alignment patterns: ring (5p, 3p hole) + centre (1p)
  for (const [ar, ac] of aligns) {
    const cx = X(ac), cy = Y(ar);
    const ring = outline(eye, cx, cy, 5 * p, 1.2 * p);
    ring.holes.push(outline(eye, cx, cy, 3 * p, 0.6 * p, THREE.Path));
    main.push(extrude(ring, hf, z0));
    main.push(extrude(outline(eye, cx, cy, p, 0.3 * p), hf, z0));
  }

  const code = mergeGeometries(main, false);
  const acc = accent.length ? mergeGeometries(accent, false) : null;
  main.forEach(g => g.dispose()); accent.forEach(g => g.dispose());
  code.computeBoundingBox();
  return { base, code, accent: acc, info: { n, p, size, height: code.boundingBox.max.z } };
}
