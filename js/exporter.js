// Frame-by-frame animation export. The caller renders the scene for a given time into `source`
// (the WebGL canvas); every frame is composited on a background and encoded. Nothing is real-time,
// so the result does not depend on how fast the machine or the tab is.

// macrotask yield that is not throttled in background tabs
const ch = new MessageChannel(); let waiting = [];
ch.port1.onmessage = () => { const w = waiting; waiting = []; w.forEach(f => f()); };
const breathe = () => new Promise(r => { waiting.push(r); ch.port2.postMessage(0); });

export const videoSupported = () => typeof VideoEncoder === 'function' && typeof VideoFrame === 'function';

async function pickCodec(format, width, height, fps, bitrate) {
  const list = format === 'mp4' ? ['avc1.640028', 'avc1.4d0028', 'avc1.42e028'] : ['vp09.00.40.08', 'vp09.00.31.08', 'vp8'];
  for (const codec of list) {
    try { const r = await VideoEncoder.isConfigSupported({ codec, width, height, framerate: fps, bitrate }); if (r.supported) return codec; } catch (e) {}
  }
  return null;
}

/**
 * opts: { format:'gif'|'mp4'|'webm', source:HTMLCanvasElement, size, fps, duration, bg:[c1,c2], renderAt(t), onProgress(0..1) }
 * returns Blob
 */
export async function encodeAnim({ format, source, size, fps, duration, bg, renderAt, onProgress }) {
  const frames = Math.round(duration * fps);
  const comp = document.createElement('canvas'); comp.width = comp.height = size;
  const cx = comp.getContext('2d', { willReadFrequently: format === 'gif' });
  const grad = cx.createLinearGradient(0, 0, size, size); grad.addColorStop(0, bg[0]); grad.addColorStop(1, bg[1]);
  const draw = i => { renderAt(i / fps); cx.fillStyle = grad; cx.fillRect(0, 0, size, size); cx.drawImage(source, 0, 0, size, size); };

  if (format === 'gif') {
    const { GIFEncoder, quantize, applyPalette } = await import('../vendor/gifenc.esm.js');
    const gif = GIFEncoder();
    for (let i = 0; i < frames; i++) {
      draw(i);
      const { data } = cx.getImageData(0, 0, size, size);
      const palette = quantize(data, 256, { format: 'rgb444' });
      gif.writeFrame(applyPalette(data, palette, 'rgb444'), size, size, { palette, delay: Math.round(1000 / fps) });
      onProgress?.((i + 1) / frames); await breathe();
    }
    gif.finish();
    return new Blob([gif.bytes()], { type: 'image/gif' });
  }

  if (!videoSupported()) throw new Error('nosupport');
  const bitrate = 8_000_000;
  const codec = await pickCodec(format, size, size, fps, bitrate);
  if (!codec) throw new Error('nosupport');
  const { Muxer, ArrayBufferTarget } = await import(format === 'mp4' ? '../vendor/mp4-muxer.mjs' : '../vendor/webm-muxer.mjs');
  const video = { codec: format === 'mp4' ? 'avc' : (codec === 'vp8' ? 'V_VP8' : 'V_VP9'), width: size, height: size, frameRate: fps };
  const muxer = new Muxer(format === 'mp4' ? { target: new ArrayBufferTarget(), video, fastStart: 'in-memory' } : { target: new ArrayBufferTarget(), video });
  let failure = null;
  const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: e => { failure = e; } });
  enc.configure({ codec, width: size, height: size, framerate: fps, bitrate });
  for (let i = 0; i < frames; i++) {
    if (failure) throw failure;
    draw(i);
    const vf = new VideoFrame(comp, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
    enc.encode(vf, { keyFrame: i % (fps * 2) === 0 }); vf.close();
    onProgress?.((i + 1) / frames);
    await breathe();
    while (enc.encodeQueueSize > 6) await breathe();
  }
  await enc.flush(); enc.close();
  if (failure) throw failure;
  muxer.finalize();
  return new Blob([muxer.target.buffer], { type: format === 'mp4' ? 'video/mp4' : 'video/webm' });
}
