import { describe, expect, it } from 'vitest';
import { type EmbedPanel, embedPath } from '../../src/domain/urlState.ts';
import { renderEmbed, renderSeasonEmbed, seasonStrip } from '../../src/ui/embed.ts';
import { fixtureRace, summary } from '../fixtures/races.ts';

const TEMPLATE =
  '<!doctype html><html lang="en-GB"><head><title>x</title><!--embed:head--></head><body><!--embed:body--></body></html>';
const render = (panel: EmbedPanel, lang: 'el' | 'en', r = fixtureRace()) =>
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

  it('labels the tyre-demand panel as derived, never as temperature, and keeps gaps visible', () => {
    const r = fixtureRace();
    r.characteristics.traction = null;
    const en = render('car', 'en', r);
    expect(en).toContain('Derived visualisation based on Pirelli circuit characteristics');
    expect(en).toContain('not temperature');
    // Longitudinal needs both braking and traction: without traction it is not provided, not guessed.
    expect(en).toMatch(/Longitudinal<\/p>[\s\S]*?Not provided/);
    expect(render('car', 'el', r)).toContain('Παράγωγη απεικόνιση');
  });

  it('ships the 3D embed as a complete poster: drawing, readout text, model credit, boot data', () => {
    const doc = render('3d', 'el', fixtureRace());
    expect(doc).toContain('id="r-fallback"');
    expect(doc).toContain('Παράγωγη απεικόνιση'); // car-mode readout carries the derived label
    expect(doc).toContain('CC BY 4.0');
    expect(doc).toMatch(/<p class="e-load" id="e-load" hidden>/); // no 3D offer without the script
    expect(doc).toContain('<script type="application/json" id="boot">');
    expect(render('summary', 'el', fixtureRace())).not.toContain('id="boot"');
  });

  it('draws the season strip as a table: the full C-range, role-coloured marks, current round, honest gaps', () => {
    const races = [
      summary({
        id: '2026-aa',
        round: 1,
        compounds: [
          { raceLabel: 'hard', compound: 'C1' },
          { raceLabel: 'medium', compound: 'C2' },
          { raceLabel: 'soft', compound: 'C3' },
        ],
      }),
      summary({
        id: '2026-bb',
        round: 2,
        compounds: [
          { raceLabel: 'hard', compound: 'C3' },
          { raceLabel: 'medium', compound: 'C4' },
          { raceLabel: 'soft', compound: 'C5' },
        ],
      }),
      summary({ id: '2026-cc', round: 3, compounds: null }),
    ];
    const strip = seasonStrip(races, 'el', '2026-bb').value;
    expect(strip.match(/<th scope="row">C\d<\/th>/g)).toEqual(
      ['C1', 'C2', 'C3', 'C4', 'C5'].map((c) => `<th scope="row">${c}</th>`),
    );
    expect(strip.match(/class="ss-mark" data-label="soft" title/g)).toHaveLength(2);
    expect(strip).toContain('aria-current="true"');
    expect(strip).toContain('2026-cc GP, Δεν δόθηκε'); // a round without compounds says so
    const doc = renderSeasonEmbed(TEMPLATE, {
      season: 2026,
      races,
      lang: 'en',
      base: '/Tyres/',
      siteUrl: 'https://example.test/Tyres/',
    });
    expect(doc).toContain('3 fixture');
    expect(doc).toContain('Compound choices, 2026 season');
  });
});
