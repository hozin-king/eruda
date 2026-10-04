import Tool from '../DevTools/Tool'
import evalCss from '../lib/evalCss'
import { classPrefix as c } from '../lib/util'
import each from 'licia/each'
import escape from 'licia/escape'
import { getRequests, onResponse } from '../Hozin/net'
import { copy, shortUrl } from '../Hozin/util'

const MEDIA_EXTS = ['.mp4', '.m3u8', '.mpd', '.webm', '.mp3', '.wav', '.ogg', '.m4a']

function stripQuery(url) {
  return String(url || '')
    .split('?')[0]
    .toLowerCase()
}

function detectType(url, mime) {
  const u = stripQuery(url)
  const m = String(mime || '').toLowerCase()
  if (
    u.endsWith('.m3u8') ||
    u.endsWith('.mpd') ||
    m.indexOf('mpegurl') >= 0 ||
    m.indexOf('dash+xml') >= 0
  ) {
    return 'STREAM'
  }
  if (
    m.indexOf('audio/') === 0 ||
    u.endsWith('.mp3') ||
    u.endsWith('.wav') ||
    u.endsWith('.ogg') ||
    u.endsWith('.m4a')
  ) {
    return 'AUDIO'
  }
  return 'VIDEO'
}

function isMediaEntry(entry) {
  if (!entry || entry.error || entry.blocked || entry.mocked) return false
  const u = stripQuery(entry.url)
  for (let i = 0; i < MEDIA_EXTS.length; i++) {
    if (u.endsWith(MEDIA_EXTS[i])) return true
  }
  const m = String(entry.mime || '').toLowerCase()
  return m.indexOf('video/') === 0 || m.indexOf('audio/') === 0
}

export default class MediaSniffer extends Tool {
  constructor() {
    super()
    this._style = evalCss(require('./MediaSniffer.scss'))
    this.name = 'media'
    this._items = new Map()
    this._unsub = null
  }
  init($el, container) {
    super.init($el)
    this._container = container
    this._render()
    this._bindEvent()
    this._rescan()
    this._unsub = onResponse((entry) => {
      if (isMediaEntry(entry)) {
        this._add(String(entry.url), detectType(entry.url, entry.mime), 'net')
      }
    })
  }
  destroy() {
    if (this._unsub) this._unsub()
    super.destroy()
    evalCss.remove(this._style)
  }
  _render() {
    this._$el.html(`<div class="${c('wrap')}">
      <div class="${c('toolbar')}">
        <button class="${c('btn')} ${c('btn-accent')}">Scan ulang</button>
        <span class="${c('count')}">0 media</span>
      </div>
      <div class="${c('list')}"></div>
    </div>`)
    this._$list = this._$el.find(c('.list'))
    this._$count = this._$el.find(c('.count'))
    this._refresh()
  }
  _bindEvent() {
    const self = this
    this._$el.on('click', c('.toolbar') + ' ' + c('.btn'), () => {
      self._rescan()
      self._notify('Scan selesai')
    })
    this._$el.on('click', c('.item') + ' ' + c('.btn'), function () {
      const url = this.getAttribute('data-url')
      const act = this.getAttribute('data-act')
      if (!url) return
      if (act === 'copy') {
        copy(url)
        self._notify('URL disalin')
      } else if (act === 'open') {
        window.open(url, '_blank')
      }
    })
  }
  _rescan() {
    const self = this
    each(document.querySelectorAll('video, audio, source, track'), (el) => {
      const src = el.currentSrc || el.src
      if (src) self._add(src, detectType(src, ''), 'dom')
    })
    each(getRequests(), (req) => {
      if (isMediaEntry(req)) {
        self._add(String(req.url), detectType(req.url, req.mime), 'net')
      }
    })
    this._refresh()
  }
  _add(url, type, source) {
    if (!url || this._items.has(url)) return
    this._items.set(url, { url, type, source })
    this._refresh()
  }
  _refresh() {
    const items = Array.from(this._items.values()).reverse()
    this._$count.text(items.length + ' media')
    if (!items.length) {
      this._$list.html(
        `<div class="${c('empty')}">Belum ada media terdeteksi.<br/>Putar video/audio di halaman ini, atau tekan "Scan ulang".</div>`
      )
      return
    }
    let html = ''
    each(items, (it) => {
      html += `<div class="${c('item')}">
        <span class="${c('badge')} ${c('badge-' + it.type.toLowerCase())}">${it.type}</span>
        <div class="${c('meta')}">
          <div class="${c('url')}" title="${escape(it.url)}">${escape(shortUrl(it.url, 72))}</div>
          <div class="${c('src')}">sumber: ${it.source === 'dom' ? 'elemen halaman' : 'network'}</div>
        </div>
        <div class="${c('actions')}">
          <button class="${c('btn')}" data-act="copy" data-url="${escape(it.url)}">Copy</button>
          <button class="${c('btn')}" data-act="open" data-url="${escape(it.url)}">Buka</button>
        </div>
      </div>`
    })
    this._$list.html(html)
  }
  _notify(msg) {
    this._container.notify(msg, { icon: 'success' })
  }
}
