/**
 * Tower Stack — a block slides back and forth; tap to drop it on the tower.
 *
 * Anything hanging over the edge of the block below is sliced off, so every
 * sloppy drop makes the next one harder. That single rule is the whole game:
 * it is self-balancing, needs no difficulty setting, and ends on its own when
 * the tower gets too narrow to hit.
 */
(function () {
  "use strict";

  const canvas = document.getElementById("stack-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const W = canvas.width;    // 480
  const H = canvas.height;   // 640

  const BLOCK_H = 30;
  const START_W = 260;
  const BASE_Y = H - 60;
  const MIN_W = 8;              // narrower than this and the tower falls
  const PERFECT = 4;            // within this many pixels counts as perfect
  const START_SPEED = 150;
  const SPEED_STEP = 7;
  const MAX_SPEED = 470;
  const VISIBLE = 12;           // how many blocks stay on screen

  const COLORS = ["#ff5a5a", "#ff8e2b", "#ffd12e", "#54bf62", "#3fc0b6", "#4a90e2", "#9b7bf7", "#ff7ac0"];

  const state = {
    phase: "ready",     // ready | playing | over
    blocks: [],         // { x, w, y, color } - y counts up from the base
    moving: null,       // { x, w, dir, speed }
    score: 0,
    perfects: 0,
    combo: 0,
    lastTime: 0,
    slices: [],         // falling offcuts, purely decorative
  };

  let soundOn = true;
  let audioCtx = null;

  const el = {
    status: document.getElementById("stack-status"),
    score: document.getElementById("stack-score"),
    height: document.getElementById("stack-height"),
    perfect: document.getElementById("stack-perfect"),
    best: document.getElementById("stack-best"),
    drop: document.getElementById("btn-drop"),
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

  /* ---------- Core rule ---------- */
  /**
   * Trim the dropped block to the part actually sitting on the one below.
   * Returns the surviving block, the overhang that falls away, and whether it
   * was close enough to count as perfect.
   */
  function trim(dropped, below) {
    const left = Math.max(dropped.x, below.x);
    const right = Math.min(dropped.x + dropped.w, below.x + below.w);
    const width = right - left;

    if (width <= 0) return { kept: null, offcut: dropped, perfect: false };

    const offset = Math.abs(dropped.x - below.x);
    if (offset <= PERFECT) {
      // Close enough: snap it flush so tiny errors do not grind the tower away.
      return { kept: { x: below.x, w: below.w }, offcut: null, perfect: true };
    }

    const offcut = dropped.x < below.x
      ? { x: dropped.x, w: below.x - dropped.x }
      : { x: right, w: dropped.x + dropped.w - right };

    return { kept: { x: left, w: width }, offcut: offcut.w > 0.5 ? offcut : null, perfect: false };
  }

  function topBlock() {
    return state.blocks[state.blocks.length - 1];
  }

  function currentSpeed() {
    return Math.min(MAX_SPEED, START_SPEED + state.blocks.length * SPEED_STEP);
  }

  function spawnMoving() {
    const top = topBlock();
    const fromLeft = Math.random() < 0.5;
    state.moving = {
      x: fromLeft ? 0 : W - top.w,
      w: top.w,
      dir: fromLeft ? 1 : -1,
      speed: currentSpeed(),
    };
  }

  /* ---------- Game ---------- */
  function newGame() {
    state.blocks = [{ x: (W - START_W) / 2, w: START_W, y: 0, color: COLORS[0] }];
    state.score = 0;
    state.perfects = 0;
    state.combo = 0;
    state.slices = [];
    state.phase = "ready";
    state.moving = null;
    syncUI();
    setStatus("Tap the tower to drop each block. Line them up!");
  }

  function startGame() {
    if (state.phase === "playing") return;
    if (state.phase === "over") { newGame(); }
    state.phase = "playing";
    spawnMoving();
    setStatus("Drop the block when it lines up!");
    syncUI();
  }

  function drop() {
    if (state.phase === "ready") { startGame(); return; }
    if (state.phase !== "playing" || !state.moving) return;

    const below = topBlock();
    const result = trim({ x: state.moving.x, w: state.moving.w }, below);

    if (!result.kept || result.kept.w < MIN_W) {
      state.phase = "over";
      state.moving = null;
      beep(150, 0.35, "sawtooth");
      if (board) board.offer(state.score);
      setStatus("💥 Missed! Your tower reached " + state.blocks.length + " blocks.");
      syncUI();
      return;
    }

    const height = state.blocks.length;
    state.blocks.push({
      x: result.kept.x,
      w: result.kept.w,
      y: height,
      color: COLORS[height % COLORS.length],
    });

    if (result.offcut) {
      state.slices.push({ x: result.offcut.x, w: result.offcut.w, y: BASE_Y - height * BLOCK_H, vy: 0 });
    }

    if (result.perfect) {
      state.perfects += 1;
      state.combo += 1;
      // Stacking neatly is what the game rewards, so perfects compound.
      state.score += 10 + state.combo * 5;
      beep(700 + state.combo * 50, 0.09, "triangle");
      setStatus(state.combo > 1 ? "🎯 Perfect ×" + state.combo + "!" : "🎯 Perfect!");
    } else {
      state.combo = 0;
      state.score += 10;
      beep(420, 0.05, "square");
      setStatus("");
    }

    spawnMoving();
    syncUI();
  }

  /* ---------- Update ---------- */
  function update(dt) {
    state.slices = state.slices.filter((slice) => {
      slice.vy += 1400 * dt;
      slice.y += slice.vy * dt;
      return slice.y < H + 60;
    });

    if (state.phase !== "playing" || !state.moving) return;

    const block = state.moving;
    block.x += block.dir * block.speed * dt;
    if (block.x <= 0) { block.x = 0; block.dir = 1; }
    else if (block.x + block.w >= W) { block.x = W - block.w; block.dir = -1; }
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
  function drawBlock(x, y, w, color, alpha) {
    ctx.save();
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, BLOCK_H - 2);
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fillRect(x, y, w, 5);
    ctx.restore();
  }

  function draw() {
    ctx.fillStyle = "#20303a";
    ctx.fillRect(0, 0, W, H);

    // Once the tower is tall the view scrolls, so it never runs off the top.
    const height = state.blocks.length;
    const lift = Math.max(0, height - VISIBLE) * BLOCK_H;

    state.blocks.forEach((block) => {
      const y = BASE_Y - block.y * BLOCK_H + lift;
      if (y < -BLOCK_H || y > H) return;
      drawBlock(block.x, y, block.w, block.color);
    });

    state.slices.forEach((slice) => {
      drawBlock(slice.x, slice.y, slice.w, "rgba(255,255,255,0.45)", 0.6);
    });

    if (state.moving) {
      const y = BASE_Y - height * BLOCK_H + lift;
      drawBlock(state.moving.x, y, state.moving.w, COLORS[height % COLORS.length]);
      // A guide line under the moving block makes lining it up learnable.
      const below = topBlock();
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.setLineDash([5, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(below.x, 0);
      ctx.lineTo(below.x, H);
      ctx.moveTo(below.x + below.w, 0);
      ctx.lineTo(below.x + below.w, H);
      ctx.stroke();
      ctx.restore();
    }

    if (state.phase !== "playing") {
      ctx.save();
      ctx.fillStyle = "rgba(32,48,58,0.74)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "700 40px Fredoka, Segoe UI, sans-serif";
      ctx.fillText(state.phase === "over" ? "Toppled!" : "Tower Stack", W / 2, H / 2 - 20);
      ctx.font = "600 19px Nunito, Segoe UI, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(state.phase === "over" ? "Score " + state.score : "Tap to start", W / 2, H / 2 + 24);
      ctx.restore();
    }
  }

  /* ---------- UI ---------- */
  function setStatus(text) { el.status.textContent = text; }

  function syncUI() {
    el.score.textContent = String(state.score);
    el.height.textContent = String(state.blocks.length);
    el.perfect.textContent = String(state.perfects);
    const stored = board ? board.entries() : [];
    el.best.textContent = stored.length ? String(stored[0].value) : "—";
    el.drop.textContent = state.phase === "over" ? "↺ Try Again"
      : state.phase === "ready" ? "▶ Start" : "⬇️ Drop";
  }

  /* ---------- Leaderboard ---------- */
  const board = window.Leaderboard ? window.Leaderboard.create({
    gameId: "tower-stack",
    gameName: "Tower Stack",
    metric: { label: "Score", better: "higher", format: "number" },
  }) : null;
  if (board) board.mount(document.getElementById("leaderboard-panel"));

  /* ---------- Input ---------- */
  canvas.addEventListener("pointerdown", (event) => {
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    if (state.phase === "over") { newGame(); return; }
    drop();
  });

  window.addEventListener("keydown", (event) => {
    if (event.code !== "Space" && event.code !== "Enter" && event.code !== "ArrowDown") return;
    event.preventDefault();
    if (state.phase === "over") { newGame(); return; }
    drop();
  });

  el.drop.addEventListener("click", () => {
    if (state.phase === "over") { newGame(); return; }
    drop();
  });
  el.restart.addEventListener("click", () => newGame());
  el.sound.addEventListener("click", () => {
    soundOn = !soundOn;
    el.sound.textContent = soundOn ? "🔊 Sound On" : "🔇 Sound Off";
    el.sound.setAttribute("aria-pressed", String(soundOn));
  });

  newGame();
  window.requestAnimationFrame(loop);

  window.TowerStackGame = {
    state, trim, drop, update, newGame, startGame, topBlock, currentSpeed, spawnMoving,
    W, H, BLOCK_H, MIN_W, PERFECT, START_W, MAX_SPEED,
  };
})();
