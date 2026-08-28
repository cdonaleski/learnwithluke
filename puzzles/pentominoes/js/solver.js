/**
 * Fitting pentominoes into a shape.
 *
 * The method is the obvious one done carefully: find the first empty square,
 * and try every way every unused piece could cover it. One of them has to,
 * because that square must be covered by something -- so nothing is ever
 * tried twice and nothing is ever missed.
 *
 * Two things stop it grinding. Any leftover pocket whose size is not a
 * multiple of five can never be filled, so the moment one appears the whole
 * branch is abandoned. And a piece can be pinned to one particular letter or
 * left free, which is what lets the same code check a child's half-finished
 * board as well as solve an empty one.
 *
 * It is used to prove every puzzle on the page can actually be finished, to
 * give a hint that is guaranteed to be part of a real answer, and to tell a
 * child who is stuck that they have painted themselves into a corner.
 */
(function () {
  "use strict";

  const P = window.Pentominoes;

  function blank(w, h, holes) {
    const grid = new Array(w * h).fill("");
    (holes || []).forEach(function (hole) { grid[hole[1] * w + hole[0]] = "#"; });
    return { w: w, h: h, grid: grid };
  }

  /**
   * Every way a piece could sit so that it covers a particular square, listed
   * once per shape rather than once per position, which is what keeps the
   * search from wandering.
   */
  function placementsCovering(board, letter, tx, ty) {
    const out = [];
    P.PIECES[letter].ways.forEach(function (way, wayIndex) {
      way.forEach(function (anchor) {
        const cells = [];
        for (let i = 0; i < way.length; i++) {
          const x = tx + way[i][0] - anchor[0];
          const y = ty + way[i][1] - anchor[1];
          if (x < 0 || y < 0 || x >= board.w || y >= board.h) return;
          if (board.grid[y * board.w + x] !== "") return;
          cells.push([x, y]);
        }
        out.push({ letter: letter, way: wayIndex, cells: cells });
      });
    });
    return out;
  }

  /** True if every empty pocket could hold a whole number of pieces. */
  function pocketsFit(board) {
    const seen = new Array(board.w * board.h).fill(false);
    for (let start = 0; start < board.grid.length; start++) {
      if (board.grid[start] !== "" || seen[start]) continue;
      let size = 0;
      const queue = [start];
      seen[start] = true;
      while (queue.length) {
        const at = queue.pop();
        size++;
        const x = at % board.w, y = Math.floor(at / board.w);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (step) {
          const nx = x + step[0], ny = y + step[1];
          if (nx < 0 || ny < 0 || nx >= board.w || ny >= board.h) return;
          const next = ny * board.w + nx;
          if (seen[next] || board.grid[next] !== "") return;
          seen[next] = true;
          queue.push(next);
        });
      }
      if (size % 5 !== 0) return false;
    }
    return true;
  }

  /**
   * The order squares are worked through, which matters more than it looks.
   * Filling along the short side of the box keeps the frontier narrow, so
   * there are far fewer ways to carry on and the search stays small. Going the
   * long way instead, a 20 by 3 box takes millions of tries where a 3 by 20
   * takes a few thousand -- the same puzzle, turned on its side.
   */
  function scanOrder(board) {
    const order = [];
    if (board.w > board.h) {
      for (let x = 0; x < board.w; x++) for (let y = 0; y < board.h; y++) order.push(y * board.w + x);
    } else {
      for (let i = 0; i < board.w * board.h; i++) order.push(i);
    }
    return order;
  }

  function firstEmpty(board, order) {
    for (let i = 0; i < order.length; i++) if (board.grid[order[i]] === "") return order[i];
    return -1;
  }

  /**
   * Fills the board using each of `letters` exactly once. Returns the list of
   * placements, or null if it cannot be done. `limit` guards against being
   * asked something unreasonable.
   */
  function solve(board, letters, limit) {
    const budget = { left: limit || 4000000 };
    const left = letters.slice();
    const laid = [];
    const order = scanOrder(board);

    function step() {
      if (budget.left-- <= 0) return null;
      const at = firstEmpty(board, order);
      if (at === -1) return left.length === 0 ? laid.slice() : null;
      if (!left.length) return null;
      if (!pocketsFit(board)) return null;

      const tx = at % board.w, ty = Math.floor(at / board.w);
      for (let i = 0; i < left.length; i++) {
        const letter = left[i];
        const options = placementsCovering(board, letter, tx, ty);
        for (let j = 0; j < options.length; j++) {
          const spot = options[j];
          spot.cells.forEach(function (c) { board.grid[c[1] * board.w + c[0]] = letter; });
          left.splice(i, 1);
          laid.push(spot);
          const done = step();
          if (done) return done;
          laid.pop();
          left.splice(i, 0, letter);
          spot.cells.forEach(function (c) { board.grid[c[1] * board.w + c[0]] = ""; });
        }
      }
      return null;
    }

    return step();
  }

  /** How many different answers there are, counted up to `limit` and no further. */
  function countSolutions(board, letters, limit) {
    let found = 0;
    const left = letters.slice();
    const order = scanOrder(board);

    function step() {
      if (found >= limit) return;
      const at = firstEmpty(board, order);
      if (at === -1) { if (!left.length) found++; return; }
      if (!left.length || !pocketsFit(board)) return;
      const tx = at % board.w, ty = Math.floor(at / board.w);
      for (let i = 0; i < left.length && found < limit; i++) {
        const letter = left[i];
        placementsCovering(board, letter, tx, ty).forEach(function (spot) {
          if (found >= limit) return;
          spot.cells.forEach(function (c) { board.grid[c[1] * board.w + c[0]] = letter; });
          left.splice(i, 1);
          step();
          left.splice(i, 0, letter);
          spot.cells.forEach(function (c) { board.grid[c[1] * board.w + c[0]] = ""; });
        });
      }
    }

    step();
    return found;
  }

  /**
   * Can this half-finished board still be finished? Answering that is what
   * lets the page tell a child they are stuck instead of leaving them to
   * discover it twenty minutes later.
   */
  function stillPossible(board, lettersLeft) {
    const copy = { w: board.w, h: board.h, grid: board.grid.slice() };
    return solve(copy, lettersLeft, 300000) !== null;
  }

  window.PentSolver = {
    blank: blank,
    solve: solve,
    countSolutions: countSolutions,
    stillPossible: stillPossible,
    pocketsFit: pocketsFit,
    placementsCovering: placementsCovering,
  };
})();
