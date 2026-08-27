/**
 * Bubble Shooter — match three or more to pop them.
 *
 * Classic mode and Math Mode run the same engine. A bubble's identity is
 * always an index into a six-slot palette; the mode only decides how that
 * index is DRAWN and what the loaded bubble is LABELLED with. In Math Mode
 * the loaded bubble shows a sum and hides its colour, so the only way to
 * know where to aim is to work the answer out.
 */
(function () {
  "use strict";

  const canvas = document.getElementById("bubble-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  const R = 24;                      // bubble radius
  const D = R * 2;                   // spacing along a row
  const ROW_H = D * Math.sin(Math.PI / 3); // hex rows overlap vertically
  const COLS = 14;                   // bubbles in a non-indented row
  const W = canvas.width;            // 672
  const H = canvas.height;           // 640

  const SHOOTER_Y = H - 46;
  const DEAD_LINE = H - 104;         // stack reaching this ends the run
  const MAX_AIM = (78 * Math.PI) / 180;
  const SHOT_SPEED = 780;
  const START_ROWS = 5;
  const SHOTS_PER_DROP = 8;
  const SHOTS_PER_DROP_MATH = 12;  // working out a sum takes longer than spotting a colour
  const GRID_ROWS = 16;            // deep enough that any legal shot has a cell
  const POP_POINTS = 10;
  const DROP_POINTS = 20;
  const CLEAR_BONUS = 250;
  /**
   * Once the board is down to this few bubbles, stop sending new rows. A full
   * board is ~68 bubbles and a drop arrives every 8 shots, so without this the
   * board can never actually be cleared and levelUp() is unreachable.
   */
  const MERCY_THRESHOLD = 14;

  const COLORS = ["#ff5a5a", "#3fc0b6", "#ffd12e", "#9b7bf7", "#54bf62", "#ff8e2b"];
  const NEUTRAL = "#f3ece1";
  const BEST_KEY = "bubble-shooter-best";
  const MODE_KEY = "bubble-shooter-mode";
  const LEVEL_KEY = "bubble-shooter-level";

  const mathLevels = Array.isArray(window.BubbleMathLevels)
    ? window.BubbleMathLevels.filter(isUsableLevel)
    : [];

  const state = {
    mode: "classic",                 // classic | math
    levelId: mathLevels.length ? mathLevels[0].id : null,
    grid: [],                        // grid[row][col] = palette index or null
    parity: 0,                       // 1 when row 0 is indented by R
    phase: "ready",                  // ready | flying | resolving | over
    score: 0,
    level: 1,
    shotsLeft: SHOTS_PER_DROP,
    best: 0,
    angle: -Math.PI / 2,
    loaded: null,                    // { value, problem }
    next: null,
    projectile: null,                // { x, y, vx, vy, value, problem }
    popping: [],                     // { x, y, value, life }
    falling: [],                     // { x, y, vy, value }
  };

  let soundOn = true;
  let audioCtx = null;
  let lastTime = 0;

  const el = {
    score: document.getElementById("bubble-score"),
    level: document.getElementById("bubble-level"),
    shots: document.getElementById("bubble-shots"),
    best: document.getElementById("bubble-best"),
    status: document.getElementById("bubble-status"),
    restart: document.getElementById("btn-restart"),
    swap: document.getElementById("btn-swap"),
    sound: document.getElementById("btn-sound"),
    levelGroup: document.getElementById("math-level-group"),
    levelButtons: document.getElementById("math-level-buttons"),
  };

  /* ---------- Maths levels ---------- */
  function isUsableLevel(level) {
    if (!level || typeof level.id !== "string" || typeof level.problem !== "function") return false;
    if (!Array.isArray(level.values) || level.values.length !== COLORS.length) {
      window.console.warn(
        'Bubble Shooter: level "' + (level && level.id) + '" needs exactly ' + COLORS.length + " values and was skipped."
      );
      return false;
    }
    if (new Set(level.values).size !== level.values.length) {
      window.console.warn('Bubble Shooter: level "' + level.id + '" has duplicate values and was skipped.');
      return false;
    }
    return true;
  }

  function currentLevel() {
    return mathLevels.find((l) => l.id === state.levelId) || mathLevels[0] || null;
  }

  function isMath() {
    return state.mode === "math" && currentLevel() !== null;
  }

  /** Math Mode gives more shots between drops — thinking time, not reflexes. */
  function shotsPerDrop() {
    return isMath() ? SHOTS_PER_DROP_MATH : SHOTS_PER_DROP;
  }

  /** The number printed inside a bubble, or "" in classic mode. */
  function labelFor(value) {
    if (!isMath()) return "";
    return String(currentLevel().values[value]);
  }

  function problemFor(value) {
    if (!isMath()) return "";
    return String(currentLevel().problem(currentLevel().values[value]));
  }

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
    } catch (err) {
      /* Sound is optional. */
    }
  }

  function playFanfare() {
    [523, 659, 784, 1047].forEach((freq, i) => {
      window.setTimeout(() => beep(freq, 0.18, "triangle"), i * 130);
    });
  }

  /* ---------- Grid geometry ---------- */
  function isIndented(row) {
    return (row + state.parity) % 2 === 1;
  }

  function rowLength(row) {
    return isIndented(row) ? COLS - 1 : COLS;
  }

  function cellX(row, col) {
    return R + col * D + (isIndented(row) ? R : 0);
  }

  function cellY(row) {
    return R + row * ROW_H;
  }

  function inBounds(row, col) {
    return row >= 0 && row < state.grid.length && col >= 0 && col < rowLength(row);
  }

  function valueAt(row, col) {
    if (!inBounds(row, col)) return null;
    const value = state.grid[row][col];
    return value === undefined ? null : value;
  }

  /**
   * Six hex neighbours. Which diagonals line up depends on whether the row
   * is indented, which is the classic off-by-one in offset-grid games.
   */
  function neighbours(row, col) {
    const shift = isIndented(row) ? 0 : -1;
    return [
      [row, col - 1],
      [row, col + 1],
      [row - 1, col + shift],
      [row - 1, col + shift + 1],
      [row + 1, col + shift],
      [row + 1, col + shift + 1],
    ].filter(([r, c]) => inBounds(r, c));
  }

  /* ---------- Board ---------- */
  function randomValue() {
    return Math.floor(Math.random() * COLORS.length);
  }

  function makeBoard(rows) {
    const grid = [];
    const totalRows = Math.max(rows + 6, GRID_ROWS);
    for (let r = 0; r < totalRows; r++) {
      const row = [];
      const len = (r + state.parity) % 2 === 1 ? COLS - 1 : COLS;
      for (let c = 0; c < len; c++) row.push(r < rows ? randomValue() : null);
      grid.push(row);
    }
    return grid;
  }

  function occupiedCells() {
    const out = [];
    for (let r = 0; r < state.grid.length; r++) {
      for (let c = 0; c < rowLength(r); c++) {
        if (valueAt(r, c) !== null) out.push([r, c]);
      }
    }
    return out;
  }

  /** Palette indexes still on the board — never hand out a useless bubble. */
  function valuesInPlay() {
    const seen = new Set();
    occupiedCells().forEach(([r, c]) => seen.add(state.grid[r][c]));
    return [...seen];
  }

  function makeBubble() {
    const pool = valuesInPlay();
    const value = pool.length ? pool[Math.floor(Math.random() * pool.length)] : randomValue();
    return { value, problem: problemFor(value) };
  }

  function refillQueue() {
    state.loaded = makeBubble();
    state.next = makeBubble();
  }

  /* ---------- Clusters ---------- */
  /** Connected run of equal values, starting from one cell. */
  function matchingCluster(row, col) {
    const target = valueAt(row, col);
    if (target === null) return [];
    const key = (r, c) => r + ":" + c;
    const seen = new Set([key(row, col)]);
    const stack = [[row, col]];
    const found = [];
    while (stack.length) {
      const [r, c] = stack.pop();
      found.push([r, c]);
      for (const [nr, nc] of neighbours(r, c)) {
        if (seen.has(key(nr, nc))) continue;
        if (valueAt(nr, nc) !== target) continue;
        seen.add(key(nr, nc));
        stack.push([nr, nc]);
      }
    }
    return found;
  }

  /** Everything no longer hanging from the top row. */
  function floatingCells() {
    const key = (r, c) => r + ":" + c;
    const anchored = new Set();
    const stack = [];
    for (let c = 0; c < rowLength(0); c++) {
      if (valueAt(0, c) !== null) {
        anchored.add(key(0, c));
        stack.push([0, c]);
      }
    }
    while (stack.length) {
      const [r, c] = stack.pop();
      for (const [nr, nc] of neighbours(r, c)) {
        if (anchored.has(key(nr, nc))) continue;
        if (valueAt(nr, nc) === null) continue;
        anchored.add(key(nr, nc));
        stack.push([nr, nc]);
      }
    }
    return occupiedCells().filter(([r, c]) => !anchored.has(key(r, c)));
  }

  /* ---------- Snapping ---------- */
  /**
   * Nearest empty cell to the point that is actually attachable — touching
   * the ceiling or an existing bubble. Without that check a bubble can snap
   * into a hole it never reached.
   */
  function snapCell(px, py) {
    const approxRow = Math.round((py - R) / ROW_H);
    let best = null;
    let bestDist = Infinity;
    for (let r = approxRow - 2; r <= approxRow + 2; r++) {
      if (r < 0 || r >= state.grid.length) continue;
      for (let c = 0; c < rowLength(r); c++) {
        if (valueAt(r, c) !== null) continue;
        const attachable = r === 0 || neighbours(r, c).some(([nr, nc]) => valueAt(nr, nc) !== null);
        if (!attachable) continue;
        const dx = cellX(r, c) - px;
        const dy = cellY(r) - py;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          best = [r, c];
        }
      }
    }
    return best;
  }

  /* ---------- Shooting ---------- */
  function shoot() {
    if (state.phase !== "ready" || !state.loaded) return;
    state.projectile = {
      x: W / 2,
      y: SHOOTER_Y,
      vx: Math.cos(state.angle) * SHOT_SPEED,
      vy: Math.sin(state.angle) * SHOT_SPEED,
      value: state.loaded.value,
      problem: state.loaded.problem,
    };
    // Advance the queue: what was next is now in the barrel, and a fresh
    // bubble takes its place. Without this the same bubble - and in Math
    // Mode the same sum - is served for the whole game.
    state.loaded = state.next;
    state.next = makeBubble();

    state.phase = "flying";
    beep(320, 0.05, "square");
  }

  function swapBubbles() {
    if (state.phase !== "ready") return;
    const held = state.loaded;
    state.loaded = state.next;
    state.next = held;
    beep(420, 0.05, "sine");
  }

  function hitsAnyBubble(x, y) {
    const threshold = D * 0.92;
    const approxRow = Math.round((y - R) / ROW_H);
    for (let r = Math.max(0, approxRow - 2); r <= Math.min(state.grid.length - 1, approxRow + 2); r++) {
      for (let c = 0; c < rowLength(r); c++) {
        if (valueAt(r, c) === null) continue;
        const dx = cellX(r, c) - x;
        const dy = cellY(r) - y;
        if (Math.hypot(dx, dy) < threshold) return true;
      }
    }
    return false;
  }

  function landProjectile() {
    const shot = state.projectile;
    state.projectile = null;

    const cell = snapCell(shot.x, shot.y);
    if (!cell) {
      // Nothing to attach to — normally means the board just emptied.
      if (!occupiedCells().length) {
        levelUp();
        return;
      }
      state.phase = "ready";
      syncUI();
      return;
    }

    const [row, col] = cell;
    state.grid[row][col] = shot.value;

    const cluster = matchingCluster(row, col);
    let popped = 0;
    let dropped = 0;

    if (cluster.length >= 3) {
      cluster.forEach(([r, c]) => {
        state.popping.push({ x: cellX(r, c), y: cellY(r), value: state.grid[r][c], life: 1 });
        state.grid[r][c] = null;
      });
      popped = cluster.length;

      // Count only what THIS shot knocked loose — bubbles from earlier shots
      // may still be animating their way off the bottom of the screen.
      const alreadyFalling = state.falling.length;
      floatingCells().forEach(([r, c]) => {
        state.falling.push({ x: cellX(r, c), y: cellY(r), vy: 60, value: state.grid[r][c] });
        state.grid[r][c] = null;
      });
      dropped = state.falling.length - alreadyFalling;

      state.score += popped * POP_POINTS + dropped * DROP_POINTS;
      beep(dropped ? 880 : 660, 0.1, "triangle");
      setStatus(
        dropped
          ? "💥 " + popped + " popped and " + dropped + " knocked loose!"
          : "Pop! " + popped + " bubbles."
      );
    } else {
      beep(220, 0.06, "sine");
      setStatus(isMath() ? "No match — check the sum and try again." : "No match — keep going!");
    }

    state.shotsLeft -= 1;
    if (state.shotsLeft <= 0) {
      // Hold the drops back when the player is close to clearing the board,
      // so finishing it off is actually possible.
      if (occupiedCells().length > MERCY_THRESHOLD) addRow();
      state.shotsLeft = shotsPerDrop();
    }

    if (!occupiedCells().length) {
      levelUp();
      return;
    }

    if (reachedDeadLine()) {
      endGame();
      return;
    }

    refillLoadedIfStale();
    state.phase = "ready";
    syncUI();
  }

  /** A bubble whose colour has vanished from the board is unplayable. */
  function refillLoadedIfStale() {
    const pool = valuesInPlay();
    if (!pool.length) return;
    if (!pool.includes(state.loaded.value)) state.loaded = makeBubble();
    if (!pool.includes(state.next.value)) state.next = makeBubble();
  }

  function addRow() {
    state.parity = state.parity === 0 ? 1 : 0;
    const len = (0 + state.parity) % 2 === 1 ? COLS - 1 : COLS;
    const row = [];
    for (let c = 0; c < len; c++) row.push(randomValue());
    state.grid.unshift(row);
    // Rebuild trailing empty rows so the array stays rectangular-ish.
    while (state.grid.length && state.grid[state.grid.length - 1].every((v) => v === null)
           && state.grid.length > GRID_ROWS) {
      state.grid.pop();
    }
  }

  function reachedDeadLine() {
    return occupiedCells().some(([r]) => cellY(r) + R >= DEAD_LINE);
  }

  function levelUp() {
    state.score += CLEAR_BONUS;
    state.level += 1;
    state.parity = 0;
    state.grid = makeBoard(Math.min(START_ROWS + state.level - 1, 8));
    state.shotsLeft = shotsPerDrop();
    state.popping = [];
    state.falling = [];
    refillQueue();
    state.phase = "ready";
    playFanfare();
    setStatus("🎉 Board cleared! +" + CLEAR_BONUS + " — here comes level " + state.level + ".");
    syncUI();
  }

  function endGame() {
    state.phase = "over";
    beep(150, 0.35, "sawtooth");
    const isBest = state.score > state.best;
    if (isBest) {
      state.best = state.score;
      try {
        window.localStorage.setItem(BEST_KEY, String(state.best));
      } catch (err) {
        /* Private browsing — the score just won't persist. */
      }
    }
    setStatus(
      isBest
        ? "🏆 New best score — " + state.score + "! Press New Game to go again."
        : "💥 The bubbles reached the bottom. You scored " + state.score + "."
    );
    syncUI();
  }

  /* ---------- Loop ---------- */
  function update(dt) {
    // Pops and drops are cosmetic, so they keep animating whatever the phase.
    state.popping = state.popping.filter((p) => {
      p.life -= dt * 4;
      return p.life > 0;
    });
    state.falling = state.falling.filter((f) => {
      f.vy += 900 * dt;
      f.y += f.vy * dt;
      return f.y < H + R;
    });

    if (state.phase !== "flying" || !state.projectile) return;

    // Small substeps so a fast bubble cannot tunnel through the stack.
    let remaining = dt;
    while (remaining > 0 && state.projectile) {
      const slice = Math.min(1 / 480, remaining);
      remaining -= slice;
      const shot = state.projectile;
      shot.x += shot.vx * slice;
      shot.y += shot.vy * slice;

      if (shot.x - R <= 0 && shot.vx < 0) {
        shot.x = R;
        shot.vx = -shot.vx;
        beep(300, 0.03, "sine");
      } else if (shot.x + R >= W && shot.vx > 0) {
        shot.x = W - R;
        shot.vx = -shot.vx;
        beep(300, 0.03, "sine");
      }

      if (shot.y - R <= 0 || hitsAnyBubble(shot.x, shot.y)) {
        if (shot.y - R < 0) shot.y = R;
        landProjectile();
        return;
      }
    }
  }

  function loop(timestamp) {
    window.requestAnimationFrame(loop);
    if (!lastTime) lastTime = timestamp;
    const dt = Math.min(0.05, (timestamp - lastTime) / 1000);
    lastTime = timestamp;
    update(dt);
    draw();
  }

  /* ---------- Drawing ---------- */
  function drawBubble(x, y, value, options) {
    const opts = options || {};
    const label = opts.label !== undefined ? opts.label : labelFor(value);
    const fill = opts.neutral ? NEUTRAL : COLORS[value];

    ctx.save();
    if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;

    ctx.beginPath();
    ctx.arc(x, y, opts.radius || R - 1, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
    ctx.stroke();

    // Highlight, so the bubbles read as round rather than flat discs.
    ctx.beginPath();
    ctx.arc(x - R * 0.28, y - R * 0.3, (opts.radius || R) * 0.26, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fill();

    if (label) {
      ctx.fillStyle = opts.neutral ? "#2d3436" : "rgba(0, 0, 0, 0.72)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // Measure and shrink to fit: sums vary from "8" to "12 × 2", and a
      // label the player cannot read makes Math Mode unplayable.
      const radius = opts.radius || R - 1;
      const maxWidth = radius * 1.62;
      let size = Math.round(radius * 0.86);
      ctx.font = "700 " + size + "px Fredoka, Segoe UI, sans-serif";
      while (size > 8 && ctx.measureText(label).width > maxWidth) {
        size -= 1;
        ctx.font = "700 " + size + "px Fredoka, Segoe UI, sans-serif";
      }
      ctx.fillText(label, x, y + 1);
    }
    ctx.restore();
  }

  function drawAimGuide() {
    if (state.phase !== "ready") return;

    // Walk the shot forward so the guide shows the bank off the wall too.
    let x = W / 2;
    let y = SHOOTER_Y;
    let vx = Math.cos(state.angle);
    let vy = Math.sin(state.angle);
    const points = [{ x, y }];
    let bounces = 0;

    for (let i = 0; i < 400; i++) {
      x += vx * 9;
      y += vy * 9;
      if (x - R <= 0 || x + R >= W) {
        vx = -vx;
        x = Math.max(R, Math.min(W - R, x));
        points.push({ x, y });
        if (++bounces > 2) break;
      }
      if (y - R <= 0 || hitsAnyBubble(x, y)) break;
    }
    points.push({ x, y });

    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 3;
    ctx.setLineDash([9, 11]);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.stroke();
    ctx.restore();
  }

  function draw() {
    ctx.fillStyle = "#20303a";
    ctx.fillRect(0, 0, W, H);

    // Danger line
    ctx.save();
    ctx.strokeStyle = "rgba(255, 90, 90, 0.55)";
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.moveTo(0, DEAD_LINE);
    ctx.lineTo(W, DEAD_LINE);
    ctx.stroke();
    ctx.restore();

    occupiedCells().forEach(([r, c]) => drawBubble(cellX(r, c), cellY(r), state.grid[r][c]));
    state.falling.forEach((f) => drawBubble(f.x, f.y, f.value, { alpha: 0.85 }));
    state.popping.forEach((p) =>
      drawBubble(p.x, p.y, p.value, { alpha: p.life, radius: R * (1 + (1 - p.life) * 0.6), label: "" })
    );

    drawAimGuide();

    if (state.projectile) {
      drawBubble(state.projectile.x, state.projectile.y, state.projectile.value, {
        neutral: isMath(),
        label: isMath() ? state.projectile.problem : "",
      });
    }

    // Shooter base
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
    ctx.beginPath();
    ctx.arc(W / 2, SHOOTER_Y, R + 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (state.loaded && state.phase !== "flying") {
      drawBubble(W / 2, SHOOTER_Y, state.loaded.value, {
        neutral: isMath(),
        label: isMath() ? state.loaded.problem : "",
      });
    }

    if (state.next) {
      ctx.save();
      ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
      ctx.textAlign = "center";
      ctx.font = "600 13px Nunito, Segoe UI, sans-serif";
      ctx.fillText("next", W - 62, SHOOTER_Y - 26);
      ctx.restore();
      drawBubble(W - 62, SHOOTER_Y, state.next.value, {
        radius: isMath() ? R * 0.95 : R * 0.72,
        neutral: isMath(),
        label: isMath() ? state.next.problem : "",
      });
    }

    if (state.phase === "over") {
      ctx.save();
      ctx.fillStyle = "rgba(32, 48, 58, 0.78)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "700 46px Fredoka, Segoe UI, sans-serif";
      ctx.fillText("Game Over", W / 2, H / 2 - 20);
      ctx.font = "600 21px Nunito, Segoe UI, sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.fillText("Score " + state.score, W / 2, H / 2 + 26);
      ctx.restore();
    }
  }

  /* ---------- UI ---------- */
  function setStatus(text) {
    el.status.textContent = text;
  }

  function syncUI() {
    el.score.textContent = String(state.score);
    el.level.textContent = String(state.level);
    el.shots.textContent = String(state.shotsLeft);
    el.best.textContent = String(state.best);
    el.swap.disabled = state.phase !== "ready";
    el.levelGroup.hidden = !isMath();
  }

  /* ---------- Input ---------- */
  function aimAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scale = W / rect.width;
    const x = (clientX - rect.left) * scale;
    const y = (clientY - rect.top) * scale;
    setAngle(Math.atan2(y - SHOOTER_Y, x - W / 2));
  }

  function setAngle(angle) {
    let next = angle;
    // Keep the barrel pointing upwards: clamp into the top half, then to MAX_AIM.
    if (next > 0) next = next > Math.PI / 2 ? -Math.PI + 0.0001 : -0.0001;
    const limitLeft = -Math.PI + (Math.PI / 2 - MAX_AIM);
    const limitRight = -(Math.PI / 2 - MAX_AIM);
    state.angle = Math.max(limitLeft, Math.min(limitRight, next));
  }

  canvas.addEventListener("pointermove", (event) => aimAt(event.clientX, event.clientY));
  canvas.addEventListener("pointerdown", (event) => {
    aimAt(event.clientX, event.clientY);
    if (state.phase === "ready") shoot();
  });

  window.addEventListener("keydown", (event) => {
    if (event.code === "ArrowLeft") {
      event.preventDefault();
      setAngle(state.angle - 0.05);
    } else if (event.code === "ArrowRight") {
      event.preventDefault();
      setAngle(state.angle + 0.05);
    } else if (event.code === "Space" || event.code === "Enter") {
      event.preventDefault();
      shoot();
    } else if (event.code === "KeyS") {
      event.preventDefault();
      swapBubbles();
    }
  });

  el.restart.addEventListener("click", () => newGame());
  el.swap.addEventListener("click", swapBubbles);
  el.sound.addEventListener("click", () => {
    soundOn = !soundOn;
    el.sound.textContent = soundOn ? "🔊 Sound On" : "🔇 Sound Off";
    el.sound.setAttribute("aria-pressed", String(soundOn));
  });

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.mode === button.dataset.mode) return;
      state.mode = button.dataset.mode;
      try {
        window.localStorage.setItem(MODE_KEY, state.mode);
      } catch (err) { /* not important */ }
      document.querySelectorAll("[data-mode]").forEach((other) => {
        const active = other === button;
        other.classList.toggle("is-active", active);
        other.setAttribute("aria-pressed", String(active));
      });
      newGame();
      setStatus(
        isMath()
          ? "Math Mode — work out the sum on your bubble, then shoot at that number!"
          : "Classic Mode — match three or more of the same colour."
      );
    });
  });

  function renderLevelButtons() {
    el.levelButtons.innerHTML = "";
    mathLevels.forEach((level) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option-btn" + (level.id === state.levelId ? " is-active" : "");
      button.textContent = level.icon + " " + level.name;
      button.setAttribute("aria-pressed", String(level.id === state.levelId));
      button.addEventListener("click", () => {
        state.levelId = level.id;
        try {
          window.localStorage.setItem(LEVEL_KEY, level.id);
        } catch (err) { /* not important */ }
        renderLevelButtons();
        newGame();
        setStatus(level.name + " — work out the sum, then shoot at that number!");
      });
      el.levelButtons.appendChild(button);
    });
  }

  /* ---------- Boot ---------- */
  function newGame() {
    state.parity = 0;
    state.grid = makeBoard(START_ROWS);
    state.phase = "ready";
    state.score = 0;
    state.level = 1;
    state.shotsLeft = shotsPerDrop();
    state.angle = -Math.PI / 2;
    state.projectile = null;
    state.popping = [];
    state.falling = [];
    refillQueue();
    syncUI();
    setStatus(
      isMath()
        ? "Work out the sum on your bubble, then pop three of that number!"
        : "Match three or more of the same colour to pop them."
    );
  }

  try {
    state.best = Number(window.localStorage.getItem(BEST_KEY)) || 0;
    const savedMode = window.localStorage.getItem(MODE_KEY);
    if (savedMode === "math" || savedMode === "classic") state.mode = savedMode;
    const savedLevel = window.localStorage.getItem(LEVEL_KEY);
    if (savedLevel && mathLevels.some((l) => l.id === savedLevel)) state.levelId = savedLevel;
  } catch (err) {
    /* No stored preferences — defaults are fine. */
  }

  document.querySelectorAll("[data-mode]").forEach((button) => {
    const active = button.dataset.mode === state.mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  renderLevelButtons();
  newGame();
  window.requestAnimationFrame(loop);

  // Exposed purely so the offline tests can drive the engine.
  window.BubbleShooterGame = {
    state, neighbours, matchingCluster, floatingCells, snapCell, cellX, cellY,
    rowLength, isIndented, occupiedCells, valuesInPlay, makeBubble, shoot, landProjectile,
    setAngle, isMath, labelFor, problemFor, mathLevels, COLORS, R, D, ROW_H, COLS, W, H, SHOOTER_Y,
  };
})();
