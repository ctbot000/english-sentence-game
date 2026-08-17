/**
 * Sentence text utilities: tokenising, lenient comparison and word-level diff.
 *
 * Comparison is deliberately forgiving — the point of the game is recalling the
 * words and their order, not reproducing curly quotes and commas exactly.
 */

/** Split a sentence into display tokens, keeping punctuation attached. */
export function words(sentence) {
  return String(sentence).trim().split(/\s+/).filter(Boolean);
}

/** Fold a string down to its comparable core. */
export function normalize(s) {
  return String(s)
    .toLowerCase()
    .replace(/[‘’ʼʹ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[-‑/]/g, ' ')
    .replace(/[^a-z0-9'\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when two sentences match apart from case, punctuation and spacing. */
export function sameSentence(a, b) {
  return normalize(a) === normalize(b) && normalize(a) !== '';
}

/** First letter of each word, e.g. "I am here." -> "I·· a·· h···" */
export function letterHint(sentence) {
  return words(sentence)
    .map((w) => {
      const letters = w.replace(/[^A-Za-z0-9']/g, '');
      if (!letters) return w;
      return letters[0] + '·'.repeat(Math.max(0, letters.length - 1));
    })
    .join(' ');
}

/** Fisher-Yates, on a copy. */
export function shuffle(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Shuffle, retrying a few times so the result is not the original order. */
export function scrambleOrder(list) {
  if (list.length < 3) return list.slice().reverse();
  for (let attempt = 0; attempt < 8; attempt++) {
    const out = shuffle(list);
    if (out.some((item, i) => item !== list[i])) return out;
  }
  return list.slice().reverse();
}

/**
 * Word-level diff of what the learner wrote against the expected sentence.
 * Returns tokens of { type: 'same' | 'missing' | 'extra', text }, where
 * `missing` is an expected word that was absent and `extra` a word that
 * should not be there.
 */
export function diffWords(expected, actual) {
  const exp = words(expected);
  const act = words(actual);
  const en = exp.map(normalize);
  const an = act.map(normalize);

  // Longest common subsequence table over the normalised words.
  const lcs = Array.from({ length: en.length + 1 }, () => new Array(an.length + 1).fill(0));
  for (let i = en.length - 1; i >= 0; i--) {
    for (let j = an.length - 1; j >= 0; j--) {
      lcs[i][j] = en[i] === an[j]
        ? lcs[i + 1][j + 1] + 1
        : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const out = [];
  let i = 0;
  let j = 0;
  while (i < en.length && j < an.length) {
    if (en[i] === an[j]) {
      out.push({ type: 'same', text: exp[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ type: 'missing', text: exp[i] });
      i++;
    } else {
      out.push({ type: 'extra', text: act[j] });
      j++;
    }
  }
  while (i < en.length) out.push({ type: 'missing', text: exp[i++] });
  while (j < an.length) out.push({ type: 'extra', text: act[j++] });
  return out;
}

/** Pick `count` indices to blank out, biased toward longer (content) words. */
export function pickBlankIndices(tokens, count) {
  const n = tokens.length;
  const wanted = Math.max(1, Math.min(count, n));
  const scored = tokens.map((w, i) => {
    const len = normalize(w).length;
    return { i, weight: Math.max(1, len) + Math.random() * 3 };
  });
  scored.sort((a, b) => b.weight - a.weight);
  return scored.slice(0, wanted).map((s) => s.i).sort((a, b) => a - b);
}
