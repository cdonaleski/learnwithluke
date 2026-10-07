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
 *   q        the prompt, word for word off the sheet
 *   a        what has to come back, word for word off the sheet
 *   say      for a list answer, the sentence it has to be SPOKEN as -- see below
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
  window.CC_ADD = function (strand, section, label, rows) {
    rows.forEach(function (row) {
      const card = Array.isArray(row) ? { q: row[0], a: row[1], note: row[2] } : row;
      window.CC_CYCLE3.cards.push(Object.assign({
        strand: strand,
        section: section,
        label: label,
      }, card));
    });
  };

  /**
   * SPOKEN FORM. The sheet prints science and history answers as a list with
   * a checkbox each -- "connective / epithelial / muscle / nerve". At proof
   * that is not an answer. The student has to say a whole sentence back:
   * "The four types of tissue are connective, epithelial, muscle, and
   * nerve."
   *
   * The sheet never writes that sentence down, so the stem is the one thing
   * on these cards NOT copied from the page. It is kept separate from `a`
   * for exactly that reason: `a` is the sheet, `say` is the stem plus the
   * sheet, and a wrong stem can be corrected without touching the facts.
   */
  window.CC_SAY = function (stem, items) {
    const last = items.length - 1;
    const joined = items.length < 2
      ? items.join("")
      : items.slice(0, last).join(", ") +
        (items.length === 2 ? " and " : ", and ") + items[last];
    return stem + " " + joined + ".";
  };
})();
