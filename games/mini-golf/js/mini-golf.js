/**
 * Mini Golf — aim, choose how hard, and putt.
 *
 * You drag from the ball in the direction you want it to GO, rather than
 * pulling back like a catapult. Pulling back is what most golf games do and
 * it confuses a lot of children; pointing where you want it is one less thing
 * to explain.
 *
 * The ball bounces off walls on the axis of least penetration, the same rule
 * Breakout uses, which is what stops it slipping through a corner. It always
 * comes to a stop because friction is applied every step and anything slower
 * than a threshold is halted outright.
 */
(function () {
  "use strict";

  const canvas = document.getElementById("golf-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const W = canvas.width;      // 640
  const H = canvas.height;     // 440
  const EDGE = 12;             // the wall round the outside

  const BALL_R = 8;
  const CUP_R = 14;
  const MAX_POWER = 760;       // pixels per second at full stretch
  const MAX_PULL = 150;        // how far you drag for full power
  const FRICTION = 1.65;       // higher stops the ball sooner
  const STOP_SPEED = 12;
  const SINK_SPEED = 300;      // faster than this and it rims out
  const MAX_STEP = 1 / 240;
  const MAX_STROKES = 10;      // pick the ball up after this many

  const HOLES = Array.isArray(window.GolfHoles) ? window.GolfHoles : [];

  const state = {
    holeIndex: 0,
    ball: { x: 0, y: 0, vx: 0, vy: 0, moving: false, sunk: false },
    aim: null,          // { x, y } while dragging
    strokes: 0,
    total: 0,
    parTotal: 0,
    scores: [],         // strokes taken on each finished hole
    phase: "ready",     // ready | rolling | sunk | done
    lastTime: 0,
  };

  let soundOn = true;
  let audioCtx = null;

  const el = {
    status: document.getElementById("golf-status"),
    hole: document.getElementById("golf-hole"),
    par: document.getElementById("golf-par"),
    strokes: document.getElementById("golf-strokes"),
    total: document.getElementById("golf-total"),
    best: document.getElementById("golf-best"),
    card: document.getElementById("golf-card"),
    next: document.getElementById("btn-next"),
    retry: document.getElementById("btn-retry"),
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

  /* ---------- Course ---------- */
  function hole() { return HOLES[state.holeIndex]; }

  /** Every wall, including the four round the edge. */
  function wallsFor(h) {
    return [
      [0, 0, W, EDGE],
      [0, H - EDGE, W, EDGE],
      [0, 0, EDGE, H],
      [W - EDGE, 0, EDGE, H],
    ].concat(h.walls || []);
  }

  /** Is a ball centred here overlapping any wall? */
  function blocked(h, x, y, radius) {
    const r = radius === undefined ? BALL_R : radius;
    return wallsFor(h).some((wall) => {
      const nearestX = Math.max(wall[0], Math.min(x, wall[0] + wall[2]));
      const nearestY = Math.max(wall[1], Math.min(y, wall[1] + wall[3]));
      const dx = x - nearestX;
      const dy = y - nearestY;
      return dx * dx + dy * dy < r * r;
    });
  }

  /* ---------- Physics ---------- */
  function bounce(h) {
    const ball = state.ball;
    wallsFor(h).forEach((wall) => {
      const [wx, wy, ww, wh] = wall;
      const nearestX = Math.max(wx, Math.min(ball.x, wx + ww));
      const nearestY = Math.max(wy, Math.min(ball.y, wy + wh));
      const dx = ball.x - nearestX;
      const dy = ball.y - nearestY;
      if (dx * dx + dy * dy >= BALL_R * BALL_R) return;

      // Push out along whichever axis it is least buried in, and reflect that
      // component - the same rule Breakout uses, and for the same reason.
      const overlapX = Math.min(ball.x + BALL_R - wx, wx + ww - (ball.x - BALL_R));
      const overlapY = Math.min(ball.y + BALL_R - wy, wy + wh - (ball.y - BALL_R));
      if (overlapX < overlapY) {
        ball.vx = -ball.vx * 0.86;
        ball.x += ball.vx > 0 ? overlapX : -overlapX;
      } else {
        ball.vy = -ball.vy * 0.86;
        ball.y += ball.vy > 0 ? overlapY : -overlapY;
      }
      beep(300, 0.03, "square");
    });
  }

  function stepBall(dt, h) {
    const ball = state.ball;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Friction, applied smoothly so it does not depend on the frame rate.
    const decay = Math.exp(-FRICTION * dt);
    ball.vx *= decay;
    ball.vy *= decay;

    bounce(h);

    const cup = h.cup;
    const dx = ball.x - cup[0];
    const dy = ball.y - cup[1];
    const speed = Math.hypot(ball.vx, ball.vy);
    if (Math.hypot(dx, dy) < CUP_R - 3 && speed < SINK_SPEED) {
      ball.sunk = true;
      ball.moving = false;
      ball.vx = 0;
      ball.vy = 0;
      ball.x = cup[0];
      ball.y = cup[1];
      return;
    }

    if (speed < STOP_SPEED) {
      ball.vx = 0;
      ball.vy = 0;
      ball.moving = false;
    }
  }

  function update(dt) {
    if (state.phase !== "rolling") return;
    let remaining = dt;
    const h = hole();
    while (remaining > 0 && state.ball.moving && !state.ball.sunk) {
      const slice = Math.min(MAX_STEP, remaining);
      remaining -= slice;
      stepBall(slice, h);
    }
    if (state.ball.sunk) sink();
    else if (!state.ball.moving) rest();
  }

  /* ---------- Turns ---------- */
  function shoot(dirX, dirY, power) {
    if (state.phase !== "ready") return;
    const length = Math.hypot(dirX, dirY);
    if (length < 4) return;
    const strength = Math.max(0, Math.min(1, power));
    state.ball.vx = (dirX / length) * MAX_POWER * strength;
    state.ball.vy = (dirY / length) * MAX_POWER * strength;
    state.ball.moving = true;
    state.strokes += 1;
    state.phase = "rolling";
    beep(420, 0.05, "square");
    syncUI();
  }

  function rest() {
    state.phase = "ready";
    if (state.strokes >= MAX_STROKES) {
      setStatus("That's " + MAX_STROKES + " shots — let's call it and move on.");
      finishHole(MAX_STROKES);
      return;
    }
    setStatus("Have another go.");
    syncUI();
  }

  function sink() {
    state.phase = "sunk";
    fanfare();
    finishHole(state.strokes);
  }

  function finishHole(strokes) {
    const h = hole();
    state.scores[state.holeIndex] = strokes;
    state.total += strokes;
    state.parTotal += h.par;
    state.phase = "sunk";

    const diff = strokes - h.par;
    const word = strokes === 1 ? "🎯 Hole in one!"
      : diff <= -2 ? "🌟 Two under par!"
      : diff === -1 ? "⭐ One under par!"
      : diff === 0 ? "👍 That's par."
      : diff === 1 ? "One over par."
      : diff + " over par.";
    setStatus(word + " " + (state.holeIndex < HOLES.length - 1
      ? "Press Next Hole."
      : "That's the whole course!"));

    if (state.holeIndex >= HOLES.length - 1) {
      state.phase = "done";
      if (board) board.offer(state.total);
    }
    syncUI();
  }

  function loadHole(index) {
    state.holeIndex = Math.max(0, Math.min(HOLES.length - 1, index));
    const h = hole();
    state.ball = { x: h.tee[0], y: h.tee[1], vx: 0, vy: 0, moving: false, sunk: false };
    state.aim = null;
    state.strokes = 0;
    state.phase = "ready";
    setStatus("Drag from the ball towards the hole, then let go.");
    syncUI();
  }

  function nextHole() {
    if (state.holeIndex >= HOLES.length - 1) { newRound(); return; }
    loadHole(state.holeIndex + 1);
  }

  function retryHole() {
    // Take back what this hole added, then start it again.
    const taken = state.scores[state.holeIndex];
    if (typeof taken === "number") {
      state.total -= taken;
      state.parTotal -= hole().par;
      state.scores[state.holeIndex] = undefined;
    }
    loadHole(state.holeIndex);
  }

  function newRound() {
    state.total = 0;
    state.parTotal = 0;
    state.scores = [];
    loadHole(0);
    setStatus("New round! Nine holes — good luck.");
  }

  /* ---------- Drawing ---------- */
  function draw() {
    const h = hole();
    ctx.fillStyle = "#3f8f4f";
    ctx.fillRect(0, 0, W, H);

    // Mown stripes, purely for looks
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    for (let x = 0; x < W; x += 56) ctx.fillRect(x, 0, 28, H);

    ctx.fillStyle = "#8a5a2b";
    wallsFor(h).forEach((wall) => ctx.fillRect(wall[0], wall[1], wall[2], wall[3]));

    // Cup
    ctx.fillStyle = "#1d2b21";
    ctx.beginPath();
    ctx.arc(h.cup[0], h.cup[1], CUP_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "18px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("⛳", h.cup[0] + 12, h.cup[1] - 14);

    // Aim guide
    if (state.aim && state.phase === "ready") {
      const dx = state.aim.x - state.ball.x;
      const dy = state.aim.y - state.ball.y;
      const pull = Math.min(MAX_PULL, Math.hypot(dx, dy));
      const power = pull / MAX_PULL;
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 3;
      ctx.setLineDash([7, 7]);
      ctx.beginPath();
      ctx.moveTo(state.ball.x, state.ball.y);
      ctx.lineTo(state.aim.x, state.aim.y);
      ctx.stroke();
      ctx.restore();

      // Power bar under the ball
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(state.ball.x - 26, state.ball.y + 16, 52, 7);
      ctx.fillStyle = power > 0.75 ? "#ff5a5a" : power > 0.4 ? "#ffd12e" : "#8ee39b";
      ctx.fillRect(state.ball.x - 25, state.ball.y + 17, 50 * power, 5);
    }

    // Ball
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(state.ball.x, state.ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.beginPath();
    ctx.arc(state.ball.x + 2, state.ball.y + 2, BALL_R * 0.55, 0, Math.PI * 2);
    ctx.fill();

    if (state.phase === "done") {
      ctx.save();
      ctx.fillStyle = "rgba(20,40,26,0.78)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff";
      ctx.font = "700 40px Fredoka, Segoe UI, sans-serif";
      ctx.fillText("Round finished!", W / 2, H / 2 - 20);
      ctx.font = "600 20px Nunito, Segoe UI, sans-serif";
      const diff = state.total - state.parTotal;
      ctx.fillText(state.total + " shots — " +
        (diff === 0 ? "level par" : diff < 0 ? Math.abs(diff) + " under par" : diff + " over par"),
        W / 2, H / 2 + 24);
      ctx.restore();
    }
  }

  function loop(timestamp) {
    window.requestAnimationFrame(loop);
    if (!state.lastTime) state.lastTime = timestamp;
    const dt = Math.min(0.05, (timestamp - state.lastTime) / 1000);
    state.lastTime = timestamp;
    update(dt);
    draw();
  }

  /* ---------- UI ---------- */
  function setStatus(text) { el.status.textContent = text; }

  function syncUI() {
    const h = hole();
    el.hole.textContent = (state.holeIndex + 1) + "/" + HOLES.length;
    el.par.textContent = String(h.par);
    el.strokes.textContent = String(state.strokes);
    const diff = state.total - state.parTotal;
    el.total.textContent = state.total + (state.parTotal
      ? " (" + (diff === 0 ? "par" : diff > 0 ? "+" + diff : diff) + ")" : "");
    const stored = board ? board.entries() : [];
    el.best.textContent = stored.length ? String(stored[0].value) : "—";

    el.next.disabled = state.phase !== "sunk" && state.phase !== "done";
    el.next.textContent = state.holeIndex >= HOLES.length - 1 && state.phase === "done"
      ? "🔁 Play Again" : "➡️ Next Hole";
    el.retry.disabled = state.phase === "rolling";

    el.card.innerHTML = "";
    HOLES.forEach((entry, i) => {
      const chip = document.createElement("li");
      const taken = state.scores[i];
      chip.className = "golf-card-item" +
        (i === state.holeIndex ? " is-current" : "") +
        (typeof taken === "number" ? (taken < entry.par ? " is-under" : taken === entry.par ? " is-par" : " is-over") : "");
      chip.textContent = (i + 1) + ": " + (typeof taken === "number" ? taken : "–");
      chip.setAttribute("title", entry.name + " (par " + entry.par + ")");
      el.card.appendChild(chip);
    });
  }

  /* ---------- Leaderboard ---------- */
  const board = window.Leaderboard ? window.Leaderboard.create({
    gameId: "mini-golf",
    gameName: "Mini Golf",
    metric: { label: "Shots", better: "lower", format: "number" },
  }) : null;
  if (board) board.mount(document.getElementById("leaderboard-panel"));

  /* ---------- Input ---------- */
  function toCourse(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (W / rect.width),
      y: (clientY - rect.top) * (H / rect.height),
    };
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (state.phase !== "ready") return;
    state.aim = toCourse(event.clientX, event.clientY);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!state.aim || state.phase !== "ready") return;
    state.aim = toCourse(event.clientX, event.clientY);
  });

  canvas.addEventListener("pointerup", () => {
    if (!state.aim || state.phase !== "ready") { state.aim = null; return; }
    const dx = state.aim.x - state.ball.x;
    const dy = state.aim.y - state.ball.y;
    const pull = Math.min(MAX_PULL, Math.hypot(dx, dy));
    state.aim = null;
    shoot(dx, dy, pull / MAX_PULL);
  });

  canvas.addEventListener("pointerleave", () => { state.aim = null; });

  el.next.addEventListener("click", nextHole);
  el.retry.addEventListener("click", retryHole);
  el.restart.addEventListener("click", newRound);
  el.sound.addEventListener("click", () => {
    soundOn = !soundOn;
    el.sound.textContent = soundOn ? "🔊 Sound On" : "🔇 Sound Off";
    el.sound.setAttribute("aria-pressed", String(soundOn));
  });

  window.addEventListener("keydown", (event) => {
    if (event.code === "KeyN" && !el.next.disabled) { event.preventDefault(); nextHole(); }
    if (event.code === "KeyR") { event.preventDefault(); retryHole(); }
  });

  if (!HOLES.length) { setStatus("No holes found — check js/holes.js."); return; }

  newRound();
  window.requestAnimationFrame(loop);

  window.MiniGolfGame = {
    state, HOLES, wallsFor, blocked, shoot, update, loadHole, nextHole, retryHole, newRound,
    hole, W, H, EDGE, BALL_R, CUP_R, MAX_POWER, MAX_STROKES,
  };
})();
