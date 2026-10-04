import Tool from '../DevTools/Tool'
import evalCss from '../lib/evalCss'
import { classPrefix as c } from '../lib/util'
import each from 'licia/each'
import escape from 'licia/escape'
import { js as beautify } from 'js-beautify'
import { download, copy, fmtBytes } from '../Hozin/util'

const MAX_SHOW = 200 * 1024

export default class JsBeautifier extends Tool {
  constructor() {
    super()
    this._style = evalCss(require('./JsBeautifier.scss'))
    this.name = 'beautify'

    this._output = ''
    this._truncated = false
    this._indent = 4
  }
  init($el, container) {
    super.init($el)
    this._container = container
    this._render()
    this._bindEvent()
  }
  destroy() {
    super.destroy()
    evalCss.remove(this._style)
  }
  _scriptOptions() {
    const opts = []
    each(document.scripts, (s, i) => {
      if (s.src) opts.push({ label: s.src, value: s.src })
      else opts.push({ label: '[inline #' + i + ']', value: 'inline:' + i })
    })
    return opts
  }
  _render() {
    const opts = this._scriptOptions()
      .map(
        (o) =>
          `<option value="${escape(o.value)}">${escape(o.label.slice(0, 80))}</option>`
      )
      .join('')

    let outHtml = `<div class="${c('empty')}">Tempel kode JS di atas, atau pilih script halaman, lalu tekan "✨ Beautify".</div>`
    if (this._output) {
      outHtml = `<pre class="${c('output')}">${escape(
        this._output.slice(0, MAX_SHOW)
      )}</pre>`
      if (this._truncated) {
        outHtml += `<div class="${c('trunc')}">… terpotong: ${
          fmtBytes(this._output.length)
        } total, ditampilkan ${fmtBytes(MAX_SHOW)}. Download untuk versi penuh.</div>`
      }
    }

    this._$el.html(`<div class="${c('wrap')}">
      <label class="${c('label')}">Pilih script halaman (opsional):</label>
      <select class="${c('select')}" data-f="script">
        <option value="">— pilih dari halaman —</option>
        ${opts}
      </select>
      <label class="${c('label')}">Atau tempel kode JS:</label>
      <textarea class="${c('input')}" data-f="code" rows="6" placeholder="// paste kode JavaScript di sini"></textarea>
      <div class="${c('toolbar')}">
        <label class="${c('label-inline')}">Indent:
          <select class="${c('select-sm')}" data-f="indent">
            <option value="2"${this._indent === 2 ? ' selected' : ''}>2</option>
            <option value="4"${this._indent === 4 ? ' selected' : ''}>4</option>
          </select>
        </label>
        <button class="${c('btn')} ${c('primary')}" data-act="go">✨ Beautify</button>
        <button class="${c('btn')}" data-act="copy" ${
          this._output ? '' : 'disabled'
        }>📋 Copy</button>
        <button class="${c('btn')}" data-act="dl" ${
          this._output ? '' : 'disabled'
        }>⬇ Download .js</button>
      </div>
      <div class="${c('outwrap')}">${outHtml}</div>
    </div>`)
  }
  _bindEvent() {
    const self = this
    this._$el.on('click', c('.btn'), function () {
      const act = this.getAttribute('data-act')
      if (act === 'go') self._go()
      else if (act === 'copy') self._copy()
      else if (act === 'dl') self._dl()
    })
    this._$el.on('change', c('[data-f="script"]'), function () {
      self._loadScript(this.value)
    })
    this._$el.on('change', c('[data-f="indent"]'), function () {
      self._indent = +this.value || 4
    })
  }
  _els() {
    const root = this._$el.get(0)
    return {
      code: root.querySelector('[data-f="code"]'),
      script: root.querySelector('[data-f="script"]'),
    }
  }
  _loadScript(value) {
    const { code } = this._els()
    if (!value) return
    if (value.indexOf('inline:') === 0) {
      const i = +value.slice(7)
      const s = document.scripts[i]
      if (s) {
        code.value = s.textContent || ''
        this._notify('Script inline #' + i + ' dimuat')
      }
      return
    }
    // script eksternal: coba fetch (bisa gagal karena CORS)
    fetch(value)
      .then((res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status)
        return res.text()
      })
      .then((text) => {
        code.value = text
        this._notify('Script halaman dimuat (' + fmtBytes(text.length) + ')')
      })
      .catch(() => {
        this._notify(
          'Gagal mengambil script (kemungkinan diblokir CORS). Salin manual via tab Sources.'
        )
      })
  }
  _go() {
    const { code } = this._els()
    const src = code.value
    if (!src.trim()) return this._notify('Kode JS masih kosong')
    try {
      this._output = beautify(src, { indent_size: this._indent })
      this._truncated = this._output.length > MAX_SHOW
      this._notify(
        'Beautify selesai (' + fmtBytes(this._output.length) + ')'
      )
    } catch (e) {
      this._notify('Gagal beautify: ' + e.message)
      return
    }
    this._render()
  }
  _copy() {
    if (!this._output) return
    copy(this._output)
    this._notify('Output disalin ke clipboard')
  }
  _dl() {
    if (!this._output) return
    download('beautified.js', this._output, 'text/javascript')
    this._notify('Download dimulai (beautified.js)')
  }
  _notify(msg) {
    this._container.notify(msg, { icon: 'success' })
  }
}
