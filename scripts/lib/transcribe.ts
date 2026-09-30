/**
 * Writes a data/overrides record from a compact transcription of an official 2026-format preview graphic.
 * Used for AI-assisted or manual transcription; status is always "transcribed" (a human verifies later).
 *
 *   node scripts/lib/transcribe.ts path/to/transcriptions.json
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type T = {
  id: string;
  /** Only when the media file name's round is demonstrably wrong; explain in `roundNote`. */
  round?: number;
  roundNote?: string;
  officialName: string;
  dates: [string, string] | null;
  circuitName: string;
  laps: number;
  distance: number;
  length: number;
  lapRecord: [string, string, number] | null;
  pit: [number, 'estimate' | 'average'] | null;
  ratings: [number, number, number, number, number, number, number]; // traction, braking, stress, abrasion, grip, lateral, evolution
  minPsi: [number, number];
  runPsi: [number, number] | null;
  camber: [number, number];
  compounds: [string, string, string];
  notes?: string[];
};

const ROOT = path.resolve(import.meta.dirname, '../..');
const list = JSON.parse(await readFile(process.argv[2]!, 'utf8')) as { retrievedAt: string; races: T[] };
for (const t of list.races) {
  const season = t.id.slice(0, 4);
  const gen = JSON.parse(await readFile(path.join(ROOT, 'data/generated', season, `${t.id}.json`), 'utf8'));
  const img = gen.source.previewAssetUrl as string;
  const prov = (note?: string) => ({
    method: 'infographic-transcription',
    sourceUrl: img,
    retrievedAt: list.retrievedAt,
    ...(note ? { note } : {}),
  });
  const [traction, braking, tyreStress, asphaltAbrasion, asphaltGrip, lateral, trackEvolution] = t.ratings;
  const o = {
    ...(t.round ? { round: t.round } : {}),
    race: {
      officialName: t.officialName,
      startDate: t.dates?.[0] ?? null,
      endDate: t.dates?.[1] ?? null,
    },
    circuit: {
      name: t.circuitName,
      lengthKm: t.length,
      laps: t.laps,
      raceDistanceKm: t.distance,
      lapRecord: t.lapRecord ? { time: t.lapRecord[0], driver: t.lapRecord[1], year: t.lapRecord[2] } : null,
      pitStopLoss: t.pit ? { seconds: t.pit[0], kind: t.pit[1] } : null,
    },
    compounds: [
      { raceLabel: 'hard', compound: t.compounds[0] },
      { raceLabel: 'medium', compound: t.compounds[1] },
      { raceLabel: 'soft', compound: t.compounds[2] },
    ],
    characteristics: { traction, braking, tyreStress, asphaltAbrasion, asphaltGrip, lateral, trackEvolution },
    setup: {
      minimumStartingPressurePsi: { front: t.minPsi[0], rear: t.minPsi[1] },
      expectedRunningPressurePsi: t.runPsi ? { front: t.runPsi[0], rear: t.runPsi[1] } : null,
      camberLimitDeg: { front: t.camber[0], rear: t.camber[1] },
    },
    provenance: {
      event: prov(t.roundNote ?? 'Round from the media file name; dates from the graphic header.'),
      circuit: prov(),
      compounds: prov(),
      characteristics: prov(),
      setup: prov('Pirelli marks pressures as subject to change after FP2.'),
    },
    validation: {
      status: 'transcribed',
      notes: [
        `Transcribed from the official preview graphic by an AI-assisted pass on ${list.retrievedAt.slice(0, 10)}; awaiting human confirmation.`,
        ...(t.notes ?? []),
      ],
    },
  };
  const file = path.join(ROOT, 'data/overrides', season, `${t.id}.json`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(o, null, 2)}\n`);
  console.log(`${t.id} → ${path.relative(ROOT, file)}`);
}
