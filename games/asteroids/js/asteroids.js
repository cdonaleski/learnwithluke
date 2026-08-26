/**
 * Asteroids for Learn With Luke
 * An old-school vector remake of the 1979 arcade original: momentum, screen
 * wrap, splitting rocks, flying saucers, hyperspace and all.
 */
(function () {
  "use strict";

  const canvas = document.getElementById("asteroids-canvas");
  if (!canvas || !canvas.getContext) return;

  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const TAU = Math.PI * 2;

  /* ---------- Tuning ---------- */
  const START_LIVES = 3;
  const EXTRA_LIFE_EVERY = 10000;

  const SHIP_R = 14;
  const SHIP_HIT_R = 11;
  const TURN_SPEED = 3.8;      // radians per second
  const THRUST_ACCEL = 320;    // pixels per second squared
  const DRAG = 0.32;           // gentle space friction, like the original
  const MAX_SHIP_SPEED = 420;
  const RESPAWN_DELAY = 1.6;
  const INVULN_TIME = 2.6;
  const HYPERSPACE_COOLDOWN = 1.4;

  const MAX_BULLETS = 4;
  const BULLET_SPEED = 540;
  const BULLET_LIFE = 1.15;
  const FIRE_COOLDOWN = 0.2;

  const ROCK = {
    3: { radius: 46, minSpeed: 32, maxSpeed: 66, points: 20 },
    2: { radius: 26, minSpeed: 55, maxSpeed: 100, points: 50 },
    1: { radius: 14, minSpeed: 80, maxSpeed: 150, points: 100 },
  };
  const WAVE_DELAY = 1.8;
  const SAFE_RADIUS = 130; // keep the respawn point clear

  const SAUCER = {
    big: { radius: 20, speed: 95, points: 200, shotEvery: 1.5, aimError: 0.55 },
    small: { radius: 12, speed: 135, points: 1000, shotEvery: 1.1, aimError: 0.12 },
  };
  const SAUCER_MIN_GAP = 13;
  const SAUCER_MAX_GAP = 24;
  const SAUCER_BULLET_SPEED = 330;

  const HI_SCORE_KEY = "lwl-asteroids-high-score";

  /* ---------- State ---------- */
  const state = {
    phase: "idle", // idle | playing | paused | over
    score: 0,
    highScore: 0,
    lives: START_LIVES,
    wave: 0,
    nextExtraLife: EXTRA_LIFE_EVERY,
    waveTimer: 0,
    respawnTimer: 0,
    saucerTimer: SAUCER_MIN_GAP,
    soundOn: true,
    lastTime: 0,
  };

  const ship = {
    x: W / 2, y: H / 2, vx: 0, vy: 0,
    angle: -Math.PI / 2,
    alive: true,
    invuln: 0,
    fireTimer: 0,
    hyperTimer: 0,
    thrusting: false,
    thrustSound: 0,
  };

  let rocks = [];
  let bullets = [];
  let particles = [];
  let saucer = null;
  let saucerSoundTimer = 0;

  const keys = { left: false, right: false, thrust: false, fire: false };

  /* ---------- Elements ---------- */
  const el = {
    status: document.getElementById("asteroids-status"),
    start: document.getElementById("btn-start"),
    restart: document.getElementById("btn-restart"),
    sound: document.getElementById("btn-sound"),
    touchPad: document.getElementById("touch-pad"),
  };

  /* ---------- Sound ---------- */
  let audioCtx = null;

  function getAudio() {
    if (!state.soundOn) return null;
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return null;
      if (!audioCtx) audioCtx = new AudioCtor();
      if (audioCtx.state === "suspended") audioCtx.resume();
      return audioCtx;
    } catch (err) {
      return null;
    }
  }

  function tone(freq, duration, type, volume, endFreq) {
    const ac = getAudio();
    if (!ac) return;
    try {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type || "square";
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, ac.currentTime + duration);
      gain.gain.setValueAtTime(volume === undefined ? 0.05 : volume, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + duration);
    } catch (err) {
      /* sound is optional */
    }
  }

  function noise(duration, volume) {
    const ac = getAudio();
    if (!ac) return;
    try {
      const frames = Math.floor(ac.sampleRate * duration);
      const buffer = ac.createBuffer(1, frames, ac.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frames; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
      }
      const src = ac.createBufferSource();
      const gain = ac.createGain();
      src.buffer = buffer;
      gain.gain.value = volume === undefined ? 0.09 : volume;
      src.connect(gain);
      gain.connect(ac.destination);
      src.start();
    } catch (err) {
      /* sound is optional */
    }
  }

  /* ---------- Helpers ---------- */
  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function wrap(obj, radius) {
    if (obj.x < -radius) obj.x = W + radius;
    else if (obj.x > W + radius) obj.x = -radius;
    if (obj.y < -radius) obj.y = H + radius;
    else if (obj.y > H + radius) obj.y = -radius;
  }

  function hits(a, b, ra, rb) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const r = ra + rb;
    return dx * dx + dy * dy <= r * r;
  }

  function loadHighScore() {
    try {
      const stored = window.localStorage.getItem(HI_SCORE_KEY);
      state.highScore = stored ? Number(stored) || 0 : 0;
    } catch (err) {
      state.highScore = 0;
    }
  }

  function saveHighScore() {
    try {
      window.localStorage.setItem(HI_SCORE_KEY, String(state.highScore));
    } catch (err) {
      /* private browsing — just keep it in memory */
    }
  }

  function addScore(points) {
    state.score += points;
    if (state.score > state.highScore) {
      state.highScore = state.score;
      saveHighScore();
    }
    if (state.score >= state.nextExtraLife) {
      state.lives += 1;
      state.nextExtraLife += EXTRA_LIFE_EVERY;
      tone(880, 0.12, "triangle", 0.06, 1760);
    }
  }

  /* ---------- Spawning ---------- */
  function makeRock(x, y, size) {
    const cfg = ROCK[size];
    const angle = rand(0, TAU);
    const speed = rand(cfg.minSpeed, cfg.maxSpeed);
    const points = Math.floor(rand(9, 13));
    const shape = [];
    for (let i = 0; i < points; i++) {
      shape.push(rand(0.72, 1.22));
    }
    return {
      x: x, y: y, size: size, radius: cfg.radius,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      angle: rand(0, TAU),
      spin: rand(-0.8, 0.8),
      shape: shape,
    };
  }

  function spawnWave() {
    state.wave += 1;
    const count = Math.min(11, 4 + (state.wave - 1) * 2);
    for (let i = 0; i < count; i++) {
      let x, y, tries = 0;
      do {
        x = rand(0, W);
        y = rand(0, H);
        tries += 1;
      } while (tries < 40 && Math.hypot(x - W / 2, y - H / 2) < SAFE_RADIUS + ROCK[3].radius);
      rocks.push(makeRock(x, y, 3));
    }
    updateStatus();
  }

  function spawnSaucer() {
    const smallChance = Math.min(0.75, 0.15 + state.score / 20000 + state.wave * 0.05);
    const kind = Math.random() < smallChance ? "small" : "big";
    const cfg = SAUCER[kind];
    const fromLeft = Math.random() < 0.5;
    saucer = {
      kind: kind,
      radius: cfg.radius,
      x: fromLeft ? -cfg.radius : W + cfg.radius,
      y: rand(60, H - 60),
      vx: (fromLeft ? 1 : -1) * cfg.speed,
      vy: 0,
      shotTimer: cfg.shotEvery * 0.6,
      turnTimer: rand(0.8, 1.8),
      travelled: 0,
    };
    saucerSoundTimer = 0;
  }

  function explode(x, y, count, speed, life) {
    for (let i = 0; i < count; i++) {
      const angle = rand(0, TAU);
      const v = rand(speed * 0.3, speed);
      particles.push({
        x: x, y: y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: rand(life * 0.5, life),
        maxLife: life,
      });
    }
  }

  /* ---------- Game flow ---------- */
  function resetShip(toCenter) {
    if (toCenter) {
      ship.x = W / 2;
      ship.y = H / 2;
    }
    ship.vx = 0;
    ship.vy = 0;
    ship.angle = -Math.PI / 2;
    ship.alive = true;
    ship.invuln = INVULN_TIME;
    ship.fireTimer = 0;
    ship.hyperTimer = 0;
    ship.thrusting = false;
  }

  function newGame() {
    state.score = 0;
    state.lives = START_LIVES;
    state.wave = 0;
    state.nextExtraLife = EXTRA_LIFE_EVERY;
    state.waveTimer = 0;
    state.respawnTimer = 0;
    state.saucerTimer = rand(SAUCER_MIN_GAP, SAUCER_MAX_GAP);
    rocks = [];
    bullets = [];
    particles = [];
    saucer = null;
    resetShip(true);
    ship.invuln = 0;
    state.phase = "idle";
    spawnWave();
    syncUI();
    draw();
  }

  function startGame() {
    if (state.phase === "over") newGame();
    if (state.phase === "idle") {
      state.phase = "playing";
      ship.invuln = INVULN_TIME;
    } else if (state.phase === "paused") {
      state.phase = "playing";
    }
    canvas.focus();
    syncUI();
  }

  function pauseGame() {
    if (state.phase !== "playing") return;
    state.phase = "paused";
    keys.left = keys.right = keys.thrust = keys.fire = false;
    syncUI();
    draw();
  }

  function togglePlay() {
    if (state.phase === "playing") pauseGame();
    else startGame();
  }

  function destroyShip() {
    if (!ship.alive || ship.invuln > 0) return;
    ship.alive = false;
    ship.thrusting = false;
    explode(ship.x, ship.y, 22, 150, 1.1);
    noise(0.5, 0.11);
    state.lives -= 1;
    if (state.lives <= 0) {
      state.phase = "over";
      saveHighScore();
    } else {
      state.respawnTimer = RESPAWN_DELAY;
    }
    syncUI();
  }

  function splitRock(rock, index) {
    rocks.splice(index, 1);
    addScore(ROCK[rock.size].points);
    explode(rock.x, rock.y, rock.size * 5 + 5, 60 + rock.size * 25, 0.7);
    if (rock.size === 3) noise(0.36, 0.1);
    else if (rock.size === 2) noise(0.26, 0.085);
    else noise(0.18, 0.07);

    if (rock.size > 1) {
      for (let i = 0; i < 2; i++) {
        const piece = makeRock(rock.x, rock.y, rock.size - 1);
        // Inherit some of the parent's drift so pieces fan out believably.
        piece.vx = piece.vx * 0.8 + rock.vx * 0.5;
        piece.vy = piece.vy * 0.8 + rock.vy * 0.5;
        rocks.push(piece);
      }
    }
  }

  function fire() {
    if (!ship.alive || ship.fireTimer > 0) return;
    const playerBullets = bullets.filter(function (b) { return !b.fromSaucer; }).length;
    if (playerBullets >= MAX_BULLETS) return;
    bullets.push({
      x: ship.x + Math.cos(ship.angle) * SHIP_R,
      y: ship.y + Math.sin(ship.angle) * SHIP_R,
      vx: Math.cos(ship.angle) * BULLET_SPEED + ship.vx * 0.5,
      vy: Math.sin(ship.angle) * BULLET_SPEED + ship.vy * 0.5,
      life: BULLET_LIFE,
      fromSaucer: false,
    });
    ship.fireTimer = FIRE_COOLDOWN;
    tone(760, 0.09, "square", 0.045, 220);
  }

  function hyperspace() {
    if (!ship.alive || ship.hyperTimer > 0 || state.phase !== "playing") return;
    ship.x = rand(40, W - 40);
    ship.y = rand(40, H - 40);
    ship.vx = 0;
    ship.vy = 0;
    ship.hyperTimer = HYPERSPACE_COOLDOWN;
    ship.invuln = Math.max(ship.invuln, 0.7);
    explode(ship.x, ship.y, 10, 90, 0.5);
    tone(200, 0.22, "sine", 0.05, 1400);
  }

  /* ---------- Update ---------- */
  function updateShip(dt) {
    if (!ship.alive) {
      if (state.respawnTimer > 0) {
        state.respawnTimer -= dt;
        if (state.respawnTimer <= 0) {
          const centerClear = rocks.every(function (rock) {
            return Math.hypot(rock.x - W / 2, rock.y - H / 2) > SAFE_RADIUS + rock.radius;
          }) && (!saucer || Math.hypot(saucer.x - W / 2, saucer.y - H / 2) > SAFE_RADIUS);
          if (centerClear) resetShip(true);
          else state.respawnTimer = 0.3; // wait for a gap
        }
      }
      return;
    }

    if (ship.invuln > 0) ship.invuln -= dt;
    if (ship.fireTimer > 0) ship.fireTimer -= dt;
    if (ship.hyperTimer > 0) ship.hyperTimer -= dt;

    if (keys.left) ship.angle -= TURN_SPEED * dt;
    if (keys.right) ship.angle += TURN_SPEED * dt;

    ship.thrusting = keys.thrust;
    if (ship.thrusting) {
      ship.vx += Math.cos(ship.angle) * THRUST_ACCEL * dt;
      ship.vy += Math.sin(ship.angle) * THRUST_ACCEL * dt;
      ship.thrustSound -= dt;
      if (ship.thrustSound <= 0) {
        ship.thrustSound = 0.11;
        tone(rand(55, 75), 0.1, "sawtooth", 0.035);
      }
    }

    // Space drag, then clamp to a top speed.
    const decay = Math.exp(-DRAG * dt);
    ship.vx *= decay;
    ship.vy *= decay;
    const speed = Math.hypot(ship.vx, ship.vy);
    if (speed > MAX_SHIP_SPEED) {
      ship.vx = (ship.vx / speed) * MAX_SHIP_SPEED;
      ship.vy = (ship.vy / speed) * MAX_SHIP_SPEED;
    }

    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;
    wrap(ship, SHIP_R);

    if (keys.fire) fire();
  }

  function updateSaucer(dt) {
    if (!saucer) {
      state.saucerTimer -= dt;
      if (state.saucerTimer <= 0 && rocks.length > 0) {
        spawnSaucer();
        state.saucerTimer = rand(SAUCER_MIN_GAP, SAUCER_MAX_GAP);
      }
      return;
    }

    const cfg = SAUCER[saucer.kind];

    saucer.turnTimer -= dt;
    if (saucer.turnTimer <= 0) {
      saucer.turnTimer = rand(0.7, 1.6);
      saucer.vy = rand(-1, 1) < 0 ? -cfg.speed * 0.55 : rand(0, 1) < 0.4 ? cfg.speed * 0.55 : 0;
    }

    saucer.x += saucer.vx * dt;
    saucer.y += saucer.vy * dt;
    saucer.travelled += Math.abs(saucer.vx) * dt;
    if (saucer.y < saucer.radius) { saucer.y = saucer.radius; saucer.vy = Math.abs(saucer.vy); }
    if (saucer.y > H - saucer.radius) { saucer.y = H - saucer.radius; saucer.vy = -Math.abs(saucer.vy); }

    // Saucers cross the screen once, then leave — they don't wrap.
    if (saucer.x < -saucer.radius * 2 || saucer.x > W + saucer.radius * 2) {
      saucer = null;
      return;
    }

    saucerSoundTimer -= dt;
    if (saucerSoundTimer <= 0) {
      saucerSoundTimer = 0.4;
      tone(saucer.kind === "small" ? 440 : 220, 0.12, "square", 0.028);
    }

    saucer.shotTimer -= dt;
    if (saucer.shotTimer <= 0) {
      saucer.shotTimer = cfg.shotEvery;
      let angle;
      if (ship.alive) {
        angle = Math.atan2(ship.y - saucer.y, ship.x - saucer.x) + rand(-cfg.aimError, cfg.aimError);
      } else {
        angle = rand(0, TAU);
      }
      bullets.push({
        x: saucer.x + Math.cos(angle) * saucer.radius,
        y: saucer.y + Math.sin(angle) * saucer.radius,
        vx: Math.cos(angle) * SAUCER_BULLET_SPEED,
        vy: Math.sin(angle) * SAUCER_BULLET_SPEED,
        life: 1.4,
        fromSaucer: true,
      });
      tone(340, 0.08, "sawtooth", 0.035, 140);
    }
  }

  function killSaucer() {
    explode(saucer.x, saucer.y, 18, 130, 0.8);
    noise(0.4, 0.1);
    saucer = null;
  }

  function updateEntities(dt) {
    rocks.forEach(function (rock) {
      rock.x += rock.vx * dt;
      rock.y += rock.vy * dt;
      rock.angle += rock.spin * dt;
      wrap(rock, rock.radius);
    });

    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      wrap(bullet, 2);
      if (bullet.life <= 0) bullets.splice(i, 1);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function handleCollisions() {
    // Bullets vs rocks and saucer
    for (let b = bullets.length - 1; b >= 0; b--) {
      const bullet = bullets[b];
      let consumed = false;

      for (let r = rocks.length - 1; r >= 0; r--) {
        if (hits(bullet, rocks[r], 1, rocks[r].radius * 0.85)) {
          const rock = rocks[r];
          bullets.splice(b, 1);
          consumed = true;
          if (bullet.fromSaucer) {
            rocks.splice(r, 1);
            explode(rock.x, rock.y, 8, 70, 0.5);
          } else {
            splitRock(rock, r);
          }
          break;
        }
      }
      if (consumed) continue;

      if (saucer && !bullet.fromSaucer && hits(bullet, saucer, 1, saucer.radius)) {
        bullets.splice(b, 1);
        addScore(SAUCER[saucer.kind].points);
        killSaucer();
        continue;
      }

      if (ship.alive && bullet.fromSaucer && hits(bullet, ship, 1, SHIP_HIT_R)) {
        bullets.splice(b, 1);
        destroyShip();
      }
    }

    // Ship vs rocks
    if (ship.alive && ship.invuln <= 0) {
      for (let r = 0; r < rocks.length; r++) {
        if (hits(ship, rocks[r], SHIP_HIT_R, rocks[r].radius * 0.85)) {
          const rock = rocks[r];
          splitRock(rock, r);
          destroyShip();
          break;
        }
      }
    }

    // Ship vs saucer
    if (ship.alive && ship.invuln <= 0 && saucer && hits(ship, saucer, SHIP_HIT_R, saucer.radius)) {
      addScore(SAUCER[saucer.kind].points);
      killSaucer();
      destroyShip();
    }

    // Saucer vs rocks
    if (saucer) {
      for (let r = 0; r < rocks.length; r++) {
        if (hits(saucer, rocks[r], saucer.radius, rocks[r].radius * 0.85)) {
          splitRock(rocks[r], r);
          killSaucer();
          break;
        }
      }
    }
  }

  function update(dt) {
    if (state.phase !== "playing") return;

    updateShip(dt);
    updateSaucer(dt);
    updateEntities(dt);
    handleCollisions();

    if (rocks.length === 0) {
      if (state.waveTimer <= 0) {
        state.waveTimer = WAVE_DELAY;
      } else {
        state.waveTimer -= dt;
        if (state.waveTimer <= 0) {
          state.waveTimer = 0;
          spawnWave();
        }
      }
    }

    if (state.phase === "playing") updateStatus();
  }

  /* ---------- Draw ---------- */
  function stroke(points, close) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    if (close !== false) ctx.closePath();
    ctx.stroke();
  }

  function drawShipShape(x, y, angle, scale) {
    const s = scale || 1;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const pts = [[SHIP_R, 0], [-SHIP_R * 0.75, SHIP_R * 0.68], [-SHIP_R * 0.4, 0], [-SHIP_R * 0.75, -SHIP_R * 0.68]];
    stroke(pts.map(function (p) {
      return [x + (p[0] * cos - p[1] * sin) * s, y + (p[0] * sin + p[1] * cos) * s];
    }));
  }

  function drawShip() {
    if (!ship.alive) return;
    // Blink while the shield is up.
    if (ship.invuln > 0 && Math.floor(ship.invuln * 10) % 2 === 0) return;

    drawShipShape(ship.x, ship.y, ship.angle, 1);

    if (ship.thrusting && Math.random() > 0.35) {
      const cos = Math.cos(ship.angle);
      const sin = Math.sin(ship.angle);
      const flame = [[-SHIP_R * 0.45, SHIP_R * 0.34], [-SHIP_R * (1.1 + Math.random() * 0.5), 0], [-SHIP_R * 0.45, -SHIP_R * 0.34]];
      stroke(flame.map(function (p) {
        return [ship.x + (p[0] * cos - p[1] * sin), ship.y + (p[0] * sin + p[1] * cos)];
      }), false);
    }
  }

  function drawRocks() {
    rocks.forEach(function (rock) {
      const pts = rock.shape.map(function (jitter, i) {
        const a = rock.angle + (i / rock.shape.length) * TAU;
        return [rock.x + Math.cos(a) * rock.radius * jitter, rock.y + Math.sin(a) * rock.radius * jitter];
      });
      stroke(pts);
    });
  }

  function drawSaucer() {
    if (!saucer) return;
    const r = saucer.radius;
    const x = saucer.x;
    const y = saucer.y;
    stroke([[x - r, y], [x - r * 0.45, y - r * 0.35], [x + r * 0.45, y - r * 0.35], [x + r, y], [x + r * 0.5, y + r * 0.4], [x - r * 0.5, y + r * 0.4]]);
    stroke([[x - r, y], [x + r, y]], false);
    stroke([[x - r * 0.45, y - r * 0.35], [x - r * 0.25, y - r * 0.7], [x + r * 0.25, y - r * 0.7], [x + r * 0.45, y - r * 0.35]], false);
  }

  function drawBullets() {
    bullets.forEach(function (bullet) {
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.fromSaucer ? 2.5 : 2, 0, TAU);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    });
  }

  function drawParticles() {
    particles.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.5, 0, TAU);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawHud() {
    ctx.font = "26px 'Courier New', Courier, monospace";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#ffffff";

    ctx.textAlign = "left";
    ctx.fillText(String(state.score).padStart(2, "0"), 24, 18);

    ctx.textAlign = "center";
    ctx.font = "18px 'Courier New', Courier, monospace";
    ctx.fillText(String(state.highScore).padStart(2, "0"), W / 2, 20);

    ctx.textAlign = "right";
    ctx.fillText("WAVE " + Math.max(1, state.wave), W - 24, 20);

    for (let i = 0; i < state.lives; i++) {
      drawShipShape(38 + i * 26, 66, -Math.PI / 2, 0.62);
    }
  }

  function drawOverlay(title, subtitle) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.font = "48px 'Courier New', Courier, monospace";
    ctx.fillText(title, W / 2, H / 2 - (subtitle ? 24 : 0));
    if (subtitle) {
      ctx.font = "20px 'Courier New', Courier, monospace";
      ctx.fillText(subtitle, W / 2, H / 2 + 34);
    }
  }

  function draw() {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(255, 255, 255, 0.55)";
    ctx.shadowBlur = 6;

    drawRocks();
    drawSaucer();
    drawShip();
    drawBullets();
    drawParticles();
    drawHud();

    if (state.phase === "idle") drawOverlay("ASTEROIDS", "PRESS START");
    else if (state.phase === "paused") drawOverlay("PAUSED", "PRESS P TO RESUME");
    else if (state.phase === "over") drawOverlay("GAME OVER", "SCORE " + state.score);

    ctx.shadowBlur = 0;
  }

  /* ---------- Loop ---------- */
  function loop(timestamp) {
    window.requestAnimationFrame(loop);
    if (!state.lastTime) state.lastTime = timestamp;
    const dt = Math.min(0.05, (timestamp - state.lastTime) / 1000);
    state.lastTime = timestamp;
    update(dt);
    draw();
  }

  /* ---------- UI ---------- */
  function syncUI() {
    el.start.textContent = state.phase === "playing" ? "⏸ Pause" : state.phase === "paused" ? "▶ Resume" : "▶ Start";
    updateStatus();
  }

  let lastStatus = "";
  function updateStatus() {
    let message;
    if (state.phase === "idle") {
      message = "Press Start to launch! Arrow keys to fly, Space to shoot.";
    } else if (state.phase === "paused") {
      message = "Paused — press P or Resume to keep playing.";
    } else if (state.phase === "over") {
      message = "Game over — you scored " + state.score + ". Best so far: " + state.highScore + ".";
    } else {
      message = "Wave " + state.wave + " · Score " + state.score + " · " +
        state.lives + (state.lives === 1 ? " ship" : " ships") + " left";
    }
    if (message !== lastStatus) {
      lastStatus = message;
      el.status.textContent = message;
    }
  }

  /* ---------- Input ---------- */
  const KEY_MAP = {
    ArrowLeft: "left", KeyA: "left",
    ArrowRight: "right", KeyD: "right",
    ArrowUp: "thrust", KeyW: "thrust",
    Space: "fire",
  };

  window.addEventListener("keydown", function (event) {
    if (event.repeat && event.code !== "Space") return;

    if (event.code === "KeyP") {
      event.preventDefault();
      togglePlay();
      return;
    }
    if (event.code === "KeyH" || event.code === "ShiftLeft" || event.code === "ShiftRight") {
      event.preventDefault();
      hyperspace();
      return;
    }

    const action = KEY_MAP[event.code];
    if (!action) return;
    event.preventDefault();
    keys[action] = true;
    if (state.phase === "idle" || state.phase === "paused") startGame();
  });

  window.addEventListener("keyup", function (event) {
    const action = KEY_MAP[event.code];
    if (!action) return;
    event.preventDefault();
    keys[action] = false;
  });

  // Touch / pointer controls
  document.querySelectorAll("[data-hold]").forEach(function (button) {
    const action = button.dataset.hold;
    const press = function (event) {
      event.preventDefault();
      keys[action] = true;
      button.classList.add("is-pressed");
      if (state.phase === "idle" || state.phase === "paused") startGame();
    };
    const release = function (event) {
      if (event && event.preventDefault) event.preventDefault();
      keys[action] = false;
      button.classList.remove("is-pressed");
    };
    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
  });

  document.querySelectorAll("[data-tap]").forEach(function (button) {
    button.addEventListener("click", function (event) {
      event.preventDefault();
      if (button.dataset.tap === "hyperspace") hyperspace();
    });
  });

  el.start.addEventListener("click", togglePlay);
  el.restart.addEventListener("click", function () {
    newGame();
    startGame();
  });
  el.sound.addEventListener("click", function () {
    state.soundOn = !state.soundOn;
    el.sound.textContent = state.soundOn ? "🔊 Sound On" : "🔇 Sound Off";
    el.sound.setAttribute("aria-pressed", String(state.soundOn));
    if (state.soundOn) tone(660, 0.08, "triangle", 0.05);
  });

  canvas.addEventListener("pointerdown", function () {
    canvas.focus();
    if (state.phase === "idle") startGame();
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) pauseGame();
  });
  window.addEventListener("blur", pauseGame);

  // Show the on-screen pad for touch devices even on wide screens.
  try {
    if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) {
      el.touchPad.classList.add("is-visible");
    }
  } catch (err) {
    /* the CSS breakpoint still covers small screens */
  }

  /* ---------- Go ---------- */
  loadHighScore();
  newGame();
  window.requestAnimationFrame(loop);
})();
