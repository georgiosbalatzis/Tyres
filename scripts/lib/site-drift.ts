/**
 * Pure parsers and comparisons for `npm run site:check`: what f1stories.gr publishes (nav, footer, Race Desk
 * switcher, next-race calendar, colour tokens) against what this app copied. No network here, so it is unit-tested.
 */
export const SITE = 'https://f1stories.gr';

export interface Link {
  label: string;
  href: string;
}

const abs = (href: string) => (href.startsWith('/') ? `${SITE}${href}` : href);
const clean = (label: string) =>
  label
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** `<a …>` elements in a fragment: label (tags stripped) and href (site-relative made absolute). Template hrefs are skipped. */
export function links(fragment: string): Link[] {
  const out: Link[] = [];
  for (const m of fragment.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
    const href = /href="([^"]*)"/.exec(m[1]!)?.[1];
    if (href == null || href.includes('{{')) continue;
    out.push({ label: clean(m[2]!), href: abs(href) });
  }
  return out;
}

const between = (text: string, from: string, to: string) => {
  const a = text.indexOf(from);
  if (a < 0) return '';
  const b = text.indexOf(to, a + from.length);
  return text.slice(a, b < 0 ? undefined : b);
};

/** The site's desktop nav links (partials/nav.html) and ours (index.html `.site-nav-links`). */
export const siteNav = (partial: string) => links(between(partial, 'id="nav-links"', 'blog-nav-right'));
export const ourNav = (indexHtml: string) => links(between(indexHtml, 'id="nav-links"', '</div>'));

/** Footer: section index, social icons (labelled by aria-label or hidden text) and legal links. */
export function footerLinks(footer: string, ours: boolean) {
  const social = between(footer, ours ? 'class="colophon-social"' : 'class="social-media"', '</div>');
  const label = (a: string) => /aria-label="([^"]+)"/.exec(a)?.[1] ?? clean(a);
  const socials = [...social.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)]
    .map((m) => ({ href: /href="([^"]*)"/.exec(m[1]!)?.[1] ?? '', label: label(m[0]) }))
    .filter((l) => !l.href.includes('{{') && !l.href.startsWith('mailto:'));
  return {
    index: links(between(footer, ours ? 'class="colophon-links"' : 'class="footer-index"', '</nav>')).map(
      (l) => ({
        ...l,
        label: l.label,
      }),
    ),
    social: socials.map((s) => s.href),
    legal: links(between(footer, ours ? 'class="colophon-legal"' : 'class="footer-links"', '</div>')).filter(
      (l) => /privacy|terms/.test(l.href),
    ),
  };
}

/** The Race Desk switcher (`<nav class="race-desk-nav">`), labels and hrefs. */
export const switcher = (page: string) => links(between(page, 'class="race-desk-nav"', '</nav>'));

/** The site's fallback calendar in scripts/shared-nav.js. */
export function siteCalendar(js: string): { name: string; start: string }[] {
  const out: { name: string; start: string }[] = [];
  for (const m of js.matchAll(/name:\s*'([^']+)',\s*flag:[^,]+,\s*date:\s*'([^']+)'/g))
    out.push({ name: JSON.parse(`"${m[1]!.replace(/"/g, '\\"')}"`), start: m[2]! });
  return out;
}

/** Canonical token → ours. Values are compared in both themes; dark falls back to light where it adds nothing. */
export const TOKEN_MAP: Record<string, string> = {
  '--bg-base': '--c-bg',
  '--bg-surface': '--c-surface',
  '--bg-surface-alt': '--c-raised',
  '--text-primary': '--c-text',
  '--text-secondary': '--c-text-2',
  '--border': '--c-rule',
  '--accent': '--c-accent',
  '--accent-hover': '--c-accent-hover',
  '--accent-muted': '--c-accent-muted',
  '--signal': '--c-signal',
  '--signal-ink': '--c-signal-ink',
  '--paper': '--c-paper',
  '--ink': '--c-ink',
  '--text-inverse-secondary': '--c-colophon-text-2',
  '--border-inverse': '--c-colophon-rule',
};

/** Custom properties declared in the first block that starts with `selector` in a stylesheet. */
export function declarations(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) return {};
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('\n}', start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) out[m[1]!] = m[2]!.trim().toLowerCase();
  return out;
}

export function tokenProblems(
  canon: { light: Record<string, string>; dark: Record<string, string> },
  tokensCss: string,
): string[] {
  const ours = {
    light: declarations(tokensCss, ':root'),
    dark: declarations(tokensCss, ':root[data-theme="dark"],\n.canvas-host,\n.e-root:target'),
  };
  const problems: string[] = [];
  for (const theme of ['light', 'dark'] as const) {
    for (const [name, ourName] of Object.entries(TOKEN_MAP)) {
      const want = canon[theme][name]?.toLowerCase();
      if (!want) continue;
      const have = ours[theme][ourName] ?? (theme === 'dark' ? ours.light[ourName] : undefined);
      if (have !== want)
        problems.push(`${theme} ${ourName}: site ${name} is ${want}, ours is ${have ?? 'missing'}`);
    }
  }
  return problems;
}

const fmt = (l: Link) => `${l.label} → ${l.href}`;

/** Order-sensitive comparison of two link lists. Returns a readable diff, or null when equal. */
export function diffLinks(site: Link[], ours: Link[]): string | null {
  if (JSON.stringify(site) === JSON.stringify(ours)) return null;
  return `    site: ${site.map(fmt).join('\n          ')}\n    ours: ${ours.map(fmt).join('\n          ')}`;
}
