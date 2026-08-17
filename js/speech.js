/**
 * Text-to-speech through the browser's built-in SpeechSynthesis.
 * No network, no API key — but voice availability differs per browser, so
 * every caller must cope with `available()` being false.
 */

const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
let voice = null;

const PREFERRED = [
  /^Samantha$/i,
  /^Alex$/i,
  /Google US English/i,
  /^Daniel$/i,
];

function pickVoice() {
  if (!synth) return;
  const voices = synth.getVoices().filter((v) => /^en(-|_)/i.test(v.lang));
  if (voices.length === 0) return;
  for (const pattern of PREFERRED) {
    const hit = voices.find((v) => pattern.test(v.name));
    if (hit) {
      voice = hit;
      return;
    }
  }
  voice = voices.find((v) => /^en(-|_)US/i.test(v.lang)) || voices[0];
}

if (synth) {
  pickVoice();
  synth.addEventListener?.('voiceschanged', pickVoice);
}

export function available() {
  return Boolean(synth);
}

export function speak(text, { rate = 0.9 } = {}) {
  if (!synth || !text) return;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  if (voice) utter.voice = voice;
  utter.lang = voice?.lang || 'en-US';
  utter.rate = rate;
  synth.speak(utter);
}

export function stop() {
  synth?.cancel();
}
