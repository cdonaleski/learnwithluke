/**
 * Keeping time.
 *
 * A metronome cannot be built on a repeating timer. Browsers do not promise to
 * run one on time -- a few milliseconds late here and there is nothing to a
 * countdown and ruinous to a beat, and the errors pile up rather than cancel
 * out. So the beats are worked out as exact times from the moment the thing
 * started, and the sound for each one is booked with the audio clock a little
 * ahead of when it is wanted. The timer only decides how often to go and look;
 * it never decides when a beat happens.
 *
 * Which leaves one thing to get right, and it is the thing that goes wrong:
 * each pass looks at a window of time, and every beat must be booked by exactly
 * one of those passes. Book a beat twice and you get a flam; miss one and the
 * bar limps. The test walks thousands of random windows across a span and
 * insists every beat turns up once, in order.
 */
(function () {
  "use strict";

  const MIN_BPM = 30;
  const MAX_BPM = 240;

  /** The named speeds, so a child can find "walking pace" without knowing 96. */
  const SPEEDS = [
    { id: "largo", label: "Very slow", bpm: 50 },
    { id: "andante", label: "Walking", bpm: 84 },
    { id: "moderato", label: "Steady", bpm: 108 },
    { id: "allegro", label: "Quick", bpm: 138 },
    { id: "presto", label: "Very fast", bpm: 180 },
  ];

  const BARS = [
    { id: "4", label: "4 / 4 — marching", beats: 4 },
    { id: "3", label: "3 / 4 — waltz", beats: 3 },
    { id: "2", label: "2 / 4 — polka", beats: 2 },
    { id: "6", label: "6 / 8 — rolling", beats: 6 },
    { id: "1", label: "Just a click", beats: 1 },
  ];

  function clampBpm(bpm) {
    if (!Number.isFinite(bpm)) return 100;
    return Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(bpm)));
  }

  /** Seconds between beats. */
  function beatLength(bpm) {
    return 60 / clampBpm(bpm);
  }

  /** When beat number `index` falls, counting from the moment it started. */
  function timeOfBeat(index, startAt, bpm) {
    return startAt + index * beatLength(bpm);
  }

  /**
   * Which beats fall in the window `from` (exclusive) to `to` (inclusive).
   *
   * Exclusive at the start and inclusive at the end is the whole trick: run the
   * windows end to end and every beat lands in exactly one of them, with none
   * counted twice at the joins.
   */
  function beatsIn(from, to, startAt, bpm) {
    const gap = beatLength(bpm);
    const out = [];
    if (to < startAt) return out;
    let first = Math.floor((from - startAt) / gap) + 1;
    if (first < 0) first = 0;
    // A beat exactly on `from` belongs to the window before this one.
    if (timeOfBeat(first, startAt, bpm) <= from) first += 1;
    for (let i = first; timeOfBeat(i, startAt, bpm) <= to; i++) {
      out.push({ index: i, time: timeOfBeat(i, startAt, bpm) });
      if (out.length > 10000) break;               // a runaway guard, never reached
    }
    return out;
  }

  /** The first beat of a bar is the strong one; the rest are weak. */
  function accentOf(index, beatsPerBar) {
    const per = Math.max(1, beatsPerBar);
    return index % per === 0 ? "strong" : "weak";
  }

  function beatInBar(index, beatsPerBar) {
    const per = Math.max(1, beatsPerBar);
    return (index % per + per) % per;
  }

  /**
   * The speed somebody is tapping.
   *
   * Taps far apart are treated as the start of a new attempt rather than a very
   * slow tempo, and a single wild gap is thrown away instead of dragging the
   * average with it -- because a child tapping will always fumble one.
   */
  function tapTempo(times) {
    if (!times || times.length < 2) return null;
    const gaps = [];
    for (let i = 1; i < times.length; i++) {
      const gap = times[i] - times[i - 1];
      if (gap > 0 && gap < 3000) gaps.push(gap);
    }
    if (!gaps.length) return null;
    if (gaps.length > 2) {
      // Drop the odd one out, then average what is left.
      const sorted = gaps.slice().sort(function (a, b) { return a - b; });
      const middle = sorted[Math.floor(sorted.length / 2)];
      const kept = gaps.filter(function (g) { return Math.abs(g - middle) <= middle * 0.4; });
      if (kept.length) return clampBpm(60000 / (kept.reduce(function (s, g) { return s + g; }, 0) / kept.length));
    }
    const mean = gaps.reduce(function (s, g) { return s + g; }, 0) / gaps.length;
    return clampBpm(60000 / mean);
  }

  /** Taps more than this far apart start the counting again. */
  function tapsStillGoing(times, now) {
    if (!times.length) return [];
    if (now - times[times.length - 1] > 3000) return [];
    return times.slice(-6);
  }

  /**
   * Throws away beats that have already been and gone.
   *
   * The dots are lit by the frame loop, and browsers stop running frames
   * altogether in a tab you are not looking at -- while the booking carries on,
   * because that runs on a timer. Leave a metronome playing in a background tab
   * and the list of beats waiting to be shown would grow for as long as it
   * played. One beat in the past is kept, so the right dot lights the moment you
   * come back to the page.
   */
  function keepRecent(booked, now) {
    let drop = 0;
    while (drop + 1 < booked.length && booked[drop + 1].time <= now) drop++;
    return drop ? booked.slice(drop) : booked;
  }

  window.Tempo = {
    keepRecent: keepRecent,
    MIN_BPM: MIN_BPM, MAX_BPM: MAX_BPM, SPEEDS: SPEEDS, BARS: BARS,
    clampBpm: clampBpm, beatLength: beatLength, timeOfBeat: timeOfBeat,
    beatsIn: beatsIn, accentOf: accentOf, beatInBar: beatInBar,
    tapTempo: tapTempo, tapsStillGoing: tapsStillGoing,
  };
})();
