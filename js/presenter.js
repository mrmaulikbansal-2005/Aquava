import { initStore, root, SESSION } from './store.js';
import * as D from './data.js';

const $ = document.getElementById('screen');
const S = { store: null, players: {}, groups: {}, scans: {}, qi: 0, armed: false };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Math.round(n).toLocaleString('en-US');
const fmt1 = n => (Math.round(n * 10) / 10).toLocaleString('en-US');

const joinUrl = () => {
  const u = new URL('./', location.href);
  if (SESSION !== 'class') u.searchParams.set('s', SESSION);
  return u.href;
};
const LOGO = `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="14.5" fill="none" stroke="#3DD8F5" stroke-width="2" opacity=".4"/><path d="M16 6.5s-6.5 7.6-6.5 12a6.5 6.5 0 0 0 13 0c0-4.4-6.5-12-6.5-12z" fill="#3DD8F5"/></svg>`;

function qr() {
  if (!window.qrcode) return '';
  const q = window.qrcode(0, 'M'); q.addData(joinUrl()); q.make();
  return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
}

const all = () => Object.entries(S.players).map(([id, p]) => ({ id, ...p })).filter(p => p.name);
const done = () => all().filter(p => p.quizDone);

function insightFor(Q, counts, n) {
  if (!n) return '';
  const pct = i => Math.round(((counts[i] || 0) / n) * 100);
  if (Q.id === 'shower') return `${pct(2) + pct(3)}% of you shower for 15 minutes or more.`;
  if (Q.id === 'tap') return `${pct(0) + pct(1)}% of you leave the tap running, at least sometimes.`;
  if (Q.id === 'yard') return `${pct(2) + pct(3)}% water 3 or more times a week in summer.`;
  if (Q.id === 'dishes') return `${pct(2)}% wash dishes under a running tap.`;
  if (Q.type === 'fact') return `${pct(Q.answer)}% of you guessed right.`;
  return '';
}

function quizPanel() {
  const Q = D.QUESTIONS[S.qi % D.QUESTIONS.length];
  const counts = {}; let n = 0;
  done().forEach(p => { const a = p.answers?.[Q.id]; if (a !== undefined) { counts[a] = (counts[a] || 0) + 1; n++; } });
  const max = Math.max(1, ...Object.values(counts));
  const bars = Q.options.map((o, i) => `<div class="bar ${Q.type === 'fact' && i === Q.answer ? 'right' : ''}"><span>${esc(o)}</span><b>${counts[i] || 0}</b>
    <div class="t"><i style="width:${((counts[i] || 0) / max) * 100}%"></i></div></div>`).join('');
  return `<div class="h">${Q.type === 'fact' ? 'Quick guess' : 'Room habits'} · live from your answers</div>
    <div class="qemoji">${Q.emoji}</div>
    <div class="qtitle">${esc(Q.q)}</div>
    <div class="bars">${bars}</div>
    <div class="insight">${n ? esc(insightFor(Q, counts, n)) : 'Waiting for answers…'}</div>
    <div class="dots">${D.QUESTIONS.map((_, i) => `<i class="${i === S.qi % D.QUESTIONS.length ? 'on' : ''}"></i>`).join('')}</div>`;
}

function people() {
  const r = done().filter(p => typeof p.score === 'number').sort((a, b) => (b.score - a.score) || (a.finishedAt || 0) - (b.finishedAt || 0)).slice(0, 8);
  if (!r.length) return '<div class="empty">The first person to finish the quiz shows up here.</div>';
  return r.map((p, i) => `<div class="row"><span class="rk">${['🥇', '🥈', '🥉'][i] || i + 1}</span><span class="av">${esc(p.emoji || '💧')}</span>
    <span class="nm">${esc(p.name)}<div class="sub">${p.correct ?? 0}/4 Water IQ · +${p.habitPts ?? 0} habits</div></span><span class="pc">${p.score}</span></div>`).join('');
}

function groupsRace() {
  const gs = Object.values(S.groups).filter(g => g && g.public && g.members).map(g => {
    const m = Object.entries(g.members).map(([id, j]) => { const p = S.players[id]; return p ? { id, joinedAt: j, name: p.name, progress: p.quizDone ? (p.progress || 0) : 0 } : null; }).filter(Boolean);
    return { name: g.name, m, cap: m.length ? D.captainOf(m) : null, score: D.groupScore(m) };
  }).filter(g => g.m.length).sort((a, b) => b.score - a.score).slice(0, 4);
  if (!gs.length) return '<div class="empty">No public groups yet. Captains, make your call! 👑</div>';
  return gs.map((g, i) => `<div class="row"><span class="rk">${['🥇', '🥈', '🥉'][i] || i + 1}</span><span class="av">👥</span>
    <span class="nm">${esc(g.name)}<div class="sub">${g.m.length} members · 👑 ${esc(g.cap?.name || '')}</div></span><span class="pc">${fmt1(g.score)}%</span></div>`).join('');
}

function render() {
  const ps = all(); const d = done();
  const perDay = d.reduce((s, p) => s + (p.saved || 0), 0);
  const perYear = perDay * 365;
  const live = S.store?.mode === 'live';
  $.innerHTML = `
  <header><div class="logo">${LOGO}Aquava</div><span class="tag">${SESSION === 'partnerday' ? 'W. P. Carey Partner Day · ' : ''}Every drop · Every neighbor · One goal</span>
    <span class="live ${live ? '' : 'local'}"><i></i>${live ? 'LIVE' : 'DEMO MODE'}</span></header>
  <section class="panel">
    <div class="h">Join the live challenge</div>
    <div class="qr">${qr()}</div>
    <div class="scan">Scan with your phone camera</div>
    <div class="url">${esc(joinUrl().replace(/^https?:\/\//, ''))}</div>
    <div class="count"><b>${Object.keys(S.scans).length}</b><span>scanned · ${d.length} finished the quiz</span></div>
  </section>
  <section class="panel">${quizPanel()}</section>
  <section class="right">
    <div class="panel" style="flex:1.35"><div class="h">Live ranking · Aquava Score out of 1,000</div><div class="rows">${people()}</div></div>
    <div class="panel" style="flex:1"><div class="h">Group race · public groups</div><div class="rows">${groupsRace()}</div></div>
  </section>
  <footer>
    <div><div class="big">${fmt1(perDay)}</div><div class="lbl">gallons a day this room pledged to save</div></div><div class="sep"></div>
    <div><div class="big">${fmt(perYear)}</div><div class="lbl">gallons a year if we keep it up</div></div><div class="sep"></div>
    <div><div class="big">${fmt(perYear / 70)}</div><div class="lbl">full bathtubs a year (about 70 gallons each)</div></div>
    <button class="reset ${S.armed ? 'arm' : ''}" id="reset">${S.armed ? 'Tap again to clear everything' : 'New session'}</button>
  </footer>`;
}

document.addEventListener('click', async e => {
  if (e.target.id !== 'reset') return;
  if (!S.armed) { S.armed = true; render(); setTimeout(() => { S.armed = false; render(); }, 4000); return; }
  S.armed = false; await S.store.remove(root());
});

async function boot() {
  S.store = await initStore();
  render();
  S.store.on(root('players'), v => { S.players = v || {}; render(); });
  S.store.on(root('groups'), v => { S.groups = v || {}; render(); });
  S.store.on(root('scans'), v => { S.scans = v || {}; render(); });
  setInterval(() => { S.qi++; render(); }, 8000);
  window.addEventListener('load', render);
}
boot();
