import { S } from './state.js';
import { sTab } from './ui.js';
import { startCam } from './camera.js';
import { startSR } from './speech.js';
import { fmt } from './utils.js';

// Clock
setInterval(() => {
  const e = document.getElementById('clock');
  if (e) e.textContent = fmt(new Date());
}, 1000);

// API key modal
document.getElementById('activateBtn').addEventListener('click', () => {
  S.apiKey = document.getElementById('keyInput').value.trim();
  if (S.apiKey) document.getElementById('modal').style.display = 'none';
});

// Initialize feed button
document.getElementById('initBtn').addEventListener('click', startCam);
document.getElementById('connectBtn').addEventListener('click', startCam);

// Tabs
document.getElementById('tab-live').addEventListener('click', () => sTab('live'));
document.getElementById('tab-events').addEventListener('click', () => sTab('events'));
document.getElementById('tab-dispatch').addEventListener('click', () => sTab('dispatch'));

// Mic reconnect
document.getElementById('micBtn').addEventListener('click', startSR);

// Preload voices
speechSynthesis.getVoices();
window.speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
