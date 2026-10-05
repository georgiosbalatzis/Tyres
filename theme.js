// Mirrors f1StoriesPage/scripts/theme-init.js: stored 'f1stories-theme' → OS preference → dark.
// Shared with Telemetry, Ghost Car and BetCast (same github.io origin). Written only when the reader presses the toggle.
// Plain script loaded blocking in <head> so the right theme paints first; the CSP allows same-origin scripts only.
(() => {
  const root = document.documentElement;
  const KEY = 'f1stories-theme';
  const LEGACY = 'theme'; // this app's pre-redesign key: copied once when KEY is absent, then removed
  const BG = { light: '#f2eee4', dark: '#1b1a19' };
  const valid = (v) => v === 'light' || v === 'dark';
  let stored = null;
  try {
    stored = localStorage.getItem(KEY);
    const legacy = localStorage.getItem(LEGACY);
    if (valid(legacy)) {
      if (stored === null) {
        localStorage.setItem(KEY, legacy);
        stored = legacy;
      }
      localStorage.removeItem(LEGACY);
    }
  } catch {}
  const apply = (theme) => {
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BG[theme]);
    for (const b of document.querySelectorAll('[data-theme-toggle]'))
      b.setAttribute('aria-pressed', String(theme === 'dark'));
  };
  apply(valid(stored) ? stored : matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  document.addEventListener('DOMContentLoaded', () => apply(root.dataset.theme));
  document.addEventListener('click', (e) => {
    if (!(e.target instanceof Element) || !e.target.closest('[data-theme-toggle]')) return;
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    apply(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {}
  });
})();
