/**
 * Periodic Table — look at it, then test yourself on it.
 *
 * Four modes share one table. Explore just shows it. The three quiz modes ask
 * a question and grade the answer:
 *
 *   easy    three choices, either way round (symbol -> name or name -> symbol)
 *   medium  type the answer, same two directions
 *   hard    type it AND tap the square it belongs in
 *
 * The quiz never invents a question it cannot mark. Wrong choices in Easy are
 * drawn from real elements, preferring ones near the answer in the table,
 * because "Neon or Argon" is a better question than "Neon or Uranium".
 */
(function () {
  "use strict";

  const tableEl = document.getElementById("pt-table");
  if (!tableEl) return;

  const ELEMENTS = Array.isArray(window.Elements) ? window.Elements : [];
  const CATEGORIES = Array.isArray(window.ElementCategories) ? window.ElementCategories : [];
  const COLOURS = {};
  CATEGORIES.forEach((c) => { COLOURS[c.id] = c.colour; });

  const MODE_KEY = "pt-mode";
  const SCOPE_KEY = "pt-scope";
  const ROUND = 10;                 // questions per round

  /** Which elements a round draws from, so a beginner is not asked about Seaborgium. */
  const SCOPES = {
    common: { label: "⭐ Common 20", test: (e) => e.z <= 20 },
    first: { label: "🔢 First 36", test: (e) => e.z <= 36 },
    all: { label: "🌍 All 118", test: () => true },
  };

  const state = {
    mode: "explore",       // explore | easy | medium | hard
    scopeId: "common",
    selected: null,        // element shown in the detail panel
    question: null,        // { element, direction, choices, needsPlacement }
    answeredName: false,
    answeredPlace: false,
    asked: 0,
    right: 0,
    streak: 0,
    bestStreak: 0,
    wrongOnThis: false,
    finished: false,
  };

  let soundOn = true;
  let audioCtx = null;

  const el = {
    table: tableEl,
    legend: document.getElementById("pt-legend"),
    detail: document.getElementById("pt-detail"),
    quiz: document.getElementById("pt-quiz"),
    prompt: document.getElementById("pt-prompt"),
    choices: document.getElementById("pt-choices"),
    entry: document.getElementById("pt-entry"),
    input: document.getElementById("pt-input"),
    submit: document.getElementById("pt-submit"),
    status: document.getElementById("pt-status"),
    asked: document.getElementById("pt-asked"),
    right: document.getElementById("pt-right"),
    streak: document.getElementById("pt-streak"),
    best: document.getElementById("pt-best"),
    skip: document.getElementById("btn-skip"),
    restart: document.getElementById("btn-restart"),
    sound: document.getElementById("btn-sound"),
    scopeGroup: document.getElementById("scope-group"),
  };

  function scope() { return SCOPES[state.scopeId] || SCOPES.common; }
  function pool() { return ELEMENTS.filter(scope().test); }
  function quizzing() { return state.mode !== "explore"; }

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

  /* ---------- Questions ---------- */
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  /**
   * Two wrong answers, preferring elements near the right one - either close in
   * atomic number or in the same group. Confusing neighbours is the useful kind
   * of hard; telling Helium from Plutonium teaches nothing.
   */
  function distractors(answer, count) {
    const others = pool().filter((e) => e.z !== answer.z);
    if (others.length <= count) return others;
    const near = others.filter((e) => Math.abs(e.z - answer.z) <= 6 || e.group === answer.group);
    const chosen = [];
    const take = (list) => {
      const shuffled = list.slice().sort(() => Math.random() - 0.5);
      for (const item of shuffled) {
        if (chosen.length >= count) break;
        if (!chosen.some((c) => c.z === item.z)) chosen.push(item);
      }
    };
    take(near);
    take(others);
    return chosen.slice(0, count);
  }

  function newQuestion() {
    const answer = pick(pool());
    // Easy and medium alternate direction; hard always asks for both.
    const direction = Math.random() < 0.5 ? "symbolToName" : "nameToSymbol";
    const question = {
      element: answer,
      direction: state.mode === "hard" ? "nameToSymbol" : direction,
      needsPlacement: state.mode === "hard",
      choices: null,
    };

    if (state.mode === "easy") {
      const wrong = distractors(answer, 2);
      question.choices = [answer].concat(wrong).sort(() => Math.random() - 0.5);
    }

    state.question = question;
    state.answeredName = false;
    state.answeredPlace = !question.needsPlacement;
    state.wrongOnThis = false;
    state.selected = null;
    render();
    setStatus(promptFor(question));
  }

  function promptFor(question) {
    const e = question.element;
    if (state.mode === "hard") {
      return "Type the symbol for " + e.name + ", then tap where it goes on the table.";
    }
    return question.direction === "symbolToName"
      ? "Which element has the symbol " + e.symbol + "?"
      : "What is the symbol for " + e.name + "?";
  }

  /** What counts as right for the typed part. Case and spacing are forgiven. */
  function checkTyped(text) {
    const q = state.question;
    if (!q) return false;
    const tidy = String(text || "").trim().toLowerCase();
    if (!tidy) return false;
    return q.direction === "symbolToName"
      ? tidy === q.element.name.toLowerCase()
      : tidy === q.element.symbol.toLowerCase();
  }

  function answerChoice(element) {
    if (!state.question || state.answeredName) return;
    const correct = element.z === state.question.element.z;
    if (!correct) state.wrongOnThis = true;
    state.answeredName = true;
    beep(correct ? 780 : 200, correct ? 0.12 : 0.2, correct ? "triangle" : "square");
    afterAnswer();
  }

  function answerTyped() {
    if (!state.question || state.answeredName) return;
    const correct = checkTyped(el.input.value);
    if (!correct) state.wrongOnThis = true;
    state.answeredName = true;
    beep(correct ? 780 : 200, correct ? 0.12 : 0.2, correct ? "triangle" : "square");
    afterAnswer();
  }

  function answerPlacement(col, row) {
    if (!state.question || !state.question.needsPlacement || state.answeredPlace) return;
    const e = state.question.element;
    const correct = col === e.col && row === e.row;
    if (!correct) state.wrongOnThis = true;
    state.answeredPlace = true;
    beep(correct ? 780 : 200, correct ? 0.12 : 0.2, correct ? "triangle" : "square");
    afterAnswer();
  }

  function afterAnswer() {
    if (!state.answeredName || !state.answeredPlace) {
      render();
      setStatus(state.answeredName
        ? "Now tap the square where " + state.question.element.symbol + " belongs."
        : "Now type the symbol.");
      return;
    }

    state.asked += 1;
    if (!state.wrongOnThis) {
      state.right += 1;
      state.streak += 1;
      if (state.streak > state.bestStreak) state.bestStreak = state.streak;
    } else {
      state.streak = 0;
    }

    const e = state.question.element;
    setStatus(state.wrongOnThis
      ? "Not quite — " + e.symbol + " is " + e.name + ", " + placeWords(e) + "."
      : "✅ Correct! " + e.symbol + " is " + e.name + ".");
    state.selected = e;

    if (state.asked >= ROUND) {
      state.finished = true;
      if (board) board.offer(state.right, state.mode + "-" + state.scopeId);
      fanfare();
      setStatus("Round over — " + state.right + " out of " + ROUND + " right. " +
        (state.right === ROUND ? "Perfect!" : "Press New Round to go again."));
    }
    render();
  }

  function placeWords(e) {
    if (e.group === 0) return "one of the " + (e.category === "lanthanide" ? "lanthanides" : "actinides") +
      " in the rows underneath";
    return "group " + e.group + ", period " + e.period;
  }

  function skip() {
    if (!quizzing() || !state.question || state.finished) return;
    state.wrongOnThis = true;
    state.answeredName = true;
    state.answeredPlace = true;
    afterAnswer();
  }

  function newRound() {
    state.asked = 0;
    state.right = 0;
    state.streak = 0;
    state.finished = false;
    state.selected = null;
    if (quizzing()) newQuestion();
    else {
      state.question = null;
      render();
      setStatus("Tap any element to find out about it.");
    }
  }

  /* ---------- Rendering ---------- */
  function tileLabel(e) {
    // In a quiz the answer must not be sitting there in plain sight.
    if (!quizzing() || state.finished) return { top: String(e.z), main: e.symbol, sub: e.name };
    const q = state.question;
    const isAnswer = q && q.element.z === e.z;
    if (state.mode === "hard" && !state.answeredPlace) return { top: "", main: "", sub: "" };
    if (isAnswer && !state.answeredName) return { top: String(e.z), main: "?", sub: "" };
    return { top: String(e.z), main: e.symbol, sub: "" };
  }

  function render() {
    el.table.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "pt-grid";

    ELEMENTS.forEach((e) => {
      const tile = document.createElement("button");
      tile.type = "button";
      const inScope = scope().test(e);
      const isAnswer = state.question && state.question.element.z === e.z;
      tile.className = "pt-el pt-el--" + e.category +
        (state.selected && state.selected.z === e.z ? " is-selected" : "") +
        (quizzing() && !inScope ? " is-out" : "") +
        (state.mode === "hard" && !state.answeredPlace ? " is-hidden" : "") +
        (state.finished && isAnswer ? " is-answer" : "");
      tile.style.gridColumn = String(e.col);
      tile.style.gridRow = String(e.row);
      tile.style.background = COLOURS[e.category] || "#ddd";

      const label = tileLabel(e);
      const z = document.createElement("span");
      z.className = "pt-z";
      z.textContent = label.top;
      const sym = document.createElement("span");
      sym.className = "pt-sym";
      sym.textContent = label.main;
      const nm = document.createElement("span");
      nm.className = "pt-name";
      nm.textContent = label.sub;

      tile.appendChild(z);
      tile.appendChild(sym);
      tile.appendChild(nm);
      tile.setAttribute("aria-label", quizzing() && state.mode === "hard" && !state.answeredPlace
        ? "Empty square, group " + e.col + " row " + e.row
        : e.name + ", symbol " + e.symbol + ", number " + e.z);

      tile.addEventListener("click", () => {
        if (state.mode === "hard" && state.answeredName && !state.answeredPlace) {
          answerPlacement(e.col, e.row);
          return;
        }
        if (quizzing() && !state.finished) return;   // no peeking mid-question
        state.selected = e;
        render();
      });

      grid.appendChild(tile);
    });

    // The two markers that stand in for the f-block inside the main table.
    [[3, 6, "57–71"], [3, 7, "89–103"]].forEach(([col, row, text]) => {
      const marker = document.createElement("div");
      marker.className = "pt-el pt-el--marker";
      marker.style.gridColumn = String(col);
      marker.style.gridRow = String(row);
      marker.textContent = text;
      marker.setAttribute("aria-hidden", "true");
      grid.appendChild(marker);
    });

    el.table.appendChild(grid);
    renderLegend();
    renderDetail();
    renderQuiz();
    renderStats();
  }

  function renderLegend() {
    if (el.legend.children.length) return;
    CATEGORIES.forEach((c) => {
      const item = document.createElement("li");
      item.className = "pt-key";
      const swatch = document.createElement("span");
      swatch.className = "pt-swatch";
      swatch.style.background = c.colour;
      const text = document.createElement("span");
      text.textContent = c.label;
      item.appendChild(swatch);
      item.appendChild(text);
      el.legend.appendChild(item);
    });
  }

  function renderDetail() {
    el.detail.innerHTML = "";
    const e = state.selected;
    if (!e) {
      const hint = document.createElement("p");
      hint.className = "pt-detail-hint";
      hint.textContent = quizzing()
        ? "Answer the question above."
        : "Tap any element to find out about it.";
      el.detail.appendChild(hint);
      return;
    }

    const badge = document.createElement("div");
    badge.className = "pt-badge pt-el--" + e.category;
    badge.style.background = COLOURS[e.category];
    badge.innerHTML = "";
    const bz = document.createElement("span"); bz.className = "pt-z"; bz.textContent = String(e.z);
    const bs = document.createElement("span"); bs.className = "pt-badge-sym"; bs.textContent = e.symbol;
    badge.appendChild(bz); badge.appendChild(bs);

    const body = document.createElement("div");
    const h = document.createElement("h3");
    h.textContent = e.name;
    const where = document.createElement("p");
    where.className = "pt-where";
    where.textContent = "Number " + e.z + " · " + categoryLabel(e.category) + " · " + placeWords(e);
    body.appendChild(h);
    body.appendChild(where);
    if (e.note) {
      const note = document.createElement("p");
      note.className = "pt-note";
      note.textContent = e.note;
      body.appendChild(note);
    }

    el.detail.appendChild(badge);
    el.detail.appendChild(body);
  }

  function categoryLabel(id) {
    const found = CATEGORIES.find((c) => c.id === id);
    return found ? found.label : id;
  }

  function renderQuiz() {
    el.quiz.hidden = !quizzing();
    if (!quizzing() || !state.question) { el.choices.innerHTML = ""; return; }

    el.prompt.textContent = state.finished ? "Round finished." : promptFor(state.question);

    el.choices.innerHTML = "";
    const showChoices = state.mode === "easy" && !state.answeredName && !state.finished;
    el.choices.hidden = !showChoices;
    if (showChoices) {
      state.question.choices.forEach((option) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "pt-choice";
        button.textContent = state.question.direction === "symbolToName" ? option.name : option.symbol;
        button.addEventListener("click", () => answerChoice(option));
        el.choices.appendChild(button);
      });
    }

    const showEntry = (state.mode === "medium" || state.mode === "hard") &&
      !state.answeredName && !state.finished;
    el.entry.hidden = !showEntry;
    if (showEntry) {
      el.input.placeholder = state.question.direction === "symbolToName" ? "element name" : "symbol";
      el.input.value = "";
      window.setTimeout(() => { try { el.input.focus(); } catch (err) { /* ok */ } }, 30);
    }

    el.skip.hidden = state.finished || !state.question;
  }

  function renderStats() {
    el.asked.textContent = quizzing() ? state.asked + "/" + ROUND : "—";
    el.right.textContent = quizzing() ? String(state.right) : "—";
    el.streak.textContent = quizzing() ? String(state.streak) : "—";
    const stored = board ? board.entries(state.mode + "-" + state.scopeId) : [];
    el.best.textContent = stored.length ? String(stored[0].value) : "—";
    el.scopeGroup.hidden = !quizzing();
  }

  function setStatus(text) { el.status.textContent = text; }

  /* ---------- Leaderboard ---------- */
  const board = window.Leaderboard ? window.Leaderboard.create({
    gameId: "periodic-table",
    gameName: "Periodic Table",
    metric: { label: "Score", better: "higher", format: "number" },
    categories: ["easy", "medium", "hard"].reduce((out, mode) => {
      Object.keys(SCOPES).forEach((s) => out.push({ id: mode + "-" + s, label: mode + " · " + SCOPES[s].label }));
      return out;
    }, []),
  }) : null;
  if (board) board.mount(document.getElementById("leaderboard-panel"));

  /* ---------- Wiring ---------- */
  el.submit.addEventListener("click", answerTyped);
  el.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); answerTyped(); }
  });
  el.skip.addEventListener("click", skip);
  el.restart.addEventListener("click", newRound);
  el.sound.addEventListener("click", () => {
    soundOn = !soundOn;
    el.sound.textContent = soundOn ? "🔊 Sound On" : "🔇 Sound Off";
    el.sound.setAttribute("aria-pressed", String(soundOn));
  });

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      try { window.localStorage.setItem(MODE_KEY, state.mode); } catch (err) { /* ok */ }
      document.querySelectorAll("[data-mode]").forEach((other) => {
        const active = other === button;
        other.classList.toggle("is-active", active);
        other.setAttribute("aria-pressed", String(active));
      });
      if (board) board.setCategory(state.mode + "-" + state.scopeId);
      newRound();
    });
  });

  document.querySelectorAll("[data-scope]").forEach((button) => {
    button.addEventListener("click", () => {
      state.scopeId = button.dataset.scope;
      try { window.localStorage.setItem(SCOPE_KEY, state.scopeId); } catch (err) { /* ok */ }
      document.querySelectorAll("[data-scope]").forEach((other) => {
        const active = other === button;
        other.classList.toggle("is-active", active);
        other.setAttribute("aria-pressed", String(active));
      });
      if (board) board.setCategory(state.mode + "-" + state.scopeId);
      newRound();
    });
  });

  try {
    const savedMode = window.localStorage.getItem(MODE_KEY);
    if (savedMode && ["explore", "easy", "medium", "hard"].indexOf(savedMode) !== -1) state.mode = savedMode;
    const savedScope = window.localStorage.getItem(SCOPE_KEY);
    if (savedScope && SCOPES[savedScope]) state.scopeId = savedScope;
  } catch (err) { /* defaults fine */ }

  document.querySelectorAll("[data-mode]").forEach((b) => {
    const active = b.dataset.mode === state.mode;
    b.classList.toggle("is-active", active);
    b.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll("[data-scope]").forEach((b) => {
    const active = b.dataset.scope === state.scopeId;
    b.classList.toggle("is-active", active);
    b.setAttribute("aria-pressed", String(active));
  });

  if (board) board.setCategory(state.mode + "-" + state.scopeId);
  newRound();

  window.PeriodicTable = {
    state, ELEMENTS, SCOPES, ROUND, scope, pool, distractors, newQuestion, checkTyped,
    answerChoice, answerTyped, answerPlacement, skip, newRound, promptFor, tileLabel,
  };
})();
