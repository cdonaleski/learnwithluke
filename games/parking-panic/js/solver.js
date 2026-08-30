/**
 * Working out whether a jam can be cleared, and in how few moves.
 *
 * Breadth first, so the first way out it finds is the shortest one there is.
 * Every arrangement it has already seen is remembered, because a car park has
 * far fewer genuinely different arrangements than it has sequences of moves --
 * without that the search would wander round in circles for ever.
 *
 * It earns its place three times over: no puzzle can ship unless this has
 * solved it, the page can tell a child the fewest moves possible, and the hint
 * button plays one move from a shortest solution rather than guessing.
 */
(function () {
  "use strict";

  const L = window.Lot;
  const GIVE_UP = 400000;      // far beyond any real jam; a guard, not a limit

  /**
   * The shortest way out, as a list of moves, or null if there is no way out.
   * Also hands back how many arrangements it had to look at, which is a decent
   * measure of how hard a jam actually is.
   */
  function solve(cars) {
    const start = L.fingerprint(cars);
    if (L.isOut(cars)) return { moves: [], looked: 1 };

    const cameFrom = {};
    cameFrom[start] = null;
    let edge = [cars];
    let looked = 1;

    while (edge.length) {
      const next = [];
      for (let i = 0; i < edge.length; i++) {
        const here = edge[i];
        const hereName = L.fingerprint(here);
        const options = L.moves(here);

        for (let m = 0; m < options.length; m++) {
          const after = L.apply(here, options[m]);
          const name = L.fingerprint(after);
          if (cameFrom[name] !== undefined) continue;
          cameFrom[name] = { from: hereName, move: options[m] };
          looked++;
          if (L.isOut(after)) return { moves: retrace(cameFrom, name), looked: looked };
          if (looked > GIVE_UP) return { moves: null, looked: looked, gaveUp: true };
          next.push(after);
        }
      }
      edge = next;
    }
    return { moves: null, looked: looked };
  }

  function retrace(cameFrom, name) {
    const path = [];
    let at = name;
    while (cameFrom[at]) {
      path.push(cameFrom[at].move);
      at = cameFrom[at].from;
    }
    return path.reverse();
  }

  /** The fewest moves that can clear this jam, or null if it cannot be cleared. */
  function fewestMoves(cars) {
    const found = solve(cars);
    return found.moves ? found.moves.length : null;
  }

  /**
   * One move from a shortest way out of wherever the child has got to.
   *
   * Worked out from the lot in front of them, not read from a stored answer, so
   * a hint always fits what they have actually done -- and if they have jammed
   * themselves solid it says so rather than pretending.
   */
  function nextMove(cars) {
    const found = solve(cars);
    if (!found.moves) return null;
    return found.moves[0] || null;
  }

  window.LotSolver = { GIVE_UP: GIVE_UP, solve: solve, fewestMoves: fewestMoves, nextMove: nextMove };
})();
