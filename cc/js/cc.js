/**
 * The memory work trainer.
 *
 * Memory Master is recitation: a tutor says the prompt, the student says the
 * whole answer back, out loud, from memory, section by section. So the
 * trainer has three modes and they are deliberately different jobs:
 *
 *   Cards   one prompt at a time, flip it, say whether you knew it. Practice,
 *           and the ones you miss come round again before the ones you know.
 *   Match   prompts and answers side by side, shuffled, tap to pair them.
 *           This asks you to RECOGNIZE the right answer, which is far easier
 *           than producing it -- so it is where you start on new material.
 *   Recite  the real thing. Prompt only, and nothing to press but "I said it
 *           all" or "not yet" -- the answer stays hidden until you have
 *           committed, because a glance at it is not recitation.
 *
 * What counts as learned is kept per card and never guessed at: a card is
 * learned when it has been said right three times in Recite. Match and Cards
 * are practice and do not grant it, which is the same rule a parent would
 * use -- picking the right answer out of five is not knowing it.
 */
(function () {
  "use strict";

  /** The seven strands, in the order a Foundations morning runs through them. */
  const STRANDS = [
    { id: "timeline", label: "Timeline", icon: "⏳" },
    { id: "history", label: "History", icon: "📜" },
    { id: "science", label: "Science", icon: "🔬" },
    { id: "math", label: "Math", icon: "🔢" },
    { id: "latin", label: "Latin", icon: "🏛️" },
    { id: "english", label: "English", icon: "✏️" },
    { id: "geography", label: "Geography", icon: "🗺️" },
  ];

  const SAID_IT_TO_LEARN = 3;
  const MATCH_ROUND = 5;          // pairs on screen at once; more is a wall of text
  const STORE = "cc-progress";

  /** Every cycle whose data file is on the page, in order. */
  function cycles() {
    return [window.CC_CYCLE1, window.CC_CYCLE2, window.CC_CYCLE3]
      .filter(Boolean)
      .sort(function (a, b) { return a.cycle - b.cycle; });
  }

  function cycleOf(number) {
    return cycles().filter(function (c) { return c.cycle === Number(number); })[0] || null;
  }

  function strandOf(id) {
    return STRANDS.filter(function (s) { return s.id === id; })[0] || null;
  }

  /** A card's name in the progress store. Stable across reordering the files. */
  function idOf(card) {
    return card.cycle + ":" + card.strand + ":" + card.section + ":" + card.q;
  }

  /* ---------------- What has been learned ---------------- */

  function progress() {
    try { return JSON.parse(window.localStorage.getItem(STORE)) || {}; }
    catch (err) { return {}; }
  }

  function saveProgress(all) {
    try { window.localStorage.setItem(STORE, JSON.stringify(all)); } catch (err) { /* fine */ }
  }

  /** Said right in Recite -- the only thing that moves a card towards learned. */
  function saidIt(card, right) {
    const all = progress();
    const id = idOf(card);
    const was = all[id] || { said: 0, missed: 0 };
    if (right) {
      was.said += 1;
    } else {
      // A miss resets the run. Three in a row is the claim; three scattered
      // among failures is not.
      was.missed += 1;
      was.said = 0;
    }
    all[id] = was;
    saveProgress(all);
  }

  function scoreOf(card) {
    return progress()[idOf(card)] || { said: 0, missed: 0 };
  }

  function isLearned(card) {
    return scoreOf(card).said >= SAID_IT_TO_LEARN;
  }

  /* ---------------- Choosing what to work on ---------------- */

  /**
   * Cards for a cycle, narrowed by strand and section. `sections` is a list
   * of section numbers; an empty list means all of them.
   */
  function pick(cycleNumber, strand, sections) {
    const found = cycleOf(cycleNumber);
    if (!found) return [];
    return found.cards
      .filter(function (card) {
        if (strand && strand !== "all" && card.strand !== strand) return false;
        if (sections && sections.length && sections.indexOf(card.section) === -1) return false;
        return true;
      })
      // The cycle rides on the card from here, so a card can be identified
      // without knowing which list it came out of.
      .map(function (card) { return Object.assign({ cycle: found.cycle }, card); });
  }

  /**
   * Practice order: missed first, then never-seen, then the ones already
   * known -- and the known ones last, because time spent on them is time not
   * spent on the ones that will fail the proof.
   */
  function forPractice(cards) {
    return cards.slice().sort(function (a, b) {
      const sa = scoreOf(a), sb = scoreOf(b);
      const rank = function (s) { return s.missed > 0 ? 0 : s.said === 0 ? 1 : 2; };
      return rank(sa) - rank(sb) || sa.said - sb.said;
    });
  }

  /** Fisher-Yates, so a round is genuinely shuffled rather than nearly sorted. */
  function shuffle(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const swap = out[i];
      out[i] = out[j];
      out[j] = swap;
    }
    return out;
  }

  /**
   * One round of Match: a few cards, prompts and answers shuffled apart.
   *
   * Two cards with the same answer would make a round unwinnable -- the
   * student pairs a prompt with an identical-looking answer and is told it is
   * wrong -- so a round never contains two of them. Cycle 3 has real examples:
   * 2 x 6 and 3 x 4 are both 12, and three different English sections answer
   * "laid".
   */
  function matchRound(cards, size) {
    const want = size || MATCH_ROUND;
    const chosen = [];
    const seen = {};
    shuffle(forPractice(cards).slice(0, Math.max(want * 4, want))).forEach(function (card) {
      if (chosen.length >= want) return;
      if (seen[card.a]) return;
      seen[card.a] = true;
      chosen.push(card);
    });
    return { prompts: shuffle(chosen), answers: shuffle(chosen) };
  }

  /** How far through a set of cards the student is. */
  function tally(cards) {
    const learned = cards.filter(isLearned).length;
    return { learned: learned, total: cards.length, left: cards.length - learned };
  }

  /** The sections that actually have cards, for the section picker. */
  function sectionsWithCards(cycleNumber, strand) {
    const seen = {};
    pick(cycleNumber, strand, []).forEach(function (card) { seen[card.section] = card.label; });
    return Object.keys(seen)
      .map(Number)
      .sort(function (a, b) { return a - b; })
      .map(function (n) { return { section: n, label: seen[n] }; });
  }

  /** Which strands this cycle actually has, so empty ones are not offered. */
  function strandsWithCards(cycleNumber) {
    return STRANDS.filter(function (strand) {
      return pick(cycleNumber, strand.id, []).length > 0;
    });
  }

  window.CC = {
    STRANDS: STRANDS,
    SAID_IT_TO_LEARN: SAID_IT_TO_LEARN,
    MATCH_ROUND: MATCH_ROUND,
    cycles: cycles,
    cycleOf: cycleOf,
    strandOf: strandOf,
    idOf: idOf,
    pick: pick,
    forPractice: forPractice,
    shuffle: shuffle,
    matchRound: matchRound,
    tally: tally,
    sectionsWithCards: sectionsWithCards,
    strandsWithCards: strandsWithCards,
    scoreOf: scoreOf,
    isLearned: isLearned,
    saidIt: saidIt,
    progress: progress,
    saveProgress: saveProgress,
  };
})();
