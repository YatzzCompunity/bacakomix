/* Bacakomix — Reader */
(function () {
  'use strict';

  const API = window.BacakomixAPI;
  const B = window.Bacakomix;

  const rawChapter = (B.param('chapter') || '').trim();
  const isNumber = /^\d+(\.\d+)?$/.test(rawChapter);
  const mangaSlug = (B.param('manga') || '').trim() || (isNumber ? '' : B.mangaSlugFromChapterSlug(rawChapter));

  const els = {
    bar: document.getElementById('reader-bar'),
    back: document.getElementById('back-btn'),
    manga: document.getElementById('reader-manga'),
    chapter: document.getElementById('reader-chapter'),
    select: document.getElementById('chapter-select'),
    selectBottom: document.getElementById('chapter-select-bottom'),
    prevTop: document.getElementById('prev-top'),
    nextTop: document.getElementById('next-top'),
    prevBottom: document.getElementById('prev-bottom'),
    nextBottom: document.getElementById('next-bottom'),
    detailBottom: document.getElementById('detail-bottom'),
    state: document.getElementById('reader-state'),
    pages: document.getElementById('reader-pages'),
    end: document.getElementById('reader-end'),
    endTitle: document.getElementById('end-title'),
    endSub: document.getElementById('end-sub'),
    progress: document.getElementById('reader-progress'),
    toTop: document.getElementById('to-top'),
  };

  let chapters = [];          // urut menaik berdasarkan nomor
  let comic = null;            // detail komik (bila berhasil dimuat)
  let current = null;          // {number, slug, title}
  let prevHref = '';
  let nextHref = '';

  if (mangaSlug) {
    const detailHref = B.detailUrl(mangaSlug);
    els.back.href = detailHref;
    els.manga.href = detailHref;
    els.detailBottom.href = detailHref;
    const hist = B.History.get(mangaSlug);
    els.manga.textContent = (hist && hist.title) || prettifySlug(mangaSlug);
  } else {
    els.back.setAttribute('aria-label', 'Kembali ke beranda');
    els.detailBottom.textContent = 'Kembali ke Beranda';
  }

  function prettifySlug(s) {
    return String(s).replace(/-/g, ' ').replace(/\b\w/g, function (m) { return m.toUpperCase(); });
  }

  function fail(err, opts) {
    els.pages.innerHTML = '';
    els.end.hidden = true;
    els.chapter.textContent = 'Chapter gagal dimuat';
    document.title = 'Gagal memuat chapter — Bacakomix';
    B.renderState(els.state, Object.assign({
      type: 'error', error: err, onRetry: start,
      action: mangaSlug ? { href: B.detailUrl(mangaSlug), label: 'Ke Detail Komik' } : { href: 'index.html', label: 'Ke Beranda' },
    }, opts || {}));
  }

  if (!rawChapter) {
    els.chapter.textContent = 'Chapter tidak ditentukan';
    B.renderState(els.state, {
      type: 'empty', title: 'Chapter tidak ditentukan',
      message: 'Tautan ini tidak menyertakan chapter yang ingin dibaca.',
      action: mangaSlug ? { href: B.detailUrl(mangaSlug), label: 'Pilih chapter' } : { href: 'index.html', label: 'Ke Beranda' },
    });
    return;
  }

  /* ---------- Data ---------- */

  let chaptersPromise = null;
  function loadChapterList() {
    if (!mangaSlug) return Promise.resolve([]);
    if (!chaptersPromise) {
      chaptersPromise = API.getChapters(mangaSlug).then(function (data) {
        const list = (Array.isArray(data.chapters) ? data.chapters : []).filter(Boolean);
        return list.sort(function (a, b) {
          const na = B.chapterNumberOf(a), nb = B.chapterNumberOf(b);
          if (!Number.isFinite(na)) return 1;
          if (!Number.isFinite(nb)) return -1;
          return na - nb;
        });
      }).catch(function () {
        chaptersPromise = null; // boleh dicoba ulang
        return [];
      });
    }
    return chaptersPromise;
  }

  function findChapter(list) {
    if (isNumber) {
      const n = Number(rawChapter);
      return list.find(function (ch) { return B.chapterNumberOf(ch) === n; }) || null;
    }
    return list.find(function (ch) { return ch.slug === rawChapter; }) || null;
  }

  function loadImages(list) {
    const match = findChapter(list);
    if (match && match.slug) return API.getChapterImages(match.slug).then(function (d) { return { data: d, match: match }; });
    if (!isNumber) return API.getChapterImages(rawChapter).then(function (d) { return { data: d, match: null }; });
    if (!mangaSlug) {
      return Promise.reject(new API.ApiError('Nomor chapter tanpa slug komik.', 'notfound', 404));
    }
    return API.readChapter(mangaSlug, rawChapter).then(function (d) { return { data: d, match: null }; });
  }

  function normalizeImages(data) {
    const raw = Array.isArray(data.images) ? data.images : (Array.isArray(data.pages) ? data.pages : []);
    return raw.map(function (img, i) {
      if (typeof img === 'string') return { page: i + 1, url: img };
      return { page: Number(img.page) || i + 1, url: img.url || img.src || img.image || '' };
    }).filter(function (img) { return img.url; })
      .sort(function (a, b) { return a.page - b.page; });
  }

  /* ---------- Render ---------- */

  function renderPages(images) {
    const title = current.title;
    els.pages.innerHTML = images.map(function (img, i) {
      const src = API.proxyImage(img.url);
      return '<figure class="reader-page-item" data-index="' + i + '" style="margin:0">' +
        '<img src="' + B.esc(src) + '" data-src="' + B.esc(src) + '" alt="' + B.esc(title) + ' — halaman ' + img.page + '"' +
          (i < 3 ? ' fetchpriority="' + (i === 0 ? 'high' : 'auto') + '"' : ' loading="lazy"') + ' decoding="async">' +
        '<div class="page-loader"><div class="spinner"></div><span>Halaman ' + img.page + '</span></div>' +
        '<div class="page-error"><span>Halaman ' + img.page + ' gagal dimuat.</span>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-reload>Muat Ulang</button></div>' +
      '</figure>';
    }).join('');

    els.pages.querySelectorAll('.reader-page-item').forEach(function (fig) {
      const img = fig.querySelector('img');
      const done = function () { fig.classList.remove('failed'); fig.classList.add('loaded'); };
      const failed = function () { fig.classList.remove('loaded'); fig.classList.add('failed'); };
      img.addEventListener('load', done);
      img.addEventListener('error', failed);
      if (img.complete && img.naturalWidth > 0) done();
      fig.querySelector('[data-reload]').addEventListener('click', function () {
        fig.classList.remove('failed');
        const base = img.getAttribute('data-src');
        img.src = base + (base.indexOf('?') === -1 ? '?' : '&') + 'retry=' + Date.now();
      });
    });
  }

  function setLink(el, href, disabledLabel) {
    if (href) {
      el.href = href;
      el.classList.remove('disabled');
      el.removeAttribute('aria-disabled');
      el.removeAttribute('tabindex');
    } else {
      el.removeAttribute('href');
      el.classList.add('disabled');
      el.setAttribute('aria-disabled', 'true');
      el.setAttribute('tabindex', '-1');
      if (disabledLabel) el.title = disabledLabel;
    }
  }

  function renderNav() {
    let idx = -1;
    if (chapters.length) {
      idx = chapters.findIndex(function (ch) {
        return (current.slug && ch.slug === current.slug) ||
          (Number.isFinite(current.number) && B.chapterNumberOf(ch) === current.number);
      });
    }
    const prev = idx > 0 ? chapters[idx - 1] : null;
    const next = idx !== -1 && idx < chapters.length - 1 ? chapters[idx + 1] : null;
    prevHref = prev ? B.chapterLink(mangaSlug, prev) : '';
    nextHref = next ? B.chapterLink(mangaSlug, next) : '';
    setLink(els.prevTop, prevHref, 'Ini chapter pertama');
    setLink(els.nextTop, nextHref, 'Belum ada chapter berikutnya');
    setLink(els.prevBottom, prevHref);
    setLink(els.nextBottom, nextHref);

    if (idx !== -1) {
      els.endSub.textContent = next
        ? 'Lanjut ke ' + (next.title || 'Chapter ' + B.chapterNumberOf(next)) + '?'
        : 'Ini chapter terbaru yang tersedia. Cek lagi nanti untuk update berikutnya.';
    } else if (!chapters.length && mangaSlug) {
      els.endSub.textContent = 'Daftar chapter tidak dapat dimuat, navigasi chapter tidak tersedia.';
    }

    [els.select, els.selectBottom].forEach(function (sel) {
      if (!chapters.length) { sel.hidden = true; return; }
      sel.innerHTML = chapters.slice().reverse().map(function (ch) {
        const n = B.chapterNumberOf(ch);
        const label = ch.title || (Number.isFinite(n) ? 'Chapter ' + n : ch.slug);
        const selected = (current.slug && ch.slug === current.slug) || (Number.isFinite(current.number) && n === current.number);
        return '<option value="' + B.esc(B.chapterLink(mangaSlug, ch)) + '"' + (selected ? ' selected' : '') + '>' + B.esc(label) + '</option>';
      }).join('');
      sel.hidden = false;
    });
  }

  [els.select, els.selectBottom].forEach(function (sel) {
    sel.addEventListener('change', function () { if (sel.value) location.href = sel.value; });
  });

  function saveProgress() {
    if (!mangaSlug || !current) return;
    const prev = B.History.get(mangaSlug) || {};
    const key = String(Number.isFinite(current.number) ? current.number : current.slug);
    const read = (Array.isArray(prev.read) ? prev.read.map(String) : []).filter(function (k) { return k !== key; });
    read.push(key);
    B.History.save({
      slug: mangaSlug,
      title: (comic && comic.title) || prev.title || prettifySlug(mangaSlug),
      cover: (comic && comic.cover) || prev.cover || '',
      type: (comic && comic.type) || prev.type || '',
      chapterNumber: Number.isFinite(current.number) ? current.number : null,
      chapterSlug: current.slug || '',
      chapterTitle: current.title,
      read: read.slice(-500),
    });
  }

  /* ---------- Alur utama ---------- */

  function start() {
    els.state.innerHTML = '<div class="loading-block"><div class="spinner"></div><span>Memuat halaman chapter…</span></div>';
    els.pages.innerHTML = '';
    els.end.hidden = true;
    els.endSub.textContent = '';
    els.chapter.textContent = 'Memuat chapter…';

    // Info komik (judul & cover untuk riwayat) — tidak memblokir pembacaan.
    if (mangaSlug && !comic) {
      API.getDetail(mangaSlug).then(function (d) {
        if (!d.manga) return;
        comic = B.normalizeComic(d.manga);
        els.manga.textContent = comic.title;
        if (current) {
          document.title = current.title + ' — ' + comic.title + ' — Bacakomix';
          saveProgress();
        }
      }).catch(function () { /* judul tetap dari slug / riwayat */ });
    }

    loadChapterList().then(function (list) {
      chapters = list;
      return loadImages(list);
    }).then(function (res) {
      const data = res.data;
      const images = normalizeImages(data);
      const numFromData = Number(data.chapterNumber);
      const number = Number.isFinite(numFromData) && data.chapterNumber !== null && data.chapterNumber !== undefined
        ? numFromData
        : (res.match ? B.chapterNumberOf(res.match) : (isNumber ? Number(rawChapter) : B.chapterNumberOf({ slug: rawChapter })));
      current = {
        number: number,
        slug: data.chapterSlug || (res.match && res.match.slug) || (isNumber ? '' : rawChapter),
        title: (res.match && res.match.title) || (Number.isFinite(number) ? 'Chapter ' + number : 'Chapter'),
      };
      els.chapter.textContent = current.title;
      document.title = current.title + ' — ' + (comic ? comic.title : els.manga.textContent) + ' — Bacakomix';
      renderNav();

      if (!images.length) {
        B.renderState(els.state, {
          type: 'empty', title: 'Halaman chapter kosong',
          message: 'Chapter ini belum memiliki gambar yang bisa ditampilkan.',
          onRetry: start,
          action: mangaSlug ? { href: B.detailUrl(mangaSlug), label: 'Ke Detail Komik' } : null,
        });
        els.end.hidden = false;
        return;
      }
      els.state.innerHTML = '';
      els.endTitle.textContent = 'Selesai: ' + current.title;
      if (!els.endSub.textContent) els.endSub.textContent = images.length + ' halaman.';
      renderPages(images);
      els.end.hidden = false;
      saveProgress();
    }).catch(function (err) {
      fail(err, err.kind === 'notfound' ? { title: 'Chapter tidak ditemukan', message: 'Chapter ini tidak tersedia atau tautannya salah.' } : null);
    });
  }

  /* ---------- Interaksi ---------- */

  let lastY = window.scrollY;
  let ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      els.progress.style.width = (max > 0 ? Math.min(100, (y / max) * 100) : 0) + '%';
      if (y > lastY + 8 && y > 120) els.bar.classList.add('hidden');
      else if (y < lastY - 8) els.bar.classList.remove('hidden');
      els.toTop.classList.toggle('show', y > 800);
      lastY = y;
      ticking = false;
    });
  }, { passive: true });

  els.pages.addEventListener('click', function (e) {
    if (e.target.closest('button')) return;
    els.bar.classList.toggle('hidden');
  });

  els.toTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey || /input|select|textarea/i.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft' && prevHref) location.href = prevHref;
    if (e.key === 'ArrowRight' && nextHref) location.href = nextHref;
  });

  start();
})();
