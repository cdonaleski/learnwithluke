/**
 * Hangman — word lists.
 *
 * ADDING A CATEGORY
 * -----------------
 * Copy a block below and change the fields. The category picker and the
 * puzzles read from this list, so nothing else needs editing.
 *
 *   id     unique lowercase key, no spaces
 *   name   what the button says
 *   icon   a single emoji for the button
 *   words  the words themselves, with a hint for each
 *
 * Words are letters only — no spaces, digits or punctuation, because the
 * keyboard offers A–Z and nothing else. Anything that breaks that rule is
 * skipped with a console warning rather than served as an unsolvable puzzle.
 * Keep them lowercase here; they are shown in capitals.
 */
(function () {
  "use strict";

  window.HangmanWords = [
    {
      id: "animals",
      name: "Animals",
      icon: "🐾",
      words: [
        { word: "elephant", hint: "The biggest land animal, with a long trunk" },
        { word: "penguin", hint: "A bird in a dinner jacket that cannot fly" },
        { word: "giraffe", hint: "Tallest animal, with a very long neck" },
        { word: "dolphin", hint: "A clever sea mammal that clicks and whistles" },
        { word: "kangaroo", hint: "It hops, and carries its baby in a pouch" },
        { word: "butterfly", hint: "It used to be a caterpillar" },
        { word: "octopus", hint: "Eight arms and three hearts" },
        { word: "squirrel", hint: "Bushy tail, buries nuts for winter" },
        { word: "hedgehog", hint: "Small, spiky, and rolls into a ball" },
        { word: "crocodile", hint: "Big toothy reptile that lurks in rivers" },
        { word: "flamingo", hint: "Pink bird that stands on one leg" },
        { word: "tortoise", hint: "Slow, with a shell, and lives for ages" },
      ],
    },
    {
      id: "food",
      name: "Food",
      icon: "🍎",
      words: [
        { word: "spaghetti", hint: "Long thin pasta you twirl on a fork" },
        { word: "pancake", hint: "Flat, fried, and flipped in a pan" },
        { word: "chocolate", hint: "Sweet brown treat made from cocoa" },
        { word: "sandwich", hint: "Filling between two slices of bread" },
        { word: "pineapple", hint: "Spiky outside, sweet yellow inside" },
        { word: "porridge", hint: "Warm oats for breakfast" },
        { word: "broccoli", hint: "A green vegetable shaped like little trees" },
        { word: "strawberry", hint: "Red berry with seeds on the outside" },
        { word: "popcorn", hint: "Corn that goes bang when it is heated" },
        { word: "cucumber", hint: "Long, green, and very watery" },
        { word: "omelette", hint: "Eggs beaten and cooked flat" },
        { word: "watermelon", hint: "Huge green fruit, pink and juicy inside" },
      ],
    },
    {
      id: "space",
      name: "Space",
      icon: "🚀",
      words: [
        { word: "asteroid", hint: "A rock tumbling through space" },
        { word: "galaxy", hint: "Billions of stars all travelling together" },
        { word: "telescope", hint: "It makes far away things look close" },
        { word: "astronaut", hint: "Someone whose job is going to space" },
        { word: "gravity", hint: "The pull that keeps your feet on the ground" },
        { word: "meteor", hint: "A shooting star streaking across the sky" },
        { word: "satellite", hint: "It orbits a planet, natural or built" },
        { word: "eclipse", hint: "When one thing in the sky hides another" },
        { word: "jupiter", hint: "The biggest planet, with a giant red spot" },
        { word: "orbit", hint: "The path something takes around a planet" },
        { word: "comet", hint: "An icy visitor with a glowing tail" },
        { word: "rocket", hint: "It roars, and pushes you off the ground" },
      ],
    },
    {
      id: "school",
      name: "School",
      icon: "📚",
      words: [
        { word: "library", hint: "A quiet room full of books to borrow" },
        { word: "pencil", hint: "You write with it and rub it out again" },
        { word: "science", hint: "Experiments, questions, and finding out why" },
        { word: "playground", hint: "Where you go at break time" },
        { word: "homework", hint: "The work that follows you home" },
        { word: "teacher", hint: "The person at the front of the class" },
        { word: "history", hint: "The subject about what happened long ago" },
        { word: "backpack", hint: "You carry it on your shoulders" },
        { word: "assembly", hint: "When the whole school sits together" },
        { word: "spelling", hint: "Getting the letters in the right order" },
        { word: "calculator", hint: "It does the sums for you" },
        { word: "notebook", hint: "Pages held together for writing in" },
      ],
    },
    {
      id: "nature",
      name: "Nature",
      icon: "🌳",
      words: [
        { word: "rainbow", hint: "Seven colours after the rain" },
        { word: "volcano", hint: "A mountain that can erupt" },
        { word: "waterfall", hint: "Where a river falls off a cliff" },
        { word: "thunder", hint: "The rumble that follows lightning" },
        { word: "mountain", hint: "Very tall, often with snow on top" },
        { word: "forest", hint: "Lots and lots of trees together" },
        { word: "blossom", hint: "The flowers on a tree in spring" },
        { word: "glacier", hint: "A river of ice moving very slowly" },
        { word: "desert", hint: "Hot, sandy, and hardly any rain" },
        { word: "island", hint: "Land with water all the way round it" },
        { word: "snowflake", hint: "Six sides, and no two are the same" },
        { word: "acorn", hint: "The seed an oak tree grows from" },
      ],
    },
  ];
})();
