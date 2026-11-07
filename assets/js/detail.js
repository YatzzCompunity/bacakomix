/* Bacakomix — Detail komik */
(function () {
  'use strict';

  const API = window.BacakomixAPI;
  const B = window.Bacakomix;
  const SORT_KEY = 'bacakomix:chapterSort';

  B.renderHeader('');
  B.renderFooter();

  const slug = (B.param('slug') || '').trim();
  const detailEl = document.getElementById('detail');
  const bodyEl = document.getElementById('detail-body');
  const chaptersEl = document.getElementById('chapters');
  const toolsEl = document.getElementById('chapter-tools');
  const countEl = document.getElementById('chapter-count');
  const filterEl = document.getElementById('chapter-filter');
  const sortBtn = document.getElementById('sort-toggle');

  let comic = null;
  let chapters = [];
  let sortDesc = localStorageGet(SORT_KEY) !== 'asc';

  function localStorageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function localStorageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* abaikan */ }
  }

  function wrapState(opts) {
    detailEl.innerHTML = '<div class="container" style="padding-top:24px"><div id="detail-state"></div></div>';
    B.renderState(document.getElementById('detail-state'), opts);
  }

  if (!slug) {
    bodyEl.hidden = true;
    wrapState({
      type: 'empty', title: 'Komik tidak ditentukan',
      message: 'Tautan ini tidak menyertakan komik yang ingin dibuka.',
      action: { href: 'browse.html', label: 'Jelajahi katalog' },
    });
    return;
  }

  /* ---------- Info komik ---------- */

  function firstChapter() {
    if (!chapters.length) return null;
    return chapters.reduce(function (min, ch) {
      const a = B.chapterNumberOf(ch), b = B.chapterNumberOf(min);
      return Number.isFinite(a) && (!Number.isFinite(b) || a < b) ? ch : min;
    }, chapters[0]);
  }

  function actionsHTML() {
    const first = firstChapter();
    const firstHref = first ? B.chapterLink(slug, first) : B.readerUrl(slug, 1);
    const firstLabel = first && Number.isFinite(B.chapterNumberOf(first)) && B.chapterNumberOf(first) !== 1
      ? 'Baca Chapter ' + B.chapterNumberOf(first) : 'Baca Chapter 1';
    const hist = B.History.get(slug);
    let cont = '';
    if (hist) {
      const target = hist.chapterNumber !== undefined && hist.chapterNumber !== null ? hist.chapterNumber : hist.chapterSlug;
      const label = hist.chapterTitle || ('Chapter ' + target);
      cont = '<a class="btn btn-primary" href="' + B.readerUrl(slug, target) + '">' + B.ICONS.book + 'Lanjutkan ' + B.esc(label) + '</a>';
    }
    return (cont || '<a class="btn btn-primary" href="' + firstHref + '">' + B.ICONS.book + firstLabel + '</a>') +
      (cont ? '<a class="btn btn-ghost" href="' + firstHref + '">' + firstLabel + '</a>' : '') +
      B.bookmarkButton(comic, B.Bookmarks.has(slug), '', true);
  }

  function renderActions() {
    const el = document.getElementById('detail-actions');
    if (el) el.innerHTML = actionsHTML();
  }

  function renderDetail() {
    const c = comic;
    const cover = API.proxyImage(c.cover);
    const type = B.typeLabel(c.type);
    const status = B.statusLabel(c.status);
    document.title = c.title + ' — Bacakomix';
    const meta = document.createElement('meta');
    meta.name = 'description';
    meta.content = (c.synopsis || ('Baca ' + c.title + ' bahasa Indonesia di Bacakomix.')).slice(0, 160);
    document.head.appendChild(meta);

    detailEl.innerHTML =
      '<section class="detail-hero">' +
        '<div class="hero-bg"' + (cover ? ' style="background-image:url(\'' + B.esc(cover) + '\')"' : '') + '></div>' +
        '<div class="container detail-inner">' +
          '<div class="detail-cover">' + B.coverImg(c, '', true) + '</div>' +
          '<div class="detail-info">' +
            '<h1 class="detail-title">' + B.esc(c.title) + '</h1>' +
            (c.alternativeName ? '<p class="detail-alt">' + B.esc(c.alternativeName) + '</p>' : '') +
            '<dl class="detail-stats">' +
              '<div class="stat"><dt>Tipe</dt><dd>' + B.esc(type || '-') + '</dd></div>' +
              '<div class="stat"><dt>Status</dt><dd>' + B.esc(status || '-') + '</dd></div>' +
              (B.hasNumber(c.rating) ? '<div class="stat"><dt>Rating</dt><dd>' + B.ICONS.star + B.formatRating(c.rating) + '</dd></div>' : '') +
              (B.hasNumber(c.views) ? '<div class="stat"><dt>Dilihat</dt><dd>' + B.formatNumber(c.views) + '</dd></div>' : '') +
            '</dl>' +
            (c.genres.length
              ? '<div class="genres" aria-label="Genre">' + c.genres.map(function (g) {
                  return '<span class="chip">' + B.esc(g) + '</span>';
                }).join('') + '</div>'
              : '') +
            (c.author ? '<p class="detail-author">Pengarang: <b>' + B.esc(c.author) + '</b></p>' : '') +
            '<div class="detail-actions" id="detail-actions"></div>' +
            (c.lastChapter ? '<p class="continue-note">Terbaru: ' + B.esc(c.lastChapter) + '</p>' : '') +
          '</div>' +
        '</div>' +
      '</section>';
    renderActions();

    const syn = document.getElementById('synopsis');
    const synToggle = document.getElementById('synopsis-toggle');
    syn.textContent = c.synopsis || 'Sinopsis belum tersedia.';
    bodyEl.hidden = false;
    requestAnimationFrame(function () {
      synToggle.hidden = syn.scrollHeight <= syn.clientHeight + 2;
    });
    synToggle.onclick = function () {
      const clamped = syn.classList.toggle('clamped');
      synToggle.textContent = clamped ? 'Selengkapnya' : 'Ringkas';
    };
  }

  function loadDetail() {
    detailEl.innerHTML = '<div class="container"><div class="loading-block"><div class="spinner"></div><span>Memuat detail komik…</span></div></div>';
    bodyEl.hidden = true;
    return API.getDetail(slug).then(function (data) {
      if (!data.manga) throw new API.ApiError('Komik tidak ditemukan.', 'notfound', 404);
      comic = B.normalizeComic(data.manga);
      if (!comic.slug) comic.slug = slug;
      renderDetail();
      if (B.Bookmarks.has(slug)) B.Bookmarks.add(comic); // segarkan data bookmark (judul/cover terbaru)
      loadChapters();
    }).catch(function (err) {
      document.title = 'Gagal memuat — Bacakomix';
      wrapState({
        type: 'error', error: err,
        title: err.kind === 'notfound' ? 'Komik tidak ditemukan' : undefined,
        onRetry: err.kind === 'notfound' ? null : loadDetail,
        action: { href: 'index.html', label: 'Ke Beranda' },
      });
    });
  }

  /* ---------- Chapter ---------- */

  function sortedChapters() {
    const list = chapters.slice().sort(function (a, b) {
      const na = B.chapterNumberOf(a), nb = B.chapterNumberOf(b);
      if (!Number.isFinite(na) && !Number.isFinite(nb)) return 0;
      if (!Number.isFinite(na)) return 1;
      if (!Number.isFinite(nb)) return -1;
      return sortDesc ? nb - na : na - nb;
    });
    const q = filterEl.value.trim().toLowerCase();
    if (!q) return list;
    return list.filter(function (ch) {
      const n = B.chapterNumberOf(ch);
      return String(Number.isFinite(n) ? n : '').indexOf(q) !== -1 ||
        String(ch.title || '').toLowerCase().indexOf(q) !== -1;
    });
  }

  function renderSortBtn() {
    sortBtn.innerHTML = B.ICONS.sort + (sortDesc ? 'Terbaru dulu' : 'Terlama dulu');
    sortBtn.setAttribute('aria-label', 'Urutan: ' + (sortDesc ? 'terbaru dulu' : 'terlama dulu') + '. Klik untuk membalik.');
  }

  function renderChapters() {
    const hist = B.History.get(slug);
    const readSet = new Set(((hist && hist.read) || []).map(String));
    const currentKey = hist ? String(hist.chapterNumber !== undefined && hist.chapterNumber !== null ? hist.chapterNumber : hist.chapterSlug) : '';
    const list = sortedChapters();
    if (!list.length) {
      B.renderState(chaptersEl, { type: 'empty', title: 'Chapter tidak ditemukan', message: 'Tidak ada chapter yang cocok dengan pencarianmu.' });
      return;
    }
    chaptersEl.innerHTML = '<ul class="chapter-list">' + list.map(function (ch) {
      const n = B.chapterNumberOf(ch);
      const key = String(Number.isFinite(n) ? n : ch.slug);
      const isCurrent = key === currentKey;
      const title = ch.title || (Number.isFinite(n) ? 'Chapter ' + n : 'Chapter');
      return '<li class="chapter-item' + (readSet.has(key) ? ' is-read' : '') + (isCurrent ? ' is-current' : '') + '">' +
        '<a href="' + B.chapterLink(slug, ch) + '">' +
          '<span class="chapter-name">' + B.esc(title) + (isCurrent ? '<span class="chapter-tag">TERAKHIR DIBACA</span>' : '') + '</span>' +
          '<span class="chapter-date">' + B.esc(B.formatDate(ch.createdAt)) + '</span>' +
        '</a></li>';
    }).join('') + '</ul>';
  }

  function loadChapters() {
    chaptersEl.innerHTML = '<div class="loading-block"><div class="spinner"></div><span>Memuat daftar chapter…</span></div>';
    toolsEl.hidden = true;
    countEl.textContent = '';
    API.getChapters(slug).then(function (data) {
      chapters = (Array.isArray(data.chapters) ? data.chapters : []).filter(Boolean);
      const total = Number(data.totalChapters) || chapters.length;
      countEl.textContent = total + ' chapter';
      if (!chapters.length) {
        B.renderState(chaptersEl, { type: 'empty', title: 'Belum ada chapter', message: 'Komik ini belum memiliki chapter yang bisa dibaca.' });
        return;
      }
      toolsEl.hidden = chapters.length < 2;
      renderSortBtn();
      renderChapters();
      renderActions();
    }).catch(function (err) {
      B.renderState(chaptersEl, { type: 'error', error: err, title: 'Gagal memuat daftar chapter', onRetry: loadChapters });
    });
  }

  sortBtn.addEventListener('click', function () {
    sortDesc = !sortDesc;
    localStorageSet(SORT_KEY, sortDesc ? 'desc' : 'asc');
    renderSortBtn();
    renderChapters();
  });
  filterEl.addEventListener('input', renderChapters);

  document.addEventListener('bacakomix:storage', function () {
    if (comic) renderActions();
  });

  loadDetail();
})();
