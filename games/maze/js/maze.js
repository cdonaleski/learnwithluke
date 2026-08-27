/**
 * Maze — find your way from the corner to the flag.
 *
 * Mazes are carved with a recursive backtracker (iterative, so a big maze
 * cannot blow the stack). That algorithm produces a "perfect" maze: every
 * cell reachable, and exactly one route between any two cells. So a generated
 * maze is always solvable, and the hint path is always the only path.
 */
(function () {
  "use strict";

  const canvas = document.getElementById("maze-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const SIZES = {
    small: { label: "🐣 Small", cols: 10, rows: 8 },
    medium: { label: "🐤 Medium", cols: 16, rows: 12 },
    large: { label: "🦅 Large", cols: 24, rows: 18 },
  };

  const N = 1, E = 2, S = 4, Wa = 8;
  const DIRS = [
    { bit: N, dr: -1, dc: 0, opposite: S },
    { bit: E, dr: 0, dc: 1, opposite: Wa },
    { bit: S, dr: 1, dc: 0, opposite: N },
    { bit: Wa, dr: 0, dc: -1, opposite: E },
  ];

  const SIZE_KEY = "maze-size";
  const BEST_KEY = "maze-best";

  const state = {
    sizeId: "small",
    cols: 10,
    rows: 8,
    cells: [],          // bitmask of walls still standing
    player: { r: 0, c: 0 },
    exit: { r: 0, c: 0 },
    visited: [],
    moves: 0,
    startedAt: 0,
    elapsed: 0,
    running: false,
    finished: false,
    solution: null,
    best: {},
  };

  let soundOn = true;
  let audioCtx = null;
  let tickTimer = null;

  const el = {
    status: document.getElementById("maze-status"),
    moves: document.getElementById("maze-moves"),
    time: document.getElementById("maze-time"),
    best: document.getElementById("maze-best"),
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
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
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

  /* ---------- Generation ---------- */
  function inside(r, c) {
    return r >= 0 && r < state.rows && c >= 0 && c < state.cols;
  }

  function generate(rows, cols) {
    // Every cell starts boxed in; carving removes walls in pairs.
    const cells = Array.from({ length: rows }, () => new Array(cols).fill(N | E | S | Wa));
    const seen = Array.from({ length: rows }, () => new Array(cols).fill(false));
    const stack = [[0, 0]];
    seen[0][0] = true;

    while (stack.length) {
      const [r, c] = stack[stack.length - 1];
      const options = DIRS.filter((d) => {
        const nr = r + d.dr, nc = c + d.dc;
        return nr >= 0 && nr < rows && nc >= 0 && nc < cols && !seen[nr][nc];
      });

      if (!options.length) { stack.pop(); continue; }

      const dir = options[Math.floor(Math.random() * options.length)];
      const nr = r + dir.dr, nc = c + dir.dc;
      cells[r][c] &= ~dir.bit;            // knock the wall out on both sides
      cells[nr][nc] &= ~dir.opposite;
      seen[nr][nc] = true;
      stack.push([nr, nc]);
    }
    return cells;
  }

  function openBetween(cells, r, c, dir) {
    return (cells[r][c] & dir.bit) === 0;
  }

  /** Shortest route between two cells. In a perfect maze it is the only route. */
  function solve(cells, from, to, rows, cols) {
    const key = (r, c) => r * cols + c;
    const cameFrom = new Map();
    const queue = [[from.r, from.c]];
    const seen = new Set([key(from.r, from.c)]);

    while (queue.length) {
      const [r, c] = queue.shift();
      if (r === to.r && c === to.c) break;
      for (const dir of DIRS) {
        if ((cells[r][c] & dir.bit) !== 0) continue;   // wall in the way
        const nr = r + dir.dr, nc = c + dir.dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        if (seen.has(key(nr, nc))) continue;
        seen.add(key(nr, nc));
        cameFrom.set(key(nr, nc), [r, c]);
        queue.push([nr, nc]);
      }
    }

    if (!seen.has(key(to.r, to.c))) return null;
    const path = [[to.r, to.c]];
    let current = key(to.r, to.c);
    while (cameFrom.has(current)) {
      const prev = cameFrom.get(current);
      path.unshift(prev);
      current = key(prev[0], prev[1]);
    }
    return path;
  }

  /* ---------- Timer ---------- */
  function startTimer() {
    if (tickTimer) return;
    state.startedAt = Date.now() - state.elapsed;
    state.running = true;
    tickTimer = window.setInterval(() => {
      state.elapsed = Date.now() - state.startedAt;
      renderStats();
    }, 200);
  }

  function stopTimer() {
    state.running = false;
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
    const value = state.best[state.sizeId];
    return typeof value === "number" ? value : null;
  }

  function recordBest() {
    const previous = bestForCurrent();
    if (previous !== null && state.elapsed >= previous) return false;
    state.best[state.sizeId] = state.elapsed;
    try { window.localStorage.setItem(BEST_KEY, JSON.stringify(state.best)); } catch (err) { /* ok */ }
    return true;
  }

  /* ---------- Game ---------- */
  function newMaze() {
    const size = SIZES[state.sizeId] || SIZES.small;
    state.cols = size.cols;
    state.rows = size.rows;
    state.cells = generate(size.rows, size.cols);
    state.player = { r: 0, c: 0 };
    state.exit = { r: size.rows - 1, c: size.cols - 1 };
    state.visited = Array.from({ length: size.rows }, () => new Array(size.cols).fill(false));
    state.visited[0][0] = true;
    state.moves = 0;
    state.elapsed = 0;
    state.finished = false;
    state.solution = null;
    stopTimer();
    draw();
    renderStats();
    setStatus("Find your way to the 🏁 flag!");
  }

  function move(dr, dc) {
    if (state.finished) return false;
    const dir = DIRS.find((d) => d.dr === dr && d.dc === dc);
    if (!dir) return false;
    const { r, c } = state.player;
    if (!openBetween(state.cells, r, c, dir)) return false;   // wall
    const nr = r + dr, nc = c + dc;
    if (!inside(nr, nc)) return false;

    state.player = { r: nr, c: nc };
    state.visited[nr][nc] = true;
    state.moves += 1;
    if (!state.running) startTimer();
    beep(420, 0.03, "sine");

    if (nr === state.exit.r && nc === state.exit.c) finish();
    draw();
    renderStats();
    return true;
  }

  function finish() {
    state.finished = true;
    stopTimer();
    state.elapsed = state.startedAt ? Date.now() - state.startedAt : state.elapsed;
    const isBest = recordBest();
    if (board) board.offer(state.elapsed, state.sizeId);
    fanfare();
    setStatus(isBest
      ? "🏆 Out in " + formatTime(state.elapsed) + " and " + state.moves + " moves — a new best!"
      : "🎉 You made it! " + state.moves + " moves in " + formatTime(state.elapsed) + ".");
  }

  function showHint() {
    if (state.finished) return;
    state.solution = solve(state.cells, state.player, state.exit, state.rows, state.cols);
    draw();
    setStatus("Following the trail costs you nothing — but see if you can beat it next time!");
  }

  /* ---------- Drawing ---------- */
  function geometry() {
    const cell = Math.floor(Math.min((W - 20) / state.cols, (H - 20) / state.rows));
    const offsetX = Math.floor((W - cell * state.cols) / 2);
    const offsetY = Math.floor((H - cell * state.rows) / 2);
    return { cell, offsetX, offsetY };
  }

  function draw() {
    const { cell, offsetX, offsetY } = geometry();
    ctx.fillStyle = "#20303a";
    ctx.fillRect(0, 0, W, H);

    // Where you have already been.
    ctx.fillStyle = "rgba(78, 205, 196, 0.16)";
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        if (state.visited[r][c]) {
          ctx.fillRect(offsetX + c * cell, offsetY + r * cell, cell, cell);
        }
      }
    }

    // Hint trail
    if (state.solution && state.solution.length > 1) {
      ctx.strokeStyle = "rgba(255, 214, 45, 0.85)";
      ctx.lineWidth = Math.max(2, cell * 0.16);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      state.solution.forEach(([r, c], i) => {
        const x = offsetX + c * cell + cell / 2;
        const y = offsetY + r * cell + cell / 2;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // Walls
    ctx.strokeStyle = "#dff1f7";
    ctx.lineWidth = Math.max(2, cell * 0.11);
    ctx.lineCap = "square";
    ctx.beginPath();
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const x = offsetX + c * cell;
        const y = offsetY + r * cell;
        const walls = state.cells[r][c];
        if (walls & N) { ctx.moveTo(x, y); ctx.lineTo(x + cell, y); }
        if (walls & Wa) { ctx.moveTo(x, y); ctx.lineTo(x, y + cell); }
        if (r === state.rows - 1 && (walls & S)) { ctx.moveTo(x, y + cell); ctx.lineTo(x + cell, y + cell); }
        if (c === state.cols - 1 && (walls & E)) { ctx.moveTo(x + cell, y); ctx.lineTo(x + cell, y + cell); }
      }
    }
    ctx.stroke();

    // Exit flag
    ctx.font = Math.floor(cell * 0.7) + "px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🏁",
      offsetX + state.exit.c * cell + cell / 2,
      offsetY + state.exit.r * cell + cell / 2);

    // Player
    ctx.fillStyle = "#ff5a5a";
    ctx.beginPath();
    ctx.arc(offsetX + state.player.c * cell + cell / 2,
            offsetY + state.player.r * cell + cell / 2,
            cell * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.arc(offsetX + state.player.c * cell + cell / 2 - cell * 0.09,
            offsetY + state.player.r * cell + cell / 2 - cell * 0.09,
            cell * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ---------- UI ---------- */
  function setStatus(text) { el.status.textContent = text; }

  function renderStats() {
    el.moves.textContent = String(state.moves);
    el.time.textContent = formatTime(state.elapsed);
    const best = bestForCurrent();
    el.best.textContent = best === null ? "—" : formatTime(best);
  }

  /* ---------- Input ---------- */
  const KEY_DIRS = {
    ArrowUp: [-1, 0], KeyW: [-1, 0],
    ArrowDown: [1, 0], KeyS: [1, 0],
    ArrowLeft: [0, -1], KeyA: [0, -1],
    ArrowRight: [0, 1], KeyD: [0, 1],
  };

  window.addEventListener("keydown", (event) => {
    const dir = KEY_DIRS[event.code];
    if (!dir) return;
    event.preventDefault();
    move(dir[0], dir[1]);
  });

  document.querySelectorAll("[data-dir]").forEach((button) => {
    button.addEventListener("click", () => {
      const [dr, dc] = button.dataset.dir.split(",").map(Number);
      move(dr, dc);
    });
  });

  let touchStart = null;
  canvas.addEventListener("pointerdown", (e) => { touchStart = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener("pointerup", (e) => {
    if (!touchStart) return;
    const dx = e.clientX - touchStart.x, dy = e.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) move(0, Math.sign(dx));
    else move(Math.sign(dy), 0);
  });

  el.restart.addEventListener("click", () => newMaze());
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
      newMaze();
      if (board) board.setCategory(state.sizeId);
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


  /* ---------- Leaderboard ---------- */
  const board = window.Leaderboard ? window.Leaderboard.create({
    gameId: "maze",
    gameName: "Maze",
    metric: { label: "Time", better: "lower", format: "time" },
    categories: [{ id: "small", label: "🐣 Small" }, { id: "medium", label: "🐤 Medium" }, { id: "large", label: "🦅 Large" }],
  }) : null;
  if (board) board.mount(document.getElementById("leaderboard-panel"));

  loadBest();
  newMaze();
  if (board) board.setCategory(state.sizeId);

  window.MazeGame = { state, generate, solve, move, newMaze, showHint, DIRS, SIZES, N, E, S, W: Wa };
})();
