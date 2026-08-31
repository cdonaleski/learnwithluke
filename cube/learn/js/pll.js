/**
 * Permuting the last layer: all twenty-one cases.
 *
 * As with the orientations, only the algorithm is written down and the case is
 * worked out by running it backwards from a solved cube. A permutation
 * algorithm must leave every sticker's colour facing the same way it did and
 * only move the pieces about, which is a strong thing to be able to check.
 *
 * There are exactly 21, and the tests prove it rather than take it on trust:
 * they work outwards from a solved cube using these algorithms until they have
 * found every arrangement the last layer can be in, then count how many of
 * those are genuinely different once you allow for turning the top face before
 * and after. That count has to come to 21, and these 21 have to be one of each.
 */
(function () {
  "use strict";

  window.PLL = [
    { id: "Aa", name: "A permutation (a)", group: "Corners only",
      alg: "x L2 D2 L' U' L D2 L' U L' x'" },
    { id: "Ab", name: "A permutation (b)", group: "Corners only",
      alg: "x' L2 D2 L U L' D2 L U' L x" },
    { id: "E", name: "E permutation", group: "Corners only",
      alg: "x' L' U L D' L' U' L D L' U' L D' L' U L D x" },
    { id: "F", name: "F permutation", group: "Edges and corners",
      alg: "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R" },
    { id: "Ga", name: "G permutation (a)", group: "Edges and corners",
      alg: "R2 U R' U R' U' R U' R2 U' D R' U R D'" },
    { id: "Gb", name: "G permutation (b)", group: "Edges and corners",
      alg: "R' U' R U D' R2 U R' U R U' R U' R2 D" },
    { id: "Gc", name: "G permutation (c)", group: "Edges and corners",
      alg: "R2 U' R U' R U R' U R2 U D' R U' R' D" },
    { id: "Gd", name: "G permutation (d)", group: "Edges and corners",
      alg: "R U R' U' D R2 U' R U' R' U R' U R2 D'" },
    { id: "H", name: "H permutation", group: "Edges only",
      alg: "M2 U M2 U2 M2 U M2" },
    { id: "Ja", name: "J permutation (a)", group: "Edges and corners",
      alg: "x R2 F R F' R U2 r' U r U2 x'" },
    { id: "Jb", name: "J permutation (b)", group: "Edges and corners",
      alg: "R U R' F' R U R' U' R' F R2 U' R' U'" },
    { id: "Na", name: "N permutation (a)", group: "Edges and corners",
      alg: "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'" },
    { id: "Nb", name: "N permutation (b)", group: "Edges and corners",
      alg: "r' D' F r U' r' F' D r2 U r' U' r' F r F'" },
    { id: "Ra", name: "R permutation (a)", group: "Edges and corners",
      alg: "R U' R' U' R U R D R' U' R D' R' U2 R' U'" },
    { id: "Rb", name: "R permutation (b)", group: "Edges and corners",
      alg: "R2 F R U R U' R' F' R U2 R' U2 R" },
    { id: "T", name: "T permutation", group: "Edges and corners",
      alg: "R U R' U' R' F R2 U' R' U' R U R' F'" },
    { id: "Ua", name: "U permutation (a)", group: "Edges only",
      alg: "M2 U M U2 M' U M2" },
    { id: "Ub", name: "U permutation (b)", group: "Edges only",
      alg: "M2 U' M U2 M' U' M2" },
    { id: "V", name: "V permutation", group: "Edges and corners",
      alg: "R' U R' U' y R' F' R2 U' R' U R' F R F y'" },
    { id: "Y", name: "Y permutation", group: "Edges and corners",
      alg: "F R U' R' U' R U R' F' R U R' U' R' F R F'" },
    { id: "Z", name: "Z permutation", group: "Edges only",
      alg: "M' U M2 U M2 U M' U2 M2" },
  ];
})();
