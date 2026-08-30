/**
 * The flat picture of a cube's top, the way every algorithm sheet draws it.
 *
 * The up face sits in the middle as a three by three, and the four sides are
 * folded down flat around it. Folding matters: the back face has to be drawn
 * reversed, and so does the right, or the picture would show stickers next to
 * each other that are nowhere near each other on the cube.
 *
 * Rather than trust that, the layout is produced as a grid of sticker numbers
 * and the test checks the folding by asking a question with a right answer: the
 * three stickers drawn around any corner of the top face must belong to the
 * same actual corner piece. If a flap were flipped, they would not.
 */
(function () {
  "use strict";

  const C = window.Cube;

  const COLOURS = {
    U: "#ffd500", D: "#ffffff", F: "#009b48", B: "#0046ad", L: "#ff5800", R: "#b71234",
  };
  const DULL = "#8a8580";

  /** Which sticker number is at row, col of a face. */
  const on = function (face, row, col) {
    return C.FACES.indexOf(face) * 9 + row * 3 + col;
  };

  /**
   * The picture as a grid of cells. `rows` is how many rows of each side face
   * to fold out -- one is enough for the last layer, two shows the slots.
   */
  function layout(rows) {
    const deep = rows || 1;
    const width = 3 + deep * 2;
    const height = 3 + deep * 2;
    const grid = [];
    for (let r = 0; r < height; r++) grid.push(new Array(width).fill(null));

    // The up face in the middle.
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) grid[deep + r][deep + c] = { face: "U", at: on("U", r, c) };
    }

    for (let d = 0; d < deep; d++) {
      for (let i = 0; i < 3; i++) {
        // Back folds up, and reverses: its row runs right to left across the top.
        grid[deep - 1 - d][deep + i] = { face: "B", at: on("B", d, 2 - i) };
        // Front folds down and keeps its order.
        grid[deep + 3 + d][deep + i] = { face: "F", at: on("F", d, i) };
        // Right folds out to the right, and reverses going down.
        grid[deep + i][deep + 3 + d] = { face: "R", at: on("R", d, 2 - i) };
        // Left folds out to the left and keeps its order.
        grid[deep + i][deep - 1 - d] = { face: "L", at: on("L", d, i) };
      }
    }
    return { grid: grid, width: width, height: height, deep: deep };
  }

  /**
   * The whole cube unfolded flat: the classic cross, with the top above the
   * front, the bottom below it, and left, front, right and back in a row. All
   * fifty-four stickers, nothing hidden -- which matters most for the first
   * two layers, where the work happens at the bottom.
   *
   * The conventions in cube.js make this fold cleanly: U is read with the back
   * of the cube at the top of the page, so its bottom row meets the front's
   * top row; D is read with the front at the top, so its top row meets the
   * front's bottom row; and the four sides in a row each meet their
   * neighbours edge to edge. The tests check every seam rather than trust it.
   */
  function layoutNet() {
    const grid = [];
    for (let r = 0; r < 9; r++) grid.push(new Array(12).fill(null));
    const place = function (face, atRow, atCol) {
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) grid[atRow + r][atCol + c] = { face: face, at: on(face, r, c) };
      }
    };
    place("U", 0, 3);
    place("L", 3, 0);
    place("F", 3, 3);
    place("R", 3, 6);
    place("B", 3, 9);
    place("D", 6, 3);
    return { grid: grid, width: 12, height: 9, deep: 0, net: true };
  }

  /**
   * An SVG of one cube state.
   *
   *   mode "orient"  yellow where the up colour is showing, dull where it is
   *                  not -- which is how orientation cases are always drawn
   *   mode "colour"  the actual sticker colours, for permutation and slot cases
   */
  function draw(state, opts) {
    const settings = opts || {};
    const plan = settings.net ? layoutNet() : layout(settings.rows);
    const size = settings.size || 22;
    const gap = 2;
    const w = plan.width * (size + gap) + gap;
    const h = plan.height * (size + gap) + gap;
    let svg = '<svg class="cube-diagram" viewBox="0 0 ' + w + " " + h +
      '" role="img" aria-label="' + (settings.label || "A cube from above") + '">';

    plan.grid.forEach(function (row, r) {
      row.forEach(function (cell, c) {
        if (!cell) return;
        const x = gap + c * (size + gap), y = gap + r * (size + gap);
        const colour = settings.mode === "orient"
          ? (state[cell.at] === "U" ? COLOURS.U : DULL)
          : COLOURS[state[cell.at]] || DULL;
        const small = cell.face !== "U";
        svg += '<rect x="' + x + '" y="' + y + '" width="' + size + '" height="' + size +
          '" rx="' + (small ? 3 : 4) + '" fill="' + colour + '"' +
          (small ? ' opacity="0.95"' : "") + " />";
      });
    });

    (settings.arrows || []).forEach(function (arrow) {
      const from = middleOf(plan, arrow[0], size, gap);
      const to = middleOf(plan, arrow[1], size, gap);
      if (!from || !to) return;
      svg += '<line x1="' + from[0] + '" y1="' + from[1] + '" x2="' + to[0] + '" y2="' + to[1] +
        '" class="pll-arrow" marker-end="url(#pll-head)" />';
    });

    if ((settings.arrows || []).length) {
      svg = svg.replace("<svg", "<svg") +
        '<defs><marker id="pll-head" viewBox="0 0 10 10" refX="8" refY="5" ' +
        'markerWidth="5" markerHeight="5" orient="auto-start-reverse">' +
        '<path d="M 0 0 L 10 5 L 0 10 z" class="pll-head" /></marker></defs>';
    }
    return svg + "</svg>";
  }

  /** Where a given sticker sits in the picture, in SVG units. */
  function middleOf(plan, sticker, size, gap) {
    for (let r = 0; r < plan.height; r++) {
      for (let c = 0; c < plan.width; c++) {
        const cell = plan.grid[r][c];
        if (cell && cell.at === sticker) {
          return [gap + c * (size + gap) + size / 2, gap + r * (size + gap) + size / 2];
        }
      }
    }
    return null;
  }

  window.CubeDiagram = { COLOURS: COLOURS, DULL: DULL, layout: layout, layoutNet: layoutNet, draw: draw, middleOf: middleOf };
})();
