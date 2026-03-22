import { S } from './state.js';
import { SC2 } from './config.js';
import { fmt } from './utils.js';

export function sTab(n) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === n));
  document.querySelectorAll('.tp2').forEach(p => p.classList.toggle('active', p.id === `pane-${n}`));
}

export function showAsk(m, c) {
  const b = document.getElementById('aB');
  if (!m) { b.style.display = 'none'; return; }
  b.style.display = 'block';
  b.textContent = '🎤 ' + m;
  b.style.color = c || '#ce93d8';
}

export function addEvt(d, s) {
  S.events = [{ description: d, severity: s, timestamp: new Date(), id: `s-${Date.now()}` }, ...S.events].slice(0, 100);
  rEvt();
}

export function rEsc() {
  const s = document.getElementById('eS'), w = document.getElementById('eT');
  const es = Object.values(S.escalations);
  if (!es.length) { s.style.display = 'none'; return; }
  s.style.display = 'block';
  w.innerHTML = es.map(e => {
    const p = Math.min(100, Math.max(0, e.level || 0));
    const c = p >= 80 ? '#ff1744' : p >= 50 ? '#ff6d00' : p >= 25 ? '#ffd600' : '#40c4ff';
    return `<div class="eb"><div class="mono el">${e.label}</div><div class="et"><div class="ef" style="width:${p}%;background:${c}"></div></div><div class="mono ev2" style="color:${c}">${p}%</div></div>`;
  }).join('');
}

export function rEvt() {
  document.getElementById('eC').textContent = `(${S.events.length})`;
  document.getElementById('eL').innerHTML = S.events.slice(0, 50).map(ev =>
    `<div class="evt"><div class="eh"><span class="mono es" style="color:${SC2[ev.severity] || '#2a3f55'}">${ev.severity}</span><span class="mono etm">${fmt(ev.timestamp)}</span></div><div class="ed">${ev.description}</div>${ev.action_recommended ? `<div class="mono ea">→ ${ev.action_recommended}</div>` : ''}</div>`
  ).join('');
}
