/**
 * The beginner's method: layer by layer, with as few algorithms as possible.
 *
 * This is how nearly everyone solves their first cube, and its whole point is
 * the trade the other methods refuse: many more moves, far less to remember.
 * Seven little stages, each using one or two short algorithms over and over --
 * so the solution reads like the beginner books teach, repetition and all.
 *
 * Every stage is a bounded loop with a claim, and the claim is checked before
 * the stage hands over: after the corners stage the bottom layer IS done,
 * after the middle edges the first two layers ARE done, and so on. A stage
 * that cannot make its claim good returns failure rather than passing the
 * mess along -- and the tests solve dozens of scrambles and check every claim
 * along the way.
 *
 * It leans on the same verified engine as everything else. Where a piece has
 * to be found and brought round, the bringing round is done by trying the
 * stage's own algorithm under each turn of the top and keeping what works --
 * which is exactly what a beginner does, just faster.
 */
(function () {
  "use strict";

  const C = window.CubeMath;

  const CUBIES = {};
  C.STICKERS.forEach(function (s, i) {
    const k = s.spot.join(",");
    (CUBIES[k] = CUBIES[k] || []).push(i);
  });
  const GROUPS = Object.keys(CUBIES).sort().map(function (k) { return CUBIES[k]; });

  function centreOf(state, faceIndex) { return state[faceIndex * 9 + 4]; }
  function stickerHome(state, i) {
    return state[i] === centreOf(state, Math.floor(i / 9));
  }

  const DOWN = C.FACES.indexOf("D");
  const TOP_STICKERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 18, 19, 20, 36, 37, 38, 45, 46, 47];

  /** Which stickers make up the bottom layer, and the first two layers. */
  const BOTTOM_STICKERS = [];
  const MIDDLE_STICKERS = [];
  for (let f = 1; f < 6; f++) {
    if (f === DOWN) { for (let i = 0; i < 9; i++) BOTTOM_STICKERS.push(f * 9 + i); continue; }
    for (let i = 6; i < 9; i++) BOTTOM_STICKERS.push(f * 9 + i);
    for (let i = 3; i < 6; i++) if (i !== 4) MIDDLE_STICKERS.push(f * 9 + i);
  }

  function bottomDone(state) {
    return BOTTOM_STICKERS.every(function (i) { return stickerHome(state, i); });
  }
  function firstTwoDone(state) {
    return bottomDone(state) && MIDDLE_STICKERS.every(function (i) { return stickerHome(state, i); });
  }
  function crossDone(state) {
    return GROUPS.every(function (g) {
      if (g.length !== 2) return true;
      if (!g.some(function (i) { return C.STICKERS[i].face === "D"; })) return true;
      return g.every(function (i) { return stickerHome(state, i); });
    });
  }


  /**
   * Which colour belongs underneath.
   *
   * In this palette the sticker letter U is white, and white on the bottom is
   * what every beginner book assumes -- including the one Luke is learning
   * from. Our own Learn CFOP diagrams paint the last layer yellow, which says
   * the same thing from the other end. The helper's cube, though, is painted
   * white-up, so a solve that just built on whatever face was down produced a
   * YELLOW cross first and contradicted both.
   */
  const BOTTOM_COLOUR = "U";

  /**
   * The turn that puts white underneath, or null if it is already there.
   * z2 comes first because it keeps the same face towards you -- the child
   * tips the cube over and everything they were looking at is still in front.
   */
  function turnWhiteDown(state) {
    if (centreOf(state, DOWN) === BOTTOM_COLOUR) return null;
    const tries = ["z2", "x2", "x", "x'", "z", "z'", "x z", "x' z"];
    for (let i = 0; i < tries.length; i++) {
      if (centreOf(C.run(state, tries[i]).state, DOWN) === BOTTOM_COLOUR) return tries[i];
    }
    return null;
  }

  /** Runs `alg`, collecting the moves. */
  function play(ctx, alg) {
    ctx.state = C.run(ctx.state, alg).state;
    C.parse(alg).moves.forEach(function (m) {
      ctx.moves.push(m.name + (m.back ? "'" : ""));
    });
  }

  /**
   * Tries the stage's algorithm under each turn of the top, keeping the first
   * that makes `better` true. This is the beginner's own loop -- "turn the top
   * until it lines up, then do the moves" -- done exhaustively.
   */
  function tryOnTop(ctx, algs, better) {
    const pres = ["", "U", "U2", "U'"];
    for (let p = 0; p < pres.length; p++) {
      for (let a = 0; a < algs.length; a++) {
        const whole = (pres[p] ? pres[p] + " " : "") + algs[a];
        const after = C.run(ctx.state, whole).state;
        if (better(after, ctx.state)) { play(ctx, whole); return true; }
      }
    }
    return false;
  }

  /* ---------------- Stage 2: the bottom corners ---------------- */

  /** The corner belonging front-right-down, by the centres. */
  function targetCorner(state) {
    return [centreOf(state, DOWN), centreOf(state, C.FACES.indexOf("F")),
            centreOf(state, C.FACES.indexOf("R"))].sort().join("");
  }

  function cornerSpot(state, want) {
    for (let gi = 0; gi < GROUPS.length; gi++) {
      const g = GROUPS[gi];
      if (g.length !== 3) continue;
      const cols = g.map(function (i) { return state[i]; }).sort().join("");
      if (cols === want) return C.STICKERS[g[0]].spot;
    }
    return null;
  }

  function frCornerHome(state) {
    // The three stickers around the front-right-down corner.
    return [26, 15, 29].every(function (i) { return stickerHome(state, i); });
  }

  /**
   * Seats the front-right bottom corner using nothing but "R U R' U'" -- the
   * one loop every beginner book teaches -- plus turns of the top to bring
   * the corner overhead.
   */
  function seatCorner(ctx) {
    const want = targetCorner(ctx.state);
    for (let guard = 0; guard < 10; guard++) {
      if (frCornerHome(ctx.state)) return true;
      const spot = cornerSpot(ctx.state, want);
      if (!spot) return false;
      if (spot[1] === -1) {
        // Stuck in a bottom slot. If it is the right slot it merely needs
        // turning, and the loop does that too; a wrong slot needs popping up.
        if (spot[0] === 1 && spot[2] === 1) { play(ctx, "R U R' U'"); continue; }
        // Bring that slot to the front-right, pop, and bring the cube back.
        const spin = spot[0] === -1 && spot[2] === 1 ? "y'" : spot[2] === -1 && spot[0] === 1 ? "y" : "y2";
        const back = spin === "y" ? "y'" : spin === "y'" ? "y" : "y2";
        play(ctx, spin + " R U R' U' " + back);
        continue;
      }
      // On top: turn the top until it sits over its slot, then loop it in.
      const over = spot[0] === 1 && spot[2] === 1;
      if (!over) { play(ctx, "U"); continue; }
      play(ctx, "R U R' U'");
    }
    return frCornerHome(ctx.state);
  }

  /* ---------------- Stage 3: the middle edges ---------------- */

  function targetEdge(state) {
    return [centreOf(state, C.FACES.indexOf("F")),
            centreOf(state, C.FACES.indexOf("R"))].sort().join("");
  }

  function edgeSpot(state, want) {
    for (let gi = 0; gi < GROUPS.length; gi++) {
      const g = GROUPS[gi];
      if (g.length !== 2) continue;
      const cols = g.map(function (i) { return state[i]; }).sort().join("");
      if (cols === want) return C.STICKERS[g[0]].spot;
    }
    return null;
  }

  function frEdgeHome(state) {
    return [23, 12].every(function (i) { return stickerHome(state, i); });
  }

  /**
   * The two ways into the front-right slot, and only those. An edge waiting on
   * top can face two ways: side colour on the front face, or side colour on
   * the right face. One insert serves each. (The first draft used the
   * front-LEFT insert as the second algorithm, which of course can never seat
   * the front-right slot -- a flipped edge just went round and round until
   * the guard gave up. The slot both algorithms serve is the whole point.)
   */
  const INSERT_FROM_FRONT = "U R U' R' U' F' U F";
  const INSERT_FROM_RIGHT = "U' F' U F U R U' R'";

  function seatEdge(ctx) {
    for (let guard = 0; guard < 6; guard++) {
      if (frEdgeHome(ctx.state)) return true;
      const spot = edgeSpot(ctx.state, targetEdge(ctx.state));
      if (!spot) return false;
      if (spot[1] !== 1) {
        // Stuck in a middle slot: insert anything into that slot to eject it.
        if (spot[0] === 1 && spot[2] === 1) { play(ctx, INSERT_FROM_FRONT); continue; }
        const spin = spot[0] === -1 && spot[2] === 1 ? "y'" : spot[2] === -1 && spot[0] === 1 ? "y" : "y2";
        const back = spin === "y" ? "y'" : spin === "y'" ? "y" : "y2";
        play(ctx, spin + " " + INSERT_FROM_FRONT + " " + back);
        continue;
      }
      // On top: one of the two inserts, under some turn of the top, seats it.
      if (tryOnTop(ctx, [INSERT_FROM_FRONT, INSERT_FROM_RIGHT], function (after) {
        return frEdgeHome(after) && bottomDone(after);
      })) continue;
      play(ctx, "U");
    }
    return frEdgeHome(ctx.state);
  }

  /* ---------------- Stages 4-7: the top ---------------- */

  /**
   * Finds how to reach `goal` using nothing but the stage's own algorithm and
   * turns of the top -- which is a beginner's entire toolkit for that stage.
   * Breadth-first, so the answer is the fewest applications there is, and a
   * goal that cannot be reached with those tools comes back null instead of
   * looping hopefully.
   *
   * The first draft used make-progress heuristics here instead, and they were
   * fragile in exactly the way heuristics are: the top cross's L-shape and its
   * line both have two edges up, so "did the count improve" rejected the very
   * step the book teaches.
   */
  function searchTop(state, generators, goal, maxDepth) {
    if (goal(state)) return [];
    const seen = new Set([state.join("")]);
    let frontier = [{ s: state, path: [] }];
    for (let depth = 0; depth < maxDepth; depth++) {
      const next = [];
      for (let f = 0; f < frontier.length; f++) {
        const here = frontier[f];
        for (let g = 0; g < generators.length; g++) {
          const s2 = C.run(here.s, generators[g]).state;
          const key = s2.join("");
          if (seen.has(key)) continue;
          seen.add(key);
          const path = here.path.concat([generators[g]]);
          if (goal(s2)) return path;
          next.push({ s: s2, path: path });
        }
      }
      frontier = next;
    }
    return null;
  }

  function playPath(ctx, path) {
    if (!path) return false;
    path.forEach(function (alg) { play(ctx, alg); });
    return true;
  }

  function upColour(state) { return centreOf(state, 0); }

  function topEdgesUp(state) {
    const up = upColour(state);
    return [1, 3, 5, 7].every(function (i) { return state[i] === up; });
  }

  function topCornersUp(state) {
    const up = upColour(state);
    return [0, 2, 6, 8].every(function (i) { return state[i] === up; });
  }

  /** Are the top-layer EDGES each on their own face (given some final U)? */
  function topEdgesPlaced(state) {
    // Each top edge's side sticker must match the centre of the face it is on.
    const spots = [[1, 46], [5, 10], [7, 19], [3, 37]];
    return spots.every(function (pair) {
      return stickerHome(state, pair[1]);
    });
  }

  function topCornersPlaced(state) {
    // Each top corner belongs where it stands: its three colours are the
    // three centres it touches, whichever way round it is turned.
    const corners = [[0, 36, 47], [2, 11, 45], [8, 9, 20], [6, 18, 38]];
    return corners.every(function (spot) {
      const here = spot.map(function (i) { return state[i]; }).sort().join("");
      const want = spot.map(function (i) { return centreOf(state, Math.floor(i / 9)); }).sort().join("");
      return here === want;
    });
  }

  /* ---------------- The whole thing ---------------- */

  const CROSS_MOVES = ["U", "U'", "U2", "D", "D'", "D2", "R", "R'", "R2",
                      "L", "L'", "L2", "F", "F'", "F2", "B", "B'", "B2"];

  function solve(startState) {
    const stages = [];
    const ctx = { state: startState.slice(), moves: [] };

    function stage(id, label, work, claim) {
      ctx.moves = [];
      const ok = work();
      if (!ok || !claim(ctx.state)) return false;
      stages.push({ id: id, label: label, moves: ctx.moves.slice() });
      return true;
    }

    // 0. White underneath first, the way every beginner book starts -- but
    // not on a cube that is already done, which needs no holding advice.
    const spin = C.isSolved(ctx.state) ? null : turnWhiteDown(ctx.state);
    if (spin) {
      ctx.moves = [];
      play(ctx, spin);
      stages.push({ id: "setup", label: "Turn white to the bottom", moves: ctx.moves.slice() });
    }

    // 1. The bottom cross, borrowed from the CFOP solver: the search is the
    // same whichever method you are learning, and its answer is short.
    if (!stage("cross", "The bottom cross", function () {
      const found = window.CFOPSolver ? window.CFOPSolver.solveCross(ctx.state) : null;
      if (found === null) return false;
      if (found.length) play(ctx, found.join(" "));
      return true;
    }, crossDone)) return null;

    // 2. Bottom corners, one slot at a time, R U R' U' and nothing else.
    for (let k = 0; k < 4; k++) {
      if (!stage("corner" + (k + 1), "Bottom corner " + (k + 1) + " of 4", function () {
        if (!seatCorner(ctx)) return false;
        // Only turn to the next slot if there IS a next slot to do. Without
        // this an already-finished bottom still collected three y turns.
        if (k < 3 && !bottomDone(ctx.state)) play(ctx, "y");
        return true;
      }, function (s) { return crossDone(s); })) return null;
    }
    if (!bottomDone(ctx.state)) return null;

    // 3. Middle edges, one slot at a time, the two inserts and nothing else.
    for (let k = 0; k < 4; k++) {
      if (!stage("edge" + (k + 1), "Middle edge " + (k + 1) + " of 4", function () {
        if (!seatEdge(ctx)) return false;
        if (k < 3 && !firstTwoDone(ctx.state)) play(ctx, "y");
        return true;
      }, bottomDone)) return null;
    }
    if (!firstTwoDone(ctx.state)) return null;

    // 4. The top cross: F R U R' U' F' and turns of the top, nothing else.
    if (!stage("topcross", "The top cross", function () {
      return playPath(ctx, searchTop(ctx.state, ["F R U R' U' F'", "U"],
        topEdgesUp, 10));
    }, function (s) { return firstTwoDone(s) && topEdgesUp(s); })) return null;

    // 5. Top edges round to their homes, with the one swap the book teaches.
    if (!stage("topedges", "Top edges round to their homes", function () {
      return playPath(ctx, searchTop(ctx.state, ["R U R' U R U2 R'", "U"],
        function (s) { return topEdgesUp(s) && topEdgesPlaced(s); }, 12));
    }, function (s) {
      return firstTwoDone(s) && topEdgesUp(s) && topEdgesPlaced(s);
    })) return null;

    // 6. Top corners round to their own corners, three cycled at a time.
    if (!stage("topcorners", "Top corners round to their homes", function () {
      return playPath(ctx, searchTop(ctx.state, ["U R U' L' U R' U' L", "U"],
        function (s) {
          return topEdgesUp(s) && topEdgesPlaced(s) && topCornersPlaced(s);
        }, 12));
    }, function (s) {
      return firstTwoDone(s) && topEdgesUp(s) && topEdgesPlaced(s) && topCornersPlaced(s);
    })) return null;

    // 7. Turning the last corners: R' D' R D pairs until each shows the top
    // colour, then the next corner is brought round. The bottom layers look
    // wrecked in between -- the famous moment every beginner book says "do
    // not panic" about -- and come back exactly as the last corner lands.
    if (!stage("orient", "Turning the last corners (do not panic)", function () {
      const up = upColour(ctx.state);
      for (let guard = 0; guard < 40; guard++) {
        if (C.isSolved(ctx.state)) return true;
        if (topCornersUp(ctx.state)) {
          for (let u = 0; u < 4 && !C.isSolved(ctx.state); u++) play(ctx, "U");
          return C.isSolved(ctx.state);
        }
        if (ctx.state[8] === up) { play(ctx, "U"); continue; }
        play(ctx, "R' D' R D R' D' R D");
      }
      return C.isSolved(ctx.state);
    }, C.isSolved)) return null;

    return {
      stages: stages,
      totalMoves: stages.reduce(function (n, s) { return n + s.moves.length; }, 0),
    };
  }

  window.LBLSolver = {
    solve: solve, bottomDone: bottomDone, firstTwoDone: firstTwoDone,
    crossDone: crossDone, topEdgesUp: topEdgesUp, topCornersPlaced: topCornersPlaced,
  };
})();
