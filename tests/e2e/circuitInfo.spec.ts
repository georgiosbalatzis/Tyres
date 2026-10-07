import { expect, test } from '@playwright/test';

import { BASE, SEPANG } from './data.ts';

const panel = '#r-circuit-info';

test('the full circuit embed stays readable at every width, language and theme', async ({ page }) => {
  for (const lang of ['el', 'en']) {
    const heights: number[] = [];
    for (const width of [300, 968]) {
      await page.setViewportSize({ width, height: 1200 });
      await page.goto(`${BASE}embed/${lang}/2026/sepang/circuit-info/`);
      await page.evaluate(() => document.fonts.ready);
      const sheet = page.locator('.e');
      heights.push(await sheet.evaluate((el) => Math.ceil(el.getBoundingClientRect().height)));
      await expect(sheet.locator('.circuit-fact')).toHaveCount(5);
      await expect(sheet.locator('[data-circuit-fact="debut"]')).toContainText('1999');
      await expect(sheet.locator('[data-circuit-fact="record"]')).toContainText('Sebastian Vettel (2017)');
      await expect(sheet.locator('[data-circuit-fact="distance"]')).toContainText(
        lang === 'el' ? '310,398' : '310.398',
      );
      await expect(sheet.locator('.circuit-flag')).toHaveAttribute(
        'alt',
        lang === 'el' ? 'Μαλαισία' : 'Malaysia',
      );
      await expect(sheet.locator('.fallback-circuit')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
      for (const selector of [
        '.circuit-info-header',
        '.circuit-fact',
        '.circuit-map figcaption',
        '.circuit-info-sources',
      ]) {
        for (const el of await sheet.locator(selector).all()) {
          expect(await el.evaluate((node) => node.scrollHeight <= node.clientHeight + 1), selector).toBe(
            true,
          );
        }
      }
      await page.evaluate(() => {
        location.hash = 'dark';
      });
      await expect(page.locator('.e-root')).toHaveCSS('background-color', 'rgb(27, 26, 25)');
      expect(await sheet.evaluate((el) => Math.ceil(el.getBoundingClientRect().height))).toBe(heights.at(-1));
    }
    expect(heights[0]).toBe(heights[1]);
  }
});

test('opening Embed from the circuit sheet selects it and offers its iframe and image', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'The embed dialog is desktop-only.');
  await page.goto(SEPANG);
  await page.getByRole('button', { name: 'Στοιχεία πίστας', exact: true }).click();
  await page.getByRole('button', { name: 'Ενσωμάτωση', exact: true }).click();
  const dialog = page.locator('#embed-dialog');
  await expect(dialog.locator('input[name="embed-panel"][value="circuit-info"]')).toBeChecked();
  await expect(page.locator('#embed-copy')).toBeEnabled();
  await expect(page.locator('#embed-code')).toHaveValue(/embed\/el\/2026\/sepang\/circuit-info\//);
  await expect(page.frameLocator('#embed-preview').locator('.circuit-facts')).toContainText('1999');
  await dialog.getByText('English', { exact: true }).click();
  await expect(page.locator('#embed-code')).toHaveValue(/embed\/en\/2026\/sepang\/circuit-info\//);
  await expect(page.frameLocator('#embed-preview').locator('.circuit-facts')).toContainText(
    'First Grand Prix',
  );
  await dialog.getByText('Εικόνα για social και newsletter', { exact: true }).click();
  await expect(page.locator('#embed-code')).toHaveValue(/img\/en\/2026\/sepang\/circuit-info\.png/);
  await expect(page.locator('#embed-code')).toHaveValue(/Sebastian Vettel \(2017\)/);
  await expect(page.locator('#embed-download')).toBeVisible();
});

test('circuit information follows race selection and restores the other views', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(SEPANG);
  const tab = page.getByRole('button', { name: 'Στοιχεία πίστας', exact: true });
  await tab.focus();
  await page.keyboard.press('Enter');
  await expect(tab).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator(panel)).toBeVisible();
  await expect(page.locator('.desk-layout')).toBeHidden();
  await expect(page.locator(`${panel} h2`)).toHaveText('Sepang International Circuit');
  await expect(page.locator(`${panel} [data-circuit-fact="debut"]`)).toContainText('1999');
  await expect(page.locator(`${panel} [data-circuit-fact="record"]`)).toContainText('Sebastian Vettel');
  await expect(page.locator(`${panel} .fallback-circuit`)).toBeVisible();
  await expect(page.locator(`${panel} .circuit-flag`)).toHaveAttribute('src', `${BASE}images/flags/my.svg`);

  await page.locator('#race').selectOption('2026-az');
  await expect(page.locator(`${panel} h2`)).toHaveText('Baku City Circuit');
  await expect(tab).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator(`${panel} [data-circuit-fact="debut"]`)).toContainText('2016');
  await expect(page.locator(`${panel} [data-circuit-fact="record"]`)).toContainText('Charles Leclerc');
  await expect(page.locator(`${panel} .circuit-flag`)).toHaveAttribute('src', `${BASE}images/flags/az.svg`);
  await page.goBack();
  await expect(page.locator(`${panel} h2`)).toHaveText('Sepang International Circuit');

  await page.locator('#year').selectOption('2025');
  await expect(page.locator(`${panel} h2`)).toHaveText('Yas Marina Circuit');
  await expect(page.locator(`${panel} [data-circuit-fact="debut"]`)).toContainText('2009');
  await page.getByRole('button', { name: 'Πίνακας', exact: true }).click();
  await expect(page.locator(panel)).toBeHidden();
  await expect(page.locator('#r-data table')).toBeVisible();
  await page.getByRole('button', { name: 'Πίστα', exact: true }).click();
  await expect(page.locator('.desk-layout')).toBeVisible();
  await expect(page.locator('#canvas-host')).toBeVisible();
});

test('circuit information works without WebGL, fits the viewport and supports both themes', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    // @ts-expect-error test override
    HTMLCanvasElement.prototype.getContext = function (type: string, ...rest: unknown[]) {
      return /webgl/.test(type) ? null : original.call(this, type as '2d', ...(rest as []));
    };
  });
  await page.goto(`${BASE}2026/madring/`);
  await page.getByRole('button', { name: 'Στοιχεία πίστας', exact: true }).click();
  await expect(page.locator(`${panel} [data-circuit-fact="record"]`)).toContainText('Δεν δόθηκε');
  await expect(page.locator(`${panel} [data-circuit-fact="debut"]`)).toContainText('2026');
  await expect(page.locator(`${panel} .fallback-circuit`)).toBeVisible();
  expect(
    await page
      .locator(`${panel} .circuit-flag`)
      .evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0),
  ).toBe(true);
  for (const theme of ['light', 'dark']) {
    if ((await page.locator('html').getAttribute('data-theme')) !== theme)
      await page.getByRole('button', { name: 'Σκούρο θέμα', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
    ).toBeLessThanOrEqual(0);
    await expect(page.locator(`${panel} .circuit-facts`)).toBeVisible();
  }
  expect(errors).toEqual([]);
});
