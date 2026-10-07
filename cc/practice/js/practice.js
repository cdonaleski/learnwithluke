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
    sections: document.getElementById("pick-section"),
    modes: document.getElementById("pick-mode"),
    why: document.getElementById("cc-mode-why"),
    count: document.getElementById("cc-count"),
    stage: document.getElementById("cc-stage"),
    empty: document.getElementById("cc-empty"),
  };

  const MODES = [
    { id: "cards", label: "Cards", icon: "🃏",
      why: "One at a time. Say it, then turn it over and see." },
    { id: "match", label: "Match", icon: "🔗",
      why: "Pair each prompt with its answer — five at a time." },
    { id: "recite", label: "Recite", icon: "🎤",
      why: "Prompt only. Say the whole thing out loud, then mark yourself. This is the real proof." },
  ];

  const state = {
    cycle: Number(new URLSearchParams(window.location.search).get("cycle")) || 0,
    strand: "all",
    sections: [],       // empty means every section
    mode: "cards",
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
    // One cycle loaded is not a choice.
    el.cycles.hidden = CC.cycles().length < 2;

    el.strands.innerHTML = "";
    el.strands.appendChild(chip("Everything", state.strand === "all", function () {
      state.strand = "all";
      state.sections = [];
      restart();
    }));
    CC.strandsWithCards(state.cycle).forEach(function (strand) {
      el.strands.appendChild(chip(strand.icon + " " + strand.label, state.strand === strand.id, function () {
        state.strand = strand.id;
        state.sections = [];
        restart();
      }));
    });

    // Sections only make sense inside one strand: section 7 of math and
    // section 7 of Latin have nothing to do with each other.
    el.sections.innerHTML = "";
    const sections = state.strand === "all" ? [] : CC.sectionsWithCards(state.cycle, state.strand);
    if (sections.length > 1) {
      el.sections.appendChild(chip("All sections", state.sections.length === 0, function () {
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
    el.sections.hidden = sections.length < 2;

    el.modes.innerHTML = "";
    MODES.forEach(function (mode) {
      el.modes.appendChild(chip(mode.icon + " " + mode.label, mode.id === state.mode, function () {
        state.mode = mode.id;
        restart();
      }));
    });

    const mode = MODES.filter(function (m) { return m.id === state.mode; })[0];
    if (el.why && mode) el.why.textContent = mode.why;
  }

  /* ---------------- Running ---------------- */

  function restart() {
    state.queue = CC.forPractice(CC.pick(state.cycle, state.strand, state.sections));
    state.at = 0;
    state.shown = false;
    state.picked = null;
    state.done = {};
    state.round = state.mode === "match" ? CC.matchRound(state.queue) : null;
    drawPickers();
    draw();
  }

  function draw() {
    const cards = CC.pick(state.cycle, state.strand, state.sections);
    const sum = CC.tally(cards);
    el.count.textContent = cards.length ? sum.learned + " of " + sum.total + " learned" : "";
    el.empty.hidden = cards.length > 0;
    el.stage.hidden = cards.length === 0;

    if (!cards.length) {
      const cycle = CC.cycleOf(state.cycle);
      const strand = CC.strandOf(state.strand);
      // The history strand is deliberately absent from the published site, so
      // say that rather than letting it look broken.
      el.empty.textContent = strand && strand.id === "history"
        ? "The history sentences are Classical Conversations’ own writing, so they are not on the "
          + "website. They are in the family copy of this page at home."
        : (cycle ? cycle.label : "That cycle") + " has nothing in it yet.";
      return;
    }

    el.stage.innerHTML = "";
    if (state.mode === "match") drawMatch();
    else drawOne();
  }

  /** Cards and Recite share a screen; what differs is whether you may peek. */
  function drawOne() {
    if (state.at >= state.queue.length) { drawFinished(); return; }
    const card = state.queue[state.at];
    const strand = CC.strandOf(card.strand);

    const box = make("div", "cc-card" + (state.shown ? " is-open" : ""));
    box.appendChild(make("p", "cc-card-where",
      (strand ? strand.icon + " " + strand.label : card.strand) +
      " · " + card.section + ". " + card.label +
      (CC.isLearned(card) ? " · learned" : "")));
    box.appendChild(make("p", "cc-q", card.q));

    if (state.shown) {
      box.appendChild(make("p", "cc-a", card.a));
      if (card.note) box.appendChild(make("p", "cc-note", card.note));
    } else if (state.mode === "cards") {
      const peek = make("button", "btn btn-secondary", "Turn it over");
      peek.type = "button";
      peek.addEventListener("click", function () { state.shown = true; draw(); });
      box.appendChild(peek);
    } else {
      box.appendChild(make("p", "cc-say", "Say the whole thing out loud."));
    }

    const row = make("div", "game-actions");
    if (state.mode === "recite" && !state.shown) {
      // Marking yourself before seeing the answer is the entire point.
      const got = make("button", "btn btn-primary", "✓ I said it all");
      got.type = "button";
      got.addEventListener("click", function () { mark(card, true); });
      const missed = make("button", "btn btn-secondary", "Not yet");
      missed.type = "button";
      missed.addEventListener("click", function () { mark(card, false); });
      row.appendChild(got);
      row.appendChild(missed);
    } else if (state.shown) {
      const next = make("button", "btn btn-primary", "Next →");
      next.type = "button";
      next.addEventListener("click", function () { mark(card, null); });
      row.appendChild(next);
    }
    box.appendChild(row);

    el.stage.appendChild(box);
    el.stage.appendChild(make("p", "cc-where", (state.at + 1) + " of " + state.queue.length));
  }

  function mark(card, right) {
    if (right !== null) CC.saidIt(card, right);
    state.at += 1;
    state.shown = false;
    draw();
  }

  function drawFinished() {
    const box = make("div", "cc-card is-done");
    box.appendChild(make("p", "cc-q", "That is the whole set."));
    const sum = CC.tally(CC.pick(state.cycle, state.strand, state.sections));
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
        state.round = CC.matchRound(state.queue);
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

  restart();

  window.CCPractice = { state: state, MODES: MODES, restart: restart };
})();
