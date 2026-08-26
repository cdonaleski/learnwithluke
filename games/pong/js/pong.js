/**
 * Pong for Learn With Luke
 * Classic paddle game — one player vs the computer, or two players on one keyboard.
 */
(function () {
  "use strict";

  const canvas = document.getElementById("pong-canvas");
  if (!canvas || !canvas.getContext) return;

  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  /* ---------- Tuning ---------- */
  const WIN_SCORE = 7;
  const PADDLE_W = 16;
  const PADDLE_H = 96;
  const PADDLE_MARGIN = 28;
  const PADDLE_SPEED = 560;
  const BALL_R = 10;
  const BALL_START_SPEED = 340;
  const BALL_MAX_SPEED = 760;
  const BALL_SPEED_UP = 1.05;
  const MAX_BOUNCE_ANGLE = Math.PI / 3.6; // 50 degrees
  const SERVE_DELAY = 1.2;
  const MAX_STEP = 1 / 120;

  const LEFT_X = PADDLE_MARGIN;
  const RIGHT_X = W - PADDLE_MARGIN - PADDLE_W;

  const DIFFICULTY = {
    easy: { speed: 235, reaction: 0.26, error: 48 },
    medium: { speed: 340, reaction: 0.15, error: 26 },
    hard: { speed: 470, reaction: 0.07, error: 9 },
  };

  const COLORS = {
    court: "#2d3436",
    line: "rgba(255, 255, 255, 0.22)",
    left: "#ff6b6b",
    right: "#4ecdc4",
    ball: "#ffe66d",
    text: "#ffffff",
  };

  /* ---------- State ---------- */
  const state = {
    mode: "cpu", // "cpu" | "two"
    difficulty: "easy",
    phase: "idle", // idle | serving | playing | paused | over
    scores: { left: 0, right: 0 },
    serveTimer: 0,
    serveDir: 1,
    winner: null,
    soundOn: true,
    lastTime: 0,
    rafId: null,
  };

  const left = { y: H / 2, up: false, down: false };
  const right = { y: H / 2, up: false, down: false, targetY: H / 2, think: 0 };
  const ball = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
  let trail = [];
  let pointerY = null;

  /* ---------- Elements ---------- */
  const el = {
    scoreLeft: document.getElementById("score-left"),
    scoreRight: document.getElementById("score-right"),
    nameLeft: document.getElementById("score-name-left"),
    nameRight: document.getElementById("score-name-right"),
    status: document.getElementById("pong-status"),
    start: document.getElementById("btn-start"),
    restart: document.getElementById("btn-restart"),
    sound: document.getElementById("btn-sound"),
    difficultyGroup: document.getElementById("difficulty-group"),
  };

  /* ---------- Sound ---------- */
  let audioCtx = null;

  function beep(freq, duration, type) {
    if (!state.soundOn) return;
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
      /* Audio is a nice-to-have — never break the game over it. */
    }
  }

  function playFanfare() {
    [523, 659, 784, 1047].forEach((freq, i) => {
      window.setTimeout(() => beep(freq, 0.18, "triangle"), i * 130);
    });
  }

  /* ---------- Helpers ---------- */
  function playerName(side) {
    if (side === "left") return state.mode === "cpu" ? "You" : "Player 1";
    return state.mode === "cpu" ? "Computer" : "Player 2";
  }

  function clampPaddle(paddle) {
    const half = PADDLE_H / 2;
    paddle.y = Math.max(half, Math.min(H - half, paddle.y));
  }

  function roundRect(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }

  /* ---------- Game flow ---------- */
  function newGame() {
    state.scores.left = 0;
    state.scores.right = 0;
    state.winner = null;
    left.y = H / 2;
    right.y = H / 2;
    right.targetY = H / 2;
    pointerY = null;
    trail = [];
    resetBall(Math.random() < 0.5 ? -1 : 1);
    state.phase = "idle";
    syncUI();
    draw();
  }

  function resetBall(dir) {
    ball.x = W / 2;
    ball.y = H / 2;
    ball.vx = 0;
    ball.vy = 0;
    trail = [];
    state.serveDir = dir;
    state.serveTimer = SERVE_DELAY;
  }

  function launchBall() {
    const angle = (Math.random() * 2 - 1) * (Math.PI / 6);
    ball.vx = state.serveDir * BALL_START_SPEED * Math.cos(angle);
    ball.vy = BALL_START_SPEED * Math.sin(angle);
    state.phase = "playing";
    syncUI();
  }

  function startGame() {
    if (state.phase === "over") {
      newGame();
    }
    if (state.phase === "idle") {
      state.phase = "serving";
      state.serveTimer = SERVE_DELAY;
    } else if (state.phase === "paused") {
      state.phase = ball.vx === 0 && ball.vy === 0 ? "serving" : "playing";
    }
    canvas.focus();
    syncUI();
  }

  function pauseGame() {
    if (state.phase === "playing" || state.phase === "serving") {
      state.phase = "paused";
      syncUI();
      draw();
    }
  }

  function togglePlay() {
    if (state.phase === "playing" || state.phase === "serving") pauseGame();
    else startGame();
  }

  function scorePoint(side) {
    state.scores[side] += 1;
    beep(180, 0.22, "sawtooth");

    if (state.scores[side] >= WIN_SCORE) {
      state.winner = side;
      state.phase = "over";
      ball.vx = 0;
      ball.vy = 0;
      playFanfare();
    } else {
      // Serve towards whoever just got scored on, so they get the ball.
      resetBall(side === "left" ? 1 : -1);
      state.phase = "serving";
    }
    syncUI();
  }

  /* ---------- Update ---------- */
  function predictBallY() {
    if (ball.vx <= 0) return H / 2;
    const targetX = RIGHT_X - BALL_R;
    const time = (targetX - ball.x) / ball.vx;
    const span = H - 2 * BALL_R;
    let y = ball.y + ball.vy * time - BALL_R;
    y = ((y % (2 * span)) + 2 * span) % (2 * span);
    if (y > span) y = 2 * span - y;
    return y + BALL_R;
  }

  function updateCpu(dt) {
    const cfg = DIFFICULTY[state.difficulty];
    right.think -= dt;
    if (right.think <= 0) {
      right.think = cfg.reaction;
      right.targetY =
        ball.vx > 0
          ? predictBallY() + (Math.random() * 2 - 1) * cfg.error
          : H / 2 + (Math.random() * 2 - 1) * cfg.error * 0.5;
    }
    const diff = right.targetY - right.y;
    const step = cfg.speed * dt;
    right.y += Math.abs(diff) <= step ? diff : Math.sign(diff) * step;
    clampPaddle(right);
  }

  function updatePaddles(dt) {
    // Left paddle: pointer wins if it is being used, otherwise keys.
    if (pointerY !== null) {
      left.y = pointerY;
    } else {
      if (left.up) left.y -= PADDLE_SPEED * dt;
      if (left.down) left.y += PADDLE_SPEED * dt;
    }
    clampPaddle(left);

    if (state.mode === "cpu") {
      updateCpu(dt);
    } else {
      if (right.up) right.y -= PADDLE_SPEED * dt;
      if (right.down) right.y += PADDLE_SPEED * dt;
      clampPaddle(right);
    }
  }

  function bounceOffPaddle(paddle, dir) {
    const relative = (ball.y - paddle.y) / (PADDLE_H / 2);
    const clamped = Math.max(-1, Math.min(1, relative));
    const angle = clamped * MAX_BOUNCE_ANGLE;
    const speed = Math.min(
      BALL_MAX_SPEED,
      Math.hypot(ball.vx, ball.vy) * BALL_SPEED_UP
    );
    ball.vx = dir * speed * Math.cos(angle);
    ball.vy = speed * Math.sin(angle);
    ball.x = dir > 0 ? LEFT_X + PADDLE_W + BALL_R : RIGHT_X - BALL_R;
    beep(520 + Math.abs(clamped) * 220, 0.06, "square");
  }

  function stepBall(dt) {
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.y - BALL_R <= 0 && ball.vy < 0) {
      ball.y = BALL_R;
      ball.vy = -ball.vy;
      beep(320, 0.05, "square");
    } else if (ball.y + BALL_R >= H && ball.vy > 0) {
      ball.y = H - BALL_R;
      ball.vy = -ball.vy;
      beep(320, 0.05, "square");
    }

    const hitsLeft =
      ball.vx < 0 &&
      ball.x - BALL_R <= LEFT_X + PADDLE_W &&
      ball.x + BALL_R >= LEFT_X &&
      Math.abs(ball.y - left.y) <= PADDLE_H / 2 + BALL_R;

    const hitsRight =
      ball.vx > 0 &&
      ball.x + BALL_R >= RIGHT_X &&
      ball.x - BALL_R <= RIGHT_X + PADDLE_W &&
      Math.abs(ball.y - right.y) <= PADDLE_H / 2 + BALL_R;

    if (hitsLeft) bounceOffPaddle(left, 1);
    else if (hitsRight) bounceOffPaddle(right, -1);

    if (ball.x + BALL_R < 0) scorePoint("right");
    else if (ball.x - BALL_R > W) scorePoint("left");
  }

  function update(dt) {
    if (state.phase === "serving") {
      updatePaddles(dt);
      state.serveTimer -= dt;
      if (state.serveTimer <= 0) launchBall();
      return;
    }

    if (state.phase !== "playing") return;

    updatePaddles(dt);

    // Sub-step so a fast ball can never tunnel through a paddle.
    let remaining = dt;
    while (remaining > 0 && state.phase === "playing") {
      const step = Math.min(MAX_STEP, remaining);
      stepBall(step);
      remaining -= step;
    }

    trail.push({ x: ball.x, y: ball.y });
    if (trail.length > 10) trail.shift();
  }

  /* ---------- Draw ---------- */
  function drawCourt() {
    ctx.fillStyle = COLORS.court;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 6;
    ctx.setLineDash([18, 20]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 70, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawPaddles() {
    ctx.fillStyle = COLORS.left;
    roundRect(LEFT_X, left.y - PADDLE_H / 2, PADDLE_W, PADDLE_H, 8);
    ctx.fillStyle = COLORS.right;
    roundRect(RIGHT_X, right.y - PADDLE_H / 2, PADDLE_W, PADDLE_H, 8);
  }

  function drawBall() {
    trail.forEach((point, i) => {
      const fade = (i + 1) / (trail.length + 1);
      ctx.globalAlpha = fade * 0.35;
      ctx.fillStyle = COLORS.ball;
      ctx.beginPath();
      ctx.arc(point.x, point.y, BALL_R * fade, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.fillStyle = COLORS.ball;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawOverlay(title, subtitle) {
    ctx.save();
    ctx.fillStyle = "rgba(45, 52, 54, 0.72)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 46px Fredoka, Segoe UI, sans-serif";
    ctx.fillText(title, W / 2, H / 2 - (subtitle ? 22 : 0));
    if (subtitle) {
      ctx.font = "600 22px Nunito, Segoe UI, sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.fillText(subtitle, W / 2, H / 2 + 32);
    }
    ctx.restore();
  }

  function drawServeCountdown() {
    const count = Math.max(1, Math.ceil(state.serveTimer));
    ctx.save();
    ctx.fillStyle = "rgba(255, 230, 109, 0.9)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 64px Fredoka, Segoe UI, sans-serif";
    ctx.fillText(String(count), W / 2, H / 2);
    ctx.restore();
  }

  function draw() {
    drawCourt();
    drawPaddles();

    if (state.phase === "serving") {
      drawServeCountdown();
    } else if (state.phase !== "over") {
      drawBall();
    }

    if (state.phase === "idle") {
      drawOverlay("Ready to play?", "Press Start or hit Space");
    } else if (state.phase === "paused") {
      drawOverlay("Paused", "Press Space or Resume to keep going");
    } else if (state.phase === "over") {
      const name = playerName(state.winner);
      const title =
        state.mode === "cpu" && state.winner === "left"
          ? "You win! 🎉"
          : state.mode === "cpu"
          ? "Computer wins!"
          : name + " wins! 🎉";
      drawOverlay(title, "Press New Game to play again");
    }
  }

  /* ---------- Loop ---------- */
  function loop(timestamp) {
    state.rafId = window.requestAnimationFrame(loop);
    if (!state.lastTime) state.lastTime = timestamp;
    const dt = Math.min(0.05, (timestamp - state.lastTime) / 1000);
    state.lastTime = timestamp;
    update(dt);
    draw();
  }

  /* ---------- UI sync ---------- */
  function syncUI() {
    el.scoreLeft.textContent = String(state.scores.left);
    el.scoreRight.textContent = String(state.scores.right);
    el.nameLeft.textContent = playerName("left");
    el.nameRight.textContent = playerName("right");
    el.difficultyGroup.hidden = state.mode !== "cpu";

    const playing = state.phase === "playing" || state.phase === "serving";
    el.start.textContent = playing
      ? "⏸ Pause"
      : state.phase === "paused"
      ? "▶ Resume"
      : "▶ Start";

    let message;
    if (state.phase === "idle") {
      message =
        state.mode === "cpu"
          ? "Press Start to play the computer!"
          : "Press Start — Player 1 uses W and S, Player 2 uses the arrow keys.";
    } else if (state.phase === "paused") {
      message = "Paused — press Space or Resume to keep playing.";
    } else if (state.phase === "over") {
      const name = playerName(state.winner);
      message =
        state.mode === "cpu" && state.winner === "left"
          ? "You win the match " + state.scores.left + "–" + state.scores.right + "! 🎉"
          : name + " wins the match " + state.scores.left + "–" + state.scores.right + "!";
    } else {
      message =
        playerName("left") + " " + state.scores.left +
        " · " + playerName("right") + " " + state.scores.right +
        " — first to " + WIN_SCORE + " wins.";
    }
    el.status.textContent = message;
  }

  /* ---------- Input ---------- */
  function pointerToCourtY(clientY) {
    const rect = canvas.getBoundingClientRect();
    const scale = H / rect.height;
    return (clientY - rect.top) * scale;
  }

  function handlePointer(event) {
    if (event.cancelable) event.preventDefault();
    pointerY = pointerToCourtY(event.clientY);
    if (state.phase === "idle") startGame();
  }

  canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture(event.pointerId);
    handlePointer(event);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerType === "mouse" || event.buttons > 0) handlePointer(event);
  });
  canvas.addEventListener("pointerleave", () => {
    pointerY = null;
  });

  const KEY_ACTIONS = {
    KeyW: (down) => (left.up = down),
    KeyS: (down) => (left.down = down),
    ArrowUp: (down) => {
      if (state.mode === "cpu") left.up = down;
      else right.up = down;
    },
    ArrowDown: (down) => {
      if (state.mode === "cpu") left.down = down;
      else right.down = down;
    },
  };

  function onKey(event, down) {
    if (event.code === "Space" && down) {
      event.preventDefault();
      togglePlay();
      return;
    }
    const action = KEY_ACTIONS[event.code];
    if (!action) return;
    event.preventDefault();
    pointerY = null; // keyboard takes over from the mouse
    action(down);
    if (down && state.phase === "idle") startGame();
  }

  window.addEventListener("keydown", (event) => onKey(event, true));
  window.addEventListener("keyup", (event) => onKey(event, false));

  el.start.addEventListener("click", togglePlay);
  el.restart.addEventListener("click", () => {
    newGame();
    startGame();
  });

  el.sound.addEventListener("click", () => {
    state.soundOn = !state.soundOn;
    el.sound.textContent = state.soundOn ? "🔊 Sound On" : "🔇 Sound Off";
    el.sound.setAttribute("aria-pressed", String(state.soundOn));
    if (state.soundOn) beep(660, 0.08, "triangle");
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
      right.up = false;
      right.down = false;
      newGame();
    });
  });

  document.querySelectorAll("[data-difficulty]").forEach((button) => {
    button.addEventListener("click", () => {
      state.difficulty = button.dataset.difficulty;
      document.querySelectorAll("[data-difficulty]").forEach((other) => {
        const active = other === button;
        other.classList.toggle("is-active", active);
        other.setAttribute("aria-pressed", String(active));
      });
      newGame();
    });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseGame();
  });
  window.addEventListener("blur", pauseGame);

  /* ---------- Go ---------- */
  newGame();
  state.rafId = window.requestAnimationFrame(loop);
})();
