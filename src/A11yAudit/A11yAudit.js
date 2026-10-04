import Tool from '../DevTools/Tool'
import evalCss from '../lib/evalCss'
import { classPrefix as c } from '../lib/util'
import escape from 'licia/escape'
import axe from 'axe-core'

const WEIGHTS = { critical: 10, serious: 5, moderate: 2, minor: 1 }
const IMPACT_COLORS = {
  critical: '#e5484d',
  serious: '#e8833c',
  moderate: '#f5a524',
  minor: '#8b8d98',
}

export default class A11yAudit extends Tool {
  constructor() {
    super()
    this._style = evalCss(require('./A11yAudit.scss'))
    this.name = 'a11y'

    this._running = false
    this._result = null
    this._highlighted = []
  }
  init($el, container) {
    super.init($el)
    this._container = container
    this._render()
    this._bindEvent()
  }
  destroy() {
    this._clearHighlight()
    super.destroy()
    evalCss.remove(this._style)
  }
  _render() {
    let body = `<div class="${c('empty')}">Tekan "Jalankan audit" untuk memeriksa aksesibilitas halaman ini dengan axe-core.</div>`
    if (this._running) {
      body = `<div class="${c('empty')}">Menganalisis halaman…</div>`
    } else if (this._result) {
      const v = this._result
      let penalty = 0
      for (const item of v.violations) {
        penalty += WEIGHTS[item.impact] || 1
      }
      const score = Math.max(0, 100 - penalty)
      const grade = score >= 90 ? 'Baik' : score >= 70 ? 'Cukup' : 'Buruk'

      const rows = v.violations.length
        ? v.violations
            .map((item, i) => {
              const color = IMPACT_COLORS[item.impact] || IMPACT_COLORS.minor
              return `<div class="${c('vio')}">
                <div class="${c('vio-head')}">
                  <span class="${c('badge')}" style="background:${color}">${escape(
                    item.impact || 'minor'
                  )}</span>
                  <span class="${c('rule')}">${escape(item.id)}</span>
                  <span class="${c('nodes')}">${item.nodes.length} node</span>
                </div>
                <div class="${c('vio-desc')}">${escape(item.help)}</div>
                <div class="${c('vio-actions')}">
                  <button class="${c('btn')}" data-act="highlight" data-idx="${i}">🔍 Sorot</button>
                </div>
              </div>`
            })
            .join('')
        : `<div class="${c('empty')}">🎉 Tidak ada pelanggaran ditemukan.</div>`

      body = `<div class="${c('score-card')}">
          <div class="${c('score')}">${score}</div>
          <div class="${c('score-meta')}">
            <div class="${c('grade')}">${grade}</div>
            <div class="${c('count')}">${v.violations.length} pelanggaran</div>
          </div>
        </div>
        <div class="${c('list')}">${rows}</div>`
    }

    this._$el.html(`<div class="${c('wrap')}">
      <div class="${c('toolbar')}">
        <button class="${c('btn')} ${c('primary')}" data-act="run" ${
          this._running ? 'disabled' : ''
        }>🔍 Jalankan audit</button>
        <button class="${c('btn')}" data-act="clear" ${
          this._highlighted.length ? '' : 'disabled'
        }>🧹 Bersihkan sorotan</button>
      </div>
      <div class="${c('note')}">Catatan jujur: axe-core menambah ±1MB ke ukuran bundle.</div>
      ${body}
    </div>`)
  }
  _bindEvent() {
    const self = this
    this._$el.on('click', c('.btn'), function () {
      const act = this.getAttribute('data-act')
      if (act === 'run') self._run()
      else if (act === 'clear') self._clearHighlight()
      else if (act === 'highlight') self._highlight(+this.getAttribute('data-idx'))
    })
  }
  _run() {
    if (this._running) return
    this._clearHighlight()
    this._running = true
    this._render()
    axe
      .run(document, { resultTypes: ['violations'] })
      .then((results) => {
        this._running = false
        this._result = results
        this._render()
        this._notify(
          'Audit selesai: ' + results.violations.length + ' pelanggaran'
        )
      })
      .catch((e) => {
        this._running = false
        this._render()
        this._notify('Audit gagal: ' + (e && e.message ? e.message : e))
      })
  }
  _highlight(idx) {
    if (!this._result || !this._result.violations[idx]) return
    this._clearHighlight()
    const item = this._result.violations[idx]
    let count = 0
    for (const node of item.nodes) {
      const targets = node.target || []
      for (const t of targets) {
        let els
        try {
          els = document.querySelectorAll(t)
        } catch {
          continue
        }
        for (const el of els) {
          if (el instanceof HTMLElement && el.style) {
            el.style.outline = '3px solid #e5484d'
            el.style.outlineOffset = '2px'
            this._highlighted.push(el)
            count++
          }
        }
      }
    }
    this._render()
    this._notify(count ? count + ' node disorot' : 'Tidak ada node yang bisa disorot')
  }
  _clearHighlight() {
    for (const el of this._highlighted) {
      if (el && el.style) {
        el.style.outline = ''
        el.style.outlineOffset = ''
      }
    }
    this._highlighted = []
    if (this._result) this._render()
  }
  _notify(msg) {
    this._container.notify(msg, { icon: 'success' })
  }
}
