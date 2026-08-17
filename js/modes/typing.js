/**
 * Typing mode: write the whole sentence out.
 * `dictation` is the same drill with the audio as the only prompt.
 */

import { el } from '../dom.js';
import { sameSentence, letterHint } from '../text.js';
import * as speech from '../speech.js';
import { promptBlock, settle, revealButton, speakButton, diffView } from './common.js';

function makeTyping({ id, label, blurb, listen }) {
  return {
    id,
    label,
    blurb,
    needsSpeech: Boolean(listen),

    mount(host, ctx) {
      const { sentence, settings } = ctx;
      let answered = false;

      const box = el('textarea', {
        class: 'text-input',
        rows: '2',
        autocapitalize: 'sentences',
        autocomplete: 'off',
        spellcheck: 'false',
        placeholder: 'Write the English sentence…',
        'aria-label': 'Your sentence',
      });

      const hintLine = el('p', { class: 'hint-row', hidden: true });
      const hintBtn = el('button', {
        type: 'button',
        class: 'btn btn-sm',
        text: 'Hint',
        onclick: () => {
          hintLine.textContent = letterHint(sentence.en);
          hintLine.hidden = false;
          hintBtn.disabled = true;
        },
      });

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
        hintBtn,
        el('span', { class: 'spacer' }),
        revealButton(() => finish(true))
      );

      const promptSettings = listen ? { ...settings, showKo: false } : settings;
      const prompt = promptBlock(sentence, promptSettings, {
        label,
        hint: listen ? 'Listen, then write what you hear' : 'Write it in English',
      });
      if (listen) {
        prompt.append(
          el(
            'div',
            { style: 'margin-top:10px' },
            speakButton(sentence.en, settings, '▶ Play again') ||
              el('span', { class: 'muted small', text: 'Speech is unavailable in this browser.' })
          )
        );
      }

      host.append(el('div', { class: 'stack' }, prompt, box, hintLine, actionRow));

      function finish(revealed) {
        if (answered) return;
        answered = true;
        const given = box.value;
        const correct = !revealed && sameSentence(given, sentence.en);
        box.disabled = true;
        hintBtn.remove();
        settle(host, actionRow, {
          correct,
          sentence,
          settings,
          detail: !correct && given.trim() ? diffView(sentence.en, given) : null,
          finish: ctx.finish,
        });
      }

      if (listen) speech.speak(sentence.en, { rate: settings.rate });
      box.focus({ preventScroll: true });

      return {
        onKeyDown(event) {
          if (answered) return;
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            finish(false);
          }
        },
      };
    },
  };
}

export const typing = makeTyping({
  id: 'typing',
  label: 'Type it out',
  blurb: 'Write the sentence from the Korean prompt',
});

export const dictation = makeTyping({
  id: 'dictation',
  label: 'Dictation',
  blurb: 'Listen, then write what you hear',
  listen: true,
});
