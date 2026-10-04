import Tool from '../DevTools/Tool'
import evalCss from '../lib/evalCss'
import { classPrefix as c } from '../lib/util'
import $ from 'licia/$'
import each from 'licia/each'
import escape from 'licia/escape'
import { shortUrl } from '../Hozin/util'

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

/* Parse "Key: Value" lines into an object. */
function parseHeaderLines(text) {
  const out = {}
  String(text || '')
    .split('\n')
    .forEach((line) => {
      const idx = line.indexOf(':')
      if (idx > 0) {
        const k = line.slice(0, idx).trim()
        const v = line.slice(idx + 1).trim()
        if (k) out[k] = v
      }
    })
  return out
}

function prettyBody(text) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

export default class ApiTester extends Tool {
  constructor() {
    super()
    this._style = evalCss(require('./ApiTester.scss'))
    this.name = 'api-tester'
    this._history = []
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
  _render() {
    const methodOpts = METHODS.map((m) => `<option value="${m}">${m}</option>`).join('')
    this._$el.html(`<div class="${c('wrap')}">
      <div class="${c('form')}">
        <div class="${c('f-row')}">
          <select class="${c('f-method')}">${methodOpts}</select>
          <input class="${c('f-url')}" placeholder="https://api.contoh.com/data" />
        </div>
        <textarea class="${c('f-headers')}" rows="2" placeholder="Header per baris, format: Key: Value"></textarea>
        <textarea class="${c('f-body')}" rows="3" placeholder="Body (untuk POST / PUT / PATCH / DELETE)"></textarea>
        <button class="${c('btn send')}">Kirim</button>
      </div>
      <div class="${c('result')}"></div>
      <div class="${c('sec')}">Riwayat</div>
      <div class="${c('history')}"></div>
    </div>`)
    this._$result = this._$el.find(c('.result'))
    this._$history = this._$el.find(c('.history'))
    this._renderHistory()
  }
  _bindEvent() {
    const self = this
    this._$el
      .on('click', c('.send'), () => self._send())
      .on('click', c('.hist-row'), function () {
        self._refill(+$(this).data('idx'))
      })
  }
  _send() {
    const method = this._$el.find(c('.f-method')).val()
    const url = this._$el.find(c('.f-url')).val().trim()
    const headers = parseHeaderLines(this._$el.find(c('.f-headers')).val())
    const bodyText = this._$el.find(c('.f-body')).val()
    if (!url) {
      this._notify('Isi URL dulu')
      return
    }
    const hasBody = /POST|PUT|PATCH|DELETE/i.test(method) && bodyText.length > 0
    this._$result.html(`<div class="${c('loading')}">Mengirim...</div>`)
    const t0 = Date.now()
    fetch(url, {
      method,
      headers,
      body: hasBody ? bodyText : undefined,
    })
      .then((res) =>
        res.text().then((t) => ({
          status: res.status,
          statusText: res.statusText,
          headers: res.headers,
          body: t,
        }))
      )
      .then((r) => {
        const dur = Date.now() - t0
        this._showResult({
          ok: true,
          method,
          url,
          status: r.status,
          statusText: r.statusText,
          headers: r.headers,
          body: r.body,
          duration: dur,
        })
        this._history.unshift({ method, url, headersText: this._$el.find(c('.f-headers')).val(), body: bodyText })
        if (this._history.length > 20) this._history.length = 20
        this._renderHistory()
      })
      .catch((err) => {
        const dur = Date.now() - t0
        const msg = String((err && err.message) || err)
        this._$result.html(`<div class="${c('err-box')}">
          <div class="${c('err-title')}">Gagal mengirim (${dur}ms)</div>
          <div class="${c('err-msg')}">${escape(msg)}</div>
          <div class="${c('err-hint')}">Kemungkinan penyebab: CORS diblokir browser, URL salah, atau tidak ada koneksi jaringan.</div>
        </div>`)
      })
  }
  _showResult(r) {
    const cls = r.status < 400 ? 'ok' : 'err'
    let hdrHtml = `<table class="${c('kv')}">`
    let count = 0
    try {
      r.headers.forEach((v, k) => {
        count++
        hdrHtml += `<tr><td class="${c('k')}">${escape(k)}</td><td>${escape(v)}</td></tr>`
      })
    } catch {
      /* ignore */
    }
    if (!count) hdrHtml += `<tr><td class="${c('muted')}">(kosong)</td></tr>`
    hdrHtml += '</table>'
    this._$result.html(`
      <div class="${c('res-line')}">
        <span class="${c('status')} ${c(cls)}">${r.status}</span>
        <span>${escape(r.statusText || '')}</span>
        <span class="${c('muted')}">${r.duration}ms</span>
      </div>
      <div class="${c('sec')}">Response Headers</div>
      ${hdrHtml}
      <div class="${c('sec')}">Response Body</div>
      <pre class="${c('body')}">${escape(prettyBody(r.body))}</pre>
    `)
  }
  _renderHistory() {
    if (!this._history.length) {
      this._$history.html(`<div class="${c('empty')}">Belum ada riwayat pengiriman.</div>`)
      return
    }
    let html = ''
    each(this._history, (h, idx) => {
      html += `<div class="${c('hist-row')}" data-idx="${idx}">
        <span class="${c('badge')}">${escape(h.method)}</span>
        <span class="${c('url')}">${escape(shortUrl(h.url))}</span>
      </div>`
    })
    this._$history.html(html)
  }
  _refill(idx) {
    const h = this._history[idx]
    if (!h) return
    this._$el.find(c('.f-method')).val(h.method)
    this._$el.find(c('.f-url')).val(h.url)
    this._$el.find(c('.f-headers')).val(h.headersText || '')
    this._$el.find(c('.f-body')).val(h.body || '')
    this._notify('Form diisi dari riwayat')
  }
  _notify(msg) {
    this._container.notify(msg, { icon: 'success' })
  }
}
