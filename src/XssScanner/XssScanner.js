import Tool from '../DevTools/Tool'
import evalCss from '../lib/evalCss'
import { classPrefix as c } from '../lib/util'
import each from 'licia/each'
import escape from 'licia/escape'

const MAX_TESTS = 10
const GAP_MS = 400

/* Sink berbahaya -> level bila berdiri sendiri. */
const SINKS = [
  { name: 'innerHTML =', regex: /\.innerHTML\s*=/, risk: 'Sedang' },
  { name: 'outerHTML =', regex: /\.outerHTML\s*=/, risk: 'Sedang' },
  { name: 'document.write(', regex: /document\.write\s*\(/, risk: 'Sedang' },
  { name: 'document.writeln(', regex: /document\.writeln\s*\(/, risk: 'Sedang' },
  { name: 'eval(', regex: /[^a-zA-Z0-9_$]eval\s*\(/, risk: 'Tinggi' },
  { name: 'insertAdjacentHTML(', regex: /insertAdjacentHTML\s*\(/, risk: 'Sedang' },
  { name: '.html(', regex: /\$\([^)]*\)\.html\s*\(/, risk: 'Sedang' },
]

/* Source yang bisa dikendalikan penyerang. */
const SOURCES = [
  /location\.hash/,
  /location\.search/,
  /document\.referrer/,
  /location\.href/,
  /postMessage/,
  /document\.cookie/,
  /window\.name/,
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export default class XssScanner extends Tool {
  constructor() {
    super()
    this._style = evalCss(require('./XssScanner.scss'))
    this.name = 'xss'
    this._vectors = []
    this._results = []
    this._sinkFindings = []
    this._blocked = []
    this._scanning = false
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
    this._$el.html(
      '<div class="' + c('wrap') + '">' +
        '<div class="' + c('banner') + '">' +
          '⚠ <b>Hanya untuk situs milik sendiri / yang memberi izin testing.</b> ' +
          'Pemindaian hanya memakai request GET read-only (maks ' + MAX_TESTS + '), ' +
          'tidak submit form &amp; tidak mengubah data.' +
        '</div>' +
        '<button class="' + c('scan-btn') + '">Pindai vektor input</button>' +
        '<button class="' + c('scan-btn') + ' ' + c('sink-btn') + '">Pindai sink DOM berbahaya</button>' +
        '<div class="' + c('status') + '"></div>' +
        '<div class="' + c('section-title') + '">Hasil uji refleksi</div>' +
        '<div class="' + c('results') + '">' + this._emptyHtml() + '</div>' +
        '<div class="' + c('section-title') + '">Temuan sink DOM</div>' +
        '<div class="' + c('sinks') + '">' +
          '<div class="' + c('empty') + '">Belum dipindai.</div>' +
        '</div>' +
        this._eduHtml() +
      '</div>'
    )
  }
  _emptyHtml() {
    return (
      '<div class="' + c('empty') + '">' +
        'Belum ada hasil. "Pindai vektor input" menguji apakah input ' +
        'terefleksi mentah di response (pakai string penanda aman, bukan payload jahat).' +
      '</div>'
    )
  }
  _eduHtml() {
    return (
      '<details class="' + c('edu') + '">' +
        '<summary class="' + c('edu-title') + '">Metode &amp; Contoh</summary>' +
        '<div class="' + c('edu-body') + '">' +
          '<p><b>Reflected XSS:</b> input dari URL/form disisipkan kembali ke HTML ' +
          'tanpa escaping. Penyerang membuat link jebakan berisi script.</p>' +
          '<pre><code>https://situs/cari?q=&lt;script&gt;alert(1)&lt;/script&gt;</code></pre>' +
          '<p><b>DOM-based XSS:</b> JavaScript halaman mengambil data dari ' +
          '<code>location.hash</code> lalu menaruhnya ke <code>innerHTML</code> ' +
          'tanpa sanitasi — semua terjadi di browser.</p>' +
          '<pre><code>el.innerHTML = location.hash.slice(1); // BAHAYA</code></pre>' +
          '<p><b>Mitigasi:</b> selalu escape output (gunakan <code>textContent</code> ' +
          'bukan <code>innerHTML</code>), validasi &amp; sanitasi input di server, ' +
          'pasang Content-Security-Policy.</p>' +
        '</div>' +
      '</details>'
    )
  }
  _bindEvent() {
    this._$el.on('click', c('.scan-btn') + ':not(' + c('.sink-btn') + ')', () => this._scanVectors())
    this._$el.on('click', c('.sink-btn'), () => this._scanSinks())
  }
  _updateStatus(msg) {
    this._$el.find(c('.status')).text(msg)
  }
  _collectVectors() {
    const vectors = []
    const seen = {}
    const addVector = (label, url) => {
      if (seen[url]) return
      seen[url] = true
      vectors.push({ label: label, url: url })
    }
    /* Parameter query URL saat ini. */
    try {
      const u = new URL(location.href)
      u.searchParams.forEach((val, key) => {
        const t = new URL(location.href)
        t.searchParams.set(key, 'hzx' + Date.now().toString(36))
        addVector('param URL: ' + key, t.href)
      })
    } catch { /* abaikan */ }
    /* Field form -> uji via GET ke action (read-only). */
    try {
      each(document.querySelectorAll('form'), (form, fi) => {
        let action
        try {
          action = new URL(form.getAttribute('action') || location.href, location.href)
        } catch { return }
        if (action.origin !== location.origin) return
        if (/^(javascript|data|mailto):/i.test(action.protocol)) return
        each(form.querySelectorAll('input,textarea,select'), (input) => {
          const name = input.getAttribute('name')
          if (!name) return
          const type = (input.getAttribute('type') || 'text').toLowerCase()
          if (['password', 'file', 'submit', 'button', 'reset', 'image'].indexOf(type) >= 0) return
          const t = new URL(action.href)
          t.searchParams.set(name, 'hzx' + Date.now().toString(36))
          addVector('form#' + (fi + 1) + ' field: ' + name, t.href)
        })
      })
    } catch { /* abaikan */ }
    return vectors.slice(0, MAX_TESTS)
  }
  _renderResults() {
    const $results = this._$el.find(c('.results'))
    let html = ''
    if (this._results.length === 0) {
      html =
        '<div class="' + c('empty') + '">' +
          'Tidak ada canary yang terefleksi pada vektor yang diuji.<br>' +
          'Catatan: ini bukan vonis aman — XSS tersimpan &amp; buta butuh pengujian manual lanjutan.' +
        '</div>'
    } else {
      html = '<div class="' + c('summary') + '">' + this._results.length + ' vektor terefleksi</div>'
      each(this._results, (r) => {
        html +=
          '<div class="' + c('card') + ' ' + c('card-danger') + '">' +
            '<div class="' + c('pattern') + '">⚠ Terefleksi: ' + escape(r.label) + '</div>' +
            '<div class="' + c('location') + '" title="' + escape(r.url) + '">' + escape(r.url) + '</div>' +
            '<div class="' + c('snippet') + '">' + escape(r.snippet) + '</div>' +
            '<div class="' + c('hint') + '">' +
              'Canary muncul di response — verifikasi manual apakah konteksnya ' +
              'dapat dieksploitasi (event handler / tag script).' +
            '</div>' +
          '</div>'
      })
    }
    $results.html(html)
  }
  _renderSinks() {
    const $sinks = this._$el.find(c('.sinks'))
    let html = ''
    if (this._sinkFindings.length === 0) {
      html =
        '<div class="' + c('empty') + '">' +
          'Tidak ada pola sink berbahaya yang cocok.' +
          (this._blocked.length ? '<br>Beberapa script eksternal tak terbaca (CORS).' : '') +
        '</div>'
    } else {
      html = '<div class="' + c('summary') + '">' + this._sinkFindings.length + ' pola ditemukan</div>'
      each(this._sinkFindings, (f) => {
        html +=
          '<div class="' + c('card') + (f.risk === 'Tinggi' ? ' ' + c('card-danger') : '') + '">' +
            '<div class="' + c('card-head') + '">' +
              '<span class="' + c('pattern') + '">' + escape(f.sink) + '</span>' +
              '<span class="' + c('risk') + '">risiko: ' + escape(f.risk) + '</span>' +
            '</div>' +
            '<div class="' + c('location') + '" title="' + escape(f.location) + '">' + escape(f.location) + '</div>' +
            '<div class="' + c('snippet') + '">' + escape(f.snippet) + '</div>' +
            (f.hasSource
              ? '<div class="' + c('hint') + '">⚠ Terhubung ke source yang bisa dikendalikan penyerang.</div>'
              : '') +
          '</div>'
      })
    }
    $sinks.html(html)
  }
  async _scanVectors() {
    if (this._scanning) return
    this._scanning = true
    this._results = []
    const vectors = this._collectVectors()
    if (vectors.length === 0) {
      this._updateStatus('Tidak ada vektor input yang bisa diuji.')
      this._scanning = false
      return
    }
    for (let i = 0; i < vectors.length; i++) {
      const v = vectors[i]
      this._updateStatus('Menguji vektor ' + (i + 1) + '/' + vectors.length + ': ' + v.label)
      try {
        const canary = new URL(v.url).searchParams
        let needle = ''
        canary.forEach((val) => { if (/^hzx/.test(val)) needle = val })
        const res = await fetch(v.url, { credentials: 'same-origin' })
        const text = await res.text()
        const idx = text.indexOf(needle)
        if (needle && idx >= 0) {
          const snippet = text.slice(Math.max(0, idx - 60), idx + needle.length + 60)
          this._results.push({ label: v.label, url: v.url, snippet: snippet })
        }
      } catch { /* gagal fetch = lewati */ }
      await sleep(GAP_MS)
    }
    this._scanning = false
    this._updateStatus('')
    this._renderResults()
    this._notify('Uji refleksi selesai: ' + this._results.length + ' terefleksi')
  }
  _scanSinksInText(text, location) {
    each(SINKS, (s) => {
      const re = new RegExp(s.regex.source, 'g')
      let m
      while ((m = re.exec(text)) !== null) {
        const context = text.slice(Math.max(0, m.index - 200), m.index + 120)
        let hasSource = false
        each(SOURCES, (sr) => {
          if (new RegExp(sr.source).test(context)) hasSource = true
        })
        this._sinkFindings.push({
          sink: s.name,
          risk: hasSource ? 'Tinggi' : s.risk,
          hasSource: hasSource,
          location: location,
          snippet: '…' + context.replace(/\s+/g, ' ').slice(0, 160) + '…',
        })
        if (this._sinkFindings.length >= 30) return false
      }
    })
  }
  async _scanSinks() {
    if (this._scanning) return
    this._scanning = true
    this._sinkFindings = []
    this._blocked = []
    const externals = []
    try {
      each(document.querySelectorAll('script'), (el, i) => {
        const src = el.getAttribute('src')
        if (src) {
          try {
            externals.push(new URL(src, location.href).href)
          } catch { /* abaikan */ }
        } else {
          this._scanSinksInText(el.textContent || '', 'inline script #' + (i + 1))
        }
      })
    } catch { /* abaikan */ }
    for (let i = 0; i < externals.length; i++) {
      const url = externals[i]
      this._updateStatus('Memindai sink ' + (i + 1) + '/' + externals.length + '…')
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error('HTTP ' + res.status)
        this._scanSinksInText(await res.text(), url)
      } catch {
        this._blocked.push(url)
      }
    }
    this._scanning = false
    this._updateStatus('')
    this._renderSinks()
    this._notify('Pindai sink selesai: ' + this._sinkFindings.length + ' pola')
  }
  _notify(msg) {
    this._container.notify(msg, { icon: 'success' })
  }
}
