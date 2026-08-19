/**
 * Pieces every mode shares: the prompt block, the speak button, the verdict
 * panel and the Next button.
 *
 * A mode is `{ id, label, blurb, selfGraded?, needsSpeech?, mount(host, ctx) }`.
 * `ctx` is `{ sentence, card, settings, finish(correct) }`, and `mount` may
 * return `{ onKeyDown(event) }` to take part in keyboard shortcuts.
 */

import { el } from '../dom.js';
import * as speech from '../speech.js';
import { diffWords } from '../text.js';

/** Task label + Korean prompt (or the English-only fallback hint) + note. */
export function promptBlock(sentence, settings, { label, hint }) {
  const showKo = settings.showKo && Boolean(sentence.ko);
  return el(
    'div',
    {},
    el('div', { class: 'task-label', text: label }),
    showKo
      ? el('p', { class: 'prompt-ko', text: sentence.ko })
      : el('p', { class: 'prompt-hint', text: hint }),
    showKo && hint ? el('p', { class: 'prompt-hint', text: hint }) : null,
    sentence.note ? el('p', { class: 'prompt-note', text: sentence.note }) : null
  );
}

/** A round "Listen" button, or null when the browser has no speech support. */
export function speakButton(text, settings, label = '▶ Listen') {
  if (!speech.available()) return null;
  return el('button', {
    type: 'button',
    class: 'speak-btn',
    text: label,
    onclick: () => speech.speak(text, { rate: settings.rate }),
  });
}

/**
 * Read the revealed sentence out and hold the advance buttons closed until it
 * finishes, so continuing cannot clip the pronunciation. When the setting is off
 * or the browser has no voice, nothing is disabled and focus lands immediately.
 *
 * `onDone` from speech.js is guaranteed to fire, including on error and cancel —
 * without that the buttons could stay disabled with no way out.
 */
export function revealAudio(sentence, settings, { buttons, speakingHint, continueHint }) {
  const focusFirst = () => buttons.find((b) => !b.disabled)?.focus({ preventScroll: true });

  if (!settings.speakOnReveal || !speech.available()) {
    focusFirst();
    return;
  }

  for (const b of buttons) b.disabled = true;
  if (speakingHint) speakingHint.hidden = false;
  if (continueHint) continueHint.hidden = true;

  speech.speak(sentence.en, {
    rate: settings.rate,
    onDone: () => {
      for (const b of buttons) b.disabled = false;
      if (speakingHint) speakingHint.hidden = true;
      if (continueHint) continueHint.hidden = false;
      // A disabled button cannot hold focus, so take it back for the Enter key.
      focusFirst();
    },
  });
}

/** Coloured banner with the verdict and the full correct sentence. */
export function verdictPanel(correct, sentence, settings) {
  return el(
    'div',
    { class: `verdict ${correct ? 'ok' : 'bad'}` },
    el('span', { text: correct ? '✓ Correct' : '✗ Not quite' }),
    el('span', { class: 'answer', text: sentence.en }),
    el('span', { class: 'spacer' }),
    speakButton(sentence.en, settings, '▶')
  );
}

/** Word-level diff of the learner's attempt against the target. */
export function diffView(expected, actual) {
  const box = el('div', { class: 'diff' });
  for (const token of diffWords(expected, actual)) {
    box.append(el('span', { class: token.type, text: token.text }), ' ');
  }
  return box;
}

/**
 * The button Enter should press when a card is already answered. Registering it
 * here — rather than relying on the focused button — keeps Enter working after
 * the learner has clicked somewhere else on the page.
 */
let continueButton = null;

export function pendingContinue() {
  return continueButton;
}

export function armContinue(button) {
  continueButton = button;
}

export function disarmContinue() {
  continueButton = null;
}

/**
 * Replace the action row with the verdict and a Next button, then hand the
 * result back to the session.
 */
export function settle(host, actionRow, { correct, sentence, settings, detail, finish }) {
  const next = el('button', {
    type: 'button',
    class: 'btn btn-primary',
    text: 'Next',
    onclick: () => {
      disarmContinue();
      finish(correct);
    },
  });
  armContinue(next);
  const continueHint = el(
    'span',
    { class: 'muted small' },
    el('span', { class: 'kbd', text: 'Enter' }),
    ' to continue'
  );
  const speakingHint = el('span', { class: 'speaking-hint', hidden: true, text: '🔊 playing…' });
  actionRow.replaceChildren(next, continueHint, speakingHint);

  const panel = el('div', { class: 'stack' }, verdictPanel(correct, sentence, settings));
  if (detail) panel.append(detail);
  actionRow.before(panel);

  revealAudio(sentence, settings, { buttons: [next], speakingHint, continueHint });
  return next;
}

/** "Show answer" — reveals the sentence and scores the card as missed. */
export function revealButton(onReveal) {
  return el('button', {
    type: 'button',
    class: 'btn btn-ghost muted',
    text: 'Show answer',
    onclick: onReveal,
  });
}
