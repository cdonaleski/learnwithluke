/**
 * Winter Variation: catching the last slot when inserting it normally would
 * leave some last-layer corners oriented for free.
 *
 * Source has 27 recognised patterns, grouped by how many corners end up
 * oriented once the pair goes in: three, two, one, or none. Only 21 are here.
 *
 * The six left out all reduce, in the source itself, to the plain three-move
 * insert "R U' R'" — five of them explicitly ("-> OLL": insert normally, then
 * the top gets a normal OLL, no shortcut exists) and the sixth is the "2
 * corners" case whose own listed algorithm is that same plain insert. That
 * is a real fact about WV, not a gap here: those six top-layer patterns are
 * grouped together precisely because they don't need a case of their own,
 * any of them, you do the same ordinary thing. But this page draws a case's
 * picture by running its algorithm backwards from a solved cube, so a case
 * has to have its OWN algorithm to have its own picture -- six entries all
 * reading "R U' R'" would draw the identical picture six times, which is not
 * a set of six things to learn, it is one thing to learn (insert normally)
 * shown six times. Learning that is what F2L and OLL already teach.
 *
 * So what is here is exactly the WV cases that are worth a special algorithm:
 * every one where the ordinary insert would NOT have gotten you that far, and
 * this smarter one does.
 */
(function () {
  "use strict";

  window.WV = [
    { n: 1, group: "3 corners oriented",
      note: "The rare one where the whole top comes oriented for free.",
      alg: "L' U2 R U R' U2 L" },

    { n: 2, group: "2 corners oriented",
      alg: "R U' R' U R' U' R U' R' U2 R" },
    { n: 3, group: "2 corners oriented",
      alg: "U' R U' R' U2 R U' R' U2 R U R'" },
    { n: 4, group: "2 corners oriented",
      note: "Inserts into a Sune-shaped top, same trigger as Sune in OLL.",
      alg: "U' R' F R U R U' R' F'" },
    { n: 5, group: "2 corners oriented",
      alg: "R2 D R' U' R D' R2" },
    { n: 6, group: "2 corners oriented",
      alg: "R U R' U' R U' R'" },

    { n: 7, group: "1 corner oriented",
      alg: "U R U' R' U R U2 R'" },
    { n: 8, group: "1 corner oriented",
      alg: "R U R2 U' R2 U' R2 U2 R" },
    { n: 9, group: "1 corner oriented",
      alg: "U R2 D R' U2 R D' R2" },
    { n: 10, group: "1 corner oriented",
      alg: "U R' U' R2 U' R2 U2 R" },
    { n: 11, group: "1 corner oriented",
      alg: "U F' R U2 R' U2 R' F R" },
    { n: 12, group: "1 corner oriented",
      alg: "U R U2 R2 U' R U' R' U2 R" },
    { n: 13, group: "1 corner oriented",
      alg: "U' L' U R U' R' L" },
    { n: 14, group: "1 corner oriented",
      alg: "U R U2 R'" },

    { n: 15, group: "0 corners oriented",
      note: "None get lucky here, but the pair still goes in cleanly.",
      alg: "R U' R' U' R U R' U R U2 R'" },
    { n: 16, group: "0 corners oriented",
      alg: "R U' R2 U2 R U R' U R" },
    { n: 17, group: "0 corners oriented",
      alg: "U R U' R' U R U' R' U R U2 R'" },
    { n: 18, group: "0 corners oriented",
      alg: "U R U2 R2 U2 R U R' U R" },
    { n: 19, group: "0 corners oriented",
      alg: "R U' R2 U' R U' R' U2 R" },
    { n: 20, group: "0 corners oriented",
      alg: "R U R' U' R U R' U' R U' R'" },
    { n: 21, group: "0 corners oriented",
      alg: "R2 D R' U R D' R' U2 R'" },
  ];
})();
