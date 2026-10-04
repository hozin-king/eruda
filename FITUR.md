# 🛠️ Hozin Eruda Pro — Daftar Fitur

Fork dari [liriliri/eruda](https://github.com/liriliri/eruda) v3.4.3 (lisensi MIT, atribusi asli dipertahankan).
20 tool custom baru + 8 tool bawaan eruda + 1 file generator bookmarklet.

Buka **tab `hub`** sebagai home: grid berkategori berisi semua tool custom.

---

## Jaringan

| Tool (tab) | Fungsi | Cara pakai singkat |
|---|---|---|
| `curl` — cURL Export | Daftar semua request (fetch/XHR) yang lewat halaman, live. | Tap baris → detail → **Copy as cURL** (siap paste ke terminal). Ada filter teks + Copy URL. |
| `interceptor` — Interceptor | Ubah request sebelum dikirim: ganti method/URL, tambah-timpa header, timpa body, atau cancel. | Aktifkan toggle → tambah rule (pattern substring atau `/regex/`) → isi aksi → tersimpan otomatis. Counter menunjukkan request yang kena intercept. |
| `mock` — Net Mock | Balas request dengan response palsu tanpa menyentuh server. | Tambah rule: pattern URL + status + content-type + body. Cocok buat testing frontend saat backend belum jadi / simulasi error. |
| `websocket` — WebSocket | Tangkap traffic WebSocket dua arah. | Buka tab saat halaman membuka WS → tap socket → lihat pesan IN/OUT + expand + copy. |
| `har` — HAR Export | Export seluruh traffic tercatat ke file `.HAR` standar. | Centang "sertakan response body" bila perlu → **Export .HAR** → buka di DevTools desktop. Tombol Hapus log untuk mulai fresh. |
| `api-tester` — API Tester | Mini Postman di dalam eruda. | Isi method + URL + header + body → Kirim → lihat status, durasi, header & body response (auto pretty-JSON). Ada riwayat kiriman. |

## Media

| Tool (tab) | Fungsi | Cara pakai singkat |
|---|---|---|
| `media` — Media Sniffer | Tangkap URL video/audio/stream (mp4, m3u8, mpd, mp3, dsb) yang dimuat halaman. | **Scan ulang** untuk pindai DOM + log network; hasil live bertambah otomatis. Copy atau Buka URL. |

## Performa

| Tool (tab) | Fungsi | Cara pakai singkat |
|---|---|---|
| `fps` — FPS Meter | Frame-rate live + grafik 60 sampel + pemakaian memori JS. | Tap Start. Loop hanya jalan saat tab terbuka (hemat baterai). |
| `perf` — Perf Audit | Audit performa ala Lighthouse versi ringkas: FCP, LCP, CLS, estimasi TBT + skor 0–100. | **Jalankan audit** → lihat skor, metrik, top 25 resource terberat + waterfall sederhana. |
| `page` — Page Audit | Inventaris semua script, gambar, stylesheet, iframe di halaman + ukurannya. | Buka tab → otomatis terdaftar per kategori (collapsible). **Copy semua URL** bila perlu. |

## Keamanan

| Tool (tab) | Fungsi | Cara pakai singkat |
|---|---|---|
| `keys` — Key Scanner | Pindai script inline & eksternal dengan 9 pola regex (Google API, AWS, GitHub token, Slack, Stripe, dsb). | **Scan halaman** → kartu temuan (nilai termask, tap Copy untuk full). |
| `licenses` — Licenses | Deteksi library JS yang dipakai halaman (24 library dikenal) + lisensinya. | Buka tab → otomatis deteksi dari src script & global window. |
| `trackers` — Trackers | Deteksi tracker/iklan (15 pola domain) yang dimuat halaman + blokir per domain sekali klik. | Buka tab saat browsing → tap **Block** di domain yang mengganggu; kelola di seksi Diblokir. |

## Penyimpanan

| Tool (tab) | Fungsi | Cara pakai singkat |
|---|---|---|
| `cookies` — Cookie Getter | Lihat semua cookie (non-HttpOnly), copy per cookie, export JSON / format Netscape (cocok untuk `curl`/`yt-dlp --cookies`), import kembali, hapus per cookie. | Tap baris untuk expand + copy. |
| `indexeddb` — IndexedDB | Viewer + editor IndexedDB: Database → Object Store → Records (JSON), bisa edit & hapus. | Drilldown 3 level; tap record → Edit (textarea) / Hapus. |

## Produktivitas

| Tool (tab) | Fungsi | Cara pakai singkat |
|---|---|---|
| `recorder` — Recorder | Rekam aksi (klik, ketik, scroll) → replay otomatis → export sebagai script JS standalone. | **● Rekam** → lakukan aksi → **■ Stop** → **Replay** / **Export .js**. |
| `userscripts` — Userscripts | Simpan script JS custom yang auto-jalan tiap halaman dibuka (ala Tampermonkey mini). | Tambah script (nama + kode) → aktifkan toggle. Auto-run saat tool di-init. |
| `beautify` — JS Beautifier | Format ulang JavaScript yang di-minify jadi readable. | Paste kode / pilih script halaman → **Beautify** → Copy / Download .js. |
| `a11y` — A11y Audit | Audit aksesibilitas pakai axe-core: skor + daftar pelanggaran + sorot elemen bermasalah. | **Jalankan audit** → tap **Sorot** untuk highlight elemen. |
| Snippets 🇮🇩 | 5 snippet sekali-klik di tab `snippets` bawaan. | Buka tab snippets → pilih: Paksa dark mode, Unblock klik kanan & copy, Scroll otomatis, Hapus overlay paywall, Kumpulkan URL gambar. |

## Generator (bukan tool)

| File | Fungsi | Cara pakai |
|---|---|---|
| `tools/bookmarklet-generator.html` | Halaman mandiri untuk generate bookmarklet eruda custom. | Buka di browser → isi URL `eruda.js` (hasil build / CDN) → centang tool yang auto-terbuka → Generate → copy ke bookmark HP. |

---

## Keterbatasan (jujur)

- **HttpOnly cookies** tidak bisa dibaca JavaScript — batasan keamanan browser, tidak ada cara mengakalinya dari dalam halaman. Tab `cookies` menampilkan banner ini.
- **CSP ketat** di situs target bisa memblokir bookmarklet / suntikan script.
- **CORS** bisa menggagalkan fetch script eksternal (Key Scanner, Beautifier) — keduanya menampilkan pesan yang jelas saat ini terjadi.
- **axe-core** menambah ±1 MB ke ukuran bundle akhir.
- **Key Scanner** untuk audit situs milik sendiri / yang memberi izin. Hasil nihil ≠ jaminan aman.
- **License Inspector** memakai deteksi heuristik pola nama — bukan audit hukum.
- **Perf Audit**: angka aproksimasi (bukan Lighthouse penuh); LCP/CLS/TBT butuh halaman aktif saat tab terbuka.
- **Interceptor/Mock/Tracker-block** bekerja pada fetch & XHR; request yang dikirim via `<img>`/`<link>`/navigasi biasa tidak terpengaruh.
- **Media Sniffer**: tombol Download mengandalkan browser (cross-origin bisa ditolak → gunakan Copy URL + Buka).
- **Session Recorder** paling andal di-replay di halaman yang sama; selector bisa berubah bila DOM dinamis.
