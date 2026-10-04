import Tool from '../DevTools/Tool'
import evalCss from '../lib/evalCss'
import { classPrefix as c } from '../lib/util'

export default class FpsMeter extends Tool {
  constructor() {
    super()
    this._style = evalCss(require('./FpsMeter.scss'))
    this.name = 'fps'
    this._running = false
    this._rafId = 0
    this._lastT = 0
    this._ema = 0
    this._frames = []
    this._memTimer = 0
    this._userStopped = false
    this._accent = '#2196f3'
  }
  init($el, container) {
    super.init($el)
    this._container = container
    this._render()
    this._bindEvent()
  }
  show() {
    super.show()
    if (!this._userStopped) this._start()
    return this
  }
  hide() {
    this._stop()
    super.hide()
    return this
  }
  destroy() {
    this._stop()
    super.destroy()
    evalCss.remove(this._style)
  }
  _render() {
    this._$el.html(`<div class="${c('wrap')}">
      <div class="${c('fps-num')}">–</div>
      <div class="${c('fps-label')}">FPS (rata-rata bergerak)</div>
      <canvas class="${c('graph')}" width="300" height="80"></canvas>
      <div class="${c('mem')}">JS heap: <span class="${c('mem-val')}">…</span></div>
      <div class="${c('note')}">Loop hanya berjalan saat tab ini terlihat.</div>
      <button class="${c('btn')} ${c('btn-accent')}">Start</button>
    </div>`)
    this._$num = this._$el.find(c('.fps-num'))
    this._$memVal = this._$el.find(c('.mem-val'))
    this._$btn = this._$el.find(c('.btn'))
    this._canvas = this._$el.find(c('.graph')).get(0)
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--accent')
      if (v && v.trim()) this._accent = v.trim()
    } catch {
      /* keep fallback */
    }
  }
  _bindEvent() {
    const self = this
    this._$btn.on('click', () => {
      if (self._running) {
        self._userStopped = true
        self._stop()
      } else {
        self._userStopped = false
        self._start()
      }
    })
  }
  _start() {
    if (this._running) return
    this._running = true
    this._lastT = 0
    this._ema = 0
    this._memTimer = setInterval(() => this._updateMem(), 1000)
    this._updateMem()
    const self = this
    const tick = (t) => {
      if (!self._running) return
      if (self._lastT && t > self._lastT) {
        const fps = 1000 / (t - self._lastT)
        self._ema = self._ema ? self._ema + (fps - self._ema) * 0.1 : fps
        self._frames.push(Math.round(self._ema))
        if (self._frames.length > 60) self._frames.shift()
        self._draw()
      }
      self._lastT = t
      self._rafId = requestAnimationFrame(tick)
    }
    this._rafId = requestAnimationFrame(tick)
    this._syncBtn()
  }
  _stop() {
    this._running = false
    if (this._rafId) cancelAnimationFrame(this._rafId)
    this._rafId = 0
    if (this._memTimer) clearInterval(this._memTimer)
    this._memTimer = 0
    this._syncBtn()
  }
  _syncBtn() {
    if (this._$btn) this._$btn.text(this._running ? 'Stop' : 'Start')
  }
  _updateMem() {
    let txt
    if (window.performance && performance.memory) {
      txt = (performance.memory.usedJSHeapSize / 1048576).toFixed(1) + ' MB'
    } else {
      txt = 'tidak didukung browser ini'
    }
    this._$memVal.text(txt)
  }
  _draw() {
    if (!this._canvas) return
    const ctx = this._canvas.getContext('2d')
    const w = this._canvas.width
    const h = this._canvas.height
    ctx.clearRect(0, 0, w, h)
    const n = this._frames.length
    if (!n) return
    const max = Math.max(60, ...this._frames)
    const bw = w / 60
    ctx.fillStyle = this._accent
    for (let i = 0; i < n; i++) {
      const bh = Math.min(h, (this._frames[i] / max) * h)
      ctx.fillRect(i * bw, h - bh, bw - 1, bh)
    }
    this._$num.text(String(this._frames[n - 1]))
  }
}
