/**
 * The fraction wall, and the questions that go with it.
 *
 * fractions.js does the arithmetic; this builds the bars and asks the
 * questions. Shading a row and seeing another row line up with it exactly is
 * the entire argument for why 1/2 and 3/6 are the same number, and it is a far
 * better argument than being told.
 */
(function () {
  "use strict";

  const wallEl = document.getElementById("wall");
  if (!wallEl) return;
  const Fr = window.Fractions;
  const ROUND = 10;

  const el = {
    wall: wallEl,
    readout: document.getElementById("readout"),
    status: document.getElementById("status"),
    question: document.getElementById("question"),
    choices: document.getElementById("choices"),
    count: document.getElementById("count"),
    score: document.getElementById("score"),
    start: document.getElementById("btn-start"),
    clear: document.getElementById("btn-clear"),
    kinds: document.getElementById("kinds"),
  };

  const state = {
    shaded: {},          // bottom -> how many parts are filled
    kind: "bigger",
    question: null,
    asked: 0,
    right: 0,
    running: false,
    started: 0,
  };

  function say(text) { el.status.textContent = text; }

  /* ---------------- The wall ---------------- */

  function buildWall() {
    el.wall.innerHTML = "";
    Fr.WALL.forEach(function (bottom) {
      const row = document.createElement("div");
      row.className = "wall-row";

      const label = document.createElement("span");
      label.className = "wall-label";
      label.textContent = bottom === 1 ? "1" : "1/" + bottom;
      row.appendChild(label);

      const bar = document.createElement("div");
      bar.className = "wall-bar";
      bar.dataset.bottom = bottom;
      for (let i = 0; i < bottom; i++) {
        const part = document.createElement("button");
        part.type = "button";
        part.className = "part";
        part.dataset.bottom = bottom;
        part.dataset.index = i;
        part.setAttribute("aria-label",
          "Shade " + (i + 1) + " of " + bottom + (bottom === 1 ? " whole" : " parts"));
        part.addEventListener("click", function () { shadeTo(bottom, i + 1); });
        bar.appendChild(part);
      }
      row.appendChild(bar);

      const amount = document.createElement("span");
      amount.className = "wall-amount";
      amount.dataset.bottom = bottom;
      row.appendChild(amount);

      el.wall.appendChild(row);
    });
    drawWall();
  }

  /** Clicking the third part of four shades three quarters; clicking it again clears the row. */
  function shadeTo(bottom, parts) {
    if (state.shaded[bottom] === parts) delete state.shaded[bottom];
    else state.shaded[bottom] = parts;
    drawWall();
    describe();
  }

  function clearWall() {
    state.shaded = {};
    drawWall();
    describe();
    say("Wall cleared. Click any bar to shade it.");
  }

  function drawWall() {
    Array.prototype.forEach.call(el.wall.children, function (row) {
      const bar = row.children[1], amount = row.children[2];
      const bottom = Number(bar.dataset.bottom);
      const filled = state.shaded[bottom] || 0;
      Array.prototype.forEach.call(bar.children, function (part, i) {
        part.className = "part" + (i < filled ? " is-on" : "");
      });
      amount.textContent = filled ? filled + "/" + bottom : "";
      row.className = "wall-row" + (filled ? " has-shading" : "");
    });
    markEquivalents();
  }

  /** Rows shaded to the same amount are outlined together. */
  function markEquivalents() {
    const shaded = Object.keys(state.shaded).map(Number);
    const matched = {};
    shaded.forEach(function (b1) {
      shaded.forEach(function (b2) {
        if (b1 === b2) return;
        if (Fr.sameAs(state.shaded[b1], b1, state.shaded[b2], b2)) {
          matched[b1] = true; matched[b2] = true;
        }
      });
    });
    Array.prototype.forEach.call(el.wall.children, function (row) {
      const bottom = Number(row.children[1].dataset.bottom);
      if (matched[bottom]) row.classList.add("is-equal");
      else row.classList.remove("is-equal");
    });
  }

  /** What the shaded rows add up to saying. */
  function describe() {
    const rows = Object.keys(state.shaded).map(Number).sort(function (a, b) { return a - b; });
    if (!rows.length) { el.readout.textContent = "Click any bar to shade it."; return; }

    const named = rows.map(function (b) {
      return state.shaded[b] + "/" + b + " (" + Fr.inWords(state.shaded[b], b) + ")";
    });
    if (rows.length === 1) { el.readout.textContent = "You have shaded " + named[0] + "."; return; }

    // With two shaded, say which is bigger -- that is what the wall is for.
    if (rows.length === 2) {
      const a = { top: state.shaded[rows[0]], bottom: rows[0] };
      const b = { top: state.shaded[rows[1]], bottom: rows[1] };
      const side = Fr.compare(a.top, a.bottom, b.top, b.bottom);
      const asText = function (f) { return f.top + "/" + f.bottom; };
      el.readout.textContent = side === 0
        ? asText(a) + " and " + asText(b) + " are exactly the same amount — look at where they line up."
        : (side > 0 ? asText(a) + " is bigger than " + asText(b)
                    : asText(b) + " is bigger than " + asText(a)) + ".";
      return;
    }
    el.readout.textContent = "Shaded: " + named.join(", ") + ".";
  }

  /* ---------------- Questions ---------------- */

  const KINDS = {
    bigger: { label: "Which is bigger?", make: Fr.biggerQuestion },
    same: { label: "Are they the same?", make: Fr.sameQuestion },
    convert: { label: "How many of these?", make: Fr.convertQuestion },
    mixed: { label: "🎲 All mixed up", make: null },
  };

  function makeQuestion() {
    let kind = state.kind;
    if (kind === "mixed") {
      const pool = ["bigger", "same", "convert"];
      kind = pool[Math.floor(Math.random() * pool.length)];
    }
    return KINDS[kind].make(Fr.WALL);
  }

  function nextQuestion() {
    state.question = makeQuestion();
    const q = state.question;
    const asText = function (f) { return f.top + "/" + f.bottom; };
    el.choices.innerHTML = "";

    if (q.kind === "bigger") {
      el.question.textContent = "Which is bigger: " + asText(q.a) + " or " + asText(q.b) + "?";
      offer([
        { label: asText(q.a) + " — " + Fr.inWords(q.a.top, q.a.bottom), value: "a" },
        { label: asText(q.b) + " — " + Fr.inWords(q.b.top, q.b.bottom), value: "b" },
      ], q.answer);
    } else if (q.kind === "same") {
      el.question.textContent = "Is " + asText(q.a) + " the same amount as " + asText(q.b) + "?";
      offer([{ label: "Yes, the same", value: true }, { label: "No, different", value: false }], q.answer);
    } else {
      el.question.textContent = "How many " + Fr.NAMES[q.into][1] + " make " +
        asText(q.a) + "?";
      offer(convertChoices(q).map(function (n) { return { label: String(n), value: n }; }), q.answer);
    }
    drawStats();
  }

  /** Four numbers to choose from, the right one among them, all sensible. */
  function convertChoices(q) {
    const out = [q.answer];
    [q.a.top, q.answer + 1, q.answer - 1, q.answer + 2, q.into, q.answer + 3].forEach(function (n) {
      if (out.length >= 4) return;
      if (n < 1 || n > q.into) return;
      if (out.indexOf(n) === -1) out.push(n);
    });
    let n = 1;
    while (out.length < 4 && n <= q.into) { if (out.indexOf(n) === -1) out.push(n); n++; }
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const swap = out[i]; out[i] = out[j]; out[j] = swap;
    }
    return out;
  }

  function offer(options, answer) {
    options.forEach(function (option) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice";
      button.textContent = option.label;
      button.addEventListener("click", function () {
        stopGoingOn(); mark(option.value === answer, button); });
      el.choices.appendChild(button);
    });
  }

  function mark(right, button) {
    if (!state.running) return;
    state.asked += 1;
    if (right) state.right += 1;
    button.classList.add(right ? "is-right" : "is-wrong");
    Array.prototype.forEach.call(el.choices.children, function (b) { b.disabled = true; });

    // Whatever the question was, show it on the wall. Seeing the two bars is
    // the explanation; the words underneath are only a caption for it.
    const q = state.question;
    state.shaded = {};
    state.shaded[q.a.bottom] = q.a.top;
    if (q.b) state.shaded[q.b.bottom] = q.b.top;
    if (q.kind === "convert") state.shaded[q.into] = q.answer;
    drawWall();
    describe();

    say(right ? "Yes. " + explain(q) : "Not quite. " + explain(q));
    drawStats();
    window.setTimeout(function () {
      if (state.asked >= ROUND) finishRound();
      else nextQuestion();
    }, right ? 1500 : 2800);
  }

  function explain(q) {
    const asText = function (f) { return f.top + "/" + f.bottom; };
    if (q.kind === "bigger") {
      const winner = q.answer === "a" ? q.a : q.b, loser = q.answer === "a" ? q.b : q.a;
      return asText(winner) + " is bigger than " + asText(loser) + " — see how much further along the bar it goes.";
    }
    if (q.kind === "same") {
      return q.answer ? asText(q.a) + " and " + asText(q.b) + " line up exactly, so they are the same amount."
                      : asText(q.a) + " and " + asText(q.b) + " do not line up, so they are different.";
    }
    return q.answer + " " + Fr.NAMES[q.into][q.answer === 1 ? 0 : 1] + " make " + asText(q.a) + ".";
  }

  /* ---------------- Rounds ---------------- */

  function startRound() {
    stopGoingOn();
    state.asked = 0;
    state.right = 0;
    state.running = true;
    state.started = Date.now();
    el.start.textContent = "Give up";
    nextQuestion();
    say("Ten questions. Use the wall if you get stuck — that is what it is for.");
  }

  /**
   * Ten questions, a moment to see how it went, and then straight on.
   *
   * It used to stop dead and wait to be told to continue, which put a button
   * press between a child and the next question every ten. Practice works
   * better when it just keeps going: the score still gets its moment on
   * screen, and anybody who wants to stop can, but the default is to carry on.
   */
  function finishRound() {
    state.running = false;
    el.choices.innerHTML = "";
    el.question.textContent = state.right + " out of " + ROUND + " right";
    say(state.right === ROUND ? "Every single one. Try a harder kind of question."
                              : "Have another go — the wall is there to work it out on.");
    drawStats();
    if (board && state.right === ROUND) board.offer(Date.now() - state.started, state.kind);

    // If the score qualified, the board is asking for a name; carrying on
    // would snatch the question away mid-typing. So wait for that instead.
    if (board && board.pending) {
      el.start.textContent = "Go again";
      return;
    }
    goOn();
  }

  /**
   * Starts the next round shortly, unless somebody stops it first. The button
   * says what will happen and how to prevent it, because a countdown nobody
   * asked for is unnerving otherwise.
   */
  function goOn() {
    stopGoingOn();
    el.start.textContent = "Wait, stop";
    state.carryingOn = window.setTimeout(function () {
      state.carryingOn = null;
      startRound();
    }, 2600);
  }

  function stopGoingOn() {
    if (state.carryingOn) {
      window.clearTimeout(state.carryingOn);
      state.carryingOn = null;
    }
  }

  function drawStats() {
    el.count.textContent = state.running ? state.asked + " / " + ROUND : "—";
    el.score.textContent = state.right;
  }

  function drawKinds() {
    el.kinds.innerHTML = "";
    Object.keys(KINDS).forEach(function (id) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip" + (state.kind === id ? " is-on" : "");
      button.textContent = KINDS[id].label;
      button.setAttribute("aria-pressed", String(state.kind === id));
      button.addEventListener("click", function () {
        state.kind = id;
        drawKinds();
        if (board) board.setCategory(id);
        say(KINDS[id].label);
      });
      el.kinds.appendChild(button);
    });
  }

  /* ---------------- Leaderboard ---------------- */

  const board = window.Leaderboard ? window.Leaderboard.create({
    gameId: "fractions",
    gameName: "Fraction Wall",
    metric: { label: "Time", better: "lower", format: "time" },
    categories: Object.keys(KINDS).map(function (id) { return { id: id, label: KINDS[id].label }; }),
    // A perfect round asks for a name. Carrying on mid-typing would snatch the
    // question away, so the wait happens there instead -- and once the name is
    // in, the next round comes on its own like any other.
    onSaved: function () { goOn(); },
  }) : null;
  if (board) board.mount(document.getElementById("leaderboard-panel"));

  /* ---------------- Go ---------------- */

  el.start.addEventListener("click", function () {
    // Pressing it while the next round is on its way means "no, stop" -- which
    // is why the button says exactly that at the time.
    if (state.carryingOn) {
      stopGoingOn();
      el.start.textContent = "Start";
      say("Stopped. The wall is still yours to play with.");
      return;
    }
    if (state.running) {
      stopGoingOn();
      state.running = false;
      el.start.textContent = "Start";
      el.choices.innerHTML = "";
      el.question.textContent = "";
      say("Stopped. The wall is still yours to play with.");
    } else startRound();
  });
  el.clear.addEventListener("click", clearWall);

  buildWall();
  drawKinds();
  drawStats();
  describe();

  window.WallApp = {
    state: state, Fr: Fr, shadeTo: shadeTo, clearWall: clearWall, describe: describe,
    nextQuestion: nextQuestion, startRound: startRound, mark: mark,
    convertChoices: convertChoices, ROUND: ROUND, scores: board,
  };
})();
