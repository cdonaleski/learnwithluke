/**
 * A cube that can carry out algorithm notation.
 *
 * The moves are not typed in as tables of fifty-four numbers -- that is how you
 * get one digit wrong and never find it. Instead each sticker knows which
 * little cube it is on and which way it faces, and a turn is an actual rotation
 * of those in space. R turns everything with x = 1; the wide r turns x = 1 and
 * the middle slice with it; x turns the whole cube. So the notation falls out
 * of the geometry rather than being asserted.
 *
 * Stickers are numbered the usual way: U 0-8, R 9-17, F 18-26, D 27-35,
 * L 36-44, B 45-53, each face read left to right, top to bottom, as you look
 * at it -- with U read as though the back of the cube were the top of the page,
 * and D as though the front were.
 */
(function () {
  "use strict";

  const FACES = ["U", "R", "F", "D", "L", "B"];
  const NORMALS = {
    U: [0, 1, 0], D: [0, -1, 0], F: [0, 0, 1], B: [0, 0, -1], R: [1, 0, 0], L: [-1, 0, 0],
  };

  /** Where a sticker sits, from its face and its place on that face. */
  function spotOf(face, index) {
    const row = Math.floor(index / 3), col = index % 3;
    if (face === "U") return [col - 1, 1, row - 1];
    if (face === "D") return [col - 1, -1, 1 - row];
    if (face === "F") return [col - 1, 1 - row, 1];
    if (face === "B") return [1 - col, 1 - row, -1];
    if (face === "R") return [1, 1 - row, 1 - col];
    return [-1, 1 - row, col - 1];                    // L
  }

  /** Every sticker, in the usual order, with where it is and which way it looks. */
  const STICKERS = [];
  FACES.forEach(function (face) {
    for (let i = 0; i < 9; i++) {
      STICKERS.push({ face: face, index: i, spot: spotOf(face, i), normal: NORMALS[face] });
    }
  });

  const same = function (a, b) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]; };

  /** Which sticker number is at this place, facing this way. */
  function slotAt(spot, normal) {
    for (let i = 0; i < STICKERS.length; i++) {
      if (same(STICKERS[i].spot, spot) && same(STICKERS[i].normal, normal)) return i;
    }
    return -1;
  }

  /**
   * A quarter turn about one axis. `way` is +1 for the direction that face
   * turns clockwise when you are looking straight at it from outside.
   */
  function spin(point, axis, way) {
    const x = point[0], y = point[1], z = point[2];
    if (axis === "x") return way > 0 ? [x, z, -y] : [x, -z, y];
    if (axis === "y") return way > 0 ? [-z, y, x] : [z, y, -x];
    return way > 0 ? [y, -x, z] : [-y, x, z];         // z
  }

  /**
   * What each move turns: which axis, which slabs of the cube along it, and
   * which way round. A slab is named by its coordinate: 1 is the R, U or F
   * side, -1 the L, D or B side, 0 the middle.
   */
  const TURNS = {
    R: { axis: "x", slabs: [1], way: 1 },
    L: { axis: "x", slabs: [-1], way: -1 },
    U: { axis: "y", slabs: [1], way: 1 },
    D: { axis: "y", slabs: [-1], way: -1 },
    F: { axis: "z", slabs: [1], way: 1 },
    B: { axis: "z", slabs: [-1], way: -1 },
    // Slices, each following the face it is named after in the usual way:
    // M follows L, E follows D, S follows F.
    M: { axis: "x", slabs: [0], way: -1 },
    E: { axis: "y", slabs: [0], way: -1 },
    S: { axis: "z", slabs: [0], way: 1 },
    // Wide turns: the face and the slice beside it, together.
    r: { axis: "x", slabs: [1, 0], way: 1 },
    l: { axis: "x", slabs: [-1, 0], way: -1 },
    u: { axis: "y", slabs: [1, 0], way: 1 },
    d: { axis: "y", slabs: [-1, 0], way: -1 },
    f: { axis: "z", slabs: [1, 0], way: 1 },
    b: { axis: "z", slabs: [-1, 0], way: -1 },
    // Turning the whole cube round.
    x: { axis: "x", slabs: [1, 0, -1], way: 1 },
    y: { axis: "y", slabs: [1, 0, -1], way: 1 },
    z: { axis: "z", slabs: [1, 0, -1], way: 1 },
  };

  const AXIS_OF = { x: 0, y: 1, z: 2 };

  /** The sticker shuffle one turn performs, worked out once and kept. */
  const shuffles = {};
  function shuffleFor(name) {
    if (shuffles[name]) return shuffles[name];
    const turn = TURNS[name];
    const moved = new Array(54);
    STICKERS.forEach(function (sticker, from) {
      if (turn.slabs.indexOf(sticker.spot[AXIS_OF[turn.axis]]) === -1) {
        moved[from] = from;
        return;
      }
      const spot = spin(sticker.spot, turn.axis, turn.way);
      const normal = spin(sticker.normal, turn.axis, turn.way);
      moved[from] = slotAt(spot, normal);
    });
    // moved[from] says where a sticker GOES; invert it so applying is a read.
    const comesFrom = new Array(54);
    moved.forEach(function (to, from) { comesFrom[to] = from; });
    shuffles[name] = comesFrom;
    return comesFrom;
  }

  /** A cube with every face its own colour, which is what solved means. */
  function solved() {
    const out = [];
    FACES.forEach(function (face) {
      for (let i = 0; i < 9; i++) out.push(face);
    });
    return out;
  }

  function turn(state, name) {
    const comesFrom = shuffleFor(name);
    return comesFrom.map(function (from) { return state[from]; });
  }

  /**
   * Reads an algorithm as written: "R U R' U'", "r U R' U' r' F R F'",
   * "(R U R' U') x2" is not understood, but "R U2 R'" is.
   */
  function parse(text) {
    const out = [];
    const bits = String(text || "").replace(/[()]/g, " ").trim().split(/\s+/);
    for (let i = 0; i < bits.length; i++) {
      const bit = bits[i];
      if (!bit) continue;
      const m = /^([UDFBLRMESxyzrludfb])([2']?)$/.exec(bit);
      if (!m) return { error: "I do not understand \"" + bit + "\"." };
      const name = m[1];
      if (!TURNS[name]) return { error: "There is no move called \"" + name + "\"." };
      const times = m[2] === "2" ? 2 : 1;
      const back = m[2] === "'";
      for (let k = 0; k < times; k++) out.push(back ? { name: name, back: true } : { name: name, back: false });
    }
    return { moves: out };
  }

  /** One move, forwards or backwards. Backwards is three of the same. */
  function step(state, move) {
    let next = state;
    const times = move.back ? 3 : 1;
    for (let i = 0; i < times; i++) next = turn(next, move.name);
    return next;
  }

  function run(state, text) {
    const read = parse(text);
    if (read.error) return { error: read.error };
    let next = state.slice();
    read.moves.forEach(function (move) { next = step(next, move); });
    return { state: next, moves: read.moves };
  }

  /** The same algorithm undone: every move backwards, in reverse order. */
  function inverse(text) {
    const read = parse(text);
    if (read.error) return "";
    return read.moves.slice().reverse().map(function (move) {
      return move.name + (move.back ? "" : "'");
    }).join(" ");
  }

  /**
   * How an algorithm is usually written out. Two of the same turn in a row are
   * a half turn, whichever way round they go -- U' U' is U2, and nobody writes
   * it any other way.
   */
  function tidy(text) {
    const read = parse(text);
    if (read.error) return String(text);
    const out = [];
    read.moves.forEach(function (move) {
      const written = move.name + (move.back ? "'" : "");
      if (out.length && out[out.length - 1] === written) {
        out[out.length - 1] = move.name + "2";
        return;
      }
      out.push(written);
    });
    return out.join(" ");
  }

  /** The undoing of an algorithm, written the way anybody would write it. */
  function setupFor(text) {
    return tidy(inverse(text));
  }

  /**
   * The same algorithm done with the other hand: everything reflected in the
   * mirror between R and L. Each move becomes its opposite letter, turned the
   * other way -- R becomes L', U becomes U', and a half turn stays a half turn.
   * An algorithm that fills the front-right slot, mirrored, fills the
   * front-left, which is how one list of cases serves both hands.
   */
  const MIRROR = { R: "L", L: "R", U: "U", D: "D", F: "F", B: "B",
                   r: "l", l: "r", u: "u", d: "d", f: "f", b: "b",
                   M: "M", E: "E", S: "S", x: "x", y: "y", z: "z" };

  function mirror(text) {
    const read = parse(text);
    if (read.error) return "";
    return tidy(read.moves.map(function (move) {
      return MIRROR[move.name] + (move.back ? "" : "'");
    }).join(" "));
  }

  function isSolved(state) {
    for (let f = 0; f < 6; f++) {
      const colour = state[f * 9 + 4];
      for (let i = 0; i < 9; i++) if (state[f * 9 + i] !== colour) return false;
    }
    return true;
  }

  // Named CubeMath rather than Cube because the cube helper page also loads
  // the vendored cubejs solver, which owns the global Cube -- and the two
  // living under one name meant a freshly loaded page called a solved cube
  // impossible. Different jobs, different names.
  window.CubeMath = {
    FACES: FACES, STICKERS: STICKERS, TURNS: TURNS,
    spotOf: spotOf, slotAt: slotAt, shuffleFor: shuffleFor,
    solved: solved, turn: turn, parse: parse, step: step, run: run,
    inverse: inverse, tidy: tidy, setupFor: setupFor, mirror: mirror, isSolved: isSolved,
  };
})();
