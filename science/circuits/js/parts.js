/**
 * The parts you can build with.
 *
 * Add a part here and it exists everywhere: in the palette, in the simulation
 * and in the drawing. A part says which sides of its square have terminals on
 * them, and what it does between those terminals.
 *
 *   terminals   which edges a wire can reach it from, before it is turned
 *   kind        what the simulator does with it
 *   ohms        how hard it is to push current through (loads only)
 *
 * Sides are N, E, S and W. Turning a part a quarter turn moves every one of
 * its terminals round by one, so a part only has to be described facing one
 * way and every other way follows.
 */
(function () {
  "use strict";

  const DIRS = ["N", "E", "S", "W"];

  window.CircuitParts = {
    DIRS: DIRS,

    /** A quarter turn clockwise, `by` times. */
    turn: function (dir, by) {
      return DIRS[(DIRS.indexOf(dir) + (by % 4) + 4) % 4];
    },

    /** The side of the next square that faces this one. */
    facing: function (dir) {
      return DIRS[(DIRS.indexOf(dir) + 2) % 4];
    },

    /** Turns one of a part's own square offsets a quarter turn clockwise. */
    turnOffset: function (offset, by) {
      let x = offset[0], y = offset[1];
      for (let i = 0; i < ((by % 4) + 4) % 4; i++) { const was = x; x = -y; y = was; }
      return [x, y];
    },

    /** Which square a side points at. */
    step: function (x, y, dir) {
      if (dir === "N") return [x, y - 1];
      if (dir === "S") return [x, y + 1];
      if (dir === "E") return [x + 1, y];
      return [x - 1, y];
    },

    /**
     * A part occupies one square unless it says otherwise, and every terminal
     * belongs to one of those squares. `spans` lists the squares as offsets
     * from the one you clicked; `wires` lists the terminals, each naming the
     * square it is on, the side it is on, and what the part calls it.
     */
    list: {
      wire: {
        name: "Wire", icon: "\u2015", kind: "wire",
        wires: [{ d: "N" }, { d: "E" }, { d: "S" }, { d: "W" }],
        blurb: "Carries electricity. Joins up to anything it touches.",
      },

      battery: {
        name: "Battery", icon: "\ud83d\udd0b", kind: "source", volts: 9,
        wires: [{ d: "W", n: "minus" }, { d: "E", n: "plus" }],
        blurb: "Pushes the electricity round. Every circuit needs one.",
      },

      bulb: {
        name: "Bulb", icon: "\ud83d\udca1", kind: "load", ohms: 12,
        wires: [{ d: "W", n: "a" }, { d: "E", n: "b" }],
        blurb: "Lights up when electricity flows through it.",
      },

      motor: {
        name: "Motor", icon: "\u2699\ufe0f", kind: "load", ohms: 24,
        wires: [{ d: "W", n: "a" }, { d: "E", n: "b" }],
        blurb: "Spins when electricity flows through it.",
      },

      switch: {
        name: "Switch", icon: "\u2b1c", kind: "switch",
        wires: [{ d: "W", n: "a" }, { d: "E", n: "b" }],
        joins: [[], [["a", "b"]]],          // off is nothing joined; on joins the two sides
        blurb: "Makes a gap in the circuit, or closes it. Click to flip.",
      },

      /**
       * What an electrician fits when a light has to work from two places. It
       * never makes a gap -- it sends the circuit down one of two roads.
       * Called a three-way switch in America, after its three terminals, and a
       * two-way switch in Britain, after the two places.
       */
      switch3: {
        name: "Two-way", icon: "\u2934\ufe0f", kind: "switch3",
        wires: [{ d: "W", n: "common" }, { d: "N", n: "up" }, { d: "S", n: "down" }],
        joins: [[["common", "up"]], [["common", "down"]]],
        blurb: "Sends the electricity one of two ways instead of stopping it.",
      },

      /**
       * Goes in the middle when a light has to work from three places or more.
       * It takes both roads and either lets them run straight past or swaps
       * them over. It is two squares tall because both roads have to run
       * through it side by side, exactly as they do on a real one -- and
       * because nothing else on this board may cross over anything.
       */
      switch4: {
        name: "Middle", icon: "\u2715", kind: "switch4",
        // Three squares tall: a road along the top, a road along the bottom, and
        // solid body between them. The gap matters -- two wires laid side by
        // side on this board touch, and the two roads must never touch.
        spans: [[0, 0], [0, 1], [0, 2]],
        wires: [
          { s: 0, d: "W", n: "inA" }, { s: 0, d: "E", n: "outA" },
          { s: 2, d: "W", n: "inB" }, { s: 2, d: "E", n: "outB" },
        ],
        joins: [
          [["inA", "outA"], ["inB", "outB"]],     // straight through
          [["inA", "outB"], ["inB", "outA"]],     // swapped over
        ],
        blurb: "Swaps the two roads over, or leaves them alone.",
      },
    },
  };
})();
