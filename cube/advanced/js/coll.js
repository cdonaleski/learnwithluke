/**
 * Corners and Orientation of Last Layer: pair goes in, top gets fully
 * oriented and permuted at once -- provided the last four edges are already
 * oriented, which is the one precondition COLL always assumes.
 *
 * Forty cases in seven groups, named for the corner-permutation shape they
 * leave (Sune, Anti-Sune, L, T, U, Pi, H) -- the same shape names OLL uses,
 * because it is the same seven shapes, just solved a different way. Six
 * cases in each group except H, which only has four: two of H's six
 * orientations are not reachable with the edges already oriented, so the
 * source does not list them and neither does this.
 */
(function () {
  "use strict";

  window.COLL = [
    { n: 1, group: "Sune cases", alg: "R U R' U R U2 R'" },
    { n: 2, group: "Sune cases", alg: "F' R U2 R' U2 R' F2 R U R U' R' F'" },
    { n: 3, group: "Sune cases", alg: "R U' L' U R' U' L" },
    { n: 4, group: "Sune cases", alg: "L' R U R' U' L U2 R U2 R'" },
    { n: 5, group: "Sune cases", alg: "L' U2 L U2 R U' L' U L R'" },
    { n: 6, group: "Sune cases", alg: "y' R U R' U R U' R D R' U' R D' R2" },

    { n: 7, group: "Anti-Sune cases", alg: "y R U2 R' U' R U' R'" },
    { n: 8, group: "Anti-Sune cases", alg: "R U' R' U2 R U' R' U2 R' D' R U R' D R" },
    { n: 9, group: "Anti-Sune cases", alg: "y2 L' U R U' L U R'" },
    { n: 10, group: "Anti-Sune cases", alg: "y2 R L' U' L U R' U2 L' U2 L" },
    { n: 11, group: "Anti-Sune cases", alg: "y2 R U2 R' U2 L' U R U' R' L" },
    { n: 12, group: "Anti-Sune cases", alg: "y R' U' R U' R' U R' D' R U R' D R2" },

    { n: 13, group: "L cases", alg: "y R U R' U R U' R' U R U' R' U R U2 R'" },
    { n: 14, group: "L cases", alg: "y' r U2 R2 F R F' R U2 r'" },
    { n: 15, group: "L cases", alg: "y' R U2 R D R' U2 R D' R2" },
    { n: 16, group: "L cases", alg: "y2 R' U2 R' D' R U2 R' D R2" },
    { n: 17, group: "L cases", alg: "y' F R' F' r U R U' r'" },
    { n: 18, group: "L cases", alg: "F' r U R' U' r' F R" },

    { n: 19, group: "T cases", alg: "R U2 R' U' R U' R2 U2 R U R' U R" },
    { n: 20, group: "T cases", alg: "y2 F R U R' U' R U' R' U' R U R' F'" },
    { n: 21, group: "T cases", alg: "R' U R U2 L' R' U R U' L" },
    { n: 22, group: "T cases", alg: "R' U R2 D r' U2 r D' R2 U' R" },
    { n: 23, group: "T cases", alg: "y l' U' L U R U' r' F" },
    { n: 24, group: "T cases", alg: "y' r U R' U' r' F R F'" },

    { n: 25, group: "U cases", alg: "y2 R U R' U R U2 R2 U' R U' R' U2 R" },
    { n: 26, group: "U cases", alg: "F R U' R' U R U R' U R U' R' F'" },
    { n: 27, group: "U cases", alg: "y2 R2 D R' U2 R D' R' U2 R'" },
    { n: 28, group: "U cases", alg: "R2 D' R U2 R' D R U2 R" },
    { n: 29, group: "U cases", alg: "R' F R U' R' U' R U R' F' R U R' U' R' F R F' R" },
    { n: 30, group: "U cases", alg: "R' U2 R F U' R' U' R U F'" },

    { n: 31, group: "Pi cases", alg: "R U2 R2 U' R2 U' R2 U2 R" },
    { n: 32, group: "Pi cases", alg: "R U D' R U R' D R2 U' R' U' R2 U2 R" },
    { n: 33, group: "Pi cases", alg: "y F U R U' R' U R U' R2 F' R U R U' R'" },
    { n: 34, group: "Pi cases", alg: "R U R' U' R' F R2 U R' U' R U R' U' F'" },
    { n: 35, group: "Pi cases", alg: "y' R U R' U F' R U2 R' U2 R' F R" },
    { n: 36, group: "Pi cases", alg: "y F U R U' R' U R U2 R' U' R U R' F'" },

    { n: 37, group: "H cases", alg: "R U R' U R U' R' U R U2 R'" },
    { n: 38, group: "H cases", alg: "y F R U R' U' R U R' U' R U R' U' F'" },
    { n: 39, group: "H cases", alg: "F R U' R' U R U2 R' U' R U R' U' F'" },
    { n: 40, group: "H cases", alg: "R U R' U R U L' U R' U' L" },
  ];
})();
