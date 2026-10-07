/**
 * Cycle 3 memory work — the frame the strand files fill.
 *
 * Organized by SECTION, the numbered box on the proof sheet, because that is
 * the unit the proof is actually done in. A tutor says "section seven,
 * thirteens" and the student recites the lot; nobody is ever asked for "week
 * nine of math." Weeks are how it is taught, sections are how it is tested,
 * and this is the testing tool.
 *
 * A card:
 *   strand   math, latin, science, english, history, geography, timeline
 *   section  the number in the gray box, 1-24
 *   label    the heading beside that number
 *   q        the prompt, the way a tutor would say it
 *   a        what has to come back, in full
 *   note     optional aside, never part of what is matched or marked
 *
 * ON WHAT IS COPIED. The Foundations Guide is a book Classical Conversations
 * sells. Three different things are in it and they are not the same:
 *
 *   Facts, which belong to nobody: 12 x 12 = 144, the capital of Vermont,
 *   the principal parts of "to go", the Latin for "light". These are written
 *   out here without hesitation.
 *
 *   Public-domain text: the Vulgate, the Preamble, Psalm 19:1. Likewise.
 *
 *   Their own prose: the history sentences, which somebody at CC sat down
 *   and wrote. Those are in a separate file that is NOT part of the public
 *   site, and the loader below treats their absence as normal.
 */
(function () {
  "use strict";

  window.CC_CYCLE3 = {
    cycle: 3,
    label: "Cycle 3",
    sections: 24,
    cards: [],
  };

  /**
   * How a strand file adds its cards. Takes the strand and section once
   * rather than on every card, because repeating them 225 times is how they
   * end up disagreeing.
   */
  window.CC_ADD = function (strand, section, label, pairs) {
    pairs.forEach(function (pair) {
      window.CC_CYCLE3.cards.push({
        strand: strand,
        section: section,
        label: label,
        q: pair[0],
        a: pair[1],
        note: pair[2],
      });
    });
  };
})();
