import Tool from '../DevTools/Tool'
import evalCss from '../lib/evalCss'
import { classPrefix as c, isErudaEl } from '../lib/util'
import escape from 'licia/escape'
import { download, fmtClock } from '../Hozin/util'

/* Bangun selector CSS unik: pakai #id bila ada, else path tag + :nth-of-type. */
function cssPath(el) {
  if (!el || el.nodeType !== 1) return ''
  if (el.id) return '#' + el.id
  const parts = []
  let node = el
  while (node && node.nodeType === 1) {
    let sel = node.tagName.toLowerCase()
    if (node !== document.documentElement) {
      const parent = node.parentNode
      if (parent && parent.children) {
        let same = 0
        let idx = 0
        const kids = parent.children
        for (let i = 0; i < kids.length; i++) {
          if (kids[i].tagName === node.tagName) {
            same++
            if (kids[i] === node) idx = same
          }
        }
        if (same > 1) sel += ':nth-of-type(' + idx + ')'
      }
    }
    parts.unshift(sel)
    node = node.parentNode
    if (node === document) break
  }
  return parts.join(' > ')
}

function shortSel(selector) {
  if (selector.length > 48) return '…' + selector.slice(-47)
  return selector
}

export default class SessionRecorder extends Tool {
  constructor() {
    super()
    this._style = evalCss(require('./SessionRecorder.scss'))
    this.name = 'recorder'

    this._steps = []
    this._recording = false
    this._replaying = false
    this._curIdx = -1

    this._onDocClick = (e) => {
      if (isErudaEl(e.target)) return
      this._pushStep({ type: 'click', selector: cssPath(e.target) })
    }
    this._onDocInput = (e) => {
      if (isErudaEl(e.target)) return
      const el = e.target
      this._pushStep({
        type: 'input',
        selector: cssPath(el),
        value: el.value !== undefined ? el.value : '',
      })
    }
    this._onDocChange = (e) => {
      if (isErudaEl(e.target)) return
      const el = e.target
      // checkbox/radio/select tidak selalu memicu input
      this._pushStep({
        type: 'change',
        selector: cssPath(el),
        value: el.type === 'checkbox' || el.type === 'radio' ? el.checked : el.value,
      })
    }
    this._scrollTimer = 0
    this._onDocScroll = () => {
      clearTimeout(this._scrollTimer)
      this._scrollTimer = setTimeout(() => {
        this._pushStep({
          type: 'scroll',
          x: window.scrollX,
          y: window.scrollY,
        })
      }, 500)
    }
  }
  init($el, container) {
    super.init($el)
    this._container = container
    this._render()
    this._bindEvent()
  }
  destroy() {
    this._detach()
    super.destroy()
    evalCss.remove(this._style)
  }
  _render() {
    const recording = this._recording
    const replaying = this._replaying
    const steps = this._steps

    let listHtml = `<div class="${c('empty')}">Belum ada langkah.<br/>Tekan "● Rekam", lalu lakukan aksi di halaman.</div>`
    if (steps.length) {
      listHtml = steps
        .map((s, i) => {
          const active = i === this._curIdx ? ` ${c('active')}` : ''
          let detail = escape(shortSel(s.selector || ''))
          if (s.type === 'scroll') detail = 'x:' + s.x + ' y:' + s.y
          if (s.value !== undefined && s.value !== '') {
            detail += ' = ' + escape(String(s.value).slice(0, 32))
          }
          return `<div class="${c('step')}${active}">
            <span class="${c('idx')}">${i + 1}</span>
            <span class="${c('type')} ${c('type-' + s.type)}">${s.type}</span>
            <span class="${c('sel')}">${detail}</span>
            <span class="${c('time')}">${s.time}</span>
          </div>`
        })
        .join('')
    }

    this._$el.html(`<div class="${c('wrap')}">
      <div class="${c('toolbar')}">
        <button class="${c('btn')} ${c(recording ? 'stop' : 'rec')}" data-act="toggle">
          ${recording ? '■ Stop' : '● Rekam'}
        </button>
        <button class="${c('btn')}" data-act="replay" ${
          steps.length && !replaying ? '' : 'disabled'
        }>▶ Replay</button>
        <button class="${c('btn')}" data-act="export" ${
          steps.length ? '' : 'disabled'
        }>⬇ Export .js</button>
        <button class="${c('btn')} ${c('danger')}" data-act="clear" ${
          steps.length ? '' : 'disabled'
        }>🗑 Hapus</button>
      </div>
      <div class="${c('hint')}">${
        recording
          ? 'Merekam… klik/input/scroll di halaman dicatat. Replay paling andal di halaman yang sama.'
          : 'Recorder menangkap klik, input/change, dan scroll sebagai langkah.'
      }</div>
      <div class="${c('list')}">${listHtml}</div>
    </div>`)
  }
  _bindEvent() {
    const self = this
    this._$el.on('click', c('.btn'), function () {
      const act = this.getAttribute('data-act')
      if (act === 'toggle') self._toggle()
      else if (act === 'replay') self._replay()
      else if (act === 'export') self._export()
      else if (act === 'clear') self._clear()
    })
  }
  _pushStep(step) {
    step.time = fmtClock(Date.now())
    this._steps.push(step)
    this._render()
  }
  _toggle() {
    if (this._recording) {
      this._detach()
      this._notify('Rekaman berhenti — ' + this._steps.length + ' langkah')
    } else {
      this._attach()
      this._notify('Merekam… lakukan aksi di halaman')
    }
    this._render()
  }
  _attach() {
    if (this._recording) return
    document.addEventListener('click', this._onDocClick, true)
    document.addEventListener('input', this._onDocInput, true)
    document.addEventListener('change', this._onDocChange, true)
    window.addEventListener('scroll', this._onDocScroll, { passive: true })
    this._recording = true
  }
  _detach() {
    if (!this._recording) return
    document.removeEventListener('click', this._onDocClick, true)
    document.removeEventListener('input', this._onDocInput, true)
    document.removeEventListener('change', this._onDocChange, true)
    window.removeEventListener('scroll', this._onDocScroll)
    clearTimeout(this._scrollTimer)
    this._recording = false
  }
  _doStep(step) {
    try {
      if (step.type === 'click') {
        const el = document.querySelector(step.selector)
        if (el) el.click()
      } else if (step.type === 'input' || step.type === 'change') {
        const el = document.querySelector(step.selector)
        if (el && 'value' in el) {
          if (step.type === 'change' && el.type === 'checkbox') {
            el.checked = !!step.value
          } else {
            el.value = step.value || ''
          }
          el.dispatchEvent(new Event('input', { bubbles: true }))
          el.dispatchEvent(new Event('change', { bubbles: true }))
        }
      } else if (step.type === 'scroll') {
        window.scrollTo(step.x, step.y)
      }
    } catch {
      /* langkah gagal diabaikan */
    }
  }
  _replay() {
    if (this._replaying || !this._steps.length) return
    const steps = this._steps.slice()
    this._replaying = true
    this._notify('Replay dimulai — ' + steps.length + ' langkah')
    let i = 0
    const next = () => {
      if (i >= steps.length) {
        this._replaying = false
        this._curIdx = -1
        this._notify('Replay selesai')
        this._render()
        return
      }
      this._curIdx = i
      this._doStep(steps[i])
      this._render()
      i++
      setTimeout(next, 600)
    }
    next()
  }
  _export() {
    if (!this._steps.length) return
    const lines = [
      '// Direkam dengan Hozin Eruda Pro — SessionRecorder',
      '// Jalankan di halaman yang sama dengan saat merekam.',
      'const steps = ' + JSON.stringify(this._steps, null, 2) + ';',
      '(async function () {',
      '  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));',
      '  for (const s of steps) {',
      '    await sleep(600);',
      '    try {',
      '      if (s.type === "click") {',
      '        const el = document.querySelector(s.selector);',
      '        if (el) el.click();',
      '      } else if (s.type === "input" || s.type === "change") {',
      '        const el = document.querySelector(s.selector);',
      '        if (el && "value" in el) {',
      '          if (s.type === "change" && el.type === "checkbox") {',
      '            el.checked = !!s.value;',
      '          } else {',
      '            el.value = s.value || "";',
      '          }',
      '          el.dispatchEvent(new Event("input", { bubbles: true }));',
      '          el.dispatchEvent(new Event("change", { bubbles: true }));',
      '        }',
      '      } else if (s.type === "scroll") {',
      '        window.scrollTo(s.x, s.y);',
      '      }',
      '    } catch (e) { console.warn("Langkah gagal:", s, e); }',
      '  }',
      '})();',
    ]
    download('recording.js', lines.join('\n'), 'text/javascript')
    this._notify('Script diekspor (recording.js)')
  }
  _clear() {
    this._steps = []
    this._curIdx = -1
    this._render()
    this._notify('Semua langkah dihapus')
  }
  _notify(msg) {
    this._container.notify(msg, { icon: 'success' })
  }
}
