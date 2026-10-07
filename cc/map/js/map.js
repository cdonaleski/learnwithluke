/**
 * States and capitals, on a map.
 *
 * Two ways to practice, the same split as the rest of Memory Work:
 *
 *   Find it   on your own. The page names a state and you tap it. A wrong
 *             tap says which state you did touch; a second one shows you
 *             where the right one is. Practice -- nothing is recorded.
 *   Name it   with a parent, the way the proof is given. One state lights
 *             up; you point and say "Augusta, Maine". The checker has the
 *             answer on screen and marks it, which counts toward learned
 *             exactly like Recite, so the geography dots on the Year at a
 *             Glance fill in from here.
 *
 * The map is drawn twice from the same shapes: the whole country, and the
 * Northeast close up. Rhode Island is a few pixels wide on a phone and the
 * District of Columbia less than two, so the close-up is the only honest
 * way to ask a child to tap them.
 */
(function () {
  "use strict";

  const CC = window.CC;
  const MAP = window.CC_US_MAP;
  const CYCLE = window.CC_CYCLE3;
  if (!CC || !MAP || !CYCLE || !CYCLE.capitals) return;

  const SVG = "http://www.w3.org/2000/svg";
  const INSET_VIEW = "772 94 172 200";        // VT, NH, MA, RI, CT, NJ, DE, MD and DC
  const WEEKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const NEXT_AFTER = 1100;                    // ms a right answer stays up before the next

  const el = {
    title: document.getElementById("map-title"),
    count: document.getElementById("map-count"),
    modes: document.getElementById("map-mode"),
    weeks: document.getElementById("map-weeks"),
    prompt: document.getElementById("map-prompt"),
    main: document.getElementById("map-main"),
    inset: document.getElementById("map-inset"),
  };

  const MODES = [
    { id: "find", label: "Find it", icon: "👆",
      why: "On your own. The page names a state — tap it on the map." },
    { id: "name", label: "Name it", icon: "🎤",
      why: "With a parent. A state lights up — point to it and say its capital and its name." },
  ];

  const nameOf = {};
  MAP.states.forEach(function (s) { nameOf[s.abbr] = s.name; });

  const state = {
    mode: "find",
    weeks: [],
    queue: [],
    at: 0,
    tries: 0,
    solved: false,
    helped: [],        // Find it: needed showing
    missed: [],        // Name it: "Not yet"
    trail: [],         // Name it: for Back, and undoing a verdict
    timer: null,
  };

  (function fromLink() {
    const params = new URLSearchParams(window.location.search);
    const weeks = (params.get("weeks") || "").split(",").map(Number)
      .filter(function (n) { return WEEKS.indexOf(n) !== -1; });
    if (weeks.length) state.weeks = weeks;
    if (params.get("mode") === "name") state.mode = "name";
  })();

  /* ---------------- Helpers ---------------- */

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(label, className, onClick) {
    const b = make("button", className, label);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }

  function shuffle(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }

  /** The states being worked on, in the proof sheet's own order. */
  function inPlay() {
    const weeks = state.weeks.length ? state.weeks : WEEKS;
    return CYCLE.capitals.filter(function (e) { return weeks.indexOf(e.section) !== -1; });
  }

  /** The Memory Work card for a state, so Name it records against it. */
  function cardFor(entry) {
    return CC.pick(3, "geography", [entry.section]).filter(function (c) {
      return c.a === entry.capital + ", " + entry.abbr;
    })[0];
  }

  /** How it is SAID: "Augusta, Maine". The sheet prints the postal code. */
  function spoken(entry) {
    return entry.abbr === "DC" ? "Washington, DC" : entry.capital + ", " + entry.state;
  }

  function hasKeyboard() {
    return Boolean(window.matchMedia && window.matchMedia("(pointer: fine)").matches);
  }

  /* ---------------- The map ---------------- */

  function drawMap(container, viewBox, dcRadius, focusable, hitRadius) {
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", viewBox);
    svg.setAttribute("class", "cc-map-svg");
    svg.setAttribute("role", focusable ? "group" : "presentation");
    if (focusable) svg.setAttribute("aria-label", "The fifty states");

    MAP.states.forEach(function (s) {
      const path = document.createElementNS(SVG, "path");
      path.setAttribute("d", s.d);
      path.setAttribute("class", "cc-st");
      path.setAttribute("data-abbr", s.abbr);
      if (focusable) {
        path.setAttribute("tabindex", "0");
        path.setAttribute("role", "button");
        path.setAttribute("aria-label", s.name);
      }
      svg.appendChild(path);
    });

    // DC is a speck as a shape; it gets a dot big enough to see, and on the
    // close-up an invisible ring around that dot big enough for a thumb. The
    // ring is not drawn bigger because it would bury half of Maryland.
    const dc = MAP.states.filter(function (s) { return s.abbr === "DC"; })[0];
    if (dc && hitRadius) {
      const hit = document.createElementNS(SVG, "circle");
      hit.setAttribute("cx", dc.cx);
      hit.setAttribute("cy", dc.cy);
      hit.setAttribute("r", hitRadius);
      hit.setAttribute("class", "cc-hit");
      hit.setAttribute("data-abbr", "DC");
      svg.appendChild(hit);
    }
    if (dc) {
      const dot = document.createElementNS(SVG, "circle");
      dot.setAttribute("cx", dc.cx);
      dot.setAttribute("cy", dc.cy);
      dot.setAttribute("r", dcRadius);
      dot.setAttribute("class", "cc-st cc-st--dot");
      dot.setAttribute("data-abbr", "DC");
      if (focusable) {
        dot.setAttribute("tabindex", "0");
        dot.setAttribute("role", "button");
        dot.setAttribute("aria-label", "District of Columbia");
      }
      svg.appendChild(dot);
    }

    svg.addEventListener("click", function (event) {
      const hit = event.target.closest("[data-abbr]");
      if (hit) tapped(hit.getAttribute("data-abbr"));
    });
    svg.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      const hit = event.target.closest("[data-abbr]");
      if (!hit) return;
      event.preventDefault();
      event.stopPropagation();       // a state's own Enter is not "carry on"
      tapped(hit.getAttribute("data-abbr"));
    });

    container.innerHTML = "";
    container.appendChild(svg);
  }

  /** Every shape for a state, on both maps. */
  function shapes(abbr) {
    return document.querySelectorAll('.cc-map-svg [data-abbr="' + abbr + '"]');
  }

  function paint() {
    const play = {};
    inPlay().forEach(function (e) { play[e.abbr] = true; });
    const target = current();
    document.querySelectorAll(".cc-map-svg [data-abbr]").forEach(function (node) {
      const abbr = node.getAttribute("data-abbr");
      node.classList.toggle("is-play", Boolean(play[abbr]));
      node.classList.toggle("is-target", state.mode === "name" && Boolean(target) && abbr === target.abbr);
      node.classList.remove("is-right", "is-wrong", "is-show");
    });
    if (state.mode === "find") {
      state.queue.slice(0, state.at).forEach(function (e) {
        shapes(e.abbr).forEach(function (n) { n.classList.add("is-right"); });
      });
    }
  }

  function flash(abbr, className, ms) {
    shapes(abbr).forEach(function (n) {
      n.classList.remove(className);
      void n.getBoundingClientRect();          // restart the animation if it is repeated
      n.classList.add(className);
    });
    if (ms) {
      window.setTimeout(function () {
        shapes(abbr).forEach(function (n) { n.classList.remove(className); });
      }, ms);
    }
  }

  /* ---------------- The run ---------------- */

  function current() {
    return state.queue[state.at] || null;
  }

  function begin() {
    window.clearTimeout(state.timer);
    const play = inPlay();
    state.queue = state.mode === "find" ? shuffle(play) : play.slice();
    state.at = 0;
    state.tries = 0;
    state.solved = false;
    state.helped = [];
    state.missed = [];
    state.trail = [];
    drawControls();
    draw();
  }

  function draw() {
    paint();
    if (!current()) { setStatus("", ""); drawFinished(); return; }
    if (state.mode === "find") drawFind(); else drawName();
    drawCount();
  }

  function drawCount() {
    const cards = inPlay().map(cardFor).filter(Boolean);
    const sum = CC.tally(cards);
    el.count.textContent = (state.at + (current() ? 1 : 0)) + " of " + state.queue.length +
      " · " + sum.learned + " of " + sum.total + " learned";
  }

  /* ---- Find it ---- */

  function drawFind() {
    const e = current();
    el.prompt.innerHTML = "";
    const card = make("div", "cc-map-card");
    card.appendChild(make("p", "cc-aside", "Week " + e.section + " · on your own"));
    const q = make("p", "cc-map-q");
    q.appendChild(document.createTextNode("Where is "));
    q.appendChild(make("strong", null, e.abbr === "DC" ? "Washington, DC" : e.state));
    q.appendChild(document.createTextNode("?"));
    card.appendChild(q);
    card.appendChild(make("p", "cc-map-sub", e.abbr === "DC"
      ? "The capital of the United States."
      : "Its capital is " + e.capital + "."));
    el.prompt.appendChild(card);
    setStatus("", "");
  }

  function setStatus(text, tone) {
    const node = el.toast;
    if (!node) return;
    node.textContent = text;
    node.hidden = !text;
    node.className = "cc-map-toast" + (tone ? " is-" + tone : "");
  }

  function tapped(abbr) {
    const e = current();
    if (!e) return;

    if (state.mode === "name") {
      // In Name it the map is for pointing at, not answering with.
      if (abbr !== e.abbr) flash(abbr, "is-wrong", 500);
      return;
    }
    if (state.solved) return;

    if (abbr === e.abbr) {
      state.solved = true;
      shapes(abbr).forEach(function (n) { n.classList.remove("is-show"); n.classList.add("is-right"); });
      setStatus("✓ " + spoken(e), "right");
      state.timer = window.setTimeout(next, NEXT_AFTER);
      return;
    }

    state.tries += 1;
    flash(abbr, "is-wrong", 700);
    const touched = abbr === "DC" ? "Washington, DC" : nameOf[abbr];
    if (state.tries >= 2) {
      if (state.helped.indexOf(e) === -1) state.helped.push(e);
      shapes(e.abbr).forEach(function (n) { n.classList.add("is-show"); });
      setStatus("That’s " + touched + ". " + (e.abbr === "DC" ? "Washington, DC" : e.state) +
        " is the one flashing — tap it.", "wrong");
    } else {
      setStatus("That’s " + touched + ". Try again.", "wrong");
    }
  }

  function next() {
    window.clearTimeout(state.timer);
    state.at += 1;
    state.tries = 0;
    state.solved = false;
    draw();
  }

  /* ---- Name it ---- */

  function drawName() {
    const e = current();
    el.prompt.innerHTML = "";
    const card = make("div", "cc-map-card cc-map-card--name");
    card.appendChild(make("p", "cc-aside", "Week " + e.section + " · with a parent"));
    card.appendChild(make("p", "cc-map-q", "Point to the yellow state. Say its capital and its name."));

    const checker = make("div", "cc-checker");
    checker.appendChild(make("p", "cc-aside", "They should say:"));
    checker.appendChild(make("p", "cc-a", spoken(e)));
    const c = cardFor(e);
    if (c && c.note) checker.appendChild(make("p", "cc-note", c.note));
    card.appendChild(checker);

    const row = make("div", "game-actions");
    const back = button("← Back", "btn btn-secondary cc-back", back_);
    back.disabled = state.trail.length === 0;
    row.appendChild(back);
    row.appendChild(button("✓ Said it all", "btn btn-primary", function () { judge(true); }));
    row.appendChild(button("Not yet", "btn btn-secondary", function () { judge(false); }));
    card.appendChild(row);

    card.appendChild(make("p", "cc-where",
      "every word counts" + (hasKeyboard() ? " · space if they got it, N if not, ← to go back" : "")));
    el.prompt.appendChild(card);
  }

  function judge(right) {
    const e = current();
    const card = cardFor(e);
    if (!card) return;
    const id = CC.idOf(card);
    const before = CC.progress()[id];
    CC.saidIt(card, right);
    const newMiss = !right && state.missed.indexOf(e) === -1;
    if (newMiss) state.missed.push(e);
    state.trail.push({ at: state.at, id: id, before: before, newMiss: newMiss, entry: e });
    state.at += 1;
    draw();
  }

  /** Back, which in Name it also takes back the verdict -- same as Recite. */
  function back_() {
    const last = state.trail.pop();
    if (!last) return;
    const all = CC.progress();
    if (last.before === undefined) delete all[last.id]; else all[last.id] = last.before;
    CC.saveProgress(all);
    if (last.newMiss) state.missed = state.missed.filter(function (m) { return m !== last.entry; });
    state.at = last.at;
    draw();
  }

  /* ---- The end of a sitting ---- */

  function drawFinished() {
    el.prompt.innerHTML = "";
    const card = make("div", "cc-map-card cc-map-card--done");
    const list = state.mode === "find" ? state.helped : state.missed;

    if (state.mode === "find") {
      const first = state.queue.length - state.helped.length;
      card.appendChild(make("p", "cc-map-q",
        "Found all " + state.queue.length + " — " + first + " on the first or second try."));
    } else {
      card.appendChild(make("p", "cc-map-q", list.length
        ? list.length + " to work on."
        : "Every one of them said right."));
    }

    if (list.length) {
      const ul = make("ul", "cc-map-list");
      list.forEach(function (e) { ul.appendChild(make("li", null, spoken(e) + " · week " + e.section)); });
      card.appendChild(ul);
    }

    const row = make("div", "game-actions");
    if (state.mode === "name" && state.trail.length) row.appendChild(button("← Back", "btn btn-secondary cc-back", back_));
    row.appendChild(button("Go again", "btn btn-primary", begin));
    if (list.length) {
      row.appendChild(button("Just these " + list.length, "btn btn-secondary", function () {
        const only = list.slice();
        begin();
        state.queue = state.mode === "find" ? shuffle(only) : only;
        draw();
      }));
    }
    card.appendChild(row);
    el.prompt.appendChild(card);
    drawCount();
  }

  /* ---------------- Controls ---------------- */

  function chip(label, on, onClick, title) {
    const b = button(label, "chip" + (on ? " is-on" : ""), onClick);
    b.setAttribute("aria-pressed", String(on));
    if (title) b.title = title;
    return b;
  }

  function drawControls() {
    el.modes.innerHTML = "";
    MODES.forEach(function (m) {
      el.modes.appendChild(chip(m.icon + " " + m.label, m.id === state.mode, function () {
        state.mode = m.id;
        begin();
      }));
    });

    el.weeks.innerHTML = "";
    el.weeks.appendChild(chip("All", state.weeks.length === 0, function () {
      state.weeks = [];
      begin();
    }, "Weeks 1 to 10, all fifty-one"));
    WEEKS.forEach(function (w) {
      el.weeks.appendChild(chip(String(w), state.weeks.indexOf(w) !== -1, function () {
        const at = state.weeks.indexOf(w);
        if (at === -1) state.weeks.push(w); else state.weeks.splice(at, 1);
        state.weeks.sort(function (a, b) { return a - b; });
        begin();
      }, "Week " + w));
    });

    const weeks = state.weeks;
    el.title.textContent = "🗺️ States and Capitals · " + (weeks.length === 0 ? "weeks 1–10"
      : weeks.length === 1 ? "week " + weeks[0]
      : "weeks " + weeks.join(", "));
  }

  /* ---------------- Keys ---------------- */

  document.addEventListener("keydown", function (event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const on = event.target;
    if (on && (on.tagName === "BUTTON" || on.tagName === "INPUT" || on.tagName === "SELECT" ||
               (on.getAttribute && on.getAttribute("role") === "button"))) return;

    if (event.key === " ") {
      if (state.mode === "name" && current()) { event.preventDefault(); judge(true); }
      else if (state.mode === "find" && state.solved) { event.preventDefault(); next(); }
    } else if ((event.key === "n" || event.key === "N") && state.mode === "name" && current()) {
      event.preventDefault();
      judge(false);
    } else if (event.key === "ArrowLeft" && state.mode === "name" && state.trail.length) {
      event.preventDefault();
      back_();
    }
  });

  /* ---------------- Start ---------------- */

  drawMap(el.main, "0 0 " + MAP.width + " " + MAP.height, 5, true);
  // Feedback floats on the map instead of sitting in the question card.
  // In the card, a longer message made the card taller and pushed the map
  // down the page -- by 29 pixels on a phone -- so a child's second tap,
  // aimed at where the dot WAS, missed it.
  el.toast = make("p", "cc-map-toast");
  el.toast.id = "map-status";
  el.toast.setAttribute("role", "status");
  el.toast.setAttribute("aria-live", "polite");
  el.toast.hidden = true;
  el.main.appendChild(el.toast);
  drawMap(el.inset, INSET_VIEW, 3.6, false, 7.5);
  begin();

  window.CCMap = { state: state, begin: begin, tapped: tapped, inPlay: inPlay, cardFor: cardFor };
})();
