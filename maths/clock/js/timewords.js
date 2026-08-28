/**
 * Clock arithmetic and the words that go with it.
 *
 * The words are the hard part and the reason this is a separate file. "Quarter
 * to four" is written 3:45, which is the single most confusing thing about
 * clocks for a seven-year-old: the number you say is not the number on the
 * clock. Getting that wrong in a teaching tool would be worse than not building
 * it, so every one of the 720 times a clock can show is checked by a test.
 *
 * Time is held as minutes past twelve, 0 to 719, because that makes both hands
 * a straight sum and leaves nowhere for an off-by-one to hide.
 */
(function () {
  "use strict";

  const HOURS = ["twelve", "one", "two", "three", "four", "five",
                 "six", "seven", "eight", "nine", "ten", "eleven"];
  const FIVES = { 5: "five", 10: "ten", 20: "twenty", 25: "twenty-five" };

  /** Every granularity a child might be working at, easiest first. */
  const STEPS = [
    { id: "oclock", label: "O'clock and half past", step: 30 },
    { id: "quarter", label: "Quarter past and quarter to", step: 15 },
    { id: "five", label: "Every five minutes", step: 5 },
    { id: "minute", label: "Any minute at all", step: 1 },
  ];

  function wrap(minutes) {
    return ((minutes % 720) + 720) % 720;
  }

  function hourOf(minutes) { return Math.floor(wrap(minutes) / 60); }
  function minuteOf(minutes) { return wrap(minutes) % 60; }

  /** 0 is shown as 12, the way a clock face does it. */
  function clockHour(h) { return h === 0 ? 12 : h; }

  function digital(minutes) {
    return clockHour(hourOf(minutes)) + ":" + String(minuteOf(minutes)).padStart(2, "0");
  }

  /**
   * How you would say it out loud.
   *
   * Past the half hour you count towards the NEXT hour, which is why 3:45 is
   * "quarter to four" and not "quarter to three". That is the whole lesson.
   */
  /** "twenty", or "seven minutes" -- and "one minute", never "1 minutes". */
  function countOf(n) {
    if (FIVES[n]) return FIVES[n];
    return n + (n === 1 ? " minute" : " minutes");
  }

  function inWords(minutes) {
    const h = hourOf(minutes), m = minuteOf(minutes);
    const next = HOURS[(h + 1) % 12];
    const here = HOURS[h];

    if (m === 0) return here + " o'clock";
    if (m === 15) return "quarter past " + here;
    if (m === 30) return "half past " + here;
    if (m === 45) return "quarter to " + next;

    if (m < 30) return countOf(m) + " past " + here;
    return countOf(60 - m) + " to " + next;
  }

  /* ---------------- Hands ---------------- */

  /**
   * Where each hand points, in degrees clockwise from twelve.
   *
   * The hour hand creeps. At half past three it is halfway between the 3 and
   * the 4, not sitting on the 3 -- which is exactly what a real clock does and
   * exactly what children are never shown.
   */
  function handAngles(minutes) {
    const t = wrap(minutes);
    return { hour: (t % 720) / 720 * 360, minute: (t % 60) / 60 * 360 };
  }

  /** The nearest whole `step` minutes to an angle of the minute hand. */
  function minuteFromAngle(angle, step) {
    const raw = (((angle % 360) + 360) % 360) / 360 * 60;
    const snapped = Math.round(raw / (step || 1)) * (step || 1);
    return snapped % 60;
  }

  /** Which hour an angle of the hour hand is closest to. */
  function hourFromAngle(angle) {
    const raw = (((angle % 360) + 360) % 360) / 360 * 12;
    return Math.floor(raw) % 12;
  }

  /* ---------------- Questions ---------------- */

  function stepFor(id) {
    const found = STEPS.filter(function (s) { return s.id === id; })[0];
    return found ? found.step : 5;
  }

  /** Every time that exists at a given granularity. */
  function everyTime(stepId) {
    const step = stepFor(stepId);
    const out = [];
    for (let t = 0; t < 720; t += step) out.push(t);
    return out;
  }

  function pickTime(stepId, random) {
    const times = everyTime(stepId);
    return times[Math.floor((random || Math.random)() * times.length)];
  }

  /**
   * A handful of wrong answers that are wrong in the ways children actually get
   * things wrong: reading the hands the wrong way round, counting from the
   * wrong hour past the half, and being out by five minutes. A choice between
   * the right answer and three obviously silly ones teaches nothing.
   */
  function distractors(minutes, stepId, howMany) {
    const step = stepFor(stepId);
    const h = hourOf(minutes), m = minuteOf(minutes);
    const wrong = [];
    const add = function (t) {
      const at = wrap(t);
      if (at === wrap(minutes)) return;
      if (at % step !== 0) return;
      if (wrong.indexOf(at) === -1) wrong.push(at);
    };

    if (m > 30) add((h + 1) % 12 * 60 + m);      // said "to" but kept this hour
    if (m > 30) add(h * 60 + (60 - m));          // counted the wrong way round
    if (m !== 0) add(m * 60 + h % 60);           // hands read the wrong way round
    add(minutes + step);
    add(minutes - step);
    add(minutes + 60);
    add(minutes + 5);
    add(minutes - 5);

    const times = everyTime(stepId);
    while (wrong.length < howMany) {
      const guess = times[Math.floor(Math.random() * times.length)];
      add(guess);
      if (wrong.length >= times.length - 1) break;
    }
    return wrong.slice(0, howMany);
  }

  window.TimeWords = {
    HOURS: HOURS, STEPS: STEPS,
    wrap: wrap, hourOf: hourOf, minuteOf: minuteOf, clockHour: clockHour,
    digital: digital, inWords: inWords, handAngles: handAngles,
    minuteFromAngle: minuteFromAngle, hourFromAngle: hourFromAngle,
    stepFor: stepFor, everyTime: everyTime, pickTime: pickTime, distractors: distractors,
  };
})();
