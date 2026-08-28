(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) { n.className = cls; } if (text !== undefined) { n.textContent = text; } return n; }
  function K() {
    var cs = getComputedStyle(document.documentElement);
    function v(n) { return cs.getPropertyValue(n).trim(); }
    return { ink:v("--ink"), soft:v("--ink-soft"), cool:v("--cool"), hot:v("--hot"), good:v("--good"),
             bad:v("--bad"), line:v("--line-strong"), surf:v("--surface-2"), sheet:v("--surface"), a:v("--a") };
  }
  function fit(cv) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(cv.clientWidth * dpr);
    cv.height = Math.round(cv.clientHeight * dpr);
    var c = cv.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, cv.clientWidth, cv.clientHeight);
    return c;
  }
  function label(c, s, x, y, size, col, align, bold) {
    c.font = (bold ? "700 " : "500 ") + size + 'px "JetBrains Mono", ui-monospace, monospace';
    c.fillStyle = col; c.textAlign = align || "left"; c.textBaseline = "alphabetic";
    c.fillText(s, x, y);
  }

  /* =====================================================
     1. TEACH THE MACHINE
     ===================================================== */
  var T = { ex: [], cur: null, tally: { agree: 0, total: 0 }, pending: null };

  function newCreature() {
    return { size: 0.15 + Math.random() * 0.8, spots: Math.floor(Math.random() * 13) };
  }

  function drawCreature() {
    var cv = $("creature"), c = fit(cv), k = K();
    var W = cv.clientWidth, H = cv.clientHeight, cr = T.cur;
    var r = 30 + cr.size * 58, cx = W / 2, cy = H / 2 - 6;
    c.fillStyle = k.cool;
    c.beginPath();
    for (var a = 0; a <= 6.2832; a += 0.05) {
      var wob = 1 + 0.07 * Math.sin(a * 5 + cr.spots);
      var x = cx + r * wob * Math.cos(a), y = cy + r * wob * 0.86 * Math.sin(a);
      if (a === 0) { c.moveTo(x, y); } else { c.lineTo(x, y); }
    }
    c.closePath(); c.fill();
    for (var i = 0; i < cr.spots; i++) {
      var ang = (i / Math.max(cr.spots, 1)) * 6.2832 + 0.6, rad = r * (0.28 + ((i * 37) % 50) / 100);
      c.fillStyle = k.sheet;
      c.beginPath(); c.arc(cx + rad * Math.cos(ang), cy + rad * 0.8 * Math.sin(ang), 5, 0, 6.2832); c.fill();
    }
    c.fillStyle = k.sheet;
    c.beginPath(); c.arc(cx - r * 0.3, cy - r * 0.3, 8, 0, 6.2832); c.fill();
    c.beginPath(); c.arc(cx + r * 0.28, cy - r * 0.32, 8, 0, 6.2832); c.fill();
    c.fillStyle = k.ink;
    c.beginPath(); c.arc(cx - r * 0.3, cy - r * 0.3, 3.5, 0, 6.2832); c.fill();
    c.beginPath(); c.arc(cx + r * 0.28, cy - r * 0.32, 3.5, 0, 6.2832); c.fill();
    label(c, "size " + Math.round(cr.size * 100) + "   spots " + cr.spots, W / 2, H - 8, 12, k.soft, "center");
  }

  function centroids() {
    var g = { zib: [0, 0, 0], zog: [0, 0, 0] };
    T.ex.forEach(function (e) {
      var t = g[e.label];
      t[0] += e.size; t[1] += e.spots / 12; t[2] += 1;
    });
    var out = {};
    ["zib", "zog"].forEach(function (n) {
      if (g[n][2] > 0) { out[n] = [g[n][0] / g[n][2], g[n][1] / g[n][2]]; }
    });
    return out;
  }

  function predict(cr) {
    var m = centroids();
    if (!m.zib || !m.zog) { return null; }
    var p = [cr.size, cr.spots / 12];
    function d(q) { return Math.sqrt(Math.pow(p[0] - q[0], 2) + Math.pow(p[1] - q[1], 2)); }
    var a = d(m.zib), b = d(m.zog);
    var pick = a < b ? "zib" : "zog";
    var conf = Math.round((Math.max(a, b) / Math.max(a + b, 0.0001)) * 100);
    return { label: pick, conf: Math.min(99, Math.max(51, conf)) };
  }

  function drawMap() {
    var cv = $("teach-map"), c = fit(cv), k = K();
    var W = cv.clientWidth, H = cv.clientHeight;
    var pad = 30, gw = W - pad * 2, gh = H - pad * 2;
    var m = centroids();
    if (m.zib && m.zog) {
      var img = c.createImageData(1, 1);
      for (var px = 0; px <= gw; px += 7) {
        for (var py = 0; py <= gh; py += 7) {
          var sx = px / gw, sy = 1 - py / gh;
          var da = Math.hypot(sx - m.zib[0], sy - m.zib[1]);
          var db = Math.hypot(sx - m.zog[0], sy - m.zog[1]);
          c.fillStyle = da < db ? k.a : k.hot;
          c.globalAlpha = 0.13;
          c.fillRect(pad + px - 3.5, pad + py - 3.5, 7, 7);
        }
      }
      c.globalAlpha = 1;
      void img;
    }
    c.strokeStyle = k.line; c.lineWidth = 1.5;
    c.strokeRect(pad, pad, gw, gh);
    label(c, "size →", pad + gw / 2, H - 8, 11, k.soft, "center");
    c.save(); c.translate(12, pad + gh / 2); c.rotate(-Math.PI / 2);
    label(c, "spots →", 0, 0, 11, k.soft, "center"); c.restore();
    T.ex.forEach(function (e) {
      var x = pad + e.size * gw, y = pad + gh - (e.spots / 12) * gh;
      c.fillStyle = e.label === "zib" ? k.a : k.hot;
      c.beginPath(); c.arc(x, y, 7, 0, 6.2832); c.fill();
    });
    if (T.cur) {
      var cx2 = pad + T.cur.size * gw, cy2 = pad + gh - (T.cur.spots / 12) * gh;
      c.strokeStyle = k.ink; c.lineWidth = 2.5; c.setLineDash([3, 3]);
      c.beginPath(); c.arc(cx2, cy2, 10, 0, 6.2832); c.stroke(); c.setLineDash([]);
    }
    if (!T.ex.length) {
      label(c, "nothing learned yet", W / 2, H / 2, 12, k.soft, "center");
    }
  }

  function teachSays(html) { $("teach-says").innerHTML = html; }

  function teachRefresh() {
    var z = T.ex.filter(function (e) { return e.label === "zib"; }).length;
    var g = T.ex.length - z;
    $("teach-tally").textContent = "Taught so far: " + z + " Zibs, " + g + " Zogs" +
      (T.tally.total ? "   ·   it matched you " + T.tally.agree + " times out of " + T.tally.total : "");
    drawCreature(); drawMap();
  }

  function teachNext() {
    T.cur = newCreature(); T.pending = null; teachRefresh();
  }

  $("lab-zib").addEventListener("click", function () { T.ex.push({ size: T.cur.size, spots: T.cur.spots, label: "zib" }); teachNext(); teachSays("<b>Noted.</b> The purple side of the map just grew. The machine is not following a rule — it is only copying the examples you give it."); });
  $("lab-zog").addEventListener("click", function () { T.ex.push({ size: T.cur.size, spots: T.cur.spots, label: "zog" }); teachNext(); teachSays("<b>Noted.</b> The orange side of the map just grew. Teach it a few of each, then press <b>Let it try one</b>."); });
  $("teach-skip").addEventListener("click", teachNext);
  $("teach-reset").addEventListener("click", function () { T.ex = []; T.tally = { agree: 0, total: 0 }; teachNext(); teachSays("Everything it knew is gone. Machines have no memory of their own — only the examples they were given."); });

  $("teach-test").addEventListener("click", function () {
    var p = predict(T.cur);
    if (!p) { teachSays("<b>It cannot guess yet.</b> Show it at least one Zib and one Zog first — with only one kind of example, every answer would be the same."); return; }
    var box = $("teach-says");
    box.innerHTML = "";
    var line = el("p", null, "");
    line.innerHTML = "The machine says: <b>this is a " + (p.label === "zib" ? "Zib" : "Zog") + "</b>, and it is " + p.conf + "% sure. It decided that by asking which group of your examples this creature sits closest to.";
    box.appendChild(line);
    var row = el("div", "ai-row");
    row.style.marginTop = "10px";
    var yes = el("button", "ai-btn ai-btn-a", "It's right");
    var no = el("button", "ai-btn", "It's wrong");
    yes.addEventListener("click", function () {
      T.tally.agree++; T.tally.total++;
      T.ex.push({ size: T.cur.size, spots: T.cur.spots, label: p.label });
      teachNext();
      teachSays("<b>Agreed.</b> That example got added to its collection, so it is now a bit more sure about creatures like that one.");
    });
    no.addEventListener("click", function () {
      T.tally.total++;
      var other = p.label === "zib" ? "zog" : "zib";
      T.ex.push({ size: T.cur.size, spots: T.cur.spots, label: other });
      teachNext();
      teachSays("<b>Corrected.</b> You just did what an AI trainer does all day: catch a wrong answer and hand back the right one. Watch the boundary on the map shift.");
    });
    row.appendChild(yes); row.appendChild(no);
    box.appendChild(row);
  });

  /* =====================================================
     2. NEXT-WORD MACHINE
     ===================================================== */
  var CORPUS = {
    pirate: "the captain sailed the salty sea and the parrot sang a song . the parrot sang about gold and the captain laughed . the ship sailed west and the sea was rough . the captain found a map and the map showed gold . the crew sang about the sea and the ship . the parrot found the map and the crew laughed . the gold was buried under the old tree and the tree was on the island . the ship sailed home and the crew sang .",
    space: "the moon goes around the earth and the earth goes around the sun . the sun is a star and the star is very hot . mars is a planet and the planet is red . the red dust covers the planet . jupiter is the biggest planet and jupiter has many moons . a comet is made of ice and dust . the ice melts near the sun and the comet grows a tail . light from the sun takes eight minutes to reach the earth . the earth spins once a day and the moon takes a month .",
    silly: "the purple llama ate my homework and the homework tasted like cheese . my dog wears a hat and the hat is far too small . the cheese sang a song about a llama . my sister ate the hat and my dog laughed . the homework grew legs and ran away . the llama wears a hat made of cheese . my dog ate the song and the song tasted purple ."
  };
  var Wm = { map: null, words: [], last: null, name: "pirate", run: null };

  function buildModel(name) {
    var toks = CORPUS[name].trim().split(/\s+/);
    var map = {};
    for (var i = 0; i < toks.length - 1; i++) {
      var a = toks[i], b = toks[i + 1];
      if (!map[a]) { map[a] = {}; }
      map[a][b] = (map[a][b] || 0) + 1;
    }
    Wm.map = map; Wm.name = name;
    Wm.words = ["the"];
    Wm.last = "the";
    renderWords();
  }

  function renderWords() {
    var s = $("sentence");
    s.innerHTML = "";
    Wm.words.forEach(function (w, i) {
      if (i === Wm.words.length - 1) {
        var sp = el("span", "ai-last", w);
        s.appendChild(sp);
      } else {
        s.appendChild(document.createTextNode(w + " "));
      }
    });
    var opts = Wm.map[Wm.last] || {};
    var list = Object.keys(opts).map(function (w) { return { w: w, n: opts[w] }; })
      .sort(function (a, b) { return b.n - a.n; });
    var total = list.reduce(function (s2, o) { return s2 + o.n; }, 0);
    var od = $("odds");
    od.innerHTML = "";
    if (!list.length) {
      od.appendChild(el("p", "ai-tally", "Dead end — this word never had anything after it. Press Start again."));
      return;
    }
    var top = list[0].n;
    list.slice(0, 6).forEach(function (o) {
      var row = el("div", "ai-odd");
      row.appendChild(el("div", "ai-w", o.w));
      var track = el("div", "ai-track");
      var fill = el("div", "ai-fill");
      fill.style.width = Math.max(6, Math.round((o.n / top) * 100)) + "%";
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(el("div", "ai-pc", Math.round((o.n / total) * 100) + "%"));
      od.appendChild(row);
    });
    $("words-says").innerHTML = "This machine has seen " + list.length +
      " different word" + (list.length === 1 ? "" : "s") + " that could follow <b>" + Wm.last + "</b>. It rolls a weighted dice and picks one. A real chatbot does the same thing, except it looks at everything written so far instead of just the last word — and it has read a large part of the internet instead of five sentences.";
  }

  function stepWord() {
    var opts = Wm.map[Wm.last];
    if (!opts) { return false; }
    var total = 0, k;
    for (k in opts) { if (Object.prototype.hasOwnProperty.call(opts, k)) { total += opts[k]; } }
    var r = Math.random() * total;
    for (k in opts) {
      if (Object.prototype.hasOwnProperty.call(opts, k)) {
        r -= opts[k];
        if (r <= 0) { Wm.words.push(k); Wm.last = k; renderWords(); return true; }
      }
    }
    return false;
  }

  $("w-next").addEventListener("click", stepWord);
  $("w-run").addEventListener("click", function () {
    var btn = $("w-run");
    if (Wm.run) { clearInterval(Wm.run); Wm.run = null; btn.textContent = "Write 15 words"; return; }
    var n = 0;
    btn.textContent = "Stop";
    Wm.run = setInterval(function () {
      if (!stepWord() || ++n >= 15) {
        clearInterval(Wm.run); Wm.run = null; btn.textContent = "Write 15 words";
      }
    }, 180);
  });
  $("w-reset").addEventListener("click", function () {
    if (Wm.run) { clearInterval(Wm.run); Wm.run = null; $("w-run").textContent = "Write 15 words"; }
    buildModel(Wm.name);
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-corpus]"), function (b) {
    b.addEventListener("click", function () { buildModel(b.dataset.corpus); });
  });

  /* =====================================================
     3. TOKENIZER
     ===================================================== */
  var PREFIX = ["under", "over", "un", "re", "pre", "dis", "mis", "non"];
  var SUFFIX = ["ation", "ible", "able", "ness", "ment", "tion", "ing", "teen", "est", "ful", "ies", "ly", "ed", "es", "s"];
  function tokenize(text) {
    var out = [];
    /*
       * The u flag matters here: without it an emoji is two surrogate halves
       * and each half renders as a broken box. With it, one emoji is one token,
       * which is also closer to what a real tokenizer does.
       */
      var chunks = text.match(/\s+|[A-Za-z]+|[0-9]+|[^\sA-Za-z0-9]/gu) || [];
    chunks.forEach(function (ch) {
      if (/^\s+$/.test(ch)) { return; }
      if (ch.length <= 5 || /^[0-9]+$/.test(ch)) { out.push(ch); return; }
      var head = "", tail = "", body = ch, i;
      for (i = 0; i < PREFIX.length; i++) {
        var p = PREFIX[i];
        if (body.toLowerCase().indexOf(p) === 0 && body.length - p.length >= 4) {
          head = body.slice(0, p.length); body = body.slice(p.length); break;
        }
      }
      for (i = 0; i < SUFFIX.length; i++) {
        var s = SUFFIX[i], at = body.length - s.length;
        if (at >= 4 && body.slice(at).toLowerCase() === s) { tail = body.slice(at); body = body.slice(0, at); break; }
      }
      if (head) { out.push(head); }
      while (body.length > 7) { out.push(body.slice(0, 4)); body = body.slice(4); }
      if (body) { out.push(body); }
      if (tail) { out.push(tail); }
    });
    return out;
  }
  var TOKHUE = [262, 196, 22, 152, 300, 210];
  function renderTokens() {
    var text = $("tokin").value;
    var toks = tokenize(text);
    var host = $("toks");
    host.innerHTML = "";
    toks.forEach(function (t, i) {
      var s = el("span", "ai-tok", t);
      s.style.background = "hsl(" + TOKHUE[i % TOKHUE.length] + ",52%,42%)";
      host.appendChild(s);
    });
    $("c-chars").textContent = text.replace(/\s/g, "").length;
    $("c-words").textContent = (text.trim() ? text.trim().split(/\s+/).length : 0);
    $("c-toks").textContent = toks.length;
    $("tokens-says").innerHTML = "Notice that short common words survive whole, while long ones get broken into pieces. That is why an AI can spell <b>cat</b> perfectly but sometimes fumbles a long unusual word — it never saw the whole word, only the chunks. <b>This is a simplified version:</b> a real tokenizer works out its own list of chunks by reading enormous amounts of text first.";
  }
  $("tokin").addEventListener("input", renderTokens);

  /* =====================================================
     4. ONE NEURON
     ===================================================== */
  var N = { pts: [], learn: null, w: { w1: 0.4, w2: -0.4, b: 0 } };
  function makePoints() {
    N.pts = [];
    var seed = 7;
    function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
    var guard = 0;
    while (N.pts.length < 26 && guard++ < 4000) {
      var x = 0.08 + rnd() * 0.84, y = 0.08 + rnd() * 0.84;
      var d = 0.9 * x + 0.8 * y - 0.85;
      if (Math.abs(d) < 0.1) { continue; }
      N.pts.push({ x: x, y: y, l: d > 0 ? 1 : -1 });
    }
  }
  function nw() { return N.w; }
  /*
   * The sliders move in steps of 0.05, so the neuron's numbers are snapped to
   * the same grid. Without this the thumb and the number beside it disagree,
   * and a weight can drift outside the range the child can reach.
   */
  function snap(v) { return Math.max(-2, Math.min(2, Math.round(v * 20) / 20)); }
  function syncSliders() {
    N.w.w1 = snap(N.w.w1); N.w.w2 = snap(N.w.w2); N.w.b = snap(N.w.b);
    $("w1").value = N.w.w1;
    $("w2").value = N.w.w2;
    $("b").value = N.w.b;
  }
  function nScore() {
    var w = nw(), ok = 0;
    N.pts.forEach(function (p) {
      var s = w.w1 * p.x + w.w2 * p.y + w.b;
      if ((s > 0 ? 1 : -1) === p.l) { ok++; }
    });
    return Math.round((ok / N.pts.length) * 100);
  }
  function drawNeuron() {
    var cv = $("neuron"), c = fit(cv), k = K();
    var W = cv.clientWidth, H = cv.clientHeight, pad = 28;
    var gw = W - pad * 2, gh = H - pad * 2, w = nw();
    c.strokeStyle = k.line; c.lineWidth = 1;
    for (var i = 0; i <= 4; i++) {
      c.beginPath(); c.moveTo(pad + (gw * i) / 4, pad); c.lineTo(pad + (gw * i) / 4, pad + gh); c.stroke();
      c.beginPath(); c.moveTo(pad, pad + (gh * i) / 4); c.lineTo(pad + gw, pad + (gh * i) / 4); c.stroke();
    }
    function X(x) { return pad + x * gw; }
    function Y(y) { return pad + gh - y * gh; }
    /*
     * w1·x + w2·y + b = 0 is a line. When the colour weight is zero that line
     * is vertical, and solving for y would divide by zero — so it gets drawn
     * the other way round instead of vanishing off the page.
     */
    c.strokeStyle = k.a; c.lineWidth = 3;
    if (Math.abs(w.w2) > 0.001) {
      var y0 = -w.b / w.w2, y1 = -(w.w1 + w.b) / w.w2;
      c.beginPath(); c.moveTo(X(0), Y(y0)); c.lineTo(X(1), Y(y1)); c.stroke();
    } else if (Math.abs(w.w1) > 0.001) {
      var xv = -w.b / w.w1;
      c.beginPath(); c.moveTo(X(xv), Y(0)); c.lineTo(X(xv), Y(1)); c.stroke();
    }
    N.pts.forEach(function (p) {
      var s = w.w1 * p.x + w.w2 * p.y + w.b;
      var right = (s > 0 ? 1 : -1) === p.l;
      c.fillStyle = p.l > 0 ? k.hot : k.cool;
      c.beginPath(); c.arc(X(p.x), Y(p.y), 7, 0, 6.2832); c.fill();
      if (!right) {
        c.strokeStyle = k.bad; c.lineWidth = 2.5;
        c.beginPath(); c.arc(X(p.x), Y(p.y), 11, 0, 6.2832); c.stroke();
      }
    });
    label(c, "size →", pad + gw / 2, H - 6, 11, k.soft, "center");
    c.save(); c.translate(11, pad + gh / 2); c.rotate(-Math.PI / 2);
    label(c, "redness →", 0, 0, 11, k.soft, "center"); c.restore();
    label(c, "sweet", X(0.82), Y(0.9), 11, k.hot, "center", true);
    label(c, "sour", X(0.2), Y(0.12), 11, k.cool, "center", true);
    $("v-w1").textContent = w.w1.toFixed(2);
    $("v-w2").textContent = w.w2.toFixed(2);
    $("v-b").textContent = w.b.toFixed(2);
    var sc = nScore();
    $("n-score").textContent = sc + "%";
    $("n-score").style.color = sc >= 95 ? k.good : (sc >= 70 ? k.ink : k.bad);
    $("neuron-says").innerHTML = sc === 100
      ? "<b>Perfect split.</b> That is all one neuron does: multiply each input by a weight, add them up, and check whether the total lands above or below zero. Millions of these, wired together, is what a large AI actually is."
      : "The circled dots are the ones it is getting wrong. Its whole opinion is three numbers — two weights and a bias — and <b>learning just means nudging those numbers</b> until fewer dots are circled.";
  }
  ["w1", "w2", "b"].forEach(function (id) {
    $(id).addEventListener("input", function () { N.w[id] = parseFloat($(id).value); drawNeuron(); });
  });
  $("n-reset").addEventListener("click", function () {
    if (N.learn) { clearInterval(N.learn); N.learn = null; learnLabel(); }
    N.w = { w1: Math.random() * 2 - 1, w2: Math.random() * 2 - 1, b: Math.random() - 0.5 };
    syncSliders(); drawNeuron();
  });
  function learnLabel() { $("n-learn").textContent = N.learn ? "Stop" : "Let it learn"; }
  $("n-learn").addEventListener("click", function () {
    if (N.learn) { clearInterval(N.learn); N.learn = null; learnLabel(); return; }
    var i = 0;
    N.learn = setInterval(function () {
      var w = nw(), changed = false;
      for (var pass = 0; pass < 6; pass++) {
        for (var n = 0; n < N.pts.length; n++) {
          var p = N.pts[(i + n) % N.pts.length];
          var s = w.w1 * p.x + w.w2 * p.y + w.b;
          if ((s > 0 ? 1 : -1) !== p.l) {
            w.w1 += 0.12 * p.l * p.x; w.w2 += 0.12 * p.l * p.y; w.b += 0.12 * p.l * 0.5;
            changed = true;
            i++;
            break;
          }
        }
        if (!changed) { break; }
      }
      i++;
      syncSliders(); drawNeuron();
      if (!changed || i > 400) { clearInterval(N.learn); N.learn = null; learnLabel(); }
    }, 90);
    learnLabel();
  });

  /* =====================================================
     tabs + boot
     ===================================================== */
  var DEMOS = ["teach", "words", "tokens", "neuron", "bias"];
  function show(name, fromClick) {
    DEMOS.forEach(function (d) { $("d-" + d).hidden = (d !== name); });
    Array.prototype.forEach.call(document.querySelectorAll(".ai-tab"), function (t) {
      var on = t.dataset.d === name;
      t.setAttribute("aria-selected", String(on));
      t.setAttribute("tabindex", on ? "0" : "-1");
    });
    if (N.learn) { clearInterval(N.learn); N.learn = null; }
    if (name === "teach") { teachRefresh(); }
    if (name === "neuron") { drawNeuron(); }
    if (fromClick && location.hash !== "#" + name) { location.hash = name; }
  }
  Array.prototype.forEach.call(document.querySelectorAll(".ai-tab"), function (t) {
    t.addEventListener("click", function () { show(t.dataset.d, true); });
  });
  window.addEventListener("hashchange", function () {
    var h = location.hash.slice(1);
    if (DEMOS.indexOf(h) >= 0) { show(h, false); }
  });

  /* Left and right arrows move between demos, the way a tab strip should. */
  document.querySelector(".ai-tabs").addEventListener("keydown", function (e) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") { return; }
    var tabs = Array.prototype.slice.call(document.querySelectorAll(".ai-tab"));
    var at = tabs.indexOf(document.activeElement);
    if (at < 0) { return; }
    e.preventDefault();
    var next = tabs[(at + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    next.focus();
    show(next.dataset.d, true);
  });
  window.addEventListener("resize", function () {
    if (!$("d-teach").hidden) { teachRefresh(); }
    if (!$("d-neuron").hidden) { drawNeuron(); }
  });

  T.cur = newCreature();
  teachSays("Press <b>It's a Zib</b> or <b>It's a Zog</b> — you decide which is which, there is no right answer. Do about six, then let the machine try one on its own.");
  buildModel("pirate");
  renderTokens();
  makePoints();
  syncSliders();
  var start = location.hash.slice(1);
  show(DEMOS.indexOf(start) >= 0 ? start : "teach");
})();
