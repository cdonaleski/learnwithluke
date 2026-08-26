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
  let viewMode = "3d";
  let cube3d = null;

  let selectedColor = "U";
  let cubeState = createSolvedState();
  let solverReady = false;
  let solutionSteps = [];
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
    btnScramble: document.getElementById("btn-scramble"),
    btnSolve: document.getElementById("btn-solve"),
    btnPrev: document.getElementById("btn-prev-step"),
    btnNext: document.getElementById("btn-next-step"),
    btnToggleList: document.getElementById("btn-toggle-list"),
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

  function paintSticker(faceId, index) {
    if (index === 4) return;
    cubeState[faceId][index] = selectedColor;
    updateCubeViews();
    hideMessage();
    els.solutionPanel.hidden = true;
  }

  function updateCubeViews() {
    if (cube3d) {
      cube3d.updateColors(cubeState);
    }
    if (viewMode === "2d") {
      renderNet();
    }
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
        const color = cubeState[faceId][i];
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
    const match = moveStr.match(/^([URFDLB])(2|'|)?$/);
    if (!match) return null;
    const face = match[1];
    const mod = match[2] || "";
    return { face, mod, notation: face + mod };
  }

  function describeMove(moveStr) {
    const parsed = parseMove(moveStr);
    if (!parsed) return { notation: moveStr, html: moveStr };

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

  function showStep(index) {
    if (!solutionSteps.length) return;
    currentStepIndex = Math.max(0, Math.min(index, solutionSteps.length - 1));
    const move = solutionSteps[currentStepIndex];
    const desc = describeMove(move);

    els.currentStepNumber.textContent =
      "Step " + (currentStepIndex + 1) + " of " + solutionSteps.length;
    els.currentStepMove.textContent = desc.notation;
    els.currentStepDesc.innerHTML = desc.html;
    els.stepCounter.textContent = currentStepIndex + 1 + " / " + solutionSteps.length;

    els.btnPrev.disabled = currentStepIndex === 0;
    els.btnNext.disabled = currentStepIndex === solutionSteps.length - 1;

    els.stepsListOl.querySelectorAll("li").forEach((li, i) => {
      li.classList.toggle("is-active", i === currentStepIndex);
    });
  }

  function showSolution(algorithm) {
    solutionSteps = algorithm.trim().split(/\s+/).filter(Boolean);
    currentStepIndex = 0;

    els.solutionSummary.textContent =
      solutionSteps.length +
      (solutionSteps.length === 1 ? " move" : " moves") +
      " to solve your cube. Follow one step at a time on your real cube!";

    els.stepsListOl.innerHTML = "";
    solutionSteps.forEach((move, i) => {
      const li = document.createElement("li");
      li.textContent = i + 1 + ". " + move + " — " + describeMove(move).html.replace(/<[^>]+>/g, "");
      li.addEventListener("click", () => showStep(i));
      els.stepsListOl.appendChild(li);
    });

    els.solutionPanel.hidden = false;
    showStep(0);
  }

  function initSolver() {
    if (typeof Cube === "undefined" || typeof Cube.initSolver !== "function") {
      els.solverStatus.hidden = false;
      els.solverStatusText.textContent = "Solver failed to load. Check your internet connection and refresh.";
      els.btnSolve.disabled = true;
      return;
    }

    els.solverStatus.hidden = false;
    els.solverStatusText.textContent = "Getting solver ready (this takes a few seconds)…";
    els.btnSolve.disabled = true;

    setTimeout(function () {
      try {
        Cube.initSolver();
        solverReady = true;
        els.solverStatus.hidden = true;
        els.btnSolve.disabled = false;
      } catch (err) {
        els.solverStatusText.textContent = "Could not start the solver. Please refresh the page.";
      }
    }, 50);
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

    els.btnSolve.disabled = true;
    els.solverStatus.hidden = false;
    els.solverStatusText.textContent = "Finding the best moves…";

    setTimeout(function () {
      try {
        const cube = Cube.fromString(validation.faceletString);
        const algorithm = cube.solve();
        if (!algorithm || !algorithm.trim()) {
          throw new Error("empty");
        }

        // Safety net: never hand a kid moves that don't actually solve their cube.
        const check = Cube.fromString(validation.faceletString);
        check.move(algorithm);
        if (!check.isSolved()) {
          throw new Error("solution does not solve this cube");
        }
        els.solverStatus.hidden = true;
        showMessage("Found a solution! Follow the steps on the right.", "success");
        showSolution(algorithm);
      } catch (err) {
        els.solverStatus.hidden = true;
        showMessage(
          "Hmm, this cube state can't be solved — it might be impossible (like a sticker that was peeled and put back wrong). Check your colors!",
          "error"
        );
        els.solutionPanel.hidden = true;
      }
      els.btnSolve.disabled = false;
    }, 30);
  }

  function resetCube() {
    cubeState = createSolvedState();
    updateCubeViews();
    hideMessage();
    els.solutionPanel.hidden = true;
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
  }

  els.btnReset.addEventListener("click", resetCube);
  els.btnScramble.addEventListener("click", scrambleCube);
  els.btnSolve.addEventListener("click", solveCube);
  els.btnView3d.addEventListener("click", () => setViewMode("3d"));
  els.btnView2d.addEventListener("click", () => setViewMode("2d"));
  els.btnPrev.addEventListener("click", () => showStep(currentStepIndex - 1));
  els.btnNext.addEventListener("click", () => showStep(currentStepIndex + 1));
  els.btnToggleList.addEventListener("click", () => {
    const isHidden = els.stepsList.hidden;
    els.stepsList.hidden = !isHidden;
    els.btnToggleList.setAttribute("aria-expanded", String(isHidden));
    els.btnToggleList.textContent = isHidden ? "Hide all steps" : "Show all steps";
  });

  renderPalette();
  initViewMode();
  const has3d = initCube3d();
  if (!has3d && viewMode === "3d") {
    viewMode = "2d";
    showMessage("3D view couldn't load. You can still use Flat View!", "info");
  }
  setViewMode(viewMode);
  initSolver();
})();
