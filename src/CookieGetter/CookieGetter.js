import Tool from '../DevTools/Tool'
import evalCss from '../lib/evalCss'
import { classPrefix as c } from '../lib/util'
import $ from 'licia/$'
import each from 'licia/each'
import escape from 'licia/escape'
import { copy, download } from '../Hozin/util'

function parseCookies() {
  const out = []
  const raw = document.cookie || ''
  if (!raw) return out
  each(raw.split(';'), (part) => {
    const idx = part.indexOf('=')
    if (idx < 0) return
    const name = part.slice(0, idx).trim()
    const value = part.slice(idx + 1)
    if (!name) return
    out.push({ name: name, value: value })
  })
  return out
}

function trunc(v, n) {
  return v.length > n ? v.slice(0, n) + '…' : v
}

export default class CookieGetter extends Tool {
  constructor() {
    super()
    this._style = evalCss(require('./CookieGetter.scss'))
    this.name = 'cookies'
    this._cookies = []
    this._expanded = -1
  }
  init($el, container) {
    super.init($el)
    this._container = container
    this._render()
    this._bindEvent()
    this._refresh()
  }
  destroy() {
    super.destroy()
    evalCss.remove(this._style)
  }
  _render() {
    this._$el.html(
      '<div class="' + c('wrap') + '">' +
        '<div class="' + c('banner') + '">' +
          'Cookie bertanda HttpOnly TIDAK bisa dibaca JavaScript (batasan keamanan browser) ' +
          '— hanya cookie biasa yang tampil di sini.' +
        '</div>' +
        '<div class="' + c('toolbar') + '">' +
          '<button class="' + c('refresh-btn') + '">Refresh</button>' +
          '<button class="' + c('exp-json-btn') + '">Export JSON</button>' +
          '<button class="' + c('exp-ns-btn') + '">Export Netscape</button>' +
          '<button class="' + c('import-toggle-btn') + '">Import</button>' +
        '</div>' +
        '<div class="' + c('import-box') + '" style="display:none">' +
          '<textarea class="' + c('import-area') + '" placeholder="Paste format Netscape (curl) atau JSON di sini…"></textarea>' +
          '<button class="' + c('import-run-btn') + '">Jalankan Import</button>' +
          '<div class="' + c('import-msg') + '"></div>' +
        '</div>' +
        '<div class="' + c('list') + '"></div>' +
      '</div>'
    )
  }
  _bindEvent() {
    const $el = this._$el
    $el.on('click', c('.refresh-btn'), () => this._refresh())
    $el.on('click', c('.exp-json-btn'), () => this._exportJson())
    $el.on('click', c('.exp-ns-btn'), () => this._exportNetscape())
    $el.on('click', c('.import-toggle-btn'), () => {
      $el.find(c('.import-box')).toggle()
    })
    $el.on('click', c('.import-run-btn'), () => this._import())
    $el.on('click', c('.row'), (e) => {
      if ($(e.target).closest(c('.del-btn') + ',' + c('.copy-btn')).length > 0) return
      const idx = $(e.currentTarget).data('idx')
      this._expanded = this._expanded === idx ? -1 : idx
      this._renderList()
    })
    $el.on('click', c('.copy-btn'), (e) => {
      e.stopPropagation()
      const idx = $(e.currentTarget).data('idx')
      const ck = this._cookies[idx]
      if (!ck) return
      copy(ck.name + '=' + ck.value)
      this._notify('Cookie disalin')
    })
    $el.on('click', c('.del-btn'), (e) => {
      e.stopPropagation()
      const idx = $(e.currentTarget).data('idx')
      const ck = this._cookies[idx]
      if (!ck) return
      document.cookie = ck.name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
      document.cookie = ck.name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      this._notify('Dihapus: ' + ck.name)
      this._refresh()
    })
  }
  _refresh() {
    this._cookies = parseCookies()
    this._expanded = -1
    this._renderList()
  }
  _renderList() {
    let html = ''
    if (this._cookies.length === 0) {
      html =
        '<div class="' + c('empty') + '">' +
          'Tidak ada cookie yang bisa dibaca JavaScript di halaman ini.' +
        '</div>'
    } else {
      html = '<div class="' + c('summary') + '">' + this._cookies.length + ' cookie</div>'
      each(this._cookies, (ck, i) => {
        html +=
          '<div class="' + c('row') + (this._expanded === i ? ' ' + c('open') : '') + '" data-idx="' + i + '">' +
            '<div class="' + c('row-main') + '">' +
              '<div class="' + c('cname') + '">' + escape(ck.name) + '</div>' +
              '<div class="' + c('cvalue') + '">' + escape(trunc(ck.value, 40)) + '</div>' +
            '</div>' +
            '<button class="' + c('del-btn') + '" data-idx="' + i + '">Hapus</button>' +
          '</div>'
        if (this._expanded === i) {
          html +=
            '<div class="' + c('detail') + '">' +
              '<div class="' + c('full-value') + '">' + escape(ck.value) + '</div>' +
              '<button class="' + c('copy-btn') + '" data-idx="' + i + '">Copy</button>' +
            '</div>'
        }
      })
    }
    this._$el.find(c('.list')).html(html)
  }
  _exportJson() {
    const arr = []
    each(this._cookies, (ck) => {
      arr.push({ name: ck.name, value: ck.value })
    })
    download('cookies-' + location.hostname + '.json', JSON.stringify(arr, null, 2), 'application/json')
    this._notify('Export JSON selesai')
  }
  _exportNetscape() {
    const domain = location.hostname
    const lines = ['# Netscape HTTP Cookie File']
    each(this._cookies, (ck) => {
      lines.push(domain + '\tTRUE\t/\tTRUE\t0\t' + ck.name + '\t' + ck.value)
    })
    download('cookies-' + domain + '.txt', lines.join('\n'), 'text/plain')
    this._notify('Export Netscape selesai')
  }
  _parseImport(text) {
    const pairs = []
    const t = text.trim()
    if (!t) return pairs
    if (t.charAt(0) === '{' || t.charAt(0) === '[') {
      try {
        const obj = JSON.parse(t)
        if (Array.isArray(obj)) {
          each(obj, (it) => {
            if (it && it.name) pairs.push({ name: String(it.name), value: String(it.value || '') })
          })
        } else {
          each(Object.keys(obj), (k) => {
            pairs.push({ name: k, value: String(obj[k]) })
          })
        }
      } catch { /* abaikan */ }
      return pairs
    }
    each(t.split('\n'), (line) => {
      const l = line.trim()
      if (!l || l.charAt(0) === '#') return
      const fields = l.split('\t')
      const f = fields.length >= 7 ? fields : l.split(/\s+/)
      if (f.length >= 7) {
        pairs.push({ name: f[5], value: f[6] })
      }
    })
    return pairs
  }
  _import() {
    const text = this._$el.find(c('.import-area')).val() || ''
    const pairs = this._parseImport(text)
    let ok = 0
    each(pairs, (p) => {
      try {
        document.cookie = p.name + '=' + p.value + '; path=/'
        ok++
      } catch { /* abaikan */ }
    })
    this._$el
      .find(c('.import-msg'))
      .text(pairs.length === 0 ? 'Format tidak dikenali.' : 'Berhasil import ' + ok + ' dari ' + pairs.length + ' cookie.')
    if (ok > 0) {
      this._notify('Import selesai: ' + ok + ' cookie')
      this._refresh()
    }
  }
  _notify(msg) {
    this._container.notify(msg, { icon: 'success' })
  }
}
