import Tool from '../DevTools/Tool'
import evalCss from '../lib/evalCss'
import { classPrefix as c } from '../lib/util'
import $ from 'licia/$'
import each from 'licia/each'
import escape from 'licia/escape'
import { copy } from '../Hozin/util'

/* Pola umum kunci API / secret: nama tampilan + regex + contoh. */
const PATTERNS = [
  { name: 'Google API Key', example: 'AIza… (39 char)', regex: /AIza[0-9A-Za-z_-]{35}/ },
  { name: 'AWS Access Key ID', example: 'AKIA… (20 char)', regex: /AKIA[0-9A-Z]{16}/ },
  { name: 'AWS Secret Access Key', example: 'aws_secret… (40 char)', regex: /aws(.{0,20})?['"][0-9a-zA-Z/+]{40}/ },
  { name: 'GitHub Token', example: 'ghp_… / gho_…', regex: /(ghp_|gho_|github_pat_)[0-9A-Za-z_]+/ },
  { name: 'Slack Token', example: 'xoxb-…', regex: /xox[baprs]-[0-9A-Za-z-]+/ },
  { name: 'Stripe Key', example: 'sk_live_…', regex: /(sk|pk)_(live|test)_[0-9A-Za-z]+/ },
  { name: 'Generic API Key', example: 'api_key: "…"', regex: /api[_-]?key\s*[:=]\s*['"][^'"]{8,}['"]/ },
  { name: 'Bearer Token', example: 'Bearer …', regex: /bearer\s+[0-9A-Za-z_.~+/-]+/i },
  { name: 'Firebase URL', example: '….firebaseio.com', regex: /https?:\/\/[0-9a-z-]+\.firebaseio\.com/ },
]

function maskValue(v) {
  if (v.length <= 12) return v.slice(0, 4) + '••••' + v.slice(-2)
  return v.slice(0, 8) + '••••' + v.slice(-4)
}

export default class KeyScanner extends Tool {
  constructor() {
    super()
    this._style = evalCss(require('./KeyScanner.scss'))
    this.name = 'keys'
    this._findings = []
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
          'Untuk audit situs milik sendiri / yang memberi izin. Semua pemindaian ' +
          'berjalan lokal di perangkat — tidak ada data yang dikirim ke mana pun.' +
        '</div>' +
        '<button class="' + c('scan-btn') + '">Scan halaman</button>' +
        '<div class="' + c('status') + '"></div>' +
        '<div class="' + c('results') + '">' + this._emptyHtml() + '</div>' +
      '</div>'
    )
  }
  _bindEvent() {
    this._$el.on('click', c('.scan-btn'), () => this._scan())
    this._$el.on('click', c('.copy-btn'), (e) => {
      const idx = $(e.currentTarget).data('idx')
      const f = this._findings[idx]
      if (!f) return
      copy(f.value)
      this._notify('Nilai penuh disalin ke clipboard')
    })
  }
  _updateStatus(msg) {
    this._$el.find(c('.status')).text(msg)
  }
  _emptyHtml() {
    return (
      '<div class="' + c('empty') + '">' +
        'Belum ada hasil. Tekan "Scan halaman" untuk memindai script inline ' +
        'dan eksternal terhadap pola kunci API umum.' +
      '</div>'
    )
  }
  _scanText(text, location, seen) {
    each(PATTERNS, (p) => {
      const flags = 'g' + (p.regex.ignoreCase ? 'i' : '')
      const re = new RegExp(p.regex.source, flags)
      let m
      while ((m = re.exec(text)) !== null) {
        const value = m[0]
        const key = p.name + '|' + value
        if (seen[key]) continue
        seen[key] = true
        this._findings.push({
          pattern: p.name,
          example: p.example,
          value: value,
          location: location,
        })
      }
    })
  }
  _renderResults() {
    const $results = this._$el.find(c('.results'))
    let html = ''
    if (this._findings.length === 0) {
      html =
        '<div class="' + c('empty') + '">' +
          'Tidak ada secret yang cocok dengan pola umum.<br>' +
          'Catatan: hasil nihil ≠ pasti aman — ini hanya heuristik pola, ' +
          'bukan audit keamanan menyeluruh.' +
        '</div>'
    } else {
      html = '<div class="' + c('summary') + '">' + this._findings.length + ' temuan</div>'
      each(this._findings, (f, i) => {
        html +=
          '<div class="' + c('card') + '">' +
            '<div class="' + c('card-head') + '">' +
              '<span class="' + c('pattern') + '">' + escape(f.pattern) + '</span>' +
              '<button class="' + c('copy-btn') + '" data-idx="' + i + '">Copy</button>' +
            '</div>' +
            '<div class="' + c('location') + '" title="' + escape(f.location) + '">' +
              escape(f.location) +
            '</div>' +
            '<div class="' + c('value') + '">' + escape(maskValue(f.value)) + '</div>' +
            '<div class="' + c('hint') + '">Contoh pola: ' + escape(f.example) + '</div>' +
          '</div>'
      })
    }
    if (this._blocked.length > 0) {
      html += '<div class="' + c('blocked-title') + '">Script eksternal tak terbaca (CORS):</div>'
      each(this._blocked, (b) => {
        html += '<div class="' + c('blocked-item') + '">' + escape(b) + '</div>'
      })
    }
    $results.html(html)
  }
  async _scan() {
    if (this._scanning) return
    this._scanning = true
    this._findings = []
    this._blocked = []
    this._updateStatus('Mengumpulkan script…')
    const externals = []
    const seen = {}
    try {
      each(document.querySelectorAll('script'), (el, i) => {
        const src = el.getAttribute('src')
        if (src) {
          try {
            externals.push(new URL(src, location.href).href)
          } catch { /* abaikan */ }
        } else {
          this._scanText(el.textContent || '', 'inline script #' + (i + 1), seen)
        }
      })
    } catch { /* abaikan */ }
    for (let i = 0; i < externals.length; i++) {
      const url = externals[i]
      this._updateStatus('Memindai script eksternal ' + (i + 1) + '/' + externals.length + '…')
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error('HTTP ' + res.status)
        const text = await res.text()
        this._scanText(text, url, seen)
      } catch {
        this._blocked.push('terblokir CORS: ' + url)
      }
    }
    this._scanning = false
    this._updateStatus('')
    this._renderResults()
    this._notify('Scan selesai: ' + this._findings.length + ' temuan')
  }
  _notify(msg) {
    this._container.notify(msg, { icon: 'success' })
  }
}
