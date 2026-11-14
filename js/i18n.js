const dict = {
  zh: {
    brand: '琉璃码', tagline: '艺术立体二维码', theme_toggle: '切换浅色 / 深色',
    sec_content: '内容', mode_link: '链接 / 文本', mode_image: '二维码图片',
    ph_link: '粘贴链接或任意文本…', drop_hint: '点击、拖入或直接粘贴一张二维码图片',
    ecl: '容错等级',
    sec_style: '立体风格', st_cube: '方块', st_dot: '圆点', st_rounded: '圆角', st_skyline: '天际线',
    st_pine: '松林', st_tree: '树冠', st_crystal: '水晶', st_pyramid: '棱台', st_bubble: '水珠',
    sec_eye: '定位角', eye_square: '方', eye_rounded: '圆角', eye_circle: '圆',
    sec_color: '配色', color_code: '码色', color_base: '底色',
    sec_mat: '材质', mat_matte: '哑光', mat_metal: '金属', mat_ceramic: '陶瓷', mat_glass: '玻璃',
    sec_3d: '立体参数', p_size: '整体尺寸', p_thick: '底板厚度', p_relief: '立体高度', p_shape: '底板形状',
    privacy: '全部在你的浏览器本地完成，链接和图片不会上传。',
    act_top: '俯视', act_reset: '复位', act_auto: '自动旋转', act_png: '导出图片', act_stl: '导出 STL',
    ok: '可扫描', bad: '扫不出', checking: '检查中…', empty: '请输入内容',
    bad_hint: '俯视图识别失败：试试加大码色与底色的反差，或换一种风格 / 定位角。',
    ok_hint: '俯视图已通过识别。实物打印或斜视角度请再用手机实测。',
    too_long: '内容太长，放不进一个二维码。请缩短或降低容错等级。',
    img_ok: '已识别二维码内容。', img_fail: '这张图片里没有识别到二维码，换一张更清晰的试试。',
    img_bad: '无法读取这张图片。',
  },
  en: {
    brand: 'GlassQR', tagline: 'Artistic 3D QR codes', theme_toggle: 'Toggle light / dark',
    sec_content: 'Content', mode_link: 'Link / Text', mode_image: 'QR image',
    ph_link: 'Paste a link or any text…', drop_hint: 'Click, drop or paste a QR code image',
    ecl: 'Error correction',
    sec_style: '3D style', st_cube: 'Blocks', st_dot: 'Dots', st_rounded: 'Rounded', st_skyline: 'Skyline',
    st_pine: 'Pine forest', st_tree: 'Treetops', st_crystal: 'Crystal', st_pyramid: 'Frustum', st_bubble: 'Droplets',
    sec_eye: 'Finder corners', eye_square: 'Square', eye_rounded: 'Rounded', eye_circle: 'Round',
    sec_color: 'Colours', color_code: 'Code', color_base: 'Base',
    sec_mat: 'Material', mat_matte: 'Matte', mat_metal: 'Metal', mat_ceramic: 'Ceramic', mat_glass: 'Glass',
    sec_3d: '3D settings', p_size: 'Overall size', p_thick: 'Base thickness', p_relief: 'Relief height', p_shape: 'Base shape',
    privacy: 'Everything runs locally in your browser. Nothing is uploaded.',
    act_top: 'Top view', act_reset: 'Reset', act_auto: 'Auto-rotate', act_png: 'Export PNG', act_stl: 'Export STL',
    ok: 'Scannable', bad: 'Not scannable', checking: 'Checking…', empty: 'Enter some content',
    bad_hint: 'The top view could not be decoded: increase contrast between code and base, or try another style / corner shape.',
    ok_hint: 'Top view decodes correctly. Test a printed part or an angled view with your phone.',
    too_long: 'Too much content for one QR code. Shorten it or lower the error correction.',
    img_ok: 'QR content recognised.', img_fail: 'No QR code found in this image. Try a sharper one.',
    img_bad: 'Could not read this image.',
  },
};

let lang = 'zh';
const listeners = [];

export function initLang() {
  let l = null;
  try { l = localStorage.getItem('gq-lang'); } catch (e) {}
  if (!l) l = (navigator.language || 'zh').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  setLang(l, false);
}
export function setLang(l, save = true) {
  lang = dict[l] ? l : 'zh';
  if (save) { try { localStorage.setItem('gq-lang', lang); } catch (e) {} }
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.title = lang === 'zh' ? '琉璃码 GlassQR — 艺术立体二维码' : 'GlassQR — Artistic 3D QR codes';
  apply(document);
  listeners.forEach(f => f(lang));
}
export function apply(root) {
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  root.querySelectorAll('[data-i18n-title]').forEach(el => { const s = t(el.dataset.i18nTitle); el.title = s; el.setAttribute('aria-label', s); });
}
export const t = k => dict[lang][k] ?? k;
export const getLang = () => lang;
export const onLang = f => listeners.push(f);
export const keys = () => ({ zh: Object.keys(dict.zh), en: Object.keys(dict.en) });
