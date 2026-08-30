/**
 * The first two layers, pairing a corner with its edge and putting them in.
 *
 * Each says which slot it fills. The right-hand ones fill the front-right slot;
 * the left-hand ones turn the cube first and so fill the front-left. Both are
 * worth knowing, because turning the whole cube for every pair is slow.
 *
 * The other two slots are these same cases with the cube turned round, which is
 * why learning them once is enough.
 *
 * As with the last layer, only the algorithm is written down; the case is what
 * you get by running it backwards from a solved cube. The tests then insist
 * that running it backwards disturbs the front-right corner and the front-right
 * edge and NOTHING else -- no other slot, no other layer. An algorithm that
 * wrecks a finished slot would be worse than useless, and that is exactly the
 * mistake this catches.
 */
(function () {
  "use strict";

  window.F2L = [
    // --- The pair is already made, sitting on top ---
    { n: 1, group: "Pair already made", name: "Straight in, right",
      note: "The pair is together and facing you. Just tuck it in.",
      slot: "FR", alg: "U R U' R'" },
    { n: 2, group: "Pair already made", name: "Straight in, left",
      note: "The mirror of the last one, going the other way.",
      slot: "FL", alg: "U' L' U L" },
    { n: 3, group: "Pair already made", name: "Round the back",
      note: "The pair is made but pointing the wrong way, so send it round.",
      slot: "FR", alg: "U' R U R'" },
    { n: 4, group: "Pair already made", name: "Round the back, left",
      note: "The mirror again.",
      slot: "FL", alg: "U L' U' L" },

    // --- Corner on top facing up: the awkward ones ---
    { n: 5, group: "Corner facing up", name: "Split, then join",
      note: "The white is on top, so separate them first and rejoin.",
      slot: "FR", alg: "U' R U2 R' U R U' R'" },
    { n: 6, group: "Corner facing up", name: "Split, then join, left",
      slot: "FL", alg: "U L' U2 L U' L' U L" },
    { n: 7, group: "Corner facing up", name: "Three-move set-up",
      slot: "FR", alg: "U' R U R' U R U R'" },
    { n: 8, group: "Corner facing up", name: "Three-move set-up, left",
      slot: "FL", alg: "U L' U' L U' L' U' L" },

    // --- Corner in the slot already, edge on top ---
    { n: 9, group: "Corner already down", name: "Corner in, edge on top",
      note: "The corner is home but the edge is still up there. Pull it out and redo it.",
      slot: "FR", alg: "R U' R' U R U' R' U2 R U' R'" },
    { n: 10, group: "Corner already down", name: "Corner in, edge on top, left",
      slot: "FL", alg: "L' U L U' L' U L U2 L' U L" },
    { n: 11, group: "Corner already down", name: "Corner twisted in place",
      note: "Take the corner out, then treat it like a normal case.",
      slot: "FR", alg: "R U R' U' R U R' U' R U R'" },

    // --- Both pieces in the slot but wrong ---
    { n: 12, group: "Both in, wrongly", name: "Edge in, corner on top",
      note: "The edge is in but flipped, or the pair is in the wrong way round.",
      slot: "FR", alg: "R U' R' U R U' R' U R U' R'" },
    { n: 13, group: "Both in, wrongly", name: "Pair in backwards",
      note: "Both are in the slot but swapped. Take them both out and start again.",
      slot: "FR", alg: "R U' R' U' R U R' U2 R U' R'" },
    { n: 14, group: "Both in, wrongly", name: "Pair in, both turned",
      slot: "FR", alg: "R U' R' U R U2 R' U R U' R'" },

    // --- The two everybody meets first ---
    { n: 15, group: "The common ones", name: "The three-mover",
      note: "The shortest case there is. Learn to spot it.",
      slot: "FR", alg: "R U R'" },
    { n: 16, group: "The common ones", name: "The three-mover, left",
      slot: "FL", alg: "L' U' L" },
    { n: 17, group: "The common ones", name: "Corner up, edge across",
      slot: "FR", alg: "U R U2 R' U R U' R'" },
    { n: 18, group: "The common ones", name: "Corner up, edge across, left",
      slot: "FL", alg: "U' L' U2 L U' L' U L" },
    { n: 19, group: "The common ones", name: "Hidden pair, right",
      slot: "FR", alg: "U2 R U R' U R U' R'" },
    { n: 20, group: "The common ones", name: "Hidden pair, left",
      slot: "FL", alg: "U2 L' U' L U' L' U L" },
  ];
})();
