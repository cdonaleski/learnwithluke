/**
 * Breakout — bounce the ball into the bricks until they are all gone.
 *
 * Where the ball hits the paddle decides the angle, so the paddle is a steering
 * wheel rather than a wall: hit it with the edge to send the ball sharply
 * sideways. Collisions are resolved on the axis of least overlap, which is what
 * stops a ball clipping a brick corner and carrying on through the wall behind.
 */
(function () {
  "use strict";

  const canvas = document.getElementById("breakout-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const W = canvas.width;    // 720
  const H = canvas.height;   // 560

  const LEVELS = {
    easy: { label: "🐢 Easy", paddle: 130, speed: 300, lives: 5, rows: 4 },
    medium: { label: "🐇 Medium", paddle: 105, speed: 370, lives: 3, rows: 5 },
    hard: { label: "🚀 Hard", paddle: 84, speed: 440, lives: 3, rows: 6 },
  };

  const COLS = 10;
  const BRICK_H = 26;
  const BRICK_GAP = 5;
  const BRICK_TOP = 60;
  const BALL_R = 8;
  const PADDLE_H = 14;
  const PADDLE_Y = H - 42;
  const PADDLE_SPEED = 620;
  const MAX_BOUNCE = (60 * Math.PI) / 180;
  const SPEED_UP = 1.03;
  const MAX_SPEED = 720;
  const MAX_STEP = 1 / 240;
  const LEVEL_KEY = "breakout-level";

  const ROW_COLORS = ["#ff5a5a", "#ff8e2b", "#ffd12e", "#54bf62", "#3fc0b6", "#9b7bf7"];

  const state = {
    levelId: "easy",
    phase: "ready",     // ready | playing | paused | over | cleared
    bricks: [],
    score: 0,
    lives: 3,
    stage: 1,
    combo: 0,
    lastTime: 0,
  };

  const paddle = { x: W / 2, w: 130, left: false, right: false };
  const ball = { x: W / 2, y: PADDLE_Y - BALL_R - 2, vx: 0, vy: 0, stuck: true };
  let pointerX = null;
  let soundOn = true;
  let audioCtx = null;

  const el = {
    status: document.getElementById("breakout-status"),
    score: document.getElementById("breakout-score"),
    lives: document.getElementById("breakout-lives"),
    stage: document.getElementById("breakout-stage"),
    best: document.getElementById("breakout-best"),
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

  /* ---------- Board ---------- */
  function brickWidth() {
    return (W - BRICK_GAP * (COLS + 1)) / COLS;
  }

  function buildBricks(rows) {
    const out = [];
    const bw = brickWidth();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < COLS; c++) {
        out.push({
          x: BRICK_GAP + c * (bw + BRICK_GAP),
          y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
          w: bw,
          h: BRICK_H,
          alive: true,
          // The rows at the top are worth more, and take two hits from stage 2.
          points: (rows - r) * 10,
          hits: 1,
          color: ROW_COLORS[r % ROW_COLORS.length],
        });
      }
    }
    return out;
  }

  function bricksLeft() {
    return state.bricks.filter((b) => b.alive).length;
  }

  /* ---------- Ball ---------- */
  function resetBall() {
    ball.stuck = true;
    ball.x = paddle.x;
    ball.y = PADDLE_Y - BALL_R - 2;
    ball.vx = 0;
    ball.vy = 0;
  }

  function launchBall() {
    if (!ball.stuck) return;
    const speed = level().speed + (state.stage - 1) * 20;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.5;
    ball.vx = Math.cos(angle) * speed;
    ball.vy = Math.sin(angle) * speed;
    ball.stuck = false;
    state.combo = 0;
    beep(420, 0.06, "square");
  }

  /** Where the ball lands on the paddle sets the angle - edges send it wide. */
  function bounceOffPaddle() {
    const offset = (ball.x - paddle.x) / (paddle.w / 2);
    const clamped = Math.max(-1, Math.min(1, offset));
    const angle = clamped * MAX_BOUNCE;
    const speed = Math.min(MAX_SPEED, Math.hypot(ball.vx, ball.vy) * SPEED_UP);
    ball.vx = speed * Math.sin(angle);
    ball.vy = -Math.abs(speed * Math.cos(angle));
    ball.y = PADDLE_Y - BALL_R - 0.5;
    state.combo = 0;
    beep(520 + Math.abs(clamped) * 200, 0.05, "square");
  }

  /**
   * Bounce off the side we actually came through. Comparing the overlap on each
   * axis and reflecting the smaller one keeps a corner clip from letting the
   * ball through the brick.
   */
  function hitBrick(brick) {
    const overlapX = Math.min(ball.x + BALL_R - brick.x, brick.x + brick.w - (ball.x - BALL_R));
    const overlapY = Math.min(ball.y + BALL_R - brick.y, brick.y + brick.h - (ball.y - BALL_R));

    if (overlapX < overlapY) {
      ball.vx = -ball.vx;
      ball.x += ball.vx > 0 ? overlapX : -overlapX;
    } else {
      ball.vy = -ball.vy;
      ball.y += ball.vy > 0 ? overlapY : -overlapY;
    }

    brick.hits -= 1;
    if (brick.hits > 0) {
      beep(300, 0.04, "square");
      return;
    }

    brick.alive = false;
    state.combo += 1;
    // Clearing several without touching the paddle is worth more.
    state.score += brick.points * Math.min(state.combo, 5);
    beep(600 + state.combo * 40, 0.05, "triangle");
  }

  function loseLife() {
    state.lives -= 1;
    beep(160, 0.3, "sawtooth");
    if (state.lives <= 0) {
      state.phase = "over";
      if (board) board.offer(state.score, state.levelId);
      setStatus("💥 Out of balls! You scored " + state.score + ".");
      syncUI();
      return;
    }
    resetBall();
    setStatus("Lost one! " + state.lives + " ball" + (state.lives === 1 ? "" : "s") + " left. Tap to launch.");
    syncUI();
  }

  function clearStage() {
    state.stage += 1;
    state.score += 200;
    fanfare();
    const rows = Math.min(level().rows + Math.floor(state.stage / 2), ROW_COLORS.length);
    state.bricks = buildBricks(rows);
    // From stage 2 the top row needs two hits.
    if (state.stage >= 2) {
      state.bricks.filter((b) => b.y === BRICK_TOP).forEach((b) => { b.hits = 2; });
    }
    resetBall();
    setStatus("🎉 Wall cleared! +200. Here comes stage " + state.stage + ".");
    syncUI();
  }

  /* ---------- Update ---------- */
  function movePaddle(dt) {
    if (pointerX !== null) {
      paddle.x = pointerX;
    } else {
      if (paddle.left) paddle.x -= PADDLE_SPEED * dt;
      if (paddle.right) paddle.x += PADDLE_SPEED * dt;
    }
    paddle.x = Math.max(paddle.w / 2, Math.min(W - paddle.w / 2, paddle.x));
    if (ball.stuck) { ball.x = paddle.x; ball.y = PADDLE_Y - BALL_R - 2; }
  }

  function stepBall(dt) {
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x - BALL_R <= 0 && ball.vx < 0) { ball.x = BALL_R; ball.vx = -ball.vx; beep(360, 0.03, "sine"); }
    else if (ball.x + BALL_R >= W && ball.vx > 0) { ball.x = W - BALL_R; ball.vx = -ball.vx; beep(360, 0.03, "sine"); }
    if (ball.y - BALL_R <= 0 && ball.vy < 0) { ball.y = BALL_R; ball.vy = -ball.vy; beep(360, 0.03, "sine"); }

    if (ball.vy > 0 &&
        ball.y + BALL_R >= PADDLE_Y &&
        ball.y - BALL_R <= PADDLE_Y + PADDLE_H &&
        Math.abs(ball.x - paddle.x) <= paddle.w / 2 + BALL_R) {
      bounceOffPaddle();
    }

    for (const brick of state.bricks) {
      if (!brick.alive) continue;
      if (ball.x + BALL_R < brick.x || ball.x - BALL_R > brick.x + brick.w) continue;
      if (ball.y + BALL_R < brick.y || ball.y - BALL_R > brick.y + brick.h) continue;
      hitBrick(brick);
      break;                     // one brick per step, so the bounce stays sane
    }

    if (ball.y - BALL_R > H) loseLife();
  }

  function update(dt) {
    if (state.phase !== "playing") return;
    movePaddle(dt);
    if (ball.stuck) return;

    let remaining = dt;
    while (remaining > 0 && state.phase === "playing" && !ball.stuck) {
      const slice = Math.min(MAX_STEP, remaining);
      remaining -= slice;
      stepBall(slice);
    }

    if (state.phase === "playing" && bricksLeft() === 0) clearStage();
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

  function draw() {
    ctx.fillStyle = "#20303a";
    ctx.fillRect(0, 0, W, H);

    state.bricks.forEach((brick) => {
      if (!brick.alive) return;
      ctx.fillStyle = brick.color;
      ctx.globalAlpha = brick.hits > 1 ? 1 : 0.92;
      roundRect(brick.x, brick.y, brick.w, brick.h, 6);
      ctx.globalAlpha = 1;
      if (brick.hits > 1) {
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        roundRect(brick.x + 5, brick.y + 5, brick.w - 10, 4, 2);
      }
    });

    ctx.fillStyle = "#dff1f7";
    roundRect(paddle.x - paddle.w / 2, PADDLE_Y, paddle.w, PADDLE_H, 7);

    ctx.fillStyle = "#ffd12e";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.arc(ball.x - 2.5, ball.y - 2.5, BALL_R * 0.35, 0, Math.PI * 2);
    ctx.fill();

    if (state.phase !== "playing") {
      ctx.save();
      ctx.fillStyle = "rgba(32,48,58,0.74)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "700 44px Fredoka, Segoe UI, sans-serif";
      const title = state.phase === "over" ? "Game Over"
        : state.phase === "paused" ? "Paused" : "Ready?";
      ctx.fillText(title, W / 2, H / 2 - 18);
      ctx.font = "600 20px Nunito, Segoe UI, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(state.phase === "over" ? "Score " + state.score : "Tap or press Space", W / 2, H / 2 + 26);
      ctx.restore();
    }
  }

  /* ---------- UI ---------- */
  function setStatus(text) { el.status.textContent = text; }

  function syncUI() {
    el.score.textContent = String(state.score);
    el.lives.textContent = String(Math.max(0, state.lives));
    el.stage.textContent = String(state.stage);
    const stored = board ? board.entries(state.levelId) : [];
    el.best.textContent = stored.length ? String(stored[0].value) : "—";
    el.start.textContent = state.phase === "playing" ? "⏸ Pause"
      : state.phase === "paused" ? "▶ Resume" : "▶ Start";
    el.start.disabled = state.phase === "over";
  }

  function newGame() {
    const cfg = level();
    paddle.w = cfg.paddle;
    paddle.x = W / 2;
    state.bricks = buildBricks(cfg.rows);
    state.score = 0;
    state.lives = cfg.lives;
    state.stage = 1;
    state.combo = 0;
    state.phase = "ready";
    resetBall();
    syncUI();
    setStatus("Tap the board or press Space to launch the ball!");
  }

  function startGame() {
    if (state.phase === "over") { newGame(); return; }
    if (state.phase === "ready" || state.phase === "paused") {
      state.phase = "playing";
      if (ball.stuck) launchBall();
      setStatus("Knock out every brick!");
      syncUI();
    }
  }

  function pauseGame() {
    if (state.phase !== "playing") return;
    state.phase = "paused";
    setStatus("Paused.");
    syncUI();
  }

  function togglePlay() {
    if (state.phase === "playing") pauseGame(); else startGame();
  }

  /* ---------- Leaderboard ---------- */
  const board = window.Leaderboard ? window.Leaderboard.create({
    gameId: "breakout",
    gameName: "Breakout",
    metric: { label: "Score", better: "higher", format: "number" },
    categories: [{ id: "easy", label: "🐢 Easy" }, { id: "medium", label: "🐇 Medium" }, { id: "hard", label: "🚀 Hard" }],
  }) : null;
  if (board) board.mount(document.getElementById("leaderboard-panel"));

  /* ---------- Input ---------- */
  function pointerToCourtX(clientX) {
    const rect = canvas.getBoundingClientRect();
    return (clientX - rect.left) * (W / rect.width);
  }

  canvas.addEventListener("pointermove", (event) => { pointerX = pointerToCourtX(event.clientX); });
  canvas.addEventListener("pointerdown", (event) => {
    pointerX = pointerToCourtX(event.clientX);
    if (state.phase === "ready" || state.phase === "paused") startGame();
    else if (state.phase === "playing" && ball.stuck) launchBall();
  });
  canvas.addEventListener("pointerleave", () => { pointerX = null; });

  window.addEventListener("keydown", (event) => {
    if (event.code === "ArrowLeft" || event.code === "KeyA") { event.preventDefault(); pointerX = null; paddle.left = true; }
    else if (event.code === "ArrowRight" || event.code === "KeyD") { event.preventDefault(); pointerX = null; paddle.right = true; }
    else if (event.code === "Space") {
      event.preventDefault();
      if (state.phase === "playing" && ball.stuck) launchBall(); else togglePlay();
    }
  });
  window.addEventListener("keyup", (event) => {
    if (event.code === "ArrowLeft" || event.code === "KeyA") paddle.left = false;
    if (event.code === "ArrowRight" || event.code === "KeyD") paddle.right = false;
  });

  el.start.addEventListener("click", togglePlay);
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

  document.addEventListener("visibilitychange", () => { if (document.hidden) pauseGame(); });
  window.addEventListener("blur", pauseGame);

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

  window.BreakoutGame = {
    state, paddle, ball, LEVELS, W, H, PADDLE_Y, BALL_R,
    buildBricks, bricksLeft, hitBrick, bounceOffPaddle, stepBall, update, newGame,
    startGame, launchBall, resetBall, level, brickWidth,
  };
})();
