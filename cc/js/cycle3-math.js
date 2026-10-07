/**
 * Cycle 3 math — the 24 sections of the Math Summary Proof Sheets.
 *
 * The tables are COMPUTED, not typed. Two hundred and twenty-five facts
 * entered by hand is two hundred and twenty-five chances to put 9 x 13 = 107
 * in front of a child and have him learn it. Computed, the only way to be
 * wrong is for multiplication itself to be wrong — and the test checks a
 * sample against the printed sheet regardless.
 */
(function () {
  "use strict";

  const add = window.CC_ADD;
  const times = function (n) {
    const out = [];
    for (let m = 1; m <= 15; m++) out.push([n + " × " + m, String(n * m)]);
    return out;
  };

  /* 1-9: the tables, 1s through 15s, each to x15 */
  add("math", 1, "1s and 2s", times(1).concat(times(2)));
  add("math", 2, "3s and 4s", times(3).concat(times(4)));
  add("math", 3, "5s and 6s", times(5).concat(times(6)));
  add("math", 4, "7s and 8s", times(7).concat(times(8)));
  add("math", 5, "9s and 10s", times(9).concat(times(10)));
  add("math", 6, "11s and 12s", times(11).concat(times(12)));
  add("math", 7, "13s", times(13));
  add("math", 8, "14s", times(14));
  add("math", 9, "15s", times(15));

  /* 10-11: squares and cubes */
  const squares = [], cubes = [];
  for (let n = 1; n <= 15; n++) {
    squares.push([n + " × " + n, String(n * n)]);
    cubes.push([n + " × " + n + " × " + n, (n * n * n).toLocaleString("en-US")]);
  }
  add("math", 10, "Squares", squares);
  add("math", 11, "Cubes", cubes);

  /* 12-15: equivalents. The answer is the whole sentence, because that is
     what has to come out of the student's mouth. */
  add("math", 12, "Teaspoons and Tablespoons", [
    ["How many teaspoons equal 1 tablespoon?", "3 teaspoons equals 1 tablespoon"],
    ["How many tablespoons equal 1 fluid ounce?", "2 tablespoons equals 1 fluid ounce"],
  ]);

  add("math", 13, "Liquid Equivalents", [
    ["How many fluid ounces equal 1 cup?", "8 fluid ounces equals 1 cup"],
    ["How many cups equal 1 pint?", "2 cups equals 1 pint"],
    ["How many pints equal 1 quart?", "2 pints equals 1 quart"],
    ["How many quarts equal 1 gallon?", "4 quarts equals 1 gallon"],
  ]);

  add("math", 14, "Linear Equivalents", [
    ["How many centimeters equal 1 inch?", "2.54 centimeters equals 1 inch"],
    ["How many inches equal 1 foot?", "12 inches equals 1 foot"],
    ["How many feet equal 1 mile?", "5,280 feet equals 1 mile"],
    ["How much of a mile is 1 kilometer?", "1 kilometer equals 5/8 mile"],
  ]);

  add("math", 15, "Metric Measurements", [
    ["How many millimeters equal 1 centimeter?", "10 millimeters equals 1 centimeter"],
    ["How many centimeters equal 1 meter?", "100 centimeters equals 1 meter"],
    ["How many meters equal 1 kilometer?", "1,000 meters equals 1 kilometer"],
  ]);

  /* 16-20: area and circumference */
  add("math", 16, "Area of a Rectangle", [
    ["What is the area of a rectangle?", "The area of a rectangle equals length times width."],
  ]);
  add("math", 17, "Area of a Square", [
    ["What is the area of a square?", "The area of a square equals length of its side squared."],
  ]);
  add("math", 18, "Area of a Triangle", [
    ["What is the area of a triangle?", "The area of a triangle equals one-half base times height."],
  ]);
  add("math", 19, "Area of a Circle", [
    ["What is the area of a circle?", "The area of a circle equals pi (3.14) times the radius squared."],
  ]);
  add("math", 20, "Circumference of a Circle", [
    ["What is the circumference of a circle?",
     "The circumference of a circle equals 2 times pi (3.14) times the radius."],
  ]);

  /* 21-24: the laws. Two cards each where the sheet has two checkboxes. */
  add("math", 21, "Associative Law", [
    ["The Associative Law for addition states:", "(a + b) + c = a + (b + c)"],
    ["The Associative Law for multiplication states:", "(a × b) × c = a × (b × c)"],
  ]);
  add("math", 22, "Commutative Law", [
    ["The Commutative Law for addition states:", "a + b = b + a"],
    ["The Commutative Law for multiplication states:", "a × b = b × a"],
  ]);
  add("math", 23, "Distributive Law", [
    ["The Distributive Law states:", "a(b + c) = ab + ac"],
  ]);
  add("math", 24, "Identity Law", [
    ["The Identity Law for addition states:", "a + 0 = a"],
    ["The Identity Law for multiplication states:", "a × 1 = a"],
  ]);
})();
