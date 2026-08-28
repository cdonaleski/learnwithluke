(function () {
  "use strict";

  var FORMULAS = Array.isArray(window.FormulaCards) ? window.FormulaCards : [];
  var VIZ = window.FormulaViz;

  var SUBJECTS = [
    { id: "all", label: "Everything" },
    { id: "physics", label: "Physics" },
    { id: "chemistry", label: "Chemistry" },
    { id: "math", label: "Maths" },
    { id: "engineering", label: "Engineering" },
    { id: "space", label: "Space" }
  ];

  var SYM = {
    rho: "ρ", sig: "σ", eps: "ε", lam: "λ", th: "θ", tau: "τ", alpha: "α",
    dT: "ΔT", dL: "ΔL", d: "d",
    v1: "v₁", v2: "v₂", m1: "m₁", m2: "m₂",
    P1: "P₁", P2: "P₂", V1: "V₁", V2: "V₂", T1: "T₁", T2: "T₂",
    C1: "C₁", C2: "C₂", R1: "R₁", R2: "R₂",
    x1: "x₁", y1: "y₁", x2: "x₂", y2: "y₂",
    H: "[H⁺]", Vout: "Vₒᵤₜ", Vin: "Vᵢₙ",
    yieldp: "yield", neu: "new", eff: "efficiency", pct: "%",
    inp: "input", out: "fx-result", ratio: "ratio", ropes: "ropes",
    driven: "driven", driver: "driver", strength: "strength", load: "load",
    effort: "effort", useful: "useful", total: "total", count: "count",
    ways: "ways", actual: "actual", theo: "theoretical", part: "fx-part", whole: "whole",
    mean: "mean", old: "old", km: "km", ly: "ly"
  };

  function sym(k) { return SYM[k] || k; }

  var $ = function (id) { return document.getElementById(id); };
  var listEl = $("list"), detailEl = $("detail"), qEl = $("q");
  var filter = "all";
  var currentId = null;

  /* ---------- number formatting ---------- */
  var SUPS = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻", "+": "" };
  function sup(s) { return String(s).split("").map(function (c) { return SUPS[c] !== undefined ? SUPS[c] : c; }).join(""); }

  function fmt(n) {
    if (typeof n !== "number" || !isFinite(n)) { return "—"; }
    var a = Math.abs(n);
    if (a !== 0 && (a >= 1e6 || a < 1e-3)) {
      var parts = n.toExponential(3).split("e");
      var mant = parseFloat(parts[0]).toString();
      return mant + " × 10" + sup(parseInt(parts[1], 10));
    }
    return Number(n.toPrecision(5)).toLocaleString("en-US", { maximumFractionDigits: 8 });
  }

  /* ---------- searching ---------- */
  function haystack(c) {
    var v = Object.keys(c.vars || {}).map(function (k) { return k + " " + c.vars[k][0]; }).join(" ");
    return (c.t + " " + c.f + " " + c.m + " " + (c.tags || "") + " " + (c.why || "") + " " + v + " " + c.sub).toLowerCase();
  }
  FORMULAS.forEach(function (c) { c._h = haystack(c); });

  function matches() {
    var q = qEl.value.trim().toLowerCase();
    var words = q ? q.split(/\s+/) : [];
    return FORMULAS.filter(function (c) {
      if (filter !== "all" && c.sub !== filter) { return false; }
      for (var i = 0; i < words.length; i++) {
        if (c._h.indexOf(words[i]) === -1) { return false; }
      }
      return true;
    });
  }

  /* ---------- list ---------- */
  function renderList() {
    var found = matches();
    $("count").textContent = found.length + (found.length === 1 ? " formula" : " formulas");
    listEl.innerHTML = "";

    if (!found.length) {
      listEl.innerHTML = '<p class="fx-noresults">Nothing matched that. Try a simpler word, like <b>force</b>, <b>gas</b>, or <b>circle</b>.</p>';
      return;
    }

    var lastSub = null;
    found.forEach(function (c) {
      if (c.sub !== lastSub) {
        lastSub = c.sub;
        var g = document.createElement("div");
        g.className = "fx-group";
        g.textContent = labelOf(c.sub);
        listEl.appendChild(g);
      }
      var b = document.createElement("button");
      b.className = "fx-item";
      b.type = "button";
      b.setAttribute("data-id", c.id);
      if (c.id === currentId) { b.setAttribute("aria-current", "true"); }
      var t = document.createElement("b");
      t.textContent = c.t;
      var f = document.createElement("span");
      f.textContent = c.f;
      b.appendChild(t);
      b.appendChild(f);
      b.addEventListener("click", function () { select(c.id, true); });
      listEl.appendChild(b);
    });
  }

  function labelOf(id) {
    for (var i = 0; i < SUBJECTS.length; i++) { if (SUBJECTS[i].id === id) { return SUBJECTS[i].label; } }
    return id;
  }

  /* ---------- detail ---------- */
  function cardById(id) {
    for (var i = 0; i < FORMULAS.length; i++) { if (FORMULAS[i].id === id) { return FORMULAS[i]; } }
    return null;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text !== undefined) { n.textContent = text; }
    return n;
  }

  function section(title) {
    var s = el("div", "fx-sec");
    s.appendChild(el("h2", null, title));
    return s;
  }

  function renderDetail(c) {
    if (VIZ) { VIZ.stop(); }
    detailEl.innerHTML = "";
    detailEl.style.setProperty("--sub-color", "var(--s-" + c.sub + ")");

    var tags = el("div", "fx-tagrow");
    tags.appendChild(el("span", "fx-tag", labelOf(c.sub)));
    if (c.age) { tags.appendChild(el("span", "fx-age", "ages " + c.age)); }
    detailEl.appendChild(tags);

    detailEl.appendChild(el("h1", null, c.t));
    detailEl.appendChild(el("p", "fx-lede", c.m));
    detailEl.appendChild(el("div", "fx-formula", c.f));

    if (VIZ && VIZ.has(c)) {
      var sv = section("Watch it happen");
      detailEl.appendChild(sv);
      VIZ.mount(sv, c);
    }

    if (c.solve && c.solve.length) {
      var s2 = section("Try it with numbers");
      s2.appendChild(buildCalc(c));
      detailEl.appendChild(s2);
    }

    var varKeys = Object.keys(c.vars || {});
    if (varKeys.length) {
      var s1 = section("What each part means");
      var parts = el("div", "fx-parts");
      varKeys.forEach(function (k) {
        var row = el("div", "fx-part");
        row.appendChild(el("code", null, sym(k)));
        row.appendChild(el("span", null, c.vars[k][0]));
        row.appendChild(el("span", "fx-unit", c.vars[k][1] || ""));
        parts.appendChild(row);
      });
      s1.appendChild(parts);
      detailEl.appendChild(s1);
    }

    if (c.note) {
      var s3 = section("Worth knowing");
      s3.appendChild(el("div", "fx-note", c.note));
      detailEl.appendChild(s3);
    }

    if (c.why) {
      var s4 = section("Why it matters");
      s4.appendChild(el("div", "fx-why", c.why));
      detailEl.appendChild(s4);
    }
  }

  function buildCalc(c) {
    var wrap = el("div", "fx-calc");
    var active = c.ex ? c.ex.for : c.solve[0].for;

    var head = el("div", "fx-calc-head");
    var lab = el("label", null, "Work out");
    lab.htmlFor = "solvefor";
    head.appendChild(lab);

    var sel = document.createElement("select");
    sel.id = "solvefor";
    c.solve.forEach(function (s) {
      var o = document.createElement("option");
      o.value = s.for;
      o.textContent = sym(s.for) + " — " + ((c.vars[s.for] && c.vars[s.for][0]) || s.for);
      sel.appendChild(o);
    });
    sel.value = active;
    if (c.solve.length < 2) { sel.disabled = true; }
    head.appendChild(sel);
    wrap.appendChild(head);

    var inputs = el("div", "fx-inputs");
    var result = el("div", "fx-result");
    wrap.appendChild(inputs);
    wrap.appendChild(result);

    function entryFor(name) {
      for (var i = 0; i < c.solve.length; i++) { if (c.solve[i].for === name) { return c.solve[i]; } }
      return c.solve[0];
    }

    function compute() {
      var entry = entryFor(sel.value);
      var vals = {};
      var ready = true;
      entry.needs.forEach(function (k) {
        var box = inputs.querySelector('[data-k="' + k + '"]');
        var raw = box ? box.value.trim() : "";
        if (raw === "" || isNaN(parseFloat(raw))) { ready = false; }
        vals[k] = parseFloat(raw);
      });
      result.innerHTML = "";
      var v = c.vars[entry.for] || [entry.for, ""];
      if (VIZ && ready) { VIZ.update(vals, entry.fn(vals), entry.for); }
      if (!ready) {
        result.appendChild(el("span", "fx-lab", "Fill in the boxes above to get an answer."));
        return;
      }
      var out = entry.fn(vals);
      result.appendChild(el("span", "fx-lab", sym(entry.for) + " ="));
      result.appendChild(el("span", "fx-val", fmt(out) + (v[1] ? " " + v[1] : "")));
      if (!isFinite(out)) {
        result.appendChild(el("span", "fx-lab", "That combination does not give a real answer — check for a zero or a negative where there should not be one."));
      }
    }

    function buildInputs() {
      var entry = entryFor(sel.value);
      inputs.innerHTML = "";
      entry.needs.forEach(function (k) {
        var f = el("div", "fx-field");
        var l = document.createElement("label");
        l.htmlFor = "in-" + k;
        var em = el("em", null, sym(k));
        l.appendChild(em);
        l.appendChild(document.createTextNode(" · " + ((c.vars[k] && c.vars[k][0]) || k) + ((c.vars[k] && c.vars[k][1]) ? " (" + c.vars[k][1] + ")" : "")));
        var i = document.createElement("input");
        i.type = "number";
        i.id = "in-" + k;
        i.setAttribute("data-k", k);
        i.step = "any";
        if (c.ex && c.ex.for === entry.for && c.ex.vals[k] !== undefined) { i.value = c.ex.vals[k]; }
        i.addEventListener("input", compute);
        f.appendChild(l);
        f.appendChild(i);
        inputs.appendChild(f);
      });
      compute();
    }

    sel.addEventListener("change", buildInputs);
    buildInputs();

    if (c.ex && c.ex.says) {
      var note = el("div", "fx-result");
      note.style.borderTop = "1px solid var(--line)";
      var ex = el("span", "fx-lab", "");
      ex.innerHTML = "";
      var b = el("b", null, "Example: ");
      ex.appendChild(b);
      ex.appendChild(document.createTextNode(c.ex.says));
      note.appendChild(ex);
      wrap.appendChild(note);
    }

    return wrap;
  }

  /* ---------- selection + routing ---------- */
  function select(id, push) {
    var c = cardById(id);
    if (!c) { return; }
    currentId = id;
    renderDetail(c);
    renderList();
    document.body.classList.add("viewing");
    if (push && location.hash !== "#" + id) { location.hash = id; }
    if (window.innerWidth <= 880) {
      window.scrollTo(0, 0);
    } else {
      var it = listEl.querySelector('[data-id="' + id + '"]');
      if (it && it.scrollIntoView) { it.scrollIntoView({ block: "nearest" }); }
    }
  }

  window.addEventListener("hashchange", function () {
    var id = location.hash.slice(1);
    if (id && id !== currentId && cardById(id)) { select(id, false); }
  });

  /* ---------- controls ---------- */
  SUBJECTS.forEach(function (s) {
    var b = el("button", "fx-chip", s.label);
    b.type = "button";
    b.setAttribute("aria-pressed", String(s.id === "all"));
    b.addEventListener("click", function () {
      filter = s.id;
      Array.prototype.forEach.call(document.querySelectorAll(".fx-chip"), function (o) {
        o.setAttribute("aria-pressed", String(o === b));
      });
      renderList();
    });
    $("chips").appendChild(b);
  });

  qEl.addEventListener("input", renderList);

  $("random").addEventListener("click", function () {
    var pool = matches();
    if (!pool.length) { pool = FORMULAS; }
    select(pool[Math.floor(Math.random() * pool.length)].id, true);
  });

  $("back").addEventListener("click", function () {
    document.body.classList.remove("viewing");
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement !== qEl) {
      e.preventDefault();
      qEl.focus();
      qEl.select();
    }
  });

  /* ---------- start ---------- */
  renderList();
  var start = location.hash.slice(1);
  if (start && cardById(start)) {
    select(start, false);
  } else {
    currentId = FORMULAS[0].id;
    renderDetail(FORMULAS[0]);
    renderList();
    document.body.classList.remove("viewing");
  }
})();
