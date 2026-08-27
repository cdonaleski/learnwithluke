/**
 * Dice Roller — roll any number of dice, of several kinds.
 *
 * Rolls come from Math.random(), scaled with Math.floor so every face is
 * equally likely. Keeping a tally of how often each face turns up is the point
 * of putting it on a learning site: roll two dice a few hundred times and 7
 * appears about six times as often as 2, which is a far better explanation of
 * why than being told.
 */
(function () {
  "use strict";

  const trayEl = document.getElementById("dice-tray");
  if (!trayEl) return;

  const DICE_TYPES = [
    { id: "d6", label: "🎲 D6", sides: 6 },
    { id: "d4", label: "▲ D4", sides: 4 },
    { id: "d8", label: "🔷 D8", sides: 8 },
    { id: "d10", label: "🔟 D10", sides: 10 },
    { id: "d12", label: "🎯 D12", sides: 12 },
    { id: "d20", label: "⭐ D20", sides: 20 },
  ];

  const PIPS = {
    1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
  };

  const MAX_DICE = 6;
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

  let soundOn = true;
  let audioCtx = null;
  let rollTimer = null;

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

  function roll() {
    if (state.rolling) return;
    state.rolling = true;
    el.roll.disabled = true;
    beep(300, 0.05, "square");

    const sides = diceType().sides;
    let shuffles = 0;
    // A short tumble before settling, so it feels like a roll.
    rollTimer = window.setInterval(() => {
      shuffles += 1;
      state.rolls = rollAll(state.count, sides);
      renderTray();
      if (shuffles < 6) return;

      window.clearInterval(rollTimer);
      rollTimer = null;
      state.rolling = false;
      el.roll.disabled = false;
      record(state.rolls);
      beep(620, 0.09, "triangle");
      renderAll();
      setStatus(describeRoll());
    }, 70);
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
  function pipFace(value) {
    const face = document.createElement("span");
    face.className = "die die--pips";
    for (let i = 0; i < 9; i++) {
      const pip = document.createElement("span");
      pip.className = "pip" + (PIPS[value] && PIPS[value].indexOf(i) !== -1 ? " is-on" : "");
      face.appendChild(pip);
    }
    face.setAttribute("aria-label", String(value));
    return face;
  }

  function numberFace(value) {
    const face = document.createElement("span");
    face.className = "die die--number";
    face.textContent = String(value);
    face.setAttribute("aria-label", String(value));
    return face;
  }

  function renderTray() {
    el.tray.innerHTML = "";
    const usePips = diceType().sides === 6;
    state.rolls.forEach((value) => {
      const die = usePips ? pipFace(value) : numberFace(value);
      if (state.rolling) die.classList.add("is-tumbling");
      el.tray.appendChild(die);
    });
    el.total.textContent = state.rolls.length ? String(total(state.rolls)) : "—";
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
        renderAll();
        setStatus("Switched to " + type.label.replace(/^\S+\s/, "") + " — tally cleared.");
      });
      el.typeButtons.appendChild(button);
    });
  }

  function renderAll() {
    renderTray();
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
  renderAll();

  window.DiceApp = { state, rollDie, rollAll, total, record, averageTotal, resetTally, DICE_TYPES, MAX_DICE };
})();
