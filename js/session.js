/**
 * Session engine: chooses which sentences to drill, in which mode, and keeps
 * the running result. Mode selection and scheduling live here so the view
 * layer only has to render whatever `current` points at.
 */

import { scramble } from './modes/scramble.js';
import { blank } from './modes/blank.js';
import { typing, dictation } from './modes/typing.js';
import { flash } from './modes/flash.js';
import * as store from './store.js';
import * as speech from './speech.js';

export const MODES = [scramble, blank, typing, dictation, flash];

export const MIXED = {
  id: 'mixed',
  label: 'Mixed',
  blurb: 'Rotate through the drills as you go',
};

/** Rotation used by Mixed once a sentence has been seen at least once. */
const MIXED_ROTATION = ['scramble', 'blank', 'typing'];

/** First exposures lean on the gentler drills — you cannot type what you have never read. */
const NEW_ROTATION = ['scramble', 'scramble', 'blank'];

export function modeById(id) {
  return MODES.find((m) => m.id === id) || null;
}

export function availableModes() {
  return [MIXED, ...MODES.filter((m) => !m.needsSpeech || speech.available())];
}

/**
 * Order the deck for study: sentences that are due first (weakest first),
 * then unseen ones in book order, then whatever is left if the user asked
 * for more cards than are due.
 */
function selectSentences(deck, size) {
  const now = Date.now();
  const withCards = deck.sentences.map((s, index) => ({
    sentence: s,
    card: store.card(deck.id, s.id),
    index,
  }));

  const fresh = withCards.filter((e) => e.card.seen === 0);
  const due = withCards
    .filter((e) => e.card.seen > 0 && e.card.due <= now)
    .sort((a, b) => a.card.level - b.card.level || a.card.due - b.card.due);
  const rest = withCards
    .filter((e) => e.card.seen > 0 && e.card.due > now)
    .sort((a, b) => a.card.due - b.card.due);

  const queue = [...due, ...fresh, ...rest];
  return size > 0 ? queue.slice(0, size) : [...due, ...fresh];
}

export class Session {
  /**
   * @param deck   normalised deck
   * @param modeId a mode id, or 'mixed'
   * @param size   cards to study; 0 means "everything due"
   */
  constructor(deck, modeId, size) {
    this.deck = deck;
    this.modeId = modeId;
    this.settings = store.settings();
    this.queue = selectSentences(deck, size).map((entry, i) => ({
      sentence: entry.sentence,
      card: entry.card,
      mode: this.#modeFor(entry, i),
    }));
    this.at = 0;
    this.total = this.queue.length;
    this.answers = [];
    this.requeued = 0;
  }

  #modeFor(entry, i) {
    if (this.modeId !== 'mixed') return modeById(this.modeId) || scramble;
    const rotation = entry.card.seen === 0 ? NEW_ROTATION : MIXED_ROTATION;
    return modeById(rotation[i % rotation.length]) || scramble;
  }

  get current() {
    return this.queue[this.at] || null;
  }

  get done() {
    return this.at >= this.queue.length;
  }

  /** 1-based position, for "3 / 10" style counters. */
  get position() {
    return Math.min(this.at + 1, this.queue.length);
  }

  /**
   * Record the answer for the current card and advance. Missed cards come
   * back once at the end of the session when that setting is on.
   */
  submit(correct) {
    const item = this.current;
    if (!item) return;
    store.grade(this.deck.id, item.sentence.id, correct);
    this.answers.push({ sentence: item.sentence, mode: item.mode.id, correct });

    if (!correct && this.settings.requeueMissed && !item.isRetry && this.requeued < 20) {
      this.requeued += 1;
      this.queue.push({
        sentence: item.sentence,
        card: store.card(this.deck.id, item.sentence.id),
        mode: item.mode,
        isRetry: true,
      });
    }
    this.at += 1;
    if (this.done) store.finishSession();
  }

  /** First attempts only, so a retried card cannot inflate the score. */
  get score() {
    const seen = new Set();
    let correct = 0;
    let asked = 0;
    for (const a of this.answers) {
      if (seen.has(a.sentence.id)) continue;
      seen.add(a.sentence.id);
      asked += 1;
      if (a.correct) correct += 1;
    }
    return { correct, asked, percent: asked ? Math.round((correct / asked) * 100) : 0 };
  }

  get missed() {
    const first = new Map();
    for (const a of this.answers) {
      if (!first.has(a.sentence.id)) first.set(a.sentence.id, a);
    }
    return [...first.values()].filter((a) => !a.correct).map((a) => a.sentence);
  }
}
