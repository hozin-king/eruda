import Tool from '../DevTools/Tool'
import evalCss from '../lib/evalCss'
import { classPrefix as c } from '../lib/util'
import escape from 'licia/escape'

const STORE_KEY = 'hozin-userscripts'

function loadScripts() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function runCode(code, name) {
  try {
    new Function(code)()
    return true
  } catch (e) {
    console.warn('Userscript gagal (' + name + '):', e)
    return false
  }
}

export default class UserscriptMgr extends Tool {
  constructor() {
    super()
    this._style = evalCss(require('./UserscriptMgr.scss'))
    this.name = 'userscripts'

    this._scripts = loadScripts()
  }
  init($el, container) {
    super.init($el)
    this._container = container
    // Jalankan semua script aktif saat tool dibuka
    for (const s of this._scripts) {
      if (s.enabled) runCode(s.code, s.name)
    }
    this._render()
    this._bindEvent()
  }
  destroy() {
    super.destroy()
    evalCss.remove(this._style)
  }
  _render() {
    const scripts = this._scripts

    let listHtml = `<div class="${c('empty')}">Belum ada userscript.<br/>Tambahkan script JS yang ingin dijalankan otomatis.</div>`
    if (scripts.length) {
      listHtml = scripts
        .map((s) => {
          return `<div class="${c('row')}" data-id="${s.id}">
            <label class="${c('toggle')}">
              <input type="checkbox" ${s.enabled ? 'checked' : ''} data-act="toggle"/>
              <span class="${c('slider')}"></span>
            </label>
            <div class="${c('meta')}">
              <div class="${c('name')}">${escape(s.name)}</div>
              <div class="${c('info')}">${s.enabled ? 'Aktif — dijalankan saat tool dibuka' : 'Nonaktif'}</div>
            </div>
            <button class="${c('btn')}" data-act="run">▶</button>
            <button class="${c('btn')} ${c('danger')}" data-act="del">✕</button>
          </div>`
        })
        .join('')
    }

    this._$el.html(`<div class="${c('wrap')}">
      <div class="${c('toolbar')}">
        <button class="${c('btn')} ${c('primary')}" data-act="runall">▶ Jalankan semua yang aktif</button>
      </div>
      <div class="${c('list')}">${listHtml}</div>
      <div class="${c('form')}">
        <h3 class="${c('form-title')}">Tambah userscript</h3>
        <input class="${c('input')}" data-f="name" placeholder="Nama script" maxlength="80"/>
        <textarea class="${c('code')}" data-f="code" placeholder="// Tulis kode JavaScript di sini&#10;// Dijalankan via new Function(code)()" rows="7"></textarea>
        <div class="${c('form-actions')}">
          <button class="${c('btn')} ${c('primary')}" data-act="save">💾 Simpan</button>
        </div>
      </div>
      <div class="${c('hint')}">Script tersimpan di localStorage ("${STORE_KEY}"). Script aktif otomatis dijalankan saat tab ini dibuka. Error script tidak menggagalkan halaman.</div>
    </div>`)
  }
  _bindEvent() {
    const self = this
    this._$el.on('click', c('.btn'), function () {
      const act = this.getAttribute('data-act')
      const row = this.closest('[data-id]')
      const id = row ? row.getAttribute('data-id') : null
      if (act === 'run') self._runOne(id)
      else if (act === 'del') self._del(id)
      else if (act === 'runall') self._runAll()
      else if (act === 'save') self._save()
    })
    this._$el.on('change', c('input[data-act="toggle"]'), function () {
      const row = this.closest('[data-id]')
      if (row) self._toggle(row.getAttribute('data-id'), this.checked)
    })
  }
  _persist() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this._scripts))
    } catch {
      this._container.notify('Gagal menyimpan (localStorage penuh?)', {
        icon: 'error',
      })
    }
  }
  _find(id) {
    return this._scripts.find((s) => String(s.id) === String(id))
  }
  _toggle(id, on) {
    const s = this._find(id)
    if (!s) return
    s.enabled = on
    this._persist()
    this._render()
    this._notify('"' + s.name + '" ' + (on ? 'diaktifkan' : 'dinonaktifkan'))
  }
  _runOne(id) {
    const s = this._find(id)
    if (!s) return
    if (runCode(s.code, s.name)) this._notify('Berjalan: ' + s.name)
    else this._notify('Gagal: ' + s.name + ' (lihat console)')
  }
  _runAll() {
    const active = this._scripts.filter((s) => s.enabled)
    if (!active.length) return this._notify('Tidak ada script aktif')
    let ok = 0
    for (const s of active) if (runCode(s.code, s.name)) ok++
    this._notify('Selesai: ' + ok + '/' + active.length + ' berhasil')
  }
  _del(id) {
    const s = this._find(id)
    if (!s) return
    if (!window.confirm('Hapus userscript "' + s.name + '"?')) return
    this._scripts = this._scripts.filter((x) => String(x.id) !== String(id))
    this._persist()
    this._render()
    this._notify('Dihapus: ' + s.name)
  }
  _save() {
    const nameEl = this._$el.get(0).querySelector('[data-f="name"]')
    const codeEl = this._$el.get(0).querySelector('[data-f="code"]')
    const name = nameEl.value.trim()
    const code = codeEl.value
    if (!name) return this._notify('Nama script wajib diisi')
    if (!code.trim()) return this._notify('Kode script kosong')
    this._scripts.push({
      id: Date.now() + '-' + Math.floor(Math.random() * 1e6),
      name,
      code,
      enabled: true,
    })
    this._notify('Userscript tersimpan & aktif')
    this._persist()
    this._render()
  }
  _notify(msg) {
    this._container.notify(msg, { icon: 'success' })
  }
}
