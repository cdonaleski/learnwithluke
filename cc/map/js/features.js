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
  const HARD_NEAR_PX = 26;     // on Hard, how near the right one a tap may land
  const LINE_HIT_PX = 22;      // the invisible width around a river or trail
  const MIN_AREA_PX = 28;      // an area narrower than this on screen gets a pin

  const el = {
    title: document.getElementById("map-title"),
    count: document.getElementById("map-count"),
    modes: document.getElementById("map-mode"),
    levels: document.getElementById("map-level"),
    levelWhy: document.getElementById("map-level-why"),
    weeks: document.getElementById("map-weeks"),
    prompt: document.getElementById("map-prompt"),
    main: document.getElementById("map-main"),
    legend: document.getElementById("map-legend"),
  };

  const MODES = [
    { id: "find", label: "Find it", icon: "👆" },
    { id: "study", label: "Study", icon: "🧠" },
    { id: "name", label: "Recite", icon: "🎤" },
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

  /*
   * THE GRAPHICS, after Classical Conversations' own key (page 246) and its
   * Black Line Master: mountain ranges as clusters of small triangles, peaks
   * as red triangles, deserts in orange, water in blue, trails dotted, the
   * Grand Canyon and Death Valley in dark brown, Mammoth Cave a small square,
   * the swamp a purple-blue patch, the Native American regions in pale tints.
   *
   * These are symbols, the way a map key's are. Where a feature has a real
   * shape it is drawn in that shape; where it is only a point, the symbol
   * marks the point and claims no outline.
   */
  const AREA_STYLE = {
    "Adirondack Mountains": "range", "Blue Ridge Mountains": "range", "Rocky Mountains": "range",
    "Sierra Nevadas": "range", "Cascade Mountains": "range", "Black Hills": "range",
    "Ozark Highlands": "hills", "Grand Canyon": "canyon", "Mississippi River Delta": "delta",
    "Sonoran Desert": "desert", "Great Salt Lake Desert": "desert",
    "Plains": "region-plains", "Great Basin": "region-basin",
  };
  const POINT_GLYPH = {
    "White Mountains": "range", "Green Mountains": "range", "Allegheny Mountains": "range",
    "Great Smoky Mountains": "range", "Cumberland Mountains": "range",
    "The Great Valley": "valley-green", "Death Valley": "valley",
    "Mojave Desert": "desert", "Colorado Desert": "desert", "Painted Desert": "desert",
    "Okefenokee Swamp": "swamp", "Olympic rainforests": "forest", "Niagara Falls": "falls",
    "Mammoth Cave": "cave", "Puget Sound": "water",
  };

  function areaStyle(item, part) {
    if (AREA_STYLE[item.name]) return AREA_STYLE[item.name];
    return LOOK[part.kind].family === "water" ? "water" : LOOK[part.kind].family;
  }

  function pointGlyph(item, part) {
    if (part.kind === "peak") return "peak";
    if (part.kind === "edge") return "edge";
    if (POINT_GLYPH[item.name]) return POINT_GLYPH[item.name];
    if (part.kind === "canal-point") return "canal";
    if (part.kind === "region-point" || item.week === 21) return "region";
    if (part.kind === "desert-point") return "desert";
    if (part.kind === "water-point") return "water";
    return "place";
  }

  /*
   * EASY, MEDIUM, HARD -- how much the map gives away.
   *   Easy    every feature is drawn, zoomed in close to the one being asked
 *           about, so it sits among its few nearest neighbors.
   *   Medium  every feature from every week is drawn, unnamed, on the whole
   *           country, the way the Black Line Master is: you have to know
   *           which triangles are the Cascades.
   *   Hard    nothing is drawn. The country, and your memory.
   */
  const LEVELS = [
    { id: "easy", label: "Easy", why: "Every feature drawn, zoomed in close on each one." },
    { id: "medium", label: "Medium", why: "Every feature drawn, none named — the whole country." },
    { id: "hard", label: "Hard", why: "A bare map. Nothing is drawn." },
  ];
  const LEVEL_KEY = "cc-features-level";

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
    level: (function () {
      try { const v = window.localStorage.getItem(LEVEL_KEY); if (v === "medium" || v === "hard") return v; }
      catch (err) { /* fine */ }
      return "easy";
    })(),
  };

  (function fromLink() {
    const params = new URLSearchParams(window.location.search);
    const week = Number(params.get("weeks"));
    if (WEEKS.indexOf(week) !== -1) state.week = week;
    else if (params.get("weeks") === "all") state.week = 0;
    if (params.get("mode") === "name" || params.get("mode") === "recite") state.mode = "name";
    if (params.get("mode") === "study") state.mode = "study";
    const level = params.get("level");
    if (level === "easy" || level === "medium" || level === "hard") state.level = level;
  })();

  function weeksInPlay() { return state.week ? [state.week] : WEEKS.slice(); }
  function itemsInPlay() {
    const weeks = weeksInPlay();
    return ITEMS.filter(function (i) { return weeks.indexOf(i.week) !== -1; });
  }

  function drawnItems() {
    return state.mode === "name" ? itemsInPlay() : ITEMS;
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

  /**
   * Easy's zoom: the area around the one feature being asked about. A whole
   * week often spans the country -- the rivers run from Montana to the St.
   * Lawrence -- so zooming to the week would not zoom at all. This frames
   * the feature together with its three nearest neighbors (from any week),
   * so there are a few pictures to choose between and not just the answer;
   * at least a third of the country, never more than about half; nudged a
   * little off-center so the answer is not always dead middle.
   */
  function boxOf(item) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    item.parts.forEach(function (p) {
      x0 = Math.min(x0, p.bbox[0]); y0 = Math.min(y0, p.bbox[1]);
      x1 = Math.max(x1, p.bbox[2]); y1 = Math.max(y1, p.bbox[3]);
    });
    return [x0, y0, x1, y1];
  }

  function regionFrame(item) {
    let [x0, y0, x1, y1] = boxOf(item);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const near = ITEMS.filter(function (o) { return o !== item; }).map(function (o) {
      const b = boxOf(o);
      return { b: b, d: Math.hypot((b[0] + b[2]) / 2 - cx, (b[1] + b[3]) / 2 - cy) };
    }).sort(function (a, b) { return a.d - b.d; });
    let added = 0;
    for (let i = 0; i < near.length && added < 3; i++) {
      const b = near[i].b;
      const nx0 = Math.min(x0, b[0]), ny0 = Math.min(y0, b[1]);
      const nx1 = Math.max(x1, b[2]), ny1 = Math.max(y1, b[3]);
      // A neighbor that would pull the frame out past half the country is
      // skipped -- a long river nearby should not undo the zoom.
      if ((nx1 - nx0) * 1.25 > FULL.w * 0.5 || (ny1 - ny0) * 1.25 > FULL.h * 0.5) continue;
      x0 = nx0; y0 = ny0; x1 = nx1; y1 = ny1; added++;
    }
    let w = Math.max((x1 - x0) * 1.25, 330), h = Math.max((y1 - y0) * 1.25, 206);
    if (w / h > ASPECT) h = w / ASPECT; else w = h * ASPECT;
    if (w >= FULL.w || h >= FULL.h) return FULL;
    // A stable nudge per feature, so the same question frames the same way.
    const jitter = function (n) { return (((item.id * 37 + n * 101) % 21) - 10) / 10; };
    let x = (x0 + x1) / 2 - w / 2 + jitter(1) * (w - (x1 - x0)) * 0.15;
    let y = (y0 + y1) / 2 - h / 2 + jitter(2) * (h - (y1 - y0)) * 0.15;
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
    const easy = state.level === "easy";
    // Every level lays out every feature, so the right one has to be told
    // apart from the rest -- Easy just zooms in close. (Recite draws only
    // the weeks in play, at any level: there the map is the checker's.) On Hard they are there but invisible -- still
    // tappable, so a wrong tap can say what it touched, and still revealed
    // when shown.
    const items = drawnItems();
    state.view = easy ? frameFor(itemsInPlay()) : FULL;
    state.weekView = state.view;
    const v = state.view;

    svg = svgNode("svg", {
      viewBox: v.x + " " + v.y + " " + v.w + " " + v.h,
      class: "cc-map-svg cc-fmap" + (state.mode === "name" ? " is-recite" : state.level === "hard" ? " is-bare" : ""),
      role: "group",
      "aria-label": "Map — tap a feature",
    });

    // Patterns for the ranges and hills. Sized in screen pixels in sizeDots,
    // so the triangles stay the same size however far the map is zoomed.
    const defs = svgNode("defs");
    const mtn = svgNode("pattern", { id: "ft-mtn", patternUnits: "userSpaceOnUse" });
    mtn.appendChild(svgNode("path", { class: "ft-mtn-a" }));
    mtn.appendChild(svgNode("path", { class: "ft-mtn-b" }));
    const hill = svgNode("pattern", { id: "ft-hill", patternUnits: "userSpaceOnUse" });
    hill.appendChild(svgNode("path", { class: "ft-hill-a" }));
    defs.appendChild(mtn); defs.appendChild(hill);
    svg.appendChild(defs);

    // The states underneath, for bearings only.
    const base = svgNode("g", { class: "cc-fbase" });
    MAP.states.forEach(function (st) { base.appendChild(svgNode("path", { d: st.d })); });
    svg.appendChild(base);

    // Areas first, lines over them, symbols on top: so a peak inside a range,
    // or a desert inside a bigger desert, is still the thing you hit.
    const areas = svgNode("g"), lines = svgNode("g"), dots = svgNode("g");
    items.forEach(function (item) {
      item.parts.forEach(function (p) {
        const look = LOOK[p.kind];
        if (look.as === "area") {
          const style = areaStyle(item, p);
          areas.appendChild(svgNode("path", { d: p.d, class: "ft ft-area ft-a--" + style, "data-item": item.id }));
          if (style === "range" || style === "hills") {
            areas.appendChild(svgNode("path", { d: p.d, class: "ft ft-over", "data-item": item.id,
              fill: style === "range" ? "url(#ft-mtn)" : "url(#ft-hill)" }));
          }
          // A pin inside the shape, used only if the shape turns out too small
          // to tap at this zoom -- San Francisco Bay is 13 pixels across on a
          // whole-country map, the Mississippi Delta 10.
          if (p.px != null) {
            dots.appendChild(svgNode("g", { class: "ft ft-dot ft-dot--pin ft-g--" + style, "data-item": item.id,
              "data-x": p.px, "data-y": p.py, "data-w": p.bbox[2] - p.bbox[0], "data-h": p.bbox[3] - p.bbox[1] }));
          }
        } else if (look.as === "line") {
          lines.appendChild(svgNode("path", { d: p.d, class: "ft ft-line ft-l--" + look.family, "data-item": item.id }));
          lines.appendChild(svgNode("path", { d: p.d, class: "ft-hit-line", "data-item": item.id }));
        } else {
          dots.appendChild(svgNode("g", { class: "ft ft-dot ft-g--" + pointGlyph(item, p), "data-item": item.id,
            "data-x": p.x, "data-y": p.y }));
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
    //
    // Hard is different. Nothing is drawn, so there is nothing to close in
    // on and nothing to tell apart -- the question is whether you know WHERE
    // it is. A tap that lands near enough to the one asked for counts, even
    // if another feature happens to be nearer.
    function idsAt(x, y, under, dotsHere) {
      document.elementsFromPoint(x, y).forEach(function (node) {
        const hit = node.closest && node.closest("[data-item]");
        if (hit && svg.contains(hit)) {
          const id = Number(hit.getAttribute("data-item"));
          if (under.indexOf(id) === -1) under.push(id);
          if (dotsHere && hit.classList.contains("ft-dot") && hit.firstChild && dotsHere.indexOf(id) === -1) dotsHere.push(id);
        }
      });
    }
    svg.addEventListener("click", function (event) {
      const under = [], dotsHere = [];
      idsAt(event.clientX, event.clientY, under, dotsHere);
      const item = current();
      if (state.level === "hard" && state.mode === "find" && !state.solved && item) {
        const near = under.slice();
        for (let i = 0; i < 16; i++) {
          const a = i * Math.PI / 4, d = i < 8 ? HARD_NEAR_PX : HARD_NEAR_PX / 2;
          idsAt(event.clientX + Math.cos(a) * d, event.clientY + Math.sin(a) * d, near);
        }
        tapped(near.indexOf(item.id) !== -1 ? [item.id] : under);
        return;
      }
      // ...unless the map has already closed in on these same dots and they
      // still overlap. The Great Valley and the Chesapeake and Ohio Canal are
      // recorded about two miles apart: no zoom separates them, and zooming
      // again would trap the child in a loop. Then the spot counts for
      // whichever of them was asked.
      const crowd = dotsHere.slice().sort().join(",");
      if (state.mode === "find" && !state.solved && dotsHere.length > 1 && state.zoomedOn !== crowd) {
        state.zoomedOn = crowd;
        zoomTo(dotsHere);
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

  /* The symbols, drawn around a point in screen-pixel sizes (s = one unit). */
  function tri(x, y, s) {
    return "M" + x + "," + (y - s) + "L" + (x + s * 0.95) + "," + (y + s * 0.7) + "L" + (x - s * 0.95) + "," + (y + s * 0.7) + "Z";
  }

  function glyph(g, kind, x, y, r) {
    const add = function (tag, attrs) { g.appendChild(svgNode(tag, attrs)); };
    if (kind === "range") {
      // A little range: five triangles, like the clusters on CC's key.
      const s = r * 0.62, d = r * 0.95;
      [[-1, 0.55], [0, 0.75], [1, 0.5], [-0.5, -0.45], [0.55, -0.5]].forEach(function (o) {
        add("path", { class: "ft-mark ft-tri", d: tri(x + o[0] * d, y + o[1] * d, s) });
      });
    } else if (kind === "peak") {
      add("path", { class: "ft-mark ft-peak", d: tri(x, y, r * 1.35) });
    } else if (kind === "edge") {
      // Hudson Bay: an arrow pointing north, off the top of the map.
      const s = r * 1.5, top = Math.max(y, state.view.y + s * 1.2);
      add("path", { class: "ft-mark ft-water-mark",
        d: "M" + x + "," + (top - s) + "L" + (x + s) + "," + (top + s * 0.6) + "L" + (x - s) + "," + (top + s * 0.6) + "Z" });
      g.querySelector(".ft-hit").setAttribute("cy", top);
    } else if (kind === "valley" || kind === "valley-green") {
      add("ellipse", { class: "ft-mark ft-" + kind, cx: x, cy: y, rx: r * 1.5, ry: r * 0.5,
        transform: "rotate(-35 " + x + " " + y + ")" });
    } else if (kind === "desert") {
      add("path", { class: "ft-mark ft-desert-mark", d:
        "M" + (x - r * 1.2) + "," + y + "q" + r * 0.2 + "," + -r * 1.1 + " " + r * 1.1 + "," + -r * 0.9 +
        "q" + r * 0.9 + "," + -r * 0.2 + " " + r * 1.2 + "," + r * 0.6 + "q" + r * 0.2 + "," + r * 1 + " " + -r * 0.9 + "," + r * 1.1 +
        "q" + -r * 1.2 + "," + r * 0.1 + " " + -r * 1.4 + "," + -r * 0.8 + "Z" });
    } else if (kind === "swamp") {
      add("ellipse", { class: "ft-mark ft-swamp-mark", cx: x, cy: y, rx: r * 1.2, ry: r * 0.85 });
      [-0.45, 0, 0.45].forEach(function (o) {
        add("path", { class: "ft-tuft", d: "M" + (x + o * r) + "," + (y + r * 0.35) + "l0," + -r * 0.6 });
      });
    } else if (kind === "forest") {
      add("path", { class: "ft-mark ft-forest-mark", d: tri(x, y - r * 0.15, r * 1.05) });
      add("rect", { class: "ft-trunk", x: x - r * 0.14, y: y + r * 0.55, width: r * 0.28, height: r * 0.45 });
    } else if (kind === "falls") {
      add("path", { class: "ft-mark ft-water-mark", d:
        "M" + x + "," + (y - r * 1.2) + "C" + (x + r * 0.9) + "," + (y - r * 0.1) + " " + (x + r * 0.9) + "," + (y + r * 0.9) +
        " " + x + "," + (y + r * 0.9) + "C" + (x - r * 0.9) + "," + (y + r * 0.9) + " " + (x - r * 0.9) + "," + (y - r * 0.1) + " " + x + "," + (y - r * 1.2) + "Z" });
    } else if (kind === "cave") {
      add("rect", { class: "ft-mark ft-cave-mark", x: x - r * 0.7, y: y - r * 0.7, width: r * 1.4, height: r * 1.4, rx: r * 0.15 });
    } else if (kind === "water") {
      add("ellipse", { class: "ft-mark ft-water-mark", cx: x, cy: y, rx: r * 1.1, ry: r * 0.8 });
    } else if (kind === "canal") {
      add("rect", { class: "ft-mark ft-canal-mark", x: x - r * 1.1, y: y - r * 0.32, width: r * 2.2, height: r * 0.64, rx: r * 0.32 });
    } else if (kind === "region") {
      add("circle", { class: "ft-mark ft-region-mark", cx: x, cy: y, r: r * 1.5 });
    } else {
      add("circle", { class: "ft-mark ft-place-mark", cx: x, cy: y, r: r * 0.8 });
    }
  }

  /**
   * Symbols and patterns are drawn in screen pixels, not map units, so they
   * are the same size however far the map is zoomed. Redone on every resize
   * and every zoom.
   */
  function sizeDots() {
    if (!svg) return;
    const k = pxPerUnit();
    // What you SEE shrinks with a small map -- on a phone, laptop-sized
    // symbols crowded the whole country -- but what you can TAP does not:
    // the hit circles stay finger-sized.
    const width = svg.getBoundingClientRect().width || 700;
    const look = Math.max(0.55, Math.min(1, width / 650));
    const r = POINT_PX * look / k, hit = POINT_HIT_PX / k;

    // Range pattern: two staggered triangles per tile, 18px apart on screen.
    const t = 18 * look / k, ts = 4.2 * look / k;
    const mtn = svg.querySelector("#ft-mtn");
    mtn.setAttribute("width", t); mtn.setAttribute("height", t);
    mtn.querySelector(".ft-mtn-a").setAttribute("d", tri(t * 0.25, t * 0.32, ts));
    mtn.querySelector(".ft-mtn-b").setAttribute("d", tri(t * 0.75, t * 0.82, ts));
    const hill = svg.querySelector("#ft-hill");
    const h = 14 * look / k;
    hill.setAttribute("width", h); hill.setAttribute("height", h);
    hill.querySelector(".ft-hill-a").setAttribute("d",
      "M" + h * 0.2 + "," + h * 0.55 + "L" + h * 0.4 + "," + h * 0.3 + "L" + h * 0.6 + "," + h * 0.55);

    svg.querySelectorAll(".ft-dot").forEach(function (g) {
      const x = Number(g.getAttribute("data-x")), y = Number(g.getAttribute("data-y"));
      g.innerHTML = "";
      if (g.classList.contains("ft-dot--pin")) {
        const smallest = Math.min(Number(g.getAttribute("data-w")), Number(g.getAttribute("data-h"))) * k;
        if (smallest >= MIN_AREA_PX) return;          // big enough to tap as it is
        g.appendChild(svgNode("circle", { cx: x, cy: y, r: hit, class: "ft-hit" }));
        g.appendChild(svgNode("circle", { cx: x, cy: y, r: r * 0.75, class: "ft-mark ft-pin-mark" }));
        return;
      }
      g.appendChild(svgNode("circle", { cx: x, cy: y, r: hit, class: "ft-hit" }));
      const kind = (g.getAttribute("class").match(/ft-g--([\w-]+)/) || [])[1] || "place";
      glyph(g, kind, x, y, r);
    });
    drawBadges();
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
    } else if (state.mode === "study") {
      const item = current();
      if (item) mark(item.id, "is-target", true);
    } else {
      const week = current();
      // Recite's screen is the checker's answer key -- the child points on a
      // paper map -- so the week is always lit, whatever the level.
      if (week) {
        ITEMS.filter(function (i) { return i.week === week; })
          .forEach(function (i) { mark(i.id, "is-target", true); });
      }
    }
  }

  function drawLegend() {
    el.legend.innerHTML = "";
    el.legend.hidden = state.level === "hard";
    if (state.level === "hard") return;
    const drawn = drawnItems();
    const seen = {};
    drawn.forEach(function (item) {
      item.parts.forEach(function (p) {
        const as = LOOK[p.kind].as;
        if (as === "area") seen["a-" + areaStyle(item, p)] = true;
        else if (as === "line") seen["l-" + LOOK[p.kind].family] = true;
        else seen["g-" + pointGlyph(item, p)] = true;
      });
    });
    const KEY = [
      ["a-range", "mountain range"], ["g-range", "mountain range"], ["g-peak", "mountain peak"],
      ["a-hills", "highlands"], ["a-water", "lake, bay or sea"], ["g-water", "lake, bay or sea"],
      ["l-water", "river"], ["l-canal", "canal"], ["g-canal", "canal"], ["l-trail", "trail"],
      ["l-fault", "fault"], ["a-desert", "desert"], ["g-desert", "desert"], ["a-canyon", "canyon"],
      ["g-valley", "valley"], ["g-valley-green", "valley"], ["a-delta", "river delta"],
      ["g-swamp", "swamp"], ["g-forest", "rainforest"], ["g-falls", "waterfall"], ["g-cave", "cave"],
      ["a-region-plains", "Native American region"], ["a-region-basin", "Native American region"],
      ["g-region", "Native American region"], ["g-place", "place"], ["g-edge", "off the map"],
    ];
    const rows = {};
    KEY.filter(function (k) { return seen[k[0]]; }).forEach(function (k) {
      let row = rows[k[1]];
      if (!row) {
        row = rows[k[1]] = make("span", "cc-key");
        el.legend.appendChild(row);
        row.appendChild(document.createTextNode(k[1]));
      }
      const swatch = make("span", "cc-sw cc-sw--" + k[0]);
      row.insertBefore(swatch, row.lastChild);
    });
  }

  /* ---------------- The run ---------------- */

  function current() {
    return state.queue[state.at] || null;
  }

  function begin() {
    window.clearTimeout(state.timer);
    // Find it and Study go one feature at a time, shuffled; Recite goes a
    // week at a time, the way the proof asks.
    state.queue = state.mode === "name" ? weeksInPlay() : shuffle(itemsInPlay());
    state.revealed = false;
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
    else if (state.mode === "study") drawStudy();
    else drawName();
    drawBadges();
    drawCount();
  }

  /**
   * Recite's numbers: a numbered badge beside each of the week's features,
   * matching the numbered list in the card, so a parent who does not know
   * where the Cumberland Mountains are can still tell whether the child
   * pointed to the right place. Drawn in screen pixels, like the symbols.
   */
  function anchorOf(item) {
    const p = item.parts[0];
    if (p.x !== undefined) return [p.x, p.y];
    if (p.px !== undefined) return [p.px, p.py];
    const line = svg.querySelector('path.ft-line[data-item="' + item.id + '"], path.ft[data-item="' + item.id + '"]');
    if (line && line.getTotalLength && /ft-line/.test(line.getAttribute("class"))) {
      const at = line.getPointAtLength(line.getTotalLength() / 2);
      return [at.x, at.y];
    }
    return [(p.bbox[0] + p.bbox[2]) / 2, (p.bbox[1] + p.bbox[3]) / 2];
  }

  function drawBadges() {
    if (!svg) return;
    const old = svg.querySelector(".ft-badges");
    if (old) old.remove();
    const week = state.mode === "name" ? current() : null;
    if (!week) return;
    const k = pxPerUnit(), r = 11 / k, off = 15 / k;
    const layer = svgNode("g", { class: "ft-badges", "aria-hidden": "true" });
    ITEMS.filter(function (i) { return i.week === week; }).forEach(function (item, n) {
      const a = anchorOf(item), v = state.view;
      // Kept inside the frame -- Hudson Bay's arrow sits on the map's edge.
      const x = Math.max(v.x + r * 1.3, Math.min(a[0] + off, v.x + v.w - r * 1.3));
      const y = Math.max(v.y + r * 1.3, Math.min(a[1] - off, v.y + v.h - r * 1.3));
      const g = svgNode("g", { class: "ft-badge" });
      g.appendChild(svgNode("circle", { cx: x, cy: y, r: r }));
      const t = svgNode("text", { x: x, y: y, "font-size": 13 / k });
      t.textContent = String(n + 1);
      g.appendChild(t);
      layer.appendChild(g);
    });
    svg.appendChild(layer);
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
    if (state.level === "easy") setView(regionFrame(item));
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
    state.zoomedOn = null;
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
    // Framed on the week, for the checker. The child is not looking here.
    state.weekView = frameFor(items);
    setView(state.weekView);
    el.prompt.innerHTML = "";
    const card = make("div", "cc-map-card cc-map-card--name");
    card.appendChild(make("p", "cc-aside", "Week " + week + " · with a parent"));
    card.appendChild(make("p", "cc-map-q", "On a paper map, point to each one and name it, in order."));
    card.appendChild(make("p", "cc-map-hint",
      "This screen is for the checker. Use a printed U.S. map or the Black Line Master."));

    const checker = make("div", "cc-checker");
    checker.appendChild(make("p", "cc-aside", "They should point to and name — numbered on the map:"));
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

  /* ---- Study ---- */

  /**
   * A flashcard on the map: one feature lights up, its name stays hidden
   * until asked for, and you mark yourself. Easy zooms in close to it, Medium
   * shows it among everything else, Hard shows it alone on a bare map. Not
   * recorded toward learned -- Recite's job -- but the ones you did not know
   * are listed at the end.
   */
  function drawStudy() {
    const item = current();
    if (state.level === "easy") setView(regionFrame(item));
    else if (state.view !== state.weekView) setView(state.weekView);
    el.prompt.innerHTML = "";
    const card = make("div", "cc-map-card cc-map-card--study");
    card.appendChild(make("p", "cc-aside", "Week " + item.week + " · " + weekLabel(item.week) + " · on your own"));
    card.appendChild(make("p", "cc-map-q", "What is the yellow one?"));

    const row = make("div", "game-actions");
    if (!state.revealed) {
      card.appendChild(make("p", "cc-map-hint", "Say it out loud first, then check."));
      row.appendChild(button("Show answer", "btn btn-primary", function () {
        state.revealed = true;
        draw();
      }));
    } else {
      const answer = make("div", "cc-checker");
      answer.appendChild(make("p", "cc-aside", "The answer"));
      answer.appendChild(make("p", "cc-a", item.name));
      card.appendChild(answer);
      row.appendChild(button("✓ I knew it", "btn btn-primary", function () { studyMark(true); }));
      row.appendChild(button("Not yet", "btn btn-secondary", function () { studyMark(false); }));
    }
    card.appendChild(row);
    if (hasKeyboard()) {
      card.appendChild(make("p", "cc-where", state.revealed ? "space if you knew it, N if not" : "space shows the answer"));
    }
    el.prompt.appendChild(card);
  }

  function studyMark(knew) {
    const item = current();
    if (!item) return;
    if (!knew && state.missed.indexOf(item) === -1) state.missed.push(item);
    state.at += 1;
    state.revealed = false;
    draw();
  }

  function drawFinished() {
    el.prompt.innerHTML = "";
    const card = make("div", "cc-map-card cc-map-card--done");
    const find = state.mode === "find";
    const study = state.mode === "study";
    const oneAtATime = find || study;          // a list of features, not weeks
    const list = find ? state.helped : state.missed;

    card.appendChild(make("p", "cc-map-q", find
      ? "Found all " + state.queue.length + (list.length ? " — " + list.length + " needed showing." : ", every one on the first or second try.")
      : study
        ? (list.length ? list.length + " to work on." : "You knew every one of them.")
        : (list.length ? list.length + (list.length === 1 ? " week" : " weeks") + " to work on." : "Every week said right.")));

    if (list.length) {
      const ul = make("ul", "cc-map-list");
      list.forEach(function (x) {
        ul.appendChild(make("li", null, oneAtATime ? x.name + " · week " + x.week : "Week " + x + " · " + weekLabel(x)));
      });
      card.appendChild(ul);
    }

    const row = make("div", "game-actions");
    if (state.mode === "name" && state.trail.length) row.appendChild(button("← Back", "btn btn-secondary cc-back", back_));
    row.appendChild(button("Go again", "btn btn-primary", begin));
    if (oneAtATime && list.length) {
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

    if (el.levels) {
      el.levels.innerHTML = "";
      LEVELS.forEach(function (lv) {
        el.levels.appendChild(chip(lv.label, lv.id === state.level, function () {
          state.level = lv.id;
          try { window.localStorage.setItem(LEVEL_KEY, lv.id); } catch (err) { /* fine */ }
          begin();
        }, lv.why));
      });
      const lv = LEVELS.filter(function (l) { return l.id === state.level; })[0];
      // Levels are for the child's own practice. In Recite the screen is the
      // checker's, and it always shows the answers.
      el.levels.hidden = state.mode === "name";
      el.levelWhy.textContent = state.mode === "name"
        ? "The week's features are lit and numbered — the answer key for whoever is checking."
        : lv.why;
    }

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
      if (state.mode === "study" && current()) {
        event.preventDefault();
        if (!state.revealed) { state.revealed = true; draw(); } else studyMark(true);
        return;
      }
      if (state.mode === "name" && current()) { event.preventDefault(); judge(true); }
      else if (state.mode === "find" && state.solved) { event.preventDefault(); next(); }
    } else if ((event.key === "n" || event.key === "N") && state.mode === "study" && current() && state.revealed) {
      event.preventDefault();
      studyMark(false);
    } else if ((event.key === "n" || event.key === "N") && state.mode === "name" && current()) {
      event.preventDefault();
      judge(false);
    } else if (event.key === "ArrowLeft" && state.mode === "name" && state.trail.length) {
      event.preventDefault();
      back_();
    }
  });

  begin();

  window.CCFeatures = { state: state, ITEMS: ITEMS, begin: begin, tapped: tapped, itemsInPlay: itemsInPlay, next: next };
})();
