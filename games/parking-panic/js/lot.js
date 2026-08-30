/**
 * The car park, and what can move in it.
 *
 * Six squares by six. Every vehicle lies either across or down and can only
 * ever slide along its own length -- cars do not turn, and they do not drive
 * through one another. One of them is red, sits on the row with the way out,
 * and getting it out is the whole game.
 *
 * A lot is written down as thirty-six characters, a dot for empty tarmac and a
 * letter for each vehicle, which makes a puzzle one readable line:
 *
 *     "..OAAP..O..PXX O..P..O...........Q" and so on
 *
 * Nothing here draws anything or listens to a finger. Give it a lot, get back
 * what could move and where it would end up.
 */
(function () {
  "use strict";

  const SIZE = 6;
  const EXIT_ROW = 2;          // the way out is on the right of the third row
  const HERO = "X";

  function at(row, col) { return row * SIZE + col; }

  /** Turns the written line into a list of vehicles. */
  function parse(text) {
    const cells = String(text).replace(/\s+/g, "").split("");
    const seen = {};
    cells.forEach(function (letter, i) {
      if (letter === ".") return;
      const row = Math.floor(i / SIZE), col = i % SIZE;
      if (!seen[letter]) seen[letter] = { id: letter, cells: [] };
      seen[letter].cells.push([row, col]);
    });

    return Object.keys(seen).sort().map(function (letter) {
      const found = seen[letter].cells;
      const rows = found.map(function (c) { return c[0]; });
      const cols = found.map(function (c) { return c[1]; });
      const across = Math.min.apply(null, rows) === Math.max.apply(null, rows);
      return {
        id: letter,
        row: Math.min.apply(null, rows),
        col: Math.min.apply(null, cols),
        len: found.length,
        dir: across ? "h" : "v",
        hero: letter === HERO,
      };
    });
  }

  /** The squares a vehicle is standing on. */
  function cellsOf(car) {
    const out = [];
    for (let i = 0; i < car.len; i++) {
      out.push(car.dir === "h" ? [car.row, car.col + i] : [car.row + i, car.col]);
    }
    return out;
  }

  /** Which square each vehicle is on, so a move can see what is in the way. */
  function occupancy(cars) {
    const grid = new Array(SIZE * SIZE).fill(null);
    cars.forEach(function (car) {
      cellsOf(car).forEach(function (cell) { grid[at(cell[0], cell[1])] = car.id; });
    });
    return grid;
  }

  /** The lot written back out, so two arrangements can be compared. */
  function write(cars) {
    const grid = occupancy(cars);
    return grid.map(function (letter) { return letter || "."; }).join("");
  }

  /** Just the positions, which is all that changes -- a smaller thing to remember. */
  function fingerprint(cars) {
    return cars.map(function (car) {
      return car.dir === "h" ? car.col : car.row;
    }).join(",");
  }

  function copy(cars) {
    return cars.map(function (car) { return Object.assign({}, car); });
  }

  /**
   * Every move available: each vehicle, each distance it could slide either
   * way. A move is one vehicle going as far as you like in one direction,
   * which is how the puzzle has always been counted.
   */
  function moves(cars) {
    const grid = occupancy(cars);
    const out = [];
    cars.forEach(function (car, index) {
      [-1, 1].forEach(function (way) {
        for (let step = 1; step < SIZE; step++) {
          // The square this vehicle would newly cover, going that way.
          const ahead = way < 0
            ? (car.dir === "h" ? [car.row, car.col - step] : [car.row - step, car.col])
            : (car.dir === "h" ? [car.row, car.col + car.len + step - 1]
                               : [car.row + car.len + step - 1, car.col]);
          if (ahead[0] < 0 || ahead[1] < 0 || ahead[0] >= SIZE || ahead[1] >= SIZE) break;
          if (grid[at(ahead[0], ahead[1])]) break;
          out.push({ index: index, id: car.id, way: way, step: step });
        }
      });
    });
    return out;
  }

  /** The lot after a move. The original is left alone. */
  function apply(cars, move) {
    const next = copy(cars);
    const car = next[move.index];
    if (car.dir === "h") car.col += move.way * move.step;
    else car.row += move.way * move.step;
    return next;
  }

  /** Is the red car free? It is out when its nose reaches the right-hand edge. */
  function isOut(cars) {
    const hero = cars.filter(function (car) { return car.hero; })[0];
    if (!hero) return false;
    return hero.col + hero.len === SIZE;
  }

  /** Does this lot make sense at all? Worth knowing before a child sees it. */
  function complain(cars) {
    if (!cars.length) return "There is nothing in the car park.";
    const heroes = cars.filter(function (car) { return car.hero; });
    if (heroes.length !== 1) return "A lot needs exactly one red car.";
    const hero = heroes[0];
    if (hero.dir !== "h") return "The red car has to lie across, towards the way out.";
    if (hero.row !== EXIT_ROW) return "The red car has to be on the row with the way out.";

    const seen = {};
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      if (car.len < 2 || car.len > 3) return car.id + " is not a car or a lorry.";
      const spots = cellsOf(car);
      for (let j = 0; j < spots.length; j++) {
        const spot = spots[j];
        if (spot[0] < 0 || spot[1] < 0 || spot[0] >= SIZE || spot[1] >= SIZE) {
          return car.id + " hangs off the edge of the car park.";
        }
        const name = spot.join(",");
        if (seen[name]) return car.id + " is parked on top of " + seen[name] + ".";
        seen[name] = car.id;
      }
    }
    return "";
  }

  window.Lot = {
    SIZE: SIZE, EXIT_ROW: EXIT_ROW, HERO: HERO,
    at: at, parse: parse, cellsOf: cellsOf, occupancy: occupancy, write: write,
    fingerprint: fingerprint, copy: copy, moves: moves, apply: apply,
    isOut: isOut, complain: complain,
  };
})();
