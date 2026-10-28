import { initStore, root, SESSION } from './store.js?v=7';
const EVENTS = { partnerday: 'W. P. Carey Partner Day' };
const EVENT_SHORT = { partnerday: 'Partner Day' }[SESSION] || '';
const EVENT = EVENTS[SESSION] || '';
import * as D from './data.js?v=7';
import * as R from './reco.js?v=7';
import * as W from './rewards.js?v=7';

const $app = document.getElementById('app');
const $tabs = document.getElementById('tabs');
const $toast = document.getElementById('toast');
const params = new URLSearchParams(location.search);

const S = {
  store: null, uid: null, me: null, players: {}, groups: {},
  screen: 'loading', qi: 0, answers: {}, revealed: false,
  tab: 'home', seg: 'score', draftName: D.randomName(), draftEmoji: D.randomEmoji(),
  inviteCode: (params.get('g') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4),
  showQR: false, qStart: 0, times: {}, groupName: '', joinCode: '', err: '', loaded: false,
  prevCaptain: undefined, prevRank: undefined, pendingRender: false,
  posts: {}, feedScope: 'near', draftZip: '', draftContact: '', consent: false, openPerk: null, nameIdeas: [D.randomName(), D.randomName(), D.randomName()],
};

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => (Math.round(n * 10) / 10).toLocaleString('en-US');

function toast(msg) {
  $toast.textContent = msg; $toast.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => $toast.classList.remove('show'), 2600);
}

const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14.5" fill="none" stroke="#0BA5C7" stroke-width="2" opacity=".35"/><path d="M16 6.5s-6.5 7.6-6.5 12a6.5 6.5 0 0 0 13 0c0-4.4-6.5-12-6.5-12z" fill="#0BA5C7"/></svg>`;
const RIPPLE = `<svg class="ripple" viewBox="0 0 200 200" aria-hidden="true">
  <circle cx="100" cy="100" r="34" fill="none" stroke="#0BA5C7" stroke-width="3" opacity=".9"/>
  <circle cx="100" cy="100" r="56" fill="none" stroke="#0BA5C7" stroke-width="2.5" opacity=".6"/>
  <circle cx="100" cy="100" r="78" fill="none" stroke="#0BA5C7" stroke-width="2" opacity=".35"/>
  <circle cx="100" cy="100" r="98" fill="none" stroke="#0BA5C7" stroke-width="1.5" opacity=".18"/>
  <path d="M100 74s-17 20-17 31a17 17 0 0 0 34 0c0-11-17-31-17-31z" fill="#0BA5C7"/>
  <circle cx="100" cy="44" r="6" fill="#E39B21"/><circle cx="51" cy="128" r="6" fill="#E39B21"/><circle cx="149" cy="128" r="6" fill="#E39B21"/>
  <circle cx="22" cy="100" r="4.5" fill="#E39B21" opacity=".7"/><circle cx="178" cy="100" r="4.5" fill="#E39B21" opacity=".7"/></svg>`;
const ICON = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z"/></svg>',
  board: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 6h3v2a3 3 0 0 1-3 3M7 6H4v2a3 3 0 0 0 3 3"/></svg>',
  group: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2a5 5 0 0 1 6 4.8"/></svg>',
  feed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>',
  me: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
};

function topbar() {
  const live = S.store.mode === 'live';
  return `<div class="topbar"><div class="logo">${LOGO}Aquava</div><div class="spacer"></div>${EVENT_SHORT ? `<span class="pill blue" style="margin-right:8px">${esc(EVENT_SHORT)}</span>` : ''}
    <span class="live ${live ? '' : 'local'}"><i></i>${live ? 'LIVE' : 'DEMO MODE'}</span></div>`;
}

/* ---------- derived data ---------- */
const finished = () => Object.entries(S.players).filter(([, p]) => p && p.quizDone).map(([id, p]) => ({ id, ...p }));
function ranked() { return finished().sort((a, b) => (b.progress - a.progress) || ((a.joinedAt || 0) - (b.joinedAt || 0))); }
function myRank() { const r = ranked(); const i = r.findIndex(p => p.id === S.uid); return i < 0 ? null : i + 1; }
function membersOf(g) {
  if (!g || !g.members) return [];
  return Object.entries(g.members).map(([id, joinedAt]) => {
    const p = S.players[id]; return p ? { id, joinedAt, name: p.name, emoji: p.emoji, progress: p.quizDone ? (p.progress || 0) : 0 } : null;
  }).filter(Boolean);
}
const myGroup = () => (S.me && S.me.groupId && S.groups[S.me.groupId]) ? S.groups[S.me.groupId] : null;
const postList = () => Object.entries(S.posts || {}).map(([id, p]) => ({ id, ...p })).filter(p => p && p.uid && p.ts);
function myStats() {
  const me = S.me || {}; const posts = postList();
  const mine = posts.filter(p => p.uid === S.uid);
  const cheersReceived = mine.reduce((t, p) => t + Object.keys(p.cheers || {}).filter(u => u !== S.uid).length, 0);
  const cheersGiven = posts.filter(p => p.uid !== S.uid && p.cheers?.[S.uid]).length;
  const actions = Object.keys(me.swaps || {}).filter(k => me.swaps[k] && k !== 'leak').length + Object.keys(me.tried || {}).length;
  const area = (me.zip || '').slice(0, 3);
  const areaRanked = scored().filter(p => area && (p.zip || '').slice(0, 3) === area);
  const ai = areaRanked.findIndex(p => p.id === S.uid);
  const g = myGroup(); const isCaptain = !!(g && D.captainOf(membersOf(g))?.id === S.uid && membersOf(g).length > 1);
  const pts = W.pointsOf(me, mine, cheersReceived);
  const badges = W.badgesOf({ me, actions, cheersGiven, cheersReceived, areaRank: ai < 0 ? null : ai + 1, isCaptain });
  return { pts, badges, mine, cheersReceived, cheersGiven, actions, areaRank: ai < 0 ? null : ai + 1, areaSize: areaRanked.length };
}
async function addPost(kind, text, extra = {}) {
  if (!S.me?.name) return;
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const post = { uid: S.uid, name: S.me.name, emoji: S.me.emoji || '💧', zip: S.me.zip || '', kind, text, ts: Date.now(), ...extra };
  S.posts = { ...S.posts, [id]: post };
  try { await S.store.set(root('posts/' + id), post); } catch (e) { console.warn('post failed', e); }
}

/* ---------- writes ---------- */
const mePath = () => root('players/' + S.uid);
async function saveMe(patch) {
  S.me = { ...(S.me || {}), ...patch, updatedAt: Date.now() };
  await S.store.update(mePath(), { ...patch, updatedAt: Date.now() });
}

/* ---------- screens ---------- */
function vWelcome() {
  const ideas = S.nameIdeas.map(n => `<button class="chipbtn" data-act="pickname" data-n="${esc(n)}">${esc(n)}</button>`).join('');
  return `${topbar()}
  <section class="hero fade" style="padding-top:14px">
    <span class="eyebrow">Strava for water</span>
    <h1 style="font-size:38px">Saving water, but make it a game.</h1>
    <p>Take the 60-second quiz, get your Aquava Score, and join your neighbors on the live board. 💧</p>
  </section>
  <div class="stack" style="margin-top:14px">
    <div class="card stack" style="gap:12px">
      <label class="lab" for="nm">1 · Your username</label>
      <div class="namebox">
        <button class="emoji-btn" data-act="emoji" aria-label="Change icon">${S.draftEmoji}</button>
        <input id="nm" maxlength="18" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type your own" value="${esc(S.draftName)}">
      </div>
      <div class="chips-row"><span class="small muted">Or pick one:</span>${ideas}<button class="chipbtn ghost" data-act="shuffle" aria-label="More names">↻</button></div>
      <label class="lab" for="zip">2 · Your ZIP code <span class="muted" style="font-weight:500">(shows neighbors near you)</span></label>
      <input id="zip" class="textin" inputmode="numeric" maxlength="5" placeholder="85281" value="${esc(S.draftZip)}" autocomplete="postal-code">
      <label class="lab" for="ct">3 · Email or phone <span class="muted" style="font-weight:500">(optional)</span></label>
      <input id="ct" class="textin" maxlength="60" placeholder="you@email.com or 480 555 0123" value="${esc(S.draftContact)}" autocomplete="email">
      ${S.draftContact.trim() ? `<label class="consent"><input type="checkbox" id="cs" ${S.consent ? 'checked' : ''}> <span>Aquava can contact me about the app. Only the Aquava team sees this, never other players.</span></label>` : '<p class="small muted" style="margin-top:-4px">Get early access and updates. Never shown to other players.</p>'}
    </div>
    ${S.err ? `<div class="small" style="color:var(--terra);font-weight:700">${esc(S.err)}</div>` : ''}
    <button class="btn" data-act="start">Let's go 💧</button>
    ${S.inviteCode ? `<div class="pill blue" style="align-self:center">You'll join group ${esc(S.inviteCode)} after the quiz</div>` : ''}
  </div>
  <p class="foot">Aquava · Every drop. Every neighbor. One goal.<br>Built in Tempe, Arizona</p>`;
}

function roomPct(qid) {
  const counts = {}; let n = 0;
  finished().forEach(p => { const a = p.answers?.[qid]; if (a !== undefined) { counts[a] = (counts[a] || 0) + 1; n++; } });
  return { counts, n };
}

function vQuiz() {
  const Q = D.QUESTIONS[S.qi]; const total = D.QUESTIONS.length;
  if (Q.type === 'fact' && S.answers[Q.id] === undefined && S.qStartFor !== Q.id) { S.qStart = Date.now(); S.qStartFor = Q.id; }
  const sel = S.answers[Q.id];
  const isFact = Q.type === 'fact'; const rev = isFact && S.revealed;
  const room = rev ? roomPct(Q.id) : null;
  const opts = Q.options.map((o, i) => {
    let cls = '';
    if (rev) cls = i === Q.answer ? 'right' : (i === sel ? 'wrong' : '');
    else if (sel === i) cls = 'sel';
    const pct = room && room.n ? `<span class="pct">${Math.round(((room.counts[i] || 0) / room.n) * 100)}% of players</span>` : '';
    return `<button class="opt ${cls}" data-act="answer" data-i="${i}" ${rev ? 'disabled' : ''}><span class="k">${'ABCD'[i]}</span>${esc(o)}${pct}</button>`;
  }).join('');
  return `<div class="qtop">
      <button data-act="qback" aria-label="Back" style="font-size:22px;width:36px;height:36px;border-radius:10px;background:var(--card);border:1px solid var(--line)">‹</button>
      <div class="qbar"><i style="width:${((S.qi + (sel !== undefined ? 1 : 0)) / total) * 100}%"></i></div>
      <span class="qcount">${S.qi + 1}/${total}</span></div>
    <div class="fade" key="${Q.id}">
      ${isFact ? '<span class="pill terra factbadge">🎯 QUICK GUESS</span>' : (S.qi === 0 ? '<span class="pill blue factbadge">No wrong answers. Just for fun!</span>' : '')}
      <div class="qemoji">${Q.emoji}</div>
      <h2 class="qtext">${esc(Q.q)}</h2>
      <div class="opts">${opts}</div>
      ${rev ? `<div class="card ${sel === Q.answer ? 'blue' : 'terra'} reveal">
          <b>${sel === Q.answer ? 'Nailed it! 🎉' : 'Ooh, close! Here\'s the real answer 👇'}</b>
          <p class="small" style="margin-top:6px;line-height:1.45">${esc(Q.reveal)}</p></div>
        <button class="btn" data-act="next" style="margin-top:14px">${S.qi === total - 1 ? 'See my Aquava Score ✨' : 'Next'}</button>` : ''}
    </div>`;
}

const scored = () => finished().filter(p => typeof p.score === 'number').sort((a, b) => (b.score - a.score) || ((a.finishedAt || 0) - (b.finishedAt || 0)));
function scoreRank() { const r = scored(); const i = r.findIndex(p => p.id === S.uid); return { rank: i < 0 ? null : i + 1, n: r.length }; }
function vResult() {
  const sc = S.lastScore || D.scoreOf(S.me.answers || {}, S.me.times || {});
  const { rank, n } = scoreRank();
  const pct = Math.round(sc.total / 10);
  return `${topbar()}
  <div class="stack fade">
    <span class="eyebrow">Your Aquava Score</span>
    <div class="card dark scorecard pop">
      <div class="sc-n">${sc.total}<span>/1000</span></div>
      <div class="sc-bar"><i style="width:${pct}%"></i></div>
      <div class="sc-rank">${rank ? `#${rank} of ${n}` : ''} <span>${EVENT ? 'at ' + esc(EVENT) : 'on the live board'}</span></div>
    </div>
    <div class="card stack" style="gap:16px">
      <div class="sc-row"><span>✅ Finished the quiz</span><b>+${sc.finish} pts</b></div>
      <div class="sc-row"><span>🧠 Water IQ</span><b>${sc.correct}/${sc.facts} right · ${sc.correct * D.FACT_PTS} pts</b></div>
      <div class="sc-row"><span>⚡ Speed bonus</span><b>+${sc.speed} pts</b></div>
      <div class="sc-row"><span>💧 Water-wise habits</span><b>+${sc.habit} pts</b></div>
    </div>
    <div class="card blue alert"><div class="ic">📺</div><div><h3>You're on the live board!</h3><p class="small" style="line-height:1.45">Look up at the screen to find <b>${esc(S.me.emoji)} ${esc(S.me.name)}</b>. Want a higher score? Fix your leak and pick easy wins in the app.</p></div></div>
    <button class="btn" data-act="toprofile">See my water personality ✨</button>
    <button class="btn ghost" data-act="tab" data-tab="board" style="margin-top:-4px">See the full ranking 🏆</button>
  </div>`;
}

function vProfile() {
  const p = D.buildProfile(S.me.answers || {});
  const t = D.personality(p);
  const max = Math.max(...p.parts.map(x => x.gal), D.LEAK_GAL);
  const bars = p.parts.filter(x => x.gal > 0).sort((a, b) => b.gal - a.gal).map(x =>
    `<div class="bar"><span>${esc(x.label)}</span><b>${fmt(x.gal)} gal</b><div class="track"><i style="width:${(x.gal / max) * 100}%"></i></div></div>`).join('');
  return `${topbar()}
  <div class="stack fade">
    <span class="eyebrow">Your water personality</span>
    <div class="card dark ptype pop"><div class="em">${t.em}</div><div><h2>${esc(t.name)}</h2><p>${esc(t.line)}</p></div></div>
    <div class="card stack">
      <div class="row"><div><div class="big" style="font-size:56px">${p.habits}</div><div style="font-weight:700">gallons a day, your estimate</div></div></div>
      <p class="small muted" style="line-height:1.45">The average American uses about 82 gallons a day at home (EPA). ${p.habits > 82 ? 'More water also means more room to climb the leaderboard. 🏆' : 'You are already efficient, so every swap is a bonus. ✨'}</p>
      <div class="bars">${bars}</div>
    </div>
    <div class="card terra alert pop">
      <div class="ic">👀</div>
      <div><h3>Plot twist!</h3>
      <p class="small" style="line-height:1.45">Your meter heard water running from 1 AM to 5 AM. Probably a sneaky toilet leak, about <b>${D.LEAK_GAL} gallons a day</b>. Good news: it's a $10 fix.</p></div>
    </div>
    <button class="btn" data-act="toapp">Let's start the challenge 🚀</button>
    <p class="foot">Your home is simulated from your answers. Estimates use EPA WaterSense and ENERGY STAR figures.</p>
  </div>`;
}

function ring(pct) {
  const r = 52, c = 2 * Math.PI * r, v = Math.min(pct, 50) / 50; // ring fills at 50%
  return `<div class="ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="${r}" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="11"/>
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="#FFFFFF" stroke-width="11" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - v)}" style="transition:stroke-dashoffset .6s"/></svg>
    <div class="val"><div><b>${fmt(pct)}%</b><span>BETTER</span></div></div></div>`;
}

function vHome() {
  const me = S.me; const prof = D.buildProfile(me.answers || {});
  const swaps = D.buildSwaps(me.answers || {}, prof);
  const on = me.swaps || {};
  const rank = myRank(); const n = finished().length;
  const leak = swaps.find(s => s.leak);
  const rest = swaps.filter(s => !s.leak);
  const sw = s => `<button class="swap ${on[s.id] ? 'on' : ''} ${s.ai ? 'ai' : ''}" data-act="swap" data-id="${s.id}">
      <span class="ic">${s.icon}</span><span><div class="t">${esc(s.title)}</div><div class="d">${esc(s.detail)}</div></span>
      <span class="g">−${fmt(s.gal)}<br><span class="small" style="font-weight:500">gal/day</span></span><span class="chk">${on[s.id] ? '✓' : ''}</span></button>`;
  return `${topbar()}
  <div class="stack fade">
    <div class="row"><div style="flex:1"><span class="eyebrow">Hi, ${esc(me.emoji)} ${esc(me.name)}</span><div class="small muted" style="margin-top:4px;font-weight:700">${(() => { const t = D.personality(prof); return t.em + ' ' + esc(t.name); })()}</div></div>
      <button class="ptspill" data-act="tab" data-tab="me">⭐ ${myStats().pts.balance} pts</button></div>
    ${vTip()}
    <div class="card dark ringwrap">
      ${ring(me.progress || 0)}
      <div class="stack" style="gap:10px">
        <div class="stat"><b>${fmt(me.saved || 0)} gal</b><span>saved a day, out of ${prof.baseline}</span></div>
        <div class="stat"><b>${rank ? '#' + rank : '–'}<span style="font-size:15px;color:var(--soft)"> of ${n}</span></b><span>${EVENT ? 'today' : 'on the board'}</span></div>
      </div>
    </div>
    ${!on.leak ? `<div class="card terra alert">
        <div class="ic">🚨</div>
        <div style="flex:1"><h3>Sneaky leak spotted 👀</h3>
          <p class="small" style="line-height:1.45;margin-bottom:10px">Water ran 1 AM to 5 AM while you slept. A $10 toilet flapper fixes it and wins you <b>${D.LEAK_GAL} gal a day</b>.</p>
          <button class="btn terra sm" data-act="swap" data-id="leak">Fix it 🔧</button></div></div>`
      : `<div class="card blue alert"><div class="ic">✅</div><div><h3>Leak fixed!</h3><p class="small">Quiet nights again. +${D.LEAK_GAL} gal a day saved. 🎉</p></div></div>`}
    <div class="row"><h3 style="font-size:22px">Pick your easy wins</h3><div class="spacer"></div><span class="small muted">${Object.keys(on).filter(k => on[k] && k !== 'leak').length}/${rest.length} on</span></div>
    <div class="stack" style="gap:10px">${rest.map(sw).join('')}</div>
    <button class="btn ghost" data-act="tab" data-tab="board">See the leaderboard 🏆</button>
    <button class="small" data-act="retake" style="color:var(--blue);font-weight:700;padding:6px">Retake the quiz</button>
    <p class="foot">Your home is simulated from your quiz answers. The weather is real AZMet data. Estimates use EPA WaterSense and ENERGY STAR figures.</p>
  </div>`;
}

function vTip() {
  const rec = R.recommend(S.me, S.players, { uid: S.uid });
  const t = rec.top;
  if (!t) return `<div class="card tipcard"><div class="pill green">TODAY'S TIP</div><h3 style="margin-top:8px">You're doing every tip we know! 🎉</h3><p class="small muted">Cheer your neighbors in the feed while we learn more.</p></div>`;
  const more = rec.list.slice(1, 3);
  return `<div class="card tipcard pop">
    <div class="row"><span class="pill green">💡 TODAY'S TIP FOR YOU</span><div class="spacer"></div><span class="small muted">${Object.keys(S.me.tried || {}).length} tried</span></div>
    <div class="row" style="margin-top:12px;align-items:flex-start"><div class="tipic">${t.icon}</div><div style="flex:1"><h3 class="tiptitle">${esc(t.title)}</h3><p class="small" style="line-height:1.45;margin-top:4px">${esc(t.detail)}</p></div></div>
    <div class="tipgal">Saves about <b>${fmt(t.gal)} gal a day</b> · +${W.PTS.perTried} pts</div>
    <ul class="why">${t.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul>
    <button class="btn green sm" data-act="try" data-id="${t.id}" style="width:100%;margin-top:4px">I'll try this ✓</button>
    ${more.length ? `<div class="moretips">${more.map(m => `<button class="mtip" data-act="try" data-id="${m.id}"><span>${m.icon}</span><span style="flex:1;text-align:left">${esc(m.title)}</span><b>+${W.PTS.perTried}</b></button>`).join('')}</div>` : ''}
    <p class="tiny muted" style="margin-top:10px">Picked for you by matching your home and the season${rec.peers >= 2 ? ', plus what similar homes tried' : ''}.</p>
  </div>`;
}

function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'now'; if (m < 60) return m + 'm'; const h = Math.round(m / 60); if (h < 24) return h + 'h'; return Math.round(h / 24) + 'd';
}
const PRESETS = [
  { k: 'shower', t: '🚿 Took a shorter shower today' }, { k: 'dawn', t: '🌅 Watered at dawn this morning' },
  { k: 'thanks', t: '🙌 Thanks for the tips, neighbors!' }, { k: 'leak', t: '🔧 Checked my home for leaks' },
  { k: 'cheer', t: '💧 Every drop counts. Let\'s go, Tempe!' },
];
function vFeed() {
  const myZip = S.me?.zip || '';
  let posts = postList();
  if (S.feedScope === 'near' && myZip) {
    posts = posts.map(p => ({ ...p, tier: W.zipTier(myZip, p.zip) })).filter(p => p.tier >= 1 || p.uid === S.uid)
      .sort((a, b) => (b.tier - a.tier) || (b.ts - a.ts));
  } else posts = posts.map(p => ({ ...p, tier: W.zipTier(myZip, p.zip) })).sort((a, b) => b.ts - a.ts);
  posts = posts.slice(0, 60);
  const done = R.doneSet(S.me);
  const card = p => {
    const cheers = Object.keys(p.cheers || {}).length; const mine = p.uid === S.uid; const cheered = !!p.cheers?.[S.uid];
    const act = p.actionId ? R.actionById(p.actionId) : null;
    return `<div class="post">
      <div class="row" style="gap:10px"><span class="av">${esc(p.emoji)}</span><div style="flex:1;min-width:0"><div class="nm">${esc(p.name)}${mine ? ' <span class="muted">(you)</span>' : ''}</div>
        <div class="sub">${W.TIER_LABEL[p.tier] || ''} · ${ago(p.ts)}</div></div></div>
      <p class="ptext">${esc(p.text)}</p>
      ${act && !mine ? `<div class="pact">${act.icon} <b>${esc(act.title)}</b>${done.has(act.id) ? '<span class="pill green" style="margin-left:auto">You do this</span>' : `<button class="btn sm green" data-act="try" data-id="${act.id}" style="margin-left:auto">Try it too +${W.PTS.perTried}</button>`}</div>` : ''}
      <div class="row" style="margin-top:8px"><button class="cheer ${cheered ? 'on' : ''}" data-act="cheer" data-id="${p.id}" ${mine ? 'disabled' : ''}>👏 ${cheers || ''} ${cheered ? 'Cheered' : 'Cheer'}</button></div>
    </div>`;
  };
  return `${topbar()}
  <div class="stack fade">
    <span class="eyebrow">Community feed</span>
    <h2 style="font-size:30px;line-height:1.1">${S.feedScope === 'near' ? 'Neighbors near ' + esc(myZip || 'you') : 'Savers around the world'}</h2>
    <div class="seg"><button class="${S.feedScope === 'near' ? 'on' : ''}" data-act="scope" data-v="near">📍 Near me</button><button class="${S.feedScope === 'world' ? 'on' : ''}" data-act="scope" data-v="world">🌍 Everyone</button></div>
    <div class="card" style="padding:14px"><div class="small" style="font-weight:700;margin-bottom:8px">Share a win (+${W.PTS.perPost} pts)</div>
      <div class="chips-row scrollx">${PRESETS.map(x => `<button class="chipbtn" data-act="post" data-k="${x.k}">${esc(x.t)}</button>`).join('')}</div></div>
    ${posts.length ? posts.map(card).join('') : '<div class="empty">No posts nearby yet. Share the first win! Or switch to 🌍 Everyone.</div>'}
    <p class="tiny muted" style="text-align:center">Usernames and ZIP areas only. Never gallons or addresses.</p>
  </div>`;
}

function vMe() {
  const me = S.me; const st = myStats(); const prof = D.buildProfile(me.answers || {}); const t = D.personality(prof);
  const perks = W.recommendPerks(me, st.badges, st.pts.balance);
  const open = S.openPerk ? W.PERKS.find(x => x.id === S.openPerk) : null;
  const code = open ? W.rotatingCode(S.uid, open.id) : null;
  return `${topbar()}
  <div class="stack fade">
    <span class="eyebrow">Your Water Profile</span>
    <div class="card dark profcard">
      <div class="row"><div class="bigav">${esc(me.emoji)}</div><div style="flex:1"><h2 style="font-size:26px;color:#fff">${esc(me.name)}</h2><div class="small" style="color:rgba(255,255,255,.9)">${t.em} ${esc(t.name)} · ZIP ${esc(me.zip || '·····')}</div></div></div>
      <div class="pgrid">
        <div><b>${st.pts.balance}</b><span>points</span></div><div><b>${me.score ?? '–'}</b><span>score</span></div>
        <div><b>${st.badges.filter(b => b.earned).length}/${st.badges.length}</b><span>badges</span></div><div><b>${fmt(me.saved || 0)}</b><span>gal/day saved</span></div>
      </div>
    </div>
    ${open ? `<div class="card codecard pop"><div class="small muted">Show this at ${esc(open.partner)}</div><div class="bigcode">${code.code}</div>
      <div class="small">${open.icon} ${esc(open.title)} · new code in <b>${code.secondsLeft}s</b></div><button class="small" data-act="closeperk" style="color:var(--blue);font-weight:700;margin-top:8px">Close</button></div>` : ''}
    <div class="row"><h3 style="font-size:22px">Badges</h3><div class="spacer"></div><span class="small muted">${st.areaRank ? `#${st.areaRank} of ${st.areaSize} in your area` : ''}</span></div>
    <div class="bgrid">${st.badges.map(b => `<div class="badge ${b.earned ? 'on' : ''}"><div class="bi">${b.icon}</div><b>${esc(b.name)}</b><span>${b.earned ? 'Earned' : esc(b.how)}</span></div>`).join('')}</div>
    <div class="row"><h3 style="font-size:22px">Perks for you</h3><div class="spacer"></div><span class="pill terra">SAMPLE PARTNERS · DEMO</span></div>
    <div class="stack" style="gap:10px">${perks.map(p => `<div class="perk ${p.unlocked ? 'on' : ''}"><span class="ic">${p.icon}</span><div style="flex:1;min-width:0"><div class="t">${esc(p.title)}</div><div class="d">${esc(p.partner)} · ${p.badge ? `needs ${esc(W.BADGES.find(b => b.id === p.badge).icon + ' ' + W.BADGES.find(b => b.id === p.badge).name)}` : `${p.cost} pts`}</div></div>
      ${p.redeemed ? `<button class="btn sm" data-act="showperk" data-id="${p.id}">Show code</button>` : p.unlocked ? `<button class="btn sm green" data-act="redeem" data-id="${p.id}">Redeem</button>` : `<span class="small muted" style="text-align:right">${p.badge ? 'Locked' : p.need + ' more'}</span>`}</div>`).join('')}</div>
    <div class="card"><div class="small" style="font-weight:700;margin-bottom:8px">How you earned ${st.pts.earned} points</div>${st.pts.parts.map(x => `<div class="sc-row" style="font-size:14px;padding:3px 0"><span>${esc(x.label)}</span><b>+${x.pts}</b></div>`).join('')}${st.pts.spent ? `<div class="sc-row" style="font-size:14px;padding:3px 0"><span>Spent on perks</span><b>−${st.pts.spent}</b></div>` : ''}</div>
    <p class="tiny muted" style="text-align:center">Aquava Points have no cash value. Perks shown are samples until partner businesses join.</p>
    <button class="btn ghost" data-act="toprofile">See my water personality ✨</button>
  </div>`;
}

function personRow(p, i, opts = {}) {
  const me = p.id === S.uid;
  return `<div class="brow ${me ? 'me' : ''} ${i < 3 ? 'top' : ''}">
    <span class="rk">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span>
    <span class="av">${esc(p.emoji || '💧')}</span>
    <div style="min-width:0"><div class="nm">${esc(p.name)}${me ? ' (you)' : ''} ${opts.crown && opts.crown === p.id ? '<span class="crown">👑</span>' : ''}</div>
    ${opts.sub ? `<div class="sub">${opts.sub(p)}</div>` : ''}</div>
    <span class="pc">${fmt(p.progress || 0)}%</span></div>`;
}

function vBoard() {
  let body;
  if (S.seg === 'score') {
    const r = scored();
    body = r.length ? `<div class="board">${r.map((p, i) => { const row = personRow(p, i, { sub: p => `${p.correct ?? 0}/4 Water IQ · +${p.habitPts ?? 0} habits` }); return row.replace(/<span class="pc">[^<]*<\/span>/, `<span class="pc">${p.score}</span>`); }).join('')}</div>`
      : `<div class="empty">Nobody has finished the quiz yet. Be the first!</div>`;
  } else if (S.seg === 'class') {
    const r = ranked();
    body = r.length ? `<div class="board">${r.map((p, i) => personRow(p, i, { sub: p => `${fmt(p.saved || 0)} gal a day saved` })).join('')}</div>`
      : `<div class="empty">Nobody has finished the quiz yet. Be the first!</div>`;
  } else {
    const gs = Object.values(S.groups).filter(g => g && g.public).map(g => {
      const m = membersOf(g); const cap = m.length ? D.captainOf(m) : null;
      return { ...g, m, cap, score: D.groupScore(m) };
    }).filter(g => g.m.length).sort((a, b) => b.score - a.score);
    body = gs.length ? `<div class="board">${gs.map((g, i) => `<div class="brow ${S.me?.groupId === g.code ? 'me' : ''} ${i < 3 ? 'top' : ''}">
        <span class="rk">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span>
        <span class="av">👥</span>
        <div style="min-width:0"><div class="nm">${esc(g.name)}</div><div class="sub">${g.m.length} member${g.m.length > 1 ? 's' : ''} · 👑 ${esc(g.cap?.name || '')}</div></div>
        <span class="pc">${fmt(g.score)}%</span></div>`).join('')}</div>`
      : `<div class="empty">No public groups yet. Make a group, and if your captain says yes, you'll show up here.</div>`;
  }
  return `${topbar()}
  <div class="stack fade">
    <span class="eyebrow">Leaderboard</span>
    <h2 style="font-size:30px;line-height:1.1">${S.seg === 'score' ? 'Live Aquava Score ranking' : 'Ranked on progress, not gallons'}</h2>
    <div class="seg"><button class="${S.seg === 'score' ? 'on' : ''}" data-act="seg" data-seg="score">Score</button><button class="${S.seg === 'class' ? 'on' : ''}" data-act="seg" data-seg="class">Savings</button><button class="${S.seg === 'groups' ? 'on' : ''}" data-act="seg" data-seg="groups">Groups</button></div>
    <div class="card" style="padding:8px 12px">${body}</div>
    <p class="small muted" style="line-height:1.45">${S.seg === 'score' ? 'Score out of 1,000: finishing, Water IQ answers, a speed bonus, and water-wise habits.' : S.seg === 'class' ? 'A tiny apartment and a big house with a yard can both win. Your score is how much you improved on your own normal.' : 'A group\'s score is the average progress of its members, so small groups can beat big ones.'}</p>
  </div>`;
}

function inviteUrl(code) { return location.origin + location.pathname + '?g=' + code + (params.get('s') ? '&s=' + params.get('s') : ''); }
function qrSvg(text) {
  if (!window.qrcode) return '<div class="empty small">QR loading…</div>';
  const q = window.qrcode(0, 'M'); q.addData(text); q.make();
  return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
}

function vGroup() {
  const g = myGroup();
  if (!g) {
    return `${topbar()}
    <div class="stack fade">
      <span class="eyebrow">Groups</span>
      <h2 style="font-size:30px;line-height:1.1">Save water with your friends</h2>
      <p class="muted" style="line-height:1.45">Make a private group for roommates, friends or your team. Track each other's progress, and whoever leads the month becomes captain.</p>
      ${S.err ? `<div class="small" style="color:var(--terra);font-weight:700">${esc(S.err)}</div>` : ''}
      <div class="card stack">
        <h3 style="font-size:20px">Join with a code</h3>
        <input class="codein" id="jc" maxlength="4" placeholder="CODE" value="${esc(S.joinCode || S.inviteCode)}" autocomplete="off" autocapitalize="characters">
        <button class="btn" data-act="join">Join group</button>
      </div>
      <div class="card stack">
        <h3 style="font-size:20px">Or start a new one</h3>
        <input class="textin" id="gn" maxlength="22" placeholder="Group name, like Tempe Roomies" value="${esc(S.groupName)}" autocomplete="off">
        <button class="btn dark" data-act="create">Create group</button>
      </div>
    </div>`;
  }
  const m = membersOf(g).sort((a, b) => (b.progress - a.progress) || (a.joinedAt - b.joinedAt));
  const cap = D.captainOf(m); const amCap = cap && cap.id === S.uid;
  const passBy = cap && !amCap ? Math.max(0, (cap.progress || 0) - (S.me.progress || 0)) : 0;
  return `${topbar()}
  <div class="stack fade">
    <span class="eyebrow">Your group</span>
    <div class="row"><h2 style="font-size:30px;line-height:1.1;flex:1">${esc(g.name)}</h2>
      <span class="pill ${g.public ? 'green' : 'dark'}">${g.public ? '🌍 PUBLIC' : '🔒 PRIVATE'}</span></div>
    <div class="card dark row" style="justify-content:space-between">
      <div><div class="small" style="color:var(--soft)">Group score (average)</div><div style="font-family:var(--head);font-size:36px;color:var(--blue-l)">${fmt(D.groupScore(m))}%</div></div>
      <div style="text-align:right"><div class="small" style="color:var(--soft)">Join code</div><div class="codebig" style="color:var(--sand);font-size:30px">${esc(g.code)}</div></div>
    </div>
    <div class="card stack">
      <div class="row"><span style="font-size:30px">👑</span><div style="flex:1"><b>${esc(cap?.name || '')}${amCap ? ' (you!)' : ''}</b> is captain
        <div class="small muted">The top member this month decides if the group races in public.</div></div></div>
      <button class="toggle" data-act="public" ${amCap ? '' : 'aria-disabled="true"'} style="text-align:left">
        <span class="switch ${g.public ? 'on' : ''} ${amCap ? '' : 'lock'}"><i></i></span>
        <span><b>${g.public ? 'Racing in public' : 'Private group'}</b><div class="small muted">${amCap ? 'Your call, captain. Tap to switch.' : `Only the captain can change this. Get ${fmt(passBy + 0.1)}% more to take the crown.`}</div></span>
      </button>
    </div>
    <div class="card" style="padding:8px 12px"><div class="board">${m.map((p, i) => personRow(p, i, { crown: cap?.id })).join('')}</div></div>
    <button class="btn ghost" data-act="qr">${S.showQR ? 'Hide invite QR' : 'Invite friends (QR)'}</button>
    ${S.showQR ? `<div class="card stack" style="align-items:center;text-align:center"><div class="qrbox">${qrSvg(inviteUrl(g.code))}</div>
      <p class="small muted">Friends scan this to join <b>${esc(g.name)}</b>, or type code <b>${esc(g.code)}</b>.</p></div>` : ''}
    <p class="small muted" style="text-align:center">The crown resets on the 1st of every month.</p>
    <button class="small" data-act="leave" style="color:var(--terra);font-weight:700;padding:6px">Leave group</button>
  </div>`;
}

function vTabs() {
  const t = (id, label) => `<button class="${S.tab === id ? 'on' : ''}" data-act="tab" data-tab="${id}">${ICON[id]}${label}</button>`;
  return `<div class="in">${t('home', 'My water')}${t('feed', 'Feed')}${t('board', 'Ranking')}${t('group', 'Groups')}${t('me', 'Me')}</div>`;
}

/* ---------- render ---------- */
function render(force) {
  const a = document.activeElement;
  if (!force && a && (a.tagName === 'INPUT') && $app.contains(a)) { S.pendingRender = true; return; }
  S.pendingRender = false;
  let html = '';
  const inApp = S.screen === 'app';
  if (S.screen === 'welcome') html = vWelcome();
  else if (S.screen === 'quiz') html = vQuiz();
  else if (S.screen === 'result') html = vResult();
  else if (S.screen === 'profile') html = vProfile();
  else if (inApp) html = S.tab === 'home' ? vHome() : S.tab === 'feed' ? vFeed() : S.tab === 'board' ? vBoard() : S.tab === 'me' ? vMe() : vGroup();
  $app.className = 'app' + (inApp ? '' : ' no-tabs');
  $app.innerHTML = html;
  $tabs.hidden = !inApp;
  if (inApp) $tabs.innerHTML = vTabs();
}
document.addEventListener('focusout', () => setTimeout(() => { if (S.pendingRender) render(); }, 0));

function go(screen, tab) { S.screen = screen; if (tab) S.tab = tab; S.err = ''; render(true); window.scrollTo(0, 0); }

/* ---------- actions ---------- */
async function onAction(el) {
  const act = el.dataset.act;
  if (act === 'emoji') { const i = D.EMOJIS.indexOf(S.draftEmoji); S.draftEmoji = D.EMOJIS[(i + 1) % D.EMOJIS.length]; syncName(); render(true); }
  else if (act === 'shuffle') { syncName(); S.nameIdeas = [D.randomName(), D.randomName(), D.randomName()]; render(true); }
  else if (act === 'pickname') { syncName(); S.draftName = el.dataset.n; render(true); }
  else if (act === 'start') {
    syncName();
    const name = S.draftName.trim().replace(/\s+/g, ' ');
    if (name.length < 2) { S.err = 'Pick a username with at least 2 letters.'; return render(true); }
    const taken = Object.entries(S.players).some(([id, p]) => id !== S.uid && p?.name?.toLowerCase() === name.toLowerCase());
    if (taken) { S.err = 'Someone already has that name. Pick another!'; return render(true); }
    const zip = S.draftZip.trim();
    if (!/^\d{5}$/.test(zip)) { S.err = 'Add your 5-digit ZIP code so we can show neighbors near you.'; return render(true); }
    const ct = S.draftContact.trim();
    let ctype = null;
    if (ct) {
      if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(ct)) ctype = 'email';
      else if (ct.replace(/[^\d]/g, '').length >= 10 && /^[\d\s()+.-]+$/.test(ct)) ctype = 'phone';
      if (!ctype) { S.err = 'That email or phone looks off. Fix it, or leave it blank.'; return render(true); }
      if (!S.consent) { S.err = 'Tick the box to let us contact you, or clear the field.'; return render(true); }
    }
    await saveMe({ name, emoji: S.draftEmoji, zip, joinedAt: S.me?.joinedAt || Date.now(), quizDone: false, progress: 0, saved: 0, hasContact: !!ctype });
    if (ctype) { try { await S.store.set(root('contacts/' + S.uid), { value: ct, type: ctype, consent: true, name, zip, ts: Date.now() }); } catch (e) { console.warn('contact save failed', e); } }
    S.qi = 0; S.answers = {}; S.revealed = false; go('quiz');
  }
  else if (act === 'answer') {
    const Q = D.QUESTIONS[S.qi]; const i = +el.dataset.i;
    S.answers[Q.id] = i;
    if (Q.type === 'fact') { S.times[Q.id] = Date.now() - (S.qStart || Date.now()); S.revealed = true; render(true); }
    else { render(true); setTimeout(() => nextQ(), 260); }
  }
  else if (act === 'next') nextQ();
  else if (act === 'qback') {
    if (S.qi === 0) return go('welcome');
    S.qi--; S.revealed = D.QUESTIONS[S.qi].type === 'fact' && S.answers[D.QUESTIONS[S.qi].id] !== undefined; render(true);
  }
  else if (act === 'toprofile') { go('profile'); }
  else if (act === 'toapp') { go('app', 'home'); maybeAutoJoin(); }
  else if (act === 'tab') { if (S.screen !== 'app') S.screen = 'app'; S.tab = el.dataset.tab; S.err = ''; render(true); window.scrollTo(0, 0); }
  else if (act === 'seg') { S.seg = el.dataset.seg; render(true); }
  else if (act === 'swap') {
    const id = el.dataset.id; const swaps = { ...(S.me.swaps || {}) };
    if (swaps[id]) delete swaps[id]; else swaps[id] = true;
    const prof = D.buildProfile(S.me.answers || {});
    const saved = D.buildSwaps(S.me.answers || {}, prof).filter(s => swaps[s.id]).reduce((t, s) => t + s.gal, 0);
    const progress = D.progressOf(prof.baseline, saved);
    await saveMe({ swaps, saved: Math.round(saved * 10) / 10, progress });
    if (id === 'leak' && swaps.leak) { toast('🔧 Leak fixed! +' + D.LEAK_GAL + ' gallons a day'); addPost('leak', '🔧 Fixed a sneaky leak at home. +20 gallons a day saved!', { actionId: 'leak' }); }
    checkBadges();
    render(true);
  }
  else if (act === 'retake') { S.qi = 0; S.times = {}; S.qStartFor = null; S.answers = {}; S.revealed = false; go('quiz'); }
  else if (act === 'create') {
    const name = (document.getElementById('gn')?.value || '').trim().replace(/\s+/g, ' ');
    S.groupName = name;
    if (name.length < 2) { S.err = 'Give your group a name first.'; return render(true); }
    let code; do { code = D.makeCode(); } while (S.groups[code]);
    await S.store.set(root('groups/' + code), { code, name, public: false, createdAt: Date.now(), createdBy: S.uid, members: { [S.uid]: Date.now() } });
    await saveMe({ groupId: code }); S.groupName = ''; S.showQR = true; toast('👥 Group created. Share code ' + code);
    render(true);
  }
  else if (act === 'join') {
    const code = (document.getElementById('jc')?.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    await joinGroup(code);
  }
  else if (act === 'public') {
    const g = myGroup(); if (!g) return;
    const m = membersOf(g); const cap = D.captainOf(m);
    if (!cap || cap.id !== S.uid) { toast('👑 Only the captain can switch this'); return; }
    await S.store.update(root('groups/' + g.code), { public: !g.public, publicSetBy: S.uid });
    toast(!g.public ? '🌍 Your group is racing in public!' : '🔒 Your group is private');
  }
  else if (act === 'qr') { S.showQR = !S.showQR; render(true); }
  else if (act === 'try') {
    const id = el.dataset.id; const a = R.actionById(id); if (!a || S.me?.tried?.[id]) return;
    const tried = { ...(S.me.tried || {}), [id]: Date.now() };
    await saveMe({ tried });
    toast(`${a.icon} Nice! +${W.PTS.perTried} points`);
    await addPost('tried', `${a.icon} Trying this: ${a.title}`, { actionId: id });
    checkBadges(); render(true);
  }
  else if (act === 'cheer') {
    const id = el.dataset.id; const p = S.posts[id]; if (!p || p.uid === S.uid) return;
    const on = !!p.cheers?.[S.uid];
    S.posts = { ...S.posts, [id]: { ...p, cheers: { ...(p.cheers || {}), [S.uid]: on ? undefined : true } } };
    if (on) delete S.posts[id].cheers[S.uid];
    try { if (on) await S.store.remove(root(`posts/${id}/cheers/${S.uid}`)); else await S.store.set(root(`posts/${id}/cheers/${S.uid}`), true); } catch (e) {}
    checkBadges(); render(true);
  }
  else if (act === 'post') {
    const x = PRESETS.find(q => q.k === el.dataset.k); if (!x) return;
    const recent = postList().some(p => p.uid === S.uid && p.text === x.t && Date.now() - p.ts < 3600000);
    if (recent) { toast('You already shared that this hour'); return; }
    await addPost('share', x.t); toast(`Shared! +${W.PTS.perPost} points`); render(true);
  }
  else if (act === 'scope') { S.feedScope = el.dataset.v; render(true); }
  else if (act === 'redeem') {
    const perk = W.PERKS.find(x => x.id === el.dataset.id); const st = myStats();
    const ok = W.recommendPerks(S.me, st.badges, st.pts.balance).find(x => x.id === perk.id)?.unlocked;
    if (!perk || !ok) return;
    await saveMe({ redeemed: { ...(S.me.redeemed || {}), [perk.id]: { ts: Date.now(), cost: perk.cost || 0 } } });
    S.openPerk = perk.id; toast(`🎁 ${perk.title} unlocked`); render(true); window.scrollTo(0, 0); startCodeTimer();
  }
  else if (act === 'showperk') { S.openPerk = el.dataset.id; render(true); window.scrollTo(0, 0); startCodeTimer(); }
  else if (act === 'closeperk') { S.openPerk = null; render(true); }
  else if (act === 'leave') {
    const g = myGroup(); if (!g) return;
    await S.store.remove(root(`groups/${g.code}/members/${S.uid}`));
    if (Object.keys(g.members || {}).length <= 1) await S.store.remove(root('groups/' + g.code));
    await saveMe({ groupId: null }); S.prevCaptain = undefined; render(true);
  }
}

async function joinGroup(code) {
  S.joinCode = code;
  if (code.length !== 4) { S.err = 'Codes have 4 letters or numbers.'; return render(true); }
  const g = S.groups[code] || await S.store.get(root('groups/' + code));
  if (!g) { S.err = `No group with code ${code}. Check the letters?`; return render(true); }
  const old = myGroup();
  if (old && old.code !== code) await S.store.remove(root(`groups/${old.code}/members/${S.uid}`));
  await S.store.set(root(`groups/${code}/members/${S.uid}`), Date.now());
  await saveMe({ groupId: code }); S.inviteCode = ''; S.joinCode = ''; S.err = '';
  toast('👥 You joined ' + g.name); S.tab = 'group'; render(true);
}
function maybeAutoJoin() { if (S.inviteCode && !S.me?.groupId) joinGroup(S.inviteCode); }

async function nextQ() {
  const total = D.QUESTIONS.length;
  if (S.answers[D.QUESTIONS[S.qi].id] === undefined) return;
  if (S.qi < total - 1) { S.qi++; S.revealed = false; render(true); window.scrollTo(0, 0); return; }
  const prof = D.buildProfile(S.answers);
  const keep = S.me?.swaps?.leak ? { leak: true } : {};
  const saved = D.buildSwaps(S.answers, prof).filter(s => keep[s.id]).reduce((t, s) => t + s.gal, 0);
  const sc = D.scoreOf(S.answers, S.times);
  const best = Math.max(sc.total, S.me?.score || 0);
  await saveMe({ answers: { ...S.answers }, times: { ...S.times }, baseline: prof.baseline, swaps: keep, saved, progress: D.progressOf(prof.baseline, saved), quizDone: true,
    score: best, iq: sc.iq, correct: sc.correct, speed: sc.speed, habitPts: sc.habit, habitsGal: sc.habits, finishedAt: S.me?.finishedAt || Date.now() });
  S.lastScore = sc;
  if (!S.me?.joinPosted) { await saveMe({ joinPosted: true }); addPost('joined', `🎉 Joined Aquava with a score of ${sc.total}. ${D.personality(prof).em} ${D.personality(prof).name}!`); }
  go('result'); checkBadges();
}

function syncName() { const i = document.getElementById('nm'); if (i) S.draftName = i.value; const z = document.getElementById('zip'); if (z) S.draftZip = z.value; const c = document.getElementById('ct'); if (c) S.draftContact = c.value; const k = document.getElementById('cs'); if (k) S.consent = k.checked; }

$app.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (el && !el.disabled) onAction(el); });
$tabs.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (el) onAction(el); });
$app.addEventListener('input', e => {
  if (e.target.id === 'nm') S.draftName = e.target.value;
  if (e.target.id === 'zip') { e.target.value = e.target.value.replace(/[^\d]/g, '').slice(0, 5); S.draftZip = e.target.value; }
  if (e.target.id === 'ct') { const had = !!S.draftContact.trim(); S.draftContact = e.target.value; if (had !== !!S.draftContact.trim()) { const pos = e.target.selectionStart; render(true); const n = document.getElementById('ct'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } } }
  if (e.target.id === 'cs') S.consent = e.target.checked;
  if (e.target.id === 'gn') S.groupName = e.target.value;
  if (e.target.id === 'jc') { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); S.joinCode = e.target.value; }
});
$app.addEventListener('change', e => { if (e.target.id === 'cs') S.consent = e.target.checked; });
$app.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (e.target.id === 'nm') onAction({ dataset: { act: 'start' } });
  if (e.target.id === 'jc') onAction({ dataset: { act: 'join' } });
  if (e.target.id === 'gn') onAction({ dataset: { act: 'create' } });
});

/* ---------- live updates and friendly banter ---------- */
function checkBanter() {
  if (!S.me?.quizDone) return;
  const rank = myRank();
  if (S.prevRank !== undefined && rank && S.prevRank && rank < S.prevRank) toast(`🚀 You moved up to #${rank}!`);
  S.prevRank = rank;
  const g = myGroup();
  if (g) {
    const cap = D.captainOf(membersOf(g));
    const capId = cap?.id;
    if (S.prevCaptain !== undefined && capId && capId !== S.prevCaptain) {
      if (capId === S.uid) toast('👑 You\'re the captain now!');
      else if (S.prevCaptain === S.uid) toast(`😤 ${cap.name} took your crown!`);
    }
    S.prevCaptain = capId;
  }
}

function checkBadges() {
  if (!S.me?.quizDone) return;
  const earned = myStats().badges.filter(b => b.earned).map(b => b.id);
  const posted = S.me.badgesPosted || {};
  const fresh = earned.filter(id => !posted[id]);
  if (!fresh.length) return;
  const upd = { ...posted }; fresh.forEach(id => upd[id] = Date.now());
  saveMe({ badgesPosted: upd });
  fresh.forEach((id, i) => { const b = W.BADGES.find(x => x.id === id); setTimeout(() => toast(`${b.icon} Badge unlocked: ${b.name}`), 300 + i * 2800); });
  const shareable = fresh.filter(id => id !== 'lover').map(id => W.BADGES.find(x => x.id === id));
  if (shareable.length) addPost('badge', `${shareable.map(b => b.icon).join(' ')} Earned ${shareable.length > 1 ? 'new badges' : 'a new badge'}: ${shareable.map(b => b.name).join(', ')}!`);
}
function startCodeTimer() {
  clearInterval(startCodeTimer.t);
  startCodeTimer.t = setInterval(() => { if (S.openPerk && S.tab === 'me' && S.screen === 'app') render(); else clearInterval(startCodeTimer.t); }, 1000);
}

async function boot() {
  S.store = await initStore(); S.uid = S.store.uid;
  try { const seen = await S.store.get(root('scans/' + S.uid)); if (!seen) await S.store.set(root('scans/' + S.uid), Date.now()); } catch (e) {}
  S.store.on(root('players'), v => {
    S.players = v || {}; S.me = S.players[S.uid] || null;
    if (!S.loaded) {
      S.loaded = true;
      if (S.me?.quizDone) { S.screen = 'app'; S.answers = { ...(S.me.answers || {}) }; }
      else S.screen = 'welcome';
      if (S.me?.name) { S.draftName = S.me.name; S.draftEmoji = S.me.emoji || S.draftEmoji; }
      if (S.screen === 'app') setTimeout(maybeAutoJoin, 300);
    }
    checkBanter(); render();
  });
  S.store.on(root('groups'), v => { S.groups = v || {}; checkBanter(); if (S.loaded) render(); });
  S.store.on(root('posts'), v => { S.posts = v || {}; if (S.loaded && (S.tab === 'feed' || S.tab === 'me' || S.tab === 'home')) render(); });
}
boot().catch(e => { console.error(e); $app.innerHTML = '<div class="empty" style="padding-top:30vh">Could not connect. Check your internet and refresh.</div>'; });
window.addEventListener('load', () => { if (S.showQR) render(); });
