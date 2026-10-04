import Tool from '../DevTools/Tool'
import evalCss from '../lib/evalCss'
import { classPrefix as c } from '../lib/util'
import each from 'licia/each'
import escape from 'licia/escape'
import { fmtBytes, shortUrl } from '../Hozin/util'

function calcScore(fcp, lcp, cls) {
  let s = 100
  if (fcp != null) s -= fcp > 3000 ? 25 : fcp > 1800 ? 12 : fcp > 1000 ? 5 : 0
  if (lcp != null) s -= lcp > 4000 ? 30 : lcp > 2500 ? 15 : lcp > 1500 ? 6 : 0
  if (cls != null) s -= cls > 0.25 ? 25 : cls > 0.1 ? 12 : cls > 0.02 ? 4 : 0
  return Math.max(0, Math.min(100, Math.round(s)))
}

function fmtMs(v) {
  return v == null ? '—' : Math.round(v) + ' ms'
}

export default class PerfAudit extends Tool {
  constructor() {
    super()
    this._style = evalCss(require('./PerfAudit.scss'))
    this.name = 'perf'
    this._lcp = 0
    this._cls = 0
    this._tbt = 0
    this._observers = []
  }
  init($el, container) {
    super.init($el)
    this._container = container
    this._render()
    this._bindEvent()
    this._watchVitals()
  }
  destroy() {
    each(this._observers, (o) => {
      try {
        o.disconnect()
      } catch {
        /* ignore */
      }
    })
    super.destroy()
    evalCss.remove(this._style)
  }
  _render() {
    this._$el.html(`<div class="${c('wrap')}">
      <div class="${c('toolbar')}">
        <button class="${c('btn')} ${c('btn-accent')}">Jalankan audit</button>
      </div>
      <div class="${c('note')}">Angka aproksimasi — LCP/CLS/TBT dipantau selama tool terbuka dan butuh aktivitas halaman.</div>
      <div class="${c('results')}"><div class="${c('empty')}">Tekan "Jalankan audit" untuk mengukur performa halaman.</div></div>
    </div>`)
    this._$results = this._$el.find(c('.results'))
  }
  _bindEvent() {
    const self = this
    this._$el.on('click', c('.toolbar') + ' ' + c('.btn'), () => self._run())
  }
  _watchVitals() {
    if (typeof PerformanceObserver === 'undefined') return
    const self = this
    try {
      const lcp = new PerformanceObserver((list) => {
        each(list.getEntries(), (e) => {
          if (e.startTime > self._lcp) self._lcp = e.startTime
        })
      })
      lcp.observe({ type: 'largest-contentful-paint', buffered: true })
      this._observers.push(lcp)
    } catch {
      /* ignore */
    }
    try {
      const cls = new PerformanceObserver((list) => {
        each(list.getEntries(), (e) => {
          if (!e.hadRecentInput) self._cls += e.value || 0
        })
      })
      cls.observe({ type: 'layout-shift', buffered: true })
      this._observers.push(cls)
    } catch {
      /* ignore */
    }
    try {
      const lt = new PerformanceObserver((list) => {
        each(list.getEntries(), (e) => {
          self._tbt += Math.max(0, (e.duration || 0) - 50)
        })
      })
      lt.observe({ type: 'longtask', buffered: true })
      this._observers.push(lt)
    } catch {
      /* ignore */
    }
  }
  _run() {
    const navs = performance.getEntriesByType('navigation') || []
    const nav = navs[0]
    const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0]
    const fcp = fcpEntry ? fcpEntry.startTime : null
    const dcl = nav ? nav.domContentLoadedEventEnd - nav.startTime : null
    const load = nav && nav.loadEventEnd > 0 ? nav.loadEventEnd - nav.startTime : null
    const lcp = this._lcp > 0 ? this._lcp : null
    const score = calcScore(fcp, lcp, this._cls)
    const resources = this._collectResources(nav)
    this._renderResults({
      fcp,
      dcl,
      load,
      lcp,
      cls: this._cls,
      tbt: Math.round(this._tbt),
      score,
      resources,
    })
  }
  _collectResources(nav) {
    const navStart = nav ? nav.startTime : 0
    const list = []
    each(performance.getEntriesByType('resource') || [], (e) => {
      list.push({
        name: e.name,
        size: e.transferSize || 0,
        duration: e.duration || 0,
        start: (e.startTime || 0) - navStart,
      })
    })
    list.sort((a, b) => b.size - a.size)
    return list.slice(0, 25)
  }
  _renderResults(r) {
    let html = `<div class="${c('score-card')}">
      <div class="${c('score')}">${r.score}</div>
      <div class="${c('score-cap')}">skor performa (heuristik dari FCP/LCP/CLS)</div>
    </div>
    <div class="${c('metrics')}">
      ${this._metricRow('FCP', fmtMs(r.fcp))}
      ${this._metricRow('LCP', fmtMs(r.lcp))}
      ${this._metricRow('CLS', r.cls.toFixed(3))}
      ${this._metricRow('TBT (est)', r.tbt + ' ms')}
      ${this._metricRow('DOMContentLoaded', fmtMs(r.dcl))}
      ${this._metricRow('Load', fmtMs(r.load))}
    </div>`
    html += `<div class="${c('section-title')}">Waterfall — ${r.resources.length} resource terberat</div>`
    if (!r.resources.length) {
      html += `<div class="${c('empty')}">Tidak ada data resource timing.</div>`
    } else {
      let maxEnd = 1
      each(r.resources, (res) => {
        maxEnd = Math.max(maxEnd, res.start + res.duration)
      })
      html += `<div class="${c('waterfall')}">`
      each(r.resources, (res) => {
        const left = ((res.start / maxEnd) * 100).toFixed(1)
        const width = Math.max(0.5, (res.duration / maxEnd) * 100).toFixed(1)
        const size = res.size ? fmtBytes(res.size) : '—'
        html += `<div class="${c('wf-row')}">
          <div class="${c('wf-name')}" title="${escape(res.name)}">${escape(shortUrl(res.name, 44))}</div>
          <div class="${c('wf-track')}"><div class="${c('wf-bar')}" style="left:${left}%;width:${width}%"></div></div>
          <div class="${c('wf-meta')}">${size} · ${Math.round(res.duration)} ms</div>
        </div>`
      })
      html += '</div>'
    }
    this._$results.html(html)
  }
  _metricRow(k, v) {
    return `<div class="${c('metric')}"><span class="${c('k')}">${k}</span><span class="${c('v')}">${v}</span></div>`
  }
}
