/*
 * Bacakomix — utilitas bersama (header, kartu, state, localStorage).
 * Tidak memanggil API secara langsung; semua fetch lewat BacakomixAPI (api.js).
 */
(function (global) {
  'use strict';

  const API = global.BacakomixAPI;
  const KEY_BOOKMARKS = 'bacakomix:bookmarks';
  const KEY_HISTORY = 'bacakomix:history';

  /* ---------------- Helper umum ---------------- */

  function $(selector, root) { return (root || document).querySelector(selector); }

  function esc(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function param(name) {
    return new URLSearchParams(global.location.search).get(name);
  }

  function intParam(name, fallback) {
    const n = parseInt(param(name), 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  function hasNumber(value) {
    return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  }

  function formatNumber(value) {
    if (!hasNumber(value)) return '-';
    const n = Number(value);
    if (!Number.isFinite(n)) return '-';
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',') + ' jt';
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace('.', ',') + ' rb';
    return String(n);
  }

  function formatRating(value) {
    if (!hasNumber(value)) return '-';
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n.toFixed(1).replace('.', ',') : '-';
  }

  function formatDate(value) {
    if (!value) return '';
    let d;
    const m = String(value).match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/); // dd/mm/yyyy
    if (m) d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    else d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function timeAgo(ts) {
    const diff = (Date.now() - ts) / 1000;
    if (diff < 60) return 'baru saja';
    if (diff < 3600) return Math.floor(diff / 60) + ' menit lalu';
    if (diff < 86400) return Math.floor(diff / 3600) + ' jam lalu';
    if (diff < 2592000) return Math.floor(diff / 86400) + ' hari lalu';
    return formatDate(ts);
  }

  const TYPE_LABELS = { manga: 'Manga', manhwa: 'Manhwa', manhua: 'Manhua' };
  function typeLabel(type) {
    const t = String(type || '').toLowerCase();
    return TYPE_LABELS[t] || (type ? String(type) : '');
  }

  function statusLabel(status) {
    const s = String(status || '').toLowerCase();
    if (/complete|tamat|end/.test(s)) return 'Tamat';
    if (/ongoing|berjalan/.test(s)) return 'Berjalan';
    if (/hiatus/.test(s)) return 'Hiatus';
    return status ? String(status) : '';
  }

  function normalizeGenres(genres) {
    if (!Array.isArray(genres)) return [];
    return genres.map(function (g) {
      if (typeof g === 'string') return g;
      if (g && typeof g === 'object') return g.name || g.title || g.genre || '';
      return '';
    }).filter(Boolean);
  }

  /** Bentuk data komik yang seragam, apa pun variasi field dari API. */
  function normalizeComic(raw) {
    const c = raw || {};
    return {
      id: c.id,
      slug: c.slug || '',
      title: c.title || c.name || 'Tanpa judul',
      alternativeName: c.alternativeName || c.alternative || '',
      author: c.author || '',
      type: c.type || '',
      status: c.status || '',
      rating: c.rating,
      views: c.views,
      cover: c.cover || c.thumbnail || c.image || '',
      synopsis: c.synopsis || c.description || '',
      genres: normalizeGenres(c.genres),
      lastChapter: c.lastChapter || c.latestChapter || '',
    };
  }

  /** Ambil nomor chapter dari objek chapter / judul. */
  function chapterNumberOf(ch) {
    if (!ch) return NaN;
    const n = Number(ch.chapterNumber !== undefined ? ch.chapterNumber : ch.number);
    if (Number.isFinite(n)) return n;
    const m = String(ch.title || ch.slug || '').match(/chapter[\s-]*(\d+(?:[.,]\d+)?)/i);
    return m ? Number(m[1].replace(',', '.')) : NaN;
  }

  /** Coba tebak slug komik dari slug chapter, mis. "solo-leveling-chapter-1-bahasa-indonesia". */
  function mangaSlugFromChapterSlug(chapterSlug) {
    const m = String(chapterSlug || '').match(/^(.+?)-chapter-\d+/i);
    return m ? m[1] : '';
  }

  function detailUrl(slug) { return 'detail.html?slug=' + encodeURIComponent(slug); }

  /** chapter boleh berupa nomor (angka) atau slug chapter. */
  function readerUrl(mangaSlug, chapter) {
    const p = new URLSearchParams();
    if (mangaSlug) p.set('manga', mangaSlug);
    if (chapter !== undefined && chapter !== null && chapter !== '') p.set('chapter', String(chapter));
    return 'reader.html?' + p.toString();
  }

  /** Link reader untuk satu objek chapter dari API. */
  function chapterLink(mangaSlug, ch) {
    const n = chapterNumberOf(ch);
    if (mangaSlug && Number.isFinite(n)) return readerUrl(mangaSlug, n);
    return readerUrl(mangaSlug, ch.slug || n);
  }

  /* ---------------- localStorage ---------------- */

  function readJSON(key, fallback) {
    try {
      const raw = global.localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try { global.localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }

  const Bookmarks = {
    all: function () {
      const list = readJSON(KEY_BOOKMARKS, []);
      return Array.isArray(list) ? list.filter(function (b) { return b && b.slug; }) : [];
    },
    has: function (slug) { return Bookmarks.all().some(function (b) { return b.slug === slug; }); },
    add: function (comic) {
      if (!comic || !comic.slug) return;
      const list = Bookmarks.all();
      const idx = list.findIndex(function (b) { return b.slug === comic.slug; });
      const entry = {
        slug: comic.slug, title: comic.title, cover: comic.cover, type: comic.type,
        status: comic.status, rating: comic.rating,
        addedAt: idx !== -1 ? list[idx].addedAt : Date.now(),
      };
      if (idx !== -1) list[idx] = entry; else list.unshift(entry);
      writeJSON(KEY_BOOKMARKS, list);
      emitChange();
    },
    remove: function (slug) {
      writeJSON(KEY_BOOKMARKS, Bookmarks.all().filter(function (b) { return b.slug !== slug; }));
      emitChange();
    },
    toggle: function (comic) {
      if (Bookmarks.has(comic.slug)) { Bookmarks.remove(comic.slug); return false; }
      Bookmarks.add(comic); return true;
    },
  };

  const History = {
    map: function () {
      const m = readJSON(KEY_HISTORY, {});
      return m && typeof m === 'object' && !Array.isArray(m) ? m : {};
    },
    all: function () {
      const m = History.map();
      return Object.keys(m).map(function (k) { return m[k]; })
        .filter(function (h) { return h && h.slug; })
        .sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    },
    get: function (slug) { return History.map()[slug] || null; },
    save: function (entry) {
      if (!entry || !entry.slug) return;
      const m = History.map();
      const prev = m[entry.slug] || {};
      m[entry.slug] = Object.assign({}, prev, entry, { updatedAt: Date.now() });
      writeJSON(KEY_HISTORY, m);
    },
    remove: function (slug) {
      const m = History.map();
      delete m[slug];
      writeJSON(KEY_HISTORY, m);
      emitChange();
    },
  };

  function emitChange() {
    document.dispatchEvent(new CustomEvent('bacakomix:storage'));
  }

  /* ---------------- Ikon (SVG inline) ---------------- */

  const ICONS = {
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    bookmark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
    eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
    up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>',
    list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    sort: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/></svg>',
    cloud: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1 0 8z"/><path d="m4 4 16 16"/></svg>',
    empty: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h5"/></svg>',
    book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/></svg>',
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/></svg>',
    grid: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  };

  /* ---------------- Header & footer ---------------- */

  function renderHeader(active) {
    const host = document.getElementById('site-header');
    if (!host) return;
    const q = param('q') || '';
    const nav = [
      { id: 'home', href: 'index.html', label: 'Beranda', icon: ICONS.home },
      { id: 'browse', href: 'browse.html', label: 'Katalog', icon: ICONS.grid },
      { id: 'bookmark', href: 'browse.html?tab=bookmark', label: 'Bookmark', icon: ICONS.bookmark },
    ];
    host.className = 'site-header';
    host.innerHTML =
      '<div class="container header-inner">' +
        '<a class="logo" href="index.html" aria-label="Bacakomix — Beranda">' +
          '<img class="logo-img" src="assets/img/logo.svg" alt="" width="36" height="36">' +
          '<span class="logo-text">baca<b>komix</b></span>' +
        '</a>' +
        '<form class="search-form" role="search" action="browse.html" method="get">' +
          '<label class="sr-only" for="search-input">Cari komik</label>' +
          '<input id="search-input" name="q" type="search" placeholder="Cari judul komik…" ' +
            'autocomplete="off" enterkeyhint="search" value="' + esc(q) + '">' +
          '<button type="submit" aria-label="Cari">' + ICONS.search + '</button>' +
        '</form>' +
        '<nav class="main-nav" aria-label="Navigasi utama">' +
          nav.map(function (n) {
            return '<a href="' + n.href + '"' + (n.id === active ? ' class="active" aria-current="page"' : '') + '>' +
              n.icon + '<span>' + n.label + '</span></a>';
          }).join('') +
        '</nav>' +
      '</div>';

    const form = host.querySelector('.search-form');
    form.addEventListener('submit', function (e) {
      const value = form.q.value.trim();
      if (!value) { e.preventDefault(); form.q.focus(); }
    });
  }

  function renderFooter() {
    const host = document.getElementById('site-footer');
    if (!host) return;
    host.className = 'site-footer';
    host.innerHTML =
      '<div class="container footer-inner">' +
        '<div class="footer-grid">' +
          '<div class="footer-brand">' +
            '<a class="logo" href="index.html" aria-label="Bacakomix — Beranda">' +
              '<img class="logo-img" src="assets/img/logo.svg" alt="" width="36" height="36">' +
              '<span class="logo-text">baca<b>komix</b></span>' +
            '</a>' +
            '<p>Baca komik manga, manhwa, dan manhua bahasa Indonesia — update terbaru, bookmark, dan riwayat baca tersimpan di perangkatmu.</p>' +
          '</div>' +
          '<div class="footer-col"><h3>Navigasi</h3><ul>' +
            '<li><a href="index.html">Beranda</a></li>' +
            '<li><a href="browse.html">Katalog Komik</a></li>' +
            '<li><a href="browse.html?tab=bookmark">Bookmark Saya</a></li>' +
            '<li><a href="browse.html?tab=history">Riwayat Baca</a></li>' +
          '</ul></div>' +
          '<div class="footer-col"><h3>Tentang</h3><ul>' +
            '<li>Semua judul dan gambar berasal dari sumber pihak ketiga.</li>' +
            '<li>Bacakomix tidak menyimpan file komik di server sendiri.</li>' +
            '<li>Hubungi pemilik hak cipta terkait jika ada konten yang perlu diturunkan.</li>' +
          '</ul></div>' +
        '</div>' +
        '<div class="footer-bottom">' +
          '<span>&copy; ' + new Date().getFullYear() + ' Bacakomix</span>' +
          '<span>Dibaca dengan ♥ — manga, manhwa &amp; manhua</span>' +
        '</div>' +
      '</div>';
  }

  /* ---------------- Gambar ---------------- */

  const PLACEHOLDER = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420"><rect width="300" height="420" fill="#1b1d27"/>' +
    '<g fill="none" stroke="#3a3e52" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="95" y="150" width="110" height="90" rx="10"/><path d="m105 230 30-30 25 22 15-12 25 20"/></g>' +
    '<text x="150" y="285" fill="#5b6079" font-family="sans-serif" font-size="20" text-anchor="middle">Gambar tidak tersedia</text></svg>'
  );

  /** Fallback global untuk <img data-fallback> yang gagal dimuat. */
  document.addEventListener('error', function (e) {
    const img = e.target;
    if (!img || img.tagName !== 'IMG' || !img.hasAttribute('data-fallback')) return;
    if (img.dataset.failed) return;
    img.dataset.failed = '1';
    img.src = PLACEHOLDER;
    img.classList.add('img-failed');
  }, true);

  function coverImg(comic, cls, eager) {
    const src = API.proxyImage(comic.cover) || PLACEHOLDER;
    return '<img class="' + (cls || '') + '" src="' + esc(src) + '" alt="Cover ' + esc(comic.title) + '"' +
      (eager ? ' fetchpriority="high"' : ' loading="lazy"') + ' decoding="async" data-fallback>';
  }

  /* ---------------- Kartu komik ---------------- */

  function cardHTML(raw) {
    const c = normalizeComic(raw);
    const marked = Bookmarks.has(c.slug);
    const type = typeLabel(c.type);
    const status = statusLabel(c.status);
    return '<article class="card">' +
      '<a class="card-link" href="' + detailUrl(c.slug) + '">' +
        '<div class="card-cover">' + coverImg(c) +
          (type ? '<span class="badge badge-type type-' + esc(String(c.type).toLowerCase()) + '">' + esc(type) + '</span>' : '') +
          (status ? '<span class="badge badge-status">' + esc(status) + '</span>' : '') +
        '</div>' +
        '<div class="card-body">' +
          '<h3 class="card-title">' + esc(c.title) + '</h3>' +
          '<div class="card-meta">' +
            (hasNumber(c.rating) ? '<span class="rating">' + ICONS.star + formatRating(c.rating) + '</span>' : '') +
            (hasNumber(c.views) ? '<span>' + ICONS.eye + formatNumber(c.views) + '</span>' : '') +
            (!hasNumber(c.rating) && !hasNumber(c.views) && c.genres.length ? '<span>' + esc(c.genres[0]) + '</span>' : '') +
          '</div>' +
        '</div>' +
      '</a>' +
      bookmarkButton(c, marked, 'card-bookmark') +
    '</article>';
  }

  function bookmarkButton(c, marked, cls, withLabel) {
    const label = marked ? 'Hapus dari bookmark' : 'Tambah ke bookmark';
    return '<button type="button" class="bookmark-btn ' + (cls || '') + (marked ? ' is-active' : '') + '"' +
      ' data-bookmark="' + esc(JSON.stringify({
        slug: c.slug, title: c.title, cover: c.cover, type: c.type, status: c.status, rating: c.rating,
      })) + '" aria-pressed="' + marked + '" aria-label="' + label + '" title="' + label + '">' +
      ICONS.bookmark + (withLabel ? '<span>' + (marked ? 'Tersimpan' : 'Bookmark') + '</span>' : '') +
    '</button>';
  }

  function refreshBookmarkButtons() {
    document.querySelectorAll('[data-bookmark]').forEach(function (btn) {
      let data;
      try { data = JSON.parse(btn.getAttribute('data-bookmark')); } catch (e) { return; }
      const marked = Bookmarks.has(data.slug);
      const label = marked ? 'Hapus dari bookmark' : 'Tambah ke bookmark';
      btn.classList.toggle('is-active', marked);
      btn.setAttribute('aria-pressed', String(marked));
      btn.setAttribute('aria-label', label);
      btn.title = label;
      const span = btn.querySelector('span');
      if (span) span.textContent = marked ? 'Tersimpan' : 'Bookmark';
    });
  }

  document.addEventListener('click', function (e) {
    const btn = e.target.closest && e.target.closest('[data-bookmark]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    let data;
    try { data = JSON.parse(btn.getAttribute('data-bookmark')); } catch (err) { return; }
    const added = Bookmarks.toggle(data);
    toast(added ? '“' + data.title + '” ditambahkan ke bookmark' : '“' + data.title + '” dihapus dari bookmark');
  });

  document.addEventListener('bacakomix:storage', refreshBookmarkButtons);
  global.addEventListener('storage', function (e) {
    if (e.key === KEY_BOOKMARKS || e.key === KEY_HISTORY) emitChange();
  });

  /* ---------------- Toast ---------------- */

  let toastTimer = null;
  function toast(message) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2400);
  }

  /* ---------------- State: loading / kosong / error ---------------- */

  function skeletonGrid(count) {
    let html = '';
    for (let i = 0; i < (count || 12); i++) {
      html += '<div class="card skeleton-card" aria-hidden="true"><div class="card-cover skeleton"></div>' +
        '<div class="card-body"><div class="skeleton line"></div><div class="skeleton line short"></div></div></div>';
    }
    return html;
  }

  function errorInfo(err) {
    const kind = (err && err.kind) || 'api';
    switch (kind) {
      case 'upstream':
        return { title: 'Sumber komik lagi down', message: 'Server sumber komik sedang bermasalah. Coba lagi nanti, ya.' };
      case 'network':
        return { title: 'Tidak bisa terhubung', message: 'Periksa koneksi internetmu, lalu coba lagi.' };
      case 'timeout':
        return { title: 'Server terlalu lama merespons', message: 'Sepertinya server sedang sibuk. Coba lagi sebentar lagi.' };
      case 'empty':
        return { title: 'Belum ada data', message: 'Sumber komik tidak mengembalikan data untuk permintaan ini.' };
      case 'notfound':
        return { title: 'Tidak ditemukan', message: 'Data yang kamu cari tidak ada atau sudah dihapus.' };
      default:
        return { title: 'Terjadi kesalahan', message: 'Gagal memuat data dari server. Coba lagi nanti.' };
    }
  }

  /**
   * Render state ke dalam container.
   * opts: {type:'error'|'empty'|'info', title, message, error, onRetry, action:{href,label}}
   */
  function renderState(container, opts) {
    if (!container) return;
    const o = opts || {};
    const info = o.error ? errorInfo(o.error) : {};
    const title = o.title || info.title || '';
    const message = o.message || info.message || '';
    const icon = o.type === 'error' ? ICONS.cloud : (o.type === 'empty' ? ICONS.empty : ICONS.book);
    const detail = o.error && o.error.message && o.error.kind !== 'notfound'
      ? '<p class="state-detail">Detail: ' + esc(o.error.message) + '</p>' : '';
    container.innerHTML =
      '<div class="state state-' + esc(o.type || 'info') + '" role="' + (o.type === 'error' ? 'alert' : 'status') + '">' +
        '<div class="state-icon">' + icon + '</div>' +
        '<h3>' + esc(title) + '</h3>' +
        (message ? '<p>' + esc(message) + '</p>' : '') + detail +
        '<div class="state-actions">' +
          (o.onRetry ? '<button type="button" class="btn btn-primary" data-retry>Coba Lagi</button>' : '') +
          (o.action ? '<a class="btn btn-ghost" href="' + esc(o.action.href) + '">' + esc(o.action.label) + '</a>' : '') +
        '</div>' +
      '</div>';
    if (o.onRetry) {
      container.querySelector('[data-retry]').addEventListener('click', o.onRetry, { once: true });
    }
  }

  /* ---------------- Pagination ---------------- */

  /** Render pagination bernomor. hrefFor(page) -> string URL. */
  function paginationHTML(current, total, hrefFor) {
    if (!total || total <= 1) return '';
    const pages = [];
    const add = function (p) { if (pages.indexOf(p) === -1 && p >= 1 && p <= total) pages.push(p); };
    add(1); add(current - 1); add(current); add(current + 1); add(total);
    pages.sort(function (a, b) { return a - b; });
    let html = '<nav class="pagination" aria-label="Halaman">';
    html += current > 1
      ? '<a class="page-btn" href="' + hrefFor(current - 1) + '" aria-label="Halaman sebelumnya">' + ICONS.left + '</a>'
      : '<span class="page-btn disabled" aria-hidden="true">' + ICONS.left + '</span>';
    let last = 0;
    pages.forEach(function (p) {
      if (p - last > 1) html += '<span class="page-gap">…</span>';
      html += p === current
        ? '<span class="page-btn current" aria-current="page">' + p + '</span>'
        : '<a class="page-btn" href="' + hrefFor(p) + '">' + p + '</a>';
      last = p;
    });
    html += current < total
      ? '<a class="page-btn" href="' + hrefFor(current + 1) + '" aria-label="Halaman berikutnya">' + ICONS.right + '</a>'
      : '<span class="page-btn disabled" aria-hidden="true">' + ICONS.right + '</span>';
    return html + '</nav>';
  }

  global.Bacakomix = {
    $: $, esc: esc, param: param, intParam: intParam,
    hasNumber: hasNumber, formatNumber: formatNumber, formatRating: formatRating, formatDate: formatDate, timeAgo: timeAgo,
    typeLabel: typeLabel, statusLabel: statusLabel, normalizeComic: normalizeComic,
    chapterNumberOf: chapterNumberOf, mangaSlugFromChapterSlug: mangaSlugFromChapterSlug,
    detailUrl: detailUrl, readerUrl: readerUrl, chapterLink: chapterLink,
    Bookmarks: Bookmarks, History: History, ICONS: ICONS, PLACEHOLDER: PLACEHOLDER,
    renderHeader: renderHeader, renderFooter: renderFooter,
    coverImg: coverImg, cardHTML: cardHTML, bookmarkButton: bookmarkButton,
    skeletonGrid: skeletonGrid, renderState: renderState, errorInfo: errorInfo,
    paginationHTML: paginationHTML, toast: toast,
  };
})(window);
