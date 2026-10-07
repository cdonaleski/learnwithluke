/**
 * Cycle 3 Latin — John 1:1-7, vocabulary first and then the verses.
 *
 * The Latin is the Vulgate and the English is the Douay-Rheims; both have
 * been out of copyright for centuries. The word-for-word glosses are
 * dictionary facts. Nothing here is anyone's property.
 *
 * Where the sheet gives several forms of a word (Deus, Deum, Deo) they stay
 * together on one card, because that is one checkbox and one thing to say.
 */
(function () {
  "use strict";

  const add = window.CC_ADD;

  add("latin", 1, "Prepositions", [
    ["in", "in"],
    ["apud", "with"],
    ["per", "by"],
    ["sine", "without"],
    ["a", "from"],
    ["de", "of"],
  ]);

  add("latin", 2, "Conjunctions and Adverbs", [
    ["et", "and"],
    ["ut", "that"],
    ["non", "not"],
  ]);

  add("latin", 3, "Pronouns", [
    ["hic", "this"],
    ["hoc", "same"],
    ["ipso, ipsum", "him"],
    ["cui", "whose"],
    ["quod", "that"],
    ["eam", "it"],
    ["illum", "him"],
  ]);

  add("latin", 4, "Verbs", [
    ["erat", "was"],
    ["venit", "came"],
    ["perhiberet", "bear"],
    ["crederent", "believe"],
  ]);

  add("latin", 5, "Verbs", [
    ["facta sunt", "were made"],
    ["factum est", "was made"],
    ["missus", "sent"],
    ["conprehenderunt", "comprehended"],
    ["lucet", "shineth"],
    ["fuit", "there was"],
  ]);

  add("latin", 6, "Nouns", [
    ["verbum", "word"],
    ["Deus, Deum, Deo", "God"],
    ["principio", "beginning"],
    ["omnia, omnes", "all"],
    ["nihil", "nothing"],
  ]);

  add("latin", 7, "Nouns", [
    ["vita", "life"],
    ["lux", "light"],
    ["homo, hominum", "man"],
    ["nomen", "name"],
  ]);

  add("latin", 8, "Nouns", [
    ["testimonium", "witness, testimony"],
    ["lumine", "light"],
    ["Iohannes", "John"],
    ["tenebris, tenebrae", "darkness"],
  ]);

  add("latin", 9, "Verb Rules", [
    ["What is the rule for Latin verbs?",
     "Latin verbs have different endings called conjugations."],
  ]);

  add("latin", 10, "Article Rules", [
    ["What is the rule for Latin articles?",
     "Latin has no translation for articles a, an, the."],
  ]);

  add("latin", 11, "Nouns/Pronouns Rules", [
    ["What is the rule for Latin nouns and pronouns?",
     "Latin nouns and pronouns have different endings called declensions."],
  ]);

  /* 12-24: the verses themselves. The prompt is the English, so the student
     produces the Latin — which is the direction the recitation runs. */
  const verse = function (section, reference, latin, english) {
    add("latin", section, reference, [[english, latin]]);
  };

  verse(12, "John 1:1", "in principio erat Verbum", "in the beginning was the Word");
  verse(13, "John 1:1", "et Verbum erat apud Deum", "and the Word was with God");
  add("latin", 13, "John 1:1", [["and the Word was God", "et Deus erat Verbum"]]);
  verse(14, "John 1:2", "hoc erat in principio apud Deum", "the same was in the beginning with God");
  verse(15, "John 1:3", "omnia per ipsum facta sunt", "all things were made by him");
  verse(16, "John 1:3", "et sine ipso factum est nihil", "and without him was made nothing");
  add("latin", 16, "John 1:3", [["that was made", "quod factum est"]]);
  verse(17, "John 1:4", "in ipso vita erat", "in him was life");
  add("latin", 17, "John 1:4", [["and the life was the light of men", "et vita erat lux hominum"]]);
  verse(18, "John 1:5", "et lux in tenebris lucet", "and the light shineth in the darkness");
  verse(19, "John 1:5", "et tenebrae eam non conprehenderunt",
    "and the darkness did not comprehend it");
  verse(20, "John 1:6", "fuit homo missus a Deo", "there was a man sent from God");
  verse(21, "John 1:6", "cui nomen erat Iohannes", "whose name was John");
  verse(22, "John 1:7", "hic venit in testimonium", "this man came for a witness");
  verse(23, "John 1:7", "ut testimonium perhiberet de lumine", "to give testimony of the light");
  verse(24, "John 1:7", "ut omnes crederent per illum", "that all men might believe through him");
})();
