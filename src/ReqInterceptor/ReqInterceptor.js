import Tool from '../DevTools/Tool'
import evalCss from '../lib/evalCss'
import { classPrefix as c } from '../lib/util'
import $ from 'licia/$'
import each from 'licia/each'
import escape from 'licia/escape'
import { addRequestHook, parsePattern, matchPattern } from '../Hozin/net'
import { ask } from '../Hozin/util'

const LS_KEY = 'hozin-interceptor-rules'
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

/* Parse "Key: Value" lines into an object. */
function parseHeaderLines(text) {
  const out = {}
  String(text || '')
    .split('\n')
    .forEach((line) => {
      const idx = line.indexOf(':')
      if (idx > 0) {
        const k = line.slice(0, idx).trim()
        const v = line.slice(idx + 1).trim()
        if (k) out[k] = v
      }
    })
  return out
}

export default class ReqInterceptor extends Tool {
  constructor() {
    super()
    this._style = evalCss(require('./ReqInterceptor.scss'))
    this.name = 'interceptor'
    this._master = true
    this._rules = []
    this._intercepted = 0
    this._editingId = 0
  }
  init($el, container) {
    super.init($el)
    this._container = container
    this._load()
    this._unhook = addRequestHook((entry) => this._applyRules(entry))
    this._render()
    this._bindEvent()
  }
  destroy() {
    this._unhook()
    super.destroy()
    evalCss.remove(this._style)
  }
  _load() {
    let raw = []
    try {
      raw = JSON.parse(localStorage.getItem(LS_KEY) || '[]')
    } catch {
      raw = []
    }
    this._rules = []
    each(raw, (r) => {
      this._rules.push({
        id: r.id || Date.now(),
        pattern: String(r.pattern || ''),
        parsed: parsePattern(r.pattern),
        method: String(r.method || ''),
        headers: String(r.headers || ''),
        body: String(r.body || ''),
        cancel: !!r.cancel,
        enabled: r.enabled !== false,
      })
    })
  }
  _save() {
    const raw = this._rules.map((r) => ({
      id: r.id,
      pattern: r.pattern,
      method: r.method,
      headers: r.headers,
      body: r.body,
      cancel: r.cancel,
      enabled: r.enabled,
    }))
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(raw))
    } catch {
      /* ignore */
    }
  }
  _render() {
    const methodOpts =
      '<option value="">-- method tetap --</option>' +
      METHODS.map((m) => `<option value="${m}">${m}</option>`).join('')
    this._$el.html(`<div class="${c('wrap')}">
      <div class="${c('toolbar')}">
        <label class="${c('switch')}">
          <input type="checkbox" class="${c('master')}" checked /> Aktif
        </label>
        <span class="${c('counter')}">0 di-intercept</span>
      </div>
      <div class="${c('form')}">
        <input class="${c('f-pattern')}" placeholder="Pattern: substring atau /regex/" />
        <div class="${c('f-row')}">
          <select class="${c('f-method')}">${methodOpts}</select>
          <label class="${c('chk')}">
            <input type="checkbox" class="${c('f-cancel')}" /> Cancel request
          </label>
        </div>
        <textarea class="${c('f-headers')}" rows="2" placeholder="Header per baris, format: Key: Value"></textarea>
        <textarea class="${c('f-body')}" rows="2" placeholder="Timpa body (kosongkan = tidak diubah)"></textarea>
        <div class="${c('f-row')}">
          <button class="${c('btn save')}">Tambah rule</button>
          <button class="${c('btn cancel-edit')}">Batal</button>
        </div>
      </div>
      <div class="${c('list')}"></div>
    </div>`)
    this._$list = this._$el.find(c('.list'))
    this._$counter = this._$el.find(c('.counter'))
    this._$cancelEdit = this._$el.find(c('.cancel-edit'))
    this._$cancelEdit.hide()
    this._renderList()
  }
  _bindEvent() {
    const self = this
    this._$el
      .on('change', c('.master'), function () {
        self._master = $(this).get(0).checked
        self._notify(self._master ? 'Interceptor aktif' : 'Interceptor nonaktif')
      })
      .on('click', c('.save'), () => self._saveRule())
      .on('click', c('.cancel-edit'), () => self._resetForm())
      .on('click', c('.edit-rule'), function () {
        self._editRule(+$(this).data('id'))
      })
      .on('click', c('.del-rule'), function () {
        const id = +$(this).data('id')
        if (ask('Hapus rule ini?')) self._deleteRule(id)
      })
      .on('change', c('.toggle-rule'), function () {
        self._toggleRule(+$(this).data('id'), $(this).get(0).checked)
      })
  }
  _readForm() {
    return {
      pattern: this._$el.find(c('.f-pattern')).val().trim(),
      method: this._$el.find(c('.f-method')).val(),
      headers: this._$el.find(c('.f-headers')).val(),
      body: this._$el.find(c('.f-body')).val(),
      cancel: this._$el.find(c('.f-cancel')).get(0).checked,
    }
  }
  _resetForm() {
    this._editingId = 0
    this._$el.find(c('.f-pattern')).val('')
    this._$el.find(c('.f-method')).val('')
    this._$el.find(c('.f-headers')).val('')
    this._$el.find(c('.f-body')).val('')
    this._$el.find(c('.f-cancel')).get(0).checked = false
    this._$el.find(c('.save')).text('Tambah rule')
    this._$cancelEdit.hide()
  }
  _saveRule() {
    const f = this._readForm()
    if (!f.pattern) {
      this._notify('Isi pattern dulu')
      return
    }
    if (this._editingId) {
      const rule = this._findRule(this._editingId)
      if (rule) {
        rule.pattern = f.pattern
        rule.parsed = parsePattern(f.pattern)
        rule.method = f.method
        rule.headers = f.headers
        rule.body = f.body
        rule.cancel = f.cancel
      }
    } else {
      this._rules.push({
        id: Date.now(),
        pattern: f.pattern,
        parsed: parsePattern(f.pattern),
        method: f.method,
        headers: f.headers,
        body: f.body,
        cancel: f.cancel,
        enabled: true,
      })
    }
    this._save()
    this._resetForm()
    this._renderList()
    this._notify('Rule tersimpan')
  }
  _findRule(id) {
    for (let i = 0; i < this._rules.length; i++) {
      if (this._rules[i].id === id) return this._rules[i]
    }
    return null
  }
  _editRule(id) {
    const rule = this._findRule(id)
    if (!rule) return
    this._editingId = id
    this._$el.find(c('.f-pattern')).val(rule.pattern)
    this._$el.find(c('.f-method')).val(rule.method)
    this._$el.find(c('.f-headers')).val(rule.headers)
    this._$el.find(c('.f-body')).val(rule.body)
    this._$el.find(c('.f-cancel')).get(0).checked = rule.cancel
    this._$el.find(c('.save')).text('Simpan perubahan')
    this._$cancelEdit.show()
  }
  _deleteRule(id) {
    this._rules = this._rules.filter((r) => r.id !== id)
    if (this._editingId === id) this._resetForm()
    this._save()
    this._renderList()
    this._notify('Rule dihapus')
  }
  _toggleRule(id, on) {
    const rule = this._findRule(id)
    if (!rule) return
    rule.enabled = on
    this._save()
  }
  _ruleDesc(rule) {
    const parts = []
    if (rule.method) parts.push('method=' + rule.method)
    if (rule.headers.trim()) parts.push('headers')
    if (rule.body) parts.push('body')
    if (rule.cancel) parts.push('CANCEL')
    return parts.length ? parts.join(' · ') : '(tanpa aksi)'
  }
  _renderList() {
    if (!this._rules.length) {
      this._$list.html(`<div class="${c('empty')}">Belum ada rule.<br/>Rule cocok ke URL request lalu mengubah method / header / body, atau membatalkan request.</div>`)
      return
    }
    let html = ''
    each(this._rules, (rule) => {
      const checked = rule.enabled ? 'checked' : ''
      html += `<div class="${c('rule')}">
        <label class="${c('switch sm')}">
          <input type="checkbox" class="${c('toggle-rule')}" data-id="${rule.id}" ${checked} />
        </label>
        <div class="${c('rule-main')}">
          <div class="${c('rule-pattern')}">${escape(rule.pattern)}</div>
          <div class="${c('rule-desc')}">${escape(this._ruleDesc(rule))}</div>
        </div>
        <button class="${c('btn xs edit-rule')}" data-id="${rule.id}">Edit</button>
        <button class="${c('btn xs del-rule')}" data-id="${rule.id}">Hapus</button>
      </div>`
    })
    this._$list.html(html)
  }
  _applyRules(entry) {
    if (!this._master) return undefined
    let cancelled = false
    each(this._rules, (rule) => {
      if (!rule.enabled || !rule.parsed || cancelled) return
      if (!matchPattern(rule.parsed, entry.url)) return
      this._intercepted++
      if (rule.cancel) {
        cancelled = true
        return
      }
      if (rule.method) entry.method = rule.method
      const hdrs = parseHeaderLines(rule.headers)
      each(hdrs, (v, k) => {
        entry.reqHeaders[k] = v
      })
      if (rule.body) {
        entry._bodyChanged = true
        entry._newBody = rule.body
      }
      entry._mutated = true
    })
    this._updateCounter()
    if (cancelled) return false
    return undefined
  }
  _updateCounter() {
    if (this._$counter) this._$counter.text(this._intercepted + ' di-intercept')
  }
  _notify(msg) {
    this._container.notify(msg, { icon: 'success' })
  }
}
