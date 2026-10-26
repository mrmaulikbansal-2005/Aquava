// Content and the water math. Every number here is a rough, labeled estimate
// built from public figures (EPA WaterSense, ENERGY STAR, AZMet).

// Real AZMet data, Phoenix Encanto station (downloaded Oct 6, 2026)
export const WEATHER = {
  station: 'Phoenix Encanto (AZMet)',
  weekLabel: 'Sep 29 to Oct 5, 2026',
  etoWeek: 0.19,   // inches of water plants lose per day, 7-day average
  etoJune: 0.30,   // June 2026 daily average
  pctLess: 36,     // (0.30 - 0.19) / 0.30, rounded
  maxF: 95.9,
};

// type 'habit' builds your profile; type 'fact' is a guess with a right answer
export const QUESTIONS = [
  { id: 'home', type: 'habit', q: "First up: what's your home base?", emoji: '🏡',
    options: ['🏢 Apartment or dorm', '🏠 House, tiny or no yard', '🌳 House with a yard'] },
  { id: 'fact1', type: 'fact', q: 'How much water does a typical American family use at home every day?', emoji: '🏠',
    options: ['About 30 gallons', 'About 100 gallons', '300+ gallons'], answer: 2,
    reveal: 'Over 300 gallons a day (EPA). Most of us only see it once a month, on a bill.' },
  { id: 'shower', type: 'habit', q: 'Pick your shower vibe', emoji: '🚿',
    options: ['⚡ In and out (about 5 min)', '🎵 A couple of songs (about 10)', '🎶 Half an album (about 15)', '🎤 Full concert (20+ min)'] },
  { id: 'fact2', type: 'fact', q: 'A sneaky toilet leak can waste up to how much water a day?', emoji: '🚽',
    options: ['5 gallons', '50 gallons', '200 gallons'], answer: 2,
    reveal: 'Up to 200 gallons a day (EPA). And most leaks make zero noise.' },
  { id: 'tap', type: 'habit', q: 'Brushing teeth: tap on or tap off?', emoji: '🪥',
    options: ['💦 On the whole time', '🤷 Depends on the day', '🚫 Off while I brush'] },
  { id: 'dishes', type: 'habit', q: 'Dish duty! How do they usually get clean?', emoji: '🍽️',
    options: ['🧼 Dishwasher, packed full', '🍽️ Dishwasher, whenever', '💧 By hand, under the tap', '🫧 By hand, in a filled sink'] },
  { id: 'fact3', type: 'fact', q: 'In September 2026, Lake Mead hit its lowest level since when?', emoji: '🏞️',
    options: ['The 1990s', 'The 1960s', 'The 1930s'], answer: 2,
    reveal: 'The 1930s: 1,037.8 feet (U.S. Bureau of Reclamation). Lake Mead supplies water to millions in Arizona.' },
  { id: 'yard', type: 'habit', q: 'Summer plant care: how often does stuff get watered?', emoji: '🌵',
    options: ['🌵 Never (cactus life, or no plants)', '🪴 Once or twice a week', '🌿 3 or 4 times a week', '🌳 Every day'] },
  { id: 'fact4', type: 'fact', q: 'How much of Arizona was dry or in drought at the end of September 2026?', emoji: '🏜️',
    options: ['About 30%', 'About 60%', 'About 90%'], answer: 2,
    reveal: 'About 90% (U.S. Drought Monitor, Sept 29, 2026). Every drop saved here counts.' },
];

// Event score out of 1,000: finishing bonus + Water IQ (facts + speed) + water-wise habits.
export const FACT_PTS = 125, SPEED_PTS = 25, HABIT_PTS = 300, FINISH_PTS = 100;
export function scoreOf(answers, times = {}) {
  const facts = QUESTIONS.filter(q => q.type === 'fact');
  let correct = 0, speed = 0;
  facts.forEach(q => {
    if (answers[q.id] === q.answer) {
      correct++;
      const t = times[q.id] ?? 15000;
      speed += Math.round(SPEED_PTS * Math.max(0, Math.min(1, (15000 - t) / 12000)));
    }
  });
  const habits = buildProfile(answers).habits;
  const habit = Math.round(HABIT_PTS * Math.max(0, Math.min(1, (150 - habits) / 105)));
  const iq = correct * FACT_PTS + speed;
  return { correct, facts: facts.length, speed, iq, habit, finish: FINISH_PTS, total: FINISH_PTS + iq + habit, habits };
}

// A fun "water personality" from your answers. No judging, just vibes.
export function personality(profile) {
  const g = Object.fromEntries(profile.parts.map(p => [p.key, p.gal]));
  if (profile.habits < 60) return { em: '🦎', name: 'The Desert Lifeguard', line: 'You already go easy on water. Now help your friends catch up!' };
  const top = ['yard', 'shower', 'dishes', 'laundry'].sort((x, y) => g[y] - g[x])[0];
  if (top === 'yard') return { em: '🌵', name: 'The Desert Gardener', line: 'Your plants are living their best life. Outdoors is where your biggest wins hide.' };
  if (top === 'shower') return { em: '🎤', name: 'The Shower Singer', line: 'Your shower is your stage. One song shorter is an easy win.' };
  if (top === 'dishes') return { em: '🫧', name: 'The Dish Hero', line: 'You keep the kitchen sparkling. A filled sink beats a running tap.' };
  return { em: '🎨', name: 'The Splash Artist', line: 'A little bit of everything. Small swaps add up fast for you.' };
}

// gallons per person per day, by answer index
const G = {
  shower: [10.5, 21, 31.5, 42],       // 2.1 gal/min (EPA average showerhead)
  tap: [8, 4, 0],                     // EPA: turning off the tap saves up to 8 gal a day
  dishes: [2, 4, 15, 6],              // ENERGY STAR: hand washing can use up to 27 gal a load
  laundry: [3, 7, 14],                // about 20 gal a load
  yard: [0, 20, 45, 90],              // outdoor watering is the biggest use in Arizona
};
const TOILET_AND_OTHER = 14;          // flushing (about 5 x 1.6 gal) plus cooking and drinking
export const LEAK_GAL = 20;           // the simulated leak your meter "finds"

export function buildProfile(a) {
  const yardIdx = a.home === 0 ? Math.min(a.yard ?? 0, 1) : (a.yard ?? 0); // apartments: balcony plants at most
  const parts = [
    { key: 'shower', label: 'Showers', gal: G.shower[a.shower ?? 1] },
    { key: 'tap', label: 'Sink and brushing', gal: G.tap[a.tap ?? 1] },
    { key: 'dishes', label: 'Dishes', gal: G.dishes[a.dishes ?? 0] },
    { key: 'laundry', label: 'Laundry', gal: G.laundry[a.laundry ?? 1] },
    { key: 'yard', label: 'Yard and plants', gal: a.home === 0 ? Math.min(G.yard[yardIdx], 8) : G.yard[yardIdx] },
    { key: 'toilet', label: 'Toilet, cooking, drinking', gal: TOILET_AND_OTHER },
  ];
  const habits = parts.reduce((s, p) => s + p.gal, 0);
  return { parts, habits: Math.round(habits), baseline: Math.round(habits + LEAK_GAL) };
}

// Swaps you can commit to. Each returns gallons saved per day for this profile.
export function buildSwaps(a, profile) {
  const g = Object.fromEntries(profile.parts.map(p => [p.key, p.gal]));
  const s = [];
  s.push({ id: 'leak', icon: '🔧', title: 'Fix the sneaky leak', detail: 'A worn flapper in the toilet tank. A $10 part.', gal: LEAK_GAL, leak: true });
  if ((a.shower ?? 1) > 0) s.push({ id: 'shower', icon: '🚿', title: 'Shower one song shorter', detail: 'About 2 minutes. Your playlist, your timer. 🎵', gal: 4.2 });
  if (g.tap > 0) s.push({ id: 'tap', icon: '🪥', title: 'Tap off while brushing', detail: 'Wet the brush, tap off, rinse at the end.', gal: g.tap });
  if ((a.dishes ?? 0) === 1) s.push({ id: 'dishes', icon: '🍽️', title: 'Only run the dishwasher when full', detail: 'Same dishes, half the loads.', gal: 2 });
  if ((a.dishes ?? 0) === 2) s.push({ id: 'dishes', icon: '🍽️', title: 'Wash in a filled sink, not under the tap', detail: 'Or use the dishwasher. It uses less.', gal: 9 });
  if ((a.laundry ?? 1) > 0) s.push({ id: 'laundry', icon: '👕', title: 'Wash only full laundry loads', detail: 'One fewer load a week.', gal: Math.round(g.laundry * 0.3 * 10) / 10 });
  if (g.yard > 0) s.push({ id: 'yard', icon: '🌵', title: `AI tip: water ${WEATHER.pctLess}% less this week`, detail: `Real weather: plants in Phoenix need ${WEATHER.pctLess}% less water now than in June.`, gal: Math.round(g.yard * WEATHER.pctLess / 10) / 10, ai: true });
  s.push({ id: 'bottle', icon: '🧊', title: 'Keep a cold bottle in the fridge', detail: 'No more waiting for the tap to run cold. 🧊', gal: 2 });
  return s;
}

export function progressOf(baseline, saved) {
  if (!baseline) return 0;
  return Math.round((saved / baseline) * 1000) / 10;
}

const A = ['Desert', 'Cactus', 'Monsoon', 'Saguaro', 'Mesa', 'Canyon', 'Sun', 'Agave', 'Dune', 'Coyote', 'Rain', 'Oasis', 'Sonoran', 'Copper', 'Javelina'];
const B = ['Drop', 'Saver', 'Crew', 'Ripple', 'Splash', 'Hero', 'Ace', 'Wave', 'Stream', 'Mist', 'Fox', 'Spark'];
export const EMOJIS = ['💧', '🌵', '🦎', '🐢', '🌞', '🦂', '🐍', '🌼', '🦉', '🐇', '🌊', '🍉'];
export function randomName() {
  const r = a => a[Math.floor(Math.random() * a.length)];
  return r(A) + r(B) + Math.floor(Math.random() * 90 + 10);
}
export function randomEmoji() { return EMOJIS[Math.floor(Math.random() * EMOJIS.length)]; }

export function makeCode() {
  const c = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => c[Math.floor(Math.random() * c.length)]).join('');
}

// Captain = top progress member; ties go to whoever joined the group first
export function captainOf(members) {
  return [...members].sort((x, y) => (y.progress - x.progress) || ((x.joinedAt || 0) - (y.joinedAt || 0)))[0];
}
export function groupScore(members) {
  if (!members.length) return 0;
  return Math.round(members.reduce((s, m) => s + (m.progress || 0), 0) / members.length * 10) / 10;
}
