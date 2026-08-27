/**
 * Battleship — place your fleet, then take turns firing.
 *
 * The computer uses hunt/target: it fires at random until something is hit,
 * then works outwards from that hit along the line the ship must be lying on.
 * A purely random opponent needs ~95 shots to finish a 10x10 board, which is
 * no fun at all; this one finishes in roughly half that.
 */
(function () {
  "use strict";

  const playerBoardEl = document.getElementById("bs-player-board");
  if (!playerBoardEl) return;

  const SIZE = 10;
  const LETTERS = "ABCDEFGHIJ";
  const FLEET = [
    { id: "carrier", name: "Carrier", length: 5 },
    { id: "battleship", name: "Battleship", length: 4 },
    { id: "cruiser", name: "Cruiser", length: 3 },
    { id: "submarine", name: "Submarine", length: 3 },
    { id: "destroyer", name: "Destroyer", length: 2 },
  ];

  const EMPTY = 0, SHIP = 1, MISS = 2, HIT = 3;

  const state = {
    phase: "placing",        // placing | playing | over
    player: null,            // { grid, ships }
    computer: null,
    placingIndex: 0,
    horizontal: true,
    turn: "player",
    winner: null,
    playerShots: 0,
    hunt: null,              // computer's current target queue
    huntOrigin: null,
    openHits: [],            // hits not yet accounted for by a sinking
    busy: false,
  };

  let soundOn = true;
  let audioCtx = null;
  let cpuTimer = null;

  const el = {
    playerBoard: playerBoardEl,
    enemyBoard: document.getElementById("bs-enemy-board"),
    status: document.getElementById("bs-status"),
    shots: document.getElementById("bs-shots"),
    yourLeft: document.getElementById("bs-your-left"),
    enemyLeft: document.getElementById("bs-enemy-left"),
    fleetList: document.getElementById("bs-fleet"),
    rotate: document.getElementById("btn-rotate"),
    auto: document.getElementById("btn-auto"),
    restart: document.getElementById("btn-restart"),
    sound: document.getElementById("btn-sound"),
    placingPanel: document.getElementById("bs-placing-panel"),
    enemyPanel: document.getElementById("bs-enemy-panel"),
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
    } catch (err) { /* optional */ }
  }

  function fanfare() {
    [523, 659, 784, 1047].forEach((f, i) => window.setTimeout(() => beep(f, 0.18, "triangle"), i * 130));
  }

  /* ---------- Board helpers ---------- */
  function makeFleetState() {
    return {
      grid: Array.from({ length: SIZE }, () => new Array(SIZE).fill(EMPTY)),
      ships: FLEET.map((s) => ({ id: s.id, name: s.name, length: s.length, cells: [], hits: 0 })),
    };
  }

  function inside(row, col) {
    return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
  }

  /** Cells a ship would occupy, or null if it will not fit. */
  function shipCells(row, col, length, horizontal) {
    const cells = [];
    for (let i = 0; i < length; i++) {
      const r = horizontal ? row : row + i;
      const c = horizontal ? col + i : col;
      if (!inside(r, c)) return null;
      cells.push([r, c]);
    }
    return cells;
  }

  function canPlace(side, row, col, length, horizontal) {
    const cells = shipCells(row, col, length, horizontal);
    if (!cells) return null;
    // Ships may touch the edge but never overlap each other.
    for (const [r, c] of cells) if (side.grid[r][c] !== EMPTY) return null;
    return cells;
  }

  function placeShip(side, shipIndex, row, col, horizontal) {
    const ship = side.ships[shipIndex];
    const cells = canPlace(side, row, col, ship.length, horizontal);
    if (!cells) return false;
    cells.forEach(([r, c]) => { side.grid[r][c] = SHIP; });
    ship.cells = cells;
    return true;
  }

  function autoPlace(side) {
    side.grid = Array.from({ length: SIZE }, () => new Array(SIZE).fill(EMPTY));
    side.ships.forEach((s) => { s.cells = []; s.hits = 0; });
    for (let i = 0; i < side.ships.length; i++) {
      let placed = false;
      for (let attempt = 0; attempt < 500 && !placed; attempt++) {
        placed = placeShip(side, i,
          Math.floor(Math.random() * SIZE), Math.floor(Math.random() * SIZE),
          Math.random() < 0.5);
      }
      if (!placed) return autoPlace(side);   // wedged itself in; start over
    }
    return side;
  }

  function shipAt(side, row, col) {
    return side.ships.find((s) => s.cells.some(([r, c]) => r === row && c === col)) || null;
  }

  function shipsLeft(side) {
    return side.ships.filter((s) => s.hits < s.length).length;
  }

  function allSunk(side) {
    return side.ships.every((s) => s.hits >= s.length);
  }

  /* ---------- Firing ---------- */
  /** Returns "miss" | "hit" | "sunk" | null when the square was already tried. */
  function fireAt(side, row, col) {
    const cell = side.grid[row][col];
    if (cell === MISS || cell === HIT) return null;
    if (cell === SHIP) {
      side.grid[row][col] = HIT;
      const ship = shipAt(side, row, col);
      if (ship) {
        ship.hits += 1;
        if (ship.hits >= ship.length) return "sunk";
      }
      return "hit";
    }
    side.grid[row][col] = MISS;
    return "miss";
  }

  /* ---------- The computer ---------- */
  function untried(side) {
    const out = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (side.grid[r][c] === EMPTY || side.grid[r][c] === SHIP) out.push([r, c]);
      }
    }
    return out;
  }

  function computerChoice() {
    const side = state.player;

    // Work through the queue built up around a known hit.
    while (state.hunt && state.hunt.length) {
      const [r, c] = state.hunt.shift();
      if (inside(r, c) && (side.grid[r][c] === EMPTY || side.grid[r][c] === SHIP)) return [r, c];
    }

    // Queue empty — but a wounded ship may still be waiting.
    if (reseedFromOpenHits()) {
      while (state.hunt.length) {
        const cell = state.hunt.shift();
        if (inside(cell[0], cell[1]) && (side.grid[cell[0]][cell[1]] === EMPTY || side.grid[cell[0]][cell[1]] === SHIP)) {
          return cell;
        }
      }
    }

    // Nothing to chase: fire on a parity grid. Every ship is at least 2 long,
    // so only checking every other square still cannot miss one.
    const open = untried(side);
    if (!open.length) return null;
    const parity = open.filter(([r, c]) => (r + c) % 2 === 0);
    const pool = parity.length ? parity : open;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /** Hits joined to the given cell in a straight orthogonal chain. */
  function connectedHits(cell) {
    const key = (r, c) => r + ":" + c;
    const pool = new Map(state.openHits.map((h) => [key(h[0], h[1]), h]));
    const found = [];
    const stack = [cell];
    const seen = new Set([key(cell[0], cell[1])]);
    while (stack.length) {
      const [r, c] = stack.pop();
      found.push([r, c]);
      [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].forEach(([nr, nc]) => {
        const k = key(nr, nc);
        if (!seen.has(k) && pool.has(k)) { seen.add(k); stack.push(pool.get(k)); }
      });
    }
    return found;
  }

  /**
   * The queue ran dry but a ship is still wounded somewhere. Without this the
   * computer forgets half-sunk ships whenever two ships sit side by side, and
   * has to find them again square by square.
   */
  function reseedFromOpenHits() {
    if (!state.openHits.length) return false;
    const run = connectedHits(state.openHits[0]);
    state.huntOrigin = run[0];
    state.hunt = [];
    if (run.length >= 2) {
      const horizontal = run[0][0] === run[1][0];
      if (horizontal) {
        const row = run[0][0];
        const cols = run.map((h) => h[1]);
        state.hunt.push([row, Math.min.apply(null, cols) - 1], [row, Math.max.apply(null, cols) + 1]);
      } else {
        const col = run[0][1];
        const rows = run.map((h) => h[0]);
        state.hunt.push([Math.min.apply(null, rows) - 1, col], [Math.max.apply(null, rows) + 1, col]);
      }
    } else {
      queueNeighbours(run[0][0], run[0][1]);
    }
    state.hunt = state.hunt.filter(function (cell) { return inside(cell[0], cell[1]); });
    return state.hunt.length > 0;
  }

  function queueNeighbours(row, col) {
    state.hunt = state.hunt || [];
    [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]].forEach((cell) => {
      if (inside(cell[0], cell[1])) state.hunt.push(cell);
    });
  }

  /** After a second hit the ship's line is known, so drop the sideways guesses. */
  function focusAlongLine(origin, latest) {
    const [r0, c0] = origin;
    const [r1, c1] = latest;
    const horizontal = r0 === r1;
    state.hunt = (state.hunt || []).filter(([r, c]) => (horizontal ? r === r0 : c === c0));
    if (horizontal) {
      const cols = [c0, c1];
      state.hunt.push([r0, Math.min(...cols) - 1], [r0, Math.max(...cols) + 1]);
    } else {
      const rows = [r0, r1];
      state.hunt.push([Math.min(...rows) - 1, c0], [Math.max(...rows) + 1, c0]);
    }
    state.hunt = state.hunt.filter(([r, c]) => inside(r, c));
  }

  function computerTurn() {
    const choice = computerChoice();
    if (!choice) return;
    const [row, col] = choice;
    const result = fireAt(state.player, row, col);
    if (result === null) return computerTurn();

    if (result === "miss") {
      beep(240, 0.07, "sine");
      setStatus("The computer fired at " + LETTERS[col] + (row + 1) + " — miss!");
    } else {
      const ship = shipAt(state.player, row, col);
      state.openHits.push([row, col]);
      if (result === "sunk") {
        beep(180, 0.25, "sawtooth");
        setStatus("💥 The computer sank your " + ship.name + "!");
        // The ship that went down is the run of hits containing the last shot;
        // anything else still on the list belongs to a different wounded ship.
        const sunkRun = connectedHits([row, col]);
        const gone = new Set(sunkRun.map(function (h) { return h[0] + ":" + h[1]; }));
        state.openHits = state.openHits.filter(function (h) { return !gone.has(h[0] + ":" + h[1]); });
        state.hunt = null;
        state.huntOrigin = null;
      } else {
        beep(520, 0.1, "square");
        setStatus("The computer hit your " + ship.name + " at " + LETTERS[col] + (row + 1) + ".");
        if (!state.huntOrigin) {
          state.huntOrigin = [row, col];
          queueNeighbours(row, col);
        } else {
          focusAlongLine(state.huntOrigin, [row, col]);
        }
      }
    }

    if (allSunk(state.player)) {
      state.phase = "over";
      state.winner = "computer";
      beep(150, 0.35, "sawtooth");
      setStatus("😮 The computer sank your whole fleet. Try again!");
    }
    state.turn = "player";
    render();
  }

  /* ---------- Player turn ---------- */
  function playerFire(row, col) {
    if (state.phase !== "playing" || state.turn !== "player" || state.busy) return;
    const result = fireAt(state.computer, row, col);
    if (result === null) {
      setStatus("You've already fired there — pick another square.");
      return;
    }

    state.playerShots += 1;

    if (result === "miss") {
      beep(240, 0.07, "sine");
      setStatus("Miss at " + LETTERS[col] + (row + 1) + ".");
    } else {
      const ship = shipAt(state.computer, row, col);
      beep(result === "sunk" ? 880 : 660, result === "sunk" ? 0.2 : 0.1, "triangle");
      setStatus(result === "sunk"
        ? "🎯 You sank their " + ship.name + "!"
        : "Hit at " + LETTERS[col] + (row + 1) + "!");
    }

    if (allSunk(state.computer)) {
      state.phase = "over";
      state.winner = "player";
      fanfare();
      setStatus("🏆 You sank the whole enemy fleet in " + state.playerShots + " shots!");
      render();
      return;
    }

    state.turn = "computer";
    state.busy = true;
    render();
    cpuTimer = window.setTimeout(() => {
      cpuTimer = null;
      state.busy = false;
      computerTurn();
    }, 550);
  }

  /* ---------- Placing ---------- */
  function tryPlaceHere(row, col) {
    if (state.phase !== "placing") return;
    const ship = state.player.ships[state.placingIndex];
    if (!ship) return;
    if (!placeShip(state.player, state.placingIndex, row, col, state.horizontal)) {
      setStatus("That won't fit there — try another spot or rotate.");
      return;
    }
    beep(560, 0.05, "sine");
    state.placingIndex += 1;
    if (state.placingIndex >= state.player.ships.length) startBattle();
    else setStatus("Now place your " + state.player.ships[state.placingIndex].name +
      " (" + state.player.ships[state.placingIndex].length + " squares).");
    render();
  }

  function startBattle() {
    state.phase = "playing";
    state.turn = "player";
    autoPlace(state.computer);
    setStatus("Fleet ready! Fire at the enemy waters on the right.");
  }

  /* ---------- Rendering ---------- */
  function buildBoard(container, side, opts) {
    container.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "bs-grid";

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "bs-cell";
        const value = side.grid[r][c];

        if (opts.hideShips) {
          if (value === HIT) cell.classList.add("is-hit");
          else if (value === MISS) cell.classList.add("is-miss");
        } else {
          if (value === SHIP) cell.classList.add("is-ship");
          else if (value === HIT) cell.classList.add("is-hit");
          else if (value === MISS) cell.classList.add("is-miss");
        }

        const coord = LETTERS[c] + (r + 1);
        const label = value === HIT ? "hit" : value === MISS ? "miss"
          : (!opts.hideShips && value === SHIP) ? "your ship" : "water";
        cell.setAttribute("aria-label", coord + ", " + label);
        cell.disabled = !opts.onPick || value === HIT || value === MISS;
        if (opts.onPick) cell.addEventListener("click", () => opts.onPick(r, c));
        grid.appendChild(cell);
      }
    }
    container.appendChild(grid);
  }

  function render() {
    buildBoard(el.playerBoard, state.player, {
      hideShips: false,
      onPick: state.phase === "placing" ? tryPlaceHere : null,
    });
    buildBoard(el.enemyBoard, state.computer, {
      hideShips: true,
      onPick: state.phase === "playing" && state.turn === "player" ? playerFire : null,
    });

    el.placingPanel.hidden = state.phase !== "placing";
    el.enemyPanel.hidden = state.phase === "placing";
    el.shots.textContent = String(state.playerShots);
    el.yourLeft.textContent = String(shipsLeft(state.player));
    el.enemyLeft.textContent = state.phase === "placing" ? "5" : String(shipsLeft(state.computer));

    el.fleetList.innerHTML = "";
    state.player.ships.forEach((ship, i) => {
      const item = document.createElement("li");
      const sunk = ship.hits >= ship.length;
      item.className = "bs-fleet-item" +
        (sunk ? " is-sunk" : "") +
        (state.phase === "placing" && i === state.placingIndex ? " is-next" : "") +
        (state.phase === "placing" && i < state.placingIndex ? " is-placed" : "");
      item.textContent = ship.name + " (" + ship.length + ")" + (sunk ? " — sunk" : "");
      el.fleetList.appendChild(item);
    });

    el.rotate.textContent = state.horizontal ? "↔️ Across" : "↕️ Down";
  }

  function setStatus(text) { el.status.textContent = text; }

  /* ---------- Wiring ---------- */
  el.rotate.addEventListener("click", () => {
    state.horizontal = !state.horizontal;
    render();
  });

  el.auto.addEventListener("click", () => {
    if (state.phase !== "placing") return;
    autoPlace(state.player);
    state.placingIndex = state.player.ships.length;
    startBattle();
    render();
  });

  el.restart.addEventListener("click", () => newGame());
  el.sound.addEventListener("click", () => {
    soundOn = !soundOn;
    el.sound.textContent = soundOn ? "🔊 Sound On" : "🔇 Sound Off";
    el.sound.setAttribute("aria-pressed", String(soundOn));
  });

  window.addEventListener("keydown", (event) => {
    if (event.code === "KeyR") { event.preventDefault(); state.horizontal = !state.horizontal; render(); }
  });

  function newGame() {
    if (cpuTimer) { window.clearTimeout(cpuTimer); cpuTimer = null; }
    state.player = makeFleetState();
    state.computer = makeFleetState();
    state.phase = "placing";
    state.placingIndex = 0;
    state.horizontal = true;
    state.turn = "player";
    state.winner = null;
    state.playerShots = 0;
    state.hunt = null;
    state.huntOrigin = null;
    state.openHits = [];
    state.busy = false;
    setStatus("Place your Carrier (5 squares). Tap your own waters on the left.");
    render();
  }

  newGame();

  window.BattleshipGame = {
    state, SIZE, FLEET, EMPTY, SHIP, MISS, HIT,
    makeFleetState, autoPlace, placeShip, canPlace, fireAt, allSunk, shipsLeft,
    computerChoice, computerTurn, playerFire, shipAt, newGame,
  };
})();
