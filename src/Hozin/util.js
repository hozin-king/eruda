/* Hozin Eruda Pro — shared small helpers for custom tools. */
import copy from 'licia/copy'
import escape from 'licia/escape'

export { copy, escape }

export function download(filename, content, mime) {
  mime = mime || 'application/octet-stream'
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime })
  const a = document.createElement('a')
  const url = URL.createObjectURL(blob)
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 500)
}

export function fmtBytes(n) {
  n = +n || 0
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1024 / 1024).toFixed(2) + ' MB'
}

export function fmtClock(ts) {
  const d = new Date(ts)
  const p = (x) => String(x).padStart(2, '0')
  return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds())
}

export function shortUrl(url, max) {
  url = String(url || '')
  max = max || 64
  if (url.length <= max) return url
  return '…' + url.slice(url.length - max + 1)
}

export function debounce(fn, ms) {
  let t = 0
  return function () {
    clearTimeout(t)
    const args = arguments
    t = setTimeout(() => fn.apply(null, args), ms)
  }
}

/* Minimal modal-less confirm using native confirm (page context). */
export function ask(msg) {
  try {
    return window.confirm(msg)
  } catch {
    return false
  }
}
