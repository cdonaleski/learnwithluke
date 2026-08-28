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
    next: document.getElementById("btn-next"),
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
    onBoard: false,    // is the piece in hand already down on the board?
    way: 0,
    started: 0,
    done: false,
    hints: 0,
    advance: null,     // the pause between finishing one puzzle and the next
  };

  // Long enough to look at what you just did, short enough not to have to wait.
  const PAUSE = 2400;

  const DONE_KEY = "pent-done";

  function at(x, y) { return y * state.puzzle.w + x; }
  function inside(x, y) { return x >= 0 && y >= 0 && x < state.puzzle.w && y < state.puzzle.h; }

  /* ---------------- Loading ---------------- */

  function load(puzzle) {
    if (state.advance) { window.clearTimeout(state.advance); state.advance = null; }
    state.puzzle = puzzle;
    state.grid = new Array(puzzle.w * puzzle.h).fill("");
    state.placed = {};
    state.picked = puzzle.set[0];
    state.onBoard = false;
    state.way = 0;   // set properly once the board exists, by usableWay below
    state.started = 0;
    state.done = false;
    state.hints = 0;
    el.title.textContent = puzzle.title + " · " + puzzle.w + " by " + puzzle.h;
    el.note.textContent = puzzle.note;
    el.board.classList.remove("is-done");
    if (el.next) el.next.hidden = true;
    buildBoard();
    state.way = usableWay(state.picked);
    drawAll();
    say("Pick a piece, then tap a square. It will slide itself into the first spot it fits.");
  }

  /**
   * Squares sized to the box in front of you. The long puzzles are twenty
   * squares across, so a fixed size would either run off the side of a phone or
   * waste half a laptop screen. Never below fifteen pixels, which is about as
   * small as a finger can find.
   */
  function sizeBoard() {
    const holder = el.board.parentNode;
    const room = (holder && holder.clientWidth ? holder.clientWidth : 560) - 24;
    const square = Math.max(15, Math.min(42, Math.floor(room / state.puzzle.w)));
    el.board.style.setProperty("--sq", square + "px");
  }

  function buildBoard() {
    el.board.innerHTML = "";
    el.board.style.setProperty("--cols", state.puzzle.w);
    sizeBoard();
    for (let y = 0; y < state.puzzle.h; y++) {
      for (let x = 0; x < state.puzzle.w; x++) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "cell";
        cell.dataset.x = x;
        cell.dataset.y = y;
        cell.addEventListener("click", function () {
          if (Date.now() - droppedAt < 250) return;   // the tail end of a drag
          tap(x, y);
        });
        cell.addEventListener("pointerdown", function (event) {
          const here = state.grid[at(x, y)];
          if (!here) return;                 // dragging starts from a piece
          select(here, true);
          drawTray();
          beginDrag(here, true, event);
        });
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
  /**
   * The first way up of a piece that could go anywhere at all on this board.
   * In a box three squares deep the L stood on end fits nowhere, and handing a
   * six-year-old a piece that cannot be put down is no way to start a puzzle.
   */
  function usableWay(letter) {
    const ways = P.PIECES[letter].ways;
    for (let i = 0; i < ways.length; i++) {
      for (let y = 0; y < state.puzzle.h; y++) {
        for (let x = 0; x < state.puzzle.w; x++) {
          if (landingAt(letter, i, x, y)) return i;
        }
      }
    }
    return 0;
  }

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

  /** Takes hold of a piece, whether it is in the tray or already on the board. */
  function select(letter, fromBoard) {
    state.picked = letter;
    state.onBoard = Boolean(fromBoard);
    state.way = fromBoard && state.placed[letter] ? state.placed[letter].way : usableWay(letter);
  }

  /**
   * Moves a piece already on the board to a new square, putting it back where
   * it was if it will not go there. Nothing is ever lost by trying.
   */
  function moveTo(x, y) {
    const was = state.placed[state.picked];
    if (!was) return false;
    lift(state.picked);
    const cells = landingAt(state.picked, state.way, x, y);
    if (!cells) { put(state.picked, was.way, was.cells); return false; }
    put(state.picked, state.way, cells);
    return true;
  }

  /**
   * Turns or flips a piece where it stands rather than making you pick it up,
   * carry it away and put it down again. It tries to stay on the squares it
   * was already using, and if the new way up will not go there at all it goes
   * back exactly as it was.
   */
  function turnInPlace(nextWay) {
    const was = state.placed[state.picked];
    if (!was) return false;
    const old = was.cells.slice();
    lift(state.picked);
    for (let i = 0; i < old.length; i++) {
      const cells = landingAt(state.picked, nextWay, old[i][0], old[i][1]);
      if (cells) {
        put(state.picked, nextWay, cells);
        state.way = nextWay;
        return true;
      }
    }
    put(state.picked, was.way, old);
    return false;
  }

  function tap(x, y) {
    if (state.done) return;
    const here = state.grid[at(x, y)];
    if (here) {
      // The first tap chooses a piece; tapping the one already chosen turns it.
      // So touching a piece twice turns it, without going near a button.
      if (state.onBoard && state.picked === here) {
        turnPiece();
        return;
      }
      select(here, true);
      drawAll();
      say("The " + here + " is chosen. Tap it again to turn it, drag it to move " +
        "it, or tap an empty square to send it there.");
      return;
    }
    if (!state.picked) { say("Pick a piece from the tray first."); return; }

    if (state.onBoard && state.placed[state.picked]) {
      const letter = state.picked;
      if (!moveTo(x, y)) { say("The " + letter + " will not go there. It has stayed put."); return; }
      drawAll();
      if (!state.done) say(letter + " moved.");
      return;
    }
    if (state.placed[state.picked]) { say("That one is already on the board."); return; }
    const ways = P.PIECES[state.picked].ways;
    let way = state.way, cells = landingAt(state.picked, way, x, y);
    // The way they chose comes first. Only if that cannot go there at all is it
    // turned, and then they are told, so nothing happens behind their back.
    for (let i = 1; i < ways.length && !cells; i++) {
      way = (state.way + i) % ways.length;
      cells = landingAt(state.picked, way, x, y);
    }
    if (!cells) {
      say("The " + state.picked + " will not fit there, whichever way up. Try another square.");
      return;
    }
    const turnedIt = way !== state.way;
    const letter = state.picked;
    put(letter, way, cells);
    nextPiece();
    drawAll();
    if (!state.done) {
      say(letter + " placed" + (turnedIt ? ", turned to fit" : "") + ". " + leftCount() + " to go.");
    }
  }

  function leftCount() {
    return state.puzzle.set.split("").filter(function (l) { return !state.placed[l]; }).length;
  }

  function nextPiece() {
    const spare = state.puzzle.set.split("").filter(function (l) { return !state.placed[l]; });
    state.onBoard = false;
    state.picked = spare.length ? spare[0] : null;
    state.way = state.picked ? usableWay(state.picked) : 0;
  }

  /* ---------------- Turning ---------------- */

  /**
   * Turns or flips a piece already on the board.
   *
   * A quarter turn often will not go: an L lying along the top of a box three
   * squares deep stands four squares tall the moment you turn it. Rather than
   * refusing and leaving the button looking broken, it keeps turning until it
   * finds a way up that does fit -- for that L, a half turn. Only if no way up
   * fits where it stands is the piece handed back, already turned, ready to be
   * put down somewhere with room.
   */
  function reorientPlaced(kind) {
    const piece = P.PIECES[state.picked];
    const was = state.placed[state.picked];
    const old = was.cells.slice();
    const startedAt = state.way;
    lift(state.picked);

    let way = startedAt;
    const steps = kind === "turned" ? 3 : 1;
    for (let step = 1; step <= steps; step++) {
      way = piece[kind][way];
      if (way === startedAt) break;
      for (let i = 0; i < old.length; i++) {
        const cells = landingAt(state.picked, way, old[i][0], old[i][1]);
        if (cells) {
          put(state.picked, way, cells);
          state.way = way;
          return step === 1 ? "turned" : "turned-far";
        }
      }
    }

    // No way up of it fits where it is. Put it back exactly as it was and say
    // so, rather than moving it somewhere it was not asked to go.
    put(state.picked, was.way, old);
    return "stuck";
  }

  function reorient(kind, verb) {
    if (!state.picked) return;
    const piece = P.PIECES[state.picked];
    if (piece[kind][state.way] === state.way) {
      say("The " + state.picked + " looks the same " +
        (kind === "turned" ? "whichever way you turn it." : "held up to a mirror."));
      return;
    }

    if (state.onBoard && state.placed[state.picked]) {
      const what = reorientPlaced(kind);
      drawAll();
      if (what === "turned") say(state.picked + " " + verb + "ed where it stands.");
      else if (what === "turned-far") {
        say(state.picked + " turned round — a quarter turn would not fit in a box this shallow.");
      } else if (what === "handed") {
        say("No way up of the " + state.picked + " fits where it was, so it is off the " +
          "board and " + verb + "ed. Tap a square to put it down.");
      } else {
        say("There is no room to " + verb + " the " + state.picked + " where it is. " +
          "Drag it somewhere with more space, or take it off in the tray below.");
      }
      return;
    }

    state.way = piece[kind][state.way];
    drawTray();
    say(state.picked + " " + verb + "ed.");
  }

  function turnPiece() { reorient("turned", "turn"); }
  function flipPiece() { reorient("flipped", "flip"); }

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

  /* ---------------- Dragging ----------------
     Pointer events rather than mouse ones, so a finger, a mouse and a stylus
     all take the same path. A drag that never leaves the square it started on
     is left alone to become an ordinary tap. */

  let drag = null;
  /**
   * When a drag ends the browser usually sends a click straight afterwards,
   * which would be read as a tap on wherever the piece landed. It is ignored by
   * the clock rather than by a flag: a flag set at the end of a drag stays set
   * if no click ever follows -- which happens whenever the finger comes up over
   * something else -- and then silently eats the next real tap instead. That
   * bug made a placed piece impossible to choose, and so impossible to turn.
   */
  let droppedAt = 0;

  function squareUnder(clientX, clientY) {
    let node = null;
    try { node = document.elementFromPoint(clientX, clientY); } catch (err) { return null; }
    if (!node || !node.dataset || node.dataset.x === undefined) return null;
    return { x: Number(node.dataset.x), y: Number(node.dataset.y) };
  }

  function beginDrag(letter, fromBoard, event) {
    if (state.done) return;
    drag = {
      letter: letter,
      fromBoard: fromBoard,
      was: fromBoard ? state.placed[letter] : null,
      lifted: false,
      moved: false,
      over: null,
    };
    if (event && event.pointerId !== undefined && el.board.setPointerCapture) {
      try { el.board.setPointerCapture(event.pointerId); } catch (err) { /* not vital */ }
    }
  }

  function dragMove(event) {
    if (!drag) return;
    const square = squareUnder(event.clientX, event.clientY);
    if (!square) return;
    if (drag.over && drag.over.x === square.x && drag.over.y === square.y) return;
    drag.over = square;
    drag.moved = true;
    // Out of its own way, so it can be previewed over the squares it is using.
    if (drag.fromBoard && !drag.lifted && state.placed[drag.letter]) {
      lift(drag.letter);
      drag.lifted = true;
      drawBoard();
    }
    clearGhost();
    ghost(square.x, square.y);
  }

  function dragEnd() {
    if (!drag) return;
    const held = drag;
    drag = null;
    clearGhost();
    if (!held.moved) return;                 // never left home: treat it as a tap
    droppedAt = Date.now();

    const target = held.over;
    const cells = target ? landingAt(held.letter, state.way, target.x, target.y) : null;
    if (cells) {
      put(held.letter, state.way, cells);
      state.onBoard = true;
      state.picked = held.letter;
      drawAll();
      if (!state.done) say(held.letter + (held.fromBoard ? " moved." : " placed. " + leftCount() + " to go."));
      return;
    }
    // Nowhere to drop it: put it back exactly where it came from.
    if (held.lifted && held.was) {
      put(held.letter, held.was.way, held.was.cells);
      state.way = held.was.way;
    }
    drawAll();
    say("The " + held.letter + " will not go there, so it is back where it was.");
  }

  /** Runs a whole drag with the pointer geometry left out, for the tests. */
  function dragTo(letter, fromBoard, x, y) {
    beginDrag(letter, fromBoard, null);
    if (!drag) return;
    drag.moved = true;
    drag.over = { x: x, y: y };
    if (fromBoard && state.placed[letter]) { lift(letter); drag.lifted = true; }
    dragEnd();
  }

  window.addEventListener("pointermove", dragMove);
  window.addEventListener("pointerup", dragEnd);
  window.addEventListener("pointercancel", dragEnd);

  /* ---------------- Drawing ---------------- */

  function drawBoard() {
    const cells = el.board.children;
    for (let i = 0; i < cells.length; i++) {
      const letter = state.grid[i];
      const cell = cells[i];
      const chosen = letter && state.onBoard && letter === state.picked;
      cell.className = "cell" + (letter ? " is-filled" : "") + (chosen ? " is-chosen" : "");
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
        if (used) {
          lift(letter);
          select(letter, false);
          drawAll();
          say("The " + letter + " taken off the board. Tap a square to put it back.");
          return;
        }
        select(letter, false);
        drawAll();
        say("The " + letter + " picked up. Tap a square to put it down.");
      });
      button.addEventListener("pointerdown", function (event) {
        if (used) lift(letter);
        select(letter, false);
        beginDrag(letter, false, event);
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
    let words = "🎉 Solved" + (clean ? " with no hints" : " with " + state.hints +
      (state.hints === 1 ? " hint" : " hints")) + "! " +
      (state.puzzle.ways ? "There are " + state.puzzle.ways.toLocaleString() +
        " different ways to do that one — you found one of them. " : "");

    // Only a solve done without hints belongs on a board of best times.
    const asked = Boolean(board && clean && took > 0 && board.offer(took, state.puzzle.id));
    if (el.next) el.next.hidden = !upNext();
    // If a name is being typed in, the puzzle must not be whipped away
    // underneath it. In that case the next one waits until the name is in.
    say(words + (asked ? "Put your name on the board, and the next one will follow."
                       : nextWords()));
    if (!asked) queueNext();
  }

  function upNext() {
    const at = PUZZLES.findIndex(function (p) { return p.id === state.puzzle.id; });
    return PUZZLES[at + 1] || null;
  }

  function nextWords() {
    const next = upNext();
    return next ? "Next: " + next.title + "…" : "That was the last one — all eleven done.";
  }

  /** Moves on by itself, so finishing one puzzle just leads into the next. */
  function queueNext() {
    const next = upNext();
    if (!next) return;
    if (state.advance) window.clearTimeout(state.advance);
    state.advance = window.setTimeout(function () {
      state.advance = null;
      load(next);
      drawPicker();
    }, PAUSE);
  }

  function goNext() {
    const next = upNext();
    if (!next) return;
    if (state.advance) { window.clearTimeout(state.advance); state.advance = null; }
    load(next);
    drawPicker();
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
  window.addEventListener("resize", sizeBoard);

  /* ---------------- Leaderboard ---------------- */

  const board = window.Leaderboard ? window.Leaderboard.create({
    gameId: "pentominoes",
    gameName: "Pentominoes",
    metric: { label: "Time", better: "lower", format: "time" },
    categories: PUZZLES.map(function (p) { return { id: p.id, label: p.title }; }),
    // Once the name is safely on the board, carry on to the next puzzle.
    onSaved: function () { say(nextWords()); queueNext(); },
  }) : null;
  if (board) board.mount(document.getElementById("leaderboard-panel"));

  /* ---------------- Buttons and keys ---------------- */

  if (el.next) el.next.addEventListener("click", goNext);
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
    scores: board,
    state: state, load: load, tap: tap, hint: hint, turnPiece: turnPiece, sizeBoard: sizeBoard,
    flipPiece: flipPiece, landingAt: landingAt, usableWay: usableWay,
    goNext: goNext, upNext: upNext, PAUSE: PAUSE,
    select: select, moveTo: moveTo, turnInPlace: turnInPlace, dragTo: dragTo, PUZZLES: PUZZLES, leftCount: leftCount,
  };
})();
