/**
 * Orienting the last layer: all fifty-seven cases.
 *
 * Only the algorithm is written down. The picture is not -- it is worked out by
 * running the algorithm backwards from a solved cube, which is exactly the
 * scramble that produces the case. That means the picture and the algorithm can
 * never disagree, because there is only one of them.
 *
 * There are exactly 57 cases, and that is not an opinion. The last layer has
 * four corners that can each be twisted three ways and four edges that can each
 * be flipped two ways, with the twists having to add to a whole turn and the
 * flips to an even number: 27 × 8 = 216 states. Counting those as the same when
 * one is the other turned round leaves 58, one of which is the solved cube. The
 * tests do that count, and check these 57 land on the other 57 exactly once
 * each -- so a mistyped algorithm shows up as a duplicate or a gap.
 */
(function () {
  "use strict";

  window.OLL = [
    { n: 1, name: "Runway", alg: "R U2 R2 F R F' U2 R' F R F'" },
    { n: 2, name: "Zamboni", alg: "F R U R' U' F' f R U R' U' f'" },
    { n: 3, name: "Anti-Nazi", alg: "f R U R' U' f' U' F R U R' U' F'" },
    { n: 4, name: "Nazi", alg: "f R U R' U' f' U F R U R' U' F'" },
    { n: 5, name: "Wario", alg: "r' U2 R U R' U r" },
    { n: 6, name: "Mario", alg: "r U2 R' U' R U' r'" },
    { n: 7, name: "Lightning", alg: "r U R' U R U2 r'" },
    { n: 8, name: "Reverse lightning", alg: "r' U' R U' R' U2 r" },
    { n: 9, name: "Kite", alg: "R U R' U' R' F R2 U R' U' F'" },
    { n: 10, name: "Anti-kite", alg: "R U R' U R' F R F' R U2 R'" },
    { n: 11, name: "Downstairs", alg: "r U R' U R' F R F' R U2 r'" },
    { n: 12, name: "Upstairs", alg: "M' R' U' R U' R' U2 R U' R r'" },
    { n: 13, name: "Gun", alg: "F U R U' R2 F' R U R U' R'" },
    { n: 14, name: "Anti-gun", alg: "R' F R U R' F' R F U' F'" },
    { n: 15, name: "Squeegee", alg: "r' U' r R' U' R U r' U r" },
    { n: 16, name: "Anti-squeegee", alg: "r U r' R U R' U' r U' r'" },
    { n: 17, name: "Slash", alg: "R U R' U R' F R F' U2 R' F R F'" },
    { n: 18, name: "Crown", alg: "r U R' U R U2 r' r' U' R U' R' U2 r" },
    { n: 19, name: "Bunny", alg: "r' R U R U R' U' r R2 F R F'" },
    { n: 20, name: "Checkers", alg: "r U R' U' M2 U R U' R' U' M'" },
    { n: 21, name: "Double cross", alg: "R U2 R' U' R U R' U' R U' R'" },
    { n: 22, name: "Pi", alg: "R U2 R2 U' R2 U' R2 U2 R" },
    { n: 23, name: "Headlights", alg: "R2 D R' U2 R D' R' U2 R'" },
    { n: 24, name: "Chameleon", alg: "r U R' U' r' F R F'" },
    { n: 25, name: "Bowtie", alg: "F' r U R' U' r' F R" },
    { n: 26, name: "Anti-sune", alg: "R U2 R' U' R U' R'" },
    { n: 27, name: "Sune", alg: "R U R' U R U2 R'" },
    { n: 28, name: "Stealth", alg: "r U R' U' r' R U R U' R'" },
    { n: 29, name: "Spotted chameleon", alg: "R U R' U' R U' R' F' U' F R U R'" },
    { n: 30, name: "Anti-spotted chameleon", alg: "F R' F R2 U' R' U' R U R' F2" },
    { n: 31, name: "Couch", alg: "R' U' F U R U' R' F' R" },
    { n: 32, name: "Anti-couch", alg: "L U F' U' L' U L F L'" },
    { n: 33, name: "Key", alg: "R U R' U' R' F R F'" },
    { n: 34, name: "City", alg: "R U R2 U' R' F R U R U' F'" },
    { n: 35, name: "Fish salad", alg: "R U2 R2 F R F' R U2 R'" },
    { n: 36, name: "Wario's shirt", alg: "L' U' L U' L' U L U L F' L' F" },
    { n: 37, name: "Mounted fish", alg: "F R' F' R U R U' R'" },
    { n: 38, name: "Mario's shirt", alg: "R U R' U R U' R' U' R' F R F'" },
    { n: 39, name: "Big lightning", alg: "L F' L' U' L U F U' L'" },
    { n: 40, name: "Anti-big lightning", alg: "R' F R U R' U' F' U R" },
    { n: 41, name: "Awkward fish", alg: "R U R' U R U2 R' F R U R' U' F'" },
    { n: 42, name: "Anti-awkward fish", alg: "R' U' R U' R' U2 R F R U R' U' F'" },
    { n: 43, name: "Anti-P", alg: "F' U' L' U L F" },
    { n: 44, name: "P", alg: "F U R U' R' F'" },
    { n: 45, name: "T", alg: "F R U R' U' F'" },
    { n: 46, name: "Seein' headlights", alg: "R' U' R' F R F' U R" },
    { n: 47, name: "Breakneck", alg: "R' U' R' F R F' R' F R F' U R" },
    { n: 48, name: "Right back squeezy", alg: "F R U R' U' R U R' U' F'" },
    { n: 49, name: "Right front squishy", alg: "r U' r2 U r2 U r2 U' r" },
    { n: 50, name: "Left back squishy", alg: "r' U r2 U' r2 U' r2 U r'" },
    { n: 51, name: "Bottlecap", alg: "F U R U' R' U R U' R' F'" },
    { n: 52, name: "Rice cooker", alg: "R U R' U R U' B U' B' R'" },
    { n: 53, name: "Frying pan", alg: "l' U2 L U L' U' L U L' U l" },
    { n: 54, name: "Anti-frying pan", alg: "r U2 R' U' R U R' U' R U' r'" },
    { n: 55, name: "Highway", alg: "R' F U R U' R2 F' R2 U R' U' R" },
    { n: 56, name: "Streetlights", alg: "r U r' U R U' R' U R U' R' r U' r'" },
    { n: 57, name: "Mummy", alg: "R U R' U' M' U R U' r'" },
  ];
})();
