/* ---------------------------------------------------------------
   Animated explainers. One canvas at a time, driven live by the
   numbers the kid typed into the calculator above it.
   --------------------------------------------------------------- */
window.FormulaViz = (function () {
  "use strict";

  var VIZ_MAP = {
    speed:"motion", momentum:"motion", ke:"motion", "light-time":"motion", lightyear:"motion",
    acceleration:"push", newton2:"push", work:"push", impulse:"push",
    weight:"hang", "weight-planets":"hang",
    pe:"fall", freefall:"fall",
    hooke:"spring",
    wavespeed:"wave", period:"wave",
    ohm:"circuit", epower:"circuit", "series-r":"circuit", "parallel-r":"circuit",
    divider:"circuit", "resistive-power":"circuit",
    power:"bar", efficiency:"bar", percentyield:"bar", percentcomp:"bar",
    "percent-change":"bar", mean:"bar", probability:"bar", "safety-factor":"bar",
    "mech-advantage":"bar", pressure:"bar", "compound-interest":"bar",
    idealgas:"gas", boyle:"gas", charles:"gas", gaylussac:"gas", combinedgas:"gas", molarvolume:"gas",
    moles:"liquid", particles:"liquid", molarity:"liquid", dilution:"liquid", ph:"liquid", poh:"liquid",
    combustion:"react", neutralization:"react", photosynthesis:"react", rusting:"react",
    "area-rect":"shape", "area-tri":"shape", "area-circle":"shape", circumference:"shape",
    "vol-box":"shape", "vol-cyl":"shape", "vol-sphere":"shape", "vol-cone":"shape",
    "sa-sphere":"shape", pythagoras:"shape", distance:"shape", slope:"shape",
    quadratic:"shape", radians:"shape",
    lever:"lever", pulley:"lever",
    torque:"turn",
    ramp:"ramp",
    "gear-ratio":"gears", "gear-speed":"gears", "wheel-speed":"gears",
    stress:"beam", strain:"beam", youngs:"beam", "beam-moment":"beam",
    "second-moment":"beam", "beam-deflection":"beam",
    projectile:"arc",
    centripetal:"orbit", gravitation:"orbit", kepler:"orbit", "escape-velocity":"orbit",
    density:"float", buoyancy:"float",
    heat:"heat", "thermal-expansion":"heat",
    flow:"pipe"
  };

  var REACTIONS = {
    combustion:      { in:["CH₄","O₂","O₂"], out:["CO₂","H₂O","H₂O"], label:"burning methane" },
    neutralization:  { in:["HCl","NaOH"],    out:["NaCl","H₂O"],      label:"acid meets base" },
    photosynthesis:  { in:["CO₂","H₂O","☀"], out:["sugar","O₂"],      label:"a leaf making food" },
    rusting:         { in:["Fe","O₂"],       out:["Fe₂O₃"],           label:"iron turning to rust" }
  };

  var canvas, ctx, raf = null, card = null, dpr = 1;
  var vals = {}, t0 = 0, reduced = false;

  try { reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  function C() {
    var cs = getComputedStyle(document.documentElement);
    function v(n) { return cs.getPropertyValue(n).trim(); }
    return { ink:v("--ink"), soft:v("--ink-soft"), cool:v("--cool"), hot:v("--hot"),
             good:v("--good"), line:v("--line-strong"), surf:v("--surface-2"), sheet:v("--surface") };
  }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function norm(v, typ) { v = Math.abs(v); if (!isFinite(v) || v === 0) { return 1; } return clamp(v / typ, 0.25, 2.6); }
  function g(k, d) { var v = vals[k]; return (typeof v === "number" && isFinite(v)) ? v : d; }

  function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
  }
  function arrow(c, x1, y1, x2, y2, col, wd) {
    var a = Math.atan2(y2 - y1, x2 - x1), h = 8;
    c.strokeStyle = col; c.fillStyle = col; c.lineWidth = wd || 3;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    c.beginPath(); c.moveTo(x2, y2);
    c.lineTo(x2 - h * Math.cos(a - 0.4), y2 - h * Math.sin(a - 0.4));
    c.lineTo(x2 - h * Math.cos(a + 0.4), y2 - h * Math.sin(a + 0.4));
    c.closePath(); c.fill();
  }
  function txt(c, s, x, y, size, col, align, bold) {
    c.font = (bold ? "700 " : "500 ") + size + 'px "JetBrains Mono", ui-monospace, monospace';
    c.fillStyle = col; c.textAlign = align || "left"; c.textBaseline = "alphabetic";
    c.fillText(s, x, y);
  }
  function fmtn(n) {
    if (!isFinite(n)) { return "—"; }
    var a = Math.abs(n);
    if (a !== 0 && (a >= 1e5 || a < 1e-3)) { return n.toExponential(1); }
    return String(Number(n.toPrecision(4)));
  }
  function caption(c, W, H, s, col) { txt(c, s, W / 2, H - 10, 12, col, "center"); }

  /* ================= renderers ================= */
  var R = {};

  R.motion = function (c, W, H, t, k) {
    var y = H - 58, v = g("v", g("out", 10));
    c.strokeStyle = k.line; c.lineWidth = 2;
    c.beginPath(); c.moveTo(20, y + 22); c.lineTo(W - 20, y + 22); c.stroke();
    var sp = 55 * norm(v, card.id === "light-time" || card.id === "lightyear" ? 3e8 : 12);
    var x = 34 + ((t * sp) % (W - 90));
    for (var i = 1; i <= 3; i++) {
      c.strokeStyle = k.soft; c.globalAlpha = 0.35 / i; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x - 12 - i * 13, y + 6); c.lineTo(x - 2 - i * 13, y + 6); c.stroke();
    }
    c.globalAlpha = 1;
    c.fillStyle = k.hot; rr(c, x, y - 12, 32, 24, 5); c.fill();
    var m = g("m", 0);
    if (card.id === "ke") {
      var e = clamp((v * v) / (40 * 40), 0, 1);
      c.fillStyle = k.surf; rr(c, 20, 22, W - 40, 14, 7); c.fill();
      c.fillStyle = k.good; rr(c, 20, 22, Math.max(6, (W - 40) * e), 14, 7); c.fill();
      txt(c, "energy grows with v × v", 20, 16, 11, k.soft);
    } else if (m) {
      txt(c, "mass " + fmtn(m), 20, 26, 12, k.soft);
    }
    caption(c, W, H, "speed = " + fmtn(v), k.ink);
  };

  R.push = function (c, W, H, t, k) {
    var a = g("a", 3), F = g("F", g("out", 0)), y = H - 62;
    var per = 2.6, tau = t % per;
    var ax = 34 * norm(a, 3);
    var x = 40 + 0.5 * ax * tau * tau;
    if (x > W - 90) { x = W - 90; }
    c.strokeStyle = k.line; c.lineWidth = 2;
    c.beginPath(); c.moveTo(20, y + 26); c.lineTo(W - 20, y + 26); c.stroke();
    c.fillStyle = k.cool; rr(c, x, y - 14, 40, 40, 6); c.fill();
    arrow(c, x - 34, y + 6, x - 6, y + 6, k.hot, 4);
    txt(c, "F", x - 24, y - 2, 13, k.hot, "left", true);
    caption(c, W, H, (F ? "force " + fmtn(F) + "  ·  " : "") + "acceleration " + fmtn(a), k.ink);
  };

  R.hang = function (c, W, H, t, k) {
    var m = g("m", 40), gr = g("g", 9.8), W2 = g("W", g("out", m * gr));
    var cx = W / 2, top = 26, len = clamp(30 + gr * 7, 30, H - 110);
    var bob = Math.sin(t * 2) * 2;
    c.strokeStyle = k.line; c.lineWidth = 3;
    c.beginPath(); c.moveTo(cx - 60, top); c.lineTo(cx + 60, top); c.stroke();
    c.beginPath(); c.moveTo(cx, top); c.lineTo(cx, top + len + bob); c.stroke();
    var s = clamp(20 + m * 0.5, 22, 60);
    c.fillStyle = k.cool; rr(c, cx - s / 2, top + len + bob, s, s * 0.7, 6); c.fill();
    txt(c, fmtn(m) + " kg", cx, top + len + bob + s * 0.45, 12, "#fff", "center", true);
    arrow(c, cx + s / 2 + 18, top + len + bob + 6, cx + s / 2 + 18, top + len + bob + 6 + clamp(gr * 3.2, 12, 70), k.hot, 4);
    txt(c, "gravity pulls", cx + s / 2 + 28, top + len + bob + 24, 11, k.soft);
    caption(c, W, H, "g = " + fmtn(gr) + " m/s²  →  weight " + fmtn(W2) + " N", k.ink);
  };

  R.fall = function (c, W, H, t, k) {
    var T = clamp(g("t", 3), 0.6, 6), gr = g("g", 9.8);
    var top = 26, bottom = H - 42, span = bottom - top;
    var tau = (t % (T + 0.8));
    if (tau > T) { tau = T; }
    var y = top + span * (0.5 * gr * tau * tau) / (0.5 * gr * T * T);
    var cx = W / 2;
    c.strokeStyle = k.line; c.lineWidth = 1.5; c.setLineDash([4, 5]);
    for (var s = 1; s <= Math.floor(T); s++) {
      var yy = top + span * (s * s) / (T * T);
      c.beginPath(); c.moveTo(cx - 70, yy); c.lineTo(cx + 70, yy); c.stroke();
      txt(c, s + "s", cx + 78, yy + 4, 11, k.soft);
    }
    c.setLineDash([]);
    c.strokeStyle = k.line; c.lineWidth = 3;
    c.beginPath(); c.moveTo(20, bottom + 8); c.lineTo(W - 20, bottom + 8); c.stroke();
    c.fillStyle = k.hot; c.beginPath(); c.arc(cx, y, 12, 0, 6.284); c.fill();
    caption(c, W, H, "each second it falls further than the one before", k.soft);
  };

  R.spring = function (c, W, H, t, k) {
    var x = g("x", 0.08), F = g("F", g("out", 0));
    var wall = 40, y = H / 2 - 8, len = clamp(90 + x * 900, 70, W - 150) + Math.sin(t * 4) * 3;
    c.fillStyle = k.line; c.fillRect(wall - 12, y - 40, 10, 80);
    c.strokeStyle = k.cool; c.lineWidth = 3; c.beginPath(); c.moveTo(wall, y);
    for (var i = 0; i <= 16; i++) {
      c.lineTo(wall + (len * i) / 16, y + (i % 2 ? -14 : 14));
    }
    c.lineTo(wall + len, y); c.stroke();
    c.fillStyle = k.hot; rr(c, wall + len, y - 22, 40, 44, 6); c.fill();
    arrow(c, wall + len + 48, y, wall + len + 48 + clamp(F * 1.6, 16, 90), y, k.good, 4);
    caption(c, W, H, "stretch " + fmtn(x) + " m  →  pull back " + fmtn(F) + " N", k.ink);
  };

  R.wave = function (c, W, H, t, k) {
    var f = g("f", 2), lam = g("lam", 1), v = g("v", g("out", 0));
    var mid = H / 2 - 6, A = 34, lp = clamp(70 * norm(lam, 1), 40, W / 1.3);
    c.strokeStyle = k.line; c.lineWidth = 1; c.setLineDash([3, 5]);
    c.beginPath(); c.moveTo(20, mid); c.lineTo(W - 20, mid); c.stroke(); c.setLineDash([]);
    c.strokeStyle = k.cool; c.lineWidth = 3; c.beginPath();
    for (var x = 20; x <= W - 20; x++) {
      var yy = mid + A * Math.sin((2 * Math.PI * (x - 20)) / lp - t * clamp(f / 60, 0.6, 6) * 2.4);
      if (x === 20) { c.moveTo(x, yy); } else { c.lineTo(x, yy); }
    }
    c.stroke();
    c.strokeStyle = k.hot; c.lineWidth = 2;
    c.beginPath(); c.moveTo(20, mid - A - 14); c.lineTo(20 + lp, mid - A - 14); c.stroke();
    txt(c, "one wavelength", 20 + lp / 2, mid - A - 20, 11, k.hot, "center");
    caption(c, W, H, fmtn(f) + " waves a second" + (v ? "  ·  speed " + fmtn(v) : ""), k.ink);
  };

  R.circuit = function (c, W, H, t, k) {
    var I = g("I", 0.05), V = g("V", g("Vin", 9)), R1 = g("R", g("R1", 330));
    var x0 = 46, y0 = 34, x1 = W - 46, y1 = H - 46;
    c.strokeStyle = k.line; c.lineWidth = 4;
    rr(c, x0, y0, x1 - x0, y1 - y0, 14); c.stroke();
    c.fillStyle = k.sheet; c.fillRect(x0 - 8, (y0 + y1) / 2 - 22, 16, 44);
    c.strokeStyle = k.ink; c.lineWidth = 3;
    c.beginPath(); c.moveTo(x0 - 8, (y0 + y1) / 2 - 14); c.lineTo(x0 + 8, (y0 + y1) / 2 - 14);
    c.moveTo(x0 - 4, (y0 + y1) / 2 + 6); c.lineTo(x0 + 4, (y0 + y1) / 2 + 6); c.stroke();
    txt(c, fmtn(V) + "V", x0 - 14, (y0 + y1) / 2 + 30, 11, k.soft, "center");
    var rx = (x0 + x1) / 2 - 26;
    c.fillStyle = k.sheet; c.fillRect(rx - 4, y0 - 9, 60, 18);
    c.strokeStyle = k.hot; c.lineWidth = 3; c.beginPath(); c.moveTo(rx, y0);
    for (var i = 0; i < 6; i++) { c.lineTo(rx + 4 + i * 8, y0 + (i % 2 ? 8 : -8)); }
    c.lineTo(rx + 52, y0); c.stroke();
    txt(c, fmtn(R1) + "Ω", rx + 26, y0 - 14, 11, k.soft, "center");
    var per = 2 * ((x1 - x0) + (y1 - y0)), n = 16, sp = clamp(I * 900, 18, 170);
    for (var j = 0; j < n; j++) {
      var p = ((t * sp + (j * per) / n) % per), px, py;
      if (p < x1 - x0) { px = x0 + p; py = y0; }
      else if (p < (x1 - x0) + (y1 - y0)) { px = x1; py = y0 + (p - (x1 - x0)); }
      else if (p < 2 * (x1 - x0) + (y1 - y0)) { px = x1 - (p - (x1 - x0) - (y1 - y0)); py = y1; }
      else { px = x0; py = y1 - (p - 2 * (x1 - x0) - (y1 - y0)); }
      c.fillStyle = k.cool; c.beginPath(); c.arc(px, py, 4, 0, 6.284); c.fill();
    }
    caption(c, W, H, "current " + fmtn(I) + " A — more push or less resistance moves them faster", k.ink);
  };

  var particles = null;
  R.gas = function (c, W, H, t, k) {
    var V = g("V", g("V1", 22.4)), T = g("T", g("T1", 293)), P = g("P", g("P2", g("out", 101)));
    var bw = clamp(150 * norm(V, 22.4), 90, W - 130), bh = H - 96;
    var bx = 30, by = 34;
    if (!particles) {
      particles = [];
      for (var i = 0; i < 20; i++) { particles.push({ x: Math.random(), y: Math.random(), dx: Math.random() * 2 - 1, dy: Math.random() * 2 - 1 }); }
    }
    c.strokeStyle = k.line; c.lineWidth = 3; rr(c, bx, by, bw, bh, 8); c.stroke();
    var sp = clamp(Math.sqrt(T / 293), 0.4, 2.2) * 0.6;
    particles.forEach(function (p) {
      p.x += p.dx * sp * 0.012; p.y += p.dy * sp * 0.012;
      if (p.x < 0.02 || p.x > 0.98) { p.dx *= -1; p.x = clamp(p.x, 0.02, 0.98); }
      if (p.y < 0.02 || p.y > 0.98) { p.dy *= -1; p.y = clamp(p.y, 0.02, 0.98); }
      c.fillStyle = k.cool;
      c.beginPath(); c.arc(bx + p.x * bw, by + p.y * bh, 4.5, 0, 6.284); c.fill();
    });
    var gx = bx + bw + 26;
    txt(c, "pressure", gx, by + 12, 11, k.soft);
    c.fillStyle = k.surf; rr(c, gx, by + 20, 20, bh - 20, 8); c.fill();
    var ph = (bh - 20) * clamp(P / 250, 0.05, 1);
    c.fillStyle = k.hot; rr(c, gx, by + 20 + (bh - 20 - ph), 20, ph, 8); c.fill();
    caption(c, W, H, "smaller box or hotter gas = harder hits on the walls", k.soft);
  };

  R.liquid = function (c, W, H, t, k) {
    var id = card.id;
    var bx = W / 2 - 60, by = 30, bw = 120, bh = H - 84;
    var fill = 0.72, col = k.cool, note = "";
    if (id === "ph" || id === "poh") {
      var p = clamp(g("pH", g("out", 7)), 0, 14);
      var stops = [[0, 0], [3, 24], [5, 52], [7, 120], [9, 178], [11, 218], [14, 285]];
      var hue = 120;
      for (var si = 0; si < stops.length - 1; si++) {
        if (p >= stops[si][0] && p <= stops[si + 1][0]) {
          var f2 = (p - stops[si][0]) / (stops[si + 1][0] - stops[si][0]);
          hue = stops[si][1] + f2 * (stops[si + 1][1] - stops[si][1]);
          break;
        }
      }
      col = "hsl(" + hue + ",72%,48%)";
      note = "pH " + fmtn(p) + " — red is acid, green is neutral, purple is basic";
    } else {
      var conc = g("c", g("C1", g("n", 1)));
      fill = clamp(0.3 + norm(conc, 1) * 0.25, 0.25, 0.9);
      note = "more dissolved = deeper colour";
    }
    c.strokeStyle = k.line; c.lineWidth = 3;
    c.beginPath(); c.moveTo(bx, by); c.lineTo(bx, by + bh); c.lineTo(bx + bw, by + bh); c.lineTo(bx + bw, by); c.stroke();
    var top = by + bh - bh * fill;
    c.fillStyle = col; c.globalAlpha = 0.85;
    c.beginPath(); c.moveTo(bx + 2, top);
    for (var x = 0; x <= bw - 4; x++) { c.lineTo(bx + 2 + x, top + Math.sin(x / 18 + t * 2) * 3); }
    c.lineTo(bx + bw - 2, by + bh - 2); c.lineTo(bx + 2, by + bh - 2); c.closePath(); c.fill();
    c.globalAlpha = 1;
    var dots = clamp(Math.round(norm(g("n", g("c", 1)), 1) * 9), 3, 26);
    for (var i = 0; i < dots; i++) {
      var px = bx + 12 + ((i * 37) % (bw - 24));
      var py = top + 16 + ((i * 53) % (bh * fill - 26)) + Math.sin(t * 1.6 + i) * 3;
      c.fillStyle = k.sheet; c.globalAlpha = 0.75;
      c.beginPath(); c.arc(px, py, 3.5, 0, 6.284); c.fill();
    }
    c.globalAlpha = 1;
    caption(c, W, H, note, k.ink);
  };

  R.react = function (c, W, H, t, k) {
    var r = REACTIONS[card.id];
    if (!r) { return; }
    var per = 4, tau = (t % per) / per, y = H / 2 - 4;
    var mid = W / 2, phase = tau < 0.45 ? tau / 0.45 : 1;
    function pill(s, x, col) {
      c.font = '700 13px "JetBrains Mono", monospace';
      var w = c.measureText(s).width + 22;
      c.fillStyle = col; rr(c, x - w / 2, y - 16, w, 32, 16); c.fill();
      txt(c, s, x, y + 5, 13, "#fff", "center", true);
    }
    if (tau < 0.55) {
      var n = r.in.length, gap = Math.min(96, (W - 120) / n);
      r.in.forEach(function (s, i) {
        var start = mid - ((n - 1) / 2) * gap * 1.9 + i * gap * 1.9;
        var end = mid - ((n - 1) / 2) * 30 + i * 30;
        pill(s, start + (end - start) * phase, k.cool);
      });
    } else {
      var out = (tau - 0.55) / 0.45, no = r.out.length, gap2 = Math.min(104, (W - 120) / no);
      r.out.forEach(function (s, i) {
        var end2 = mid - ((no - 1) / 2) * gap2 * 1.9 + i * gap2 * 1.9;
        pill(s, mid + (end2 - mid) * out, k.good);
      });
    }
    arrow(c, mid - 20, y - 46, mid + 20, y - 46, k.hot, 3);
    txt(c, r.label, mid, y - 56, 11, k.soft, "center");
    caption(c, W, H, "the same atoms, rearranged into something new", k.soft);
  };

  R.bar = function (c, W, H, t, k) {
    var id = card.id, pct = 0, la = "", lb = "";
    var out = g("out", 0);
    if (id === "efficiency") { pct = clamp(out / 100, 0, 1); la = "useful"; lb = "wasted as heat"; }
    else if (id === "percentyield") { pct = clamp(out / 100, 0, 1); la = "you got"; lb = "lost in the process"; }
    else if (id === "percentcomp") { pct = clamp(out / 100, 0, 1); la = "this element"; lb = "everything else"; }
    else if (id === "probability") { pct = clamp(out, 0, 1); la = "it happens"; lb = "it does not"; }
    else if (id === "safety-factor") { pct = clamp(1 / Math.max(out, 1), 0, 1); la = "actually used"; lb = "spare strength"; }
    else if (id === "mech-advantage") { pct = clamp(1 / Math.max(out, 1), 0, 1); la = "your effort"; lb = "the machine's help"; }
    else if (id === "percent-change") { pct = clamp(Math.abs(out) / 100, 0, 1); la = (out >= 0 ? "grew by" : "fell by") + " " + fmtn(Math.abs(out)) + "%"; lb = ""; }
    else { pct = clamp(norm(out, out || 1) / 2.6, 0.08, 1); la = fmtn(out); lb = ""; }
    var bw = W - 60, bx = 30, by = H / 2 - 26, bh = 46;
    var animated = reduced ? pct : pct * clamp(t / 0.7, 0, 1);
    c.fillStyle = k.surf; rr(c, bx, by, bw, bh, 10); c.fill();
    c.fillStyle = k.good; rr(c, bx, by, Math.max(8, bw * animated), bh, 10); c.fill();
    txt(c, la, bx + 14, by + 29, 13, "#fff", "left", true);
    if (lb) { txt(c, lb, bx + bw - 14, by + 29, 12, k.soft, "right"); }
    txt(c, "0", bx, by + bh + 18, 11, k.soft);
    txt(c, id === "probability" ? "1" : "100%", bx + bw, by + bh + 18, 11, k.soft, "right");
    caption(c, W, H, "the bar moves as you change the numbers", k.soft);
  };

  R.gears = function (c, W, H, t, k) {
    var dr = g("driver", 10), dn = g("driven", 40);
    if (card.id === "wheel-speed") { dr = 1; dn = 1; }
    var r1 = clamp(24 * Math.sqrt(dr / 10), 18, 52), r2 = clamp(24 * Math.sqrt(dn / 10), 18, 66);
    var cy = H / 2 - 6, c1x = W / 2 - r1 - 6, c2x = W / 2 + r2 + 6;
    var a1 = t * 1.3, a2 = -a1 * (dr / dn);
    function gear(x, r, a, col, teeth) {
      c.save(); c.translate(x, cy); c.rotate(a);
      c.fillStyle = col;
      for (var i = 0; i < teeth; i++) {
        c.save(); c.rotate((i / teeth) * 6.2832);
        c.fillRect(-4, -r - 7, 8, 9); c.restore();
      }
      c.beginPath(); c.arc(0, 0, r, 0, 6.284); c.fill();
      c.fillStyle = k.sheet; c.beginPath(); c.arc(0, 0, r * 0.3, 0, 6.284); c.fill();
      c.strokeStyle = k.sheet; c.lineWidth = 3;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -r * 0.75); c.stroke();
      c.restore();
    }
    gear(c1x, r1, a1, k.hot, Math.max(6, Math.min(16, Math.round(dr))));
    gear(c2x, r2, a2, k.cool, Math.max(6, Math.min(22, Math.round(dn))));
    txt(c, "driver", c1x, cy + r1 + 24, 11, k.soft, "center");
    txt(c, "driven", c2x, cy + r2 + 24, 11, k.soft, "center");
    caption(c, W, H, "the big gear turns slower — and pushes harder", k.ink);
  };

  R.beam = function (c, W, H, t, k) {
    var sag = 26;
    if (card.id === "beam-deflection") { sag = clamp(g("out", 0.02) * 900, 4, 52); }
    else if (card.id === "second-moment") { sag = clamp(30 / Math.max(norm(g("h", 0.2), 0.2), 0.3), 5, 50); }
    else if (card.id === "strain") { sag = clamp(g("out", 0.001) * 9000, 4, 50); }
    var wob = reduced ? 1 : 1 + Math.sin(t * 2.4) * 0.12;
    sag *= wob;
    var x0 = 46, x1 = W - 46, y = H / 2 + 4;
    c.strokeStyle = k.line; c.lineWidth = 3;
    [x0, x1].forEach(function (x) {
      c.beginPath(); c.moveTo(x - 14, y + 34); c.lineTo(x, y + 6); c.lineTo(x + 14, y + 34); c.closePath(); c.stroke();
    });
    c.strokeStyle = k.cool; c.lineWidth = 9; c.lineCap = "round";
    c.beginPath(); c.moveTo(x0, y);
    c.quadraticCurveTo((x0 + x1) / 2, y + sag * 2, x1, y); c.stroke();
    c.lineCap = "butt";
    arrow(c, W / 2, y - 52, W / 2, y + sag - 8, k.hot, 4);
    txt(c, "load", W / 2 + 10, y - 40, 12, k.hot);
    c.strokeStyle = k.line; c.lineWidth = 1; c.setLineDash([4, 4]);
    c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke(); c.setLineDash([]);
    caption(c, W, H, "longer span or thinner beam = more sag", k.soft);
  };

  R.lever = function (c, W, H, t, k) {
    var F1 = g("F1", g("effort", g("out", 100))), d1 = g("d1", 2);
    var F2 = g("F2", g("load", 500)), d2 = g("d2", 0.4);
    if (card.id === "pulley") { F1 = g("effort", g("out", 200)); F2 = g("load", 800); d1 = 1; d2 = 1; }
    var diff = (F2 * d2 - F1 * d1) / Math.max(F1 * d1, F2 * d2, 1);
    var ang = clamp(diff, -1, 1) * 0.2 * (reduced ? 1 : 1 + Math.sin(t * 2) * 0.08);
    var px = W / 2, py = H / 2 + 22, L = Math.min(W / 2 - 40, 190);
    c.save(); c.translate(px, py); c.rotate(ang);
    c.fillStyle = k.line; rr(c, -L, -5, L * 2, 10, 5); c.fill();
    function w(x, force, col) {
      var s = clamp(16 + Math.sqrt(Math.abs(force)) * 1.6, 18, 54);
      c.fillStyle = col; rr(c, x - s / 2, -5 - s, s, s, 5); c.fill();
      txt(c, fmtn(force) + "N", x, -12 - s, 11, k.ink, "center");
    }
    var sc = L / Math.max(d1, d2, 0.1);
    w(-clamp(d1 * sc, 30, L), F1, k.cool);
    w(clamp(d2 * sc, 30, L), F2, k.hot);
    c.restore();
    c.fillStyle = k.soft;
    c.beginPath(); c.moveTo(px - 18, py + 34); c.lineTo(px, py + 2); c.lineTo(px + 18, py + 34); c.closePath(); c.fill();
    caption(c, W, H, "small force far out balances a big force close in", k.ink);
  };

  R.turn = function (c, W, H, t, k) {
    var F = g("F", 200), r = g("r", 0.25), tq = g("tau", g("out", 0));
    var cx = W / 2 - 40, cy = H / 2, len = clamp(60 + r * 260, 60, W / 2 - 20);
    var a = Math.sin(t * 1.4) * 0.28;
    c.save(); c.translate(cx, cy); c.rotate(a);
    c.fillStyle = k.line; rr(c, -10, -9, len, 18, 6); c.fill();
    c.fillStyle = k.hot; c.beginPath(); c.arc(0, 0, 15, 0, 6.284); c.fill();
    c.fillStyle = k.sheet; c.beginPath(); c.arc(0, 0, 6, 0, 6.284); c.fill();
    arrow(c, len - 4, -22, len - 4, -22 + clamp(F / 6, 16, 60), k.good, 4);
    c.restore();
    txt(c, "r = " + fmtn(r) + " m", cx + len / 2, cy + 34, 11, k.soft, "center");
    caption(c, W, H, "same push, longer handle, more turning power (" + fmtn(tq) + " N·m)", k.ink);
  };

  R.ramp = function (c, W, H, t, k) {
    var L = g("L", 6), h = g("h", 1);
    var x0 = 40, x1 = W - 40, base = H - 46;
    var rise = clamp((h / Math.max(L, 0.1)) * (x1 - x0), 22, H - 100);
    c.fillStyle = k.surf;
    c.beginPath(); c.moveTo(x0, base); c.lineTo(x1, base); c.lineTo(x1, base - rise); c.closePath(); c.fill();
    c.strokeStyle = k.line; c.lineWidth = 3; c.stroke();
    var p = (t % 3) / 3;
    var bx = x0 + (x1 - x0) * p, by = base - rise * p;
    c.save(); c.translate(bx, by); c.rotate(-Math.atan2(rise, x1 - x0));
    c.fillStyle = k.hot; rr(c, -16, -30, 32, 30, 5); c.fill();
    c.restore();
    txt(c, "height " + fmtn(h) + " m", x1 - 8, base - rise / 2, 11, k.soft, "right");
    caption(c, W, H, "a longer, gentler ramp needs less force", k.ink);
  };

  R.arc = function (c, W, H, t, k) {
    var v = g("v", 20), th = g("th", 45), gr = g("g", 9.8);
    var Rm = (v * v * Math.sin((2 * th * Math.PI) / 180)) / gr;
    var base = H - 42, x0 = 34, span = W - 80;
    var rad = (th * Math.PI) / 180;
    var flight = Rm > 0 ? Rm : 1;
    c.strokeStyle = k.line; c.lineWidth = 2;
    c.beginPath(); c.moveTo(20, base); c.lineTo(W - 20, base); c.stroke();
    var peak = clamp((Math.pow(v * Math.sin(rad), 2) / (2 * gr)) / Math.max(flight, 0.1) * span, 10, H - 90);
    c.strokeStyle = k.line; c.setLineDash([4, 5]); c.lineWidth = 2; c.beginPath();
    for (var i = 0; i <= 60; i++) {
      var u = i / 60, xx = x0 + span * u, yy = base - 4 * peak * u * (1 - u);
      if (i === 0) { c.moveTo(xx, yy); } else { c.lineTo(xx, yy); }
    }
    c.stroke(); c.setLineDash([]);
    var p = (t % 2.4) / 2.4;
    c.fillStyle = k.hot;
    c.beginPath(); c.arc(x0 + span * p, base - 4 * peak * p * (1 - p), 8, 0, 6.284); c.fill();
    c.strokeStyle = k.cool; c.lineWidth = 4;
    c.beginPath(); c.moveTo(x0, base); c.lineTo(x0 + 34 * Math.cos(rad), base - 34 * Math.sin(rad)); c.stroke();
    txt(c, fmtn(th) + "°", x0 + 40, base - 8, 11, k.cool);
    txt(c, "lands at " + fmtn(Rm) + " m", x0 + span, base + 18, 11, k.soft, "right");
    caption(c, W, H, "45° throws the furthest — try changing the angle", k.ink);
  };

  R.orbit = function (c, W, H, t, k) {
    var r = g("r", 1.2), v = g("v", 6);
    var cx = W / 2, cy = H / 2 - 4;
    var rp = clamp(50 * norm(r, card.id === "gravitation" || card.id === "escape-velocity" ? 6.4e6 : (card.id === "kepler" ? 1 : 1.2)), 34, Math.min(H / 2 - 22, 96));
    if (card.id === "kepler") { rp = clamp(30 * g("a", 1), 34, Math.min(H / 2 - 22, 100)); }
    c.strokeStyle = k.line; c.lineWidth = 1.5; c.setLineDash([3, 5]);
    c.beginPath(); c.arc(cx, cy, rp, 0, 6.284); c.stroke(); c.setLineDash([]);
    c.fillStyle = k.hot; c.beginPath(); c.arc(cx, cy, 18, 0, 6.284); c.fill();
    var w = clamp(v / Math.max(r, 0.1) / 4, 0.25, 2.4);
    if (card.id === "kepler") { w = clamp(1.6 / Math.pow(g("a", 1), 1.5), 0.15, 2.4); }
    var a = t * w, ox = cx + rp * Math.cos(a), oy = cy + rp * Math.sin(a);
    c.fillStyle = k.cool; c.beginPath(); c.arc(ox, oy, 9, 0, 6.284); c.fill();
    arrow(c, ox, oy, ox + (cx - ox) * 0.34, oy + (cy - oy) * 0.34, k.good, 3);
    txt(c, "pulled inward", ox + 12, oy - 12, 11, k.soft);
    caption(c, W, H, card.id === "kepler" ? "further out means a much longer year" : "without that inward pull it would fly off straight", k.ink);
  };

  R.float = function (c, W, H, t, k) {
    var rho = g("rho", g("out", 700));
    if (card.id === "buoyancy") { rho = 700; }
    var waterTop = H / 2 - 6, bx = W / 2 - 44, s = 78;
    var sink = clamp(rho / 1000, 0.05, 1.3);
    var bob = reduced ? 0 : Math.sin(t * 1.6) * 3;
    c.fillStyle = k.cool; c.globalAlpha = 0.22;
    c.fillRect(24, waterTop, W - 48, H - waterTop - 34); c.globalAlpha = 1;
    c.strokeStyle = k.cool; c.lineWidth = 2; c.beginPath();
    for (var x = 24; x <= W - 24; x++) { c.lineTo(x, waterTop + Math.sin(x / 22 + t * 1.6) * 2.5); }
    c.stroke();
    var top = waterTop - s * (1 - clamp(sink, 0, 1)) + bob;
    if (sink > 1) { top = H - 70 + bob; }
    c.fillStyle = k.hot; rr(c, bx, top, s, s * 0.72, 6); c.fill();
    arrow(c, bx + s + 18, top + 78, bx + s + 18, top + 10, k.good, 4);
    txt(c, "push up", bx + s + 28, top + 46, 11, k.soft);
    caption(c, W, H, sink >= 1 ? "denser than water — it sinks" : "less dense than water — it floats", k.ink);
  };

  R.heat = function (c, W, H, t, k) {
    var dT = g("dT", 40);
    var lvl = clamp(dT / 100, 0.05, 1);
    var tx = 46, ty = 30, th2 = H - 84;
    c.strokeStyle = k.line; c.lineWidth = 3;
    rr(c, tx, ty, 22, th2, 11); c.stroke();
    c.fillStyle = k.hot; rr(c, tx + 4, ty + th2 - (th2 - 8) * lvl - 4, 14, (th2 - 8) * lvl, 7); c.fill();
    c.beginPath(); c.arc(tx + 11, ty + th2 + 2, 13, 0, 6.284); c.fill();
    var bx = tx + 70, bw = W - bx - 34, bh = th2;
    c.strokeStyle = k.line; c.lineWidth = 2; rr(c, bx, ty, bw, bh, 8); c.stroke();
    for (var i = 0; i < 24; i++) {
      var jx = bx + 14 + ((i * 61) % (bw - 28)) + Math.sin(t * (2 + lvl * 8) + i) * (2 + lvl * 7);
      var jy = ty + 14 + ((i * 43) % (bh - 28)) + Math.cos(t * (2 + lvl * 8) + i * 1.7) * (2 + lvl * 7);
      c.fillStyle = k.cool; c.beginPath(); c.arc(jx, jy, 4, 0, 6.284); c.fill();
    }
    caption(c, W, H, "hotter means the particles jiggle harder (ΔT = " + fmtn(dT) + ")", k.ink);
  };

  R.pipe = function (c, W, H, t, k) {
    var A = g("A", 0.0005), v = g("v", 2);
    var ph = clamp(120 * norm(A, 0.0005) * 0.5, 26, H - 90);
    var y = H / 2 - 6;
    c.strokeStyle = k.line; c.lineWidth = 3;
    c.beginPath(); c.moveTo(24, y - ph / 2); c.lineTo(W - 24, y - ph / 2);
    c.moveTo(24, y + ph / 2); c.lineTo(W - 24, y + ph / 2); c.stroke();
    for (var i = 0; i < 22; i++) {
      var p = ((t * clamp(v * 40, 20, 220) + i * 40) % (W - 60));
      c.fillStyle = k.cool; c.globalAlpha = 0.8;
      c.beginPath(); c.arc(30 + p, y - ph / 2 + 8 + ((i * 29) % Math.max(ph - 16, 1)), 4, 0, 6.284); c.fill();
    }
    c.globalAlpha = 1;
    caption(c, W, H, "narrow the pipe and the water has to speed up", k.ink);
  };

  R.shape = function (c, W, H, t, k) {
    var id = card.id, cx = W / 2, cy = H / 2 - 6;
    var sweep = reduced ? 1 : clamp((t % 3) / 2, 0, 1);
    c.lineWidth = 3;
    function fillNote(s) { caption(c, W, H, s, k.ink); }

    if (id === "area-rect" || id === "vol-box") {
      var w = clamp(g("w", g("l", 4)) * 24, 60, W - 120), h = clamp(g("h", 2.5) * 24, 40, H - 90);
      c.strokeStyle = k.cool; c.strokeRect(cx - w / 2, cy - h / 2, w, h);
      c.fillStyle = k.cool; c.globalAlpha = 0.25;
      c.fillRect(cx - w / 2, cy - h / 2, w * sweep, h); c.globalAlpha = 1;
      if (id === "vol-box") {
        var d = 26;
        c.strokeStyle = k.line;
        c.beginPath();
        c.moveTo(cx - w / 2, cy - h / 2); c.lineTo(cx - w / 2 + d, cy - h / 2 - d);
        c.lineTo(cx + w / 2 + d, cy - h / 2 - d); c.lineTo(cx + w / 2, cy - h / 2);
        c.moveTo(cx + w / 2 + d, cy - h / 2 - d); c.lineTo(cx + w / 2 + d, cy + h / 2 - d);
        c.lineTo(cx + w / 2, cy + h / 2); c.stroke();
      }
      fillNote("area fills row by row — that is what multiplying does");
    } else if (id === "area-tri") {
      var b = clamp(g("b", 6) * 22, 60, W - 120), h2 = clamp(g("h", 4) * 22, 40, H - 90);
      c.strokeStyle = k.line; c.setLineDash([4, 4]);
      c.strokeRect(cx - b / 2, cy - h2 / 2, b, h2); c.setLineDash([]);
      c.fillStyle = k.cool; c.globalAlpha = 0.3;
      c.beginPath(); c.moveTo(cx - b / 2, cy + h2 / 2); c.lineTo(cx + b / 2, cy + h2 / 2); c.lineTo(cx - b / 2 + b * 0.4, cy - h2 / 2); c.closePath(); c.fill();
      c.globalAlpha = 1; c.strokeStyle = k.cool; c.stroke();
      fillNote("exactly half of the rectangle around it");
    } else if (id === "area-circle" || id === "circumference" || id === "vol-sphere" || id === "sa-sphere") {
      var r = clamp(g("r", 5) * 8, 34, Math.min(H / 2 - 24, 96));
      c.strokeStyle = k.cool;
      c.beginPath(); c.arc(cx, cy, r, 0, 6.284); c.stroke();
      if (id === "area-circle" || id === "vol-sphere") {
        c.fillStyle = k.cool; c.globalAlpha = 0.25;
        c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, r, -1.5708, -1.5708 + 6.284 * sweep); c.closePath(); c.fill(); c.globalAlpha = 1;
      }
      if (id === "circumference") {
        var a = t * 1.4;
        c.fillStyle = k.hot; c.beginPath(); c.arc(cx + r * Math.cos(a), cy + r * Math.sin(a), 7, 0, 6.284); c.fill();
      }
      if (id === "vol-sphere" || id === "sa-sphere") {
        c.strokeStyle = k.line; c.lineWidth = 1.5;
        c.beginPath(); c.ellipse(cx, cy, r, r * 0.32, 0, 0, 6.284); c.stroke(); c.lineWidth = 3;
      }
      arrow(c, cx, cy, cx + r, cy, k.hot, 2);
      txt(c, "r", cx + r / 2, cy - 8, 12, k.hot, "center", true);
      fillNote(id === "circumference" ? "one lap around the edge" : "double the radius, four times the area");
    } else if (id === "vol-cyl" || id === "vol-cone") {
      var rr2 = clamp(g("r", 3) * 12, 26, 80), hh = clamp(g("h", 10) * 9, 50, H - 80);
      var top2 = cy - hh / 2;
      c.strokeStyle = k.cool;
      if (id === "vol-cyl") {
        c.beginPath(); c.ellipse(cx, top2, rr2, rr2 * 0.3, 0, 0, 6.284); c.stroke();
        c.beginPath(); c.moveTo(cx - rr2, top2); c.lineTo(cx - rr2, top2 + hh);
        c.moveTo(cx + rr2, top2); c.lineTo(cx + rr2, top2 + hh); c.stroke();
        c.beginPath(); c.ellipse(cx, top2 + hh, rr2, rr2 * 0.3, 0, 0, 3.1416); c.stroke();
        c.fillStyle = k.cool; c.globalAlpha = 0.25;
        c.fillRect(cx - rr2, top2 + hh - hh * sweep, rr2 * 2, hh * sweep); c.globalAlpha = 1;
      } else {
        c.beginPath(); c.moveTo(cx, top2); c.lineTo(cx - rr2, top2 + hh); c.lineTo(cx + rr2, top2 + hh); c.closePath(); c.stroke();
        c.fillStyle = k.cool; c.globalAlpha = 0.25;
        c.beginPath(); c.moveTo(cx, top2 + hh - hh * sweep); c.lineTo(cx - rr2 * sweep, top2 + hh); c.lineTo(cx + rr2 * sweep, top2 + hh); c.closePath(); c.fill(); c.globalAlpha = 1;
      }
      fillNote(id === "vol-cone" ? "a cone holds one third of its cylinder" : "the circle, stacked all the way up");
    } else if (id === "pythagoras") {
      var A2 = clamp(g("a", 3), 0.5, 20) * 20, B2 = clamp(g("b", 4), 0.5, 20) * 20;
      var big = Math.max(A2, B2); A2 = (A2 / big) * 70; B2 = (B2 / big) * 70;
      var O = { x: 0, y: 0 }, P1 = { x: 0, y: -A2 }, P2 = { x: B2, y: 0 };
      var nx = A2, ny = -B2;
      var sq = [P1, P2, { x: P2.x + nx, y: P2.y + ny }, { x: P1.x + nx, y: P1.y + ny }];
      var pts = [O, P1, P2, { x: -A2, y: 0 }, { x: -A2, y: -A2 }, { x: B2, y: B2 }, { x: 0, y: B2 }].concat(sq);
      var minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
      pts.forEach(function (p) { minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x); miny = Math.min(miny, p.y); maxy = Math.max(maxy, p.y); });
      var sc = Math.min((W - 70) / (maxx - minx), (H - 74) / (maxy - miny));
      c.save();
      c.translate(cx - ((minx + maxx) / 2) * sc, (cy - 8) - ((miny + maxy) / 2) * sc);
      c.scale(sc, sc);
      c.lineWidth = 2.5 / sc;
      c.fillStyle = k.cool; c.globalAlpha = 0.2; c.fillRect(-A2, -A2, A2, A2); c.globalAlpha = 1;
      c.strokeStyle = k.cool; c.strokeRect(-A2, -A2, A2, A2);
      c.fillStyle = k.hot; c.globalAlpha = 0.2; c.fillRect(0, 0, B2, B2); c.globalAlpha = 1;
      c.strokeStyle = k.hot; c.strokeRect(0, 0, B2, B2);
      c.fillStyle = k.good; c.globalAlpha = 0.18;
      c.beginPath(); c.moveTo(sq[0].x, sq[0].y);
      for (var qi = 1; qi < 4; qi++) { c.lineTo(sq[qi].x, sq[qi].y); }
      c.closePath(); c.fill(); c.globalAlpha = 1;
      c.strokeStyle = k.good; c.stroke();
      c.strokeStyle = k.ink; c.lineWidth = 3.5 / sc;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(P1.x, P1.y); c.lineTo(P2.x, P2.y); c.closePath(); c.stroke();
      c.restore();
      function lab(s, p, col) {
        txt(c, s, cx - ((minx + maxx) / 2) * sc + p.x * sc, (cy - 8) - ((miny + maxy) / 2) * sc + p.y * sc + 5, 13, col, "center", true);
      }
      lab("a²", { x: -A2 / 2, y: -A2 / 2 }, k.cool);
      lab("b²", { x: B2 / 2, y: B2 / 2 }, k.hot);
      lab("c²", { x: (P1.x + P2.x) / 2 + nx / 2, y: (P1.y + P2.y) / 2 + ny / 2 }, k.good);
      fillNote("the two small squares add up to the tilted one");
    } else if (id === "slope" || id === "distance") {
      var gx = 40, gy = H - 46, gw = W - 80, gh = H - 86;
      c.strokeStyle = k.line; c.lineWidth = 1;
      for (var i2 = 0; i2 <= 6; i2++) {
        c.beginPath(); c.moveTo(gx + (gw * i2) / 6, gy - gh); c.lineTo(gx + (gw * i2) / 6, gy); c.stroke();
        c.beginPath(); c.moveTo(gx, gy - (gh * i2) / 6); c.lineTo(gx + gw, gy - (gh * i2) / 6); c.stroke();
      }
      var p1 = { x: gx + gw * 0.18, y: gy - gh * 0.2 }, p2 = { x: gx + gw * 0.78, y: gy - gh * 0.8 };
      c.strokeStyle = k.line; c.setLineDash([4, 4]); c.lineWidth = 2;
      c.beginPath(); c.moveTo(p1.x, p1.y); c.lineTo(p2.x, p1.y); c.lineTo(p2.x, p2.y); c.stroke(); c.setLineDash([]);
      c.strokeStyle = k.hot; c.lineWidth = 3;
      c.beginPath(); c.moveTo(p1.x, p1.y); c.lineTo(p2.x, p2.y); c.stroke();
      c.fillStyle = k.cool;
      c.beginPath(); c.arc(p1.x, p1.y, 6, 0, 6.284); c.fill();
      c.beginPath(); c.arc(p2.x, p2.y, 6, 0, 6.284); c.fill();
      txt(c, "across", (p1.x + p2.x) / 2, p1.y + 16, 11, k.soft, "center");
      txt(c, "up", p2.x + 8, (p1.y + p2.y) / 2, 11, k.soft);
      fillNote(id === "slope" ? "slope is just up divided by across" : "the straight line is the triangle's long side");
    } else if (id === "quadratic") {
      var A3 = g("a", 1), B3 = g("b", -5), C3 = g("c", 6);
      var gx2 = 40, gw2 = W - 80, mid = H / 2 + 20;
      c.strokeStyle = k.line; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(gx2, mid); c.lineTo(gx2 + gw2, mid); c.stroke();
      c.strokeStyle = k.cool; c.lineWidth = 3; c.beginPath();
      for (var xx2 = 0; xx2 <= 100; xx2++) {
        var xv = -2 + (xx2 / 100) * 9;
        var yv = A3 * xv * xv + B3 * xv + C3;
        var px2 = gx2 + (xx2 / 100) * gw2, py2 = mid - clamp(yv * 9, -mid + 20, H - mid - 30);
        if (xx2 === 0) { c.moveTo(px2, py2); } else { c.lineTo(px2, py2); }
      }
      c.stroke();
      fillNote("the answers are where the curve crosses the line");
    } else if (id === "radians") {
      var rr3 = Math.min(H / 2 - 28, 78), deg = g("deg", 90);
      var end = (clamp(deg, -360, 360) * Math.PI) / 180;
      c.strokeStyle = k.line; c.lineWidth = 2;
      c.beginPath(); c.arc(cx, cy, rr3, 0, 6.284); c.stroke();
      c.strokeStyle = k.cool; c.lineWidth = 5;
      c.beginPath(); c.arc(cx, cy, rr3, 0, end, end < 0); c.stroke();
      c.strokeStyle = k.hot; c.lineWidth = 3;
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + rr3, cy);
      c.moveTo(cx, cy); c.lineTo(cx + rr3 * Math.cos(end), cy + rr3 * Math.sin(end)); c.stroke();
      fillNote(fmtn(deg) + "° is " + fmtn((deg * Math.PI) / 180) + " radians — one full turn is 2π");
    }
  };

  /* ================= plumbing ================= */
  function frame(ts) {
    if (!ctx || !card) { return; }
    if (!t0) { t0 = ts; }
    var t = (ts - t0) / 1000;
    var W = canvas.clientWidth, H = canvas.clientHeight, k = C();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var fn = R[VIZ_MAP[card.id]];
    try { if (fn) { fn(ctx, W, H, t, k); } } catch (e) { /* never let a drawing bug break the page */ }
    if (!reduced) { raf = requestAnimationFrame(frame); }
  }

  function size() {
    if (!canvas) { return; }
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
  }

  window.addEventListener("resize", function () { size(); if (reduced) { t0 = 0; requestAnimationFrame(frame); } });

  return {
    has: function (c) { return !!VIZ_MAP[c.id] && !!R[VIZ_MAP[c.id]]; },
    stop: function () { if (raf) { cancelAnimationFrame(raf); raf = null; } canvas = null; ctx = null; card = null; particles = null; },
    mount: function (host, cardObj) {
      this.stop();
      card = cardObj;
      canvas = document.createElement("canvas");
      canvas.className = "fx-viz";
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", "Animated illustration of " + cardObj.t);
      host.appendChild(canvas);
      ctx = canvas.getContext("2d");
      size();
      t0 = 0;
      raf = requestAnimationFrame(frame);
    },
    update: function (v, out, forKey) {
      vals = {};
      for (var k in v) { if (Object.prototype.hasOwnProperty.call(v, k)) { vals[k] = v[k]; } }
      if (forKey) { vals[forKey] = out; }
      vals.out = out;
      if (reduced) { t0 = 0; requestAnimationFrame(frame); }
    }
  };
})();
