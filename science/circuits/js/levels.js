/**
 * The lessons, in the order they are met.
 *
 * Add one here and it appears on the page. Each says what is already on the
 * board, what the child may add, and what has to be true before it counts as
 * done. Nothing is checked by looking at where pieces were put -- the board is
 * simulated and the answer judged on what the electricity actually does, so
 * any wiring that genuinely works is accepted, including ones I never thought
 * of.
 *
 *   fixed     already there, and cannot be moved
 *   start     already there, and can be moved or thrown away
 *   tray      what may be added, and how many of each
 *   goal      lit      at least one bulb is lit
 *             allLit   every bulb on the board is lit
 *             bright   every bulb is at nearly full brightness
 *             rule     the switches work the light in a particular way:
 *                        on   the one switch turns it on and off
 *                        and  every switch has to be on
 *                        or   any one switch is enough
 *                        xor  every switch changes it, whatever the others do
 *   answer    one wiring that works, so a test can prove the level is possible
 *
 * A short circuit fails every goal. Getting the light on by melting the
 * battery is not getting the light on.
 */
(function () {
  "use strict";

  window.CircuitLevels = [
    {
      id: "loop",
      title: "Close the loop",
      hint: "There is a gap on the right. Electricity cannot jump a gap.",
      teach: "Electricity only moves round a loop with no gaps in it. A loop " +
             "with a gap is an open circuit and nothing happens. Close the gap " +
             "and it is a closed circuit, and the bulb lights.",
      w: 5, h: 3,
      fixed: [
        [0, 0, "wire"], [1, 0, "battery"], [2, 0, "wire"], [3, 0, "wire"],
        [0, 1, "wire"],
        [0, 2, "wire"], [1, 2, "wire"], [2, 2, "bulb"], [3, 2, "wire"],
      ],
      tray: { wire: 1 },
      goal: { kind: "lit" },
      answer: [[3, 1, "wire"]],
    },

    {
      id: "long",
      title: "The long way round",
      hint: "It does not matter how far it goes, only that it gets all the way back.",
      teach: "The loop can be as long as you like. Electricity does not get " +
             "tired and it does not get lost -- but every single piece has to " +
             "touch the next one.",
      w: 7, h: 4,
      fixed: [
        [0, 0, "wire"], [1, 0, "battery"], [2, 0, "wire"], [6, 0, "wire"],
        [0, 1, "wire"], [0, 2, "wire"],
        [0, 3, "wire"], [1, 3, "wire"], [2, 3, "bulb"], [3, 3, "wire"], [6, 3, "wire"],
      ],
      tray: { wire: 7 },
      goal: { kind: "lit" },
      answer: [
        [3, 0, "wire"], [4, 0, "wire"], [5, 0, "wire"],
        [6, 1, "wire"], [6, 2, "wire"], [5, 3, "wire"], [4, 3, "wire"],
      ],
    },

    {
      id: "switch",
      title: "A switch of your own",
      hint: "A switch is a gap you are allowed to close. Put one in, then click it.",
      teach: "A switch is nothing cleverer than a gap you can open and close " +
             "whenever you like. Every light switch in your house is doing " +
             "exactly this.",
      w: 5, h: 3,
      fixed: [
        [0, 0, "wire"], [1, 0, "battery"], [2, 0, "wire"], [3, 0, "wire"],
        [0, 1, "wire"],
        [0, 2, "wire"], [1, 2, "wire"], [2, 2, "bulb"], [3, 2, "wire"],
      ],
      tray: { switch: 1 },
      goal: { kind: "rule", rule: "on" },
      answer: [[3, 1, "switch", 1]],
    },

    {
      id: "and",
      title: "Both at once",
      hint: "Two switches, one after the other, on the same loop.",
      teach: "Switches one after another are in series. The electricity has to " +
             "get past both, so both have to be on. A microwave door and its " +
             "start button work like this: neither alone will do.",
      w: 6, h: 4,
      fixed: [
        [0, 0, "wire"], [1, 0, "battery"], [2, 0, "wire"], [4, 0, "wire"],
        [0, 1, "wire"],
        [0, 2, "wire"], [1, 2, "wire"], [2, 2, "bulb"], [3, 2, "wire"], [4, 2, "wire"],
      ],
      tray: { switch: 2 },
      goal: { kind: "rule", rule: "and" },
      answer: [[3, 0, "switch"], [4, 1, "switch", 1]],
    },

    {
      id: "or",
      title: "Either one will do",
      hint: "Two switches side by side, each bridging the same two rails.",
      teach: "Switches side by side are in parallel. The electricity only needs " +
             "one way through, so either switch on is enough. Two doors into " +
             "the same room, and only one of them has to be unlocked.",
      w: 5, h: 4,
      fixed: [
        [0, 0, "wire"], [1, 0, "wire"], [2, 0, "wire"], [3, 0, "wire"], [4, 0, "wire"],
        [0, 1, "battery", 1],
        [0, 2, "bulb", 1], [1, 2, "wire"], [2, 2, "wire"], [3, 2, "wire"], [4, 2, "wire"],
        [0, 3, "wire"], [1, 3, "wire"],
      ],
      tray: { switch: 2 },
      goal: { kind: "rule", rule: "or" },
      answer: [[1, 1, "switch", 1], [3, 1, "switch", 1]],
    },

    {
      id: "series",
      title: "One after another",
      hint: "Put the second bulb in the gap on the bottom row.",
      teach: "Two bulbs in a row share the push between them, so each gets half " +
             "the voltage -- and only a quarter of the power. That is why they " +
             "go properly dim rather than half dim. Old Christmas lights were " +
             "wired like this, which is why one dud bulb killed the whole string.",
      w: 5, h: 3,
      fixed: [
        [0, 0, "wire"], [1, 0, "battery"], [2, 0, "wire"], [3, 0, "wire"],
        [0, 1, "wire"], [3, 1, "wire"],
        [0, 2, "wire"], [2, 2, "bulb"], [3, 2, "wire"],
      ],
      tray: { bulb: 1 },
      goal: { kind: "allLit", least: 2 },
      answer: [[1, 2, "bulb"]],
    },

    {
      id: "parallel",
      title: "Side by side",
      hint: "Give the second bulb its own way round, not the first one's.",
      teach: "Two bulbs side by side each get the whole push, so both are fully " +
             "bright -- and the battery has to work twice as hard, so it runs " +
             "down twice as fast. Everything in your house is wired this way.",
      w: 5, h: 3,
      fixed: [
        [0, 0, "wire"], [1, 0, "battery"], [2, 0, "wire"], [3, 0, "wire"],
        [0, 1, "wire"], [3, 1, "wire"], [0, 2, "wire"], [3, 2, "wire"],
        [1, 1, "bulb"], [2, 1, "wire"],
      ],
      tray: { bulb: 1, wire: 1 },
      goal: { kind: "bright", least: 2 },
      answer: [[1, 2, "bulb"], [2, 2, "wire"]],
    },

    {
      id: "short",
      title: "The bulb that will not light",
      hint: "Something is letting the electricity get round without going " +
            "through the bulb. Find it and throw it away.",
      teach: "Electricity takes every road it can, and takes the easiest one " +
             "hardest. A bare wire laid round a bulb is a much easier road than " +
             "the bulb, so nearly all of it goes that way and the bulb sits " +
             "dark. That is a short circuit, and it is what a blown fuse is for.",
      w: 6, h: 4,
      fixed: [
        [0, 0, "wire"], [1, 0, "battery"], [2, 0, "wire"], [3, 0, "wire"],
        [4, 0, "wire"], [5, 0, "wire"], [5, 1, "wire"], [0, 1, "wire"],
        [0, 2, "wire"], [1, 2, "bulb"], [2, 2, "wire"], [3, 2, "bulb"],
        [4, 2, "wire"], [5, 2, "wire"],
      ],
      start: [[2, 3, "wire"], [3, 3, "wire"], [4, 3, "wire"]],
      tray: {},
      goal: { kind: "allLit" },
      answer: [],
      remove: [[2, 3], [3, 3], [4, 3]],
    },

    {
      id: "twoplaces",
      title: "Two doors, one light",
      hint: "Each switch sends the electricity down one of two roads. Lay both " +
            "roads from one switch to the other -- and do not let them touch.",
      teach: "This is the real thing, wired the way a hallway is wired. Neither " +
             "switch makes a gap: each one picks a road. The light is on when " +
             "both switches happen to have picked the same road, so flipping " +
             "either one always changes it. Electricians call this a three-way " +
             "switch in America and a two-way switch in Britain -- the same " +
             "switch, named after its three terminals or its two places.",
      w: 7, h: 5,
      fixed: [
        [0, 1, "wire"], [1, 1, "wire"], [2, 1, "switch3"], [4, 1, "switch3", 2],
        [5, 1, "wire"], [6, 1, "wire"],
        [0, 2, "wire"], [6, 2, "wire"], [0, 3, "wire"], [6, 3, "wire"],
        [0, 4, "wire"], [1, 4, "battery", 2], [2, 4, "wire"], [3, 4, "bulb"],
        [4, 4, "wire"], [5, 4, "wire"], [6, 4, "wire"],
      ],
      tray: { wire: 6 },
      goal: { kind: "rule", rule: "xor" },
      answer: [
        [2, 0, "wire"], [3, 0, "wire"], [4, 0, "wire"],
        [2, 2, "wire"], [3, 2, "wire"], [4, 2, "wire"],
      ],
    },

    {
      id: "threeplaces",
      title: "Halfway up the stairs",
      hint: "The middle switch takes both roads and either lets them past or " +
            "swaps them over. It is three squares tall so the roads never touch.",
      teach: "To work a light from a third place you cannot just add another " +
             "switch -- you have to put one into both roads at once, which " +
             "either lets them run straight through or crosses them over. Add " +
             "as many of these as you like and the light works from as many " +
             "places as you like. It is the same trick as a row of light " +
             "switches down a long corridor.",
      w: 10, h: 6,
      fixed: [
        [2, 1, "wire"], [3, 1, "wire"], [7, 1, "wire"],
        [0, 2, "wire"], [1, 2, "wire"], [2, 2, "switch3"],
        [7, 2, "switch3", 2], [8, 2, "wire"], [9, 2, "wire"],
        [2, 3, "wire"], [3, 3, "wire"], [7, 3, "wire"],
        [0, 3, "wire"], [0, 4, "wire"], [9, 3, "wire"], [9, 4, "wire"],
        [0, 5, "wire"], [1, 5, "battery"], [2, 5, "wire"], [3, 5, "bulb"],
        [4, 5, "wire"], [5, 5, "wire"], [6, 5, "wire"], [7, 5, "wire"],
        [8, 5, "wire"], [9, 5, "wire"],
      ],
      tray: { switch4: 1, wire: 4 },
      goal: { kind: "rule", rule: "xor" },
      answer: [
        [5, 1, "switch4"],
        [4, 1, "wire"], [6, 1, "wire"], [4, 3, "wire"], [6, 3, "wire"],
      ],
    },
  ];
})();
