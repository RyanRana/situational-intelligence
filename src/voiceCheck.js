import { S } from './state.js';
import { P_GESTURE } from './config.js';
import { showAsk, addEvt, rEsc } from './ui.js';
import { speakTo, setAudioHandler } from './speech.js';
import { capGestureFrame } from './capture.js';
import { triggerDisp } from './dispatch.js';

// ===== AUDIO CHECK =====
function chkAudio(t) {
  // Handle confirmation phase
  if (S.askState === 'confirm_listening') {
    const no = ['no', 'cancel', 'stop', "don't", 'never mind', 'nevermind', 'false alarm'];
    const yes = ['yes', 'confirm', 'help', 'please', 'do it', 'send help'];
    if (no.some(w => t.includes(w))) {
      S.askState = 'denied';
      showAsk('✓ Cancelled by person. Standing down.', '#69f0ae');
      addEvt('Person cancelled dispatch during confirmation', 'info');
      Object.keys(S.escalations).forEach(k => { S.escalations[k].level = Math.max(0, S.escalations[k].level - 40); if (S.escalations[k].level <= 0) delete S.escalations[k]; });
      rEsc();
      S.askCooldown = Date.now() + 120000;
      setTimeout(() => { S.askState = 'idle'; showAsk(); }, 5000);
      return;
    }
    if (yes.some(w => t.includes(w))) {
      S.askState = 'dispatched';
      showAsk('✓ Confirmed. Dispatching.', '#ff1744');
      addEvt('Person confirmed need for help during confirmation', 'emergency');
      if (S.lastAnalysis && !S.dispatchLock) triggerDisp(S.lastAnalysis, new Date());
      S.askCooldown = Date.now() + 180000;
      return;
    }
  }

  // Normal voice check listening
  if (!isListen() || S.gestureResolved) return;
  const yes = ['yes', 'yeah', 'help', 'please', 'need help', 'help me', 'ambulance', 'emergency', 'somebody', 'uh huh', 'mm hmm', 'mhm'];
  const no = ['no', 'nope', "i'm fine", "i'm okay", "i'm good", 'im fine', 'im okay', 'go away', 'leave me alone', 'stop', 'fine', 'all good', "don't need"];
  if (yes.some(w => t.includes(w))) resolveVC('yes', 'audio', t);
  else if (no.some(w => t.includes(w))) resolveVC('no', 'audio', t);
}

// Register audio handler with speech module
setAudioHandler(chkAudio);

function isListen() {
  return S.askState === 'attempt1_listening' || S.askState === 'attempt2_listening';
}

// ===== RESOLVE =====
function resolveVC(ans, method, detail) {
  if (S.gestureResolved) return;
  S.gestureResolved = true;
  stopGest();

  if (ans === 'yes') {
    S.askState = 'confirming';
    showAsk(`Detected: ${method} — "${detail}". Confirming...`, '#ffd600');
    addEvt(`Response detected (${method}: ${detail}). Confirming before dispatch.`, 'alert');
    speakTo('I detected your response. Confirming: do you need emergency assistance? Help will be dispatched to your location. Say yes to confirm or no to cancel.');
    setTimeout(() => {
      if (S.askState !== 'confirming') return;
      S.askState = 'confirm_listening';
      S.listenUntil = Date.now() + 12000;
      S.gestureResolved = false;
      showAsk('Waiting for final confirmation (12s)...', '#ffd600');
      setTimeout(() => {
        if (S.askState !== 'confirm_listening') return;
        S.askState = 'dispatched';
        showAsk('No denial — proceeding with dispatch.', '#ff1744');
        addEvt('Person did not deny help after confirmation — dispatching', 'emergency');
        if (S.lastAnalysis && !S.dispatchLock) triggerDisp(S.lastAnalysis, new Date());
        S.askCooldown = Date.now() + 180000;
      }, 12000);
    }, 6000);
  } else if (ans === 'no') {
    S.askState = 'denied';
    showAsk(`✓ Declined (${method}). Standing down.`, '#69f0ae');
    addEvt(`Person declined via ${method} — de-escalating`, 'info');
    Object.keys(S.escalations).forEach(k => { S.escalations[k].level = Math.max(0, S.escalations[k].level - 50); if (S.escalations[k].level <= 0) delete S.escalations[k]; });
    rEsc();
    S.askCooldown = Date.now() + 120000;
    setTimeout(() => { S.askState = 'idle'; showAsk(); }, 5000);
  } else if (ans === 'ambiguous') {
    S.gestureResolved = false;
    addEvt(`Ambiguous gesture: ${detail}`, 'warning');
    showAsk(`Gesture: ${detail} — still listening...`, '#ffd600');
  }
}

// ===== VOICE CHECK FLOW =====
export function initVC(msg) {
  if (S.askState !== 'idle' || Date.now() < S.askCooldown || S.dispatchLock) return;
  S.voiceAttempt = 1;
  S.gestureResolved = false;
  S.baseMotion = S.motionHistory.length ? Math.round(S.motionHistory.slice(-5).reduce((a, b) => a + b, 0) / Math.min(S.motionHistory.length, 5)) : 0;
  doVA(msg);
}

function doVA(msg) {
  const ph = S.voiceAttempt === 1 ? 'attempt1' : 'attempt2';
  S.askState = ph + '_speaking';
  S.gestureResolved = false;
  showAsk(`Speaking (#${S.voiceAttempt}/2)...`, '#ce93d8');
  speakTo(msg);
  addEvt(`Voice check #${S.voiceAttempt}: "${msg}"`, 'info');

  setTimeout(() => {
    if (!S.askState.startsWith(ph)) return;
    S.askState = ph + '_listening';
    S.listenUntil = Date.now() + 15000;
    showAsk(`Listening for voice/gesture (#${S.voiceAttempt}/2, 15s)...`, '#ffd600');
    document.getElementById('gI').style.display = 'block';
    startGest();
    startMotWatch();

    setTimeout(() => {
      if (!isListen() || S.gestureResolved) return;
      stopGest();
      if (S.voiceAttempt === 1) {
        S.voiceAttempt = 2;
        showAsk('No response. Trying again...', '#ff6d00');
        setTimeout(() => doVA("Hello? Please raise your hand, wave, or say something. I need to know if you're okay."), 2000);
      } else {
        S.askState = 'cooldown';
        showAsk('Unresponsive after 2 attempts. Dispatching.', '#ff1744');
        addEvt('Unresponsive to 2 checks — dispatching', 'emergency');
        if (S.lastAnalysis && !S.dispatchLock) triggerDisp(S.lastAnalysis, new Date());
        S.askState = 'dispatched';
        S.askCooldown = Date.now() + 180000;
      }
    }, 15000);
  }, 5500);
}

// ===== GESTURE DETECTION =====
function startGest() {
  stopGest();
  S.gestureInterval = setInterval(() => { if (!isListen() || S.gestureResolved) return; runGest(); }, 3000);
  setTimeout(() => { if (isListen() && !S.gestureResolved) runGest(); }, 1000);
}

export function stopGest() {
  clearInterval(S.gestureInterval);
  clearInterval(S.motionWatchInterval);
  S.gestureInterval = null;
  document.getElementById('gI').style.display = 'none';
}

async function runGest() {
  if (!S.stream || !S.apiKey || S.gestureResolved) return;
  const b = capGestureFrame();
  const d = S.motion - S.baseMotion;
  const pr = P_GESTURE
    .replace('__M__', String(S.motion))
    .replace('__B__', String(S.baseMotion))
    .replace('__D__', String(d));
  try {
    const r = await (await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': S.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 250, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b } }, { type: 'text', text: pr }] }] })
    })).json();
    if (r.error) return;
    const g = JSON.parse((r.content || []).map(c => c.text || '').join('').replace(/```json|```/g, '').trim());
    if (g.gesture_detected) {
      addEvt(`Gesture: ${g.gesture_type} — "${g.description}" (${Math.round(g.confidence * 100)}%)`, 'warning');
      if (g.means_yes && g.confidence >= 0.5) resolveVC('yes', 'gesture', g.description);
      else if (g.means_no && g.confidence >= 0.5) resolveVC('no', 'gesture', g.description);
      else if (g.confidence >= 0.4) resolveVC('ambiguous', 'gesture', g.description);
    }
  } catch (e) { /* ignore */ }
}

function startMotWatch() {
  clearInterval(S.motionWatchInterval);
  S.motionWatchInterval = setInterval(() => {
    if (!isListen() || S.gestureResolved) { clearInterval(S.motionWatchInterval); return; }
    if (S.baseMotion < 3 && S.motion >= 8) addEvt(`Motion spike: ${S.baseMotion}%→${S.motion}%`, 'warning');
  }, 1000);
}
