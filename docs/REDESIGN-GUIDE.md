# TYRES. redesign guide — joining the F1 Stories Race Desk

This guide is for the implementing agent (Claude Sonnet). Work through it **in order, one phase per commit**, and keep the
Status list below up to date in this file as part of each phase's commit. Read the whole guide once before starting.
`CLAUDE.md` describes the target state; this guide describes how to get there.

## Status

- [x] Phase 0 — Branch, references, baseline captures
- [x] Phase 1 — Tokens and theme contract
- [x] Phase 2 — One strings module, Greek UI copy
- [x] Phase 3 — Site shell: masthead, Race Desk hero, signal band, sponsors, colophon, countdown
- [x] Phase 4 — Product body: scope row, context row, tabs, stage + sidebar, panels, archive
- [x] Phase 5 — Head, SEO, notices, 404 in Greek
- [x] Phase 6 — Embeds and social/panel images
- [x] Phase 7 — Tests and visual parity pass
- [x] Phase 8 — Docs
- [ ] Phase 9 — `site:check` drift script
- [ ] Phase 10 — Cross-repo: add TYRES to the Race Desk switcher (f1StoriesPage, Telemetry, Ghost Car)

---

## 1. Why, and the decisions already made

The current app reuses the site's colours and fonts but is structured like a different product: an English
spec sheet with boxed controls, its own nav (with a "Tyres" item the site forbids), a light-only default with its own
storage key, and a footer full of archive links. Every other F1 Stories data product (THE GRID, TELEMETRY, GHOST CAR)
shares one **Race Desk** shell. TYRES joins it as the fourth product.

The owner (the user) decided the following. Don't reopen these:

| Topic | Decision |
|---|---|
| Identity | 4th Race Desk product. Kicker `F1 STORIES / RACE DESK`, switcher `THE GRID · TELEMETRY · GHOST CAR · TYRES` |
| Product name | **`TYRES.`** H1, red dot. Descriptor: "Ελαστικά & απαιτήσεις πίστας" |
| Language | Greek UI. Product names, F1 terms and data values stay English. Embeds keep `el` + `en` |
| Theme | Site contract: key `f1stories-theme`, stored → OS → dark. 3D bench stays dark |
| Layout | Full rebuild on THE GRID / TELEMETRY pattern (hero → band → scope row → context row → tabs → stage + sidebar → panels) |
| 3D | Stays the centrepiece of the stage. The giant grey circuit-name watermark ("hero word") is removed |
| Scope | Restyle embeds + images · cross-repo switcher PRs · canonical footer + sponsors · masthead countdown |

## 2. Reference material

Clone once into a scratch directory (not inside this repo):

```bash
git clone --depth 1 https://github.com/georgiosbalatzis/f1StoriesPage     main-site
git clone --depth 1 https://github.com/georgiosbalatzis/f1-telemetry-dashboard tele
git clone --depth 1 https://github.com/georgiosbalatzis/ghostcar          ghost
```

| What | Where |
|---|---|
| Canonical tokens | `main-site/docs/design-tokens.md`, `main-site/styles/editorial.css` |
| Race Desk rules | `main-site/docs/race-desk-architecture.md`, `tele/docs/RACE_DESK.md` |
| Masthead / footer markup | `main-site/partials/nav.html`, `main-site/partials/footer.html` |
| Theme contract | `main-site/scripts/theme-init.js`, `tele/docs/THEME.md` |
| Countdown calendar | `main-site/scripts/shared-nav.js` (the `// ── Next Race Countdown` list) |
| **Port source for the shell CSS** | `tele/src/index.css`, section `/* ── Site chrome: masthead, hero, signal band, colophon` (≈ lines 900–1070), plus `.tab-strip`, `.dashboard-select`, `.field-label`, `.dashboard-panel`, `.panel-heading` |
| Shell markup to mirror | `tele/src/components/dashboard/DashboardHeader.tsx`, `SiteFooter.tsx`, `tele/src/copy.ts` |
| THE GRID body patterns | `main-site/standings/index.html` (≈ lines 119–200), `main-site/standings/standings-editorial.css` (context row, side panel, tabs) |
| Shell parity checks to imitate | `tele/scripts/shell-parity.mjs`, `ghost/e2e/race-desk.smoke.spec.js` |
| Canonical assets | `tele/public/f1stories-social.svg`, `tele/public/images/sponsors/normalized/*.webp` (12 files) |

Live pages to compare against at every step: <https://f1stories.gr/standings/>,
<https://georgiosbalatzis.github.io/f1-telemetry-dashboard/>, <https://georgiosbalatzis.github.io/ghostcar/>.
"Before" captures of TYRES and the site are in `.playwright-mcp/*.png` (gitignored and local, if they're still there).

## 3. Working rules for this job

- One phase = one commit on branch `redesign/race-desk`. Run `npm run check` before each commit and `npm run test:e2e`
  from Phase 4 on. A phase is done only when both pass. Never weaken a test to make it pass; change the assertion only
  where this guide says the behaviour or copy changed.
- Never push, open PRs or touch other repos without asking the user first (Phase 10 is all outward-facing).
- Keep the hard rules in `CLAUDE.md`. They're unchanged by the redesign: static only, `html` template only, `null` →
  "Δεν δόθηκε", status honesty, derived label, one WebGL canvas, `%BASE_URL%`/`import.meta.env.BASE_URL`.
- Use token **role names** that already exist (`--c-*`). Don't introduce telemetry's or editorial's names; map them (table in §P1).
- Prefer deleting old CSS over overriding it. When a phase replaces a component, delete its old rules in the same commit.
  `app.css` is 1,727 lines today. Expect it to shrink, not grow.
- No new dependencies.

---

## Phase 0 — Branch, references, baseline captures

1. `git switch -c redesign/race-desk`.
2. Clone the three references (§2).
3. `npm ci && npm run build && npx vite preview --base /Tyres/` (or the e2e server config) and capture full-page
   screenshots of `/Tyres/` at 1440, 1024, 768, 390 and 375px in both themes, plus the same widths of
   `https://f1stories.gr/standings/` and the Telemetry page. Keep them in the scratch directory for later comparison.
4. Commit nothing yet except the Status tick for Phase 0 in this file.

## Phase 1 — Tokens and theme contract

### 1a. `src/styles/tokens.css`

Edit the `:root` block. **Values must equal the canonical ones**:

| Token | Change |
|---|---|
| `--c-text-2` | light `#545b50` → **`#5b6256`** (canonical `--text-secondary`). Dark stays `#b6bbac` |
| add `--c-signal-ink` | `#17191b`, both themes (text/icons on `--c-signal`) |
| add `--c-accent-hover` | light `#8e281a`, dark `#ff947f` |
| add `--c-accent-muted` | `#ed4c3214`, both themes (wash only, never the sole indicator) |
| add `--c-colophon-bg` / `--c-colophon-text` / `--c-colophon-text-2` / `--c-colophon-rule` | `#20251f` / `#e9e3d6` / `#c0bfb2` / `rgba(233, 227, 214, 0.18)`, both themes |
| add `--c-sponsor-paper` / `--c-sponsor-text` | `#f2eee4` / `#5b6256`, both themes |
| `--gutter` | replace the `clamp()` with the canonical steps: `48px`; `32px` at `max-width: 1199px`; `22px` at `max-width: 767px`; `17px` at `max-width: 359px` |
| add `--shell-max` | `1476px` |
| add `--nav-h` | `76px`; `68px` at `max-width: 991px` (fixed masthead height + 1px rule) |
| add `--ease-editorial` | `cubic-bezier(.22, .68, 0, 1.02)` (Race Desk bar and tab underline transition, .35s) |
| `--font-brand` | keep `"Barlow Condensed", "Arial Narrow", sans-serif` |

Then:

- **Deferred to Phase 3:** remove `.colophon` from the charcoal selector list (the old colophon still needs it until it is replaced). Then remove `.colophon` from the charcoal selector list (`:root[data-theme="dark"], .canvas-host, .colophon, .e-root:target`).
  The canonical colophon is the fixed **ink** block (`--c-colophon-bg`), not charcoal. Keep `.canvas-host` and `.e-root:target`.
- Update the header comment: "Values mirror f1StoriesPage/docs/design-tokens.md. Light values on :root; the dark edition on
  `[data-theme="dark"]`. `public/theme.js` always sets data-theme explicitly (dark when nothing else applies)."
- Mapping for anything you port from Telemetry. Rename on paste:

| Telemetry | TYRES |
|---|---|
| `--bg` | `--c-bg` |
| `--surface` | `--c-surface` |
| `--surface-soft` | `--c-raised` |
| `--line` | `--c-rule` |
| `--line-strong` | `--c-text-2` (borders of small outlined squares) |
| `--text` / `--ink` | `--c-text` (Telemetry's `--ink` follows the theme, so it is **not** our fixed `--c-ink`) |
| `--text-muted` / `--text-faint` / `--text-dim` | `--c-text-2` |
| `--accent` / `--focus` | `--c-accent` |
| `--accent-muted` | `--c-accent-muted` |
| `--signal` / `--signal-ink` | `--c-signal` / `--c-signal-ink` |
| `--colophon-bg` / `--colophon-text` / `--text-inverse-secondary` / `--border-inverse` | `--c-colophon-bg` / `--c-colophon-text` / `--c-colophon-text-2` / `--c-colophon-rule` |
| `--sponsor-paper` / `--sponsor-text` | `--c-sponsor-paper` / `--c-sponsor-text` |
| `--font-body` / `--font-display` / `--font-brand` | `--font` / `--font-brand` / `--font-brand` |

### 1b. `public/theme.js`: replace the whole file

```js
// Mirrors f1StoriesPage/scripts/theme-init.js: stored 'f1stories-theme' → OS preference → dark.
// Shared with Telemetry, Ghost Car and BetCast (same github.io origin). Written only when the reader presses the toggle.
// Plain script loaded blocking in <head> so the right theme paints first; the CSP allows same-origin scripts only.
(() => {
  const root = document.documentElement;
  const KEY = 'f1stories-theme';
  const LEGACY = 'theme'; // this app's pre-redesign key: copied once when KEY is absent, then removed
  const BG = { light: '#f2eee4', dark: '#1b1a19' };
  const valid = (v) => v === 'light' || v === 'dark';
  let stored = null;
  try {
    stored = localStorage.getItem(KEY);
    const legacy = localStorage.getItem(LEGACY);
    if (valid(legacy)) {
      if (stored === null) localStorage.setItem(KEY, (stored = legacy));
      localStorage.removeItem(LEGACY);
    }
  } catch {}
  const apply = (theme) => {
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BG[theme]);
    for (const b of document.querySelectorAll('[data-theme-toggle]')) b.setAttribute('aria-pressed', String(theme === 'dark'));
  };
  apply(valid(stored) ? stored : matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  document.addEventListener('DOMContentLoaded', () => apply(root.dataset.theme));
  document.addEventListener('click', (e) => {
    if (!(e.target instanceof Element) || !e.target.closest('[data-theme-toggle]')) return;
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    apply(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {}
  });
})();
```

Other values (for example a sibling's `auto`) mean "follow the OS" and are left in place, never overwritten. Don't add
`storage`-event sync or live OS-change tracking. The site doesn't do either.

### 1c. `index.html` head

- `<meta name="theme-color" content="#1b1a19" />` (`theme.js` corrects it before paint).
- Keep `<meta name="color-scheme" content="light dark" />`.

### 1d. Tests

Replace the e2e test "opens in the light theme and remembers a switch to dark" with "follows the OS and remembers the
choice under f1stories-theme":
- `page.emulateMedia({ colorScheme: 'dark' })` → `html[data-theme="dark"]`.
- `colorScheme: 'light'` → `light`.
- Clicking the toggle writes `localStorage['f1stories-theme']`, and the choice survives a reload with the OS set the other way.
- A pre-set legacy `localStorage.theme = 'dark'` (via `addInitScript`) is migrated to `f1stories-theme` and removed.
- An `f1stories-theme` value of `auto` is left untouched and the OS preference is applied.

Commit: `Theme: adopt the f1stories-theme contract and canonical token values`.

## Phase 2 — One strings module, Greek UI copy

Goal: every user-visible word comes from `src/ui/strings.ts`. The page is Greek; embeds stay bilingual.

1. Create `src/ui/strings.ts`. **Move** (don't copy) `Strings`, `STRINGS` and `fmt()` out of `src/ui/embed.ts` into it,
   and export them. `embed.ts` imports them back. Keep `embedText` working.
2. In `STRINGS`, change `open` to `'Άνοιγμα στο TYRES'` / `'Open in TYRES'`.
3. Add a Greek-only `PAGE` object for page copy (below). Use `STRINGS.el` for everything that already exists there
   (rating labels, compound names, status labels, `notProvided`, `front`/`rear`, setup labels, spec labels, `demandView`,
   `mode`, `derived`, `loading3d`, `noGl`, `failed3d`, `reset`, `seasonTitle`, `roundsNote`, `outline`, `noTrack`,
   `noCompounds`, `round`). Format numbers and dates on the page with `fmt(STRINGS.el)`. Greek uses a decimal comma
   (`5,543`), as the embeds already do.
4. Replace every English literal in `templates.ts`, `page.ts`, `app.ts`, `fallbackSvg.ts` (aria labels) and `index.html`.
   Then delete the now-unused English helpers in `src/domain/format.ts` (`NOT_PROVIDED`, `STATUS_TEXT`, the `label`/`explain`
   fields of `CHARACTERISTICS`, `eventDates`, `publishedText`, `shortDate`) **once nothing imports them** (`ogCard.ts` moves
   to Greek in Phase 6, so do that file's switch here too). Do the same for `DERIVED_LABEL` and `VIEW_TITLES` in
   `derivedMetrics.ts` (use `STRINGS[lang].derived` / `.demandView`). `format.ts` keeps only language-neutral helpers
   (`characteristicsFor`, `RACE_LABEL_ORDER`, `compoundCssVar`, `fixed`/`signedDeg` if still used).
5. `src/domain/urlState.ts` must not hold UI copy. Change `Resolution.notice` to a typed value:
   `{ kind: 'noRace'; race: string; year: number } | { kind: 'noYear'; year: number } | { kind: 'noSeason' } | null`,
   and format it with `PAGE.notice.resolve(...)` in `app.ts` and `page.ts`. Update `tests/unit/urlState.test.ts` to assert
   the kinds.

`PAGE`, written to match `STRINGS.el` terminology. Use it as given, and keep the keys and Greek wording:

```ts
export const PAGE = {
  skip: 'Μετάβαση στα δεδομένα του αγώνα',
  homeAria: 'F1 Stories, αρχική σελίδα',
  menu: 'Μενού',
  theme: 'Σκούρο θέμα', // aria-label of the toggle; aria-pressed carries the state
  hero: {
    descriptor: 'Ελαστικά & απαιτήσεις πίστας',
    tagline: 'Κάθε γόμα, μια ιστορία.',
    taglineBody: 'Οι γόμες, οι απαιτήσεις της πίστας και τα όρια ρυθμίσεων από την προεπισκόπηση της Pirelli για κάθε Grand Prix.',
  },
  band: {
    preview: 'Προεπισκόπηση Pirelli',
    season: (y: number) => `Σεζόν ${y}`,
    slogan: 'EVERY COMPOUND COUNTS.',
  },
  scope: {
    label: 'Επιλογή αγώνα',
    season: 'Σεζόν',
    race: 'Grand Prix',
    prev: 'Προηγούμενος',
    next: 'Επόμενος',
    embed: 'Ενσωμάτωση',
    option: (round: number | null, name: string, circuit: string | null) =>
      `${round != null ? `R${round} ` : ''}${name}${circuit ? `, ${circuit}` : ''}`,
  },
  context: 'Ο αγώνας με μια ματιά',
  modes: { label: 'Προβολή', car: 'Μονοθέσιο', circuit: 'Πίστα', tyres: 'Ελαστικά', data: 'Πίνακας' },
  aside: { title: 'Δελτίο ελαστικών', sub: 'Βαθμολογίες και όρια της Pirelli' },
  ratingsLink: 'Τι σημαίνουν οι βαθμολογίες',
  corner: { FL: 'Εμπρός αριστερά', FR: 'Εμπρός δεξιά', RL: 'Πίσω αριστερά', RR: 'Πίσω δεξιά' },
  derivedShort: 'παράγωγο',
  autoRotate: 'Αυτόματη περιστροφή',
  carPlan: 'Κάτοψη ενός γενικού μονοθεσίου Formula 1 με τα ελαστικά χρωματισμένα κατά την επιλεγμένη παράγωγη προβολή',
  circuitOutline: (name: string) => `Χάραξη της πίστας ${name}`,
  source: {
    title: 'Πηγή',
    publisher: 'Εκδότης',
    published: 'Δημοσίευση',
    retrieved: 'Ανάκτηση',
    record: 'Εγγραφή',
    status: 'Κατάσταση δεδομένων',
    graphic: 'επίσημο γραφικό',
    origin: {
      none: 'Η προέλευση δεν καταγράφηκε',
      metadata: 'Από τα μεταδεδομένα του άρθρου',
      text: 'Από το κείμενο του άρθρου',
      filename: 'Από το όνομα αρχείου του media kit',
      vision: 'Μεταγραφή από το επίσημο γραφικό της προεπισκόπησης',
      manual: 'Καταχώριση με το χέρι από την πηγή',
    },
  },
  statusExplain: {
    verified: 'Κάθε τιμή ελέγχθηκε από άνθρωπο με την επίσημη πηγή της Pirelli.',
    transcribed: 'Οι τιμές διαβάστηκαν από το επίσημο γραφικό της Pirelli και περιμένουν ανθρώπινο έλεγχο.',
    'needs-review': 'Βρέθηκαν αυτόματα. Κάποιες τιμές δεν δημοσιεύονται ως κείμενο και δεν έχουν καταχωριστεί ακόμη.',
    fixture: 'Δοκιμαστικά δεδομένα. Δεν δημοσιεύονται.',
  },
  ratingExplain: {
    traction: 'Πόσο ζορίζει η χάραξη τα πίσω ελαστικά στις επιταχύνσεις από αργές στροφές.',
    braking: 'Συχνότητα και ένταση των δυνατών φρεναρισμάτων. Τα νιώθουν κυρίως τα εμπρός ελαστικά.',
    tyreStress: 'Η συνολική βαθμολογία της Pirelli για τις δυνάμεις που απορροφά η δομή του ελαστικού.',
    asphaltAbrasion: 'Πόσο τραχιά είναι η επιφάνεια. Υψηλότερη τιμή σημαίνει περισσότερη φθορά στο πέλμα.',
    asphaltGrip: 'Το κράτημα που δίνει η ίδια η επιφάνεια. Χαμηλό κράτημα φέρνει ολισθήσεις και υπερθέρμανση.',
    lateral: 'Πλευρικά φορτία από γρήγορες και μεγάλες στροφές.',
    trackEvolution: 'Πόσο βελτιώνεται το κράτημα μέσα στο Σαββατοκύριακο, καθώς η πίστα γεμίζει λάστιχο.',
    downforce: 'Το επίπεδο κάθετης δύναμης που τρέχουν οι ομάδες. Δημοσιεύεται μόνο στις προεπισκοπήσεις μορφής 2025.',
  },
  table: {
    caption: 'Όλα τα δεδομένα του αγώνα',
    lengthNote: 'Μήκος ενός γύρου.',
    lapsNote: 'Προγραμματισμένοι γύροι αγώνα.',
    distanceNote: 'Προγραμματισμένη απόσταση αγώνα.',
    lapRecordNote: 'Ταχύτερος γύρος αγώνα, όπως τον δίνει η Pirelli.',
    pitLossNote: 'Χρόνος που χάνεται στη διέλευση από το pit lane για μια στάση.',
    demands: 'Απαιτήσεις πίστας (1 χαμηλή – 5 υψηλή)',
    minPressureNote: 'Η χαμηλότερη επιτρεπόμενη πίεση εν ψυχρώ στην εκκίνηση.',
    runningPressureNote: 'Η σταθεροποιημένη πίεση που αναμένεται στην πίστα.',
    camberNote: 'Μέγιστο αρνητικό camber, μετρημένο στο τέλος της ευθείας.',
    compoundNote: 'Γόμα που ορίστηκε για αυτό το Σαββατοκύριακο.',
  },
  archive: { title: 'Αρχείο προεπισκοπήσεων', aside: (n: number) => `${n} προεπισκοπήσεις Pirelli` },
  credits: {
    disclaimer:
      'Ανεπίσημη απεικόνιση. Τα δεδομένα ελαστικών και πίστας προέρχονται από τις προεπισκοπήσεις της Pirelli Motorsport· κάθε σελίδα παραπέμπει στην πηγή της. Χωρίς σχέση ή έγκριση από Pirelli, Formula 1 ή FIA.',
    sources:
      'Χαράξεις πιστών: bacinger/f1-circuits (MIT). Μοντέλο 3D: «Low Poly-F1», salasilma13 (CC BY 4.0), επαναχρωματισμένο. Γραμματοσειρές IBM Plex Sans και Barlow Condensed (SIL OFL).',
  },
  embedDialog: {
    title: 'Ενσωμάτωση σε άρθρο',
    close: 'Κλείσιμο',
    panel: 'Πάνελ',
    format: 'Μορφή',
    iframe: 'Iframe για άρθρα',
    image: 'Εικόνα για social και newsletter',
    language: 'Γλώσσα',
    code: 'Κώδικας για το άρθρο',
    copy: 'Αντιγραφή κώδικα',
    download: 'Λήψη εικόνας',
    preview: 'Προεπισκόπηση, όπως θα εμφανιστεί στο άρθρο',
    previewTitle: 'Προεπισκόπηση ενσωμάτωσης',
    copied: 'Αντιγράφηκε. Επικόλλησέ το στο άρθρο.',
    copyBlocked: 'Ο browser μπλόκαρε την αντιγραφή. Ο κώδικας είναι επιλεγμένος: πάτα Ctrl/⌘ + C.',
    previewFailed: 'Η προεπισκόπηση δεν φόρτωσε.',
    // Panel names: reuse STRINGS.el.panel.*, plus 'Γόμες ανά αγώνα' (STRINGS.el.seasonPanel) for "season".
  },
  notice: {
    showing: (name: string, season: number) => `Εμφανίζεται: ${name} ${season}`,
    loadFailed: (name: string, reason: string, current: string, season: number) =>
      `Δεν φορτώθηκε το ${name} (${reason}). Παραμένει το ${current} ${season}.`,
    bootDamaged: 'Τα ενσωματωμένα δεδομένα της σελίδας είναι κατεστραμμένα. Φορτώνεται η λίστα αγώνων.',
    manifestFailed:
      'Η λίστα αγώνων δεν φόρτωσε, οπότε οι άλλες προεπισκοπήσεις δεν επιλέγονται τώρα. Τα δεδομένα αυτής της σελίδας είναι πλήρη.',
    notFound: 'Αυτή η σελίδα δεν υπάρχει. Εμφανίζεται η πιο πρόσφατη προεπισκόπηση.',
    resolve: (n: { kind: 'noRace'; race: string; year: number } | { kind: 'noYear'; year: number } | { kind: 'noSeason' }) =>
      n.kind === 'noRace'
        ? `Δεν υπάρχει προεπισκόπηση «${n.race}» για το ${n.year}. Εμφανίζεται η πιο πρόσφατη.`
        : n.kind === 'noYear'
          ? `Δεν υπάρχουν ακόμη προεπισκοπήσεις για το ${n.year}. Εμφανίζεται η πιο πρόσφατη.`
          : 'Από τον σύνδεσμο λείπει η σεζόν. Εμφανίζεται η πιο πρόσφατη προεπισκόπηση.',
  },
  seo: {
    siteName: 'F1 Stories',
    title: (race: string, season: number) => `TYRES — ${race} ${season}: γόμες και απαιτήσεις πίστας | F1 Stories`,
    notFoundTitle: 'Η σελίδα δεν βρέθηκε | TYRES | F1 Stories',
    description: (compounds: string[], race: string, season: number, circuit: string | null) =>
      `${compounds.length ? `Γόμες ${compounds.join(', ')}` : 'Οι γόμες'} για το ${race} ${season}${circuit ? ` στην πίστα ${circuit}` : ''}: απαιτήσεις πίστας, πιέσεις εκκίνησης, όρια camber και στοιχεία πίστας από την προεπισκόπηση της Pirelli. Ανεπίσημη απεικόνιση.`,
    ogAlt: (race: string, season: number) =>
      `Σύνοψη ελαστικών για το ${race} ${season}: γόμες, χάραξη πίστας και βαθμολογίες απαιτήσεων της Pirelli`,
    ogAltGeneric: 'TYRES από το F1 Stories: γόμες και απαιτήσεις πίστας για κάθε Grand Prix',
  },
} as const;
```

Wording rules for any string not listed: informal second person singular ("Επίλεξε", "πάτα"), sentence case, `«»`
quotes, Greek decimal comma, "γόμα/γόμες" for compounds, "ελαστικά" for tyres, "πίστα" for circuit, "αγώνας" for race,
"προεπισκόπηση" for preview. Keep `Hard/Medium/Soft`, `C1–C5`, `psi`, `camber`, `pit stop`, `FP2`, `DRS` in English.

Tests: `tests/unit/templates.test.ts` changes `Not provided` → `Δεν δόθηκε`, `Asphalt abrasion` → `Τραχύτητα ασφάλτου`,
`Downforce` → `Κάθετη δύναμη`. The `eventDates`/`publishedText` cases move to `fmt(STRINGS.el)` and expect Greek output
(`2–4 Οκτ 2026`, the exact `Intl` output). Embed unit tests should be unaffected apart from `open`.

Commit: `Copy: one strings module; Greek page UI`.

## Phase 3 — Site shell

Everything here mirrors f1stories.gr and Telemetry. Nothing in the shell is TYRES-specific except the switcher's current
item and the colophon credits.

### 3a. Assets

Copy from `tele/public/` into `public/`: `f1stories-social.svg` and `images/sponsors/normalized/*.webp` (12 files).
`public/logo-nav.webp` already exists. Check it's byte-identical to `main-site/images/logo-nav.webp`, and replace it if not.

### 3b. `index.html` structure (top to bottom)

`<html lang="el">`. The body order is skip link → `header.site-header` → `main#main` (hero, band, scope, notice, stage, panels,
archive) → `section.sponsor-strip` → `footer.colophon` → embed `dialog` → announcer → boot script.

**Masthead.** Keep the existing single-list + native `popover` mechanism (no JS), but make the content and visuals
canonical:

```html
<a class="skip-link" href="#main">Μετάβαση στα δεδομένα του αγώνα</a>
<header class="site-header">
  <nav class="site-nav" aria-label="F1 Stories">
    <div class="shell site-nav-inner">
      <a class="brand" href="https://f1stories.gr/" aria-label="F1 Stories, αρχική σελίδα">
        <img src="%BASE_URL%logo-nav.webp" alt="" width="38" height="38" decoding="async" />
        <span class="wordmark">F1 STORIES<span class="wordmark-dot">.</span></span>
      </a>
      <div class="site-nav-links" id="nav-links" popover>
        <a href="https://f1stories.gr/">Αρχική</a>
        <a href="https://f1stories.gr/blog-module/blog/index.html">Άρθρα</a>
        <a href="https://www.youtube.com/@f1_stories_original" target="_blank" rel="noopener">YouTube</a>
        <a href="https://f1stories.gr/standings/">Βαθμολογία</a>
        <a href="https://f1stories.gr/standings/?tab=tyre-pace" class="is-current" aria-current="page">Δεδομένα</a>
        <a href="https://f1stories.gr/authors/">Συντάκτες</a>
        <a href="https://georgiosbalatzis.github.io/BetCastVisualisation/" target="_blank" rel="noopener">BetCast</a>
      </div>
      <div class="site-nav-right">
        <p class="nav-countdown" id="nav-countdown" hidden>
          <span class="nav-countdown-name"></span><span class="nav-countdown-time"></span>
        </p>
        <button type="button" class="theme-toggle" data-theme-toggle aria-label="Σκούρο θέμα" aria-pressed="false">…moon/sun svgs as today…</button>
        <button type="button" class="nav-menu" popovertarget="nav-links" aria-label="Μενού">…3-line svg as today…</button>
      </div>
    </div>
  </nav>
</header>
```

- The seven links, labels, order and hrefs are exactly `main-site/partials/nav.html` with `/` made absolute to
  `https://f1stories.gr`. **There is no Tyres link.** **Δεδομένα** is current: TYRES belongs to Race Desk, and Race Desk lives
  under Δεδομένα. This is the same as Telemetry.
- No icons in the links (Telemetry parity). The external-link ↗ appears only in the mobile panel via CSS (below).

**Race Desk hero** (first child of `<main id="main" tabindex="-1">`):

```html
<header class="desk-hero">
  <div class="shell">
    <div class="kicker-row">
      <span class="kicker">F1 STORIES / RACE DESK</span>
      <nav class="race-desk-nav" aria-label="Race Desk" lang="en">
        <a href="https://f1stories.gr/standings/">THE GRID</a>
        <a href="https://georgiosbalatzis.github.io/f1-telemetry-dashboard/">TELEMETRY</a>
        <a href="https://georgiosbalatzis.github.io/ghostcar/">GHOST CAR</a>
        <a href="%BASE_URL%" aria-current="page">TYRES</a>
      </nav>
    </div>
    <div class="hero-grid">
      <div>
        <h1 class="display"><span lang="en">TYRES<span class="dot">.</span></span><span class="display-descriptor">Ελαστικά &amp; απαιτήσεις πίστας</span></h1>
        <div id="r-identity"><!--app:identity--></div>
      </div>
      <aside class="hero-aside"><strong>Κάθε γόμα, μια ιστορία.</strong><p>…PAGE.hero.taglineBody…</p></aside>
    </div>
  </div>
</header>
<div class="signal-band">
  <div class="shell signal-band-inner">
    <p class="signal-status" id="r-band"><!--app:band--></p>
    <span class="signal-slogan" lang="en">EVERY COMPOUND COUNTS.</span>
  </div>
</div>
```

- `identity(r)` (templates.ts) now returns `<h2 id="race-title" class="hero-subtitle">{race name}</h2>` followed by
  `<p class="hero-meta">{circuit} · {location} · {dates}</p>`. Missing parts are dropped, never shown as placeholders. The id
  `race-title` is kept (e2e uses it).
- Add `band(r)` to templates.ts: `● Προεπισκόπηση Pirelli · Σεζόν 2026` `|` `Αγώνας 16` `|` `{STRINGS.el.status[status]}`.
  Separators are `<span class="signal-sep" aria-hidden="true"></span>`, as in Telemetry. The leading dot is the
  `.signal-live::before` 7px circle. The status is always present (status honesty).
- `page.ts` `renderPage` replaces `<!--app:identity-->` and `<!--app:band-->`, and `app.ts` `renderRace` re-renders `#r-identity`
  and `#r-band`. Delete `heroWord`, `#r-hero` and their CSS.

**Sponsors + colophon** (after `</main>`). This is a direct transliteration of `tele/src/components/dashboard/SiteFooter.tsx`:
the same six sponsors, order, hrefs, `rel="noopener sponsored"`, relation labels, `srcset` (`-1x.webp 1x, .webp 2x`),
`loading="lazy"`, `width="320" height="160"`, and the heading `ΜΑΖΙ ΣΤΗΝ ΕΚΚΙΝΗΣΗ`. Image paths use `%BASE_URL%images/sponsors/normalized/`.
Then:

```html
<footer class="colophon">
  <div class="shell">
    <div class="colophon-brand"><a href="https://f1stories.gr/" class="wordmark" aria-label="F1 Stories, αρχική σελίδα">F1 STORIES<span class="wordmark-dot">.</span></a><p>Τεχνική ανάλυση, άποψη και ελληνική F1 κοινότητα.</p></div>
    <nav class="colophon-links" aria-label="Ενότητες">
      <a href="https://f1stories.gr/blog-module/blog/index.html">Άρθρα</a>
      <a href="https://f1stories.gr/standings/">Βαθμολογία</a>
      <a href="https://f1stories.gr/authors/">Συντάκτες</a>
      <a href="https://www.youtube.com/@f1_stories_original" target="_blank" rel="noopener">YouTube ↗</a>
      <a href="https://georgiosbalatzis.github.io/BetCastVisualisation/" target="_blank" rel="noopener">BetCast ↗</a>
    </nav>
    <div class="colophon-meta">
      <span>© <span data-current-year>2026</span> F1 Stories. Με επιφύλαξη παντός δικαιώματος.</span>
      <span>{PAGE.credits.disclaimer} {PAGE.credits.sources}</span>
    </div>
    <div class="colophon-social">
      <!-- five links from tele SITE_SOCIAL_LINKS, each <svg width="20" height="20" aria-hidden="true"><use href="%BASE_URL%f1stories-social.svg#fa-youtube"/></svg> -->
    </div>
    <div class="colophon-legal"><a href="https://f1stories.gr/privacy/privacy.html">Πολιτική Απορρήτου</a><a href="https://f1stories.gr/privacy/terms.html">Όροι Χρήσης</a></div>
  </div>
</footer>
```

- The `index.html` copy is static, but the credits text must equal `PAGE.credits`. Inject it with a `<!--app:credits-->`
  placeholder in `renderPage` instead of duplicating it.
- `data-current-year` is filled by the prerender (`new Date().getUTCFullYear()` at build). No runtime script.
- The archive is **not** in the footer any more (Phase 4 moves it into `main`).
- No cookie-settings button. TYRES has no consent system, as with Telemetry.

### 3c. Countdown: `src/ui/countdown.ts` (new)

```ts
// Mirrors the calendar in f1StoriesPage/scripts/shared-nav.js ("Next Race Countdown"). Update both together;
// `npm run site:check` reports drift. Names stay as the site writes them ("Singapore GP").
export const CALENDAR: readonly { name: string; start: string }[] = [ /* copy every { name, date } entry verbatim */ ];

export function nextRace(now: number, calendar = CALENDAR) { /* earliest start > now, or null */ }
/** "6d 0h 36m", as the site's masthead shows it. */
export function formatCountdown(ms: number): string { /* port tele nextMeeting.ts formatCountdown */ }
```

In `app.ts` `start()`, fill `#nav-countdown` (name and time), un-hide it, and refresh every 60s with `setInterval`. Leave it
hidden when `nextRace` is null. No flag emoji (CLAUDE.md: no emoji). Add `tests/unit/countdown.test.ts` covering
`nextRace` (picks the earliest future race, null after the last race) and `formatCountdown` (0, 59s, 1d 2h 3m).

### 3d. `src/styles/shell.css` (new; import it from `main.ts` right after `tokens.css`)

Port Telemetry's site-chrome CSS (§2), renamed per the token table. The target values are below. Every number is from the
canonical pages, so don't "improve" them:

```css
/* Masthead, Race Desk hero, signal band, sponsors and colophon. Mirrors f1stories.gr via Telemetry's src/index.css
   ("Site chrome"); keep in step with them, not with the rest of this app. */
.shell { max-width: var(--shell-max); margin-inline: auto; padding-inline: var(--gutter); }

.site-header { position: relative; z-index: 40; padding-top: var(--nav-h); }
:root { scroll-padding-top: var(--nav-h); }
.site-nav { position: fixed; inset: 0 0 auto; z-index: 1; background: var(--c-surface);
  background-image: radial-gradient(ellipse at 5% 0%, #ffffff4d, transparent 65%);
  border-bottom: 1px solid color-mix(in srgb, var(--c-text) 20%, transparent); }
:root[data-theme="dark"] .site-nav { background-image: linear-gradient(180deg, #ffffff08, transparent 75%); border-color: var(--c-rule); }
.site-nav-inner { display: flex; align-items: center; gap: 28px; min-height: 75px; }
.brand { display: flex; align-items: center; flex-shrink: 0; gap: 8.8px; min-height: 44px; color: inherit; text-decoration: none; }
.brand img { width: 38px; height: 38px; }
.wordmark { font: 700 28px/1 var(--font-brand); letter-spacing: -.035em; white-space: nowrap; }
.wordmark-dot { color: var(--c-signal); }
.site-nav-links { align-self: stretch; gap: 22.4px; font-size: 14px; font-weight: 500; }
.site-nav-links a { position: relative; display: inline-flex; align-items: center; min-height: 44px; color: inherit; text-decoration: none; }
.site-nav-links a.is-current { font-weight: 600; }
.site-nav-links a::after { content: ''; position: absolute; left: 0; right: 0; bottom: 21px; height: 2px; background: var(--c-signal);
  transform: scaleX(0); transform-origin: right; transition: transform .35s var(--ease-editorial); }
.site-nav-links a.is-current::after { right: 60%; transform: scaleX(1); }
.site-nav-links a:is(:hover, :focus-visible)::after { right: 0; transform: scaleX(1); transform-origin: left; }
.site-nav-right { display: flex; align-items: center; gap: 9.6px; margin-left: auto; min-width: 0; }
.nav-countdown { display: none; flex-direction: column; margin: 0; padding-left: 19.2px; border-left: 1px solid var(--c-rule); font-size: 12px; line-height: 1.3; }
.nav-countdown-name { max-width: 125px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--c-text-2); }
.nav-countdown-time { font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; }
.theme-toggle { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border: 0; background: none; color: var(--c-text-2); }
.nav-menu { display: grid; place-items: center; width: 44px; height: 44px; border: 1px solid var(--c-rule); background: none; color: inherit; }

/* Desktop (≥992px): links inline, popover behaviour off. Below: the links are the popover panel. */
@media (min-width: 992px) {
  .site-nav-links { display: flex; position: static; inset: auto; margin: 0; padding: 0; border: 0; background: none; overflow: visible; }
  .nav-menu { display: none; }
}
@media (max-width: 991px) {
  .site-nav-inner { min-height: 67px; gap: 16px; }
  .brand { font-size: 25.6px; }
  .site-nav-links:popover-open { position: fixed; inset: 67px 0 auto; display: grid; margin: 0; padding: 0; width: 100%;
    max-height: min(430px, calc(100svh - 68px)); overflow-y: auto; background: var(--c-surface);
    border: 0; border-top: 1px solid var(--c-rule); border-bottom: 1px solid var(--c-rule); }
  .site-nav-links a { min-height: 52px; padding: 12.8px 24px; border-left: 3px solid transparent; border-bottom: 1px solid var(--c-rule); font-size: 14.72px; }
  .site-nav-links a::after { display: none; }
  .site-nav-links a.is-current { border-left-color: var(--c-signal); }
  .site-nav-links a[target="_blank"]::after { display: block; position: static; content: '↗'; height: auto; margin-left: auto; background: none; transform: none; color: var(--c-text-2); }
  .site-nav-links a:is(:hover, :focus-visible) { background: #20251f0a; }
  :root[data-theme="dark"] .site-nav-links a:is(:hover, :focus-visible) { background: #ffffff0a; }
  .site-nav-links a:focus-visible { outline-offset: -5px; }
}
@media (max-width: 575px) {
  .brand { font-size: 23.2px; gap: 7.2px; }
  .brand img { width: 32px; height: 32px; }
  .site-nav-right { gap: 2.4px; }
}
/* Countdown: full at 768–991 and ≥1200px, time only at 576–767px, hidden on phones and compact desktop (site rule). */
@media (min-width: 576px) and (max-width: 767px) { .nav-countdown:not([hidden]) { display: flex; } .nav-countdown-name { display: none; } }
@media (min-width: 768px) and (max-width: 991px), (min-width: 1200px) { .nav-countdown:not([hidden]) { display: flex; } }

/* Race Desk hero */
.desk-hero { padding: 24px 0 32px; background: linear-gradient(180deg, var(--c-surface), var(--c-bg)); }
.kicker-row { display: flex; justify-content: space-between; gap: 16px; padding-top: 12px; border-top: 1px solid var(--c-text); }
.kicker, .display-descriptor { font-size: 12px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; }
.race-desk-nav { display: flex; gap: 24px; margin-top: -12px; }
.race-desk-nav a { position: relative; display: flex; align-items: center; min-height: 44px; font: 700 15px/1 var(--font-brand);
  letter-spacing: .06em; white-space: nowrap; color: var(--c-text-2); text-decoration: none; }
.race-desk-nav a::before { content: ''; position: absolute; inset: 0 0 auto; height: 3px; background: var(--c-signal);
  transform: scaleX(0); transform-origin: left; transition: transform .35s var(--ease-editorial); }
.race-desk-nav a:is(:hover, [aria-current="page"]) { color: var(--c-text); }
.race-desk-nav a[aria-current="page"]::before { transform: scaleX(1); }
.race-desk-nav a:focus-visible { outline-offset: 2px; }
@media (max-width: 767px) {
  .kicker-row { flex-wrap: wrap; gap: 0; }
  .race-desk-nav { flex: 1 0 100%; margin-top: 10px; border-top: 1px solid var(--c-rule); justify-content: space-between; }
}
@media (max-width: 400px) { .race-desk-nav { gap: 12px; } .race-desk-nav a { letter-spacing: .03em; } } /* 4 products must fit 320px */
.display { margin: 0; font: 700 clamp(64px, 10vw, 150px)/.84 var(--font-brand); letter-spacing: -.01em; text-transform: uppercase; }
.display .dot { color: var(--c-signal); }
.display-descriptor { display: block; margin-top: 14px; color: var(--c-text-2); font-family: var(--font); line-height: 1.5; }
.hero-grid { display: grid; gap: 24px; align-items: end; margin-top: 22px; }
.hero-subtitle { margin: 14px 0 0; font-size: 20px; font-weight: 400; letter-spacing: -.02em; overflow-wrap: anywhere; }
.hero-meta { margin: 6px 0 0; color: var(--c-text-2); font-size: 14px; }
.hero-aside { display: none; }
@media (min-width: 1024px) {
  .desk-hero { padding: 28px 0 40px; }
  .hero-grid { grid-template-columns: 1fr 290px; gap: 40px; margin-top: 36px; }
  .hero-subtitle { font-size: 30px; }
  .hero-aside { display: block; padding-left: 24px; border-left: 1px solid var(--c-rule); color: var(--c-text-2); }
  .hero-aside strong { display: block; margin-bottom: 10px; font-size: 26px; font-weight: 400; line-height: 1.25; }
  .hero-aside p { margin: 0; font-size: 13px; }
}

/* Signal band */
.signal-band { background: var(--c-signal); color: var(--c-signal-ink); }
.signal-band-inner { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; min-height: 58px; padding-block: 7px; font-size: 13px; font-weight: 600; }
.signal-status { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; margin: 0; }
.signal-live::before { content: ''; display: inline-block; width: 7px; height: 7px; margin-right: 8px; border-radius: 50%; background: currentColor; }
.signal-sep { width: 1px; height: 18px; background: color-mix(in srgb, var(--c-signal-ink) 33.333333%, transparent); }
.signal-band :focus-visible { outline-color: var(--c-signal-ink); }
.signal-slogan { display: none; margin-left: auto; font: 700 24px/1 var(--font-brand); letter-spacing: -.01em; text-transform: uppercase; }
@media (min-width: 1024px) { .signal-slogan { display: block; } }

/* Sponsors and colophon: copy tele/src/index.css .sponsor-strip … .colophon-legal (≈ lines 1014–1057) verbatim,
   renamed per docs/REDESIGN-GUIDE.md §P1, with .page-shell → .shell. */
```

- The skip link, focus defaults (`:where(a, button, input, select, summary, [tabindex]):focus-visible { outline: 2px solid
  var(--c-accent); outline-offset: 5px }`) and `.visually-hidden` already exist in `app.css`. Move them to `shell.css` so
  the shell is self-contained.
- Delete the old `site nav`, `masthead`, `colophon` and noise-grain-on-nav sections from `app.css`. Keep the paper grain on
  `body` in light mode (the site has it, see `editorial.css` ≈ line 178).
- Verify the switcher fits at **320px** with four items. If it doesn't, the 400px rule above may tighten to `gap: 8px`,
  but never wrap a label or scroll.

### 3e. Shell test: `tests/e2e/shell.spec.ts` (new, modelled on `ghost/e2e/race-desk.smoke.spec.js`)

- Global nav: seven links in canonical order. Exactly one `[aria-current="page"]`, and it's "Δεδομένα". No "TYRES"/"Tyres" in the
  masthead (`getByRole('banner')`).
- Race Desk nav: `aria-label="Race Desk"`, links exactly `["THE GRID","TELEMETRY","GHOST CAR","TYRES"]`, TYRES is the only
  `aria-current`, no `target` attributes, no BetCast.
- Exactly one H1, with text `TYRES.`. "Race Desk" is not a heading.
- At 1440, 1024, 768, 390, 375 and 320px: no horizontal overflow, and the switcher links are ≥ 44px tall. Below 992px, the menu
  button opens the popover, which shows seven 52px rows, and Esc closes it.
- When scrolled, the fixed masthead paints above the switcher (`elementFromPoint` at the switcher's top while it
  sits under the masthead returns a masthead element).
- Footer: six sponsor images load (`naturalWidth > 0`), five social links, the privacy/terms hrefs, and the credits text contains
  "Pirelli" and "CC BY 4.0".

Commit: `Shell: f1stories masthead, Race Desk hero, signal band, sponsors and colophon`.

## Phase 4 — Product body

Target structure inside `<main>` after the band. Replace `mainRegions` in `page.ts` and the matching parts of
`index.html`:

```
.scope (shell)            Σεζόν [select] · Grand Prix [select] · ‹ › · (right) Ενσωμάτωση
#notice                   role=status (unchanged behaviour)
.shell.stage[data-mode]   (keeps the class/attribute app.ts already toggles)
  #r-specs  .context-row  Γόμες · Μήκος πίστας · Γύροι · Απόσταση αγώνα · Απώλεια pit stop · Ρεκόρ γύρου
  .tab-strip.modes        Μονοθέσιο · Πίστα · Ελαστικά · Πίνακας   (buttons .mode[data-mode], aria-pressed)
  .desk-layout
    section.viewport      canvas-host (bench) · #r-data · #r-readout
    aside.desk-aside      title "ΔΕΛΤΙΟ ΕΛΑΣΤΙΚΩΝ" · #r-compounds · #r-ratings · #r-setup
  section.panel#r-source  Πηγή (title block as a ruled context row)
  section.panel#r-season  Επιλογές γομών, σεζόν 2026 (season strip)
  section.panel.archive   Αρχείο προεπισκοπήσεων (moved from the footer; `.archive a` count unchanged)
```

Keep every existing element id that `app.ts` and the tests use (`#year`, `#race`, `#prev`, `#next`, `#embed-open`, `#notice`,
`#canvas-host`, `#loading-3d`, `#view-tools`, `#r-*`, `.mode`, `.chip`, `.corner`, `.compound`, `.archive`). Change classes and
markup freely.

### Component specs (all in `app.css`; remove the old rules for each)

**Scope row** (Telemetry's `.session-scope`): `border-bottom: 1px solid var(--c-rule); padding: 22px 0 16px`. Fields sit in
a grid (`auto-fit`, Σεζόν 120px, Grand Prix `minmax(240px, 420px)`, stepper, embed pushed right with `margin-left: auto`).
- `.field-label`: 11px, 600, `.12em`, uppercase, `--c-text-2`, margin-bottom 6px.
- Selects: Telemetry `.dashboard-select`. No box, `border-bottom: 1.5px solid var(--c-text)`, 16px text, `min-height: 44px`,
  CSS chevron via the two `linear-gradient`s, and `border-bottom-color: var(--c-signal)` on focus. `option` uses
  `background: var(--c-surface)`.
- Prev/next (`#prev`/`#next` stay `<a>` from `stepper()`): Telemetry `.dashboard-nav-button`, a 28px outlined square
  (`::before inset: 8px; border: 1px solid var(--c-text-2)`) inside a 44px target, chevron icon, and `aria-label`
  `PAGE.scope.prev/next`. Disabled = `aria-disabled="true"`, 40% opacity, no href (keep current logic).
- Embed button: Telemetry `.text-action`. 12px text, `--c-text-2`, `--c-accent` on hover, the existing `</>` icon, and label
  "Ενσωμάτωση". Still hidden until JS (unchanged).
- Phones (<640px): Σεζόν and Grand Prix take full width on two rows, with the stepper beside Grand Prix.

**Context row** `#r-specs` (THE GRID `.standings-context-row`): `display: grid; grid-template-columns: repeat(6, minmax(0,1fr))`
at ≥1200px, 3 columns at 768–1199px, 2 below. Each cell has `padding: 16px 20px 16px 0`, a `1px` right rule except the last in a row, and
`border-bottom: 1px solid var(--c-rule)` on the row.
- Label: 11px 600 `.12em` uppercase `--c-text-2`.
- Value: Plex 600, `clamp(1.25rem, 1rem + .6vw, 1.625rem)`, tabular. Unit: 13px `--c-text-2`. Note: 12px `--c-text-2`
  (for example "εκτίμηση Pirelli" under pit loss, or the driver/year under the lap record).
- **First cell "Γόμες"** lists the three compounds inline: a 10px disc in `--c-{hard,medium,soft}`, a 1px `--c-text` ring for hard,
  then the C-number. Missing = "Δεν δόθηκε".
- Every missing value is `STRINGS.el.notProvided` in `--c-text-2`, never `0`.

**Tabs** `.tab-strip.modes` (Telemetry `.tab-strip`): a flex row with `border-bottom: 1px solid var(--c-rule)`, `margin: 24px 0`,
`overflow-x: auto`, hidden scrollbar. Buttons have no border/background, `min-height: 56px`, `padding: 0 16px`, 15px, `--c-text-2`,
`border-bottom: 2px solid transparent; margin-bottom: -1px`. `[aria-pressed="true"]` → `--c-text`, weight 600,
`border-bottom-color: var(--c-signal)`. Focus `outline-offset: -4px`. Sentence-case Greek labels from `PAGE.modes` (**not**
uppercase, and not the old ink block).

**Layout** `.desk-layout`: `grid-template-columns: minmax(0, 1fr) 300px; gap: 48px` at ≥1100px, one column below (aside
after the viewport). The aside has `padding-left: 24px; border-left: 1px solid var(--c-rule)` on desktop and none on mobile.

**Viewport / bench** (`bench.css`):
- Keep the dark `.canvas-host` with the 40px grid, 16:11 aspect (4:3 on phones), the probe sweep and the fallback SVG.
- Delete the `.hero-word` element, CSS and code.
- `.view-tools` buttons: 44px, transparent, `1px solid var(--c-colophon-rule)`, paper icons, and `border-color` paper at 35% on
  hover/focus (as `.colophon-social a`). No filled squares.
- "Φόρτωση 3D…" stays text in the bench's corner in `--c-text-2` (bench scope).

**Sub-views** `.chip` (Διαμήκη φορτία · Πλευρικά φορτία · …): a second-level text toggle, distinct from the tabs. 13px,
`--c-text-2`, `min-height: 44px`, `padding: 0 12px`, no border. `[aria-pressed="true"]` → `--c-text` with `background: var(--c-accent-muted)`
(Telemetry `.utility-button[aria-pressed]`). Row scrolls horizontally on phones (keep today's behaviour). No boxes.

**Corner readout** `.corner` (2×2, FL FR / RL RR): unboxed grid. Each button is `min-height: 56px`, `border-bottom: 1px solid
var(--c-rule)`, `box-shadow: inset 3px 0 0 {heat colour}` (the THE GRID team stripe), `padding-left: 14px`, with the label 12px
`--c-text-2` above the value "3,7 / 5" (Plex 600, 18px, tabular) and "παράγωγο" 12px. Pressed → `background: var(--c-accent-muted)`.
Below it: the heat legend (Χαμηλή → Υψηλή απαίτηση, existing gradient bar) and the `STRINGS.el.derived` note in 13px
`--c-text-2`, max 72ch, with the "Μέθοδος" link.

**Aside title**: `h2.aside-title`, Barlow Condensed 700, 1.5rem, uppercase, `letter-spacing: .02em` → "ΔΕΛΤΙΟ ΕΛΑΣΤΙΚΩΝ"
(`PAGE.aside.title` uppercased in CSS). Then `p.aside-sub` 14px `--c-text-2` (THE GRID "ΑΓΩΝΙΣΤΙΚΟ ΔΕΛΤΙΟ" +
"Πλαίσιο πρωταθλήματος οδηγών"). Sections inside the aside are separated by 23px.

**Panel heading** (every section title: aside sections, source, season, archive, data table): Telemetry `.dashboard-panel` +
`.panel-heading h2`, so `border-top: 2px solid var(--c-text); padding-top: 12px`, title 12px 600 `.12em` uppercase, an optional
right-aligned aside in 12px `--c-text-2` (for example "Βαθμολογία Pirelli, 1–5", "Slick 18 ιντσών"). Delete the old `.section-title`
variants.

**Compounds** `#r-compounds` (aside): rows, not cards. Each `.compound` button is `min-height: 56px`, `display: grid;
grid-template-columns: 40px 1fr auto`, has `border-bottom: 1px solid var(--c-rule)`, and contains the existing sidewall disc (36px), the race
label (`HARD`/`MEDIUM`/`SOFT`, 12px 600 `.12em` uppercase in `--c-{x}-text`) and the C-number (Plex 600, 18px). It's
interactive only in tyres mode (keep the logic). `[aria-pressed="true"]` → `box-shadow: inset 3px 0 0 var(--c-signal)` +
`--c-accent-muted` background. Delete the border boxes.

**Ratings** `#r-ratings`: keep the five-segment heat bars (data). Rows are `min-height: 44px` with a 1px rule between them, the label left
(15px), bars, then "4/5" (Plex 600 tabular, "/5" in `--c-text-2`). Missing → empty scale + "Δεν δόθηκε". Explanations
(`PAGE.ratingExplain`) go in the `title`/`#r-data` table only, as today. Link "Τι σημαίνουν οι βαθμολογίες" below.

**Setup** `#r-setup`: per limit, a label (13px `--c-text-2`, with the FP2 note in 12px italic as today) and an Εμπρός / Πίσω
figure pair (Plex 600, 20px tabular, units in `--c-text-2`). Panel aside: `STRINGS.el.slick`.

**Data table** `#r-data` (Πίνακας mode): THE GRID table style. Caption as a panel heading, `th` 11px 600 `.12em` uppercase
`--c-text-2` with `border-bottom: 2px solid var(--c-text)`, rows 1px `--c-rule`, numbers right-aligned tabular, notes 12px
`--c-text-2`. Missing cells keep `.is-missing` + "Δεν δόθηκε".

**Source** `#r-source` (title block → context-row style): cells for Πηγή (article link, 600, underlined), Εκδότης, Δημοσίευση,
Ανάκτηση, Εγγραφή (id + "επίσημο γραφικό" link), and Κατάσταση δεδομένων (status label 600 + `PAGE.statusExplain` 12px). Use
the same cell styling as `#r-specs`: 6 columns on desktop, 2 on phones. The status cell keeps its existing marker (□ / ✓).

**Season** `#r-season`: keep `season.css` visuals (they're data). Swap the header for a panel heading with
`STRINGS.el.seasonTitle(y)` + aside `STRINGS.el.roundsNote(n)`. Check that the current-round column highlight uses
`--c-raised` and the dots keep `--c-{compound}`.

**Archive** `.archive` (moved from the colophon to the end of `main`): panel heading `PAGE.archive.title` + aside count.
Seasons sit side by side in a grid (`repeat(auto-fill, minmax(260px, 1fr))`), each with a season label (12px 600 `.12em`) and a list
of `R{n}` (12px `--c-text-2`, 3ch) + race name (15px). Rows are `min-height: 44px` with 1px rules. The current race has
`aria-current="page"`, weight 600 and `box-shadow: inset 3px 0 0 var(--c-signal)`, `padding-left: 12px`. No red text (that was the old
`--c-accent` link colour on dark).

**Embed dialog** (author tool): the dialog surface is `--c-bg`, no radius, `2px solid var(--c-text)` top border, 24px padding,
max-width 960px. Fieldset legends are styled like `.field-label`, and radio options are text rows (`min-height: 44px`). The checked state is a native
radio + weight 600. The code textarea keeps the only monospace (documented exception). Buttons: primary "Αντιγραφή κώδικα" = the
site's ink button (`background: var(--c-text); color: var(--c-bg); min-height: 44px; padding: 0 18px; font-weight: 600`,
`--c-signal` background on hover with `--c-signal-ink` text); "Λήψη εικόνας" as `.text-action`. All copy is from `PAGE.embedDialog`.

### `app.ts` changes

- Mode buttons: labels from `PAGE.modes` (rendered in templates), behaviour unchanged.
- `renderRace` also renders `#r-identity` and `#r-band`. Drop `#r-hero`.
- Every notice and announcement comes from `PAGE.notice` / `PAGE.embedDialog`.
- `.archive` click handling: same logic, new location.
- Countdown init (Phase 3c).
- Read `$('.stage')` the same way. If you rename the wrapper, keep `data-mode` on it, since `bench.css`/`app.css` key off it.

Commit: `Body: Race Desk scope row, context row, tabs, stage and Δελτίο ελαστικών sidebar`.

## Phase 5 — Head, SEO, notices, 404

- `page.ts`: `SITE_NAME` → `PAGE.seo.siteName` ("F1 Stories"). Titles come from `PAGE.seo.title(...)` and `notFoundTitle`, and the
  description from `PAGE.seo.description(...)`. Add `<meta property="og:locale" content="el_GR" />`. `og:image:alt` comes from
  `PAGE.seo.ogAlt`/`ogAltGeneric`.
- The 404 notice is `PAGE.notice.notFound`.
- `index.html` has the default `<title>TYRES — Ελαστικά & απαιτήσεις πίστας Formula 1 | F1 Stories</title>`.
- Preload the three fonts the first paint needs, as Telemetry does (`ibm-plex-sans-400-600.woff2`, `…-greek.woff2`,
  `barlow-condensed-700.woff2`). They're Vite-processed imports in `tokens.css`, so use Vite's emitted URLs. If that turns out to be
  awkward, skip the preload and say so in the commit message rather than hard-coding hashed names.
- `grep -rn "Tyre Intelligence" src scripts index.html embed*.html package.json README.md` → replace every product mention
  with "TYRES" (the package `name` can stay).

Commit: `Head: Greek titles, descriptions and notices; TYRES naming`.

## Phase 6 — Embeds and images

Embeds already follow the article style closely. **Change only what's listed here.** The fixed-height row rule and the
script-free rule stand.

1. Tokens flow in automatically (the `--c-text-2` value). Check contrast in both `#dark` and light.
2. Footer brand line: `F1 STORIES.` wordmark + `Άνοιγμα στο TYRES ↗` (from `STRINGS`), and the hidden `.e-site` text becomes
   `TYRES · {host}`.
3. Make the panel kicker (for example "ΕΛΑΣΤΙΚΑ ΑΓΩΝΑ") and its top rule match the panel heading spec (2px `--c-text`, 12px 600 `.12em`).
   Most of this is already true, so just verify.
4. `src/ui/ogCard.ts` (1200×630 social card), the Race Desk version:
   - Paper background `#f2eee4` with grain. Top: a 1px ink rule, kicker `F1 STORIES / RACE DESK` left, `TYRES` with a 3px signal bar above it right.
   - Left column: `TYRES.` (Barlow 700, ~170px, red dot), then the race name (Plex 600, 44px) and `{circuit} · {dates in Greek}` (Plex 400, 24px).
   - Right column: three compound discs with HARD/MEDIUM/SOFT + C-number, and the circuit outline (existing SVG) in ink.
   - Bottom: a full-width signal band, 72px, `--c-signal` with `--c-signal-ink` text. Left `Προεπισκόπηση Pirelli · Αγώνας {n} · Σεζόν {y}`,
     right `EVERY COMPOUND COUNTS.` (Barlow 700).
   - All text in Greek via `STRINGS.el`/`PAGE`. Missing values are left out, never invented.
   - Make `ogCardHtml` accept `record: RaceRecord | null`. With `null`, render the generic card (no race line or compounds). Then make
     `scripts/og-images.ts` also write `dist/og.png` from it, and delete `public/og.png`.
5. Panel images (`dist/img/...`) are screenshots of the embeds, so they update by themselves.

Commit: `Embeds and images: TYRES naming, Race Desk social card`.

## Phase 7 — Tests and visual parity

Update `tests/e2e/app.spec.ts`. Change these assertions and leave the rest alone:

| Test | Change |
|---|---|
| prerendered HTML | `#r-specs` contains `5,543` (Greek decimal comma) |
| previous/next | `#r-specs` contains `Δεν δόθηκε` |
| changing season | `#r-ratings` contains `Κάθετη δύναμη` |
| without WebGL | `#loading-3d` contains `STRINGS.el.noGl`'s text, and the `circuit` button is found by name `Πίστα` |
| missing race file | `#notice` contains `Δεν φορτώθηκε` |
| keyboard modes | button names `Πίστα`, `Πίνακας`, `Μονοθέσιο`, and the table contains `Όριο camber` (whatever the Greek row label is) |
| touch targets | keep the selector list (`.mode`, `.chip`, `.corner`, `.compound`, `#race`, `#year`), add `#prev`, `.race-desk-nav a`, `.site-nav .theme-toggle`, and require ≥ 44 |
| tyres mode | button name `Ελαστικά` |
| Embed dialog | button name `Ενσωμάτωση` |
| theme | replaced in Phase 1 |
| reference screenshots | regenerate |

Then run the visual parity pass (Playwright MCP or a scratch script; nothing committed). At 1440, 1280, 1024, 768, 390
and 375px, in both themes, screenshot TYRES next to Telemetry and THE GRID and check:

- [x] The masthead is pixel-aligned with the site: 75px (67px ≤991), logo 38px (32px ≤575), wordmark 28px, links 14px/500 with gap 22.4px,
      the current-link stub under "Δεδομένα", and the countdown visibility rules.
- [x] The left edges of the logo, kicker, H1, band text, scope, panels, sponsors label and colophon wordmark are on one vertical line
      (same `--gutter`) at every width.
- [x] The kicker rule, switcher bar position, H1 size/leading, descriptor and aside match Telemetry's hero.
- [x] Band height 58px (59 on phones), slogan hidden below 1024px, as on Telemetry.
- [x] No box/card borders remain anywhere outside the bench, data table cells and the embed code box.
- [x] Tabs look different from the switcher (underline below vs bar above).
- [x] Dark theme: no light-only colours leak (search `app.css` for raw hex, which should only be in tokens and the bench).
- [x] Keyboard: Tab order is skip link → masthead → switcher → scope → tabs → stage controls → aside → panels → footer. Every
      focus ring is fully visible (check the tab strip's inset ring and the mobile menu rows).
- [x] `prefers-reduced-motion`: there's no sweep or bar/underline transition.
- [x] Lighthouse a11y on `/Tyres/` ≥ 95. There are no console errors.

Commit: `Tests: Greek copy, Race Desk shell parity`.

## Phase 8 — Docs

- Rewrite `docs/DESIGN-SYSTEM.md` for the Race Desk system. It covers the shell (and where it comes from), the token table with the canonical
  mapping (TYRES `--c-*` ↔ editorial `--*`), components as built in Phase 4, the bench, motion and embeds. Drop the "light is
  default" and "spec sheet" sections.
- `docs/ARCHITECTURE.md`: update the page composition (placeholders `identity`, `band`, `credits`), `strings.ts`,
  `countdown.ts` and `shell.css`.
- `README.md`: title "F1 Stories — TYRES." with Greek UI noted, and a link to the Race Desk.
- `CLAUDE.md`: delete the "Redesign in progress" note and the `REDESIGN-GUIDE.md` mentions. Keep this guide in `docs/` as
  history, or delete it if the user prefers (ask).

Commit: `Docs: Race Desk design system`.

## Phase 9 — `site:check` drift script

`scripts/check-site.ts` (network, not part of `npm run check`; add `"site:check": "node scripts/check-site.ts"`). Model it on
`ghost/scripts/check-site-drift.mjs`. Fetch from `https://raw.githubusercontent.com/georgiosbalatzis/f1StoriesPage/main/`:

1. `partials/nav.html`: desktop link labels + hrefs (prefix relative ones with `https://f1stories.gr`) vs `index.html`'s
   `.site-nav-links`.
2. `partials/footer.html`: index links, social hrefs, privacy/terms hrefs vs the colophon.
3. `standings/index.html`: `.race-desk-nav` labels + hrefs vs ours (ignore our own `aria-current` item's href).
4. `scripts/shared-nav.js`: calendar `{ name, date }` entries vs `CALENDAR` in `src/ui/countdown.ts`.
5. `docs/design-tokens.json`: core theme values vs the `--c-*` values in `tokens.css` (via the mapping table).

Print a readable diff and exit 1 on any difference. Until Phase 10's main-site PR is merged, item 3 reports the missing TYRES
link. That's expected; say so in the output.

Commit: `site:check: report drift from f1stories.gr`.

## Phase 10 — Cross-repo: TYRES in the Race Desk switcher

**Ask the user before each push/PR.** Do this in order: the main site first (Ghost Car's drift check compares against it).
TYRES's URL is `https://georgiosbalatzis.github.io/Tyres/`. The order everywhere is THE GRID, TELEMETRY, GHOST CAR, TYRES.

1. **f1StoriesPage**
   - `standings/index.html`: append `<a href="https://georgiosbalatzis.github.io/Tyres/">TYRES</a>` to `.race-desk-nav`.
   - `docs/race-desk-architecture.md`: add TYRES to the hierarchy tree, the products table, the destinations table and
     "exactly four links in this order". Update the reference-implementation snippet.
   - `standings/standings-editorial.css`: confirm that four products fit at 320–400px (add the same ≤400px gap rule if needed).
   - Add a `/tyres/` redirect stub by copying `f1telemetry/index.html` (noindex, meta refresh, canonical, theme-init, no-flash
     style). Then `grep -rn "f1telemetry" scripts sitemap.xml robots.txt` and register `tyres/` wherever the telemetry stub
     is registered (build include lists, quality checks).
   - Run that repo's checks (`npm run check:tokens`, `quality:static` or whatever its README lists).
2. **f1-telemetry-dashboard**
   - `src/copy.ts` `RACE_DESK_NAV`: add `{ label: 'TYRES', href: AGGREGATED ? '/tyres/' : 'https://georgiosbalatzis.github.io/Tyres/' }`.
   - `src/components/__tests__/SiteShell.test.tsx`: expected links. `docs/RACE_DESK.md`: tables.
   - `src/index.css`: ≤400px gap rule if four labels overflow. Run `npm test`, `npm run lint`, `npm run build` and
     `node scripts/shell-parity.mjs`.
3. **ghostcar**
   - `src/app/siteNav.js` `RACE_DESK_LINKS`: add TYRES. `e2e/race-desk.smoke.spec.js`: expected labels. `docs/race-desk.md`.
   - `src/app/app.css`: the same overflow check. Run its tests and `npm run check:site` (after the main PR is merged).

Each PR description states that it adds the fourth Race Desk product per the updated `race-desk-architecture.md`, with the link to
TYRES.

---

## Definition of done

- A reader moving from f1stories.gr → Δεδομένα → TELEMETRY → TYRES sees the same masthead, the same hero rhythm, the same
  band, the same controls and the same footer, with only the product content changing.
- No English UI text remains on the TYRES page outside product names, F1 terms and Pirelli data values.
- `npm run check` and `npm run test:e2e` pass, and `npm run site:check` is clean after Phase 10 merges.
- Every Pirelli value still shows provenance and status, and missing values still read "Δεν δόθηκε".
