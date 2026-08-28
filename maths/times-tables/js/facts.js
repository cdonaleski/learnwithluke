/**
 * Which times table fact to ask next, and how well it is known.
 *
 * The point of this file is that practice should not be random. Asking a child
 * 7 x 8 as often as 2 x 2 wastes most of their time on the ones they already
 * know. Every fact carries a strength from 0 to 5, and the chance of being
 * asked falls away sharply as that strength rises -- so the ones being got
 * wrong keep coming back, and the ones that are solid quietly stop appearing.
 *
 * 3 x 7 and 7 x 3 are held as ONE fact, because they are one fact: knowing
 * either is knowing both. They are still asked in either order, and the grid
 * colours both squares together, which shows a child something true about
 * multiplication rather than doubling their work.
 *
 * Nothing here touches the page or the browser's storage. Give it a store, get
 * back what to ask.
 */
(function () {
  "use strict";

  const MAX = 12;
  const TOP_STRENGTH = 5;

  /** One name for a fact and its mirror image. */
  function key(a, b) {
    return Math.min(a, b) + "x" + Math.max(a, b);
  }

  function blank() {
    return { facts: {}, asked: 0, right: 0 };
  }

  function factIn(store, a, b) {
    return store.facts[key(a, b)] || { right: 0, wrong: 0, streak: 0 };
  }

  /**
   * How well a fact is known, 0 to 5.
   *
   * A right answer is worth one step up; a wrong one costs two, because
   * getting it wrong after a run of luck says more than getting it right does.
   * It cannot fall below nothing or rise above five.
   */
  function strengthOf(store, a, b) {
    return Math.max(0, Math.min(TOP_STRENGTH, factIn(store, a, b).streak));
  }

  function record(store, a, b, right) {
    const name = key(a, b);
    const fact = store.facts[name] || { right: 0, wrong: 0, streak: 0 };
    if (right) { fact.right += 1; fact.streak = Math.min(TOP_STRENGTH, fact.streak + 1); }
    else { fact.wrong += 1; fact.streak = Math.max(0, fact.streak - 2); }
    store.facts[name] = fact;
    store.asked += 1;
    if (right) store.right += 1;
    return fact;
  }

  /**
   * How likely a fact is to come up. Squaring the gap makes the difference
   * between "never seen" and "solid" about thirty-six to one, which is enough
   * to feel like the practice is aimed at you without a fact you have just
   * learned vanishing entirely.
   */
  function weightFor(strength) {
    const gap = TOP_STRENGTH + 1 - strength;
    return gap * gap;
  }

  /** Every fact in the chosen tables, as [a, b] pairs. */
  function poolFor(tables) {
    const out = [];
    tables.forEach(function (a) {
      for (let b = 1; b <= MAX; b++) out.push([a, b]);
    });
    return out;
  }

  /**
   * The next fact to ask. Weighted towards the shaky ones, and never the same
   * fact twice running -- being asked 6 x 7 twice in a row feels like the
   * program has stopped paying attention.
   */
  function pick(store, tables, avoid, random) {
    const roll = random || Math.random;
    let pool = poolFor(tables);
    if (avoid && pool.length > 1) {
      const without = pool.filter(function (p) { return key(p[0], p[1]) !== avoid; });
      if (without.length) pool = without;
    }
    let total = 0;
    const weights = pool.map(function (p) {
      const w = weightFor(strengthOf(store, p[0], p[1]));
      total += w;
      return w;
    });
    let ticket = roll() * total;
    for (let i = 0; i < pool.length; i++) {
      ticket -= weights[i];
      if (ticket <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  /**
   * The question itself. `kind` is one of:
   *   times    7 x 8 = ?
   *   missing  7 x ? = 56      -- the one that teaches division without saying so
   *   divide   56 ÷ 7 = ?
   * `flip` swaps which number is shown, so it is not always the table you chose
   * that appears first.
   */
  function ask(a, b, kind, flip) {
    const shown = flip ? b : a;
    const hidden = flip ? a : b;
    const product = a * b;
    if (kind === "missing") {
      return { kind: kind, a: a, b: b, answer: hidden,
               text: shown + " × ? = " + product, spoken: shown + " times what makes " + product };
    }
    if (kind === "divide") {
      return { kind: kind, a: a, b: b, answer: hidden,
               text: product + " ÷ " + shown, spoken: product + " divided by " + shown };
    }
    return { kind: "times", a: a, b: b, answer: product,
             text: shown + " × " + hidden, spoken: shown + " times " + hidden };
  }

  /** How many of the 78 different facts are solid, and how far through we are. */
  function progress(store, tables) {
    const seen = {};
    let strong = 0, total = 0;
    poolFor(tables || allTables()).forEach(function (p) {
      const name = key(p[0], p[1]);
      if (seen[name]) return;              // 3x7 and 7x3 are the same fact
      seen[name] = true;
      total += 1;
      if (strengthOf(store, p[0], p[1]) >= 4) strong += 1;
    });
    return { strong: strong, total: total };
  }

  function allTables() {
    const out = [];
    for (let a = 1; a <= MAX; a++) out.push(a);
    return out;
  }

  /** The facts being got wrong most often, worst first. */
  function trickiest(store, howMany) {
    const rows = Object.keys(store.facts).map(function (name) {
      const bits = name.split("x");
      const fact = store.facts[name];
      return { a: Number(bits[0]), b: Number(bits[1]), fact: fact,
               strength: Math.max(0, Math.min(TOP_STRENGTH, fact.streak)) };
    });
    rows.sort(function (x, y) {
      return (x.strength - y.strength) || (y.fact.wrong - x.fact.wrong);
    });
    return rows.filter(function (r) { return r.fact.wrong > 0; }).slice(0, howMany || 6);
  }

  window.TimesFacts = {
    MAX: MAX, TOP_STRENGTH: TOP_STRENGTH,
    key: key, blank: blank, strengthOf: strengthOf, record: record,
    weightFor: weightFor, poolFor: poolFor, pick: pick, ask: ask,
    progress: progress, allTables: allTables, trickiest: trickiest,
  };
})();
