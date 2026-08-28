/**
 * The times tables page.
 *
 * facts.js decides what to ask and keeps track of what is known; this puts it
 * on screen. The grid is the reason the whole thing works: a child can see the
 * squares filling in, and can see which ones are still pale.
 */
(function () {
  "use strict";

  const askEl = document.getElementById("question");
  if (!askEl) return;
  const F = window.TimesFacts;

  const STORE_KEY = "maths-times-tables";
  const ROUND = 20;
  const KINDS = {
    times: { label: "× Times", kinds: ["times"] },
    divide: { label: "÷ Dividing", kinds: ["divide"] },
    missing: { label: "? Missing number", kinds: ["missing"] },
    mixed: { label: "🎲 All mixed up", kinds: ["times", "times", "divide", "missing"] },
  };

  const el = {
    ask: askEl,
    entry: document.getElementById("entry"),
    keypad: document.getElementById("keypad"),
    status: document.getElementById("status"),
    grid: document.getElementById("grid"),
    tables: document.getElementById("tables"),
    modes: document.getElementById("modes"),
    count: document.getElementById("count"),
    streak: document.getElementById("streak"),
    clock: document.getElementById("clock"),
    solid: document.getElementById("solid"),
    tricky: document.getElementById("tricky"),
    start: document.getElementById("btn-start"),
    panel: document.getElementById("round-panel"),
  };

  const state = {
    store: load(),
    tables: F.allTables(),
    mode: "times",
    question: null,
    lastKey: null,
    typed: "",
    asked: 0,
    right: 0,
    streak: 0,
    best: 0,
    started: 0,
    running: false,
    marking: false,
  };

  function load() {
    try {
      const raw = JSON.parse(window.localStorage.getItem(STORE_KEY));
      if (raw && raw.facts) return raw;
    } catch (err) { /* start fresh */ }
    return F.blank();
  }

  function save() {
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(state.store)); }
    catch (err) { /* practice still works without it */ }
  }

  function say(text) { el.status.textContent = text; }

  /* ---------------- Asking ---------------- */

  function nextQuestion() {
    const pair = F.pick(state.store, state.tables, state.lastKey);
    state.lastKey = F.key(pair[0], pair[1]);
    const kinds = KINDS[state.mode].kinds;
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    state.question = F.ask(pair[0], pair[1], kind, Math.random() < 0.5);
    state.typed = "";
    drawQuestion();
  }

  function drawQuestion() {
    el.ask.textContent = state.question ? state.question.text : "—";
    el.ask.setAttribute("aria-label", state.question ? state.question.spoken : "");
    el.entry.textContent = state.typed || "?";
    el.entry.className = "entry" + (state.typed ? " has-answer" : "");
  }

  function type(digit) {
    if (!state.running || state.marking) return;
    if (state.typed.length >= 3) return;
    state.typed += digit;
    drawQuestion();
  }

  function rub() {
    if (!state.running || state.marking) return;
    state.typed = state.typed.slice(0, -1);
    drawQuestion();
  }

  function submit() {
    if (!state.running || state.marking || !state.typed) return;
    const given = Number(state.typed);
    const q = state.question;
    const right = given === q.answer;
    state.marking = true;

    F.record(state.store, q.a, q.b, right);
    save();
    state.asked += 1;
    if (right) {
      state.right += 1;
      state.streak += 1;
      state.best = Math.max(state.best, state.streak);
      el.entry.classList.add("is-right");
      say(cheer() + "  " + q.text + " = " + q.answer);
    } else {
      state.streak = 0;
      el.entry.classList.add("is-wrong");
      // The right answer is shown rather than hidden. Being told is how you
      // learn it; being asked again in a minute is how you keep it.
      say("Not quite — " + q.text + " = " + q.answer + ". You will see it again shortly.");
    }
    drawStats();
    drawGrid();

    window.setTimeout(function () {
      el.entry.classList.remove("is-right", "is-wrong");
      state.marking = false;
      if (state.asked >= ROUND) finishRound();
      else nextQuestion();
    }, right ? 550 : 1900);
  }

  function cheer() {
    const words = ["Yes!", "Got it.", "That's it.", "Right.", "Spot on.", "Good."];
    if (state.streak >= 10) return "🔥 Ten in a row!";
    if (state.streak >= 5) return "⭐ Five in a row!";
    return words[Math.floor(Math.random() * words.length)];
  }

  /* ---------------- Rounds ---------------- */

  function startRound() {
    state.asked = 0;
    state.right = 0;
    state.streak = 0;
    state.best = 0;
    state.started = Date.now();
    state.running = true;
    state.marking = false;
    el.start.textContent = "Give up";
    nextQuestion();
    drawStats();
    say("Twenty questions. Type your answer and press the tick.");
  }

  function finishRound() {
    state.running = false;
    const took = Date.now() - state.started;
    el.start.textContent = "Go again";
    el.ask.textContent = state.right + " / " + ROUND;
    el.entry.textContent = "🎉";
    const perfect = state.right === ROUND;
    const seconds = Math.round(took / 1000);
    say((perfect ? "Every one right, in " + seconds + " seconds! "
                 : state.right + " out of " + ROUND + " right. ") +
      (state.best >= 5 ? "Best run: " + state.best + " in a row. " : "") +
      "The pale squares in the grid are the ones to work on.");
    drawTricky();
    // Only a clean sweep goes on the board, so the fastest time means something.
    if (board && perfect) board.offer(took, state.mode);
  }

  function stopRound() {
    state.running = false;
    el.start.textContent = "Start";
    el.ask.textContent = "—";
    el.entry.textContent = "?";
    say("Stopped. Press Start when you want another go.");
  }

  /* ---------------- Drawing ---------------- */

  function drawStats() {
    el.count.textContent = state.running ? state.asked + " / " + ROUND : "—";
    el.streak.textContent = state.streak;
    const done = F.progress(state.store, F.allTables());
    el.solid.textContent = done.strong + " / " + done.total;
  }

  function tick() {
    if (!el.clock) return;
    if (!state.running) return;
    const total = Math.floor((Date.now() - state.started) / 1000);
    el.clock.textContent = Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
  }
  window.setInterval(tick, 500);

  /**
   * The whole grid, coloured by how well each fact is known. Both 3 × 7 and
   * 7 × 3 light up together, which is a child's first sight of the fact that
   * multiplication does not care which way round you say it.
   */
  function drawGrid() {
    el.grid.innerHTML = "";
    const corner = document.createElement("div");
    corner.className = "gcell gcell--head";
    corner.textContent = "×";
    el.grid.appendChild(corner);
    for (let b = 1; b <= F.MAX; b++) {
      const head = document.createElement("div");
      head.className = "gcell gcell--head";
      head.textContent = b;
      el.grid.appendChild(head);
    }
    for (let a = 1; a <= F.MAX; a++) {
      const head = document.createElement("div");
      head.className = "gcell gcell--head";
      head.textContent = a;
      el.grid.appendChild(head);
      for (let b = 1; b <= F.MAX; b++) {
        const cell = document.createElement("div");
        const strength = F.strengthOf(state.store, a, b);
        cell.className = "gcell strength-" + strength +
          (state.tables.indexOf(a) === -1 ? " is-off" : "");
        cell.textContent = a * b;
        cell.setAttribute("aria-label", a + " times " + b + " is " + (a * b) + ", " +
          ["not tried yet", "just started", "shaky", "getting there", "nearly there", "solid"][strength]);
        el.grid.appendChild(cell);
      }
    }
  }

  function drawTricky() {
    if (!el.tricky) return;
    const hard = F.trickiest(state.store, 6);
    el.tricky.innerHTML = "";
    if (!hard.length) {
      el.tricky.textContent = "Nothing tricky yet — get some wrong and they will show up here.";
      return;
    }
    hard.forEach(function (row) {
      const chip = document.createElement("span");
      chip.className = "tricky-chip";
      chip.textContent = row.a + " × " + row.b + " = " + (row.a * row.b);
      el.tricky.appendChild(chip);
    });
  }

  function drawChoosers() {
    el.tables.innerHTML = "";
    const all = document.createElement("button");
    all.type = "button";
    all.className = "chip" + (state.tables.length === F.MAX ? " is-on" : "");
    all.textContent = "All";
    all.addEventListener("click", function () {
      state.tables = F.allTables();
      drawChoosers();
      drawGrid();
      say("Practising every table.");
    });
    el.tables.appendChild(all);

    for (let a = 1; a <= F.MAX; a++) {
      const chosen = state.tables.length < F.MAX && state.tables.indexOf(a) !== -1;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip" + (chosen ? " is-on" : "");
      button.textContent = a + "s";
      button.setAttribute("aria-pressed", String(chosen));
      button.addEventListener("click", function () {
        if (state.tables.length === F.MAX) state.tables = [a];
        else if (state.tables.indexOf(a) === -1) state.tables = state.tables.concat([a]);
        else state.tables = state.tables.filter(function (n) { return n !== a; });
        if (!state.tables.length) state.tables = F.allTables();
        drawChoosers();
        drawGrid();
        say(state.tables.length === F.MAX ? "Practising every table."
          : "Practising the " + state.tables.join("s, the ") + "s.");
      });
      el.tables.appendChild(button);
    }

    el.modes.innerHTML = "";
    Object.keys(KINDS).forEach(function (id) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip" + (state.mode === id ? " is-on" : "");
      button.textContent = KINDS[id].label;
      button.setAttribute("aria-pressed", String(state.mode === id));
      button.addEventListener("click", function () {
        state.mode = id;
        drawChoosers();
        if (board) board.setCategory(id);
        say(KINDS[id].label.replace(/^\S+\s/, "") + " it is.");
      });
      el.modes.appendChild(button);
    });
  }

  function buildKeypad() {
    el.keypad.innerHTML = "";
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"].forEach(function (label) {
      const key = document.createElement("button");
      key.type = "button";
      key.className = "key" + (label === "✓" ? " key--go" : label === "⌫" ? " key--rub" : "");
      key.textContent = label;
      key.setAttribute("aria-label", label === "⌫" ? "Rub out" : label === "✓" ? "Check it" : label);
      key.addEventListener("click", function () {
        if (label === "⌫") rub();
        else if (label === "✓") submit();
        else type(label);
      });
      el.keypad.appendChild(key);
    });
  }

  /* ---------------- Leaderboard ---------------- */

  const board = window.Leaderboard ? window.Leaderboard.create({
    gameId: "times-tables",
    gameName: "Times Tables",
    metric: { label: "Time", better: "lower", format: "time" },
    categories: Object.keys(KINDS).map(function (id) { return { id: id, label: KINDS[id].label }; }),
  }) : null;
  if (board) board.mount(document.getElementById("leaderboard-panel"));

  /* ---------------- Wiring ---------------- */

  el.start.addEventListener("click", function () {
    if (state.running) stopRound(); else startRound();
  });

  window.addEventListener("keydown", function (event) {
    if (event.target && event.target.tagName === "INPUT") return;
    if (/^[0-9]$/.test(event.key)) { type(event.key); event.preventDefault(); return; }
    if (event.key === "Backspace") { rub(); event.preventDefault(); return; }
    if (event.key === "Enter") { if (state.running) submit(); else startRound(); event.preventDefault(); }
  });

  drawChoosers();
  buildKeypad();
  drawGrid();
  drawStats();
  drawTricky();

  window.TimesApp = {
    state: state, F: F, startRound: startRound, submit: submit, type: type, rub: rub,
    nextQuestion: nextQuestion, finishRound: finishRound, ROUND: ROUND, scores: board,
  };
})();
