# Bacakomix — Frontend

Website baca komik (manga, manhwa, manhua) berbahasa Indonesia. Static site
murni: **HTML + CSS + JavaScript vanilla**, tanpa build step, tanpa npm,
tanpa framework. Semua data diambil langsung dari API Bacakomix.

## Struktur

```
.
├── index.html          # Beranda: hero, Lanjutkan Membaca, Terbaru (+ Muat Lebih), Bookmark Saya
├── browse.html         # Katalog (?page=), Pencarian (?q=), Bookmark (?tab=bookmark), Riwayat (?tab=history)
├── detail.html         # Detail komik (?slug=)
├── reader.html         # Pembaca chapter (?manga=&chapter=nomor  atau  ?chapter=chapter-slug)
├── assets/
│   ├── css/style.css   # Satu stylesheet bersama (tema gelap, mobile-first)
│   ├── img/favicon.svg
│   └── js/
│       ├── api.js      # SATU-SATUNYA tempat pemanggilan API (API_BASE)
│       ├── common.js   # Header/footer, kartu, state loading/kosong/error, bookmark & riwayat (localStorage)
│       ├── home.js     # Logika beranda
│       ├── browse.js   # Logika katalog / pencarian / bookmark / riwayat
│       ├── detail.js   # Logika detail komik + daftar chapter
│       └── reader.js   # Logika reader
└── docs/, logs/        # Catatan & log tugas (bukan bagian situs)
```

## Halaman

| Halaman | URL | Isi |
|---|---|---|
| Beranda | `index.html` | Header (logo, pencarian, nav Beranda/Katalog/Bookmark), hero dari 5 komik terbaru, "Lanjutkan Membaca" (riwayat), grid "Terbaru" 12 per halaman + tombol **Muat Lebih**, "Bookmark Saya" |
| Katalog | `browse.html?page=2` | Grid semua komik dari `/api/latest` dengan pagination bernomor |
| Pencarian | `browse.html?q=solo` | Hasil `/api/search`, jumlah hasil, state "tidak ditemukan" |
| Bookmark | `browse.html?tab=bookmark` | Semua bookmark (localStorage) |
| Riwayat | `browse.html?tab=history` | Riwayat baca + tombol hapus |
| Detail | `detail.html?slug=solo-leveling` | Cover, judul, tipe, status, rating, views, genre, sinopsis, Baca Chapter 1 / Lanjutkan, bookmark, daftar chapter (terbaru dulu + toggle urutan + filter nomor) |
| Reader | `reader.html?manga=solo-leveling&chapter=1` atau `reader.html?chapter=solo-leveling-chapter-1-bahasa-indonesia` | Gambar vertikal, loading & retry per gambar, prev/next (tombol + panah ← →), pilih chapter, kembali ke detail, progres disimpan otomatis |

## API

Base URL ada di **satu tempat**: `assets/js/api.js`

```js
const API_BASE = 'https://bacakomix-api-zipudenguga-8459.vercel.app';
```

Fungsi yang tersedia di `window.BacakomixAPI`:

| Fungsi | Endpoint |
|---|---|
| `getLatest(page, limit)` | `GET /api/latest?page=&limit=` |
| `searchComics(q, page)` | `GET /api/search?q=&page=` |
| `getDetail(slug)` | `GET /api/manga/{slug}` |
| `getChapters(slugOrId)` | `GET /api/manga-chapters/{slug-atau-id}` |
| `getChapterImages(chapterSlug)` | `GET /api/chapter/{chapter-slug}` |
| `readChapter(manga, nomor)` | `GET /api/read?manga=&chapter=` (cadangan bila daftar chapter gagal) |
| `proxyImage(url)` | `/api/image-proxy?url=` + `encodeURIComponent(url)` |

Semua respons yang `success !== true` (atau jaringan gagal / timeout 20 detik)
dilempar sebagai `ApiError` dengan `kind`:
`upstream` (mis. HTTP 502 dari sumber), `notfound`, `network`, `timeout`,
`invalid`, `api`. Setiap halaman menampilkan pesan yang sesuai beserta tombol
**Coba Lagi** — tidak ada halaman kosong atau spinner tanpa akhir.

Semua cover dan halaman chapter dimuat lewat `image-proxy`, dengan
`loading="lazy"`, `alt` deskriptif, dan fallback (placeholder untuk cover,
tombol "Muat Ulang" untuk halaman chapter).

## Data lokal (tanpa login)

Disimpan di `localStorage` perangkat:

- `bacakomix:bookmarks` — daftar komik yang dibookmark.
- `bacakomix:history` — per komik: chapter terakhir dibaca (nomor/slug/judul),
  daftar chapter yang sudah dibaca, waktu baca.
- `bacakomix:chapterSort` — preferensi urutan daftar chapter.

## Menjalankan secara lokal

Butuh server statis apa saja (jangan buka via `file://`, beberapa browser
membatasi `fetch` dari file lokal):

```bash
cd bacakomix
python3 -m http.server 8000
# buka http://localhost:8000/
```

Alternatif: `npx serve .`, `php -S localhost:8000`, dsb.

## Deploy statis

Tidak ada build step — upload isi folder apa adanya.

- **Vercel**: `vercel deploy` dari folder ini (framework preset: *Other*,
  build command kosong, output directory `.`).
- **Wasmer / Netlify / GitHub Pages / Cloudflare Pages**: arahkan ke root
  folder ini sebagai direktori publik, tanpa perintah build.

Folder `docs/`, `logs/`, dan `run-opus-frontend.py` bukan bagian situs dan
boleh dikecualikan saat deploy.

## Status upstream (catatan penting)

Backend sumber KomikNesia (`api-be.komiknesia.my.id`) sedang **502 Bad
Gateway** (per November 2026). Tapi API Bacakomix v1.1.0 sudah punya
**fallback otomatis ke Komiku** (`komiku.org`): kalau KomikNesia mati,
endpoint tetap mengembalikan data asli dari Komiku (field `source` di
respons: `"komiknesia"` atau `"komiku-fallback"`). Jadi situs ini sudah
bisa dipakai penuh — bukan cuma menampilkan state error. Kalau KomikNesia
hidup lagi, API otomatis balik ke sana tanpa perubahan di frontend.

## Laporan pengujian

Diverifikasi Muse (orchestrator) setelah Opus kehabisan kuota di tengah
pengujian (kuota Antigravity Opus habis, reset ~4 jam 49 menit setelah
14:09 WITA 7 Nov 2026):

- Server statis lokal: `index.html`, `browse.html`, `detail.html`,
  `reader.html`, `style.css`, semua file JS, dan `favicon.svg` — semua
  HTTP 200.
- Semua file JS lolos `node --check`; tidak ada data komik hardcode/mock
  di dalam situs; semua pemanggilan API hanya lewat `API_BASE` di
  `assets/js/api.js`.
- Live API (fallback Komiku): latest 10 judul, search "Solo Leveling"
  ketemu, detail One Piece, 1217 chapter, reader ch. 1198 = 16 gambar,
  image-proxy 200.
- Yang belum dites end-to-end di browser: klik antar halaman dengan data
  live (Opus sempat mengujinya dengan data contoh via intersepsi request,
  tapi log pengujiannya terpotong saat kuota habis).
