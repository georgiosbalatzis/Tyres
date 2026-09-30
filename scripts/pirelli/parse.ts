/**
 * Pure parsing of one press.pirelli.com article page into plain typed facts.
 * Raw HTML never leaves this module: output is strings/numbers only, and nothing here is ever
 * rendered as HTML by the site. Regex-based on purpose — the page is server-rendered Presspage
 * markup and we only need a handful of stable anchors (JSON-LD, gallery data attributes, text blocks).
 * Fixtures in tests/fixtures/pirelli pin the expected structure; update them when Pirelli changes markup.
 */

export interface ParsedArticle {
  url: string;
  headline: string | null;
  datePublished: string | null;
  keywords: string[];
  media: { filename: string; url: string }[];
  /** Plain text paragraphs of the article body. */
  paragraphs: string[];
}

export interface PreviewSignals {
  season: number;
  grandPrix: string;
  round: number;
  eventCode: string;
  infographicUrl: string;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  ndash: '–',
  mdash: '—',
  hellip: '…',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code =
        e[1]?.toLowerCase() === 'x' ? Number.parseInt(e.slice(2), 16) : Number.parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export const stripTags = (s: string) =>
  decodeEntities(s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\s${name}="([^"]*)"`, 'i').exec(tag);
  return m ? decodeEntities(m[1]!) : null;
}

export function parseArticle(html: string, url: string): ParsedArticle {
  let ld: Record<string, unknown> = {};
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const json = JSON.parse(m[1]!);
      const obj = Array.isArray(json) ? json.find((x) => x?.['@type'] === 'Article') : json;
      if (obj?.['@type'] === 'Article') {
        ld = obj;
        break;
      }
    } catch {
      // Malformed JSON-LD: treat as absent, classification will fail safely.
    }
  }

  const media: ParsedArticle['media'] = [];
  for (const m of html.matchAll(/<a\s[^>]*data-filename="[^"]*"[^>]*>/gi)) {
    const filename = attr(m[0], 'data-filename');
    const src = attr(m[0], 'data-sourcepath');
    if (filename && src && /^https:\/\/content\.presspage\.com\//.test(src)) {
      media.push({ filename: filename.toLowerCase(), url: src.replace(/\?.*$/, '') });
    }
  }

  const paragraphs: string[] = [];
  for (const block of html.matchAll(
    /<div class="ppmodule_textblock[^"]*">([\s\S]*?)(?=<div class="ppmodule_textblock|<div class="pp_gridcontainer|<div class="pp-gallery|<div class="footer|$)/gi,
  )) {
    for (const p of block[1]!.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
      const text = stripTags(p[1]!);
      if (text) paragraphs.push(text);
    }
  }

  const keywords = Array.isArray(ld.keywords)
    ? (ld.keywords as unknown[]).filter((k): k is string => typeof k === 'string')
    : typeof ld.keywords === 'string'
      ? ld.keywords.split(',').map((k) => k.trim())
      : [];

  return {
    url,
    headline: typeof ld.headline === 'string' ? decodeEntities(ld.headline).trim() : null,
    datePublished: typeof ld.datePublished === 'string' ? ld.datePublished : null,
    keywords,
    media,
    paragraphs,
  };
}

const INFOGRAPHIC = /^(\d{1,2})-([a-z]{2,3})(\d{2})-preview-en\.(?:jpe?g|png)$/;

/** The three-signal preview rule (see docs/DATA-SOURCES.md). Returns null for anything that is not an F1 race preview. */
export function previewSignals(a: ParsedArticle): PreviewSignals | null {
  if (!a.keywords.some((k) => k.toLowerCase() === 'formula 1')) return null;
  const gp = a.keywords.map((k) => /^(\d{4}) (.+ Grand Prix)$/.exec(k.trim())).find(Boolean);
  if (!gp) return null;
  const season = Number(gp[1]);
  for (const m of a.media) {
    const hit = INFOGRAPHIC.exec(m.filename);
    if (hit && 2000 + Number(hit[3]) === season) {
      return { season, grandPrix: gp[2]!, round: Number(hit[1]), eventCode: hit[2]!, infographicUrl: m.url };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ text facts (conservative) */

const ROLE = { hard: 'hard', medium: 'medium', soft: 'soft' } as const;

/**
 * Compound nomination from prose. Returns null unless exactly one unambiguous trio is found.
 * Handles:
 *   "C3 as Hard, C4 as Medium and C5 as Soft"
 *   "the C2, C3 and C4 compounds, designated respectively as Hard, Medium and Soft"
 *   "namely the C3, C4 and C5" (a nomination sentence; roles follow hardest → softest)
 */
export function compoundsFromText(paragraphs: string[]): { raceLabel: string; compound: string }[] | null {
  const text = paragraphs.join(' ');
  const found = new Set<string>();
  const results: { raceLabel: string; compound: string }[][] = [];
  const push = (trio: string[]) => {
    const key = trio.join(',');
    const nums = trio.map((c) => Number(c.slice(1)));
    if (new Set(trio).size !== 3 || !(nums[0]! < nums[1]! && nums[1]! < nums[2]!) || found.has(key)) return;
    found.add(key);
    results.push([
      { raceLabel: ROLE.hard, compound: trio[0]! },
      { raceLabel: ROLE.medium, compound: trio[1]! },
      { raceLabel: ROLE.soft, compound: trio[2]! },
    ]);
  };

  const explicit =
    /\b(C\d)\s+(?:as\s+(?:the\s+)?)?Hard\b[^.]{0,40}?\b(C\d)\s+(?:as\s+(?:the\s+)?)?Medium\b[^.]{0,40}?\b(C\d)\s+(?:as\s+(?:the\s+)?)?Soft\b/i;
  const respectively =
    /\b(C\d),\s*(C\d)\s+and\s+(C\d)\b[^.]{0,80}?\brespectively\b[^.]{0,20}?\bHard,\s*Medium\s+and\s+Soft\b/i;
  const selection =
    /\b(?:selected|selection|chosen|choice|nominated|namely|bring(?:s|ing)?)\b[^.]{0,60}?\bC(\d),\s*C(\d)\s+and\s+C(\d)\b/i;

  // Only the first nomination sentence counts: later ones usually describe previous seasons.
  for (const sentence of text.split(/(?<=\.)\s+/)) {
    const m = explicit.exec(sentence) ?? respectively.exec(sentence);
    if (m) {
      push([m[1]!.toUpperCase(), m[2]!.toUpperCase(), m[3]!.toUpperCase()]);
      break;
    }
    const s = selection.exec(sentence);
    if (s && !/\blast year\b|\bprevious(?:ly)?\b/i.test(sentence)) {
      push([`C${s[1]}`, `C${s[2]}`, `C${s[3]}`]);
      break;
    }
  }
  return results.length === 1 ? results[0]! : null;
}

/** Circuit length stated as "… is 5.543 km long" or "a 5.4-kilometre layout"; null unless a single 3-decimal value appears. */
export function circuitLengthFromText(paragraphs: string[]): number | null {
  const values = new Set<number>();
  for (const p of paragraphs) {
    for (const m of p.matchAll(/\b(\d\.\d{3})\s*(?:km|kilometres|kilometers)\b(?:\s+long)?/gi)) {
      const ctx = p.slice(Math.max(0, m.index! - 80), m.index! + 40).toLowerCase();
      if (/(circuit|track|lap|layout)/.test(ctx) && !/(race distance|total)/.test(ctx))
        values.add(Number(m[1]));
    }
  }
  return values.size === 1 ? [...values][0]! : null;
}

export interface CircuitRef {
  trackId: string;
  name: string;
  aliases: string[];
  countryCode: string;
  location: string;
}

/** Picks the reference circuit mentioned most in headline + body; null on a tie or no mention. */
export function circuitFromText(a: ParsedArticle, circuits: CircuitRef[]): CircuitRef | null {
  const text = `${a.headline ?? ''} ${a.paragraphs.join(' ')}`;
  const scores = circuits
    .map((c) => ({
      c,
      n: [c.name, ...c.aliases].reduce(
        (sum, alias) =>
          sum +
          (text.match(new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'))?.length ?? 0),
        0,
      ),
    }))
    .filter((x) => x.n > 0)
    .sort((x, y) => y.n - x.n);
  if (!scores.length || (scores[1] && scores[1].n === scores[0]!.n)) return null;
  return scores[0]!.c;
}
