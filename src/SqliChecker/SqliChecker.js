import Tool from '../DevTools/Tool'
import evalCss from '../lib/evalCss'
import { classPrefix as c } from '../lib/util'
import each from 'licia/each'
import escape from 'licia/escape'

const MAX_TESTS = 10
const GAP_MS = 400

/* Signature error database umum: label + pola. */
const DB_ERRORS = [
  { db: 'MySQL', patterns: [/You have an error in your SQL syntax/i, /mysql_fetch/i, /Warning:\s*mysql_/i, /MySQL server version/i] },
  { db: 'PostgreSQL', patterns: [/pg_query/i, /PostgreSQL.*ERROR/i, /psql:/i, /unterminated quoted string/i] },
  { db: 'MSSQL', patterns: [/ODBC SQL Server Driver/i, /SqlException/i, /Unclosed quotation mark/i, /Microsoft OLE DB Provider/i] },
  { db: 'Oracle', patterns: [/ORA-\d{5}/i, /Oracle.*Driver/i] },
  { db: 'SQLite', patterns: [/SQLite3::/i, /sqlite_error/i, /SQLITE_ERROR/i] },
]

/* Varian uji: read-only, non-destruktif. */
const VARIANTS = ["'", '\'"']

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export default class SqliChecker extends Tool {
  constructor() {
    super()
    this._style = evalCss(require('./SqliChecker.scss'))
    this.name = 'sqli'
    this._results = []
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
          'Pemeriksaan memakai request GET read-only (maks ' + MAX_TESTS + ') dengan ' +
          'karakter uji non-destruktif — tanpa DROP/DELETE/UPDATE/UNION.' +
        '</div>' +
        '<button class="' + c('scan-btn') + '">Cek parameter</button>' +
        '<div class="' + c('status') + '"></div>' +
        '<div class="' + c('results') + '">' + this._emptyHtml() + '</div>' +
        this._eduHtml() +
      '</div>'
    )
  }
  _emptyHtml() {
    return (
      '<div class="' + c('empty') + '">' +
        'Belum ada hasil. Tool menguji tiap parameter query/form GET dengan ' +
        'tanda kutip, lalu mencari signature error database di response.' +
      '</div>'
    )
  }
  _eduHtml() {
    return (
      '<details class="' + c('edu') + '">' +
        '<summary class="' + c('edu-title') + '">Metode &amp; Contoh</summary>' +
        '<div class="' + c('edu-body') + '">' +
          '<p><b>Metodenya:</b> SQL injection terjadi saat input user digabung ' +
          'langsung ke query database tanpa sanitasi. Penguji menempel karakter ' +
          'seperti tanda kutip (<code>\'</code>) — bila aplikasi rentan, database ' +
          'melempar error yang bocor ke response.</p>' +
          '<p><b>Contoh:</b> parameter <code>?id=5</code> diubah jadi ' +
          '<code>?id=5\'</code>. Bila response berisi:</p>' +
          '<pre><code>You have an error in your SQL syntax near \'\\\'\' ...</code></pre>' +
          '<p>artinya input lolos ke query — indikasi kuat celah SQLi.</p>' +
          '<p><b>Mitigasi:</b> selalu pakai <i>parameterized query / prepared ' +
          'statement</i>, jangan gabung string ke SQL; sembunyikan error ' +
          'database dari user; prinsip least-privilege untuk akun DB.</p>' +
        '</div>' +
      '</details>'
    )
  }
  _bindEvent() {
    this._$el.on('click', c('.scan-btn'), () => this._scan())
  }
  _updateStatus(msg) {
    this._$el.find(c('.status')).text(msg)
  }
  _collectParams() {
    const params = []
    const seen = {}
    const addParam = (label, url) => {
      if (seen[url]) return
      seen[url] = true
      params.push({ label: label, url: url })
    }
    try {
      const keys = []
      new URL(location.href).searchParams.forEach((val, key) => keys.push(key))
      each(keys, (key) => {
        each(VARIANTS, (v) => {
          const t = new URL(location.href)
          t.searchParams.set(key, (t.searchParams.get(key) || '') + v)
          addParam('param URL: ' + key + ' + ' + JSON.stringify(v), t.href)
        })
      })
    } catch { /* abaikan */ }
    try {
      each(document.querySelectorAll('form'), (form, fi) => {
        const method = (form.getAttribute('method') || 'get').toLowerCase()
        if (method !== 'get') return
        let action
        try {
          action = new URL(form.getAttribute('action') || location.href, location.href)
        } catch { return }
        if (action.origin !== location.origin) return
        each(form.querySelectorAll('input,select,textarea'), (input) => {
          const name = input.getAttribute('name')
          if (!name) return
          const type = (input.getAttribute('type') || 'text').toLowerCase()
          if (['password', 'file', 'submit', 'button', 'reset', 'image'].indexOf(type) >= 0) return
          each(VARIANTS, (v) => {
            const t = new URL(action.href)
            t.searchParams.set(name, (input.value || '') + v)
            addParam('form#' + (fi + 1) + ' ' + name + ' + ' + JSON.stringify(v), t.href)
          })
        })
      })
    } catch { /* abaikan */ }
    return params.slice(0, MAX_TESTS)
  }
  _detectDbError(text) {
    for (let i = 0; i < DB_ERRORS.length; i++) {
      const entry = DB_ERRORS[i]
      for (let j = 0; j < entry.patterns.length; j++) {
        const m = entry.patterns[j].exec(text)
        if (m) {
          const idx = m.index
          return {
            db: entry.db,
            snippet: text.slice(Math.max(0, idx - 60), idx + 140).replace(/\s+/g, ' '),
          }
        }
      }
    }
    return null
  }
  _renderResults() {
    const $results = this._$el.find(c('.results'))
    let html = ''
    if (this._results.length === 0) {
      html =
        '<div class="' + c('empty') + '">' +
          'Tidak ada signature error database yang terpicu.<br>' +
          'Catatan: blind SQLi &amp; celah tanpa error message tidak terdeteksi ' +
          'metode ini — butuh pengujian lanjutan (mis. Burp/ZAP).' +
        '</div>'
    } else {
      html = '<div class="' + c('summary') + '">' + this._results.length + ' indikasi ditemukan</div>'
      each(this._results, (r) => {
        html +=
          '<div class="' + c('card') + ' ' + c('card-danger') + '">' +
            '<div class="' + c('card-head') + '">' +
              '<span class="' + c('pattern') + '">⚠ ' + escape(r.db) + ' error</span>' +
            '</div>' +
            '<div class="' + c('location') + '" title="' + escape(r.url) + '">' +
              escape(r.label) +
            '</div>' +
            '<div class="' + c('snippet') + '">' + escape(r.snippet) + '</div>' +
            '<div class="' + c('hint') + '">' +
              'Parameter memicu error DB — indikasi kuat input lolos ke query. ' +
              'Verifikasi manual sebelum menyimpulkan.' +
            '</div>' +
          '</div>'
      })
    }
    $results.html(html)
  }
  async _scan() {
    if (this._scanning) return
    this._scanning = true
    this._results = []
    const params = this._collectParams()
    if (params.length === 0) {
      this._updateStatus('Tidak ada parameter yang bisa diuji.')
      this._scanning = false
      return
    }
    for (let i = 0; i < params.length; i++) {
      const p = params[i]
      this._updateStatus('Menguji ' + (i + 1) + '/' + params.length + ': ' + p.label)
      try {
        const res = await fetch(p.url, { credentials: 'same-origin' })
        const text = await res.text()
        const hit = this._detectDbError(text)
        if (hit) {
          this._results.push({ label: p.label, url: p.url, db: hit.db, snippet: hit.snippet })
        }
      } catch { /* gagal fetch = lewati */ }
      await sleep(GAP_MS)
    }
    this._scanning = false
    this._updateStatus('')
    this._renderResults()
    this._notify('Pemeriksaan selesai: ' + this._results.length + ' indikasi')
  }
  _notify(msg) {
    this._container.notify(msg, { icon: 'success' })
  }
}
