/**
 * The page for the working-out. working.js produces the steps; this shows one
 * at a time and lets you walk back and forth through them.
 *
 * Because every step is a complete picture, going back is simply showing an
 * earlier one -- nothing is ever undone, so there is no way for the display and
 * the arithmetic to drift apart.
 */
(function () {
  "use strict";

  const sumEl = document.getElementById("sum");
  if (!sumEl) return;
  const W = window.Working;

  const el = {
    sum: sumEl,
    note: document.getElementById("note"),
    status: document.getElementById("status"),
    first: document.getElementById("num-a"),
    second: document.getElementById("num-b"),
    ops: document.getElementById("ops"),
    go: document.getElementById("btn-go"),
    back: document.getElementById("btn-back"),
    next: document.getElementById("btn-next"),
    play: document.getElementById("btn-play"),
    where: document.getElementById("where"),
    examples: document.getElementById("examples"),
  };

  const state = { op: "add", out: null, at: 0, playing: null };

  function say(text) { el.status.textContent = text; }

  function readNumber(input) {
    const raw = String(input.value || "").replace(/[^0-9.-]/g, "");
    return raw === "" ? NaN : Number(raw);
  }

  function workItOut() {
    stopPlaying();
    const a = readNumber(el.first), b = readNumber(el.second);
    const out = W.stepsFor(state.op, a, b);
    if (out.error) {
      state.out = null;
      el.sum.innerHTML = "";
      el.note.textContent = "";
      el.where.textContent = "—";
      say(out.error);
      return;
    }
    state.out = out;
    state.at = 0;
    drawStep();
    say("Press Next to go through it a step at a time, or Play to watch it all.");
  }

  function drawStep() {
    const out = state.out;
    if (!out) return;
    const step = out.steps[state.at];
    el.sum.innerHTML = "";
    el.sum.className = "sum" + (step.bus ? " sum--bus" : "");

    step.rows.forEach(function (r) {
      const line = document.createElement("div");
      line.className = "sum-row sum-row--" + r.kind;
      line.style.setProperty("--cols", r.cells.length || out.width);

      const label = document.createElement("span");
      label.className = "sum-sign";
      label.textContent = r.label || "";
      line.appendChild(label);

      if (r.kind === "line" || r.kind === "busline") {
        const rule = document.createElement("span");
        rule.className = "sum-rule";
        line.appendChild(rule);
      } else {
        r.cells.forEach(function (c, i) {
          const box = document.createElement("span");
          box.className = "sum-cell" +
            (c.mark ? " is-" + c.mark : "") +
            (step.column === i ? " is-here" : "");
          box.textContent = c.t;
          line.appendChild(box);
        });
      }
      el.sum.appendChild(line);
    });

    el.note.textContent = step.note;
    el.where.textContent = (state.at + 1) + " / " + out.steps.length;
    el.back.disabled = state.at === 0;
    el.next.disabled = state.at >= out.steps.length - 1;
    el.sum.setAttribute("aria-label", step.note);
  }

  function move(by) {
    if (!state.out) return;
    state.at = Math.max(0, Math.min(state.out.steps.length - 1, state.at + by));
    drawStep();
  }

  function stopPlaying() {
    if (state.playing) { window.clearTimeout(state.playing); state.playing = null; }
    if (el.play) el.play.textContent = "▶ Play it through";
  }

  /**
   * Each step books the next one rather than a clock ticking away underneath.
   * If a step ever took longer than expected, two of them could not pile up on
   * top of each other -- and it stops itself at the end rather than running on.
   */
  function play() {
    if (!state.out) return;
    if (state.playing) { stopPlaying(); say("Paused."); return; }
    if (state.at >= state.out.steps.length - 1) state.at = 0;
    el.play.textContent = "⏸ Pause";
    drawStep();

    const tick = function () {
      if (!state.out || state.at >= state.out.steps.length - 1) { stopPlaying(); return; }
      move(1);
      if (state.at >= state.out.steps.length - 1) { stopPlaying(); return; }
      state.playing = window.setTimeout(tick, 2100);
    };
    state.playing = window.setTimeout(tick, 2100);
  }

  function drawOps() {
    el.ops.innerHTML = "";
    Object.keys(W.OPS).forEach(function (id) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip" + (state.op === id ? " is-on" : "");
      button.textContent = W.OPS[id].sign + " " + W.OPS[id].name;
      button.setAttribute("aria-pressed", String(state.op === id));
      button.addEventListener("click", function () {
        state.op = id;
        drawOps();
        workItOut();
      });
      el.ops.appendChild(button);
    });
  }

  const EXAMPLES = [
    { op: "add", a: 3476, b: 2985, why: "carrying all the way along" },
    { op: "sub", a: 5003, b: 1847, why: "borrowing past a nought" },
    { op: "mul", a: 376, b: 24, why: "long multiplication" },
    { op: "div", a: 4728, b: 6, why: "the bus stop" },
  ];

  function drawExamples() {
    if (!el.examples) return;
    el.examples.innerHTML = "";
    EXAMPLES.forEach(function (ex) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip";
      button.textContent = ex.a + " " + W.OPS[ex.op].sign + " " + ex.b + " — " + ex.why;
      button.addEventListener("click", function () {
        state.op = ex.op;
        el.first.value = ex.a;
        el.second.value = ex.b;
        drawOps();
        workItOut();
      });
      el.examples.appendChild(button);
    });
  }

  el.go.addEventListener("click", workItOut);
  el.back.addEventListener("click", function () { stopPlaying(); move(-1); });
  el.next.addEventListener("click", function () { stopPlaying(); move(1); });
  if (el.play) el.play.addEventListener("click", play);
  [el.first, el.second].forEach(function (input) {
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") { workItOut(); event.preventDefault(); }
    });
  });
  window.addEventListener("keydown", function (event) {
    if (event.target && event.target.tagName === "INPUT") return;
    if (event.key === "ArrowRight") { stopPlaying(); move(1); event.preventDefault(); }
    if (event.key === "ArrowLeft") { stopPlaying(); move(-1); event.preventDefault(); }
  });

  drawOps();
  drawExamples();
  el.first.value = 3476;
  el.second.value = 2985;
  workItOut();

  window.WorkingApp = {
    state: state, W: W, workItOut: workItOut, move: move, play: play,
    stopPlaying: stopPlaying, drawStep: drawStep, EXAMPLES: EXAMPLES,
  };
})();
