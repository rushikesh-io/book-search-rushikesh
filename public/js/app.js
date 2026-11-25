/**
 * app.js — application state and event wiring for Shelfwise.
 * Data fetching lives in api.js, persistence in storage.js, markup in ui.js.
 */

import { searchBooks, fetchSuggestions, loadFullDescription, activeSource } from './api.js';
import * as store from './storage.js';
import * as ui from './ui.js';

/* ---------- DOM references ---------- */

const $ = (selector) => document.querySelector(selector);

const els = {
  form: $('#searchForm'),
  input: $('#searchInput'),
  hint: $('#formHint'),
  suggestions: $('#suggestions'),
  quick: $('#quickSearches'),
  toolbar: $('#toolbar'),
  count: $('#resultCount'),
  yearFrom: $('#yearFrom'),
  yearTo: $('#yearTo'),
  clearYears: $('#clearYears'),
  sort: $('#sortSelect'),
  results: $('#results'),
  status: $('#status'),
  grid: $('#bookGrid'),
  pagination: $('#pagination'),
  favToggle: $('#favoritesToggle'),
  favCount: $('#favoritesCount'),
  drawer: $('#favoritesDrawer'),
  overlay: $('#drawerOverlay'),
  closeDrawer: $('#closeDrawer'),
  favList: $('#favoritesList'),
  modal: $('#bookModal'),
  modalContent: $('#modalContent'),
  themeToggle: $('#themeToggle'),
};

/* ---------- State ---------- */

const PAGE_SIZE = 12;

const state = {
  term: '',
  mode: 'all',
  page: 1,
  orderBy: 'relevance',
  total: 0,
  books: [], // books on the current page (unfiltered)
  bookIndex: new Map(), // id -> book, for quick lookup on click
  modalBook: null,
  searchController: null,
  suggestController: null,
  suggestions: [],
  activeSuggestion: -1,
};

const getMode = () => els.form.querySelector('input[name="mode"]:checked').value;
const totalPages = () => Math.max(1, Math.ceil(state.total / PAGE_SIZE));

/* ---------- Search ---------- */

/**
 * Fetch one page of results and render it.
 * Any in-flight request is aborted so fast typing/clicking never shows stale data.
 */
async function runSearch({ page = 1, scroll = false } = {}) {
  if (!state.term) return;

  state.searchController?.abort();
  const controller = new AbortController();
  state.searchController = controller;
  state.page = page;

  showLoading();
  syncUrl();

  try {
    const { books, total } = await searchBooks({
      term: state.term,
      mode: state.mode,
      page,
      pageSize: PAGE_SIZE,
      orderBy: state.orderBy,
      signal: controller.signal,
    });

    state.books = books;
    state.bookIndex = new Map(books.map((b) => [b.id, b]));
    // Google's totalItems is an estimate; if this page came back short, trust what we actually got.
    state.total = books.length < PAGE_SIZE ? (page - 1) * PAGE_SIZE + books.length : total;

    renderResults();
    if (scroll) els.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    if (error.name === 'AbortError') return; // a newer search replaced this one
    console.error('Search failed:', error);
    showError(error.message);
  } finally {
    if (state.searchController === controller) state.searchController = null;
  }
}

function startNewSearch(term, mode = getMode()) {
  const clean = term.trim();
  if (clean.length < 2) {
    showHint('Please type at least 2 characters to search.');
    els.input.focus();
    return;
  }
  hideHint();
  state.suggestController?.abort();
  hideSuggestions();
  els.input.blur(); // closes the mobile keyboard so results are visible
  state.term = clean;
  state.mode = mode;
  els.input.value = clean;
  setMode(mode);
  runSearch({ page: 1 });
}

/* ---------- Rendering ---------- */

function showLoading() {
  els.toolbar.classList.add('hidden');
  els.toolbar.classList.remove('flex');
  els.pagination.classList.add('hidden');
  els.status.innerHTML = ui.loadingMessage(state.term);
  els.grid.innerHTML = ui.skeletonCards(8);
  els.grid.setAttribute('aria-busy', 'true');
}

function showError(message) {
  els.grid.innerHTML = '';
  els.grid.removeAttribute('aria-busy');
  els.pagination.classList.add('hidden');
  els.status.innerHTML = ui.statusMessage('error', message);
}

/** Year filter is applied client-side to the current page of results. */
function filteredBooks() {
  const from = parseInt(els.yearFrom.value, 10);
  const to = parseInt(els.yearTo.value, 10);
  const active = Number.isFinite(from) || Number.isFinite(to);
  els.clearYears.classList.toggle('hidden', !active);
  if (!active) return { books: state.books, active };

  const books = state.books.filter((b) => {
    if (b.year === null) return false;
    if (Number.isFinite(from) && b.year < from) return false;
    if (Number.isFinite(to) && b.year > to) return false;
    return true;
  });
  return { books, active };
}

function renderResults() {
  els.grid.removeAttribute('aria-busy');

  if (!state.books.length) {
    els.toolbar.classList.add('hidden');
    els.toolbar.classList.remove('flex');
    els.pagination.classList.add('hidden');
    els.grid.innerHTML = '';
    els.status.innerHTML = ui.statusMessage(
      'empty',
      state.page > 1 ? 'You have reached the end of the results.' : 'Check the spelling, or switch between Title and Author search.'
    );
    return;
  }

  const { books, active } = filteredBooks();

  els.toolbar.classList.remove('hidden');
  els.toolbar.classList.add('flex');

  const modeLabel = { all: '', title: ' in titles', author: ' by author' }[state.mode];
  const filterNote = active ? ` · <strong>${books.length}</strong> of ${state.books.length} on this page match the year filter` : '';
  els.count.innerHTML = `About <strong>${ui.formatNumber(state.total)}</strong> results for “${ui.escapeHtml(state.term)}”${modeLabel} · page ${state.page} of ${totalPages()}${filterNote}`;
  els.count.innerHTML += ` <span class="ml-1 whitespace-nowrap rounded-full bg-paper-100 px-2 py-0.5 text-[11px] font-medium dark:bg-ink-800">via ${activeSource === 'google' ? 'Google Books' : 'Open Library'}</span>`;

  const favIds = new Set(store.getFavorites().map((b) => b.id));
  els.status.innerHTML = books.length ? '' : ui.statusMessage('filtered', 'Widen the year range, clear the filter, or try another page.');
  els.grid.innerHTML = books.map((b, i) => ui.bookCard(b, favIds.has(b.id), i)).join('');

  els.pagination.innerHTML = ui.pagination(state.page, totalPages());
  els.pagination.classList.toggle('hidden', totalPages() <= 1);
  els.pagination.classList.toggle('flex', totalPages() > 1);
}

/** Re-render only the bookmark state of cards (keeps scroll position, no refetch). */
function refreshFavoriteButtons() {
  if (state.books.length) renderResults();
  renderFavorites();
}

function renderFavorites() {
  const favorites = store.getFavorites();
  els.favCount.textContent = favorites.length;
  els.favList.innerHTML = ui.favoritesList(favorites);
}

/* ---------- Favourites ---------- */

function toggleFavorite(book) {
  const saved = store.toggleFavorite(book);
  refreshFavoriteButtons();
  if (state.modalBook?.id === book.id) renderModal(book);
  announce(saved ? `Saved “${book.title}” to My Shelf` : `Removed “${book.title}” from My Shelf`);
}

function openDrawer() {
  renderFavorites();
  els.drawer.classList.remove('translate-x-full');
  els.drawer.removeAttribute('inert');
  els.drawer.setAttribute('aria-hidden', 'false');
  els.overlay.classList.remove('hidden');
  els.favToggle.setAttribute('aria-expanded', 'true');
  document.body.classList.add('overflow-hidden');
  els.closeDrawer.focus();
}

function closeDrawer() {
  els.drawer.classList.add('translate-x-full');
  els.drawer.setAttribute('inert', '');
  els.drawer.setAttribute('aria-hidden', 'true');
  els.overlay.classList.add('hidden');
  els.favToggle.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('overflow-hidden');
  els.favToggle.focus();
}

const drawerIsOpen = () => !els.drawer.classList.contains('translate-x-full');

/* ---------- Details modal ---------- */

function renderModal(book) {
  els.modalContent.innerHTML = ui.bookDetails(book, store.isFavorite(book.id));
}

function openModal(book) {
  state.modalBook = book;
  renderModal(book);
  if (!els.modal.open) els.modal.showModal();
  els.modalContent.scrollTop = 0;

  // Open Library results only carry a first sentence — fetch the full blurb lazily.
  if (book.source === 'openlibrary' && !book.fullDescriptionLoaded) {
    loadFullDescription(book).then((text) => {
      book.fullDescriptionLoaded = true;
      if (text) book.description = text;
      if (state.modalBook?.id === book.id) renderModal(book);
    });
  }
}

function closeModal() {
  if (els.modal.open) els.modal.close();
}

/* ---------- Suggestions (debounced autocomplete) ---------- */

function debounce(fn, wait) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

const loadSuggestions = debounce(async (term) => {
  state.suggestController?.abort();
  if (term.length < 3) return hideSuggestions();

  const controller = new AbortController();
  state.suggestController = controller;
  try {
    const list = await fetchSuggestions(term, getMode(), controller.signal);
    // ignore if the user kept typing or already left the field / submitted
    if (els.input.value.trim() !== term || document.activeElement !== els.input) return;
    state.suggestions = list;
    state.activeSuggestion = -1;
    renderSuggestions(term);
  } catch (error) {
    if (error.name !== 'AbortError') hideSuggestions(); // suggestions are optional — fail quietly
  }
}, 300);

function renderSuggestions(term = els.input.value.trim()) {
  if (!state.suggestions.length) return hideSuggestions();
  els.suggestions.innerHTML = ui.suggestionItems(state.suggestions, term, state.activeSuggestion);
  els.suggestions.classList.remove('hidden');
  els.input.setAttribute('aria-expanded', 'true');
  if (state.activeSuggestion >= 0) {
    els.input.setAttribute('aria-activedescendant', `suggestion-${state.activeSuggestion}`);
    $(`#suggestion-${state.activeSuggestion}`)?.scrollIntoView({ block: 'nearest' });
  } else {
    els.input.removeAttribute('aria-activedescendant');
  }
}

function hideSuggestions() {
  state.suggestions = [];
  state.activeSuggestion = -1;
  els.suggestions.classList.add('hidden');
  els.suggestions.innerHTML = '';
  els.input.setAttribute('aria-expanded', 'false');
  els.input.removeAttribute('aria-activedescendant');
}

/* ---------- Small helpers ---------- */

function setMode(mode) {
  const radio = els.form.querySelector(`input[name="mode"][value="${mode}"]`);
  if (radio) radio.checked = true;
}

function showHint(text) {
  els.hint.textContent = text;
  els.hint.classList.remove('hidden');
}

function hideHint() {
  els.hint.classList.add('hidden');
}

/** Screen-reader announcement for actions that don't move focus. */
const liveRegion = Object.assign(document.createElement('div'), { className: 'sr-only' });
liveRegion.setAttribute('aria-live', 'polite');
document.body.append(liveRegion);
function announce(text) {
  liveRegion.textContent = '';
  requestAnimationFrame(() => (liveRegion.textContent = text));
}

/** Keep the search in the URL so results can be shared / survive a refresh. */
function syncUrl() {
  const params = new URLSearchParams({ q: state.term });
  if (state.mode !== 'all') params.set('by', state.mode);
  if (state.page > 1) params.set('page', state.page);
  if (state.orderBy !== 'relevance') params.set('sort', state.orderBy);
  history.replaceState(null, '', `?${params}`);
}

function restoreFromUrl() {
  const params = new URLSearchParams(location.search);
  const q = params.get('q');
  if (!q) {
    els.status.innerHTML = ui.statusMessage('welcome', 'Pick a popular search above, or type your own.');
    return;
  }
  state.term = q.trim();
  state.mode = ['title', 'author'].includes(params.get('by')) ? params.get('by') : 'all';
  state.orderBy = params.get('sort') === 'newest' ? 'newest' : 'relevance';
  els.input.value = state.term;
  els.sort.value = state.orderBy;
  setMode(state.mode);
  runSearch({ page: Math.max(1, parseInt(params.get('page'), 10) || 1) });
}

/** Replace a broken cover image with the generated placeholder cover. */
function handleBrokenCover(event) {
  const img = event.target;
  if (!(img instanceof HTMLImageElement) || !img.dataset.coverId) return;
  const id = img.dataset.coverId;
  const book = state.bookIndex.get(id) || store.getFavoriteById(id) || state.modalBook;
  const small = img.closest('#favoritesList') !== null;
  if (book) img.outerHTML = ui.placeholderCover(book, small ? 'sm' : 'md');
}

/* ---------- Event wiring ---------- */

function bindEvents() {
  els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const picked = state.suggestions[state.activeSuggestion];
    startNewSearch(picked ?? els.input.value);
  });

  els.input.addEventListener('input', () => {
    hideHint();
    loadSuggestions(els.input.value.trim());
  });

  els.input.addEventListener('keydown', (e) => {
    if (!state.suggestions.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      const last = state.suggestions.length - 1;
      // cycle through -1 (nothing highlighted) … last
      let next = state.activeSuggestion + step;
      if (next > last) next = -1;
      if (next < -1) next = last;
      state.activeSuggestion = next;
      renderSuggestions();
    } else if (e.key === 'Escape') {
      hideSuggestions();
    }
  });

  els.input.addEventListener('blur', () => setTimeout(hideSuggestions, 150));
  document.addEventListener('pointerdown', (e) => {
    if (!els.form.contains(e.target)) hideSuggestions();
  });

  // mousedown (not click) so it fires before the input's blur hides the list
  els.suggestions.addEventListener('mousedown', (e) => {
    const item = e.target.closest('[data-value]');
    if (!item) return;
    e.preventDefault();
    startNewSearch(item.dataset.value);
  });

  els.form.addEventListener('change', (e) => {
    if (e.target.name === 'mode') {
      hideSuggestions();
      if (els.input.value.trim().length >= 2 && state.term) startNewSearch(els.input.value);
    }
  });

  els.quick.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-query]');
    if (chip) startNewSearch(chip.dataset.query, chip.dataset.mode);
  });

  els.sort.addEventListener('change', () => {
    state.orderBy = els.sort.value;
    runSearch({ page: 1 });
  });

  const onYearChange = debounce(() => state.books.length && renderResults(), 250);
  els.yearFrom.addEventListener('input', onYearChange);
  els.yearTo.addEventListener('input', onYearChange);
  els.clearYears.addEventListener('click', () => {
    els.yearFrom.value = '';
    els.yearTo.value = '';
    renderResults();
  });

  els.pagination.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-page]');
    if (!btn || btn.disabled) return;
    const page = Number(btn.dataset.page);
    if (page >= 1 && page <= totalPages() && page !== state.page) runSearch({ page, scroll: true });
  });

  // Result cards: details / favourite / retry (event delegation)
  els.results.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const { action } = actionEl.dataset;
    if (action === 'retry') return runSearch({ page: state.page });

    const card = actionEl.closest('[data-book-id]');
    const book = card && state.bookIndex.get(card.dataset.bookId);
    if (!book) return;
    if (action === 'details') openModal(book);
    if (action === 'favorite') toggleFavorite(book);
  });

  // Favourites drawer
  els.favToggle.addEventListener('click', () => (drawerIsOpen() ? closeDrawer() : openDrawer()));
  els.closeDrawer.addEventListener('click', closeDrawer);
  els.overlay.addEventListener('click', closeDrawer);
  els.favList.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-action]');
    const item = e.target.closest('[data-book-id]');
    if (!actionEl || !item) return;
    const book = store.getFavoriteById(item.dataset.bookId);
    if (!book) return;

    if (actionEl.dataset.action === 'open-favorite') openModal(book);
    if (actionEl.dataset.action === 'remove-favorite') {
      store.removeFavorite(book.id);
      refreshFavoriteButtons();
      announce(`Removed “${book.title}” from My Shelf`);
    }
  });

  // Modal
  els.modal.addEventListener('click', (e) => {
    if (e.target === els.modal) return closeModal(); // backdrop click
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl || !state.modalBook) return;
    if (actionEl.dataset.action === 'close-modal') closeModal();
    if (actionEl.dataset.action === 'favorite') toggleFavorite(state.modalBook);
  });
  els.modal.addEventListener('close', () => (state.modalBook = null));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawerIsOpen() && !els.modal.open) closeDrawer();
    if (e.key === '/' && document.activeElement !== els.input && !e.target.matches('input, textarea, select')) {
      e.preventDefault();
      els.input.focus();
    }
  });

  // Theme
  els.themeToggle.addEventListener('click', () => {
    const dark = document.documentElement.classList.toggle('dark');
    store.saveTheme(dark ? 'dark' : 'light');
  });

  // Broken cover images (error events don't bubble, so listen in the capture phase)
  document.addEventListener('error', handleBrokenCover, true);

  // Keep favourites in sync if the app is open in two tabs
  window.addEventListener('storage', (e) => e.key === 'shelfwise:favorites' && refreshFavoriteButtons());
}

/* ---------- Boot ---------- */

bindEvents();
renderFavorites();
restoreFromUrl();
