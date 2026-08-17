# CLAUDE.md

Read `README.md` first for how the game works and the deck-file schema.

## Adding sentences from book snapshots

This is the main recurring job: the user sends photos or screenshots of book
pages, and those become a deck.

Deck files live in the sibling `english-sentence-data` repo, reached here through
the `data` symlink. Commit them there — adding sentences should not touch this
repo at all.

1. **One deck per chapter or page range**, not per snapshot. If the user sends
   more pages from a range already covered, append to that deck rather than
   creating a second one.
2. Write `data/books/<book title>/<chapter>.json` using `data/_template.json`,
   then add the entry to `data/decks.json` with the same subpath. Both steps are
   needed — a deck file that is not listed is invisible.
3. Keep the sentences **in book order**, and keep `page` when the page number is
   legible. First-time sessions follow deck order, so order matters.
4. `id` values must be unique within the deck and stable — progress is stored
   under `<deckId>/<sentenceId>`. Renumbering an existing sentence silently
   resets its level, so append new ones rather than reflowing the numbering.
5. Validate before saying it is done:
   `python3 -c "import json;json.load(open('data/<file>.json'))"`, and check it
   actually reaches the home screen — `./serve.sh` and load the page. A broken
   symlink or a manifest path that does not match the file on disk both look
   like "no deck" rather than an error.

## Transcribing rules

- Copy `en` **exactly as printed**, including contractions and punctuation. Do
  not "improve" the book's English.
- `ko` is the prompt the learner sees, so it must be present for Word order and
  Type it out to make sense. Use the book's own Korean when the page has it;
  translate only when it does not, and keep it natural rather than word-for-word.
- Put grammar or idiom explanations in `note`, in the book's own terms where
  possible. Keep it to one line — it renders as a single hint under the prompt.
- Skip anything that is not a full sentence: headings, exercise numbers, answer
  keys, vocabulary lists without context.
- If a snapshot is blurry or a word is genuinely unreadable, ask rather than
  guessing. A wrong sentence gets memorized wrong.

## Working on the game itself

- No build step and no dependencies. Keep it that way — plain ES modules loaded
  straight from `js/`.
- `./serve.sh` to run it; the game cannot read deck files over `file://`.
- Adding a drill: create `js/modes/<name>.js` following the contract documented
  at the top of `js/modes/common.js`, then register it in the `MODES` array in
  `js/session.js`. It shows up in the picker automatically. Set
  `needsSpeech: true` if it depends on text-to-speech, so it is hidden when no
  English voice exists.
- Answer checking must stay lenient about case, punctuation and spacing — see
  `normalize()` in `js/text.js`.
