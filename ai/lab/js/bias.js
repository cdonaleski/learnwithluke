/**
 * Bias Detective — the child builds the training set, the machine lives with it.
 *
 * Nothing here is scripted. The machine works out an average example of each
 * group from whatever it was shown (a nearest-centroid classifier), and every
 * verdict on this page is that sum being done live. The famous wrong answers —
 * a tomato called an apple, a wolf called a dog — are not written in anywhere.
 * They happen because of what the child chose to show it.
 *
 * ADDING A JOB
 * ------------
 * Copy a block in JOBS. A job needs:
 *   feats     the four things the machine can measure, in plain words
 *   pool      the examples the child can teach it, each with f: [0/1, 0/1, 0/1, 0/1]
 *   tests     six held-out items it gets judged on, each with truth: true/false
 *   trap      the pool item that shares its features with something on the other
 *             side — the one the machine can never get right if both are taught
 *
 * The rule that makes this work: at least one pair of items must be identical
 * in `f` while sitting on opposite sides of `truth`. That is the moment a child
 * discovers that a machine can only ever be as clever as what it is allowed to
 * measure.
 */
(function () {
  "use strict";

  var JOBS = {
    apple: {
      label: "Is it an apple?",
      word: "APPLE",
      notWord: "NOT AN APPLE",
      feats: ["is it red", "is it round", "has a stem", "is it big"],
      pool: [
        { id: "redapple",  icon: "🍎", name: "Red apple",   f: [1, 1, 1, 1], truth: true },
        { id: "redapple2", icon: "🍎", name: "Another red apple", f: [1, 1, 1, 1], truth: true },
        { id: "greenapple",icon: "🍏", name: "Green apple", f: [0, 1, 1, 1], truth: true },
        { id: "tomato",    icon: "🍅", name: "Tomato",      f: [1, 1, 0, 1], truth: false },
        { id: "cherry",    icon: "🍒", name: "Cherry",      f: [1, 1, 1, 0], truth: false },
        { id: "grape",     icon: "🍇", name: "Grapes",      f: [0, 1, 1, 0], truth: false },
        { id: "orange",    icon: "🍊", name: "Orange",      f: [0, 1, 0, 1], truth: false },
        { id: "lemon",     icon: "🍋", name: "Lemon",       f: [0, 1, 0, 0], truth: false },
        { id: "banana",    icon: "🍌", name: "Banana",      f: [0, 0, 0, 1], truth: false },
        { id: "pear",      icon: "🍐", name: "Pear",        f: [0, 1, 1, 1], truth: false }
      ],
      tests: [
        { id: "t-red",    icon: "🍎", name: "Red apple",   f: [1, 1, 1, 1], truth: true },
        { id: "t-green",  icon: "🍏", name: "Green apple", f: [0, 1, 1, 1], truth: true },
        { id: "t-tomato", icon: "🍅", name: "Tomato",      f: [1, 1, 0, 1], truth: false },
        { id: "t-cherry", icon: "🍒", name: "Cherry",      f: [1, 1, 1, 0], truth: false },
        { id: "t-banana", icon: "🍌", name: "Banana",      f: [0, 0, 0, 1], truth: false },
        { id: "t-pear",   icon: "🍐", name: "Pear",        f: [0, 1, 1, 1], truth: false }
      ],
      trap: "t-pear",
      trapTwin: "a green apple",
      missions: [
        { text: "Trick it into calling the tomato an apple",
          check: function (s) { return s.said["t-tomato"] === true; } },
        { text: "Get at least 5 of the 6 right",
          check: function (s) { return s.right >= 5; } },
        { text: "Get 5 right without ever teaching it a red apple",
          check: function (s) { return s.right >= 5 && s.picks.redapple !== 1 && s.picks.redapple2 !== 1; } },
        { text: "Find the one it can never get right",
          check: function (s) { return s.right === 5 && s.wrong.length === 1 && s.wrong[0] === "t-pear"; } }
      ],
      presets: {
        "Only red apples": { yes: ["redapple", "redapple2"], no: ["grape", "lemon", "banana"] },
        "Apples of every colour": { yes: ["redapple", "greenapple"], no: ["orange", "lemon", "banana"] },
        "Everything": { yes: ["redapple", "redapple2", "greenapple"], no: ["tomato", "cherry", "grape", "orange", "lemon", "banana", "pear"] }
      }
    },

    dog: {
      label: "Is it a dog?",
      word: "DOG",
      notWord: "NOT A DOG",
      feats: ["four legs", "furry", "pointy ears", "wags its tail"],
      pool: [
        { id: "lab",    icon: "🐕", name: "Labrador",  f: [1, 1, 0, 1], truth: true },
        { id: "husky",  icon: "🐕", name: "Husky",     f: [1, 1, 1, 1], truth: true },
        { id: "poodle", icon: "🐩", name: "Poodle",    f: [1, 1, 0, 1], truth: true },
        { id: "puppy",  icon: "🐶", name: "Puppy",     f: [1, 1, 0, 1], truth: true },
        { id: "cat",    icon: "🐱", name: "Cat",       f: [1, 1, 1, 0], truth: false },
        { id: "fox",    icon: "🦊", name: "Fox",       f: [1, 1, 1, 0], truth: false },
        { id: "wolf",   icon: "🐺", name: "Wolf",      f: [1, 1, 1, 1], truth: false },
        { id: "rabbit", icon: "🐰", name: "Rabbit",    f: [1, 1, 1, 0], truth: false },
        { id: "horse",  icon: "🐴", name: "Horse",     f: [1, 0, 0, 0], truth: false },
        { id: "teddy",  icon: "🧸", name: "Teddy bear",f: [1, 1, 0, 0], truth: false }
      ],
      tests: [
        { id: "t-lab",    icon: "🐕", name: "Labrador",  f: [1, 1, 0, 1], truth: true },
        { id: "t-poodle", icon: "🐩", name: "Poodle",    f: [1, 1, 0, 1], truth: true },
        { id: "t-cat",    icon: "🐱", name: "Cat",       f: [1, 1, 1, 0], truth: false },
        { id: "t-wolf",   icon: "🐺", name: "Wolf",      f: [1, 1, 1, 1], truth: false },
        { id: "t-horse",  icon: "🐴", name: "Horse",     f: [1, 0, 0, 0], truth: false },
        { id: "t-teddy",  icon: "🧸", name: "Teddy bear",f: [1, 1, 0, 0], truth: false }
      ],
      trap: "t-wolf",
      trapTwin: "a husky",
      missions: [
        { text: "Trick it into calling the wolf a dog",
          check: function (s) { return s.said["t-wolf"] === true; } },
        { text: "Get at least 5 of the 6 right",
          check: function (s) { return s.right >= 5; } },
        { text: "Get all 6 right",
          check: function (s) { return s.right === 6; } },
        { text: "Teach it the husky and the wolf at once, then look at the wolf",
          check: function (s) { return s.picks.husky === 1 && s.picks.wolf === 2; } }
      ],
      presets: {
        "Only fluffy pets": { yes: ["poodle", "puppy"], no: ["horse"] },
        "Dogs and their look-alikes": { yes: ["lab", "husky"], no: ["wolf", "cat"] },
        "Everything": { yes: ["lab", "husky", "poodle", "puppy"], no: ["cat", "fox", "wolf", "rabbit", "horse", "teddy"] }
      }
    }
  };

  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text !== undefined) { n.textContent = text; }
    return n;
  }

  var jobId = "apple";
  var picks = {};                 /* item id -> 1 (yes) or 2 (no); missing = not used */
  var done = {};

  function job() { return JOBS[jobId]; }

  /* ---------- the machine itself ---------- */
  function centroid(which) {
    var j = job(), sum = [0, 0, 0, 0], n = 0;
    j.pool.forEach(function (it) {
      if (picks[it.id] === which) {
        it.f.forEach(function (v, i) { sum[i] += v; });
        n++;
      }
    });
    if (!n) { return null; }
    return sum.map(function (v) { return v / n; });
  }

  function judge(item, yes, no) {
    function d(c) {
      return Math.sqrt(item.f.reduce(function (s, v, i) { return s + Math.pow(v - c[i], 2); }, 0));
    }
    var dy = d(yes), dn = d(no);
    return {
      says: dy < dn,
      /*
       * Dead heat. The two groups it learned sit exactly the same distance
       * away, so whichever answer comes out is the tie-break in the code and
       * nothing more. Worth showing honestly rather than dressing it up as a
       * decision.
       */
      tie: Math.abs(dy - dn) < 1e-9,
      sure: Math.round((Math.max(dy, dn) / Math.max(dy + dn, 0.0001)) * 100)
    };
  }

  /* ---------- drawing ---------- */
  function card(item, state, onClick) {
    var b = el("button", "bd-card" + (state === 1 ? " is-yes" : state === 2 ? " is-no" : ""));
    b.type = "button";
    b.appendChild(el("span", "bd-icon", item.icon));
    b.appendChild(el("span", "bd-name", item.name));
    var tag = el("span", "bd-state", state === 1 ? "✓ " + job().word : state === 2 ? "✗ " + job().notWord : "not used");
    b.appendChild(tag);
    b.setAttribute("aria-label", item.name + ", currently " + (state === 1 ? "taught as " + job().word : state === 2 ? "taught as " + job().notWord : "not being used") + ". Press to change.");
    if (onClick) { b.addEventListener("click", onClick); }
    return b;
  }

  function renderPool() {
    var host = $("bd-pool");
    host.innerHTML = "";
    job().pool.forEach(function (it) {
      host.appendChild(card(it, picks[it.id] || 0, function () {
        var next = ((picks[it.id] || 0) + 1) % 3;
        if (next === 0) { delete picks[it.id]; } else { picks[it.id] = next; }
        render();
      }));
    });
  }

  function renderLearned(yes, no) {
    var j = job();
    var tbl = $("bd-feat");
    tbl.innerHTML = "";
    var head = el("tr");
    ["What it measures", "In the " + j.word + "s", "In the rest", "Leaning on"].forEach(function (h) {
      head.appendChild(el("th", null, h));
    });
    tbl.appendChild(head);

    var gaps = j.feats.map(function (_, i) { return Math.abs(yes[i] - no[i]); });
    var top = Math.max.apply(null, gaps) || 1;

    j.feats.forEach(function (name, i) {
      var tr = el("tr");
      tr.appendChild(el("td", null, name));
      tr.appendChild(el("td", "ai-n", yes[i].toFixed(2)));
      tr.appendChild(el("td", "ai-n", no[i].toFixed(2)));
      var cell = el("td");
      var track = el("span", "bd-gap");
      var fill = el("span", "bd-gap-fill");
      fill.style.width = Math.round((gaps[i] / top) * 100) + "%";
      track.appendChild(fill);
      cell.appendChild(track);
      tr.appendChild(cell);
      tbl.appendChild(tr);
    });

    var best = gaps.indexOf(Math.max.apply(null, gaps));
    return { feature: j.feats[best], gap: gaps[best] };
  }

  function renderTests(yes, no) {
    var j = job(), host = $("bd-tests");
    host.innerHTML = "";
    var right = 0, wrongIds = [], ties = 0, said = {};
    j.tests.forEach(function (t) {
      var v = judge(t, yes, no);
      /*
       * A dead heat does not count as a right answer even when the label that
       * falls out happens to match. Getting it right by coin flip is not the
       * machine knowing something.
       */
      var ok = v.says === t.truth && !v.tie;
      said[t.id] = v.says;
      if (ok) { right++; } else { wrongIds.push(t.id); }
      var c = el("div", "bd-test" + (v.tie ? " is-tie" : ok ? " is-right" : " is-wrong"));
      c.appendChild(el("span", "bd-icon", t.icon));
      c.appendChild(el("span", "bd-name", t.name));
      c.appendChild(el("span", "bd-verdict " + (v.says ? "ai-yes" : "ai-no"), v.says ? j.word : j.notWord));
      c.appendChild(el("span", "bd-sure", v.tie
        ? "it flipped a coin"
        : v.sure + "% sure · " + (ok ? "correct" : "wrong")));
      host.appendChild(c);
      if (v.tie) { ties++; }
    });
    return { right: right, wrong: wrongIds, ties: ties, said: said };
  }

  function renderMissions() {
    var host = $("bd-missions");
    host.innerHTML = "";
    job().missions.forEach(function (m, i) {
      var li = el("li", "bd-mission" + (done[i] ? " is-done" : ""));
      li.appendChild(el("span", "bd-tick", done[i] ? "✓" : "○"));
      li.appendChild(el("span", null, m.text));
      host.appendChild(li);
    });
  }

  /* ---------- the loop ---------- */
  function render() {
    var j = job();
    renderPool();

    var yes = centroid(1), no = centroid(2);
    var nYes = j.pool.filter(function (i) { return picks[i.id] === 1; }).length;
    var nNo = j.pool.filter(function (i) { return picks[i.id] === 2; }).length;
    $("bd-count").textContent = nYes + " taught as " + j.word + ", " + nNo + " taught as " + j.notWord;

    var ready = !!(yes && no);
    $("bd-result").hidden = !ready;
    $("bd-empty").hidden = ready;

    if (!ready) {
      $("bias-says").innerHTML = "<b>Give it at least one of each to start.</b> A machine shown only one kind of thing has nothing to compare against — every answer it gave would be the same answer.";
      renderMissions();
      return;
    }

    var lean = renderLearned(yes, no);
    var score = renderTests(yes, no);
    var total = nYes + nNo;

    $("bd-score").textContent = score.right + " out of 6 right";
    $("bd-score").className = "bd-score " + (score.right === 6 ? "is-perfect" : score.right >= 5 ? "is-ok" : "is-bad");

    /*
     * Missions are checked against what actually happened, never against the
     * route taken to get there. A mission ticked stays ticked.
     */
    var state = { right: score.right, wrong: score.wrong, said: score.said, picks: picks, examples: total };
    j.missions.forEach(function (m, i) { if (m.check(state)) { done[i] = true; } });
    renderMissions();

    if (score.ties === j.tests.length) {
      $("bias-says").innerHTML = "<b>It knows nothing at all now.</b> You gave it two examples that are identical in everything it can measure, but told it they were opposites. Every answer on the bench is a coin flip. This is not the machine being stupid — you asked it to tell apart two things using only measurements that cannot tell them apart.";
      return;
    }

    var msg = "It is leaning hardest on <b>" + lean.feature + "</b>. ";
    if (lean.gap < 0.34) {
      msg += "Nothing it measures separates the two groups cleanly, so it is guessing more than deciding. ";
    }
    if (score.ties) {
      msg += "<b>" + score.ties + (score.ties === 1 ? " of them was a dead heat" : " of them were dead heats") +
        "</b> — landing exactly between the two groups you taught it. Those answers are coin flips rather than decisions, so they do not count as right. ";
    }
    if (score.right === 6) {
      msg += "Six out of six — but check how you did it. Machines get to look clever when someone has shown them the awkward cases on purpose.";
    } else if (score.right === 5 && score.wrong[0] === j.trap) {
      msg += "Five out of six, and the one it missed is the one it <b>cannot</b> get right: it has exactly the same four measurements as " + j.trapTwin + ". No amount of teaching fixes that — the machine would need to be allowed to measure something new.";
    } else {
      msg += "It got " + score.right + " of 6. Look at what you left out: the mistakes are almost never random, they are the gaps in what you showed it.";
    }
    $("bias-says").innerHTML = msg;
  }

  /* ---------- controls ---------- */
  function setJob(id) {
    jobId = id;
    picks = {};
    done = {};
    Array.prototype.forEach.call(document.querySelectorAll("[data-job]"), function (b) {
      b.className = "option-btn" + (b.dataset.job === id ? " is-active" : "");
    });
    $("bd-ask").textContent = job().label;
    renderPresets();
    render();
  }

  function renderPresets() {
    var host = $("bd-presets");
    host.innerHTML = "";
    host.appendChild(el("span", "ai-tally", "Or start from:"));
    var sets = job().presets;
    Object.keys(sets).forEach(function (name) {
      var b = el("button", "ai-btn", name);
      b.type = "button";
      b.addEventListener("click", function () {
        picks = {};
        sets[name].yes.forEach(function (id) { picks[id] = 1; });
        sets[name].no.forEach(function (id) { picks[id] = 2; });
        render();
      });
      host.appendChild(b);
    });
    var clear = el("button", "ai-btn", "Clear");
    clear.type = "button";
    clear.addEventListener("click", function () { picks = {}; render(); });
    host.appendChild(clear);
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-job]"), function (b) {
    b.addEventListener("click", function () { setJob(b.dataset.job); });
  });

  setJob("apple");
})();
