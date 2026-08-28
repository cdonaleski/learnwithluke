/**
 * The wheel's arithmetic, kept away from the drawing of it.
 *
 * There is one classic way for a spinner to be wrong: it announces a winner,
 * animates to some angle, and the angle it stops at is not the winner's slice.
 * The child sees the pointer on "Ella" and is told "Sam", and quite rightly
 * never trusts it again.
 *
 * So there is exactly one function that decides who won -- `winnerAt`, which
 * reads it off the angle -- and the animation is aimed using `restingAngle`,
 * which is its inverse. A test spins every slice of every wheel size and checks
 * the two agree, which is the only way to be sure the picture and the answer
 * can never come apart.
 *
 * Slices are measured clockwise from the top, because that is where the pointer
 * is and it saves everybody a quarter turn of confusion.
 */
(function () {
  "use strict";

  const TAU = Math.PI * 2;
  const MAX_ENTRIES = 24;
  const MAX_LENGTH = 22;

  /** Angles wrap; this brings any of them back into 0..2π. */
  function wrap(angle) {
    return ((angle % TAU) + TAU) % TAU;
  }

  function sliceSize(count) {
    return TAU / Math.max(1, count);
  }

  /**
   * Which slice the pointer is over, the wheel having been turned by `turn`.
   * The pointer does not move, so turning the wheel one way is the same as
   * reading round the other.
   */
  function winnerAt(turn, count) {
    if (count < 1) return -1;
    const under = wrap(-turn);
    return Math.min(count - 1, Math.floor(under / sliceSize(count)));
  }

  /**
   * How far to turn so the pointer ends up in the middle of slice `index`.
   * `turns` whole revolutions are added on so it looks like a spin rather than
   * a twitch. The middle, not the edge, so rounding can never tip it over into
   * the slice next door.
   */
  function restingAngle(index, count, turns) {
    const middle = index * sliceSize(count) + sliceSize(count) / 2;
    return wrap(-middle) + (turns || 0) * TAU;
  }

  /**
   * Tidies up what somebody typed into a list of names. Blank lines go, spaces
   * at the ends go, anything silly-long is cut short, and there is a limit on
   * how many will fit round a wheel and still be readable.
   */
  function tidy(text) {
    return String(text || "")
      .split("\n")
      .map(function (line) { return line.trim().slice(0, MAX_LENGTH); })
      .filter(function (line) { return line.length > 0; })
      .slice(0, MAX_ENTRIES);
  }

  /** An even pick. Nothing clever, and nothing weighted -- that is the point. */
  function choose(count, random) {
    return Math.floor((random || Math.random)() * count) % Math.max(1, count);
  }

  /**
   * Where the spin should be at a given moment. Starts fast and eases to a
   * stop, so it looks like a wheel slowing under friction rather than a number
   * changing.
   */
  function easeTo(from, to, progress) {
    const t = Math.max(0, Math.min(1, progress));
    const eased = 1 - Math.pow(1 - t, 3);
    return from + (to - from) * eased;
  }

  window.Wheel = {
    TAU: TAU, MAX_ENTRIES: MAX_ENTRIES, MAX_LENGTH: MAX_LENGTH,
    wrap: wrap, sliceSize: sliceSize, winnerAt: winnerAt, restingAngle: restingAngle,
    tidy: tidy, choose: choose, easeTo: easeTo,
  };
})();
