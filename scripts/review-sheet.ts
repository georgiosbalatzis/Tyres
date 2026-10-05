/**
 * Human verification helpers for overrides.
 *
 *   node scripts/review-sheet.ts                      → review-sheet.html (git-ignored): official graphic beside our values
 *   node scripts/review-sheet.ts --verify <id> --by "Name"   → sets validation.status = "verified" with a dated note
 *
 * Only run --verify after comparing every value yourself. This is the one place "verified" is set.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { characteristicsFor, fixed, signedDeg } from '../src/domain/format.ts';
import { parseWith, RaceRecord } from '../src/domain/schema.ts';
import { html, safeUrl } from '../src/ui/html.ts';
import { STRINGS } from '../src/ui/strings.ts';
import { sortedCompounds } from '../src/ui/templates.ts';
import { type Json, mergeRecord } from './lib/merge.ts';

const ROOT = path.resolve(import.meta.dirname, '..');

async function files(layer: string) {
  const map = new Map<string, string>();
  const entries = await readdir(path.join(ROOT, 'data', layer), {
    recursive: true,
    withFileTypes: true,
  }).catch(() => []);
  for (const e of entries)
    if (e.isFile() && e.name.endsWith('.json')) map.set(e.name.slice(0, -5), path.join(e.parentPath, e.name));
  return map;
}

async function verify(id: string, by: string) {
  const overrides = await files('overrides');
  const file = overrides.get(id);
  if (!file) throw new Error(`No override for ${id}: create data/overrides/<season>/${id}.json first.`);
  const o = JSON.parse(await readFile(file, 'utf8'));
  const date = new Date().toISOString().slice(0, 10);
  o.validation = {
    status: 'verified',
    notes: [
      `Verified by ${by} on ${date} against ${o.source?.previewAssetUrl ?? o.source?.articleUrl ?? 'the official source'}.`,
      ...(o.validation?.notes ?? []).filter((n: string) => !/awaiting human confirmation/i.test(n)),
    ],
  };
  await writeFile(file, `${JSON.stringify(o, null, 2)}\n`);
  console.log(`${id}: verified (${path.relative(ROOT, file)})`);
}

async function sheet() {
  const [gen, ovr] = [await files('generated'), await files('overrides')];
  const ids = [...new Set([...gen.keys(), ...ovr.keys()])].sort().reverse();
  const cards = [];
  for (const id of ids) {
    const g = gen.has(id) ? (JSON.parse(await readFile(gen.get(id)!, 'utf8')) as Json) : undefined;
    const o = ovr.has(id) ? (JSON.parse(await readFile(ovr.get(id)!, 'utf8')) as Json) : undefined;
    const parsed = parseWith(RaceRecord, mergeRecord(g, o).value);
    if (!parsed.ok || parsed.value.validation.status === 'verified') continue;
    const r = parsed.value;
    const c = r.circuit;
    const s = r.setup;
    const psi = (v: number | null | undefined) => fixed(v, 1, ' psi');
    const rows: [string, string][] = [
      ['Dates', r.race.startDate ? `${r.race.startDate} → ${r.race.endDate}` : 'Not provided'],
      ['Laps', c.laps == null ? 'Not provided' : String(c.laps)],
      ['Race distance', c.raceDistanceKm == null ? 'Not provided' : `${c.raceDistanceKm} km`],
      ['Circuit length', fixed(c.lengthKm, 3, ' km')],
      [
        'Lap record',
        c.lapRecord ? `${c.lapRecord.time} ${c.lapRecord.driver} (${c.lapRecord.year})` : 'Not provided',
      ],
      [
        'Pit-stop loss',
        c.pitStopLoss ? `${c.pitStopLoss.seconds} s (${c.pitStopLoss.kind})` : 'Not provided',
      ],
      ...characteristicsFor(r).map((x): [string, string] => [
        STRINGS.en.rating[x.key],
        String(r.characteristics[x.key] ?? 'Not provided'),
      ]),
      [
        'Min. start pressure F / R',
        `${psi(s.minimumStartingPressurePsi?.front)} / ${psi(s.minimumStartingPressurePsi?.rear)}`,
      ],
      [
        'Running pressure F / R',
        `${psi(s.expectedRunningPressurePsi?.front)} / ${psi(s.expectedRunningPressurePsi?.rear)}`,
      ],
      ['Camber F / R', `${signedDeg(s.camberLimitDeg?.front)} / ${signedDeg(s.camberLimitDeg?.rear)}`],
      [
        'Compounds',
        sortedCompounds(r)
          .map((x) => `${x.raceLabel} ${x.compound}`)
          .join(', ') || 'Not provided',
      ],
    ];
    cards.push(html`<section>
      <h2>${r.id} — ${r.season} ${r.race.name} <small>${r.validation.status}</small></h2>
      <div class="grid">
        <a href="${safeUrl(r.source.previewAssetUrl)}" target="_blank" rel="noopener"><img src="${safeUrl(r.source.previewAssetUrl)}" alt="Official Pirelli preview graphic for ${r.id}" loading="lazy"></a>
        <table>${rows.map(([k, v]) => html`<tr><th>${k}</th><td>${v}</td></tr>`)}</table>
      </div>
      <p>Source: <a href="${safeUrl(r.source.articleUrl)}" target="_blank" rel="noopener">${r.source.articleTitle}</a></p>
      <p>All correct? <code>npm run data:verify -- ${r.id} --by "Your Name"</code> · Wrong value? Edit <code>data/overrides/${r.season}/${r.id}.json</code>.</p>
    </section>`);
  }
  const doc = html`<!doctype html><html lang="en"><meta charset="utf-8"><title>Pirelli data review</title>
<style>body{font:15px/1.45 system-ui;background:#16181b;color:#ebe7df;margin:24px}a{color:#9ccbdc}section{border-top:1px solid #3a4047;padding:16px 0}
.grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(280px,1fr);gap:20px;align-items:start}img{width:100%;border:1px solid #3a4047}
table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:4px 8px;border-bottom:1px solid #2b3036}th{color:#959ca5;font-weight:500}
td{font-weight:600;font-variant-numeric:tabular-nums}small{color:#959ca5;font-weight:400}code{background:#2b3036;padding:1px 5px}</style>
<h1>Pirelli data review (${cards.length} record(s) awaiting verification)</h1>
<p>Compare each value with the official graphic (click to enlarge). This page is local only and loads images directly from Pirelli's media server.</p>
${cards}</html>`;
  await writeFile(path.join(ROOT, 'review-sheet.html'), doc.value);
  console.log(`review-sheet.html: ${cards.length} record(s) to verify`);
}

const i = process.argv.indexOf('--verify');
if (i >= 0) {
  const id = process.argv[i + 1];
  const b = process.argv.indexOf('--by');
  const by = b >= 0 ? process.argv[b + 1] : undefined;
  if (!id || !by) {
    console.error('usage: node scripts/review-sheet.ts --verify <id> --by "Name"');
    process.exit(1);
  }
  await verify(id, by);
} else {
  await sheet();
}
