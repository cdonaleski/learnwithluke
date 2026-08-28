/**
 * The twelve pentominoes.
 *
 * A pentomino is five squares joined edge to edge. There are exactly twelve
 * ways to do that -- no more have ever been found because no more exist -- and
 * each is named after the letter it looks like.
 *
 * Only one way up of each is written down here. Every other way up is worked
 * out: turn it four times, flip it over, turn it four more, and throw away any
 * that come out the same as one already found. That last step is why the X
 * ends up with one way up and the F with eight, which is a fact about the
 * shapes rather than a decision anybody made.
 */
(function () {
  "use strict";

  const BASE = {
    F: [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]],
    I: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
    L: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3]],
    N: [[1, 0], [1, 1], [0, 2], [1, 2], [0, 3]],
    P: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]],
    T: [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]],
    U: [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
    V: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]],
    W: [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2]],
    X: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]],
    Y: [[1, 0], [0, 1], [1, 1], [1, 2], [1, 3]],
    Z: [[0, 0], [1, 0], [1, 1], [1, 2], [2, 2]],
  };

  /** The colours are only so a child can tell one piece from the next. */
  const COLOUR = {
    F: "#ef6f6c", I: "#f2a65a", L: "#f5cf5b", N: "#a8cf5b",
    P: "#5bbf7a", T: "#4fb8a8", U: "#4f9fd0", V: "#6f7fd8",
    W: "#a97bd8", X: "#d871b8", Y: "#c98a5e", Z: "#8d9aa8",
  };

  /** Slides a shape up against the top-left corner so two shapes can be compared. */
  function snug(cells) {
    const minX = Math.min.apply(null, cells.map(function (c) { return c[0]; }));
    const minY = Math.min.apply(null, cells.map(function (c) { return c[1]; }));
    return cells
      .map(function (c) { return [c[0] - minX, c[1] - minY]; })
      .sort(function (a, b) { return a[1] - b[1] || a[0] - b[0]; });
  }

  function asText(cells) {
    return snug(cells).map(function (c) { return c.join(","); }).join(" ");
  }

  const spin = function (cells) { return cells.map(function (c) { return [-c[1], c[0]]; }); };
  const flip = function (cells) { return cells.map(function (c) { return [-c[0], c[1]]; }); };

  /** Every distinct way up of a shape. */
  function waysUp(cells) {
    const found = {}, out = [];
    [cells, flip(cells)].forEach(function (start) {
      let turned = start;
      for (let i = 0; i < 4; i++) {
        const tidy = snug(turned);
        const name = asText(tidy);
        if (!found[name]) { found[name] = true; out.push(tidy); }
        turned = spin(turned);
      }
    });
    return out;
  }

  /**
   * Which way up you land on if you turn or flip this one. Worked out rather
   * than assumed, because the list of ways up has had its duplicates thrown
   * away -- so for the X, turning it lands you back where you started, and the
   * buttons have to know that.
   */
  function neighbours(ways) {
    const index = {};
    ways.forEach(function (way, i) { index[asText(way)] = i; });
    return {
      turned: ways.map(function (way) { return index[asText(spin(way))]; }),
      flipped: ways.map(function (way) { return index[asText(flip(way))]; }),
    };
  }

  const PIECES = {};
  Object.keys(BASE).forEach(function (letter) {
    const ways = waysUp(BASE[letter]);
    const links = neighbours(ways);
    PIECES[letter] = {
      turned: links.turned,
      flipped: links.flipped,
      letter: letter,
      colour: COLOUR[letter],
      cells: snug(BASE[letter]),
      ways: ways,
      width: Math.max.apply(null, snug(BASE[letter]).map(function (c) { return c[0]; })) + 1,
      height: Math.max.apply(null, snug(BASE[letter]).map(function (c) { return c[1]; })) + 1,
    };
  });

  window.Pentominoes = {
    LETTERS: Object.keys(BASE),
    PIECES: PIECES,
    snug: snug,
    asText: asText,
    waysUp: waysUp,
  };
})();
