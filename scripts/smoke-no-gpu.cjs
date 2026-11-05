// Preload for smoke.mjs --gpu none: the page gets no WebGPU and no WebGL context, as in a browser
// without either, so the app's startup fails the way it does there.
const getContext = HTMLCanvasElement.prototype.getContext
HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
  return /^(webgl|webgl2|experimental-webgl|webgpu)$/.test(type) ? null : getContext.call(this, type, ...rest)
}
if (typeof OffscreenCanvas !== 'undefined') {
  const offscreen = OffscreenCanvas.prototype.getContext
  OffscreenCanvas.prototype.getContext = function (type, ...rest) {
    return /^(webgl|webgl2|webgpu)$/.test(type) ? null : offscreen.call(this, type, ...rest)
  }
}
Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined, configurable: true })
