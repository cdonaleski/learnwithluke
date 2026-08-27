/**
 * Rock Paper Scissors — with an optional Lizard/Spock mode.
 *
 * The "Sharp" computer is the interesting part. People are bad at being
 * random: they repeat, they avoid repeating, they cycle. It counts what you
 * played after each of your own previous moves and plays the counter to
 * whatever you most often follow with. Against genuinely random play it
 * degrades to a coin toss, which is the honest ceiling.
 */
(function () {
  "use strict";

  const choicesEl = document.getElementById("rps-choices");
  if (!choicesEl) return;

  /** Each move lists what it beats, so both rule sets share one engine. */
  const MOVES = {
    classic: {
      rock: { icon: "✊", label: "Rock", beats: { scissors: "crushes" } },
      paper: { icon: "✋", label: "Paper", beats: { rock: "covers" } },
      scissors: { icon: "✌️", label: "Scissors", beats: { paper: "cuts" } },
    },
    spock: {
      rock: { icon: "✊", label: "Rock", beats: { scissors: "crushes", lizard: "crushes" } },
      paper: { icon: "✋", label: "Paper", beats: { rock: "covers", spock: "disproves" } },
      scissors: { icon: "✌️", label: "Scissors", beats: { paper: "cuts", lizard: "decapitates" } },
      lizard: { icon: "🦎", label: "Lizard", beats: { paper: "eats", spock: "poisons" } },
      spock: { icon: "🖖", label: "Spock", beats: { scissors: "smashes", rock: "vaporises" } },
    },
  };

  const TARGETS = [3, 5, 10];
  const RULES_KEY = "rps-rules";

  const state = {
    rules: "classic",
    skill: "fair",        // fair | sharp
    target: 5,
    you: 0,
    cpu: 0,
    draws: 0,
    round: 0,
    history: [],          // your moves, oldest first
    followUps: {},        // "after X you played Y" tallies
    lastYou: null,
    phase: "playing",     // playing | over
    busy: false,
  };

  let soundOn = true;
  let audioCtx = null;
  let revealTimer = null;

  const el = {
    choices: choicesEl,
    youPick: document.getElementById("rps-you-pick"),
    cpuPick: document.getElementById("rps-cpu-pick"),
    verdict: document.getElementById("rps-verdict"),
    status: document.getElementById("rps-status"),
    scoreYou: document.getElementById("rps-score-you"),
    scoreCpu: document.getElementById("rps-score-cpu"),
    scoreDraws: document.getElementById("rps-score-draws"),
    round: document.getElementById("rps-round"),
    restart: document.getElementById("btn-restart"),
    sound: document.getElementById("btn-sound"),
    targetButtons: document.getElementById("target-buttons"),
  };

  function table() {
    return MOVES[state.rules];
  }

  function moveNames() {
    return Object.keys(table());
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
  /** -1 you lose, 0 draw, 1 you win. */
  function judge(you, cpu) {
    if (you === cpu) return 0;
    if (table()[you].beats[cpu]) return 1;
    return -1;
  }

  function verb(winner, loser) {
    return table()[winner].beats[loser] || "beats";
  }

  /** Every move that beats the given one. */
  function countersTo(move) {
    return moveNames().filter((m) => Boolean(table()[m].beats[move]));
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  /* ---------- The computer ---------- */
  function cpuMove() {
    const names = moveNames();
    if (state.skill === "fair" || state.history.length < 3 || !state.lastYou) {
      return pick(names);
    }

    // What has this player usually done after the move they just made?
    const tally = state.followUps[state.lastYou];
    if (!tally) return pick(names);

    let best = null;
    let bestCount = 0;
    for (const move of names) {
      const count = tally[move] || 0;
      if (count > bestCount) { bestCount = count; best = move; }
    }
    if (!best || bestCount < 2) return pick(names);

    // Play something that beats their likely next move.
    const counters = countersTo(best);
    return counters.length ? pick(counters) : pick(names);
  }

  function rememberFollowUp(move) {
    if (state.lastYou) {
      const tally = state.followUps[state.lastYou] || (state.followUps[state.lastYou] = {});
      tally[move] = (tally[move] || 0) + 1;
    }
    state.lastYou = move;
    state.history.push(move);
  }

  /* ---------- Play ---------- */
  function play(you) {
    if (state.busy || state.phase !== "playing") return;
    if (!table()[you]) return;

    state.busy = true;
    const cpu = cpuMove();          // decided BEFORE recording, so it cannot peek
    rememberFollowUp(you);

    state.round += 1;
    const result = judge(you, cpu);
    if (result === 1) state.you += 1;
    else if (result === -1) state.cpu += 1;
    else state.draws += 1;

    showThrow(you, cpu, result);

    if (state.you >= state.target || state.cpu >= state.target) {
      state.phase = "over";
      const won = state.you > state.cpu;
      if (won) fanfare(); else beep(160, 0.3, "sawtooth");
      setStatus(won
        ? "🏆 You win the match " + state.you + "–" + state.cpu + "!"
        : "The computer takes it " + state.cpu + "–" + state.you + ". Go again?");
    }

    render();
    revealTimer = window.setTimeout(() => { state.busy = false; revealTimer = null; render(); }, 450);
  }

  function showThrow(you, cpu, result) {
    el.youPick.textContent = table()[you].icon;
    el.cpuPick.textContent = table()[cpu].icon;
    el.youPick.setAttribute("aria-label", "You played " + table()[you].label);
    el.cpuPick.setAttribute("aria-label", "Computer played " + table()[cpu].label);

    if (result === 0) {
      el.verdict.textContent = "Draw!";
      el.verdict.className = "rps-verdict is-draw";
      beep(400, 0.1, "sine");
      setStatus("You both played " + table()[you].label + ".");
    } else if (result === 1) {
      el.verdict.textContent = "You win!";
      el.verdict.className = "rps-verdict is-win";
      beep(760, 0.12, "triangle");
      setStatus(table()[you].label + " " + verb(you, cpu) + " " + table()[cpu].label + ".");
    } else {
      el.verdict.textContent = "Computer wins";
      el.verdict.className = "rps-verdict is-lose";
      beep(240, 0.12, "square");
      setStatus(table()[cpu].label + " " + verb(cpu, you) + " " + table()[you].label + ".");
    }
  }

  function newMatch() {
    if (revealTimer) { window.clearTimeout(revealTimer); revealTimer = null; }
    state.you = 0; state.cpu = 0; state.draws = 0; state.round = 0;
    state.history = []; state.followUps = {}; state.lastYou = null;
    state.phase = "playing"; state.busy = false;
    el.youPick.textContent = "❔";
    el.cpuPick.textContent = "❔";
    el.verdict.textContent = "";
    el.verdict.className = "rps-verdict";
    setStatus("First to " + state.target + " wins. Pick your move!");
    render();
  }

  /* ---------- Rendering ---------- */
  function setStatus(text) { el.status.textContent = text; }

  function render() {
    el.choices.innerHTML = "";
    moveNames().forEach((name) => {
      const move = table()[name];
      const button = document.createElement("button");
      button.type = "button";
      button.className = "rps-choice";
      button.disabled = state.busy || state.phase !== "playing";
      button.setAttribute("aria-label", "Play " + move.label);

      const icon = document.createElement("span");
      icon.className = "rps-choice-icon";
      icon.textContent = move.icon;
      const label = document.createElement("span");
      label.className = "rps-choice-label";
      label.textContent = move.label;

      button.appendChild(icon);
      button.appendChild(label);
      button.addEventListener("click", () => play(name));
      el.choices.appendChild(button);
    });

    el.scoreYou.textContent = String(state.you);
    el.scoreCpu.textContent = String(state.cpu);
    el.scoreDraws.textContent = String(state.draws);
    el.round.textContent = String(state.round);

    el.targetButtons.querySelectorAll("[data-target]").forEach((button) => {
      const active = Number(button.dataset.target) === state.target;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  /* ---------- Wiring ---------- */
  el.restart.addEventListener("click", newMatch);
  el.sound.addEventListener("click", () => {
    soundOn = !soundOn;
    el.sound.textContent = soundOn ? "🔊 Sound On" : "🔇 Sound Off";
    el.sound.setAttribute("aria-pressed", String(soundOn));
  });

  document.querySelectorAll("[data-rules]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.rules === button.dataset.rules) return;
      state.rules = button.dataset.rules;
      try { window.localStorage.setItem(RULES_KEY, state.rules); } catch (err) { /* ok */ }
      document.querySelectorAll("[data-rules]").forEach((other) => {
        const active = other === button;
        other.classList.toggle("is-active", active);
        other.setAttribute("aria-pressed", String(active));
      });
      newMatch();
    });
  });

  document.querySelectorAll("[data-skill]").forEach((button) => {
    button.addEventListener("click", () => {
      state.skill = button.dataset.skill;
      document.querySelectorAll("[data-skill]").forEach((other) => {
        const active = other === button;
        other.classList.toggle("is-active", active);
        other.setAttribute("aria-pressed", String(active));
      });
      newMatch();
    });
  });

  document.querySelectorAll("[data-target]").forEach((button) => {
    button.addEventListener("click", () => {
      state.target = Number(button.dataset.target);
      newMatch();
    });
  });

  window.addEventListener("keydown", (event) => {
    const map = { KeyR: "rock", KeyP: "paper", KeyS: "scissors", KeyL: "lizard", KeyK: "spock" };
    const move = map[event.code];
    if (!move || !table()[move]) return;
    event.preventDefault();
    play(move);
  });

  try {
    const saved = window.localStorage.getItem(RULES_KEY);
    if (saved && MOVES[saved]) state.rules = saved;
  } catch (err) { /* defaults fine */ }

  document.querySelectorAll("[data-rules]").forEach((button) => {
    const active = button.dataset.rules === state.rules;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  newMatch();

  window.RpsGame = { state, judge, cpuMove, play, newMatch, moveNames, countersTo, MOVES, TARGETS };
})();
