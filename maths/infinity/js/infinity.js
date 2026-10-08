/**
 * Infinity — four ways for a ten-year-old to poke at something that never ends.
 *
 *   The biggest number   build one; there is always one bigger.
 *   Hilbert's Hotel      every room full, and still room for one more --
 *                        and for a whole bus of infinitely many.
 *   Halfway forever      infinitely many jumps that add up to exactly one.
 *   Same size?           the even numbers pair off with all the counting
 *                        numbers, none left over.
 *
 * The arithmetic lives in small functions on window.INF so it can be checked
 * headless; nothing here is approximated except where it says so.
 */
(function () {
  "use strict";

  /* ---------------- The arithmetic ---------------- */

  /** 1234567 -> "1,234,567", for numbers of any length. */
  function commas(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  /* Short-scale names, as used in the United States. */
  const NAMES = [
    [3, "thousand"], [6, "million"], [9, "billion"], [12, "trillion"], [15, "quadrillion"],
    [18, "quintillion"], [21, "sextillion"], [24, "septillion"], [27, "octillion"],
    [30, "nonillion"], [33, "decillion"], [100, "googol"],
  ];

  /** What to call a number: "one million", "a googol", or "1 followed by 40 zeros". */
  function nameOf(n) {
    const s = String(n);
    const digits = s.length;
    const isPow10 = /^10*$/.test(s);
    if (isPow10 && digits > 1) {
      const zeros = digits - 1;
      const named = NAMES.filter(function (x) { return x[0] === zeros; })[0];
      if (named) return (named[1] === "googol" ? "a googol" : "one " + named[1]) + " — a 1 with " + zeros + " zeros";
      return "a 1 with " + zeros + " zeros";
    }
    return digits + (digits === 1 ? " digit" : " digits") + " long";
  }

  const YEAR = 31557600n;                       // seconds in a year of 365¼ days
  const UNIVERSE_YEARS = 13800000000n;          // the universe is about 13.8 billion years old

  /** How long counting to n takes at one number a second, in words. */
  function countingTime(n) {
    n = BigInt(n);
    const about = function (unit) { return (n + unit / 2n) / unit; };     // rounded, not cut off
    if (n < 60n) return n + (n === 1n ? " second" : " seconds");
    if (n < 3600n) return "about " + about(60n) + (about(60n) === 1n ? " minute" : " minutes");
    if (n < 86400n) return "about " + about(3600n) + (about(3600n) === 1n ? " hour" : " hours");
    if (n < YEAR) return "about " + about(86400n) + (about(86400n) === 1n ? " day" : " days");
    const years = about(YEAR);
    if (years > UNIVERSE_YEARS) {
      return "longer than the whole universe has existed — it is only about 13.8 billion years old";
    }
    return "about " + commas(years) + (years === 1n ? " year" : " years");
  }

  /*
   * The hotel. Every move is a rule for where the guest in room n goes:
   *   one new guest      n -> n + 1, and the newcomer takes room 1
   *   a bus              n -> 2n, and bus passenger k takes room 2k - 1
   * To draw a room we run the moves backwards and find who ended up there.
   */
  function whoIsIn(room, moves) {
    let r = room;
    for (let i = moves.length - 1; i >= 0; i--) {
      if (moves[i] === "one") {
        if (r === 1) return { kind: "one", step: i };
        r -= 1;
      } else {
        if (r % 2 === 1) return { kind: "bus", step: i, seat: (r + 1) / 2 };
        r /= 2;
      }
    }
    return { kind: "first", was: r };
  }

  /** Halfway forever: after n jumps the frog has covered 1 - 1/2^n, exactly. */
  function halves(n) {
    const den = 2n ** BigInt(n);
    return { done: den - 1n, left: 1n, den: den };
  }

  /** Same size: counting number k pairs with the even number 2k. */
  function partners(text) {
    const t = String(text).replace(/[,\s]/g, "");
    if (!/^\d+$/.test(t) || /^0+$/.test(t)) return null;
    const n = BigInt(t);
    return { n: n, double: n * 2n, half: n % 2n === 0n ? n / 2n : null };
  }

  window.INF = { commas: commas, nameOf: nameOf, countingTime: countingTime, whoIsIn: whoIsIn, halves: halves, partners: partners };

  /* ---------------- The page ---------------- */

  if (typeof document === "undefined" || !document.getElementById("p-biggest")) return;
  const $ = function (id) { return document.getElementById(id); };

  function make(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  /* ---- 1. The biggest number ---- */

  let big = 1n;
  const MAX_DIGITS = 400;                       // past this the page would be all digits

  function drawBig() {
    $("big-n").textContent = commas(big);
    $("big-name").textContent = nameOf(big);
    $("big-more").textContent = commas(big + 1n);
    $("big-count").innerHTML = "Counting to your number, one a second without stopping, would take <b>" +
      countingTime(big) + "</b>.";
    $("big-times").disabled = String(big).length >= MAX_DIGITS;
  }
  $("big-plus").addEventListener("click", function () { big += 1n; drawBig(); });
  $("big-times").addEventListener("click", function () { big *= 10n; drawBig(); });
  $("big-million").addEventListener("click", function () { big = 1000000n; drawBig(); });
  $("big-googol").addEventListener("click", function () { big = 10n ** 100n; drawBig(); });
  $("big-reset").addEventListener("click", function () { big = 1n; drawBig(); });

  /* ---- 2. Hilbert's Hotel ---- */

  let moves = [];
  const ROOMS = 16;
  const SAY = {
    start: "Every room has a guest in it. There is no empty room anywhere. So the hotel is full… isn’t it?",
    one: "<b>Everybody moved to the next room</b>: room 1 to room 2, room 2 to room 3, and so on forever. Nobody falls off the end, because <b>there is no last room</b>. Now room 1 is empty, and the new guest 🧳 takes it. The full hotel fit one more!",
    bus: "<b>Everybody moved to the room with double their number</b>: room 1 to 2, 2 to 4, 3 to 6, and so on. Now every odd room — 1, 3, 5, 7, … — is empty, and there are infinitely many of those. Bus seat 1 goes to room 1, seat 2 to room 3, seat 3 to room 5… <b>every passenger gets a room.</b>",
  };

  function drawHotel(say) {
    const host = $("hotel");
    host.innerHTML = "";
    for (let r = 1; r <= ROOMS; r++) {
      const who = whoIsIn(r, moves);
      const li = make("li", "inf-room inf-room--" + who.kind + (who.step === moves.length - 1 && who.kind !== "first" ? " is-new" : ""));
      li.appendChild(make("span", "inf-room-no", "Room " + r));
      if (who.kind === "first") {
        li.appendChild(make("span", "inf-guest", "🙂"));
        li.appendChild(make("span", "inf-room-who", moves.length ? "started in room " + who.was : "guest " + who.was));
      } else if (who.kind === "one") {
        li.appendChild(make("span", "inf-guest", "🧳"));
        li.appendChild(make("span", "inf-room-who", "new guest"));
      } else {
        li.appendChild(make("span", "inf-guest", "🚌"));
        li.appendChild(make("span", "inf-room-who", "bus seat " + who.seat));
      }
      host.appendChild(li);
    }
    $("hotel-says").innerHTML = SAY[say];
    const full = moves.length >= 6;
    $("hotel-one").disabled = full;
    $("hotel-bus").disabled = full;
  }
  $("hotel-one").addEventListener("click", function () { moves.push("one"); drawHotel("one"); });
  $("hotel-bus").addEventListener("click", function () { moves.push("bus"); drawHotel("bus"); });
  $("hotel-reset").addEventListener("click", function () { moves = []; drawHotel("start"); });

  /* ---- 3. Halfway forever ---- */

  let jumps = 0;
  const MAX_JUMPS = 60;

  function frac(top, bottom) { return commas(top) + "/" + commas(bottom); }

  function drawHalf() {
    const h = halves(jumps);
    const done = jumps === 0 ? 0 : 1 - Math.pow(2, -jumps);
    $("half-fill").style.width = (done * 100) + "%";
    $("half-frog").style.left = "calc(" + (done * 100) + "% - " + (done * 1.6) + "rem)";
    $("half-n").textContent = jumps;
    $("half-done").textContent = jumps === 0 ? "0" : frac(h.done, h.den);
    $("half-left").textContent = jumps === 0 ? "1" : frac(h.left, h.den);

    const terms = [];
    for (let i = 1; i <= Math.min(jumps, 5); i++) terms.push("1/" + commas(2n ** BigInt(i)));
    $("half-sum").innerHTML = jumps === 0 ? "" :
      terms.join(" + ") + (jumps > 5 ? " + … + 1/" + commas(h.den) : "") + " = <b>" + frac(h.done, h.den) + "</b>";

    $("half-zoom").style.width = jumps === 0 ? "0%" : "50%";
    $("half-zoom-note").textContent = jumps === 0 ? "" :
      "Magnified " + commas(2n ** BigInt(jumps - 1)) + " times. Every jump covers half of what was left — so zoomed in, every jump looks exactly like the first one.";

    $("half-says").innerHTML = jumps === 0
      ? "The first jump takes it halfway. Then half of what is left. Then half of that…"
      : jumps < 10
        ? "Each jump is smaller than the last, and the frog is always a little short of the wall."
        : "The gap is now far too thin to see — but it is still there, and the frog can always jump half of it. <b>If it could jump forever, the jumps would add up to exactly 1</b>: the whole way to the wall, and not one bit further. Infinitely many pieces, one finite total.";
    $("half-jump").disabled = $("half-ten").disabled = jumps >= MAX_JUMPS;
  }
  $("half-jump").addEventListener("click", function () { jumps += 1; drawHalf(); });
  $("half-ten").addEventListener("click", function () { jumps = Math.min(MAX_JUMPS, jumps + 10); drawHalf(); });
  $("half-reset").addEventListener("click", function () { jumps = 0; drawHalf(); });

  /* ---- 4. Same size? ---- */

  let paired = 0;
  const SHOW = 12;

  function drawPairs() {
    const host = $("pairs");
    host.innerHTML = "";
    const from = Math.max(1, paired - SHOW + 1);
    for (let k = from; k <= Math.max(paired, from + SHOW - 1); k++) {
      const col = make("div", "inf-pair" + (k <= paired ? " is-paired" : ""));
      col.appendChild(make("span", "inf-pair-top", commas(k)));
      col.appendChild(make("span", "inf-pair-link", k <= paired ? "↕" : ""));
      col.appendChild(make("span", "inf-pair-bottom", commas(2 * k)));
      host.appendChild(col);
    }
    $("pairs-says").innerHTML = paired === 0
      ? "Top row: every counting number. Bottom row: every even number. Pair each number with its double."
      : "Every counting number has an even partner (its double), and every even number has a counting partner (its half). <b>Nobody is ever left over</b> — so there are exactly as many even numbers as counting numbers, even though the even numbers are only some of them. With infinity, a part can be as big as the whole." +
        "<br><br><b>And a surprise:</b> some infinities really are bigger. Georg Cantor proved that the numbers with decimals between 0 and 1 can <b>never</b> all be paired with the counting numbers — there are always some left over.";
  }
  $("pairs-next").addEventListener("click", function () { paired += 1; drawPairs(); });
  $("pairs-ten").addEventListener("click", function () { paired += 10; drawPairs(); });
  $("pairs-reset").addEventListener("click", function () { paired = 0; drawPairs(); $("pairs-out").textContent = ""; });

  function checkPartner() {
    const p = partners($("pairs-in").value);
    const out = $("pairs-out");
    if (!p) { out.textContent = "Type a whole number bigger than 0, like 1000."; return; }
    let html = "As a counting number, <b>" + commas(p.n) + "</b> pairs with the even number <b>" + commas(p.double) + "</b>.";
    if (p.half !== null) {
      html += " And as an even number, it pairs with the counting number <b>" + commas(p.half) + "</b>.";
    }
    out.innerHTML = html + " It has a partner — they all do.";
  }
  $("pairs-check").addEventListener("click", checkPartner);
  $("pairs-in").addEventListener("keydown", function (e) { if (e.key === "Enter") checkPartner(); });

  /* ---- Tabs ---- */

  const PARTS = ["biggest", "hotel", "half", "pairs"];
  function show(name, fromClick) {
    PARTS.forEach(function (p) { $("p-" + p).hidden = p !== name; });
    document.querySelectorAll(".inf-tab").forEach(function (t) {
      const on = t.dataset.p === name;
      t.setAttribute("aria-selected", String(on));
      t.setAttribute("tabindex", on ? "0" : "-1");
    });
    if (fromClick && location.hash !== "#" + name) history.replaceState(null, "", "#" + name);
  }
  document.querySelectorAll(".inf-tab").forEach(function (t) {
    t.addEventListener("click", function () { show(t.dataset.p, true); });
  });
  document.querySelector(".inf-tabs").addEventListener("keydown", function (e) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const tabs = Array.prototype.slice.call(document.querySelectorAll(".inf-tab"));
    const at = tabs.indexOf(document.activeElement);
    if (at < 0) return;
    e.preventDefault();
    const next = tabs[(at + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    next.focus();
    show(next.dataset.p, true);
  });

  drawBig();
  drawHotel("start");
  drawHalf();
  drawPairs();
  const start = location.hash.slice(1);
  show(PARTS.indexOf(start) >= 0 ? start : "biggest");
})();
