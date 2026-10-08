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
  { id: 'home', type: 'habit', q: 'Where do you live?', emoji: '🏠',
    options: ['Apartment or dorm', 'House, little or no yard', 'House with a yard'] },
  { id: 'shower', type: 'habit', q: 'How long is your usual shower?', emoji: '🚿',
    options: ['About 5 minutes', 'About 10 minutes', 'About 15 minutes', '20 minutes or more'] },
  { id: 'fact1', type: 'fact', q: 'Guess: a leaky toilet can waste up to how much water in one day?', emoji: '🚽',
    options: ['5 gallons', '50 gallons', '200 gallons'], answer: 2,
    reveal: 'Up to 200 gallons a day, says the EPA. Most leaks make no sound.' },
  { id: 'tap', type: 'habit', q: 'Do you leave the tap running while you brush your teeth?', emoji: '🪥',
    options: ['Always', 'Sometimes', 'Never'] },
  { id: 'dishes', type: 'habit', q: 'How are dishes usually washed?', emoji: '🍽️',
    options: ['Dishwasher, only when full', 'Dishwasher, half-full is fine', 'By hand, tap running', 'By hand, in a filled sink'] },
  { id: 'laundry', type: 'habit', q: 'How many laundry loads do you run a week?', emoji: '👕',
    options: ['1 load', '2 to 3 loads', '4 or more'] },
  { id: 'yard', type: 'habit', q: 'In summer, how often are your yard or plants watered?', emoji: '🌵',
    options: ['Never, no plants', 'Once or twice a week', '3 to 4 times a week', 'Every day'] },
  { id: 'fact2', type: 'fact', q: 'Guess: how much of Arizona was abnormally dry or in drought at the end of September 2026?', emoji: '🏜️',
    options: ['About 30%', 'About 60%', 'About 90%'], answer: 2,
    reveal: 'About 90% (U.S. Drought Monitor, Sept 29, 2026). Every gallon counts here.' },
];

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
  s.push({ id: 'leak', icon: '🔧', title: 'Fix the leak we found', detail: 'A flapper in the toilet tank is worn. A $10 part.', gal: LEAK_GAL, leak: true });
  if ((a.shower ?? 1) > 0) s.push({ id: 'shower', icon: '🚿', title: 'Cut 2 minutes from your shower', detail: 'Play one song. Done when it ends.', gal: 4.2 });
  if (g.tap > 0) s.push({ id: 'tap', icon: '🪥', title: 'Turn off the tap while brushing', detail: 'Wet the brush, turn it off, rinse at the end.', gal: g.tap });
  if ((a.dishes ?? 0) === 1) s.push({ id: 'dishes', icon: '🍽️', title: 'Only run the dishwasher when full', detail: 'Same dishes, half the loads.', gal: 2 });
  if ((a.dishes ?? 0) === 2) s.push({ id: 'dishes', icon: '🍽️', title: 'Wash in a filled sink, not under the tap', detail: 'Or use the dishwasher. It uses less.', gal: 9 });
  if ((a.laundry ?? 1) > 0) s.push({ id: 'laundry', icon: '👕', title: 'Wash only full laundry loads', detail: 'One fewer load a week.', gal: Math.round(g.laundry * 0.3 * 10) / 10 });
  if (g.yard > 0) s.push({ id: 'yard', icon: '🌵', title: `AI tip: water ${WEATHER.pctLess}% less this week`, detail: `Real weather: plants in Phoenix need ${WEATHER.pctLess}% less water now than in June.`, gal: Math.round(g.yard * WEATHER.pctLess / 10) / 10, ai: true });
  s.push({ id: 'bottle', icon: '🧊', title: 'Keep cold water in the fridge', detail: 'No more running the tap until it gets cold.', gal: 2 });
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
