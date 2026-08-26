# Learn With Luke

A kid-friendly learning website with puzzles, games, coding adventures, and more.

## What's included

- **Landing page** (`index.html`) — hero section and navigation cards
- **Puzzles** (`puzzles/`) — puzzle hub with links to individual challenges
- **Rubik's Cube Helper** (`puzzles/rubiks-cube/`) — mirror your physical cube and get step-by-step solve moves
- **Games** (`games/`) — game hub with links to individual games
- **Pong** (`games/pong/`) — classic paddle game, 1 player vs the computer or 2 players on one keyboard
- **Code** (`code/`) — placeholder page (coming soon)
- **Shared styles** (`css/styles.css`) — consistent look across all pages
- **Shared navigation** (`js/nav.js`) — header, footer, and mobile menu

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

The solver uses [cubejs](https://github.com/ldez/cubejs) (Kociemba two-phase algorithm) loaded from jsDelivr CDN. First visit takes ~4–5 seconds to initialize the solver tables.

## Pong

Open **Games → Pong** (or go to `games/pong/index.html`).

- **Move your paddle** with the mouse, a finger drag, or the `W` / `S` keys (`↑` / `↓` also work in 1 player mode).
- **2 player mode** puts Player 1 on `W` / `S` and Player 2 on `↑` / `↓`.
- **Space** starts the game and toggles pause; the game also pauses when the tab loses focus.
- **Computer skill** picks the paddle speed, reaction time, and aim error (Easy / Medium / Hard).
- First to **7 points** wins. The ball speeds up on every paddle hit, and the hit position on the paddle sets the bounce angle.

Everything runs on a plain `<canvas>` — no libraries, no network calls.

## Adding new pages

1. Create a new folder (e.g. `art/`) with an `index.html` file.
2. Copy the structure from an existing section page (e.g. `puzzles/index.html`).
3. Update the page title, heading, and icon.
4. Add a link in `js/nav.js` and a card on `index.html`.

## Tech stack

- Vanilla HTML, CSS, and JavaScript
- [Fredoka](https://fonts.google.com/specimen/Fredoka) and [Nunito](https://fonts.google.com/specimen/Nunito) fonts via Google Fonts
- Mobile-responsive layout with a collapsible navigation menu
