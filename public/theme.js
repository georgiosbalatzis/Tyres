// Light is the default; a saved "dark" choice is applied before first paint (loaded blocking in <head>).
// Plain script, not a module, so it runs before the stylesheet paints. The CSP allows same-origin scripts only.
(() => {
  const root = document.documentElement;
  const COLORS = { light: '#e9e3d6', dark: '#242321' };
  const apply = (theme) => {
    if (theme === 'dark') root.dataset.theme = 'dark';
    else delete root.dataset.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[theme]);
    for (const b of document.querySelectorAll('[data-theme-toggle]'))
      b.setAttribute('aria-pressed', String(theme === 'dark'));
  };
  let saved = null;
  try {
    saved = localStorage.getItem('theme');
  } catch {}
  if (saved === 'dark') root.dataset.theme = 'dark';
  document.addEventListener('DOMContentLoaded', () =>
    apply(root.dataset.theme === 'dark' ? 'dark' : 'light'),
  );
  document.addEventListener('click', (e) => {
    if (!(e.target instanceof Element) || !e.target.closest('[data-theme-toggle]')) return;
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    apply(next);
    try {
      localStorage.setItem('theme', next);
    } catch {}
  });
})();
