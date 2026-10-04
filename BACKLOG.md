# BACKLOG — Hozin Eruda Pro (ditampung, belum dibangun)

> Status: ide-ide di bawah ini DITAMPUNG dulu atas permintaan user (4 Okt 2026 malam).
> Jangan dibangun sebelum user menyuruh.

## Ide dari user (prioritas saat user bilang "gas")
1. **DOM Editor** — tap elemen → edit teks/HTML/atribut, tambah child node, hapus node. (Belum ada di build.)
2. **Cookie Import/Export** — SUDAH ADA di tool Cookie Getter, tapi user melaporkan belum bisa dipakai → kemungkinan build bermasalah di HP. Perlu diagnosis dulu (menunggu jawaban user: gejala a/b/c).
3. **Adblock beneran** — upgrade TrackerDetector jadi adblock pakai daftar filter + tombol on/off global. (Belum ada; TrackerDetector baru block per-domain.)

## Bug yang dilaporkan user (4 Okt 2026 ~23:02 WIB)
- "javascript tambahan itu belum bisa di apa apain" — build `dist/eruda.js` (commit 566c38d) diduga tidak jalan di HP user via bookmarklet.
- Bookmarklet terverifikasi valid: `eruda.init()` + `eruda.show()` API-nya benar, file live di jsDelivr (200, 1.411.050 bytes).
- Menunggu user menjawab gejala: (a) tidak ada reaksi / (b) panel kebuka tapi tool kosong-error / (c) tombol mengambang tapi panel tidak kebuka.

## Ide gelombang 1 (dari studi — SUDAH DIBANGUN semua, 21 fitur)
Copy as cURL, Request Interceptor, Network Mocking, WebSocket Inspector, Export HAR,
Mini Postman, Video URL Sniffer, FPS/Memory Meter, Lighthouse Lite, Page Audit,
API Key Scanner, License Inspector, Tracker Detector, Cookie Getter, IndexedDB Inspector,
Session Recorder, Userscript Manager, JS Beautifier, Snippet Pack ID, A11y Audit,
Bookmarklet Generator. + HozinHub.

## Ide gelombang 2 (ditampung — belum dipilih)
SEO Inspector, Font & Color Detective, Geolocation Spoofer, Table-to-CSV Extractor,
Bulk Image Downloader, Reading Mode + TTS, Smart Selector Generator, Design Mode Toggle,
Page Ruler, Service Worker & Cache Inspector, QR Share, Auto-Refresh Monitor.

## Ide gelombang 3 (ditampung — user bilang "kurang menarik")
Overflow Detector, Security Headers Checker, Z-index Mapper, DOM Snapshot Diff,
Animation Controller, Form Recovery, Clean URL Copier, Lazy-load Forcer,
Broken Resource Finder, Theme Emulator.

## Ide gelombang 4 (ditampung — user bilang "lebih good", belum pilih)
AI Debugger, HLS Downloader (m3u8→TS), Privacy Grade + Fingerprinting Detector,
Visual Style Editor, Chaos Mode, JWT Decoder, JSONPath Explorer,
WebView Bridge Inspector, Offline Page Saver, Color Blindness Simulator.

## Ide ditunda user ("nanti")
- **Browser mini APK** — address bar + WebView + auto-inject Hozin Eruda Pro via
  evaluateJavascript (tembus CSP). Tujuan user: test eruda di vidio.com
  (tidak bisa suntik langsung ke aplikasi Vidio orang lain — WebView tertutup).
  Batasan: DRM Vidio tetap tidak bisa diapa-apain.

## Batch 2 yang DIBATALKAN (4 Okt 2026 ~23:00 WIB)
- Sempat dikerjakan subagent: AI Debugger, HLS Downloader, Privacy Grade, JWT Decoder,
  JSONPath Explorer, WebView Bridge Inspector + tombol "‹ Hub" di semua tool.
- User: "kurang menarik itu" → subagent di-shutdown sebelum selesai. Working tree
  `~/workspace/eruda-pro/` mungkin berisi file setengah jadi yang BELUM di-commit —
  bersihkan/abaikan sebelum mulai batch berikutnya.
