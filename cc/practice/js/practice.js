/**
 * The practice page: pick what to work on, then work on it.
 *
 * cc.js knows the cards and the rules; this file is only the screen. The
 * split matters because the rules are the part worth testing, and a test
 * should not have to click anything to check them.
 */
(function () {
  "use strict";

  const CC = window.CC;
  const root = document.getElementById("cc-app");
  if (!CC || !root) return;

  const el = {
    cycles: document.getElementById("pick-cycle"),
    strands: document.getElementById("pick-strand"),
    sectionBar: document.getElementById("section-bar"),
    tools: document.getElementById("cc-app"),
    summary: document.getElementById("cc-summary"),
    sectionToggle: document.getElementById("section-toggle"),
    sections: document.getElementById("pick-section"),
    modes: document.getElementById("pick-mode"),
    levels: document.getElementById("pick-level"),
    directions: document.getElementById("pick-direction"),
    why: document.getElementById("cc-mode-why"),
    count: document.getElementById("cc-count"),
    stage: document.getElementById("cc-stage"),
    empty: document.getElementById("cc-empty"),
  };

  const MODES = [
    { id: "cards", label: "Cards", icon: "🃏",
      why: "On your own. Say it, turn it over, see if you were right." },
    { id: "match", label: "Match", icon: "🔗",
      why: "On your own. Pair each prompt with its answer, a few at a time." },
    { id: "recite", label: "Recite", icon: "🎤",
      why: "With a parent or a friend. They read the prompt and check you — this is proof day." },
  ];

  /** Recite help is spoken, so the levels mean something different there. */
  const RECITE_WHY = {
    easy: "If they stall, you can give them the opening words.",
    medium: "If they stall, all you can tell them is how many words.",
    hard: "Nothing to give them. This is proof day.",
  };

  const state = {
    cycle: Number(new URLSearchParams(window.location.search).get("cycle")) || 0,
    strand: "all",
    sections: [],
    direction: "taught",
    level: "medium",
    mode: "cards",
    sectionsOpen: false,
    toolsOpen: false,
    queue: [],
    at: 0,
    shown: false,
    round: null,
    picked: null,
    done: {},
    // What happened in THIS sitting. The progress store knows the long run;
    // this is so a parent can see, at the end, what to work on tonight.
    missed: [],
    drill: null,
  };

  if (!state.cycle) {
    const first = CC.cycles()[0];
    state.cycle = first ? first.cycle : 3;
  }

  /**
   * Keyboard advice, but only where there is a keyboard. A phone has no
   * space bar and telling it to press one is noise.
   */
  function hasKeyboard() {
    return Boolean(window.matchMedia && window.matchMedia("(pointer: fine)").matches);
  }

  function keys(text) {
    return hasKeyboard() ? " · " + text : "";
  }

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function chip(label, on, onClick, title) {
    const button = make("button", "chip" + (on ? " is-on" : ""), label);
    button.type = "button";
    button.setAttribute("aria-pressed", String(on));
    if (title) button.title = title;
    button.addEventListener("click", onClick);
    return button;
  }

  /* ---------------- The pickers ---------------- */

  function drawPickers() {
    el.cycles.innerHTML = "";
    CC.cycles().forEach(function (cycle) {
      el.cycles.appendChild(chip(cycle.label, cycle.cycle === state.cycle, function () {
        state.cycle = cycle.cycle;
        state.strand = "all";
        state.sections = [];
        restart();
      }));
    });
    el.cycles.hidden = CC.cycles().length < 2;

    el.strands.innerHTML = "";
    el.strands.appendChild(chip("All", state.strand === "all", function () {
      state.strand = "all";
      state.sections = [];
      state.sectionsOpen = false;
      restart();
    }));
    CC.strandsWithCards(state.cycle).forEach(function (strand) {
      el.strands.appendChild(chip(strand.icon + " " + strand.label, state.strand === strand.id, function () {
        state.strand = strand.id;
        state.sections = [];
        restart();
      }));
    });

    // Sections only mean something inside one strand: section 7 of math and
    // section 7 of Latin have nothing to do with each other. They are also
    // twenty-four buttons, so they stay folded away until asked for.
    const sections = state.strand === "all" ? [] : CC.sectionsWithCards(state.cycle, state.strand);
    el.sectionBar.hidden = sections.length < 2;
    if (sections.length > 1) {
      el.sectionToggle.textContent = (state.sections.length
        ? "Sections " + state.sections.slice().sort(function (a, b) { return a - b; }).join(", ")
        : "All " + sections.length + " sections") + (state.sectionsOpen ? " ▴" : " ▾");
      el.sectionToggle.setAttribute("aria-expanded", String(state.sectionsOpen));

      el.sections.innerHTML = "";
      el.sections.hidden = !state.sectionsOpen;
      el.sections.appendChild(chip("All", state.sections.length === 0, function () {
        state.sections = [];
        restart();
      }));
      sections.forEach(function (row) {
        const on = state.sections.indexOf(row.section) !== -1;
        el.sections.appendChild(chip(String(row.section), on, function () {
          // Sections add up: revising 1 to 6 means tapping six of them.
          const where = state.sections.indexOf(row.section);
          if (where === -1) state.sections.push(row.section); else state.sections.splice(where, 1);
          restart();
        }, row.section + ". " + row.label));
      });
    }

    el.modes.innerHTML = "";
    MODES.forEach(function (mode) {
      el.modes.appendChild(chip(mode.icon + " " + mode.label, mode.id === state.mode, function () {
        state.mode = mode.id;
        restart();
      }));
    });

    el.levels.innerHTML = "";
    CC.LEVELS.forEach(function (level) {
      el.levels.appendChild(chip(level.label, level.id === state.level, function () {
        state.level = level.id;
        restart();
      }, level.why));
    });

    // Only Latin has two-sided cards, so the choice only appears there.
    const twoSided = CC.canChooseDirection(state.cycle, state.strand, state.sections);
    el.directions.hidden = !twoSided;
    el.directions.innerHTML = "";
    if (twoSided) {
      CC.DIRECTIONS.forEach(function (dir) {
        el.directions.appendChild(chip(dir.label, dir.id === state.direction, function () {
          state.direction = dir.id;
          restart();
        }, dir.why));
      });
    }

    const mode = MODES.filter(function (m) { return m.id === state.mode; })[0];
    const dir = CC.DIRECTIONS.filter(function (d) { return d.id === state.direction; })[0];
    const level = CC.levelOf(state.level);
    if (el.why && mode) {
      const levelWhy = state.mode === "recite" ? RECITE_WHY[level.id] : level.why;
      el.why.textContent = mode.why + " · " + levelWhy +
        (twoSided && dir && dir.id !== "taught" ? " · " + dir.why : "");
    }

    if (el.summary) {
      const strand = state.strand === "all" ? null : CC.strandOf(state.strand);
      const where = strand ? strand.icon + " " + strand.label : "Everything";
      const which = state.sections.length
        ? " " + state.sections.slice().sort(function (a, b) { return a - b; }).join(", ")
        : "";
      el.summary.textContent = (mode ? mode.icon + " " + mode.label : "") +
        " · " + where + which + " · " + level.label +
        (state.toolsOpen ? "  ▴" : "  ▾");
      el.summary.setAttribute("aria-expanded", String(state.toolsOpen));
    }
  }

  /* ---------------- Running ---------------- */

  function cards() {
    if (state.drill) return state.drill;
    return CC.pick(state.cycle, state.strand, state.sections, state.direction);
  }

  /** Start over on whatever is chosen. Any change to the pickers lands here. */
  function restart() {
    state.drill = null;
    begin();
  }

  /** Lay out a run. `state.drill`, when set, narrows it to a chosen few. */
  function begin() {
    state.queue = CC.forPractice(cards());
    state.at = 0;
    state.shown = false;
    state.picked = null;
    state.done = {};
    state.missed = [];
    state.round = state.mode === "match"
      ? CC.matchRound(state.queue, CC.levelOf(state.level).pairs)
      : null;
    drawPickers();
    draw();
  }

  function draw() {
    // Every draw replaces the stage, so keys bound to the screen being thrown
    // away go with it -- or space would fire a verdict on a card that is gone.
    state.space = null;
    state.nope = null;
    const all = cards();
    const sum = CC.tally(all);
    el.count.textContent = all.length ? sum.learned + " of " + sum.total + " learned" : "";
    el.empty.hidden = all.length > 0;
    el.stage.hidden = all.length === 0;

    if (!all.length) {
      const cycle = CC.cycleOf(state.cycle);
      const strand = CC.strandOf(state.strand);
      // History is deliberately absent from the published site, so say that
      // rather than letting it look broken.
      el.empty.textContent = strand && strand.id === "history"
        ? "The history sentences are Classical Conversations’ own writing, so they are not on the "
          + "website. They are in the family’s copy of this page at home."
        : (cycle ? cycle.label : "That cycle") + " has nothing in it yet.";
      return;
    }

    el.stage.innerHTML = "";
    if (state.mode === "match") drawMatch();
    else if (state.mode === "recite") drawRecite();
    else drawCard();
  }

  /**
   * Cards: a real card with two sides, which turns over.
   *
   * The flip is a CSS transition, so the card must NOT be rebuilt when it is
   * turned -- a node created and transformed in the same tick has no starting
   * style to animate from and simply snaps. Both faces are therefore built up
   * front and turning over only toggles a class on what is already there.
   */
  function drawCard() {
    if (state.at >= state.queue.length) { drawFinished(); return; }
    const card = state.queue[state.at];

    const flip = make("div", "cc-flip");
    const inner = make("div", "cc-flip-inner");

    const front = make("div", "cc-face cc-face--front");
    front.appendChild(whereLine(card));
    front.appendChild(make("p", "cc-q", card.q));
    const hint = CC.hintFor(card, state.level);
    if (hint) front.appendChild(make("p", "cc-hint", hint));
    front.appendChild(make("p", "cc-face-foot",
      "Say it out loud, then " + (hasKeyboard() ? "press space" : "tap the card")));

    const back = make("div", "cc-face cc-face--back");
    back.appendChild(make("p", "cc-aside", "The answer"));
    back.appendChild(make("p", "cc-a", card.a));
    if (card.note) back.appendChild(make("p", "cc-note", card.note));
    // The point of the exercise is that the answer is not there yet, so it is
    // hidden from a screen reader too, not just from the eye.
    back.setAttribute("aria-hidden", "true");

    inner.appendChild(front);
    inner.appendChild(back);
    flip.appendChild(inner);

    const turn = make("button", "btn btn-secondary", "Turn it over");
    turn.type = "button";

    function turnOver() {
      if (state.shown) return;
      state.shown = true;
      flip.classList.add("is-flipped");
      front.setAttribute("aria-hidden", "true");
      back.setAttribute("aria-hidden", "false");
      turn.textContent = "Next →";
      turn.className = "btn btn-primary";
    }

    turn.addEventListener("click", function () {
      if (state.shown) step(); else turnOver();
    });
    flip.addEventListener("click", turnOver);

    // Space is the one key the hands are already on. In Cards it means
    // "carry on": turn this card over, and once it is over, deal the next.
    state.space = function () { if (state.shown) step(); else turnOver(); };

    const row = make("div", "game-actions");
    row.appendChild(turn);

    el.stage.appendChild(flip);
    el.stage.appendChild(row);
    el.stage.appendChild(make("p", "cc-where",
      (state.at + 1) + " of " + state.queue.length + keys("space turns it over")));
  }

  /**
   * Recite: two people. Whoever is checking holds the device, reads the
   * prompt out loud and watches the answer while the student says it back —
   * so the answer is ON SCREEN, for the checker, not hidden from the room.
   * That is how the proof is actually given, and a student practicing it
   * alone with the answer hidden is practicing something else.
   */
  function drawRecite() {
    if (state.at >= state.queue.length) { drawFinished(); return; }
    const card = state.queue[state.at];

    const box = make("div", "cc-card is-recite");
    box.appendChild(whereLine(card));
    box.appendChild(make("p", "cc-aside", "Read this out loud:"));
    box.appendChild(make("p", "cc-q", card.q));

    const checker = make("div", "cc-checker");
    checker.appendChild(make("p", "cc-aside", "They should say:"));
    checker.appendChild(make("p", "cc-a", card.a));
    if (card.note) checker.appendChild(make("p", "cc-note", card.note));

    // The checker is holding the screen, so a scaffold floating above the
    // card would be help nobody can use -- they can already see the whole
    // answer. It belongs down here, as something to feed the student when
    // they stall. At Hard there is nothing to feed them, which is the point.
    // Spoken help, because the checker is speaking. A first-letter skeleton
    // is something you read with your eyes; nobody can say it out loud.
    const nudge = CC.nudgeFor(card, state.level);
    if (nudge) {
      checker.appendChild(make("p", "cc-aside cc-aside--nudge", "If they stall, you can give them:"));
      checker.appendChild(make("p", "cc-nudge", nudge));
    }
    box.appendChild(checker);

    const row = make("div", "game-actions");
    const got = make("button", "btn btn-primary", "✓ Said it all");
    got.type = "button";
    got.addEventListener("click", function () { judge(card, true); });
    const missed = make("button", "btn btn-secondary", "Not yet");
    missed.type = "button";
    missed.addEventListener("click", function () { judge(card, false); });
    row.appendChild(got);
    row.appendChild(missed);
    box.appendChild(row);

    // Space is the common case -- it went fine, carry on. A miss is the
    // judgment worth making deliberately, so it keeps a key of its own.
    state.space = function () { judge(card, true); };
    state.nope = function () { judge(card, false); };

    el.stage.appendChild(box);
    el.stage.appendChild(make("p", "cc-where",
      (state.at + 1) + " of " + state.queue.length + " · every word counts" +
      keys("space if they got it, N if not")));
  }

  /**
   * A verdict in Recite. It goes two places: the long-run progress store,
   * and this sitting's own list, so the end of the session can say what to
   * work on rather than just how many were right.
   */
  function judge(card, right) {
    CC.saidIt(card, right);
    if (!right && !state.missed.some(function (m) { return CC.idOf(m) === CC.idOf(card); })) {
      state.missed.push(card);
    }
    step();
  }

  function whereLine(card) {
    const strand = CC.strandOf(card.strand);
    return make("p", "cc-card-where",
      (strand ? strand.icon + " " + strand.label : card.strand) +
      " · " + card.section + ". " + card.label +
      (CC.isLearned(card) ? " · learned" : ""));
  }

  function step() {
    state.at += 1;
    state.shown = false;
    draw();
  }

  /**
   * The end of a sitting. The count is the least useful thing here: what a
   * parent needs is the list of what did not come out, with the answers, so
   * the next ten minutes have somewhere to go.
   */
  function drawFinished() {
    const box = make("div", "cc-card is-done");
    box.appendChild(make("p", "cc-q", state.drill ? "That is the lot." : "That is the whole set."));
    const sum = CC.tally(cards());
    box.appendChild(make("p", "cc-a", sum.learned + " of " + sum.total + " learned" +
      (sum.left ? " — " + sum.left + " to go." : " — every one of them.")));

    const row = make("div", "game-actions");
    const again = make("button", "btn btn-primary", "Go again");
    again.type = "button";
    again.addEventListener("click", function () { restart(); });
    row.appendChild(again);

    if (state.missed.length) {
      const drill = make("button", "btn btn-secondary",
        "Work on these " + state.missed.length);
      drill.type = "button";
      drill.addEventListener("click", function () {
        state.drill = state.missed.slice();
        begin();
      });
      row.appendChild(drill);
    }
    box.appendChild(row);
    el.stage.appendChild(box);

    if (state.missed.length) el.stage.appendChild(report());
    else if (state.mode === "recite") {
      el.stage.appendChild(make("p", "cc-where", "Nothing missed this time."));
    }

    state.space = function () { restart(); };
  }

  /** What did not come out this sitting, grouped the way the proof asks. */
  function report() {
    const panel = make("div", "cc-report");
    panel.appendChild(make("h3", "cc-report-title",
      "To work on — " + state.missed.length +
      (state.missed.length === 1 ? " card" : " cards") + " missed"));

    const byWhere = {};
    state.missed.forEach(function (card) {
      const strand = CC.strandOf(card.strand);
      const key = (strand ? strand.icon + " " + strand.label : card.strand) +
        " · " + card.section + ". " + card.label;
      if (!byWhere[key]) byWhere[key] = [];
      byWhere[key].push(card);
    });

    Object.keys(byWhere).forEach(function (key) {
      panel.appendChild(make("p", "cc-report-where", key));
      const list = make("dl", "cc-report-list");
      byWhere[key].forEach(function (card) {
        list.appendChild(make("dt", null, card.q));
        list.appendChild(make("dd", null, card.a));
      });
      panel.appendChild(list);
    });

    return panel;
  }

  /* ---------------- Match ---------------- */

  function drawMatch() {
    if (!state.round || !state.round.prompts.length) { drawFinished(); return; }
    const solved = Object.keys(state.done).length;

    if (solved >= state.round.prompts.length) {
      const box = make("div", "cc-card is-done");
      box.appendChild(make("p", "cc-q", "All matched."));
      const again = make("button", "btn btn-primary", "Another round");
      again.type = "button";
      again.addEventListener("click", function () {
        state.round = CC.matchRound(state.queue, CC.levelOf(state.level).pairs);
        state.done = {};
        state.picked = null;
        draw();
      });
      const row = make("div", "game-actions");
      row.appendChild(again);
      box.appendChild(row);
      el.stage.appendChild(box);
      return;
    }

    const grid = make("div", "cc-match");
    const left = make("div", "cc-match-side");
    const right = make("div", "cc-match-side");

    state.round.prompts.forEach(function (card) {
      const id = CC.idOf(card);
      const done = Boolean(state.done[id]);
      const button = make("button",
        "cc-pair" + (done ? " is-done" : "") + (state.picked === id ? " is-picked" : ""), card.q);
      button.type = "button";
      button.disabled = done;
      button.addEventListener("click", function () {
        state.picked = state.picked === id ? null : id;
        draw();
      });
      left.appendChild(button);
    });

    state.round.answers.forEach(function (card) {
      const id = CC.idOf(card);
      const done = Boolean(state.done[id]);
      const button = make("button", "cc-pair cc-pair--a" + (done ? " is-done" : ""), card.a);
      button.type = "button";
      button.disabled = done;
      button.addEventListener("click", function () {
        if (!state.picked) { flash(button, "nudge"); return; }
        if (state.picked === id) {
          state.done[id] = true;
          state.picked = null;
          draw();
        } else {
          // Wrong pair: say so and let them try again. Nothing is marked
          // learned or missed here -- Match is recognition, not recitation.
          flash(button, "wrong");
          state.picked = null;
          draw();
        }
      });
      right.appendChild(button);
    });

    grid.appendChild(left);
    grid.appendChild(right);
    el.stage.appendChild(grid);
    el.stage.appendChild(make("p", "cc-where",
      solved + " of " + state.round.prompts.length + " paired · " +
      (state.picked ? "now tap its answer" : "tap a prompt, then its answer")));
  }

  function flash(node, why) {
    node.classList.add(why === "wrong" ? "is-wrong" : "is-nudge");
    window.setTimeout(function () { node.classList.remove("is-wrong", "is-nudge"); }, 450);
  }

  /* ---------------- Wiring ---------------- */

  /**
   * Space carries on. It is bound per screen rather than globally, because
   * what "carry on" means changes: turn the card over, deal the next one,
   * record that it was said. A screen with nothing to carry on to -- Match,
   * where the work is the tapping -- binds nothing.
   *
   * A key press that belongs to a focused control is left alone, or space on
   * a focused button would fire twice.
   */
  document.addEventListener("keydown", function (event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const on = event.target;
    if (on && (on.tagName === "INPUT" || on.tagName === "TEXTAREA" ||
               on.tagName === "SELECT" || on.tagName === "BUTTON" ||
               on.isContentEditable)) return;

    if (event.key === " " || event.key === "Spacebar") {
      if (!state.space) return;
      event.preventDefault();      // or the page scrolls out from under you
      state.space();
    } else if ((event.key === "n" || event.key === "N") && state.nope) {
      event.preventDefault();
      state.nope();
    }
  });

  el.sectionToggle.addEventListener("click", function () {
    state.sectionsOpen = !state.sectionsOpen;
    drawPickers();
  });

  if (el.summary) {
    el.summary.addEventListener("click", function () {
      state.toolsOpen = !state.toolsOpen;
      el.tools.classList.toggle("is-open", state.toolsOpen);
      drawPickers();
    });
  }

  restart();

  window.CCPractice = { state: state, MODES: MODES, restart: restart };
})();
