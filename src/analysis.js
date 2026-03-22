import { S } from './state.js';
import { TM, CC2, P_LIGHT, P_FULL } from './config.js';
import { addEvt, rEsc, rEvt, sTab } from './ui.js';
import { fmt } from './utils.js';
import { compMot } from './motion.js';
import { capFrame } from './capture.js';
import { speakTo } from './speech.js';
import { initVC } from './voiceCheck.js';
import { triggerDisp } from './dispatch.js';

export async function doScan() {
  if (S.isAnalyzing || !S.stream) return;
  if (!S.apiKey) { document.getElementById('modal').style.display = 'flex'; return; }

  S.isAnalyzing = true;
  S.frameCount++;
  document.getElementById('cF').textContent = `SCANS: ${S.frameCount}`;
  document.getElementById('sL').style.display = 'block';
  const sb = document.getElementById('sB');
  if (sb) { sb.textContent = '⟳'; sb.disabled = true; }

  compMot();
  const m = S.motion;
  const maxE = Object.values(S.escalations).reduce((a, e) => Math.max(a, e.level || 0), 0);
  const elev = S.tier === 'elevated' || maxE >= 25;
  const eS = Object.keys(S.escalations).length ? JSON.stringify(S.escalations) : 'None';

  try {
    const b = capFrame();
    let pr;
    if (elev) {
      pr = P_FULL
        .replace('__A__', S.aiAudio || 'None')
        .replace('__H__', S.motionHistory.slice(-5).reverse().join(',') || '-')
        .replace('__M__', String(m))
        .replace('__N__', S.narrative || '-')
        .replace('__E__', eS)
        .replace('__V__', S.askState);
    } else {
      pr = P_LIGHT
        .replace('__A__', S.aiAudio || 'None')
        .replace('__M__', String(m))
        .replace('__E__', eS);
    }

    const r = await (await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': S.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: elev ? 1200 : 600, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b } }, { type: 'text', text: pr }] }] })
    })).json();

    if (r.error) throw new Error(r.error.message);
    procResult(JSON.parse((r.content || []).map(c => c.text || '').join('').replace(/```json|```/g, '').trim()));
  } catch (e) {
    console.error(e);
  } finally {
    S.isAnalyzing = false;
    document.getElementById('sL').style.display = 'none';
    if (sb) { sb.textContent = '⊙ SCAN'; sb.disabled = false; }
  }
}

function procResult(a) {
  S.lastAnalysis = a;
  const now = new Date();
  const tl = TM[a.threat_level] || TM.NORMAL;
  const was = S.tier;
  S.tier = (['MODERATE', 'HIGH', 'CRITICAL'].includes(a.threat_level)) ? 'elevated' : 'low';
  if (was !== S.tier && S.autoScan) setRate();

  document.getElementById('cT').textContent = fmt(now);
  const ct = document.getElementById('cTh');
  ct.textContent = `THREAT: ${a.threat_level}`;
  ct.style.color = tl.c;

  const pill = document.getElementById('tP');
  pill.style.display = 'block';
  pill.textContent = a.threat_level;
  pill.style.background = tl.bg;
  pill.style.borderColor = tl.c;
  pill.style.color = tl.c;
  pill.style.animation = tl.p ? 'pulse-ring 2s infinite' : 'none';

  const nb = document.getElementById('nB');
  if (S.tier === 'elevated' && a.narrative_update) {
    S.narrative = a.narrative_update;
    document.getElementById('nT').textContent = S.narrative;
    nb.style.display = 'block';
  } else if (S.tier === 'low') { nb.style.display = 'none'; S.narrative = ''; }

  document.getElementById('sP').textContent = a.people_count ?? '—';
  document.getElementById('sSc').textContent = (a.scene_type || '—').toUpperCase();
  document.getElementById('sCf').textContent = a.confidence ? Math.round(a.confidence * 100) + '%' : '—';

  const tags = a.tags || [];
  if (tags.length) {
    document.getElementById('tG').innerHTML = [...tags].sort((x, y) => (y.priority || 0) - (x.priority || 0)).map(t => {
      const c = CC2[t.category] || '#546e7a';
      return `<div class="mono tag" style="background:${c}15;border:1px solid ${c}55;color:${c}"><span class="p">P${t.priority || 0}</span>${t.label}<span class="p">${(t.category || '').toUpperCase()}</span></div>`;
    }).join('');
  }

  if (a.escalations?.length) {
    a.escalations.forEach(e => { S.escalations[e.id] = e; });
    Object.keys(S.escalations).forEach(k => { if (S.escalations[k].level <= 0) delete S.escalations[k]; });
    rEsc();
  }

  if (a.events?.length) {
    S.events = [...a.events.map((e, i) => ({ ...e, timestamp: now, id: `${Date.now()}-${i}` })), ...S.events].slice(0, 100);
    rEvt();
  }

  // ===== DECISION TREE =====
  const maxE = Object.values(S.escalations).reduce((a, e) => Math.max(a, e.level || 0), 0);
  const hazard = a.hazard_detected && a.hazard_detected !== 'none';

  if (hazard && !S.dispatchLock && S.askState !== 'dispatched') {
    addEvt(`⚠ HAZARD DETECTED: ${a.hazard_detected} — immediate dispatch`, 'emergency');
    speakTo(`Warning: ${a.hazard_detected} detected. Emergency services are being contacted immediately. Please evacuate if safe to do so.`);
    setTimeout(() => { if (!S.dispatchLock) triggerDisp(a, now); }, 3000);
    return;
  }

  if (S.askState === 'denied' || S.dispatchLock || S.askState === 'dispatched') return;
  if (S.askState.startsWith('attempt') || S.askState === 'confirming' || S.askState === 'confirm_listening') return;

  if (maxE >= 35 && maxE < 90 && S.askState === 'idle' && Date.now() > S.askCooldown) {
    const msg = a.should_voice_check && a.voice_check_message ? a.voice_check_message :
      "Hello, this is a safety system. I noticed you may need help. Say yes or raise your hand if you need assistance. Say no if you're okay.";
    initVC(msg);
  } else if (maxE >= 90 && (S.askState === 'cooldown' || S.voiceAttempt >= 2) && !S.dispatchLock) {
    triggerDisp(a, now);
  } else if (a.threat_level === 'CRITICAL' && S.voiceAttempt >= 1 && !S.dispatchLock) {
    triggerDisp(a, now);
  }
}

// Called from camera.js when scan rate changes
export function setRate() {
  clearInterval(S.scanTimer);
  const b = parseInt(document.getElementById('iSel')?.value || 4) * 1000;
  S.scanTimer = setInterval(doScan, S.tier === 'elevated' ? Math.min(b, 2000) : b);
}
