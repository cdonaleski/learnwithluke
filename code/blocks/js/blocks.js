/**
 * Robot Blocks — build a program out of blocks and watch the robot run it.
 *
 * Blocks are tapped rather than dragged. Dragging is fiddly on a tablet and
 * needs a big library; tapping needs neither, and a five-year-old can do it
 * with one finger. Tapping a Repeat selects it, and the next blocks you tap
 * go inside it - the "Out" button steps back to the main program.
 *
 * The interpreter is deliberately separate from the drawing, so the offline
 * tests can prove every level is solvable without a browser anywhere near it.
 */
(function () {
  "use strict";

  const boardEl = document.getElementById("rb-board");
  if (!boardEl) return;

  const LEVELS = Array.isArray(window.RobotLevels) ? window.RobotLevels : [];
  const PROGRESS_KEY = "lwl-robot-blocks";
  const STEP_BUDGET = 500;      // stops an Until that never finds the treasure
  const TICK_MS = 380;

  const DIRS = {
    up: { dc: 0, dr: -1, icon: "⬆️", turnRight: "right", turnLeft: "left" },
    right: { dc: 1, dr: 0, icon: "➡️", turnRight: "down", turnLeft: "up" },
    down: { dc: 0, dr: 1, icon: "⬇️", turnRight: "left", turnLeft: "right" },
    left: { dc: -1, dr: 0, icon: "⬅️", turnRight: "up", turnLeft: "down" },
  };

  const BLOCK_INFO = {
    forward: { label: "Go forward", icon: "⬆️", kind: "move" },
    left: { label: "Turn left", icon: "↰", kind: "turn" },
    right: { label: "Turn right", icon: "↱", kind: "turn" },
    repeat: { label: "Repeat", icon: "🔁", kind: "loop" },
    until: { label: "Until treasure", icon: "🔄", kind: "loop" },
    ifPath: { label: "If path ahead", icon: "❓", kind: "test" },
  };

  const state = {
    levelIndex: 0,
    program: [],
    cursor: null,        // the body array new blocks go into
    cursorNode: null,    // the repeat/if that owns it, or null for the main program
    running: false,
    done: {},            // levelId -> stars
  };

  let runTimer = null;
  let soundOn = true;
  let audioCtx = null;

  const el = {
    board: boardEl,
    palette: document.getElementById("rb-palette"),
    program: document.getElementById("rb-program"),
    status: document.getElementById("rb-status"),
    teaches: document.getElementById("rb-teaches"),
    levelName: document.getElementById("rb-level-name"),
    count: document.getElementById("rb-count"),
    par: document.getElementById("rb-par"),
    stars: document.getElementById("rb-stars"),
    run: document.getElementById("btn-run"),
    reset: document.getElementById("btn-reset"),
    out: document.getElementById("btn-out"),
    sound: document.getElementById("btn-sound"),
    levels: document.getElementById("rb-levels"),
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

  /* ---------- The world ---------- */
  function readLevel(level) {
    const rows = level.grid;
    const world = {
      cols: Math.max.apply(null, rows.map((r) => r.length)),
      rows: rows.length,
      walls: {},
      start: null,
      goal: null,
    };
    rows.forEach((line, r) => {
      for (let c = 0; c < line.length; c++) {
        const ch = line.charAt(c);
        if (ch === "#") world.walls[c + "," + r] = true;
        else if (ch === "R") world.start = { col: c, row: r };
        else if (ch === "T") world.goal = { col: c, row: r };
      }
    });
    return world;
  }

  function isWall(world, col, row) {
    if (col < 0 || row < 0 || col >= world.cols || row >= world.rows) return true;
    return Boolean(world.walls[col + "," + row]);
  }

  /* ---------- The interpreter ---------- */
  /**
   * Runs a program and returns every position the robot passed through, so the
   * drawing code can replay it one step at a time. Pure: no DOM, no timers.
   */
  function execute(program, level) {
    const world = readLevel(level);
    const robot = { col: world.start.col, row: world.start.row, facing: level.facing };
    const trail = [{ col: robot.col, row: robot.row, facing: robot.facing, bumped: false }];
    let steps = 0;
    let bumped = false;

    function onGoal() {
      return robot.col === world.goal.col && robot.row === world.goal.row;
    }

    function record(didBump) {
      trail.push({ col: robot.col, row: robot.row, facing: robot.facing, bumped: Boolean(didBump) });
    }

    function pathAhead() {
      const dir = DIRS[robot.facing];
      return !isWall(world, robot.col + dir.dc, robot.row + dir.dr);
    }

    function runBody(body) {
      for (let i = 0; i < body.length; i++) {
        if (steps >= STEP_BUDGET) return;
        const node = body[i];

        if (node.type === "forward") {
          steps += 1;
          const dir = DIRS[robot.facing];
          const nc = robot.col + dir.dc;
          const nr = robot.row + dir.dr;
          if (isWall(world, nc, nr)) { bumped = true; record(true); }
          else { robot.col = nc; robot.row = nr; record(false); }
        } else if (node.type === "left" || node.type === "right") {
          steps += 1;
          robot.facing = node.type === "right" ? DIRS[robot.facing].turnRight : DIRS[robot.facing].turnLeft;
          record(false);
        } else if (node.type === "repeat") {
          const times = Math.max(1, Math.min(20, Number(node.times) || 1));
          for (let n = 0; n < times && steps < STEP_BUDGET; n++) runBody(node.body || []);
        } else if (node.type === "until") {
          // Bounded, so a program that never finds the treasure still stops.
          let guard = 0;
          while (!onGoal() && steps < STEP_BUDGET && guard < STEP_BUDGET) {
            guard += 1;
            runBody(node.body || []);
          }
        } else if (node.type === "ifPath") {
          if (pathAhead()) runBody(node.body || []);
        }
      }
    }

    runBody(program);
    return { reached: onGoal(), bumped: bumped, steps: steps, trail: trail, robot: robot };
  }

  /** How many blocks a program uses, counting the ones inside loops. */
  function countBlocks(program) {
    let total = 0;
    program.forEach((node) => {
      total += 1;
      if (node.body) total += countBlocks(node.body);
    });
    return total;
  }

  function starsFor(level, used) {
    if (used <= level.par) return 3;
    if (used <= level.par + 2) return 2;
    return 1;
  }

  /* ---------- Progress ---------- */
  function loadProgress() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) || "{}");
      state.done = parsed && typeof parsed === "object" ? parsed : {};
    } catch (err) { state.done = {}; }
  }

  function saveProgress() {
    try { window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(state.done)); } catch (err) { /* ok */ }
  }

  function level() { return LEVELS[state.levelIndex]; }

  /** A level is open if it is the first, or the one before it is finished. */
  function isUnlocked(index) {
    if (index === 0) return true;
    return Boolean(state.done[LEVELS[index - 1].id]);
  }

  /* ---------- Building the program ---------- */
  function addBlock(type) {
    if (state.running) return;
    const node = { type: type };
    if (type === "repeat") { node.times = 4; node.body = []; }
    if (type === "until" || type === "ifPath") { node.body = []; }
    state.cursor.push(node);
    beep(520, 0.04, "sine");
    // Tapping a container drops you straight inside it - that is almost always
    // what you meant next.
    if (node.body) selectContainer(node);
    render();
  }

  function selectContainer(node) {
    state.cursorNode = node;
    state.cursor = node.body;
  }

  function stepOut() {
    state.cursorNode = null;
    state.cursor = state.program;
    render();
  }

  function removeNode(target) {
    if (state.running) return;
    function strip(list) {
      const index = list.indexOf(target);
      if (index !== -1) { list.splice(index, 1); return true; }
      return list.some((node) => node.body && strip(node.body));
    }
    strip(state.program);
    if (state.cursorNode === target) stepOut();
    beep(300, 0.04, "sine");
    render();
  }

  function changeTimes(node, delta) {
    if (state.running) return;
    node.times = Math.max(2, Math.min(20, (node.times || 2) + delta));
    render();
  }

  /* ---------- Running ---------- */
  function runProgram() {
    if (state.running) return;
    if (!countBlocks(state.program)) { setStatus("Add some blocks first, then press Run!"); return; }

    const result = execute(state.program, level());
    state.running = true;
    render();

    let i = 0;
    runTimer = window.setInterval(() => {
      i += 1;
      if (i >= result.trail.length) {
        window.clearInterval(runTimer);
        runTimer = null;
        state.running = false;
        finish(result);
        return;
      }
      drawBoard(result.trail[i]);
      beep(result.trail[i].bumped ? 200 : 620, 0.04, result.trail[i].bumped ? "square" : "sine");
    }, TICK_MS);
  }

  function finish(result) {
    const used = countBlocks(state.program);
    if (result.reached) {
      const stars = starsFor(level(), used);
      const best = state.done[level().id] || 0;
      if (stars > best) { state.done[level().id] = stars; saveProgress(); }
      fanfare();
      setStatus(stars === 3
        ? "⭐⭐⭐ Perfect! You did it in " + used + " block" + (used === 1 ? "" : "s") + "."
        : "🎉 You got the treasure with " + used + " blocks. It can be done in " + level().par + " — try again for three stars!");
    } else if (result.bumped) {
      beep(180, 0.25, "sawtooth");
      setStatus("🤖 Bonk! The robot walked into a wall. Look at where it stopped and fix that bit.");
    } else {
      beep(180, 0.25, "sawtooth");
      setStatus("The robot stopped before the treasure. Does it need more steps?");
    }
    render();
  }

  function resetRun() {
    if (runTimer) { window.clearInterval(runTimer); runTimer = null; }
    state.running = false;
    drawBoard(null);
  }

  function clearProgram() {
    resetRun();
    state.program = [];
    stepOut();
    setStatus("Cleared. Build a new program!");
  }

  /* ---------- Drawing ---------- */
  function drawBoard(position) {
    const lvl = level();
    const world = readLevel(lvl);
    const robot = position || { col: world.start.col, row: world.start.row, facing: lvl.facing };

    el.board.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "rb-grid";
    grid.style.setProperty("--rb-cols", String(world.cols));

    for (let r = 0; r < world.rows; r++) {
      for (let c = 0; c < world.cols; c++) {
        const cell = document.createElement("div");
        const wall = isWall(world, c, r);
        const goal = world.goal.col === c && world.goal.row === r;
        const here = robot.col === c && robot.row === r;
        cell.className = "rb-cell" + (wall ? " is-wall" : "") + (goal ? " is-goal" : "") +
          (here && position && position.bumped ? " is-bumped" : "");
        if (here) cell.textContent = DIRS[robot.facing].icon;
        else if (goal) cell.textContent = "💎";
        cell.setAttribute("aria-label",
          "row " + (r + 1) + " column " + (c + 1) + ", " +
          (here ? "robot facing " + robot.facing : goal ? "treasure" : wall ? "wall" : "floor"));
        grid.appendChild(cell);
      }
    }
    el.board.appendChild(grid);
  }

  function blockChip(node, depth) {
    const info = BLOCK_INFO[node.type] || { label: node.type, icon: "•" };
    const chip = document.createElement("div");
    chip.className = "rb-block rb-block--" + (info.kind || "move") +
      (state.cursorNode === node ? " is-open" : "");

    const main = document.createElement("button");
    main.type = "button";
    main.className = "rb-block-main";
    main.textContent = info.icon + " " + info.label + (node.type === "repeat" ? " " + node.times + "×" : "");
    main.setAttribute("aria-label", info.label + (node.body ? ", tap to put blocks inside" : ""));
    main.disabled = state.running;
    main.addEventListener("click", () => {
      if (node.body) { selectContainer(node); render(); }
    });
    chip.appendChild(main);

    if (node.type === "repeat") {
      const fewer = document.createElement("button");
      fewer.type = "button";
      fewer.className = "rb-mini";
      fewer.textContent = "−";
      fewer.setAttribute("aria-label", "Repeat fewer times");
      fewer.disabled = state.running;
      fewer.addEventListener("click", () => changeTimes(node, -1));

      const more = document.createElement("button");
      more.type = "button";
      more.className = "rb-mini";
      more.textContent = "+";
      more.setAttribute("aria-label", "Repeat more times");
      more.disabled = state.running;
      more.addEventListener("click", () => changeTimes(node, 1));

      chip.appendChild(fewer);
      chip.appendChild(more);
    }

    const bin = document.createElement("button");
    bin.type = "button";
    bin.className = "rb-mini rb-mini--bin";
    bin.textContent = "✕";
    bin.setAttribute("aria-label", "Remove this block");
    bin.disabled = state.running;
    bin.addEventListener("click", () => removeNode(node));
    chip.appendChild(bin);

    const wrap = document.createElement("li");
    wrap.className = "rb-row";
    wrap.style.marginLeft = depth * 1.1 + "rem";
    wrap.appendChild(chip);
    return wrap;
  }

  function renderProgram(list, into, depth) {
    list.forEach((node) => {
      into.appendChild(blockChip(node, depth));
      if (node.body) renderProgram(node.body, into, depth + 1);
    });
  }

  function renderPalette() {
    el.palette.innerHTML = "";
    (level().blocks || []).forEach((type) => {
      const info = BLOCK_INFO[type];
      if (!info) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "rb-palette-btn rb-block--" + info.kind;
      button.textContent = info.icon + " " + info.label;
      button.disabled = state.running;
      button.addEventListener("click", () => addBlock(type));
      el.palette.appendChild(button);
    });
  }

  function renderLevels() {
    el.levels.innerHTML = "";
    LEVELS.forEach((lvl, i) => {
      const button = document.createElement("button");
      button.type = "button";
      const stars = state.done[lvl.id] || 0;
      const open = isUnlocked(i);
      button.className = "option-btn" + (i === state.levelIndex ? " is-active" : "");
      button.textContent = (open ? "" : "🔒 ") + lvl.name + (stars ? " " + "⭐".repeat(stars) : "");
      button.disabled = !open;
      button.setAttribute("aria-pressed", String(i === state.levelIndex));
      button.addEventListener("click", () => loadLevel(i));
      el.levels.appendChild(button);
    });
  }

  function render() {
    el.program.innerHTML = "";
    if (!state.program.length) {
      const empty = document.createElement("li");
      empty.className = "rb-empty";
      empty.textContent = "Tap a block below to start your program.";
      el.program.appendChild(empty);
    } else {
      renderProgram(state.program, el.program, 0);
    }

    const used = countBlocks(state.program);
    el.count.textContent = String(used);
    el.par.textContent = String(level().par);
    const stars = state.done[level().id] || 0;
    el.stars.textContent = stars ? "⭐".repeat(stars) : "—";
    el.out.hidden = state.cursorNode === null;
    el.run.disabled = state.running;
    el.reset.disabled = state.running;
    renderPalette();
    renderLevels();
  }

  function setStatus(text) { el.status.textContent = text; }

  function loadLevel(index) {
    if (!isUnlocked(index)) return;
    resetRun();
    state.levelIndex = index;
    state.program = [];
    stepOut();
    el.levelName.textContent = level().name;
    el.teaches.textContent = level().teaches;
    drawBoard(null);
    render();
    setStatus("Build a program to get the robot to the 💎.");
  }

  /* ---------- Wiring ---------- */
  el.run.addEventListener("click", runProgram);
  el.reset.addEventListener("click", clearProgram);
  el.out.addEventListener("click", stepOut);
  el.sound.addEventListener("click", () => {
    soundOn = !soundOn;
    el.sound.textContent = soundOn ? "🔊 Sound On" : "🔇 Sound Off";
    el.sound.setAttribute("aria-pressed", String(soundOn));
  });

  if (!LEVELS.length) {
    setStatus("No levels found — check js/levels.js.");
    return;
  }

  loadProgress();
  // Start on the first level they have not finished.
  let start = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (state.done[LEVELS[i].id]) start = Math.min(i + 1, LEVELS.length - 1);
  }
  state.cursor = state.program;
  loadLevel(isUnlocked(start) ? start : 0);

  window.RobotBlocks = {
    state, execute, countBlocks, starsFor, readLevel, isWall, LEVELS,
    addBlock, runProgram, clearProgram, loadLevel, DIRS,
  };
})();
