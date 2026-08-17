/** Word-order mode: rebuild the sentence from shuffled word chips. */

import { el, clear } from '../dom.js';
import { words, sameSentence, scrambleOrder, normalize } from '../text.js';
import { promptBlock, settle, revealButton } from './common.js';

export const scramble = {
  id: 'scramble',
  label: 'Word order',
  blurb: 'Tap the shuffled words into the right order',

  mount(host, ctx) {
    const { sentence, settings } = ctx;
    const target = words(sentence.en);
    const pool = scrambleOrder(target.map((text, key) => ({ text, key })));
    const chosen = [];
    let answered = false;

    const tray = el('div', { class: 'tray' });
    const poolRow = el('div', { class: 'pool' });
    const checkBtn = el('button', {
      type: 'button',
      class: 'btn btn-primary',
      text: 'Check',
      disabled: true,
      onclick: check,
    });
    const clearBtn = el('button', {
      type: 'button',
      class: 'btn btn-sm',
      text: 'Clear',
      onclick: () => {
        chosen.length = 0;
        draw();
      },
    });
    const actionRow = el(
      'div',
      { class: 'actions' },
      checkBtn,
      clearBtn,
      el('span', { class: 'spacer' }),
      revealButton(() => finish(false, true))
    );

    host.append(
      el(
        'div',
        { class: 'stack' },
        promptBlock(sentence, settings, {
          label: 'Word order',
          hint: 'Put the words back in order',
        }),
        tray,
        poolRow,
        actionRow
      )
    );

    function draw() {
      clear(tray);
      tray.classList.toggle('filled', chosen.length > 0);
      if (chosen.length === 0) {
        tray.append(el('span', { class: 'tray-placeholder', text: 'Tap the words below…' }));
      }
      chosen.forEach((item, position) => {
        tray.append(
          el('button', {
            type: 'button',
            class: 'chip',
            text: item.text,
            disabled: answered,
            onclick: () => {
              chosen.splice(position, 1);
              draw();
            },
          })
        );
      });

      clear(poolRow);
      for (const item of pool) {
        const used = chosen.includes(item);
        poolRow.append(
          el('button', {
            type: 'button',
            class: `chip${used ? ' spent' : ''}`,
            text: item.text,
            disabled: used || answered,
            onclick: () => {
              chosen.push(item);
              draw();
            },
          })
        );
      }
      checkBtn.disabled = chosen.length !== target.length;
    }

    function check() {
      finish(sameSentence(chosen.map((c) => c.text).join(' '), sentence.en), false);
    }

    /** Freeze the board, colour each slot, then hand over to the session. */
    function finish(correct, revealed) {
      if (answered) return;
      answered = true;
      if (revealed) {
        // Lay the real pool chips out in the correct order, so the board stays consistent.
        chosen.length = 0;
        const remaining = pool.slice();
        for (const word of target) {
          const at = remaining.findIndex((p) => p.text === word);
          if (at >= 0) chosen.push(remaining.splice(at, 1)[0]);
        }
      }
      draw();
      [...tray.children].forEach((chip, i) => {
        if (revealed) {
          chip.classList.add('ok');
        } else if (chip.textContent && normalize(chip.textContent) === normalize(target[i] || '')) {
          chip.classList.add('ok');
        } else {
          chip.classList.add('bad');
        }
      });
      clearBtn.remove();
      settle(host, actionRow, {
        correct,
        sentence,
        settings,
        finish: ctx.finish,
      });
    }

    draw();

    return {
      onKeyDown(event) {
        if (answered) return;
        if (event.key === 'Enter' && !checkBtn.disabled) {
          event.preventDefault();
          check();
        } else if (event.key === 'Backspace' && chosen.length > 0) {
          event.preventDefault();
          chosen.pop();
          draw();
        }
      },
    };
  },
};
