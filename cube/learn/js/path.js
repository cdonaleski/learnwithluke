/**
 * The guided path through CFOP: one thing to do next, always.
 *
 * The wall of 119 cases is a reference. It is exactly right for somebody who
 * already knows what they are looking for, and exactly wrong for a kid who
 * has just arrived: forty-one pictures and no idea which one is first, or
 * what a picture even IS. This puts two things over the top of the wall.
 *
 * First, a thirty-second try. Not reading -- a cube in the hands. Three moves
 * on a solved cube and a pair comes out onto the top; three moves and it is
 * back. That is what "a pair" is and what "a case" is, felt rather than
 * explained, and it teaches the loop every case on this page is learnt by:
 * set it up, do it, watch it solve, again. Every move in the lesson is read
 * from the case data, so the words can never drift from the picture.
 *
 * Then the path. The order is not invented here -- it is how CFOP is
 * actually taught. Cross. Pairs, easiest four first. Then the top in TWO
 * looks, using only ten orientation algorithms and six permutation ones:
 * that is enough to solve every cube with CFOP, and it is what nearly
 * everyone learns before the full fifty-seven and twenty-one. Those come
 * last, and Advanced after.
 *
 * Nothing here keeps its own score. A step is done when its cases are marked
 * learnt on the wall, read from the same place the wall reads -- so the path
 * and the wall can never disagree about what has been learnt.
 */
(function () {
  "use strict";

  const holder = document.getElementById("path");
  const app = window.CFOPApp;
  if (!holder || !app) return;
  const C = app.C;

  const PATH_KEY = "cfop-path";

  /* ---------------- The curriculum ---------------- */

  const STEPS = [
    {
      id: "cross", stage: "cross", title: "The cross",
      why: "Four edges, one colour, on the bottom, with their side colours " +
           "matching the middles. Everything else is built on top of this, so " +
           "get it smooth before anything.",
      how: "No algorithms — this one you work out by looking. Read the five " +
           "tips, then practise until you can do it without stopping to think. " +
           "Tick the box when you can.",
      self: "I can make the cross on the bottom without help",
    },
    {
      id: "f2l-easy", stage: "f2l", ids: [1, 2, 3, 4], title: "Your first four pairs",
      why: "The beginner way does the corners, then the edges. CFOP puts a " +
           "corner together with its edge and drops the two in as a pair. " +
           "These four are the easiest — the pair is almost together already, " +
           "three or four moves and it is in. You did the first one in the try.",
      how: "Click a picture. Do the set-up moves on your cube so it matches. " +
           "Press Play, and do the same moves. Watch it solve. Again, until " +
           "you can do it without the screen — then press Mark as learnt.",
    },
    {
      id: "f2l-top", stage: "f2l", ids: range(5, 16), title: "The rest with both pieces on top",
      why: "Same idea, longer moves. In all of these the corner and edge are " +
           "both up on the top layer — the most common thing you will meet.",
      how: "Twelve of them. Do not rush: two or three a day sticks better than " +
           "all twelve in one sitting.",
    },
    {
      id: "f2l-rest", stage: "f2l", ids: range(17, 41), title: "The awkward pairs",
      why: "The corner is upside down, or something is already in the slot the " +
           "wrong way round. These come up less often, so they matter less — " +
           "but a full F2L means all forty-one.",
      how: "Twenty-five to go. Learn the ones you keep bumping into first.",
    },
    {
      id: "oll-sune", stage: "oll", ids: [27, 26], title: "Sune and Anti-sune",
      why: "Now the top. Two algorithms that between them turn up in a huge " +
           "share of solves, and nearly every fast solver learnt these two first.",
      how: "Seven moves each, and one is the other backwards.",
    },
    {
      id: "oll-edges", stage: "oll", ids: [45, 44], title: "Two-look OLL: the edges",
      why: "Here is the trick that makes CFOP learnable. Instead of fifty-seven " +
           "algorithms, orient the top in two goes: first make the edges face " +
           "up, then fix the corners. These two do the edges.",
      how: "Six moves each. If no edges face up, do the first one, then the " +
           "second — that is all the dot case is.",
    },
    {
      id: "oll-corners", stage: "oll", ids: [21, 22, 23, 24, 25], title: "Two-look OLL: the corners",
      why: "With the edges done, the corners are in one of seven shapes. You " +
           "already know two (Sune, Anti-sune). These five finish the set.",
      how: "After this you can orient any top in two looks. That is the whole " +
           "of OLL, usable — the other forty-eight are a speed-up for later.",
    },
    {
      id: "pll-two", stage: "pll", ids: ["T", "Y", "Ua", "Ub", "H", "Z"], title: "Two-look PLL",
      why: "Last step: slide the top pieces home. Same trick — corners first, " +
           "then edges, six algorithms instead of twenty-one.",
      how: "T and Y sort the corners. Ua, Ub, H and Z sort the edges. Learn " +
           "these six and you are a CFOP solver.",
      milestone: "You can now solve any cube with CFOP. Time yourself — " +
                 "under a minute is normal here, and it only goes down from now.",
    },
    {
      id: "oll-full", stage: "oll", ids: null, title: "The full fifty-seven",
      why: "Two-look OLL takes two looks. Knowing every shape takes one. This " +
           "is where thirty seconds becomes twenty.",
      how: "The forty-eight you have not done. No order needed — the wall " +
           "shows which are left. Months, not days, and that is normal.",
    },
    {
      id: "pll-full", stage: "pll", ids: null, title: "The full twenty-one",
      why: "Same again for the last step. The G perms are the long ones; " +
           "leave those for last.",
      how: "Fifteen to go. When these are done, there is nothing on this page " +
           "you do not know.",
      milestone: "That is all of CFOP — every case a world-record holder " +
                 "knows. From here it is practice, and Advanced CFOP when " +
                 "you want it.",
    },
  ];

  function range(a, b) {
    const out = [];
    for (let i = a; i <= b; i++) out.push(i);
    return out;
  }

  /* ---------------- What has been done ---------------- */

  function mine() {
    try { return JSON.parse(window.localStorage.getItem(PATH_KEY)) || {}; }
    catch (err) { return {}; }
  }

  function remember(change) {
    const all = Object.assign(mine(), change);
    try { window.localStorage.setItem(PATH_KEY, JSON.stringify(all)); } catch (err) { /* fine */ }
  }

  /** The case ids a step covers -- null means "all in the stage not covered earlier". */
  function idsOf(step) {
    if (step.ids) return step.ids.map(String);
    const stage = app.STAGES[step.stage];
    const taken = {};
    STEPS.forEach(function (other) {
      if (other.stage === step.stage && other.ids) {
        other.ids.forEach(function (id) { taken[String(id)] = true; });
      }
    });
    return stage.cases().map(app.caseId).filter(function (id) { return !taken[id]; });
  }

  function progressOf(step) {
    if (step.self) {
      const yes = Boolean(mine()[step.id]);
      return { done: yes ? 1 : 0, total: 1, complete: yes };
    }
    const ids = idsOf(step);
    const learnt = app.learnt()[step.stage] || {};
    const done = ids.filter(function (id) { return learnt[id]; }).length;
    return { done: done, total: ids.length, complete: done === ids.length };
  }

  function currentIndex() {
    for (let i = 0; i < STEPS.length; i++) {
      if (!progressOf(STEPS[i]).complete) return i;
    }
    return STEPS.length;   // everything done
  }

  /* ---------------- The thirty-second try ---------------- */

  /** The first case on the wall, and the moves that get a solved cube into it. */
  function firstCase() {
    const item = app.STAGES.f2l.cases()[0];
    return { item: item, setup: C.setupFor(item.alg), alg: C.tidy(item.alg) };
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /** Moves written as the chips the player uses, so they read the same everywhere. */
  function chips(alg) {
    const row = el("span", "lesson-moves");
    C.parse(alg).moves.forEach(function (move) {
      row.appendChild(el("span", "move", move.name + (move.back ? "'" : "")));
    });
    return row;
  }

  function drawLesson(tried) {
    const first = firstCase();
    const box = el("div", "lesson" + (tried ? " is-done" : ""));

    if (tried) {
      const line = el("p", "lesson-again");
      line.appendChild(el("span", null, "Done the thirty-second try. "));
      const again = el("button", "lesson-link", "Do it again");
      again.type = "button";
      again.addEventListener("click", function () { remember({ tried: false }); draw(); });
      line.appendChild(again);
      box.appendChild(line);
      return box;
    }

    box.appendChild(el("h3", "lesson-title", "Try it right now — thirty seconds"));
    box.appendChild(el("p", "lesson-lead",
      "Not reading. A cube in your hands. This is what every picture on this " +
      "page means, and you will feel it before anyone explains it."));

    const steps = el("ol", "lesson-steps");

    // 1. A solved cube, held the right way round.
    const s1 = el("li");
    s1.appendChild(el("strong", null, "Hold a solved cube "));
    s1.appendChild(el("span", null,
      "white on the bottom, green facing you. (Different colours on yours? " +
      "Fine — it is the positions that matter.) "));
    const cant = el("a", "lesson-link", "Can't solve one yet? Start with the beginner way.");
    cant.href = "../helper/index.html";
    s1.appendChild(cant);
    steps.appendChild(s1);

    // 2. Take a pair out -- the set-up moves, played from solved.
    const s2 = el("li");
    s2.appendChild(el("strong", null, "Do these three moves: "));
    s2.appendChild(chips(first.setup));
    s2.appendChild(el("span", null,
      " Now look at the top of your cube, towards the right. A corner and an " +
      "edge are sitting together up there. That is a pair, and it just came " +
      "out of the slot in front of your right hand. "));
    const show2 = el("button", "btn btn-secondary btn-small", "▶ Show me on the cube");
    show2.type = "button";
    show2.addEventListener("click", function () {
      app.openSequence({
        from: C.solved(), alg: first.setup, block: "center",
        name: "Taking a pair out",
        note: "Do each move on your cube as it plays. Slow the speed if you need to.",
      });
      app.play();
    });
    s2.appendChild(show2);
    steps.appendChild(s2);

    // 3. Put it back -- the algorithm itself.
    const s3 = el("li");
    s3.appendChild(el("strong", null, "Now put it back: "));
    s3.appendChild(chips(first.alg));
    s3.appendChild(el("span", null,
      " Solved. You just did your first CFOP algorithm — the corner and edge " +
      "went in together, as a pair. "));
    const show3 = el("button", "btn btn-secondary btn-small", "▶ Show me on the cube");
    show3.type = "button";
    show3.addEventListener("click", function () {
      app.openSequence({
        item: first.item, from: app.caseState(first.item), alg: first.item.alg, block: "center",
        name: "Putting the pair back in",
        setup: first.setup,
        note: "The same three moves, backwards and forwards — that is all it takes.",
      });
      app.play();
    });
    s3.appendChild(show3);
    steps.appendChild(s3);

    box.appendChild(steps);

    box.appendChild(el("p", "lesson-notation",
      "F is the face towards you, U is the top, R is the right. A plain letter " +
      "is a quarter turn clockwise; a dash — say it “prime” — is anticlockwise."));

    const point = el("div", "lesson-point");
    point.appendChild(el("h4", null, "That is the whole trick"));
    point.appendChild(el("p", null,
      "Every picture below is a situation like that one — the top of the cube " +
      "seen from above, with the sides folded out flat. To learn a case: " +
      "set it up on your cube with the moves shown, do the algorithm, watch it " +
      "solve, and again until your hands remember. Do it enough and in a real " +
      "solve you will see the situation and your hands will just go."));
    box.appendChild(point);

    const did = el("button", "btn btn-primary", "I did it — show me the path");
    did.type = "button";
    did.addEventListener("click", function () {
      remember({ tried: true });
      app.closeCase();
      draw();
      try { holder.scrollIntoView({ block: "start", behavior: "smooth" }); } catch (err) { /* fine */ }
    });
    box.appendChild(did);
    return box;
  }

  /* ---------------- The path ---------------- */

  function draw() {
    holder.innerHTML = "";
    const tried = Boolean(mine().tried);
    holder.appendChild(drawLesson(tried));

    const now = currentIndex();
    const list = el("ol", "path-steps" + (tried ? "" : " is-waiting"));
    STEPS.forEach(function (step, i) {
      const p = progressOf(step);
      const state = p.complete ? "done" : i === now ? "now" : "later";
      const item = el("li", "path-step is-" + state);
      if (state === "now" && tried) item.setAttribute("aria-current", "step");

      const head = el("div", "path-head");
      head.appendChild(el("span", "path-mark", p.complete ? "✓" : String(i + 1)));
      const titles = el("div", "path-titles");
      titles.appendChild(el("span", "path-title", step.title));
      if (!step.self) {
        titles.appendChild(el("span", "path-count", p.done + " of " + p.total + " learnt"));
      }
      head.appendChild(titles);
      item.appendChild(head);

      // Until the try is done, the path is just a map of what is coming; the
      // one open step is the lesson above it.
      if (tried && (state === "now" || (state === "done" && step.milestone && i === now - 1))) {
        item.appendChild(drawBody(step, p, state));
      }
      list.appendChild(item);
    });

    if (!tried) {
      holder.appendChild(el("p", "path-waiting", "Then, the path — one step at a time:"));
    }
    holder.appendChild(list);

    if (tried && now === STEPS.length) {
      const fin = el("p", "path-finished",
        "Every step done. Nothing on this page is left to learn — only to get faster.");
      const go = el("a", "btn btn-primary", "⚡ On to Advanced CFOP");
      go.href = "../advanced/index.html";
      holder.appendChild(fin);
      holder.appendChild(go);
    }
  }

  function drawBody(step, p, state) {
    const body = el("div", "path-body");
    body.appendChild(el("p", "path-why", step.why));
    body.appendChild(el("p", "path-how", step.how));

    if (step.self) {
      const label = el("label", "admin-check path-self");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = p.complete;
      box.addEventListener("change", function () {
        const change = {};
        change[step.id] = box.checked;
        remember(change);
        draw();
      });
      label.appendChild(box);
      label.appendChild(el("span", null, step.self));
      body.appendChild(label);
      const tips = el("button", "btn btn-secondary btn-small", "Show me the tips");
      tips.type = "button";
      tips.addEventListener("click", function () { app.showOnly("cross", [], ""); });
      body.appendChild(tips);
    } else {
      const bar = el("div", "path-bar");
      const fill = el("div", "path-fill");
      fill.style.width = (p.total ? Math.round(p.done / p.total * 100) : 0) + "%";
      bar.appendChild(fill);
      body.appendChild(bar);

      const go = el("button", "btn btn-primary btn-small",
        p.done ? "Show me what is left" : "Show me these " + p.total);
      go.type = "button";
      go.addEventListener("click", function () {
        app.showOnly(step.stage, idsOf(step), step.title.toLowerCase());
      });
      body.appendChild(go);
    }

    if (state === "done" && step.milestone) {
      body.appendChild(el("p", "path-milestone", "🎉 " + step.milestone));
    }
    return body;
  }

  app.onChange(draw);
  draw();

  window.CFOPPath = {
    STEPS: STEPS, idsOf: idsOf, progressOf: progressOf, currentIndex: currentIndex,
    firstCase: firstCase,
  };
})();
