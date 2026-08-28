/**
 * The spinner: put names in, give it a shove, see who it lands on.
 *
 * wheel.js does the arithmetic; this draws it and turns it. The winner is
 * chosen first and the wheel is aimed at that slice, so what the pointer shows
 * and what is announced are the same thing by construction.
 */
(function () {
  "use strict";

  const canvas = document.getElementById("wheel");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = window.Wheel;

  const LIST_KEY = "spinner-list";
  const TAKE_KEY = "spinner-take-out";
  const SPIN_MS = 3400;

  const START = ["Luke", "Mum", "Dad", "Nobody", "Everybody", "Try again"];

  const COLOURS = ["#ff8a80", "#ffb74d", "#ffe082", "#aed581", "#4db6ac",
                   "#4fc3f7", "#9575cd", "#f06292"];

  const el = {
    canvas: canvas,
    entries: document.getElementById("entries"),
    result: document.getElementById("result"),
    status: document.getElementById("status"),
    spin: document.getElementById("btn-spin"),
    apply: document.getElementById("btn-apply"),
    reset: document.getElementById("btn-reset"),
    takeOut: document.getElementById("take-out"),
    left: document.getElementById("left"),
    sound: document.getElementById("btn-sound"),
  };

  const state = {
    names: load(LIST_KEY, START),
    all: null,          // the full list, kept so "start again" can restore it
    turn: 0,
    spinning: false,
    winner: -1,
    takeOut: false,
    lastTick: -1,
  };
  state.all = state.names.slice();
  try { state.takeOut = window.localStorage.getItem(TAKE_KEY) === "yes"; } catch (err) { /* ok */ }

  let soundOn = true;
  let audio = null;

  function load(key, fallback) {
    try {
      const raw = JSON.parse(window.localStorage.getItem(key));
      if (Array.isArray(raw) && raw.length) return raw;
    } catch (err) { /* fall through */ }
    return fallback.slice();
  }

  function save() {
    try {
      window.localStorage.setItem(LIST_KEY, JSON.stringify(state.all));
      window.localStorage.setItem(TAKE_KEY, state.takeOut ? "yes" : "no");
    } catch (err) { /* the wheel still spins */ }
  }

  function say(text) { el.status.textContent = text; }

  /* ---------------- Sound ---------------- */
  function tick(strong) {
    if (!soundOn) return;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      if (!audio) audio = new Ctor();
      if (audio.state === "suspended") audio.resume();
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = "square";
      osc.frequency.value = strong ? 880 : 420;
      gain.gain.setValueAtTime(strong ? 0.05 : 0.02, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + (strong ? 0.16 : 0.03));
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start();
      osc.stop(audio.currentTime + (strong ? 0.16 : 0.04));
    } catch (err) { /* sound is a nicety */ }
  }

  /* ---------------- Drawing ---------------- */

  function size() {
    const room = (canvas.parentNode && canvas.parentNode.clientWidth) || 360;
    const side = Math.max(220, Math.min(420, room - 8));
    const dpr = window.devicePixelRatio || 1;
    canvas.width = side * dpr;
    canvas.height = side * dpr;
    canvas.style.width = side + "px";
    canvas.style.height = side + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return side;
  }

  function draw() {
    const side = size();
    const mid = side / 2;
    const radius = mid - 12;
    const count = state.names.length;
    ctx.clearRect(0, 0, side, side);

    if (!count) {
      ctx.fillStyle = "#c3b69c";
      ctx.font = "600 16px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Add some names below", mid, mid);
      return;
    }

    const slice = W.sliceSize(count);
    ctx.save();
    ctx.translate(mid, mid);
    // Slices run clockwise from the top, matching how winnerAt reads them.
    ctx.rotate(state.turn - Math.PI / 2);

    state.names.forEach(function (name, i) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, i * slice, (i + 1) * slice);
      ctx.closePath();
      ctx.fillStyle = COLOURS[i % COLOURS.length];
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.rotate(i * slice + slice / 2);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#3a3226";
      const room = radius - 26;
      let px = Math.min(20, Math.max(9, Math.floor(slice * radius * 0.42)));
      ctx.font = "700 " + px + "px " + "Fredoka, system-ui, sans-serif";
      let label = name;
      while (ctx.measureText(label).width > room && label.length > 3) {
        label = label.slice(0, -1);
      }
      if (label !== name) label = label.slice(0, -1) + "…";
      ctx.fillText(label, radius - 14, 0);
      ctx.restore();
    });
    ctx.restore();

    // The hub and the pointer, which never move.
    ctx.beginPath();
    ctx.arc(mid, mid, 22, 0, W.TAU);
    ctx.fillStyle = "#fffdf7";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#c9b894";
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(mid, 6);
    ctx.lineTo(mid - 15, 34);
    ctx.lineTo(mid + 15, 34);
    ctx.closePath();
    ctx.fillStyle = "#2d3436";
    ctx.fill();

    canvas.setAttribute("aria-label", count + " on the wheel: " + state.names.join(", "));
  }

  /* ---------------- Spinning ---------------- */

  function spin() {
    if (state.spinning) return;
    if (state.names.length < 2) { say("Put at least two things on the wheel first."); return; }
    state.spinning = true;
    state.winner = -1;
    el.result.textContent = "…";
    el.result.className = "result is-spinning";
    el.spin.disabled = true;

    // Decide first, then aim at that slice. The picture cannot disagree with
    // the answer because the answer is what the picture is aimed at.
    const chosen = W.choose(state.names.length);
    const from = W.wrap(state.turn);
    const to = W.restingAngle(chosen, state.names.length, 4 + Math.floor(Math.random() * 3));
    const started = Date.now();
    state.lastTick = -1;

    function step() {
      const progress = (Date.now() - started) / SPIN_MS;
      state.turn = W.easeTo(from, to, progress);
      const over = W.winnerAt(state.turn, state.names.length);
      if (over !== state.lastTick) { tick(false); state.lastTick = over; }
      draw();
      if (progress < 1) { window.requestAnimationFrame(step); return; }
      state.turn = to;
      land(chosen);
    }
    window.requestAnimationFrame(step);
  }

  function land(chosen) {
    state.spinning = false;
    el.spin.disabled = false;
    // Read the winner back off the wheel rather than trusting the plan, so if
    // the two ever disagreed it would be the pointer that won the argument.
    const shown = W.winnerAt(state.turn, state.names.length);
    state.winner = shown;
    const name = state.names[shown];
    draw();
    tick(true);
    el.result.textContent = name;
    el.result.className = "result is-won";
    say("It landed on " + name + ".");

    if (state.takeOut) {
      state.names = state.names.filter(function (n, i) { return i !== shown; });
      drawLeft();
      draw();
      if (!state.names.length) {
        say("That is everybody. Press Start again to put them all back.");
      } else {
        say("It landed on " + name + " — taken off the wheel. " +
          state.names.length + " left.");
      }
    }
  }

  function drawLeft() {
    if (el.left) el.left.textContent = state.names.length;
  }

  /* ---------------- The list ---------------- */

  function applyList() {
    const tidied = W.tidy(el.entries.value);
    if (tidied.length < 2) { say("Two or more, one on each line."); return; }
    state.all = tidied;
    state.names = tidied.slice();
    state.turn = 0;
    state.winner = -1;
    el.result.textContent = "—";
    el.result.className = "result";
    save();
    draw();
    drawLeft();
    say(tidied.length + " on the wheel. Give it a spin.");
  }

  function resetWheel() {
    state.names = state.all.slice();
    state.turn = 0;
    el.result.textContent = "—";
    el.result.className = "result";
    draw();
    drawLeft();
    say("Everybody is back on. " + state.names.length + " on the wheel.");
  }

  /* ---------------- Wiring ---------------- */

  el.entries.value = state.all.join("\n");
  if (el.takeOut) {
    el.takeOut.checked = state.takeOut;
    el.takeOut.addEventListener("change", function () {
      state.takeOut = el.takeOut.checked;
      save();
      say(state.takeOut ? "Whoever it lands on comes off the wheel."
                        : "Everybody stays on the wheel.");
    });
  }
  el.spin.addEventListener("click", spin);
  canvas.addEventListener("click", spin);
  el.apply.addEventListener("click", applyList);
  el.reset.addEventListener("click", resetWheel);
  if (el.sound) el.sound.addEventListener("click", function () {
    soundOn = !soundOn;
    el.sound.textContent = soundOn ? "🔊 Sound On" : "🔇 Sound Off";
    el.sound.setAttribute("aria-pressed", String(soundOn));
  });

  window.addEventListener("resize", draw);
  window.addEventListener("keydown", function (event) {
    if (event.target && (event.target.tagName === "TEXTAREA" || event.target.tagName === "INPUT")) return;
    if (event.code === "Space" || event.key === "Enter") { event.preventDefault(); spin(); }
  });

  draw();
  drawLeft();

  window.SpinnerApp = {
    state: state, spin: spin, land: land, applyList: applyList, resetWheel: resetWheel, W: W,
  };
})();
