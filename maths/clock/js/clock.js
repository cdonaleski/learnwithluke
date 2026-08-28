/**
 * The clock you can take hold of.
 *
 * timewords.js knows what the time is and what it is called; this draws the
 * face and lets the hands be dragged. Dragging the minute hand round drags the
 * hour hand with it, a twelfth as far, because that is what the cogs inside a
 * real clock do -- and seeing that happen is most of the lesson.
 */
(function () {
  "use strict";

  const faceEl = document.getElementById("face");
  if (!faceEl) return;
  const T = window.TimeWords;
  const NS = "http://www.w3.org/2000/svg";
  const ROUND = 10;

  const MODES = {
    explore: { label: "🔎 Have a play", asks: false },
    read: { label: "👀 Read the clock", asks: true },
    set: { label: "✋ Set the clock", asks: true },
  };

  const el = {
    face: faceEl,
    digital: document.getElementById("digital"),
    words: document.getElementById("words"),
    status: document.getElementById("status"),
    modes: document.getElementById("modes"),
    steps: document.getElementById("steps"),
    choices: document.getElementById("choices"),
    task: document.getElementById("task"),
    count: document.getElementById("count"),
    score: document.getElementById("score"),
    start: document.getElementById("btn-start"),
    check: document.getElementById("btn-check"),
  };

  const state = {
    time: 10 * 60 + 10,        // ten past ten: the friendliest a clock ever looks
    mode: "explore",
    step: "oclock",
    target: null,
    asked: 0,
    right: 0,
    running: false,
    grabbed: null,
    started: 0,
    locked: false,
  };

  /* ---------------- The face ---------------- */

  function tag(name, attrs) {
    const node = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach(function (key) { node.setAttribute(key, attrs[key]); });
    return node;
  }

  const MID = 100, R = 92;

  function pointAt(angle, radius) {
    const rad = (angle - 90) * Math.PI / 180;
    return [MID + radius * Math.cos(rad), MID + radius * Math.sin(rad)];
  }

  function buildFace() {
    el.face.innerHTML = "";
    el.face.appendChild(tag("circle", { cx: MID, cy: MID, r: R, class: "dial" }));

    for (let m = 0; m < 60; m++) {
      const long = m % 5 === 0;
      const a = pointAt(m * 6, R - (long ? 12 : 6));
      const b = pointAt(m * 6, R - 2);
      el.face.appendChild(tag("line", {
        x1: a[0], y1: a[1], x2: b[0], y2: b[1],
        class: long ? "tick tick--hour" : "tick",
      }));
    }

    for (let h = 1; h <= 12; h++) {
      const p = pointAt(h * 30, R - 26);
      const num = tag("text", { x: p[0], y: p[1], class: "numeral" });
      num.textContent = h;
      el.face.appendChild(num);
    }

    el.hourHand = tag("line", { class: "hand hand--hour", x1: MID, y1: MID, x2: MID, y2: MID - 48 });
    el.minuteHand = tag("line", { class: "hand hand--minute", x1: MID, y1: MID, x2: MID, y2: MID - 74 });
    el.face.appendChild(el.hourHand);
    el.face.appendChild(el.minuteHand);
    el.face.appendChild(tag("circle", { cx: MID, cy: MID, r: 6, class: "pin" }));
  }

  function drawHands() {
    const angles = T.handAngles(state.time);
    const hour = pointAt(angles.hour, 48);
    const minute = pointAt(angles.minute, 74);
    el.hourHand.setAttribute("x2", hour[0]);
    el.hourHand.setAttribute("y2", hour[1]);
    el.minuteHand.setAttribute("x2", minute[0]);
    el.minuteHand.setAttribute("y2", minute[1]);
    el.face.setAttribute("aria-label", "A clock showing " + T.inWords(state.time));

    const showAnswer = state.mode !== "read" || !state.running;
    el.digital.textContent = showAnswer ? T.digital(state.time) : "?";
    el.words.textContent = showAnswer ? T.inWords(state.time) : "what time is this?";
  }

  /* ---------------- Dragging ---------------- */

  function angleFromEvent(event) {
    const box = el.face.getBoundingClientRect();
    const x = event.clientX - (box.left + box.width / 2);
    const y = event.clientY - (box.top + box.height / 2);
    return (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360;
  }

  /** Whichever hand the finger came down nearest to. */
  function nearestHand(angle) {
    const hands = T.handAngles(state.time);
    const gap = function (a, b) {
      const d = Math.abs(((a - b) % 360 + 360) % 360);
      return Math.min(d, 360 - d);
    };
    return gap(angle, hands.minute) <= gap(angle, hands.hour) ? "minute" : "hour";
  }

  function moveHand(angle) {
    // The guard lives here rather than at each place that calls it. When the
    // clock IS the question, nothing may move the hands -- and putting the
    // check at the one place that changes them means that stays true however
    // it comes to be called.
    if (state.locked) return;
    const step = T.stepFor(state.step);
    if (state.grabbed === "minute") {
      // Keep the hour, set the minutes -- and the hour hand creeps on its own,
      // because it is worked out from the total, not stored separately.
      const minutes = T.minuteFromAngle(angle, step);
      state.time = T.wrap(T.hourOf(state.time) * 60 + minutes);
    } else {
      const hour = T.hourFromAngle(angle);
      state.time = T.wrap(hour * 60 + T.minuteOf(state.time));
    }
    drawHands();
  }

  el.face.addEventListener("pointerdown", function (event) {
    if (state.locked) return;
    const angle = angleFromEvent(event);
    state.grabbed = nearestHand(angle);
    moveHand(angle);
    try { el.face.setPointerCapture(event.pointerId); } catch (err) { /* not vital */ }
    event.preventDefault();
  });

  window.addEventListener("pointermove", function (event) {
    if (!state.grabbed || state.locked) return;
    moveHand(angleFromEvent(event));
  });

  window.addEventListener("pointerup", function () { state.grabbed = null; });
  window.addEventListener("pointercancel", function () { state.grabbed = null; });

  /* ---------------- Questions ---------------- */

  function say(text) { el.status.textContent = text; }

  function startRound() {
    if (!MODES[state.mode].asks) {
      say("This is the playing-about mode. Pick 'Read the clock' or 'Set the clock' for questions.");
      return;
    }
    state.asked = 0;
    state.right = 0;
    state.running = true;
    state.started = Date.now();
    el.start.textContent = "Give up";
    nextQuestion();
  }

  function nextQuestion() {
    state.target = T.pickTime(state.step);
    state.locked = false;
    if (state.mode === "read") {
      state.time = state.target;
      state.locked = true;              // the clock is the question, not a toy
      askWhichWords();
      say("What time is this clock showing?");
    } else {
      state.time = T.wrap(T.pickTime(state.step));
      el.choices.innerHTML = "";
      el.task.textContent = "Make it say: " + T.inWords(state.target);
      say("Drag the hands, then press Check.");
    }
    el.check.hidden = state.mode !== "set";
    drawHands();
    drawStats();
  }

  function askWhichWords() {
    el.task.textContent = "";
    const wrong = T.distractors(state.target, state.step, 3);
    const options = wrong.concat([state.target]);
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const swap = options[i]; options[i] = options[j]; options[j] = swap;
    }
    el.choices.innerHTML = "";
    options.forEach(function (time) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice";
      button.textContent = T.inWords(time);
      button.addEventListener("click", function () { answerWith(time, button); });
      el.choices.appendChild(button);
    });
  }

  function answerWith(time, button) {
    if (!state.running) return;
    const right = T.wrap(time) === T.wrap(state.target);
    mark(right, button);
  }

  function checkSetting() {
    if (!state.running || state.mode !== "set") return;
    const right = T.wrap(state.time) === T.wrap(state.target);
    mark(right, null);
  }

  function mark(right, button) {
    state.asked += 1;
    if (right) state.right += 1;
    state.locked = true;
    if (button) button.classList.add(right ? "is-right" : "is-wrong");
    Array.prototype.forEach.call(el.choices.children, function (b) { b.disabled = true; });

    if (right) {
      say("Yes — " + T.inWords(state.target) + ".");
    } else if (state.mode === "set") {
      state.time = state.target;
      drawHands();
      say("Not quite. " + T.inWords(state.target) + " looks like this — " +
        T.digital(state.target) + ".");
    } else {
      say("Not quite. It was " + T.inWords(state.target) + ", which is written " +
        T.digital(state.target) + ".");
    }
    drawStats();

    window.setTimeout(function () {
      if (state.asked >= ROUND) finishRound();
      else nextQuestion();
    }, right ? 900 : 2400);
  }

  function finishRound() {
    state.running = false;
    state.locked = false;
    el.start.textContent = "Go again";
    el.check.hidden = true;
    el.choices.innerHTML = "";
    el.task.textContent = "";
    const took = Date.now() - state.started;
    say(state.right + " out of " + ROUND + " right. " +
      (state.right === ROUND ? "Every one! " : "") + "Have another go, or make it harder.");
    drawStats();
    drawHands();
    if (board && state.right === ROUND) board.offer(took, state.mode + "-" + state.step);
  }

  function drawStats() {
    el.count.textContent = state.running ? state.asked + " / " + ROUND : "—";
    el.score.textContent = state.right;
  }

  /* ---------------- Choosers ---------------- */

  function drawChoosers() {
    el.modes.innerHTML = "";
    Object.keys(MODES).forEach(function (id) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip" + (state.mode === id ? " is-on" : "");
      button.textContent = MODES[id].label;
      button.setAttribute("aria-pressed", String(state.mode === id));
      button.addEventListener("click", function () {
        state.mode = id;
        state.running = false;
        state.locked = false;
        el.start.textContent = "Start";
        el.choices.innerHTML = "";
        el.task.textContent = "";
        el.check.hidden = true;
        drawChoosers();
        drawHands();
        say(id === "explore" ? "Drag the hands and watch what the time is called."
          : id === "read" ? "Press Start and read what the clock says."
          : "Press Start and set the clock to what it asks for.");
      });
      el.modes.appendChild(button);
    });

    el.steps.innerHTML = "";
    T.STEPS.forEach(function (s) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip" + (state.step === s.id ? " is-on" : "");
      button.textContent = s.label;
      button.setAttribute("aria-pressed", String(state.step === s.id));
      button.addEventListener("click", function () {
        state.step = s.id;
        drawChoosers();
        if (board) board.setCategory(state.mode + "-" + state.step);
        say(s.label + ".");
      });
      el.steps.appendChild(button);
    });
  }

  /* ---------------- Leaderboard ---------------- */

  const categories = [];
  ["read", "set"].forEach(function (mode) {
    T.STEPS.forEach(function (s) {
      categories.push({ id: mode + "-" + s.id, label: (mode === "read" ? "Read · " : "Set · ") + s.label });
    });
  });
  const board = window.Leaderboard ? window.Leaderboard.create({
    gameId: "clock",
    gameName: "Telling the Time",
    metric: { label: "Time", better: "lower", format: "time" },
    categories: categories,
  }) : null;
  if (board) board.mount(document.getElementById("leaderboard-panel"));

  /* ---------------- Go ---------------- */

  el.start.addEventListener("click", function () {
    if (state.running) {
      state.running = false;
      state.locked = false;
      el.start.textContent = "Start";
      el.choices.innerHTML = "";
      el.task.textContent = "";
      el.check.hidden = true;
      say("Stopped.");
      drawHands();
    } else startRound();
  });
  el.check.addEventListener("click", checkSetting);

  buildFace();
  drawChoosers();
  drawHands();
  drawStats();
  say("Drag the hands and watch what the time is called.");

  window.ClockApp = {
    state: state, T: T, startRound: startRound, nextQuestion: nextQuestion,
    answerWith: answerWith, checkSetting: checkSetting, moveHand: moveHand,
    nearestHand: nearestHand, drawHands: drawHands, ROUND: ROUND, scores: board,
  };
})();
