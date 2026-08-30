/**
 * Solving a whole cube the CFOP way, stage by honest stage.
 *
 * The fewest-moves solver answers in about twenty moves that mean nothing to a
 * learner. This one answers the way a person would solve: cross, then each
 * pair of the first two layers, then orient the top, then permute it -- using
 * the very same algorithm sets the Learn CFOP page teaches, so what it tells
 * you to do is what the lessons told you to learn.
 *
 * Every stage checks its own claim before handing over: after the cross stage
 * the four bottom edges ARE home, after each pair that slot IS filled and no
 * finished slot has been wrecked, and so on. A stage that cannot make its
 * claim good reports failure rather than passing the mess along.
 *
 *   cross  breadth-first search over face turns -- the cross is always within
 *          eight moves, and the search proves each one it emits
 *   pairs  the 41-case set, tried under each turn of the top; a piece stuck in
 *          another slot is first popped out with the three-mover
 *   top    the 57 orientations and 21 permutations, matched the same way
 */
(function () {
  "use strict";

  const C = window.CubeMath;

  const FACE_MOVES = ["U", "U'", "U2", "D", "D'", "D2", "R", "R'", "R2",
                      "L", "L'", "L2", "F", "F'", "F2", "B", "B'", "B2"];

  /**
   * The cross search visits tens of thousands of states, and parsing "U2"
   * afresh for every one of them was most of a two-second wait. Each of the
   * eighteen face moves is one fixed shuffle of fifty-four stickers, so they
   * are worked out once and applied as plain array reads.
   */
  const MOVE_TABLE = FACE_MOVES.map(function (text) {
    const face = text[0];
    const once = C.shuffleFor(face);
    const times = text.length === 1 ? 1 : text[1] === "2" ? 2 : 3;
    let table = once;
    for (let k = 1; k < times; k++) {
      const next = new Array(54);
      for (let i = 0; i < 54; i++) next[i] = table[once[i]];
      table = next;
    }
    return table;
  });

  function applyTable(state, table) {
    const out = new Array(54);
    for (let i = 0; i < 54; i++) out[i] = state[table[i]];
    return out;
  }

  /**
   * A whole algorithm is also one fixed shuffle, however many moves it says.
   * Matching a case means trying dozens of algorithms against a state, and
   * parsing "R U R' U' R' F R2 U' R' U' R U R' F'" afresh for each try was
   * where the seconds were going. Composed once, an attempt is 54 array reads.
   */
  const tableCache = {};
  function tableFor(alg) {
    if (tableCache[alg]) return tableCache[alg];
    const moves = C.parse(alg).moves;
    let table = null;
    moves.forEach(function (move) {
      const once = C.shuffleFor(move.name);
      const times = move.back ? 3 : 1;
      for (let k = 0; k < times; k++) {
        if (!table) { table = once.slice(); continue; }
        const next = new Array(54);
        for (let i = 0; i < 54; i++) next[i] = table[once[i]];
        table = next;
      }
    });
    tableCache[alg] = table;
    return table;
  }

  const U_TABLES = [null, tableFor("U"), tableFor("U2"), tableFor("U'")];

  /** Sticker indices grouped by the little cube they sit on. */
  const CUBIES = {};
  C.STICKERS.forEach(function (s, i) {
    const k = s.spot.join(",");
    (CUBIES[k] = CUBIES[k] || []).push(i);
  });

  /**
   * Everything below asks "is this sticker the colour of its face's centre",
   * never "is it the letter F". The difference matters because the whole cube
   * gets turned between pairs: after a y turn the front face wears what used
   * to be the right face's colour, and a check against fixed letters would go
   * hunting for the same pair for ever -- which is exactly the bug this
   * replaced. The centres cannot be moved off their faces, so they are the
   * one fixed thing to measure against.
   */
  function centreOf(state, faceIndex) {
    return state[faceIndex * 9 + 4];
  }

  function stickerHome(state, i) {
    return state[i] === centreOf(state, Math.floor(i / 9));
  }

  const DOWN_FACE = C.FACES.indexOf("D");

  /** The colours of the four bottom-edge pieces, read off the centres. */
  function wantedCrossPairs(state) {
    const down = centreOf(state, DOWN_FACE);
    return ["F", "B", "L", "R"].map(function (side) {
      return [down, centreOf(state, C.FACES.indexOf(side))].sort().join("");
    });
  }

  const EDGE_GROUPS = Object.keys(CUBIES)
    .sort()
    .map(function (k) { return CUBIES[k]; })
    .filter(function (g) { return g.length === 2; });

  function crossKey(state) {
    const wanted = wantedCrossPairs(state);
    const down = centreOf(state, DOWN_FACE);
    // Walked in one fixed order, so the key needs no sorting.
    let out = "";
    for (let e = 0; e < EDGE_GROUPS.length; e++) {
      const g = EDGE_GROUPS[e];
      const a = state[g[0]], b = state[g[1]];
      const cols = a < b ? a + b : b + a;
      const at = wanted.indexOf(cols);
      if (at === -1) { out += "."; continue; }
      out += at + (a === down ? "^" : "v");
    }
    return out;
  }

  /** The twelve stickers of the bottom cross: the D edges and their side halves. */
  const CROSS_STICKERS = [];
  Object.keys(CUBIES).forEach(function (k) {
    const g = CUBIES[k];
    if (g.length === 2 && g.some(function (i) { return C.STICKERS[i].face === "D"; })) {
      g.forEach(function (i) { CROSS_STICKERS.push(i); });
    }
  });

  function crossDone(state) {
    return CROSS_STICKERS.every(function (i) { return stickerHome(state, i); });
  }

  /**
   * The cross, by breadth-first search. The first answer found is the
   * shortest, and it is verified by construction: the search only ever
   * returns a path whose end state passes crossDone.
   */
  function solveCross(state) {
    if (crossDone(state)) return [];
    const seen = new Set([crossKey(state)]);
    let frontier = [{ s: state, path: [], face: "" }];
    for (let depth = 0; depth < 9; depth++) {
      const next = [];
      for (let f = 0; f < frontier.length; f++) {
        const here = frontier[f];
        for (let m = 0; m < FACE_MOVES.length; m++) {
          // Two turns of the same face in a row are always one turn written
          // longer, so the search never takes them -- which trims the deepest
          // crosses from seconds to well under one.
          if (FACE_MOVES[m][0] === here.face) continue;
          const s2 = applyTable(here.s, MOVE_TABLE[m]);
          const key = crossKey(s2);
          if (seen.has(key)) continue;
          seen.add(key);
          const path = here.path.concat([FACE_MOVES[m]]);
          if (crossDone(s2)) return path;
          next.push({ s: s2, path: path, face: FACE_MOVES[m][0] });
        }
      }
      frontier = next;
    }
    return null;
  }

  /* ---------------- The first two layers ---------------- */

  const SLOT_STICKERS = [29, 26, 15, 23, 12];       // the front-right pair, solved colours DDFFR... by index
  const TOP_STICKERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 18, 19, 20, 36, 37, 38, 45, 46, 47];

  function slotSolved(state) {
    return SLOT_STICKERS.every(function (i) { return stickerHome(state, i); });
  }

  function firstTwoDone(state) {
    for (let f = 1; f < 6; f++) {
      for (let i = 3; i < 9; i++) {
        if (!stickerHome(state, f * 9 + i)) return false;
      }
    }
    return crossDone(state);
  }

  /** The colours of the pair that belongs front-right, read off the centres. */
  function wantedPair(state) {
    const d = centreOf(state, DOWN_FACE);
    const f = centreOf(state, C.FACES.indexOf("F"));
    const r = centreOf(state, C.FACES.indexOf("R"));
    return { corner: [d, f, r].sort().join(""), edge: [f, r].sort().join("") };
  }

  /** Is either piece of the front-right pair sitting in some OTHER slot? */
  function pairStuckElsewhere(state) {
    const want = wantedPair(state);
    const groups = Object.keys(CUBIES).map(function (k) { return CUBIES[k]; });
    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi];
      const cols = g.map(function (i) { return state[i]; }).sort().join("");
      if (cols !== want.corner && cols !== want.edge) continue;
      const spot = C.STICKERS[g[0]].spot;
      if (spot[1] === 1) continue;                        // on top: fine
      if (spot[0] === 1 && spot[2] === 1) continue;       // in its own slot: fine
      return true;
    }
    return false;
  }

  /**
   * Fills the front-right slot: turn the top until one of the 41 cases
   * matches, popping stuck pieces out of other slots first. Everything here is
   * relative -- the caller has already turned the whole cube so the slot being
   * worked on IS the front-right.
   */
  function fillFrontRight(state) {
    const moves = [];
    let here = state;
    let guard = 0;

    while (!slotSolved(here) && guard++ < 6) {
      if (pairStuckElsewhere(here)) {
        // Pop it out: turn the cube so that slot is at the front-right, do the
        // three-mover, and turn back. y turns are free to say and cheap to do.
        for (let y = 1; y < 4 && pairStuckElsewhere(here); y++) {
          const spin = y === 1 ? "y" : y === 2 ? "y2" : "y'";
          const back = y === 1 ? "y'" : y === 2 ? "y2" : "y";
          const trial = C.run(here, spin).state;
          // The pair we are hunting is named by its colours, and colours do
          // not change when the cube is turned -- so the want is read off the
          // centres BEFORE the spin. Reading it after would name the pair that
          // belongs in the spun frame's own slot: a different piece, and the
          // bug that had the hunt walking straight past its quarry.
          const hunting = wantedPair(here);
          const groups = Object.keys(CUBIES).map(function (k) { return CUBIES[k]; });
          const inFR = groups.some(function (g) {
            const cols = g.map(function (i) { return trial[i]; }).sort().join("");
            if (cols !== hunting.corner && cols !== hunting.edge) return false;
            const spot = C.STICKERS[g[0]].spot;
            return spot[1] !== 1 && spot[0] === 1 && spot[2] === 1;
          });
          if (!inFR) continue;
          [spin, "R", "U", "R'", back].forEach(function (m) { moves.push(m); });
          here = C.run(here, spin + " R U R' " + back).state;
        }
        continue;
      }

      // On top, or in its own slot: one of the 41, under some turn of the top.
      let done = false;
      for (let u = 0; u < 4 && !done; u++) {
        const pre = u === 0 ? "" : u === 1 ? "U" : u === 2 ? "U2" : "U'";
        const start = u === 0 ? here : applyTable(here, U_TABLES[u]);
        for (let a = 0; a < window.F2L.length && !done; a++) {
          const alg = window.F2L[a].alg;
          const after = applyTable(start, tableFor(alg));
          if (!slotSolved(after)) continue;
          // The case set only touches its own slot, but check anyway: every
          // stage makes its claim good before handing over.
          let wrecked = false;
          for (let i = 0; i < 54; i++) {
            if (TOP_STICKERS.indexOf(i) !== -1 || SLOT_STICKERS.indexOf(i) !== -1) continue;
            if (after[i] !== here[i]) { wrecked = true; break; }
          }
          if (wrecked) continue;
          if (pre) moves.push(pre);
          C.parse(alg).moves.forEach(function (mv) {
            moves.push(mv.name + (mv.back ? "'" : ""));
          });
          here = after;
          done = true;
        }
      }
      if (!done) return null;
    }
    return slotSolved(here) ? { moves: moves, state: here } : null;
  }

  /* ---------------- The last layer ---------------- */

  function topOriented(state) {
    const up = centreOf(state, 0);
    for (let i = 0; i < 9; i++) if (state[i] !== up) return false;
    return true;
  }

  /** Match-and-apply from a case list, under each turn of the top. */
  function matchOnTop(state, list, check) {
    for (let u = 0; u < 4; u++) {
      const pre = u === 0 ? [] : u === 1 ? ["U"] : u === 2 ? ["U2"] : ["U'"];
      const start = u === 0 ? state : applyTable(state, U_TABLES[u]);
      for (let a = 0; a < list.length; a++) {
        const after = applyTable(start, tableFor(list[a].alg));
        if (!check(after)) continue;
        const moves = pre.slice();
        C.parse(list[a].alg).moves.forEach(function (mv) {
          moves.push(mv.name + (mv.back ? "'" : ""));
        });
        return { moves: moves, state: after, name: list[a].name || list[a].id };
      }
    }
    return null;
  }

  /* ---------------- The whole thing ---------------- */

  /**
   * A full CFOP solution, as named stages of plain moves. Returns null only if
   * the cube is not a possible cube -- and the caller has already checked that.
   */
  function solve(startState) {
    const stages = [];
    let here = startState.slice();

    const cross = solveCross(here);
    if (cross === null) return null;
    here = cross.length ? C.run(here, cross.join(" ")).state : here;
    if (!crossDone(here)) return null;
    stages.push({ id: "cross", label: "The cross", moves: cross });

    // Four pairs. Turn the whole cube so each slot in turn is at the front
    // right; the y turns are part of the instructions, as they are in life.
    for (let slot = 0; slot < 4; slot++) {
      // Nothing left to do means nothing left to say. Without this, a cube
      // whose layers were already finished was told to turn itself round
      // three times for no reason at all.
      if (firstTwoDone(here)) {
        stages.push({ id: "pair" + (slot + 1),
                      label: "Pair " + (slot + 1) + " of 4 — already done", moves: [] });
        continue;
      }
      const filled = fillFrontRight(here);
      if (!filled) return null;
      here = filled.state;
      const moves = filled.moves;
      if (slot < 3 && !firstTwoDone(here)) { moves.push("y"); here = C.run(here, "y").state; }
      stages.push({ id: "pair" + (slot + 1), label: "Pair " + (slot + 1) + " of 4", moves: moves });
    }
    if (!firstTwoDone(here)) return null;

    if (!topOriented(here)) {
      const oll = matchOnTop(here, window.OLL, topOriented);
      if (!oll) return null;
      here = oll.state;
      stages.push({ id: "oll", label: "Orient the top (" + oll.name + ")", moves: oll.moves });
    } else {
      stages.push({ id: "oll", label: "Orient the top — already done", moves: [] });
    }

    if (!C.isSolved(here)) {
      // A permutation may need the top turned afterwards as well as before.
      let done = null;
      for (let after = 0; after < 4 && !done; after++) {
        const tail = after === 0 ? [] : after === 1 ? ["U"] : after === 2 ? ["U2"] : ["U'"];
        done = matchOnTop(here, window.PLL, function (s) {
          const finished = tail.length ? C.run(s, tail[0]).state : s;
          return C.isSolved(finished);
        });
        if (done) {
          here = tail.length ? C.run(done.state, tail[0]).state : done.state;
          stages.push({ id: "pll", label: "Move the top pieces home (" + done.name + ")",
                        moves: done.moves.concat(tail) });
        }
      }
      if (!done) {
        // Only a turn of the top left.
        for (let u = 1; u < 4; u++) {
          const m = u === 1 ? "U" : u === 2 ? "U2" : "U'";
          if (C.isSolved(C.run(here, m).state)) {
            here = C.run(here, m).state;
            stages.push({ id: "pll", label: "Straighten the top", moves: [m] });
            break;
          }
        }
      }
    } else {
      stages.push({ id: "pll", label: "Move the top pieces home — already done", moves: [] });
    }

    if (!C.isSolved(here)) return null;
    return { stages: stages,
             totalMoves: stages.reduce(function (n, s) { return n + s.moves.length; }, 0) };
  }

  window.CFOPSolver = {
    solve: solve, solveCross: solveCross, crossDone: crossDone,
    firstTwoDone: firstTwoDone, fillFrontRight: fillFrontRight, topOriented: topOriented,
  };
})();
