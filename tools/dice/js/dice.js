/**
 * Dice Roller — roll any number of dice, of several kinds.
 *
 * Rolls come from Math.random(), scaled with Math.floor so every face is
 * equally likely. Keeping a tally of how often each face turns up is the point
 * of putting it on a learning site: roll two dice a few hundred times and 7
 * appears about six times as often as 2, which is a far better explanation of
 * why than being told.
 *
 * The D6 is a genuine CSS cube: six faces pushed out from the centre, spun to
 * bring the rolled face forward. The other dice are drawn as the shape you
 * would actually be holding — a d20 shows the ten faces you can see from one
 * side, a d12 shows six pentagons — and tumble in 3D while they settle.
 */
(function () {
  "use strict";

  const trayEl = document.getElementById("dice-tray");
  if (!trayEl) return;

  const DICE_TYPES = [
    { id: "d6", label: "🎲 D6", sides: 6, shape: "cube" },
    { id: "d4", label: "▲ D4", sides: 4, shape: "solid" },
    { id: "d8", label: "🔷 D8", sides: 8, shape: "solid" },
    { id: "d10", label: "🔟 D10", sides: 10, shape: "solid" },
    { id: "d12", label: "🎯 D12", sides: 12, shape: "solid" },
    { id: "d20", label: "⭐ D20", sides: 20, shape: "solid" },
  ];

  const PIPS = {
    1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
  };

  /**
   * Which face of the cube carries which number. Opposite faces of a real die
   * add up to 7, and these do: 1/6 front and back, 3/4 right and left,
   * 2/5 top and bottom.
   */
  const CUBE_FACES = [
    { value: 1, side: "front" }, { value: 6, side: "back" },
    { value: 3, side: "right" }, { value: 4, side: "left" },
    { value: 2, side: "top" }, { value: 5, side: "bottom" },
  ];

  /**
   * How far to turn the whole cube to bring each number to the front. These are
   * the inverses of the face placements above: the top face is pushed up by
   * rotateX(90deg), so tipping the cube back by -90deg brings it forward.
   */
  const CUBE_ANGLES = {
    1: [0, 0], 2: [-90, 0], 3: [0, -90], 4: [0, 90], 5: [90, 0], 6: [0, -180],
  };

  const MAX_DICE = 6;
  const ROLL_MS = 900;
  const TYPE_KEY = "dice-type";
  const COUNT_KEY = "dice-count";

  const state = {
    typeId: "d6",
    count: 2,
    rolls: [],
    rolling: false,
    totals: {},        // how often each TOTAL has come up
    rollCount: 0,
    history: [],       // recent totals, newest first
  };

  let diceEls = [];
  let soundOn = true;
  let audioCtx = null;
  let settleTimer = null;

  const el = {
    tray: trayEl,
    total: document.getElementById("dice-total"),
    status: document.getElementById("dice-status"),
    rolls: document.getElementById("dice-rolls"),
    average: document.getElementById("dice-average"),
    history: document.getElementById("dice-history"),
    chart: document.getElementById("dice-chart"),
    chartPanel: document.getElementById("chart-panel"),
    roll: document.getElementById("btn-roll"),
    reset: document.getElementById("btn-reset"),
    sound: document.getElementById("btn-sound"),
    countButtons: document.getElementById("count-buttons"),
    typeButtons: document.getElementById("type-buttons"),
  };

  function diceType() {
    return DICE_TYPES.find((d) => d.id === state.typeId) || DICE_TYPES[0];
  }

  /* ---------- The other dice, as solids ----------
     polyhedra.js works out the corners, the faces and how each one sits in
     space. All that is left here is to turn each face into an element, and
     light them. */

  /** Matches the tilt the CSS holds every die at, so the light agrees with it. */
  const TILT = window.Polyhedra
    ? window.Polyhedra.times(window.Polyhedra.rotX(-16), window.Polyhedra.rotY(-20))
    : null;

  /**
   * Fixed where you are sitting, not fixed to the die, and set just off your
   * line of sight -- allowing for the tilt above. Off to one side it gives the
   * faces their shape; too far off and a face angled towards the lamp outshines
   * the one you are trying to read, which on a real die is honest and here is
   * merely annoying.
   */
  const LIGHT = TILT ? window.Polyhedra.apply(TILT, [-0.2, -0.26, 0.94]) : [0, 0, 1];
  const LIT = [255, 253, 246];
  const SHADE = [178, 162, 133];

  /**
   * An extra turn for a die that would otherwise look flat.
   *
   * Every other solid shows several faces at once, but a tetrahedron's faces
   * are 109 degrees apart, so one held square to you hides the other three
   * completely and you are looking at a plain triangle. Turning it far enough
   * to bring a second face round the edge is the only way to see that it has
   * any depth at all.
   */
  const REST = { d4: [-10, -20] };

  function toneAt(brightness) {
    const t = Math.max(0, Math.min(1, brightness));
    return "rgb(" + LIT.map(function (c, i) {
      return Math.round(SHADE[i] + (c - SHADE[i]) * t);
    }).join(",") + ")";
  }

  function buildSolid(typeId) {
    const spec = window.Polyhedra.build(typeId);
    const solid = document.createElement("span");
    solid.className = "die-solid";
    const faces = spec.faces.map(function (face) {
      const el = document.createElement("span");
      el.className = "face";
      el.style.transform = face.transform;
      el.innerHTML = '<svg class="face-svg" viewBox="-50 -50 100 100" aria-hidden="true" ' +
        'focusable="false"><polygon points="' + face.points + '"/>' +
        '<text x="0" y="0" font-size="' + spec.font + '">' + face.number + "</text></svg>";
      solid.appendChild(el);
      return el;
    });
    return { el: solid, spec: spec, faces: faces };
  }

  /**
   * Turns the solid so `value` faces you, and relights every face for where it
   * has ended up. A face angled away from the light goes darker, which is the
   * only reason a white die reads as a solid rather than a white blob.
   */
  function showSolid(die, value) {
    const P = window.Polyhedra;
    const spec = die.solid.spec;
    const landed = spec.faces.find(function (f) { return f.number === value; }) || spec.faces[0];
    const rest = REST[spec.id];
    const extra = rest ? "rotateX(" + rest[0] + "deg) rotateY(" + rest[1] + "deg) " : "";
    die.solid.el.style.transform = extra + landed.landing;
    const turned = rest
      ? P.times(P.times(P.rotX(rest[0]), P.rotY(rest[1])), landed.rotation)
      : landed.rotation;
    const view = P.times(TILT, turned);
    spec.faces.forEach(function (face, i) {
      const facing = P.apply(view, face.normal);
      die.solid.faces[i].style.setProperty("--tone", toneAt(P.dot(facing, LIGHT)));
    });
  }

  /* ---------- Sound ---------- */
  function beep(freq, duration, type) {
    if (!soundOn) return;
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      if (!audioCtx) audioCtx = new AudioCtor();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type || "square";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (err) { /* optional */ }
  }

  /* ---------- Rolling ---------- */
  /** One fair die. Math.floor over a uniform random gives every face equal odds. */
  function rollDie(sides) {
    return 1 + Math.floor(Math.random() * sides);
  }

  function rollAll(count, sides) {
    const out = [];
    for (let i = 0; i < count; i++) out.push(rollDie(sides));
    return out;
  }

  function total(rolls) {
    return rolls.reduce((sum, value) => sum + value, 0);
  }

  function record(rolls) {
    const sum = total(rolls);
    state.totals[sum] = (state.totals[sum] || 0) + 1;
    state.rollCount += 1;
    state.history.unshift(sum);
    if (state.history.length > 30) state.history.length = 30;
  }

  function averageTotal() {
    if (!state.rollCount) return 0;
    let sum = 0;
    Object.keys(state.totals).forEach((key) => { sum += Number(key) * state.totals[key]; });
    return sum / state.rollCount;
  }

  /** Someone who has asked for less movement gets the result without the tumble. */
  function reducedMotion() {
    try {
      return Boolean(window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (err) { return false; }
  }

  function roll() {
    if (state.rolling) return;
    const type = diceType();
    // The result is decided up front; the tumble is only for show, so a slow
    // phone or an interrupted animation can never change what was rolled.
    state.rolls = rollAll(state.count, type.sides);
    state.rolling = true;
    el.roll.disabled = true;
    beep(300, 0.05, "square");

    const still = reducedMotion();
    diceEls.forEach(function (die, i) {
      if (still) return;
      // Whole extra turns land on the same face but make the cube spin to get
      // there. Varying them per die stops the dice moving in lockstep.
      die.spinX += 360 * (1 + (i % 2));
      die.spinY += 360 * (2 + ((i + 1) % 2));
      die.root.classList.add("is-rolling");
    });

    showValues();
    settleTimer = window.setTimeout(settle, still ? 0 : ROLL_MS);
  }

  function settle() {
    settleTimer = null;
    diceEls.forEach(function (die) { die.root.classList.remove("is-rolling"); });
    state.rolling = false;
    el.roll.disabled = false;
    record(state.rolls);
    beep(620, 0.09, "triangle");
    renderAll();
    setStatus(describeRoll());
  }

  function describeRoll() {
    const sum = total(state.rolls);
    const sides = diceType().sides;
    if (state.count === 1) return "You rolled a " + sum + ".";
    const allSame = state.rolls.every((v) => v === state.rolls[0]);
    if (allSame) return "🎉 All " + state.rolls[0] + "s! That's " + sum + ".";
    if (sum === state.count * sides) return "🌟 The highest possible — " + sum + "!";
    if (sum === state.count) return "😮 The lowest possible — " + sum + ".";
    return state.rolls.join(" + ") + " = " + sum;
  }

  /* ---------- Rendering ---------- */
  function buildCube() {
    const cube = document.createElement("span");
    cube.className = "die-cube";
    CUBE_FACES.forEach(function (face) {
      const side = document.createElement("span");
      side.className = "cube-face cube-face--" + face.side;
      for (let i = 0; i < 9; i++) {
        const pip = document.createElement("span");
        pip.className = "pip" + (PIPS[face.value].indexOf(i) !== -1 ? " is-on" : "");
        side.appendChild(pip);
      }
      cube.appendChild(side);
    });
    return cube;
  }

  /** The transform that brings `value` to the front, plus whatever spin it has built up. */
  function cubeTransform(value, die) {
    const angles = CUBE_ANGLES[value] || CUBE_ANGLES[1];
    return "rotateX(" + (die.spinX + angles[0]) + "deg) rotateY(" + (die.spinY + angles[1]) + "deg)";
  }

  /** Builds the dice themselves. Only needed when the number or kind changes. */
  function buildTray() {
    el.tray.innerHTML = "";
    diceEls = [];
    const shape = diceType().shape;
    for (let i = 0; i < state.count; i++) {
      const root = document.createElement("span");
      // The spin class varies so six dice do not tumble in lockstep.
      root.className = "die die--" + shape + " die--" + state.typeId + " spin-" + (i % 3);
      const die = { root: root, cube: null, solid: null, shape: shape, spinX: 0, spinY: 0 };
      const stage = document.createElement("span");
      stage.className = "die-stage";
      if (shape === "cube") {
        die.cube = buildCube();
        stage.appendChild(die.cube);
      } else {
        // The tumble goes on a wrapper, so the solid itself holds nothing but
        // the orientation of the face that was rolled.
        const spin = document.createElement("span");
        spin.className = "die-spin";
        die.solid = buildSolid(state.typeId);
        spin.appendChild(die.solid.el);
        stage.appendChild(spin);
      }
      root.appendChild(stage);
      el.tray.appendChild(root);
      diceEls.push(die);
    }
    showValues();
  }

  /** Points each die at its rolled value. */
  function showValues() {
    diceEls.forEach(function (die, i) {
      const value = state.rolls[i];
      if (die.cube) die.cube.style.transform = cubeTransform(value || 1, die);
      else showSolid(die, value || 1);
      die.root.setAttribute("aria-label", value ? String(value) : "not rolled yet");
    });
    el.total.textContent = state.rolls.length ? String(total(state.rolls)) : "—";
    el.tray.setAttribute("aria-label",
      state.rolls.length ? "Dice showing " + state.rolls.join(", ") : "The dice");
  }

  function renderHistory() {
    el.history.innerHTML = "";
    state.history.forEach((sum) => {
      const chip = document.createElement("li");
      chip.className = "dice-chip";
      chip.textContent = String(sum);
      el.history.appendChild(chip);
    });
  }

  /** A little bar chart of how often each total has come up. */
  function renderChart() {
    const sides = diceType().sides;
    const min = state.count;
    const max = state.count * sides;
    const spread = max - min + 1;
    el.chartPanel.hidden = state.rollCount === 0 || spread > 40;
    if (el.chartPanel.hidden) return;

    let peak = 1;
    for (let sum = min; sum <= max; sum++) peak = Math.max(peak, state.totals[sum] || 0);

    el.chart.innerHTML = "";
    for (let sum = min; sum <= max; sum++) {
      const count = state.totals[sum] || 0;
      const column = document.createElement("div");
      column.className = "chart-col";

      const bar = document.createElement("div");
      bar.className = "chart-bar";
      bar.style.height = Math.round((count / peak) * 100) + "%";
      bar.setAttribute("title", count + " time" + (count === 1 ? "" : "s"));

      const label = document.createElement("span");
      label.className = "chart-label";
      label.textContent = String(sum);

      column.appendChild(bar);
      column.appendChild(label);
      column.setAttribute("aria-label", "Total " + sum + ": rolled " + count + " times");
      el.chart.appendChild(column);
    }
  }

  function renderOptions() {
    el.countButtons.innerHTML = "";
    for (let n = 1; n <= MAX_DICE; n++) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option-btn" + (n === state.count ? " is-active" : "");
      button.textContent = String(n);
      button.setAttribute("aria-pressed", String(n === state.count));
      button.setAttribute("aria-label", n + (n === 1 ? " die" : " dice"));
      button.addEventListener("click", () => {
        state.count = n;
        try { window.localStorage.setItem(COUNT_KEY, String(n)); } catch (err) { /* ok */ }
        resetTally();
        state.rolls = [];
        renderOptions();
        buildTray();
        renderAll();
        setStatus("Rolling " + n + (n === 1 ? " die" : " dice") + " — tally cleared.");
      });
      el.countButtons.appendChild(button);
    }

    el.typeButtons.innerHTML = "";
    DICE_TYPES.forEach((type) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option-btn" + (type.id === state.typeId ? " is-active" : "");
      button.textContent = type.label;
      button.setAttribute("aria-pressed", String(type.id === state.typeId));
      button.addEventListener("click", () => {
        state.typeId = type.id;
        try { window.localStorage.setItem(TYPE_KEY, type.id); } catch (err) { /* ok */ }
        resetTally();
        state.rolls = [];
        renderOptions();
        buildTray();
        renderAll();
        setStatus("Switched to " + type.label.replace(/^\S+\s/, "") + " — tally cleared.");
      });
      el.typeButtons.appendChild(button);
    });
  }

  function renderAll() {
    showValues();
    renderHistory();
    renderChart();
    el.rolls.textContent = String(state.rollCount);
    el.average.textContent = state.rollCount ? averageTotal().toFixed(2) : "—";
  }

  function resetTally() {
    state.totals = {};
    state.rollCount = 0;
    state.history = [];
  }

  function setStatus(text) { el.status.textContent = text; }

  /* ---------- Wiring ---------- */
  el.roll.addEventListener("click", roll);
  el.tray.addEventListener("click", roll);
  el.reset.addEventListener("click", () => {
    resetTally();
    state.rolls = [];
    renderAll();
    setStatus("Tally cleared — roll away!");
  });
  el.sound.addEventListener("click", () => {
    soundOn = !soundOn;
    el.sound.textContent = soundOn ? "🔊 Sound On" : "🔇 Sound Off";
    el.sound.setAttribute("aria-pressed", String(soundOn));
  });

  window.addEventListener("keydown", (event) => {
    if (event.code !== "Space" && event.code !== "Enter") return;
    const tag = event.target && event.target.tagName;
    if (tag === "INPUT" || tag === "BUTTON") return;
    event.preventDefault();
    roll();
  });

  try {
    const savedType = window.localStorage.getItem(TYPE_KEY);
    if (savedType && DICE_TYPES.some((d) => d.id === savedType)) state.typeId = savedType;
    const savedCount = Number(window.localStorage.getItem(COUNT_KEY));
    if (savedCount >= 1 && savedCount <= MAX_DICE) state.count = savedCount;
  } catch (err) { /* defaults fine */ }

  renderOptions();
  buildTray();
  renderAll();

  window.DiceApp = {
    state, rollDie, rollAll, total, record, averageTotal, resetTally, roll, settle,
    buildTray, showValues, cubeTransform, buildSolid, showSolid, toneAt,
    CUBE_FACES, CUBE_ANGLES, REST, LIGHT,
    DICE_TYPES, MAX_DICE, ROLL_MS,
    dice: function () { return diceEls; },
  };
})();
