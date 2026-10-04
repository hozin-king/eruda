import Tool from '../DevTools/Tool'
import evalCss from '../lib/evalCss'
import { classPrefix as c } from '../lib/util'
import $ from 'licia/$'
import map from 'licia/map'

const CATALOG = [
  {
    title: 'Jaringan',
    tools: [
      { name: 'curl', icon: '📋', label: 'cURL Export', desc: 'Salin request sebagai perintah cURL' },
      { name: 'interceptor', icon: '✏️', label: 'Interceptor', desc: 'Ubah header/body request lalu replay' },
      { name: 'mock', icon: '🎭', label: 'Net Mock', desc: 'Mock response berdasar pola URL' },
      { name: 'websocket', icon: '🔌', label: 'WebSocket', desc: 'Intip traffic WebSocket live' },
      { name: 'har', icon: '📦', label: 'HAR Export', desc: 'Export traffic ke file .HAR' },
      { name: 'api-tester', icon: '🚀', label: 'API Tester', desc: 'Kirim HTTP request manual' },
    ],
  },
  {
    title: 'Media',
    tools: [{ name: 'media', icon: '🎬', label: 'Media Sniffer', desc: 'Tangkap URL video/audio halaman' }],
  },
  {
    title: 'Performa',
    tools: [
      { name: 'fps', icon: '🎞️', label: 'FPS Meter', desc: 'Frame-rate + memori JS live' },
      { name: 'perf', icon: '⚡', label: 'Perf Audit', desc: 'Audit performa ala Lighthouse' },
      { name: 'page', icon: '📄', label: 'Page Audit', desc: 'Daftar script/gambar/stylesheet' },
    ],
  },
  {
    title: 'Keamanan',
    tools: [
      { name: 'keys', icon: '🔑', label: 'Key Scanner', desc: 'Cari API key yang ke-expose' },
      { name: 'licenses', icon: '📜', label: 'Licenses', desc: 'Deteksi library JS + lisensinya' },
      { name: 'trackers', icon: '🕵️', label: 'Trackers', desc: 'Deteksi & blokir tracker/iklan' },
      { name: 'phish', icon: '🎣', label: 'Phish Detector', desc: 'Deteksi exfil Telegram/Discord' },
      { name: 'xss', icon: '🪲', label: 'XSS Scanner', desc: 'Pindai celah XSS ringan' },
      { name: 'sqli', icon: '🧪', label: 'SQLi Checker', desc: 'Cek error DB heuristik' },
    ],
  },
  {
    title: 'Penyimpanan',
    tools: [
      { name: 'cookies', icon: '🍪', label: 'Cookie Getter', desc: 'Lihat, copy, export/import cookie' },
      { name: 'indexeddb', icon: '🗄️', label: 'IndexedDB', desc: 'Viewer & editor IndexedDB' },
    ],
  },
  {
    title: 'Produktivitas',
    tools: [
      { name: 'recorder', icon: '🎬', label: 'Recorder', desc: 'Rekam & replay aksi halaman' },
      { name: 'userscripts', icon: '💉', label: 'Userscripts', desc: 'Script auto-jalan tiap halaman' },
      { name: 'beautify', icon: '✨', label: 'JS Beautifier', desc: 'Format ulang JS minified' },
      { name: 'a11y', icon: '♿', label: 'A11y Audit', desc: 'Audit aksesibilitas (axe-core)' },
    ],
  },
]

export default class HozinHub extends Tool {
  constructor() {
    super()
    this._style = evalCss(require('./HozinHub.scss'))
    this.name = 'hub'
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
    const sections = map(
      CATALOG,
      (cat) => `
      <div class="${c('section')}">
        <h2 class="${c('section-title')}">${cat.title}</h2>
        <div class="${c('grid')}">
          ${map(
            cat.tools,
            (t) => `
            <div class="${c('card')}" data-tool="${t.name}">
              <div class="${c('card-icon')}">${t.icon}</div>
              <div class="${c('card-label')}">${t.label}</div>
              <div class="${c('card-desc')}">${t.desc}</div>
            </div>`
          ).join('')}
        </div>
      </div>`
    ).join('')

    this._$el.html(`
      <div class="${c('hero')}">
        <div class="${c('hero-title')}">🛠️ Hozin Eruda Pro</div>
        <div class="${c('hero-sub')}">20 tool pro + 8 tool bawaan eruda</div>
      </div>
      ${sections}
    `)
  }
  _bindEvent() {
    const container = this._container
    this._$el.on('click', c('.card'), function () {
      const name = $(this).data('tool')
      try {
        container.showTool(name)
      } catch {
        container.notify('Tool tidak ditemukan: ' + name, { icon: 'error' })
      }
    })
  }
}

export { CATALOG }
