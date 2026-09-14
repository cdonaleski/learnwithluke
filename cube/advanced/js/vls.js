/**
 * Valk Last Slot: insert the last pair and orient the top at the same time,
 * for the cases where the edge going into the slot is turned the wrong way.
 *
 * VLS is a genuinely huge set -- this is the curated "easy" subset, forty-two
 * cases grouped by which of the last slot's two pieces (the edge headed for
 * up-front, the edge headed for up-back, or both, or neither of the other
 * two but something else again) is misoriented. Cases that reduce to a plain
 * insert followed by ordinary OLL are left out of the source sheet itself,
 * not trimmed here -- there is nothing to add back.
 */
(function () {
  "use strict";

  window.VLS = [
    { n: 1, group: "UF edge misoriented", alg: "U F' U' F U R U2 R'" },
    { n: 2, group: "UF edge misoriented", alg: "M' U R U' r'" },
    { n: 3, group: "UF edge misoriented", alg: "F2 r U r' F U' R U R'" },
    { n: 4, group: "UF edge misoriented", alg: "y' r' U' R U M'" },
    { n: 5, group: "UF edge misoriented", alg: "R' F R F'" },
    { n: 6, group: "UF edge misoriented", alg: "U R' U' R' F R2 F' R' U R" },

    { n: 7, group: "UB edge misoriented", alg: "y' U R' F' L' U' L F R" },
    { n: 8, group: "UB edge misoriented", alg: "U F' U F R U' R'" },
    { n: 9, group: "UB edge misoriented", alg: "U2 R' F2 L F L' F2 R F'" },
    { n: 10, group: "UB edge misoriented", alg: "y' U2 R2 F R F' R" },
    { n: 11, group: "UB edge misoriented", alg: "U F' L' U2 L U F" },
    { n: 12, group: "UB edge misoriented", alg: "U y F R U' R' F'" },
    { n: 13, group: "UB edge misoriented", alg: "U2 R' F R F' R U2 R'" },
    { n: 14, group: "UB edge misoriented", alg: "U R U' y R U R' U' R U R' U' F'" },
    { n: 15, group: "UB edge misoriented", alg: "U F' U F U R U2 R'" },
    { n: 16, group: "UB edge misoriented", alg: "F' U2 F U R U R'" },
    { n: 17, group: "UB edge misoriented", alg: "U2 R U' R' F' L' U' L F" },

    { n: 18, group: "UL edge misoriented", alg: "U2 R U2 y R U R' U' F'" },
    { n: 19, group: "UL edge misoriented", alg: "R' U' F R F' U' R' U2 R" },
    { n: 20, group: "UL edge misoriented", alg: "R' U' F R F' R' U R" },
    { n: 21, group: "UL edge misoriented", alg: "U R U' x' U L' U L U2 l'" },
    { n: 22, group: "UL edge misoriented", alg: "U R B' U' R' U l U l'" },
    { n: 23, group: "UL edge misoriented", alg: "U F' L' U' L F" },
    { n: 24, group: "UL edge misoriented", alg: "U R U R2 F R F' R U2 R'" },

    { n: 25, group: "UB and UL edges misoriented", alg: "y' U R D r' U' r D' R'" },
    { n: 26, group: "UB and UL edges misoriented", alg: "M U R U' R' U' M'" },
    { n: 27, group: "UB and UL edges misoriented", alg: "U R U' y R U R' U' F'" },
    { n: 28, group: "UB and UL edges misoriented", alg: "U R l U' R' U x U' R'" },
    { n: 29, group: "UB and UL edges misoriented", alg: "U2 r U R' U' M U R U R'" },
    { n: 30, group: "UB and UL edges misoriented", alg: "U2 R U' y R U' R' F'" },
    { n: 31, group: "UB and UL edges misoriented", alg: "U R y R U' R' U R U' R' F'" },

    { n: 32, group: "UB and UF edges misoriented", alg: "U R' F' U' F U R2 U2 R'" },
    { n: 33, group: "UB and UF edges misoriented", alg: "U2 R U' R' U' R' F R F'" },
    { n: 34, group: "UB and UF edges misoriented", alg: "R' F R2 U R' U' F'" },
    { n: 35, group: "UB and UF edges misoriented", alg: "R U' R' F' U' F R U R'" },

    { n: 36, group: "UF and UL edges misoriented", alg: "U R U R' U' R U' R' F R U R' U' F'" },
    { n: 37, group: "UF and UL edges misoriented", alg: "U2 R U' R' U R U' R' U' R' F R F'" },
    { n: 38, group: "UF and UL edges misoriented", alg: "M' U2 R U' R' U R U2 r'" },

    { n: 39, group: "All edges misoriented", alg: "y' r' U' r U2 M U' M'" },
    { n: 40, group: "All edges misoriented", alg: "U2 F' L' U2 L F R U2 R'" },
    { n: 41, group: "All edges misoriented", alg: "U2 R' F R F' U2 R' F R F'" },
    { n: 42, group: "All edges misoriented", alg: "U2 F' U2 F R U' R2 F R F'" },
  ];
})();
