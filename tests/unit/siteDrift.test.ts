import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  declarations,
  diffLinks,
  footerLinks,
  ourNav,
  siteCalendar,
  siteNav,
  switcher,
  tokenProblems,
} from '../../scripts/lib/site-drift.ts';
import { CALENDAR } from '../../src/ui/countdown.ts';

// Markup as f1StoriesPage publishes it (partials/nav.html, partials/footer.html, standings/index.html).
const SITE_NAV = `<div class="blog-nav-links" id="nav-links">
  <a href="/" class="blog-nav-link{{navHome}}"><svg class="icon"><use href="#fa-home"/></svg> Αρχική</a>
  <a href="/standings/" class="blog-nav-link{{navStandings}}"><svg class="icon"><use href="#fa-trophy"/></svg> Βαθμολογία</a>
  <a href="https://www.youtube.com/@f1_stories_original" target="_blank" rel="noopener" class="blog-nav-link"> YouTube</a>
</div><div class="blog-nav-right">`;
const OUR_NAV = `<div class="site-nav-links" id="nav-links" popover>
  <a href="https://f1stories.gr/">Αρχική</a>
  <a href="https://f1stories.gr/standings/">Βαθμολογία</a>
  <a href="https://www.youtube.com/@f1_stories_original" target="_blank" rel="noopener">YouTube</a>
</div>`;

describe('site drift: links', () => {
  it('reads the site nav and ours the same way, whatever the classes and icons', () => {
    expect(diffLinks(siteNav(SITE_NAV), ourNav(OUR_NAV))).toBeNull();
  });

  it('notices a reordered or re-pointed link', () => {
    const swapped = OUR_NAV.replace('/standings/', '/standings/?tab=drivers');
    expect(diffLinks(siteNav(SITE_NAV), ourNav(swapped))).toContain('standings/?tab=drivers');
    const reordered = ourNav(OUR_NAV).reverse();
    expect(diffLinks(siteNav(SITE_NAV), reordered)).not.toBeNull();
  });

  it('reads footer sections, socials (skipping the templated email) and legal links', () => {
    const site = `<nav class="footer-index"><a href="/standings/">Βαθμολογία</a><a href="https://x.test/" target="_blank">YouTube ↗</a></nav>
      <div class="social-media"><a href="https://fb.test/" aria-label="FB"><svg/></a><a href="{{footerEmailHref}}" aria-label="Email"><svg/></a></div>
      <div class="footer-links"><a href="/privacy/privacy.html" class="footer-link">Πολιτική</a><span>|</span><button>Cookies</button></div>`;
    const ours = `<nav class="colophon-links"><a href="https://f1stories.gr/standings/">Βαθμολογία</a><a href="https://x.test/">YouTube ↗</a></nav>
      <div class="colophon-social"><a href="https://fb.test/"><svg/><span>FB</span></a><a href="mailto:a@b.c"><svg/></a></div>
      <div class="colophon-legal"><a href="https://f1stories.gr/privacy/privacy.html">Πολιτική</a></div>`;
    const a = footerLinks(site, false);
    const b = footerLinks(ours, true);
    expect(diffLinks(a.index, b.index)).toBeNull();
    expect(a.social).toEqual(['https://fb.test/']);
    expect(b.social).toEqual(['https://fb.test/']);
    expect(diffLinks(a.legal, b.legal)).toBeNull();
  });

  it('reads the Race Desk switcher', () => {
    const page = `<nav class="race-desk-nav" aria-label="Race Desk" lang="en"><a href="/standings/" aria-current="page">THE GRID</a><a href="https://t.test/">TELEMETRY</a></nav>`;
    expect(switcher(page).map((l) => l.label)).toEqual(['THE GRID', 'TELEMETRY']);
    expect(switcher(page)[0]!.href).toBe('https://f1stories.gr/standings/');
  });

  it('our real index.html lists the four Race Desk products, TYRES last', async () => {
    const index = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
    expect(switcher(index).map((l) => l.label)).toEqual(['THE GRID', 'TELEMETRY', 'GHOST CAR', 'TYRES']);
  });
});

describe('site drift: calendar', () => {
  it('parses the site calendar, including escaped names', () => {
    const js = `{ name: 'S\\u00e3o Paulo GP', flag: '\\u{1F1E7}\\u{1F1F7}', date: '2026-11-08T17:00:00Z' },
      { name: 'Qatar GP',      flag: '\\u{1F1F6}\\u{1F1E6}', date: '2026-11-29T14:00:00Z' }`;
    expect(siteCalendar(js)).toEqual([
      { name: 'São Paulo GP', start: '2026-11-08T17:00:00Z' },
      { name: 'Qatar GP', start: '2026-11-29T14:00:00Z' },
    ]);
  });

  it('our bundled calendar parses back from its own source form', () => {
    expect(
      siteCalendar(CALENDAR.map((r) => `{ name: '${r.name}', flag: 'x', date: '${r.start}' }`).join(',')),
    ).toEqual([...CALENDAR]);
  });
});

describe('site drift: tokens', () => {
  const canon = {
    light: { '--bg-base': '#f2eee4', '--signal': '#ed4c32', '--text-secondary': '#5b6256' },
    dark: { '--bg-base': '#1b1a19', '--signal': '#ed4c32', '--text-secondary': '#b6bbac' },
  };

  it('reads declarations from the first matching block', () => {
    expect(declarations(':root {\n  --a: #ABC;\n  --b: 1px;\n}\n.x {\n  --a: red;\n}', ':root')).toEqual({
      '--a': '#abc',
      '--b': '1px',
    });
  });

  it("passes on this app's real tokens.css against the values in design-tokens.json", async () => {
    const css = await readFile(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8');
    expect(tokenProblems(canon, css)).toEqual([]);
  });

  it('reports a changed value and a missing token', () => {
    const css =
      ':root {\n  --c-bg: #f2eee5;\n  --c-text-2: #5b6256;\n}\n:root[data-theme="dark"],\n.canvas-host,\n.e-root:target {\n  --c-bg: #1b1a19;\n  --c-text-2: #b6bbac;\n}';
    const problems = tokenProblems(canon, css);
    expect(problems).toContain('light --c-bg: site --bg-base is #f2eee4, ours is #f2eee5');
    expect(problems.some((p) => p.includes('--c-signal') && p.includes('missing'))).toBe(true);
  });
});
