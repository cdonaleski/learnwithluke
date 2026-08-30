/**
 * Scoring a run through all fifteen jams.
 *
 * Two people should be able to compare a run, so the score has to reward both
 * things that matter: getting out in few moves, and getting out quickly. It
 * also has to be worth more to clear a hard jam than an easy one, or the way to
 * win would be to rush the four-move ones and give up on the rest.
 *
 * So each jam is worth up to thirty times its own difficulty, split as:
 *
 *   moves   up to 20 × best, and you get all of it for matching the fewest
 *           moves possible. Take twice as many and you get half.
 *   time    up to 10 × best, and you get all of it for finishing inside the
 *           par time -- five seconds a move, which is generous. Take twice as
 *           long and you get half.
 *
 * Neither part can ever be improved by playing worse, which is the property
 * that makes two runs worth comparing at all, and the one the tests hold.
 */
(function () {
  "use strict";

  const MOVE_WEIGHT = 20;
  const TIME_WEIGHT = 10;
  const PAR_SECONDS_PER_MOVE = 5;
  const HINT_COST = 0.25;          // a quarter of that jam, per hint

  /** How long a jam ought to take somebody who knows what they are doing. */
  function parSeconds(best) {
    return Math.max(1, best) * PAR_SECONDS_PER_MOVE;
  }

  /**
   * What one jam is worth. `best` is the fewest moves it can be done in,
   * `moves` and `seconds` are what it actually took, `hints` how much help.
   */
  function jamScore(best, moves, seconds, hints) {
    if (!moves || moves < 1) return 0;
    const floor = Math.max(1, best);
    const movePart = floor * MOVE_WEIGHT * (floor / Math.max(moves, floor));
    const par = parSeconds(best);
    const timePart = floor * TIME_WEIGHT * (par / Math.max(seconds, par));
    const kept = Math.max(0, 1 - HINT_COST * (hints || 0));
    return Math.round((movePart + timePart) * kept);
  }

  /** The most a jam could ever be worth, for showing alongside what was got. */
  function bestPossible(best) {
    return Math.max(1, best) * (MOVE_WEIGHT + TIME_WEIGHT);
  }

  /** The most a whole run could be worth. */
  function perfectRun(levels) {
    return levels.reduce(function (sum, level) { return sum + bestPossible(level.best); }, 0);
  }

  /** A word for how a jam went, so the number means something. */
  function verdict(best, moves, seconds, hints) {
    if (!moves) return "skipped";
    if (hints) return "with help";
    if (moves === best && seconds <= parSeconds(best)) return "perfect";
    if (moves === best) return "fewest moves";
    if (seconds <= parSeconds(best)) return "quick";
    return "out";
  }

  window.ParkingScore = {
    MOVE_WEIGHT: MOVE_WEIGHT, TIME_WEIGHT: TIME_WEIGHT,
    PAR_SECONDS_PER_MOVE: PAR_SECONDS_PER_MOVE, HINT_COST: HINT_COST,
    parSeconds: parSeconds, jamScore: jamScore, bestPossible: bestPossible,
    perfectRun: perfectRun, verdict: verdict,
  };
})();
