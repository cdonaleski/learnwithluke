/**
 * The simulator.
 *
 * This does not pretend. It builds the actual network of the board and solves
 * it the way an engineer would: every join between two squares is a point in
 * the network, every part is something joining two points, and the voltage at
 * every point is found by insisting that whatever current flows into a point
 * flows back out of it again. From those voltages come the current in every
 * single wire, which is what makes two bulbs in a row genuinely dimmer than
 * two side by side rather than merely drawn that way.
 *
 * Wires are given a very small resistance rather than none at all. It costs
 * nothing, and it means every separate strand of a split has a current of its
 * own to show, instead of one lump sum with nowhere to put it.
 *
 * No drawing happens here and nothing is clicked. Give it a board, get back
 * what the electricity does.
 */
(function () {
  "use strict";

  const P = window.CircuitParts;

  const WIRE_OHMS = 0.01;      // near enough to nothing to ignore, enough to divide by
  const SHORT_AMPS = 2.5;      // past this the battery is being asked for far too much

  function key(x, y) { return x + "," + y; }

  /** The name of the join between two touching squares, from either side. */
  function joinName(x, y, dir) {
    const to = P.step(x, y, dir);
    const ax = Math.min(x, to[0]), ay = Math.min(y, to[1]);
    return "j" + ax + "," + ay + (dir === "E" || dir === "W" ? "h" : "v");
  }

  /** The squares a placed part covers, once it has been turned. */
  function occupies(cell, x, y) {
    const part = P.list[cell.part];
    if (!part) return [];
    return (part.spans || [[0, 0]]).map(function (offset) {
      const turned = P.turnOffset(offset, cell.rot || 0);
      return [x + turned[0], y + turned[1]];
    });
  }

  /**
   * Every terminal of a placed part, where it actually is on the board and
   * what the part calls it. This is the one place that knows about turning, so
   * nothing after it has to.
   */
  function placedWires(cell, x, y) {
    const part = P.list[cell.part];
    if (!part) return [];
    const squares = occupies(cell, x, y);
    return part.wires.map(function (w) {
      const square = squares[w.s || 0];
      return { x: square[0], y: square[1], dir: P.turn(w.d, cell.rot || 0), n: w.n };
    });
  }

  /** Where every terminal on the whole board is, keyed by square and side. */
  function terminalMap(board) {
    const map = {};
    board.cells.forEach(function (cell, at) {
      if (cell.link) return;
      const bits = at.split(",");
      placedWires(cell, Number(bits[0]), Number(bits[1])).forEach(function (w) {
        map[w.x + "," + w.y + "," + w.dir] = at;
      });
    });
    return map;
  }

  /**
   * Every place two terminals meet face to face. A terminal pointing off the
   * board, or at a part with nothing on that side, joins nothing and carries
   * nothing -- which is how a circuit comes to be open.
   */
  function joins(board) {
    const terminals = terminalMap(board);
    const found = {};
    Object.keys(terminals).forEach(function (spot) {
      const bits = spot.split(",");
      const x = Number(bits[0]), y = Number(bits[1]), dir = bits[2];
      const to = P.step(x, y, dir);
      const facing = terminals[to[0] + "," + to[1] + "," + P.facing(dir)];
      if (!facing) return;
      if (facing === terminals[spot]) return;      // a part joined to itself is not a join
      found[joinName(x, y, dir)] = true;
    });
    return found;
  }

  /**
   * Turns the board into a list of things joining two points: a resistance, or
   * the battery. This is the whole translation from "squares with pictures on
   * them" into "a circuit", and everything after it is arithmetic.
   */
  function elementsOf(board) {
    const live = joins(board);
    const parts = [];

    board.cells.forEach(function (cell, at) {
      if (cell.link) return;
      const bits = at.split(",");
      const x = Number(bits[0]), y = Number(bits[1]);
      const part = P.list[cell.part];
      if (!part) return;

      const here = {};
      placedWires(cell, x, y).forEach(function (w) {
        const name = joinName(w.x, w.y, w.dir);
        here[w.n || w.dir] = live[name] ? name : null;
      });

      if (part.kind === "wire") {
        // A wire square is a hub: every joined side reaches the middle. Split
        // that way rather than joined side to side, a T or a crossroads divides
        // its current properly instead of lumping it together.
        const middle = "m" + x + "," + y;
        P.DIRS.forEach(function (dir) {
          if (here[dir]) {
            parts.push({ type: "r", a: here[dir], b: middle, ohms: WIRE_OHMS / 2, cell: at, dir: dir });
          }
        });
        return;
      }

      if (part.kind === "load") {
        if (here.a && here.b) parts.push({ type: "r", a: here.a, b: here.b, ohms: part.ohms, cell: at, load: true });
        return;
      }

      if (part.kind === "source") {
        if (here.minus && here.plus) {
          parts.push({ type: "src", a: here.minus, b: here.plus, volts: part.volts, cell: at });
        }
        return;
      }

      // Everything else is a switch, and a switch is nothing but a table of
      // what it joins to what in each of its positions.
      const table = part.joins && part.joins[(cell.state || 0) % part.joins.length];
      (table || []).forEach(function (pair) {
        const a = here[pair[0]], b = here[pair[1]];
        if (a && b) parts.push({ type: "r", a: a, b: b, ohms: WIRE_OHMS, cell: at });
      });
    });

    return parts;
  }

  /** Everything the battery can reach through the parts on the board. */
  function reachable(elements, from) {
    const near = {};
    elements.forEach(function (e) {
      (near[e.a] = near[e.a] || []).push(e.b);
      (near[e.b] = near[e.b] || []).push(e.a);
    });
    const seen = {}, queue = [from];
    seen[from] = true;
    while (queue.length) {
      const node = queue.pop();
      (near[node] || []).forEach(function (next) {
        if (seen[next]) return;
        seen[next] = true;
        queue.push(next);
      });
    }
    return seen;
  }

  /** Gaussian elimination, swapping rows so the biggest number leads. */
  function solveLinear(matrix, rhs) {
    const n = rhs.length;
    for (let col = 0; col < n; col++) {
      let best = col;
      for (let row = col + 1; row < n; row++) {
        if (Math.abs(matrix[row][col]) > Math.abs(matrix[best][col])) best = row;
      }
      if (Math.abs(matrix[best][col]) < 1e-14) return null;    // nothing to pivot on
      if (best !== col) {
        const swap = matrix[best]; matrix[best] = matrix[col]; matrix[col] = swap;
        const r = rhs[best]; rhs[best] = rhs[col]; rhs[col] = r;
      }
      for (let row = col + 1; row < n; row++) {
        const factor = matrix[row][col] / matrix[col][col];
        if (!factor) continue;
        for (let c = col; c < n; c++) matrix[row][c] -= factor * matrix[col][c];
        rhs[row] -= factor * rhs[col];
      }
    }
    const out = new Array(n).fill(0);
    for (let row = n - 1; row >= 0; row--) {
      let sum = rhs[row];
      for (let c = row + 1; c < n; c++) sum -= matrix[row][c] * out[c];
      out[row] = sum / matrix[row][row];
    }
    return out;
  }

  /**
   * What the electricity is doing.
   *
   * Returns the current in every part, whether each bulb is lit and how
   * brightly, and a plain reason when nothing is happening.
   */
  function simulate(board) {
    const elements = elementsOf(board);
    const sources = elements.filter(function (e) { return e.type === "src"; });
    const result = {
      current: {}, flow: {}, lit: {}, amps: 0,
      ok: false, short: false, reason: "",
    };

    const batteries = [];
    board.cells.forEach(function (cell, at) {
      if (P.list[cell.part] && P.list[cell.part].kind === "source") batteries.push(at);
    });
    if (!batteries.length) { result.reason = "no-battery"; return result; }
    if (!sources.length) { result.reason = "battery-loose"; return result; }
    if (sources.length > 1) { result.reason = "too-many-batteries"; return result; }

    const source = sources[0];
    const can = reachable(elements.filter(function (e) { return e.type === "r"; }), source.b);
    if (!can[source.a]) { result.reason = "open"; return result; }

    // The battery's own two ends are the two voltages we already know; every
    // other point in the circuit has to be worked out.
    const fixed = {};
    fixed[source.a] = 0;
    fixed[source.b] = source.volts;

    const unknown = Object.keys(can).filter(function (node) { return !(node in fixed); });
    const index = {};
    unknown.forEach(function (node, i) { index[node] = i; });

    const n = unknown.length;
    const matrix = [], rhs = new Array(n).fill(0);
    for (let i = 0; i < n; i++) matrix.push(new Array(n).fill(0));

    elements.forEach(function (e) {
      if (e.type !== "r") return;
      if (!can[e.a] && !can[e.b]) return;
      const g = 1 / e.ohms;
      [[e.a, e.b], [e.b, e.a]].forEach(function (pair) {
        const here = pair[0], there = pair[1];
        if (!(here in index)) return;
        matrix[index[here]][index[here]] += g;
        if (there in index) matrix[index[here]][index[there]] -= g;
        else if (there in fixed) rhs[index[here]] += g * fixed[there];
      });
    });

    const answer = n ? solveLinear(matrix, rhs) : [];
    if (!answer) { result.reason = "open"; return result; }

    const volts = Object.assign({}, fixed);
    unknown.forEach(function (node, i) { volts[node] = answer[i]; });

    // Current in each part, and how much the battery is being asked for.
    let drawn = 0;
    elements.forEach(function (e) {
      if (e.type !== "r") return;
      if (!(e.a in volts) || !(e.b in volts)) return;
      const amps = (volts[e.a] - volts[e.b]) / e.ohms;
      const at = e.cell + (e.dir ? "|" + e.dir : "");
      result.current[at] = amps;
      result.flow[at] = amps;
      if (e.a === source.b || e.b === source.b) drawn += Math.abs(amps) / 2;
      if (e.load) {
        const part = P.list[board.cells.get(e.cell).part];
        const full = part.volts || source.volts;
        // Brightness follows the power it is actually getting against the power
        // it would get on its own. Two in a row each get half the voltage, so a
        // quarter of the power -- properly dim, not half dim.
        const share = Math.abs(volts[e.a] - volts[e.b]) / full;
        result.lit[e.cell] = Math.max(0, Math.min(1, share * share));
      }
    });

    // Everything the battery pushes out has to come back, so adding up one end
    // and halving gives what it is supplying.
    let outward = 0;
    elements.forEach(function (e) {
      if (e.type !== "r") return;
      if (e.a === source.b) outward += (volts[e.a] - volts[e.b]) / e.ohms;
      else if (e.b === source.b) outward += (volts[e.b] - volts[e.a]) / e.ohms;
    });
    result.amps = outward;
    result.ok = Math.abs(outward) > 1e-6;
    result.short = Math.abs(outward) > SHORT_AMPS;
    if (result.short) result.reason = "short";
    else if (!result.ok) result.reason = "open";
    return result;
  }

  /** Every switch on the board, in reading order, so a run of them is stable. */
  function switchesOf(board) {
    const found = [];
    board.cells.forEach(function (cell, at) {
      if (cell.link) return;
      const part = P.list[cell.part];
      if (!part) return;
      if (part.joins) {
        const bits = at.split(",");
        found.push({ at: at, x: Number(bits[0]), y: Number(bits[1]), kind: part.kind });
      }
    });
    found.sort(function (a, b) { return a.y - b.y || a.x - b.x; });
    return found;
  }

  /** The same board with its switches set a particular way. */
  function withSwitches(board, switches, bits) {
    const cells = new Map();
    board.cells.forEach(function (cell, at) { cells.set(at, Object.assign({}, cell)); });
    switches.forEach(function (s, i) { cells.get(s.at).state = bits[i]; });
    return { w: board.w, h: board.h, cells: cells };
  }

  /**
   * Whether the lamps follow a given rule as the switches are worked.
   *
   *   on    one switch, and it turns the light on and off
   *   and   every switch has to be on
   *   or    any switch on is enough
   *   xor   every switch changes it, whatever the others are doing --
   *         which is exactly what "works from either end of the hall" means
   */
  function followsRule(board, rule) {
    const switches = switchesOf(board);
    if (!switches.length) return { pass: false, why: "no switches" };
    const total = 1 << switches.length;
    for (let combo = 0; combo < total; combo++) {
      const bits = switches.map(function (s, i) { return (combo >> i) & 1; });
      const run = simulate(withSwitches(board, switches, bits));
      const on = Object.keys(run.lit).some(function (at) { return run.lit[at] > 0.02; });
      if (run.short) return { pass: false, why: "short circuit" };

      let want;
      if (rule === "on" || rule === "or") want = bits.some(Boolean);
      else if (rule === "and") want = bits.every(Boolean);
      else if (rule === "xor") want = bits.reduce(function (a, b) { return a ^ b; }, 0) === 1;
      else return { pass: false, why: "unknown rule" };

      if (on !== want) {
        return { pass: false, why: "with switches " + bits.join("") + " the light is " +
          (on ? "on" : "off") + " but should be " + (want ? "on" : "off") };
      }
    }
    return { pass: true, why: "" };
  }

  /** Every load on the board, by square. */
  function loadsOf(board) {
    const found = [];
    board.cells.forEach(function (cell, at) {
      if (cell.link) return;
      const part = P.list[cell.part];
      if (part && part.kind === "load") found.push(at);
    });
    return found;
  }

  /**
   * Whether a board has done what a lesson asked. Judged on what the
   * electricity does, never on where the pieces were put, so any wiring that
   * genuinely works counts -- including ones nobody thought of.
   */
  function goalMet(board, goal) {
    if (!goal) return { pass: false, why: "no goal" };
    if (goal.kind === "rule") return followsRule(board, goal.rule);

    const run = simulate(board);
    if (run.short) return { pass: false, why: "that is a short circuit" };
    const bulbs = loadsOf(board);
    if (!bulbs.length) return { pass: false, why: "nothing to light" };
    // Some lessons are about what happens with more than one, so one on its own
    // -- however brightly it burns -- is not the answer.
    if (goal.least && bulbs.length < goal.least) {
      return { pass: false, why: "this one needs " + goal.least + " bulbs" };
    }
    const level = function (at) { return run.lit[at] || 0; };

    if (goal.kind === "lit") {
      return { pass: bulbs.some(function (b) { return level(b) > 0.02; }), why: "" };
    }
    if (goal.kind === "allLit") {
      return { pass: bulbs.every(function (b) { return level(b) > 0.02; }), why: "" };
    }
    if (goal.kind === "bright") {
      return { pass: bulbs.every(function (b) { return level(b) > 0.85; }), why: "" };
    }
    return { pass: false, why: "unknown goal" };
  }

  window.CircuitEngine = {
    goalMet: goalMet,
    loadsOf: loadsOf,
    simulate: simulate,
    elementsOf: elementsOf,
    joins: joins,
    switchesOf: switchesOf,
    withSwitches: withSwitches,
    followsRule: followsRule,
    occupies: occupies,
    placedWires: placedWires,
    WIRE_OHMS: WIRE_OHMS,
    SHORT_AMPS: SHORT_AMPS,
  };
})();
