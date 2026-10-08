/**
 * All user-visible wording. STRINGS holds the vocabulary shared by the page and the article embeds (Greek and
 * English); PAGE holds copy that exists only on the main page (Greek). Components never carry literal UI copy.
 */
import type { CarView, DerivedText } from '../domain/derivedMetrics.ts';
import type { CharacteristicKey, DataStatus, RaceRecord } from '../domain/schema.ts';
import type { EmbedLang, EmbedPanel, ResolveNotice } from '../domain/urlState.ts';

export interface Strings {
  locale: string;
  panel: Record<EmbedPanel, string>;
  rating: Record<CharacteristicKey, string>;
  compound: Record<string, string>;
  status: Record<DataStatus, string>;
  notProvided: string;
  round: (n: number) => string;
  ratingScale: string;
  topDemands: string;
  front: string;
  rear: string;
  minPressure: string;
  minPressureShort: string;
  minPressureNote: string;
  runningPressure: string;
  camber: string;
  slick: string;
  length: string;
  laps: string;
  distance: string;
  pitLoss: string;
  pitKind: { estimate: string; average: string };
  lapRecord: string;
  circuitInfo: {
    firstGrandPrix: string;
    firstGrandPrixNote: string;
    mapNote: string;
    historySource: string;
    factsSource: string;
    outlineLead: string;
    outlineLabel: (name: string) => string;
  };
  noCompounds: string;
  noTrack: string;
  source: string;
  open: string;
  demandView: Record<CarView, string>;
  mode: Record<'car' | 'circuit' | 'tyres', string>;
  modesLabel: string;
  viewsLabel: string;
  load3d: string;
  loadNote: string;
  loading3d: string;
  noGl: string;
  failed3d: string;
  reset: string;
  laps2: (n: number) => string;
  outline: (name: string, licence: string) => string;
  tyresNote: string;
  modelCredit: string;
  seasonPanel: string;
  seasonTitle: (season: number) => string;
  roundsNote: (n: number) => string;
  compoundCol: string;
  previews: string;
  statusShort: Record<DataStatus, string>;
  planLabel: (view: string) => string;
  low: string;
  high: string;
  derived: string;
  method: string;
}

/* Greek glossary: editorial choices, kept in one place so they are easy to review. */
export const STRINGS: Record<EmbedLang, Strings> = {
  el: {
    locale: 'el-GR',
    panel: {
      summary: 'Ελαστικά αγώνα',
      compounds: 'Γόμες αγώνα',
      demands: 'Απαιτήσεις πίστας',
      car: 'Απαίτηση ανά ελαστικό',
      '3d': 'Τρισδιάστατη προβολή',
      setup: 'Όρια ρυθμίσεων',
      circuit: 'Η πίστα',
      'circuit-info': 'Στοιχεία πίστας',
      weather: 'Καιρός τριημέρου',
    },
    rating: {
      traction: 'Πρόσφυση',
      braking: 'Φρενάρισμα',
      tyreStress: 'Καταπόνηση ελαστικών',
      asphaltAbrasion: 'Τραχύτητα ασφάλτου',
      asphaltGrip: 'Κράτημα ασφάλτου',
      lateral: 'Πλευρικά φορτία',
      trackEvolution: 'Εξέλιξη πίστας',
      downforce: 'Κάθετη δύναμη',
    },
    // Compound names stay in English, as in Greek F1 coverage.
    compound: { hard: 'Hard', medium: 'Medium', soft: 'Soft' },
    status: {
      verified: 'Επαληθευμένα',
      transcribed: 'Μεταγραφή, προς έλεγχο',
      'needs-review': 'Χρειάζεται έλεγχο',
      fixture: 'Δοκιμαστικά δεδομένα',
    },
    notProvided: 'Δεν δόθηκε',
    round: (n) => `Αγώνας ${n}`,
    ratingScale: 'Βαθμολογία Pirelli, 1–5',
    topDemands: 'Μεγαλύτερες απαιτήσεις',
    front: 'Εμπρός',
    rear: 'Πίσω',
    minPressure: 'Ελάχιστη πίεση εκκίνησης',
    minPressureShort: 'Ελάχ. πίεση εκκίνησης',
    minPressureNote: 'Μπορεί να αλλάξει μετά το FP2',
    runningPressure: 'Αναμενόμενη πίεση λειτουργίας',
    camber: 'Όριο camber στο τέλος της ευθείας',
    slick: 'Slick 18 ιντσών',
    length: 'Μήκος πίστας',
    laps: 'Γύροι',
    distance: 'Απόσταση αγώνα',
    pitLoss: 'Απώλεια χρόνου στο pit stop',
    pitKind: { estimate: 'εκτίμηση Pirelli', average: 'μέσος όρος Pirelli' },
    lapRecord: 'Ρεκόρ γύρου',
    circuitInfo: {
      firstGrandPrix: 'Πρώτο Grand Prix',
      firstGrandPrixNote: 'Στο Παγκόσμιο Πρωτάθλημα Formula 1',
      mapNote:
        'Δεν υπάρχουν επαληθευμένα όρια τομέων, αριθμοί στροφών ή σημείο εκκίνησης για αυτή τη χάραξη.',
      historySource: 'Ιστορικό πίστας: Formula 1',
      factsSource: 'Στοιχεία αγώνα: Pirelli',
      outlineLead: 'Χάραξη:',
      outlineLabel: (name) => `Χάραξη της πίστας ${name}`,
    },
    noCompounds: 'Οι γόμες δεν έχουν ανακοινωθεί.',
    noTrack: 'Δεν υπάρχει ακόμη χάρτης της πίστας.',
    source: 'Πηγή',
    open: 'Άνοιγμα στο TYRES',
    demandView: {
      longitudinal: 'Διαμήκη φορτία',
      lateral: 'Πλευρικά φορτία',
      stress: 'Καταπόνηση ελαστικών',
      brakingTraction: 'Φρενάρισμα / πρόσφυση',
      pressures: 'Πιέσεις',
    },
    mode: { car: 'Μονοθέσιο', circuit: 'Πίστα', tyres: 'Ελαστικά' },
    modesLabel: 'Προβολή',
    viewsLabel: 'Απεικόνιση ελαστικών',
    load3d: 'Προβολή σε 3D',
    loadNote: 'φορτώνει περίπου 300 KB',
    loading3d: 'Φόρτωση 3D…',
    noGl: 'Το 3D δεν είναι διαθέσιμο σε αυτή τη συσκευή. Εμφανίζεται το σχέδιο.',
    failed3d: 'Το 3D δεν φόρτωσε. Εμφανίζεται το σχέδιο.',
    reset: 'Επαναφορά κάμερας',
    laps2: (n) => `${n} γύροι`,
    outline: (name, licence) => `Χάραξη πίστας: ${name} (${licence}). Δεν σχεδιάζονται τομείς ή υψομετρικά.`,
    tyresNote: 'Το χρώμα στο πλάι δείχνει τον ρόλο της γόμας: λευκό Hard, κίτρινο Medium, κόκκινο Soft.',
    modelCredit: 'Μοντέλο: “Low Poly-F1”, salasilma13, CC BY 4.0',
    seasonPanel: 'Γόμες ανά αγώνα',
    seasonTitle: (y) => `Επιλογές γομών, σεζόν ${y}`,
    roundsNote: (n) => `${n} αγώνες με δημοσιευμένη προεπισκόπηση της Pirelli`,
    compoundCol: 'Γόμα',
    previews: 'προεπισκοπήσεις Pirelli',
    statusShort: {
      verified: 'επαληθευμένα',
      transcribed: 'μεταγραφή',
      'needs-review': 'προς έλεγχο',
      fixture: 'δοκιμαστικά',
    },
    planLabel: (view) => `Κάτοψη μονοθεσίου: ${view} ανά ελαστικό`,
    low: 'Χαμηλή',
    high: 'Υψηλή απαίτηση',
    // The required "Derived visualisation" label (CLAUDE.md), in Greek.
    derived:
      'Παράγωγη απεικόνιση με βάση τα χαρακτηριστικά πίστας της Pirelli. Τα χρώματα δείχνουν σχετική απαίτηση, όχι θερμοκρασία.',
    method: 'Μέθοδος',
  },
  en: {
    locale: 'en-GB',
    panel: {
      summary: 'Race tyres',
      compounds: 'Weekend compounds',
      demands: 'Track demands',
      car: 'Tyre demand by corner',
      '3d': '3D view',
      setup: 'Setup limits',
      circuit: 'Circuit',
      'circuit-info': 'Circuit information',
      weather: 'Weekend weather',
    },
    rating: {
      traction: 'Traction',
      braking: 'Braking',
      tyreStress: 'Tyre stress',
      asphaltAbrasion: 'Asphalt abrasion',
      asphaltGrip: 'Asphalt grip',
      lateral: 'Lateral',
      trackEvolution: 'Track evolution',
      downforce: 'Downforce',
    },
    compound: { hard: 'Hard', medium: 'Medium', soft: 'Soft' },
    status: {
      verified: 'Verified',
      transcribed: 'Transcribed, awaiting review',
      'needs-review': 'Needs review',
      fixture: 'Development fixture',
    },
    notProvided: 'Not provided',
    round: (n) => `Round ${n}`,
    ratingScale: 'Pirelli rating, 1–5',
    topDemands: 'Highest demands',
    front: 'Front',
    rear: 'Rear',
    minPressure: 'Minimum starting pressure',
    minPressureShort: 'Min. starting pressure',
    minPressureNote: 'Subject to change after FP2',
    runningPressure: 'Expected running pressure',
    camber: 'End-of-straight camber limit',
    slick: '18-inch slick',
    length: 'Circuit length',
    laps: 'Laps',
    distance: 'Race distance',
    pitLoss: 'Pit-stop time loss',
    pitKind: { estimate: 'Pirelli estimate', average: 'Pirelli average' },
    lapRecord: 'Lap record',
    circuitInfo: {
      firstGrandPrix: 'First Grand Prix',
      firstGrandPrixNote: 'In the Formula 1 World Championship',
      mapNote:
        'Verified sector boundaries, turn numbers and a start/finish point are not available for this outline.',
      historySource: 'Circuit history: Formula 1',
      factsSource: 'Race facts: Pirelli',
      outlineLead: 'Outline:',
      outlineLabel: (name) => `Outline of ${name}`,
    },
    noCompounds: 'Compounds not announced yet.',
    noTrack: 'Track outline not available yet.',
    source: 'Source',
    open: 'Open in TYRES',
    demandView: {
      longitudinal: 'Longitudinal',
      lateral: 'Lateral',
      stress: 'Tyre stress',
      brakingTraction: 'Braking / traction',
      pressures: 'Pressures',
    },
    mode: { car: 'Car', circuit: 'Circuit', tyres: 'Tyres' },
    modesLabel: 'View',
    viewsLabel: 'Tyre visualisation',
    load3d: 'View in 3D',
    loadNote: 'loads about 300 KB',
    loading3d: 'Loading 3D…',
    noGl: '3D isn’t available on this device. Showing the drawing.',
    failed3d: 'The 3D view couldn’t load. Showing the drawing.',
    reset: 'Reset camera',
    laps2: (n) => `${n} laps`,
    outline: (name, licence) => `Outline: ${name} (${licence}). Sectors and elevation are not drawn.`,
    tyresNote: 'Sidewall colour marks the weekend role: white hard, yellow medium, red soft.',
    modelCredit: 'Model: “Low Poly-F1”, salasilma13, CC BY 4.0',
    seasonPanel: 'Compounds by round',
    seasonTitle: (y) => `Compound choices, ${y} season`,
    roundsNote: (n) => `${n} rounds with a published Pirelli preview`,
    compoundCol: 'Compound',
    previews: 'Pirelli previews',
    statusShort: {
      verified: 'verified',
      transcribed: 'transcribed',
      'needs-review': 'needs review',
      fixture: 'fixture',
    },
    planLabel: (view) => `Car plan view: ${view} by tyre`,
    low: 'Low',
    high: 'High demand',
    derived:
      'Derived visualisation based on Pirelli circuit characteristics. Colours show relative demand, not temperature.',
    method: 'Method',
  },
};

/* ------------------------------------------------------------------ locale formatting */

export function fmt(t: Strings) {
  const num = (v: number | null | undefined, digits: number, unit = '') =>
    v == null
      ? null
      : `${v < 0 ? '−' : ''}${new Intl.NumberFormat(t.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Math.abs(v))}${unit}`;
  const day = new Intl.DateTimeFormat(t.locale, { day: 'numeric', timeZone: 'UTC' });
  const dayMonth = new Intl.DateTimeFormat(t.locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const full = new Intl.DateTimeFormat(t.locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const dates = (race: RaceRecord['race']) => {
    if (!race.startDate || !race.endDate) return null;
    const a = new Date(`${race.startDate}T00:00:00Z`);
    const b = new Date(`${race.endDate}T00:00:00Z`);
    return a.getUTCMonth() === b.getUTCMonth()
      ? `${day.format(a)}–${dayMonth.format(b)} ${b.getUTCFullYear()}`
      : `${dayMonth.format(a)} – ${dayMonth.format(b)} ${b.getUTCFullYear()}`;
  };
  const published = (iso: string | null) => {
    const t0 = iso ? Date.parse(iso) : Number.NaN;
    return Number.isNaN(t0) ? null : full.format(new Date(t0));
  };
  /** Publication time as shown to readers: date plus the source's local time and UTC offset. */
  const publishedTime = (iso: string | null) => {
    const m = iso
      ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(iso)
      : null;
    if (!m) return null;
    const date = full.format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))));
    const offset = m[6] === 'Z' ? 'UTC' : `UTC${m[6]!.replace(':00', '')}`;
    return `${date}, ${m[4]}:${m[5]} ${offset}`;
  };
  return { num, dates, published, publishedTime };
}

/* ------------------------------------------------------------------ page copy (Greek only) */

/**
 * Copy that exists only on the main page (not in article embeds). Greek, informal second person singular,
 * sentence case, «» quotes, decimal comma. Product names (TYRES), F1 terms (C1–C5, Hard/Medium/Soft, psi,
 * camber, pit stop, FP2) and Pirelli data values stay as published.
 */
export const PAGE = {
  skip: 'Μετάβαση στα δεδομένα του αγώνα',
  homeAria: 'F1 Stories, αρχική σελίδα',
  menu: 'Μενού',
  theme: 'Σκούρο θέμα', // aria-label of the toggle; aria-pressed carries the state
  hero: {
    descriptor: 'Ελαστικά & απαιτήσεις πίστας',
    tagline: 'Κάθε γόμα, μια ιστορία.',
    taglineBody:
      'Οι γόμες, οι απαιτήσεις της πίστας και τα όρια ρυθμίσεων από την προεπισκόπηση της Pirelli για κάθε Grand Prix.',
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
  },
  viz: 'Απεικόνιση',
  weather: {
    title: 'Καιρός τριημέρου',
    forecast: 'Πρόγνωση για την πίστα',
    archived: 'Αρχειοθετημένη πρόγνωση',
    noForecast: 'Η πρόγνωση δεν είναι διαθέσιμη',
    unavailable: 'Δεν υπάρχει διαθέσιμο πρόγραμμα για αυτό το τριήμερο.',
    forecastWindow:
      'Η πρόγνωση καλύπτει έως 16 ημέρες μπροστά. Αν δεν υπάρχουν ακόμη δεδομένα ή η πηγή δεν είναι διαθέσιμη, εμφανίζεται μόνο το πρόγραμμα.',
    stale: 'Η πρόγνωση είναι παλαιότερη από 24 ώρες. Ελέγξτε την ημερομηνία ενημέρωσης.',
    sessionTimeZone: 'Ώρες συνεδριών',
    athens: 'Ώρα Ελλάδας',
    track: 'Ώρα πίστας',
    sprintWeekend: 'Τριήμερο Sprint',
    temperature: 'Θερμοκρασία αέρα',
    maximum: 'μέγιστη',
    minimum: 'Ελάχιστη',
    humidity: 'Υγρασία',
    rainChance: 'Πιθανότητα βροχής',
    sessions: 'Πρόγραμμα',
    noSchedule: 'Οι ώρες δεν έχουν δοθεί.',
    scrollHint: 'Σύρετε οριζόντια για τις τρεις ημέρες.',
    dailyNote:
      'Ημερήσια μέγιστη / ελάχιστη θερμοκρασία, μέση υγρασία και μέγιστη πιθανότητα βροχής. Η υγρασία αφορά τον αέρα.',
    daysNote: (zone: string) => `Οι ημέρες ομαδοποιούνται στην ώρα πίστας (${zone}).`,
    scheduleSource: 'Πρόγραμμα: Formula 1',
    weatherSource: 'Καιρός: Open-Meteo · CC BY 4.0',
    updated: 'Ενημέρωση',
    session: {
      fp1: 'FP1',
      fp2: 'FP2',
      fp3: 'FP3',
      'sprint-qualifying': 'SPQ',
      sprint: 'Sprint',
      qualifying: 'Q',
      race: 'Αγώνας',
    },
    conditions: {
      sun: 'Ηλιοφάνεια',
      partial: 'Λίγες νεφώσεις',
      cloud: 'Συννεφιά',
      fog: 'Ομίχλη',
      drizzle: 'Ψιλόβροχο',
      rain: 'Βροχή',
      snow: 'Χιόνι',
      storm: 'Καταιγίδα',
      unknown: 'Δεν δόθηκε',
    },
  },
  modes: {
    label: 'Προβολή',
    car: 'Μονοθέσιο',
    circuit: 'Πίστα',
    'circuit-info': 'Στοιχεία πίστας',
    weather: 'Καιρός τριημέρου',
    tyres: 'Ελαστικά',
    data: 'Πίνακας',
  },
  aria: {
    facts: 'Στοιχεία πίστας',
    demandsAndSetup: 'Απαιτήσεις πίστας και ρυθμίσεις',
    carViews: 'Απεικόνιση μονοθεσίου',
    tyres: 'Ελαστικά',
  },
  aside: { title: 'Δελτίο ελαστικών', sub: 'Βαθμολογίες και όρια της Pirelli' },
  ratingsLink: 'Τι σημαίνουν οι βαθμολογίες',
  corner: { FL: 'Εμπρός αριστερά', FR: 'Εμπρός δεξιά', RL: 'Πίσω αριστερά', RR: 'Πίσω δεξιά' },
  derivedShort: 'παράγωγο',
  autoRotate: 'Αυτόματη περιστροφή',
  carPlan:
    'Κάτοψη ενός γενικού μονοθεσίου Formula 1 με τα ελαστικά χρωματισμένα κατά την επιλεγμένη παράγωγη προβολή',
  circuitOutline: (name: string | null) => (name ? `Χάραξη της πίστας ${name}` : 'Χάραξη της πίστας'),
  noOutlineAria: 'Δεν υπάρχει χάραξη πίστας',
  noOutline: 'Δεν υπάρχει ακόμη χάραξη για αυτή την πίστα.',
  derivedLabel: 'Παράγωγη απεικόνιση με βάση τα χαρακτηριστικά πίστας της Pirelli.',
  derivedNote: 'Τα χρώματα δείχνουν σχετική απαίτηση, όχι θερμοκρασία.',
  readout: {
    circuit: 'Η πίστα',
    outlineLead: 'Χάραξη:',
    outlineTail:
      'Δεν σχεδιάζονται όρια τομέων ή υψομετρικά, επειδή δεν δημοσιεύονται σε επαναχρησιμοποιήσιμη μορφή.',
    tyresRoleMid: 'τρέχει ως η γόμα',
    tyresRoleEnd: 'αυτό το Σαββατοκύριακο.',
    tyresNote:
      'Η Pirelli επιλέγει τρεις slick γόμες ανά αγώνα από τη γκάμα της. Το χρώμα στο πλάι δείχνει τον ρόλο της γόμας: λευκό Hard, κίτρινο Medium, κόκκινο Soft. Επίλεξε γόμα παρακάτω ή στη σκηνή.',
    data: 'Όλες οι τιμές της σελίδας σε πίνακα, με την προέλευσή τους.',
  },
  source: {
    title: 'Πηγή',
    opensNewPress: '(περιοχή τύπου Pirelli, ανοίγει σε νέα καρτέλα)',
    opensNew: '(ανοίγει σε νέα καρτέλα)',
    publisher: 'Εκδότης',
    publisherName: 'Pirelli Motorsport press',
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
    'needs-review':
      'Βρέθηκαν αυτόματα. Κάποιες τιμές δεν δημοσιεύονται ως κείμενο και δεν έχουν καταχωριστεί ακόμη.',
    fixture: 'Δοκιμαστικά δεδομένα. Δεν δημοσιεύονται.',
  },
  ratingExplain: {
    traction: 'Πόσο ζορίζει η χάραξη τα πίσω ελαστικά στις επιταχύνσεις από αργές στροφές.',
    braking: 'Συχνότητα και ένταση των δυνατών φρεναρισμάτων. Τα νιώθουν κυρίως τα εμπρός ελαστικά.',
    tyreStress: 'Η συνολική βαθμολογία της Pirelli για τις δυνάμεις που απορροφά η δομή του ελαστικού.',
    asphaltAbrasion: 'Πόσο τραχιά είναι η επιφάνεια. Υψηλότερη τιμή σημαίνει περισσότερη φθορά στο πέλμα.',
    asphaltGrip:
      'Το κράτημα που δίνει η ίδια η επιφάνεια. Χαμηλό κράτημα φέρνει ολισθήσεις και υπερθέρμανση.',
    lateral: 'Πλευρικά φορτία από γρήγορες και μεγάλες στροφές.',
    trackEvolution: 'Πόσο βελτιώνεται το κράτημα μέσα στο Σαββατοκύριακο, καθώς η πίστα γεμίζει λάστιχο.',
    downforce:
      'Το επίπεδο κάθετης δύναμης που τρέχουν οι ομάδες. Δημοσιεύεται μόνο στις προεπισκοπήσεις μορφής 2025.',
  } satisfies Record<CharacteristicKey, string>,
  table: {
    caption: (name: string, season: number) => `${name} ${season}: όλες οι δημοσιευμένες τιμές`,
    value: 'Τιμή',
    figure: 'Μέγεθος',
    meaning: 'Σημασία',
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
  viewer: {
    flat: 'Εμφανίζεται το σχέδιο.',
    load: 'Προβολή σε 3D',
    graphicsError: 'Η τρισδιάστατη προβολή αντιμετώπισε σφάλμα γραφικών.',
    contextLost: 'Η τρισδιάστατη προβολή έχασε το γραφικό της περιβάλλον.',
    buildFailed: 'Η τρισδιάστατη προβολή δεν μπόρεσε να δημιουργηθεί.',
    ariaCar: (view: string) =>
      `Τρισδιάστατο μοντέλο ενός γενικού μονοθεσίου Formula 1. Τα ελαστικά χρωματίζονται κατά «${view}». Παράγωγη απεικόνιση με βάση τα χαρακτηριστικά πίστας της Pirelli. Χρησιμοποίησε τα βελάκια για περιστροφή και τα + και − για ζουμ.`,
    ariaCircuit: (name: string | null) =>
      `Τρισδιάστατη χάραξη της πίστας${name ? ` ${name}` : ''}. Χρησιμοποίησε τα βελάκια για περιστροφή.`,
    ariaTyres: (list: string) => `Τρισδιάστατη προβολή των γομών του Σαββατοκύριακου: ${list}.`,
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
    iframeTitle: (title: string) => `${title} (F1 Stories TYRES)`,
  },
  notice: {
    showing: (name: string, season: number) => `Εμφανίζεται: ${name} ${season}`,
    loadFailed: (name: string, reason: string, current: string, season: number) =>
      `Δεν φορτώθηκε το ${name} (${reason}). Παραμένει το ${current} ${season}.`,
    bootDamaged: 'Τα ενσωματωμένα δεδομένα της σελίδας είναι κατεστραμμένα. Φορτώνεται η λίστα αγώνων.',
    manifestFailed:
      'Η λίστα αγώνων δεν φόρτωσε, οπότε οι άλλες προεπισκοπήσεις δεν επιλέγονται τώρα. Τα δεδομένα αυτής της σελίδας είναι πλήρη.',
    notFound: 'Αυτή η σελίδα δεν υπάρχει. Εμφανίζεται η πιο πρόσφατη προεπισκόπηση.',
    resolve: (n: ResolveNotice) =>
      n.kind === 'noRace'
        ? `Δεν υπάρχει προεπισκόπηση «${n.race}» για το ${n.year}. Εμφανίζεται η πιο πρόσφατη.`
        : n.kind === 'noYear'
          ? `Δεν υπάρχουν ακόμη προεπισκοπήσεις για το ${n.year}. Εμφανίζεται η πιο πρόσφατη.`
          : 'Από τον σύνδεσμο λείπει η σεζόν. Εμφανίζεται η πιο πρόσφατη προεπισκόπηση.',
  },
  seo: {
    siteName: 'F1 Stories',
    title: (race: string, season: number) =>
      `TYRES — ${race} ${season}: γόμες και απαιτήσεις πίστας | F1 Stories`,
    notFoundTitle: 'Η σελίδα δεν βρέθηκε | TYRES | F1 Stories',
    description: (compounds: string[], race: string, season: number, circuit: string | null) =>
      `${compounds.length ? `Γόμες ${compounds.join(', ')}` : 'Οι γόμες'} για το ${race} ${season}${circuit ? ` στην πίστα ${circuit}` : ''}: απαιτήσεις πίστας, πιέσεις εκκίνησης, όρια camber και στοιχεία πίστας από την προεπισκόπηση της Pirelli. Ανεπίσημη απεικόνιση.`,
    ogAlt: (race: string, season: number) =>
      `Σύνοψη ελαστικών για το ${race} ${season}: γόμες, χάραξη πίστας και βαθμολογίες απαιτήσεων της Pirelli`,
    ogAltGeneric: 'TYRES από το F1 Stories: γόμες και απαιτήσεις πίστας για κάθε Grand Prix',
  },
  /** Words the domain layer needs to describe a derived view (see deriveView). */
  derivedText: {
    notProvided: STRINGS.el.notProvided,
    num: (v: number, digits: number) =>
      new Intl.NumberFormat('el-GR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(
        v,
      ),
    derived: (value: string) => `${value} / 5 παράγωγο`,
    ratingOf: (rating: number, what: 'lateral' | 'stress' | 'braking' | 'traction') =>
      `${rating} / 5 ${{ lateral: 'πλευρικά', stress: 'καταπόνηση', braking: 'φρενάρισμα', traction: 'πρόσφυση' }[what]}`,
    psiMin: (psi: string) => `${psi} psi ελάχιστο`,
    longitudinal: (braking: string, traction: string) =>
      `Από φρενάρισμα ${braking} / 5 και πρόσφυση ${traction} / 5: τα εμπρός ζυγίζουν 65 % φρενάρισμα και 35 % πρόσφυση, τα πίσω αντίστροφα. Αριστερά και δεξιά εμφανίζονται ίσα, επειδή η Pirelli δεν δημοσιεύει τιμές ανά πλευρά.`,
    lateral:
      'Η βαθμολογία πλευρικών φορτίων εφαρμόζεται και στα τέσσερα ελαστικά, με έμφαση στους ώμους, όπου δρα το φορτίο στις στροφές.',
    stress: 'Η συνολική βαθμολογία καταπόνησης εφαρμόζεται ομοιόμορφα και στα τέσσερα ελαστικά.',
    brakingTraction:
      'Τα εμπρός ελαστικά δείχνουν τη βαθμολογία φρεναρίσματος, τα πίσω τη βαθμολογία πρόσφυσης.',
    pressures: (min: number, max: number) =>
      `Οι επίσημες ελάχιστες πιέσεις εκκίνησης τοποθετημένες σε χρωματική κλίμακα ${min}–${max} psi, για σύγκριση μεταξύ πιστών.`,
  } satisfies DerivedText,
} as const;
