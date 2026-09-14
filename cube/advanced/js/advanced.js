/**
 * Walking through the advanced techniques, the same way Learn CFOP walks
 * through F2L, OLL and PLL.
 *
 * This is a sibling of cube/learn/js/cfop.js, not the same file: the two
 * pages share every engine underneath (cube.js runs the notation, diagram.js
 * draws it, cfop3d.js turns it in three dimensions) but each owns its own
 * STAGES and its own progress, kept under its own key, because "learnt Sune"
 * and "learnt the Winter Variation case that looks like Sune" are different
 * facts and marking one should not touch the other.
 */
(function () {
  "use strict";

  const stageEl = document.getElementById("stages");
  if (!stageEl) return;
  const C = window.CubeMath;
  const D = window.CubeDiagram;

  const LEARNT_KEY = "advanced-learnt";

  const STAGES = {
    wv: {
      label: "Winter Variation", short: "WV",
      blurb: "Catch the last slot in a state where a smarter insert orients " +
             "some or all of the top corners for free. 21 cases worth knowing " +
             "out of WV's 27 -- the rest are just the ordinary insert.",
      cases: function () { return window.WV; }, rows: 2, mode: "colour",
    },
    coll: {
      label: "COLL", short: "COLL",
      blurb: "For once the last slot is already in and the last layer's edges " +
             "are already oriented: one algorithm finishes corners and edges " +
             "together, no separate PLL. Forty cases, named for the same seven " +
             "shapes OLL uses.",
      cases: function () { return window.COLL; }, rows: 1, mode: "colour",
    },
    vls: {
      label: "Valk Last Slot", short: "VLS",
      blurb: "Insert the last pair and orient the top in the same algorithm, " +
             "for the cases where the edge going into the slot is turned the " +
             "wrong way. Forty-two cases, the curated easy subset of a much " +
             "larger set.",
      cases: function () { return window.VLS; }, rows: 2, mode: "colour",
    },
    ble: {
      label: "Brooks' Last Edge", short: "BLE",
      blurb: "Break the last pair back apart on purpose, solve the top, then " +
             "put the pair back together -- worth it exactly when that edge " +
             "was going to need flipping anyway. 19 cases worth knowing out " +
             "of BLE's 27 -- the rest are just a normal OLL.",
      cases: function () { return window.BLE; }, rows: 2, mode: "colour",
    },
    cls: {
      label: "Corner Last Slot", short: "CLS",
      blurb: "For once the last slot's edge is already sitting where it " +
             "belongs and only the corner is left -- on top waiting to go " +
             "in, or already in the slot but twisted. Forty-four cases, " +
             "every one of them a genuine algorithm.",
      cases: function () { return window.CLS; }, rows: 2, mode: "colour",
    },
  };

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
    board3d: document.getElementById("player-3d"),
    speed: document.getElementById("speed"),
    mirrorText: document.getElementById("mirror-text"),
    back: document.getElementById("btn-back"),
    next: document.getElementById("btn-next"),
    play: document.getElementById("btn-play"),
    learnt: document.getElementById("btn-learnt"),
    close: document.getElementById("btn-close"),
    progress: document.getElementById("progress"),
    search: document.getElementById("search"),
  };

  const firstStage = Object.keys(STAGES)[0];

  const state = {
    stage: firstStage,
    view3d: null,
    animating: false,
    open: null,
    moves: [],
    at: 0,
    from: null,
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
    const keys = Object.keys(STAGES);
    // One technique, one button, is not a choice -- don't draw a tab strip
    // for a set of one.
    el.stages.hidden = keys.length < 2;
    keys.forEach(function (id) {
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

    const done = learnt()[state.stage] || {};
    const hunt = (el.search && el.search.value || "").trim().toLowerCase();
    stage.cases().forEach(function (item) {
      const id = caseId(item);
      const label = (item.n ? item.n + ". " : "") + (item.name || item.id || item.group);
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
    el.caseName.textContent = (item.n ? item.n + ". " : "") + (item.name || item.id || item.group);
    el.algText.textContent = C.tidy(item.alg);
    el.setup.textContent = C.setupFor(item.alg);
    el.note.textContent = item.note || item.group || "";
    if (el.mirrorText) el.mirrorText.textContent = C.mirror(item.alg);
    wake3d();
    const done = learnt()[state.stage] || {};
    setLearntButton(Boolean(done[caseId(item)]));
    drawPlayer();
    try { el.player.scrollIntoView({ block: "nearest" }); } catch (err) { /* fine */ }
  }

  function closeCase() {
    stopPlaying();
    state.open = null;
    el.player.hidden = true;
  }

  /* ---------------- The turning cube ---------------- */

  function swingMs() {
    const setting = el.speed ? Number(el.speed.value) : 3;
    return [1400, 950, 650, 420, 240][Math.max(0, Math.min(4, setting - 1))] || 650;
  }

  function still() {
    try {
      return Boolean(window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (err) { return false; }
  }

  function wake3d() {
    if (!window.CFOP3D || !el.board3d) return;
    if (!state.view3d) {
      state.view3d = window.CFOP3D.makeView(el.board3d);
      if (state.view3d) {
        const loop = function () {
          state.view3d.tick();
          window.requestAnimationFrame(loop);
        };
        window.requestAnimationFrame(loop);
        window.addEventListener("resize", function () { state.view3d.resize(); });
      }
    }
    if (state.view3d) state.view3d.paint(nowState());
  }

  function stepAnimated(by, done) {
    if (state.animating) return false;
    const forwards = by > 0;
    const at = forwards ? state.at : state.at - 1;
    if (at < 0 || at >= state.moves.length) { if (done) done(); return false; }
    const move = state.moves[at];
    const played = forwards ? move : { name: move.name, back: !move.back };

    if (!state.view3d || still()) {
      state.at += by;
      drawPlayer();
      if (state.view3d) state.view3d.paint(nowState());
      if (done) done();
      return true;
    }

    state.animating = true;
    state.view3d.animate(played, swingMs(), function () {
      state.animating = false;
      state.at += by;
      drawPlayer();
      state.view3d.paint(nowState());
      if (done) done();
    });
    if (forwards) {
      state.at += by;
      drawPlayer();
      state.at -= by;
    }
    return true;
  }

  function nowState() {
    let here = state.from;
    for (let i = 0; i < state.at; i++) here = C.step(here, state.moves[i]);
    return here;
  }

  function drawPlayer() {
    el.board.innerHTML = D.draw(nowState(), {
      mode: "colour", net: true, size: 30,
      label: "The whole cube unfolded, after " + state.at + " of " + state.moves.length + " moves",
    });
    el.where.textContent = state.at + " / " + state.moves.length;
    el.back.disabled = state.at === 0;
    el.next.disabled = state.at >= state.moves.length;

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
    if (typeof state.playing === "number") window.clearTimeout(state.playing);
    state.playing = null;
    if (el.play) el.play.textContent = "▶ Play";
  }

  function play() {
    if (state.playing) { stopPlaying(); return; }
    if (state.at >= state.moves.length) {
      state.at = 0;
      drawPlayer();
      if (state.view3d) state.view3d.paint(nowState());
    }
    el.play.textContent = "⏸ Pause";
    state.playing = true;
    const breath = function () { return Math.round(swingMs() * 0.3); };
    const next = function () {
      if (!state.playing || state.at >= state.moves.length) { stopPlaying(); return; }
      stepAnimated(1, function () {
        if (!state.playing) return;
        if (state.at >= state.moves.length) { stopPlaying(); return; }
        state.playing = window.setTimeout(next, breath()) || true;
      });
    };
    next();
  }

  function setLearntButton(yes) {
    if (!el.learnt) return;
    el.learnt.textContent = yes ? "✓ Learnt" : "Mark as learnt";
    el.learnt.classList.toggle("is-on", yes);
    el.learnt.setAttribute("aria-pressed", String(yes));
  }

  /* ---------------- Wiring ---------------- */

  if (el.back) el.back.addEventListener("click", function () { stopPlaying(); stepAnimated(-1); });
  if (el.next) el.next.addEventListener("click", function () { stopPlaying(); stepAnimated(1); });
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
    if (event.key === "ArrowRight") { stopPlaying(); stepAnimated(1); event.preventDefault(); }
    if (event.key === "ArrowLeft") { stopPlaying(); stepAnimated(-1); event.preventDefault(); }
    if (event.key === "Escape") { closeCase(); event.preventDefault(); }
  });

  drawStages();
  drawStage();

  window.AdvancedApp = {
    state: state, STAGES: STAGES, C: C, D: D,
    caseState: caseState, openCase: openCase, closeCase: closeCase,
    move: move, play: play, nowState: nowState, drawStage: drawStage,
    stepAnimated: stepAnimated, swingMs: swingMs,
    caseId: caseId, learnt: learnt, markLearnt: markLearnt,
  };
})();
