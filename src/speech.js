import { S } from './state.js';

// Callback for when finalized audio arrives — set by voiceCheck
let audioHandler = null;
export function setAudioHandler(fn) { audioHandler = fn; }

export function startSR() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    document.getElementById('aT').textContent = 'Not supported';
    return;
  }
  S.micDead = false;
  document.getElementById('micBtn').style.display = 'none';

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (S.recognition) try { S.recognition.abort(); } catch (e) { /* ignore */ }

  S.recognition = new SR();
  S.recognition.continuous = true;
  S.recognition.interimResults = true;
  S.recognition.lang = 'en-US';
  S.recognition.maxAlternatives = 3;

  S.recognition.onstart = () => {
    S.micPermissionGranted = true;
    S.micDead = false;
    document.getElementById('micBtn').style.display = 'none';
    document.getElementById('mI').textContent = '🎙';
    document.getElementById('aT').textContent = 'Listening...';
  };

  S.recognition.onresult = (e) => {
    let interim = '', final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) {
        let b = e.results[i][0].transcript;
        for (let a = 0; a < e.results[i].length; a++) {
          if (e.results[i][a].confidence > 0.1) b = e.results[i][a].transcript;
        }
        final += b;
      } else {
        interim += e.results[i][0].transcript;
      }
    }
    const d = document.getElementById('aT');
    if (interim) { d.textContent = interim; d.className = 'tr int mono'; }
    if (final) {
      const c = final.trim();
      // Ignore anything the mic picks up while speaker is active (TTS feedback)
      if (S.speakerActive || Date.now() < S.speakerMuteUntil) {
        d.textContent = `[speaker] ${c}`;
        d.className = 'tr mono';
        return;
      }
      S.audioBuffer.push(c);
      if (S.audioBuffer.length > 30) S.audioBuffer.shift();
      S.aiAudio = S.audioBuffer.slice(-15).join('. ');
      d.textContent = c;
      d.className = 'tr mono';
      if (audioHandler) audioHandler(c.toLowerCase());
    }
  };

  S.recognition.onerror = (e) => {
    // On localhost, 'not-allowed' means user denied — don't retry
    if (e.error === 'not-allowed') {
      S.micDead = true;
      document.getElementById('micBtn').style.display = 'inline-block';
      document.getElementById('aT').textContent = 'Mic denied';
      return;
    }
    // For 'aborted' or 'no-speech', just let onend handle reconnect
  };

  S.recognition.onend = () => {
    if (!S.stream) return;
    // On localhost, auto-reconnect is safe — permissions persist for the origin.
    // Use a 3s delay to avoid rapid restart loops.
    if (S.micPermissionGranted) {
      setTimeout(() => {
        if (!S.stream || S.micDead) return;
        try {
          const newRec = new SR();
          newRec.continuous = true;
          newRec.interimResults = true;
          newRec.lang = 'en-US';
          newRec.maxAlternatives = 3;
          newRec.onstart = S.recognition.onstart;
          newRec.onresult = S.recognition.onresult;
          newRec.onerror = S.recognition.onerror;
          newRec.onend = S.recognition.onend;
          S.recognition = newRec;
          newRec.start();
        } catch (e) {
          S.micDead = true;
          document.getElementById('micBtn').style.display = 'inline-block';
          document.getElementById('aT').textContent = 'Mic disconnected';
        }
      }, 3000);
    } else {
      S.micDead = true;
      document.getElementById('micBtn').style.display = 'inline-block';
      document.getElementById('aT').textContent = 'Mic disconnected';
    }
  };

  try {
    S.recognition.start();
  } catch (e) {
    document.getElementById('micBtn').style.display = 'inline-block';
    document.getElementById('aT').textContent = 'Mic error';
  }
}

export function stopSR() {
  if (S.recognition) try { S.recognition.abort(); } catch (e) { /* ignore */ }
  S.recognition = null;
  S.micDead = true;
  document.getElementById('mI').textContent = '🔇';
  document.getElementById('aT').textContent = 'Inactive';
  document.getElementById('micBtn').style.display = 'none';
}

export function speakTo(m) {
  if (!m) return;
  const o = document.getElementById('sO');
  document.getElementById('sT').textContent = m;
  o.style.display = 'block';
  const u = new SpeechSynthesisUtterance(m);
  u.rate = 0.9;
  u.volume = 1;
  const v = speechSynthesis.getVoices();
  const p = v.find(x => x.lang.startsWith('en')) || v[0];
  if (p) u.voice = p;

  // Mute mic processing while speaker is active to prevent TTS feedback loop
  S.speakerActive = true;
  u.onstart = () => { S.speakerActive = true; };
  u.onend = () => {
    S.speakerActive = false;
    // Keep muted for 1.5s after TTS ends to catch echo/reverb tail
    S.speakerMuteUntil = Date.now() + 1500;
    setTimeout(() => { o.style.display = 'none'; }, 2000);
  };
  u.onerror = () => {
    S.speakerActive = false;
    S.speakerMuteUntil = Date.now() + 1500;
  };

  speechSynthesis.speak(u);
}
