import Tool from '../DevTools/Tool'
import evalCss from '../lib/evalCss'
import { classPrefix as c } from '../lib/util'
import each from 'licia/each'
import escape from 'licia/escape'

/* [nama, kata kunci di URL script, lisensi] */
const KNOWN = [
  ['jQuery', 'jquery', 'MIT'],
  ['Lodash', 'lodash', 'MIT'],
  ['React DOM', 'react-dom', 'MIT'],
  ['React', 'react', 'MIT'],
  ['Vue', 'vue', 'MIT'],
  ['Axios', 'axios', 'MIT'],
  ['Moment.js', 'moment', 'MIT'],
  ['Day.js', 'dayjs', 'MIT'],
  ['Three.js', 'three', 'MIT'],
  ['D3.js', 'd3', 'ISC'],
  ['Chart.js', 'chart', 'MIT'],
  ['Bootstrap', 'bootstrap', 'MIT'],
  ['Tailwind CSS', 'tailwind', 'MIT'],
  ['Alpine.js', 'alpine', 'MIT'],
  ['Svelte', 'svelte', 'MIT'],
  ['Ember CLI', 'ember', 'MIT'],
  ['Backbone.js', 'backbone', 'MIT'],
  ['Underscore.js', 'underscore', 'MIT'],
  ['Swiper', 'swiper', 'MIT'],
  ['GSAP', 'gsap', 'Gratis / Standar'],
  ['Firebase', 'firebase', 'Apache-2.0'],
  ['core-js', 'core-js', 'MIT'],
  ['Zone.js', 'zone', 'MIT'],
  ['RxJS', 'rxjs', 'Apache-2.0'],
]

/* [nama kanonik, fungsi pembaca versi dari window] — null bila hanya terdeteksi. */
const GLOBALS = [
  ['jQuery', () => (window.jQuery && window.jQuery.fn ? window.jQuery.fn.jquery : null)],
  ['Lodash', () => (window._ && window._.VERSION ? window._.VERSION : null)],
  ['React', () => (window.React && window.React.version ? window.React.version : null)],
  ['Vue', () => (window.Vue && window.Vue.version ? window.Vue.version : null)],
  ['Axios', () => (window.axios ? '' : null)],
  ['Moment.js', () => (window.moment && window.moment.version ? window.moment.version : null)],
]

function versionFromUrl(url) {
  const m = url.match(/[@/-](\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/)
  return m ? m[1] : ''
}

export default class LicenseInspector extends Tool {
  constructor() {
    super()
    this._style = evalCss(require('./LicenseInspector.scss'))
    this.name = 'licenses'
    this._libs = []
  }
  init($el, container) {
    super.init($el)
    this._container = container
    this._detect()
    this._render()
    this._bindEvent()
  }
  destroy() {
    super.destroy()
    evalCss.remove(this._style)
  }
  _render() {
    this._$el.html(
      '<div class="' + c('wrap') + '">' +
        '<div class="' + c('banner') + '">' +
          'Deteksi heuristik dari URL script & global window — bukan audit hukum. ' +
          'Selalu cek lisensi resmi library sebelum dipakai produksi.' +
        '</div>' +
        '<button class="' + c('refresh-btn') + '">Deteksi ulang</button>' +
        '<div class="' + c('table') + '">' + this._tableHtml() + '</div>' +
      '</div>'
    )
  }
  _bindEvent() {
    this._$el.on('click', c('.refresh-btn'), () => {
      this._detect()
      this._$el.find(c('.table')).html(this._tableHtml())
      this._notify('Deteksi ulang selesai')
    })
  }
  _add(name, version, license, source) {
    let lib = null
    each(this._libs, (l) => {
      if (l.name === name) lib = l
    })
    if (!lib) {
      lib = { name: name, version: version || '', license: license, sources: [] }
      this._libs.push(lib)
    }
    if (version && !lib.version) lib.version = version
    if (lib.sources.indexOf(source) < 0) lib.sources.push(source)
  }
  _detect() {
    this._libs = []
    const byName = {}
    each(KNOWN, (k) => {
      byName[k[0]] = k
    })
    /* (a) cocokkan dari src script tags */
    try {
      each(document.querySelectorAll('script[src]'), (el) => {
        const src = el.getAttribute('src') || ''
        const low = src.toLowerCase()
        each(KNOWN, (k) => {
          if (low.indexOf(k[1]) >= 0) {
            this._add(k[0], versionFromUrl(src), k[2], 'script: ' + src)
          }
        })
      })
    } catch { /* abaikan */ }
    /* (b) cocokkan dari global window */
    each(GLOBALS, (g) => {
      let version = null
      try {
        version = g[1]()
      } catch { /* abaikan */ }
      if (version !== null && version !== undefined) {
        const k = byName[g[0]]
        if (k) this._add(k[0], version, k[2], 'window (global)')
      }
    })
  }
  _tableHtml() {
    if (this._libs.length === 0) {
      return (
        '<div class="' + c('empty') + '">' +
          'Tidak ada library dikenal yang terdeteksi di halaman ini.' +
        '</div>'
      )
    }
    let html =
      '<div class="' + c('summary') + '">' + this._libs.length + ' library terdeteksi</div>' +
      '<table class="' + c('tbl') + '">' +
        '<thead><tr>' +
          '<th>Library</th><th>Versi</th><th>Lisensi</th><th>Sumber</th>' +
        '</tr></thead><tbody>'
    each(this._libs, (l) => {
      html +=
        '<tr>' +
          '<td class="' + c('col-lib') + '">' + escape(l.name) + '</td>' +
          '<td>' + escape(l.version || '—') + '</td>' +
          '<td><span class="' + c('license') + '">' + escape(l.license) + '</span></td>' +
          '<td class="' + c('col-src') + '" title="' + escape(l.sources.join('\n')) + '">' +
            escape(l.sources.length > 1 ? l.sources.length + ' sumber' : l.sources[0]) +
          '</td>' +
        '</tr>'
    })
    html += '</tbody></table>'
    return html
  }
  _notify(msg) {
    this._container.notify(msg, { icon: 'success' })
  }
}
