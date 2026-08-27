/**
 * Mastermind — crack the hidden colour code.
 *
 * The scoring is the whole game and it is easy to get wrong: a guess peg may
 * only be credited ONCE. The classic bug is counting a repeated colour against
 * the same secret peg more than once, which hands out phantom clues. This
 * scores exact matches first, removes them from both sides, and only then
 * counts what is left — see score().
 */
(function () {
  "use strict";

  const boardEl = document.getElementById("mm-board");
  if (!boardEl) return;

  const COLORS = [
    { id: 0, name: "Red", hex: "#ff5a5a" },
    { id: 1, name: "Blue", hex: "#4a90e2" },
    { id: 2, name: "Yellow", hex: "#ffd12e" },
    { id: 3, name: "Green", hex: "#54bf62" },
    { id: 4, name: "Purple", hex: "#9b7bf7" },
    { id: 5, name: "Orange", hex: "#ff8e2b" },
    { id: 6, name: "Pink", hex: "#ff7ac0" },
    { id: 7, name: "Cyan", hex: "#3fc0b6" },
  ];

  const LEVELS = {
    easy: { label: "🐣 Easy", pegs: 4, colours: 6, tries: 12, repeats: false },
    medium: { label: "🐤 Medium", pegs: 4, colours: 6, tries: 10, repeats: true },
    hard: { label: "🦅 Hard", pegs: 5, colours: 8, tries: 10, repeats: true },
  };

  const LEVEL_KEY = "mastermind-level";

  const state = {
    levelId: "easy",
    secret: [],
    guess: [],
    rows: [],          // { guess, exact, colour }
    active: 0,         // which peg of the current guess is selected
    selected: 0,       // chosen colour
    phase: "playing",  // playing | won | lost
    wins: 0,
    played: 0,
  };

  let soundOn = true;
  let audioCtx = null;

  const el = {
    board: boardEl,
    palette: document.getElementById("mm-palette"),
    status: document.getElementById("mm-status"),
    secret: document.getElementById("mm-secret"),
    triesLeft: document.getElementById("mm-tries"),
    wins: document.getElementById("mm-wins"),
    played: document.getElementById("mm-played"),
    check: document.getElementById("btn-check"),
    clear: document.getElementById("btn-clear"),
    restart: document.getElementById("btn-restart"),
    sound: document.getElementById("btn-sound"),
  };

  function level() {
    return LEVELS[state.levelId] || LEVELS.easy;
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

  /* ---------- Rules ---------- */
  /**
   * Exact = right colour in the right place. Colour = right colour, wrong
   * place. Every peg on both sides can be used at most once, so exacts are
   * taken out before the leftovers are matched up.
   */
  function score(guess, secret) {
    let exact = 0;
    const secretLeft = [];
    const guessLeft = [];

    for (let i = 0; i < secret.length; i++) {
      if (guess[i] === secret[i]) exact += 1;
      else {
        secretLeft.push(secret[i]);
        guessLeft.push(guess[i]);
      }
    }

    let colour = 0;
    for (const peg of guessLeft) {
      const at = secretLeft.indexOf(peg);
      if (at !== -1) {
        colour += 1;
        secretLeft.splice(at, 1);   // used up, cannot be matched twice
      }
    }
    return { exact, colour };
  }

  function makeSecret() {
    const cfg = level();
    const pool = COLORS.slice(0, cfg.colours).map((c) => c.id);
    const out = [];
    if (cfg.repeats) {
      for (let i = 0; i < cfg.pegs; i++) out.push(pool[Math.floor(Math.random() * pool.length)]);
      return out;
    }
    const bag = pool.slice();
    for (let i = 0; i < cfg.pegs; i++) {
      out.push(bag.splice(Math.floor(Math.random() * bag.length), 1)[0]);
    }
    return out;
  }

  /* ---------- Flow ---------- */
  function newGame() {
    const cfg = level();
    state.secret = makeSecret();
    state.guess = new Array(cfg.pegs).fill(null);
    state.rows = [];
    state.active = 0;
    state.selected = 0;
    state.phase = "playing";
    render();
    setStatus(
      cfg.repeats
        ? "Crack the code! Colours can repeat."
        : "Crack the code! Every colour is different."
    );
  }

  function placeColour(colourId) {
    if (state.phase !== "playing") return;
    state.selected = colourId;
    state.guess[state.active] = colourId;
    // Hop to the next empty slot so you can just tap colours in order.
    const next = state.guess.indexOf(null);
    state.active = next === -1 ? Math.min(state.active + 1, state.guess.length - 1) : next;
    beep(520 + colourId * 40, 0.05, "sine");
    render();
  }

  function selectSlot(index) {
    if (state.phase !== "playing") return;
    state.active = index;
    render();
  }

  function clearGuess() {
    if (state.phase !== "playing") return;
    state.guess = new Array(level().pegs).fill(null);
    state.active = 0;
    render();
  }

  function checkGuess() {
    if (state.phase !== "playing") return;
    if (state.guess.some((p) => p === null)) {
      setStatus("Fill every slot before you check!");
      return;
    }

    const result = score(state.guess, state.secret);
    state.rows.push({ guess: state.guess.slice(), exact: result.exact, colour: result.colour });

    if (result.exact === state.secret.length) {
      state.phase = "won";
      state.wins += 1;
      state.played += 1;
      fanfare();
      setStatus("🎉 Cracked it in " + state.rows.length + (state.rows.length === 1 ? " try!" : " tries!"));
    } else if (state.rows.length >= level().tries) {
      state.phase = "lost";
      state.played += 1;
      beep(150, 0.3, "sawtooth");
      setStatus("😮 Out of tries! The code is shown above.");
    } else {
      beep(660, 0.07, "square");
      setStatus(
        result.exact + (result.exact === 1 ? " in place, " : " in place, ") +
        result.colour + " right colour but wrong place."
      );
    }

    state.guess = new Array(level().pegs).fill(null);
    state.active = 0;
    render();
  }

  /* ---------- Rendering ---------- */
  function pegEl(colourId, extraClass) {
    const peg = document.createElement("span");
    peg.className = "mm-peg" + (extraClass ? " " + extraClass : "");
    if (colourId === null || colourId === undefined) peg.classList.add("is-empty");
    else peg.style.background = COLORS[colourId].hex;
    return peg;
  }

  function render() {
    const cfg = level();
    el.board.innerHTML = "";

    // Past guesses, newest at the bottom like the real board.
    state.rows.forEach((row, i) => {
      const line = document.createElement("div");
      line.className = "mm-row";

      const num = document.createElement("span");
      num.className = "mm-row-num";
      num.textContent = String(i + 1);
      line.appendChild(num);

      const pegs = document.createElement("div");
      pegs.className = "mm-pegs";
      row.guess.forEach((c) => pegs.appendChild(pegEl(c)));
      line.appendChild(pegs);

      const clues = document.createElement("div");
      clues.className = "mm-clues";
      clues.setAttribute("aria-label", row.exact + " in place, " + row.colour + " right colour wrong place");
      for (let k = 0; k < cfg.pegs; k++) {
        const clue = document.createElement("span");
        clue.className = "mm-clue " +
          (k < row.exact ? "is-exact" : k < row.exact + row.colour ? "is-colour" : "is-none");
        clues.appendChild(clue);
      }
      line.appendChild(clues);
      el.board.appendChild(line);
    });

    // The row you are working on.
    if (state.phase === "playing") {
      const line = document.createElement("div");
      line.className = "mm-row is-active";

      const num = document.createElement("span");
      num.className = "mm-row-num";
      num.textContent = String(state.rows.length + 1);
      line.appendChild(num);

      const pegs = document.createElement("div");
      pegs.className = "mm-pegs";
      state.guess.forEach((c, i) => {
        const slot = document.createElement("button");
        slot.type = "button";
        slot.className = "mm-slot" + (i === state.active ? " is-active" : "");
        slot.setAttribute("aria-label",
          "Slot " + (i + 1) + (c === null ? ", empty" : ", " + COLORS[c].name));
        slot.appendChild(pegEl(c));
        slot.addEventListener("click", () => selectSlot(i));
        pegs.appendChild(slot);
      });
      line.appendChild(pegs);

      const clues = document.createElement("div");
      clues.className = "mm-clues";
      line.appendChild(clues);
      el.board.appendChild(line);
    }

    // Palette
    el.palette.innerHTML = "";
    COLORS.slice(0, cfg.colours).forEach((colour) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mm-colour" + (state.selected === colour.id ? " is-selected" : "");
      button.style.background = colour.hex;
      button.setAttribute("aria-label", colour.name);
      button.disabled = state.phase !== "playing";
      button.addEventListener("click", () => placeColour(colour.id));
      el.palette.appendChild(button);
    });

    // The answer, once the game is over.
    el.secret.innerHTML = "";
    el.secret.hidden = state.phase === "playing";
    if (state.phase !== "playing") {
      const label = document.createElement("span");
      label.className = "mm-secret-label";
      label.textContent = state.phase === "won" ? "You got it:" : "The code was:";
      el.secret.appendChild(label);
      state.secret.forEach((c) => el.secret.appendChild(pegEl(c, "is-big")));
    }

    el.triesLeft.textContent = String(Math.max(0, cfg.tries - state.rows.length));
    el.wins.textContent = String(state.wins);
    el.played.textContent = String(state.played);
    el.check.disabled = state.phase !== "playing";
    el.clear.disabled = state.phase !== "playing";
  }

  function setStatus(text) {
    el.status.textContent = text;
  }

  /* ---------- Wiring ---------- */
  el.check.addEventListener("click", checkGuess);
  el.clear.addEventListener("click", clearGuess);
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
      newGame();
    });
  });

  window.addEventListener("keydown", (event) => {
    if (state.phase !== "playing") return;
    const cfg = level();
    if (event.code === "Enter") { event.preventDefault(); checkGuess(); return; }
    if (event.code === "Backspace") {
      event.preventDefault();
      state.guess[state.active] = null;
      render();
      return;
    }
    if (event.code === "ArrowLeft") { event.preventDefault(); state.active = Math.max(0, state.active - 1); render(); return; }
    if (event.code === "ArrowRight") { event.preventDefault(); state.active = Math.min(cfg.pegs - 1, state.active + 1); render(); return; }
    const digit = /^Digit([1-8])$/.exec(event.code);
    if (digit) {
      const index = Number(digit[1]) - 1;
      if (index < cfg.colours) { event.preventDefault(); placeColour(index); }
    }
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

  newGame();

  window.MastermindGame = { state, score, makeSecret, checkGuess, placeColour, clearGuess, LEVELS, COLORS, level };
})();
