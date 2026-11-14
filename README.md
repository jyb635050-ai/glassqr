# 琉璃码 GlassQR

把链接或普通二维码变成可旋转、可 3D 打印的艺术立体二维码。纯前端，全部在浏览器本地完成，不上传任何内容。

Turn a link or an existing QR code into an artistic 3D QR code you can rotate, export as an image, or 3D print. Runs entirely in the browser.

- 魔法树模式：二维码当地面长出一棵树（阔叶 / 松 / 柳，四季，6 种叶色），点一下叶子飞落成可扫的码
- 立体浮雕模式 9 种风格：方块、圆点、圆角、天际线、松林、树冠、水晶、棱台、水珠
- 3 种定位角、6 组配色、4 种材质、底板形状与尺寸可调
- 导出 PNG（透明背景）与 STL
- 内置自检：把俯视图重新识别一遍，确认能扫出原内容
- 中文 / English，浅色 / 深色

## 本地运行

```bash
python -m http.server 8791
```

## 第三方库

- [three.js](https://github.com/mrdoob/three.js) — MIT
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) — MIT
- [jsQR](https://github.com/cozmo/jsQR) — Apache-2.0

## License

MIT
