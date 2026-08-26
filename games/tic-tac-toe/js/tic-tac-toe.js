/**
 * Tic Tac Toe — one player against the computer, or two players sharing a device.
 */
(function () {
  "use strict";

  const board = document.getElementById("ttt-board");
  if (!board) return;

  const LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],   // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8],   // columns
    [0, 4, 8], [2, 4, 6],              // diagonals
  ];

  const CELL_NAMES = [
    "top left", "top middle", "top right",
    "middle left", "centre", "middle right",
    "bottom left", "bottom middle", "bottom right",
  ];

  const MARKS = { X: "✖️", O: "⭕" };
  const CPU_DELAY = 450;

  const state = {
    mode: "cpu", // cpu | two
    difficulty: "easy",
    cells: new Array(9).fill(null),
    turn: "X",
    starter: "X",
    human: "X",
    phase: "playing", // playing | over
    winningLine: null,
    scores: { X: 0, O: 0, draw: 0 },
    thinking: false,
  };

  let soundOn = true;
  let audioCtx = null;
  let cpuTimer = null;

  const el = {
    status: document.getElementById("ttt-status"),
    scoreX: document.getElementById("score-x"),
    scoreO: document.getElementById("score-o"),
    scoreDraw: document.getElementById("score-draw"),
    nameX: document.getElementById("name-x"),
    nameO: document.getElementById("name-o"),
    restart: document.getElementById("btn-restart"),
    reset: document.getElementById("btn-reset-scores"),
    sound: document.getElementById("btn-sound"),
    difficultyGroup: document.getElementById("difficulty-group"),
  };

  const cellButtons = [];

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
      gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (err) {
      /* Sound is optional. */
    }
  }

  function playFanfare() {
    [523, 659, 784, 1047].forEach((freq, i) => {
      window.setTimeout(() => beep(freq, 0.18, "triangle"), i * 130);
    });
  }

  /* ---------- Rules ---------- */
  function winnerOf(cells) {
    for (const line of LINES) {
      const [a, b, c] = line;
      if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) {
        return { winner: cells[a], line };
      }
    }
    return { winner: null, line: null };
  }

  function isFull(cells) {
    return cells.every(Boolean);
  }

  function other(mark) {
    return mark === "X" ? "O" : "X";
  }

  function emptyIndexes(cells) {
    const out = [];
    for (let i = 0; i < 9; i++) if (!cells[i]) out.push(i);
    return out;
  }

  /* ---------- Computer ---------- */
  /** Exhaustive search. Prefers faster wins and slower losses via depth. */
  function minimax(cells, current, aiMark, depth) {
    const { winner } = winnerOf(cells);
    if (winner === aiMark) return 10 - depth;
    if (winner) return depth - 10;
    if (isFull(cells)) return 0;

    const moves = emptyIndexes(cells);
    let best = current === aiMark ? -Infinity : Infinity;
    for (const i of moves) {
      cells[i] = current;
      const score = minimax(cells, other(current), aiMark, depth + 1);
      cells[i] = null;
      best = current === aiMark ? Math.max(best, score) : Math.min(best, score);
    }
    return best;
  }

  function perfectMove(cells, aiMark) {
    let best = -Infinity;
    let choice = null;
    for (const i of emptyIndexes(cells)) {
      cells[i] = aiMark;
      const score = minimax(cells, other(aiMark), aiMark, 0);
      cells[i] = null;
      if (score > best) {
        best = score;
        choice = i;
      }
    }
    return choice;
  }

  /** A line the given mark can complete right now, if there is one. */
  function completingMove(cells, mark) {
    for (const i of emptyIndexes(cells)) {
      cells[i] = mark;
      const done = winnerOf(cells).winner === mark;
      cells[i] = null;
      if (done) return i;
    }
    return null;
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function sensibleMove(cells, aiMark) {
    const win = completingMove(cells, aiMark);
    if (win !== null) return win;
    const block = completingMove(cells, other(aiMark));
    if (block !== null) return block;
    if (!cells[4]) return 4;
    const corners = [0, 2, 6, 8].filter((i) => !cells[i]);
    if (corners.length) return pick(corners);
    return pick(emptyIndexes(cells));
  }

  function chooseMove(cells, aiMark) {
    const free = emptyIndexes(cells);
    if (!free.length) return null;

    if (state.difficulty === "hard") return perfectMove(cells, aiMark);
    if (state.difficulty === "medium") {
      // Mostly sharp, occasionally careless — beatable without feeling broken.
      return Math.random() < 0.75 ? sensibleMove(cells, aiMark) : pick(free);
    }
    // Easy: takes an obvious win, but never bothers to block.
    const win = completingMove(cells, aiMark);
    if (win !== null && Math.random() < 0.5) return win;
    return pick(free);
  }

  /* ---------- Flow ---------- */
  function cpuMark() {
    return other(state.human);
  }

  function isCpuTurn() {
    return state.mode === "cpu" && state.phase === "playing" && state.turn === cpuMark();
  }

  function playerLabel(mark) {
    if (state.mode === "two") return mark === "X" ? "Player 1" : "Player 2";
    return mark === state.human ? "You" : "Computer";
  }

  function placeMark(index) {
    if (state.phase !== "playing") return;
    if (state.cells[index]) return;

    state.cells[index] = state.turn;
    beep(state.turn === "X" ? 620 : 480, 0.07, "square");

    const { winner, line } = winnerOf(state.cells);
    if (winner) {
      state.phase = "over";
      state.winningLine = line;
      state.scores[winner] += 1;
      playFanfare();
      setStatus(
        state.mode === "cpu" && winner !== state.human
          ? "The computer wins this one! " + MARKS[winner] + " Try again?"
          : "🎉 " + playerLabel(winner) + " wins with " + MARKS[winner] + "!"
      );
    } else if (isFull(state.cells)) {
      state.phase = "over";
      state.scores.draw += 1;
      setStatus("😄 It's a draw! Nobody wins this round.");
    } else {
      state.turn = other(state.turn);
      setStatus(turnPrompt());
    }

    render();
    if (isCpuTurn()) scheduleCpu();
  }

  function turnPrompt() {
    if (state.mode === "cpu" && state.turn !== state.human) return "Computer is thinking…";
    return playerLabel(state.turn) + "'s turn — place " + MARKS[state.turn];
  }

  function scheduleCpu() {
    if (cpuTimer) window.clearTimeout(cpuTimer);
    state.thinking = true;
    render();
    cpuTimer = window.setTimeout(() => {
      state.thinking = false;
      cpuTimer = null;
      if (!isCpuTurn()) {
        render();
        return;
      }
      const move = chooseMove(state.cells.slice(), cpuMark());
      if (move === null) return;
      placeMark(move);
    }, CPU_DELAY);
  }

  function newRound(keepStarter) {
    if (cpuTimer) {
      window.clearTimeout(cpuTimer);
      cpuTimer = null;
    }
    state.thinking = false;
    state.cells = new Array(9).fill(null);
    state.winningLine = null;
    state.phase = "playing";
    // Alternate who opens, so nobody has the first-move advantage every round.
    if (!keepStarter) state.starter = other(state.starter);
    state.turn = state.starter;
    setStatus(turnPrompt());
    render();
    if (isCpuTurn()) scheduleCpu();
  }

  /* ---------- Rendering ---------- */
  function buildBoard() {
    board.innerHTML = "";
    for (let i = 0; i < 9; i++) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ttt-cell";
      button.dataset.index = String(i);
      button.setAttribute("role", "gridcell");
      button.addEventListener("click", () => placeMark(i));
      board.appendChild(button);
      cellButtons.push(button);
    }
  }

  function render() {
    cellButtons.forEach((button, i) => {
      const mark = state.cells[i];
      button.textContent = mark ? MARKS[mark] : "";
      button.classList.toggle("is-x", mark === "X");
      button.classList.toggle("is-o", mark === "O");
      button.classList.toggle("is-win", Boolean(state.winningLine && state.winningLine.includes(i)));
      button.disabled = Boolean(mark) || state.phase === "over" || state.thinking;
      button.setAttribute(
        "aria-label",
        CELL_NAMES[i] + (mark ? ", " + (mark === "X" ? "X" : "O") : ", empty")
      );
    });

    el.scoreX.textContent = String(state.scores.X);
    el.scoreO.textContent = String(state.scores.O);
    el.scoreDraw.textContent = String(state.scores.draw);
    el.nameX.textContent = playerLabel("X");
    el.nameO.textContent = playerLabel("O");
    el.difficultyGroup.hidden = state.mode !== "cpu";
  }

  function setStatus(text) {
    el.status.textContent = text;
  }

  /* ---------- Controls ---------- */
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.mode === button.dataset.mode) return;
      state.mode = button.dataset.mode;
      document.querySelectorAll("[data-mode]").forEach((other2) => {
        const active = other2 === button;
        other2.classList.toggle("is-active", active);
        other2.setAttribute("aria-pressed", String(active));
      });
      state.scores = { X: 0, O: 0, draw: 0 };
      state.starter = "X";
      newRound(true);
    });
  });

  document.querySelectorAll("[data-difficulty]").forEach((button) => {
    button.addEventListener("click", () => {
      state.difficulty = button.dataset.difficulty;
      document.querySelectorAll("[data-difficulty]").forEach((other2) => {
        const active = other2 === button;
        other2.classList.toggle("is-active", active);
        other2.setAttribute("aria-pressed", String(active));
      });
      state.starter = "X";
      newRound(true);
    });
  });

  el.restart.addEventListener("click", () => newRound(false));
  el.reset.addEventListener("click", () => {
    state.scores = { X: 0, O: 0, draw: 0 };
    state.starter = "X";
    newRound(true);
  });
  el.sound.addEventListener("click", () => {
    soundOn = !soundOn;
    el.sound.textContent = soundOn ? "🔊 Sound On" : "🔇 Sound Off";
    el.sound.setAttribute("aria-pressed", String(soundOn));
  });

  buildBoard();
  newRound(true);

  // Exposed purely so the offline tests can drive the rules engine.
  window.TicTacToeRules = { winnerOf, isFull, other, emptyIndexes, perfectMove, chooseMove, LINES };
})();
