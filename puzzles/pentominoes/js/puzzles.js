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
      id: "three", title: "Three to start", w: 3, h: 5, set: "LPV",
      answer: ["LPP", "LPP", "LPV", "LLV", "VVV"],
      note: "Three pieces, fifteen squares. Every square has to be covered and " +
            "no piece may overlap another.",
    },
    {
      id: "four", title: "Four in a box", w: 4, h: 5, set: "ILPV",
      answer: ["ILPP", "ILPP", "ILPV", "ILLV", "IVVV"],
      note: "The I only fits one way up in a box five tall. Start with the piece " +
            "that has the fewest choices — that is the whole trick to these.",
    },
    {
      id: "square", title: "A perfect square", w: 5, h: 5, set: "ILPTV",
      answer: ["ILLLL", "ILPPP", "IVPPT", "IVTTT", "IVVVT"],
      note: "Twenty-five squares, five pieces. Corners are the hardest part of " +
            "any of these: only some shapes can sit in one.",
    },
    {
      id: "six", title: "Six of them", w: 5, h: 6, set: "ILPTUV",
      answer: ["IVVVP", "IVLPP", "IVLPP", "ITLUU", "ITLLU", "TTTUU"],
      note: "The U is awkward: it leaves a notch that only certain pieces can fill.",
    },
    {
      id: "seven", title: "Seven", w: 5, h: 7, set: "ILPTUVY",
      answer: ["ILUUY", "ILUYY", "ILUUY", "ILLTY", "ITTTV", "PPPTV", "PPVVV"],
      note: "If you leave a gap of one, two, three or four squares anywhere, you " +
            "have already lost — nothing can ever fill it.",
    },
    {
      id: "eight", title: "Eight", w: 5, h: 8, set: "ILNPTUVY",
      answer: ["ILLLL", "IVVVL", "IVUUU", "IVUNU", "IPPNN", "TPPPN", "TTTYN", "TYYYY"],
      note: "The N and the Y look almost the same and behave nothing alike. " +
            "Getting caught out by that is part of the fun.",
    },
    {
      id: "nine", title: "Nine", w: 5, h: 9, set: "ILNPTUVYZ",
      answer: ["ILPPY", "ILPPY", "ILPYY", "ILLTY", "ITTTN", "VVVTN", "VZZNN", "VZUNU", "ZZUUU"],
      note: "Work along one edge rather than jumping about. A tidy edge leaves " +
            "you far fewer ways to go wrong.",
    },
    {
      id: "classic", title: "All twelve", w: 6, h: 10, set: "FILNPTUVWXYZ",
      answer: ["FIIIII", "FFFNNN", "TFNNLL", "TTTZZL", "TWWZVL", "WWZZVL",
               "WXVVVY", "XXXPYY", "UXUPPY", "UUUPPY"],
      ways: 2339,
      note: "All twelve pieces in one rectangle. There are 2,339 genuinely " +
            "different ways to do it, so you have plenty of room to be right.",
    },
    {
      id: "tall", title: "Taller and thinner", w: 5, h: 12, set: "FILNPTUVWXYZ",
      answer: ["FLLLL", "FFFNL", "YFXNN", "YXXXN", "YYXZN", "YZZZT",
               "WZTTT", "WWUUT", "PWWUV", "PPUUV", "PPVVV", "IIIII"],
      ways: 1010,
      note: "The same twelve pieces, a narrower box. 1,010 ways — less than half " +
            "as many as the last one, and it feels it.",
    },
    {
      id: "long", title: "Longer still", w: 4, h: 15, set: "FILNPTUVWXYZ",
      answer: ["FVVV", "FFFV", "NFXV", "NXXX", "NNXI", "UNUI", "UUUI", "YZZI",
               "YYZI", "YTZZ", "YTTT", "LTPP", "LWPP", "LWWP", "LLWW"],
      ways: 368,
      note: "Only four wide. The X barely fits at all, and where it goes decides " +
            "most of the rest. 368 ways.",
    },
    {
      id: "hardest", title: "The hard one", w: 3, h: 20, set: "FILNPTUVWXYZ",
      answer: ["UUU", "UXU", "XXX", "IXP", "IPP", "IPP", "ILL", "INL", "NNL",
               "NFL", "NFF", "FFT", "TTT", "WWT", "YWW", "YYW", "YZZ", "YZV",
               "ZZV", "VVV"],
      ways: 2,
      note: "Three squares wide. In the whole of mathematics there are exactly " +
            "two ways to do this, and this is one of them. Do not feel bad about " +
            "asking for a hint.",
    },
  ];
})();
