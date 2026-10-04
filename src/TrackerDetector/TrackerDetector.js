import Tool from '../DevTools/Tool'
import evalCss from '../lib/evalCss'
import { classPrefix as c } from '../lib/util'
import $ from 'licia/$'
import each from 'licia/each'
import escape from 'licia/escape'
import {
  ensureNetPatch,
  onRequest,
  getRequests,
  addBlockPattern,
  removeBlockPattern,
} from '../Hozin/net'

const TRACKERS = [
  'googletagmanager.com',
  'google-analytics.com',
  'analytics.google.com',
  'facebook.net',
  'connect.facebook.net',
  'doubleclick.net',
  'hotjar.com',
  'mixpanel.com',
  'segment.io',
  'amplitude.com',
  'fullstory.com',
  'matomo',
  'criteo.com',
  'taboola.com',
  'outbrain.com',
]

export default class TrackerDetector extends Tool {
  constructor() {
    super()
    this._style = evalCss(require('./TrackerDetector.scss'))
    this.name = 'trackers'
    this._domains = {}
    this._off = null
  }
  init($el, container) {
    super.init($el)
    this._container = container
    ensureNetPatch()
    this._render()
    this._bindEvent()
    /* pindai request yang sudah tercatat sebelum tool dibuka */
    each(getRequests(), (entry) => this._handle(entry))
    this._off = onRequest((entry) => {
      this._handle(entry)
      this._renderList()
    })
  }
  destroy() {
    if (this._off) {
      this._off()
      this._off = null
    }
    super.destroy()
    evalCss.remove(this._style)
  }
  _render() {
    this._$el.html(
      '<div class="' + c('wrap') + '">' +
        '<div class="' + c('banner') + '">' +
          'Memantau request fetch/XHR halaman secara live. Blocking memakai pola ' +
          'domain net.js — request baru ke domain yang diblokir akan digagalkan ' +
          'sebelum dikirim (berpengaruh ke fetch/XHR halaman).' +
        '</div>' +
        '<div class="' + c('summary') + '"></div>' +
        '<div class="' + c('list') + '"></div>' +
        '<div class="' + c('blocked-title') + '">Diblokir</div>' +
        '<div class="' + c('blocked-list') + '"></div>' +
      '</div>'
    )
    this._renderList()
  }
  _bindEvent() {
    this._$el.on('click', c('.block-btn'), (e) => {
      const domain = $(e.currentTarget).data('domain')
      this._block(domain)
    })
    this._$el.on('click', c('.unblock-btn'), (e) => {
      const domain = $(e.currentTarget).data('domain')
      this._unblock(domain)
    })
    this._$el.on('click', c('.clear-btn'), () => {
      this._domains = {}
      this._renderList()
      this._notify('Daftar tracker dibersihkan')
    })
  }
  _handle(entry) {
    const url = entry && entry.url ? String(entry.url) : ''
    if (!url) return
    each(TRACKERS, (t) => {
      if (url.indexOf(t) >= 0) {
        let d = this._domains[t]
        if (!d) {
          d = { domain: t, urls: {}, hits: 0, blockRule: null }
          this._domains[t] = d
        }
        if (!d.urls[url]) {
          d.urls[url] = true
        }
        d.hits++
      }
    })
  }
  _block(domain) {
    const d = this._domains[domain]
    if (!d || d.blockRule) return
    d.blockRule = addBlockPattern(domain)
    this._renderList()
    this._notify('Diblokir: ' + domain)
  }
  _unblock(domain) {
    const d = this._domains[domain]
    if (!d || !d.blockRule) return
    removeBlockPattern(d.blockRule)
    d.blockRule = null
    this._renderList()
    this._notify('Unblock: ' + domain)
  }
  _renderList() {
    const names = Object.keys(this._domains).sort()
    const detected = names.length
    let blocked = 0
    let html = ''
    if (names.length === 0) {
      html =
        '<div class="' + c('empty') + '">' +
          'Belum ada tracker terdeteksi. Request ke domain tracker akan muncul di sini ' +
          'saat halaman memuatnya.' +
        '</div>'
    } else {
      each(names, (name) => {
        const d = this._domains[name]
        const urlCount = Object.keys(d.urls).length
        if (d.blockRule) blocked++
        html +=
          '<div class="' + c('row') + '">' +
            '<div class="' + c('row-info') + '">' +
              '<div class="' + c('domain') + '">' + escape(name) + '</div>' +
              '<div class="' + c('meta') + '">' + urlCount + ' URL unik · ' + d.hits + ' hit</div>' +
            '</div>' +
            (d.blockRule
              ? '<span class="' + c('blocked-badge') + '">BLOCKED</span>'
              : '<button class="' + c('block-btn') + '" data-domain="' + escape(name) + '">Block</button>') +
          '</div>'
      })
    }
    this._$el.find(c('.list')).html(html)
    this._$el
      .find(c('.summary'))
      .html(
        '<strong>' + detected + '</strong> tracker terdeteksi · ' +
          '<strong>' + blocked + '</strong> diblokir' +
          (names.length > 0 ? ' · <button class="' + c('clear-btn') + '">Bersihkan</button>' : '')
      )
    let bHtml = ''
    let anyBlocked = false
    each(names, (name) => {
      const d = this._domains[name]
      if (d.blockRule) {
        anyBlocked = true
        bHtml +=
          '<div class="' + c('row') + '">' +
            '<div class="' + c('row-info') + '">' +
              '<div class="' + c('domain') + '">' + escape(name) + '</div>' +
            '</div>' +
            '<button class="' + c('unblock-btn') + '" data-domain="' + escape(name) + '">Unblock</button>' +
          '</div>'
      }
    })
    if (!anyBlocked) {
      bHtml = '<div class="' + c('empty') + '">Tidak ada domain yang diblokir.</div>'
    }
    this._$el.find(c('.blocked-list')).html(bHtml)
  }
  _notify(msg) {
    this._container.notify(msg, { icon: 'success' })
  }
}
