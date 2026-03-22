import { S } from './state.js';
import { startMot, stopMot } from './motion.js';
import { acquireLoc } from './location.js';
import { startSR, stopSR } from './speech.js';
import { stopGest } from './voiceCheck.js';
import { doScan, setRate } from './analysis.js';

export async function startCam() {
  try {
    S.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' },
      audio: true
    });
    document.getElementById('vid').srcObject = new MediaStream(S.stream.getVideoTracks());
    document.getElementById('vid').style.display = 'block';
    document.getElementById('ph').style.display = 'none';
    document.getElementById('vH').style.display = 'flex';
    document.getElementById('dot').className = 'dot on';
    rCtrl(true);
    startMot();
    startSR();
    acquireLoc();
  } catch (e) {
    alert('Denied: ' + e.message);
  }
}

export function stopCam() {
  if (S.stream) { S.stream.getTracks().forEach(t => t.stop()); S.stream = null; }
  S.autoScan = false;
  clearInterval(S.scanTimer);
  stopMot();
  stopSR();
  stopGest();
  document.getElementById('vid').style.display = 'none';
  document.getElementById('ph').style.display = 'flex';
  document.getElementById('vH').style.display = 'none';
  document.getElementById('sL').style.display = 'none';
  document.getElementById('tP').style.display = 'none';
  document.getElementById('dot').className = 'dot';
  rCtrl(false);
}

function rCtrl(on) {
  const ct = document.getElementById('ct');
  if (on) {
    ct.innerHTML = `<button class="mono btn bp" id="sB">⊙ SCAN</button><button class="mono btn bg" id="aBtn">▶ AUTO</button><select class="mono sel" id="iSel"><option value="2">2s</option><option value="4" selected>4s</option><option value="6">6s</option></select><button class="mono btn bd" id="stopBtn" style="margin-left:auto">⏻ STOP</button>`;
    document.getElementById('sB').addEventListener('click', doScan);
    document.getElementById('aBtn').addEventListener('click', togAuto);
    document.getElementById('iSel').addEventListener('change', () => { if (S.autoScan) setRate(); });
    document.getElementById('stopBtn').addEventListener('click', stopCam);
  } else {
    ct.innerHTML = `<button class="mono btn bg" style="flex:1" id="connectBtn2">⏻ CONNECT</button>`;
    document.getElementById('connectBtn2').addEventListener('click', startCam);
  }
}

function togAuto() {
  S.autoScan = !S.autoScan;
  const b = document.getElementById('aBtn');
  if (S.autoScan) {
    b.textContent = '■ STOP';
    b.className = 'mono btn bs';
    setRate();
  } else {
    b.textContent = '▶ AUTO';
    b.className = 'mono btn bg';
    clearInterval(S.scanTimer);
  }
}
