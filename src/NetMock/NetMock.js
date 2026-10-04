import Tool from '../DevTools/Tool'
import evalCss from '../lib/evalCss'
import { classPrefix as c } from '../lib/util'
import $ from 'licia/$'
import each from 'licia/each'
import escape from 'licia/escape'
import { addMockRule, removeMockRule, getRequests, parsePattern, onResponse } from '../Hozin/net'
import { ask } from '../Hozin/util'

const LS_KEY = 'hozin-mock-rules'
const CONTENT_TYPES = ['application/json', 'text/html', 'text/plain']

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

export default class NetMock extends Tool {
  constructor() {
    super()
    this._style = evalCss(require('./NetMock.scss'))
    this.name = 'mock'
    this._master = true
    this._rules = []
    this._editingId = 0
  }
  init($el, container) {
    super.init($el)
    this._container = container
    this._load()
    this._render()
    this._bindEvent()
    this._unsubRes = onResponse(() => this._renderMocked())
  }
  destroy() {
    each(this._rules, (rule) => removeMockRule(rule._netId))
    this._unsubRes()
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
      const rule = {
        id: r.id || Date.now(),
        pattern: String(r.pattern || ''),
        status: +r.status || 200,
        contentType: String(r.contentType || 'application/json'),
        body: String(r.body || ''),
        headers: String(r.headers || ''),
        enabled: r.enabled !== false,
      }
      this._addToNet(rule)
      this._rules.push(rule)
    })
  }
  _save() {
    const raw = this._rules.map((r) => ({
      id: r.id,
      pattern: r.pattern,
      status: r.status,
      contentType: r.contentType,
      body: r.body,
      headers: r.headers,
      enabled: r.enabled,
    }))
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(raw))
    } catch {
      /* ignore */
    }
  }
  _addToNet(rule) {
    rule._ref = {
      pattern: parsePattern(rule.pattern),
      status: rule.status,
      contentType: rule.contentType,
      body: rule.body,
      headers: parseHeaderLines(rule.headers),
      enabled: this._master && rule.enabled,
    }
    rule._netId = addMockRule(rule._ref)
  }
  _refreshNet(rule) {
    removeMockRule(rule._netId)
    this._addToNet(rule)
  }
  _render() {
    const typeOpts = CONTENT_TYPES.map((t) => `<option value="${t}">${t}</option>`).join('')
    this._$el.html(`<div class="${c('wrap')}">
      <div class="${c('toolbar')}">
        <label class="${c('switch')}">
          <input type="checkbox" class="${c('master')}" checked /> Aktif
        </label>
        <span class="${c('hint')}">Balas request dengan data palsu</span>
      </div>
      <div class="${c('form')}">
        <input class="${c('f-pattern')}" placeholder="Pattern: substring atau /regex/" />
        <div class="${c('f-row')}">
          <input class="${c('f-status')}" type="number" value="200" placeholder="Status" />
          <select class="${c('f-type')}">${typeOpts}</select>
        </div>
        <textarea class="${c('f-body')}" rows="3" placeholder="Body respons palsu"></textarea>
        <textarea class="${c('f-headers')}" rows="2" placeholder="Header tambahan (opsional), format: Key: Value"></textarea>
        <div class="${c('f-row')}">
          <button class="${c('btn save')}">Tambah mock</button>
          <button class="${c('btn cancel-edit')}">Batal</button>
        </div>
      </div>
      <div class="${c('sec')}">Mock rules</div>
      <div class="${c('list')}"></div>
      <div class="${c('sec')}">Request yang ke-mock</div>
      <div class="${c('mocked-list')}"></div>
    </div>`)
    this._$list = this._$el.find(c('.list'))
    this._$mocked = this._$el.find(c('.mocked-list'))
    this._$cancelEdit = this._$el.find(c('.cancel-edit'))
    this._$cancelEdit.hide()
    this._renderList()
    this._renderMocked()
  }
  _bindEvent() {
    const self = this
    this._$el
      .on('change', c('.master'), function () {
        self._master = $(this).get(0).checked
        each(self._rules, (rule) => {
          rule._ref.enabled = self._master && rule.enabled
        })
        self._notify(self._master ? 'Mock aktif' : 'Mock nonaktif')
      })
      .on('click', c('.save'), () => self._saveRule())
      .on('click', c('.cancel-edit'), () => self._resetForm())
      .on('click', c('.edit-rule'), function () {
        self._editRule(+$(this).data('id'))
      })
      .on('click', c('.del-rule'), function () {
        const id = +$(this).data('id')
        if (ask('Hapus mock rule ini?')) self._deleteRule(id)
      })
      .on('change', c('.toggle-rule'), function () {
        self._toggleRule(+$(this).data('id'), $(this).get(0).checked)
      })
  }
  _readForm() {
    return {
      pattern: this._$el.find(c('.f-pattern')).val().trim(),
      status: +this._$el.find(c('.f-status')).val() || 200,
      contentType: this._$el.find(c('.f-type')).val(),
      body: this._$el.find(c('.f-body')).val(),
      headers: this._$el.find(c('.f-headers')).val(),
    }
  }
  _resetForm() {
    this._editingId = 0
    this._$el.find(c('.f-pattern')).val('')
    this._$el.find(c('.f-status')).val('200')
    this._$el.find(c('.f-type')).val('application/json')
    this._$el.find(c('.f-body')).val('')
    this._$el.find(c('.f-headers')).val('')
    this._$el.find(c('.save')).text('Tambah mock')
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
        rule.status = f.status
        rule.contentType = f.contentType
        rule.body = f.body
        rule.headers = f.headers
        this._refreshNet(rule)
      }
    } else {
      const rule = {
        id: Date.now(),
        pattern: f.pattern,
        status: f.status,
        contentType: f.contentType,
        body: f.body,
        headers: f.headers,
        enabled: true,
      }
      this._addToNet(rule)
      this._rules.push(rule)
    }
    this._save()
    this._resetForm()
    this._renderList()
    this._notify('Mock rule tersimpan')
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
    this._$el.find(c('.f-status')).val(String(rule.status))
    this._$el.find(c('.f-type')).val(rule.contentType)
    this._$el.find(c('.f-body')).val(rule.body)
    this._$el.find(c('.f-headers')).val(rule.headers)
    this._$el.find(c('.save')).text('Simpan perubahan')
    this._$cancelEdit.show()
  }
  _deleteRule(id) {
    const rule = this._findRule(id)
    if (rule) removeMockRule(rule._netId)
    this._rules = this._rules.filter((r) => r.id !== id)
    if (this._editingId === id) this._resetForm()
    this._save()
    this._renderList()
    this._notify('Mock rule dihapus')
  }
  _toggleRule(id, on) {
    const rule = this._findRule(id)
    if (!rule) return
    rule.enabled = on
    rule._ref.enabled = this._master && on
    this._save()
  }
  _renderList() {
    if (!this._rules.length) {
      this._$list.html(`<div class="${c('empty')}">Belum ada mock rule.</div>`)
      return
    }
    let html = ''
    each(this._rules, (rule) => {
      const checked = rule.enabled ? 'checked' : ''
      html += `<div class="${c('rule')}">
        <label class="${c('switch')}">
          <input type="checkbox" class="${c('toggle-rule')}" data-id="${rule.id}" ${checked} />
        </label>
        <div class="${c('rule-main')}">
          <div class="${c('rule-pattern')}">${escape(rule.pattern)}</div>
          <div class="${c('rule-desc')}">${rule.status} · ${escape(rule.contentType)}</div>
        </div>
        <button class="${c('btn xs edit-rule')}" data-id="${rule.id}">Edit</button>
        <button class="${c('btn xs del-rule')}" data-id="${rule.id}">Hapus</button>
      </div>`
    })
    this._$list.html(html)
  }
  _renderMocked() {
    const mocked = getRequests().filter((e) => e.mocked)
    if (!mocked.length) {
      this._$mocked.html(`<div class="${c('empty sm')}">Belum ada request yang ke-mock.</div>`)
      return
    }
    let html = ''
    each(mocked, (e) => {
      html += `<div class="${c('mocked-row')}">
        <span class="${c('status ok')}">${e.status}</span>
        <span class="${c('url')}">${escape(e.url)}</span>
      </div>`
    })
    this._$mocked.html(html)
  }
  _notify(msg) {
    this._container.notify(msg, { icon: 'success' })
  }
}
