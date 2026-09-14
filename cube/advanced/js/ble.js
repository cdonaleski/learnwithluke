/**
 * Brooks' Last Edge: break the last F2L pair back apart on purpose, solve
 * the top, then put the pair back together -- useful exactly when the last
 * slot's edge is going to need flipping anyway, so flipping it as part of
 * getting the corners oriented costs nothing extra.
 *
 * Source lists 27 recognised patterns across seven groups and marks the ones
 * with no special shortcut "-> OLL": break the pair up, solve it as an
 * ordinary OLL, and stop. Same situation as Winter Variation and for the
 * same reason those are not kept as cases here -- this trainer draws a
 * case's picture by running ITS OWN algorithm backwards, and an "-> OLL"
 * entry has no algorithm of its own, only "do the normal thing". Nineteen of
 * the 27 have a genuine one-algorithm answer; those are what is here.
 */
(function () {
  "use strict";

  window.BLE = [
    { n: 1, group: "H cases and corners already oriented",
      alg: "U' R U' R' U' R U R' U R U R'" },
    { n: 2, group: "H cases and corners already oriented",
      alg: "R U' R' U' R U' R' U R U R'" },
    { n: 3, group: "H cases and corners already oriented",
      alg: "U R U' R' U' R U2 R' U R U R'" },

    { n: 4, group: "Sune cases", alg: "R U R' U2 R U R' U2 R U' R'" },
    { n: 5, group: "Sune cases", alg: "U' R U' R' U R U R' U R U2 R' U R U R'" },
    { n: 6, group: "Sune cases", alg: "U R U' R' U R U R' U2 R U R'" },

    { n: 7, group: "Anti-Sune cases", alg: "U' F' R U R2 U' R' F R U R" },
    { n: 8, group: "Anti-Sune cases", alg: "U' R U' R' U2 R U' R' U' R U R'" },
    { n: 9, group: "Anti-Sune cases", alg: "U' R U R' U2 R U' R' U2 R U' R'" },

    { n: 10, group: "L cases", alg: "U R U' R' U y' R' U R U R' U2 R" },
    { n: 11, group: "L cases", alg: "U' F' R U R' U' R' F R" },
    { n: 12, group: "L cases", alg: "U2 R U2 R' U' y' R' U2 R U' R' U' R" },

    { n: 13, group: "T cases", alg: "R' F' R U R U' R' F" },

    { n: 14, group: "U cases", alg: "U' R' D' R U' R' D R U R U R'" },
    { n: 15, group: "U cases", alg: "U R U' R' U' R' D' R U R' D R" },

    { n: 16, group: "Pi cases", alg: "R U2 R' U R U2 R' U' R U2 R'" },
    { n: 17, group: "Pi cases", alg: "R U R' U2 R U R' U' R U2 R'" },
    { n: 18, group: "Pi cases", alg: "U2 R U2 R' U R U' R' U2 R U' R'" },
    { n: 19, group: "Pi cases", alg: "U2 R U R' U2 R U2 R' U2 R U' R'" },
  ];
})();
