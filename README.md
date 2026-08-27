# Learn With Luke

A kid-friendly learning website with puzzles, games, coding adventures, and more.

## What's included

- **Landing page** (`index.html`) — hero section and navigation cards
- **Puzzles** (`puzzles/`) — puzzle hub with links to individual challenges
- **Rubik's Cube Helper** (`puzzles/rubiks-cube/`) — mirror your physical cube and get step-by-step solve moves
- **Games** (`games/`) — game hub with links to individual games
- **Pong** (`games/pong/`) — classic paddle game, 1 player vs the computer or 2 players on one keyboard
- **Asteroids** (`games/asteroids/`) — old-school vector arcade remake with saucers, hyperspace, and a saved high score
- **Snake** (`games/snake/`) — three speeds, solid or pass-through walls, best score per speed
- **Tic Tac Toe** (`games/tic-tac-toe/`) — 1 player vs the computer (Hard is unbeatable) or 2 players
- **Memory** (`games/memory/`) — themed pair matching with six card themes and three board sizes
- **Bubble Shooter** (`games/bubble-shooter/`) — match-three bubble popper with a Math Mode that puts sums on the shooter, see below
- **Mastermind** (`games/mastermind/`) — crack a colour code from black/white clue dots
- **Rock Paper Scissors** (`games/rock-paper-scissors/`) — classic or Lizard & Spock, with a pattern-spotting computer
- **Battleship** (`games/battleship/`) — place a fleet and trade shots with a hunt/target computer
- **Word Guess** (`games/hangman/`) — hangman with five word categories, in `js/words.js`
- **Connect Four** (`games/connect-four/`) — minimax at depth 6 on Hard, or two players
- **Maze** (`games/maze/`) — freshly carved every time, always solvable
- **Minesweeper** (`games/minesweeper/`) — three sizes, flags, chording, first tap always safe
- **Lights Out** (`games/lights-out/`) — every puzzle solvable by construction
- **Sudoku** (`games/sudoku/`) — generated with a guaranteed-unique answer
- **Tools** (`tools/`) — helper hub
- **Timer** (`tools/timer/`) — countdown and stopwatch with laps, driven by the wall clock so it never drifts
- **Coin Flip** (`tools/coin-flip/`) — heads or tails with a saved tally, plus batch flips that show the odds settling
- **Code** (`code/`) — placeholder page (coming soon)
- **Shared styles** (`css/styles.css`) — consistent look across all pages
- **Shared game chrome** (`css/game.css`) — panels, stat strips, option pickers and
  help blocks used by the newer game pages
- **Shared navigation** (`js/nav.js`) — header, footer, and mobile menu
- **Vendored libraries** (`vendor/`) — Three.js and cubejs, checked in so the
  site works with no internet connection

## How to run locally

No build step or dependencies required — just static HTML, CSS, and JavaScript.

### Option 1: Open directly in a browser

Double-click `index.html`, or drag it into your browser window.

> Note: Some browsers restrict local file loading. If navigation looks broken, use Option 2 instead.

### Option 2: Use a simple local server (recommended)

**Python 3** (built in on macOS):

```bash
cd "/Users/osq_studio/Documents/CUSTOM APPS/Learning With Luke"
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in your browser.

**Node.js** (if installed):

```bash
npx serve .
```

## Rubik's Cube Helper

Open **Puzzles → Rubik's Cube Helper** (or go to `puzzles/rubiks-cube/index.html`).

1. Pick a color from the palette and tap stickers on the unfolded cube net to match your physical cube.
2. Center stickers stay fixed (standard cube colors: white top, yellow bottom, green front, blue back, orange left, red right).
3. Click **Solve!** to get a numbered list of moves (U, D, L, R, F, B notation with `'` and `2` modifiers).
4. Use **Previous / Next** to walk through steps one at a time.

The solver uses [cubejs](https://github.com/ldez/cubejs) (Kociemba two-phase
algorithm), vendored in `vendor/cubejs/`. Building its lookup tables takes a few
seconds, so it runs in a Web Worker — the page stays usable while it loads, and
you can start painting stickers right away. Browsers block workers on `file://`
pages; there the tables are built on the main thread instead, which briefly
freezes the page. That's one more reason to use the local server below.

Before showing any moves, the app checks that the cube you entered is actually
buildable. A cube can show nine stickers of every color and still be impossible
— one flipped edge, or one twisted corner — and the solver will happily return
moves that don't work. Those states are caught and explained instead.

## Pong

Open **Games → Pong** (or go to `games/pong/index.html`).

- **Move your paddle** with the mouse, a finger drag, or the `W` / `S` keys (`↑` / `↓` also work in 1 player mode).
- **2 player mode** puts Player 1 on `W` / `S` and Player 2 on `↑` / `↓`.
- **Space** starts the game and toggles pause; the game also pauses when the tab loses focus.
- **Computer skill** picks the paddle speed, reaction time, and aim error (Easy / Medium / Hard).
- First to **7 points** wins. The ball speeds up on every paddle hit, and the hit position on the paddle sets the bounce angle.

Everything runs on a plain `<canvas>` — no libraries, no network calls.

## Asteroids

Open **Games → Asteroids** (or go to `games/asteroids/index.html`).

- **Turn** with `←` / `→` (or `A` / `D`), **thrust** with `↑` (or `W`), **shoot** with `Space`.
- **Hyperspace** with `H` or `Shift` jumps the ship to a random spot (1.4s cooldown).
- **Pause** with `P`; the game also pauses when the tab loses focus.
- Rocks split 46px → 26px → 14px and score 20 / 50 / 100. Saucers score 200 (big, sprays shots) and 1000 (small, aims at you). Extra ship every 10,000 points.
- Waves start at 4 rocks and grow by 2 each wave, capped at 11.
- The high score is kept in `localStorage` under `lwl-asteroids-high-score` (falls back to memory in private browsing).
- On touch screens an on-screen control pad appears under the playfield.

Vector rendering on a plain `<canvas>` — no libraries, no network calls.

## Adding a Memory theme

Open `games/memory/js/themes.js` and copy one of the blocks:

```js
{
  id: "dinosaurs",
  name: "Dinosaurs",
  icon: "🦖",
  cards: ["🦖", "🦕", "🦴", "🥚", "🌋", "🌿", "🐊", "🦎", "🐢", "🪨", "🌴", "☄️"],
},
```

That's the whole job — the theme picker, the card faces and the shuffle all read
from that list. Two rules:

- Every face in a theme must be **different**. Two identical faces would look
  like a match between unrelated cards, so a theme with duplicates is skipped
  with a console warning rather than dealt.
- Give a theme **12 faces** to unlock every board size. With fewer, the larger
  boards are hidden for that theme and the smaller ones still work.

Faces are plain text, so emoji, letters, numbers or short words all work.

To add a board size instead, add an entry to `SIZES` at the top of
`games/memory/js/memory.js` — `pairs` is how many pairs to deal and `columns` is
how wide the grid should be.

## Adding a Bubble Shooter maths level

Math Mode and Classic Mode run the same engine. A bubble's identity is always an
index into a six-slot palette; the mode only decides how it is drawn and what the
loaded bubble is labelled with. In Math Mode the loaded bubble shows a sum and
hides its colour, so working out the answer is the only way to know where to aim.

Open `games/bubble-shooter/js/math-levels.js` and copy one of the blocks:

```js
{
  id: "doubles",
  name: "Doubles",
  icon: "✌️",
  values: [2, 4, 6, 8, 10, 12],
  problem: function (value) {
    return (value / 2) + " + " + (value / 2);
  },
},
```

The rules:

- `values` must be **exactly six** different numbers — one per bubble colour.
- `problem(value)` must return a string whose answer is **exactly** that value.
  The board is built from `values`, so a mismatch would be unsolvable. The
  offline tests check every level against this.

A level that breaks either rule is skipped with a console warning rather than
being dealt.

## Adding new pages

1. Create a new folder (e.g. `art/`) with an `index.html` file.
2. Copy the structure from an existing section page (e.g. `puzzles/index.html`).
3. Update the page title, heading, and icon.
4. If it's a whole new **section**, add `{ id: "art", label: "Art" }` to the
   `SECTIONS` array in `js/nav.js` — the menu builds itself from that list, so
   it's the only navigation edit. Then add a card on `index.html`.

## Tech stack

- Vanilla HTML, CSS, and JavaScript — no build step, no package manager
- Games are plain `<canvas>` or DOM — no game engine
- Three.js r128 and cubejs 1.3.2, vendored in `vendor/`
- [Fredoka](https://fonts.google.com/specimen/Fredoka) and [Nunito](https://fonts.google.com/specimen/Nunito) fonts via Google Fonts
- Mobile-responsive layout with a collapsible navigation menu
