/**
 * Farkle — push-your-luck dice.
 *
 * Roll six dice, set aside anything that scores, then choose: bank what you
 * have, or roll what's left and risk it. Roll nothing that scores and the whole
 * turn is gone.
 *
 * All the difficulty is in scoring a handful of dice, and the rules interact:
 * three 1s is 1000, but 1s left over are worth 100 each, and a run of six or
 * three pairs beats counting them individually. score() works out the BEST
 * reading of a set rather than the first one it finds.
 */
(function () {
  "use strict";

  const trayEl = document.getElementById("farkle-tray");
  if (!trayEl) return;

  const TARGET = 4000;
  const DICE = 6;
  const OPENING = 300;      // you must bank at least this much to get going

  const state = {
    dice: [],               // { value, held, setAside }
    turnScore: 0,
    total: 0,
    opened: false,
    phase: "ready",         // ready | rolling | picking | farkled | over
    rollsThisTurn: 0,
    bestTurn: 0,
  };

  let soundOn = true;
  let audioCtx = null;

  const el = {
    tray: trayEl,
    status: document.getElementById("farkle-status"),
    turn: document.getElementById("farkle-turn"),
    total: document.getElementById("farkle-total"),
    target: document.getElementById("farkle-target"),
    best: document.getElementById("farkle-best"),
    roll: document.getElementById("btn-roll"),
    bank: document.getElementById("btn-bank"),
    restart: document.getElementById("btn-restart"),
    sound: document.getElementById("btn-sound"),
    hint: document.getElementById("farkle-hint"),
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
      osc.type = type || "square";
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

  /* ---------- Scoring ---------- */
  function counts(values) {
    const out = [0, 0, 0, 0, 0, 0, 0];
    values.forEach((v) => { out[v] += 1; });
    return out;
  }

  /**
   * The best score for exactly this set of dice, and whether every die was
   * used. Special combinations are checked before falling back to counting
   * triples and leftover 1s and 5s, because a run of six is worth more than
   * the 1 and 5 inside it.
   */
  function score(values) {
    if (!values.length) return { points: 0, usesAll: false };
    const n = values.length;
    const candidates = [];

    // Special combinations, which only exist on a full set of six.
    if (n === 6) {
      const c = counts(values);
      if (c.slice(1).every((count) => count === 1)) candidates.push({ points: 1500, usesAll: true });
      const pairs = c.slice(1).filter((count) => count === 2).length;
      const fours = c.slice(1).filter((count) => count === 4).length;
      if (pairs === 3 || (fours === 1 && pairs === 1)) candidates.push({ points: 1500, usesAll: true });
      if (c.slice(1).filter((count) => count === 3).length === 2) candidates.push({ points: 2500, usesAll: true });
      // No separate "six of a kind" value: the doubling rule already covers it,
      // and pays more (six 6s = 4800, six 1s = 8000). Two rules for the same
      // hand that disagree is exactly how a child ends up mistrusting the game.
    }

    // The ordinary reading: triples (doubling for each extra die), then
    // leftover 1s and 5s.
    const c = counts(values);
    let points = 0;
    let used = 0;
    for (let face = 1; face <= 6; face++) {
      const count = c[face];
      if (count < 3) continue;
      const base = face === 1 ? 1000 : face * 100;
      points += base * Math.pow(2, count - 3);
      used += count;
      c[face] = 0;
    }
    points += c[1] * 100;
    used += c[1];
    points += c[5] * 50;
    used += c[5];
    candidates.push({ points: points, usesAll: used === n && points > 0 });

    // A special combination is not automatically best: six 1s are worth 8000
    // by the doubling rule but only 3000 as "six of a kind". Prefer a reading
    // that uses every die, and among those take the highest.
    const full = candidates.filter((cand) => cand.usesAll);
    const pool = full.length ? full : candidates;
    return pool.reduce((best, cand) => (cand.points > best.points ? cand : best), pool[0]);
  }

  /** Any scoring dice at all? If not, the turn is lost. */
  function hasScore(values) {
    return score(values).points > 0 ||
      values.some((v) => v === 1 || v === 5) ||
      counts(values).slice(1).some((count) => count >= 3);
  }

  function rollDie() {
    return 1 + Math.floor(Math.random() * 6);
  }

  /* ---------- Turn flow ---------- */
  function liveDice() {
    return state.dice.filter((d) => !d.setAside);
  }

  function heldDice() {
    return state.dice.filter((d) => !d.setAside && d.held);
  }

  function heldValues() {
    return heldDice().map((d) => d.value);
  }

  function newTurnDice(count) {
    const dice = [];
    for (let i = 0; i < count; i++) dice.push({ value: rollDie(), held: false, setAside: false });
    return dice;
  }

  function roll() {
    if (state.phase === "over") return;

    // Anything picked out on the previous roll is locked in first.
    if (state.phase === "picking") {
      const picked = heldValues();
      const result = score(picked);
      if (!picked.length || result.points === 0 || !result.usesAll) {
        setStatus("Pick dice that actually score before rolling again.");
        return;
      }
      state.turnScore += result.points;
      heldDice().forEach((d) => { d.setAside = true; d.held = false; });
    }

    // Used all six? You get all six back, keeping the score. That's "hot dice".
    let remaining = state.dice.filter((d) => !d.setAside).length;
    if (remaining === 0) {
      state.dice = [];
      remaining = DICE;
      setStatus("🔥 Hot dice! All six scored, so you get them all again.");
    }

    const fresh = newTurnDice(remaining);
    state.dice = state.dice.filter((d) => d.setAside).concat(fresh);
    state.rollsThisTurn += 1;
    beep(320, 0.05, "square");

    if (!hasScore(fresh.map((d) => d.value))) {
      state.phase = "farkled";
      state.turnScore = 0;
      beep(150, 0.35, "sawtooth");
      setStatus("💥 Farkle! Nothing in that roll scores, so this turn is worth nothing.");
      render();
      return;
    }

    state.phase = "picking";
    render();
    setStatus("Pick the dice you want to keep, then roll again or bank.");
  }

  function toggleDie(index) {
    if (state.phase !== "picking") return;
    const die = state.dice[index];
    if (!die || die.setAside) return;
    die.held = !die.held;
    beep(die.held ? 620 : 420, 0.04, "sine");
    render();
  }

  function bank() {
    if (state.phase !== "picking") return;
    const picked = heldValues();
    const result = score(picked);
    if (!picked.length || result.points === 0 || !result.usesAll) {
      setStatus("Pick some scoring dice first — then you can bank.");
      return;
    }

    const turn = state.turnScore + result.points;
    if (!state.opened && turn < OPENING) {
      setStatus("You need " + OPENING + " in one turn to get started. That's only " + turn + " — keep rolling!");
      return;
    }

    state.opened = true;
    state.total += turn;
    if (turn > state.bestTurn) state.bestTurn = turn;
    fanfare();

    if (state.total >= TARGET) {
      state.phase = "over";
      if (board) board.offer(state.total);
      setStatus("🏆 You made it to " + state.total + "! Press New Game to play again.");
      render();
      return;
    }

    setStatus("Banked " + turn + "! You're on " + state.total + ".");
    startTurn();
  }

  function startTurn() {
    state.dice = [];
    state.turnScore = 0;
    state.rollsThisTurn = 0;
    state.phase = "ready";
    render();
  }

  function newGame() {
    state.total = 0;
    state.opened = false;
    state.bestTurn = 0;
    startTurn();
    setStatus("Roll six dice to begin. First to " + TARGET + " wins!");
  }

  /* ---------- Rendering ---------- */
  function renderTray() {
    el.tray.innerHTML = "";
    if (!state.dice.length) {
      const hint = document.createElement("p");
      hint.className = "farkle-empty";
      hint.textContent = "Press Roll to throw six dice.";
      el.tray.appendChild(hint);
      return;
    }

    state.dice.forEach((die, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "farkle-die" +
        (die.setAside ? " is-set" : "") +
        (die.held ? " is-held" : "");
      button.textContent = String(die.value);
      button.disabled = die.setAside || state.phase !== "picking";
      button.setAttribute("aria-label", "Die showing " + die.value +
        (die.setAside ? ", already banked this turn" : die.held ? ", picked" : ", not picked"));
      button.setAttribute("aria-pressed", String(die.held));
      button.addEventListener("click", () => toggleDie(index));
      el.tray.appendChild(button);
    });
  }

  function renderStats() {
    const picked = score(heldValues());
    el.turn.textContent = String(state.turnScore + (picked.usesAll ? picked.points : 0));
    el.total.textContent = String(state.total);
    el.target.textContent = String(TARGET);
    const stored = board ? board.entries() : [];
    el.best.textContent = stored.length ? String(stored[0].value) : "—";

    el.roll.disabled = state.phase === "over";
    el.bank.disabled = state.phase !== "picking";
    el.roll.textContent = state.phase === "farkled" ? "▶ Next Turn"
      : state.phase === "picking" ? "🎲 Roll Again" : "🎲 Roll";

    const held = heldValues();
    if (state.phase !== "picking") { el.hint.textContent = ""; return; }
    if (!held.length) { el.hint.textContent = "Pick at least one scoring die."; return; }
    const result = score(held);
    el.hint.textContent = result.points === 0
      ? "Those dice don't score anything."
      : !result.usesAll
        ? "Some of those don't score — that combination is worth nothing unless every picked die counts."
        : "Those dice are worth " + result.points + ".";
  }

  function render() {
    if (state.phase === "farkled") {
      state.dice.forEach((d) => { d.held = false; });
    }
    renderTray();
    renderStats();
  }

  function setStatus(text) { el.status.textContent = text; }

  /* ---------- Leaderboard ---------- */
  const board = window.Leaderboard ? window.Leaderboard.create({
    gameId: "farkle",
    gameName: "Farkle",
    metric: { label: "Score", better: "higher", format: "number" },
  }) : null;
  if (board) board.mount(document.getElementById("leaderboard-panel"));

  /* ---------- Wiring ---------- */
  el.roll.addEventListener("click", () => {
    if (state.phase === "farkled") { startTurn(); setStatus("New turn — roll six dice."); return; }
    roll();
  });
  el.bank.addEventListener("click", bank);
  el.restart.addEventListener("click", () => newGame());
  el.sound.addEventListener("click", () => {
    soundOn = !soundOn;
    el.sound.textContent = soundOn ? "🔊 Sound On" : "🔇 Sound Off";
    el.sound.setAttribute("aria-pressed", String(soundOn));
  });

  window.addEventListener("keydown", (event) => {
    if (event.code === "Space") { event.preventDefault(); if (state.phase === "farkled") startTurn(); else roll(); }
    else if (event.code === "KeyB") { event.preventDefault(); bank(); }
    else {
      const digit = /^Digit([1-6])$/.exec(event.code);
      if (digit) {
        event.preventDefault();
        const live = state.dice.map((d, i) => ({ d, i })).filter((x) => !x.d.setAside);
        const target = live[Number(digit[1]) - 1];
        if (target) toggleDie(target.i);
      }
    }
  });

  newGame();

  window.FarkleGame = {
    state, score, hasScore, counts, roll, bank, toggleDie, newGame, startTurn,
    TARGET, DICE, OPENING,
  };
})();
