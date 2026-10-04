/* Hozin Eruda Pro — shared network interception.
 * Patches fetch / XHR / WebSocket ONCE (idempotent, composes with eruda's
 * own Network tool). All Hozin network tools read from this single store.
 */

const FLAG = '__hozinNetPatched__'

let reqSeq = 0
let wsSeq = 0
let mockSeq = 0

const requests = []
const sockets = []
const reqListeners = []
const resListeners = []
const wsListeners = []
const reqHooks = []
const mockRules = []
const blockPatterns = []

const MAX_BODY = 100 * 1024 // capture at most 100KB of response text
const MAX_REQ_BODY = 32 * 1024

function now() {
  return Date.now()
}

export function matchPattern(pattern, url) {
  if (pattern == null || url == null) return false
  if (pattern instanceof RegExp) {
    try {
      return pattern.test(url)
    } catch {
      return false
    }
  }
  return url.indexOf(pattern) !== -1
}

/* Accept user input: plain substring or /regex/flags */
export function parsePattern(input) {
  input = String(input || '').trim()
  if (!input) return null
  const m = input.match(/^\/(.+)\/([gimsuy]*)$/)
  if (m) {
    try {
      return new RegExp(m[1], m[2])
    } catch {
      return input
    }
  }
  return input
}

function emit(list, arg) {
  for (let i = 0; i < list.length; i++) {
    try {
      list[i](arg)
    } catch {
      /* ignore listener errors */
    }
  }
}

function newEntry(kind, method, url) {
  return {
    id: ++reqSeq,
    kind,
    method: String(method || 'GET').toUpperCase(),
    url: String(url || ''),
    reqHeaders: {},
    reqBody: '',
    status: 0,
    statusText: '',
    resHeaders: {},
    resBody: '',
    resTruncated: false,
    mime: '',
    size: 0,
    startTime: now(),
    endTime: 0,
    duration: 0,
    error: '',
    mocked: false,
    blocked: false,
    _mutated: false,
  }
}

function finishEntry(entry) {
  entry.endTime = now()
  entry.duration = entry.endTime - entry.startTime
  emit(resListeners, entry)
}

function isBlocked(url) {
  for (const b of blockPatterns) {
    if (b.enabled !== false && matchPattern(b.pattern, url)) return b
  }
  return null
}

function findMock(url) {
  for (const r of mockRules) {
    if (r.enabled !== false && matchPattern(r.pattern, url)) return r
  }
  return null
}

function runHooks(entry) {
  for (const h of reqHooks) {
    try {
      if (h(entry) === false) return false
    } catch {
      /* ignore */
    }
  }
  return true
}

function headersToObj(headers) {
  const out = {}
  if (!headers) return out
  try {
    if (typeof headers.forEach === 'function') {
      headers.forEach((v, k) => {
        out[k] = v
      })
    } else if (typeof headers === 'object') {
      for (const k in headers) out[k] = headers[k]
    }
  } catch {
    /* ignore */
  }
  return out
}

function bodyPreview(body) {
  if (body == null) return ''
  if (typeof body === 'string') return body.slice(0, MAX_REQ_BODY)
  try {
    if (body instanceof URLSearchParams) return body.toString().slice(0, MAX_REQ_BODY)
    if (body instanceof FormData) return '[FormData]'
    if (body instanceof Blob) return '[Blob ' + (body.type || '') + ' ' + body.size + 'b]'
    if (body instanceof ArrayBuffer) return '[ArrayBuffer ' + body.byteLength + 'b]'
  } catch {
    /* ignore */
  }
  return '[binary body]'
}

/* ---------------- fetch ---------------- */

function patchFetch() {
  if (!window.fetch) return
  const origFetch = window.fetch.bind(window)

  window.fetch = function (input, init) {
    init = init || {}
    let url, method, headers, body
    const isReqObj = typeof input !== 'string' && input && input.url

    if (isReqObj) {
      url = input.url
      method = input.method
      headers = headersToObj(input.headers)
      body = init.body !== undefined ? init.body : undefined
    } else {
      url = String(input)
      method = init.method
      headers = headersToObj(init.headers)
      body = init.body
    }

    const entry = newEntry('fetch', method, url)
    entry.reqHeaders = headers
    entry.reqBody = bodyPreview(body)
    requests.push(entry)
    emit(reqListeners, entry)

    const blocker = isBlocked(url)
    if (blocker) {
      entry.blocked = true
      entry.error = 'Blocked by rule: ' + String(blocker.pattern)
      finishEntry(entry)
      return Promise.reject(new Error('[Hozin] Blocked: ' + url))
    }

    const rule = findMock(url)
    if (rule) {
      entry.mocked = true
      entry.status = rule.status || 200
      entry.resBody = String(rule.body || '')
      entry.mime = rule.contentType || 'application/json'
      setTimeout(() => finishEntry(entry), 0)
      const resHeaders = Object.assign(
        { 'content-type': entry.mime },
        rule.headers || {}
      )
      return Promise.resolve(new Response(entry.resBody, { status: entry.status, headers: resHeaders }))
    }

    if (runHooks(entry) === false) {
      entry.error = 'Cancelled by interceptor'
      finishEntry(entry)
      return Promise.reject(new Error('[Hozin] Cancelled by interceptor'))
    }

    let finalInput = input
    let finalInit = init
    if (entry._mutated) {
      finalInit = Object.assign({}, init, {
        method: entry.method,
        headers: entry.reqHeaders,
      })
      if (entry._bodyChanged) finalInit.body = entry._newBody
      finalInput = entry.url
    }

    return origFetch(finalInput, finalInit).then(
      (res) => {
        entry.status = res.status
        entry.statusText = res.statusText
        entry.resHeaders = headersToObj(res.headers)
        entry.mime = entry.resHeaders['content-type'] || ''
        const clone = res.clone()
        clone
          .text()
          .then((t) => {
            entry.size = t.length
            if (t.length > MAX_BODY) {
              entry.resBody = t.slice(0, MAX_BODY)
              entry.resTruncated = true
            } else {
              entry.resBody = t
            }
            finishEntry(entry)
          })
          .catch(() => {
            entry.resBody = '[unreadable body]'
            finishEntry(entry)
          })
        return res
      },
      (err) => {
        entry.error = String((err && err.message) || err)
        finishEntry(entry)
        throw err
      }
    )
  }
}

/* ---------------- XHR ---------------- */

function patchXHR() {
  const OrigXHR = window.XMLHttpRequest
  if (!OrigXHR || OrigXHR.__hozinWrapped) return

  function HozinXHR() {
    const xhr = new OrigXHR()
    const entry = newEntry('xhr', 'GET', '')
    const reqHeaders = {}
    let openArgs = null

    const origOpen = xhr.open.bind(xhr)
    const origSend = xhr.send.bind(xhr)
    const origSetRH = xhr.setRequestHeader.bind(xhr)

    xhr.open = function (method, url) {
      openArgs = Array.prototype.slice.call(arguments)
      entry.method = String(method || 'GET').toUpperCase()
      try {
        entry.url = new URL(url, location.href).href
      } catch {
        entry.url = String(url)
      }
      return origOpen.apply(xhr, arguments)
    }

    xhr.setRequestHeader = function (k, v) {
      reqHeaders[k] = v
      return origSetRH(k, v)
    }

    function fireError(msg) {
      entry.error = msg
      finishEntry(entry)
      setTimeout(() => {
        xhr.dispatchEvent(new Event('error'))
        xhr.dispatchEvent(new Event('loadend'))
      }, 0)
    }

    function simulateMock(rule) {
      entry.mocked = true
      entry.status = rule.status || 200
      entry.statusText = 'OK (mocked)'
      entry.resBody = String(rule.body || '')
      entry.mime = rule.contentType || 'application/json'
      entry.size = entry.resBody.length
      const hdrs = Object.assign({ 'content-type': entry.mime }, rule.headers || {})
      entry.resHeaders = {}
      for (const k in hdrs) entry.resHeaders[k.toLowerCase()] = hdrs[k]
      finishEntry(entry)
      setTimeout(() => {
        const states = [1, 2, 3, 4]
        let i = 0
        const step = () => {
          if (i < states.length) {
            try {
              Object.defineProperty(xhr, 'readyState', { value: states[i], configurable: true })
            } catch {
              /* ignore */
            }
            xhr.dispatchEvent(new Event('readystatechange'))
            i++
            setTimeout(step, 0)
          } else {
            try {
              Object.defineProperty(xhr, 'status', { value: entry.status, configurable: true })
              Object.defineProperty(xhr, 'statusText', { value: entry.statusText, configurable: true })
              Object.defineProperty(xhr, 'responseText', { value: entry.resBody, configurable: true })
              Object.defineProperty(xhr, 'response', { value: entry.resBody, configurable: true })
            } catch {
              /* ignore */
            }
            xhr.dispatchEvent(new Event('load'))
            xhr.dispatchEvent(new Event('loadend'))
          }
        }
        step()
      }, 10)
    }

    xhr.send = function (body) {
      entry.reqHeaders = Object.assign({}, reqHeaders)
      entry.reqBody = bodyPreview(body)
      requests.push(entry)
      emit(reqListeners, entry)

      const blocker = isBlocked(entry.url)
      if (blocker) {
        entry.blocked = true
        fireError('Blocked by rule: ' + String(blocker.pattern))
        return
      }

      const rule = findMock(entry.url)
      if (rule) {
        simulateMock(rule)
        return
      }

      if (runHooks(entry) === false) {
        fireError('Cancelled by interceptor')
        return
      }

      if (entry._mutated && openArgs) {
        openArgs[0] = entry.method
        openArgs[1] = entry.url
        origOpen.apply(xhr, openArgs)
        for (const k in entry.reqHeaders) {
          try {
            origSetRH(k, entry.reqHeaders[k])
          } catch {
            /* ignore */
          }
        }
      }

      const sendBody = entry._bodyChanged ? entry._newBody : body

      xhr.addEventListener('load', () => {
        try {
          entry.status = xhr.status
          entry.statusText = xhr.statusText
          const raw = xhr.getAllResponseHeaders() || ''
          raw.split('\r\n').forEach((line) => {
            const idx = line.indexOf(':')
            if (idx > 0) entry.resHeaders[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim()
          })
          entry.mime = entry.resHeaders['content-type'] || ''
          let t = ''
          try {
            t = xhr.responseText || ''
          } catch {
            t = '[binary response]'
          }
          entry.size = t.length
          if (t.length > MAX_BODY) {
            entry.resBody = t.slice(0, MAX_BODY)
            entry.resTruncated = true
          } else {
            entry.resBody = t
          }
        } catch (e) {
          entry.error = String(e && e.message)
        }
        finishEntry(entry)
      })
      xhr.addEventListener('error', () => {
        entry.error = 'network error'
        finishEntry(entry)
      })
      xhr.addEventListener('abort', () => {
        entry.error = 'aborted'
        finishEntry(entry)
      })

      return origSend(sendBody)
    }

    return xhr
  }

  HozinXHR.prototype = OrigXHR.prototype
  HozinXHR.__hozinWrapped = true
  ;['UNSENT', 'OPENED', 'HEADERS_RECEIVED', 'LOADING', 'DONE'].forEach((k) => {
    try {
      HozinXHR[k] = OrigXHR[k]
    } catch {
      /* ignore */
    }
  })
  window.XMLHttpRequest = HozinXHR
}

/* ---------------- WebSocket ---------------- */

function wsDataPreview(data) {
  if (typeof data === 'string') {
    return data.length > 4096 ? data.slice(0, 4096) + '…[truncated]' : data
  }
  try {
    if (data instanceof Blob) return '[Blob ' + (data.type || '') + ' ' + data.size + 'b]'
    if (data instanceof ArrayBuffer) return '[ArrayBuffer ' + data.byteLength + 'b]'
  } catch {
    /* ignore */
  }
  return '[binary]'
}

function patchWS() {
  const OrigWS = window.WebSocket
  if (!OrigWS || OrigWS.__hozinWrapped) return

  function HozinWS(url, protocols) {
    const ws = protocols === undefined ? new OrigWS(url) : new OrigWS(url, protocols)
    const sock = {
      id: ++wsSeq,
      url: String(url),
      messages: [],
      open: false,
      closed: false,
    }
    sockets.push(sock)
    emit(wsListeners, { type: 'open-socket', socket: sock })

    const origSend = ws.send.bind(ws)
    ws.send = function (data) {
      const msg = { dir: 'out', time: now(), data: wsDataPreview(data) }
      sock.messages.push(msg)
      emit(wsListeners, { type: 'message', socket: sock, message: msg })
      return origSend(data)
    }
    ws.addEventListener('open', () => {
      sock.open = true
      emit(wsListeners, { type: 'open', socket: sock })
    })
    ws.addEventListener('message', (e) => {
      const msg = { dir: 'in', time: now(), data: wsDataPreview(e.data) }
      sock.messages.push(msg)
      emit(wsListeners, { type: 'message', socket: sock, message: msg })
    })
    ws.addEventListener('close', () => {
      sock.closed = true
      emit(wsListeners, { type: 'close', socket: sock })
    })
    ws.addEventListener('error', () => {
      emit(wsListeners, { type: 'error', socket: sock })
    })
    return ws
  }

  HozinWS.prototype = OrigWS.prototype
  HozinWS.__hozinWrapped = true
  ;['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach((k) => {
    try {
      HozinWS[k] = OrigWS[k]
    } catch {
      /* ignore */
    }
  })
  window.WebSocket = HozinWS
}

/* ---------------- public API ---------------- */

export function ensureNetPatch() {
  if (window[FLAG]) return
  window[FLAG] = true
  try {
    patchFetch()
  } catch {
    /* ignore */
  }
  try {
    patchXHR()
  } catch {
    /* ignore */
  }
  try {
    patchWS()
  } catch {
    /* ignore */
  }
}

export function getRequests() {
  return requests
}

export function clearRequests() {
  requests.length = 0
}

export function onRequest(fn) {
  reqListeners.push(fn)
  return () => {
    const i = reqListeners.indexOf(fn)
    if (i >= 0) reqListeners.splice(i, 1)
  }
}

export function onResponse(fn) {
  resListeners.push(fn)
  return () => {
    const i = resListeners.indexOf(fn)
    if (i >= 0) resListeners.splice(i, 1)
  }
}

export function addRequestHook(fn) {
  reqHooks.push(fn)
  return () => {
    const i = reqHooks.indexOf(fn)
    if (i >= 0) reqHooks.splice(i, 1)
  }
}

/* rule: {pattern, status, headers, body, contentType, enabled} */
export function addMockRule(rule) {
  rule.id = ++mockSeq
  rule.enabled = rule.enabled !== false
  mockRules.push(rule)
  return rule.id
}

export function removeMockRule(id) {
  for (let i = mockRules.length - 1; i >= 0; i--) {
    if (mockRules[i].id === id) mockRules.splice(i, 1)
  }
}

export function getMockRules() {
  return mockRules
}

/* pattern: string substring or RegExp */
export function addBlockPattern(pattern) {
  const b = { pattern, enabled: true }
  blockPatterns.push(b)
  return b
}

export function removeBlockPattern(b) {
  const i = blockPatterns.indexOf(b)
  if (i >= 0) blockPatterns.splice(i, 1)
}

export function getBlockPatterns() {
  return blockPatterns
}

export function getSockets() {
  return sockets
}

export function onWsEvent(fn) {
  wsListeners.push(fn)
  return () => {
    const i = wsListeners.indexOf(fn)
    if (i >= 0) wsListeners.splice(i, 1)
  }
}

/* Re-send a logged request with optional overrides. Resolves {status, statusText, headers, body, truncated, duration}. */
export function resendRequest(entry, overrides) {
  overrides = overrides || {}
  const method = overrides.method || entry.method || 'GET'
  const url = overrides.url || entry.url
  const headers = Object.assign({}, entry.reqHeaders, overrides.headers || {})
  let body = overrides.body !== undefined ? overrides.body : undefined
  if (body === undefined && entry.reqBody && /POST|PUT|PATCH|DELETE/i.test(method)) {
    body = entry.reqBody
  }
  const t0 = now()
  return window
    .fetch(url, { method, headers, body })
    .then((res) =>
      res.text().then((t) => ({
        status: res.status,
        statusText: res.statusText,
        headers: headersToObj(res.headers),
        body: t.length > MAX_BODY ? t.slice(0, MAX_BODY) : t,
        truncated: t.length > MAX_BODY,
        duration: now() - t0,
      }))
    )
    .catch((err) => ({
      status: 0,
      statusText: '',
      headers: {},
      body: '',
      truncated: false,
      duration: now() - t0,
      error: String((err && err.message) || err),
    }))
}

/* Auto-install on import (idempotent). */
try {
  ensureNetPatch()
} catch {
  /* ignore */
}
