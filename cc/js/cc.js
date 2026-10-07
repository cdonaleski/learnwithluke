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

  /* ---------------- Which way round a card is asked ---------------- */

  /**
   * Some cards are a PAIR rather than a question: a Latin word and its
   * meaning, where either side can be the prompt. Recognizing that "apud"
   * means "with" and producing "apud" when you mean "with" are different
   * skills, and a card stored one way round only ever trains one of them.
   */
  function hasPair(card) {
    return Boolean(card.lat && card.eng);
  }

  /**
   * `want` is "taught" (the way the sheet drills it), "eng" (answer in
   * English) or "lat" (answer in Latin). A card with no pair is returned
   * untouched, so the Latin rules and every other strand are unaffected.
   *
   * The prompt is what identifies a card in the progress store, so asking
   * it the other way round is automatically a separate thing to learn --
   * which is right, because it is.
   */
  function askedAs(card, want) {
    if (!hasPair(card) || !want || want === "taught") return card;
    const answerIn = want === "lat" ? "lat" : "eng";
    return Object.assign({}, card, {
      q: answerIn === "lat" ? card.eng : card.lat,
      a: answerIn === "lat" ? card.lat : card.eng,
      asked: answerIn,
    });
  }

  /**
   * Cards for a cycle, narrowed by strand and section, and asked whichever
   * way round was chosen. `sections` is a list of section numbers; an empty
   * list means all of them.
   */
  function pick(cycleNumber, strand, sections, direction) {
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
      .map(function (card) { return askedAs(Object.assign({ cycle: found.cycle }, card), direction); });
  }

  /** Does anything in this selection have two sides to it? */
  function canChooseDirection(cycleNumber, strand, sections) {
    return pick(cycleNumber, strand, sections).some(hasPair);
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

  /* ---------------- How much help the prompt gives ---------------- */

  /**
   * Difficulty here is not "harder cards" -- the cards are the cards, and the
   * proof asks for all of them. It is how much of the answer the student can
   * see while trying to produce it, which is the thing that actually makes
   * recall easy or hard.
   *
   * Easy is the first-letter method, which is how people have memorized long
   * passages for centuries: enough to unlock the sentence, never enough to
   * read it off.
   */
  const LEVELS = [
    { id: "easy", label: "Easy", pairs: 4, why: "First letter of every word to lean on." },
    { id: "medium", label: "Medium", pairs: 6, why: "Just the opening, and how much is left." },
    { id: "hard", label: "Hard", pairs: 8, why: "Nothing but the prompt. This is proof day." },
  ];

  /** A word with everything after its first character hidden. */
  function skeleton(word) {
    let out = "";
    let seenFirst = false;
    for (let i = 0; i < word.length; i++) {
      const ch = word[i];
      if (/[A-Za-z0-9]/.test(ch)) {
        // Digits are masked like letters: showing "104" in full would be the
        // whole answer for most of the math strand.
        out += seenFirst ? "_" : ch;
        seenFirst = true;
      } else {
        out += ch;
      }
    }
    return out;
  }

  /**
   * What the student is allowed to see before answering. Never the answer:
   * at easy it is the shape of it, at medium the start of it, at hard
   * nothing. Returns "" when there is no help to give.
   */
  function hintFor(card, level) {
    if (!card || !card.a || !level || level === "hard") return "";
    const answer = String(card.a);
    const words = answer.split(/\s+/).filter(Boolean);
    if (!words.length) return "";

    const hint = level === "easy" ? easyHint(words) : mediumHint(words);

    // Short answers have nothing to scaffold: "1 × 1" answers "1", and one
    // character masked is still that character. Give nothing rather than
    // print the answer above the card and call it a hint.
    return hint === answer ? "" : hint;
  }

  function easyHint(words) {
    return words.map(skeleton).join(" ");
  }

  function mediumHint(words) {
    const lead = words.length > 8 ? 2 : 1;
    const rest = words.length - lead;
    if (rest <= 0) return skeleton(words[0]);
    return words.slice(0, lead).join(" ") + " … (" + rest + " more word" + (rest === 1 ? "" : "s") + ")";
  }

  /**
   * Recite help is different in kind from Cards help. In Cards the student is
   * looking at the screen, so a first-letter skeleton works -- you read it
   * with your eyes. In Recite the CHECKER is holding the screen and speaking,
   * and nobody can say "c_______, e_______" out loud. So what they get is a
   * sayable prompt: the opening word, or just how many parts there are.
   */
  function nudgeFor(card, level) {
    if (!card || !card.a || !level || level === "hard") return "";
    const words = String(card.a).split(/\s+/).filter(Boolean);
    if (words.length < 2) return "";

    if (level !== "easy") return words.length + " words in all";

    // A long sentence usually opens on an article, and "The..." is no help to
    // anybody. Give a phrase, enough to start the tongue moving; a short list
    // only needs its first item.
    const lead = words.length > 8 ? 3 : 1;
    const rest = words.length - lead;
    return "\u201c" + words.slice(0, lead).join(" ") + "\u2026\u201d  then " +
      rest + " more word" + (rest === 1 ? "" : "s");
  }

  function levelOf(id) {
    return LEVELS.filter(function (l) { return l.id === id; })[0] || LEVELS[2];
  }

  /** How a pair can be asked. "taught" is whichever way the sheet drills it. */
  const DIRECTIONS = [
    { id: "taught", label: "As taught", why: "Words for their meaning, verses in Latin — the way the sheet drills them." },
    { id: "eng", label: "→ English", why: "See the Latin, say what it means." },
    { id: "lat", label: "→ Latin", why: "Hear the English, produce the Latin. The harder way." },
  ];

  window.CC = {
    STRANDS: STRANDS,
    DIRECTIONS: DIRECTIONS,
    LEVELS: LEVELS,
    levelOf: levelOf,
    hintFor: hintFor,
    nudgeFor: nudgeFor,
    skeleton: skeleton,
    hasPair: hasPair,
    askedAs: askedAs,
    canChooseDirection: canChooseDirection,
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
