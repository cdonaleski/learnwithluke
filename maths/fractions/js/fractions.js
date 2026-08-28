/**
 * Fractions, compared exactly.
 *
 * Everything here is done in whole numbers. Is 3/4 bigger than 5/7? Cross
 * multiply: 3×7 = 21 against 5×4 = 20, so yes, and no division has happened at
 * any point. Compare them as decimals instead and 1/3 becomes 0.3333333333333333
 * and sooner or later two fractions that are equal are reported as different by
 * a hair. On a page whose whole job is to show a child which fraction is
 * bigger, that is not a rounding error, it is a lie.
 *
 * The wall shows the denominators a fraction wall traditionally shows: the ones
 * that divide neatly into each other often enough to make equivalence visible.
 */
(function () {
  "use strict";

  const WALL = [1, 2, 3, 4, 5, 6, 8, 10, 12];

  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { const t = b; b = a % b; a = t; }
    return a || 1;
  }

  function simplify(top, bottom) {
    const g = gcd(top, bottom);
    return { top: top / g, bottom: bottom / g };
  }

  /** -1, 0 or 1. Cross multiplication, so it is exact for any fraction. */
  function compare(aTop, aBottom, bTop, bBottom) {
    const left = aTop * bBottom, right = bTop * aBottom;
    return left < right ? -1 : left > right ? 1 : 0;
  }

  function sameAs(aTop, aBottom, bTop, bBottom) {
    return compare(aTop, aBottom, bTop, bBottom) === 0;
  }

  /** How it is said out loud: 3/4 is "three quarters", 1/2 is "a half". */
  const NAMES = {
    2: ["half", "halves"], 3: ["third", "thirds"], 4: ["quarter", "quarters"],
    5: ["fifth", "fifths"], 6: ["sixth", "sixths"], 8: ["eighth", "eighths"],
    10: ["tenth", "tenths"], 12: ["twelfth", "twelfths"],
  };
  const COUNT = ["no", "one", "two", "three", "four", "five", "six",
                 "seven", "eight", "nine", "ten", "eleven", "twelve"];

  function inWords(top, bottom) {
    if (bottom === 1) return top === 1 ? "one whole" : top + " wholes";
    if (top === bottom) return "one whole";
    const name = NAMES[bottom];
    if (!name) return top + " over " + bottom;
    const word = top === 1 ? name[0] : name[1];
    const many = COUNT[top] || top;
    return (top === 1 ? "one " : many + " ") + word;
  }

  /** Every fraction on the wall equal to this one, itself included. */
  function equivalents(top, bottom, walls) {
    const rows = walls || WALL;
    const out = [];
    rows.forEach(function (d) {
      for (let n = 0; n <= d; n++) {
        if (sameAs(top, bottom, n, d)) { out.push({ top: n, bottom: d }); return; }
      }
    });
    return out;
  }

  /**
   * Can this fraction be written in `bottom` parts without a remainder?
   * 3/4 can be eighths; 1/3 cannot be quarters, and asking a child to do it
   * would be a bug rather than a hard question.
   */
  function fitsIn(top, bottom, into) {
    return (top * into) % bottom === 0;
  }

  function convert(top, bottom, into) {
    return (top * into) / bottom;
  }

  /* ---------------- Questions ---------------- */

  /** Proper fractions on the wall, ignoring 0, whole ones, and 1/1. */
  function everyFraction(walls) {
    const rows = (walls || WALL).filter(function (d) { return d > 1; });
    const out = [];
    rows.forEach(function (d) {
      for (let n = 1; n < d; n++) out.push({ top: n, bottom: d });
    });
    return out;
  }

  function pickOne(list, random) {
    return list[Math.floor((random || Math.random)() * list.length)];
  }

  /**
   * "Which is bigger?" -- with two fractions that are genuinely different, and
   * near enough in size that it cannot be answered by glancing at it.
   */
  function biggerQuestion(walls, random) {
    const all = everyFraction(walls);
    for (let tries = 0; tries < 400; tries++) {
      const a = pickOne(all, random), b = pickOne(all, random);
      // Never two out of the same bar. Comparing 11/12 with 9/12 is answered by
      // looking at the top numbers and teaches nothing about fractions -- and
      // the two could not be shown side by side on the wall anyway, because
      // there is only one twelfths bar to shade.
      if (a.bottom === b.bottom) continue;
      const side = compare(a.top, a.bottom, b.top, b.bottom);
      if (side === 0) continue;
      // Close enough to be worth thinking about, but not a hair apart.
      const gap = Math.abs(a.top / a.bottom - b.top / b.bottom);
      if (gap > 0.34 || gap < 0.02) continue;
      return { kind: "bigger", a: a, b: b, answer: side > 0 ? "a" : "b" };
    }
    const a = { top: 3, bottom: 4 }, b = { top: 2, bottom: 3 };
    return { kind: "bigger", a: a, b: b, answer: "a" };
  }

  /** "How many eighths make three quarters?" -- only ever asked when it works. */
  function convertQuestion(walls, random) {
    const rows = (walls || WALL).filter(function (d) { return d > 1; });
    for (let tries = 0; tries < 400; tries++) {
      const from = pickOne(rows, random), into = pickOne(rows, random);
      if (from === into || into % from !== 0) continue;
      const top = 1 + Math.floor((random || Math.random)() * (from - 1));
      if (!fitsIn(top, from, into)) continue;
      return { kind: "convert", a: { top: top, bottom: from }, into: into,
               answer: convert(top, from, into) };
    }
    return { kind: "convert", a: { top: 1, bottom: 2 }, into: 4, answer: 2 };
  }

  /** "Is 2/4 the same as 1/2?" -- half of them true, half of them not. */
  function sameQuestion(walls, random) {
    const roll = random || Math.random;
    const all = everyFraction(walls);
    const wantSame = roll() < 0.5;
    for (let tries = 0; tries < 400; tries++) {
      const a = pickOne(all, roll);
      const mates = equivalents(a.top, a.bottom, walls)
        .filter(function (f) { return !(f.bottom === a.bottom); });
      if (wantSame) {
        if (!mates.length) continue;
        return { kind: "same", a: a, b: pickOne(mates, roll), answer: true };
      }
      const b = pickOne(all, roll);
      if (a.bottom === b.bottom) continue;     // one bar cannot show two answers
      if (sameAs(a.top, a.bottom, b.top, b.bottom)) continue;
      const gap = Math.abs(a.top / a.bottom - b.top / b.bottom);
      if (gap > 0.2) continue;                 // near misses, not obvious ones
      return { kind: "same", a: a, b: b, answer: false };
    }
    return { kind: "same", a: { top: 1, bottom: 2 }, b: { top: 2, bottom: 4 }, answer: true };
  }

  window.Fractions = {
    WALL: WALL, NAMES: NAMES,
    gcd: gcd, simplify: simplify, compare: compare, sameAs: sameAs, inWords: inWords,
    equivalents: equivalents, fitsIn: fitsIn, convert: convert,
    everyFraction: everyFraction, biggerQuestion: biggerQuestion,
    convertQuestion: convertQuestion, sameQuestion: sameQuestion,
  };
})();
