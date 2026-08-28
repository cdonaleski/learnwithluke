/**
 * The puzzles, easiest first.
 *
 * Every one of these was found by the solver rather than by hand, and the
 * answer stored with it is the answer it found -- so no puzzle can be
 * impossible, which is the one unforgivable thing to hand a child. A test
 * re-solves each of them from scratch to make sure it stays that way.
 *
 * `set`      which pieces you get, one letter each
 * `answer`   one way it can be done, a row per line
 * `ways`     how many genuinely different answers exist, not counting the
 *            same one turned round or held up to a mirror
 *
 * Add a puzzle here and it appears on the page. If you invent one, run the
 * tests: they will tell you if it cannot be done.
 */
(function () {
  "use strict";

  window.PentPuzzles = [
    {
      id: "three", title: "Three to start", w: 5, h: 3, set: "LPV",
      answer: ["LLLLV", "PPPLV", "PPVVV"],
      note: "Three pieces, fifteen squares. Every square has to be covered and " +
            "no piece may overlap another.",
    },
    {
      id: "four", title: "Four in a box", w: 5, h: 4, set: "ILPV",
      answer: ["IIIII", "LLLLV", "PPPLV", "PPVVV"],
      note: "The I only fits one way up in a box four tall. Start with the piece " +
            "that has the fewest choices — that is the whole trick to these.",
    },
    {
      id: "square", title: "A perfect square", w: 5, h: 5, set: "ILPTV",
      answer: ["ILLLL", "ILPPP", "IVPPT", "IVTTT", "IVVVT"],
      note: "Twenty-five squares, five pieces. Corners are the hardest part of " +
            "any of these: only some shapes can sit in one.",
    },
    {
      id: "six", title: "Six of them", w: 6, h: 5, set: "ILPTUV",
      answer: ["IIIIIT", "VVVTTT", "VLLLLT", "VPPULU", "PPPUUU"],
      note: "The U is awkward: it leaves a notch that only certain pieces can fill.",
    },
    {
      id: "seven", title: "Seven", w: 7, h: 5, set: "ILPTUVY",
      answer: ["IIIIIPP", "LLLLTPP", "UUULTPV", "UYUTTTV", "YYYYVVV"],
      note: "If you leave a gap of one, two, three or four squares anywhere, you " +
            "have already lost — nothing can ever fill it.",
    },
    {
      id: "eight", title: "Eight", w: 8, h: 5, set: "ILNPTUVY",
      answer: ["IIIIITTT", "LVVVPPTY", "LVUUPPTY", "LVUNNPYY", "LLUUNNNY"],
      note: "The N and the Y look almost the same and behave nothing alike. " +
            "Getting caught out by that is part of the fun.",
    },
    {
      id: "nine", title: "Nine", w: 9, h: 5, set: "ILNPTUVYZ",
      answer: ["IIIIIVVVZ", "LLLLTVZZZ", "PPPLTVZUU", "PPYTTTNNU", "YYYYNNNUU"],
      note: "Work along one edge rather than jumping about. A tidy edge leaves " +
            "you far fewer ways to go wrong.",
    },
    {
      id: "classic", title: "All twelve", w: 10, h: 6, set: "FILNPTUVWXYZ",
      answer: ["FFTTTWWXUU", "IFFTWWXXXU", "IFNTWZVXUU", "INNZZZVPPP", "INLZVVVYPP",
               "INLLLLYYYY"],
      ways: 2339,
      note: "All twelve pieces in one rectangle. There are 2,339 genuinely " +
            "different ways to do it, so you have plenty of room to be right.",
    },
    {
      id: "tall", title: "Longer and thinner", w: 12, h: 5, set: "FILNPTUVWXYZ",
      answer: ["FFYYYYWWPPPI", "LFFXYZZWWPPI", "LFXXXZTUWUVI", "LNNXZZTUUUVI", "LLNNNTTTVVVI"],
      ways: 1010,
      note: "The same twelve pieces, a shallower box. 1,010 ways — less than half " +
            "as many as the last one, and it feels it.",
    },
    {
      id: "long", title: "Longer still", w: 15, h: 4, set: "FILNPTUVWXYZ",
      answer: ["FFNNNUUYYYYLLLL", "VFFXNNUZYTTTWWL", "VFXXXUUZZZTPPWW", "VVVXIIIIIZTPPPW"],
      ways: 368,
      note: "Only four squares tall. The X barely fits at all, and where it goes decides " +
            "most of the rest. 368 ways.",
    },
    {
      id: "hardest", title: "The hard one", w: 20, h: 3, set: "FILNPTUVWXYZ",
      answer: ["UUXIIIIINNNFTWYYYYZV", "UXXXPPLNNFFFTWWYZZZV", "UUXPPPLLLLFTTTWWZVVV"],
      ways: 2,
      note: "Three squares tall. In the whole of mathematics there are exactly " +
            "two ways to do this, and this is one of them. Do not feel bad about " +
            "asking for a hint.",
    },
  ];
})();
