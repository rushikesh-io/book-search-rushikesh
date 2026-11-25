/**
 * storage.js — favourites ("My Shelf") and theme persisted in localStorage.
 * All access is wrapped in try/catch because storage can be disabled
 * (private mode, blocked cookies) and the app must keep working anyway.
 */

const FAVORITES_KEY = 'shelfwise:favorites';
const THEME_KEY = 'shelfwise:theme';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** @returns {object[]} saved books, newest first */
export function getFavorites() {
  const list = read(FAVORITES_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function isFavorite(id) {
  return getFavorites().some((book) => book.id === id);
}

export function addFavorite(book) {
  if (isFavorite(book.id)) return getFavorites();
  const list = [{ ...book, savedAt: Date.now() }, ...getFavorites()];
  write(FAVORITES_KEY, list);
  return list;
}

export function removeFavorite(id) {
  const list = getFavorites().filter((book) => book.id !== id);
  write(FAVORITES_KEY, list);
  return list;
}

/** Add if missing, remove if present. @returns {boolean} the new saved state */
export function toggleFavorite(book) {
  if (isFavorite(book.id)) {
    removeFavorite(book.id);
    return false;
  }
  addFavorite(book);
  return true;
}

export function getFavoriteById(id) {
  return getFavorites().find((book) => book.id === id) || null;
}

export function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore — theme just won't persist */
  }
}
