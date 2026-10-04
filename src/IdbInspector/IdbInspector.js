import Tool from '../DevTools/Tool'
import evalCss from '../lib/evalCss'
import { classPrefix as c } from '../lib/util'
import $ from 'licia/$'
import each from 'licia/each'
import escape from 'licia/escape'
import { copy } from '../Hozin/util'

const RECORD_LIMIT = 50

function reqPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function keyText(key) {
  try {
    return typeof key === 'string' ? key : JSON.stringify(key)
  } catch {
    return String(key)
  }
}

function previewText(value) {
  try {
    const s = JSON.stringify(value)
    return s.length > 100 ? s.slice(0, 100) + '…' : s
  } catch {
    return String(value)
  }
}

export default class IdbInspector extends Tool {
  constructor() {
    super()
    this._style = evalCss(require('./IdbInspector.scss'))
    this.name = 'indexeddb'
    this._level = 'dbs'
    this._dbs = []
    this._stores = []
    this._records = []
    this._dbName = ''
    this._storeName = ''
    this._recordKey = null
    this._recordValue = null
    this._editing = false
  }
  init($el, container) {
    super.init($el)
    this._container = container
    this._render()
    this._bindEvent()
    this._loadDbs()
  }
  destroy() {
    super.destroy()
    evalCss.remove(this._style)
  }
  _render() {
    this._$el.html(
      '<div class="' + c('wrap') + '">' +
        '<div class="' + c('head') + '"></div>' +
        '<div class="' + c('body') + '"></div>' +
      '</div>'
    )
  }
  _bindEvent() {
    const $el = this._$el
    $el.on('click', c('.back-btn'), () => this._back())
    $el.on('click', c('.db-row'), (e) => {
      this._openStores($(e.currentTarget).data('name'))
    })
    $el.on('click', c('.store-row'), (e) => {
      this._openRecords($(e.currentTarget).data('name'))
    })
    $el.on('click', c('.rec-row'), (e) => {
      this._openDetail($(e.currentTarget).data('idx'))
    })
    $el.on('click', c('.copy-detail-btn'), () => {
      copy(JSON.stringify(this._recordValue, null, 2))
      this._notify('Record disalin')
    })
    $el.on('click', c('.edit-toggle-btn'), () => {
      this._editing = !this._editing
      this._renderBody()
    })
    $el.on('click', c('.save-btn'), () => this._saveRecord())
    $el.on('click', c('.del-record-btn'), () => this._deleteRecord())
  }
  _setHead(title, showBack) {
    this._$el.find(c('.head')).html(
      (showBack ? '<button class="' + c('back-btn') + '">← Kembali</button>' : '') +
        '<span class="' + c('head-title') + '">' + escape(title) + '</span>'
    )
  }
  _setBody(html) {
    this._$el.find(c('.body')).html(html)
  }
  _emptyHtml(msg) {
    return '<div class="' + c('empty') + '">' + msg + '</div>'
  }
  /* ---- level: databases ---- */
  async _loadDbs() {
    this._level = 'dbs'
    this._setHead('IndexedDB', false)
    if (!window.indexedDB) {
      this._setBody(this._emptyHtml('Perangkat/browser ini tidak mendukung IndexedDB.'))
      return
    }
    if (typeof window.indexedDB.databases !== 'function') {
      this._setBody(
        this._emptyHtml(
          'browser ini tidak mendukung enumerasi database ' +
            '(indexedDB.databases tidak tersedia di browser ini).'
        )
      )
      return
    }
    this._setBody(this._emptyHtml('Memuat daftar database…'))
    try {
      this._dbs = await window.indexedDB.databases()
    } catch (err) {
      this._setBody(this._emptyHtml('Gagal membaca daftar database: ' + escape(String(err))))
      return
    }
    let html = ''
    if (!this._dbs || this._dbs.length === 0) {
      html = this._emptyHtml('Tidak ada database IndexedDB di halaman ini.')
    } else {
      each(this._dbs, (d) => {
        html +=
          '<div class="' + c('db-row') + '" data-name="' + escape(d.name || '') + '">' +
            '<div class="' + c('dbname') + '">' + escape(d.name || '(tanpa nama)') + '</div>' +
            '<div class="' + c('meta') + '">versi ' + escape(String(d.version || '—')) + '</div>' +
          '</div>'
      })
    }
    this._setBody(html)
  }
  /* ---- level: object stores ---- */
  async _openStores(dbName) {
    this._level = 'stores'
    this._dbName = dbName
    this._setHead(dbName, true)
    this._setBody(this._emptyHtml('Memuat object stores…'))
    let db = null
    try {
      db = await reqPromise(window.indexedDB.open(dbName))
      const names = []
      for (let i = 0; i < db.objectStoreNames.length; i++) {
        names.push(db.objectStoreNames[i])
      }
      this._stores = names
    } catch (err) {
      this._setBody(this._emptyHtml('Gagal membuka database: ' + escape(String(err))))
      return
    } finally {
      if (db) db.close()
    }
    let html = ''
    if (this._stores.length === 0) {
      html = this._emptyHtml('Database ini tidak punya object store.')
    } else {
      each(this._stores, (s) => {
        html +=
          '<div class="' + c('store-row') + '" data-name="' + escape(s) + '">' +
            '<div class="' + c('storename') + '">' + escape(s) + '</div>' +
          '</div>'
      })
    }
    this._setBody(html)
  }
  /* ---- level: records ---- */
  async _openRecords(storeName) {
    this._level = 'records'
    this._storeName = storeName
    this._setHead(this._dbName + ' / ' + storeName, true)
    this._setBody(this._emptyHtml('Memuat records…'))
    let db = null
    try {
      db = await reqPromise(window.indexedDB.open(this._dbName))
      const tx = db.transaction(storeName, 'readonly')
      const store = tx.objectStore(storeName)
      const records = []
      const cursorReq = store.openCursor()
      await new Promise((resolve, reject) => {
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result
          if (!cursor || records.length >= RECORD_LIMIT) {
            resolve()
            return
          }
          records.push({ key: cursor.key, value: cursor.value })
          cursor.continue()
        }
        cursorReq.onerror = () => reject(cursorReq.error)
      })
      this._records = records
    } catch (err) {
      this._setBody(this._emptyHtml('Gagal membaca records: ' + escape(String(err))))
      return
    } finally {
      if (db) db.close()
    }
    let html = ''
    if (this._records.length === 0) {
      html = this._emptyHtml('Object store ini kosong.')
    } else {
      html =
        '<div class="' + c('summary') + '">' +
        this._records.length + ' record (maks ' + RECORD_LIMIT + ')</div>'
      each(this._records, (r, i) => {
        html +=
          '<div class="' + c('rec-row') + '" data-idx="' + i + '">' +
            '<div class="' + c('reckey') + '">' + escape(keyText(r.key)) + '</div>' +
            '<div class="' + c('recprev') + '">' + escape(previewText(r.value)) + '</div>' +
          '</div>'
      })
    }
    this._setBody(html)
  }
  /* ---- level: detail ---- */
  _openDetail(idx) {
    const r = this._records[idx]
    if (!r) return
    this._level = 'detail'
    this._recordKey = r.key
    this._recordValue = r.value
    this._editing = false
    this._renderBody()
  }
  _renderBody() {
    if (this._level !== 'detail') return
    this._setHead(this._dbName + ' / ' + this._storeName + ' / key', true)
    let json = ''
    try {
      json = JSON.stringify(this._recordValue, null, 2)
    } catch {
      json = String(this._recordValue)
    }
    let html =
      '<div class="' + c('detail-meta') + '">key: <span>' + escape(keyText(this._recordKey)) + '</span></div>' +
      '<pre class="' + c('detail-json') + '">' + escape(json) + '</pre>' +
      '<div class="' + c('detail-actions') + '">' +
        '<button class="' + c('copy-detail-btn') + '">Copy</button>' +
        '<button class="' + c('edit-toggle-btn') + '">' + (this._editing ? 'Batal' : 'Edit') + '</button>' +
        '<button class="' + c('del-record-btn') + '">Hapus</button>' +
      '</div>'
    if (this._editing) {
      html +=
        '<textarea class="' + c('edit-area') + '">' + escape(json) + '</textarea>' +
        '<button class="' + c('save-btn') + '">Simpan</button>'
    }
    this._setBody(html)
  }
  async _saveRecord() {
    const text = this._$el.find(c('.edit-area')).val() || ''
    let newValue
    try {
      newValue = JSON.parse(text)
    } catch {
      this._notify('JSON tidak valid')
      return
    }
    let db = null
    try {
      db = await reqPromise(window.indexedDB.open(this._dbName))
      const tx = db.transaction(this._storeName, 'readwrite')
      const store = tx.objectStore(this._storeName)
      const req = store.keyPath ? store.put(newValue) : store.put(newValue, this._recordKey)
      await reqPromise(req)
      this._recordValue = newValue
      this._editing = false
      this._renderBody()
      this._notify('Record disimpan')
    } catch (err) {
      this._notify('Gagal menyimpan: ' + String(err && err.message ? err.message : err))
    } finally {
      if (db) db.close()
    }
  }
  async _deleteRecord() {
    let db = null
    try {
      db = await reqPromise(window.indexedDB.open(this._dbName))
      const tx = db.transaction(this._storeName, 'readwrite')
      const store = tx.objectStore(this._storeName)
      await reqPromise(store.delete(this._recordKey))
    } catch (err) {
      this._notify('Gagal menghapus: ' + String(err && err.message ? err.message : err))
      return
    } finally {
      if (db) db.close()
    }
    this._notify('Record dihapus')
    this._openRecords(this._storeName)
  }
  _back() {
    if (this._level === 'detail') {
      this._openRecords(this._storeName)
    } else if (this._level === 'records') {
      this._openStores(this._dbName)
    } else if (this._level === 'stores') {
      this._loadDbs()
    }
  }
  _notify(msg) {
    this._container.notify(msg, { icon: 'success' })
  }
}
