/**
 * Corner Last Slot: the last pair's edge is already sitting where it belongs
 * -- CLS only cares about the corner, whether it is still on top waiting to
 * go in, or already in the slot but twisted the wrong way.
 *
 * Forty-four cases, all with a genuine algorithm of their own -- unlike
 * Winter Variation and BLE, this source sheet has no "-> OLL" fallbacks to
 * leave out. Grouped by which way the corner's coloured sticker faces
 * (front, right, or straight up) while it is still on top, and then by the
 * two ways it can be twisted once it is already sitting in the slot.
 */
(function () {
  "use strict";

  window.CLS = [
    { n: 1, group: "Corner sticker facing front", alg: "y R' D R U' R' D' R" },
    { n: 2, group: "Corner sticker facing front", alg: "U' R U' R' U' R U2 R'" },
    { n: 3, group: "Corner sticker facing front", alg: "y' U R' U2 R U' R' U' R" },
    { n: 4, group: "Corner sticker facing front", alg: "U L U' R U L' U' R'" },
    { n: 5, group: "Corner sticker facing front", alg: "R U R' U' R U' R' U R U' R'" },
    { n: 6, group: "Corner sticker facing front", alg: "U' R U' R' U2 R U R' U' R U' R'" },
    { n: 7, group: "Corner sticker facing front", alg: "R U' R U2 R' U' R U' R2" },
    { n: 8, group: "Corner sticker facing front", alg: "U' R U' R' U2 R U' R'" },
    { n: 9, group: "Corner sticker facing front", alg: "U2 l R U' R' U R U' R' U R U' R' U l'" },
    { n: 10, group: "Corner sticker facing front", alg: "y' U' R' U' R U2 R' U' R" },
    { n: 11, group: "Corner sticker facing front", alg: "U' R U' R' U' R U' R' U R U2 R'" },
    { n: 12, group: "Corner sticker facing front", alg: "U R U2 R' U' R U R' U R U R'" },

    { n: 13, group: "Corner sticker facing right", alg: "U R' D' R U' R' D R" },
    { n: 14, group: "Corner sticker facing right", alg: "y' U R' U R U R' U2 R" },
    { n: 15, group: "Corner sticker facing right", alg: "U' R U2 R' U R U2 R' U R U2 R'" },
    { n: 16, group: "Corner sticker facing right", alg: "U' R U2 R' U R U R'" },
    { n: 17, group: "Corner sticker facing right", alg: "R U R' U' R' F' R U R U' R' F" },
    { n: 18, group: "Corner sticker facing right", alg: "U R U L U' R' U L'" },
    { n: 19, group: "Corner sticker facing right", alg: "U' R U R' U' R U' R' U' R U R'" },
    { n: 20, group: "Corner sticker facing right", alg: "y' U R' U R U2 R' U' R U R' U R" },
    { n: 21, group: "Corner sticker facing right", alg: "y' U R' U R U2 R' U R" },
    { n: 22, group: "Corner sticker facing right", alg: "U R U R' U2 R U R'" },

    { n: 23, group: "Corner sticker facing up", alg: "U' R U' R' U R U2 R' U' R U R'" },
    { n: 24, group: "Corner sticker facing up", alg: "y' U' R' U2 R U R' U2 R U R' U2 R" },
    { n: 25, group: "Corner sticker facing up", alg: "y' U R' U' R U R' U' R U' R' U R" },
    { n: 26, group: "Corner sticker facing up", alg: "y' U2 R' U R U' R' U' R U' R' U R" },
    { n: 27, group: "Corner sticker facing up", alg: "U2 R U' R' U R U R' U R U' R'" },
    { n: 28, group: "Corner sticker facing up", alg: "U' R U R' U' R U R' U R U' R'" },
    { n: 29, group: "Corner sticker facing up", alg: "U R U2 R' U' R U2 R' U' R U2 R'" },
    { n: 30, group: "Corner sticker facing up", alg: "U R U' R' U R U' R' U R U' R'" },
    { n: 31, group: "Corner sticker facing up", alg: "y' U' R' U R U' R' U R U' R' U R" },
    { n: 32, group: "Corner sticker facing up", alg: "U' R U R' U' R U R' U2 R U2 R'" },

    { n: 33, group: "Corner in slot, sticker facing front",
      alg: "L' R U R' U' L R U2 R' U' R U R'" },
    { n: 34, group: "Corner in slot, sticker facing front",
      alg: "R U' R' U' R U R' U2 R U' R'" },
    { n: 35, group: "Corner in slot, sticker facing front",
      alg: "R U2 R' U2 R U2 R' U' R U R'" },
    { n: 36, group: "Corner in slot, sticker facing front",
      alg: "y' R' U2 R U' R' U R U' R' U' R" },
    { n: 37, group: "Corner in slot, sticker facing front",
      alg: "R U' R' U' R U R' U' R U2 R'" },
    { n: 38, group: "Corner in slot, sticker facing front",
      alg: "U' R U R' U' R U2 R' U' R U R'" },

    { n: 39, group: "Corner in slot, sticker facing right",
      alg: "U2 R U' R' U R U2 R' L' U R U' R' L" },
    { n: 40, group: "Corner in slot, sticker facing right",
      alg: "U R U2 R U R' U R U2 R2" },
    { n: 41, group: "Corner in slot, sticker facing right",
      alg: "R U' R' U R U2 R' U2 R U2 R'" },
    { n: 42, group: "Corner in slot, sticker facing right",
      alg: "R U2 R' U R U' R' U R U R'" },
    { n: 43, group: "Corner in slot, sticker facing right",
      alg: "U R U' R' U R U2 R' U R U' R'" },
    { n: 44, group: "Corner in slot, sticker facing right",
      alg: "y' R' U R U R' U' R U R' U2 R" },
  ];
})();
