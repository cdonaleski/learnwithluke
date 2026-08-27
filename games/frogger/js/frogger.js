/**
 * Frogger — hop across the road, then ride the logs over the river.
 *
 * The two halves work in opposite ways, which is the whole idea: on the road
 * touching something kills you, and on the river touching nothing kills you.
 * A frog on a log is carried along with it, so the river is about timing your
 * hops rather than dodging.
 */
(function () {
  "use strict";

  const canvas = document.getElementById("frogger-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const COLS = 13;
  const ROWS = 14;
  const CELL = 44;
  const W = COLS * CELL;      // 572
  const H = ROWS * CELL;      // 616

  const LEVELS = {
    easy: { label: "🐢 Easy", speed: 0.75, lives: 5 },
    medium: { label: "🐇 Medium", speed: 1, lives: 3 },
    hard: { label: "🚀 Hard", speed: 1.35, lives: 3 },
  };

  /**
   * Row 13 is the start bank, 7 is the middle bank, 0 is home.
   * Rows 8-12 are the road, rows 1-5 the river.
   */
  const LANES = [
    { row: 12, kind: "road", dir: 1, speed: 70, gap: 4.0, size: 2, sprite: "🚗" },
    { row: 11, kind: "road", dir: -1, speed: 95, gap: 4.6, size: 1, sprite: "🚕" },
    { row: 10, kind: "road", dir: 1, speed: 120, gap: 5.2, size: 1, sprite: "🚙" },
    { row: 9, kind: "road", dir: -1, speed: 150, gap: 6.0, size: 2, sprite: "🚚" },
    { row: 8, kind: "road", dir: 1, speed: 190, gap: 6.6, size: 1, sprite: "🏎️" },
    { row: 5, kind: "river", dir: -1, speed: 80, gap: 5.0, size: 3, sprite: "🪵" },
    { row: 4, kind: "river", dir: 1, speed: 110, gap: 5.4, size: 2, sprite: "🐢" },
    { row: 3, kind: "river", dir: -1, speed: 140, gap: 6.0, size: 3, sprite: "🪵" },
    { row: 2, kind: "river", dir: 1, speed: 95, gap: 5.0, size: 2, sprite: "🪵" },
    { row: 1, kind: "river", dir: -1, speed: 165, gap: 6.4, size: 2, sprite: "🐢" },
  ];

  const HOME_SLOTS = [1, 4, 6, 8, 11];
  const START = { col: 6, row: 13 };
  const LEVEL_KEY = "frogger-level";

  const state = {
    levelId: "easy",
    phase: "ready",       // ready | playing | over
    frog: { col: START.col, row: START.row, x: START.col * CELL },
    lanes: [],
    homes: [],            // which home slots are filled
    lives: 3,
    score: 0,
    stage: 1,
    highestRow: START.row,
    lastTime: 0,
    flash: 0,
  };

  let soundOn = true;
  let audioCtx = null;

  const el = {
    status: document.getElementById("frogger-status"),
    score: document.getElementById("frogger-score"),
    lives: document.getElementById("frogger-lives"),
    homes: document.getElementById("frogger-homes"),
    best: document.getElementById("frogger-best"),
    start: document.getElementById("btn-start"),
    restart: document.getElementById("btn-restart"),
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
      osc.type = type || "square";
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

  /* ---------- Lanes ---------- */
  function buildLanes() {
    const boost = level().speed * (1 + (state.stage - 1) * 0.12);
    return LANES.map((lane) => {
      const spacing = lane.gap * CELL;
      const items = [];
      const span = W + spacing * 2;
      for (let x = -spacing; x < span; x += spacing) {
        items.push({ x: x + Math.random() * spacing * 0.3 });
      }
      return {
        row: lane.row,
        kind: lane.kind,
        dir: lane.dir,
        speed: lane.speed * boost,
        width: lane.size * CELL,
        sprite: lane.sprite,
        spacing: spacing,
        items: items,
      };
    });
  }

  function laneAt(row) {
    return state.lanes.find((lane) => lane.row === row) || null;
  }

  function moveLanes(dt) {
    state.lanes.forEach((lane) => {
      const travel = lane.dir * lane.speed * dt;
      lane.items.forEach((item) => {
        item.x += travel;
        // Wrap round rather than respawn, so gaps stay even and learnable.
        const span = lane.items.length * lane.spacing;
        if (item.x > W + lane.spacing) item.x -= span;
        else if (item.x + lane.width < -lane.spacing) item.x += span;
      });
    });
  }

  /* ---------- Collisions ---------- */
  function frogBox() {
    return { x: state.frog.x + 6, w: CELL - 12 };
  }

  function overlaps(a, aw, b, bw) {
    return a < b + bw && b < a + aw;
  }

  /** The log or turtle the frog is standing on, if any. */
  function carrierUnderFrog() {
    const lane = laneAt(state.frog.row);
    if (!lane || lane.kind !== "river") return null;
    const box = frogBox();
    for (const item of lane.items) {
      if (overlaps(box.x, box.w, item.x, lane.width)) return { lane: lane, item: item };
    }
    return null;
  }

  function hitByTraffic() {
    const lane = laneAt(state.frog.row);
    if (!lane || lane.kind !== "road") return false;
    const box = frogBox();
    return lane.items.some((item) => overlaps(box.x, box.w, item.x + 4, lane.width - 8));
  }

  /* ---------- Movement ---------- */
  function hop(dCol, dRow) {
    if (state.phase !== "playing") return;
    const nextRow = state.frog.row + dRow;
    const nextCol = Math.round(state.frog.x / CELL) + dCol;
    if (nextRow < 0 || nextRow >= ROWS) return;
    if (nextCol < 0 || nextCol >= COLS) return;

    state.frog.row = nextRow;
    state.frog.col = nextCol;
    state.frog.x = nextCol * CELL;
    beep(560, 0.04, "square");

    // Points for getting further than you have before this life.
    if (nextRow < state.highestRow) {
      state.score += 10;
      state.highestRow = nextRow;
    }

    if (nextRow === 0) reachHome();
    else checkFrog();
  }

  function reachHome() {
    const slot = HOME_SLOTS.indexOf(Math.round(state.frog.x / CELL));
    if (slot === -1 || state.homes[slot]) {
      // Landed on the bank between the lily pads.
      loseLife("You need to land on a lily pad!");
      return;
    }
    state.homes[slot] = true;
    state.score += 60;
    beep(880, 0.14, "triangle");

    if (state.homes.every(Boolean)) {
      state.stage += 1;
      state.score += 250;
      state.homes = HOME_SLOTS.map(() => false);
      state.lanes = buildLanes();
      fanfare();
      setStatus("🎉 All five frogs home! +250. Stage " + state.stage + " is faster.");
    } else {
      const left = state.homes.filter((h) => !h).length;
      setStatus("🏡 Home! " + left + " lily pad" + (left === 1 ? "" : "s") + " to go.");
    }
    resetFrog();
    syncUI();
  }

  function checkFrog() {
    if (state.phase !== "playing") return;
    const lane = laneAt(state.frog.row);
    if (!lane) return;

    if (lane.kind === "road" && hitByTraffic()) { loseLife("🚗 Squashed!"); return; }
    if (lane.kind === "river" && !carrierUnderFrog()) { loseLife("💦 Splash!"); return; }
  }

  function resetFrog() {
    state.frog.row = START.row;
    state.frog.col = START.col;
    state.frog.x = START.col * CELL;
    state.highestRow = START.row;
  }

  function loseLife(reason) {
    state.lives -= 1;
    state.flash = 0.5;
    beep(170, 0.28, "sawtooth");
    if (state.lives <= 0) {
      state.phase = "over";
      if (board) board.offer(state.score, state.levelId);
      setStatus(reason + " Out of lives — you scored " + state.score + ".");
      syncUI();
      return;
    }
    resetFrog();
    setStatus(reason + " " + state.lives + " " + (state.lives === 1 ? "life" : "lives") + " left.");
    syncUI();
  }

  /* ---------- Update ---------- */
  function update(dt) {
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt);
    if (state.phase !== "playing") return;

    moveLanes(dt);

    // A frog on a log rides along with it.
    const carrier = carrierUnderFrog();
    if (carrier) {
      state.frog.x += carrier.lane.dir * carrier.lane.speed * dt;
      if (state.frog.x < -CELL * 0.4 || state.frog.x > W - CELL * 0.6) {
        loseLife("🌊 Carried off the edge!");
        return;
      }
    }

    checkFrog();
  }

  function loop(timestamp) {
    window.requestAnimationFrame(loop);
    if (!state.lastTime) state.lastTime = timestamp;
    const dt = Math.min(0.05, (timestamp - state.lastTime) / 1000);
    state.lastTime = timestamp;
    update(dt);
    draw();
  }

  /* ---------- Draw ---------- */
  function draw() {
    // Banks, road and river
    ctx.fillStyle = "#3b7a3b";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#2b3a44";
    ctx.fillRect(0, 8 * CELL, W, 5 * CELL);
    ctx.fillStyle = "#2f6fd0";
    ctx.fillRect(0, 1 * CELL, W, 5 * CELL);
    ctx.fillStyle = "#5a9e5a";
    ctx.fillRect(0, 7 * CELL, W, CELL);
    ctx.fillRect(0, 13 * CELL, W, CELL);

    // Lane markings
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.setLineDash([14, 14]);
    ctx.lineWidth = 2;
    for (let r = 9; r <= 12; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL);
      ctx.lineTo(W, r * CELL);
      ctx.stroke();
    }
    ctx.restore();

    // Lily pads
    ctx.font = Math.floor(CELL * 0.72) + "px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    HOME_SLOTS.forEach((col, i) => {
      ctx.fillStyle = state.homes[i] ? "#54bf62" : "#245b24";
      ctx.fillRect(col * CELL + 3, 3, CELL - 6, CELL - 6);
      ctx.fillText(state.homes[i] ? "🐸" : "🪷", col * CELL + CELL / 2, CELL / 2);
    });

    state.lanes.forEach((lane) => {
      const y = lane.row * CELL + CELL / 2;
      lane.items.forEach((item) => {
        if (lane.kind === "river") {
          ctx.fillStyle = lane.sprite === "🪵" ? "#8a5a2b" : "#2e8b45";
          ctx.fillRect(item.x, lane.row * CELL + 5, lane.width, CELL - 10);
        }
        for (let i = 0; i < Math.max(1, Math.round(lane.width / CELL)); i++) {
          ctx.fillText(lane.sprite, item.x + CELL / 2 + i * CELL, y);
        }
      });
    });

    // Frog
    ctx.fillText("🐸", state.frog.x + CELL / 2, state.frog.row * CELL + CELL / 2);

    if (state.flash > 0) {
      ctx.save();
      ctx.globalAlpha = state.flash;
      ctx.fillStyle = "#ff5a5a";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    if (state.phase !== "playing") {
      ctx.save();
      ctx.fillStyle = "rgba(20,30,36,0.74)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff";
      ctx.font = "700 40px Fredoka, Segoe UI, sans-serif";
      ctx.fillText(state.phase === "over" ? "Game Over" : "Ready?", W / 2, H / 2 - 18);
      ctx.font = "600 19px Nunito, Segoe UI, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(state.phase === "over" ? "Score " + state.score : "Press Start or an arrow key",
        W / 2, H / 2 + 24);
      ctx.restore();
    }
  }

  /* ---------- UI ---------- */
  function setStatus(text) { el.status.textContent = text; }

  function syncUI() {
    el.score.textContent = String(state.score);
    el.lives.textContent = String(Math.max(0, state.lives));
    el.homes.textContent = state.homes.filter(Boolean).length + "/5";
    const stored = board ? board.entries(state.levelId) : [];
    el.best.textContent = stored.length ? String(stored[0].value) : "—";
    el.start.textContent = state.phase === "playing" ? "🐸 Playing" : "▶ Start";
    el.start.disabled = state.phase === "playing";
  }

  function newGame() {
    state.lanes = buildLanes();
    state.homes = HOME_SLOTS.map(() => false);
    state.lives = level().lives;
    state.score = 0;
    state.stage = 1;
    state.phase = "ready";
    resetFrog();
    syncUI();
    setStatus("Hop across the road, then ride the logs over the river!");
  }

  function startGame() {
    if (state.phase === "playing") return;
    if (state.phase === "over") newGame();
    state.phase = "playing";
    setStatus("Go! Use the arrows to hop.");
    syncUI();
  }

  /* ---------- Leaderboard ---------- */
  const board = window.Leaderboard ? window.Leaderboard.create({
    gameId: "frogger",
    gameName: "Frogger",
    metric: { label: "Score", better: "higher", format: "number" },
    categories: [{ id: "easy", label: "🐢 Easy" }, { id: "medium", label: "🐇 Medium" }, { id: "hard", label: "🚀 Hard" }],
  }) : null;
  if (board) board.mount(document.getElementById("leaderboard-panel"));

  /* ---------- Input ---------- */
  const KEYS = {
    ArrowUp: [0, -1], KeyW: [0, -1],
    ArrowDown: [0, 1], KeyS: [0, 1],
    ArrowLeft: [-1, 0], KeyA: [-1, 0],
    ArrowRight: [1, 0], KeyD: [1, 0],
  };

  window.addEventListener("keydown", (event) => {
    const move = KEYS[event.code];
    if (!move) return;
    event.preventDefault();
    if (state.phase !== "playing") { startGame(); return; }
    hop(move[0], move[1]);
  });

  document.querySelectorAll("[data-hop]").forEach((button) => {
    button.addEventListener("click", () => {
      const [dc, dr] = button.dataset.hop.split(",").map(Number);
      if (state.phase !== "playing") { startGame(); return; }
      hop(dc, dr);
    });
  });

  let touchStart = null;
  canvas.addEventListener("pointerdown", (e) => { touchStart = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener("pointerup", (e) => {
    if (!touchStart) return;
    const dx = e.clientX - touchStart.x, dy = e.clientY - touchStart.y;
    touchStart = null;
    if (state.phase !== "playing") { startGame(); return; }
    if (Math.abs(dx) < 18 && Math.abs(dy) < 18) { hop(0, -1); return; }
    if (Math.abs(dx) > Math.abs(dy)) hop(Math.sign(dx), 0);
    else hop(0, Math.sign(dy));
  });

  el.start.addEventListener("click", startGame);
  el.restart.addEventListener("click", () => newGame());
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
      if (board) board.setCategory(state.levelId);
      newGame();
    });
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

  if (board) board.setCategory(state.levelId);
  newGame();
  window.requestAnimationFrame(loop);

  window.FroggerGame = {
    state, hop, update, newGame, startGame, buildLanes, laneAt, carrierUnderFrog,
    hitByTraffic, checkFrog, resetFrog, moveLanes, LANES, HOME_SLOTS, COLS, ROWS, CELL, W, H, START,
  };
})();
