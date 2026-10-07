/**
 * Cycle 3 science — the human body, then atoms and origins.
 *
 * Most sections are a question with a LIST for an answer. The whole list is
 * one card, because the proof is one checkbox and the student says all of it
 * — getting four of the five senses is not getting the card.
 */
(function () {
  "use strict";

  const add = window.CC_ADD;

  /**
   * A list section. `a` is the sheet, item for item. `stem` is the only
   * thing here not copied from the page: the opening of the sentence the
   * answer has to be SPOKEN as, since the sheet prints the list but a tutor
   * will not accept it said as one. Drafted from the printed question and
   * meant to be corrected, which is why it is a separate field.
   */
  const list = function (section, label, question, stem, items) {
    add("science", section, label, [{
      q: question,
      a: items.join(", "),
      say: window.CC_SAY(stem, items),
    }]);
  };

  list("1" && 1, "Types of Tissue", "What are four types of tissue?",
    "The four types of tissue are",
    ["connective", "epithelial", "muscle", "nerve"]);

  list(2, "Axial Skeleton", "Which bones make up the axial skeleton?",
    "The bones that make up the axial skeleton are the",
    ["skull", "vertebrae", "ribs", "sternum"]);

  list(3, "Kinds of Muscle", "What are three kinds of muscle?",
    "The three kinds of muscle are",
    ["skeletal", "smooth", "cardiac"]);

  list(4, "Nervous System", "What are three parts of the nervous system?",
    "The three parts of the nervous system are the",
    ["brain", "spinal cord", "nerves"]);

  list(5, "The Five Senses", "What are the five main senses?",
    "The five main senses are",
    ["sight", "hearing", "taste", "smell", "touch"]);

  list(6, "Digestive System", "What are some parts of the digestive system?",
    "Some parts of the digestive system are the",
    ["mouth", "esophagus", "stomach", "liver", "small intestine", "large intestine"]);

  list(7, "Excretory System", "What are four parts of the excretory system?",
    "Four parts of the excretory system are the",
    ["urinary tract", "lungs", "skin", "intestines"]);

  list(8, "Circulatory System", "What are six parts of the circulatory system?",
    "Six parts of the circulatory system are the",
    ["heart", "arteries", "veins", "capillaries", "red and white blood cells", "platelets"]);

  list(9, "Lymph System", "What are four parts of the lymph system?",
    "Four parts of the lymph system are the",
    ["lymph vessels", "lymph nodes", "spleen", "thymus"]);

  list(10, "Respiratory System", "What are some parts of the respiratory system?",
    "Some parts of the respiratory system are the",
    ["nose", "pharynx", "larynx", "trachea", "bronchi", "bronchioles", "alveoli", "lungs"]);

  add("science", 11, "Endocrine System", [
    ["What is the endocrine system?",
     "The endocrine system consists of glands and organs that use hormones to send messages " +
     "through the bloodstream to the rest of the body."],
  ]);

  list(12, "Purposes of Blood", "What are the major purposes of blood?",
    "The major purposes of blood are",
    ["transportation", "protection", "communication", "regulation"]);

  add("science", 13, "Atomic Number", [
    ["What is the atomic number?",
     "The atomic number is the number of protons in the nucleus of an atom, which is also the " +
     "number of electrons in a neutral atom."],
  ]);

  add("science", 14, "Element", [
    ["What is an element?",
     "An element is a basic chemical substance defined by its atomic number and atomic mass."],
  ]);

  list(15, "Parts of an Atom", "What are some parts of an atom?",
    "Some parts of an atom are the",
    ["nucleus", "protons", "electrons", "quarks", "leptons", "neutrons"]);

  /* 16-18: the first twelve elements, by number, element, symbol and mass.
     Each element is its own card -- twelve checkboxes, twelve things said. */
  const elements = function (section, which, rows) {
    // One section, one card. The sheet gives these four a single checkbox
    // group under one question, exactly like the body-system lists -- the
    // proof is "recite the first four elements", not four separate asks.
    add("science", section, "First Twelve Elements", [{
      q: "What are the " + which + " four elements in the periodic table by " +
         "number, element, symbol, and mass?",
      a: rows.map(function (row) {
        return row[0] + " " + row[1] + " " + row[2] + " " + row[3];
      }).join(" · "),
    }]);
  };

  elements(16, "first", [
    [1, "Hydrogen", "H", 1],
    [2, "Helium", "He", 4],
    [3, "Lithium", "Li", 7],
    [4, "Beryllium", "Be", 9],
  ]);
  elements(17, "second", [
    [5, "Boron", "B", 11],
    [6, "Carbon", "C", 12],
    [7, "Nitrogen", "N", 14],
    [8, "Oxygen", "O", 16],
  ]);
  elements(18, "third", [
    [9, "Fluorine", "F", 19],
    [10, "Neon", "Ne", 20],
    [11, "Sodium", "Na", 23],
    [12, "Magnesium", "Mg", 24],
  ]);

  add("science", 19, "Acids and Bases", [
    ["What is the difference between an acid and a base?",
     "An acid donates a hydrogen ion and a base accepts a hydrogen ion."],
  ]);

  add("science", 20, "The Heavens Declare", [
    ["What do the heavens declare?",
     "The heavens declare the glory of God; the skies proclaim the work of his hands.",
     "Psalm 19:1 NIV"],
  ]);

  add("science", 21, "Theory of Evolution", [
    ["What does the theory of evolution rely on?",
     "The theory of evolution relies on the belief that life began as a chance combination of " +
     "non-living things."],
  ]);

  add("science", 22, "Theory of Intelligent Design", [
    ["What does the theory of intelligent design rely on?",
     "The theory of intelligent design relies on the belief that life began as a result of " +
     "intention and purpose."],
  ]);

  list(23, "Earth's History", "What are some ways earth's history is preserved?",
    "Some ways earth's history is preserved are in",
    ["rocks", "fossils", "ice", "tar", "amber"]);

  add("science", 24, "Natural Selection", [
    ["What is natural selection?",
     "Natural selection is the idea that the fittest survive and pass along their traits to " +
     "their offspring."],
  ]);
})();
