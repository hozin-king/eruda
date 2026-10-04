import Tool from '../DevTools/Tool'
import evalCss from '../lib/evalCss'
import { classPrefix as c } from '../lib/util'
import $ from 'licia/$'
import each from 'licia/each'
import escape from 'licia/escape'
import copy from 'licia/copy'
import { getRequests, clearRequests, onRequest, onResponse } from '../Hozin/net'
import { shortUrl } from '../Hozin/util'

/* Escape a string for safe inclusion inside single quotes in shell. */
function shellEscape(s) {
  return String(s).replace(/'/g, "'\\''")
}

export default class CurlExport extends Tool {
  constructor() {
    super()
    this._style = evalCss(require('./CurlExport.scss'))
    this.name = 'curl'
    this._filter = ''
    this._selectedId = 0
  }
  init($el, container) {
    super.init($el)
    this._container = container
    this._render()
    this._bindEvent()
    this._unsubReq = onRequest(() => this._refresh())
    this._unsubRes = onResponse(() => this._refresh())
  }
  destroy() {
    this._unsubReq()
    this._unsubRes()
    super.destroy()
    evalCss.remove(this._style)
  }
  _render() {
    this._$el.html(`<div class="${c('wrap')}">
      <div class="${c('toolbar')}">
        <input class="${c('filter')}" placeholder="Filter URL / method..." />
        <button class="${c('btn clear-log')}">Hapus</button>
      </div>
      <div class="${c('list')}"></div>
      <div class="${c('detail')}"></div>
    </div>`)
    this._$list = this._$el.find(c('.list'))
    this._$detail = this._$el.find(c('.detail'))
    this._$detail.hide()
    this._refresh()
  }
  _bindEvent() {
    const self = this
    this._$el
      .on('click', c('.row'), function () {
        self._showDetail(+$(this).data('id'))
      })
      .on('click', c('.back'), () => self._hideDetail())
      .on('click', c('.copy-curl'), () => self._copyCurl())
      .on('click', c('.copy-url'), () => self._copyUrl())
      .on('click', c('.clear-log'), () => {
        clearRequests()
        self._hideDetail()
        self._refresh()
        self._notify('Log request dihapus')
      })
      .on('input', c('.filter'), function () {
        self._filter = $(this).val()
        self._refresh()
      })
  }
  _findEntry(id) {
    const all = getRequests()
    for (let i = 0; i < all.length; i++) {
      if (all[i].id === id) return all[i]
    }
    return null
  }
  _visibleEntries() {
    const f = this._filter.trim().toLowerCase()
    const all = getRequests()
    if (!f) return all
    return all.filter((e) => (e.method + ' ' + e.url).toLowerCase().indexOf(f) !== -1)
  }
  _refresh() {
    const list = this._visibleEntries()
    if (!list.length) {
      this._$list.html(
        `<div class="${c('empty')}">Belum ada request tercatat.<br/>Request fetch / XHR dari halaman ini akan muncul di sini.</div>`
      )
    } else {
      let html = ''
      each(list, (entry) => {
        html += this._rowHtml(entry)
      })
      this._$list.html(html)
    }
    if (this._selectedId) {
      const entry = this._findEntry(this._selectedId)
      if (entry) this._renderDetail(entry)
    }
  }
  _methodBadge(method) {
    const m = String(method || 'GET').toLowerCase()
    return `<span class="${c('badge')} ${c('m-' + m)}">${escape(String(method || 'GET'))}</span>`
  }
  _statusHtml(entry) {
    if (entry.blocked) return `<span class="${c('status err')}">BLOCKED</span>`
    if (entry.error && !entry.status) return `<span class="${c('status err')}">ERR</span>`
    if (!entry.status) return `<span class="${c('status pending')}">...</span>`
    const cls = entry.status < 400 ? 'ok' : 'err'
    return `<span class="${c('status')} ${c(cls)}">${entry.status}</span>`
  }
  _rowHtml(entry) {
    const dur = entry.endTime ? `<span class="${c('dur')}">${entry.duration}ms</span>` : ''
    const tag = entry.mocked
      ? ` <span class="${c('tag')}">MOCK</span>`
      : entry.blocked
        ? ` <span class="${c('tag blocked')}">BLOCKED</span>`
        : ''
    return `<div class="${c('row')}" data-id="${entry.id}">
      ${this._methodBadge(entry.method)}
      <span class="${c('url')}">${escape(shortUrl(entry.url))}</span>
      ${this._statusHtml(entry)}${dur}${tag}
    </div>`
  }
  _kvHtml(obj) {
    let html = `<table class="${c('kv')}">`
    let count = 0
    each(obj, (v, k) => {
      count++
      html += `<tr><td class="${c('k')}">${escape(String(k))}</td><td>${escape(String(v))}</td></tr>`
    })
    if (!count) html += `<tr><td class="${c('muted')}">(kosong)</td></tr>`
    return html + '</table>'
  }
  _showDetail(id) {
    const entry = this._findEntry(id)
    if (!entry) return
    this._selectedId = id
    this._renderDetail(entry)
    this._$list.hide()
    this._$detail.show()
  }
  _hideDetail() {
    this._selectedId = 0
    this._$detail.hide()
    this._$list.show()
  }
  _renderDetail(entry) {
    const resLine = entry.blocked
      ? `<span class="${c('status err')}">BLOCKED</span> ${escape(entry.error || '')}`
      : entry.error && !entry.status
        ? `<span class="${c('status err')}">ERROR</span> ${escape(entry.error)}`
        : entry.status
          ? `<span class="${c('status')} ${c(entry.status < 400 ? 'ok' : 'err')}">${entry.status}</span>
             <span>${escape(entry.statusText || '')}</span>
             <span class="${c('muted')}">${entry.duration}ms${entry.mocked ? ' (mocked)' : ''}</span>`
          : `<span class="${c('status pending')}">menunggu respons...</span>`
    this._$detail.html(`
      <button class="${c('btn back')}">&larr; Kembali</button>
      <div class="${c('d-head')}">
        ${this._methodBadge(entry.method)}
        <span class="${c('d-url')}">${escape(entry.url)}</span>
      </div>
      <div class="${c('d-actions')}">
        <button class="${c('btn copy-curl')}">Copy as cURL</button>
        <button class="${c('btn copy-url')}">Copy URL</button>
      </div>
      <div class="${c('sec')}">Request Headers</div>
      ${this._kvHtml(entry.reqHeaders)}
      ${
        entry.reqBody
          ? `<div class="${c('sec')}">Request Body</div><pre class="${c('body')}">${escape(entry.reqBody)}</pre>`
          : ''
      }
      <div class="${c('sec')}">Response</div>
      <div class="${c('res-line')}">${resLine}</div>
      ${this._kvHtml(entry.resHeaders)}
      ${
        entry.resBody
          ? `<div class="${c('sec')}">Response Body${
              entry.resTruncated ? ' <span class="' + c('muted') + '">(terpotong)</span>' : ''
            }</div><pre class="${c('body')}">${escape(entry.resBody)}</pre>`
          : ''
      }
    `)
  }
  _buildCurl(entry) {
    const parts = ['curl', '-X', entry.method, `'${shellEscape(entry.url)}'`]
    each(entry.reqHeaders, (v, k) => {
      parts.push('-H', `'${shellEscape(k + ': ' + v)}'`)
    })
    if (entry.reqBody) parts.push('--data-raw', `'${shellEscape(entry.reqBody)}'`)
    return parts.join(' ')
  }
  _copyCurl() {
    const entry = this._findEntry(this._selectedId)
    if (!entry) return
    copy(this._buildCurl(entry))
    this._notify('cURL tersalin')
  }
  _copyUrl() {
    const entry = this._findEntry(this._selectedId)
    if (!entry) return
    copy(entry.url)
    this._notify('URL tersalin')
  }
  _notify(msg) {
    this._container.notify(msg, { icon: 'success' })
  }
}
