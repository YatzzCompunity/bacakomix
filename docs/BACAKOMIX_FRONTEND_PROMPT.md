# BACAKOMIX — Frontend (Fase 1: bangun situs lengkap)

Kamu adalah implementation agent untuk website baca komik **Bacakomix**.
Kerjakan di working directory ini (`/home/hatch/workspace/bacakomix`) dan
hanya di sini. JANGAN sentuh folder lain, JANGAN deploy ke mana pun —
deployment dilakukan terpisah setelah hasilmu diverifikasi.

## Stack

- Static site murni: HTML + CSS + JavaScript vanilla, TANPA build step,
  TANPA npm dependency, TANPA framework. Harus bisa jalan dengan server
  statis biasa (`python3 -m http.server` / Vercel static / Wasmer static).
- Satu file CSS bersama (`assets/css/style.css`) dan satu file JS API
  bersama (`assets/js/api.js` + `assets/js/common.js` bila perlu).
- Bahasa UI: Indonesia. Mobile-first, responsif, tema gelap yang rapi.
- Desain ORIGINAL untuk Bacakomix (logo teks, jangan meniru tampilan
  KomikNesia / Komiku / situs komik lain).

## API (sudah live, jangan diubah)

Base URL — pakai konstanta ini di `assets/js/api.js`, jangan hardcode
di tiap halaman:

```
const API_BASE = 'https://bacakomix-api-zipudenguga-8459.vercel.app';
```

Docs live: `https://bacakomix-api-zipudenguga-8459.vercel.app/` dan
`https://bacakomix-api-zipudenguga-8459.vercel.app/api/`

Semua respons JSON berbentuk `{success, ...}` dan mendukung CORS `*`.

| Endpoint | Contoh |
|---|---|
| `GET /api/latest?page=1&limit=12` | komik terbaru |
| `GET /api/search?q=Solo%20Leveling&page=1` | cari komik |
| `GET /api/manga/{slug}` | detail komik |
| `GET /api/manga-chapters/{slug-atau-id}` | daftar chapter |
| `GET /api/chapter/{chapter-slug}` | gambar halaman chapter |
| `GET /api/read?manga={slug}&chapter=1` | gambar chapter by nomor |
| `GET /api/image-proxy?url={image-url}` | proxy gambar cover/halaman |

Bentuk respons (contoh nyata dari bentuknya):

```json
// GET /api/latest
{"success": true, "page": 1, "totalPages": 10, "totalCount": 120,
 "results": [{"id": 1, "title": "Solo Leveling", "slug": "solo-leveling",
   "type": "manhwa", "status": "completed", "rating": 9.8, "views": 123456,
   "cover": "https://...", "synopsis": "...", "genres": ["Action", "Fantasy"]}]}

// GET /api/search?q=Solo%20Leveling
{"success": true, "source": "search_api", "total": 1, "results": [/* sama seperti di atas */]}

// GET /api/manga/solo-leveling
{"success": true, "manga": {"id": 1, "title": "Solo Leveling",
  "alternativeName": "...", "slug": "solo-leveling", "author": "...",
  "type": "manhwa", "status": "completed", "rating": 9.8, "views": 123456,
  "cover": "https://...", "synopsis": "...", "genres": ["Action"],
  "lastChapter": "Chapter 179"}}

// GET /api/manga-chapters/solo-leveling
{"success": true, "mangaId": 1, "totalChapters": 179,
 "chapters": [{"id": 10, "title": "Chapter 1", "chapterNumber": 1,
   "slug": "solo-leveling-chapter-1-bahasa-indonesia", "imageCount": 42,
   "views": 1000, "createdAt": "2024-01-01"}]}

// GET /api/chapter/solo-leveling-chapter-1-bahasa-indonesia
{"success": true, "chapterSlug": "solo-leveling-chapter-1-bahasa-indonesia",
 "chapterNumber": 1, "totalImages": 42,
 "images": [{"page": 1, "url": "https://..."}, {"page": 2, "url": "https://..."}]}
```

**PENTING — status upstream saat ini:** backend sumber KomikNesia
(`api-be.komiknesia.my.id`) sedang **502 Bad Gateway**, jadi endpoint data
(`latest`, `search`, `manga`, dst.) saat ini mengembalikan
`{"success": false, "error": "Komiknesia API error: HTTP 502"}`.
Itu BUKAN bug di API Bacakomix dan BUKAN bug di frontendmu.
Bangun frontend supaya:

1. Saat upstream mati, halaman menampilkan state error yang jelas dan
   manusiawi ("Sumber komik lagi down, coba lagi nanti" + tombol Coba Lagi),
   BUKAN halaman kosong / crash / spinner selamanya.
2. Saat upstream hidup, semua halaman menampilkan data asli dari API.
3. Untuk menguji tampilanmu sendiri selagi upstream mati, kamu BOLEH
   memakai data contoh (mock) — tapi mock HANYA untuk pengujian lokalmu,
   jangan pernah menampilkannya sebagai data asli di situs, dan jangan
   commit data contoh itu sebagai isi situs. Hapus / nonaktifkan mock
   sebelum selesai; situs produksi harus 100% dari API di atas.

Gambar cover dan halaman chapter WAJIB lewat image-proxy:
`/api/image-proxy?url=` + `encodeURIComponent(urlAsli)`. Beri `loading="lazy"`,
`alt` yang benar, dan fallback bila gambar gagal load.

## Halaman yang harus dibuat

1. **`index.html` (Beranda)** — header (logo Bacakomix + search box +
   nav: Beranda / Katalog / Bookmark), hero/featured dari komik terbaru,
   grid "Terbaru" (12 per halaman + pagination / tombol Muat Lebih),
   section "Bookmark Saya" (dari localStorage, bila ada).
2. **`browse.html` (Katalog)** — grid semua komik dari `/api/latest`
   dengan pagination halaman (`?page=`), search box yang sama.
3. **`detail.html?slug={slug}`** — cover besar, judul, tipe
   (manga/manhwa/manhua), status, rating, views, genre chips, sinopsis,
   tombol "Baca Chapter 1" + "Lanjutkan" (chapter terakhir dibaca dari
   localStorage bila ada), daftar chapter (urut terbaru dulu + toggle
   urutan), klik chapter → reader.
4. **`reader.html?manga={slug}&chapter={nomor}`** (dan dukung juga
   `?chapter={chapter-slug}`) — gambar halaman vertikal berurutan,
   judul chapter, tombol Chapter Sebelumnya / Berikutnya, tombol kembali
   ke detail, simpan progres baca (manga + chapter) ke localStorage,
   loading per gambar, dan state error bila chapter gagal dimuat.
5. **Search** — dari header, ketik → `browse.html?q=...` memakai
   `/api/search`; tampilkan jumlah hasil + state "tidak ditemukan".
6. **`assets/js/api.js`** — semua fungsi fetch ke API di satu tempat
   (`getLatest`, `searchComics`, `getDetail`, `getChapters`,
   `getChapterImages`, `proxyImage`), dengan penanganan `success:false`
   yang konsisten.
7. **`README.md`** — cara jalanin lokal + cara deploy statis + daftar
   halaman + catatan status upstream 502 di atas.

Fitur pendukung (localStorage, tanpa login): Bookmark (tambah/hapus dari
kartu & detail, halaman bookmark di beranda/katalog), Riwayat Baca
(manga + chapter terakhir, "Lanjutkan Membaca").

## Kriteria selesai (acceptance)

- [ ] Semua 4 halaman ada dan saling terhubung (navigasi + link kartu/detail/reader jalan).
- [ ] Semua pemanggilan API hanya lewat `API_BASE` di `assets/js/api.js`.
- [ ] Tidak ada data komik hardcode yang tampil sebagai konten situs.
- [ ] State loading, kosong, dan error (termasuk upstream 502) tertangani
      di tiap halaman — tidak ada halaman blank.
- [ ] Responsif di layar HP (cek lebar ~390px) dan desktop.
- [ ] Tidak ada error JS di console saat halaman dibuka (dengan upstream
      mati, error yang muncul hanyalah state error API yang ditangani).
- [ ] Uji lokal dengan server statis dan laporkan hasil pengujianmu
      (halaman apa saja yang dicek, apa yang jalan, apa yang belum bisa
      dites karena upstream 502).
- [ ] `README.md` lengkap.

Kerjakan sampai kriteria di atas terpenuhi. Kalau ada yang tidak bisa
kamu verifikasi karena upstream mati, tulis dengan jujur apa yang belum
terverifikasi — jangan klaim sudah dites live padahal belum.
