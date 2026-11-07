/* Bacakomix — Katalog, Pencarian, Bookmark & Riwayat */
(function () {
  'use strict';

  const API = window.BacakomixAPI;
  const B = window.Bacakomix;
  const PER_PAGE = 24;

  const query = (B.param('q') || '').trim();
  const tab = query ? 'search' : (['bookmark', 'history'].indexOf(B.param('tab')) !== -1 ? B.param('tab') : 'all');
  const page = B.intParam('page', 1);

  B.renderHeader(tab === 'bookmark' ? 'bookmark' : 'browse');
  B.renderFooter();

  const titleEl = document.getElementById('page-title');
  const subEl = document.getElementById('page-subtitle');
  const tabsEl = document.getElementById('tabs');
  const gridEl = document.getElementById('grid');
  const pagEl = document.getElementById('pagination');

  function renderTabs() {
    const bm = B.Bookmarks.all().length;
    const hs = B.History.all().length;
    const tabs = [
      { id: 'all', href: 'browse.html', label: 'Semua Komik' },
      { id: 'bookmark', href: 'browse.html?tab=bookmark', label: 'Bookmark', count: bm },
      { id: 'history', href: 'browse.html?tab=history', label: 'Riwayat Baca', count: hs },
    ];
    if (tab === 'search') tabs.unshift({ id: 'search', href: location.href, label: 'Hasil Pencarian' });
    tabsEl.innerHTML = tabs.map(function (t) {
      return '<a class="tab' + (t.id === tab ? ' active' : '') + '" href="' + B.esc(t.href) + '"' +
        (t.id === tab ? ' aria-current="page"' : '') + '>' + B.esc(t.label) +
        (t.count ? '<span class="count">' + t.count + '</span>' : '') + '</a>';
    }).join('');
  }

  function pageHref(p) {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (p > 1) params.set('page', String(p));
    const s = params.toString();
    return 'browse.html' + (s ? '?' + s : '');
  }

  function scrollTopIfNeeded() {
    if (window.scrollY > 200) window.scrollTo({ top: 0 });
  }

  /* ---------- Semua komik ---------- */

  function loadAll() {
    document.title = (page > 1 ? 'Katalog — Halaman ' + page : 'Katalog') + ' — Bacakomix';
    titleEl.textContent = 'Katalog Komik';
    subEl.textContent = 'Semua komik, diurutkan dari yang terbaru diperbarui.';
    gridEl.innerHTML = B.skeletonGrid(12);
    pagEl.innerHTML = '';

    API.getLatest(page, PER_PAGE).then(function (data) {
      const results = Array.isArray(data.results) ? data.results : [];
      const total = Number(data.totalPages) || 1;
      if (data.totalCount) {
        subEl.textContent = Number(data.totalCount).toLocaleString('id-ID') + ' komik · halaman ' + page + ' dari ' + total;
      } else {
        subEl.textContent = 'Halaman ' + page + ' dari ' + total;
      }
      if (!results.length) {
        B.renderState(gridEl, {
          type: 'empty', title: 'Halaman ini kosong',
          message: page > 1 ? 'Tidak ada komik di halaman ' + page + '.' : 'Belum ada komik untuk ditampilkan.',
          action: page > 1 ? { href: 'browse.html', label: 'Ke halaman 1' } : null,
        });
        pagEl.innerHTML = B.paginationHTML(Math.min(page, total), total, pageHref);
        return;
      }
      gridEl.innerHTML = results.map(B.cardHTML).join('');
      pagEl.innerHTML = B.paginationHTML(page, total, pageHref);
    }).catch(function (err) {
      B.renderState(gridEl, { type: 'error', error: err, onRetry: loadAll });
    });
  }

  /* ---------- Pencarian ---------- */

  function loadSearch() {
    document.title = 'Cari “' + query + '” — Bacakomix';
    titleEl.textContent = 'Hasil pencarian “' + query + '”';
    subEl.textContent = 'Mencari…';
    gridEl.innerHTML = B.skeletonGrid(6);
    pagEl.innerHTML = '';

    API.searchComics(query, page).then(function (data) {
      const results = Array.isArray(data.results) ? data.results : [];
      const total = Number.isFinite(Number(data.total)) ? Number(data.total) : results.length;
      if (!results.length) {
        subEl.textContent = page > 1 ? 'Tidak ada hasil lagi di halaman ' + page + '.' : '0 komik ditemukan';
        B.renderState(gridEl, {
          type: 'empty', title: 'Komik tidak ditemukan',
          message: 'Tidak ada komik yang cocok dengan “' + query + '”. Coba kata kunci lain atau periksa ejaannya.',
          action: { href: 'browse.html', label: 'Jelajahi katalog' },
        });
        if (page > 1) pagEl.innerHTML = B.paginationHTML(page, page, pageHref);
        return;
      }
      subEl.textContent = total + ' komik ditemukan';
      gridEl.innerHTML = results.map(B.cardHTML).join('');

      let totalPages = Number(data.totalPages) || 0;
      if (!totalPages) {
        const shown = (page - 1) * results.length + results.length;
        totalPages = total > shown ? page + 1 : page;
      }
      pagEl.innerHTML = B.paginationHTML(page, totalPages, pageHref);
    }).catch(function (err) {
      subEl.textContent = 'Pencarian gagal';
      B.renderState(gridEl, { type: 'error', error: err, onRetry: loadSearch });
    });
  }

  /* ---------- Bookmark ---------- */

  function loadBookmarks() {
    document.title = 'Bookmark — Bacakomix';
    titleEl.textContent = 'Bookmark Saya';
    const list = B.Bookmarks.all();
    subEl.textContent = list.length
      ? list.length + ' komik tersimpan di perangkat ini.'
      : 'Komik yang kamu simpan akan muncul di sini.';
    pagEl.innerHTML = '';
    if (!list.length) {
      B.renderState(gridEl, {
        type: 'empty', title: 'Belum ada bookmark',
        message: 'Tekan ikon bookmark pada kartu atau halaman detail komik untuk menyimpannya.',
        action: { href: 'browse.html', label: 'Jelajahi katalog' },
      });
      return;
    }
    gridEl.innerHTML = list.map(B.cardHTML).join('');
  }

  /* ---------- Riwayat ---------- */

  function loadHistory() {
    document.title = 'Riwayat Baca — Bacakomix';
    titleEl.textContent = 'Riwayat Baca';
    const list = B.History.all();
    subEl.textContent = list.length
      ? 'Komik yang terakhir kamu baca di perangkat ini.'
      : 'Riwayat bacamu akan muncul di sini.';
    pagEl.innerHTML = '';
    if (!list.length) {
      B.renderState(gridEl, {
        type: 'empty', title: 'Belum ada riwayat',
        message: 'Mulai baca komik dan progresmu akan tersimpan otomatis.',
        action: { href: 'browse.html', label: 'Jelajahi katalog' },
      });
      return;
    }
    gridEl.innerHTML = list.map(function (h) {
      const c = B.normalizeComic(h);
      const label = h.chapterTitle || (h.chapterNumber !== undefined ? 'Chapter ' + h.chapterNumber : 'Lanjutkan');
      const href = B.readerUrl(h.slug, h.chapterNumber !== undefined && h.chapterNumber !== null ? h.chapterNumber : h.chapterSlug);
      return '<article class="card history-card">' +
        '<a class="card-link" href="' + href + '">' +
          '<div class="card-cover">' + B.coverImg(c) + '<span class="progress-chip">' + B.esc(label) + '</span></div>' +
          '<div class="card-body"><h3 class="card-title">' + B.esc(c.title) + '</h3>' +
          '<div class="card-sub">' + B.esc(B.timeAgo(h.updatedAt || Date.now())) + ' · <span class="muted">Lanjutkan</span></div></div>' +
        '</a>' +
        '<button type="button" class="remove-btn" data-remove-history="' + B.esc(h.slug) + '" aria-label="Hapus ' +
          B.esc(c.title) + ' dari riwayat" title="Hapus dari riwayat">' + B.ICONS.close + '</button>' +
      '</article>';
    }).join('');
  }

  document.addEventListener('click', function (e) {
    const btn = e.target.closest && e.target.closest('[data-remove-history]');
    if (!btn) return;
    e.preventDefault();
    B.History.remove(btn.getAttribute('data-remove-history'));
    B.toast('Dihapus dari riwayat baca');
  });

  document.addEventListener('bacakomix:storage', function () {
    renderTabs();
    if (tab === 'bookmark') loadBookmarks();
    if (tab === 'history') loadHistory();
  });

  renderTabs();
  scrollTopIfNeeded();
  if (tab === 'search') loadSearch();
  else if (tab === 'bookmark') loadBookmarks();
  else if (tab === 'history') loadHistory();
  else loadAll();
})();
