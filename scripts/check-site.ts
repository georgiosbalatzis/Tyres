/**
 * Has f1stories.gr changed since this app copied its shell? The masthead, footer, Race Desk switcher, next-race
 * calendar and colour tokens are copied, not imported (separate deployments), so this is how drift gets noticed.
 * Needs network. Exit code 1 when something differs.
 *
 *   npm run site:check
 */

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { CALENDAR } from '../src/ui/countdown.ts';
import {
  diffLinks,
  footerLinks,
  type Link,
  ourNav,
  SITE,
  siteCalendar,
  siteNav,
  switcher,
  tokenProblems,
} from './lib/site-drift.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const RAW = 'https://raw.githubusercontent.com/georgiosbalatzis/f1StoriesPage/main';
const get = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res;
};
const text = async (url: string) => (await get(url)).text();
const ours = (file: string) => readFile(path.join(ROOT, file), 'utf8');

const problems: string[] = [];
const index = await ours('index.html');

// 1. Global nav: seven links, same order, same destinations.
const navDiff = diffLinks(siteNav(await text(`${RAW}/partials/nav.html`)), ourNav(index));
if (navDiff) problems.push(`Masthead links differ (update index.html):\n${navDiff}`);

// 2. Footer: section index, social destinations, privacy and terms.
const siteFooter = footerLinks(await text(`${RAW}/partials/footer.html`), false);
const ourFooter = footerLinks(index, true);
const footerDiff = diffLinks(siteFooter.index, ourFooter.index);
if (footerDiff) problems.push(`Footer section links differ (update index.html):\n${footerDiff}`);
if (siteFooter.social.join() !== ourFooter.social.join())
  problems.push(
    `Footer social links differ:\n    site: ${siteFooter.social.join(' ')}\n    ours: ${ourFooter.social.join(' ')}`,
  );
const legalDiff = diffLinks(siteFooter.legal, ourFooter.legal);
if (legalDiff) problems.push(`Footer legal links differ:\n${legalDiff}`);

// 3. Race Desk switcher. THE GRID's page is the reference; our own item's href is ours (the base path differs).
const siteDesk = switcher(await text(`${RAW}/standings/index.html`));
const ourDesk = switcher(index);
const strip = (l: Link[]) => l.filter((x) => x.label !== 'TYRES');
const deskDiff = diffLinks(strip(siteDesk), strip(ourDesk));
if (deskDiff) problems.push(`Race Desk switcher differs from the site's (update index.html):\n${deskDiff}`);
else if (!siteDesk.some((l) => l.label === 'TYRES'))
  problems.push(
    "f1stories.gr's Race Desk switcher does not list TYRES yet. Expected until the TYRES switcher PR merges in f1StoriesPage (Phase 10 of docs/REDESIGN-GUIDE.md).",
  );

// 4. Next-race calendar behind the masthead countdown.
const siteCal = siteCalendar(await text(`${RAW}/scripts/shared-nav.js`));
const key = (c: { name: string; start: string }[]) =>
  c.map((r) => `${r.start} ${r.name}`).join('\n          ');
if (key(siteCal) !== key([...CALENDAR]))
  problems.push(
    `Next-race calendar differs (update src/ui/countdown.ts):\n    site: ${key(siteCal)}\n    ours: ${key([...CALENDAR])}`,
  );

// 5. Colour tokens, both themes.
const canon = JSON.parse(await text(`${RAW}/docs/design-tokens.json`)).themes;
problems.push(
  ...tokenProblems(canon, await ours('src/styles/tokens.css')).map(
    (p) => `Token drift: ${p} (update src/styles/tokens.css)`,
  ),
);

// 6. The nav logo.
const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const live = Buffer.from(await (await get(`${SITE}/images/logo-nav.webp`)).arrayBuffer());
if (hash(live) !== hash(await readFile(path.join(ROOT, 'public/logo-nav.webp'))))
  problems.push('The nav logo changed: copy f1stories.gr/images/logo-nav.webp to public/logo-nav.webp.');

if (problems.length) {
  console.error(`f1stories.gr and this app have drifted:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(
  'site:check — masthead, footer, Race Desk switcher, calendar, tokens and logo all match f1stories.gr.',
);
