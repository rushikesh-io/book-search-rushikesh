/**
 * api.js — everything that talks to the Google Books API.
 * Docs: https://developers.google.com/books/docs/v1/using
 */

const API_BASE = 'https://www.googleapis.com/books/v1/volumes';

/** Google Books never returns more than ~1000 results for a query, so we cap paging there. */
export const MAX_RESULTS = 1000;

/**
 * Build the `q` parameter for the chosen search mode.
 * @param {string} term  what the user typed
 * @param {'all'|'title'|'author'} mode
 */
export function buildQuery(term, mode) {
  const clean = term.trim().replace(/\s+/g, ' ');
  if (mode === 'title') return `intitle:${clean}`;
  if (mode === 'author') return `inauthor:${clean}`;
  return clean;
}

/** Turn HTML (Google sometimes returns <p>, <b>…) into plain text. */
function stripHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

/**
 * Convert a raw API volume into the small, predictable object the UI uses.
 * Every field has a safe fallback so the UI never has to null-check.
 */
export function normalizeBook(item) {
  const info = item.volumeInfo || {};
  const images = info.imageLinks || {};
  const rawCover = images.thumbnail || images.smallThumbnail || '';
  const year = parseInt((info.publishedDate || '').slice(0, 4), 10);

  return {
    id: item.id,
    title: info.title || 'Untitled',
    subtitle: info.subtitle || '',
    authors: info.authors?.length ? info.authors : ['Unknown author'],
    publisher: info.publisher || 'Unknown publisher',
    publishedDate: info.publishedDate || '',
    year: Number.isFinite(year) ? year : null,
    description: stripHtml(info.description || item.searchInfo?.textSnippet || ''),
    cover: rawCover.replace(/^http:\/\//, 'https://').replace('&edge=curl', ''),
    previewLink: info.previewLink || info.infoLink || '',
    pageCount: info.pageCount || null,
    categories: info.categories || [],
    language: info.language || '',
    rating: info.averageRating || null,
    source: 'google',
  };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Shared fetch wrapper: turns HTTP and network failures into friendly Errors.
 * Dropped connections are retried (up to `retries` times) before giving up.
 */
async function getJson(url, signal, retries = 2) {
  let response;
  try {
    response = await fetch(url, { signal });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    if (retries > 0) {
      await wait(600);
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      return getJson(url, signal, retries - 1);
    }
    throw new Error('Network error — please check your internet connection and try again.');
  }

  // Temporary server hiccups (5xx) are worth one more try too.
  if (response.status >= 500 && retries > 0) {
    await wait(600);
    return getJson(url, signal, retries - 1);
  }

  if (!response.ok) {
    if (response.status === 429) throw new Error('Too many requests right now. Please wait a moment and try again.');
    throw new Error(`The book service responded with an error (${response.status}). Please try again.`);
  }
  return response.json();
}

/* ------------------------------------------------------------------
 * Fallback provider: Open Library (free, no key).
 * Keyless Google Books requests share one global daily quota, so Google
 * sometimes answers 429 "Quota exceeded". When that happens we switch to
 * Open Library for the rest of the session so the app keeps working.
 * ------------------------------------------------------------------ */

const OPEN_LIBRARY = 'https://openlibrary.org';
const OL_FIELDS = 'key,title,subtitle,author_name,first_publish_year,publisher,cover_i,first_sentence,number_of_pages_median,subject,ratings_average,ebook_access';

let googleUnavailable = false;

/** Which service answered the last search ('google' | 'openlibrary'). */
export let activeSource = 'google';

/** Errors worth falling back for: quota/rate limits, auth and server errors. */
function shouldFallback(error) {
  return error.name !== 'AbortError' && /\((429|403|5\d\d)\)|Too many requests/.test(error.message);
}

function openLibraryParams(term, mode) {
  const clean = term.trim().replace(/\s+/g, ' ');
  if (mode === 'title') return { title: clean };
  if (mode === 'author') return { author: clean };
  return { q: clean };
}

function normalizeOpenLibrary(doc) {
  // Editions in many languages are merged into one work; prefer a sentence written in plain Latin characters.
  const sentences = [].concat(doc.first_sentence || []);
  const firstSentence = sentences.find((s) => /^[\x20-\x7E“”‘’—–…]+$/.test(s)) || sentences[0];
  return {
    id: `ol:${doc.key}`,
    title: doc.title || 'Untitled',
    subtitle: doc.subtitle || '',
    authors: doc.author_name?.length ? doc.author_name.slice(0, 4) : ['Unknown author'],
    publisher: doc.publisher?.[0] || 'Unknown publisher',
    publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : '',
    year: doc.first_publish_year || null,
    description: firstSentence || '',
    cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : '',
    previewLink: `${OPEN_LIBRARY}${doc.key}`,
    pageCount: doc.number_of_pages_median || null,
    categories: doc.subject?.slice(0, 1) || [],
    language: '',
    rating: doc.ratings_average ? Math.round(doc.ratings_average * 10) / 10 : null,
    source: 'openlibrary',
    workKey: doc.key,
  };
}

async function searchOpenLibrary({ term, mode, page, pageSize, orderBy, signal }) {
  const params = new URLSearchParams({
    ...openLibraryParams(term, mode),
    page: String(page),
    limit: String(pageSize),
    fields: OL_FIELDS,
  });
  if (orderBy === 'newest') params.set('sort', 'new');

  const data = await getJson(`${OPEN_LIBRARY}/search.json?${params}`, signal);
  return { books: (data.docs || []).map(normalizeOpenLibrary), total: Math.min(data.numFound || 0, MAX_RESULTS) };
}

/**
 * Open Library search results don't include the full description,
 * so the details view loads it on demand. Returns '' if unavailable.
 */
export async function loadFullDescription(book) {
  if (book.source !== 'openlibrary' || !book.workKey) return '';
  try {
    const work = await getJson(`${OPEN_LIBRARY}${book.workKey}.json`);
    const text = typeof work.description === 'string' ? work.description : work.description?.value || '';
    return text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/-{3,}[\s\S]*$/, '').trim();
  } catch {
    return '';
  }
}

/* ------------------------------------------------------------------ */

async function searchGoogle({ term, mode, page, pageSize, orderBy, signal }) {
  const params = new URLSearchParams({
    q: buildQuery(term, mode),
    startIndex: String((page - 1) * pageSize),
    maxResults: String(pageSize),
    orderBy,
    printType: 'books',
  });

  const data = await getJson(`${API_BASE}?${params}`, signal);
  const books = (data.items || []).map(normalizeBook);
  return { books, total: Math.min(data.totalItems || 0, MAX_RESULTS) };
}

/**
 * Search books — Google Books first, Open Library if Google is rate-limited.
 * @returns {Promise<{ books: object[], total: number }>}
 */
export async function searchBooks({ term, mode = 'all', page = 1, pageSize = 12, orderBy = 'relevance', signal }) {
  const options = { term, mode, page, pageSize, orderBy, signal };

  if (!googleUnavailable) {
    try {
      const result = await searchGoogle(options);
      activeSource = 'google';
      return result;
    } catch (error) {
      if (!shouldFallback(error)) throw error;
      console.warn('Google Books unavailable, switching to Open Library:', error.message);
      googleUnavailable = true;
    }
  }

  const result = await searchOpenLibrary(options);
  activeSource = 'openlibrary';
  return result;
}

/** Collect unique, non-empty strings (case-insensitive) up to `limit`. */
function uniqueStrings(values, limit = 6) {
  const seen = new Set();
  const out = [];
  for (const text of values) {
    const key = text?.toLowerCase();
    if (text && !seen.has(key)) {
      seen.add(key);
      out.push(text);
    }
  }
  return out.slice(0, limit);
}

/**
 * Lightweight request for the autocomplete dropdown.
 * @returns {Promise<string[]>} unique suggestion strings
 */
export async function fetchSuggestions(term, mode, signal) {
  if (!googleUnavailable) {
    try {
      const params = new URLSearchParams({
        q: buildQuery(term, mode),
        maxResults: '8',
        printType: 'books',
        fields: 'items(volumeInfo(title,authors))',
      });
      const data = await getJson(`${API_BASE}?${params}`, signal);
      const items = (data.items || []).map((i) => i.volumeInfo || {});
      return uniqueStrings(items.flatMap((v) => (mode === 'author' ? v.authors || [] : [v.title])));
    } catch (error) {
      if (!shouldFallback(error)) throw error;
      googleUnavailable = true;
    }
  }

  const params = new URLSearchParams({ ...openLibraryParams(term, mode), limit: '8', fields: 'title,author_name' });
  const data = await getJson(`${OPEN_LIBRARY}/search.json?${params}`, signal);
  const docs = data.docs || [];
  return uniqueStrings(docs.flatMap((d) => (mode === 'author' ? d.author_name || [] : [d.title])));
}
