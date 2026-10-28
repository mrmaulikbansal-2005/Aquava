// Aquava Points, badges, and partner perks.
// Points have no cash value; perks are funded by partner businesses.

export const PTS = { perScore: 0.1, perSwap: 20, perTried: 15, perPost: 5, perCheerReceived: 2 };

export function pointsOf(me, myPosts = [], cheersReceived = 0) {
  if (!me) return { earned: 0, spent: 0, balance: 0, parts: [] };
  const swaps = Object.values(me.swaps || {}).filter(Boolean).length;
  const tried = Object.keys(me.tried || {}).length;
  const parts = [
    { label: 'Aquava Score', pts: Math.round((me.score || 0) * PTS.perScore) },
    { label: 'Swaps you committed to', pts: swaps * PTS.perSwap },
    { label: 'Tips you tried', pts: tried * PTS.perTried },
    { label: 'Posts in the feed', pts: myPosts.length * PTS.perPost },
    { label: 'Cheers from neighbors', pts: cheersReceived * PTS.perCheerReceived },
  ];
  const earned = parts.reduce((s, p) => s + p.pts, 0);
  const spent = Object.values(me.redeemed || {}).reduce((s, r) => s + (r.cost || 0), 0);
  return { earned, spent, balance: Math.max(0, earned - spent), parts };
}

// Each badge: how to earn it, checked against the player's data
export const BADGES = [
  { id: 'lover', icon: '💧', name: 'Water Lover', how: 'Finish the water quiz', test: c => c.me.quizDone },
  { id: 'leak', icon: '🔧', name: 'Leak Fixer', how: 'Fix your leak', test: c => c.me.swaps?.leak },
  { id: 'iq', icon: '🧠', name: 'Water IQ Genius', how: 'Get all 4 water facts right', test: c => (c.me.correct || 0) >= 4 },
  { id: 'guardian', icon: '🌵', name: 'Desert Guardian', how: 'Take 3 water-saving actions', test: c => c.actions >= 3 },
  { id: 'hero', icon: '🤝', name: 'Neighbor Hero', how: 'Cheer 3 neighbors or get 3 cheers', test: c => c.cheersGiven >= 3 || c.cheersReceived >= 3 },
  { id: 'top', icon: '🏆', name: 'Top Saver', how: 'Reach the top 10 in your area', test: c => c.areaRank && c.areaRank <= 10 },
  { id: 'savior', icon: '🦸', name: 'The Savior', how: 'Become captain of a group', test: c => c.isCaptain },
];

export function badgesOf(ctx) {
  return BADGES.map(b => ({ ...b, earned: !!b.test(ctx) }));
}

// Sample perks until real partners sign on. Clearly labeled in the app.
export const PERKS = [
  { id: 'coffee', icon: '☕', partner: 'Sample Café', title: '10% off any cold drink', cost: 80, cat: 'food' },
  { id: 'plant', icon: '🪴', partner: 'Sample Plant Nursery', title: 'Free succulent with any purchase', badge: 'guardian', cat: 'garden' },
  { id: 'bike', icon: '🚲', partner: 'Sample Bike Shop', title: '10% off a tune-up', cost: 150, cat: 'outdoor' },
  { id: 'bottle', icon: '🧴', partner: 'Sample Outdoor Store', title: 'Free reusable water bottle', badge: 'top', cat: 'outdoor' },
  { id: 'smoothie', icon: '🥤', partner: 'Sample Juice Bar', title: '10% off for Water Lovers', badge: 'lover', cat: 'food' },
  { id: 'nozzle', icon: '🚿', partner: 'Sample Hardware Store', title: '15% off a WaterSense showerhead', cost: 120, cat: 'home' },
];

// Recommend perks: unlocked first, then the ones closest to unlocking,
// with a nudge toward perks that match what the person already does.
export function recommendPerks(me, badges, balance) {
  const has = new Set(badges.filter(b => b.earned).map(b => b.id));
  const garden = (me?.answers?.yard || 0) > 0;
  return PERKS.map(p => {
    const unlocked = p.badge ? has.has(p.badge) : balance >= p.cost;
    const need = p.badge ? null : Math.max(0, p.cost - balance);
    let score = unlocked ? 100 : p.badge ? 20 : 60 - Math.min(59, need / 5);
    if (garden && p.cat === 'garden') score += 15;
    if ((me?.answers?.shower || 0) >= 2 && p.cat === 'home') score += 15;
    const redeemed = !!me?.redeemed?.[p.id];
    return { ...p, unlocked, need, redeemed, score: redeemed ? -1 : score };
  }).sort((a, b) => b.score - a.score);
}

// A short code that changes every minute, so a screenshot cannot be reused
export function rotatingCode(uid, perkId, t = Date.now()) {
  const slot = Math.floor(t / 60000);
  let h = 2166136261;
  for (const ch of `${uid}|${perkId}|${slot}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const c = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = ''; let x = h >>> 0;
  for (let i = 0; i < 6; i++) { out += c[x % c.length]; x = Math.floor(x / c.length) + (i + 1) * 7919; }
  return { code: out, secondsLeft: 60 - Math.floor((t % 60000) / 1000) };
}

// ZIP proximity for the local feed: same ZIP > same area (first 3 digits) > Arizona > world
export function zipTier(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 3;
  if (a.slice(0, 3) === b.slice(0, 3)) return 2;
  const az = z => /^8[56]/.test(z);
  if (az(a) && az(b)) return 1;
  return 0;
}
export const TIER_LABEL = ['🌍 Elsewhere', '🌵 Arizona', '📍 Your area', '🏠 Your ZIP'];
