// Applies the saved theme before first paint, so light-theme users don't see a
// dark flash. Loaded as a blocking same-origin script because the CSP forbids
// inline scripts. Must stay in sync with STORAGE_KEY in src/theme/ThemeProvider.tsx.
try {
  if (window.localStorage.getItem('financier.theme') === 'light') {
    document.documentElement.dataset.theme = 'light';
  }
} catch {
  // Storage unavailable: keep the dark default.
}
