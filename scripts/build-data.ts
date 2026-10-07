/**
 * generated + overrides → validated publishable dataset in public/data/.
 * A broken record is excluded and reported; the build only fails when nothing is publishable.
 *
 *   node scripts/build-data.ts [--allow-fixtures] [--out public/data]
 */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as z from 'zod/mini';
import {
  crossCheck,
  type Manifest,
  type ManifestRace,
  Manifest as ManifestSchema,
  parseWith,
  RaceRecord,
  SCHEMA_VERSION,
  TrackShape,
} from '../src/domain/schema.ts';
import { compareLatest, pickLatest } from '../src/domain/selection.ts';
import { Weekend, weekendProblems } from '../src/domain/weekend.ts';
import { type Json, mergeRecord } from './lib/merge.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'data');

async function jsonFiles(dir: string): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  const entries = await readdir(dir, { recursive: true, withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    if (e.isFile() && e.name.endsWith('.json'))
      found.set(e.name.replace(/\.json$/, ''), path.join(e.parentPath, e.name));
  }
  return found;
}

const readJson = async (file: string): Promise<Json> => JSON.parse(await readFile(file, 'utf8'));

export async function buildData({
  outDir = path.join(ROOT, 'public/data'),
  allowFixtures = false,
  write = true,
}: {
  outDir?: string;
  allowFixtures?: boolean;
  write?: boolean;
} = {}) {
  const OUT = outDir;
  const generated = await jsonFiles(path.join(DATA, 'generated'));
  const overrides = await jsonFiles(path.join(DATA, 'overrides'));
  const ids = [...new Set([...generated.keys(), ...overrides.keys()])].sort();

  const problems: string[] = [];
  const warnings: string[] = [];
  const records: RaceRecord[] = [];

  for (const id of ids) {
    try {
      const g = generated.has(id) ? await readJson(generated.get(id)!) : undefined;
      const o = overrides.has(id) ? await readJson(overrides.get(id)!) : undefined;
      const { value, conflicts } = mergeRecord(g, o);
      for (const c of conflicts) {
        warnings.push(
          `${id}: override replaces generated ${c.path} (${JSON.stringify(c.generated)} → ${JSON.stringify(c.override)})`,
        );
      }
      const parsed = parseWith(RaceRecord, value);
      if (!parsed.ok) {
        problems.push(`${id}: schema\n${parsed.error}`);
        continue;
      }
      const record = parsed.value;
      if (record.id !== id) {
        problems.push(`${id}: file name does not match id "${record.id}"`);
        continue;
      }
      const cross = crossCheck(record);
      if (cross.length) {
        problems.push(...cross.map((p) => `${id}: ${p}`));
        continue;
      }
      if (record.validation.status === 'fixture' && !allowFixtures) {
        warnings.push(`${id}: fixture skipped (use --allow-fixtures for local testing)`);
        continue;
      }
      records.push(record);
    } catch (err) {
      problems.push(`${id}: ${(err as Error).message}`);
    }
  }

  // Slugs are URL segments: unique within a season.
  const seen = new Map<string, string>();
  for (const r of [...records]) {
    const key = `${r.season}/${r.slug}`;
    if (seen.has(key)) {
      problems.push(
        `${r.id}: slug "${r.slug}" already used by ${seen.get(key)} — set a distinct slug in its override`,
      );
      records.splice(records.indexOf(r), 1);
    } else seen.set(key, r.id);
  }

  // Two races claiming the same round usually means a mis-numbered media file upstream.
  const rounds = new Map<string, string>();
  for (const r of records) {
    if (r.round == null) continue;
    const key = `${r.season}/R${r.round}`;
    if (rounds.has(key))
      warnings.push(
        `${r.id}: round ${r.round} also used by ${rounds.get(key)} — check the source and set "round" in an override`,
      );
    else rounds.set(key, r.id);
  }

  const weekends = new Map<string, Weekend>();
  for (const [id, file] of await jsonFiles(path.join(DATA, 'weekends'))) {
    const parsed = parseWith(Weekend, await readJson(file));
    if (parsed.ok && parsed.value.raceId === id && !weekendProblems(parsed.value).length)
      weekends.set(id, parsed.value);
    else problems.push(`weekend ${id}: ${parsed.ok ? 'invalid dates or schedule' : parsed.error}`);
  }

  // Tracks
  const trackFiles = await jsonFiles(path.join(DATA, 'tracks'));
  const tracks = new Map<string, TrackShape>();
  for (const [id, file] of trackFiles) {
    const parsed = parseWith(TrackShape, await readJson(file));
    if (parsed.ok && parsed.value.id === id) tracks.set(id, parsed.value);
    else problems.push(`track ${id}: ${parsed.ok ? 'id mismatch' : parsed.error}`);
  }
  for (const r of records) {
    if (r.circuit.trackId && !tracks.has(r.circuit.trackId))
      warnings.push(`${r.id}: no track shape "${r.circuit.trackId}" (circuit view will show a placeholder)`);
  }

  if (!records.length) {
    console.error(problems.join('\n'));
    throw new Error('No publishable races.');
  }

  const toManifestRace = (r: RaceRecord): ManifestRace => ({
    id: r.id,
    slug: r.slug,
    season: r.season,
    round: r.round,
    name: r.race.name,
    circuitName: r.circuit.name,
    location: r.race.location,
    startDate: r.race.startDate,
    publishedAt: r.source.publishedAt,
    status: r.validation.status,
    compounds: r.compounds,
  });
  const summaries = records.map(toManifestRace);
  const years = [...new Set(summaries.map((r) => r.season))].sort((a, b) => b - a);
  const manifest: Manifest = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    latest: pickLatest(summaries)?.id ?? null,
    years: years.map((year) => ({
      year,
      races: summaries
        .filter((r) => r.season === year)
        .sort((a, b) => (a.round ?? 99) - (b.round ?? 99) || compareLatest(a, b)),
    })),
  };
  const check = parseWith(ManifestSchema, manifest);
  if (!check.ok) throw new Error(`Manifest invalid:\n${check.error}`);

  if (!write) return { manifest, records, problems, warnings };
  await rm(OUT, { recursive: true, force: true });
  await mkdir(path.join(OUT, 'races'), { recursive: true });
  await mkdir(path.join(OUT, 'tracks'), { recursive: true });
  await mkdir(path.join(OUT, 'weekends'), { recursive: true });
  await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest));
  for (const r of records) await writeFile(path.join(OUT, 'races', `${r.id}.json`), JSON.stringify(r));
  for (const [id, t] of tracks) await writeFile(path.join(OUT, 'tracks', `${id}.json`), JSON.stringify(t));

  for (const r of records)
    await writeFile(path.join(OUT, 'weekends', `${r.id}.json`), JSON.stringify(weekends.get(r.id) ?? null));

  // Keep the published JSON Schema in step with the zod source of truth.
  await mkdir(path.join(DATA, 'schemas'), { recursive: true });
  for (const [name, schema] of [
    ['race', RaceRecord],
    ['track', TrackShape],
    ['manifest', ManifestSchema],
    ['weekend', Weekend],
  ] as const) {
    const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
    await writeFile(path.join(DATA, 'schemas', `${name}.schema.json`), `${JSON.stringify(json, null, 2)}\n`);
  }

  return { manifest, records, problems, warnings };
}

if (import.meta.main) {
  try {
    const args = process.argv.slice(2);
    const out = args.indexOf('--out');
    const { manifest, records, problems, warnings } = await buildData({
      allowFixtures: args.includes('--allow-fixtures'),
      ...(out >= 0 ? { outDir: path.resolve(ROOT, args[out + 1]!) } : {}),
    });
    for (const w of warnings) console.warn(`warn  ${w}`);
    for (const p of problems) console.error(`error ${p}`);
    console.log(
      `data: ${records.length} race(s) published, latest = ${manifest.latest}, ${problems.length} excluded/problem(s)`,
    );
  } catch (err) {
    console.error(`data: ${(err as Error).message}`);
    process.exit(1);
  }
}
