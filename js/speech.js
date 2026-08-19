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

/** Last-resort ceiling, for browsers where neither `onend` nor `speaking` behaves. */
function timeoutFor(text, rate) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(20000, 2000 + (words / Math.max(0.5, rate)) * 700);
}

/**
 * Speak `text`. `onDone` runs exactly once when the utterance finishes, errors,
 * or is cancelled — callers gate UI on it, so it must never be dropped.
 *
 * `onend` alone is not enough: several browsers skip it for long utterances or
 * when the tab is backgrounded. So the end is detected three ways, whichever
 * lands first, and `onDone` is latched to a single call.
 */
export function speak(text, { rate = 0.9, onDone } = {}) {
  if (!synth || !text) {
    onDone?.();
    return;
  }
  synth.cancel();

  const utter = new SpeechSynthesisUtterance(text);
  if (voice) utter.voice = voice;
  utter.lang = voice?.lang || 'en-US';
  utter.rate = rate;

  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    clearInterval(poll);
    clearTimeout(cap);
    onDone?.();
  };

  utter.onend = finish;
  utter.onerror = finish;

  // 2nd tier: watch the `speaking` flag, which keeps working when `onend` does not.
  const startedAt = Date.now();
  let began = false;
  const poll = setInterval(() => {
    if (synth.speaking) {
      began = true;
      return;
    }
    if (began) finish();
    // Never started: either it was dropped outright, or nothing is queued.
    else if (Date.now() - startedAt > 1500 && !synth.pending) finish();
  }, 150);

  // 3rd tier: hard ceiling, so a wedged utterance cannot lock the UI.
  const cap = setTimeout(finish, timeoutFor(text, rate));

  synth.speak(utter);
}

export function stop() {
  synth?.cancel();
}
