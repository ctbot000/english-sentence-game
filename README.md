# English Sentence Game

A browser game for memorizing English sentences. No build step, no dependencies —
plain HTML, CSS and ES modules. The sentences live in a separate repo,
`english-sentence-data`, so adding a new chapter of a book never touches the
game's code.

## Running it

Clone `english-sentence-data` next to this repo — `data/` here is a symlink into
it:

```
workspaces/claude/
├── english-sentence-game/
│   └── data -> ../english-sentence-data/data
└── english-sentence-data/
    └── data/
```

```bash
./serve.sh
```

Then open <http://localhost:8000>. Pass a port to use a different one:
`./serve.sh 9000`.

If it reports the port is already in use, an earlier `./serve.sh` is still
running in another terminal — the game is already up at that address, so just
open it (or serve on another port).

Before starting, `serve.sh` checks that `data/` resolves and that every deck in
the manifest is actually on disk, since both failures otherwise show up in the
game as "no decks" rather than an error.

Opening `index.html` straight from Finder will **not** work — browsers refuse to
read the deck files over `file://`. The page says as much if you try.

## The drills

| Drill | What you do |
| --- | --- |
| **Word order** | Tap shuffled word chips into the right order |
| **Fill the blanks** | Type the missing words back into the sentence |
| **Type it out** | Write the whole sentence from the Korean prompt |
| **Dictation** | Listen, then write what you heard |
| **Flashcards** | Recall it in your head, then grade yourself |
| **Mixed** | Rotates the drills; new sentences start with the gentler ones |

Comparison is lenient about case, punctuation and extra spaces — `i dont know`
counts as `I don't know.` Wrong answers get a word-level diff showing what was
missing and what did not belong.

Speech uses the browser's built-in voices, so Dictation needs no network. If a
browser has no English voice, the listening drills are hidden automatically.

### Keyboard

- `Enter` — check your answer, then again to continue
- `Backspace` — take back the last chip in Word order
- `Tab` — move between blanks

While the sentence is being read aloud after an answer, the continue button is
disabled and `Enter` does nothing, so advancing cannot cut the pronunciation
short. Turn off **Read the sentence aloud after each answer** in Settings to skip
the wait entirely.

## Progress

Each sentence has a level from 0 to 6 in a Leitner-style schedule: a correct
answer promotes it and pushes the next review out (1, 2, 4, 8, 16, 32 days), a
wrong one knocks it back two boxes. Sessions serve what is due first, weakest
first, then anything you have not seen yet.

Everything is stored in `localStorage` under `english-sentence-game:v1` — per
browser, no account. **Reset all progress** in Settings clears it.

## Deck files

Everything under `data/` belongs to the `english-sentence-data` repo; the paths
below are relative to it.

`data/decks.json` lists the decks in the order they appear on the home screen.
`file` is relative to `data/`, so decks kept in book folders are listed with
their subpath:

```json
{
  "decks": [
    { "id": "goldilocks-ch1", "file": "books/Goldilocks and the Three Bears/chapter1.json" },
    { "id": "sample", "file": "sample.json" }
  ]
}
```

Each deck file holds the sentences (see `data/_template.json`):

```json
{
  "id": "book1-ch3",
  "title": "Chapter 3 — Small talk",
  "source": "My Book, pp. 40–52",
  "description": "Optional one-liner.",
  "sentences": [
    {
      "id": "book1-ch3-001",
      "en": "I have been meaning to ask you about that.",
      "ko": "그것에 대해 너에게 물어보려고 했었어.",
      "note": "have been meaning to = 계속 ~하려고 생각해 왔다",
      "page": 41,
      "tags": ["present perfect"]
    }
  ]
}
```

Only `en` is required. `ko` is what the game shows as the prompt, so a deck
without it falls back to English-only drills (Fill the blanks and Dictation
still work well; Type it out has nothing to prompt from). `note`, `page` and
`tags` are optional; `id` is generated from the deck id and position if omitted.

A deck file that is missing or malformed is reported on the home screen and
skipped — it never takes the rest of the game down. If `data/decks.json` itself
cannot be read, the `english-sentence-data` repo is missing or is not sitting
next to this one.

## Layout

```
index.html          markup and the settings dialog
css/style.css       all styling, light and dark
js/app.js           routing, views, wiring
js/session.js       what to study next, in which drill
js/store.js         localStorage: settings, levels, streak
js/decks.js         loading and normalising deck files
js/text.js          tokenising, lenient comparison, word diff
js/speech.js        text-to-speech
js/dom.js           small element helper
js/modes/           one file per drill
data/               symlink → ../english-sentence-data/data
```
