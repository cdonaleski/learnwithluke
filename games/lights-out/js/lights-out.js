/**
 * Lights Out — turn every light off.
 *
 * Puzzles are made by starting from a solved board and pressing random
 * squares. Not every arrangement of lights is solvable, so scrambling from
 * solved is the guarantee: whatever presses got you here, pressing the same
 * ones again undoes it. Pressing is its own inverse, because every press
 * toggles, and toggling twice is doing nothing.
 */
(function () {
  "use strict";

  const boardEl = document.getElementById("lo-board");
  if (!boardEl) return;

  const SIZES = {
    small: { label: "🐣 Easy", size: 3, presses: 4 },
    medium: { label: "🐤 Medium", size: 4, presses: 7 },
    large: { label: "🦅 Hard", size: 5, presses: 12 },
  };

  const SIZE_KEY = "lights-out-size";
  const BEST_KEY = "lights-out-best";

  const state = {
    sizeId: "small",
    size: 3,
    grid: [],
    scramble: [],      // the presses that built this puzzle
    moves: 0,
    solved: false,
    best: {},
    hintCell: null,
  };

  let soundOn = true;
  let audioCtx = null;

  const el = {
    board: boardEl,
    status: document.getElementById("lo-status"),
    moves: document.getElementById("lo-moves"),
    lit: document.getElementById("lo-lit"),
    best: document.getElementById("lo-best"),
    restart: document.getElementById("btn-restart"),
    hint: document.getElementById("btn-hint"),
    sound: document.getElementById("btn-sound"),
  };

  /* ---------- Sound ---------- */
  function beep(freq, duration, type) {
    if (!soundOn) return;
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      if (!audioCtx) audioCtx = new AudioCtor();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type || "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (err) { /* optional */ }
  }

  function fanfare() {
    [523, 659, 784, 1047].forEach((f, i) => window.setTimeout(() => beep(f, 0.18, "triangle"), i * 130));
  }

  /* ---------- Puzzle ---------- */
  function blank(size) {
    return Array.from({ length: size }, () => new Array(size).fill(false));
  }

  /** A press flips the square and its four orthogonal neighbours. */
  function press(grid, row, col) {
    const size = grid.length;
    [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => {
      const r = row + dr, c = col + dc;
      if (r >= 0 && r < size && c >= 0 && c < size) grid[r][c] = !grid[r][c];
    });
    return grid;
  }

  function litCount(grid) {
    return grid.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
  }

  function isSolved(grid) {
    return litCount(grid) === 0;
  }

  function makePuzzle(size, presses) {
    const grid = blank(size);
    const used = [];
    let guard = 0;
    // Keep scrambling until something is actually lit — pressing the same
    // square twice cancels out and could hand the player a finished board.
    while (isSolved(grid) && guard++ < 50) {
      for (let i = 0; i < presses; i++) {
        const r = Math.floor(Math.random() * size);
        const c = Math.floor(Math.random() * size);
        press(grid, r, c);
        used.push([r, c]);
      }
    }
    return { grid, scramble: used };
  }

  /**
   * Which squares still need pressing. Presses commute and each is its own
   * inverse, so a square pressed an odd number of times during scrambling is
   * one the player still owes.
   */
  function remainingPresses() {
    const counts = new Map();
    state.scramble.forEach(([r, c]) => {
      const key = r + ":" + c;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const out = [];
    counts.forEach((count, key) => {
      if (count % 2 === 1) {
        const [r, c] = key.split(":").map(Number);
        out.push([r, c]);
      }
    });
    return out;
  }

  /* ---------- Best scores ---------- */
  function loadBest() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(BEST_KEY) || "{}");
      state.best = parsed && typeof parsed === "object" ? parsed : {};
    } catch (err) { state.best = {}; }
  }

  function bestForCurrent() {
    const value = state.best[state.sizeId];
    return typeof value === "number" ? value : null;
  }

  function recordBest() {
    const previous = bestForCurrent();
    if (previous !== null && state.moves >= previous) return false;
    state.best[state.sizeId] = state.moves;
    try { window.localStorage.setItem(BEST_KEY, JSON.stringify(state.best)); } catch (err) { /* ok */ }
    return true;
  }

  /* ---------- Play ---------- */
  function newPuzzle() {
    const cfg = SIZES[state.sizeId] || SIZES.small;
    state.size = cfg.size;
    const puzzle = makePuzzle(cfg.size, cfg.presses);
    state.grid = puzzle.grid;
    state.scramble = puzzle.scramble;
    state.moves = 0;
    state.solved = false;
    state.hintCell = null;
    render();
    setStatus("Turn every light off. Pressing one flips its neighbours too!");
  }

  function tap(row, col) {
    if (state.solved) return;
    press(state.grid, row, col);
    state.scramble.push([row, col]);   // keeps the hint honest as you play
    state.moves += 1;
    state.hintCell = null;
    beep(state.grid[row][col] ? 620 : 460, 0.05, "sine");

    if (isSolved(state.grid)) {
      state.solved = true;
      const isBest = recordBest();
      fanfare();
      setStatus(isBest
        ? "🏆 All out in " + state.moves + " moves — a new best!"
        : "🎉 Lights out! You did it in " + state.moves + " moves.");
    }
    render();
  }

  function showHint() {
    if (state.solved) return;
    const remaining = remainingPresses();
    if (!remaining.length) return;
    state.hintCell = remaining[Math.floor(Math.random() * remaining.length)];
    render();
    setStatus("💡 Try the square that's glowing at the edge.");
  }

  /* ---------- Rendering ---------- */
  function render() {
    el.board.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "lo-grid";
    grid.style.setProperty("--lo-size", String(state.size));

    for (let r = 0; r < state.size; r++) {
      for (let c = 0; c < state.size; c++) {
        const on = state.grid[r][c];
        const button = document.createElement("button");
        button.type = "button";
        button.className = "lo-light" + (on ? " is-on" : "") +
          (state.hintCell && state.hintCell[0] === r && state.hintCell[1] === c ? " is-hint" : "");
        button.textContent = on ? "💡" : "";
        button.setAttribute("aria-label", "Row " + (r + 1) + " column " + (c + 1) + ", " + (on ? "on" : "off"));
        button.disabled = state.solved;
        button.addEventListener("click", () => tap(r, c));
        grid.appendChild(button);
      }
    }
    el.board.appendChild(grid);

    el.moves.textContent = String(state.moves);
    el.lit.textContent = String(litCount(state.grid));
    const best = bestForCurrent();
    el.best.textContent = best === null ? "—" : String(best);
  }

  function setStatus(text) { el.status.textContent = text; }

  /* ---------- Wiring ---------- */
  el.restart.addEventListener("click", () => newPuzzle());
  el.hint.addEventListener("click", showHint);
  el.sound.addEventListener("click", () => {
    soundOn = !soundOn;
    el.sound.textContent = soundOn ? "🔊 Sound On" : "🔇 Sound Off";
    el.sound.setAttribute("aria-pressed", String(soundOn));
  });

  document.querySelectorAll("[data-size]").forEach((button) => {
    button.addEventListener("click", () => {
      state.sizeId = button.dataset.size;
      try { window.localStorage.setItem(SIZE_KEY, state.sizeId); } catch (err) { /* ok */ }
      document.querySelectorAll("[data-size]").forEach((other) => {
        const active = other === button;
        other.classList.toggle("is-active", active);
        other.setAttribute("aria-pressed", String(active));
      });
      newPuzzle();
    });
  });

  try {
    const saved = window.localStorage.getItem(SIZE_KEY);
    if (saved && SIZES[saved]) state.sizeId = saved;
  } catch (err) { /* defaults fine */ }

  document.querySelectorAll("[data-size]").forEach((button) => {
    const active = button.dataset.size === state.sizeId;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  loadBest();
  newPuzzle();

  window.LightsOutGame = {
    state, press, blank, litCount, isSolved, makePuzzle, remainingPresses, tap, newPuzzle, SIZES,
  };
})();
