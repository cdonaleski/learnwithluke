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
  };

  if (!state.cycle) {
    const first = CC.cycles()[0];
    state.cycle = first ? first.cycle : 3;
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
      el.why.textContent = mode.why + " · " + level.why +
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
    return CC.pick(state.cycle, state.strand, state.sections, state.direction);
  }

  function restart() {
    state.queue = CC.forPractice(cards());
    state.at = 0;
    state.shown = false;
    state.picked = null;
    state.done = {};
    state.round = state.mode === "match"
      ? CC.matchRound(state.queue, CC.levelOf(state.level).pairs)
      : null;
    drawPickers();
    draw();
  }

  function draw() {
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

  /** Cards: on your own, flip it over. */
  function drawCard() {
    if (state.at >= state.queue.length) { drawFinished(); return; }
    const card = state.queue[state.at];

    const box = make("div", "cc-card" + (state.shown ? " is-open" : ""));
    box.appendChild(whereLine(card));
    box.appendChild(make("p", "cc-q", card.q));

    const row = make("div", "game-actions");
    if (state.shown) {
      box.appendChild(make("p", "cc-a", card.a));
      if (card.note) box.appendChild(make("p", "cc-note", card.note));
      const next = make("button", "btn btn-primary", "Next →");
      next.type = "button";
      next.addEventListener("click", function () { step(); });
      row.appendChild(next);
    } else {
      const hint = CC.hintFor(card, state.level);
      if (hint) box.appendChild(make("p", "cc-hint", hint));
      const peek = make("button", "btn btn-secondary", "Turn it over");
      peek.type = "button";
      peek.addEventListener("click", function () { state.shown = true; draw(); });
      row.appendChild(peek);
    }
    box.appendChild(row);

    el.stage.appendChild(box);
    el.stage.appendChild(make("p", "cc-where", (state.at + 1) + " of " + state.queue.length));
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
    const hint = CC.hintFor(card, state.level);
    if (hint) {
      checker.appendChild(make("p", "cc-aside cc-aside--nudge", "If they stall, read them this:"));
      checker.appendChild(make("p", "cc-hint", hint));
    }
    box.appendChild(checker);

    const row = make("div", "game-actions");
    const got = make("button", "btn btn-primary", "✓ Said it all");
    got.type = "button";
    got.addEventListener("click", function () { CC.saidIt(card, true); step(); });
    const missed = make("button", "btn btn-secondary", "Not yet");
    missed.type = "button";
    missed.addEventListener("click", function () { CC.saidIt(card, false); step(); });
    row.appendChild(got);
    row.appendChild(missed);
    box.appendChild(row);

    el.stage.appendChild(box);
    el.stage.appendChild(make("p", "cc-where",
      (state.at + 1) + " of " + state.queue.length + " · every word counts"));
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

  function drawFinished() {
    const box = make("div", "cc-card is-done");
    box.appendChild(make("p", "cc-q", "That is the whole set."));
    const sum = CC.tally(cards());
    box.appendChild(make("p", "cc-a", sum.learned + " of " + sum.total + " learned" +
      (sum.left ? " — " + sum.left + " to go." : " — every one of them.")));
    const again = make("button", "btn btn-primary", "Go again");
    again.type = "button";
    again.addEventListener("click", restart);
    const row = make("div", "game-actions");
    row.appendChild(again);
    box.appendChild(row);
    el.stage.appendChild(box);
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
