/**
 * Parking Panic: the board you can push cars around on.
 *
 * lot.js knows what can move; solver.js knows the way out. This draws the car
 * park and lets a finger shove things about.
 *
 * A vehicle is dragged along its own length and snaps to whole squares, and it
 * stops dead against whatever is in the way -- you cannot drag one through
 * another even for a moment, so the board on screen is always a legal one.
 */
(function () {
  "use strict";

  const lotEl = document.getElementById("lot");
  if (!lotEl) return;
  const L = window.Lot;
  const S = window.LotSolver;
  const LEVELS = window.ParkingLevels;
  const SC = window.ParkingScore;

  const DONE_KEY = "parking-done";
  const COLOURS = ["#f2a65a", "#7fb069", "#5b9bd5", "#a97bd8", "#4fb8a8",
                   "#d871b8", "#c98a5e", "#8d9aa8", "#e8c547", "#6f7fd8",
                   "#e07a5f", "#81b29a", "#b8b8d1", "#c17767", "#9db4c0"];

  const el = {
    lot: lotEl,
    status: document.getElementById("status"),
    name: document.getElementById("level-name"),
    moves: document.getElementById("moves"),
    best: document.getElementById("best"),
    yours: document.getElementById("yours"),
    picker: document.getElementById("picker"),
    undo: document.getElementById("btn-undo"),
    modes: document.getElementById("modes"),
    runPanel: document.getElementById("run-panel"),
    runWhich: document.getElementById("run-which"),
    runScore: document.getElementById("run-score"),
    runClock: document.getElementById("run-clock"),
    jamClock: document.getElementById("jam-clock"),
    skip: document.getElementById("btn-skip"),
    tally: document.getElementById("tally"),
    restart: document.getElementById("btn-restart"),
    hint: document.getElementById("btn-hint"),
  };

  const state = {
    mode: "pick",          // pick a jam, or run the whole lot in order
    runAt: 0,              // which jam of the run we are on
    runScore: 0,
    runResults: [],
    runStarted: 0,
    jamStarted: 0,
    ticker: null,
    level: null,
    cars: [],
    history: [],
    moves: 0,
    hints: 0,
    won: false,
    picked: null,
    drag: null,
    square: 48,
  };

  function say(text) { el.status.textContent = text; }

  /* ---------------- Loading ---------------- */

  function load(level) {
    state.level = level;
    state.cars = L.parse(level.lot);
    state.history = [];
    state.moves = 0;
    state.hints = 0;
    state.won = false;
    state.picked = null;
    state.jamStarted = Date.now();
    el.name.textContent = level.name;
    el.best.textContent = level.best;
    buildLot();
    drawStats();
    say("Get the red car out to the right. Drag a vehicle along its own length.");
  }

  /* ---------------- Drawing ---------------- */

  function sizeLot() {
    const holder = el.lot.parentNode;
    const room = (holder && holder.clientWidth ? holder.clientWidth : 380) - 16;
    state.square = Math.max(38, Math.min(64, Math.floor(room / L.SIZE)));
    el.lot.style.setProperty("--square", state.square + "px");
  }

  function buildLot() {
    sizeLot();
    el.lot.innerHTML = "";

    const floor = document.createElement("div");
    floor.className = "floor";
    for (let i = 0; i < L.SIZE * L.SIZE; i++) {
      const bay = document.createElement("div");
      bay.className = "bay";
      const row = Math.floor(i / L.SIZE), col = i % L.SIZE;
      bay.dataset.row = row;
      bay.dataset.col = col;
      bay.addEventListener("click", function () { tapBay(row, col); });
      floor.appendChild(bay);
    }
    el.lot.appendChild(floor);

    const way = document.createElement("div");
    way.className = "way-out";
    way.style.setProperty("--row", L.EXIT_ROW);
    way.textContent = "way out";
    el.lot.appendChild(way);

    state.cars.forEach(function (car, index) {
      const box = document.createElement("div");
      box.className = "car" + (car.hero ? " car--hero" : "") + " car--" + car.dir;
      box.dataset.index = index;
      if (!car.hero) box.style.background = COLOURS[index % COLOURS.length];
      box.setAttribute("role", "button");
      box.setAttribute("tabindex", "0");
      box.addEventListener("pointerdown", function (event) { grab(index, event); });
      box.addEventListener("keydown", function (event) { nudgeByKey(index, event); });
      el.lot.appendChild(box);
      car.el = box;
    });
    placeCars();
  }

  function placeCars() {
    state.cars.forEach(function (car, index) {
      if (!car.el) return;
      const across = car.dir === "h";
      car.el.style.width = (across ? car.len : 1) * state.square + "px";
      car.el.style.height = (across ? 1 : car.len) * state.square + "px";
      car.el.style.transform = "translate(" + (car.col * state.square) + "px," +
        (car.row * state.square) + "px)";
      car.el.classList.toggle("is-picked", state.picked === index);
      car.el.setAttribute("aria-label", (car.hero ? "The red car" : "A " +
        (car.len === 3 ? "lorry" : "car")) + ", " + (across ? "lying across" : "lying down") +
        ", row " + (car.row + 1) + " column " + (car.col + 1));
    });
  }

  function drawStats() {
    el.moves.textContent = state.moves;
    el.yours.textContent = state.won ? state.moves : "—";
  }

  /* ---------------- Moving ---------------- */

  function moveBy(index, way, step) {
    const move = { index: index, id: state.cars[index].id, way: way, step: step };
    const legal = L.moves(state.cars).some(function (m) {
      return m.index === index && m.way === way && m.step === step;
    });
    if (!legal) return false;
    state.history.push(L.copy(state.cars));
    state.cars = L.apply(state.cars, move).map(function (car, i) {
      car.el = state.cars[i].el;
      return car;
    });
    state.moves += 1;
    placeCars();
    drawStats();
    checkWin();
    return true;
  }

  /** How far a vehicle could go from where it is, each way. */
  function room(index) {
    let back = 0, forward = 0;
    L.moves(state.cars).forEach(function (m) {
      if (m.index !== index) return;
      if (m.way < 0) back = Math.max(back, m.step);
      else forward = Math.max(forward, m.step);
    });
    return { back: back, forward: forward };
  }

  function secondsOnThisJam() {
    return Math.max(0, Math.round((Date.now() - state.jamStarted) / 1000));
  }

  function checkWin() {
    if (state.won || !L.isOut(state.cars)) return;
    state.won = true;
    const seconds = secondsOnThisJam();
    const done = remembered();
    if (done.indexOf(state.level.id) === -1) done.push(state.level.id);
    try { window.localStorage.setItem(DONE_KEY, JSON.stringify(done)); } catch (err) { /* fine */ }
    drawPicker();
    drawStats();

    const best = state.level.best;
    const clean = state.hints === 0;
    const howLong = state.moves === best
      ? "🎉 Out in " + state.moves + " moves — nobody can do it in fewer."
      : "🎉 Out in " + state.moves + " moves. The very best possible is " + best + ".";

    if (state.mode === "run") {
      const points = SC.jamScore(best, state.moves, seconds, state.hints);
      state.runScore += points;
      state.runResults.push({
        level: state.level, moves: state.moves, seconds: seconds,
        hints: state.hints, points: points,
        verdict: SC.verdict(best, state.moves, seconds, state.hints),
      });
      drawRun();
      say(howLong + " " + points + " points, in " + seconds + " seconds.");
      window.setTimeout(nextInRun, 1600);
      return;
    }

    say(howLong);
    // Only a solve done without hints belongs on a board of fewest moves.
    if (board && clean) board.offer(state.moves, state.level.id);
  }

  /* ---------------- Running the lot ---------------- */

  function startRun() {
    state.mode = "run";
    state.runAt = 0;
    state.runScore = 0;
    state.runResults = [];
    state.runStarted = Date.now();
    if (el.runPanel) el.runPanel.hidden = false;
    if (el.skip) el.skip.hidden = false;
    drawModes();
    drawRun();
    load(LEVELS[0]);
    drawPicker();
    say("All fifteen, in order. Fewer moves and less time both score more.");
  }

  function nextInRun() {
    state.runAt += 1;
    if (state.runAt >= LEVELS.length) { finishRun(); return; }
    load(LEVELS[state.runAt]);
    drawRun();
    drawPicker();
  }

  /** Giving up on one, so a jam nobody can see the answer to cannot end the run. */
  function skipJam() {
    if (state.mode !== "run" || state.won) return;
    state.runResults.push({
      level: state.level, moves: 0, seconds: secondsOnThisJam(),
      hints: state.hints, points: 0, verdict: "skipped",
    });
    say("Left that one. On to the next.");
    nextInRun();
  }

  function finishRun() {
    const took = Math.round((Date.now() - state.runStarted) / 1000);
    const perfect = SC.perfectRun(LEVELS);
    state.mode = "pick";
    if (el.skip) el.skip.hidden = true;
    drawModes();
    drawRun(took);
    say("That is all fifteen: " + state.runScore + " points out of a possible " +
      perfect + ", in " + Math.floor(took / 60) + " minutes " + (took % 60) + " seconds.");
    if (runBoard) runBoard.offer(state.runScore, "run");
  }

  function drawRun(finalSeconds) {
    if (!el.runPanel) return;
    el.runPanel.hidden = state.mode !== "run" && !state.runResults.length;
    if (el.runWhich) {
      el.runWhich.textContent = state.mode === "run"
        ? (state.runAt + 1) + " / " + LEVELS.length : "—";
    }
    if (el.runScore) el.runScore.textContent = state.runScore;
    if (el.runClock && finalSeconds !== undefined) {
      el.runClock.textContent = Math.floor(finalSeconds / 60) + ":" +
        String(finalSeconds % 60).padStart(2, "0");
    }
    if (!el.tally) return;
    el.tally.innerHTML = "";
    state.runResults.forEach(function (row) {
      const chip = document.createElement("span");
      chip.className = "tally-chip tally-chip--" + row.verdict.replace(/\s+/g, "-");
      chip.textContent = row.level.name + ": " + row.points;
      chip.title = row.verdict + " — " + (row.moves || "no") + " moves in " + row.seconds + "s";
      el.tally.appendChild(chip);
    });
  }

  function drawModes() {
    if (!el.modes) return;
    el.modes.innerHTML = "";
    [{ id: "pick", label: "🅿️ Pick a jam" }, { id: "run", label: "🏁 Run the lot" }]
      .forEach(function (mode) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "chip" + (state.mode === mode.id ? " is-on" : "");
        button.textContent = mode.label;
        button.setAttribute("aria-pressed", String(state.mode === mode.id));
        button.addEventListener("click", function () {
          if (mode.id === "run") { startRun(); return; }
          state.mode = "pick";
          if (el.skip) el.skip.hidden = true;
          drawModes();
          drawRun();
          say("Pick any jam you like from the list below.");
        });
        el.modes.appendChild(button);
      });
  }

  function tick() {
    if (el.jamClock && state.level) {
      const on = state.won ? 0 : secondsOnThisJam();
      if (!state.won) {
        el.jamClock.textContent = Math.floor(on / 60) + ":" + String(on % 60).padStart(2, "0");
      }
    }
    if (el.runClock && state.mode === "run" && state.runStarted) {
      const all = Math.round((Date.now() - state.runStarted) / 1000);
      el.runClock.textContent = Math.floor(all / 60) + ":" + String(all % 60).padStart(2, "0");
    }
  }

  /* ---------------- Dragging ---------------- */

  function grab(index, event) {
    if (state.won) return;
    state.picked = index;
    placeCars();
    const car = state.cars[index];
    const space = room(index);
    state.drag = {
      index: index,
      startX: event.clientX,
      startY: event.clientY,
      from: car.dir === "h" ? car.col : car.row,
      back: space.back,
      forward: space.forward,
      shifted: 0,
      moved: false,
    };
    try { car.el.setPointerCapture(event.pointerId); } catch (err) { /* not vital */ }
    event.preventDefault();
  }

  window.addEventListener("pointermove", function (event) {
    if (!state.drag) return;
    const car = state.cars[state.drag.index];
    const along = car.dir === "h" ? event.clientX - state.drag.startX
                                  : event.clientY - state.drag.startY;
    // Snap to whole squares, and stop dead against whatever is in the way.
    let cells = Math.round(along / state.square);
    cells = Math.max(-state.drag.back, Math.min(state.drag.forward, cells));
    if (cells !== state.drag.shifted) {
      state.drag.shifted = cells;
      state.drag.moved = true;
      const across = car.dir === "h";
      car.el.style.transform = "translate(" +
        ((car.col + (across ? cells : 0)) * state.square) + "px," +
        ((car.row + (across ? 0 : cells)) * state.square) + "px)";
    }
  });

  window.addEventListener("pointerup", function () {
    if (!state.drag) return;
    const held = state.drag;
    state.drag = null;
    if (!held.shifted) { placeCars(); return; }
    moveBy(held.index, held.shifted > 0 ? 1 : -1, Math.abs(held.shifted));
  });
  window.addEventListener("pointercancel", function () {
    if (!state.drag) return;
    state.drag = null;
    placeCars();
  });

  /** Tapping a bay sends the chosen vehicle there, if it can get there. */
  function tapBay(row, col) {
    if (state.won || state.picked === null) return;
    const car = state.cars[state.picked];
    const along = car.dir === "h" ? col - car.col : row - car.row;
    const across = car.dir === "h" ? row !== car.row : col !== car.col;
    if (across || !along) return;
    // Tapping beyond the far end of the vehicle means its nose, not its tail.
    const step = along > 0 ? Math.max(1, along - (car.len - 1)) : Math.abs(along);
    if (!moveBy(state.picked, along > 0 ? 1 : -1, step)) {
      say("It cannot get there — something is in the way.");
    }
  }

  function nudgeByKey(index, event) {
    const car = state.cars[index];
    const keys = car.dir === "h"
      ? { ArrowLeft: -1, ArrowRight: 1 }
      : { ArrowUp: -1, ArrowDown: 1 };
    if (keys[event.key] === undefined) return;
    event.preventDefault();
    state.picked = index;
    if (!moveBy(index, keys[event.key], 1)) say("That one cannot go any further that way.");
  }

  /* ---------------- Buttons ---------------- */

  function undo() {
    if (!state.history.length || state.won) return;
    const before = state.history.pop();
    state.cars = before.map(function (car, i) {
      car.el = state.cars[i].el;
      return car;
    });
    state.moves = Math.max(0, state.moves - 1);
    placeCars();
    drawStats();
    say("Taken back.");
  }

  function hint() {
    if (state.won) return;
    const move = S.nextMove(state.cars);
    if (!move) {
      say("There is no way out from here — take a move back and try something else.");
      el.lot.classList.add("is-stuck");
      window.setTimeout(function () { el.lot.classList.remove("is-stuck"); }, 800);
      return;
    }
    state.hints += 1;
    state.picked = move.index;
    moveBy(move.index, move.way, move.step);
    say("Move that one. " + (state.hints === 1 ? "It is on a shortest way out." : ""));
  }

  function remembered() {
    try { return JSON.parse(window.localStorage.getItem(DONE_KEY)) || []; }
    catch (err) { return []; }
  }

  function drawPicker() {
    const done = remembered();
    el.picker.innerHTML = "";
    LEVELS.forEach(function (level, i) {
      const button = document.createElement("button");
      button.type = "button";
      const finished = done.indexOf(level.id) !== -1;
      button.className = "chip" + (state.level && state.level.id === level.id ? " is-on" : "") +
        (finished ? " is-done" : "");
      button.textContent = (finished ? "✓ " : (i + 1) + ". ") + level.name +
        " (" + level.best + ")";
      button.addEventListener("click", function () { load(level); drawPicker(); });
      el.picker.appendChild(button);
    });
  }

  /* ---------------- Leaderboard ---------------- */

  const runBoard = window.Leaderboard ? window.Leaderboard.create({
    gameId: "parking-panic-run",
    gameName: "Parking Panic — the whole lot",
    metric: { label: "Points", better: "higher", format: "number" },
    categories: [{ id: "run", label: "All fifteen jams" }],
  }) : null;
  if (runBoard) runBoard.mount(document.getElementById("run-leaderboard-panel"));

  const board = window.Leaderboard ? window.Leaderboard.create({
    gameId: "parking-panic",
    gameName: "Parking Panic",
    metric: { label: "Moves", better: "lower", format: "number" },
    categories: LEVELS.map(function (l) { return { id: l.id, label: l.name }; }),
  }) : null;
  if (board) board.mount(document.getElementById("leaderboard-panel"));

  /* ---------------- Go ---------------- */

  el.undo.addEventListener("click", undo);
  if (el.skip) el.skip.addEventListener("click", skipJam);
  window.setInterval(tick, 500);
  el.restart.addEventListener("click", function () { load(state.level); drawPicker(); });
  el.hint.addEventListener("click", hint);
  window.addEventListener("resize", function () { sizeLot(); placeCars(); });

  const done = remembered();
  const first = LEVELS.find(function (l) { return done.indexOf(l.id) === -1; }) || LEVELS[0];
  drawModes();
  load(first);
  drawPicker();
  drawRun();

  window.ParkingApp = {
    state: state, L: L, S: S, LEVELS: LEVELS,
    load: load, moveBy: moveBy, undo: undo, hint: hint, room: room,
    startRun: startRun, skipJam: skipJam, nextInRun: nextInRun, finishRun: finishRun,
    SC: SC, runScores: null,
    tapBay: tapBay, checkWin: checkWin, scores: board, runScores: runBoard,
  };
})();
