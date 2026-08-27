/**
 * Number Memory — a number appears for a moment, then you type it back.
 *
 * One more digit every round, so the game finds the edge of what you can hold
 * in your head and stops there. Most adults land around seven digits, which is
 * worth knowing before a child decides they are bad at it.
 *
 * How long the number stays on screen grows with its length, so a ten-digit
 * number is not simply flashed for the same instant as a two-digit one.
 */
(function () {
  "use strict";

  const stageEl = document.getElementById("nm-stage");
  if (!stageEl) return;

  const LEVELS = {
    relaxed: { label: "🐢 Relaxed", base: 1400, perDigit: 520, lives: 3 },
    normal: { label: "🐇 Normal", base: 900, perDigit: 360, lives: 3 },
    sharp: { label: "🚀 Sharp", base: 650, perDigit: 210, lives: 1 },
  };

  const LEVEL_KEY = "number-memory-level";
  const MAX_DIGITS = 20;

  const state = {
    levelId: "normal",
    phase: "ready",     // ready | showing | recall | wrong | over
    level: 1,
    number: "",
    typed: "",
    lives: 3,
    best: 0,
  };

  let showTimer = null;
  let countTimer = null;
  let soundOn = true;
  let audioCtx = null;

  const el = {
    stage: stageEl,
    status: document.getElementById("nm-status"),
    level: document.getElementById("nm-level"),
    lives: document.getElementById("nm-lives"),
    best: document.getElementById("nm-best"),
    keypad: document.getElementById("nm-keypad"),
    start: document.getElementById("btn-start"),
    restart: document.getElementById("btn-restart"),
    sound: document.getElementById("btn-sound"),
  };

  function level() { return LEVELS[state.levelId] || LEVELS.normal; }

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

  /* ---------- The number ---------- */
  /** A number of exactly `digits` digits, never starting with a zero. */
  function makeNumber(digits) {
    const count = Math.max(1, Math.min(MAX_DIGITS, digits));
    let out = String(1 + Math.floor(Math.random() * 9));
    for (let i = 1; i < count; i++) out += String(Math.floor(Math.random() * 10));
    return out;
  }

  /** Longer numbers get longer on screen - flashing them all equally is unfair. */
  function showTime(digits) {
    const cfg = level();
    return cfg.base + cfg.perDigit * Math.max(0, digits - 1);
  }

  /* ---------- Flow ---------- */
  function clearTimers() {
    if (showTimer) { window.clearTimeout(showTimer); showTimer = null; }
    if (countTimer) { window.clearInterval(countTimer); countTimer = null; }
  }

  function newGame() {
    clearTimers();
    state.level = 1;
    state.lives = level().lives;
    state.number = "";
    state.typed = "";
    state.phase = "ready";
    render();
    setStatus("A number will flash up. Remember it, then type it back!");
  }

  function showNumber() {
    clearTimers();
    state.number = makeNumber(state.level);
    state.typed = "";
    state.phase = "showing";
    beep(660, 0.06, "sine");
    render();
    showTimer = window.setTimeout(() => {
      showTimer = null;
      state.phase = "recall";
      render();
      setStatus("Now type what you saw.");
    }, showTime(state.level));
  }

  function typeDigit(digit) {
    if (state.phase !== "recall") return;
    if (state.typed.length >= state.number.length) return;
    state.typed += String(digit);
    beep(520, 0.03, "sine");
    render();
  }

  function backspace() {
    if (state.phase !== "recall") return;
    state.typed = state.typed.slice(0, -1);
    render();
  }

  function submit() {
    if (state.phase !== "recall") return;
    if (!state.typed.length) { setStatus("Type the number first!"); return; }

    if (state.typed === state.number) {
      state.level += 1;
      if (state.level - 1 > state.best) state.best = state.level - 1;
      beep(880, 0.12, "triangle");
      setStatus("✅ Correct! Now try " + state.level + " digits.");
      state.phase = "ready";
      render();
      return;
    }

    state.lives -= 1;
    state.phase = "wrong";
    beep(180, 0.28, "sawtooth");
    render();

    if (state.lives <= 0) {
      state.phase = "over";
      const reached = state.level - 1;
      if (board) board.offer(reached, state.levelId);
      fanfare();
      setStatus("The number was " + state.number + ", you typed " + state.typed +
        ". You remembered " + reached + " digit" + (reached === 1 ? "" : "s") + "!");
    } else {
      setStatus("The number was " + state.number + ", you typed " + state.typed +
        ". " + state.lives + " " + (state.lives === 1 ? "life" : "lives") + " left — press Go for another " +
        state.level + "-digit number.");
      state.phase = "ready";
    }
    render();
  }

  /* ---------- Rendering ---------- */
  function render() {
    el.stage.innerHTML = "";

    if (state.phase === "showing") {
      const number = document.createElement("p");
      number.className = "nm-number";
      number.textContent = state.number;
      el.stage.appendChild(number);

      const bar = document.createElement("div");
      bar.className = "nm-bar";
      const fill = document.createElement("div");
      fill.className = "nm-bar-fill";
      fill.style.animationDuration = showTime(state.level) + "ms";
      bar.appendChild(fill);
      el.stage.appendChild(bar);
    } else if (state.phase === "recall") {
      const slots = document.createElement("p");
      slots.className = "nm-typed";
      const shown = state.typed.padEnd(state.number.length, "•");
      slots.textContent = shown.split("").join(" ");
      slots.setAttribute("aria-label", "You have typed " + (state.typed || "nothing") +
        " of " + state.number.length + " digits");
      el.stage.appendChild(slots);
    } else if (state.phase === "over" || state.phase === "wrong") {
      const answer = document.createElement("p");
      answer.className = "nm-number nm-number--answer";
      answer.textContent = state.number;
      el.stage.appendChild(answer);
      const typed = document.createElement("p");
      typed.className = "nm-typed nm-typed--wrong";
      typed.textContent = "you typed " + (state.typed || "nothing");
      el.stage.appendChild(typed);
    } else {
      const prompt = document.createElement("p");
      prompt.className = "nm-prompt";
      prompt.textContent = state.level + " digit" + (state.level === 1 ? "" : "s");
      el.stage.appendChild(prompt);
    }

    el.level.textContent = String(state.level);
    el.lives.textContent = String(Math.max(0, state.lives));
    const stored = board ? board.entries(state.levelId) : [];
    el.best.textContent = stored.length ? String(stored[0].value) : "—";

    el.start.textContent = state.phase === "over" ? "↺ Play Again"
      : state.phase === "recall" ? "✅ Check"
      : state.phase === "showing" ? "👀 Look…" : "▶ Go";
    el.start.disabled = state.phase === "showing";
    el.keypad.hidden = state.phase !== "recall";
    renderKeypad();
  }

  function renderKeypad() {
    if (el.keypad.hidden) { el.keypad.innerHTML = ""; return; }
    if (el.keypad.children.length) return;   // built once per recall
    el.keypad.innerHTML = "";
    [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach((n) => el.keypad.appendChild(keyButton(String(n), () => typeDigit(n))));
    el.keypad.appendChild(keyButton("⌫", backspace, "nm-key--wide"));
    el.keypad.appendChild(keyButton("0", () => typeDigit(0)));
    el.keypad.appendChild(keyButton("✅", submit, "nm-key--go"));
  }

  function keyButton(label, action, extra) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "nm-key" + (extra ? " " + extra : "");
    button.textContent = label;
    button.addEventListener("click", action);
    return button;
  }

  function setStatus(text) { el.status.textContent = text; }

  /* ---------- Leaderboard ---------- */
  const board = window.Leaderboard ? window.Leaderboard.create({
    gameId: "number-memory",
    gameName: "Number Memory",
    metric: { label: "Digits", better: "higher", format: "number" },
    categories: [
      { id: "relaxed", label: "🐢 Relaxed" },
      { id: "normal", label: "🐇 Normal" },
      { id: "sharp", label: "🚀 Sharp" },
    ],
  }) : null;
  if (board) board.mount(document.getElementById("leaderboard-panel"));

  /* ---------- Wiring ---------- */
  el.start.addEventListener("click", () => {
    if (state.phase === "over") { newGame(); return; }
    if (state.phase === "recall") { submit(); return; }
    if (state.phase === "ready") showNumber();
  });

  el.restart.addEventListener("click", () => newGame());
  el.sound.addEventListener("click", () => {
    soundOn = !soundOn;
    el.sound.textContent = soundOn ? "🔊 Sound On" : "🔇 Sound Off";
    el.sound.setAttribute("aria-pressed", String(soundOn));
  });

  window.addEventListener("keydown", (event) => {
    const digit = /^(?:Digit|Numpad)([0-9])$/.exec(event.code);
    if (digit) { event.preventDefault(); typeDigit(Number(digit[1])); return; }
    if (event.code === "Backspace") { event.preventDefault(); backspace(); return; }
    if (event.code === "Enter" || event.code === "Space") {
      event.preventDefault();
      if (state.phase === "over") newGame();
      else if (state.phase === "recall") submit();
      else if (state.phase === "ready") showNumber();
    }
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

  window.NumberMemoryGame = {
    state, makeNumber, showTime, showNumber, typeDigit, backspace, submit, newGame,
    LEVELS, MAX_DIGITS, level,
  };
})();
