import { describe, expect, it } from 'vitest';
import { eventDates, publishedText, signedDeg } from '../../src/domain/format.ts';
import { html, safeUrl } from '../../src/ui/html.ts';
import { inlineJson } from '../../src/ui/page.ts';
import { dataTable, ratings, setup, specs, titleBlock } from '../../src/ui/templates.ts';
import { fixtureRace } from '../fixtures/races.ts';

describe('rendering safety', () => {
  it('escapes every interpolated value', () => {
    expect(html`<p>${'<img src=x onerror=alert(1)>'}</p>`.value).toBe(
      '<p>&lt;img src=x onerror=alert(1)&gt;</p>',
    );
    expect(html`<a title="${'" onmouseover="x'}">`.value).not.toContain('" onmouseover');
  });

  it('only lets https or same-site URLs through', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('#');
    expect(safeUrl('//evil.example/x')).toBe('#');
    expect(safeUrl('https://press.pirelli.com/a/')).toBe('https://press.pirelli.com/a/');
    expect(safeUrl('/Tyres/2026/sepang/')).toBe('/Tyres/2026/sepang/');
  });

  it('neutralises </script> in inline JSON', () => {
    expect(inlineJson({ a: '</script><script>alert(1)</script>' })).not.toContain('</script>');
  });

  it('escapes hostile text coming from data', () => {
    const r = fixtureRace();
    r.source.articleTitle = '<script>alert(1)</script>';
    expect(titleBlock(r).value).not.toContain('<script>');
  });
});

describe('missing data', () => {
  it('shows "Not provided" instead of 0 or blanks', () => {
    const r = fixtureRace();
    r.circuit.laps = null;
    r.circuit.pitStopLoss = null;
    r.setup.camberLimitDeg = null;
    expect(specs(r).value).toContain('Not provided');
    expect(specs(r).value).not.toMatch(/data-figure="laps">0</);
    expect(setup(r).value).toContain('Not provided');
    expect(ratings(r).value).toMatch(/Asphalt abrasion[\s\S]*Not provided/);
    expect(dataTable(r).value).toContain('class="is-missing"');
  });

  it('only shows Downforce when the source format had it', () => {
    expect(ratings(fixtureRace()).value).not.toContain('Downforce');
    const r = fixtureRace();
    r.characteristics.downforce = 3;
    expect(ratings(r).value).toContain('Downforce');
  });
});

describe('formatting', () => {
  it('formats event dates, publication time and camber', () => {
    expect(eventDates({ ...fixtureRace().race, startDate: '2026-10-02', endDate: '2026-10-04' })).toBe(
      '2–4 Oct 2026',
    );
    expect(eventDates({ ...fixtureRace().race, startDate: '2026-10-30', endDate: '2026-11-01' })).toBe(
      '30 Oct – 1 Nov 2026',
    );
    expect(publishedText('2026-09-29T10:36:03+02:00')).toBe('29 Sept 2026, 10:36 UTC+02');
    expect(publishedText(null)).toBe('Not provided');
    expect(signedDeg(-1.75)).toBe('−1.75°');
  });
});

describe('prerender robustness', () => {
  it('treats "$" sequences in data as literal text, not replacement patterns', async () => {
    const { renderPage } = await import('../../src/ui/page.ts');
    const r = fixtureRace();
    r.race.name = "Dollar $' $& $` Grand Prix";
    r.validation.notes = ["note with $' inside"];
    const template =
      '<html><head><title>x</title><!--app:head--></head><body><!--app:stepper--><!--app:notice--><main><!--app:main--></main><!--app:archive--><!--app:boot--></body></html>';
    const manifest = {
      schemaVersion: 1 as const,
      generatedAt: '2099-01-01T00:00:00Z',
      latest: r.id,
      years: [],
    };
    const out = renderPage(template, {
      manifest,
      record: r,
      track: null,
      base: '/',
      siteUrl: 'https://x.test/',
      path: '',
    });
    expect(out.match(/<body>/g)).toHaveLength(1);
    const boot = /<script type="application\/json" id="boot">(.*?)<\/script>/s.exec(out)?.[1];
    expect(JSON.parse(boot!).record.race.name).toBe(r.race.name);
  });

  it('rejects backslash host tricks in same-site URLs', () => {
    expect(safeUrl('/\\evil.example/x')).toBe('#');
  });
});

describe('social card', () => {
  it('renders race data, escaped, with a data-URL font and no external requests', async () => {
    const { ogCardHtml } = await import('../../src/ui/ogCard.ts');
    const r = fixtureRace();
    r.race.name = 'Fixture <b>Alpha</b> Grand Prix';
    const doc = ogCardHtml(r, null, 'data:font/woff2;base64,AAAA');
    expect(doc).toContain('Fixture &lt;b&gt;Alpha&lt;/b&gt; Grand Prix');
    expect(doc).toContain('C1');
    expect(doc).not.toMatch(/(src|href)="https?:/);
  });
});
