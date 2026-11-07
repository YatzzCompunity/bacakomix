/* Bacakomix — Beranda */
(function () {
  'use strict';

  const API = window.BacakomixAPI;
  const B = window.Bacakomix;
  const PER_PAGE = 12;

  B.renderHeader('home');
  B.renderFooter();

  const heroEl = document.getElementById('hero');
  const gridEl = document.getElementById('latest-grid');
  const moreWrap = document.getElementById('load-more-wrap');
  const moreBtn = document.getElementById('load-more');

  let page = 1;
  let totalPages = 1;
  let heroTimer = null;

  /* ---------- Hero ---------- */

  function renderHero(items) {
    const list = items.slice(0, 5).map(B.normalizeComic).filter(function (c) { return c.slug; });
    if (!list.length) { heroEl.hidden = true; return; }
    heroEl.hidden = false;
    heroEl.innerHTML = list.map(function (c, i) {
      const cover = API.proxyImage(c.cover);
      const type = B.typeLabel(c.type);
      const status = B.statusLabel(c.status);
      return '<article class="hero-slide"' + (i ? ' hidden' : '') + ' data-index="' + i + '">' +
        '<div class="hero-bg"' + (cover ? ' style="background-image:url(\'' + B.esc(cover) + '\')"' : '') + '></div>' +
        '<div class="hero-content">' +
          '<a class="hero-cover" href="' + B.detailUrl(c.slug) + '" tabindex="-1">' + B.coverImg(c, '', i === 0) + '</a>' +
          '<div class="hero-text">' +
            '<span class="hero-kicker">' + (i === 0 ? 'Baru diperbarui' : 'Pilihan terbaru') + '</span>' +
            '<h2 class="hero-title"><a href="' + B.detailUrl(c.slug) + '">' + B.esc(c.title) + '</a></h2>' +
            '<div class="hero-meta">' +
              (type ? '<span class="pill">' + B.esc(type) + '</span>' : '') +
              (status ? '<span class="pill">' + B.esc(status) + '</span>' : '') +
              (B.hasNumber(c.rating) ? '<span class="pill rating">' + B.ICONS.star + B.formatRating(c.rating) + '</span>' : '') +
              (B.hasNumber(c.views) ? '<span class="pill">' + B.ICONS.eye + B.formatNumber(c.views) + '</span>' : '') +
            '</div>' +
            (c.synopsis ? '<p class="hero-synopsis">' + B.esc(c.synopsis) + '</p>' : '') +
            '<div class="hero-actions">' +
              '<a class="btn btn-primary" href="' + B.readerUrl(c.slug, 1) + '">' + B.ICONS.book + 'Baca Chapter 1</a>' +
              '<a class="btn btn-ghost" href="' + B.detailUrl(c.slug) + '">Detail</a>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</article>';
    }).join('') +
    (list.length > 1
      ? '<button type="button" class="hero-arrow prev" data-go-prev aria-label="Komik sebelumnya">' + B.ICONS.left + '</button>' +
        '<button type="button" class="hero-arrow next" data-go-next aria-label="Komik berikutnya">' + B.ICONS.right + '</button>'
      : '') +
    (list.length > 1
      ? '<div class="hero-dots" role="tablist" aria-label="Pilih komik">' + list.map(function (c, i) {
          return '<button type="button" role="tab" aria-label="' + B.esc(c.title) + '" aria-selected="' + (i === 0) + '"' +
            (i === 0 ? ' class="active"' : '') + ' data-go="' + i + '"></button>';
        }).join('') + '</div>'
      : '');

    let current = 0;
    function show(i) {
      current = (i + list.length) % list.length;
      heroEl.querySelectorAll('.hero-slide').forEach(function (s, idx) { s.hidden = idx !== current; });
      heroEl.querySelectorAll('.hero-dots button').forEach(function (d, idx) {
        d.classList.toggle('active', idx === current);
        d.setAttribute('aria-selected', String(idx === current));
      });
    }
    function restart() {
      clearInterval(heroTimer);
      if (list.length > 1) heroTimer = setInterval(function () { show(current + 1); }, 7000);
    }
    heroEl.querySelectorAll('[data-go]').forEach(function (btn) {
      btn.addEventListener('click', function () { show(Number(btn.dataset.go)); restart(); });
    });
    const prevBtn = heroEl.querySelector('[data-go-prev]');
    const nextBtn = heroEl.querySelector('[data-go-next]');
    if (prevBtn) prevBtn.addEventListener('click', function () { show(current - 1); restart(); });
    if (nextBtn) nextBtn.addEventListener('click', function () { show(current + 1); restart(); });
    restart();
  }

  /* ---------- Terbaru ---------- */

  function setMore() {
    moreWrap.hidden = page >= totalPages;
  }

  function loadFirst() {
    clearInterval(heroTimer);
    heroEl.hidden = false;
    heroEl.innerHTML = '<div class="hero-skeleton skeleton"></div>';
    gridEl.innerHTML = B.skeletonGrid(PER_PAGE);
    moreWrap.hidden = true;
    page = 1;

    API.getLatest(1, PER_PAGE).then(function (data) {
      const results = Array.isArray(data.results) ? data.results : [];
      totalPages = Number(data.totalPages) || 1;
      if (!results.length) {
        heroEl.hidden = true;
        B.renderState(gridEl, {
          type: 'empty', title: 'Belum ada komik',
          message: 'Daftar komik terbaru masih kosong. Coba lagi nanti.', onRetry: loadFirst,
        });
        return;
      }
      renderHero(results);
      gridEl.innerHTML = results.map(B.cardHTML).join('');
      setMore();
    }).catch(function (err) {
      heroEl.hidden = true;
      heroEl.innerHTML = '';
      B.renderState(gridEl, { type: 'error', error: err, onRetry: loadFirst });
    });
  }

  moreBtn.addEventListener('click', function () {
    const next = page + 1;
    moreBtn.disabled = true;
    moreBtn.textContent = 'Memuat…';
    API.getLatest(next, PER_PAGE).then(function (data) {
      const results = Array.isArray(data.results) ? data.results : [];
      totalPages = Number(data.totalPages) || totalPages;
      page = next;
      gridEl.insertAdjacentHTML('beforeend', results.map(B.cardHTML).join(''));
      if (!results.length) totalPages = page;
      moreBtn.textContent = 'Muat Lebih';
      setMore();
    }).catch(function (err) {
      const info = B.errorInfo(err);
      B.toast(info.title + '. Coba lagi.');
      moreBtn.textContent = 'Coba Muat Lagi';
    }).finally(function () {
      moreBtn.disabled = false;
    });
  });

  /* ---------- Lanjutkan Membaca ---------- */

  function renderContinue() {
    const section = document.getElementById('continue-section');
    const list = document.getElementById('continue-list');
    const items = B.History.all().slice(0, 12);
    section.hidden = !items.length;
    list.innerHTML = items.map(function (h) {
      const c = B.normalizeComic(h);
      const chapterLabel = h.chapterTitle || (h.chapterNumber !== undefined ? 'Chapter ' + h.chapterNumber : 'Lanjutkan');
      const href = B.readerUrl(h.slug, h.chapterNumber !== undefined && h.chapterNumber !== null ? h.chapterNumber : h.chapterSlug);
      return '<article class="card history-card">' +
        '<a class="card-link" href="' + href + '">' +
          '<div class="card-cover">' + B.coverImg(c) +
            '<span class="progress-chip">' + B.esc(chapterLabel) + '</span>' +
          '</div>' +
          '<div class="card-body"><h3 class="card-title">' + B.esc(c.title) + '</h3>' +
            '<div class="card-sub">' + B.esc(B.timeAgo(h.updatedAt || Date.now())) + '</div></div>' +
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

  /* ---------- Bookmark ---------- */

  function renderBookmarks() {
    const host = document.getElementById('bookmark-list');
    const all = B.Bookmarks.all();
    document.getElementById('bookmark-all').hidden = all.length <= 12;
    if (!all.length) {
      B.renderState(host, {
        type: 'empty', title: 'Belum ada bookmark',
        message: 'Tekan ikon bookmark pada kartu atau halaman detail komik untuk menyimpannya di sini.',
      });
      return;
    }
    host.innerHTML = '<div class="rail">' + all.slice(0, 12).map(B.cardHTML).join('') + '</div>';
  }

  document.addEventListener('bacakomix:storage', function () {
    renderBookmarks();
    renderContinue();
  });

  renderContinue();
  renderBookmarks();
  loadFirst();
})();
