import { expect, type Page, test } from '@playwright/test';

const BASE = '/Tyres/';

function trackConsole(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

const title = (page: Page) => page.locator('#race-title');

test('prerendered HTML carries the full race data without JavaScript', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await expect(title(page)).toHaveText('Bahrain Grand Prix');
  await expect(page.locator('#r-specs')).toContainText('5.543');
  await expect(page.locator('#r-compounds')).toContainText('C2');
  await expect(page.locator('#r-source a').first()).toHaveAttribute('href', /press\.pirelli\.com/);
  const manifest = await (await page.request.get(`${BASE}data/manifest.json`)).json();
  const total = manifest.years.reduce((n: number, y: { races: unknown[] }) => n + y.races.length, 0);
  await expect(page.locator('.archive a')).toHaveCount(total);
  await ctx.close();
});

test('opens on the latest Pirelli preview and loads the 3D view without errors', async ({ page }) => {
  const errors = trackConsole(page);
  const fallbacks: string[] = [];
  page.on('console', (m) => {
    if (m.text().includes('using the procedural car')) fallbacks.push(m.text());
  });
  const model = page.waitForResponse((r) => r.url().endsWith(`${BASE}models/f1car.glb`));
  await page.goto(BASE);
  await expect(title(page)).toHaveText('Bahrain Grand Prix');
  await expect(page.locator('#race')).toHaveValue('2026-bh');
  await page.locator('#canvas-host').scrollIntoViewIfNeeded();
  await expect(page.locator('#canvas-host canvas')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#canvas-host')).toHaveClass(/has-3d/);
  expect((await model).ok()).toBe(true);
  expect(fallbacks).toEqual([]);
  expect(errors).toEqual([]);
});

test('changing race updates content, URL, title and survives reload and back', async ({ page }) => {
  await page.goto(BASE);
  await page.locator('#race').selectOption('2026-az');
  await expect(page).toHaveURL(`${BASE}2026/baku/`);
  await expect(title(page)).toHaveText('Azerbaijan Grand Prix');
  await expect(page).toHaveTitle(/Azerbaijan Grand Prix 2026/);
  await expect(page.locator('#r-compounds')).toContainText('C5');
  await page.reload();
  await expect(title(page)).toHaveText('Azerbaijan Grand Prix');
  await expect(page.locator('#race')).toHaveValue('2026-az');
  await page.goBack();
  await expect(title(page)).toHaveText('Bahrain Grand Prix');
});

test('changing season selects that season’s latest preview', async ({ page }) => {
  await page.goto(BASE);
  await page.locator('#year').selectOption('2025');
  await expect(page).toHaveURL(`${BASE}2025/yas-marina/`);
  await expect(title(page)).toHaveText('Abu Dhabi Grand Prix');
  await expect(page.locator('#r-ratings')).toContainText('Downforce');
});

test('previous/next step through races and work as plain links', async ({ page }) => {
  await page.goto(`${BASE}2026/monza/`);
  await expect(page.locator('#next')).toHaveAttribute('href', `${BASE}2026/madring/`);
  await page.locator('#next').click();
  await expect(title(page)).toHaveText('Spanish Grand Prix');
  await expect(page.locator('#r-specs')).toContainText('Not provided'); // Madring has no lap record yet
});

test('query-string state is honoured and normalised to the static path', async ({ page }) => {
  await page.goto(`${BASE}?year=2025&race=marina-bay`);
  await expect(title(page)).toHaveText('Singapore Grand Prix');
  await expect(page).toHaveURL(`${BASE}2025/marina-bay/`);
});

test('invalid URL state falls back to the latest preview with a notice', async ({ page }) => {
  await page.goto(`${BASE}?year=1999&race=atlantis`);
  await expect(title(page)).toHaveText('Bahrain Grand Prix');
  await expect(page.locator('#notice')).toContainText('1999');
  await page.goto(`${BASE}?year=2026&race=%3Cscript%3E`);
  await expect(title(page)).toHaveText('Bahrain Grand Prix');
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
  await page.goto(BASE);
  await page.locator('#canvas-host').scrollIntoViewIfNeeded();
  await expect(page.locator('#loading-3d')).toContainText('3D view unavailable');
  await expect(page.locator('.fallback-car')).toBeVisible();
  await page.getByRole('button', { name: 'circuit' }).click();
  await expect(page.locator('.fallback-circuit')).toBeVisible();
  await expect(page.locator('#canvas-host canvas')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a missing race file keeps the current race and explains the failure', async ({ page }) => {
  await page.route('**/data/races/2026-az.json', (r) => r.fulfill({ status: 200, body: '{"broken":true}' }));
  await page.goto(BASE);
  await page.locator('#race').selectOption('2026-az');
  await expect(page.locator('#notice')).toContainText('Couldn’t load');
  await expect(title(page)).toHaveText('Bahrain Grand Prix');
});

test('keyboard users can switch modes, views and tyres', async ({ page }) => {
  await page.goto(BASE);
  const circuit = page.getByRole('button', { name: 'circuit', exact: true });
  await circuit.focus();
  await page.keyboard.press('Enter');
  await expect(circuit).toHaveAttribute('aria-pressed', 'true');
  const data = page.getByRole('button', { name: 'data', exact: true });
  await data.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#r-data table')).toBeVisible();
  await expect(page.getByRole('table')).toContainText('Camber limit, rear');
  await page.getByRole('button', { name: 'car', exact: true }).click();
  const fl = page.locator('.corner[data-corner="FL"]');
  await fl.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.corner[data-corner="FL"]')).toHaveAttribute('aria-pressed', 'true');
});

test('layout has no horizontal overflow and touch targets are large enough', async ({ page }) => {
  await page.goto(BASE);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  for (const sel of ['.mode', '.chip', '.corner', '.compound', '#race', '#year']) {
    const box = await page.locator(sel).first().boundingBox();
    expect(box?.height, sel).toBeGreaterThanOrEqual(40);
  }
});

test('unknown static path falls back gracefully', async ({ page }) => {
  await page.goto(`${BASE}2031/nowhere/`);
  await expect(title(page)).toHaveText('Bahrain Grand Prix');
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
  await page.goto(BASE);
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
  await page.goto(BASE);
  await page.getByRole('button', { name: 'tyres', exact: true }).click();
  await page.locator('#race').selectOption('2026-az');
  await expect(page.locator('.compound[aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator('#r-readout')).toContainText('C4');
});

test('every prerendered page has resolved asset URLs', async ({ request }) => {
  for (const path of ['', '2026/baku/', '2025/yas-marina/', '404.html']) {
    const body = await (await request.get(`${BASE}${path}`)).text();
    expect(body, path).not.toContain('__VITE_ASSET__');
    expect(body, path).toMatch(/rel="preload" href="\/Tyres\/assets\/ibm-plex-sans-400-600-[\w-]+\.woff2"/);
    expect(body, path).toContain('<script src="/Tyres/theme.js"></script>');
  }
});

test('opens in the light theme and remembers a switch to dark', async ({ page }) => {
  await page.goto(BASE);
  const root = page.locator('html');
  await expect(root).not.toHaveAttribute('data-theme');
  const toggle = page.getByRole('button', { name: 'Dark theme' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await expect(root).not.toHaveAttribute('data-theme');
});

test('article embeds keep one height at every width and load without errors', async ({ page }) => {
  const errors = trackConsole(page);
  for (const panel of ['summary', 'compounds', 'demands', 'setup', 'circuit']) {
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
  await page.goto(BASE);
  await page.getByRole('button', { name: 'Embed' }).click();
  await page.locator('#embed-dialog').getByText('Track demands', { exact: true }).click();
  const copy = page.getByRole('button', { name: 'Copy code' });
  await expect(copy).toBeEnabled();
  await copy.click();
  await expect(page.locator('#embed-status')).toContainText('Copied');
  const snippet = await page.evaluate(() => navigator.clipboard.readText());
  expect(snippet).toMatch(
    /^<iframe src="http:\/\/localhost:\d+\/Tyres\/embed\/el\/2026\/sepang\/demands\/" title="[^"]+" width="100%" height="\d+"/,
  );
  const height = Number(/height="(\d+)"/.exec(snippet)![1]);
  expect(height).toBeGreaterThan(200);
});
