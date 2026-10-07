/**
 * Cycle 3 English — principal parts of verbs, then sentence grammar.
 *
 * A verb's five principal parts are one section and one checkbox, so they
 * are one card: the student says all five in order. Splitting them into five
 * cards would let him "know" to-lie while still saying "lied."
 */
(function () {
  "use strict";

  const add = window.CC_ADD;

  const PARTS = ["infinitive", "present", "past", "present participle", "past participle"];

  /** One verb, its five parts said in order. */
  const verb = function (section, name, parts) {
    add("english", section, "To " + name, [
      ["Principal parts of “to " + name + "”",
       PARTS.map(function (part, i) { return part + ": " + parts[i]; }).join(" · ")],
    ]);
  };

  add("english", 1, "An Infinitive", [
    ["What is an infinitive?",
     "An infinitive is “to” plus a verb, used as a noun, adjective, or adverb."],
  ]);
  add("english", 2, "A Present Participle", [
    ["What is a present participle?",
     "A present participle is a verb plus “-ing,” used as an adjective or a verb."],
  ]);
  add("english", 3, "A Past Participle", [
    ["What is a past participle?",
     "A past participle is a verb plus “-ed,” used as an adjective or a verb."],
  ]);
  add("english", 4, "Verb: Principal Parts", [
    ["What are the principal parts of a verb?", PARTS.join(", ")],
  ]);

  verb(5, "be", ["to be", "am, are, is", "was, were", "being", "been"]);
  verb(6, "do", ["to do", "do, does", "did", "doing", "done"]);
  verb(7, "rise", ["to rise", "rise, rises", "rose", "rising", "risen"]);
  verb(8, "raise", ["to raise", "raise, raises", "raised", "raising", "raised"]);
  verb(9, "lay", ["to lay", "lay, lays", "laid", "laying", "laid"]);
  verb(10, "lie", ["to lie", "lie, lies", "lay", "lying", "lain"]);
  verb(11, "set", ["to set", "set, sets", "set", "setting", "set"]);
  verb(12, "sit", ["to sit", "sit, sits", "sat", "sitting", "sat"]);
  verb(13, "beat", ["to beat", "beat, beats", "beat", "beating", "beaten"]);
  verb(14, "break", ["to break", "break, breaks", "broke", "breaking", "broken"]);
  verb(15, "write", ["to write", "write, writes", "wrote", "writing", "written"]);
  verb(16, "go", ["to go", "go, goes", "went", "going", "gone"]);

  add("english", 17, "Sentence Parts: Subject", [
    ["What is the subject?",
     "The subject is that part of a sentence about which something is being said."],
  ]);
  add("english", 18, "Sentence Parts: Predicate", [
    ["What is the predicate?",
     "The predicate is that part of a sentence that says something about the subject."],
  ]);
  add("english", 19, "Sentence Parts: Clause", [
    ["What is a clause?", "A clause is a group of words that contains both a subject and a verb."],
  ]);
  add("english", 20, "Independent Clause", [
    ["What is an independent clause?",
     "An independent clause expresses a complete thought like a sentence."],
  ]);
  add("english", 21, "Subordinate Clause", [
    ["What is a subordinate clause?",
     "A subordinate clause, also known as a dependent clause, does not express a complete " +
     "thought and cannot stand alone."],
  ]);
  add("english", 22, "Sentence Parts: Phrase", [
    ["What is a phrase?",
     "A phrase is a group of words that does not contain both a subject and a verb and may be " +
     "used as a single part of speech."],
  ]);
  add("english", 23, "Four Sentence Structures", [
    ["What are the four sentence structures?", "simple, compound, complex, compound-complex"],
  ]);
  add("english", 24, "Seven Sentence Patterns", [
    ["What are the seven sentence patterns?",
     "subject–verb · subject–verb–direct object · subject–verb–predicate nominative · " +
     "subject–verb–predicate adjective · subject–verb–indirect object–direct object · " +
     "subject–verb–direct object–object complement noun · " +
     "subject–verb–direct object–object complement adjective"],
  ]);
})();
