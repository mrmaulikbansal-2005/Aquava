// Aquava recommender: a hybrid of content-based and collaborative filtering.
//  1. Content-based: score each water-saving action by how well its tags fit
//     this home's profile (quiz answers), the season, and real AZMet weather.
//  2. Collaborative: boost actions that similar homes ("homes like yours")
//     actually tried, using quiz answers as the similarity signal.
//  3. Exclude anything the person already does or already tried.
import { buildProfile, WEATHER } from './data.js?v=7';

// The "items" the system can recommend. Gallons are rough per-day estimates
// built from EPA WaterSense figures; `fits` says when an action applies.
export const ACTIONS = [
  { id: 'leak', icon: '🔧', title: 'Fix the toilet leak', detail: 'A worn flapper is a $10 part and a 10-minute fix.',
    tags: ['indoor', 'leak'], seasons: 'all', fits: a => true, gal: () => 20 },
  { id: 'dawn', icon: '🌅', title: 'Water the yard before 8 AM', detail: 'Less water is lost to heat and wind in the early morning.',
    tags: ['outdoor', 'yard', 'heat'], seasons: ['summer', 'fall', 'spring'], fits: a => a.home > 0 && a.yard > 0, gal: g => g.yard * 0.25 },
  { id: 'weather', icon: '🌤️', title: `Water ${WEATHER.pctLess}% less this week`, detail: `Real AZMet data: plants in Phoenix need ${WEATHER.pctLess}% less water now than in June.`,
    tags: ['outdoor', 'yard', 'weather'], seasons: ['fall', 'winter'], fits: a => a.yard > 0, gal: g => g.yard * WEATHER.pctLess / 100 },
  { id: 'rainskip', icon: '🌧️', title: 'Skip watering after rain', detail: 'One good monsoon storm can cover a week of watering.',
    tags: ['outdoor', 'yard', 'weather'], seasons: ['summer'], fits: a => a.yard > 0, gal: g => g.yard * 0.3 },
  { id: 'winter', icon: '❄️', title: 'Cut yard watering to once a week', detail: 'Desert plants rest in winter and need far less.',
    tags: ['outdoor', 'yard', 'season'], seasons: ['winter'], fits: a => a.yard > 1, gal: g => g.yard * 0.5 },
  { id: 'drip', icon: '💧', title: 'Switch to drip irrigation', detail: 'Drip lines put water at the roots instead of the sidewalk.',
    tags: ['outdoor', 'yard', 'upgrade'], seasons: 'all', fits: a => a.home === 2 && a.yard >= 2, gal: g => g.yard * 0.35 },
  { id: 'shower', icon: '🚿', title: 'Shower one song shorter', detail: 'About 2 minutes. Your playlist, your timer.',
    tags: ['indoor', 'shower'], seasons: 'all', fits: a => a.shower >= 1, gal: () => 4.2 },
  { id: 'showerhead', icon: '🛁', title: 'Install a WaterSense showerhead', detail: 'Same pressure feel, about 20% less water.',
    tags: ['indoor', 'shower', 'upgrade'], seasons: 'all', fits: a => a.shower >= 2, gal: g => g.shower * 0.2 },
  { id: 'tap', icon: '🪥', title: 'Tap off while brushing', detail: 'Wet the brush, tap off, rinse at the end.',
    tags: ['indoor', 'sink'], seasons: 'all', fits: a => a.tap < 2, gal: g => g.tap },
  { id: 'dishfull', icon: '🍽️', title: 'Only run the dishwasher when full', detail: 'Same dishes, fewer loads.',
    tags: ['indoor', 'kitchen'], seasons: 'all', fits: a => a.dishes === 1, gal: () => 2 },
  { id: 'sinkfill', icon: '🫧', title: 'Wash dishes in a filled sink', detail: 'A filled sink uses a fraction of a running tap.',
    tags: ['indoor', 'kitchen'], seasons: 'all', fits: a => a.dishes === 2, gal: () => 9 },
  { id: 'laundry', icon: '👕', title: 'Run only full laundry loads', detail: 'One fewer load a week adds up fast.',
    tags: ['indoor', 'laundry'], seasons: 'all', fits: a => a.laundry >= 1, gal: g => g.laundry * 0.3 },
  { id: 'bottle', icon: '🧊', title: 'Keep a cold bottle in the fridge', detail: 'No more running the tap until it gets cold.',
    tags: ['indoor', 'sink'], seasons: ['summer', 'spring', 'fall'], fits: () => true, gal: () => 2 },
];
export const actionById = id => ACTIONS.find(x => x.id === id);

// Phoenix seasons by month (0 = January)
export function seasonOf(d = new Date()) {
  const m = d.getMonth();
  if (m === 11 || m <= 1) return 'winter';
  if (m <= 4) return 'spring';
  if (m <= 8) return 'summer';
  return 'fall';
}
const SEASON_LABEL = { winter: 'Winter', spring: 'Spring', summer: 'Summer', fall: 'Fall' };

// Answers as a numeric vector for "homes like yours"
const KEYS = ['home', 'shower', 'tap', 'dishes', 'laundry', 'yard'];
const MAX = { home: 2, shower: 3, tap: 2, dishes: 3, laundry: 2, yard: 3 };
function vec(a) { return KEYS.map(k => (a?.[k] ?? 0) / MAX[k]); }
function similarity(a, b) {
  const x = vec(a), y = vec(b);
  const d = Math.sqrt(x.reduce((s, v, i) => s + (v - y[i]) ** 2, 0) / KEYS.length);
  const sameHome = (a?.home ?? -1) === (b?.home ?? -2) ? 1 : 0.6;
  return (1 - d) * sameHome;
}

// The set of actions someone has done or committed to
export function doneSet(p) {
  const s = new Set(Object.keys(p?.tried || {}));
  Object.keys(p?.swaps || {}).forEach(k => { if (p.swaps[k]) s.add(k === 'yard' ? 'weather' : k === 'dishes' ? (p.answers?.dishes === 2 ? 'sinkfill' : 'dishfull') : k); });
  return s;
}

// Main entry: rank every action for one person
export function recommend(me, players, opts = {}) {
  const a = me?.answers || {};
  const season = opts.season || seasonOf();
  const prof = buildProfile(a);
  const g = Object.fromEntries(prof.parts.map(p => [p.key, p.gal]));
  const done = doneSet(me);

  // Collaborative: the 8 most similar homes that have tried things
  const peers = Object.entries(players || {})
    .filter(([id, p]) => id !== opts.uid && p?.quizDone && p.answers)
    .map(([id, p]) => ({ id, p, sim: similarity(a, p.answers) }))
    .filter(x => x.sim > 0.55)
    .sort((x, y) => y.sim - x.sim).slice(0, 8);

  const maxGal = Math.max(1, ...ACTIONS.map(x => x.fits(a) ? x.gal(g) : 0));
  // The leak has its own alert card in the app, so it is not ranked as a daily tip
  const list = ACTIONS.filter(x => x.id !== 'leak' && x.fits(a) && !done.has(x.id)).map(x => {
    const gal = Math.max(0.5, Math.round(x.gal(g) * 10) / 10);
    const seasonFit = x.seasons === 'all' ? 0.8 : x.seasons.includes(season) ? 1 : 0.25;
    const content = 0.55 * (gal / maxGal) + 0.45 * seasonFit;
    const triedBy = peers.filter(pr => doneSet(pr.p).has(x.id));
    const collab = peers.length ? triedBy.reduce((s, pr) => s + pr.sim, 0) / peers.reduce((s, pr) => s + pr.sim, 0) : 0;
    const score = peers.length >= 2 ? 0.65 * content + 0.35 * collab : content;

    const why = [];
    if (x.tags.includes('leak')) why.push('Your meter shows water running 1 to 5 AM');
    else if (x.tags.includes('yard')) why.push('You told us you water a yard');
    else if (x.tags.includes('shower')) why.push('Your showers run on the longer side');
    else if (x.tags.includes('kitchen')) why.push('Fits how you wash dishes');
    else if (x.tags.includes('laundry')) why.push('Fits your laundry routine');
    else if (x.tags.includes('sink')) why.push('An easy habit for any home');
    if (x.id === 'weather' && (season === 'fall' || season === 'winter')) why.push(`${SEASON_LABEL[season]} in Phoenix: plants need ${WEATHER.pctLess}% less water than June (real AZMet data)`);
    else if (x.id === 'rainskip' && season === 'summer') why.push('Monsoon season: one storm can cover a week of watering');
    else if (x.seasons !== 'all' && x.seasons.includes(season)) why.push(`Right for ${SEASON_LABEL[season].toLowerCase()} in the desert`);
    if (triedBy.length) why.push(`${triedBy.length} home${triedBy.length > 1 ? 's' : ''} like yours tried this`);

    return { ...x, gal, score: Math.round(score * 1000) / 1000, content, collab, triedBy: triedBy.length, why };
  }).sort((p, q) => q.score - p.score);

  return { list, top: list[0] || null, season, peers: peers.length };
}
