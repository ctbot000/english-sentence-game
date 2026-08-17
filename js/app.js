/** App shell: routing, views and the wiring between store, session and modes. */

import { el, clear } from './dom.js';
import { loadDecks } from './decks.js';
import * as store from './store.js';
import * as speech from './speech.js';
import { Session, availableModes } from './session.js';
import { pendingContinue, disarmContinue } from './modes/common.js';

const view = document.getElementById('view');
const streakBadge = document.getElementById('streak');

let decks = [];
let problems = [];
let session = null;
let modeHandle = null;

/* ---------- helpers ---------- */

const deckById = (id) => decks.find((d) => d.id === id) || null;

function go(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

function pct(n) {
  return `${Math.round(n * 100)}%`;
}

function render(...nodes) {
  clear(view);
  view.append(...nodes.flat().filter(Boolean));
  window.scrollTo({ top: 0 });
}

function bar(fraction, thin = false) {
  return el('div', { class: `bar${thin ? ' thin' : ''}` }, el('i', { style: `width:${pct(fraction)}` }));
}

function levelPill(card) {
  if (card.seen === 0) return el('span', { class: 'pill new', text: 'new' });
  if (card.level >= store.MAX_LEVEL) return el('span', { class: 'pill', text: 'mastered' });
  return el('span', { class: 'pill', text: `Lv ${card.level}/${store.MAX_LEVEL}` });
}

function refreshStreak() {
  const s = store.stats();
  streakBadge.hidden = s.streak < 1;
  streakBadge.textContent = `🔥 ${s.streak}-day streak`;
}

/* ---------- home ---------- */

function viewHome() {
  const rows = decks.map((deck) => ({ deck, p: store.deckProgress(deck.id, deck.sentences) }));
  const totals = rows.reduce(
    (acc, { p }) => ({
      total: acc.total + p.total,
      mastered: acc.mastered + p.mastered,
      due: acc.due + p.due,
    }),
    { total: 0, mastered: 0, due: 0 }
  );
  const st = store.stats();

  render(
    el(
      'div',
      { class: 'page-head' },
      el('h1', { text: 'Your decks' }),
      el('p', { text: 'Pick a deck and drill the sentences until they stick.' })
    ),
    el(
      'div',
      { class: 'stats' },
      el('div', { class: 'stat' }, el('b', { text: totals.total }), el('span', { text: 'sentences' })),
      el('div', { class: 'stat' }, el('b', { text: totals.due }), el('span', { text: 'due now' })),
      el('div', { class: 'stat' }, el('b', { text: totals.mastered }), el('span', { text: 'mastered' })),
      el(
        'div',
        { class: 'stat' },
        el('b', { text: st.answered ? pct(st.correct / st.answered) : '–' }),
        el('span', { text: 'lifetime accuracy' })
      )
    ),
    problems.length
      ? el(
          'div',
          { class: 'card notice', style: 'margin-bottom:16px' },
          el('h2', { text: 'Some deck files were skipped' }),
          el('ul', { class: 'small muted' }, ...problems.map((p) => el('li', { text: p })))
        )
      : null,
    rows.length === 0
      ? el(
          'div',
          { class: 'card' },
          el('p', { class: 'muted', text: 'No decks yet. Add a deck file under data/ and list it in data/decks.json.' })
        )
      : el(
          'div',
          { class: 'deck-grid' },
          ...rows.map(({ deck, p }) =>
            el(
              'button',
              { class: 'deck-card', type: 'button', onclick: () => go(`#/deck/${deck.id}`) },
              el('div', { class: 'row' }, el('h3', { text: deck.title }), el('span', { class: 'spacer' }),
                p.due > 0 ? el('span', { class: 'pill due', text: `${p.due} due` }) : null),
              el('div', {
                class: 'deck-meta',
                text: [
                  `${p.total} sentences`,
                  deck.source || null,
                  p.mastered ? `${p.mastered} mastered` : null,
                ]
                  .filter(Boolean)
                  .join(' · '),
              }),
              bar(p.strength)
            )
          )
        )
  );
}

/* ---------- deck ---------- */

function viewDeck(deck) {
  const p = store.deckProgress(deck.id, deck.sentences);
  const settings = store.settings();
  const modes = availableModes();
  const notice = el('p', { class: 'muted small', hidden: true });

  const choices = modes.map((mode) => {
    const input = el('input', {
      type: 'radio',
      name: 'mode',
      value: mode.id,
      checked: settings.lastMode === mode.id,
      onchange: () => {
        store.setSetting('lastMode', mode.id);
        paintChoices();
      },
    });
    return {
      input,
      label: el('label', { class: 'mode-opt' }, input, el('b', { text: mode.label }), el('span', { text: mode.blurb })),
    };
  });

  function paintChoices() {
    for (const { input, label } of choices) label.classList.toggle('selected', input.checked);
  }

  // The stored mode may be unavailable (e.g. no speech voices): fall back to the first.
  if (!choices.some((c) => c.input.checked) && choices.length) {
    choices[0].input.checked = true;
    store.setSetting('lastMode', choices[0].input.value);
  }
  paintChoices();

  const modeGrid = el('div', { class: 'mode-grid' }, ...choices.map((c) => c.label));

  const sizeSelect = el(
    'select',
    { onchange: (e) => store.setSetting('sessionSize', Number(e.target.value)) },
    ...[5, 10, 20, 0].map((n) =>
      el('option', { value: n, selected: settings.sessionSize === n, text: n === 0 ? 'All due' : `${n} cards` })
    )
  );

  function start() {
    session = new Session(deck, store.settings().lastMode, store.settings().sessionSize);
    if (session.total === 0) {
      session = null;
      notice.textContent =
        'Nothing is due right now. Choose a fixed session size to review ahead of schedule.';
      notice.hidden = false;
      return;
    }
    go(`#/deck/${deck.id}/play`);
  }

  render(
    el(
      'div',
      { class: 'page-head' },
      el('p', {}, el('a', { href: '#/', class: 'muted small', text: '← All decks' })),
      el('h1', { text: deck.title }),
      el('p', {
        text: [deck.source, deck.description].filter(Boolean).join(' — ') || `${p.total} sentences`,
      })
    ),
    el(
      'div',
      { class: 'card stack' },
      el(
        'div',
        { class: 'row small muted' },
        el('span', { text: `${p.total} sentences` }),
        el('span', { text: '·' }),
        el('span', { text: `${p.fresh} new` }),
        el('span', { text: '·' }),
        el('span', { text: `${p.learning} learning` }),
        el('span', { text: '·' }),
        el('span', { text: `${p.mastered} mastered` }),
        el('span', { class: 'spacer' }),
        el('span', { text: `${pct(p.strength)} strength` })
      ),
      bar(p.strength, true),
      el('div', {}, el('div', { class: 'task-label', text: 'Drill' }), modeGrid),
      el(
        'div',
        { class: 'row' },
        el('span', { class: 'small muted', text: 'Session length' }),
        sizeSelect,
        el('span', { class: 'spacer' }),
        el('button', { type: 'button', class: 'btn btn-ghost', text: 'Browse sentences', onclick: () => go(`#/deck/${deck.id}/browse`) }),
        el('button', { type: 'button', class: 'btn btn-primary', text: 'Start ▶', onclick: start })
      ),
      notice
    )
  );
}

/* ---------- browse ---------- */

function viewBrowse(deck) {
  const settings = store.settings();
  render(
    el(
      'div',
      { class: 'page-head' },
      el('p', {}, el('a', { href: `#/deck/${deck.id}`, class: 'muted small', text: `← ${deck.title}` })),
      el('h1', { text: 'All sentences' }),
      el('p', { text: `${deck.sentences.length} sentences in this deck` })
    ),
    el(
      'div',
      { class: 'card' },
      el(
        'ul',
        { class: 'browse-list' },
        ...deck.sentences.map((s, i) =>
          el(
            'li',
            {},
            el('span', { class: 'idx', text: String(i + 1).padStart(2, '0') }),
            el(
              'div',
              {},
              el('div', { class: 'en', text: s.en }),
              s.ko ? el('div', { class: 'ko', text: s.ko }) : null,
              s.note ? el('div', { class: 'ko', text: s.note }) : null
            ),
            el(
              'span',
              { class: 'lvl row' },
              speech.available()
                ? el('button', {
                    type: 'button',
                    class: 'speak-btn',
                    text: '▶',
                    title: 'Listen',
                    onclick: () => speech.speak(s.en, { rate: settings.rate }),
                  })
                : null,
              levelPill(store.card(deck.id, s.id))
            )
          )
        )
      )
    )
  );
}

/* ---------- session ---------- */

function viewSession(deck) {
  disarmContinue();
  const item = session.current;
  if (!item) {
    go(`#/deck/${deck.id}/done`);
    return;
  }

  const host = el('div', { class: 'card' });
  render(
    el(
      'div',
      { class: 'session-head' },
      el('button', {
        type: 'button',
        class: 'icon-btn',
        text: '✕ End',
        onclick: () => {
          speech.stop();
          go(session.answers.length ? `#/deck/${deck.id}/done` : `#/deck/${deck.id}`);
        },
      }),
      el('span', { class: 'spacer' }, bar(session.at / session.queue.length, true)),
      el('span', {
        class: 'counter',
        text: `${session.position} / ${session.queue.length}${item.isRetry ? ' · retry' : ''}`,
      })
    ),
    host
  );

  modeHandle = item.mode.mount(host, {
    sentence: item.sentence,
    card: item.card,
    settings: store.settings(),
    finish(correct) {
      modeHandle = null;
      speech.stop();
      session.submit(correct);
      if (session.done) go(`#/deck/${deck.id}/done`);
      else viewSession(deck);
    },
  });
}

/* ---------- results ---------- */

function viewResults(deck) {
  const { correct, asked, percent } = session.score;
  const missed = session.missed;
  const modeId = session.modeId;
  const size = store.settings().sessionSize;
  refreshStreak();

  render(
    el(
      'div',
      { class: 'page-head' },
      el('h1', { text: 'Session complete' }),
      el('p', { text: deck.title })
    ),
    el(
      'div',
      { class: 'card stack' },
      el(
        'div',
        { class: 'row' },
        el('div', {}, el('div', { class: 'score', text: `${percent}%` }),
          el('div', { class: 'muted small', text: `${correct} of ${asked} right on the first try` })),
        el('span', { class: 'spacer' }),
        el('div', { class: 'stack', style: 'gap:8px' },
          el('button', {
            type: 'button',
            class: 'btn btn-primary',
            text: 'Another session',
            onclick: () => {
              session = new Session(deck, modeId, size);
              if (session.total === 0) {
                session = null;
                go(`#/deck/${deck.id}`);
              } else go(`#/deck/${deck.id}/play`);
            },
          }),
          el('button', { type: 'button', class: 'btn', text: 'Back to deck', onclick: () => go(`#/deck/${deck.id}`) }))
      ),
      missed.length
        ? el(
            'div',
            {},
            el('div', { class: 'task-label', text: `Review these ${missed.length}` }),
            el(
              'ul',
              { class: 'miss-list' },
              ...missed.map((s) =>
                el('li', {}, el('div', { class: 'en', text: s.en }), s.ko ? el('div', { class: 'ko', text: s.ko }) : null)
              )
            )
          )
        : el('p', { class: 'muted', text: 'Every sentence right on the first try. 완벽!' })
    )
  );
}

/* ---------- setup notice ---------- */

function viewFileProtocol() {
  render(
    el(
      'div',
      { class: 'card notice' },
      el('h2', { text: 'Start a local server first' }),
      el('p', {
        class: 'muted',
        text:
          'Browsers refuse to read the deck files when the page is opened straight from disk. ' +
          'Run one of these from the project folder, then open the printed address.',
      }),
      el('pre', { text: './serve.sh' }),
      el('pre', { text: 'python3 -m http.server 8000' })
    )
  );
}

/* ---------- routing ---------- */

function route() {
  modeHandle = null;
  disarmContinue();
  speech.stop();
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);

  if (parts[0] !== 'deck') {
    session = null;
    viewHome();
    return;
  }

  const deck = deckById(decodeURIComponent(parts[1] || ''));
  if (!deck) {
    go('#/');
    return;
  }

  const sub = parts[2];
  if (sub === 'browse') {
    viewBrowse(deck);
  } else if (sub === 'play') {
    if (!session || session.deck.id !== deck.id || session.done) go(`#/deck/${deck.id}`);
    else viewSession(deck);
  } else if (sub === 'done') {
    if (!session || session.deck.id !== deck.id || session.answers.length === 0) go(`#/deck/${deck.id}`);
    else viewResults(deck);
  } else {
    session = null;
    viewDeck(deck);
  }
}

/* ---------- settings dialog ---------- */

function wireSettings() {
  const dialog = document.getElementById('settings-dialog');
  const size = document.getElementById('set-session-size');
  const showKo = document.getElementById('set-show-ko');
  const speakReveal = document.getElementById('set-speak-reveal');
  const requeue = document.getElementById('set-requeue');
  const rate = document.getElementById('set-rate');
  const rateOut = document.getElementById('set-rate-out');

  document.getElementById('settings-btn').addEventListener('click', () => {
    const s = store.settings();
    size.value = String(s.sessionSize);
    showKo.checked = s.showKo;
    speakReveal.checked = s.speakOnReveal;
    requeue.checked = s.requeueMissed;
    rate.value = String(s.rate);
    rateOut.textContent = `${Number(s.rate).toFixed(1)}×`;
    dialog.showModal();
  });

  size.addEventListener('change', () => store.setSetting('sessionSize', Number(size.value)));
  showKo.addEventListener('change', () => store.setSetting('showKo', showKo.checked));
  speakReveal.addEventListener('change', () => store.setSetting('speakOnReveal', speakReveal.checked));
  requeue.addEventListener('change', () => store.setSetting('requeueMissed', requeue.checked));
  rate.addEventListener('input', () => {
    store.setSetting('rate', Number(rate.value));
    rateOut.textContent = `${Number(rate.value).toFixed(1)}×`;
  });

  document.getElementById('reset-progress').addEventListener('click', () => {
    if (!confirm('Erase all levels, streaks and statistics? This cannot be undone.')) return;
    store.resetAll();
    dialog.close();
    refreshStreak();
    go('#/');
  });

  dialog.addEventListener('close', () => {
    refreshStreak();
    route();
  });
}

/* ---------- boot ---------- */

document.addEventListener('keydown', (event) => {
  if (document.querySelector('dialog[open]')) return;
  if (event.key === 'Enter') {
    const next = pendingContinue();
    if (next) {
      event.preventDefault();
      next.click();
      return;
    }
  }
  modeHandle?.onKeyDown?.(event);
});

window.addEventListener('hashchange', route);

wireSettings();
refreshStreak();

try {
  const loaded = await loadDecks();
  decks = loaded.decks;
  problems = loaded.problems;
  route();
} catch (err) {
  if (err.fileProtocol) viewFileProtocol();
  else
    render(
      el(
        'div',
        { class: 'card notice' },
        el('h2', { text: 'Could not load the decks' }),
        el('p', { class: 'muted', text: err.message })
      )
    );
}
