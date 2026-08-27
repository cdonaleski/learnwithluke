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
  const LEVEL_KEY = "hangman-level";

  /**
   * Difficulty changes the word pool and the guesses allowed, rather than
   * anything hidden. Easy also reveals a letter to start, which is a big help
   * to a younger reader without making the round trivial.
   */
  const LEVELS = {
    easy: { label: "🐣 Easy", maxLength: 6, wrong: 8, freeLetter: true },
    medium: { label: "🐤 Medium", maxLength: 8, wrong: 6, freeLetter: false },
    hard: { label: "🦅 Hard", maxLength: 99, wrong: 5, freeLetter: false },
  };

  /** Each wrong guess adds one piece of the rocket. */
  const PARTS = [
    "🌍", "🛠️", "🔥", "☁️", "💨", "🚀",
  ];

  const categories = (Array.isArray(window.HangmanWords) ? window.HangmanWords : []).filter(isUsable);

  const state = {
    levelId: "medium",
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
    levelButtons: document.getElementById("level-buttons"),
  };

  function level() { return LEVELS[state.levelId] || LEVELS.medium; }

  /** Wrong guesses allowed at this difficulty. */
  function allowedWrong() { return level().wrong; }

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
    // Keep to words this difficulty allows, but never end up with nothing.
    const byLength = words.filter((w) => w.word.length <= level().maxLength);
    const sized = byLength.length ? byLength : words;
    // Avoid the last few so the same word doesn't come round twice in a row.
    const fresh = sized.filter((w) => state.recent.indexOf(w.word) === -1);
    const pool = fresh.length ? fresh : sized;
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

    if (level().freeLetter) {
      // Give away a letter that appears only once, so it helps without
      // handing over half the word.
      const letters = state.word.split("");
      const singles = letters.filter((ch, i) => letters.indexOf(ch) === letters.lastIndexOf(ch) && i >= 0);
      const pool = singles.length ? singles : letters;
      state.guessed.add(pool[Math.floor(Math.random() * pool.length)]);
    }

    render();
    setStatus(level().freeLetter
      ? "Here's one letter to start you off. Guess another!"
      : "Guess a letter to begin!");
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
        winStreak += 1;
        fanfare();
        setStatus("🎉 You got it — " + state.word + "!");
      } else {
        setStatus(count === 1 ? "Yes, one " + letter + "!" : "Yes, " + count + " of them!");
      }
    } else {
      state.wrong += 1;
      beep(220, 0.12, "square");
      if (state.wrong >= allowedWrong()) {
        state.phase = "lost";
        state.losses += 1;
        endStreak();
        setStatus("🚀 Out of guesses! The word was " + state.word + ".");
      } else {
        const left = allowedWrong() - state.wrong;
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
    for (let i = 0; i < allowedWrong(); i++) {
      const part = document.createElement("span");
      part.className = "hm-part" + (i < state.wrong ? " is-on" : "");
      part.textContent = PARTS[i % PARTS.length];
      part.setAttribute("aria-hidden", "true");
      el.rocket.appendChild(part);
    }

    el.lives.textContent = String(Math.max(0, allowedWrong() - state.wrong));
    el.wins.textContent = String(state.wins);
    el.losses.textContent = String(state.losses);

    el.hint.hidden = !(state.hintShown && state.hint);
    el.hint.textContent = state.hint ? "💡 " + state.hint : "";
    el.hintBtn.disabled = state.phase !== "playing" || state.hintShown || !state.hint;
  }

  function setStatus(text) { el.status.textContent = text; }

  function renderLevels() {
    if (!el.levelButtons) return;
    el.levelButtons.innerHTML = "";
    Object.keys(LEVELS).forEach((id) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option-btn" + (id === state.levelId ? " is-active" : "");
      button.textContent = LEVELS[id].label;
      button.setAttribute("aria-pressed", String(id === state.levelId));
      button.addEventListener("click", () => {
        endStreak();
        state.levelId = id;
        state.recent = [];
        try { window.localStorage.setItem(LEVEL_KEY, id); } catch (err) { /* ok */ }
        renderLevels();
        newGame();
        setStatus(LEVELS[id].label + " — " + LEVELS[id].wrong + " wrong guesses allowed.");
      });
      el.levelButtons.appendChild(button);
    });
  }

  function renderCategories() {
    el.categoryButtons.innerHTML = "";
    categories.forEach((cat) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option-btn" + (cat.id === state.categoryId ? " is-active" : "");
      button.textContent = cat.icon + " " + cat.name;
      button.setAttribute("aria-pressed", String(cat.id === state.categoryId));
      button.addEventListener("click", () => {
        endStreak();
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


  /* ---------- Leaderboard ---------- */
  const board = window.Leaderboard ? window.Leaderboard.create({
    gameId: "hangman",
    gameName: "Word Guess",
    metric: { label: "Win streak", better: "higher", format: "number" },
    categories: [],
  }) : null;
  if (board) board.mount(document.getElementById("leaderboard-panel"));
  /** Longest run of wins in a row. Offered when the run ends. */
  let winStreak = 0;
  function endStreak() {
    if (board && winStreak > 0) board.offer(winStreak);
    winStreak = 0;
  }

  try {
    const savedLevel = window.localStorage.getItem(LEVEL_KEY);
    if (savedLevel && LEVELS[savedLevel]) state.levelId = savedLevel;
  } catch (err) { /* defaults fine */ }

  renderLevels();
  renderCategories();
  newGame();

  window.HangmanGame = { state, guess, newGame, revealed, categories, MAX_WRONG, ALPHABET,
    isUsable, showHint, LEVELS, level, allowedWrong, pickWord };
})();
