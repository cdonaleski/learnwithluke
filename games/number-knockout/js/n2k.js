/**
 * Number Knockout.
 *
 * One roll of the dice, a board of numbers, and however long the level gives
 * you to make as many of those numbers as you can. Every number rolled has to
 * be used exactly once in each sum.
 *
 * expression.js reads what is typed, finder.js works out what the roll could
 * have made, and the dice are the same cubes the Dice Roller uses -- one cube,
 * two pages, so they cannot drift apart.
 */
(function () {
  "use strict";

  const boardEl = document.getElementById("board");
  if (!boardEl) return;
  const E = window.Expression;
  const F = window.Finder;
  const D3 = window.Dice3D;

  /**
   * The standard bout is three dice, a 6 by 6 board and SIXTY seconds from a
   * single roll -- that is what the How to Play guide describes. The two-minute
   * round in the rule book is the national championship, which is a different
   * and longer thing. Both are here.
   *
   * 1 to 36 is only the classic board. The guide ranks competition boards by
   * difficulty, the first rung being thirty-six numbers below a hundred, so
   * there is one of those too.
   */
  const LEVELS = {
    starter: {
      label: "🐣 Starter", dice: 2, highest: 12, seconds: 120, ops: "+-*/",
      blurb: "Two dice, numbers up to 12, and plenty of time.",
    },
    middle: {
      label: "🚶 Getting there", dice: 3, highest: 24, seconds: 90, ops: "+-*/",
      blurb: "Three dice now, and all three have to be used.",
    },
    bout: {
      label: "🥊 A bout", dice: 3, highest: 36, seconds: 60, ops: "+-*/^√",
      blurb: "The standard game: the classic 1 to 36 board, one roll, sixty seconds.",
    },
    championship: {
      label: "🏆 Championship round", dice: 3, highest: 36, seconds: 120, ops: "+-*/^√",
      blurb: "The same board with the two minutes they give you at the national final.",
    },
    advanced: {
      label: "🚀 Up to a hundred", dice: 3, spread: 99, seconds: 120, ops: "+-*/^√",
      blurb: "Thirty-six numbers scattered up to 99, which is where advanced players go.",
    },
    practice: {
      label: "🧘 No hurry", dice: 3, highest: 36, seconds: 0, ops: "+-*/^√",
      blurb: "The classic board with the clock switched off.",
    },
  };

  const el = {
    board: boardEl,
    tray: document.getElementById("tray"),
    typed: document.getElementById("typed"),
    keys: document.getElementById("keys"),
    status: document.getElementById("status"),
    levels: document.getElementById("levels"),
    clock: document.getElementById("clock"),
    score: document.getElementById("score"),
    left: document.getElementById("left"),
    start: document.getElementById("btn-start"),
    enter: document.getElementById("btn-enter"),
    rub: document.getElementById("btn-rub"),
    summary: document.getElementById("summary"),
    summaryScore: document.getElementById("summary-score"),
    missed: document.getElementById("missed"),
  };

  const state = {
    level: "middle",
    dice: [],
    dieEls: [],
    numbers: [],
    gone: {},
    possible: [],
    typed: "",
    score: 0,
    knocked: 0,
    running: false,
    endsAt: 0,
    startedAt: 0,
    ticker: null,
  };

  function level() { return LEVELS[state.level]; }
  function say(text) { el.status.textContent = text; }

  /* ---------------- The board ---------------- */

  /**
   * The numbers on the board. The classic one is simply 1 to 36; a harder one
   * is thirty-six picked out of a much wider range, with the small friendly
   * ones kept in so it is not all high primes -- the guide is explicit that a
   * board overloaded with those is frustrating rather than hard.
   */
  function makeNumbers() {
    const spec = level();
    if (!spec.spread) {
      const run = [];
      for (let n = 1; n <= spec.highest; n++) run.push(n);
      return run;
    }
    const pool = [];
    for (let n = 1; n <= spec.spread; n++) pool.push(n);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const swap = pool[i]; pool[i] = pool[j]; pool[j] = swap;
    }
    // A dozen from the friendly end so there is always a way in.
    const easy = pool.filter(function (n) { return n <= 36; }).slice(0, 12);
    const rest = pool.filter(function (n) { return easy.indexOf(n) === -1; }).slice(0, 24);
    return easy.concat(rest).sort(function (a, b) { return a - b; });
  }

  function buildBoard() {
    el.board.innerHTML = "";
    el.board.style.setProperty("--cols", state.numbers.length > 12 ? 6 : 4);
    state.numbers.forEach(function (n) {
      const cell = document.createElement("div");
      cell.className = "square";
      cell.dataset.number = n;
      cell.textContent = n;
      el.board.appendChild(cell);
    });
    drawBoard();
  }

  function drawBoard() {
    Array.prototype.forEach.call(el.board.children, function (cell) {
      const n = Number(cell.dataset.number);
      cell.className = "square" + (state.gone[n] ? " is-out" : "");
      cell.setAttribute("aria-label", n + (state.gone[n] ? ", knocked out" : ", still up"));
    });
    el.left.textContent = state.numbers.filter(function (n) { return !state.gone[n]; }).length;
  }

  /* ---------------- The dice ---------------- */

  function buildTray() {
    el.tray.innerHTML = "";
    state.dieEls = [];
    for (let i = 0; i < level().dice; i++) {
      const die = D3.makeDie("spin-" + (i % 3));
      el.tray.appendChild(die.root);
      state.dieEls.push(die);
    }
  }

  function stillMotionless() {
    try {
      return Boolean(window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (err) { return false; }
  }

  /**
   * Throws the dice, and throws them again if the roll is no good.
   *
   * Two ones is an automatic re-roll -- that is in the rule book, because a
   * roll like 1, 1, 4 can barely make anything and is not a hard round, just a
   * wasted one. The same goes for a roll that cannot reach a single number
   * still standing on the board.
   */
  function rollDice() {
    const still = stillMotionless();
    for (let tries = 0; tries < 40; tries++) {
      state.dice = [];
      for (let i = 0; i < level().dice; i++) state.dice.push(D3.rollDie(6));
      const ones = state.dice.filter(function (d) { return d === 1; }).length;
      if (ones > 1 && level().dice > 2) continue;
      state.possible = F.onBoard(state.dice, level().ops, state.numbers)
        .filter(function (n) { return !state.gone[n]; });
      if (state.possible.length) break;
    }
    state.dieEls.forEach(function (die, i) { D3.spinTo(die, state.dice[i], still); });
    window.setTimeout(function () {
      state.dieEls.forEach(function (die) { D3.settle(die); });
    }, still ? 0 : 900);
    drawKeys();
    el.tray.setAttribute("aria-label", "Rolled " + state.dice.join(", "));
  }

  /* ---------------- Typing ---------------- */

  function put(text) {
    if (!state.running) return;
    if (state.typed.length > 40) return;
    state.typed += text;
    drawTyped();
  }

  function rub() {
    if (!state.running) return;
    state.typed = state.typed.slice(0, -1);
    drawTyped();
  }

  function clearTyped() {
    state.typed = "";
    drawTyped();
  }

  function drawTyped() {
    el.typed.textContent = state.typed || "…";
    el.typed.className = "typed" + (state.typed ? " has-sum" : "");
  }

  function submit() {
    if (!state.running) return;
    const checked = E.check(state.typed, state.dice, level().ops);
    if (!checked.ok) { nudge(checked.why); return; }

    const value = checked.value;
    if (state.numbers.indexOf(value) === -1) {
      nudge("That comes to " + value + ", which is not on the board.");
      return;
    }
    if (state.gone[value]) {
      nudge(value + " has already been knocked out. Find another one.");
      return;
    }

    state.gone[value] = true;
    // The rule book scores the face value: knock out 12 and you get 12 points.
    // Which changes the whole game -- the big numbers are where the points are.
    state.score += value;
    state.knocked += 1;
    clearTyped();
    drawBoard();
    el.score.textContent = state.score;
    flash(value);
    say("✔ " + checked.tidy + " = " + value + ". Worth " + value + " points!" +
      (checked.claimed === null ? "  (Try writing = and the answer next time — it counts for more.)" : ""));

    el.score.textContent = state.score;
    const leftToFind = state.possible.filter(function (n) { return !state.gone[n]; });
    if (!leftToFind.length) {
      say("That is every single one this roll could make. Rolling again…");
      window.setTimeout(function () { if (state.running) rollDice(); }, 900);
    }
  }

  function nudge(why) {
    say(why);
    el.typed.classList.add("is-wrong");
    window.setTimeout(function () { el.typed.classList.remove("is-wrong"); }, 500);
  }

  function flash(value) {
    const cell = el.board.children[state.numbers.indexOf(value)];
    if (!cell) return;
    cell.classList.add("just-out");
    window.setTimeout(function () { cell.classList.remove("just-out"); }, 700);
  }

  /* ---------------- Keys ---------------- */

  function drawKeys() {
    el.keys.innerHTML = "";
    const keys = state.dice.map(function (n) {
      return { label: String(n), put: String(n), kind: "die" };
    });
    keys.push({ label: "+", put: "+" }, { label: "−", put: "-" },
              { label: "×", put: "*" }, { label: "÷", put: "/" },
              { label: "(", put: "(" }, { label: ")", put: ")" },
              { label: "=", put: "=", kind: "equals" });
    if (level().ops.indexOf("^") !== -1) keys.push({ label: "^", put: "^" });
    if (level().ops.indexOf("√") !== -1) keys.push({ label: "√", put: "√" });

    keys.forEach(function (key) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "key" + (key.kind === "die" ? " key--die" : "") +
        (key.kind === "equals" ? " key--equals" : "");
      button.textContent = key.label;
      button.setAttribute("aria-label", key.kind === "die" ? "The " + key.label + " you rolled" : key.label);
      button.addEventListener("click", function () { put(key.put); });
      el.keys.appendChild(button);
    });
  }

  /* ---------------- Rounds ---------------- */

  function startRound() {
    state.gone = {};
    state.numbers = makeNumbers();
    state.score = 0;
    state.knocked = 0;
    state.typed = "";
    state.running = true;
    state.startedAt = Date.now();
    state.endsAt = level().seconds ? Date.now() + level().seconds * 1000 : 0;
    el.start.textContent = "Give up";
    el.summary.hidden = true;
    el.score.textContent = "0";
    buildBoard();
    buildTray();
    rollDice();
    drawTyped();
    if (state.ticker) window.clearInterval(state.ticker);
    state.ticker = window.setInterval(tick, 200);
    tick();
    say("Use all " + state.dice.length + " numbers in every sum. Go!");
  }

  function tick() {
    if (!state.running) return;
    if (!state.endsAt) { el.clock.textContent = "∞"; return; }
    const left = Math.max(0, state.endsAt - Date.now());
    el.clock.textContent = Math.ceil(left / 1000) + "s";
    el.clock.className = "stat-value" + (left < 10000 ? " is-urgent" : "");
    if (left <= 0) finishRound();
  }

  function finishRound() {
    state.running = false;
    if (state.ticker) { window.clearInterval(state.ticker); state.ticker = null; }
    el.start.textContent = "Play again";
    el.clock.className = "stat-value";

    // What was left on the table. The finder is generous, so if a player ever
    // found more than it did, believe the player.
    const couldHave = Math.max(state.knocked, state.possible.length);
    const missed = state.possible.filter(function (n) { return !state.gone[n]; });
    el.summary.hidden = false;
    el.summaryScore.textContent = state.score + " points — " + state.knocked +
      " of the " + couldHave + " numbers that roll could make";
    el.missed.innerHTML = "";
    if (missed.length) {
      const note = document.createElement("p");
      note.className = "missed-note";
      note.textContent = "That last roll — " + state.dice.join(", ") + " — could also have made:";
      el.missed.appendChild(note);
      missed.forEach(function (n) {
        const chip = document.createElement("span");
        chip.className = "missed-chip";
        chip.textContent = n;
        el.missed.appendChild(chip);
      });
    } else {
      const note = document.createElement("p");
      note.className = "missed-note";
      note.textContent = "You found everything that last roll could make.";
      el.missed.appendChild(note);
    }
    say("Time! " + state.score + " points from " + state.knocked + " numbers. " +
      (state.knocked >= couldHave ? "Nothing left on the table." : ""));
    if (board) board.offer(state.score, state.level);
  }

  function stopRound() {
    state.running = false;
    if (state.ticker) { window.clearInterval(state.ticker); state.ticker = null; }
    el.start.textContent = "Start";
    el.clock.textContent = "—";
    say("Stopped. Press Start whenever you like.");
  }

  /* ---------------- Levels ---------------- */

  function drawLevels() {
    el.levels.innerHTML = "";
    Object.keys(LEVELS).forEach(function (id) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip" + (state.level === id ? " is-on" : "");
      button.textContent = LEVELS[id].label;
      button.setAttribute("aria-pressed", String(state.level === id));
      button.addEventListener("click", function () {
        state.level = id;
        if (state.running) stopRound();
        state.gone = {};
        state.dice = [];
        state.numbers = makeNumbers();
        buildBoard();
        buildTray();
        drawKeys();
        drawLevels();
        if (board) board.setCategory(id);
        say(LEVELS[id].blurb);
      });
      el.levels.appendChild(button);
    });
  }

  /* ---------------- Leaderboard ---------------- */

  const board = window.Leaderboard ? window.Leaderboard.create({
    gameId: "number-knockout",
    gameName: "Number Knockout",
    metric: { label: "Points", better: "higher", format: "number" },
    categories: Object.keys(LEVELS).map(function (id) { return { id: id, label: LEVELS[id].label }; }),
  }) : null;
  if (board) board.mount(document.getElementById("leaderboard-panel"));

  /* ---------------- Wiring ---------------- */

  el.start.addEventListener("click", function () {
    if (state.running) stopRound(); else startRound();
  });
  el.enter.addEventListener("click", submit);
  el.rub.addEventListener("click", rub);

  window.addEventListener("keydown", function (event) {
    if (event.target && (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA")) return;
    if (event.key === "Enter") { event.preventDefault(); if (state.running) submit(); else startRound(); return; }
    if (event.key === "Backspace") { event.preventDefault(); rub(); return; }
    if (event.key === "Escape") { event.preventDefault(); clearTyped(); return; }
    if (/^[0-9+\-*/()^=]$/.test(event.key)) { event.preventDefault(); put(event.key); return; }
    if (event.key === "r" || event.key === "R") { event.preventDefault(); put("√"); }
  });

  drawLevels();
  state.numbers = makeNumbers();
  buildBoard();
  buildTray();
  drawKeys();
  drawTyped();
  say(level().blurb + " Press Start.");

  window.N2KApp = {
    state: state, LEVELS: LEVELS, E: E, F: F,
    startRound: startRound, finishRound: finishRound, submit: submit,
    put: put, rub: rub, clearTyped: clearTyped, rollDice: rollDice, level: level,
    makeNumbers: makeNumbers,
    scores: board,
  };
})();
