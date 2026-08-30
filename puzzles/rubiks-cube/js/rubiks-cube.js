/**
 * Rubik's Cube Helper — mirror input + step-by-step solver
 * Uses cubejs (Kociemba two-phase) via CDN.
 */
(function () {
  "use strict";

  const FACES = [
    { id: "U", label: "Top (White)", gridClass: "cube-face--u" },
    { id: "L", label: "Left (Orange)", gridClass: "cube-face--l" },
    { id: "F", label: "Front (Green)", gridClass: "cube-face--f" },
    { id: "R", label: "Right (Red)", gridClass: "cube-face--r" },
    { id: "B", label: "Back (Blue)", gridClass: "cube-face--b" },
    { id: "D", label: "Bottom (Yellow)", gridClass: "cube-face--d" },
  ];

  const FACELETTERS = ["U", "R", "F", "D", "L", "B"];

  const FACE_INFO = {
    U: { name: "Top", kidName: "white top", color: "White" },
    D: { name: "Bottom", kidName: "yellow bottom", color: "Yellow" },
    F: { name: "Front", kidName: "green front", color: "Green" },
    B: { name: "Back", kidName: "blue back", color: "Blue" },
    L: { name: "Left", kidName: "orange left", color: "Orange" },
    R: { name: "Right", kidName: "red right", color: "Red" },
  };

  /** cubejs facelet order: U, R, F, D, L, B */
  const NET_ORDER = ["U", "L", "F", "R", "B", "D"];

  const VIEW_STORAGE_KEY = "rubiks-cube-view";
  /** Relative to this page. importScripts() inside it resolves alongside it. */
  const WORKER_URI = "../../vendor/cubejs/worker.js";
  /** How long to wait for the worker before giving up and using this thread. */
  const WORKER_TIMEOUT_MS = 20000;
  let useWorker = false;
  let viewMode = "3d";
  let cube3d = null;

  let selectedColor = "U";
  let cubeState = createSolvedState();
  let solverReady = false;
  let solutionSteps = [];
  let stepStages = null;
  let solutionStart = null;   // the cube as painted when Solve was pressed
  let shownMoves = 0;         // how many solution moves the display has played
  let displayFaces = null;    // what the views show during playback, or null
  let playbackSeq = 0;        // stamps each display change, so a late swing repaints nothing
  let currentStepIndex = 0;

  const els = {
    palette: document.querySelector(".color-palette"),
    net: document.getElementById("cube-net"),
    cube3d: document.getElementById("cube-3d"),
    viewHint: document.getElementById("cube-view-hint"),
    btnView3d: document.getElementById("btn-view-3d"),
    btnView2d: document.getElementById("btn-view-2d"),
    message: document.getElementById("rubiks-message"),
    solverStatus: document.getElementById("solver-status"),
    solverStatusText: document.getElementById("solver-status-text"),
    solutionPanel: document.getElementById("solution-panel"),
    solutionSummary: document.getElementById("solution-summary"),
    currentStepNumber: document.getElementById("current-step-number"),
    currentStepMove: document.getElementById("current-step-move"),
    currentStepDesc: document.getElementById("current-step-desc"),
    stepCounter: document.getElementById("step-counter"),
    stepsList: document.getElementById("steps-list"),
    stepsListOl: document.getElementById("steps-list-ol"),
    btnReset: document.getElementById("btn-reset"),
    btnBlank: document.getElementById("btn-blank"),
    btnScramble: document.getElementById("btn-scramble"),
    btnSolve: document.getElementById("btn-solve"),
    btnPrev: document.getElementById("btn-prev-step"),
    btnNext: document.getElementById("btn-next-step"),
    btnToggleList: document.getElementById("btn-toggle-list"),
    liveStatus: document.getElementById("live-status"),
    methods: document.getElementById("solve-methods"),
  };

  function createSolvedState() {
    const state = {};
    FACES.forEach(({ id }) => {
      state[id] = Array(9).fill(id);
    });
    return state;
  }

  function buildFaceletString(state) {
    let str = "";
    FACELETTERS.forEach((face) => {
      state[face].forEach((letter) => {
        str += letter;
      });
    });
    return str;
  }

  /**
   * A cube can show 9 stickers of every color and still be physically
   * impossible to build — one flipped edge, or one twisted corner.
   * cubejs does NOT catch this: solve() returns a normal-looking algorithm
   * that does not actually solve the cube. These are the standard
   * solvability invariants, checked before we trust the solver.
   */
  function findImpossibility(cube) {
    function isPermutation(pieces, count) {
      const seen = new Array(count).fill(false);
      for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i];
        if (typeof piece !== "number" || piece < 0 || piece >= count || seen[piece]) {
          return false;
        }
        seen[piece] = true;
      }
      return true;
    }

    function sum(values) {
      return values.reduce(function (total, value) {
        return total + value;
      }, 0);
    }

    if (!isPermutation(cube.cp, 8) || !isPermutation(cube.ep, 12)) {
      return "Two pieces on your cube look exactly the same. Every corner and edge needs its own set of colors!";
    }
    if (sum(cube.co) % 3 !== 0) {
      return "One of the corners is twisted the wrong way. Check the three colors on each corner piece!";
    }
    if (sum(cube.eo) % 2 !== 0) {
      return "One of the edges is flipped the wrong way. Check the two colors on each edge piece!";
    }
    if (cube.cornerParity() !== cube.edgeParity()) {
      return "It looks like two pieces got swapped. Give your colors one more look!";
    }
    return null;
  }

  function validateState(state) {
    const counts = {};
    FACELETTERS.forEach((f) => {
      counts[f] = 0;
    });

    let unpainted = 0;
    FACELETTERS.forEach((f) => {
      state[f].forEach((letter) => { if (letter === BLANK) unpainted += 1; });
    });
    if (unpainted) {
      return { valid: false, error: "There " + (unpainted === 1 ? "is" : "are") + " still " +
        unpainted + " grey square" + (unpainted === 1 ? "" : "s") + " to paint before it can be solved." };
    }

    for (const face of FACELETTERS) {
      for (const letter of state[face]) {
        if (!counts.hasOwnProperty(letter)) {
          return { valid: false, error: "Oops! Every sticker should be one of the six cube colors." };
        }
        counts[letter] += 1;
      }
    }

    for (const face of FACELETTERS) {
      if (counts[face] !== 9) {
        const info = FACE_INFO[face];
        return {
          valid: false,
          error: `You need exactly 9 ${info.color.toLowerCase()} stickers. Right now there ${counts[face] === 1 ? "is" : "are"} ${counts[face]}.`,
        };
      }
    }

    for (const face of FACELETTERS) {
      if (state[face][4] !== face) {
        const info = FACE_INFO[face];
        return {
          valid: false,
          error: `The middle sticker on the ${info.name} face must stay ${info.color.toLowerCase()} — that's how we know which side is which!`,
        };
      }
    }

    if (typeof Cube === "undefined") {
      return { valid: false, error: "The solver is still loading. Please wait a moment and try again." };
    }

    const faceletString = buildFaceletString(state);
    let testCube;
    try {
      testCube = Cube.fromString(faceletString);
    } catch (err) {
      return {
        valid: false,
        error: "This doesn't look like a real Rubik's cube setup. Double-check your colors!",
      };
    }

    // If cubejs could not match a sticker pattern to a real piece it silently
    // falls back to a default piece, so the parse loses information. Round-trip
    // the string to catch that (e.g. a corner showing both white and yellow).
    if (testCube.asString() !== faceletString) {
      return {
        valid: false,
        error: "Some of these colors can't sit next to each other on a real cube. Take another look at the corners and edges!",
      };
    }

    const impossible = findImpossibility(testCube);
    if (impossible) {
      return { valid: false, error: impossible };
    }

    return { valid: true, faceletString, alreadySolved: testCube.isSolved() };
  }

  /** How many stickers of each colour are on the cube right now. */
  /**
   * An unpainted sticker. Starting from a blank cube is the honest way to
   * clone a real one: on a cube that starts solved, a sticker you forget to
   * repaint keeps its solved colour and the result still validates -- a
   * perfectly possible cube that simply is not yours, which no checker can
   * catch. A forgotten sticker on a blank cube stays grey, and grey is
   * visible.
   */
  const BLANK = "none";

  function createBlankState() {
    const state = {};
    FACELETTERS.forEach((id) => {
      state[id] = Array(9).fill(BLANK);
      state[id][4] = id;                    // centres cannot move, so they stay
    });
    return state;
  }

  function blankCount() {
    let n = 0;
    FACELETTERS.forEach((face) => {
      cubeState[face].forEach((letter) => { if (letter === BLANK) n += 1; });
    });
    return n;
  }

  function colorCounts() {
    const counts = {};
    FACELETTERS.forEach((f) => { counts[f] = 0; });
    FACELETTERS.forEach((face) => {
      cubeState[face].forEach((letter) => { counts[letter] += 1; });
    });
    return counts;
  }

  /**
   * Painting is refused, not merely warned about, when it would put a tenth
   * sticker of a colour on the cube. A real cube has nine of each and no
   * amount of turning changes that -- letting the tenth on would only mean
   * telling them at the end that the whole thing is wrong.
   *
   * Painting over a sticker that is already that colour, or repainting with
   * a colour that still has spares, goes through as before.
   */
  function paintSticker(faceId, index) {
    if (index === 4) return;
    const was = cubeState[faceId][index];
    if (was !== selectedColor && colorCounts()[selectedColor] >= 9) {
      const info = FACE_INFO[selectedColor];
      showMessage(
        "All nine " + info.color.toLowerCase() + " stickers are already on the cube. " +
        "Paint over one of them with a different colour first.", "error");
      return;
    }
    cubeState[faceId][index] = selectedColor;
    displayFaces = null;
    shownMoves = 0;
    updateCubeViews();
    hideMessage();
    els.solutionPanel.hidden = true;
    renderPalette();
    liveCheck();
  }

  /**
   * A running verdict while they paint, so an impossible pattern is caught the
   * moment it is complete rather than when Solve is pressed. While colours are
   * still short it stays quiet -- a half-painted cube is not wrong, just
   * unfinished.
   */
  function liveCheck() {
    if (!els.liveStatus) return;
    const counts = colorCounts();
    const missing = FACELETTERS.filter((f) => counts[f] < 9);
    if (missing.length) {
      const blanks = blankCount();
      const bits = missing.map((f) => (9 - counts[f]) + " " + FACE_INFO[f].color.toLowerCase());
      els.liveStatus.textContent = "Still to place: " + bits.join(", ") +
        (blanks ? " — " + blanks + " grey square" + (blanks === 1 ? "" : "s") + " left." : ".");
      els.liveStatus.className = "live-status";
      return;
    }
    const verdict = validateState(cubeState);
    if (!verdict.valid) {
      els.liveStatus.textContent = "⚠ " + verdict.error;
      els.liveStatus.className = "live-status is-bad";
      return;
    }
    els.liveStatus.textContent = "✓ All 54 placed, and this pattern is possible. Ready to solve.";
    els.liveStatus.className = "live-status is-good";
  }

  function updateCubeViews() {
    const showing = displayFaces || cubeState;
    if (cube3d) {
      cube3d.updateColors(showing);
    }
    if (viewMode === "2d") {
      renderNet();
    }
  }

  /** The painted cube advanced by the first `k` solution moves, as face arrays. */
  function facesAfter(k) {
    if (!window.CubeMath || !solutionStart) return null;
    let state = solutionStart;
    if (k > 0) state = window.CubeMath.run(state, solutionSteps.slice(0, k).join(" ")).state;
    const faces = {};
    FACELETTERS.forEach((face, f) => {
      faces[face] = state.slice(f * 9, f * 9 + 9);
    });
    return faces;
  }

  /** Repaints the views to show the cube after `k` moves of the solution. */
  function showDisplayAt(k) {
    shownMoves = k;
    displayFaces = k === 0 ? null : facesAfter(k);
    updateCubeViews();
  }

  function setViewMode(mode) {
    viewMode = mode === "2d" ? "2d" : "3d";
    const is3d = viewMode === "3d";

    els.btnView3d.classList.toggle("is-active", is3d);
    els.btnView3d.setAttribute("aria-selected", String(is3d));
    els.btnView2d.classList.toggle("is-active", !is3d);
    els.btnView2d.setAttribute("aria-selected", String(!is3d));

    els.cube3d.hidden = !is3d;
    els.net.hidden = is3d;

    if (cube3d) {
      cube3d.setVisible(is3d);
    }

    if (!is3d) {
      renderNet();
    }

    els.viewHint.innerHTML = is3d
      ? "<strong>Spin View:</strong> drag to rotate the cube, then click a sticker to paint it with your chosen color."
      : "<strong>Flat View:</strong> tap any square on the unfolded cube to paint it. Centers stay fixed!";

    try {
      localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
    } catch (err) {
      /* ignore */
    }
  }

  function initViewMode() {
    try {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved === "2d" || saved === "3d") {
        viewMode = saved;
      }
    } catch (err) {
      /* ignore */
    }
  }

  function initCube3d() {
    if (typeof Cube3DView === "undefined" || typeof THREE === "undefined") {
      return false;
    }

    cube3d = new Cube3DView(els.cube3d, {
      onStickerClick: paintSticker,
    });
    cube3d.updateColors(cubeState);
    return true;
  }

  function showMessage(text, type) {
    els.message.hidden = false;
    els.message.textContent = text;
    els.message.className = "rubiks-message rubiks-message--" + type;
  }

  function hideMessage() {
    els.message.hidden = true;
  }

  function renderPalette() {
    els.palette.innerHTML = "";
    FACES.forEach(({ id, label }) => {
      const item = document.createElement("div");
      item.className = "palette-item";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "color-swatch sticker--" + id + (selectedColor === id ? " is-selected" : "");
      btn.setAttribute("aria-label", "Select " + label + " color");
      btn.setAttribute("aria-pressed", String(selectedColor === id));
      btn.dataset.color = id;
      btn.addEventListener("click", () => {
        selectedColor = id;
        renderPalette();
      });

      const counts = colorCounts();
      const left = 9 - counts[id];
      const badge = document.createElement("span");
      badge.className = "swatch-left" + (left === 0 ? " is-spent" : "");
      badge.textContent = left;
      badge.setAttribute("aria-hidden", "true");
      btn.appendChild(badge);
      btn.setAttribute("aria-label", "Select " + label + " color, " + left + " left to place");

      const lbl = document.createElement("span");
      lbl.className = "color-swatch-label";
      lbl.textContent = id;

      item.appendChild(btn);
      item.appendChild(lbl);
      els.palette.appendChild(item);
    });
  }

  function renderNet() {
    els.net.innerHTML = "";
    const showing = displayFaces || cubeState;

    NET_ORDER.forEach((faceId) => {
      const faceMeta = FACES.find((f) => f.id === faceId);
      const wrapper = document.createElement("div");
      wrapper.className = "cube-face " + faceMeta.gridClass;
      wrapper.dataset.face = faceId;

      const label = document.createElement("span");
      label.className = "cube-face-label";
      label.textContent = faceMeta.label;
      wrapper.appendChild(label);

      for (let i = 0; i < 9; i++) {
        const sticker = document.createElement("button");
        sticker.type = "button";
        const color = showing[faceId][i];
        sticker.className = "sticker sticker--" + color + (i === 4 ? " is-center" : "");
        sticker.dataset.face = faceId;
        sticker.dataset.index = String(i);
        sticker.setAttribute(
          "aria-label",
          faceMeta.label + " sticker " + (i + 1) + ", " + FACE_INFO[color].color
        );

        if (i !== 4) {
          sticker.addEventListener("click", () => {
            paintSticker(faceId, i);
          });
        }

        wrapper.appendChild(sticker);
      }

      els.net.appendChild(wrapper);
    });
  }

  function parseMove(moveStr) {
    if (/^y(2|')?$/.test(moveStr)) {
      const mod = moveStr.slice(1);
      return { face: "y", mod: mod, notation: moveStr };
    }
    const match = moveStr.match(/^([URFDLB])(2|'|)?$/);
    if (!match) return null;
    const face = match[1];
    const mod = match[2] || "";
    return { face, mod, notation: face + mod };
  }

  function describeMove(moveStr) {
    const parsed = parseMove(moveStr);
    if (!parsed) return { notation: moveStr, html: moveStr };

    if (parsed.face === "y") {
      const how = parsed.mod === "2" ? "half way round"
        : parsed.mod === "'" ? "a quarter turn to the right"
        : "a quarter turn to the left";
      return { notation: parsed.notation,
               html: "Turn the <strong>whole cube</strong> " + how +
                     " — nothing moves, you are just holding it differently." };
    }
    const info = FACE_INFO[parsed.face];
    let direction;
    if (parsed.mod === "2") {
      direction = "Turn the <span class=\"face-highlight face-highlight--" + parsed.face + "\">" + info.name + "</span> face halfway around (180°).";
    } else if (parsed.mod === "'") {
      direction = "Turn the <span class=\"face-highlight face-highlight--" + parsed.face + "\">" + info.name + "</span> face counter-clockwise (opposite way from before).";
    } else {
      direction = "Turn the <span class=\"face-highlight face-highlight--" + parsed.face + "\">" + info.name + "</span> face clockwise, like tightening a jar lid.";
    }

    return { notation: parsed.notation, html: direction };
  }

  function prefersStillness() {
    try {
      return Boolean(window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (err) { return false; }
  }

  function stageLabelFor(index) {
    if (!stepStages) return "";
    return stepStages[index] || "";
  }

  /**
   * Why each stage exists, said once at the moment it begins. The labels the
   * solver emits carry detail ("Orient the top (Sune)"), so matching is by
   * what the label starts with.
   */
  const STAGE_WHY = [
    ["The cross", "First job: four edges round the bottom centre, each matched to " +
      "the side it touches. Everything else is built on top of this."],
    ["Pair ", "Now corners and edges go in together as pairs, filling the bottom " +
      "two layers at once — this is the trick that makes CFOP fast. The whole-cube " +
      "turns just change which corner you are working at."],
    ["Orient the top", "The top face becomes one colour. Never mind where each " +
      "piece is yet — only which way up it is. This is one of the 57 patterns " +
      "from the Learn CFOP page."],
    ["Move the top pieces home", "Last job: the top pieces slide round to their " +
      "own corners and edges without turning over. One of the 21 permutations, " +
      "and then it is done."],
    ["Straighten the top", "Everything is solved — the top layer just needs " +
      "turning round to line up."],
    ["The bottom cross", "First job: four edges round the bottom centre, each " +
      "matched to the side it touches. Do this by looking, not by memorising."],
    ["Bottom corner", "Each bottom corner drops in with the same little loop — " +
      "R U R' U' — repeated until it sits right. Turn the whole cube between " +
      "corners so the one you are working on is always at the front right."],
    ["Middle edge", "The middle edges go in with one of two mirror-image " +
      "patterns, depending which way the edge is facing. These are the only " +
      "two patterns this stage needs."],
    ["The top cross", "F R U R' U' F' turns the top edges over: dot to L-shape " +
      "to line to cross. Same pattern every time, just from the right angle."],
    ["Top edges round", "The edges are up; now they slide round to their own " +
      "faces with one repeated pattern."],
    ["Top corners round", "Three corners swap round at a time. Ignore which " +
      "way up they are — that is the last stage's job."],
    ["Turning the last corners", "The famous bit: the bottom layers will look " +
      "wrecked in the middle of this. Do not panic and do not restart — they " +
      "come back exactly as the last corner lands."],
  ];

  function stageWhy(label) {
    for (let i = 0; i < STAGE_WHY.length; i++) {
      if (label.indexOf(STAGE_WHY[i][0]) === 0) return STAGE_WHY[i][1];
    }
    return "";
  }

  /** Is this step the first of its stage? That is when the why gets said. */
  function stageStartsHere(index) {
    if (!stepStages) return false;
    return index === 0 || stepStages[index] !== stepStages[index - 1];
  }

  /**
   * Shows step `index`, and moves the cube on screen to match: the display
   * always shows the cube as it stands BEFORE the step being read, so you
   * read the move, press next, and watch that very move happen. Stepping one
   * place swings the turn; jumping about snaps.
   */
  function showStep(index) {
    if (!solutionSteps.length) return;
    const was = currentStepIndex;
    currentStepIndex = Math.max(0, Math.min(index, solutionSteps.length - 1));

    // The books never wait for the picture. The display state is settled here
    // and now, so pressing next faster than the cube can turn, or an old swing
    // landing late, cannot disorder anything -- at worst a swing is skipped.
    const want = currentStepIndex;
    if (want !== shownMoves) {
      const oneOn = want === shownMoves + 1;
      const oneBack = want === shownMoves - 1;
      const token = oneOn ? solutionSteps[shownMoves]
        : oneBack && window.CubeMath ? window.CubeMath.inverse(solutionSteps[want]) : null;
      const seq = ++playbackSeq;
      showDisplayAt(want);
      if (token && cube3d && cube3d.animateMove && !prefersStillness()) {
        // Rewind one frame visually and swing forward to where the books are.
        // If another press has moved things on by the time it lands, the
        // repaint is skipped: the books already repainted for the newer press.
        cube3d.updateColors(facesAfter(oneOn ? want - 1 : want + 1) ||
          (displayFaces || cubeState));
        cube3d.animateMove(token, 450, function () {
          if (seq === playbackSeq) updateCubeViews();
        });
      }
    }
    void was;
    const move = solutionSteps[currentStepIndex];
    const desc = describeMove(move);

    els.currentStepNumber.textContent =
      "Step " + (currentStepIndex + 1) + " of " + solutionSteps.length;
    els.currentStepMove.textContent = desc.notation;
    const stage = stageLabelFor(currentStepIndex);
    const why = stage && stageStartsHere(currentStepIndex) ? stageWhy(stage) : "";
    els.currentStepDesc.innerHTML = (stage
      ? '<span class="stage-tag">' + stage + "</span> " : "") + desc.html +
      (why ? '<span class="stage-why">' + why + "</span>" : "");
    els.stepCounter.textContent = currentStepIndex + 1 + " / " + solutionSteps.length;

    els.btnPrev.disabled = currentStepIndex === 0 && shownMoves === 0;
    els.btnNext.disabled = shownMoves >= solutionSteps.length;

    let stepAt = -1;
    els.stepsListOl.querySelectorAll("li").forEach((li) => {
      if (li.classList.contains("step-stage")) return;   // a heading, not a step
      stepAt += 1;
      li.classList.toggle("is-active", stepAt === currentStepIndex);
    });
  }

  function showSolution(algorithm, stageOf, summary) {
    solutionSteps = algorithm.trim().split(/\s+/).filter(Boolean);
    stepStages = stageOf || null;
    currentStepIndex = 0;
    shownMoves = 0;
    displayFaces = null;
    solutionStart = [];
    FACELETTERS.forEach((face) => {
      cubeState[face].forEach((letter) => { solutionStart.push(letter); });
    });

    els.solutionSummary.textContent = summary ||
      solutionSteps.length +
      (solutionSteps.length === 1 ? " move" : " moves") +
      " to solve your cube. Follow one step at a time on your real cube!";

    els.stepsListOl.innerHTML = "";
    let lastStage = null;
    solutionSteps.forEach((move, i) => {
      if (stepStages && stepStages[i] !== lastStage) {
        lastStage = stepStages[i];
        const heading = document.createElement("li");
        heading.className = "step-stage";
        heading.textContent = lastStage;
        els.stepsListOl.appendChild(heading);
      }
      const li = document.createElement("li");
      li.textContent = i + 1 + ". " + move + " — " + describeMove(move).html.replace(/<[^>]+>/g, "");
      li.addEventListener("click", () => showStep(i));
      els.stepsListOl.appendChild(li);
    });

    els.solutionPanel.hidden = false;
    showStep(0);
  }

  /**
   * The CFOP answer: the same cube solved the way the Learn CFOP page
   * teaches, in named stages. More moves than the computer's answer -- around
   * eighty-five against twenty -- but every one of them belongs to a stage a
   * learner knows the name of, using the very algorithms the lessons teach.
   *
   * The stages come from the CFOP engine, and the whole solution is checked
   * against the painted cube before being shown: if applying it does not end
   * on a solved cube, it is not shown.
   */
  function solveTheTeachingWay(validation, method) {
    const solver = method === "beginner" ? window.LBLSolver : window.CFOPSolver;
    if (!solver || !window.CubeMath) {
      showMessage("That solver has not loaded — try the fewest-moves way.", "error");
      return;
    }
    els.btnSolve.disabled = true;
    els.solverStatus.hidden = false;
    els.solverStatusText.textContent = method === "beginner"
      ? "Solving it layer by layer, the way you would learn first…"
      : "Solving it the CFOP way — cross, pairs, then the top…";

    // A breath, so the status paints before the work starts.
    window.setTimeout(function () {
      const state54 = [];
      FACELETTERS.forEach(function (face) {
        cubeState[face].forEach(function (letter) { state54.push(letter); });
      });

      let solution = null;
      try { solution = solver.solve(state54); } catch (err) { solution = null; }
      els.solverStatus.hidden = true;
      els.btnSolve.disabled = false;

      if (!solution) {
        showMessage(
          "Hmm, this cube state can't be solved — it might be impossible (like a " +
          "sticker that was peeled and put back wrong). Check your colors!", "error");
        els.solutionPanel.hidden = true;
        return;
      }

      // The claim is checked before it is shown, exactly as the fast way is.
      let check = state54;
      solution.stages.forEach(function (stage) {
        if (stage.moves.length) check = window.CubeMath.run(check, stage.moves.join(" ")).state;
      });
      if (!window.CubeMath.isSolved(check)) {
        showMessage("Something went wrong working that out — try the fewest-moves way.", "error");
        els.solutionPanel.hidden = true;
        return;
      }

      const moves = [];
      const stageOf = [];
      solution.stages.forEach(function (stage) {
        stage.moves.forEach(function (m) {
          moves.push(m);
          stageOf.push(stage.label);
        });
      });
      showMessage(method === "beginner"
        ? "Solved layer by layer — lots of moves, hardly anything to remember."
        : "Solved the CFOP way — the stages are labelled as you go.", "success");
      showSolution(moves.join(" "), stageOf,
        moves.length + " moves in " + solution.stages.length + " named stages" +
        (method === "beginner"
          ? " — each stage repeats one or two little patterns."
          : " — the same stages the Learn CFOP page teaches."));
    }, 60);
  }

  function markSolverReady() {
    solverReady = true;
    els.solverStatus.hidden = true;
    els.btnSolve.disabled = false;
  }

  function markSolverFailed(text) {
    els.solverStatus.hidden = false;
    els.solverStatusText.textContent = text;
    els.btnSolve.disabled = true;
  }

  /**
   * Building the solver's lookup tables takes a few seconds. On the main
   * thread that freezes the whole page — no painting, no scrolling, nothing.
   * Run it in a Web Worker instead and keep the page alive while it loads.
   * Workers are blocked on file:// pages, so fall back to this thread there.
   */
  function initSolverOnThisThread() {
    setTimeout(function () {
      try {
        Cube.initSolver();
        markSolverReady();
      } catch (err) {
        markSolverFailed("Could not start the solver. Please refresh the page.");
      }
    }, 50);
  }

  function initSolver() {
    if (typeof Cube === "undefined" || typeof Cube.initSolver !== "function") {
      markSolverFailed("Solver failed to load. Please refresh the page.");
      return;
    }

    els.solverStatus.hidden = false;
    els.solverStatusText.textContent = "Getting the solver ready — you can start painting!";
    els.btnSolve.disabled = true;

    if (!Cube.asyncOK || typeof Cube.asyncInit !== "function") {
      initSolverOnThisThread();
      return;
    }

    let settled = false;
    function fallBackToThisThread() {
      if (settled) return;
      settled = true;
      initSolverOnThisThread();
    }

    try {
      Cube.asyncInit(WORKER_URI, function () {
        if (settled) return;
        settled = true;
        useWorker = true;
        markSolverReady();
      });
    } catch (err) {
      // new Worker() throws outright on file:// pages.
      fallBackToThisThread();
      return;
    }

    // A worker that 404s or throws never calls back, so watch for both.
    if (Cube._worker) {
      Cube._worker.addEventListener("error", fallBackToThisThread);
    }
    setTimeout(fallBackToThisThread, WORKER_TIMEOUT_MS);
  }

  /** Runs the solver in the worker when we have one, otherwise on this thread. */
  function runSolver(faceletString, done) {
    if (useWorker) {
      try {
        Cube.fromString(faceletString).asyncSolve(function (algorithm) {
          done(algorithm);
        });
      } catch (err) {
        done(null);
      }
      return;
    }

    setTimeout(function () {
      try {
        done(Cube.fromString(faceletString).solve());
      } catch (err) {
        done(null);
      }
    }, 30);
  }

  function solveCube() {
    hideMessage();

    const validation = validateState(cubeState);
    if (!validation.valid) {
      showMessage(validation.error, "error");
      els.solutionPanel.hidden = true;
      return;
    }

    if (validation.alreadySolved) {
      showMessage("🎉 Your cube is already solved! Great job!", "success");
      els.solutionPanel.hidden = true;
      return;
    }

    if (!solverReady) {
      showMessage("The solver is still warming up. Wait a few seconds and try again!", "info");
      return;
    }

    const method = els.methods
      ? (els.methods.querySelector("input:checked") || {}).value || "fast"
      : "fast";

    if (method === "cfop" || method === "beginner") {
      solveTheTeachingWay(validation, method);
      return;
    }

    els.btnSolve.disabled = true;
    els.solverStatus.hidden = false;
    els.solverStatusText.textContent = "Finding the best moves…";

    runSolver(validation.faceletString, function (algorithm) {
      els.solverStatus.hidden = true;
      els.btnSolve.disabled = false;

      if (algorithm && algorithm.trim() && solutionActuallyWorks(validation.faceletString, algorithm)) {
        showMessage("Found a solution! Follow the steps one at a time.", "success");
        showSolution(algorithm);
        return;
      }

      showMessage(
        "Hmm, this cube state can't be solved — it might be impossible (like a sticker that was peeled and put back wrong). Check your colors!",
        "error"
      );
      els.solutionPanel.hidden = true;
    });
  }

  /** Safety net: never hand a kid moves that don't actually solve their cube. */
  function solutionActuallyWorks(faceletString, algorithm) {
    try {
      const check = Cube.fromString(faceletString);
      check.move(algorithm);
      return check.isSolved();
    } catch (err) {
      return false;
    }
  }

  function resetCube() {
    cubeState = createSolvedState();
    updateCubeViews();
    hideMessage();
    els.solutionPanel.hidden = true;
    renderPalette();
    liveCheck();
  }

  function scrambleCube() {
    if (typeof Cube === "undefined") return;

    const scrambled = Cube.random();
    const faceletString = scrambled.asString();
    let idx = 0;
    FACELETTERS.forEach((face) => {
      cubeState[face] = faceletString.slice(idx, idx + 9).split("");
      idx += 9;
    });
    updateCubeViews();
    hideMessage();
    els.solutionPanel.hidden = true;
    renderPalette();
    liveCheck();
  }

  els.btnReset.addEventListener("click", resetCube);
  if (els.btnBlank) {
    els.btnBlank.addEventListener("click", function () {
      cubeState = createBlankState();
      updateCubeViews();
      hideMessage();
      els.solutionPanel.hidden = true;
      renderPalette();
      liveCheck();
    });
  }
  els.btnScramble.addEventListener("click", scrambleCube);
  els.btnSolve.addEventListener("click", solveCube);
  els.btnView3d.addEventListener("click", () => setViewMode("3d"));
  els.btnView2d.addEventListener("click", () => setViewMode("2d"));
  els.btnPrev.addEventListener("click", () => {
    // Standing at the first step with a move already played means stepping the
    // cube back rather than the reading.
    if (currentStepIndex === 0 && shownMoves > 0) {
      const seq = ++playbackSeq;
      showDisplayAt(0);
      showStep(0);
      if (cube3d && cube3d.animateMove && !prefersStillness() && window.CubeMath) {
        cube3d.updateColors(facesAfter(1) || cubeState);
        cube3d.animateMove(window.CubeMath.inverse(solutionSteps[0]), 450,
          function () { if (seq === playbackSeq) updateCubeViews(); });
      }
      return;
    }
    showStep(currentStepIndex - 1);
  });
  els.btnNext.addEventListener("click", () => {
    // The last step's own move still deserves watching: the reading stays put
    // and the cube plays it, ending solved.
    if (currentStepIndex === solutionSteps.length - 1 && shownMoves === solutionSteps.length - 1) {
      const seq = ++playbackSeq;
      showDisplayAt(solutionSteps.length);
      els.currentStepDesc.innerHTML =
        "🎉 <strong>That's it — solved!</strong> The cube on screen is now one colour a side.";
      els.btnNext.disabled = true;
      els.btnPrev.disabled = false;
      if (cube3d && cube3d.animateMove && !prefersStillness()) {
        cube3d.updateColors(facesAfter(solutionSteps.length - 1) || cubeState);
        cube3d.animateMove(solutionSteps[solutionSteps.length - 1], 450,
          function () { if (seq === playbackSeq) updateCubeViews(); });
      }
      return;
    }
    showStep(currentStepIndex + 1);
  });
  els.btnToggleList.addEventListener("click", () => {
    const isHidden = els.stepsList.hidden;
    els.stepsList.hidden = !isHidden;
    els.btnToggleList.setAttribute("aria-expanded", String(isHidden));
    els.btnToggleList.textContent = isHidden ? "Hide all steps" : "Show all steps";
  });

  renderPalette();
  liveCheck();
  initViewMode();
  const has3d = initCube3d();
  if (!has3d && viewMode === "3d") {
    viewMode = "2d";
    showMessage("3D view couldn't load. You can still use Flat View!", "info");
  }
  setViewMode(viewMode);
  initSolver();
})();
