/**
 * Hangman — guess the word one letter at a time.
 *
 * Drawn as a rocket being built rather than a person being hanged: same game,
 * same six wrong guesses, friendlier for a children's site.
 */
(function () {
  "use strict";

  const wordEl = document.getElementById("hm-word");
  if (!wordEl) return;

  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const MAX_WRONG = 6;
  const CATEGORY_KEY = "hangman-category";

  /** Each wrong guess adds one piece of the rocket. */
  const PARTS = [
    "🌍", "🛠️", "🔥", "☁️", "💨", "🚀",
  ];

  const categories = (Array.isArray(window.HangmanWords) ? window.HangmanWords : []).filter(isUsable);

  const state = {
    categoryId: categories.length ? categories[0].id : null,
    word: "",
    hint: "",
    guessed: new Set(),
    wrong: 0,
    phase: "playing",   // playing | won | lost
    wins: 0,
    losses: 0,
    hintShown: false,
    recent: [],         // words used lately, so they don't repeat straight away
  };

  let soundOn = true;
  let audioCtx = null;

  const el = {
    word: wordEl,
    keyboard: document.getElementById("hm-keyboard"),
    status: document.getElementById("hm-status"),
    rocket: document.getElementById("hm-rocket"),
    lives: document.getElementById("hm-lives"),
    wins: document.getElementById("hm-wins"),
    losses: document.getElementById("hm-losses"),
    hint: document.getElementById("hm-hint"),
    hintBtn: document.getElementById("btn-hint"),
    restart: document.getElementById("btn-restart"),
    sound: document.getElementById("btn-sound"),
    categoryButtons: document.getElementById("category-buttons"),
  };

  /* ---------- Word list validation ---------- */
  function isUsable(category) {
    if (!category || typeof category.id !== "string" || !Array.isArray(category.words)) return false;
    const good = category.words.filter((entry) =>
      entry && typeof entry.word === "string" && /^[a-z]+$/.test(entry.word) && entry.word.length >= 3);
    if (good.length !== category.words.length) {
      window.console.warn('Hangman: category "' + category.id +
        '" has words with spaces, digits or punctuation — those cannot be guessed on an A-Z keyboard.');
    }
    category.words = good;
    return good.length > 0;
  }

  function category() {
    return categories.find((c) => c.id === state.categoryId) || categories[0];
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

  /* ---------- Game ---------- */
  function pickWord() {
    const words = category().words;
    // Avoid the last few so the same word doesn't come round twice in a row.
    const fresh = words.filter((w) => state.recent.indexOf(w.word) === -1);
    const pool = fresh.length ? fresh : words;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    state.recent.push(chosen.word);
    if (state.recent.length > Math.min(5, words.length - 1)) state.recent.shift();
    return chosen;
  }

  function newGame() {
    const chosen = pickWord();
    state.word = chosen.word.toUpperCase();
    state.hint = chosen.hint || "";
    state.guessed = new Set();
    state.wrong = 0;
    state.phase = "playing";
    state.hintShown = false;
    render();
    setStatus("Guess a letter to begin!");
  }

  function revealed() {
    return state.word.split("").every((ch) => state.guessed.has(ch));
  }

  function guess(letter) {
    if (state.phase !== "playing") return;
    if (state.guessed.has(letter)) return;
    state.guessed.add(letter);

    if (state.word.indexOf(letter) !== -1) {
      const count = state.word.split("").filter((ch) => ch === letter).length;
      beep(660, 0.08, "triangle");
      if (revealed()) {
        state.phase = "won";
        state.wins += 1;
        fanfare();
        setStatus("🎉 You got it — " + state.word + "!");
      } else {
        setStatus(count === 1 ? "Yes, one " + letter + "!" : "Yes, " + count + " of them!");
      }
    } else {
      state.wrong += 1;
      beep(220, 0.12, "square");
      if (state.wrong >= MAX_WRONG) {
        state.phase = "lost";
        state.losses += 1;
        setStatus("🚀 Out of guesses! The word was " + state.word + ".");
      } else {
        const left = MAX_WRONG - state.wrong;
        setStatus("No " + letter + ". " + left + (left === 1 ? " guess left!" : " guesses left."));
      }
    }
    render();
  }

  function showHint() {
    if (state.phase !== "playing" || !state.hint) return;
    state.hintShown = true;
    render();
  }

  /* ---------- Rendering ---------- */
  function render() {
    // The word, as blanks and revealed letters.
    el.word.innerHTML = "";
    state.word.split("").forEach((ch) => {
      const slot = document.createElement("span");
      const shown = state.guessed.has(ch) || state.phase === "lost";
      slot.className = "hm-letter" + (shown ? " is-shown" : "") +
        (state.phase === "lost" && !state.guessed.has(ch) ? " is-missed" : "");
      slot.textContent = shown ? ch : "";
      slot.setAttribute("aria-hidden", "true");
      el.word.appendChild(slot);
    });
    el.word.setAttribute("aria-label",
      state.phase === "playing"
        ? "Word so far: " + state.word.split("").map((ch) => state.guessed.has(ch) ? ch : "blank").join(" ")
        : "The word was " + state.word);

    // Keyboard
    el.keyboard.innerHTML = "";
    ALPHABET.forEach((letter) => {
      const button = document.createElement("button");
      button.type = "button";
      const used = state.guessed.has(letter);
      const right = used && state.word.indexOf(letter) !== -1;
      button.className = "hm-key" + (used ? (right ? " is-right" : " is-wrong") : "");
      button.textContent = letter;
      button.disabled = used || state.phase !== "playing";
      button.setAttribute("aria-label", letter + (used ? (right ? ", correct" : ", not in the word") : ""));
      button.addEventListener("click", () => guess(letter));
      el.keyboard.appendChild(button);
    });

    // Rocket, one piece per wrong guess
    el.rocket.innerHTML = "";
    for (let i = 0; i < MAX_WRONG; i++) {
      const part = document.createElement("span");
      part.className = "hm-part" + (i < state.wrong ? " is-on" : "");
      part.textContent = PARTS[i];
      part.setAttribute("aria-hidden", "true");
      el.rocket.appendChild(part);
    }

    el.lives.textContent = String(Math.max(0, MAX_WRONG - state.wrong));
    el.wins.textContent = String(state.wins);
    el.losses.textContent = String(state.losses);

    el.hint.hidden = !(state.hintShown && state.hint);
    el.hint.textContent = state.hint ? "💡 " + state.hint : "";
    el.hintBtn.disabled = state.phase !== "playing" || state.hintShown || !state.hint;
  }

  function setStatus(text) { el.status.textContent = text; }

  function renderCategories() {
    el.categoryButtons.innerHTML = "";
    categories.forEach((cat) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option-btn" + (cat.id === state.categoryId ? " is-active" : "");
      button.textContent = cat.icon + " " + cat.name;
      button.setAttribute("aria-pressed", String(cat.id === state.categoryId));
      button.addEventListener("click", () => {
        state.categoryId = cat.id;
        state.recent = [];
        try { window.localStorage.setItem(CATEGORY_KEY, cat.id); } catch (err) { /* ok */ }
        renderCategories();
        newGame();
        setStatus("New category: " + cat.name + "!");
      });
      el.categoryButtons.appendChild(button);
    });
  }

  /* ---------- Wiring ---------- */
  el.restart.addEventListener("click", () => newGame());
  el.hintBtn.addEventListener("click", showHint);
  el.sound.addEventListener("click", () => {
    soundOn = !soundOn;
    el.sound.textContent = soundOn ? "🔊 Sound On" : "🔇 Sound Off";
    el.sound.setAttribute("aria-pressed", String(soundOn));
  });

  window.addEventListener("keydown", (event) => {
    if (event.code === "Enter" && state.phase !== "playing") { event.preventDefault(); newGame(); return; }
    const match = /^Key([A-Z])$/.exec(event.code);
    if (!match) return;
    event.preventDefault();
    guess(match[1]);
  });

  /* ---------- Boot ---------- */
  if (!categories.length) {
    setStatus("No word lists available — check js/words.js.");
    return;
  }

  try {
    const saved = window.localStorage.getItem(CATEGORY_KEY);
    if (saved && categories.some((c) => c.id === saved)) state.categoryId = saved;
  } catch (err) { /* defaults fine */ }

  renderCategories();
  newGame();

  window.HangmanGame = { state, guess, newGame, revealed, categories, MAX_WRONG, ALPHABET, isUsable, showHint };
})();
