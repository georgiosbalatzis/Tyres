import { describe, expect, it } from 'vitest';
import { embedPath } from '../../src/domain/urlState.ts';
import { renderEmbed } from '../../src/ui/embed.ts';
import { fixtureRace } from '../fixtures/races.ts';

const TEMPLATE =
  '<!doctype html><html lang="en-GB"><head><title>x</title><!--embed:head--></head><body><!--embed:body--></body></html>';
const render = (
  panel: 'summary' | 'compounds' | 'demands' | 'setup' | 'circuit',
  lang: 'el' | 'en',
  r = fixtureRace(),
) =>
  renderEmbed(TEMPLATE, {
    record: r,
    track: null,
    panel,
    lang,
    base: '/Tyres/',
    siteUrl: 'https://example.test/Tyres/',
  });

describe('article embeds', () => {
  it('builds stable, language-scoped paths', () => {
    expect(embedPath('/Tyres/', 'el', { season: 2026, slug: 'sepang' }, 'demands')).toBe(
      '/Tyres/embed/el/2026/sepang/demands/',
    );
  });

  it('renders Greek labels and Greek number formatting', () => {
    const r = fixtureRace();
    r.circuit.lengthKm = 5.543;
    const doc = render('circuit', 'el', r);
    expect(doc).toContain('<html lang="el">');
    expect(doc).toContain('Μήκος πίστας');
    expect(doc).toContain('5,543 km');
    expect(render('circuit', 'en', r)).toContain('5.543 km');
    // Compound names stay in English in Greek embeds.
    expect(render('compounds', 'el', r)).toMatch(/e-compound-label">(Hard|Medium|Soft)</);
  });

  it('shows missing values as not provided, never as zero', () => {
    const r = fixtureRace();
    r.setup.minimumStartingPressurePsi = null;
    r.characteristics.braking = null;
    expect(render('setup', 'el', r)).toContain('Δεν δόθηκε');
    const demands = render('demands', 'en', r);
    expect(demands).toContain('Not provided');
    expect(demands).not.toMatch(/Braking<\/span>[\s\S]{0,200}>0</);
  });

  it('carries provenance and status, escapes data, and ships no script', () => {
    const r = fixtureRace();
    r.race.name = 'Fixture <b>Alpha</b> Grand Prix';
    const doc = render('summary', 'en', r);
    expect(doc).toContain('Fixture &lt;b&gt;Alpha&lt;/b&gt; Grand Prix');
    expect(doc).toContain(`data-status="${r.validation.status}"`);
    expect(doc).toContain('href="https://example.test/Tyres/');
    expect(doc).toContain('noindex');
    expect(doc).not.toContain('<script');
  });
});
