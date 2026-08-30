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
  const MAX_POWER = 40;
  const MAX_ROOTS = 2;          // enough for any sum a person would actually write

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
    if (allowed.indexOf("^") !== -1) {
      if (Math.abs(b) <= MAX_POWER && (a >= 0 || Math.abs(b % 1) < NEARLY)) keep(Math.pow(a, b));
      if (Math.abs(a) <= MAX_POWER && (b >= 0 || Math.abs(a % 1) < NEARLY)) keep(Math.pow(b, a));
    }
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
    const seen = {};

    function walk(list, rootsLeft) {
      const name = list.slice().sort(function (a, b) { return a - b; }).join(",") + "|" + rootsLeft;
      if (seen[name]) return;
      seen[name] = true;

      if (list.length === 1) {
        const value = whole(list[0]);
        if (value !== null) found[value] = true;
        // A root of the very last number counts too: √36 is 6.
        if (rootsLeft > 0 && list[0] >= 0) {
          const rooted = whole(Math.sqrt(list[0]));
          if (rooted !== null) found[rooted] = true;
        }
        return;
      }

      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const rest = list.filter(function (v, k) { return k !== i && k !== j; });
          combine(list[i], list[j], allowed).forEach(function (value) {
            walk(rest.concat([value]), rootsLeft);
          });
        }
      }

      if (rootsLeft > 0 && allowed.indexOf("√") !== -1) {
        for (let i = 0; i < list.length; i++) {
          if (list[i] < 0) continue;
          const rooted = Math.sqrt(list[i]);
          if (!Number.isFinite(rooted)) continue;
          const swapped = list.slice();
          swapped[i] = rooted;
          walk(swapped, rootsLeft - 1);
        }
      }
    }

    walk(dice.slice(), allowed.indexOf("√") !== -1 ? MAX_ROOTS : 0);
    return found;
  }

  /** Which numbers on this board the roll could knock out. */
  function onBoard(dice, allowed, highest) {
    const all = reachable(dice, allowed);
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
    MAX_ROOTS: MAX_ROOTS,
    whole: whole, combine: combine, reachable: reachable,
    onBoard: onBoard, anythingThere: anythingThere,
  };
})();
