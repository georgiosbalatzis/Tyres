import { expect, test } from '@playwright/test';

import { BASE, SEPANG } from './data.ts';

const panel = '#r-weather';

test('weather embeds fit one iframe height across article widths and forecast states', async ({ page }) => {
  for (const slug of ['sepang', 'miami', 'suzuka', 'marina-bay']) {
    let height = 0;
    for (const width of [300, 346, 680, 700, 701, 968]) {
      await page.setViewportSize({ width, height: 1200 });
      await page.goto(`${BASE}embed/el/2026/${slug}/weather/`);
      await page.evaluate(() => document.fonts.ready);
      const sheet = page.locator('.e');
      const measured = await sheet.evaluate((el) => Math.ceil(el.getBoundingClientRect().height));
      height ||= measured;
      expect(measured, `${slug} at ${width}px`).toBe(height);
      // The published AnalystCast article already uses a 774px iframe for Sepang's weather.
      if (slug === 'sepang') expect(height).toBeLessThanOrEqual(774);
      await page.setViewportSize({ width, height });
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(height);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      for (const selector of ['.weather-meta', '.weather-explanation', '.weather-sources']) {
        expect(
          await page.locator(selector).evaluate((el) => el.scrollHeight <= el.clientHeight),
          `${slug} ${selector} at ${width}px`,
        ).toBe(true);
      }
    }
  }
});

test('weather tab has three daily columns, selectable time zones and standard / sprint schedules', async ({
  page,
  baseURL,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const externalRequests: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith('data:') && new URL(request.url()).origin !== new URL(baseURL!).origin)
      externalRequests.push(request.url());
  });
  await page.goto(SEPANG);
  const tab = page.getByRole('button', { name: 'Καιρός τριημέρου', exact: true });
  await tab.focus();
  await page.keyboard.press('Enter');
  await expect(tab).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator(panel)).toBeVisible();
  await expect(page.locator('.desk-layout')).toBeHidden();
  await expect(page.locator(`${panel} .weather-day`)).toHaveCount(3);
  await expect(page.locator(`${panel} .weather-meta`)).toContainText('Αρχειοθετημένη');
  await expect(page.locator(`${panel} [data-session="fp1"]`)).toContainText('07:30');
  await page.locator('#weather-timezone').selectOption('Asia/Kuala_Lumpur');
  await expect(page.locator(`${panel} [data-session="fp1"]`)).toContainText('12:30');
  await expect(page.locator('#weather-timezone')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  const columns = await page
    .locator(`${panel} .weather-day`)
    .evaluateAll((days) => days.map((d) => d.getBoundingClientRect().x));
  expect(columns[0]).toBeLessThan(columns[1]!);
  expect(columns[1]).toBeLessThan(columns[2]!);

  await page.locator('#race').selectOption('2026-mi');
  await expect(page.locator(`${panel} .weather-meta`)).toContainText('Sprint');
  await expect(page.locator(`${panel} [data-session="sprint-qualifying"]`)).toHaveCount(1);
  await expect(page.locator(`${panel} [data-session="sprint"]`)).toHaveCount(1);
  await expect(page.locator(`${panel} [data-session="fp2"]`)).toHaveCount(0);
  await expect(page.locator(`${panel} [data-session="fp3"]`)).toHaveCount(0);
  await expect(page.locator(`${panel} [data-session="race"]`)).toContainText('20:00');
  await expect(tab).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Στοιχεία πίστας', exact: true }).click();
  await expect(page.locator(panel)).toBeHidden();
  await expect(page.locator('#r-circuit-info')).toBeVisible();
  expect(externalRequests).toEqual([]);
});

test('weather and sessions are prerendered without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${BASE}2026/miami/`);
  await expect(page.locator(`${panel} .weather-day`)).toHaveCount(3);
  await expect(page.locator(`${panel} [data-session="sprint"]`)).toHaveCount(1);
  await context.close();
});
