/*
 * Bacakomix — API client.
 * SEMUA pemanggilan ke backend harus lewat file ini (pakai API_BASE di bawah).
 * Setiap fungsi mengembalikan objek JSON berisi `success: true`,
 * atau melempar `ApiError` dengan `kind` yang konsisten:
 *   - 'upstream'  : sumber komik (KomikNesia) sedang error / down (mis. HTTP 502)
 *   - 'notfound'  : data tidak ditemukan
 *   - 'empty'     : sumber mengembalikan daftar kosong (mis. halaman di luar jangkauan)
 *   - 'network'   : gagal terhubung ke API (offline, DNS, CORS, dsb.)
 *   - 'timeout'   : API terlalu lama merespons
 *   - 'invalid'   : respons bukan JSON yang valid
 *   - 'api'       : success:false dengan alasan lain
 */
(function (global) {
  'use strict';

  const API_BASE = 'https://bacakomix-api-zipudenguga-8459.vercel.app';
  const DEFAULT_TIMEOUT = 20000;

  class ApiError extends Error {
    constructor(message, kind, status) {
      super(message || 'Terjadi kesalahan');
      this.name = 'ApiError';
      this.kind = kind || 'api';
      this.status = status || 0;
    }
  }

  function buildUrl(path, params) {
    const url = new URL(API_BASE + path);
    if (params) {
      Object.keys(params).forEach(function (key) {
        const value = params[key];
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, String(value));
        }
      });
    }
    return url.toString();
  }

  function classify(message, status) {
    const msg = String(message || '').toLowerCase();
    if (/\b404\b|not found|tidak ditemukan/.test(msg) || status === 404) return 'notfound';
    if (/kosong|empty|no results/.test(msg)) return 'empty';
    if (/\b50[0-9]\b|bad gateway|upstream|komiknesia api error|service unavailable/.test(msg)) {
      return 'upstream';
    }
    if (status >= 500) return 'upstream';
    return 'api';
  }

  async function request(path, params, options) {
    const opts = options || {};
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller
      ? setTimeout(function () { controller.abort(); }, opts.timeout || DEFAULT_TIMEOUT)
      : null;

    let res;
    try {
      res = await fetch(buildUrl(path, params), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller ? controller.signal : undefined,
      });
    } catch (err) {
      if (err && err.name === 'AbortError') {
        throw new ApiError('Server terlalu lama merespons.', 'timeout');
      }
      throw new ApiError('Tidak bisa terhubung ke server Bacakomix.', 'network');
    } finally {
      if (timer) clearTimeout(timer);
    }

    let data = null;
    try {
      data = await res.json();
    } catch (err) {
      if (res.status >= 500) throw new ApiError('HTTP ' + res.status, 'upstream', res.status);
      if (res.status === 404) throw new ApiError('Data tidak ditemukan.', 'notfound', 404);
      throw new ApiError('Respons server tidak valid.', 'invalid', res.status);
    }

    if (!data || data.success !== true) {
      const message = (data && (data.error || data.message)) || ('HTTP ' + res.status);
      throw new ApiError(message, classify(message, res.status), res.status);
    }
    return data;
  }

  function enc(value) {
    return encodeURIComponent(String(value));
  }

  /** Komik terbaru. Respons: {page, totalPages, totalCount, results[]} */
  function getLatest(page, limit) {
    return request('/api/latest', { page: page || 1, limit: limit || 12 });
  }

  /** Cari komik. Respons: {source, total, results[]} */
  function searchComics(query, page) {
    return request('/api/search', { q: query, page: page || 1 });
  }

  /** Detail komik. Respons: {manga:{...}} */
  function getDetail(slug) {
    return request('/api/manga/' + enc(slug));
  }

  /** Daftar chapter. Respons: {mangaId, totalChapters, chapters[]} */
  function getChapters(slugOrId) {
    return request('/api/manga-chapters/' + enc(slugOrId));
  }

  /** Gambar halaman chapter. Respons: {chapterSlug, chapterNumber, totalImages, images[]} */
  function getChapterImages(chapterSlug) {
    return request('/api/chapter/' + enc(chapterSlug));
  }

  /** Gambar chapter berdasarkan slug komik + nomor chapter. */
  function readChapter(mangaSlug, chapterNumber) {
    return request('/api/read', { manga: mangaSlug, chapter: chapterNumber });
  }

  /** URL gambar lewat image-proxy. Mengembalikan '' bila url kosong. */
  function proxyImage(url) {
    if (!url || typeof url !== 'string') return '';
    if (url.indexOf(API_BASE + '/api/image-proxy') === 0) return url;
    return API_BASE + '/api/image-proxy?url=' + encodeURIComponent(url);
  }

  global.BacakomixAPI = {
    API_BASE: API_BASE,
    ApiError: ApiError,
    getLatest: getLatest,
    searchComics: searchComics,
    getDetail: getDetail,
    getChapters: getChapters,
    getChapterImages: getChapterImages,
    readChapter: readChapter,
    proxyImage: proxyImage,
  };
})(window);
