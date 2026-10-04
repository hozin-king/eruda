import Tool from '../DevTools/Tool'
import evalCss from '../lib/evalCss'
import { classPrefix as c } from '../lib/util'
import each from 'licia/each'
import escape from 'licia/escape'
import { copy, fmtBytes, shortUrl } from '../Hozin/util'

export default class PageAudit extends Tool {
  constructor() {
    super()
    this._style = evalCss(require('./PageAudit.scss'))
    this.name = 'page'
    this._allUrls = []
  }
  init($el, container) {
    super.init($el)
    this._container = container
    this._render()
    this._bindEvent()
    this._audit()
  }
  destroy() {
    super.destroy()
    evalCss.remove(this._style)
  }
  _render() {
    this._$el.html(`<div class="${c('wrap')}">
      <div class="${c('toolbar')}">
        <button class="${c('btn')} ${c('btn-scan')}">Scan ulang</button>
        <button class="${c('btn')} ${c('btn-accent')}">Copy semua URL</button>
      </div>
      <div class="${c('summary')}"></div>
      <div class="${c('cats')}"></div>
    </div>`)
    this._$summary = this._$el.find(c('.summary'))
    this._$cats = this._$el.find(c('.cats'))
  }
  _bindEvent() {
    const self = this
    this._$el.on('click', c('.btn-scan'), () => self._audit())
    this._$el.on('click', c('.btn-accent'), () => {
      if (!self._allUrls.length) {
        self._notify('Tidak ada URL untuk disalin')
        return
      }
      copy(self._allUrls.join('\n'))
      self._notify(self._allUrls.length + ' URL disalin')
    })
  }
  _audit() {
    const resMap = {}
    each(performance.getEntriesByType('resource') || [], (e) => {
      resMap[e.name] = e
    })
    const sizeOf = (url) => {
      const e = resMap[url]
      return e ? e.transferSize || 0 : 0
    }

    const scripts = []
    each(document.scripts, (s) => {
      if (s.src) scripts.push({ url: s.src, size: sizeOf(s.src) })
      else scripts.push({ url: '[inline]', size: 0, inline: true })
    })

    const images = []
    each(document.images, (img) => {
      const url = img.currentSrc || img.src
      images.push({
        url: url || '[tanpa src]',
        size: url ? sizeOf(url) : 0,
        extra: (img.naturalWidth || 0) + '×' + (img.naturalHeight || 0),
      })
    })

    const styles = []
    each(document.styleSheets, (ss) => {
      let href = ''
      try {
        href = ss.href || ''
      } catch {
        href = ''
      }
      if (href) styles.push({ url: href, size: sizeOf(href) })
      else styles.push({ url: '[inline]', size: 0, inline: true })
    })

    const frames = []
    each(document.querySelectorAll('iframe'), (f) => {
      frames.push({ url: f.src || '[tanpa src]', size: f.src ? sizeOf(f.src) : 0 })
    })

    const seen = {}
    this._allUrls = []
    each([scripts, images, styles, frames], (cat) => {
      each(cat, (it) => {
        if (!it.inline && it.url && it.url !== '[tanpa src]' && !seen[it.url]) {
          seen[it.url] = true
          this._allUrls.push(it.url)
        }
      })
    })

    this._renderSummary([scripts, images, styles, frames])
    this._renderCats([
      { title: 'Scripts', items: scripts },
      { title: 'Images', items: images },
      { title: 'Stylesheets', items: styles },
      { title: 'IFrames', items: frames },
    ])
  }
  _totalSize(items) {
    let t = 0
    each(items, (it) => {
      t += it.size || 0
    })
    return t
  }
  _renderSummary(cats) {
    const labels = ['Scripts', 'Images', 'Stylesheets', 'IFrames']
    let total = 0
    let html = ''
    each(cats, (items, i) => {
      const s = this._totalSize(items)
      total += s
      html += `<div class="${c('sum-item')}"><span class="${c('sum-k')}">${labels[i]}</span><span class="${c('sum-v')}">${items.length} · ${s ? fmtBytes(s) : '—'}</span></div>`
    })
    html += `<div class="${c('sum-item')} ${c('sum-total')}"><span class="${c('sum-k')}">Total size</span><span class="${c('sum-v')}">${total ? fmtBytes(total) : '—'}</span></div>`
    this._$summary.html(html)
  }
  _renderCats(cats) {
    let html = ''
    each(cats, (cat, i) => {
      const size = this._totalSize(cat.items)
      html += `<details class="${c('cat')}"${i === 0 ? ' open' : ''}>
        <summary class="${c('cat-head')}">${cat.title} (${cat.items.length}) — ${size ? fmtBytes(size) : '—'}</summary>
        <div class="${c('items')}">`
      if (!cat.items.length) {
        html += `<div class="${c('empty')}">Tidak ada.</div>`
      }
      each(cat.items, (it) => {
        html += `<div class="${c('row')}">
          <div class="${c('url')}" title="${escape(it.url)}">${escape(shortUrl(it.url, 64))}${it.extra ? ` <span class="${c('dim')}">${it.extra}</span>` : ''}</div>
          <div class="${c('size')}">${it.size ? fmtBytes(it.size) : '—'}</div>
        </div>`
      })
      html += '</div></details>'
    })
    this._$cats.html(html)
  }
  _notify(msg) {
    this._container.notify(msg, { icon: 'success' })
  }
}
