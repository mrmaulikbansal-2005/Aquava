import { initStore, root, SESSION, adminSignIn, adminEmail } from './store.js?v=8';
import * as D from './data.js?v=8';

const $ = document.getElementById('root');
const S = { players: {}, scans: {}, groups: {}, posts: {}, contacts: null, contactErr: '', mode: '', st: null };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const t = ms => ms ? new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';

function rows() {
  return Object.entries(S.players).map(([id, p]) => ({ id, ...p })).filter(p => p.name)
    .sort((a, b) => ((b.score ?? -1) - (a.score ?? -1)) || ((a.finishedAt || 0) - (b.finishedAt || 0)));
}

function render() {
  const all = rows(); const fin = all.filter(p => p.quizDone && typeof p.score === 'number');
  const scans = Object.keys(S.scans).length;
  const avg = fin.length ? Math.round(fin.reduce((s, p) => s + p.score, 0) / fin.length) : 0;
  const top = fin.length ? fin[0].score : 0;
  const iqAvg = fin.length ? (fin.reduce((s, p) => s + (p.correct || 0), 0) / fin.length).toFixed(1) : '0';
  const pledged = fin.reduce((s, p) => s + (p.saved || 0), 0);
  const max = Math.max(scans, all.length, 1);
  const fb = (label, n) => `<div class="fb"><span>${label}</span><div class="t"><i style="width:${(n / max) * 100}%"></i></div><span>${n}</span></div>`;
  $.innerHTML = `
  <header><h1>Aquava organizer</h1><span class="tag">Session: ${esc(SESSION)}</span><span class="live">${S.mode === 'live' ? '● LIVE' : 'DEMO MODE'}</span></header>
  <div class="kpis">
    <div class="k"><b>${scans}</b><span>Scanned</span></div>
    <div class="k"><b>${all.length}</b><span>Started quiz</span></div>
    <div class="k"><b>${fin.length}</b><span>Finished quiz</span></div>
    <div class="k"><b>${scans ? Math.round((fin.length / scans) * 100) : 0}%</b><span>Completion</span></div>
    <div class="k"><b>${avg}</b><span>Avg score</span></div>
    <div class="k"><b>${top}</b><span>Top score</span></div>
    <div class="k"><b>${iqAvg}/4</b><span>Avg Water IQ</span></div>
    <div class="k"><b>${Math.round(pledged)}</b><span>Gal/day pledged</span></div>
    <div class="k"><b>${all.filter(p => p.hasContact).length}</b><span>Left contact</span></div>
    <div class="k"><b>${Object.keys(S.posts).length}</b><span>Feed posts</span></div>
  </div>
  <div class="card">
    <div class="row"><b style="font-family:Outfit,sans-serif;font-size:20px">Contacts (private)</b><span style="flex:1"></span>
    ${S.contacts ? `<span class="muted">Signed in as ${esc(adminEmail() || '')}</span><button id="ccsv">Download contacts (CSV)</button><button id="reset" class="ghost">${S.armReset ? 'Tap again to wipe this session' : 'Reset session'}</button>` : `<button id="signin">Sign in with Google to view</button>`}</div>
    ${S.contactErr ? `<p class="muted" style="color:#B97300;margin-top:8px">${esc(S.contactErr)}</p>` : ''}
    ${S.contacts ? `<div class="scroll" style="margin-top:10px"><table><tr><th>Username</th><th>Type</th><th>Contact</th><th>ZIP</th><th>When</th></tr>${Object.values(S.contacts).sort((a, b) => b.ts - a.ts).map(c => `<tr><td>${esc(c.name)}</td><td>${esc(c.type)}</td><td>${esc(c.value)}</td><td>${esc(c.zip || '')}</td><td>${t(c.ts)}</td></tr>`).join('')}</table></div>` : '<p class="muted" style="margin-top:8px">Only the organizer account can read emails and phone numbers.</p>'}
  </div>
  <div class="card"><div class="funnel">${fb('Scanned', scans)}${fb('Started quiz', all.length)}${fb('Finished quiz', fin.length)}</div></div>
  <div class="card">
    <div class="row" style="margin-bottom:12px"><b style="font-family:Outfit,sans-serif;font-size:20px">All participants</b><span class="muted">Usernames and scores. Contacts are in the private section above.</span><span style="flex:1"></span><button id="csv">Download results (CSV)</button></div>
    <div class="scroll"><table><tr><th>#</th><th>Username</th><th>Score</th><th>Water IQ</th><th>Speed</th><th>Habits</th><th>Gal/day</th><th>Personality</th><th>Group</th><th>Finished</th></tr>
    ${all.map((p, i) => { const pers = p.answers ? D.personality(D.buildProfile(p.answers)).name : ''; return `<tr><td class="n">${p.quizDone ? i + 1 : ''}</td><td>${esc(p.emoji || '')} ${esc(p.name)}</td><td class="n"><b>${p.score ?? '·'}</b></td><td class="n">${p.correct ?? ''}${p.correct != null ? '/4' : ''}</td><td class="n">${p.speed ?? ''}</td><td class="n">${p.habitPts ?? ''}</td><td class="n">${p.habitsGal ?? ''}</td><td>${esc(pers)}</td><td>${esc(S.groups[p.groupId]?.name || '')}</td><td>${p.quizDone ? t(p.finishedAt) : 'in progress'}</td></tr>`; }).join('')}
    </table></div>
  </div>
  <p class="muted">Projector screen: <a href="presenter.html?s=${encodeURIComponent(SESSION)}">presenter.html?s=${esc(SESSION)}</a> · Player link: <a href="./?s=${encodeURIComponent(SESSION)}">./?s=${esc(SESSION)}</a></p>`;
  document.getElementById('csv').onclick = download;
  const si = document.getElementById('signin'); if (si) si.onclick = signIn;
  const cc = document.getElementById('ccsv'); if (cc) cc.onclick = downloadContacts;
  const rs = document.getElementById('reset'); if (rs) rs.onclick = async () => {
    if (!S.armReset) { S.armReset = true; render(); setTimeout(() => { S.armReset = false; render(); }, 4000); return; }
    S.armReset = false; try { await S.st.remove(root()); } catch (e) { S.contactErr = 'Reset failed: ' + (e.code || e.message); } render();
  };
}

function download() {
  const head = ['rank', 'username', 'score', 'water_iq_correct', 'speed_bonus', 'habit_points', 'gallons_per_day_estimate', 'personality', 'group', 'swaps_pledged_gal_day', 'finished_at'];
  const csvq = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [head.join(',')].concat(rows().map((p, i) => [p.quizDone ? i + 1 : '', p.name, p.score ?? '', p.correct ?? '', p.speed ?? '', p.habitPts ?? '', p.habitsGal ?? '',
    p.answers ? D.personality(D.buildProfile(p.answers)).name : '', S.groups[p.groupId]?.name || '', p.saved ?? '', p.finishedAt ? new Date(p.finishedAt).toISOString() : ''].map(csvq).join(',')));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `aquava-${SESSION}-results.csv`; a.click();
}

async function signIn() {
  S.contactErr = '';
  try { await adminSignIn(); S.st.on(root('contacts'), v => { S.contacts = v || {}; render(); }, e => { S.contactErr = 'This account is not allowed to view contacts.'; S.contacts = null; render(); }); }
  catch (e) { S.contactErr = 'Sign-in failed: ' + (e.code || e.message); render(); }
}
function downloadContacts() {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['username', 'type', 'contact', 'zip', 'consent', 'signed_up'].join(',')].concat(Object.values(S.contacts || {}).map(c => [c.name, c.type, c.value, c.zip, c.consent ? 'yes' : 'no', new Date(c.ts).toISOString()].map(q).join(',')));
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' })); a.download = `aquava-${SESSION}-contacts.csv`; a.click();
}

(async () => {
  const st = await initStore(); S.mode = st.mode; S.st = st;
  st.on(root('posts'), v => { S.posts = v || {}; render(); });
  st.on(root('players'), v => { S.players = v || {}; render(); });
  st.on(root('scans'), v => { S.scans = v || {}; render(); });
  st.on(root('groups'), v => { S.groups = v || {}; render(); });
})();
