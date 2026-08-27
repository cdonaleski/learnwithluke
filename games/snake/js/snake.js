/**
 * Snake — grid game with keyboard, swipe and on-screen controls.
 */
(function () {
  "use strict";

  const canvas = document.getElementById("snake-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const CELL = 25;
  const COLS = canvas.width / CELL;   // 32
  const ROWS = canvas.height / CELL;  // 20

  const SPEEDS = {
    slow: { step: 0.17, label: "Slow" },
    normal: { step: 0.115, label: "Normal" },
    fast: { step: 0.072, label: "Fast" },
  };

  const POINTS_PER_FOOD = 10;
  const START_LENGTH = 4;
  const BEST_KEY = "snake-best";

  const COLORS = {
    board: "#2d3436",
    grid: "rgba(255, 255, 255, 0.05)",
    body: "#6bcb77",
    bodyAlt: "#57b463",
    head: "#a7e8ae",
    eye: "#2d3436",
    food: "#ff6b6b",
    foodShine: "rgba(255, 255, 255, 0.55)",
    text: "#ffffff",
  };

  const state = {
    phase: "idle", // idle | playing | paused | over
    speed: "normal",
    walls: true,
    score: 0,
    best: {},
    accumulator: 0,
    lastTime: 0,
    rafId: null,
  };

  let snake = [];
  let dir = { x: 1, y: 0 };
  /** Queued turns, so a fast double-tap (up then left) is not swallowed. */
  let turns = [];
  let food = { x: 0, y: 0 };
  let growth = 0;
  let audioCtx = null;
  let soundOn = true;

  const el = {
    score: document.getElementById("snake-score"),
    best: document.getElementById("snake-best"),
    length: document.getElementById("snake-length"),
    status: document.getElementById("snake-status"),
    start: document.getElementById("btn-start"),
    restart: document.getElementById("btn-restart"),
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
      osc.type = type || "square";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (err) {
      /* Sound is a nice-to-have — never break the game over it. */
    }
  }

  /* ---------- Best scores ---------- */
  function loadBest() {
    try {
      const raw = window.localStorage.getItem(BEST_KEY);
      state.best = raw ? JSON.parse(raw) : {};
      if (!state.best || typeof state.best !== "object") state.best = {};
    } catch (err) {
      state.best = {};
    }
  }

  function bestForCurrent() {
    return state.best[state.speed] || 0;
  }

  function recordBest() {
    if (state.score <= bestForCurrent()) return false;
    state.best[state.speed] = state.score;
    try {
      window.localStorage.setItem(BEST_KEY, JSON.stringify(state.best));
    } catch (err) {
      /* Private browsing — the score just won't persist. */
    }
    return true;
  }

  /* ---------- Setup ---------- */
  function newGame() {
    snake = [];
    const startY = Math.floor(ROWS / 2);
    const startX = Math.floor(COLS / 4);
    for (let i = 0; i < START_LENGTH; i++) {
      snake.push({ x: startX - i, y: startY });
    }
    dir = { x: 1, y: 0 };
    turns = [];
    growth = 0;
    state.score = 0;
    state.accumulator = 0;
    state.phase = "idle";
    placeFood();
    syncUI();
    draw();
  }

  function placeFood() {
    const free = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!snake.some((part) => part.x === x && part.y === y)) free.push({ x, y });
      }
    }
    // Only possible if the snake fills the board, which is already a win.
    if (!free.length) return;
    food = free[Math.floor(Math.random() * free.length)];
  }

  /* ---------- Turning ---------- */
  function isOpposite(a, b) {
    return a.x === -b.x && a.y === -b.y;
  }

  function queueTurn(next) {
    // Compare against the last queued turn, not the current heading, so two
    // quick presses (up, then left) both register instead of the second being
    // rejected as a reversal of the first.
    const reference = turns.length ? turns[turns.length - 1] : dir;
    if (isOpposite(next, reference)) return;
    if (next.x === reference.x && next.y === reference.y) return;
    if (turns.length < 2) turns.push(next);
    if (state.phase === "idle") startGame();
  }

  /* ---------- Step ---------- */
  function step() {
    if (turns.length) dir = turns.shift();

    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    if (state.walls) {
      if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) return gameOver();
    } else {
      head.x = (head.x + COLS) % COLS;
      head.y = (head.y + ROWS) % ROWS;
    }

    // The tail cell frees up on this same tick unless the snake is growing,
    // so moving into it is legal.
    const ignoreTail = growth === 0;
    const hitSelf = snake.some((part, i) => {
      if (ignoreTail && i === snake.length - 1) return false;
      return part.x === head.x && part.y === head.y;
    });
    if (hitSelf) return gameOver();

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
      state.score += POINTS_PER_FOOD;
      growth += 2;
      beep(660, 0.07, "square");
      placeFood();
    }

    if (growth > 0) growth -= 1;
    else snake.pop();

    syncUI();
  }

  function gameOver() {
    state.phase = "over";
    beep(150, 0.3, "sawtooth");
    const isBest = recordBest();
    if (board) board.offer(state.score, state.speed);
    setStatus(
      isBest
        ? "🏆 New best score — " + state.score + "! Press New Game to go again."
        : "💥 Game over! You scored " + state.score + ". Press New Game to try again."
    );
    syncUI();
    draw();
  }

  /* ---------- Loop ---------- */
  function update(dt) {
    if (state.phase !== "playing") return;
    state.accumulator += dt;
    const stepTime = SPEEDS[state.speed].step;
    // Cap the catch-up so a backgrounded tab does not fast-forward the snake
    // into a wall the moment it returns.
    let steps = 0;
    while (state.accumulator >= stepTime && steps < 3 && state.phase === "playing") {
      state.accumulator -= stepTime;
      steps += 1;
      step();
    }
    if (state.accumulator > stepTime) state.accumulator = 0;
  }

  function loop(timestamp) {
    state.rafId = window.requestAnimationFrame(loop);
    if (!state.lastTime) state.lastTime = timestamp;
    const dt = Math.min(0.05, (timestamp - state.lastTime) / 1000);
    state.lastTime = timestamp;
    update(dt);
    draw();
  }

  /* ---------- Draw ---------- */
  function roundRect(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
    ctx.fill();
  }

  function drawBoard() {
    ctx.fillStyle = COLORS.board;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 1; x < COLS; x++) {
      ctx.moveTo(x * CELL + 0.5, 0);
      ctx.lineTo(x * CELL + 0.5, canvas.height);
    }
    for (let y = 1; y < ROWS; y++) {
      ctx.moveTo(0, y * CELL + 0.5);
      ctx.lineTo(canvas.width, y * CELL + 0.5);
    }
    ctx.stroke();
  }

  function drawFood() {
    const cx = food.x * CELL + CELL / 2;
    const cy = food.y * CELL + CELL / 2;
    ctx.fillStyle = COLORS.food;
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.foodShine;
    ctx.beginPath();
    ctx.arc(cx - CELL * 0.11, cy - CELL * 0.12, CELL * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSnake() {
    for (let i = snake.length - 1; i >= 0; i--) {
      const part = snake[i];
      ctx.fillStyle = i === 0 ? COLORS.head : i % 2 ? COLORS.bodyAlt : COLORS.body;
      roundRect(part.x * CELL + 2, part.y * CELL + 2, CELL - 4, CELL - 4, 7);
    }

    // Eyes, so it reads as a head rather than another block.
    const head = snake[0];
    const cx = head.x * CELL + CELL / 2;
    const cy = head.y * CELL + CELL / 2;
    const along = CELL * 0.16;
    const across = CELL * 0.17;
    ctx.fillStyle = COLORS.eye;
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.arc(
        cx + dir.x * along - dir.y * across * side,
        cy + dir.y * along + dir.x * across * side,
        CELL * 0.075,
        0,
        Math.PI * 2
      );
      ctx.fill();
    });
  }

  function drawOverlay(title, subtitle) {
    ctx.save();
    ctx.fillStyle = "rgba(45, 52, 54, 0.72)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 44px Fredoka, Segoe UI, sans-serif";
    ctx.fillText(title, canvas.width / 2, canvas.height / 2 - (subtitle ? 22 : 0));
    if (subtitle) {
      ctx.font = "600 21px Nunito, Segoe UI, sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 30);
    }
    ctx.restore();
  }

  function draw() {
    drawBoard();
    drawFood();
    drawSnake();

    if (state.phase === "idle") drawOverlay("Ready?", "Press Start or an arrow key");
    else if (state.phase === "paused") drawOverlay("Paused", "Press Space to keep going");
    else if (state.phase === "over") drawOverlay("Game Over", "Score " + state.score);
  }

  /* ---------- UI ---------- */
  function setStatus(text) {
    el.status.textContent = text;
  }

  function syncUI() {
    el.score.textContent = String(state.score);
    el.best.textContent = String(bestForCurrent());
    el.length.textContent = String(snake.length);

    const running = state.phase === "playing";
    el.start.textContent = running ? "⏸ Pause" : state.phase === "paused" ? "▶ Resume" : "▶ Start";
    el.start.disabled = state.phase === "over";
  }

  /* ---------- Controls ---------- */
  function startGame() {
    if (state.phase === "over") newGame();
    if (state.phase === "idle" || state.phase === "paused") {
      state.phase = "playing";
      state.accumulator = 0;
      setStatus("Eat the apples and don't bite yourself!");
      syncUI();
    }
  }

  function pauseGame() {
    if (state.phase !== "playing") return;
    state.phase = "paused";
    setStatus("Paused.");
    syncUI();
    draw();
  }

  function togglePlay() {
    if (state.phase === "playing") pauseGame();
    else startGame();
  }

  const KEY_DIRS = {
    ArrowUp: { x: 0, y: -1 }, KeyW: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 }, KeyS: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 }, KeyA: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 }, KeyD: { x: 1, y: 0 },
  };

  window.addEventListener("keydown", (event) => {
    if (event.code === "Space") {
      event.preventDefault();
      togglePlay();
      return;
    }
    const next = KEY_DIRS[event.code];
    if (!next) return;
    event.preventDefault();
    queueTurn(next);
  });

  document.querySelectorAll("[data-dir]").forEach((button) => {
    button.addEventListener("click", () => {
      const [x, y] = button.dataset.dir.split(",").map(Number);
      queueTurn({ x, y });
    });
  });

  document.querySelectorAll("[data-speed]").forEach((button) => {
    button.addEventListener("click", () => {
      state.speed = button.dataset.speed;
      document.querySelectorAll("[data-speed]").forEach((other) => {
        const active = other === button;
        other.classList.toggle("is-active", active);
        other.setAttribute("aria-pressed", String(active));
      });
      newGame();
      if (board) board.setCategory(state.speed);
      setStatus("Speed set to " + SPEEDS[state.speed].label + ".");
    });
  });

  document.querySelectorAll("[data-walls]").forEach((button) => {
    button.addEventListener("click", () => {
      state.walls = button.dataset.walls === "on";
      document.querySelectorAll("[data-walls]").forEach((other) => {
        const active = other === button;
        other.classList.toggle("is-active", active);
        other.setAttribute("aria-pressed", String(active));
      });
      newGame();
      setStatus(state.walls ? "Walls are solid — don't touch them!" : "Walls are open — slip right through!");
    });
  });

  el.start.addEventListener("click", togglePlay);
  el.restart.addEventListener("click", () => {
    newGame();
    startGame();
  });
  el.sound.addEventListener("click", () => {
    soundOn = !soundOn;
    el.sound.textContent = soundOn ? "🔊 Sound On" : "🔇 Sound Off";
    el.sound.setAttribute("aria-pressed", String(soundOn));
  });

  /* Swipe */
  let touchStart = null;
  canvas.addEventListener("pointerdown", (event) => {
    touchStart = { x: event.clientX, y: event.clientY };
  });
  canvas.addEventListener("pointerup", (event) => {
    if (!touchStart) return;
    const dx = event.clientX - touchStart.x;
    const dy = event.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) {
      togglePlay();
      return;
    }
    queueTurn(
      Math.abs(dx) > Math.abs(dy)
        ? { x: Math.sign(dx), y: 0 }
        : { x: 0, y: Math.sign(dy) }
    );
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseGame();
  });
  window.addEventListener("blur", pauseGame);


  /* ---------- Leaderboard ---------- */
  const board = window.Leaderboard ? window.Leaderboard.create({
    gameId: "snake",
    gameName: "Snake",
    metric: { label: "Score", better: "higher", format: "number" },
    categories: [{ id: "slow", label: "🐢 Slow" }, { id: "normal", label: "🐇 Normal" }, { id: "fast", label: "🚀 Fast" }],
  }) : null;
  if (board) board.mount(document.getElementById("leaderboard-panel"));

  loadBest();
  newGame();
  if (board) board.setCategory(state.speed);
  setStatus("Press Start or an arrow key to begin!");
  state.rafId = window.requestAnimationFrame(loop);
})();
