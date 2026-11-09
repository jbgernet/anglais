// Voix : lecture à voix haute (synthèse) et transcription du micro (reconnaissance vocale).
// Les deux sont fournies par le navigateur, gratuitement.

import { S } from './store.js';
import { button, icon, plainEx } from './util.js';

export const tts = { ok: typeof window !== 'undefined' && 'speechSynthesis' in window, voices: [] };

export function initVoices(onReady) {
  if (!tts.ok) return;
  const load = () => {
    tts.voices = speechSynthesis.getVoices().filter((v) => /^en[-_]/i.test(v.lang));
    if (onReady) onReady();
  };
  load();
  speechSynthesis.addEventListener('voiceschanged', load);
}

function pickVoice() {
  const want = S.settings.voice;
  return tts.voices.find((v) => v.voiceURI === want)
    || tts.voices.find((v) => /en[-_]GB/i.test(v.lang))
    || tts.voices[0] || null;
}

export function speak(text) {
  if (!tts.ok) return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(plainEx(text).replace(/…/g, ', '));
  const v = pickVoice();
  if (v) u.voice = v;
  u.lang = v ? v.lang : 'en-GB';
  u.rate = Number(S.settings.rate) || 0.95;
  speechSynthesis.speak(u);
  return true;
}

export function speakBtn(text, label = 'Écouter') {
  const b = button('', 'icon-btn speak');
  b.append(icon('speaker'));
  b.setAttribute('aria-label', label + ' : ' + plainEx(text));
  b.title = label;
  b.hidden = !tts.ok;
  b.addEventListener('click', (e) => { e.stopPropagation(); speak(text); });
  return b;
}

const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
export const canListen = !!SR;

// Transcription continue : redémarre seule après un silence, jusqu'à ce qu'on l'arrête.
export function createRecognizer({ onText, onState, onError }) {
  const r = new SR();
  r.lang = 'en-GB';
  r.continuous = true;
  r.interimResults = true;
  let finalText = '', wanted = false;
  r.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) finalText += res[0].transcript.trim() + ' ';
      else interim += res[0].transcript;
    }
    onText(finalText, interim);
  };
  r.onerror = (e) => {
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    wanted = false;
    if (onError) onError(e.error);
  };
  r.onend = () => {
    if (wanted) { try { r.start(); return; } catch (x) { wanted = false; } }
    if (onState) onState(false);
  };
  return {
    start(base = '') {
      finalText = base.trim() ? base.trim() + ' ' : '';
      wanted = true;
      try { r.start(); if (onState) onState(true); } catch (x) { /* déjà en cours */ }
    },
    stop() { wanted = false; try { r.stop(); } catch (x) { /* rien */ } },
    get on() { return wanted; },
  };
}
