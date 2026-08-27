/**
 * Minesweeper — clear the board without setting off a mine.
 *
 * Mines are laid AFTER the first click, with that square and its neighbours
 * excluded. That makes "your first click is always safe" a guarantee rather
 * than a hope, and it means the first click always opens a region instead of
 * a lone number, which is a much kinder start for a child.
 */
(function () {
  "use strict";

  const boardEl = document.getElementById("ms-board");
  if (!boardEl) return;

  const LEVELS = {
    easy: { label: "🐣 Easy", cols: 9, rows: 9, mines: 10 },
    medium: { label: "🐤 Medium", cols: 16, rows: 16, mines: 40 },
    hard: { label: "🦅 Hard", cols: 22, rows: 16, mines: 60 },
  };

  const LEVEL_KEY = "minesweeper-level";
  const BEST_KEY = "minesweeper-best";
  const NUMBER_COLORS = ["", "#2f6fd0", "#2e8b45", "#d64545", "#6b3fa0", "#a35b1f", "#1f8a8a", "#444", "#777"];

  const state = {
    levelId: "easy",
    cols: 9,
    rows: 9,
    mines: 10,
    grid: [],          // { mine, near, open, flag }
    laid: false,       // have the mines been placed yet?
    phase: "ready",    // ready | playing | won | lost
    flags: 0,
    opened: 0,
    elapsed: 0,
    startedAt: 0,
    best: {},
    flagMode: false,
  };

  let soundOn = true;
  let audioCtx = null;
  let tickTimer = null;

  const el = {
    board: boardEl,
    status: document.getElementById("ms-status"),
    minesLeft: document.getElementById("ms-mines"),
    time: document.getElementById("ms-time"),
    best: document.getElementById("ms-best"),
    restart: document.getElementById("btn-restart"),
    flagBtn: document.getElementById("btn-flag"),
    sound: document.getElementById("btn-sound"),
  };

  function level() { return LEVELS[state.levelId] || LEVELS.easy; }

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

  /* ---------- Board ---------- */
  function inside(r, c) { return r >= 0 && r < state.rows && c >= 0 && c < state.cols; }

  function neighbours(r, c) {
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        if (inside(r + dr, c + dc)) out.push([r + dr, c + dc]);
      }
    }
    return out;
  }

  function blankGrid(rows, cols) {
    return Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ mine: false, near: 0, open: false, flag: false })));
  }

  /**
   * Lay the mines, keeping the first-clicked square AND its neighbours clear
   * so the opening click always cascades.
   */
  function layMines(safeR, safeC) {
    const forbidden = new Set([safeR + ":" + safeC]);
    neighbours(safeR, safeC).forEach(([r, c]) => forbidden.add(r + ":" + c));

    const spots = [];
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        if (!forbidden.has(r + ":" + c)) spots.push([r, c]);
      }
    }
    // Shuffle, then take the first N — no risk of an infinite retry loop.
    for (let i = spots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const swap = spots[i]; spots[i] = spots[j]; spots[j] = swap;
    }
    const count = Math.min(state.mines, spots.length);
    spots.slice(0, count).forEach(([r, c]) => { state.grid[r][c].mine = true; });

    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        state.grid[r][c].near = neighbours(r, c).filter(([nr, nc]) => state.grid[nr][nc].mine).length;
      }
    }
    state.laid = true;
  }

  /* ---------- Timer ---------- */
  function startTimer() {
    if (tickTimer) return;
    state.startedAt = Date.now() - state.elapsed;
    tickTimer = window.setInterval(() => {
      state.elapsed = Date.now() - state.startedAt;
      renderStats();
    }, 250);
  }

  function stopTimer() {
    if (!tickTimer) return;
    window.clearInterval(tickTimer);
    tickTimer = null;
  }

  function formatTime(ms) {
    const total = Math.floor(ms / 1000);
    return Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
  }

  /* ---------- Best times ---------- */
  function loadBest() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(BEST_KEY) || "{}");
      state.best = parsed && typeof parsed === "object" ? parsed : {};
    } catch (err) { state.best = {}; }
  }

  function bestForCurrent() {
    const value = state.best[state.levelId];
    return typeof value === "number" ? value : null;
  }

  function recordBest() {
    const previous = bestForCurrent();
    if (previous !== null && state.elapsed >= previous) return false;
    state.best[state.levelId] = state.elapsed;
    try { window.localStorage.setItem(BEST_KEY, JSON.stringify(state.best)); } catch (err) { /* ok */ }
    return true;
  }

  /* ---------- Play ---------- */
  function open(r, c) {
    if (state.phase === "won" || state.phase === "lost") return;
    const cell = state.grid[r][c];
    if (cell.flag || cell.open) return;

    if (!state.laid) {
      layMines(r, c);
      state.phase = "playing";
      startTimer();
    }

    if (cell.mine) {
      cell.open = true;
      state.phase = "lost";
      stopTimer();
      revealAllMines();
      beep(150, 0.35, "sawtooth");
      setStatus("💥 That one was a mine! Press New Game to try again.");
      render();
      return;
    }

    // Flood out across the blank region, then stop at the numbers around it.
    const stack = [[r, c]];
    while (stack.length) {
      const [cr, cc] = stack.pop();
      const current = state.grid[cr][cc];
      if (current.open || current.flag) continue;
      current.open = true;
      state.opened += 1;
      if (current.near === 0) {
        neighbours(cr, cc).forEach(([nr, nc]) => {
          if (!state.grid[nr][nc].open && !state.grid[nr][nc].mine) stack.push([nr, nc]);
        });
      }
    }

    beep(560, 0.04, "sine");
    checkWin();
    render();
  }

  function toggleFlag(r, c) {
    if (state.phase === "won" || state.phase === "lost") return;
    const cell = state.grid[r][c];
    if (cell.open) return;
    cell.flag = !cell.flag;
    state.flags += cell.flag ? 1 : -1;
    beep(cell.flag ? 700 : 420, 0.05, "square");
    checkWin();
    render();
  }

  /**
   * Click a number that already has the right count of flags around it to open
   * everything else next to it. Saves a lot of tedious clicking.
   */
  function chord(r, c) {
    const cell = state.grid[r][c];
    if (!cell.open || cell.near === 0) return;
    const around = neighbours(r, c);
    const flagged = around.filter(([nr, nc]) => state.grid[nr][nc].flag).length;
    if (flagged !== cell.near) return;
    around.forEach(([nr, nc]) => {
      if (!state.grid[nr][nc].flag && !state.grid[nr][nc].open) open(nr, nc);
    });
  }

  function revealAllMines() {
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        if (state.grid[r][c].mine) state.grid[r][c].open = true;
      }
    }
  }

  /** Won when every square that is NOT a mine has been opened. */
  function checkWin() {
    if (state.phase === "lost") return;
    const safeSquares = state.rows * state.cols - state.mines;
    if (state.opened < safeSquares) return;
    state.phase = "won";
    stopTimer();
    // Flag anything left, so the finished board reads properly.
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        if (state.grid[r][c].mine && !state.grid[r][c].flag) {
          state.grid[r][c].flag = true;
          state.flags += 1;
        }
      }
    }
    const isBest = recordBest();
    if (board) board.offer(state.elapsed, state.levelId);
    fanfare();
    setStatus(isBest
      ? "🏆 Cleared in " + formatTime(state.elapsed) + " — a new best!"
      : "🎉 All clear in " + formatTime(state.elapsed) + "!");
  }

  function newGame() {
    const cfg = level();
    stopTimer();
    state.cols = cfg.cols;
    state.rows = cfg.rows;
    state.mines = cfg.mines;
    state.grid = blankGrid(cfg.rows, cfg.cols);
    state.laid = false;
    state.phase = "ready";
    state.flags = 0;
    state.opened = 0;
    state.elapsed = 0;
    state.startedAt = 0;
    render();
    setStatus("Tap any square to begin — your first tap is always safe.");
  }

  /* ---------- Rendering ---------- */
  function render() {
    el.board.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "ms-grid";
    grid.style.setProperty("--ms-cols", String(state.cols));

    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const cell = state.grid[r][c];
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ms-cell" + (cell.open ? " is-open" : "") +
          (cell.flag ? " is-flag" : "") +
          (cell.open && cell.mine ? " is-mine" : "");

        if (cell.flag && !cell.open) button.textContent = "🚩";
        else if (cell.open && cell.mine) button.textContent = "💣";
        else if (cell.open && cell.near > 0) {
          button.textContent = String(cell.near);
          button.style.color = NUMBER_COLORS[cell.near];
        } else button.textContent = "";

        const coord = "row " + (r + 1) + " column " + (c + 1);
        button.setAttribute("aria-label", coord + ", " +
          (cell.flag ? "flagged" : cell.open
            ? (cell.mine ? "mine" : cell.near ? cell.near + " nearby" : "clear")
            : "unopened"));

        button.addEventListener("click", () => {
          if (state.flagMode) toggleFlag(r, c);
          else if (state.grid[r][c].open) chord(r, c);
          else open(r, c);
        });
        button.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          toggleFlag(r, c);
        });

        grid.appendChild(button);
      }
    }
    el.board.appendChild(grid);
    renderStats();
  }

  function renderStats() {
    el.minesLeft.textContent = String(Math.max(0, state.mines - state.flags));
    el.time.textContent = formatTime(state.elapsed);
    const best = bestForCurrent();
    el.best.textContent = best === null ? "—" : formatTime(best);
    el.flagBtn.textContent = state.flagMode ? "🚩 Flag Mode: On" : "🚩 Flag Mode: Off";
    el.flagBtn.setAttribute("aria-pressed", String(state.flagMode));
  }

  function setStatus(text) { el.status.textContent = text; }

  /* ---------- Wiring ---------- */
  el.restart.addEventListener("click", () => newGame());
  el.flagBtn.addEventListener("click", () => {
    state.flagMode = !state.flagMode;
    renderStats();
    setStatus(state.flagMode
      ? "Flag mode on — tapping now plants a flag instead of digging."
      : "Flag mode off — tapping digs again.");
  });
  el.sound.addEventListener("click", () => {
    soundOn = !soundOn;
    el.sound.textContent = soundOn ? "🔊 Sound On" : "🔇 Sound Off";
    el.sound.setAttribute("aria-pressed", String(soundOn));
  });

  document.querySelectorAll("[data-level]").forEach((button) => {
    button.addEventListener("click", () => {
      state.levelId = button.dataset.level;
      try { window.localStorage.setItem(LEVEL_KEY, state.levelId); } catch (err) { /* ok */ }
      document.querySelectorAll("[data-level]").forEach((other) => {
        const active = other === button;
        other.classList.toggle("is-active", active);
        other.setAttribute("aria-pressed", String(active));
      });
      newGame();
      if (board) board.setCategory(state.levelId);
    });
  });

  window.addEventListener("keydown", (event) => {
    if (event.code !== "KeyF") return;
    event.preventDefault();
    state.flagMode = !state.flagMode;
    renderStats();
  });

  try {
    const saved = window.localStorage.getItem(LEVEL_KEY);
    if (saved && LEVELS[saved]) state.levelId = saved;
  } catch (err) { /* defaults fine */ }

  document.querySelectorAll("[data-level]").forEach((button) => {
    const active = button.dataset.level === state.levelId;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });


  /* ---------- Leaderboard ---------- */
  const board = window.Leaderboard ? window.Leaderboard.create({
    gameId: "minesweeper",
    gameName: "Minesweeper",
    metric: { label: "Time", better: "lower", format: "time" },
    categories: [{ id: "easy", label: "🐣 Easy" }, { id: "medium", label: "🐤 Medium" }, { id: "hard", label: "🦅 Hard" }],
  }) : null;
  if (board) board.mount(document.getElementById("leaderboard-panel"));

  loadBest();
  newGame();
  if (board) board.setCategory(state.levelId);

  window.MinesweeperGame = {
    state, LEVELS, newGame, open, toggleFlag, chord, layMines, neighbours, checkWin, level,
  };
})();
