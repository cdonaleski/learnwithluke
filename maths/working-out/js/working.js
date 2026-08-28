/**
 * Sums worked out on paper, one step at a time.
 *
 * A calculator gives a child the answer, which is the least interesting part.
 * This gives them the working: the carries, the exchanges, the partial products
 * and the remainders, in the order and the layout they would write them.
 *
 * Every step is a complete snapshot of what the page should look like at that
 * moment, so stepping backwards is just showing an earlier one and nothing has
 * to be undone. And because each snapshot carries the numbers it is claiming,
 * the tests can check that every step is arithmetically true -- not merely that
 * the last one happens to land on the right answer.
 */
(function () {
  "use strict";

  const MAX = 99999;

  function digitsOf(n) {
    return String(n).split("").map(Number);
  }

  /** A row of cells, right-aligned into `width` columns. */
  function row(kind, cells, width, label) {
    const pad = [];
    for (let i = cells.length; i < width; i++) pad.push({ t: "" });
    return { kind: kind, label: label || "", cells: pad.concat(cells) };
  }

  function cell(text, mark) {
    return { t: text === null || text === undefined ? "" : String(text), mark: mark || "" };
  }

  /**
   * Nobody writes 067 for sixty-seven. Noughts at the front of an answer are
   * left off -- unless the answer really is nought, which does get written.
   */
  function withoutLeadingZeros(digits) {
    const out = digits.slice();
    const written = out.filter(function (d) { return d !== null; });
    if (!written.length) return out;
    if (written.every(function (d) { return d === 0; })) {
      // The answer is nought. Write one, at the right-hand end.
      for (let i = 0; i < out.length; i++) if (out[i] !== null) out[i] = null;
      out[out.length - 1] = 0;
      return out;
    }
    for (let i = 0; i < out.length; i++) {
      if (out[i] === null) continue;
      if (out[i] !== 0) break;
      out[i] = null;
    }
    return out;
  }

  /* ---------------- Adding ---------------- */

  function addSteps(a, b) {
    const width = String(a + b).length + 1;
    const da = digitsOf(a), db = digitsOf(b);
    const steps = [];
    const carries = new Array(width).fill(null);
    const answer = new Array(width).fill(null);

    const snapshot = function (note, column) {
      return {
        note: note, column: column,
        rows: [
          row("carry", carries.map(function (c) { return cell(c === null ? "" : c, "carry"); }), width),
          row("num", da.map(function (d) { return cell(d); }), width),
          row("num", db.map(function (d) { return cell(d); }), width, "+"),
          row("line", [], width),
          row("result", answer.map(function (d) { return cell(d === null ? "" : d); }), width),
        ],
      };
    };

    steps.push(snapshot("Line the numbers up so the units are under the units. Always start on the right.", -1));

    let carry = 0;
    for (let i = 0; i < width; i++) {
      const x = da[da.length - 1 - i] || 0;
      const y = db[db.length - 1 - i] || 0;
      if (i >= da.length && i >= db.length && !carry) break;
      const total = x + y + carry;
      const put = total % 10;
      const next = Math.floor(total / 10);
      answer[width - 1 - i] = put;
      let note = x + " and " + y + (carry ? " and the " + carry + " carried" : "") + " is " + total + ".";
      note += next ? " Write the " + put + " and carry the " + next + "." : " Write the " + put + ".";
      carry = next;
      if (carry) carries[width - 2 - i] = carry;
      steps.push(snapshot(note, width - 1 - i));
    }
    steps.push(snapshot("And that is the answer: " + (a + b) + ".", -1));
    return { steps: steps, answer: a + b, width: width };
  }

  /* ---------------- Taking away ---------------- */

  function subSteps(a, b) {
    const width = String(a).length + 1;
    const top = new Array(width).fill(0);
    digitsOf(a).forEach(function (d, i) { top[width - String(a).length + i] = d; });
    const db = digitsOf(b);
    const answer = new Array(width).fill(null);
    const changed = new Array(width).fill(false);
    const steps = [];

    const snapshot = function (note, column) {
      return {
        note: note, column: column,
        rows: [
          row("num", top.map(function (d, i) { return cell(d, changed[i] ? "changed" : ""); }), width),
          row("num", db.map(function (d) { return cell(d); }), width, "−"),
          row("line", [], width),
          row("result", withoutLeadingZeros(answer).map(function (d) {
            return cell(d === null ? "" : d);
          }), width),
        ],
      };
    };

    steps.push(snapshot("Line them up and start on the right, the same as adding.", -1));

    for (let i = 0; i < width; i++) {
      const at = width - 1 - i;
      const y = db[db.length - 1 - i] || 0;
      if (i >= String(a).length && !y) break;
      let x = top[at];
      let note;
      if (x < y) {
        // Borrow from the left, walking past any noughts.
        let from = at - 1;
        while (from >= 0 && top[from] === 0) from--;
        top[from] -= 1;
        changed[from] = true;
        for (let j = from + 1; j < at; j++) { top[j] = 9; changed[j] = true; }
        top[at] += 10;
        changed[at] = true;
        x = top[at];
        note = "You cannot take " + y + " from " + (x - 10) + ", so borrow ten from next door: " +
          (x - 10) + " becomes " + x + ". Now " + x + " take away " + y + " is " + (x - y) + ".";
      } else {
        note = x + " take away " + y + " is " + (x - y) + ".";
      }
      answer[at] = x - y;
      steps.push(snapshot(note, at));
    }
    steps.push(snapshot("And that is the answer: " + (a - b) + ".", -1));
    return { steps: steps, answer: a - b, width: width };
  }

  /* ---------------- Multiplying ---------------- */

  function mulSteps(a, b) {
    const db = digitsOf(b);
    const partials = [];
    const width = String(a * b).length + 1;
    const steps = [];
    const done = [];

    const snapshot = function (note, extraRows) {
      return {
        note: note, column: -1,
        rows: [
          row("num", digitsOf(a).map(function (d) { return cell(d); }), width),
          row("num", db.map(function (d) { return cell(d); }), width, "×"),
          row("line", [], width),
        ].concat(done.map(function (p) {
          return row("partial", p.text.split("").map(function (c) { return cell(c); }), width, p.label);
        })).concat(extraRows || []),
      };
    };

    steps.push(snapshot("Multiply the top number by each digit of the bottom one in turn, " +
      "starting with the units."));

    for (let i = 0; i < db.length; i++) {
      const digit = db[db.length - 1 - i];
      const place = Math.pow(10, i);
      const product = a * digit * place;
      partials.push(product);
      const zeros = i ? " (and " + i + (i === 1 ? " nought" : " noughts") + " on the end, " +
        "because that " + digit + " is worth " + digit * place + ")" : "";
      done.push({ text: String(product), label: i === 0 ? "" : "+" });
      steps.push(snapshot(a + " × " + digit + " = " + (a * digit) + zeros + "."));
    }

    if (partials.length > 1) {
      const total = partials.reduce(function (s, n) { return s + n; }, 0);
      steps.push(snapshot("Now add those " + partials.length + " lines together: " +
        partials.join(" + ") + ".", [row("line", [], width)]));
      steps.push(snapshot("And that is the answer: " + total + ".", [
        row("line", [], width),
        row("result", String(total).split("").map(function (c) { return cell(c); }), width),
      ]));
    } else {
      steps.push(snapshot("And that is the answer: " + (a * b) + ".", [
        row("line", [], width),
        row("result", String(a * b).split("").map(function (c) { return cell(c); }), width),
      ]));
    }
    return { steps: steps, answer: a * b, width: width };
  }

  /* ---------------- Dividing ---------------- */

  /**
   * Short division -- the bus stop. The number goes underneath, the answer on
   * top, and whatever is left over is carried in front of the next digit.
   */
  function divSteps(a, b) {
    const da = digitsOf(a);
    const width = da.length;
    const quotient = new Array(width).fill(null);
    const carried = new Array(width).fill(null);
    const steps = [];

    const snapshot = function (note, column) {
      return {
        note: note, column: column, bus: true,
        rows: [
          row("quotient", quotient.map(function (d) { return cell(d === null ? "" : d); }), width),
          row("busline", [], width),
          row("dividend", da.map(function (d, i) {
            return cell((carried[i] === null ? "" : carried[i]) + String(d),
              carried[i] === null ? "" : "carried");
          }), width, b + " )"),
        ],
      };
    };

    steps.push(snapshot("The number to be shared out goes under the bus stop and the answer " +
      "goes on top. Work from the left this time.", -1));

    let left = 0;
    let startedWriting = false;
    for (let i = 0; i < da.length; i++) {
      const here = left * 10 + da[i];
      const got = Math.floor(here / b);
      const over = here % b;
      // A nought at the front of the answer is not written down. Nobody writes
      // 0788, and a child copying that would think they had gone wrong.
      if (got > 0) startedWriting = true;
      quotient[i] = startedWriting ? got : null;
      let note;
      if (!startedWriting) {
        note = b + " will not go into " + here + " at all, so carry the whole " + here +
          " and look at the next digit as well.";
      } else {
        note = "How many " + b + "s in " + here + "? " + got +
          (got * b ? ", because " + b + " × " + got + " = " + (got * b) : "") + ".";
        note += over ? " That leaves " + over + " over, so carry it." : " Nothing left over.";
      }
      steps.push(snapshot(note, i));
      left = over;
      if (i + 1 < da.length) carried[i + 1] = over === 0 ? null : over;
    }

    // If it never went in at all, the answer is nought -- and that nought does
    // get written, or there would be no answer on the page.
    if (!startedWriting) quotient[width - 1] = 0;

    const whole = Math.floor(a / b), rest = a % b;
    steps.push(snapshot("And that is the answer: " + whole +
      (rest ? " remainder " + rest : "") + ".", -1));
    return { steps: steps, answer: whole, remainder: rest, width: width };
  }

  /* ---------------- The front door ---------------- */

  const OPS = {
    add: { sign: "+", name: "Adding", make: addSteps },
    sub: { sign: "−", name: "Taking away", make: subSteps },
    mul: { sign: "×", name: "Multiplying", make: mulSteps },
    div: { sign: "÷", name: "Dividing", make: divSteps },
  };

  /** What is wrong with these two numbers, in words, or nothing if they are fine. */
  function complain(op, a, b) {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return "Two numbers, please.";
    if (a < 0 || b < 0) return "Whole numbers that are not negative, please.";
    if (a !== Math.floor(a) || b !== Math.floor(b)) return "Whole numbers only for now.";
    if (a > MAX || b > MAX) return "Something a bit smaller would fit on the page better.";
    if (op === "sub" && b > a) return "Take the smaller one away from the bigger one.";
    if (op === "div" && b === 0) return "Nothing can be shared between nought people.";
    if (op === "div" && a === 0) return "Nought shared out is nought, however you do it.";
    if (op === "mul" && String(b).length > 3) return "Keep the second number to three digits or fewer.";
    return "";
  }

  function stepsFor(op, a, b) {
    const wrong = complain(op, a, b);
    if (wrong) return { error: wrong, steps: [] };
    return OPS[op].make(a, b);
  }

  window.Working = { OPS: OPS, MAX: MAX, stepsFor: stepsFor, complain: complain, digitsOf: digitsOf };
})();
