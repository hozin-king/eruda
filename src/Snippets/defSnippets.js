import logger from '../lib/logger'
import emitter from '../lib/emitter'
import Url from 'licia/Url'
import now from 'licia/now'
import startWith from 'licia/startWith'
import $ from 'licia/$'
import upperFirst from 'licia/upperFirst'
import loadJs from 'licia/loadJs'
import trim from 'licia/trim'
import LunaModal from 'luna-modal'
import { isErudaEl } from '../lib/util'
import evalCss from '../lib/evalCss'

let style = null
let unblockStyle = null

export default [
  {
    name: 'Border All',
    fn() {
      if (style) {
        evalCss.remove(style)
        style = null
        return
      }

      style = evalCss(
        '* { outline: 2px dashed #707d8b; outline-offset: -3px; }',
        document.head
      )
    },
    desc: 'Add color borders to all elements',
  },
  {
    name: 'Refresh Page',
    fn() {
      const url = new Url()
      url.setQuery('timestamp', now())

      window.location.replace(url.toString())
    },
    desc: 'Add timestamp to url and refresh',
  },
  {
    name: 'Search Text',
    fn() {
      LunaModal.prompt('Enter the text').then((keyword) => {
        if (!keyword || trim(keyword) === '') {
          return
        }

        search(keyword)
      })
    },
    desc: 'Highlight given text on page',
  },
  {
    name: 'Edit Page',
    fn() {
      const body = document.body

      body.contentEditable = body.contentEditable !== 'true'
    },
    desc: 'Toggle body contentEditable',
  },
  {
    name: 'Fit Screen',
    // https://achrafkassioui.com/birdview/
    fn() {
      const body = document.body
      const html = document.documentElement
      const $body = $(body)
      if ($body.data('scaled')) {
        window.scrollTo(0, +$body.data('scaled'))
        $body.rmAttr('data-scaled')
        $body.css('transform', 'none')
      } else {
        const documentHeight = Math.max(
          body.scrollHeight,
          body.offsetHeight,
          html.clientHeight,
          html.scrollHeight,
          html.offsetHeight
        )
        const viewportHeight = Math.max(
          document.documentElement.clientHeight,
          window.innerHeight || 0
        )
        const scaleVal = viewportHeight / documentHeight
        $body.css('transform', `scale(${scaleVal})`)
        $body.data('scaled', window.scrollY)
        window.scrollTo(0, documentHeight / 2 - viewportHeight / 2)
      }
    },
    desc: 'Scale down the whole page to fit screen',
  },
  {
    name: 'Load Vue Plugin',
    fn() {
      loadPlugin('vue')
    },
    desc: 'Vue devtools',
  },
  {
    name: 'Load Monitor Plugin',
    fn() {
      loadPlugin('monitor')
    },
    desc: 'Display page fps, memory and dom nodes',
  },
  {
    name: 'Load Features Plugin',
    fn() {
      loadPlugin('features')
    },
    desc: 'Browser feature detections',
  },
  {
    name: 'Load Timing Plugin',
    fn() {
      loadPlugin('timing')
    },
    desc: 'Show performance and resource timing',
  },
  {
    name: 'Load Code Plugin',
    fn() {
      loadPlugin('code')
    },
    desc: 'Edit and run JavaScript',
  },
  {
    name: 'Load Benchmark Plugin',
    fn() {
      loadPlugin('benchmark')
    },
    desc: 'Run JavaScript benchmarks',
  },
  {
    name: 'Load Geolocation Plugin',
    fn() {
      loadPlugin('geolocation')
    },
    desc: 'Test geolocation',
  },
  {
    name: 'Load Orientation Plugin',
    fn() {
      loadPlugin('orientation')
    },
    desc: 'Test orientation api',
  },
  {
    name: 'Load Touches Plugin',
    fn() {
      loadPlugin('touches')
    },
    desc: 'Visualize screen touches',
  },
  {
    name: '🇮🇩 Paksa dark mode',
    fn() {
      const html = document.documentElement
      if (window.__hozinDark) {
        html.style.filter = ''
        window.__hozinDark = false
      } else {
        html.style.filter = 'invert(1) hue-rotate(180deg)'
        window.__hozinDark = true
      }
    },
    desc: 'Toggle filter invert + hue-rotate agar halaman terlihat gelap',
  },
  {
    name: '🇮🇩 Unblock klik kanan & copy',
    fn() {
      document.oncontextmenu = null
      document.oncopy = null
      document.oncut = null
      document.onpaste = null
      document.onselectstart = null
      document.ondragstart = null
      const attrs = [
        'oncontextmenu',
        'oncopy',
        'oncut',
        'onpaste',
        'onselectstart',
        'ondragstart',
      ]
      const els = document.querySelectorAll(attrs.map((a) => '[' + a + ']').join(','))
      for (let i = 0; i < els.length; i++) {
        for (let j = 0; j < attrs.length; j++) els[i].removeAttribute(attrs[j])
      }
      if (unblockStyle) {
        evalCss.remove(unblockStyle)
        unblockStyle = null
      } else {
        unblockStyle = evalCss(
          '* { user-select: text !important; -webkit-user-select: text !important; }',
          document.head
        )
      }
    },
    desc: 'Aktifkan klik kanan, copy, dan seleksi teks yang diblokir situs',
  },
  {
    name: '🇮🇩 Scroll otomatis',
    fn() {
      if (window.__hozinAutoScroll) {
        clearInterval(window.__hozinAutoScroll)
        window.__hozinAutoScroll = 0
      } else {
        window.__hozinAutoScroll = setInterval(() => {
          window.scrollBy({ top: 2, behavior: 'smooth' })
        }, 50)
      }
    },
    desc: 'Toggle scroll halaman otomatis ke bawah (jalankan lagi untuk berhenti)',
  },
  {
    name: '🇮🇩 Hapus overlay paywall',
    fn() {
      const area = window.innerWidth * window.innerHeight
      const els = document.querySelectorAll('body *')
      let removed = 0
      for (let i = 0; i < els.length; i++) {
        const el = els[i]
        const cs = getComputedStyle(el)
        if (cs.position !== 'fixed') continue
        const z = parseInt(cs.zIndex, 10)
        if (isNaN(z) || z < 100) continue
        const r = el.getBoundingClientRect()
        if (r.width * r.height > area * 0.7) {
          el.remove()
          removed++
        }
      }
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
      logger.info('Overlay paywall dihapus: ' + removed)
    },
    desc: 'Hapus elemen fixed ber-z-index tinggi yang menutupi >70% layar',
  },
  {
    name: '🇮🇩 Kumpulkan URL gambar',
    fn() {
      const urls = []
      const imgs = document.querySelectorAll('img')
      for (let i = 0; i < imgs.length; i++) {
        const src = imgs[i].currentSrc || imgs[i].src
        if (src && urls.indexOf(src) < 0) urls.push(src)
      }
      if (!urls.length) {
        logger.info('Tidak ada gambar ditemukan')
        return
      }
      const text = urls.join('\n')
      const done = () => logger.info(urls.length + ' URL gambar disalin')
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, () => {
          window.prompt('Salin manual (' + urls.length + ' URL):', text)
        })
      } else {
        window.prompt('Salin manual (' + urls.length + ' URL):', text)
      }
    },
    desc: 'Kumpulkan semua URL gambar unik lalu salin ke clipboard',
  },
]

evalCss(require('./searchText.scss'), document.head)

function search(text) {
  const root = document.body
  const regText = new RegExp(text, 'ig')

  traverse(root, (node) => {
    const $node = $(node)

    if (!$node.hasClass('eruda-search-highlight-block')) return

    return document.createTextNode($node.text())
  })

  traverse(root, (node) => {
    if (node.nodeType !== 3) return

    let val = node.nodeValue
    val = val.replace(
      regText,
      (match) => `<span class="eruda-keyword">${match}</span>`
    )
    if (val === node.nodeValue) return

    const $ret = $(document.createElement('div'))

    $ret.html(val)
    $ret.addClass('eruda-search-highlight-block')

    return $ret.get(0)
  })
}

function traverse(root, processor) {
  const childNodes = root.childNodes

  if (isErudaEl(root)) return

  for (let i = 0, len = childNodes.length; i < len; i++) {
    const newNode = traverse(childNodes[i], processor)
    if (newNode) root.replaceChild(newNode, childNodes[i])
  }

  return processor(root)
}

function loadPlugin(name) {
  const globalName = 'eruda' + upperFirst(name)
  if (window[globalName]) return

  let protocol = location.protocol
  if (!startWith(protocol, 'http')) protocol = 'http:'

  loadJs(
    `${protocol}//cdn.jsdelivr.net/npm/eruda-${name}@${pluginVersion[name]}`,
    (isLoaded) => {
      if (!isLoaded || !window[globalName])
        return logger.error('Fail to load plugin ' + name)

      emitter.emit(emitter.ADD, window[globalName])
      emitter.emit(emitter.SHOW, name)
    }
  )
}

const pluginVersion = {
  monitor: '1.1.1',
  features: '2.1.0',
  timing: '2.0.1',
  code: '2.2.0',
  benchmark: '2.0.1',
  geolocation: '2.1.0',
  orientation: '2.1.1',
  touches: '2.1.0',
  vue: '1.1.1',
}
