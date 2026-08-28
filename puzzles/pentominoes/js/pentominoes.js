/**
 * The pentomino board.
 *
 * Picking a piece up and putting it down is deliberately forgiving: you do not
 * have to aim at the piece's top-left corner, because a seven-year-old cannot
 * see where that is. Tap any empty square the piece could cover and it slides
 * itself into the first spot that fits. Tap a piece already on the board and it
 * goes back to the tray.
 *
 * The hint button does not read out of a stored answer. It solves whatever is
 * on the board at that moment, so a hint always fits what the child has already
 * built -- and if nothing can be built from it, it says so, which is far kinder
 * than letting them shuffle pieces for twenty minutes.
 */
(function () {
  "use strict";

  const boardEl = document.getElementById("board");
  if (!boardEl) return;
  const P = window.Pentominoes;
  const S = window.PentSolver;
  const PUZZLES = window.PentPuzzles;

  const el = {
    board: boardEl,
    tray: document.getElementById("tray"),
    status: document.getElementById("status"),
    title: document.getElementById("puzzle-title"),
    note: document.getElementById("puzzle-note"),
    picker: document.getElementById("picker"),
    clock: document.getElementById("clock"),
    leftCount: document.getElementById("left-count"),
    turn: document.getElementById("btn-turn"),
    flip: document.getElementById("btn-flip"),
    hint: document.getElementById("btn-hint"),
    clear: document.getElementById("btn-clear"),
  };

  const state = {
    puzzle: null,
    grid: [],
    placed: {},        // letter -> { way, cells }
    picked: null,
    way: 0,
    started: 0,
    done: false,
    hints: 0,
  };

  const DONE_KEY = "pent-done";

  function at(x, y) { return y * state.puzzle.w + x; }
  function inside(x, y) { return x >= 0 && y >= 0 && x < state.puzzle.w && y < state.puzzle.h; }

  /* ---------------- Loading ---------------- */

  function load(puzzle) {
    state.puzzle = puzzle;
    state.grid = new Array(puzzle.w * puzzle.h).fill("");
    state.placed = {};
    state.picked = puzzle.set[0];
    state.way = 0;
    state.started = 0;
    state.done = false;
    state.hints = 0;
    el.title.textContent = puzzle.title + " · " + puzzle.w + " by " + puzzle.h;
    el.note.textContent = puzzle.note;
    buildBoard();
    drawAll();
    say("Pick a piece, then tap a square. It will slide itself into the first spot it fits.");
  }

  function buildBoard() {
    el.board.innerHTML = "";
    el.board.style.setProperty("--cols", state.puzzle.w);
    for (let y = 0; y < state.puzzle.h; y++) {
      for (let x = 0; x < state.puzzle.w; x++) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "cell";
        cell.dataset.x = x;
        cell.dataset.y = y;
        cell.addEventListener("click", function () { tap(x, y); });
        cell.addEventListener("mouseenter", function () { ghost(x, y); });
        cell.addEventListener("mouseleave", clearGhost);
        el.board.appendChild(cell);
      }
    }
  }

  /* ---------------- Placing ---------------- */

  /**
   * Where a piece would go if you tapped this square. Every one of the piece's
   * own five squares is tried as the one under your finger, and the first that
   * fits wins -- which is why you can aim roughly and still get what you meant.
   */
  function landingAt(letter, way, x, y) {
    const shape = P.PIECES[letter].ways[way];
    for (let a = 0; a < shape.length; a++) {
      const cells = [];
      let ok = true;
      for (let i = 0; i < shape.length; i++) {
        const cx = x + shape[i][0] - shape[a][0];
        const cy = y + shape[i][1] - shape[a][1];
        if (!inside(cx, cy) || state.grid[at(cx, cy)] !== "") { ok = false; break; }
        cells.push([cx, cy]);
      }
      if (ok) return cells;
    }
    return null;
  }

  function put(letter, way, cells) {
    cells.forEach(function (c) { state.grid[at(c[0], c[1])] = letter; });
    state.placed[letter] = { way: way, cells: cells };
    if (!state.started) state.started = Date.now();
  }

  function lift(letter) {
    const was = state.placed[letter];
    if (!was) return;
    was.cells.forEach(function (c) { state.grid[at(c[0], c[1])] = ""; });
    delete state.placed[letter];
  }

  function tap(x, y) {
    if (state.done) return;
    const here = state.grid[at(x, y)];
    if (here) {
      lift(here);
      state.picked = here;
      state.way = 0;
      drawAll();
      say(here + " taken back. Tap a square to put it somewhere else.");
      return;
    }
    if (!state.picked) { say("Pick a piece from the tray first."); return; }
    if (state.placed[state.picked]) { say("That one is already on the board."); return; }
    const cells = landingAt(state.picked, state.way, x, y);
    if (!cells) {
      say("The " + state.picked + " will not fit there. Try turning it, or another square.");
      return;
    }
    const letter = state.picked;
    put(letter, state.way, cells);
    nextPiece();
    drawAll();
    if (!state.done) say(letter + " placed. " + leftCount() + " to go.");
  }

  function leftCount() {
    return state.puzzle.set.split("").filter(function (l) { return !state.placed[l]; }).length;
  }

  function nextPiece() {
    const spare = state.puzzle.set.split("").filter(function (l) { return !state.placed[l]; });
    state.picked = spare.length ? spare[0] : null;
    state.way = 0;
  }

  /* ---------------- Turning ---------------- */

  function turnPiece() {
    if (!state.picked) return;
    const piece = P.PIECES[state.picked];
    state.way = piece.turned[state.way];
    drawTray();
    say(state.picked + " turned a quarter turn." +
      (piece.ways.length === 1 ? " Though the X looks the same whichever way you turn it." : ""));
  }

  function flipPiece() {
    if (!state.picked) return;
    const piece = P.PIECES[state.picked];
    const was = state.way;
    state.way = piece.flipped[state.way];
    drawTray();
    say(state.way === was
      ? state.picked + " looks the same held up to a mirror."
      : state.picked + " flipped over.");
  }

  /* ---------------- Hints ---------------- */

  function hint() {
    if (state.done) return;
    const left = state.puzzle.set.split("").filter(function (l) { return !state.placed[l]; });
    if (!left.length) return;
    const board = { w: state.puzzle.w, h: state.puzzle.h, grid: state.grid.slice() };
    const answer = S.solve(board, left, 900000);
    if (!answer) {
      say("This cannot be finished from here — something already on the board is " +
        "in the way. Take a piece off and try again.");
      el.board.classList.add("is-stuck");
      window.setTimeout(function () { el.board.classList.remove("is-stuck"); }, 900);
      return;
    }
    const step = answer[0];
    put(step.letter, step.way, step.cells);
    state.hints++;
    nextPiece();
    drawAll();
    if (!state.done) say("The " + step.letter + " goes there. " + leftCount() + " to go.");
  }

  /* ---------------- Drawing ---------------- */

  function drawBoard() {
    const cells = el.board.children;
    for (let i = 0; i < cells.length; i++) {
      const letter = state.grid[i];
      const cell = cells[i];
      cell.className = "cell" + (letter ? " is-filled" : "");
      cell.style.background = letter ? P.PIECES[letter].colour : "";
      const x = i % state.puzzle.w, y = Math.floor(i / state.puzzle.w);
      cell.setAttribute("aria-label", "Row " + (y + 1) + ", column " + (x + 1) + ": " +
        (letter ? "the " + letter + " piece" : "empty"));
    }
    // Draw the seams between different pieces, not between squares of the same
    // one, so each piece reads as a single object rather than five tiles.
    for (let i = 0; i < cells.length; i++) {
      const x = i % state.puzzle.w, y = Math.floor(i / state.puzzle.w);
      const mine = state.grid[i];
      const edge = function (dx, dy) {
        const nx = x + dx, ny = y + dy;
        return !inside(nx, ny) || state.grid[at(nx, ny)] !== mine;
      };
      cells[i].classList.toggle("edge-t", Boolean(mine) && edge(0, -1));
      cells[i].classList.toggle("edge-b", Boolean(mine) && edge(0, 1));
      cells[i].classList.toggle("edge-l", Boolean(mine) && edge(-1, 0));
      cells[i].classList.toggle("edge-r", Boolean(mine) && edge(1, 0));
    }
  }

  function ghost(x, y) {
    if (state.done || !state.picked || state.placed[state.picked]) return;
    clearGhost();
    const cells = landingAt(state.picked, state.way, x, y);
    if (!cells) return;
    cells.forEach(function (c) {
      const cell = el.board.children[at(c[0], c[1])];
      cell.classList.add("is-ghost");
      cell.style.background = P.PIECES[state.picked].colour;
    });
  }

  function clearGhost() {
    Array.prototype.forEach.call(el.board.children, function (cell, i) {
      if (!cell.classList.contains("is-ghost")) return;
      cell.classList.remove("is-ghost");
      cell.style.background = state.grid[i] ? P.PIECES[state.grid[i]].colour : "";
    });
  }

  function drawTray() {
    el.tray.innerHTML = "";
    state.puzzle.set.split("").forEach(function (letter) {
      const piece = P.PIECES[letter];
      const used = Boolean(state.placed[letter]);
      const chosen = state.picked === letter;
      const way = chosen ? state.way : 0;
      const shape = piece.ways[way];
      const wide = Math.max.apply(null, shape.map(function (c) { return c[0]; })) + 1;
      const tall = Math.max.apply(null, shape.map(function (c) { return c[1]; })) + 1;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "piece" + (chosen ? " is-picked" : "") + (used ? " is-used" : "");
      button.setAttribute("aria-pressed", String(chosen));
      button.setAttribute("aria-label", "The " + letter + " piece" + (used ? ", already placed" : ""));

      const art = document.createElement("span");
      art.className = "piece-art";
      art.style.setProperty("--pw", wide);
      art.style.setProperty("--ph", tall);
      for (let y = 0; y < tall; y++) {
        for (let x = 0; x < wide; x++) {
          const dot = document.createElement("span");
          const on = shape.some(function (c) { return c[0] === x && c[1] === y; });
          dot.className = "dot" + (on ? " is-on" : "");
          if (on) dot.style.background = piece.colour;
          art.appendChild(dot);
        }
      }
      const tag = document.createElement("span");
      tag.className = "piece-letter";
      tag.textContent = letter;

      button.appendChild(art);
      button.appendChild(tag);
      button.addEventListener("click", function () {
        if (used) { lift(letter); }
        state.picked = letter;
        state.way = 0;
        drawAll();
        say("The " + letter + " picked up. Tap a square to put it down.");
      });
      el.tray.appendChild(button);
    });
  }

  function drawPicker() {
    if (!el.picker) return;
    const done = remembered();
    el.picker.innerHTML = "";
    PUZZLES.forEach(function (puzzle, i) {
      const button = document.createElement("button");
      button.type = "button";
      const finished = done.indexOf(puzzle.id) !== -1;
      button.className = "chip" + (state.puzzle && state.puzzle.id === puzzle.id ? " is-on" : "") +
        (finished ? " is-done" : "");
      button.textContent = (finished ? "✓ " : (i + 1) + ". ") + puzzle.title;
      button.addEventListener("click", function () { load(puzzle); drawPicker(); });
      el.picker.appendChild(button);
    });
  }

  function drawAll() {
    drawBoard();
    drawTray();
    el.leftCount.textContent = leftCount();
    check();
  }

  /* ---------------- Winning ---------------- */

  function check() {
    if (state.done) return;
    if (state.grid.some(function (c) { return c === ""; })) return;
    state.done = true;
    const took = state.started ? Date.now() - state.started : 0;
    const done = remembered();
    if (done.indexOf(state.puzzle.id) === -1) done.push(state.puzzle.id);
    try { window.localStorage.setItem(DONE_KEY, JSON.stringify(done)); } catch (err) { /* fine */ }
    el.board.classList.add("is-done");
    drawPicker();
    const clean = state.hints === 0;
    say("🎉 Solved" + (clean ? " with no hints" : " with " + state.hints +
      (state.hints === 1 ? " hint" : " hints")) + "! " +
      (state.puzzle.ways ? "There are " + state.puzzle.ways.toLocaleString() +
        " different ways to do that one — you found one of them." : ""));
    // Only a solve done without hints belongs on a board of best times.
    if (board && clean && took > 0) board.offer(took, state.puzzle.id);
  }

  function remembered() {
    try { return JSON.parse(window.localStorage.getItem(DONE_KEY)) || []; }
    catch (err) { return []; }
  }

  function say(text) { el.status.textContent = text; }

  /* ---------------- Clock ---------------- */

  function tick() {
    if (!el.clock) return;
    const ms = state.started && !state.done ? Date.now() - state.started
             : state.started ? 0 : 0;
    const total = Math.floor((state.started ? (state.done ? 0 : ms) : 0) / 1000);
    if (state.started && !state.done) {
      el.clock.textContent = Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
    } else if (!state.started) {
      el.clock.textContent = "0:00";
    }
  }
  window.setInterval(tick, 500);

  /* ---------------- Leaderboard ---------------- */

  const board = window.Leaderboard ? window.Leaderboard.create({
    gameId: "pentominoes",
    gameName: "Pentominoes",
    metric: { label: "Time", better: "lower", format: "time" },
    categories: PUZZLES.map(function (p) { return { id: p.id, label: p.title }; }),
  }) : null;
  if (board) board.mount(document.getElementById("leaderboard-panel"));

  /* ---------------- Buttons and keys ---------------- */

  if (el.turn) el.turn.addEventListener("click", turnPiece);
  if (el.flip) el.flip.addEventListener("click", flipPiece);
  if (el.hint) el.hint.addEventListener("click", hint);
  if (el.clear) el.clear.addEventListener("click", function () {
    load(state.puzzle);
    drawPicker();
  });

  window.addEventListener("keydown", function (event) {
    const tag = event.target && event.target.tagName;
    if (tag === "INPUT") return;
    if (event.key === "r" || event.key === "R") { turnPiece(); event.preventDefault(); }
    if (event.key === "f" || event.key === "F") { flipPiece(); event.preventDefault(); }
    if (event.key === "h" || event.key === "H") { hint(); event.preventDefault(); }
  });

  /* ---------------- Go ---------------- */

  const done = remembered();
  const first = PUZZLES.find(function (p) { return done.indexOf(p.id) === -1; }) || PUZZLES[0];
  load(first);
  drawPicker();

  window.PentApp = {
    state: state, load: load, tap: tap, hint: hint, turnPiece: turnPiece,
    flipPiece: flipPiece, landingAt: landingAt, PUZZLES: PUZZLES, leftCount: leftCount,
  };
})();
