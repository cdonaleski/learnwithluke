/**
 * Reading the sums a player types.
 *
 * Nothing here goes anywhere near eval. What a child types is taken apart into
 * tokens, built into a tree by a plain recursive-descent parser, and worked out
 * by walking that tree -- so the only things that can ever happen are the
 * handful of operations written below, and a stray bracket produces a sentence
 * rather than an error in the console.
 *
 * The rule that makes the game a game is that every number rolled must be used
 * exactly once, so the numbers in the tree are counted and compared against the
 * dice. Using a 4 twice, or quietly leaving one out, is the whole difference
 * between a clever answer and a wrong one.
 *
 *   expression := term (('+' | '-') term)*
 *   term       := power (('*' | '/') power)*
 *   power      := unary ('^' power)?        -- 2^3^2 is 2^(3^2), as it should be
 *   unary      := ('-' | '√') unary | primary
 *   primary    := number | '(' expression ')'
 */
(function () {
  "use strict";

  // Past this, a sum has stopped being arithmetic and started being a way to
  // make the page stop responding.
  const TOO_BIG = 1e12;
  const MAX_POWER = 40;
  const NEARLY = 1e-9;

  const SYMBOLS = { "×": "*", "·": "*", "÷": "/", "−": "-", "–": "-", "^": "^", "√": "√" };

  function tokenize(text) {
    const out = [];
    const raw = String(text || "");
    let i = 0;
    while (i < raw.length) {
      const ch = raw[i];
      if (ch === " " || ch === "\t") { i++; continue; }
      if (ch >= "0" && ch <= "9") {
        let number = "";
        while (i < raw.length && raw[i] >= "0" && raw[i] <= "9") number += raw[i++];
        out.push({ type: "number", value: Number(number), text: number });
        continue;
      }
      const mapped = SYMBOLS[ch] || ch;
      if ("+-*/^√()".indexOf(mapped) !== -1) {
        out.push({ type: mapped });
        i++;
        continue;
      }
      return { error: "I do not know what \"" + ch + "\" means here." };
    }
    return { tokens: out };
  }

  function parse(tokens) {
    let at = 0;
    const peek = function () { return tokens[at]; };
    const take = function () { return tokens[at++]; };

    function expression() {
      let left = term();
      if (left.error) return left;
      while (peek() && (peek().type === "+" || peek().type === "-")) {
        const op = take().type;
        const right = term();
        if (right.error) return right;
        left = { op: op, left: left, right: right };
      }
      return left;
    }

    function term() {
      let left = power();
      if (left.error) return left;
      while (peek() && (peek().type === "*" || peek().type === "/")) {
        const op = take().type;
        const right = power();
        if (right.error) return right;
        left = { op: op, left: left, right: right };
      }
      return left;
    }

    function power() {
      const base = unary();
      if (base.error) return base;
      if (peek() && peek().type === "^") {
        take();
        const exponent = power();          // right to left, so 2^3^2 is 2^9
        if (exponent.error) return exponent;
        return { op: "^", left: base, right: exponent };
      }
      return base;
    }

    function unary() {
      const next = peek();
      if (!next) return { error: "The sum stops before it is finished." };
      if (next.type === "-") { take(); const inner = unary(); return inner.error ? inner : { op: "neg", left: inner }; }
      if (next.type === "√") { take(); const inner = unary(); return inner.error ? inner : { op: "root", left: inner }; }
      return primary();
    }

    function primary() {
      const next = take();
      if (!next) return { error: "The sum stops before it is finished." };
      if (next.type === "number") return { number: next.value };
      if (next.type === "(") {
        const inside = expression();
        if (inside.error) return inside;
        const close = take();
        if (!close || close.type !== ")") return { error: "There is a bracket that never closes." };
        return inside;
      }
      if (next.type === ")") return { error: "There is a closing bracket with nothing to close." };
      return { error: "There is a " + next.type + " where a number should be." };
    }

    const tree = expression();
    if (tree.error) return tree;
    if (at < tokens.length) {
      return { error: "I got lost after \"" + describe(tree) + "\" — check the brackets." };
    }
    return { tree: tree };
  }

  /** Works the tree out, refusing anything that has stopped being sensible. */
  function evaluate(node) {
    if (node.number !== undefined) return { value: node.number };
    if (node.op === "neg") {
      const inner = evaluate(node.left);
      return inner.error ? inner : { value: -inner.value };
    }
    if (node.op === "root") {
      const inner = evaluate(node.left);
      if (inner.error) return inner;
      if (inner.value < 0) return { error: "You cannot take the square root of a number below nought." };
      return { value: Math.sqrt(inner.value) };
    }
    const left = evaluate(node.left);
    if (left.error) return left;
    const right = evaluate(node.right);
    if (right.error) return right;

    let value;
    if (node.op === "+") value = left.value + right.value;
    else if (node.op === "-") value = left.value - right.value;
    else if (node.op === "*") value = left.value * right.value;
    else if (node.op === "/") {
      if (Math.abs(right.value) < NEARLY) return { error: "You cannot divide by nought." };
      value = left.value / right.value;
    } else if (node.op === "^") {
      if (Math.abs(right.value) > MAX_POWER) return { error: "That power is far too big." };
      if (left.value < 0 && Math.abs(right.value % 1) > NEARLY) {
        return { error: "That power does not give a proper number." };
      }
      value = Math.pow(left.value, right.value);
    } else return { error: "I do not know that operation." };

    if (!Number.isFinite(value)) return { error: "That comes out too big to work with." };
    if (Math.abs(value) > TOO_BIG) return { error: "That comes out far too big." };
    return { value: value };
  }

  /** Every number written in the sum, so they can be counted against the dice. */
  function numbersIn(node, into) {
    const found = into || [];
    if (!node) return found;
    if (node.number !== undefined) { found.push(node.number); return found; }
    numbersIn(node.left, found);
    numbersIn(node.right, found);
    return found;
  }

  function describe(node) {
    if (!node) return "";
    if (node.number !== undefined) return String(node.number);
    if (node.op === "neg") return "-" + describe(node.left);
    if (node.op === "root") return "√" + describe(node.left);
    const signs = { "+": " + ", "-": " − ", "*": " × ", "/": " ÷ ", "^": "^" };
    return "(" + describe(node.left) + signs[node.op] + describe(node.right) + ")";
  }

  function sortedCopy(list) {
    return list.slice().sort(function (a, b) { return a - b; });
  }

  /**
   * Does the sum use each rolled number once, and no others?
   *
   * Checked by taking each number written and crossing one off the dice, so a
   * roll of two fours lets you write two fours but not three. A number that
   * cannot be crossed off is named, because the usual reason for one is a child
   * writing 45 for a 4 and a 5 -- which looks entirely reasonable until someone
   * explains that it is not.
   */
  function usesTheDice(used, dice) {
    const pool = dice.slice();
    const strays = [];
    used.forEach(function (n) {
      const at = pool.indexOf(n);
      if (at === -1) strays.push(n);
      else pool.splice(at, 1);
    });

    if (strays.length) {
      const stray = strays[0];
      const stuckTogether = String(stray).length > 1 &&
        String(stray).split("").every(function (d) { return dice.indexOf(Number(d)) !== -1; });
      return { ok: false, why: stuckTogether
        ? stray + " is two dice pushed together. Each one has to be used as its own number."
        : stray + " is not one of the numbers you rolled — use " + dice.join(", ") + "." };
    }
    if (pool.length) {
      return { ok: false, why: pool.length === 1
        ? "The " + pool[0] + " has not been used. Every number rolled has to be."
        : "You still have " + pool.join(" and ") + " to use." };
    }
    return { ok: true };
  }

  /** Whole numbers only, and let a whisker of rounding pass. */
  function wholeNumber(value) {
    const near = Math.round(value);
    return Math.abs(value - near) < 1e-7 ? near : null;
  }

  /**
   * The whole check, in one call: does it parse, does it use the dice, does it
   * come out as a whole number. What it does NOT decide is whether that number
   * is on the board -- the game knows that.
   */
  function check(text, dice, allowed) {
    if (!String(text || "").trim()) return { ok: false, why: "Type a sum first." };
    const lexed = tokenize(text);
    if (lexed.error) return { ok: false, why: lexed.error };
    if (!lexed.tokens.length) return { ok: false, why: "Type a sum first." };

    const banned = lexed.tokens.filter(function (t) {
      return (t.type === "^" && allowed && allowed.indexOf("^") === -1) ||
             (t.type === "√" && allowed && allowed.indexOf("√") === -1);
    });
    if (banned.length) {
      return { ok: false, why: "Powers and square roots are saved for the harder levels." };
    }

    const parsed = parse(lexed.tokens);
    if (parsed.error) return { ok: false, why: parsed.error };

    const used = numbersIn(parsed.tree);
    const fits = usesTheDice(used, dice);
    if (!fits.ok) return { ok: false, why: fits.why };

    const worked = evaluate(parsed.tree);
    if (worked.error) return { ok: false, why: worked.error };

    const whole = wholeNumber(worked.value);
    if (whole === null) {
      return { ok: false, why: "That comes to " + Math.round(worked.value * 100) / 100 +
        ", which is not a whole number." };
    }
    return { ok: true, value: whole, tidy: describe(parsed.tree) };
  }

  window.Expression = {
    TOO_BIG: TOO_BIG, MAX_POWER: MAX_POWER,
    tokenize: tokenize, parse: parse, evaluate: evaluate, numbersIn: numbersIn,
    describe: describe, usesTheDice: usesTheDice, wholeNumber: wholeNumber, check: check,
  };
})();
