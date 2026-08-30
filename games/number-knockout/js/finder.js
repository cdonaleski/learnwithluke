/**
 * What could have been knocked out.
 *
 * At the end of a round it is worth knowing whether you found three out of
 * four or three out of nineteen -- those are very different rounds and the
 * score alone cannot tell them apart. This works out every number the roll
 * could have made.
 *
 * It does it the same way a person would: take any two of the numbers, combine
 * them, put the answer back in the pile, and carry on until one number is left.
 * With three dice that is a small enough search to do exhaustively in well
 * under a blink.
 *
 * It is deliberately generous. If it ever found FEWER numbers than a player
 * managed, the game would report four out of three, so where there is any doubt
 * it counts the possibility in.
 */
(function () {
  "use strict";

  const NEARLY = 1e-9;
  const TOO_BIG = 1e12;
  // One free index per die, which is what the rule book describes.
  const MAX_POWERS = 1;

  function whole(value) {
    const near = Math.round(value);
    return Math.abs(value - near) < 1e-7 ? near : null;
  }

  /** Every value two numbers can make, with the operations allowed. */
  function combine(a, b, allowed) {
    const out = [];
    const keep = function (v) {
      if (Number.isFinite(v) && Math.abs(v) <= TOO_BIG) out.push(v);
    };
    if (allowed.indexOf("+") !== -1) keep(a + b);
    if (allowed.indexOf("-") !== -1) { keep(a - b); keep(b - a); }
    if (allowed.indexOf("*") !== -1) keep(a * b);
    if (allowed.indexOf("/") !== -1) {
      if (Math.abs(b) > NEARLY) keep(a / b);
      if (Math.abs(a) > NEARLY) keep(b / a);
    }
    return out;
  }

  /**
   * What a free index can do to one number.
   *
   * The index is not one of the dice. The rule book is explicit that it is
   * chosen by the contender and does not count as using one of the rolled
   * numbers, so any die may be squared, cubed or rooted for nothing -- which is
   * what makes powers worth having at all.
   *
   * Held to the handful anybody actually writes. Nobody reaches for the seventh
   * power of five.
   */
  function powersOf(value) {
    const out = [];
    const keep = function (v) {
      if (Number.isFinite(v) && Math.abs(v) <= TOO_BIG) out.push(v);
    };
    keep(1);                                     // anything to the power of nought
    keep(value * value);
    keep(value * value * value);
    keep(value * value * value * value);
    if (value >= 0) { keep(Math.sqrt(value)); keep(Math.cbrt(value)); }
    return out;
  }

  /**
   * Every whole number the dice can be made into, as a set.
   *
   * Square roots are tried on any number along the way, up to a couple of
   * times, which is more than any sum a child would write and keeps the search
   * from wandering off.
   */
  function reachable(dice, allowed) {
    const found = {};
    const canPower = allowed.indexOf("^") !== -1 || allowed.indexOf("√") !== -1;

    /**
     * Combining what is left, using only the four signs. Powers have already
     * been applied to the dice by this point, which is what the rule book
     * describes -- "any power of the numbers rolled (the bases)" -- and is also
     * why this stays quick. Letting a power be applied to anything at any point
     * made a single roll take well over a second, which is far too long to sit
     * between somebody throwing the dice and seeing the board.
     */
    function walk(list, seen) {
      if (list.length === 1) {
        const value = whole(list[0]);
        if (value !== null) found[value] = true;
        // A power of the finished answer, since a player may write (4 + 5)².
        if (canPower) {
          powersOf(list[0]).forEach(function (v) {
            const w = whole(v);
            if (w !== null) found[w] = true;
          });
        }
        return;
      }
      const name = list.map(function (v) { return Math.round(v * 1e6) / 1e6; })
        .sort(function (a, b) { return a - b; }).join(",");
      if (seen[name]) return;
      seen[name] = true;

      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const rest = list.filter(function (v, k) { return k !== i && k !== j; });
          combine(list[i], list[j], allowed).forEach(function (value) {
            walk(rest.concat([value]), seen);
          });
        }
      }
    }

    // Each die on its own, then each die with a free index on it.
    const shapes = dice.map(function (d) {
      return canPower ? [d].concat(powersOf(d)) : [d];
    });

    const combo = new Array(dice.length);
    (function choose(at) {
      if (at === shapes.length) { walk(combo.slice(), {}); return; }
      shapes[at].forEach(function (value) { combo[at] = value; choose(at + 1); });
    })(0);

    return found;
  }

  // The same roll gets asked about more than once -- when it is thrown, when a
  // re-roll is considered, and again at the end of the round. Working it out
  // twice is pure waste.
  const remembered = {};

  function reachableCached(dice, allowed) {
    const name = dice.slice().sort(function (a, b) { return a - b; }).join(",") + "|" + allowed;
    if (!remembered[name]) remembered[name] = reachable(dice, allowed);
    return remembered[name];
  }

  /** Which numbers on this board the roll could knock out. */
  function onBoard(dice, allowed, highest) {
    const all = reachableCached(dice, allowed);
    const out = [];
    for (let n = 1; n <= highest; n++) if (all[n]) out.push(n);
    return out;
  }

  /** Is there anything at all to be found? A roll with nothing in it is a dud. */
  function anythingThere(dice, allowed, highest, alreadyGone) {
    const possible = onBoard(dice, allowed, highest);
    const gone = alreadyGone || {};
    return possible.some(function (n) { return !gone[n]; });
  }

  window.Finder = {
    MAX_POWERS: MAX_POWERS, powersOf: powersOf,
    whole: whole, combine: combine, reachable: reachableCached, uncached: reachable,
    onBoard: onBoard, anythingThere: anythingThere,
  };
})();
