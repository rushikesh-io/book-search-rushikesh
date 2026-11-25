/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./public/**/*.html', './public/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        paper: { 50: '#fcfaf5', 100: '#f6f1e6', 200: '#ebe2cd', 300: '#dccfb2' },
        ink: { 500: '#6b6456', 600: '#4f493e', 700: '#3a352c', 800: '#26231d', 900: '#1b1915', 950: '#12110e' },
        clay: { 300: '#eea283', 400: '#e07a52', 500: '#cc5f36', 600: '#b04c27', 700: '#8f3d20' },
        moss: { 400: '#8aa77a', 500: '#6d8c5d', 600: '#557147' },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        book: '0 1px 2px rgba(27,25,21,.06), 0 8px 24px -12px rgba(27,25,21,.25)',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'slide-in': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        'fade-up': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      },
      animation: {
        shimmer: 'shimmer 1.4s infinite',
        'fade-up': 'fade-up .35s ease-out both',
      },
    },
  },
  plugins: [],
};
