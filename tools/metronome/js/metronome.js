/**
 * The metronome.
 *
 * tempo.js says when the beats are; this makes the sound and shows the bar.
 * Each click is booked with the audio clock a fraction ahead of when it is
 * wanted, so the sound is exact even when the page is busy -- a beat that
 * arrives when the browser gets round to it is not a beat, it is a stumble.
 */
(function () {
  "use strict";

  const dotsEl = document.getElementById("dots");
  if (!dotsEl) return;
  const T = window.Tempo;

  const LOOK_AHEAD = 0.14;      // seconds of beats booked in advance
  const CHECK_EVERY = 25;       // milliseconds between looks

  const el = {
    dots: dotsEl,
    bpm: document.getElementById("bpm"),
    name: document.getElementById("speed-name"),
    slider: document.getElementById("slider"),
    status: document.getElementById("status"),
    start: document.getElementById("btn-start"),
    tap: document.getElementById("btn-tap"),
    down: document.getElementById("btn-down"),
    up: document.getElementById("btn-up"),
    bars: document.getElementById("bars"),
    speeds: document.getElementById("speeds"),
    accent: document.getElementById("accent"),
  };

  const KEY = "metronome";

  const state = {
    bpm: 100,
    beats: 4,
    accent: true,
    running: false,
    startAt: 0,
    lookedTo: 0,
    booked: [],        // beats booked but not yet heard, for the dots
    showing: -1,
    taps: [],
    timer: null,
  };

  let audio = null;

  /* ---------------- Remembering ---------------- */

  (function restore() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(KEY));
      if (saved) {
        state.bpm = T.clampBpm(saved.bpm);
        state.beats = Number(saved.beats) || 4;
        state.accent = saved.accent !== false;
      }
    } catch (err) { /* the defaults are fine */ }
  })();

  function remember() {
    try {
      window.localStorage.setItem(KEY, JSON.stringify({
        bpm: state.bpm, beats: state.beats, accent: state.accent,
      }));
    } catch (err) { /* it still keeps time */ }
  }

  function say(text) { el.status.textContent = text; }

  /* ---------------- Sound ---------------- */

  function wakeAudio() {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    if (!audio) audio = new Ctor();
    if (audio.state === "suspended") audio.resume();
    return audio;
  }

  /**
   * One click, booked for an exact moment on the audio clock. A short blip
   * rather than a beep: the ear places a click far more precisely than a tone,
   * which is the whole point of the thing.
   */
  function click(at, strong) {
    if (!audio) return;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(strong ? 1600 : 1000, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(strong ? 0.5 : 0.28, at + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + (strong ? 0.05 : 0.035));
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(at);
    osc.stop(at + 0.07);
  }

  /* ---------------- Keeping time ---------------- */

  /**
   * Look a little way ahead and book whatever falls in that stretch. The timer
   * only decides how often to look; the times themselves come from the beat
   * arithmetic, so a late look catches up rather than losing the beat.
   */
  function lookAhead() {
    if (!state.running) return;
    const now = audio ? audio.currentTime : 0;
    const until = now + LOOK_AHEAD;
    const due = T.beatsIn(state.lookedTo, until, state.startAt, state.bpm);
    due.forEach(function (beat) {
      const strong = state.accent && T.accentOf(beat.index, state.beats) === "strong";
      click(beat.time, strong);
      state.booked.push(beat);
    });
    state.lookedTo = until;
  }

  function start() {
    const ctx = wakeAudio();
    if (!ctx) { say("This browser will not make a sound, sorry."); return; }
    state.running = true;
    state.startAt = ctx.currentTime + 0.1;
    state.lookedTo = ctx.currentTime;
    state.booked = [];
    state.showing = -1;
    el.start.textContent = "⏹ Stop";
    el.start.setAttribute("aria-pressed", "true");
    state.timer = window.setInterval(lookAhead, CHECK_EVERY);
    lookAhead();
    say("Counting " + state.beats + " to the bar at " + state.bpm + " beats a minute.");
  }

  function stop() {
    state.running = false;
    if (state.timer) { window.clearInterval(state.timer); state.timer = null; }
    state.booked = [];
    state.showing = -1;
    el.start.textContent = "▶ Start";
    el.start.setAttribute("aria-pressed", "false");
    drawDots();
    say("Stopped.");
  }

  function restart() {
    if (!state.running) return;
    stop();
    start();
  }

  /* ---------------- Showing the beat ---------------- */

  function watch() {
    if (state.running && audio) {
      const now = audio.currentTime;
      while (state.booked.length && state.booked[0].time <= now) {
        state.showing = state.booked.shift().index;
        drawDots();
      }
    }
    window.requestAnimationFrame(watch);
  }

  function drawDots() {
    el.dots.innerHTML = "";
    for (let i = 0; i < state.beats; i++) {
      const dot = document.createElement("span");
      const lit = state.running && T.beatInBar(state.showing, state.beats) === i && state.showing >= 0;
      dot.className = "dot" + (i === 0 && state.accent ? " dot--strong" : "") + (lit ? " is-lit" : "");
      dot.textContent = String(i + 1);
      el.dots.appendChild(dot);
    }
    el.dots.setAttribute("aria-label", state.beats + " beats to the bar" +
      (state.running ? ", on beat " + (T.beatInBar(state.showing, state.beats) + 1) : ""));
  }

  /* ---------------- Speed ---------------- */

  function setBpm(bpm, why) {
    state.bpm = T.clampBpm(bpm);
    if (el.slider) el.slider.value = state.bpm;
    el.bpm.textContent = String(state.bpm);
    el.name.textContent = nameFor(state.bpm);
    remember();
    if (why) say(why);
    // Changing speed mid-count restarts the sum, so the beats stay exact.
    restart();
  }

  function nameFor(bpm) {
    let best = T.SPEEDS[0];
    T.SPEEDS.forEach(function (s) {
      if (Math.abs(s.bpm - bpm) < Math.abs(best.bpm - bpm)) best = s;
    });
    return best.label;
  }

  function tap() {
    const now = Date.now();
    state.taps = T.tapsStillGoing(state.taps, now).concat([now]);
    const bpm = T.tapTempo(state.taps);
    if (bpm) setBpm(bpm, "Tapped: " + bpm + " beats a minute.");
    else say("Keep tapping — a couple more and it will work out your speed.");
  }

  /* ---------------- Choosers ---------------- */

  function drawChoosers() {
    el.bars.innerHTML = "";
    T.BARS.forEach(function (bar) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip" + (String(state.beats) === bar.id ? " is-on" : "");
      button.textContent = bar.label;
      button.setAttribute("aria-pressed", String(String(state.beats) === bar.id));
      button.addEventListener("click", function () {
        state.beats = bar.beats;
        remember();
        drawChoosers();
        drawDots();
        restart();
        say(bar.label + ".");
      });
      el.bars.appendChild(button);
    });

    el.speeds.innerHTML = "";
    T.SPEEDS.forEach(function (speed) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip" + (state.bpm === speed.bpm ? " is-on" : "");
      button.textContent = speed.label + " (" + speed.bpm + ")";
      button.addEventListener("click", function () {
        setBpm(speed.bpm, speed.label + " — " + speed.bpm + " beats a minute.");
        drawChoosers();
      });
      el.speeds.appendChild(button);
    });
  }

  /* ---------------- Wiring ---------------- */

  el.start.addEventListener("click", function () {
    if (state.running) stop(); else start();
  });
  el.tap.addEventListener("click", tap);
  el.down.addEventListener("click", function () { setBpm(state.bpm - 1); drawChoosers(); });
  el.up.addEventListener("click", function () { setBpm(state.bpm + 1); drawChoosers(); });
  if (el.slider) {
    el.slider.min = T.MIN_BPM;
    el.slider.max = T.MAX_BPM;
    el.slider.addEventListener("input", function () {
      setBpm(Number(el.slider.value));
      drawChoosers();
    });
  }
  if (el.accent) {
    el.accent.checked = state.accent;
    el.accent.addEventListener("change", function () {
      state.accent = el.accent.checked;
      remember();
      drawDots();
      restart();
      say(state.accent ? "The first beat of each bar is louder."
                       : "Every beat the same.");
    });
  }

  window.addEventListener("keydown", function (event) {
    if (event.target && (event.target.tagName === "INPUT")) return;
    if (event.code === "Space") { event.preventDefault(); if (state.running) stop(); else start(); }
    if (event.key === "t" || event.key === "T") { event.preventDefault(); tap(); }
    if (event.key === "ArrowUp") { event.preventDefault(); setBpm(state.bpm + 1); drawChoosers(); }
    if (event.key === "ArrowDown") { event.preventDefault(); setBpm(state.bpm - 1); drawChoosers(); }
  });

  el.bpm.textContent = String(state.bpm);
  el.name.textContent = nameFor(state.bpm);
  if (el.slider) el.slider.value = state.bpm;
  drawChoosers();
  drawDots();
  say("Press Start, or tap the Tap button in time with something.");
  window.requestAnimationFrame(watch);

  window.MetronomeApp = {
    state: state, T: T, start: start, stop: stop, setBpm: setBpm, tap: tap,
    lookAhead: lookAhead, drawDots: drawDots, nameFor: nameFor,
  };
})();
