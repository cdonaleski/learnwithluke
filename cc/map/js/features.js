/**
 * Geography weeks 11-24 on a map: mountains, lakes, bays, rivers, trails,
 * canals, regions, deserts and landmarks.
 *
 *   Find it   on your own. The page names one feature; tap it. A wrong tap
 *             says what you touched; a second shows you the right one.
 *   Name it   with a parent, the way the proof is given: the whole week's
 *             features light up and the child points to and names each, in
 *             order. The checker has the list and marks the WEEK -- the same
 *             card Memory Work keeps -- so the Year at a Glance dot fills.
 *
 * The map zooms to whatever week is chosen. A whole-country map puts Mt.
 * Mitchell, the Great Smokies and the Cumberlands a few pixels apart; fitted
 * to the week, they are a thumb's width apart at least.
 *
 * Shapes come from public datasets (see us-features.js for the source of
 * every one). Lines and points are given fixed on-screen sizes, so a river
 * is as easy to tap zoomed out as zoomed in.
 */
(function () {
  "use strict";

  const CC = window.CC;
  const MAP = window.CC_US_MAP;
  const DATA = window.CC_US_FEATURES;
  if (!CC || !MAP || !DATA) return;

  const SVG = "http://www.w3.org/2000/svg";
  const WEEKS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
  const FULL = { x: 0, y: 0, w: MAP.width, h: MAP.height };
  const ASPECT = MAP.width / MAP.height;
  const NEXT_AFTER = 1100;
  const POINT_PX = 9;          // a dot's drawn radius on screen
  const POINT_HIT_PX = 20;     // and the radius a finger can hit
  const LINE_HIT_PX = 22;      // the invisible width around a river or trail
  const MIN_AREA_PX = 28;      // an area narrower than this on screen gets a pin

  const el = {
    title: document.getElementById("map-title"),
    count: document.getElementById("map-count"),
    modes: document.getElementById("map-mode"),
    weeks: document.getElementById("map-weeks"),
    prompt: document.getElementById("map-prompt"),
    main: document.getElementById("map-main"),
    legend: document.getElementById("map-legend"),
  };

  const MODES = [
    { id: "find", label: "Find it", icon: "👆" },
    { id: "name", label: "Name it", icon: "🎤" },
  ];

  /* What each kind of feature looks like: drawn as an area, a line or a dot. */
  const LOOK = {
    area: { family: "land", as: "area" }, region: { family: "region", as: "area" },
    desert: { family: "desert", as: "area" }, water: { family: "water", as: "area" },
    river: { family: "water", as: "line" }, trail: { family: "trail", as: "line" },
    canal: { family: "canal", as: "line" }, fault: { family: "fault", as: "line" },
    point: { family: "land", as: "dot" }, peak: { family: "peak", as: "peak" },
    "water-point": { family: "water", as: "dot" }, "canal-point": { family: "canal", as: "dot" },
    "region-point": { family: "region", as: "dot" }, "desert-point": { family: "desert", as: "dot" },
    edge: { family: "water", as: "edge" },
  };

  /* ---- The features, grouped by name: Eastern Woodlands is two points. ---- */

  const ITEMS = [];
  DATA.features.forEach(function (f) {
    let item = ITEMS.filter(function (i) { return i.week === f.week && i.name === f.name; })[0];
    if (!item) {
      item = { id: ITEMS.length, week: f.week, name: f.name, parts: [] };
      ITEMS.push(item);
    }
    item.parts.push(f);
  });

  /**
   * A feature as it is said in a sentence. The sheet lists bare names --
   * "Cumberland Mountains", "Huron" -- and "Where is Cumberland Mountains?"
   * is not English. The sheet's own wording is kept wherever the name is
   * being checked; this is only for the questions and messages around it.
   */
  function spokenName(item) {
    const n = item.name;
    if (item.week === 15) return "Lake " + n;                         // the Great Lakes
    if (/^The /.test(n)) return "the " + n.slice(4);
    if (/^(Mt\. |Pikes Peak$|Denali$|California$|Death Valley$|Mammoth Cave$|Niagara Falls$)/.test(n) ||
        /(Bay|Sound)$/.test(n)) return n;
    return "the " + n;
  }

  function isPlural(item) {
    return item.name !== "Niagara Falls" &&
      /(Mountains|Nevadas|Hills|Highlands|rainforests|Plains|Woodlands)$/.test(item.name);
  }

  function where(item) {
    return (isPlural(item) ? "Where are " : "Where is ") + spokenName(item) + "?";
  }

  function weekCard(week) {
    return CC.pick(3, "geography", [week])[0];
  }

  function weekLabel(week) {
    const card = weekCard(week);
    return card ? card.label : "Week " + week;
  }

  /* ---- State ---- */

  const state = {
    mode: "find",
    week: 11,               // a week, or 0 for all of them
    queue: [],
    at: 0,
    tries: 0,
    solved: false,
    helped: [],
    missed: [],
    trail: [],
    timer: null,
    view: FULL,
  };

  (function fromLink() {
    const params = new URLSearchParams(window.location.search);
    const week = Number(params.get("weeks"));
    if (WEEKS.indexOf(week) !== -1) state.week = week;
    else if (params.get("weeks") === "all") state.week = 0;
    if (params.get("mode") === "name") state.mode = "name";
  })();

  function weeksInPlay() { return state.week ? [state.week] : WEEKS.slice(); }
  function itemsInPlay() {
    const weeks = weeksInPlay();
    return ITEMS.filter(function (i) { return weeks.indexOf(i.week) !== -1; });
  }

  /* ---- Helpers ---- */

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function svgNode(tag, attrs) {
    const node = document.createElementNS(SVG, tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
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

  function hasKeyboard() {
    return Boolean(window.matchMedia && window.matchMedia("(pointer: fine)").matches);
  }

  /* ---------------- The map ---------------- */

  let svg = null;

  /** The frame that fits a set of features, at the map's own proportions. */
  function frameFor(items, tight) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    items.forEach(function (item) {
      item.parts.forEach(function (p) {
        x0 = Math.min(x0, p.bbox[0]); y0 = Math.min(y0, p.bbox[1]);
        x1 = Math.max(x1, p.bbox[2]); y1 = Math.max(y1, p.bbox[3]);
      });
    });
    if (!isFinite(x0)) return FULL;
    let w = Math.max(x1 - x0, tight ? 50 : 150), h = Math.max(y1 - y0, tight ? 32 : 95);
    w *= tight ? 2.2 : 1.3; h *= tight ? 2.2 : 1.3;       // breathing room
    if (w / h > ASPECT) h = w / ASPECT; else w = h * ASPECT;
    if (w >= FULL.w || h >= FULL.h) return FULL;
    let x = (x0 + x1) / 2 - w / 2, y = (y0 + y1) / 2 - h / 2;
    x = Math.max(0, Math.min(x, FULL.w - w));
    y = Math.max(0, Math.min(y, FULL.h - h));
    return { x: x, y: y, w: w, h: h };
  }

  function pxPerUnit() {
    const width = svg ? svg.getBoundingClientRect().width : 0;
    return width ? width / state.view.w : 1;
  }

  function setView(view) {
    state.view = view;
    if (svg) svg.setAttribute("viewBox", view.x + " " + view.y + " " + view.w + " " + view.h);
    sizeDots();
    if (el.zoomOut) el.zoomOut.hidden = view === state.weekView;
  }

  /** Close in on a few features, when they are too near to tell apart. */
  function zoomTo(ids) {
    setView(frameFor(ids.map(function (id) { return ITEMS[id]; }), true));
  }

  function drawMap() {
    const items = itemsInPlay();
    state.view = frameFor(items);
    state.weekView = state.view;
    const v = state.view;

    svg = svgNode("svg", {
      viewBox: v.x + " " + v.y + " " + v.w + " " + v.h,
      class: "cc-map-svg cc-fmap",
      role: "group",
      "aria-label": "Map — tap a feature",
    });

    // The states underneath, for bearings only.
    const base = svgNode("g", { class: "cc-fbase" });
    MAP.states.forEach(function (s) { base.appendChild(svgNode("path", { d: s.d })); });
    svg.appendChild(base);

    // Areas first, lines over them, dots on top: so a peak inside a range,
    // or a desert inside a bigger desert, is still the thing you hit.
    const areas = svgNode("g"), lines = svgNode("g"), dots = svgNode("g");
    items.forEach(function (item) {
      item.parts.forEach(function (p) {
        const look = LOOK[p.kind];
        const cls = "ft ft--" + look.family;
        if (look.as === "area") {
          areas.appendChild(svgNode("path", { d: p.d, class: cls + " ft-area", "data-item": item.id }));
          // A pin inside the shape, used only if the shape turns out too small
          // to tap at this zoom -- San Francisco Bay is 13 pixels across on a
          // whole-country map, the Mississippi Delta 10.
          if (p.px != null) {
            dots.appendChild(svgNode("g", { class: cls + " ft-dot ft-dot--pin", "data-item": item.id,
              "data-x": p.px, "data-y": p.py, "data-w": p.bbox[2] - p.bbox[0], "data-h": p.bbox[3] - p.bbox[1] }));
          }
        } else if (look.as === "line") {
          lines.appendChild(svgNode("path", { d: p.d, class: cls + " ft-line", "data-item": item.id }));
          lines.appendChild(svgNode("path", { d: p.d, class: "ft-hit-line", "data-item": item.id }));
        } else {
          const g = svgNode("g", { class: cls + " ft-dot ft-dot--" + look.as, "data-item": item.id,
                                   "data-x": p.x, "data-y": p.y });
          dots.appendChild(g);
        }
      });
    });
    svg.appendChild(areas); svg.appendChild(lines); svg.appendChild(dots);

    // Everything under the finger, not just whatever is drawn on top. The
    // Oregon, California and Mormon trails really did share the Platte route,
    // so a child asked for the Mormon Trail who taps that stretch is right --
    // even though the Oregon Trail happens to be painted over it.
    //
    // Dots are the exception. Two separate points whose tap circles overlap
    // -- Mt. Rainier and Mt. St. Helens are 5 pixels apart on a phone -- mean
    // the tap could be either, and counting it right for both would accept a
    // guess. So the map closes in on those dots instead, and the next tap
    // decides.
    svg.addEventListener("click", function (event) {
      const under = [], dots = [];
      document.elementsFromPoint(event.clientX, event.clientY).forEach(function (node) {
        const hit = node.closest && node.closest("[data-item]");
        if (hit && svg.contains(hit)) {
          const id = Number(hit.getAttribute("data-item"));
          if (under.indexOf(id) === -1) under.push(id);
          if (hit.classList.contains("ft-dot") && dots.indexOf(id) === -1) dots.push(id);
        }
      });
      if (state.mode === "find" && !state.solved && dots.length > 1) {
        zoomTo(dots);
        setStatus("Those are close together — tap the one you mean.", "");
        return;
      }
      tapped(under);
    });

    el.main.innerHTML = "";
    el.main.appendChild(svg);

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

    // The way back out, shown only while zoomed in.
    el.zoomOut = button("⤢ Whole map", "cc-zoom-out", function () { setView(state.weekView); });
    el.zoomOut.hidden = true;
    el.main.appendChild(el.zoomOut);
    sizeDots();
  }

  /**
   * Dots are drawn in screen pixels, not map units, so they are the same
   * size however far the map is zoomed. Redone on every resize.
   */
  function sizeDots() {
    if (!svg) return;
    const k = pxPerUnit();
    const r = POINT_PX / k, hit = POINT_HIT_PX / k;
    svg.querySelectorAll(".ft-dot").forEach(function (g) {
      const x = Number(g.getAttribute("data-x")), y = Number(g.getAttribute("data-y"));
      g.innerHTML = "";
      if (g.classList.contains("ft-dot--pin")) {
        const smallest = Math.min(Number(g.getAttribute("data-w")), Number(g.getAttribute("data-h"))) * k;
        if (smallest >= MIN_AREA_PX) return;          // big enough to tap as it is
        g.appendChild(svgNode("circle", { cx: x, cy: y, r: hit, class: "ft-hit" }));
        g.appendChild(svgNode("circle", { cx: x, cy: y, r: r * 0.75, class: "ft-mark" }));
        return;
      }
      g.appendChild(svgNode("circle", { cx: x, cy: y, r: hit, class: "ft-hit" }));
      if (g.classList.contains("ft-dot--peak")) {
        const s = r * 1.35;
        g.appendChild(svgNode("path", { class: "ft-mark",
          d: "M" + x + "," + (y - s) + "L" + (x + s * 0.95) + "," + (y + s * 0.7) + "L" + (x - s * 0.95) + "," + (y + s * 0.7) + "Z" }));
      } else if (g.classList.contains("ft-dot--edge")) {
        // Hudson Bay: an arrow pointing north, off the top of the map.
        const s = r * 1.5, top = Math.max(y, state.view.y + s * 1.2);
        g.appendChild(svgNode("path", { class: "ft-mark",
          d: "M" + x + "," + (top - s) + "L" + (x + s) + "," + (top + s * 0.6) + "L" + (x - s) + "," + (top + s * 0.6) + "Z" }));
        g.querySelector(".ft-hit").setAttribute("cy", top);
      } else {
        g.appendChild(svgNode("circle", { cx: x, cy: y, r: r, class: "ft-mark" }));
      }
    });
  }

  window.addEventListener("resize", sizeDots);

  function shapesOf(id) {
    return svg ? svg.querySelectorAll('[data-item="' + id + '"]') : [];
  }

  function mark(id, className, on) {
    shapesOf(id).forEach(function (n) { n.classList.toggle(className, on); });
  }

  function flash(id, className, ms) {
    shapesOf(id).forEach(function (n) {
      n.classList.remove(className);
      void n.getBoundingClientRect();
      n.classList.add(className);
    });
    window.setTimeout(function () { mark(id, className, false); }, ms);
  }

  function paint() {
    if (!svg) return;
    svg.querySelectorAll("[data-item]").forEach(function (n) {
      n.classList.remove("is-right", "is-show", "is-target", "is-wrong");
    });
    if (state.mode === "find") {
      state.queue.slice(0, state.at).forEach(function (item) { mark(item.id, "is-right", true); });
    } else {
      const week = current();
      if (week) ITEMS.filter(function (i) { return i.week === week; })
        .forEach(function (i) { mark(i.id, "is-target", true); });
    }
  }

  function drawLegend() {
    const seen = {};
    itemsInPlay().forEach(function (i) { i.parts.forEach(function (p) { seen[LOOK[p.kind].family + ":" + LOOK[p.kind].as] = true; }); });
    const KEY = [
      ["water:area", "lake, bay or sea"], ["water:line", "river"], ["trail:line", "trail"],
      ["canal:line", "canal"], ["canal:dot", "canal"], ["fault:line", "fault"],
      ["land:area", "mountains or landform"], ["region:area", "region"], ["region:dot", "region"],
      ["desert:area", "desert"], ["desert:dot", "desert"], ["peak:peak", "peak"],
      ["land:dot", "place"], ["water:dot", "water"], ["water:edge", "off the map"],
    ];
    el.legend.innerHTML = "";
    // One entry per word: a desert drawn as a shape and one marked by a dot
    // are both "desert", and the key should say so once, with both swatches.
    const rows = {};
    KEY.filter(function (k) { return seen[k[0]]; }).forEach(function (k) {
      let row = rows[k[1]];
      if (!row) {
        row = rows[k[1]] = make("span", "cc-key");
        el.legend.appendChild(row);
        row.appendChild(document.createTextNode(k[1]));
      }
      const swatch = make("span", "cc-key--" + k[0].replace(":", "-"));
      swatch.appendChild(make("i"));
      row.insertBefore(swatch, row.lastChild);
    });
  }

  /* ---------------- The run ---------------- */

  function current() {
    return state.queue[state.at] || null;
  }

  function begin() {
    window.clearTimeout(state.timer);
    state.queue = state.mode === "find" ? shuffle(itemsInPlay()) : weeksInPlay();
    state.at = 0;
    state.tries = 0;
    state.solved = false;
    state.helped = [];
    state.missed = [];
    state.trail = [];
    drawControls();
    drawMap();
    drawLegend();
    draw();
  }

  function draw() {
    paint();
    if (!current()) { setStatus("", ""); drawFinished(); }
    else if (state.mode === "find") drawFind();
    else drawName();
    drawCount();
  }

  function drawCount() {
    const cards = weeksInPlay().map(weekCard).filter(Boolean);
    const sum = CC.tally(cards);
    el.count.textContent = Math.min(state.at + 1, state.queue.length) + " of " + state.queue.length +
      " · " + sum.learned + " of " + sum.total + (sum.total === 1 ? " week" : " weeks") + " learned";
  }

  /* ---- Find it ---- */

  function drawFind() {
    const item = current();
    el.prompt.innerHTML = "";
    const card = make("div", "cc-map-card");
    card.appendChild(make("p", "cc-aside", "Week " + item.week + " · " + weekLabel(item.week) + " · on your own"));
    const q = make("p", "cc-map-q");
    const said = spokenName(item);
    const lead = isPlural(item) ? "Where are " : "Where is ";
    // Bold only the name itself, not "the" in front of it.
    const article = /^the /.test(said) ? "the " : "";
    q.appendChild(document.createTextNode(lead + article));
    q.appendChild(make("strong", null, said.slice(article.length)));
    q.appendChild(document.createTextNode("?"));
    card.appendChild(q);
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

  /** `under` is every feature beneath the tap, topmost first. */
  function tapped(under) {
    if (state.mode !== "find" || state.solved) return;
    const item = current();
    if (!item) return;
    const id = under.indexOf(item.id) !== -1 ? item.id : (under.length ? under[0] : -1);

    if (id === item.id) {
      state.solved = true;
      mark(id, "is-show", false);
      mark(id, "is-right", true);
      setStatus("✓ " + item.name, "right");
      state.timer = window.setTimeout(next, NEXT_AFTER);
      return;
    }
    if (id < 0) { setStatus("Nothing there — try again.", "wrong"); return; }

    state.tries += 1;
    flash(id, "is-wrong", 700);
    const touched = spokenName(ITEMS[id]);
    if (state.tries >= 2) {
      if (state.helped.indexOf(item) === -1) state.helped.push(item);
      mark(item.id, "is-show", true);
      const said = spokenName(item);
      setStatus("That’s " + touched + ". " + said.charAt(0).toUpperCase() + said.slice(1) +
        (isPlural(item) ? " are" : " is") + " the one flashing — tap it.", "wrong");
    } else {
      setStatus("That’s " + touched + ". Try again.", "wrong");
    }
  }

  function next() {
    window.clearTimeout(state.timer);
    state.at += 1;
    state.tries = 0;
    state.solved = false;
    if (state.view !== state.weekView) setView(state.weekView);
    draw();
  }

  /* ---- Name it ---- */

  function drawName() {
    const week = current();
    const items = ITEMS.filter(function (i) { return i.week === week; });
    el.prompt.innerHTML = "";
    const card = make("div", "cc-map-card cc-map-card--name");
    card.appendChild(make("p", "cc-aside", "Week " + week + " · with a parent"));
    card.appendChild(make("p", "cc-map-q", weekLabel(week) + ": point to each one and name it, in order."));

    const checker = make("div", "cc-checker");
    checker.appendChild(make("p", "cc-aside", "They should name:"));
    const ol = make("ol", "cc-map-order");
    items.forEach(function (i) { ol.appendChild(make("li", null, i.name)); });
    checker.appendChild(ol);
    const c = weekCard(week);
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
      "every one, in order" + (hasKeyboard() ? " · space if they got it, N if not, ← to go back" : "")));
    el.prompt.appendChild(card);
  }

  function judge(right) {
    const week = current();
    const card = weekCard(week);
    if (!card) return;
    const id = CC.idOf(card);
    const before = CC.progress()[id];
    CC.saidIt(card, right);
    const newMiss = !right && state.missed.indexOf(week) === -1;
    if (newMiss) state.missed.push(week);
    state.trail.push({ at: state.at, id: id, before: before, newMiss: newMiss, week: week });
    state.at += 1;
    draw();
  }

  /** Back also takes back the verdict, exactly as it does in Recite. */
  function back_() {
    const last = state.trail.pop();
    if (!last) return;
    const all = CC.progress();
    if (last.before === undefined) delete all[last.id]; else all[last.id] = last.before;
    CC.saveProgress(all);
    if (last.newMiss) state.missed = state.missed.filter(function (w) { return w !== last.week; });
    state.at = last.at;
    draw();
  }

  /* ---- The end of a sitting ---- */

  function drawFinished() {
    el.prompt.innerHTML = "";
    const card = make("div", "cc-map-card cc-map-card--done");
    const find = state.mode === "find";
    const list = find ? state.helped : state.missed;

    card.appendChild(make("p", "cc-map-q", find
      ? "Found all " + state.queue.length + (list.length ? " — " + list.length + " needed showing." : ", every one on the first or second try.")
      : (list.length ? list.length + (list.length === 1 ? " week" : " weeks") + " to work on." : "Every week said right.")));

    if (list.length) {
      const ul = make("ul", "cc-map-list");
      list.forEach(function (x) {
        ul.appendChild(make("li", null, find ? x.name + " · week " + x.week : "Week " + x + " · " + weekLabel(x)));
      });
      card.appendChild(ul);
    }

    const row = make("div", "game-actions");
    if (!find && state.trail.length) row.appendChild(button("← Back", "btn btn-secondary cc-back", back_));
    row.appendChild(button("Go again", "btn btn-primary", begin));
    if (find && list.length) {
      row.appendChild(button("Just these " + list.length, "btn btn-secondary", function () {
        const only = list.slice();
        begin();
        state.queue = shuffle(only);
        draw();
      }));
    }
    card.appendChild(row);
    el.prompt.appendChild(card);
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
    WEEKS.forEach(function (w) {
      el.weeks.appendChild(chip(String(w), state.week === w, function () {
        state.week = w;
        begin();
      }, "Week " + w + " · " + weekLabel(w)));
    });
    el.weeks.appendChild(chip("All", state.week === 0, function () {
      state.week = 0;
      begin();
    }, "Weeks 11 to 24"));

    el.title.textContent = "🏔️ " + (state.week
      ? "Week " + state.week + " · " + weekLabel(state.week)
      : "Geography · weeks 11–24");
  }

  /* ---------------- Keys ---------------- */

  document.addEventListener("keydown", function (event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const on = event.target;
    if (on && (on.tagName === "BUTTON" || on.tagName === "INPUT" || on.tagName === "SELECT")) return;

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

  begin();

  window.CCFeatures = { state: state, ITEMS: ITEMS, begin: begin, tapped: tapped, itemsInPlay: itemsInPlay };
})();
