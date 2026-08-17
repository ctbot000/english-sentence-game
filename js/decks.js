/**
 * Deck loading. `data/decks.json` lists the deck files; each deck file holds
 * the sentences. See README.md for the exact shape.
 */

export class DeckLoadError extends Error {
  constructor(message, { fileProtocol = false } = {}) {
    super(message);
    this.fileProtocol = fileProtocol;
  }
}

async function getJSON(path) {
  let res;
  try {
    res = await fetch(path, { cache: 'no-store' });
  } catch (err) {
    if (location.protocol === 'file:') {
      throw new DeckLoadError('Deck files cannot be read from file:// URLs.', {
        fileProtocol: true,
      });
    }
    throw new DeckLoadError(`Could not fetch ${path}: ${err.message}`);
  }
  if (!res.ok) {
    // Some browsers surface a blocked file:// read as a bogus response rather than a throw.
    if (location.protocol === 'file:') {
      throw new DeckLoadError('Deck files cannot be read from file:// URLs.', { fileProtocol: true });
    }
    throw new DeckLoadError(`${path} returned HTTP ${res.status}.`);
  }
  try {
    return await res.json();
  } catch (err) {
    throw new DeckLoadError(`${path} is not valid JSON: ${err.message}`);
  }
}

/** Normalise a deck file, filling in ids and dropping unusable entries. */
function normalizeDeck(raw, file) {
  const id = raw.id || file.replace(/\.json$/, '');
  const sentences = (raw.sentences || [])
    .map((s, i) => {
      const en = typeof s === 'string' ? s : s.en;
      if (!en || !String(en).trim()) return null;
      const base = typeof s === 'string' ? {} : s;
      return {
        id: base.id || `${id}-${String(i + 1).padStart(3, '0')}`,
        en: String(en).trim(),
        ko: base.ko ? String(base.ko).trim() : '',
        note: base.note ? String(base.note).trim() : '',
        page: base.page ?? null,
        tags: Array.isArray(base.tags) ? base.tags : [],
      };
    })
    .filter(Boolean);

  return {
    id,
    file,
    title: raw.title || id,
    source: raw.source || '',
    description: raw.description || '',
    sentences,
  };
}

/** Load every deck listed in the manifest. Bad deck files are skipped. */
export async function loadDecks() {
  const manifest = await getJSON('data/decks.json');
  const entries = (manifest.decks || []).filter((d) => d && d.file);
  const problems = [];

  const decks = [];
  for (const entry of entries) {
    try {
      const raw = await getJSON(`data/${entry.file}`);
      const deck = normalizeDeck({ ...raw, id: raw.id || entry.id }, entry.file);
      if (deck.sentences.length === 0) {
        problems.push(`${entry.file} has no usable sentences.`);
        continue;
      }
      decks.push(deck);
    } catch (err) {
      if (err.fileProtocol) throw err;
      problems.push(err.message);
    }
  }
  return { decks, problems };
}
