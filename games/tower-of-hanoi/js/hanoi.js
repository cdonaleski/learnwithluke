/**
 * Tower of Hanoi — move the whole tower, one disc at a time, never putting a
 * bigger disc on a smaller one.
 *
 * The lovely thing about this puzzle is that the best possible answer is known
 * exactly: 2^n - 1 moves for n discs. So the game can tell a child not just
 * that they finished, but how close to perfect they were - and the offline
 * tests can check the built-in solver really is optimal rather than merely
 * correct.
 */
(function () {
  "use strict";

  const boardEl = document.getElementById("hanoi-board");
  if (!boardEl) return;

  const MIN_DISCS = 3;
  const MAX_DISCS = 8;
  const DISCS_KEY = "hanoi-discs";
  const PEG_NAMES = ["Left", "Middle", "Right"];

  const state = {
    discs: 3,
    pegs: [[], [], []],   // each peg holds disc sizes, largest first
    held: null,           // index of the peg a disc has been lifted from
    moves: 0,
    solved: false,
    elapsed: 0,
    startedAt: 0,
    demo: null,           // queued moves while the solver is demonstrating
  };

  let soundOn = true;
  let audioCtx = null;
  let tickTimer = null;
  let demoTimer = null;

  const el = {
    board: boardEl,
    status: document.getElementById("hanoi-status"),
    moves: document.getElementById("hanoi-moves"),
    best: document.getElementById("hanoi-best"),
    optimal: document.getElementById("hanoi-optimal"),
    time: document.getElementById("hanoi-time"),
    restart: document.getElementById("btn-restart"),
    undoBtn: document.getElementById("btn-undo"),
    demoBtn: document.getElementById("btn-demo"),
    sound: document.getElementById("btn-sound"),
    discButtons: document.getElementById("disc-buttons"),
  };

  const history = [];

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
    } catch (err) { /* optional */ }
  }

  function fanfare() {
    [523, 659, 784, 1047].forEach((f, i) => window.setTimeout(() => beep(f, 0.18, "triangle"), i * 130));
  }

  /* ---------- Rules ---------- */
  function optimalMoves(discs) {
    return Math.pow(2, discs) - 1;
  }

  function topOf(peg) {
    return peg.length ? peg[peg.length - 1] : null;
  }

  /** A disc may only land on an empty peg or on a strictly larger disc. */
  function canMove(pegs, from, to) {
    if (from === to) return false;
    if (from < 0 || from > 2 || to < 0 || to > 2) return false;
    const disc = topOf(pegs[from]);
    if (disc === null) return false;
    const target = topOf(pegs[to]);
    return target === null || disc < target;
  }

  function applyMove(pegs, from, to) {
    if (!canMove(pegs, from, to)) return false;
    pegs[to].push(pegs[from].pop());
    return true;
  }

  /** The classic recursive answer, which is provably the shortest. */
  function solveMoves(count, from, to, via, out) {
    if (count <= 0) return out;
    solveMoves(count - 1, from, via, to, out);
    out.push([from, to]);
    solveMoves(count - 1, via, to, from, out);
    return out;
  }

  function isSolved(pegs, discs) {
    return pegs[2].length === discs;
  }

  /* ---------- Timer ---------- */
  function startTimer() {
    if (tickTimer) return;
    state.startedAt = Date.now() - state.elapsed;
    tickTimer = window.setInterval(() => {
      state.elapsed = Date.now() - state.startedAt;
      renderStats();
    }, 250);
  }

  function stopTimer() {
    if (!tickTimer) return;
    window.clearInterval(tickTimer);
    tickTimer = null;
  }

  function formatTime(ms) {
    const total = Math.floor(ms / 1000);
    return Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
  }

  /* ---------- Game ---------- */
  function newGame() {
    stopTimer();
    stopDemo();
    state.pegs = [[], [], []];
    for (let size = state.discs; size >= 1; size--) state.pegs[0].push(size);
    state.held = null;
    state.moves = 0;
    state.solved = false;
    state.elapsed = 0;
    history.length = 0;
    render();
    setStatus("Move the whole tower to the right-hand peg. Never put a big disc on a small one!");
  }

  function pickOrDrop(pegIndex) {
    if (state.solved || state.demo) return;

    if (state.held === null) {
      if (!state.pegs[pegIndex].length) {
        setStatus("That peg is empty — pick a disc from another one.");
        return;
      }
      state.held = pegIndex;
      beep(520, 0.04, "sine");
      render();
      return;
    }

    if (state.held === pegIndex) {   // tapping the same peg puts it back down
      state.held = null;
      render();
      return;
    }

    if (!canMove(state.pegs, state.held, pegIndex)) {
      beep(180, 0.12, "square");
      setStatus("You can't put a bigger disc on a smaller one!");
      state.held = null;
      render();
      return;
    }

    history.push([state.held, pegIndex]);
    applyMove(state.pegs, state.held, pegIndex);
    state.held = null;
    state.moves += 1;
    if (!tickTimer) startTimer();
    beep(440 + state.moves * 3, 0.05, "sine");

    if (isSolved(state.pegs, state.discs)) finish();
    render();
  }

  function undo() {
    if (state.solved || state.demo || !history.length) return;
    const [from, to] = history.pop();
    applyMove(state.pegs, to, from);
    state.moves = Math.max(0, state.moves - 1);
    state.held = null;
    beep(300, 0.05, "sine");
    render();
    setStatus("Took that one back.");
  }

  function finish() {
    state.solved = true;
    stopTimer();
    const best = optimalMoves(state.discs);
    fanfare();
    if (board) board.offer(state.moves, String(state.discs));
    setStatus(state.moves === best
      ? "🏆 Perfect! " + state.moves + " moves is the best anyone can do with " + state.discs + " discs."
      : "🎉 Solved in " + state.moves + " moves. The very best possible is " + best + ".");
  }

  /* ---------- Watch it solve itself ---------- */
  function startDemo() {
    if (state.demo) { stopDemo(); return; }
    newGame();
    state.demo = solveMoves(state.discs, 0, 2, 1, []);
    setStatus("Watch closely — this is the shortest way to do it.");
    render();
    demoTimer = window.setInterval(() => {
      if (!state.demo || !state.demo.length) {
        stopDemo();
        setStatus("That took " + state.moves + " moves — the fewest possible. Now try it yourself!");
        return;
      }
      const [from, to] = state.demo.shift();
      applyMove(state.pegs, from, to);
      state.moves += 1;
      beep(440 + state.moves * 3, 0.04, "sine");
      render();
    }, 420);
  }

  function stopDemo() {
    state.demo = null;
    if (demoTimer) { window.clearInterval(demoTimer); demoTimer = null; }
    if (el.demoBtn) el.demoBtn.textContent = "👀 Show Me";
    render();
  }

  /* ---------- Rendering ---------- */
  function render() {
    el.board.innerHTML = "";
    const row = document.createElement("div");
    row.className = "hanoi-pegs";

    state.pegs.forEach((peg, index) => {
      const column = document.createElement("button");
      column.type = "button";
      column.className = "hanoi-peg" + (state.held === index ? " is-holding" : "") +
        (index === 2 ? " is-target" : "");
      column.setAttribute("aria-label", PEG_NAMES[index] + " peg, " +
        (peg.length ? peg.length + " disc" + (peg.length === 1 ? "" : "s") + ", top disc size " + topOf(peg)
                    : "empty"));
      column.disabled = state.solved || Boolean(state.demo);
      column.addEventListener("click", () => pickOrDrop(index));

      const stack = document.createElement("span");
      stack.className = "hanoi-stack";
      // Drawn bottom-up, so the array order matches what you see.
      peg.forEach((size) => {
        const disc = document.createElement("span");
        disc.className = "hanoi-disc";
        disc.style.width = (28 + (size / state.discs) * 72) + "%";
        disc.style.background = "hsl(" + Math.round((size / state.discs) * 300) + ", 70%, 58%)";
        disc.textContent = String(size);
        stack.appendChild(disc);
      });

      const post = document.createElement("span");
      post.className = "hanoi-post";
      post.setAttribute("aria-hidden", "true");

      const base = document.createElement("span");
      base.className = "hanoi-base";
      base.setAttribute("aria-hidden", "true");

      const label = document.createElement("span");
      label.className = "hanoi-peg-label";
      label.textContent = PEG_NAMES[index] + (index === 2 ? " 🎯" : "");

      column.appendChild(post);
      column.appendChild(stack);
      column.appendChild(base);
      column.appendChild(label);
      row.appendChild(column);
    });

    el.board.appendChild(row);
    renderStats();
    el.undoBtn.disabled = state.solved || Boolean(state.demo) || !history.length;
  }

  function renderStats() {
    el.moves.textContent = String(state.moves);
    el.optimal.textContent = String(optimalMoves(state.discs));
    el.time.textContent = formatTime(state.elapsed);
    const stored = board ? board.entries(String(state.discs)) : [];
    el.best.textContent = stored.length ? String(stored[0].value) : "—";
  }

  function setStatus(text) { el.status.textContent = text; }

  function renderDiscButtons() {
    el.discButtons.innerHTML = "";
    for (let n = MIN_DISCS; n <= MAX_DISCS; n++) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option-btn" + (n === state.discs ? " is-active" : "");
      button.textContent = String(n);
      button.setAttribute("aria-pressed", String(n === state.discs));
      button.setAttribute("aria-label", n + " discs");
      button.addEventListener("click", () => {
        state.discs = n;
        try { window.localStorage.setItem(DISCS_KEY, String(n)); } catch (err) { /* ok */ }
        if (board) board.setCategory(String(n));
        renderDiscButtons();
        newGame();
      });
      el.discButtons.appendChild(button);
    }
  }

  /* ---------- Leaderboard ---------- */
  const board = window.Leaderboard ? window.Leaderboard.create({
    gameId: "tower-of-hanoi",
    gameName: "Tower of Hanoi",
    metric: { label: "Moves", better: "lower", format: "number" },
    categories: [3, 4, 5, 6, 7, 8].map((n) => ({ id: String(n), label: n + " discs" })),
  }) : null;
  if (board) board.mount(document.getElementById("leaderboard-panel"));

  /* ---------- Wiring ---------- */
  el.restart.addEventListener("click", () => newGame());
  el.undoBtn.addEventListener("click", undo);
  el.demoBtn.addEventListener("click", () => {
    if (state.demo) { stopDemo(); setStatus("Stopped. Your turn!"); return; }
    el.demoBtn.textContent = "⏹ Stop";
    startDemo();
  });
  el.sound.addEventListener("click", () => {
    soundOn = !soundOn;
    el.sound.textContent = soundOn ? "🔊 Sound On" : "🔇 Sound Off";
    el.sound.setAttribute("aria-pressed", String(soundOn));
  });

  window.addEventListener("keydown", (event) => {
    const digit = /^Digit([123])$/.exec(event.code);
    if (digit) { event.preventDefault(); pickOrDrop(Number(digit[1]) - 1); return; }
    if (event.code === "KeyU") { event.preventDefault(); undo(); }
  });

  try {
    const saved = Number(window.localStorage.getItem(DISCS_KEY));
    if (saved >= MIN_DISCS && saved <= MAX_DISCS) state.discs = saved;
  } catch (err) { /* defaults fine */ }

  if (board) board.setCategory(String(state.discs));
  renderDiscButtons();
  newGame();

  window.HanoiGame = {
    state, canMove, applyMove, solveMoves, optimalMoves, isSolved, topOf,
    pickOrDrop, undo, newGame, MIN_DISCS, MAX_DISCS,
  };
})();
