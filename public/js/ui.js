/**
 * ui.js — pure rendering helpers. These functions build markup from data;
 * they don't fetch anything or keep state (that lives in app.js).
 */

/** Escape text before putting it into innerHTML — API data is untrusted. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function truncate(text, max) {
  if (!text || text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

export const formatNumber = (n) => new Intl.NumberFormat('en-IN').format(n);

/* ---------- Icons ---------- */

const ICONS = {
  bookmark: (filled) =>
    `<svg viewBox="0 0 24 24" class="h-5 w-5" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linejoin="round" d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg>`,
  close: `<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" d="M6 6l12 12M18 6 6 18"/></svg>`,
  external: `<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>`,
};

/* ---------- Covers ---------- */

/** Warm, deterministic colour per title so placeholder covers look intentional. */
function coverHue(title) {
  let hash = 0;
  for (const ch of title) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  return hash;
}

/** A styled "blank cover" used when a book has no image (or the image fails). */
export function placeholderCover(book, size = 'md') {
  const hue = coverHue(book.title);
  const text = size === 'sm' ? 'text-[9px]' : 'text-sm';
  return `
    <div class="flex h-full w-full flex-col justify-between p-3 text-left text-white"
      style="background:linear-gradient(150deg,hsl(${hue} 45% 42%),hsl(${(hue + 40) % 360} 50% 28%))">
      <span class="font-display ${text} font-bold leading-tight line-clamp-4">${escapeHtml(book.title)}</span>
      ${size === 'sm' ? '' : `<span class="text-[11px] opacity-80 line-clamp-1">${escapeHtml(book.authors[0])}</span>`}
    </div>`;
}

function coverMarkup(book, size = 'md') {
  if (!book.cover) return placeholderCover(book, size);
  return `<img src="${escapeHtml(book.cover)}" alt="Cover of ${escapeHtml(book.title)}" loading="lazy"
    data-cover-id="${escapeHtml(book.id)}" class="h-full w-full object-cover" />`;
}

/* ---------- Book cards ---------- */

export function bookCard(book, saved, index = 0) {
  const authors = book.authors.join(', ');
  const description = book.description ? truncate(book.description, 160) : 'No description available for this book.';

  return `
  <article class="card group flex flex-col overflow-hidden animate-fade-up" style="animation-delay:${Math.min(index, 11) * 35}ms" data-book-id="${escapeHtml(book.id)}">
    <div class="relative flex gap-4 p-4">
      <button type="button" data-action="details" class="relative h-36 w-24 shrink-0 overflow-hidden rounded-lg bg-paper-200 shadow-book ring-1 ring-black/5 transition group-hover:-translate-y-0.5 dark:bg-ink-800"
        aria-label="View details for ${escapeHtml(book.title)}" data-cover-wrap>
        ${coverMarkup(book)}
      </button>
      <div class="min-w-0 flex-1">
        <h3 class="font-display text-lg font-bold leading-snug line-clamp-2">
          <button type="button" data-action="details" class="text-left hover:text-clay-600 dark:hover:text-clay-300">${escapeHtml(book.title)}</button>
        </h3>
        <p class="mt-1 text-sm text-ink-600 line-clamp-2 dark:text-paper-300">by ${escapeHtml(authors)}</p>
        <dl class="mt-3 space-y-1 text-xs text-ink-500 dark:text-paper-300">
          <div class="flex gap-1"><dt class="font-semibold">Year:</dt><dd>${book.year ?? '—'}</dd></div>
          <div class="flex gap-1"><dt class="font-semibold">Publisher:</dt><dd class="line-clamp-1">${escapeHtml(book.publisher)}</dd></div>
        </dl>
      </div>
      <button type="button" data-action="favorite" aria-pressed="${saved}"
        class="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full transition ${saved ? 'bg-clay-500 text-white' : 'bg-paper-100 text-ink-600 hover:text-clay-600 dark:bg-ink-800 dark:text-paper-200'}"
        aria-label="${saved ? 'Remove from' : 'Add to'} My Shelf">${ICONS.bookmark(saved)}</button>
    </div>
    <p class="flex-1 px-4 text-sm leading-relaxed text-ink-700 line-clamp-3 dark:text-paper-200">${escapeHtml(description)}</p>
    <div class="mt-4 flex items-center gap-2 border-t border-paper-200 p-3 dark:border-ink-800">
      <button type="button" data-action="details" class="btn-ghost flex-1 py-2">Details</button>
      ${
        book.previewLink
          ? `<a href="${escapeHtml(book.previewLink)}" target="_blank" rel="noopener noreferrer" class="btn-primary flex-1 py-2">Preview ${ICONS.external}</a>`
          : `<span class="btn flex-1 cursor-not-allowed border border-dashed border-paper-300 py-2 text-ink-500 dark:border-ink-700">No preview</span>`
      }
    </div>
  </article>`;
}

export function skeletonCards(count = 8) {
  const one = `
    <div class="card overflow-hidden p-4" aria-hidden="true">
      <div class="flex gap-4">
        <div class="relative h-36 w-24 overflow-hidden rounded-lg bg-paper-200 dark:bg-ink-800"><div class="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/10"></div></div>
        <div class="flex-1 space-y-3 pt-1">
          <div class="h-4 w-4/5 rounded bg-paper-200 dark:bg-ink-800"></div>
          <div class="h-3 w-3/5 rounded bg-paper-200 dark:bg-ink-800"></div>
          <div class="h-3 w-2/5 rounded bg-paper-200 dark:bg-ink-800"></div>
        </div>
      </div>
      <div class="mt-4 space-y-2"><div class="h-3 rounded bg-paper-200 dark:bg-ink-800"></div><div class="h-3 w-11/12 rounded bg-paper-200 dark:bg-ink-800"></div></div>
      <div class="mt-5 h-9 rounded-xl bg-paper-200 dark:bg-ink-800"></div>
    </div>`;
  return one.repeat(count);
}

/* ---------- Status messages ---------- */

export function loadingMessage(term) {
  return `
    <div class="mb-6 flex items-center justify-center gap-3 text-sm text-ink-600 dark:text-paper-300" role="status">
      <span class="h-5 w-5 animate-spin rounded-full border-2 border-clay-500 border-t-transparent"></span>
      Searching the shelves for “${escapeHtml(term)}”…
    </div>`;
}

/**
 * @param {'empty'|'error'|'welcome'|'filtered'} kind
 */
export function statusMessage(kind, text) {
  const styles = {
    empty: { emoji: '📚', title: 'No books found. Please try another search.' },
    filtered: { emoji: '🗓️', title: 'No books on this page match those years.' },
    error: { emoji: '⚠️', title: 'Something went wrong' },
    welcome: { emoji: '✨', title: 'Start by searching for a book or author' },
  }[kind];

  return `
    <div class="mx-auto max-w-md rounded-3xl border border-dashed border-paper-300 px-6 py-12 text-center dark:border-ink-700" ${kind === 'error' ? 'role="alert"' : ''}>
      <div class="text-4xl" aria-hidden="true">${styles.emoji}</div>
      <p class="mt-3 font-display text-xl font-bold">${escapeHtml(styles.title)}</p>
      ${text ? `<p class="mt-2 text-sm text-ink-600 dark:text-paper-300">${escapeHtml(text)}</p>` : ''}
      ${kind === 'error' ? `<button type="button" data-action="retry" class="btn-primary mt-5">Try again</button>` : ''}
    </div>`;
}

/* ---------- Pagination ---------- */

/** Page numbers with ellipses, e.g. 1 … 4 5 [6] 7 8 … 42 */
function pageWindow(current, totalPages) {
  const pages = new Set([1, totalPages, current - 1, current, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (current >= totalPages - 2) [totalPages - 3, totalPages - 2, totalPages - 1].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
}

export function pagination(current, totalPages) {
  if (totalPages <= 1) return '';
  const base = 'grid h-10 min-w-[2.5rem] place-items-center rounded-xl px-3 text-sm font-semibold transition';
  const idle = 'border border-paper-300 bg-white hover:border-clay-400 hover:text-clay-600 dark:border-ink-700 dark:bg-ink-900 dark:hover:text-clay-300';

  const pages = pageWindow(current, totalPages)
    .map((p) =>
      p === '…'
        ? `<span class="px-1 text-ink-500" aria-hidden="true">…</span>`
        : `<button type="button" data-page="${p}" class="${base} ${p === current ? 'bg-clay-500 text-white' : idle}" ${p === current ? 'aria-current="page"' : ''} aria-label="Page ${p}">${p}</button>`
    )
    .join('');

  return `
    <button type="button" data-page="${current - 1}" class="${base} ${idle} disabled:pointer-events-none disabled:opacity-40" ${current === 1 ? 'disabled' : ''} aria-label="Previous page">‹ <span class="hidden sm:inline">&nbsp;Prev</span></button>
    ${pages}
    <button type="button" data-page="${current + 1}" class="${base} ${idle} disabled:pointer-events-none disabled:opacity-40" ${current === totalPages ? 'disabled' : ''} aria-label="Next page"><span class="hidden sm:inline">Next&nbsp;</span> ›</button>`;
}

/* ---------- Suggestions ---------- */

export function suggestionItems(list, term, activeIndex) {
  const pattern = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
  return list
    .map((text, i) => {
      const highlighted = escapeHtml(text).replace(pattern, '<mark class="bg-transparent font-bold text-clay-600 dark:text-clay-300">$1</mark>');
      return `<li id="suggestion-${i}" role="option" aria-selected="${i === activeIndex}" data-value="${escapeHtml(text)}"
        class="cursor-pointer truncate rounded-xl px-3 py-2 text-sm ${i === activeIndex ? 'bg-paper-100 dark:bg-ink-800' : ''} hover:bg-paper-100 dark:hover:bg-ink-800">${highlighted}</li>`;
    })
    .join('');
}

/* ---------- Favourites drawer ---------- */

export function favoritesList(favorites) {
  if (!favorites.length) {
    return `
      <li class="px-4 py-16 text-center">
        <div class="text-4xl" aria-hidden="true">🔖</div>
        <p class="mt-3 font-display text-lg font-bold">Your shelf is empty</p>
        <p class="mt-1 text-sm text-ink-600 dark:text-paper-300">Tap the bookmark on any book to save it here.</p>
      </li>`;
  }

  return favorites
    .map(
      (book) => `
      <li class="card flex items-center gap-3 p-3" data-book-id="${escapeHtml(book.id)}">
        <button type="button" data-action="open-favorite" class="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label="Open details for ${escapeHtml(book.title)}">
          <span class="block h-20 w-14 shrink-0 overflow-hidden rounded-md bg-paper-200 shadow-book dark:bg-ink-800" data-cover-wrap>${coverMarkup(book, 'sm')}</span>
          <span class="min-w-0">
            <span class="block font-display font-bold leading-snug line-clamp-2 hover:text-clay-600 dark:hover:text-clay-300">${escapeHtml(book.title)}</span>
            <span class="mt-0.5 block text-xs text-ink-600 line-clamp-1 dark:text-paper-300">${escapeHtml(book.authors.join(', '))}</span>
            <span class="mt-0.5 block text-xs text-ink-500">${book.year ?? 'Year unknown'}</span>
          </span>
        </button>
        <button type="button" data-action="remove-favorite" class="icon-btn h-9 w-9 shrink-0 hover:!border-red-400 hover:!text-red-600" aria-label="Remove ${escapeHtml(book.title)} from My Shelf">${ICONS.trash}</button>
      </li>`
    )
    .join('');
}

/* ---------- Details modal ---------- */

export function bookDetails(book, saved) {
  const meta = [
    ['Author(s)', book.authors.join(', ')],
    ['Published', book.publishedDate || 'Unknown'],
    ['Publisher', book.publisher],
    ['Pages', book.pageCount ?? '—'],
    ['Category', book.categories[0] || '—'],
    ['Rating', book.rating ? `${book.rating} / 5` : '—'],
  ];

  return `
    <div class="relative grid gap-6 p-6 sm:grid-cols-[180px_1fr] sm:p-8">
      <button type="button" data-action="close-modal" class="icon-btn absolute right-4 top-4" aria-label="Close details">${ICONS.close}</button>
      <div class="mx-auto h-64 w-44 overflow-hidden rounded-xl bg-paper-200 shadow-book sm:mx-0 dark:bg-ink-800" data-cover-wrap>${coverMarkup(book)}</div>
      <div class="min-w-0">
        <h2 id="modalTitle" class="pr-10 font-display text-2xl font-bold leading-tight sm:text-3xl">${escapeHtml(book.title)}</h2>
        ${book.subtitle ? `<p class="mt-1 text-ink-600 dark:text-paper-300">${escapeHtml(book.subtitle)}</p>` : ''}
        <dl class="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          ${meta
            .map(
              ([label, value]) => `<div class="min-w-0"><dt class="text-xs font-semibold uppercase tracking-wide text-ink-500">${label}</dt><dd class="mt-0.5 break-words">${escapeHtml(value)}</dd></div>`
            )
            .join('')}
        </dl>
        <div class="mt-6 flex flex-wrap gap-2">
          <button type="button" data-action="favorite" aria-pressed="${saved}" class="${saved ? 'btn-primary' : 'btn-ghost'}">
            ${ICONS.bookmark(saved)} ${saved ? 'On My Shelf — Remove' : 'Add to My Shelf'}
          </button>
          ${book.previewLink ? `<a href="${escapeHtml(book.previewLink)}" target="_blank" rel="noopener noreferrer" class="btn-ghost">${book.source === 'openlibrary' ? 'View on Open Library' : 'Preview on Google Books'} ${ICONS.external}</a>` : ''}
        </div>
      </div>
      <div class="sm:col-span-2">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-ink-500">About this book</h3>
        <p class="mt-2 whitespace-pre-line leading-relaxed text-ink-700 dark:text-paper-200">${escapeHtml(truncate(book.description, 1200) || 'No description available.')}</p>
      </div>
    </div>`;
}
