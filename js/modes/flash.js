/** Flashcard mode: recall it in your head, then grade yourself. */

import { el } from '../dom.js';
import { promptBlock, revealAudio, speakButton, armContinue, disarmContinue } from './common.js';

export const flash = {
  id: 'flash',
  label: 'Flashcards',
  blurb: 'Recall it in your head, then grade yourself',
  selfGraded: true,

  mount(host, ctx) {
    const { sentence, settings } = ctx;
    let revealed = false;

    const answer = el('p', { class: 'reveal', hidden: true, text: sentence.en });
    const showBtn = el('button', {
      type: 'button',
      class: 'btn btn-primary',
      text: 'Show answer',
      onclick: reveal,
    });
    const actionRow = el('div', { class: 'actions' }, showBtn);

    host.append(
      el(
        'div',
        { class: 'stack' },
        promptBlock(sentence, settings, {
          label: 'Flashcard',
          hint: 'Say the sentence out loud, then check',
        }),
        answer,
        actionRow
      )
    );

    function reveal() {
      if (revealed) return;
      revealed = true;
      answer.hidden = false;
      const again = el('button', {
        type: 'button',
        class: 'btn',
        text: '✗ Again',
        onclick: () => {
          disarmContinue();
          ctx.finish(false);
        },
      });
      const good = el('button', {
        type: 'button',
        class: 'btn btn-primary',
        text: '✓ I knew it',
        onclick: () => {
          disarmContinue();
          ctx.finish(true);
        },
      });
      armContinue(good);
      const speakingHint = el('span', { class: 'speaking-hint', hidden: true, text: '🔊 playing…' });
      actionRow.replaceChildren(
        good,
        again,
        speakingHint,
        el('span', { class: 'spacer' }),
        speakButton(sentence.en, settings, '▶ Listen')
      );
      // Grading is advancing too, so hold both buttons until the audio finishes.
      revealAudio(sentence, settings, { buttons: [good, again], speakingHint });
    }

    showBtn.focus({ preventScroll: true });

    return {
      onKeyDown(event) {
        if (event.key === 'Enter' && !revealed) {
          event.preventDefault();
          reveal();
        }
      },
    };
  },
};
