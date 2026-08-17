/**
 * Local persistence: settings, per-sentence review state and lifetime stats.
 * Everything lives in one localStorage key so it is easy to inspect or clear.
 */

const KEY = 'english-sentence-game:v1';

/** Days until a card comes back, indexed by level. Level 0 = due now. */
const INTERVALS = [0, 1, 2, 4, 8, 16, 32];
export const MAX_LEVEL = INTERVALS.length - 1;

const DEFAULT_SETTINGS = {
  sessionSize: 10,
  showKo: true,
  speakOnReveal: true,
  requeueMissed: true,
  rate: 0.9,
  lastMode: 'mixed',
};

const DAY = 86400000;

function blank() {
  return {
    settings: { ...DEFAULT_SETTINGS },
    cards: {},
    stats: { answered: 0, correct: 0, sessions: 0, streak: 0, lastDay: null },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const parsed = JSON.parse(raw);
    return {
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
      cards: parsed.cards || {},
      stats: { ...blank().stats, ...(parsed.stats || {}) },
    };
  } catch {
    return blank();
  }
}

let state = load();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode / quota: the game still works, it just forgets. */
  }
}

/** Local calendar day as YYYY-MM-DD, for streak counting. */
function today() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/* ---------- settings ---------- */

export function settings() {
  return state.settings;
}

export function setSetting(key, value) {
  state.settings[key] = value;
  save();
}

/* ---------- review state ---------- */

const EMPTY_CARD = { level: 0, due: 0, seen: 0, correct: 0, wrong: 0 };

export function card(deckId, sentenceId) {
  return state.cards[`${deckId}/${sentenceId}`] || { ...EMPTY_CARD };
}

export function isDue(c, now = Date.now()) {
  return c.seen === 0 || c.due <= now;
}

/**
 * Record an answer. Correct answers step the level up, wrong ones drop it
 * back two boxes so the sentence returns soon.
 */
export function grade(deckId, sentenceId, correct) {
  const id = `${deckId}/${sentenceId}`;
  const c = { ...card(deckId, sentenceId) };
  c.seen += 1;
  if (correct) {
    c.correct += 1;
    c.level = Math.min(MAX_LEVEL, c.level + 1);
  } else {
    c.wrong += 1;
    c.level = Math.max(0, c.level - 2);
  }
  c.due = Date.now() + INTERVALS[c.level] * DAY;
  state.cards[id] = c;

  state.stats.answered += 1;
  if (correct) state.stats.correct += 1;
  save();
  return c;
}

export function finishSession() {
  const day = today();
  const s = state.stats;
  s.sessions += 1;
  if (s.lastDay !== day) {
    const yesterday = new Date(Date.now() - DAY);
    const m = String(yesterday.getMonth() + 1).padStart(2, '0');
    const d = String(yesterday.getDate()).padStart(2, '0');
    const yKey = `${yesterday.getFullYear()}-${m}-${d}`;
    s.streak = s.lastDay === yKey ? s.streak + 1 : 1;
    s.lastDay = day;
  }
  save();
}

export function stats() {
  return state.stats;
}

/** Aggregate progress for one deck. */
export function deckProgress(deckId, sentences) {
  const now = Date.now();
  let learning = 0;
  let mastered = 0;
  let due = 0;
  let fresh = 0;
  for (const s of sentences) {
    const c = card(deckId, s.id);
    if (c.seen === 0) fresh += 1;
    else if (c.level >= MAX_LEVEL) mastered += 1;
    else learning += 1;
    if (isDue(c, now)) due += 1;
  }
  const total = sentences.length;
  const strength = total
    ? sentences.reduce((sum, s) => sum + card(deckId, s.id).level, 0) / (total * MAX_LEVEL)
    : 0;
  return { total, fresh, learning, mastered, due, strength };
}

export function resetAll() {
  state = blank();
  save();
}
