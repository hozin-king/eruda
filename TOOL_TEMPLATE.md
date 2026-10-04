# TOOL TEMPLATE — Hozin Eruda Pro

Setiap custom tool = folder `src/<Folder>/` berisi 2 file:
- `src/<Folder>/<Folder>.js` — class tool
- `src/<Folder>/<Folder>.scss` — style

## Template JS (WAJIB diikuti)

```js
import Tool from '../DevTools/Tool'
import evalCss from '../lib/evalCss'
import { classPrefix as c } from '../lib/util'
import $ from 'licia/$'
import each from 'licia/each'
import escape from 'licia/escape'
import copy from 'licia/copy'

export default class ContohTool extends Tool {
  constructor() {
    super()
    this._style = evalCss(require('./ContohTool.scss'))
    this.name = 'contoh' // <-- NAMA TAB: lowercase, unik, tanpa spasi
  }
  init($el, container) {
    super.init($el)
    this._container = container
    this._render()
    this._bindEvent()
  }
  destroy() {
    super.destroy()
    evalCss.remove(this._style)
  }
  _render() {
    // root element otomatis ber-id eruda-<name>, mis. #eruda-contoh
    this._$el.html(`<div class="${c('wrap')}">...</div>`)
  }
  _bindEvent() {
    // pakai this._$el.on('click', c('.btn'), ...) — c() = classPrefix, HASIL: eruda-btn
    // JANGAN tulis class "eruda-..." manual di HTML; selalu lewat c('...')
  }
  _notify(msg) {
    this._container.notify(msg, { icon: 'success' })
  }
}
```

## Aturan keras

1. **Nama tab** (`this.name`): lowercase, pendek, unik. Daftar final (JANGAN diganti):
   hub, curl, interceptor, mock, websocket, har, api-tester, media, fps, perf,
   page, keys, licenses, trackers, cookies, indexeddb, recorder, userscripts,
   beautify, a11y
2. **SCSS**: selector root HARUS `#<name>` (mis. `#curl { ... }`). Class dalam HARUS
   ditulis TANPA prefix (mis. `.title`), karena build otomatis: postcss tambah `_`
   lalu evalCss ubah `_` → `eruda-`. Awali file dengan:
   ```scss
   @use '../style/variable' as *;
   @use '../style/mixin' as *;
   ```
   Pakai variabel tema: `var(--border)`, `var(--accent)`, `var(--primary)`,
   `var(--foreground)`, `var(--background)`. Jangan hardcode warna mencolok.
   Mixin berguna: `@include overflow-auto(y);`, `@include control();`
3. **Di JS**: semua class di HTML string WAJIB lewat `c('nama')`. Jangan pernah
   tulis literal `eruda-xxx` di JS/HTML.
4. **Jangan** `import` dari tool lain (mis. Network bawaan). Tool jaringan pakai
   `../Hozin/net.js` (baca filenya dulu — API: getRequests, onRequest/onResponse,
   addMockRule, addBlockPattern, addRequestHook, resendRequest, getSockets,
   onWsEvent, matchPattern, parsePattern). Helper umum di `../Hozin/util.js`
   (download, copy, fmtBytes, fmtClock, shortUrl).
5. Kode harus lolos ESLint (build menjalankan eslint-webpack-plugin). Hindari
   `var`, pakai `const`/`let`; hindari unused import.
6. **JANGAN sentuh**: `src/eruda.js`, tool bawaan lain, `package.json`,
   `build/`. Hanya buat file di folder tool yang ditugaskan (+1 pengecualian:
   SnippetsID boleh APPEND ke `src/Snippets/defSnippets.js`).
7. Tiap tool harus punya tombol/aksi yang jelas dan UI yang rapi mobile-first.
   Tampilkan empty-state yang informatif bila belum ada data.

## Verifikasi per tool (tanpa full build)

Jalankan: `npx eslint src/<Folder>/` — harus bersih (ini menangkap syntax error).
Jangan jalankan `npm run build` (berat & dilakukan koordinator di akhir).
