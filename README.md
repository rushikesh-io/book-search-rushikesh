# 📚 Shelfwise — Book Finder

A clean, responsive web app to **search books by title or author**, view their details, and keep favourites on a personal shelf.
Built with **HTML, Tailwind CSS and vanilla JavaScript (ES modules)** — no frameworks.

**🔗 Live demo:** https://shelfwise-book-finder.netlify.app

---

## ✨ Features

### Core
- 🔎 **Search** by *Anything*, *Title* (`intitle:`) or *Author* (`inauthor:`)
- 📖 Each book shows **title, author(s), cover, published year, publisher, short description and preview link**
- ⏳ **Loading indicator** (spinner + skeleton cards) while the API request is running
- 🚫 Friendly empty state: **"No books found. Please try another search."**
- 🔖 **My Shelf (favourites)** saved in `localStorage`
  - click a saved book to open its full details again
  - remove button for each saved book
  - stays in sync across browser tabs
- 📱 Fully **responsive** (mobile → desktop)
- 🛡️ All API calls wrapped in `try/catch` with readable error messages and a **Try again** button

### Bonus
- 🗓️ **Filter by publish year** (from / to range)
- 📄 **Pagination** with page numbers (12 books per page)
- 🌗 **Dark / Light mode** toggle (remembers your choice, respects system preference)
- 🔢 **Total number of results** shown
- 💡 **Search suggestions** (debounced autocomplete with keyboard navigation ↑ ↓ Enter Esc)

### Extras
- ↕️ Sort by *Most relevant* or *Newest*
- 🔗 Shareable URLs — the search is stored in the address bar (`?q=dune&by=title`)
- 🔁 **Automatic API fallback:** keyless Google Books requests share a global daily quota.
  If Google answers `429 Quota exceeded`, the app switches to the free **Open Library API** so search keeps working.
- 🖼️ Generated placeholder covers when a book has no image
- ♿ Accessible: semantic HTML, ARIA live regions, focus styles, `<dialog>` modal, `/` shortcut to focus search
- 🔒 All API text is HTML-escaped before rendering (XSS-safe)

---

## 🛠️ Tech Stack

| Layer   | Tool |
|---------|------|
| Markup  | HTML5 |
| Styling | Tailwind CSS 3 (compiled with the Tailwind CLI) |
| Logic   | Vanilla JavaScript (ES modules) |
| Data    | [Google Books API](https://developers.google.com/books) · fallback [Open Library API](https://openlibrary.org/developers/api) |
| Hosting | Netlify |

## 📁 Project Structure

```
├── public/                 # Everything that gets deployed
│   ├── index.html
│   ├── css/styles.css      # Compiled Tailwind output (generated)
│   └── js/
│       ├── app.js          # State + event wiring
│       ├── api.js          # API calls, data normalisation, fallback
│       ├── storage.js      # localStorage: favourites + theme
│       └── ui.js           # Pure rendering helpers (cards, modal, pagination…)
├── src/input.css           # Tailwind source (custom components)
├── tailwind.config.js      # Theme: colours, fonts, animations
├── netlify.toml            # Netlify build settings
└── package.json
```

## 🚀 Run Locally

```bash
npm install
npm run build     # compile Tailwind -> public/css/styles.css
npm start         # serve at http://localhost:5173
```

While editing styles, run `npm run dev` to rebuild CSS on every change.

## ☁️ Deploy on Netlify

1. Push this repository to GitHub.
2. On Netlify: **Add new site → Import an existing project → GitHub** and pick this repo.
3. Netlify reads `netlify.toml` automatically (build: `npm run build`, publish: `public`). Click **Deploy**.

> Quick alternative: drag the `public/` folder onto <https://app.netlify.com/drop>.

## 📡 API Reference

```
GET https://www.googleapis.com/books/v1/volumes?q=intitle:dune&startIndex=0&maxResults=12
GET https://openlibrary.org/search.json?title=dune&page=1&limit=12      (fallback)
```

No API key is required.

## 📄 License

MIT
