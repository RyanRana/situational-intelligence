import { S } from './state.js';

export function compMot() {
  const vid = document.getElementById('vid'), c = document.getElementById('cap');
  const w = 160, h = 120;
  c.width = w; c.height = h;
  c.getContext('2d', { willReadFrequently: true }).drawImage(vid, 0, 0, w, h);
  const d = c.getContext('2d').getImageData(0, 0, w, h).data;
  if (!S.prevFrameData) { S.prevFrameData = new Uint8ClampedArray(d); return 0; }
  let diff = 0;
  const t = w * h;
  for (let i = 0; i < d.length; i += 4) {
    if ((Math.abs(d[i] - S.prevFrameData[i]) + Math.abs(d[i + 1] - S.prevFrameData[i + 1]) + Math.abs(d[i + 2] - S.prevFrameData[i + 2])) / 3 > 12) diff++;
  }
  S.prevFrameData = new Uint8ClampedArray(d);
  const p = Math.round(diff / t * 100);
  S.motion = p;
  S.motionHistory.push(p);
  if (S.motionHistory.length > 15) S.motionHistory.shift();
  const bar = document.getElementById('mF'), lbl = document.getElementById('mP');
  if (bar) { bar.style.width = Math.min(p * 2, 100) + '%'; bar.style.background = p < 5 ? '#ff1744' : p < 15 ? '#ffd600' : '#00e676'; }
  if (lbl) lbl.textContent = p + '%';
  document.getElementById('sM').textContent = p + '%';
  return p;
}

export function startMot() {
  S.motionInterval = setInterval(compMot, 400);
  document.getElementById('mB').style.display = 'block';
}

export function stopMot() {
  clearInterval(S.motionInterval);
  document.getElementById('mB').style.display = 'none';
  S.prevFrameData = null;
  S.motionHistory = [];
}
