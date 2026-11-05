// Applies the theme before first paint, so nobody sees a flash of the other one.
// Loaded as a blocking same-origin script because the CSP forbids inline scripts.
// Must stay in sync with STORAGE_KEY and resolveTheme in src/theme/ThemeProvider.tsx:
// a saved "light" or "dark" wins, otherwise the device setting decides (D21).
(function () {
  var theme = 'light';
  try {
    var saved = window.localStorage.getItem('financier.theme');
    if (saved === 'light' || saved === 'dark') theme = saved;
    else if (window.matchMedia('(prefers-color-scheme: dark)').matches) theme = 'dark';
  } catch {
    // Storage or matchMedia unavailable: keep light.
  }
  document.documentElement.dataset.theme = theme;
})();
