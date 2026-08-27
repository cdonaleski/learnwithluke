/**
 * Timer — countdown and stopwatch.
 *
 * Time is always derived from a wall-clock reading, never accumulated frame
 * by frame. Adding up rAF deltas drifts, and browsers throttle timers in a
 * background tab, so a 20-minute timer built that way finishes late. Here the
 * countdown stores the moment it should END and the stopwatch stores the
 * moment it STARTED; every tick is a subtraction. Come back to a background
 * tab and the numbers are simply correct.
 */
(function () {
  "use strict";

  const display = document.getElementById("timer-display");
  if (!display) return;

  const PRESETS = [
    { label: "1 min", seconds: 60 },
    { label: "3 min", seconds: 180 },
    { label: "5 min", seconds: 300 },
    { label: "10 min", seconds: 600 },
    { label: "15 min", seconds: 900 },
    { label: "20 min", seconds: 1200 },
  ];

  const MAX_SECONDS = 99 * 60 + 59;   // the display is mm:ss
  const RING_LENGTH = 2 * Math.PI * 130;
  const DURATION_KEY = "timer-duration";
  const MODE_KEY = "timer-mode";

  const state = {
    mode: "countdown",     // countdown | stopwatch
    running: false,
    durationMs: 300000,    // countdown length
    endAt: 0,              // countdown: when it finishes
    remainingMs: 300000,   // countdown: what's left while paused
    startedAt: 0,          // stopwatch: when it started
    elapsedMs: 0,          // stopwatch: banked time while paused
    finished: false,
    laps: [],
  };

  let soundOn = true;
  let audioCtx = null;
  let alarmTimer = null;

  const el = {
    display: display,
    label: document.getElementById("timer-label"),
    status: document.getElementById("timer-status"),
    ring: document.getElementById("timer-ring"),
    start: document.getElementById("btn-start"),
    reset: document.getElementById("btn-reset"),
    lap: document.getElementById("btn-lap"),
    sound: document.getElementById("btn-sound"),
    presets: document.getElementById("preset-buttons"),
    presetGroup: document.getElementById("preset-group"),
    customGroup: document.getElementById("custom-group"),
    minutes: document.getElementById("custom-minutes"),
    seconds: document.getElementById("custom-seconds"),
    setCustom: document.getElementById("btn-set-custom"),
    laps: document.getElementById("lap-list"),
    lapPanel: document.getElementById("lap-panel"),
  };

  /** Wall clock. Kept in one place so the offline tests can drive it. */
  let clock = function () {
    return Date.now();
  };

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
      osc.type = type || "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.07, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (err) {
      /* Sound is a nice-to-have. */
    }
  }

  function stopAlarm() {
    if (!alarmTimer) return;
    window.clearInterval(alarmTimer);
    alarmTimer = null;
  }

  function startAlarm() {
    stopAlarm();
    let rings = 0;
    const chime = function () {
      [880, 1100].forEach((freq, i) => window.setTimeout(() => beep(freq, 0.25, "triangle"), i * 180));
      rings += 1;
      if (rings >= 6) stopAlarm();
    };
    chime();
    alarmTimer = window.setInterval(chime, 900);
  }

  /* ---------- Time maths ---------- */
  function clampSeconds(seconds) {
    return Math.max(1, Math.min(MAX_SECONDS, Math.round(seconds)));
  }

  function formatTime(ms) {
    const safe = Math.max(0, ms);
    // Round UP while counting down: a timer should read 0:01 until the second
    // is truly spent, then 0:00. Rounding down shows 0:00 for a whole second.
    const totalSeconds = state.mode === "countdown" ? Math.ceil(safe / 1000) : Math.floor(safe / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return mins + ":" + String(secs).padStart(2, "0");
  }

  function formatLap(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const hundredths = Math.floor((ms % 1000) / 10);
    return mins + ":" + String(secs).padStart(2, "0") + "." + String(hundredths).padStart(2, "0");
  }

  /** Milliseconds currently on the clock, derived fresh every call. */
  function currentMs() {
    if (state.mode === "countdown") {
      if (!state.running) return state.remainingMs;
      return Math.max(0, state.endAt - clock());
    }
    if (!state.running) return state.elapsedMs;
    return state.elapsedMs + (clock() - state.startedAt);
  }

  /* ---------- Controls ---------- */
  function start() {
    if (state.running) return;

    if (state.mode === "countdown") {
      if (state.finished || state.remainingMs <= 0) {
        state.remainingMs = state.durationMs;
        state.finished = false;
      }
      state.endAt = clock() + state.remainingMs;
    } else {
      state.startedAt = clock();
    }

    state.running = true;
    stopAlarm();
    setStatus(state.mode === "countdown" ? "Counting down…" : "Stopwatch running…");
    render();
  }

  function pause() {
    if (!state.running) return;
    // Bank the elapsed/remaining time before dropping the anchor.
    if (state.mode === "countdown") state.remainingMs = Math.max(0, state.endAt - clock());
    else state.elapsedMs += clock() - state.startedAt;
    state.running = false;
    setStatus("Paused.");
    render();
  }

  function toggle() {
    if (state.running) pause();
    else start();
  }

  function reset() {
    stopAlarm();
    state.running = false;
    state.finished = false;
    state.remainingMs = state.durationMs;
    state.elapsedMs = 0;
    state.startedAt = 0;
    state.endAt = 0;
    state.laps = [];
    setStatus(state.mode === "countdown" ? "Ready — press Start." : "Stopwatch ready.");
    render();
  }

  function setDuration(seconds) {
    const safe = clampSeconds(seconds);
    state.durationMs = safe * 1000;
    try {
      window.localStorage.setItem(DURATION_KEY, String(safe));
    } catch (err) { /* not important */ }
    reset();
    setStatus("Timer set to " + formatTime(state.durationMs) + ".");
  }

  function finish() {
    state.running = false;
    state.finished = true;
    state.remainingMs = 0;
    startAlarm();
    setStatus("⏰ Time's up!");
    render();
  }

  function addLap() {
    if (state.mode !== "stopwatch" || !state.running) return;
    const total = currentMs();
    const previous = state.laps.length ? state.laps[state.laps.length - 1].total : 0;
    state.laps.push({ total, split: total - previous });
    beep(700, 0.06, "square");
    renderLaps();
  }

  /* ---------- Tick ---------- */
  function tick() {
    if (state.mode === "countdown" && state.running && clock() >= state.endAt) {
      finish();
      return;
    }
    render();
  }

  /* ---------- Rendering ---------- */
  function setStatus(text) {
    el.status.textContent = text;
  }

  function render() {
    const ms = currentMs();
    el.display.textContent = formatTime(ms);
    el.display.classList.toggle("is-finished", state.finished);
    el.display.classList.toggle("is-running", state.running);

    if (state.mode === "countdown") {
      const fraction = state.durationMs > 0 ? Math.max(0, Math.min(1, ms / state.durationMs)) : 0;
      el.ring.style.strokeDasharray = RING_LENGTH;
      el.ring.style.strokeDashoffset = String(RING_LENGTH * (1 - fraction));
      el.ring.classList.toggle("is-low", ms <= 10000 && ms > 0 && state.running);
    } else {
      // A stopwatch has no end, so sweep the ring once a minute.
      const fraction = (ms % 60000) / 60000;
      el.ring.style.strokeDasharray = RING_LENGTH;
      el.ring.style.strokeDashoffset = String(RING_LENGTH * (1 - fraction));
      el.ring.classList.remove("is-low");
    }

    el.start.textContent = state.running ? "⏸ Pause" : state.finished ? "▶ Start Again" : "▶ Start";
    el.label.textContent = state.mode === "countdown" ? "Countdown" : "Stopwatch";
    el.lap.hidden = state.mode !== "stopwatch";
    el.lap.disabled = !state.running;
    el.presetGroup.hidden = state.mode !== "countdown";
    el.customGroup.hidden = state.mode !== "countdown";
    el.lapPanel.hidden = state.mode !== "stopwatch" || state.laps.length === 0;
  }

  function renderLaps() {
    el.laps.innerHTML = "";
    state.laps.slice().reverse().forEach((lap, i) => {
      const index = state.laps.length - i;
      const item = document.createElement("li");
      item.className = "lap-row";

      const name = document.createElement("span");
      name.className = "lap-name";
      name.textContent = "Lap " + index;

      const split = document.createElement("span");
      split.className = "lap-split";
      split.textContent = formatLap(lap.split);

      const total = document.createElement("span");
      total.className = "lap-total";
      total.textContent = formatLap(lap.total);

      item.appendChild(name);
      item.appendChild(split);
      item.appendChild(total);
      el.laps.appendChild(item);
    });
    render();
  }

  function renderPresets() {
    el.presets.innerHTML = "";
    PRESETS.forEach((preset) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option-btn" + (state.durationMs === preset.seconds * 1000 ? " is-active" : "");
      button.textContent = preset.label;
      button.setAttribute("aria-pressed", String(state.durationMs === preset.seconds * 1000));
      button.addEventListener("click", () => {
        setDuration(preset.seconds);
        renderPresets();
      });
      el.presets.appendChild(button);
    });
  }

  /* ---------- Wiring ---------- */
  el.start.addEventListener("click", toggle);
  el.reset.addEventListener("click", () => {
    reset();
    setStatus(state.mode === "countdown" ? "Reset — press Start." : "Stopwatch reset.");
  });
  el.lap.addEventListener("click", addLap);
  el.sound.addEventListener("click", () => {
    soundOn = !soundOn;
    if (!soundOn) stopAlarm();
    el.sound.textContent = soundOn ? "🔊 Sound On" : "🔇 Sound Off";
    el.sound.setAttribute("aria-pressed", String(soundOn));
  });

  el.setCustom.addEventListener("click", () => {
    const mins = Number(el.minutes.value) || 0;
    const secs = Number(el.seconds.value) || 0;
    const total = mins * 60 + secs;
    if (total <= 0) {
      setStatus("Pick a time longer than zero!");
      return;
    }
    setDuration(total);
    renderPresets();
  });

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.mode === button.dataset.mode) return;
      state.mode = button.dataset.mode;
      try {
        window.localStorage.setItem(MODE_KEY, state.mode);
      } catch (err) { /* not important */ }
      document.querySelectorAll("[data-mode]").forEach((other) => {
        const active = other === button;
        other.classList.toggle("is-active", active);
        other.setAttribute("aria-pressed", String(active));
      });
      reset();
    });
  });

  window.addEventListener("keydown", (event) => {
    const tag = event.target && event.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (event.code === "Space") {
      event.preventDefault();
      toggle();
    } else if (event.code === "KeyR") {
      event.preventDefault();
      reset();
    } else if (event.code === "KeyL") {
      event.preventDefault();
      addLap();
    }
  });

  /* ---------- Boot ---------- */
  try {
    const savedDuration = Number(window.localStorage.getItem(DURATION_KEY));
    if (savedDuration > 0) state.durationMs = clampSeconds(savedDuration) * 1000;
    const savedMode = window.localStorage.getItem(MODE_KEY);
    if (savedMode === "countdown" || savedMode === "stopwatch") state.mode = savedMode;
  } catch (err) {
    /* Defaults are fine. */
  }

  document.querySelectorAll("[data-mode]").forEach((button) => {
    const active = button.dataset.mode === state.mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  state.remainingMs = state.durationMs;
  renderPresets();
  reset();

  window.setInterval(tick, 100);

  window.TimerApp = {
    state, start, pause, reset, toggle, tick, addLap, setDuration, currentMs,
    formatTime, formatLap, clampSeconds, PRESETS,
    setClock: function (fn) { clock = fn; },
  };
})();
