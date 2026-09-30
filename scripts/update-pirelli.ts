/**
 * Discover → fetch → parse → classify → normalise new Pirelli F1 previews into data/generated/.
 * Never writes to data/overrides/. Never fails the pipeline because Pirelli is unreachable.
 *
 *   node scripts/update-pirelli.ts [--since 2026-01-01] [--max 40] [--url <article-url>] [--dry-run]
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createPoliteFetch } from './pirelli/http.ts';
import { normalize } from './pirelli/normalize.ts';
import { type CircuitRef, parseArticle, previewSignals } from './pirelli/parse.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const INDEX_FILE = path.join(ROOT, 'data/sources/pirelli-index.json');
const SITEMAP = 'https://press.pirelli.com/sitemap.xml';

type IndexEntry = {
  lastmod: string | null;
  kind: 'preview' | 'other' | 'error';
  id?: string;
  checkedAt: string;
};
type Index = { note: string; entries: Record<string, IndexEntry> };

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export function sitemapEntries(xml: string): { url: string; lastmod: string | null }[] {
  const out: { url: string; lastmod: string | null }[] = [];
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = /<loc>\s*([^<\s]+)\s*<\/loc>/.exec(m[1]!)?.[1];
    if (!loc) continue;
    out.push({ url: loc, lastmod: /<lastmod>\s*([^<\s]+)\s*<\/lastmod>/.exec(m[1]!)?.[1] ?? null });
  }
  return out;
}

/** English article URLs only; the Italian mirror duplicates every article. */
export const isCandidateUrl = (url: string) =>
  /^https:\/\/press\.pirelli\.com\/[a-z0-9-]+\/$/.test(url) && !/\/(it|media-library|archive)\//.test(url);

async function main() {
  const now = new Date();
  const since = arg('since') ?? `${now.getUTCFullYear()}-01-01`;
  const max = Number(arg('max') ?? 40);
  const single = arg('url');
  const dryRun = process.argv.includes('--dry-run');
  const retrievedAt = now.toISOString().replace(/\.\d{3}Z$/, 'Z');

  const circuits = (
    JSON.parse(await readFile(path.join(ROOT, 'data/reference/circuits.json'), 'utf8')) as {
      circuits: CircuitRef[];
    }
  ).circuits;
  const index: Index = await readFile(INDEX_FILE, 'utf8')
    .then((t) => JSON.parse(t))
    .catch(() => ({
      note: 'URLs already classified by update-pirelli.ts; delete an entry to force a re-check.',
      entries: {},
    }));
  const fetchPage = createPoliteFetch({ cacheDir: path.join(ROOT, '.cache/pirelli') });

  let candidates: { url: string; lastmod: string | null }[];
  if (single) {
    candidates = [{ url: single, lastmod: null }];
  } else {
    try {
      const res = await fetchPage(SITEMAP);
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      candidates = sitemapEntries(res.body)
        .filter((e) => isCandidateUrl(e.url) && (e.lastmod ?? '') >= since)
        .filter((e) => {
          const known = index.entries[e.url];
          // Retry errors; re-check previews when Pirelli modifies them; never re-fetch known non-previews.
          return (
            !known || known.kind === 'error' || (known.kind === 'preview' && known.lastmod !== e.lastmod)
          );
        })
        .sort((a, b) => (b.lastmod ?? '').localeCompare(a.lastmod ?? ''))
        .slice(0, max);
    } catch (err) {
      console.warn(`warn  sitemap unavailable (${(err as Error).message}); nothing to do this run.`);
      await writeReport([], [`Sitemap unavailable: ${(err as Error).message}`]);
      return;
    }
  }
  console.log(`discover: ${candidates.length} candidate article(s) since ${since}`);

  const found: { id: string; missing: string[]; file: string; changed: boolean }[] = [];
  const errors: string[] = [];
  for (const c of candidates) {
    try {
      const res = await fetchPage(c.url);
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      const article = parseArticle(res.body, c.url);
      const sig = previewSignals(article);
      if (!sig) {
        index.entries[c.url] = { lastmod: c.lastmod, kind: 'other', checkedAt: retrievedAt };
        continue;
      }
      const { record, missing } = normalize(article, sig, circuits, retrievedAt);
      const file = path.join(ROOT, 'data/generated', String(record.season), `${record.id}.json`);
      const previous = await readFile(file, 'utf8').catch(() => null);
      const comparable = (t: string) => t.replace(/"retrievedAt":"[^"]*"/g, '');
      const next = `${JSON.stringify(record, null, 2)}\n`;
      const changed =
        !previous || comparable(JSON.stringify(JSON.parse(previous))) !== comparable(JSON.stringify(record));
      if (changed && !dryRun) {
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, next);
      }
      index.entries[c.url] = { lastmod: c.lastmod, kind: 'preview', id: record.id, checkedAt: retrievedAt };
      found.push({ id: record.id, missing, file: path.relative(ROOT, file), changed });
      console.log(`preview: ${record.id} ${changed ? '(updated)' : '(unchanged)'} — ${article.headline}`);
    } catch (err) {
      errors.push(`${c.url}: ${(err as Error).message}`);
      index.entries[c.url] = { lastmod: c.lastmod, kind: 'error', checkedAt: retrievedAt };
    }
  }

  if (!dryRun) {
    await mkdir(path.dirname(INDEX_FILE), { recursive: true });
    const sorted = Object.fromEntries(Object.entries(index.entries).sort(([a], [b]) => a.localeCompare(b)));
    await writeFile(INDEX_FILE, `${JSON.stringify({ ...index, entries: sorted }, null, 2)}\n`);
  }
  await writeReport(found, errors);
}

/** review-report.md: what a human still needs to enter, per race without a verified override. */
async function writeReport(found: { id: string; missing: string[]; changed: boolean }[], errors: string[]) {
  const overrides = new Map<string, string>();
  const entries = await readdir(path.join(ROOT, 'data/overrides'), {
    recursive: true,
    withFileTypes: true,
  }).catch(() => []);
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith('.json')) continue;
    const o = JSON.parse(await readFile(path.join(e.parentPath, e.name), 'utf8'));
    overrides.set(e.name.replace(/\.json$/, ''), o.validation?.status ?? 'unknown');
  }
  const lines: string[] = [];
  for (const f of found) {
    const status = overrides.get(f.id);
    if (status === 'verified') continue;
    const file = `\`data/overrides/${f.id.slice(0, 4)}/${f.id}.json\``;
    lines.push(
      status === 'transcribed'
        ? `- **${f.id}** — values were transcribed from the official graphic; confirm them and set \`validation.status\` to \`verified\` in ${file}.`
        : `- **${f.id}** ${status ? `(override status: ${status})` : '(no override yet)'} — enter from the official graphic: ${f.missing.join(', ')}. Create or edit ${file}.`,
    );
  }
  for (const e of errors) lines.push(`- Fetch/parse problem: ${e}`);
  const body = lines.length
    ? `# Pirelli data review\n\nNo values have been invented. Missing values display as “Not provided” until entered.\n\n${lines.join('\n')}\n`
    : '';
  await writeFile(path.join(ROOT, 'review-report.md'), body);
  console.log(
    lines.length ? `review: ${lines.length} item(s) → review-report.md` : 'review: nothing to review',
  );
}

if (import.meta.main) {
  await main().catch((err) => {
    console.error(`update-pirelli: ${(err as Error).message}`);
    process.exitCode = 1;
  });
}
