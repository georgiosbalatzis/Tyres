import { describe, expect, it } from 'vitest';
import { html, inlineJson, safeUrl } from '../../src/ui/html.ts';
import { fmt, STRINGS } from '../../src/ui/strings.ts';
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
    expect(specs(r).value).toContain('Δεν δόθηκε');
    expect(specs(r).value).not.toMatch(/data-figure="laps">0</);
    expect(setup(r).value).toContain('Δεν δόθηκε');
    expect(ratings(r).value).toMatch(/Τραχύτητα ασφάλτου[\s\S]*Δεν δόθηκε/);
    expect(dataTable(r).value).toContain('class="is-missing"');
  });

  it('only shows Downforce when the source format had it', () => {
    expect(ratings(fixtureRace()).value).not.toContain('Κάθετη δύναμη');
    const r = fixtureRace();
    r.characteristics.downforce = 3;
    expect(ratings(r).value).toContain('Κάθετη δύναμη');
  });
});

describe('formatting', () => {
  it('formats event dates, publication time and camber in Greek', () => {
    const f = fmt(STRINGS.el);
    expect(f.dates({ ...fixtureRace().race, startDate: '2026-10-02', endDate: '2026-10-04' })).toBe(
      '2–4 Οκτ 2026',
    );
    expect(f.dates({ ...fixtureRace().race, startDate: '2026-10-30', endDate: '2026-11-01' })).toBe(
      '30 Οκτ – 1 Νοε 2026',
    );
    expect(f.publishedTime('2026-09-29T10:36:03+02:00')).toBe('29 Σεπ 2026, 10:36 UTC+02');
    expect(f.publishedTime(null)).toBeNull();
    expect(f.num(-1.75, 2, '°')).toBe('−1,75°');
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
    const doc = ogCardHtml(r, null, {
      text: 'data:font/woff2;base64,AAAA',
      textGreek: 'data:font/woff2;base64,AAAA',
      brand: 'data:font/woff2;base64,AAAA',
    });
    expect(doc).toContain('Fixture &lt;b&gt;Alpha&lt;/b&gt; Grand Prix');
    expect(doc).toContain('C1');
    expect(doc).not.toMatch(/(src|href)="https?:/);
  });
});

describe('document head', () => {
  const template = '<html><head><title>x</title><!--app:head--></head><body><!--app:notice--></body></html>';
  const ctx = (notFound?: boolean) => ({
    manifest: {
      schemaVersion: 1 as const,
      generatedAt: '2099-01-01T00:00:00Z',
      latest: fixtureRace().id,
      years: [],
    },
    record: fixtureRace(),
    track: null,
    base: '/Tyres/',
    siteUrl: 'https://x.test/Tyres/',
    path: '2026/fixture/',
    notFound,
  });

  it('is Greek: title, description, locale and image alt', async () => {
    const { renderPage } = await import('../../src/ui/page.ts');
    const r = fixtureRace();
    const out = renderPage(template, ctx());
    expect(out).toContain(
      `<title>TYRES — ${r.race.name} ${r.season}: γόμες και απαιτήσεις πίστας | F1 Stories</title>`,
    );
    expect(out).toContain('<meta property="og:locale" content="el_GR" />');
    expect(out).toContain('Ανεπίσημη απεικόνιση.');
    expect(out).toContain('og:image:alt" content="Σύνοψη ελαστικών');
    expect(out).toContain('<link rel="canonical" href="https://x.test/Tyres/2026/fixture/" />');
    expect(out).not.toMatch(/Tyre Intelligence|Unofficial|Showing the latest/);
  });

  it('marks the 404 noindex, with the generic card and a Greek notice', async () => {
    const { renderPage } = await import('../../src/ui/page.ts');
    const out = renderPage(template, ctx(true));
    expect(out).toContain('<title>Η σελίδα δεν βρέθηκε | TYRES | F1 Stories</title>');
    expect(out).toContain('<meta name="robots" content="noindex" />');
    expect(out).toContain('https://x.test/Tyres/og.png');
    expect(out).toContain('Αυτή η σελίδα δεν υπάρχει.');
    expect(out).not.toContain('rel="canonical"');
  });
});

describe('social card, Race Desk edition', () => {
  const fonts = { text: 'data:,', textGreek: 'data:,', brand: 'data:,' };
  it('shows the race, its status-free facts and the Race Desk marks, in Greek', async () => {
    const { ogCardHtml } = await import('../../src/ui/ogCard.ts');
    const r = fixtureRace();
    const doc = ogCardHtml(r, null, fonts);
    expect(doc).toContain('F1 STORIES / RACE DESK');
    expect(doc).toContain('EVERY COMPOUND COUNTS.');
    expect(doc).toContain('Προεπισκόπηση Pirelli');
    expect(doc).toContain(`Σεζόν ${r.season}`);
    expect(doc).not.toMatch(/Tyre intelligence|Round \d|season</);
  });

  it('renders a generic card without a race: no compound numbers, nothing invented', async () => {
    const { ogCardHtml } = await import('../../src/ui/ogCard.ts');
    const doc = ogCardHtml(null, null, fonts);
    expect(doc).toContain('Κάθε γόμα, μια ιστορία.');
    expect(doc).not.toMatch(/\bC\d\b|Αγώνας \d|Σεζόν \d/);
  });
});
