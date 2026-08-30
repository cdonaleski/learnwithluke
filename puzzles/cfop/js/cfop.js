/**
 * Walking through CFOP.
 *
 * cube.js runs the notation, diagram.js draws it, and the four algorithm files
 * hold the cases. This puts them together: pick a stage, pick a case, and step
 * through the algorithm one move at a time watching the cube change.
 *
 * Every picture on the page is worked out by running the algorithm rather than
 * stored, so nothing on screen can be out of step with the moves beside it.
 */
(function () {
  "use strict";

  const stageEl = document.getElementById("stages");
  if (!stageEl) return;
  const C = window.Cube;
  const D = window.CubeDiagram;

  const LEARNT_KEY = "cfop-learnt";

  const STAGES = {
    cross: {
      label: "1 · Cross", short: "Cross",
      blurb: "Four edges round one centre, matched to the sides. No algorithms — " +
             "this one is worked out by looking.",
      cases: null,
    },
    f2l: {
      label: "2 · First two layers", short: "F2L",
      blurb: "Pair each corner with its edge and put the two in together. " +
             "Two layers finished at once, which is what makes CFOP quick.",
      cases: function () { return window.F2L; }, rows: 2, mode: "colour",
    },
    oll: {
      label: "3 · Orient the last layer", short: "OLL",
      blurb: "Make the whole top face one colour, never mind which piece is where. " +
             "Fifty-seven cases — and it really is fifty-seven, no more.",
      cases: function () { return window.OLL; }, rows: 1, mode: "orient",
    },
    pll: {
      label: "4 · Permute the last layer", short: "PLL",
      blurb: "Slide the top-layer pieces round to where they belong. " +
             "Twenty-one cases, and then the cube is done.",
      cases: function () { return window.PLL; }, rows: 1, mode: "colour",
    },
  };

  const CROSS_TIPS = [
    { title: "Do it on the bottom", text: "Beginners build the cross on top and then turn the " +
      "cube over. Building it on the bottom from the start saves that, and you can see the " +
      "first two layers coming while you do it." },
    { title: "Match the sides, not just the top", text: "An edge is only right when its other " +
      "colour matches the middle of the face it is on. A cross that looks finished from above " +
      "but has its sides all over the place is not a cross." },
    { title: "Look for the easy ones first", text: "Some edges drop straight in with one turn. " +
      "Do those, and the awkward ones will have moved while you were not looking." },
    { title: "Eight moves is plenty", text: "Every cross can be done in eight moves or fewer, " +
      "and most in six. If you are using more than that, there is a shorter way you have not seen." },
    { title: "Plan it before you start", text: "You get as long as you like to look before the " +
      "clock starts. Spend it on the cross — it is the only part you can plan the whole of." },
  ];

  const el = {
    stages: stageEl,
    blurb: document.getElementById("stage-blurb"),
    cases: document.getElementById("cases"),
    tips: document.getElementById("tips"),
    player: document.getElementById("player"),
    board: document.getElementById("player-board"),
    caseName: document.getElementById("case-name"),
    algText: document.getElementById("alg-text"),
    setup: document.getElementById("setup-text"),
    note: document.getElementById("case-note"),
    where: document.getElementById("player-where"),
    back: document.getElementById("btn-back"),
    next: document.getElementById("btn-next"),
    play: document.getElementById("btn-play"),
    learnt: document.getElementById("btn-learnt"),
    close: document.getElementById("btn-close"),
    progress: document.getElementById("progress"),
    search: document.getElementById("search"),
  };

  const state = {
    stage: "cross",
    open: null,        // the case being stepped through
    moves: [],
    at: 0,
    from: null,        // the cube as the case starts
    playing: null,
  };

  /* ---------------- Cases ---------------- */

  function caseId(item) {
    return String(item.id || item.n);
  }

  /** The cube as this case looks, worked out by running the algorithm backwards. */
  function caseState(item) {
    return C.run(C.solved(), C.inverse(item.alg)).state;
  }

  function learnt() {
    try { return JSON.parse(window.localStorage.getItem(LEARNT_KEY)) || {}; }
    catch (err) { return {}; }
  }

  function markLearnt(stage, id, yes) {
    const all = learnt();
    all[stage] = all[stage] || {};
    if (yes) all[stage][id] = true; else delete all[stage][id];
    try { window.localStorage.setItem(LEARNT_KEY, JSON.stringify(all)); } catch (err) { /* fine */ }
  }

  /* ---------------- Drawing ---------------- */

  function drawStages() {
    el.stages.innerHTML = "";
    Object.keys(STAGES).forEach(function (id) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip" + (state.stage === id ? " is-on" : "");
      button.textContent = STAGES[id].label;
      button.setAttribute("aria-pressed", String(state.stage === id));
      button.addEventListener("click", function () {
        state.stage = id;
        closeCase();
        drawStages();
        drawStage();
      });
      el.stages.appendChild(button);
    });
  }

  function drawStage() {
    const stage = STAGES[state.stage];
    el.blurb.textContent = stage.blurb;
    el.cases.innerHTML = "";
    el.tips.innerHTML = "";
    if (el.search) el.search.hidden = !stage.cases;

    if (!stage.cases) {
      CROSS_TIPS.forEach(function (tip) {
        const box = document.createElement("div");
        box.className = "tip";
        const head = document.createElement("h3");
        head.textContent = tip.title;
        const body = document.createElement("p");
        body.textContent = tip.text;
        box.appendChild(head);
        box.appendChild(body);
        el.tips.appendChild(box);
      });
      drawProgress();
      return;
    }

    const done = learnt()[state.stage] || {};
    const hunt = (el.search && el.search.value || "").trim().toLowerCase();
    stage.cases().forEach(function (item) {
      const id = caseId(item);
      const label = (item.n ? item.n + ". " : "") + (item.name || item.id);
      if (hunt && label.toLowerCase().indexOf(hunt) === -1 &&
          item.alg.toLowerCase().indexOf(hunt) === -1) return;

      const card = document.createElement("button");
      card.type = "button";
      card.className = "case" + (done[id] ? " is-learnt" : "");
      card.innerHTML = D.draw(caseState(item), {
        mode: stage.mode, rows: stage.rows, size: 16,
        label: label + ". Set up with " + C.setupFor(item.alg),
      }) + '<span class="case-label">' + label + "</span>";
      card.addEventListener("click", function () { openCase(item); });
      el.cases.appendChild(card);
    });
    drawProgress();
  }

  function drawProgress() {
    if (!el.progress) return;
    const stage = STAGES[state.stage];
    if (!stage.cases) { el.progress.textContent = ""; return; }
    const all = stage.cases();
    const done = learnt()[state.stage] || {};
    const count = all.filter(function (item) { return done[caseId(item)]; }).length;
    el.progress.textContent = count + " of " + all.length + " marked as learnt";
  }

  /* ---------------- Stepping through ---------------- */

  function openCase(item) {
    stopPlaying();
    state.open = item;
    state.from = caseState(item);
    state.moves = C.parse(item.alg).moves || [];
    state.at = 0;
    el.player.hidden = false;
    el.caseName.textContent = (item.n ? item.n + ". " : "") + (item.name || item.id);
    el.algText.textContent = C.tidy(item.alg);
    el.setup.textContent = C.setupFor(item.alg);
    el.note.textContent = item.note || (item.group ? item.group : "");
    const done = learnt()[state.stage] || {};
    setLearntButton(Boolean(done[caseId(item)]));
    drawPlayer();
    // Bringing it into view is a nicety, not the point; never let it stop the
    // case from opening.
    try { el.player.scrollIntoView({ block: "nearest" }); } catch (err) { /* fine */ }
  }

  function closeCase() {
    stopPlaying();
    state.open = null;
    el.player.hidden = true;
  }

  /** The cube after however many moves have been stepped through. */
  function nowState() {
    let here = state.from;
    for (let i = 0; i < state.at; i++) here = C.step(here, state.moves[i]);
    return here;
  }

  function drawPlayer() {
    const stage = STAGES[state.stage];
    el.board.innerHTML = D.draw(nowState(), {
      mode: "colour", rows: 2, size: 30,
      label: "The cube after " + state.at + " of " + state.moves.length + " moves",
    });
    void stage;
    el.where.textContent = state.at + " / " + state.moves.length;
    el.back.disabled = state.at === 0;
    el.next.disabled = state.at >= state.moves.length;

    // Show the algorithm with the move you are on picked out.
    el.algText.innerHTML = "";
    state.moves.forEach(function (move, i) {
      const bit = document.createElement("span");
      bit.className = "move" + (i === state.at - 1 ? " is-now" : "") +
        (i < state.at ? " is-done" : "");
      bit.textContent = move.name + (move.back ? "'" : "");
      el.algText.appendChild(bit);
    });
  }

  function move(by) {
    state.at = Math.max(0, Math.min(state.moves.length, state.at + by));
    drawPlayer();
  }

  function stopPlaying() {
    if (state.playing) { window.clearTimeout(state.playing); state.playing = null; }
    if (el.play) el.play.textContent = "▶ Play";
  }

  function play() {
    if (state.playing) { stopPlaying(); return; }
    if (state.at >= state.moves.length) state.at = 0;
    el.play.textContent = "⏸ Pause";
    const tick = function () {
      if (state.at >= state.moves.length) { stopPlaying(); return; }
      move(1);
      if (state.at >= state.moves.length) { stopPlaying(); return; }
      state.playing = window.setTimeout(tick, 700);
    };
    drawPlayer();
    state.playing = window.setTimeout(tick, 700);
  }

  function setLearntButton(yes) {
    if (!el.learnt) return;
    el.learnt.textContent = yes ? "✓ Learnt" : "Mark as learnt";
    el.learnt.classList.toggle("is-on", yes);
    el.learnt.setAttribute("aria-pressed", String(yes));
  }

  /* ---------------- Wiring ---------------- */

  if (el.back) el.back.addEventListener("click", function () { stopPlaying(); move(-1); });
  if (el.next) el.next.addEventListener("click", function () { stopPlaying(); move(1); });
  if (el.play) el.play.addEventListener("click", play);
  if (el.close) el.close.addEventListener("click", closeCase);
  if (el.learnt) el.learnt.addEventListener("click", function () {
    if (!state.open) return;
    const id = caseId(state.open);
    const was = Boolean((learnt()[state.stage] || {})[id]);
    markLearnt(state.stage, id, !was);
    setLearntButton(!was);
    drawStage();
  });
  if (el.search) el.search.addEventListener("input", drawStage);

  window.addEventListener("keydown", function (event) {
    if (event.target && event.target.tagName === "INPUT") return;
    if (!state.open) return;
    if (event.key === "ArrowRight") { stopPlaying(); move(1); event.preventDefault(); }
    if (event.key === "ArrowLeft") { stopPlaying(); move(-1); event.preventDefault(); }
    if (event.key === "Escape") { closeCase(); event.preventDefault(); }
  });

  drawStages();
  drawStage();

  window.CFOPApp = {
    state: state, STAGES: STAGES, C: C, D: D,
    caseState: caseState, openCase: openCase, closeCase: closeCase,
    move: move, play: play, nowState: nowState, drawStage: drawStage,
    caseId: caseId, learnt: learnt, markLearnt: markLearnt,
  };
})();
