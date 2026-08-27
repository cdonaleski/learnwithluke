/**
 * Coin Flip — flip one coin, or run a batch to watch the odds settle.
 *
 * The batch runs are the point of putting this on a learning site: ten flips
 * can easily come out 8–2, but a few hundred always drift towards 50/50, and
 * seeing that happen is a better explanation of chance than being told.
 */
(function () {
  "use strict";

  const coin = document.getElementById("coin");
  if (!coin) return;

  const HISTORY_LIMIT = 50;
  const FLIP_MS = 1100;
  const HEADS = "heads";
  const TAILS = "tails";
  const STATS_KEY = "coin-flip-stats";

  const state = {
    heads: 0,
    tails: 0,
    history: [],        // newest first
    last: null,
    longestStreak: 0,
    streakSide: null,
    streakLength: 0,
    flipping: false,
  };

  let soundOn = true;
  let audioCtx = null;
  let flipTimer = null;
  let spinTurns = 0;

  const el = {
    coin: coin,
    result: document.getElementById("coin-result"),
    status: document.getElementById("coin-status"),
    heads: document.getElementById("stat-heads"),
    tails: document.getElementById("stat-tails"),
    total: document.getElementById("stat-total"),
    percent: document.getElementById("stat-percent"),
    streak: document.getElementById("stat-streak"),
    bar: document.getElementById("odds-bar-heads"),
    barLabel: document.getElementById("odds-bar-label"),
    history: document.getElementById("coin-history"),
    historyPanel: document.getElementById("history-panel"),
    flip: document.getElementById("btn-flip"),
    reset: document.getElementById("btn-reset"),
    sound: document.getElementById("btn-sound"),
    batchButtons: document.getElementById("batch-buttons"),
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
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (err) {
      /* Sound is optional. */
    }
  }

  /* ---------- Saved tally ---------- */
  function loadStats() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STATS_KEY) || "null");
      if (!parsed || typeof parsed !== "object") return;
      state.heads = Number(parsed.heads) || 0;
      state.tails = Number(parsed.tails) || 0;
      state.longestStreak = Number(parsed.longestStreak) || 0;
      state.history = Array.isArray(parsed.history)
        ? parsed.history.filter((s) => s === HEADS || s === TAILS).slice(0, HISTORY_LIMIT)
        : [];
      state.last = state.history.length ? state.history[0] : null;
    } catch (err) {
      /* A corrupt entry just means starting fresh. */
    }
  }

  function saveStats() {
    try {
      window.localStorage.setItem(STATS_KEY, JSON.stringify({
        heads: state.heads,
        tails: state.tails,
        longestStreak: state.longestStreak,
        history: state.history.slice(0, HISTORY_LIMIT),
      }));
    } catch (err) {
      /* Private browsing — the tally just won't persist. */
    }
  }

  /* ---------- The flip itself ---------- */
  /** One fair coin. Math.random() is uniform, so a straight halving is fair. */
  function tossOnce() {
    return Math.random() < 0.5 ? HEADS : TAILS;
  }

  /** Records an outcome and keeps the tally, history and streaks in step. */
  function record(side) {
    if (side === HEADS) state.heads += 1;
    else state.tails += 1;

    if (side === state.streakSide) {
      state.streakLength += 1;
    } else {
      state.streakSide = side;
      state.streakLength = 1;
    }
    if (state.streakLength > state.longestStreak) state.longestStreak = state.streakLength;

    state.last = side;
    state.history.unshift(side);
    if (state.history.length > HISTORY_LIMIT) state.history.length = HISTORY_LIMIT;
  }

  function total() {
    return state.heads + state.tails;
  }

  function headsPercent() {
    const n = total();
    return n === 0 ? 50 : (state.heads / n) * 100;
  }

  /* ---------- Single flip, with the animation ---------- */
  function flip() {
    if (state.flipping) return;
    state.flipping = true;
    el.flip.disabled = true;
    el.result.textContent = "…";
    el.result.className = "coin-result";
    setStatus("Flipping…");
    beep(520, 0.06, "sine");

    const side = tossOnce();

    // Spin several whole turns, then land face-up or face-down. Always turning
    // forwards keeps it from visibly rewinding between flips.
    spinTurns += 4 + Math.floor(Math.random() * 3);
    const landing = side === HEADS ? 0 : 180;
    el.coin.style.transform = "rotateY(" + (spinTurns * 360 + landing) + "deg)";

    flipTimer = window.setTimeout(() => {
      flipTimer = null;
      state.flipping = false;
      el.flip.disabled = false;
      record(side);
      saveStats();
      showResult(side);
      render();
    }, FLIP_MS);
  }

  function showResult(side) {
    const isHeads = side === HEADS;
    el.result.textContent = isHeads ? "Heads!" : "Tails!";
    el.result.className = "coin-result " + (isHeads ? "is-heads" : "is-tails");
    beep(isHeads ? 780 : 480, 0.14, "triangle");

    const run = state.streakLength;
    setStatus(
      run >= 4
        ? "That's " + run + " " + side + " in a row!"
        : "It came up " + side + "."
    );
  }

  /* ---------- Batch flips ---------- */
  function flipMany(count) {
    if (state.flipping) return;
    let heads = 0;
    for (let i = 0; i < count; i++) {
      const side = tossOnce();
      if (side === HEADS) heads += 1;
      record(side);
    }
    saveStats();

    // Show the last one on the coin so the face matches the tally.
    spinTurns += 4;
    el.coin.style.transform = "rotateY(" + (spinTurns * 360 + (state.last === HEADS ? 0 : 180)) + "deg)";
    el.result.textContent = state.last === HEADS ? "Heads!" : "Tails!";
    el.result.className = "coin-result " + (state.last === HEADS ? "is-heads" : "is-tails");
    beep(660, 0.12, "triangle");

    setStatus(
      count + " flips: " + heads + " heads and " + (count - heads) + " tails. " +
      "Overall you're on " + headsPercent().toFixed(1) + "% heads after " + total() + " flips."
    );
    render();
  }

  /* ---------- Rendering ---------- */
  function setStatus(text) {
    el.status.textContent = text;
  }

  function render() {
    el.heads.textContent = String(state.heads);
    el.tails.textContent = String(state.tails);
    el.total.textContent = String(total());
    el.percent.textContent = total() === 0 ? "—" : headsPercent().toFixed(1) + "%";
    el.streak.textContent = String(state.longestStreak);

    const percent = headsPercent();
    el.bar.style.width = percent + "%";
    el.barLabel.textContent = total() === 0
      ? "Flip a coin to start the tally"
      : Math.round(percent) + "% heads · " + Math.round(100 - percent) + "% tails";

    renderHistory();
  }

  function renderHistory() {
    el.historyPanel.hidden = state.history.length === 0;
    el.history.innerHTML = "";
    state.history.forEach((side) => {
      const chip = document.createElement("li");
      chip.className = "history-chip " + (side === HEADS ? "is-heads" : "is-tails");
      chip.textContent = side === HEADS ? "H" : "T";
      chip.setAttribute("title", side === HEADS ? "Heads" : "Tails");
      el.history.appendChild(chip);
    });
  }

  function resetStats() {
    if (flipTimer) {
      window.clearTimeout(flipTimer);
      flipTimer = null;
    }
    state.flipping = false;
    el.flip.disabled = false;
    state.heads = 0;
    state.tails = 0;
    state.history = [];
    state.last = null;
    state.longestStreak = 0;
    state.streakSide = null;
    state.streakLength = 0;
    saveStats();
    el.result.textContent = "Ready";
    el.result.className = "coin-result";
    setStatus("Tally cleared — flip away!");
    render();
  }

  /* ---------- Wiring ---------- */
  el.flip.addEventListener("click", flip);
  el.coin.addEventListener("click", flip);
  el.reset.addEventListener("click", resetStats);
  el.sound.addEventListener("click", () => {
    soundOn = !soundOn;
    el.sound.textContent = soundOn ? "🔊 Sound On" : "🔇 Sound Off";
    el.sound.setAttribute("aria-pressed", String(soundOn));
  });

  document.querySelectorAll("[data-batch]").forEach((button) => {
    button.addEventListener("click", () => flipMany(Number(button.dataset.batch)));
  });

  window.addEventListener("keydown", (event) => {
    if (event.code !== "Space" && event.code !== "Enter") return;
    const tag = event.target && event.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;
    event.preventDefault();
    flip();
  });

  loadStats();
  render();

  window.CoinFlipApp = { state, tossOnce, record, flipMany, headsPercent, total, resetStats, HISTORY_LIMIT };
})();
