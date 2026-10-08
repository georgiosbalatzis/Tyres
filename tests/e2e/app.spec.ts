import { expect, type Page, test } from '@playwright/test';

import { BASE, publishedLatest, SEPANG } from './data.ts';

function trackConsole(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

const title = (page: Page) => page.locator('#race-title');

test('prerendered HTML carries the latest race data without JavaScript', async ({ browser, request }) => {
  const { manifest, record } = await publishedLatest(request);
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await expect(title(page)).toHaveText(record.race.name);
  for (const compound of record.compounds ?? [])
    await expect(page.locator('#r-compounds')).toContainText(compound.compound);
  if (record.circuit.lengthKm != null)
    await expect(page.locator('#r-specs')).toContainText(
      new Intl.NumberFormat('el-GR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(
        record.circuit.lengthKm,
      ),
    );
  await expect(page.locator('#r-source a').first()).toHaveAttribute('href', /press\.pirelli\.com/);
  const total = manifest.years.reduce((n, y) => n + y.races.length, 0);
  await expect(page.locator('.archive a')).toHaveCount(total);
  await ctx.close();
});

test('opens on the latest Pirelli preview and loads the 3D view without errors', async ({
  page,
  request,
}) => {
  const { record } = await publishedLatest(request);
  const errors = trackConsole(page);
  const fallbacks: string[] = [];
  page.on('console', (m) => {
    if (m.text().includes('using the procedural car')) fallbacks.push(m.text());
  });
  const model = page.waitForResponse((r) => r.url().endsWith(`${BASE}models/f1car.glb`));
  await page.goto(BASE);
  await expect(title(page)).toHaveText(record.race.name);
  await expect(page.locator('#race')).toHaveValue(record.id);
  await page.locator('#canvas-host').scrollIntoViewIfNeeded();
  await expect(page.locator('#canvas-host canvas')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#canvas-host')).toHaveClass(/has-3d/);
  expect((await model).ok()).toBe(true);
  expect(fallbacks).toEqual([]);
  expect(errors).toEqual([]);
});

test('changing race updates content, URL, title and survives reload and back', async ({ page }) => {
  await page.goto(SEPANG);
  await page.locator('#race').selectOption('2026-az');
  await expect(page).toHaveURL(`${BASE}2026/baku/`);
  await expect(title(page)).toHaveText('Azerbaijan Grand Prix');
  await expect(page).toHaveTitle(
    'TYRES — Azerbaijan Grand Prix 2026: γόμες και απαιτήσεις πίστας | F1 Stories',
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    /Γόμες C3, C4, C5 για το Azerbaijan Grand Prix 2026/,
  );
  await expect(page.locator('#r-compounds')).toContainText('C5');
  await page.reload();
  await expect(title(page)).toHaveText('Azerbaijan Grand Prix');
  await expect(page.locator('#race')).toHaveValue('2026-az');
  await page.goBack();
  await expect(title(page)).toHaveText('Bahrain Grand Prix');
});

test('changing season selects that season’s latest preview', async ({ page }) => {
  await page.goto(SEPANG);
  await page.locator('#year').selectOption('2025');
  // On GPU-less CI runners the 3D view compiles in software right after load and can hold the main
  // thread for a few seconds; allow for it, as the 3D test does.
  await expect(page).toHaveURL(`${BASE}2025/yas-marina/`, { timeout: 15_000 });
  await expect(title(page)).toHaveText('Abu Dhabi Grand Prix');
  await expect(page.locator('#r-ratings')).toContainText('Κάθετη δύναμη');
});

test('previous/next step through races and work as plain links', async ({ page }) => {
  await page.goto(`${BASE}2026/monza/`);
  await expect(page.locator('#next')).toHaveAttribute('href', `${BASE}2026/madring/`);
  await page.locator('#next').click();
  await expect(title(page)).toHaveText('Spanish Grand Prix');
  await expect(page.locator('#r-specs')).toContainText('Δεν δόθηκε'); // Madring has no lap record yet
});

test('query-string state is honoured and normalised to the static path', async ({ page }) => {
  await page.goto(`${BASE}?year=2025&race=marina-bay`);
  await expect(title(page)).toHaveText('Singapore Grand Prix');
  await expect(page).toHaveURL(`${BASE}2025/marina-bay/`);
});

test('invalid URL state falls back to the latest preview with a notice', async ({ page, request }) => {
  const { record } = await publishedLatest(request);
  await page.goto(`${BASE}?year=1999&race=atlantis`);
  await expect(title(page)).toHaveText(record.race.name);
  await expect(page.locator('#notice')).toContainText('1999');
  await page.goto(`${BASE}?year=${record.season}&race=%3Cscript%3E`);
  await expect(title(page)).toHaveText(record.race.name);
});

test('without WebGL the SVG drawing and every value remain available', async ({ page }) => {
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    // @ts-expect-error test override
    HTMLCanvasElement.prototype.getContext = function (type: string, ...rest: unknown[]) {
      return /webgl/.test(type) ? null : orig.call(this, type as '2d', ...(rest as []));
    };
  });
  const errors = trackConsole(page);
  await page.goto(SEPANG);
  await page.locator('#canvas-host').scrollIntoViewIfNeeded();
  await expect(page.locator('#loading-3d')).toContainText('Το 3D δεν είναι διαθέσιμο');
  await expect(page.locator('.fallback-car')).toBeVisible();
  await page.getByRole('button', { name: 'Πίστα', exact: true }).click();
  await expect(page.locator('#r-fallback .fallback-circuit')).toBeVisible();
  await expect(page.locator('#canvas-host canvas')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a missing race file keeps the current race and explains the failure', async ({ page }) => {
  await page.route('**/data/races/2026-az.json', (r) => r.fulfill({ status: 200, body: '{"broken":true}' }));
  await page.goto(SEPANG);
  await page.locator('#race').selectOption('2026-az');
  await expect(page.locator('#notice')).toContainText('Δεν φορτώθηκε');
  await expect(title(page)).toHaveText('Bahrain Grand Prix');
});

test('keyboard users can switch modes, views and tyres', async ({ page }) => {
  await page.goto(SEPANG);
  const circuit = page.getByRole('button', { name: 'Πίστα', exact: true });
  await circuit.focus();
  await page.keyboard.press('Enter');
  await expect(circuit).toHaveAttribute('aria-pressed', 'true');
  const data = page.getByRole('button', { name: 'Πίνακας', exact: true });
  await data.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#r-data table')).toBeVisible();
  await expect(page.locator('#r-data').getByRole('table')).toContainText(
    'Όριο camber στο τέλος της ευθείας, πίσω',
  );
  await page.getByRole('button', { name: 'Μονοθέσιο', exact: true }).click();
  const fl = page.locator('.corner[data-corner="FL"]');
  await fl.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.corner[data-corner="FL"]')).toHaveAttribute('aria-pressed', 'true');
});

test('layout has no horizontal overflow and touch targets are large enough', async ({ page }) => {
  await page.goto(SEPANG);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  for (const sel of [
    '.mode',
    '.chip',
    '.corner',
    '.compound',
    '#race',
    '#year',
    '#prev',
    '.race-desk-nav a',
  ]) {
    const box = await page.locator(sel).first().boundingBox();
    expect(box?.height, sel).toBeGreaterThanOrEqual(44);
  }
});

test('unknown static path falls back gracefully', async ({ page, request }) => {
  const { record } = await publishedLatest(request);
  await page.goto(`${BASE}2031/nowhere/`);
  await expect(title(page)).toHaveText(record.race.name);
});

test('captures reference screenshots', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(BASE);
  await page.locator('#canvas-host').scrollIntoViewIfNeeded();
  await expect(page.locator('#canvas-host')).toHaveClass(/has-3d/, { timeout: 15_000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  await page.screenshot({ path: info.outputPath(`${info.project.name}-latest.png`), fullPage: true });
});

test('the latest choice wins when an earlier race is still loading', async ({ page }) => {
  await page.goto(SEPANG);
  await page.route('**/data/races/2026-az.json', async (r) => {
    await new Promise((res) => setTimeout(res, 1200));
    await r.continue();
  });
  await page.locator('#race').selectOption('2026-az');
  await page.locator('#race').selectOption('2026-bh');
  await page.waitForTimeout(1600);
  await expect(title(page)).toHaveText('Bahrain Grand Prix');
  await expect(page).not.toHaveURL(/baku/);
});

test('tyres mode keeps a selected compound across races', async ({ page }) => {
  await page.goto(SEPANG);
  await page.getByRole('button', { name: 'Ελαστικά', exact: true }).click();
  await page.locator('#race').selectOption('2026-az');
  await expect(page.locator('.compound[aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator('#r-readout')).toContainText('C4');
});

test('every prerendered page has resolved asset URLs', async ({ request }) => {
  for (const path of ['', '2026/baku/', '2025/yas-marina/', '404.html']) {
    const body = await (await request.get(`${BASE}${path}`)).text();
    expect(body, path).not.toContain('__VITE_ASSET__');
    expect(body, path).toMatch(/rel="preload" href="\/Tyres\/assets\/ibm-plex-sans-400-600-[\w-]+\.woff2"/);
    expect(body, path).toMatch(
      /rel="preload" href="\/Tyres\/assets\/ibm-plex-sans-400-600-greek-[\w-]+\.woff2"/,
    );
    expect(body, path).toMatch(/rel="preload" href="\/Tyres\/assets\/barlow-condensed-700-[\w-]+\.woff2"/);
    expect(body, path).toContain('<script src="/Tyres/theme.js"></script>');
  }
});

test('follows the OS and remembers the choice under f1stories-theme', async ({ page }) => {
  const root = page.locator('html');
  const stored = () => page.evaluate(() => localStorage.getItem('f1stories-theme'));
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(SEPANG);
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.reload();
  await expect(root).toHaveAttribute('data-theme', 'light');
  expect(await stored()).toBeNull(); // only the toggle writes
  const toggle = page.getByRole('button', { name: 'Σκούρο θέμα' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(root).toHaveAttribute('data-theme', 'dark');
  expect(await stored()).toBe('dark');
  await page.reload(); // the OS still says light; the stored choice wins
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
});

test('migrates the legacy theme key once and leaves foreign values alone', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('theme', 'dark');
    }
  });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(SEPANG);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(
    await page.evaluate(() => [localStorage.getItem('f1stories-theme'), localStorage.getItem('theme')]),
  ).toEqual(['dark', null]);
  await page.evaluate(() => localStorage.setItem('f1stories-theme', 'auto'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light'); // 'auto' means follow the OS
  expect(await page.evaluate(() => localStorage.getItem('f1stories-theme'))).toBe('auto');
});

test('article embeds keep one height at every width and load without errors', async ({ page }) => {
  const errors = trackConsole(page);
  for (const panel of [
    'summary',
    'compounds',
    'demands',
    'car',
    'setup',
    'circuit',
    'circuit-info',
    'weather',
    '3d',
  ]) {
    const heights: number[] = [];
    for (const width of [300, 968]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${BASE}embed/el/2026/sepang/${panel}/`);
      await page.evaluate(() => document.fonts.ready);
      heights.push(await page.locator('.e').evaluate((e) => Math.ceil(e.getBoundingClientRect().height)));
    }
    expect(heights[0], panel).toBe(heights[1]);
  }
  await expect(page.locator('html')).toHaveAttribute('lang', 'el');
  expect(errors).toEqual([]);
});

test('the Embed dialog copies an iframe snippet for the current race', async ({
  page,
  context,
  isMobile,
}) => {
  test.skip(isMobile, 'The embed tool is desktop-only.');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(SEPANG);
  await page.getByRole('button', { name: 'Ενσωμάτωση' }).click();
  await page.locator('#embed-dialog').getByText('Απαιτήσεις πίστας', { exact: true }).click();
  const copy = page.getByRole('button', { name: 'Αντιγραφή κώδικα' });
  await expect(copy).toBeEnabled();
  await copy.click();
  await expect(page.locator('#embed-status')).toContainText('Αντιγράφηκε');
  const snippet = await page.evaluate(() => navigator.clipboard.readText());
  expect(snippet).toMatch(
    /^<iframe src="http:\/\/localhost:\d+\/Tyres\/embed\/el\/2026\/sepang\/demands\/" title="[^"]+" width="100%" height="\d+"/,
  );
  const height = Number(/height="(\d+)"/.exec(snippet)![1]);
  expect(height).toBeGreaterThan(200);
});

test('the 3D embed loads only on request and keeps its height', async ({ page }) => {
  const errors = trackConsole(page);
  let viewerRequested = false;
  page.on('request', (r) => {
    if (/viewer-.*\.js|f1car\.glb/.test(r.url())) viewerRequested = true;
  });
  await page.goto(`${BASE}embed/el/2026/sepang/3d/`);
  const panel = page.locator('.e');
  const before = await panel.evaluate((e) => Math.ceil(e.getBoundingClientRect().height));
  await page.waitForTimeout(500);
  expect(viewerRequested).toBe(false);
  await page.getByRole('button', { name: 'Προβολή σε 3D' }).click();
  await expect(page.locator('#canvas-host')).toHaveClass(/has-3d/, { timeout: 15_000 });
  expect(await panel.evaluate((e) => Math.ceil(e.getBoundingClientRect().height))).toBe(before);
  await page.getByRole('button', { name: 'Πίστα' }).click();
  await expect(page.locator('#r-readout')).toContainText('km');
  expect(errors).toEqual([]);
});

test('embeds switch to the dark theme with #dark, without a reload or a height change', async ({ page }) => {
  await page.goto(`${BASE}embed/el/2026/sepang/demands/`);
  const root = page.locator('.e-root');
  const height = () => page.locator('.e').evaluate((e) => Math.ceil(e.getBoundingClientRect().height));
  const light = await height();
  await expect(root).toHaveCSS('background-color', 'rgb(242, 238, 228)');
  await page.evaluate(() => {
    (window as Window & { marker?: number }).marker = 1;
    location.hash = 'dark';
  });
  await expect(root).toHaveCSS('background-color', 'rgb(27, 26, 25)');
  expect(await height()).toBe(light);
  expect(await page.evaluate(() => (window as Window & { marker?: number }).marker)).toBe(1);
});

test('the Embed dialog offers a panel image with alt text from the panel', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The embed tool is desktop-only.');
  await page.goto(SEPANG);
  await page.getByRole('button', { name: 'Ενσωμάτωση' }).click();
  const dialog = page.locator('#embed-dialog');
  await dialog.getByText('Εικόνα για social και newsletter').click();
  await expect(page.getByRole('button', { name: 'Αντιγραφή κώδικα' })).toBeEnabled();
  const snippet = await page.locator('#embed-code').inputValue();
  expect(snippet).toMatch(/^<img src="http:\/\/localhost:\d+\/Tyres\/img\/el\/2026\/sepang\/summary\.png"/);
  expect(snippet).toContain('alt="Ελαστικά αγώνα');
  expect(snippet).toContain('Πηγή: Pirelli');
  await expect(page.locator('#embed-download')).toBeVisible();
  await dialog.getByText('Τρισδιάστατη προβολή', { exact: true }).click();
  await expect(dialog.locator('input[value="image"]')).toBeDisabled();
});

test('the season strip shows on the race page and as an embed of constant height', async ({
  page,
  request,
}) => {
  const { record } = await publishedLatest(request);
  await page.goto(BASE);
  const band = page.locator('#r-season');
  await expect(band).toContainText(`Επιλογές γομών, σεζόν ${record.season}`);
  if (record.round != null) await expect(band.locator('th.is-current')).toContainText(`R${record.round}`);
  const heights: number[] = [];
  for (const width of [300, 968]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}embed/el/${record.season}/season/`);
    heights.push(await page.locator('.e').evaluate((e) => Math.ceil(e.getBoundingClientRect().height)));
  }
  expect(heights[0]).toBe(heights[1]);
  await expect(page.locator('caption')).toHaveText(`Επιλογές γομών, σεζόν ${record.season}`);
});

test('the body follows the Race Desk pattern: key figures, underlined tabs, sidebar, archive in the page', async ({
  page,
}) => {
  await page.goto(SEPANG);
  await expect(page.locator('#r-specs .spec')).toHaveCount(6);
  await expect(page.locator('#r-specs .spec-compounds')).toContainText('C3');
  const mode = page.getByRole('button', { name: 'Μονοθέσιο', exact: true });
  await expect(mode).toHaveAttribute('aria-pressed', 'true');
  const [bg, bar] = await mode.evaluate((el) => {
    const cs = getComputedStyle(el);
    return [cs.backgroundColor, cs.borderBottomColor];
  });
  expect(bg).toBe('rgba(0, 0, 0, 0)'); // no ink block: the old selected-tab look
  expect(bar).toBe('rgb(237, 76, 50)'); // 3px --c-signal underline
  await expect(page.locator('.desk-aside .aside-title')).toHaveText('Δελτίο ελαστικών');
  await expect(page.locator('main .archive a').first()).toBeVisible(); // the archive moved out of the footer
  await expect(page.locator('footer .archive')).toHaveCount(0);
  // Panels are unboxed: no bordered cards.
  for (const sel of ['.compound', '.corner', '.chip', '.mode']) {
    const widths = await page
      .locator(sel)
      .first()
      .evaluate((el) => {
        const cs = getComputedStyle(el);
        return [cs.borderTopWidth, cs.borderLeftWidth, cs.borderRightWidth];
      });
    expect(widths, sel).toEqual(['0px', '0px', '0px']);
  }
});
