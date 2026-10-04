import Tool from '../DevTools/Tool'
import evalCss from '../lib/evalCss'
import { classPrefix as c } from '../lib/util'
import $ from 'licia/$'
import each from 'licia/each'
import escape from 'licia/escape'
import copy from 'licia/copy'
import { getSockets, onWsEvent } from '../Hozin/net'
import { shortUrl, fmtClock } from '../Hozin/util'

export default class WsInspector extends Tool {
  constructor() {
    super()
    this._style = evalCss(require('./WsInspector.scss'))
    this.name = 'websocket'
    this._socketId = 0
    this._expandedIdx = -1
  }
  init($el, container) {
    super.init($el)
    this._container = container
    this._render()
    this._bindEvent()
    this._unsub = onWsEvent(() => {
      if (this._socketId) this._renderMessages()
      else this._renderSockets()
    })
  }
  destroy() {
    this._unsub()
    super.destroy()
    evalCss.remove(this._style)
  }
  _render() {
    this._$el.html(`<div class="${c('wrap')}">
      <div class="${c('list')}"></div>
      <div class="${c('msgs')}"></div>
    </div>`)
    this._$list = this._$el.find(c('.list'))
    this._$msgs = this._$el.find(c('.msgs'))
    this._$msgs.hide()
    this._renderSockets()
  }
  _bindEvent() {
    const self = this
    this._$el
      .on('click', c('.sock'), function () {
        self._socketId = +$(this).data('id')
        self._expandedIdx = -1
        self._showMessages()
      })
      .on('click', c('.back'), () => self._showSockets())
      .on('click', c('.msg'), function (e) {
        if ($(e.target).hasClass(c('copy-msg'))) return
        const idx = +$(this).data('idx')
        self._expandedIdx = self._expandedIdx === idx ? -1 : idx
        self._renderMessages()
      })
      .on('click', c('.copy-msg'), function (e) {
        e.stopPropagation()
        self._copyMessage(+$(this).data('idx'))
      })
  }
  _findSocket(id) {
    const socks = getSockets()
    for (let i = 0; i < socks.length; i++) {
      if (socks[i].id === id) return socks[i]
    }
    return null
  }
  _showSockets() {
    this._socketId = 0
    this._expandedIdx = -1
    this._$msgs.hide()
    this._$list.show()
    this._renderSockets()
  }
  _showMessages() {
    this._$list.hide()
    this._$msgs.show()
    this._renderMessages()
  }
  _renderSockets() {
    const socks = getSockets()
    if (!socks.length) {
      this._$list.html(`<div class="${c('empty')}">Belum ada koneksi WebSocket.</div>`)
      return
    }
    let html = ''
    each(socks, (s) => {
      const state = s.closed ? 'CLOSED' : s.open ? 'OPEN' : 'CONNECTING'
      const stCls = s.closed ? 'closed' : s.open ? 'open' : 'pending'
      html += `<div class="${c('sock')}" data-id="${s.id}">
        <span class="${c('st')} ${c(stCls)}">${state}</span>
        <span class="${c('url')}">${escape(shortUrl(s.url))}</span>
        <span class="${c('count')}">${s.messages.length} pesan</span>
      </div>`
    })
    this._$list.html(html)
  }
  _renderMessages() {
    const sock = this._findSocket(this._socketId)
    if (!sock) {
      this._showSockets()
      return
    }
    let html = `<button class="${c('btn back')}">&larr; Kembali</button>
      <div class="${c('sock-url')}">${escape(sock.url)}</div>`
    if (!sock.messages.length) {
      html += `<div class="${c('empty')}">Belum ada pesan di socket ini.</div>`
    } else {
      each(sock.messages, (m, idx) => {
        const dirCls = m.dir === 'in' ? 'in' : 'out'
        const preview = m.data.length > 140 ? m.data.slice(0, 140) + '...' : m.data
        const expanded = this._expandedIdx === idx
        html += `<div class="${c('msg')}" data-idx="${idx}">
          <div class="${c('msg-head')}">
            <span class="${c('dir')} ${c(dirCls)}">${m.dir === 'in' ? 'IN' : 'OUT'}</span>
            <span class="${c('time')}">${fmtClock(m.time)}</span>
            <span class="${c('preview')}">${escape(preview)}</span>
          </div>
          ${
            expanded
              ? `<pre class="${c('full')}">${escape(m.data)}</pre>
                 <button class="${c('btn copy-msg')}" data-idx="${idx}">Salin pesan</button>`
              : ''
          }
        </div>`
      })
    }
    this._$msgs.html(html)
  }
  _copyMessage(idx) {
    const sock = this._findSocket(this._socketId)
    if (!sock || !sock.messages[idx]) return
    copy(sock.messages[idx].data)
    this._notify('Pesan tersalin')
  }
  _notify(msg) {
    this._container.notify(msg, { icon: 'success' })
  }
}
