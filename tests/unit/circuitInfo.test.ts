import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import history from '../../data/reference/circuit-history.json' with { type: 'json' };
import { parseWith, RaceRecord } from '../../src/domain/schema.ts';
import { circuitInfo } from '../../src/ui/circuitInfo.ts';
import { fixtureRace } from '../fixtures/races.ts';

describe('circuit information', () => {
  it('uses the circuit identity, rather than the event name, for its debut and flag', () => {
    const input = JSON.parse(readFileSync('data/overrides/2026/2026-bh.json', 'utf8'));
    const parsed = parseWith(RaceRecord, input);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.error);
    const out = circuitInfo(parsed.value, null, '/Tyres/').value;
    expect(out).toContain('Sepang International Circuit');
    expect(out).toContain('/Tyres/images/flags/my.svg');
    expect(out).toContain('1999');
    expect(out).toContain('1:34.080');
    expect(out).toContain('Sebastian Vettel (2017)');
    expect(out).toContain('310,398');
    expect(out).not.toContain('/flags/bh.svg');
  });

  it('keeps unknown circuit facts and missing maps explicit, without invented values', () => {
    const r = fixtureRace();
    r.circuit.lengthKm = null;
    r.circuit.laps = null;
    r.circuit.raceDistanceKm = null;
    r.circuit.name = '<script>alert(1)</script>';
    const out = circuitInfo(r, null, '/Tyres/').value;
    expect(out.match(/circuit-fact is-missing/g)).toHaveLength(5);
    expect(out).toContain('Δεν δόθηκε');
    expect(out).toContain('&lt;script&gt;');
    expect(out).not.toContain('<script>');
    expect(out).not.toContain('circuit-flag');
    expect(out).not.toContain('Ιστορικό πίστας: Formula 1');
    expect(out).not.toContain('<svg class="fallback-circuit"');
  });

  it('has sourced debut years for every published venue', () => {
    const manifest = JSON.parse(readFileSync('public/data/manifest.json', 'utf8'));
    for (const year of manifest.years) {
      for (const race of year.races) {
        const record = JSON.parse(readFileSync(`public/data/races/${race.id}.json`, 'utf8'));
        const entry = history.circuits.find((c) => c.trackId === record.circuit.trackId);
        expect(entry, race.id).toBeDefined();
        expect(entry?.sourceUrl).toMatch(/^https:\/\/www\.formula1\.com\//);
      }
    }
  });
});
