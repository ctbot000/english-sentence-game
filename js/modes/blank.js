/** Fill-in-the-blanks mode: type the missing words back into the sentence. */

import { el } from '../dom.js';
import { words, normalize, pickBlankIndices } from '../text.js';
import { promptBlock, settle, revealButton } from './common.js';
import { MAX_LEVEL } from '../store.js';

/** More of the sentence disappears as the card gets stronger. */
function blankRatio(level) {
  if (level <= 1) return 0.25;
  if (level <= 3) return 0.4;
  return 0.55;
}

export const blank = {
  id: 'blank',
  label: 'Fill the blanks',
  blurb: 'Type the missing words back in',

  mount(host, ctx) {
    const { sentence, settings, card } = ctx;
    const target = words(sentence.en);
    const ratio = blankRatio(Math.min(card.level, MAX_LEVEL));
    const holes = pickBlankIndices(target, Math.max(1, Math.min(6, Math.round(target.length * ratio))));
    const inputs = new Map();
    let answered = false;

    const line = el('p', { class: 'blank-line' });
    for (let i = 0; i < target.length; i++) {
      if (holes.includes(i)) {
        const bare = normalize(target[i]);
        const input = el('input', {
          type: 'text',
          class: 'blank-input',
          autocapitalize: 'off',
          autocomplete: 'off',
          spellcheck: 'false',
          'aria-label': `Missing word ${holes.indexOf(i) + 1}`,
          style: `width: ${Math.max(3.5, bare.length + 2)}ch`,
        });
        inputs.set(i, input);
        line.append(input);
      } else {
        line.append(el('span', { text: target[i] }));
      }
      line.append(' ');
    }

    const checkBtn = el('button', {
      type: 'button',
      class: 'btn btn-primary',
      text: 'Check',
      onclick: () => finish(false),
    });
    const actionRow = el(
      'div',
      { class: 'actions' },
      checkBtn,
      el('span', { class: 'spacer' }),
      revealButton(() => finish(true))
    );

    host.append(
      el(
        'div',
        { class: 'stack' },
        promptBlock(sentence, settings, {
          label: 'Fill the blanks',
          hint: 'Complete the sentence',
        }),
        line,
        actionRow
      )
    );

    /** Grade every blank, colour it, and append the answer where it was wrong. */
    function finish(revealed) {
      if (answered) return;
      answered = true;
      let allRight = true;

      for (const [i, input] of inputs) {
        const expected = normalize(target[i]);
        const got = normalize(input.value);
        const right = got !== '' && got === expected;
        if (!right) allRight = false;
        input.disabled = true;
        input.classList.add(right ? 'ok' : 'bad');
        if (revealed) input.value = target[i];
        else if (!right) input.after(el('span', { class: 'blank-answer', text: `→ ${target[i]}` }));
      }

      settle(host, actionRow, {
        correct: !revealed && allRight,
        sentence,
        settings,
        finish: ctx.finish,
      });
    }

    const first = inputs.values().next().value;
    first?.focus({ preventScroll: true });

    return {
      onKeyDown(event) {
        if (answered || event.key !== 'Enter') return;
        event.preventDefault();
        finish(false);
      },
    };
  },
};
