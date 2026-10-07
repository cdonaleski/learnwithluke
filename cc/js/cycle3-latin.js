/**
 * Cycle 3 Latin — John 1:1-7, vocabulary first and then the verses.
 *
 * Every card stores the PAIR, lat and eng, rather than a prompt and an
 * answer. Which way round it is asked is then a choice made when it is
 * drilled, not a decision baked into the data — because recognizing that
 * "apud" means "with" and producing "apud" when you want to say "with" are
 * two different skills, and only one of them was practiceable when these
 * were stored one way round.
 *
 * Each card still carries the direction it is normally taught in: the
 * vocabulary sheet asks the meaning of a Latin word, and the verses are
 * recited in Latin. That is the default; the other way is one tap away.
 *
 * The Latin is the Vulgate and the English is the Douay-Rheims, both out of
 * copyright for centuries, and the word glosses are dictionary facts.
 */
(function () {
  "use strict";

  const cards = window.CC_CYCLE3.cards;

  /** A word or a verse: stored as a pair, asked either way. */
  const pair = function (section, label, lat, eng, taught) {
    cards.push({
      strand: "latin",
      section: section,
      label: label,
      lat: lat,
      eng: eng,
      // Which language the ANSWER is in by default.
      taught: taught,
      q: taught === "lat" ? eng : lat,
      a: taught === "lat" ? lat : eng,
    });
  };

  /** Vocabulary: see the Latin, say what it means. */
  const word = function (section, label, lat, eng) { pair(section, label, lat, eng, "eng"); };

  /** Verses: hear the English, say the Latin. */
  const verse = function (section, reference, lat, eng) { pair(section, reference, lat, eng, "lat"); };

  word(1, "Prepositions", "in", "in");
  word(1, "Prepositions", "apud", "with");
  word(1, "Prepositions", "per", "by");
  word(1, "Prepositions", "sine", "without");
  word(1, "Prepositions", "a", "from");
  word(1, "Prepositions", "de", "of");

  word(2, "Conjunctions and Adverbs", "et", "and");
  word(2, "Conjunctions and Adverbs", "ut", "that");
  word(2, "Conjunctions and Adverbs", "non", "not");

  word(3, "Pronouns", "hic", "this");
  word(3, "Pronouns", "hoc", "same");
  word(3, "Pronouns", "ipso, ipsum", "him");
  word(3, "Pronouns", "cui", "whose");
  word(3, "Pronouns", "quod", "that");
  word(3, "Pronouns", "eam", "it");
  word(3, "Pronouns", "illum", "him");

  word(4, "Verbs", "erat", "was");
  word(4, "Verbs", "venit", "came");
  word(4, "Verbs", "perhiberet", "bear");
  word(4, "Verbs", "crederent", "believe");

  word(5, "Verbs", "facta sunt", "were made");
  word(5, "Verbs", "factum est", "was made");
  word(5, "Verbs", "missus", "sent");
  word(5, "Verbs", "conprehenderunt", "comprehended");
  word(5, "Verbs", "lucet", "shineth");
  word(5, "Verbs", "fuit", "there was");

  word(6, "Nouns", "verbum", "word");
  word(6, "Nouns", "Deus, Deum, Deo", "God");
  word(6, "Nouns", "principio", "beginning");
  word(6, "Nouns", "omnia, omnes", "all");
  word(6, "Nouns", "nihil", "nothing");

  word(7, "Nouns", "vita", "life");
  word(7, "Nouns", "lux", "light");
  word(7, "Nouns", "homo, hominum", "man");
  word(7, "Nouns", "nomen", "name");

  word(8, "Nouns", "testimonium", "witness, testimony");
  word(8, "Nouns", "lumine", "light");
  word(8, "Nouns", "Iohannes", "John");
  word(8, "Nouns", "tenebris, tenebrae", "darkness");

  /* 9-11: rules about Latin, asked and answered in English. No pair, so no
     direction to choose, and the trainer leaves them alone when flipped. */
  window.CC_ADD("latin", 9, "Verb Rules", [
    ["What is the rule for Latin verbs?",
     "Latin verbs have different endings called conjugations."],
  ]);
  window.CC_ADD("latin", 10, "Article Rules", [
    ["What is the rule for Latin articles?",
     "Latin has no translation for articles a, an, the."],
  ]);
  window.CC_ADD("latin", 11, "Nouns/Pronouns Rules", [
    ["What is the rule for Latin nouns and pronouns?",
     "Latin nouns and pronouns have different endings called declensions."],
  ]);

  verse(12, "John 1:1", "in principio erat Verbum", "in the beginning was the Word");
  verse(13, "John 1:1", "et Verbum erat apud Deum", "and the Word was with God");
  verse(13, "John 1:1", "et Deus erat Verbum", "and the Word was God");
  verse(14, "John 1:2", "hoc erat in principio apud Deum", "the same was in the beginning with God");
  verse(15, "John 1:3", "omnia per ipsum facta sunt", "all things were made by him");
  verse(16, "John 1:3", "et sine ipso factum est nihil", "and without him was made nothing");
  verse(16, "John 1:3", "quod factum est", "that was made");
  verse(17, "John 1:4", "in ipso vita erat", "in him was life");
  verse(17, "John 1:4", "et vita erat lux hominum", "and the life was the light of men");
  verse(18, "John 1:5", "et lux in tenebris lucet", "and the light shineth in the darkness");
  verse(19, "John 1:5", "et tenebrae eam non conprehenderunt",
    "and the darkness did not comprehend it");
  verse(20, "John 1:6", "fuit homo missus a Deo", "there was a man sent from God");
  verse(21, "John 1:6", "cui nomen erat Iohannes", "whose name was John");
  verse(22, "John 1:7", "hic venit in testimonium", "this man came for a witness");
  verse(23, "John 1:7", "ut testimonium perhiberet de lumine", "to give testimony of the light");
  verse(24, "John 1:7", "ut omnes crederent per illum", "that all men might believe through him");
})();
