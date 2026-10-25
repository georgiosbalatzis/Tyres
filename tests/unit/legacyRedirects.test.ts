import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { onTestFinished, test } from 'vitest';
import {
  LEGACY_BASE,
  notFoundPage,
  pageFor,
  routes,
  TARGET,
  writeSite,
} from '../../scripts/legacy-redirects.ts';

// Runs a compatibility page's own script against a fake location; returns where it navigates.
function navigate(html: string, { pathname = LEGACY_BASE, search = '', hash = '' } = {}): string | null {
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? '';
  let destination: string | null = null;
  const location = {
    pathname,
    search,
    hash,
    replace: (url: string) => {
      destination = url;
    },
  };
  vm.runInNewContext(script, { location, document: { addEventListener: () => {} } });
  return destination;
}

function tmp(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  onTestFinished(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('every page of the new build gets a page that keeps path, query and hash', () => {
  const html = pageFor({ route: '2026/austin/', noindex: false });
  assert.match(html, new RegExp(`<link rel="canonical" href="${TARGET}2026/austin/">`));
  assert.doesNotMatch(html, /noindex/);
  assert.equal(
    navigate(html, { search: '?y=2026&d1=1', hash: '#replay' }),
    `${TARGET}2026/austin/?y=2026&d1=1#replay`,
  );
  assert.equal(navigate(html), `${TARGET}2026/austin/`);
  assert.equal(
    navigate(html, { search: '?q=%CE%A4%26x&a=1%26b' }),
    `${TARGET}2026/austin/?q=%CE%A4%26x&a=1%26b`,
  );
});

test('without JavaScript the page refreshes to the same page and shows a working link', () => {
  const html = pageFor({ route: '', noindex: false });
  assert.match(
    html,
    new RegExp(`<noscript><meta http-equiv="refresh" content="0;url=${TARGET}"></noscript>`),
  );
  assert.match(html, new RegExp(`<a id="destination" href="${TARGET}">`));
  assert.ok(html.indexOf('<script>') < html.indexOf('<noscript>'));
});

test('pages that are noindex on f1-stories.gr stay noindex', () => {
  assert.match(
    pageFor({ route: 'embed/el/2026/austin/compounds/', noindex: true }),
    /<meta name="robots" content="noindex">/,
  );
});

test('other old paths go to the same page when it exists, else to the landing page; never off the tool', () => {
  const html = notFoundPage([{ route: '' }, { route: '2026/austin/' }]);
  const go = (pathname: string, extra = {}) => navigate(html, { pathname, ...extra });
  assert.equal(go(`${LEGACY_BASE}2026/austin/`), `${TARGET}2026/austin/`);
  assert.equal(
    go(`${LEGACY_BASE.toLowerCase()}2026/AUSTIN`, { search: '?a=1', hash: '#x' }),
    `${TARGET}2026/austin/?a=1#x`,
  );
  assert.equal(go(`${LEGACY_BASE}2026/unknown/`, { search: '?a=1' }), `${TARGET}?a=1`);
  assert.equal(go('/somewhere-else/'), TARGET);
  assert.equal(go(`${LEGACY_BASE}//evil.example/`), TARGET);
  assert.match(html, /<meta name="robots" content="noindex">/);
});

test('a destination outside the tool on f1-stories.gr is refused', () => {
  const html = pageFor({ route: '', noindex: false }).replace(
    `"${TARGET}"+location.search`,
    '"https://evil.example/"+location.search',
  );
  assert.equal(navigate(html), TARGET);
});

test('the site keeps every non-page file, replaces every page and adds 404.html and .nojekyll', () => {
  const dir = tmp('legacy-build-');
  const out = tmp('legacy-out-');
  const write = (rel: string, data: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), data);
  };
  write('index.html', '<html><head><link rel="canonical" href="x"></head></html>');
  write('2026/austin/index.html', '<html><head><title>race</title></head></html>');
  write(
    'embed/el/2026/austin/compounds/index.html',
    '<html><head><meta name="robots" content="noindex"></head></html>',
  );
  write('404.html', '<html>not found</html>');
  write('og/2026/austin.png', 'png');
  write('data/manifest.json', '{}');
  write('assets/app.js.map', '{}');
  assert.deepEqual(routes(dir), [
    { route: '', noindex: false },
    { route: '2026/austin/', noindex: false },
    { route: 'embed/el/2026/austin/compounds/', noindex: true },
  ]);
  assert.deepEqual(writeSite(dir, out), { pages: 3, files: 7 });
  assert.equal(fs.readFileSync(path.join(out, 'og/2026/austin.png'), 'utf8'), 'png');
  assert.ok(!fs.existsSync(path.join(out, 'assets/app.js.map')));
  assert.ok(fs.existsSync(path.join(out, '.nojekyll')));
  assert.match(fs.readFileSync(path.join(out, '404.html'), 'utf8'), /"2026\/austin\/"/);
});
