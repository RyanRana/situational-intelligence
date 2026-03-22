import { S } from './state.js';
import { SVC } from './config.js';
import { fmt, fmtS } from './utils.js';
import { sTab, addEvt } from './ui.js';
import { locStr } from './location.js';
import { speakTo } from './speech.js';
import { capEvidence } from './capture.js';

export function triggerDisp(a, now) {
  if (S.dispatchLock) return;
  S.dispatchLock = true;

  const ev = capEvidence();
  const st = a.service_type || 'EMS';
  const svc = SVC[st] || SVC.EMS;
  const cid = `CALL-${String(S.dispatchCalls.length + 1).padStart(3, '0')}`;

  const stationList = S.nearbyStations[st] || [];
  const station = stationList[0] || null;
  const call = { id: cid, start: Date.now(), status: 'CONNECTING', msgs: [], analysis: a, ev, svcType: st, mapId: `map-${cid}`, station };
  S.dispatchCalls.unshift(call);
  sTab('dispatch');

  const loc = locStr();
  const esc = Object.values(S.escalations).filter(e => e.level >= 40).map(e => `${e.label}(${e.level}%)`).join(',') || 'Elevated';
  const unitName = st === 'EMS' ? `Medic-${Math.floor(Math.random() * 20 + 1)}` : st === 'FIRE' ? `Engine-${Math.floor(Math.random() * 15 + 1)}` : `Unit ${Math.floor(Math.random() * 40 + 10)}-${Math.floor(Math.random() * 9 + 1)}`;
  const resp = st === 'EMS' ? 'ems' : st === 'FIRE' ? 'fire' : 'officer';
  const stName = station ? station.name : (st + ' Station');
  const eta = st === 'EMS' ? '4-6' : st === 'FIRE' ? '3-5' : '5-8';
  const vc = S.askState === 'confirmed' || S.askState === 'dispatched' ? 'Person confirmed need.' : S.voiceAttempt >= 2 ? 'Unresponsive to checks.' : a.hazard_detected && a.hazard_detected !== 'none' ? `Hazard: ${a.hazard_detected} detected.` : '';

  const script = [
    { d: 0, s: 'system', t: `${svc.i} ${cid} [${svc.l}]`, st: 'CONNECTING' },
    { d: 1500, s: 'dispatch', t: `911 Emergency. What's your emergency?`, st: 'ACTIVE' },
    { d: 4000, s: 'aegis', t: `AEGIS automated guardian. Requesting ${svc.l}. Level: ${a.threat_level}. ${vc}`, ev: true },
    { d: 8000, s: 'dispatch', t: `Nature of emergency and location?` },
    { d: 10500, s: 'aegis', t: `${a.summary} Triggers: ${esc}. Motion: ${S.motion}%.` },
    { d: 13500, s: 'aegis', t: `Location: ${loc}` },
    { d: 16000, s: 'dispatch', t: `Dispatching ${unitName} from ${stName}.` },
    { d: 19000, s: resp, t: `${unitName} responding from ${stName}. Code ${st === 'EMS' || a.threat_level === 'CRITICAL' ? '3' : '2'}.`, st: 'DISPATCHED' },
    { d: 22000, s: 'dispatch', t: `${unitName}, ETA ${eta} minutes.` },
    { d: 25000, s: 'aegis', t: `Copy. Maintaining observation.` },
    { d: 27000, s: 'speaker', t: `Help is on the way. ${st === 'EMS' ? 'Paramedics' : 'Emergency responders'} dispatched from ${stName}, arriving in approximately ${eta} minutes.`, speak: true },
    { d: 40000, s: resp, t: `Dispatch, approaching location. Current status?` },
    { d: 43000, s: 'aegis', t: `${S.narrative || a.summary} Motion: ${S.motion}%.` },
    { d: 48000, s: resp, t: `On scene.`, st: 'ON SCENE' },
    { d: 50000, s: 'speaker', t: `Help has arrived at your location.`, speak: true },
    { d: 53000, s: 'dispatch', t: `${unitName} on scene.` },
    { d: 56000, s: 'system', t: `${cid} — responders on scene. AEGIS passive.`, st: 'RESOLVED' },
  ];

  let idx = 0;
  function next() {
    if (idx >= script.length) { setTimeout(() => { S.dispatchLock = false; }, 60000); return; }
    const s = script[idx];
    const t = S.dispatchCalls.find(c => c.id === cid);
    if (!t) return;
    if (s.st) t.status = s.st;
    t.msgs.push({ s: s.s, t: s.t, time: new Date(), ev: s.ev ? ev : null });
    rDisp();
    if (s.speak) speakTo(s.t.replace(/<br>/g, ' '));
    if (s.st === 'DISPATCHED') setTimeout(() => initMap(cid), 300);
    idx++;
    if (idx < script.length) setTimeout(next, script[idx].d - s.d);
  }
  next();
}

function initMap(cid) {
  const el = document.getElementById(`map-${cid}`);
  if (!el || !S.myLoc || S.maps[cid]) return;
  const call = S.dispatchCalls.find(c => c.id === cid);
  const svc = SVC[call?.svcType] || SVC.EMS;
  const L = window.L;
  const map = L.map(el, { zoomControl: false, attributionControl: false }).setView([S.myLoc.lat, S.myLoc.lng], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);

  L.marker([S.myLoc.lat, S.myLoc.lng], { icon: L.divIcon({ html: '<div style="background:#ff1744;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 8px #ff174488"></div>', iconSize: [14, 14], iconAnchor: [7, 7] }) }).addTo(map).bindPopup('<b>📍 Scene</b>');

  if (S.hospital) L.marker([S.hospital.lat, S.hospital.lon], { icon: L.divIcon({ html: '<div style="background:#42a5f5;width:14px;height:14px;border-radius:3px;border:2px solid #fff;font-size:8px;color:#fff;text-align:center;line-height:12px;font-weight:bold">H</div>', iconSize: [14, 14], iconAnchor: [7, 7] }) }).addTo(map).bindPopup(`<b>🏥 ${S.hospital.name}</b>`);

  let sLat, sLng, stLabel;
  if (call?.station) { sLat = call.station.lat; sLng = call.station.lon; stLabel = call.station.name; }
  else { const a = Math.random() * Math.PI * 2; sLat = S.myLoc.lat + Math.cos(a) * 0.02; sLng = S.myLoc.lng + Math.sin(a) * 0.025; stLabel = 'Station'; }

  L.marker([sLat, sLng], { icon: L.divIcon({ html: `<div style="background:${svc.c};width:14px;height:14px;border-radius:3px;border:2px solid #fff;font-size:9px;text-align:center">${svc.i}</div>`, iconSize: [14, 14], iconAnchor: [7, 7] }) }).addTo(map).bindPopup(`<b>${svc.i} ${stLabel}</b>`);

  L.polyline([[sLat, sLng], [S.myLoc.lat, S.myLoc.lng]], { color: svc.c, weight: 2, dashArray: '6,8', opacity: 0.4 }).addTo(map);

  const rm = L.marker([sLat, sLng], { icon: L.divIcon({ html: `<div style="background:${svc.c};width:18px;height:18px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 12px ${svc.c}88;font-size:10px;text-align:center;line-height:14px">${svc.i}</div>`, iconSize: [18, 18], iconAnchor: [9, 9] }) }).addTo(map);

  const bounds = L.latLngBounds([[S.myLoc.lat, S.myLoc.lng], [sLat, sLng]]);
  if (S.hospital) bounds.extend([S.hospital.lat, S.hospital.lon]);
  map.fitBounds(bounds.pad(0.2));

  let step = 0;
  const totalSteps = 120;
  const anim = setInterval(() => {
    step++;
    const t = Math.min(step / totalSteps, 1);
    const ease = t < 0.5 ? 2 * t * t : (1 - Math.pow(-2 * t + 2, 2) / 2);
    rm.setLatLng([sLat + (S.myLoc.lat - sLat) * ease, sLng + (S.myLoc.lng - sLng) * ease]);
    if (step >= totalSteps) {
      clearInterval(anim);
      if (S.hospital) L.polyline([[S.myLoc.lat, S.myLoc.lng], [S.hospital.lat, S.hospital.lon]], { color: '#42a5f5', weight: 2, dashArray: '4,6', opacity: 0.6 }).addTo(map);
    }
  }, 290);
  S.maps[cid] = map;
}

export function rDisp() {
  const active = S.dispatchCalls.filter(c => c.status !== 'RESOLVED').length;
  document.getElementById('dBg').textContent = active > 0 ? `(${active})` : '';
  const el = document.getElementById('dL');
  if (!S.dispatchCalls.length) { el.innerHTML = '<div class="es2">Monitoring</div>'; return; }

  const stC = {
    'CONNECTING': 'background:#1a237e55;color:#7986cb',
    'ACTIVE': 'background:#e6510033;color:#ffab40',
    'DISPATCHED': 'background:#1b5e2044;color:#69f0ae',
    'ON SCENE': 'background:#00695c33;color:#4db6ac',
    'RESOLVED': 'background:#37474f33;color:#78909c'
  };
  const sM2 = {
    aegis: { l: 'AEGIS', c: 'aegis', b: 'ab2' },
    dispatch: { l: '911', c: 'ds', b: 'db' },
    officer: { l: 'OFFICER', c: 'officer', b: 'ob' },
    ems: { l: 'MEDIC', c: 'ems', b: 'eb2' },
    fire: { l: 'FIRE', c: 'fire', b: 'fb' },
    speaker: { l: 'SPEAKER', c: 'speaker', b: 'sb' },
    system: { l: 'SYS', c: 'sys', b: 'syb' }
  };

  el.innerHTML = S.dispatchCalls.map(call => {
    const st = stC[call.status] || stC.ACTIVE;
    const svc = SVC[call.svcType] || SVC.EMS;
    const msgs = call.msgs.map(m => {
      const i = sM2[m.s] || sM2.system;
      return `<div class="dm"><div class="mono sn ${i.c}">${i.l} <span style="font-weight:300;color:#2a3f55;font-size:8px">${fmtS(m.time)}</span></div><div class="bub ${i.b}">${m.t}</div>${m.ev ? `<div class="evi"><img src="${m.ev}"/><div class="mono evi-l">📸 ${fmtS(m.time)}</div></div>` : ''}</div>`;
    }).join('');
    return `<div class="dc"><div class="dch"><div><span class="mono" style="font-size:9px;padding:2px 8px;border-radius:2px;margin-right:6px;background:${svc.c}22;color:${svc.c}">${svc.i} ${svc.l}</span><span class="mono" style="font-size:11px;color:#ab47bc;font-weight:600">${call.id}</span></div><span class="mono" style="font-size:9px;padding:2px 8px;border-radius:2px;${st}">${call.status}</span></div><div class="dcc" id="chat-${call.id}">${msgs}</div><div class="dmap" id="${call.mapId}"></div></div>`;
  }).join('');

  requestAnimationFrame(() => {
    const ch = document.getElementById(`chat-${S.dispatchCalls[0]?.id}`);
    if (ch) ch.scrollTop = ch.scrollHeight;
    S.dispatchCalls.forEach(c => {
      if (S.maps[c.id]) { S.maps[c.id].remove(); delete S.maps[c.id]; if (['DISPATCHED', 'ON SCENE', 'RESOLVED'].includes(c.status)) setTimeout(() => initMap(c.id), 100); }
    });
  });
}
