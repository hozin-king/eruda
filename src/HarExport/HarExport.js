import Tool from '../DevTools/Tool'
import evalCss from '../lib/evalCss'
import { classPrefix as c } from '../lib/util'
import each from 'licia/each'
import map from 'licia/map'
import { getRequests, clearRequests, onResponse } from '../Hozin/net'
import { download } from '../Hozin/util'

function headersArr(obj) {
  const arr = []
  each(obj, (v, k) => {
    arr.push({ name: String(k), value: String(v) })
  })
  return arr
}

function mimeOf(entry) {
  const h = entry.reqHeaders || {}
  return h['content-type'] || h['Content-Type'] || 'text/plain'
}

export default class HarExport extends Tool {
  constructor() {
    super()
    this._style = evalCss(require('./HarExport.scss'))
    this.name = 'har'
  }
  init($el, container) {
    super.init($el)
    this._container = container
    this._render()
    this._bindEvent()
    this._unsub = onResponse(() => this._updateCount())
  }
  destroy() {
    this._unsub()
    super.destroy()
    evalCss.remove(this._style)
  }
  _render() {
    this._$el.html(`<div class="${c('wrap')}">
      <div class="${c('stat')}">
        <div class="${c('big')}">0</div>
        <div class="${c('label')}">request tercatat</div>
      </div>
      <label class="${c('chk')}">
        <input type="checkbox" class="${c('include-body')}" checked />
        Sertakan response body
      </label>
      <div class="${c('actions')}">
        <button class="${c('btn export')}">Export .HAR</button>
        <button class="${c('btn clear')}">Hapus log</button>
      </div>
      <div class="${c('note')}">
        File HAR 1.2 berisi seluruh request fetch / XHR yang dicatat sejak halaman dimuat.
      </div>
    </div>`)
    this._updateCount()
  }
  _bindEvent() {
    const self = this
    this._$el
      .on('click', c('.export'), () => self._export())
      .on('click', c('.clear'), () => {
        clearRequests()
        self._updateCount()
        self._notify('Log request dihapus')
      })
  }
  _updateCount() {
    const n = getRequests().length
    this._$el.find(c('.big')).text(String(n))
  }
  _buildHar(includeBody) {
    const entries = map(getRequests(), (e) => ({
      startedDateTime: new Date(e.startTime).toISOString(),
      time: e.duration || 0,
      request: {
        method: e.method,
        url: e.url,
        httpVersion: 'HTTP/1.1',
        cookies: [],
        headers: headersArr(e.reqHeaders),
        queryString: [],
        postData: e.reqBody
          ? { mimeType: mimeOf(e), text: e.reqBody }
          : undefined,
        headersSize: -1,
        bodySize: e.reqBody ? e.reqBody.length : 0,
      },
      response: {
        status: e.status,
        statusText: e.statusText,
        httpVersion: 'HTTP/1.1',
        cookies: [],
        headers: headersArr(e.resHeaders),
        content: {
          size: e.size,
          mimeType: e.mime || 'text/plain',
          text: includeBody ? e.resBody : '',
        },
        redirectURL: '',
        headersSize: -1,
        bodySize: e.size,
      },
      cache: {},
      timings: { send: 0, wait: e.duration || 0, receive: 0 },
    }))
    return {
      log: {
        version: '1.2',
        creator: { name: 'Hozin Eruda Pro', version: '1.0' },
        entries,
      },
    }
  }
  _export() {
    const includeBody = this._$el.find(c('.include-body')).get(0).checked
    const requests = getRequests()
    if (!requests.length) {
      this._notify('Belum ada request untuk diekspor')
      return
    }
    const har = this._buildHar(includeBody)
    download('hozin-log.har', JSON.stringify(har, null, 2), 'application/json')
    this._notify('HAR diekspor (' + requests.length + ' request)')
  }
  _notify(msg) {
    this._container.notify(msg, { icon: 'success' })
  }
}
