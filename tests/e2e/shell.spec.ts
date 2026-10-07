import { expect, test } from '@playwright/test';
import { STRINGS } from '../../src/ui/strings.ts';
import { BASE, publishedLatest } from './data.ts';

/** The shared f1stories.gr shell: global nav, Race Desk switcher, signal band, sponsors and colophon. */

const NAV = [
  ['Αρχική', 'https://f1stories.gr/'],
  ['Άρθρα', 'https://f1stories.gr/blog-module/blog/index.html'],
  ['YouTube', 'https://www.youtube.com/@f1_stories_original'],
  ['Βαθμολογία', 'https://f1stories.gr/standings/'],
  ['Δεδομένα', 'https://f1stories.gr/standings/?tab=tyre-pace'],
  ['Συντάκτες', 'https://f1stories.gr/authors/'],
  ['BetCast', 'https://georgiosbalatzis.github.io/BetCastVisualisation/'],
];

test('the global nav is the site nav: seven links, Δεδομένα current, no TYRES', async ({ page }) => {
  await page.goto(BASE);
  const nav = page.getByRole('navigation', { name: 'F1 Stories', exact: true });
  const links = nav.locator('.site-nav-links a');
  await expect(links).toHaveCount(7);
  expect(
    await links.evaluateAll((els) => els.map((a) => [a.textContent, (a as HTMLAnchorElement).href])),
  ).toEqual(NAV);
  await expect(nav.locator('[aria-current="page"]')).toHaveText(['Δεδομένα']);
  await expect(nav.getByText('TYRES')).toHaveCount(0); // Race Desk and its products never go in the masthead
  await expect(nav.getByText('Race Desk')).toHaveCount(0);
});

test('Race Desk lists the four products, TYRES current, same tab, one H1', async ({ page, request }) => {
  const { record } = await publishedLatest(request);
  await page.goto(BASE);
  const desk = page.getByRole('navigation', { name: 'Race Desk' });
  await expect(desk.locator('a')).toHaveText(['THE GRID', 'TELEMETRY', 'GHOST CAR', 'TYRES']);
  await expect(desk.locator('[aria-current="page"]')).toHaveText(['TYRES']);
  await expect(desk.locator('[target]')).toHaveCount(0);
  await expect(desk.getByText('BetCast')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^TYRES\./);
  await expect(page.getByRole('heading', { name: /Race Desk/i })).toHaveCount(0);
  const status = page.locator('.signal-band [data-status]');
  await expect(status).toBeVisible();
  await expect(status).toHaveAttribute('data-status', record.validation.status);
  await expect(status).toHaveText(STRINGS.el.status[record.validation.status]);
});

for (const width of [1440, 1024, 768, 390, 375, 320]) {
  test(`no horizontal overflow, 44px switcher targets and a fixed masthead at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(BASE);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
    ).toBeLessThanOrEqual(0);
    for (const a of await page.locator('.race-desk-nav a').all())
      expect((await a.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    // The fixed masthead paints above the switcher once the page scrolls under it.
    await page.evaluate(() => window.scrollTo(0, 60));
    const top = await page.evaluate(
      () => document.elementFromPoint(window.innerWidth / 2, 10)?.closest('.site-nav') != null,
    );
    expect(top).toBe(true);
  });
}

test('below 992px the menu is a popover of 52px rows that Esc closes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE);
  await page.getByRole('button', { name: 'Μενού' }).click();
  const panel = page.locator('#nav-links');
  await expect(panel).toBeVisible();
  for (const a of await panel.locator('a').all())
    expect((await a.boundingBox())?.height).toBeGreaterThanOrEqual(52);
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
});

test('the colophon carries sponsors, socials, legal links and the credits', async ({ page }) => {
  await page.goto(BASE);
  const strip = page.locator('.sponsor-strip');
  await strip.scrollIntoViewIfNeeded();
  const logos = strip.locator('img');
  await expect(logos).toHaveCount(6);
  await expect
    .poll(() => logos.evaluateAll((els) => els.every((i) => (i as HTMLImageElement).naturalWidth > 0)))
    .toBe(true);
  const footer = page.locator('footer.colophon');
  await expect(footer.locator('.colophon-social a')).toHaveCount(5);
  await expect(footer.getByRole('link', { name: 'Πολιτική Απορρήτου' })).toHaveAttribute(
    'href',
    'https://f1stories.gr/privacy/privacy.html',
  );
  await expect(footer.getByRole('link', { name: 'Όροι Χρήσης' })).toHaveAttribute(
    'href',
    'https://f1stories.gr/privacy/terms.html',
  );
  await expect(footer).toContainText('Pirelli');
  await expect(footer).toContainText('CC BY 4.0');
  await expect(footer).toContainText(`© ${new Date().getFullYear()} F1 Stories`);
  await expect(page.locator('.archive a')).not.toHaveCount(0); // the archive stays crawlable
});

test('desktop nav links sit centred in the 75px masthead, in the page ink', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Links are in the popover on phones.');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BASE);
  const link = page.locator('.site-nav-links a.is-current');
  const box = (await link.boundingBox())!;
  expect(Math.abs(box.y + box.height / 2 - 37.5)).toBeLessThan(4);
  // The popover's UA colour (CanvasText) must not leak onto the links.
  const [a, b] = await page.evaluate(() => [
    getComputedStyle(document.querySelector('.site-nav-links a')!).color,
    getComputedStyle(document.body).color,
  ]);
  expect(a).toBe(b);
});

test('the band slogan appears from 1024px, as on Telemetry, and the band stays one line', async ({
  page,
}) => {
  for (const [width, slogan] of [
    [1440, true],
    [1024, true],
    [768, false],
    [390, false],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(BASE);
    await expect(page.locator('.signal-slogan'))[slogan ? 'toBeVisible' : 'toBeHidden']();
    const h = (await page.locator('.signal-band').boundingBox())!.height;
    expect(h, `${width}px`).toBeLessThanOrEqual(59);
  }
});

test('reduced motion switches off the bar, underline and tab transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BASE);
  const durations = await page.evaluate(() => {
    const d = (sel: string, pseudo?: string) =>
      getComputedStyle(document.querySelector(sel)!, pseudo).transitionDuration;
    return [
      d('.race-desk-nav a[aria-current]', '::before'),
      d('.site-nav-links a', '::after'),
      d('.mode'),
      d('.sponsor-logo img'),
    ];
  });
  expect(durations).toEqual(['0s', '0s', '0s', '0s']);
});
