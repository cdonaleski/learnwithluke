/**
 * Bubble Shooter — maths levels for Math Mode.
 *
 * ADDING A LEVEL
 * --------------
 * Copy a block below and change the fields. The level picker, the bubble
 * numbers and the problems on the shooter all read from this list, so
 * nothing else needs editing.
 *
 *   id       unique lowercase key, no spaces (used to remember your choice)
 *   name     what the button says
 *   icon     a single emoji shown on the button
 *   values   the six numbers printed on the bubbles — must be exactly six,
 *            and all different
 *   problem  given one of those values, return a sum that works out to it
 *
 * `problem` is called with a value from the list above and must return a
 * string whose answer is EXACTLY that value — that is the whole contract.
 * The board is built from `values`, so a problem that does not match its
 * value would be unsolvable. The offline tests check every level for this.
 */

(function () {
  "use strict";

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Factor pairs of n using single-digit-ish factors, e.g. 12 -> [[2,6],[3,4]] */
function factorPairs(n, maxFactor) {
  const pairs = [];
  for (let a = 2; a <= maxFactor; a++) {
    const b = n / a;
    // Both factors must be real ones — "6 × 1" is not a times-table fact.
    if (n % a === 0 && b >= 2 && b <= maxFactor) pairs.push([a, b]);
  }
  return pairs;
}

window.BubbleMathLevels = [
  {
    id: "add",
    name: "Adding",
    icon: "➕",
    values: [4, 5, 6, 7, 8, 9],
    problem: function (value) {
      const a = randomInt(1, value - 1);
      return a + " + " + (value - a);
    },
  },
  {
    id: "addsub",
    name: "Add & Subtract",
    icon: "➖",
    values: [3, 4, 5, 6, 7, 8],
    problem: function (value) {
      if (Math.random() < 0.5) {
        const a = randomInt(1, value - 1);
        return a + " + " + (value - a);
      }
      const taken = randomInt(1, 9);
      return value + taken + " − " + taken;
    },
  },
  {
    id: "bigger",
    name: "Bigger Sums",
    icon: "🔢",
    values: [10, 11, 12, 13, 14, 15],
    problem: function (value) {
      if (Math.random() < 0.5) {
        const a = randomInt(2, value - 2);
        return a + " + " + (value - a);
      }
      const taken = randomInt(2, 9);
      return value + taken + " − " + taken;
    },
  },
  {
    id: "times",
    name: "Times Tables",
    icon: "✖️",
    values: [6, 8, 12, 16, 18, 24],
    problem: function (value) {
      const pairs = factorPairs(value, 12);
      if (!pairs.length) return value + " × 1";
      const pair = pairs[Math.floor(Math.random() * pairs.length)];
      return pair[0] + " × " + pair[1];
    },
  },
];

})();
