/**
 * Connect Four — four in a row, against the computer or a friend.
 *
 * The Hard computer is minimax with alpha-beta pruning. Depth is what makes it
 * feel sharp: at depth 6 it sees the trap where a move hands you a winning
 * square two turns later. Columns are searched centre-outwards, which both
 * prunes better and makes it open in the strongest column.
 */
(function () {
  "use strict";

  const boardEl = document.getElementById("c4-board");
  if (!boardEl) return;

  const COLS = 7;
  const ROWS = 6;
  const EMPTY = 0, YOU = 1, CPU = 2;
  const CPU_DELAY = 420;

  const LEVELS = { easy: { depth: 1, slip: 0.55 }, medium: { depth: 4, slip: 0.18 }, hard: { depth: 6, slip: 0 } };
  /** Centre columns are worth more, so search them first for better pruning. */
  const COLUMN_ORDER = [3, 2, 4, 1, 5, 0, 6];

  const state = {
    mode: "cpu",          // cpu | two
    levelId: "easy",
    grid: [],             // grid[row][col], row 0 is the TOP
    turn: YOU,
    phase: "playing",     // playing | over
    winner: null,
    winningCells: [],
    scores: { you: 0, cpu: 0, draw: 0 },
    starter: YOU,
    busy: false,
    lastDrop: null,
  };

  let soundOn = true;
  let audioCtx = null;
  let cpuTimer = null;

  const el = {
    board: boardEl,
    status: document.getElementById("c4-status"),
    scoreYou: document.getElementById("c4-you"),
    scoreCpu: document.getElementById("c4-cpu"),
    scoreDraw: document.getElementById("c4-draw"),
    nameYou: document.getElementById("c4-name-you"),
    nameCpu: document.getElementById("c4-name-cpu"),
    restart: document.getElementById("btn-restart"),
    reset: document.getElementById("btn-reset-scores"),
    sound: document.getElementById("btn-sound"),
    levelGroup: document.getElementById("level-group"),
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

  /* ---------- Board ---------- */
  function emptyGrid() {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(EMPTY));
  }

  function legalColumns(grid) {
    const out = [];
    for (const c of COLUMN_ORDER) if (grid[0][c] === EMPTY) out.push(c);
    return out;
  }

  /** Row a disc would land in, or -1 if the column is full. */
  function dropRow(grid, col) {
    for (let r = ROWS - 1; r >= 0; r--) if (grid[r][col] === EMPTY) return r;
    return -1;
  }

  function drop(grid, col, player) {
    const row = dropRow(grid, col);
    if (row === -1) return -1;
    grid[row][col] = player;
    return row;
  }

  /** Four in a row through the given cell, or null. */
  function winningLineAt(grid, row, col) {
    const player = grid[row][col];
    if (player === EMPTY) return null;
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of directions) {
      const line = [[row, col]];
      for (const sign of [1, -1]) {
        let r = row + dr * sign, c = col + dc * sign;
        while (r >= 0 && r < ROWS && c >= 0 && c < COLS && grid[r][c] === player) {
          line.push([r, c]);
          r += dr * sign;
          c += dc * sign;
        }
      }
      if (line.length >= 4) return line;
    }
    return null;
  }

  function findWinner(grid) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] === EMPTY) continue;
        const line = winningLineAt(grid, r, c);
        if (line) return { player: grid[r][c], line };
      }
    }
    return null;
  }

  function isFull(grid) {
    return grid[0].every((cell) => cell !== EMPTY);
  }

  /* ---------- Computer ---------- */
  /** Rough worth of a 4-cell window for the given player. */
  function windowScore(cells, player) {
    const opponent = player === CPU ? YOU : CPU;
    const mine = cells.filter((v) => v === player).length;
    const theirs = cells.filter((v) => v === opponent).length;
    if (mine && theirs) return 0;           // blocked, worth nothing
    if (mine === 4) return 1000;
    if (mine === 3) return 12;
    if (mine === 2) return 3;
    if (theirs === 4) return -1000;
    if (theirs === 3) return -14;           // blocking matters slightly more
    if (theirs === 2) return -3;
    return 0;
  }

  function evaluate(grid, player) {
    let score = 0;
    // Centre control is worth real points in Connect Four.
    for (let r = 0; r < ROWS; r++) if (grid[r][3] === player) score += 4;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (c + 3 < COLS) score += windowScore([grid[r][c], grid[r][c+1], grid[r][c+2], grid[r][c+3]], player);
        if (r + 3 < ROWS) score += windowScore([grid[r][c], grid[r+1][c], grid[r+2][c], grid[r+3][c]], player);
        if (r + 3 < ROWS && c + 3 < COLS)
          score += windowScore([grid[r][c], grid[r+1][c+1], grid[r+2][c+2], grid[r+3][c+3]], player);
        if (r + 3 < ROWS && c - 3 >= 0)
          score += windowScore([grid[r][c], grid[r+1][c-1], grid[r+2][c-2], grid[r+3][c-3]], player);
      }
    }
    return score;
  }

  function minimax(grid, depth, alpha, beta, maximising) {
    const winner = findWinner(grid);
    if (winner) {
      // Prefer winning sooner and losing later, so it does not dawdle.
      return winner.player === CPU ? 100000 + depth : -100000 - depth;
    }
    if (isFull(grid) || depth === 0) return evaluate(grid, CPU);

    const columns = legalColumns(grid);
    if (maximising) {
      let best = -Infinity;
      for (const col of columns) {
        const row = drop(grid, col, CPU);
        const score = minimax(grid, depth - 1, alpha, beta, false);
        grid[row][col] = EMPTY;
        best = Math.max(best, score);
        alpha = Math.max(alpha, score);
        if (alpha >= beta) break;
      }
      return best;
    }
    let best = Infinity;
    for (const col of columns) {
      const row = drop(grid, col, YOU);
      const score = minimax(grid, depth - 1, alpha, beta, true);
      grid[row][col] = EMPTY;
      best = Math.min(best, score);
      beta = Math.min(beta, score);
      if (alpha >= beta) break;
    }
    return best;
  }

  function chooseColumn(grid) {
    const level = LEVELS[state.levelId] || LEVELS.easy;
    const columns = legalColumns(grid);
    if (!columns.length) return -1;

    // A deliberate slip rate keeps the easier levels beatable without making
    // them play obviously silly moves every turn.
    if (level.slip > 0 && Math.random() < level.slip) {
      return columns[Math.floor(Math.random() * columns.length)];
    }

    let best = -Infinity;
    let choice = columns[0];
    for (const col of columns) {
      const row = drop(grid, col, CPU);
      const score = minimax(grid, level.depth - 1, -Infinity, Infinity, false);
      grid[row][col] = EMPTY;
      if (score > best) { best = score; choice = col; }
    }
    return choice;
  }

  /* ---------- Flow ---------- */
  function playerName(who) {
    if (state.mode === "two") return who === YOU ? "Red" : "Yellow";
    return who === YOU ? "You" : "Computer";
  }

  function isCpuTurn() {
    return state.mode === "cpu" && state.phase === "playing" && state.turn === CPU;
  }

  function playColumn(col) {
    if (state.phase !== "playing" || state.busy) return;
    if (col < 0 || col >= COLS) return;
    const row = drop(state.grid, col, state.turn);
    if (row === -1) { setStatus("That column is full — try another."); return; }

    state.lastDrop = [row, col];
    beep(state.turn === YOU ? 480 : 380, 0.07, "sine");

    const line = winningLineAt(state.grid, row, col);
    if (line) {
      state.phase = "over";
      state.winner = state.turn;
      state.winningCells = line;
      if (state.turn === YOU) { state.scores.you += 1; fanfare(); }
      else { state.scores.cpu += 1; beep(170, 0.3, "sawtooth"); }
      setStatus("🎉 " + playerName(state.turn) + " got four in a row!");
      render();
      return;
    }

    if (isFull(state.grid)) {
      state.phase = "over";
      state.scores.draw += 1;
      setStatus("😄 The board is full — it's a draw!");
      render();
      return;
    }

    state.turn = state.turn === YOU ? CPU : YOU;
    setStatus(turnPrompt());
    render();

    if (isCpuTurn()) {
      state.busy = true;
      cpuTimer = window.setTimeout(() => {
        cpuTimer = null;
        state.busy = false;
        if (!isCpuTurn()) { render(); return; }
        playColumn(chooseColumn(state.grid));
      }, CPU_DELAY);
    }
  }

  function turnPrompt() {
    if (isCpuTurn()) return "Computer is thinking…";
    return playerName(state.turn) + "'s turn — drop a disc.";
  }

  function newRound(keepStarter) {
    if (cpuTimer) { window.clearTimeout(cpuTimer); cpuTimer = null; }
    state.busy = false;
    state.grid = emptyGrid();
    state.phase = "playing";
    state.winner = null;
    state.winningCells = [];
    state.lastDrop = null;
    if (!keepStarter) state.starter = state.starter === YOU ? CPU : YOU;
    state.turn = state.starter;
    setStatus(turnPrompt());
    render();
    if (isCpuTurn()) {
      state.busy = true;
      cpuTimer = window.setTimeout(() => {
        cpuTimer = null; state.busy = false;
        if (isCpuTurn()) playColumn(chooseColumn(state.grid));
      }, CPU_DELAY);
    }
  }

  /* ---------- Rendering ---------- */
  function render() {
    el.board.innerHTML = "";

    // A button per column, so the whole column is one big target.
    const picker = document.createElement("div");
    picker.className = "c4-picker";
    for (let c = 0; c < COLS; c++) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "c4-drop";
      button.textContent = "▼";
      button.disabled = state.phase !== "playing" || state.busy || state.grid[0][c] !== EMPTY;
      button.setAttribute("aria-label", "Drop a disc in column " + (c + 1));
      button.addEventListener("click", () => playColumn(c));
      picker.appendChild(button);
    }
    el.board.appendChild(picker);

    const grid = document.createElement("div");
    grid.className = "c4-grid";
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement("div");
        const value = state.grid[r][c];
        const winning = state.winningCells.some(([wr, wc]) => wr === r && wc === c);
        cell.className = "c4-cell" +
          (value === YOU ? " is-you" : value === CPU ? " is-cpu" : "") +
          (winning ? " is-win" : "") +
          (state.lastDrop && state.lastDrop[0] === r && state.lastDrop[1] === c ? " is-last" : "");
        cell.setAttribute("role", "img");
        cell.setAttribute("aria-label", "Row " + (r + 1) + " column " + (c + 1) + ", " +
          (value === EMPTY ? "empty" : playerName(value)));
        grid.appendChild(cell);
      }
    }
    el.board.appendChild(grid);

    el.scoreYou.textContent = String(state.scores.you);
    el.scoreCpu.textContent = String(state.scores.cpu);
    el.scoreDraw.textContent = String(state.scores.draw);
    el.nameYou.textContent = playerName(YOU);
    el.nameCpu.textContent = playerName(CPU);
    el.levelGroup.hidden = state.mode !== "cpu";
  }

  function setStatus(text) { el.status.textContent = text; }

  /* ---------- Wiring ---------- */
  el.restart.addEventListener("click", () => newRound(false));
  el.reset.addEventListener("click", () => {
    state.scores = { you: 0, cpu: 0, draw: 0 };
    state.starter = YOU;
    newRound(true);
  });
  el.sound.addEventListener("click", () => {
    soundOn = !soundOn;
    el.sound.textContent = soundOn ? "🔊 Sound On" : "🔇 Sound Off";
    el.sound.setAttribute("aria-pressed", String(soundOn));
  });

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.mode === button.dataset.mode) return;
      state.mode = button.dataset.mode;
      document.querySelectorAll("[data-mode]").forEach((other) => {
        const active = other === button;
        other.classList.toggle("is-active", active);
        other.setAttribute("aria-pressed", String(active));
      });
      state.scores = { you: 0, cpu: 0, draw: 0 };
      state.starter = YOU;
      newRound(true);
    });
  });

  document.querySelectorAll("[data-level]").forEach((button) => {
    button.addEventListener("click", () => {
      state.levelId = button.dataset.level;
      document.querySelectorAll("[data-level]").forEach((other) => {
        const active = other === button;
        other.classList.toggle("is-active", active);
        other.setAttribute("aria-pressed", String(active));
      });
      state.starter = YOU;
      newRound(true);
    });
  });

  window.addEventListener("keydown", (event) => {
    const match = /^Digit([1-7])$/.exec(event.code);
    if (!match) return;
    event.preventDefault();
    playColumn(Number(match[1]) - 1);
  });

  newRound(true);

  window.ConnectFourGame = {
    state, COLS, ROWS, EMPTY, YOU, CPU, LEVELS,
    emptyGrid, drop, dropRow, legalColumns, winningLineAt, findWinner, isFull,
    chooseColumn, minimax, evaluate, playColumn, newRound,
  };
})();
