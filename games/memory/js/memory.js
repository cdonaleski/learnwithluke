/**
 * Memory — flip two cards, find the matching pairs.
 * Card faces come from js/themes.js; adding a theme needs no changes here.
 */
(function () {
  "use strict";

  const grid = document.getElementById("memory-grid");
  if (!grid) return;

  const SIZES = [
    { id: "small", label: "🐣 Easy", pairs: 6, columns: 4 },
    { id: "medium", label: "🐤 Medium", pairs: 8, columns: 4 },
    { id: "large", label: "🦅 Hard", pairs: 12, columns: 6 },
  ];

  const FLIP_BACK_MS = 900;
  const THEME_KEY = "memory-theme";
  const SIZE_KEY = "memory-size";
  const BEST_KEY = "memory-best";

  const themes = Array.isArray(window.MemoryThemes) ? window.MemoryThemes.filter(isUsableTheme) : [];

  const state = {
    themeId: themes.length ? themes[0].id : null,
    sizeId: "small",
    deck: [],
    flipped: [],   // indexes of face-up, unmatched cards
    matched: 0,
    moves: 0,
    locked: false,
    started: false,
    finished: false,
    seconds: 0,
    best: {},
  };

  let timerId = null;
  let flipBackId = null;
  let soundOn = true;
  let audioCtx = null;

  const el = {
    moves: document.getElementById("memory-moves"),
    matches: document.getElementById("memory-matches"),
    time: document.getElementById("memory-time"),
    best: document.getElementById("memory-best"),
    status: document.getElementById("memory-status"),
    themeButtons: document.getElementById("theme-buttons"),
    sizeButtons: document.getElementById("size-buttons"),
    restart: document.getElementById("btn-restart"),
    sound: document.getElementById("btn-sound"),
  };

  /* ---------- Theme validation ---------- */
  function isUsableTheme(theme) {
    if (!theme || typeof theme.id !== "string" || !Array.isArray(theme.cards)) return false;
    const faces = theme.cards.filter((c) => typeof c === "string" && c.length);
    const unique = new Set(faces);
    if (unique.size !== faces.length) {
      // Two identical faces would look like a match between unrelated cards.
      window.console.warn('Memory: theme "' + theme.id + '" has duplicate card faces and was skipped.');
      return false;
    }
    if (faces.length < SIZES[0].pairs) {
      window.console.warn(
        'Memory: theme "' + theme.id + '" needs at least ' + SIZES[0].pairs + " faces and was skipped."
      );
      return false;
    }
    return true;
  }

  function currentTheme() {
    return themes.find((t) => t.id === state.themeId) || themes[0];
  }

  function currentSize() {
    return SIZES.find((s) => s.id === state.sizeId) || SIZES[0];
  }

  /** Sizes this theme has enough distinct faces for. */
  function sizesFor(theme) {
    return SIZES.filter((size) => theme.cards.length >= size.pairs);
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
    } catch (err) {
      /* Sound is optional. */
    }
  }

  function playFanfare() {
    [523, 659, 784, 1047].forEach((freq, i) => {
      window.setTimeout(() => beep(freq, 0.2, "triangle"), i * 140);
    });
  }

  /* ---------- Saved preferences and best scores ---------- */
  function readStored(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : raw;
    } catch (err) {
      return fallback;
    }
  }

  function writeStored(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (err) {
      /* Private browsing — preferences just won't stick. */
    }
  }

  function loadBest() {
    try {
      const parsed = JSON.parse(readStored(BEST_KEY, "{}"));
      state.best = parsed && typeof parsed === "object" ? parsed : {};
    } catch (err) {
      state.best = {};
    }
  }

  function bestForCurrent() {
    const value = state.best[state.sizeId];
    return typeof value === "number" ? value : null;
  }

  function recordBest() {
    const previous = bestForCurrent();
    if (previous !== null && state.moves >= previous) return false;
    state.best[state.sizeId] = state.moves;
    writeStored(BEST_KEY, JSON.stringify(state.best));
    return true;
  }

  /* ---------- Deck ---------- */
  function shuffle(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const swap = out[i];
      out[i] = out[j];
      out[j] = swap;
    }
    return out;
  }

  function buildDeck() {
    const theme = currentTheme();
    const size = currentSize();
    // Draw a different subset of the theme each game, then pair and shuffle.
    const faces = shuffle(theme.cards).slice(0, size.pairs);
    const cards = [];
    faces.forEach((face, pairIndex) => {
      cards.push({ face, pairIndex, matched: false, faceUp: false });
      cards.push({ face, pairIndex, matched: false, faceUp: false });
    });
    return shuffle(cards);
  }

  /* ---------- Timer ---------- */
  function startTimer() {
    if (timerId) return;
    timerId = window.setInterval(() => {
      state.seconds += 1;
      renderStats();
    }, 1000);
  }

  function stopTimer() {
    if (!timerId) return;
    window.clearInterval(timerId);
    timerId = null;
  }

  function formatTime(total) {
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return mins + ":" + String(secs).padStart(2, "0");
  }

  /* ---------- Game flow ---------- */
  function newGame() {
    if (flipBackId) {
      window.clearTimeout(flipBackId);
      flipBackId = null;
    }
    stopTimer();
    state.deck = buildDeck();
    state.flipped = [];
    state.matched = 0;
    state.moves = 0;
    state.locked = false;
    state.started = false;
    state.finished = false;
    state.seconds = 0;
    renderGrid();
    renderStats();
    setStatus("Flip two cards to find a matching pair!");
  }

  function flipCard(index) {
    if (state.locked || state.finished) return;
    const card = state.deck[index];
    if (!card || card.matched || card.faceUp) return;

    if (!state.started) {
      state.started = true;
      startTimer();
    }

    card.faceUp = true;
    state.flipped.push(index);
    beep(560, 0.06, "sine");

    if (state.flipped.length < 2) {
      renderGrid();
      return;
    }

    state.moves += 1;
    const [a, b] = state.flipped;
    const isMatch = state.deck[a].face === state.deck[b].face;

    if (isMatch) {
      state.deck[a].matched = true;
      state.deck[b].matched = true;
      state.flipped = [];
      state.matched += 1;
      beep(860, 0.12, "triangle");
      setStatus("✨ Match! " + state.matched + " of " + currentSize().pairs + " pairs found.");
      if (state.matched === currentSize().pairs) finish();
    } else {
      // Lock the board so a fast tapper can't turn over a third card.
      state.locked = true;
      setStatus("Not a pair — have another look!");
      flipBackId = window.setTimeout(() => {
        state.deck[a].faceUp = false;
        state.deck[b].faceUp = false;
        state.flipped = [];
        state.locked = false;
        flipBackId = null;
        renderGrid();
      }, FLIP_BACK_MS);
    }

    renderGrid();
    renderStats();
  }

  function finish() {
    state.finished = true;
    stopTimer();
    const isBest = recordBest();
    playFanfare();
    setStatus(
      (isBest ? "🏆 New best — " : "🎉 All pairs found! ") +
        state.moves + " moves in " + formatTime(state.seconds) + "." +
        (isBest ? " Fewest moves yet!" : "")
    );
    renderStats();
  }

  /* ---------- Rendering ---------- */
  function renderGrid() {
    const size = currentSize();
    grid.style.setProperty("--memory-columns", String(size.columns));
    grid.innerHTML = "";

    state.deck.forEach((card, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className =
        "memory-card" +
        (card.faceUp || card.matched ? " is-flipped" : "") +
        (card.matched ? " is-matched" : "");
      button.setAttribute("aria-label",
        card.faceUp || card.matched ? "Card " + (index + 1) + ", " + card.face : "Card " + (index + 1) + ", face down");
      button.disabled = card.matched || state.finished;
      button.addEventListener("click", () => flipCard(index));

      const inner = document.createElement("span");
      inner.className = "memory-card-inner";

      const back = document.createElement("span");
      back.className = "memory-card-face memory-card-back";
      back.textContent = "?";
      back.setAttribute("aria-hidden", "true");

      const front = document.createElement("span");
      front.className = "memory-card-face memory-card-front";
      front.textContent = card.face;
      front.setAttribute("aria-hidden", "true");

      inner.appendChild(back);
      inner.appendChild(front);
      button.appendChild(inner);
      grid.appendChild(button);
    });
  }

  function renderStats() {
    el.moves.textContent = String(state.moves);
    el.matches.textContent = state.matched + "/" + currentSize().pairs;
    el.time.textContent = formatTime(state.seconds);
    const best = bestForCurrent();
    el.best.textContent = best === null ? "—" : String(best);
  }

  function setStatus(text) {
    el.status.textContent = text;
  }

  /* ---------- Option pickers (built from the theme list) ---------- */
  function renderThemeButtons() {
    el.themeButtons.innerHTML = "";
    themes.forEach((theme) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option-btn" + (theme.id === state.themeId ? " is-active" : "");
      button.textContent = theme.icon + " " + theme.name;
      button.setAttribute("aria-pressed", String(theme.id === state.themeId));
      button.addEventListener("click", () => {
        state.themeId = theme.id;
        writeStored(THEME_KEY, theme.id);
        // A smaller theme may not support the current board size.
        const allowed = sizesFor(theme);
        if (!allowed.some((s) => s.id === state.sizeId)) state.sizeId = allowed[allowed.length - 1].id;
        renderThemeButtons();
        renderSizeButtons();
        newGame();
        setStatus("Theme changed to " + theme.name + " — new cards dealt!");
      });
      el.themeButtons.appendChild(button);
    });
  }

  function renderSizeButtons() {
    const allowed = sizesFor(currentTheme());
    el.sizeButtons.innerHTML = "";
    allowed.forEach((size) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option-btn" + (size.id === state.sizeId ? " is-active" : "");
      button.textContent = size.label + " (" + size.pairs + " pairs)";
      button.setAttribute("aria-pressed", String(size.id === state.sizeId));
      button.addEventListener("click", () => {
        state.sizeId = size.id;
        writeStored(SIZE_KEY, size.id);
        renderSizeButtons();
        newGame();
      });
      el.sizeButtons.appendChild(button);
    });
  }

  /* ---------- Boot ---------- */
  if (!themes.length) {
    setStatus("No card themes are available — check js/themes.js.");
    return;
  }

  loadBest();

  const savedTheme = readStored(THEME_KEY, null);
  if (savedTheme && themes.some((t) => t.id === savedTheme)) state.themeId = savedTheme;

  const savedSize = readStored(SIZE_KEY, null);
  const allowedSizes = sizesFor(currentTheme());
  state.sizeId = allowedSizes.some((s) => s.id === savedSize) ? savedSize : allowedSizes[0].id;

  el.restart.addEventListener("click", () => {
    newGame();
    setStatus("New cards dealt — good luck!");
  });
  el.sound.addEventListener("click", () => {
    soundOn = !soundOn;
    el.sound.textContent = soundOn ? "🔊 Sound On" : "🔇 Sound Off";
    el.sound.setAttribute("aria-pressed", String(soundOn));
  });

  renderThemeButtons();
  renderSizeButtons();
  newGame();

  // Exposed purely so the offline tests can inspect a dealt deck.
  window.MemoryGame = { state, buildDeck, sizesFor, isUsableTheme, SIZES };
})();
