/**
 * The circuit bench: the board you build on, and the drawing of it.
 *
 * Nothing here decides what the electricity does -- engine.js does that, and
 * this asks it. Which matters, because it means the picture can never disagree
 * with the answer: the dots move along a wire because that wire genuinely has
 * a current in it, and a bulb glows by however much power it is genuinely
 * getting.
 */
(function () {
  "use strict";

  const canvas = document.getElementById("board");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const P = window.CircuitParts;
  const E = window.CircuitEngine;
  const LEVELS = window.CircuitLevels;

  const SANDBOX = {
    id: "sandbox", title: "Free build",
    hint: "Everything is unlocked. Build whatever you like.",
    teach: "", w: 11, h: 7, fixed: [], start: [], sandbox: true,
    tray: { wire: 999, battery: 2, bulb: 6, motor: 3, switch: 6, switch3: 6, switch4: 3 },
    goal: null,
  };

  const el = {
    status: document.getElementById("status"),
    tools: document.getElementById("tools"),
    levelName: document.getElementById("level-name"),
    levelHint: document.getElementById("level-hint"),
    levelList: document.getElementById("level-list"),
    teach: document.getElementById("teach"),
    teachText: document.getElementById("teach-text"),
    next: document.getElementById("btn-next"),
    reset: document.getElementById("btn-reset"),
    rotate: document.getElementById("btn-rotate"),
    meter: document.getElementById("meter"),
  };

  const state = {
    level: null,
    board: null,
    locked: {},          // squares the lesson will not let you touch
    used: {},            // how many of each tray part is on the board
    tool: "flip",
    rot: 0,
    cursor: { x: 0, y: 0 },
    solved: false,
    run: null,
    cell: 48,
  };

  const DONE_KEY = "circuits-done";

  /* ---------------- Board ---------------- */

  function place(board, x, y, part, rot, st) {
    const cell = { part: part, rot: rot || 0, state: st || 0 };
    const squares = E.occupies(cell, x, y);
    board.cells.set(x + "," + y, cell);
    squares.slice(1).forEach(function (sq) {
      board.cells.set(sq[0] + "," + sq[1], { link: x + "," + y });
    });
    return squares;
  }

  /** Where a square's part actually lives, following a link back to its anchor. */
  function anchorAt(x, y) {
    const cell = state.board.cells.get(x + "," + y);
    if (!cell) return null;
    if (cell.link) {
      const bits = cell.link.split(",");
      return { key: cell.link, x: Number(bits[0]), y: Number(bits[1]), cell: state.board.cells.get(cell.link) };
    }
    return { key: x + "," + y, x: x, y: y, cell: cell };
  }

  function fits(x, y, part, rot) {
    const squares = E.occupies({ part: part, rot: rot }, x, y);
    return squares.every(function (sq) {
      if (sq[0] < 0 || sq[1] < 0 || sq[0] >= state.level.w || sq[1] >= state.level.h) return false;
      if (state.locked[sq[0] + "," + sq[1]]) return false;
      return true;
    });
  }

  /** How many of a part's terminals would meet a terminal facing back at them. */
  function meetings(x, y, part, rot) {
    if (!fits(x, y, part, rot)) return -1;
    const cell = { part: part, rot: rot };
    return E.placedWires(cell, x, y).filter(function (w) {
      const to = P.step(w.x, w.y, w.dir);
      const other = anchorAt(to[0], to[1]);
      if (!other || other.key === x + "," + y) return false;
      return E.placedWires(other.cell, other.x, other.y).some(function (o) {
        return o.x === to[0] && o.y === to[1] && o.dir === P.facing(w.dir);
      });
    }).length;
  }

  /**
   * Which way up to drop a piece. A six-year-old dropping a switch into a
   * gap that runs up and down should get a switch that fits the gap, not one
   * lying on its side joined to nothing. Clicking it again still turns it, so
   * nothing is taken away by choosing well the first time.
   */
  function bestRotation(x, y, part) {
    let bestRot = state.rot, most = meetings(x, y, part, state.rot);
    for (let by = 1; by < 4; by++) {
      const rot = (state.rot + by) % 4;
      const count = meetings(x, y, part, rot);
      if (count > most) { most = count; bestRot = rot; }
    }
    return most < 0 ? state.rot : bestRot;
  }

  function remove(x, y) {
    const found = anchorAt(x, y);
    if (!found || state.locked[found.key]) return false;
    E.occupies(found.cell, found.x, found.y).forEach(function (sq) {
      state.board.cells.delete(sq[0] + "," + sq[1]);
    });
    return true;
  }

  function countUsed() {
    const used = {};
    state.board.cells.forEach(function (cell, at) {
      if (cell.link || state.locked[at]) return;
      used[cell.part] = (used[cell.part] || 0) + 1;
    });
    return used;
  }

  function left(part) {
    const allowed = (state.level.tray || {})[part];
    if (allowed === undefined) return 0;
    return allowed - (state.used[part] || 0);
  }

  /* ---------------- Loading a lesson ---------------- */

  function load(level) {
    state.level = level;
    state.board = { w: level.w, h: level.h, cells: new Map() };
    state.locked = {};
    state.solved = false;
    state.rot = 0;
    state.tool = "flip";
    state.cursor = { x: 0, y: 0 };

    (level.fixed || []).forEach(function (p) {
      place(state.board, p[0], p[1], p[2], p[3], p[4]).forEach(function (sq) {
        state.locked[sq[0] + "," + sq[1]] = true;
      });
    });
    (level.start || []).forEach(function (p) { place(state.board, p[0], p[1], p[2], p[3], p[4]); });

    el.levelName.textContent = level.title;
    el.levelHint.textContent = level.hint;
    el.teach.hidden = true;
    el.next.hidden = true;
    refresh();
    drawTools();
    fit();
    say(level.sandbox ? "Free build. Everything is unlocked." : level.hint);
  }

  /* ---------------- Running it ---------------- */

  function refresh() {
    state.used = countUsed();
    state.run = E.simulate(state.board);
    drawTools();
    meter();
    if (!state.solved && state.level.goal) {
      const met = E.goalMet(state.board, state.level.goal);
      if (met.pass) win();
    }
  }

  function meter() {
    const run = state.run;
    let text;
    if (run.short) text = "⚠️ Short circuit — " + run.amps.toFixed(0) + " amps. That would melt something.";
    else if (run.reason === "no-battery") text = "No battery yet.";
    else if (run.reason === "battery-loose") text = "The battery is not joined to anything.";
    else if (!run.ok) text = "Open circuit — nothing is flowing.";
    else text = "Flowing: " + run.amps.toFixed(2) + " amps";
    el.meter.textContent = text;
    el.meter.className = "meter" + (run.short ? " is-bad" : run.ok ? " is-live" : "");
  }

  function win() {
    state.solved = true;
    const done = remembered();
    if (done.indexOf(state.level.id) === -1) done.push(state.level.id);
    try { window.localStorage.setItem(DONE_KEY, JSON.stringify(done)); } catch (err) { /* fine */ }
    el.teachText.textContent = state.level.teach;
    el.teach.hidden = false;
    el.next.hidden = false;
    drawLevelList();
    say("That works! " + state.level.teach);
  }

  function remembered() {
    try { return JSON.parse(window.localStorage.getItem(DONE_KEY)) || []; }
    catch (err) { return []; }
  }

  function say(text) { el.status.textContent = text; }

  /* ---------------- Doing things to the board ---------------- */

  function act(x, y) {
    if (x < 0 || y < 0 || x >= state.level.w || y >= state.level.h) return;
    const found = anchorAt(x, y);

    if (state.tool === "flip") {
      if (!found) { say("Nothing there to flip. Pick a piece from the tray to build with."); return; }
      const part = P.list[found.cell.part];
      if (!part || !part.joins) { say("That one has nothing to flip."); return; }
      const wasSolved = state.solved;
      found.cell.state = ((found.cell.state || 0) + 1) % part.joins.length;
      refresh();
      if (state.solved === wasSolved) say(part.name + " flipped.");
      return;
    }

    if (state.tool === "erase") {
      if (!found) return;
      if (state.locked[found.key]) { say("That piece is part of the puzzle — it has to stay."); return; }
      const wasSolved = state.solved;
      remove(x, y);
      refresh();
      if (state.solved === wasSolved) say("Taken away.");
      return;
    }

    // A part is selected. Same part already here? Turn it. Otherwise place it.
    if (found && !state.locked[found.key] && found.cell.part === state.tool) {
      const was = found.cell;
      remove(found.x, found.y);
      if (fits(found.x, found.y, state.tool, (was.rot + 1) % 4)) {
        place(state.board, found.x, found.y, state.tool, (was.rot + 1) % 4, was.state);
        say(P.list[state.tool].name + " turned.");
      } else {
        place(state.board, found.x, found.y, state.tool, was.rot, was.state);
        say("No room to turn it there.");
      }
      refresh();
      return;
    }

    if (found && state.locked[found.key]) { say("That piece is part of the puzzle — it has to stay."); return; }
    if (left(state.tool) <= 0) { say("No " + P.list[state.tool].name.toLowerCase() + " left in the tray."); return; }
    if (![0, 1, 2, 3].some(function (r) { return fits(x, y, state.tool, r); })) {
      say("It will not fit there — it needs more room. Try somewhere else.");
      return;
    }

    if (found) remove(found.x, found.y);
    const rot = bestRotation(x, y, state.tool);
    const wasSolved = state.solved;
    place(state.board, x, y, state.tool, rot, 0);
    refresh();
    if (state.solved === wasSolved) {
      say(P.list[state.tool].name + " placed" + (rot === state.rot ? "" : ", turned to fit") +
        ". Click it again to turn it.");
    }
  }

  /* ---------------- The tray ---------------- */

  function drawTools() {
    if (!el.tools) return;
    el.tools.innerHTML = "";
    const tools = [{ id: "flip", name: "Flip", icon: "👆" }];
    Object.keys(state.level.tray || {}).forEach(function (part) {
      tools.push({ id: part, name: P.list[part].name, icon: P.list[part].icon, part: part });
    });
    tools.push({ id: "erase", name: "Throw away", icon: "🗑" });

    tools.forEach(function (tool) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tool" + (state.tool === tool.id ? " is-on" : "");
      const spare = tool.part ? left(tool.part) : null;
      if (tool.part && spare <= 0) button.classList.add("is-empty");
      button.innerHTML = '<span class="tool-icon" aria-hidden="true">' + tool.icon + "</span>" +
        '<span class="tool-name">' + tool.name + "</span>" +
        (tool.part && state.level.tray[tool.part] < 900
          ? '<span class="tool-left">' + spare + "</span>" : "");
      button.setAttribute("aria-pressed", String(state.tool === tool.id));
      button.title = tool.part ? P.list[tool.part].blurb : tool.name;
      button.addEventListener("click", function () {
        state.tool = tool.id;
        drawTools();
        say(tool.part ? P.list[tool.part].name + " picked up. " + P.list[tool.part].blurb
                      : tool.name + " chosen.");
      });
      el.tools.appendChild(button);
    });
  }

  function drawLevelList() {
    if (!el.levelList) return;
    const done = remembered();
    el.levelList.innerHTML = "";
    LEVELS.concat([SANDBOX]).forEach(function (level, i) {
      const button = document.createElement("button");
      button.type = "button";
      const isDone = done.indexOf(level.id) !== -1;
      button.className = "chip" + (state.level && state.level.id === level.id ? " is-on" : "") +
        (isDone ? " is-done" : "");
      button.textContent = (level.sandbox ? "🧰 " : isDone ? "✓ " : (i + 1) + ". ") + level.title;
      button.addEventListener("click", function () { load(level); drawLevelList(); });
      el.levelList.appendChild(button);
    });
  }

  /* ---------------- Drawing ---------------- */

  function fit() {
    const holder = canvas.parentNode;
    const wide = (holder && holder.clientWidth ? holder.clientWidth : 520) - 8;
    state.cell = Math.max(30, Math.min(74, Math.floor(wide / state.level.w)));
    const w = state.cell * state.level.w, h = state.cell * state.level.h;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const INK = "#4a4136", COPPER = "#c8792f", GLOW = "#ffd24a";

  function mid(x, y) { return [(x + 0.5) * state.cell, (y + 0.5) * state.cell]; }

  function edgePoint(x, y, dir) {
    const c = state.cell, cx = (x + 0.5) * c, cy = (y + 0.5) * c, half = c / 2;
    if (dir === "N") return [cx, cy - half];
    if (dir === "S") return [cx, cy + half];
    if (dir === "E") return [cx + half, cy];
    return [cx - half, cy];
  }

  function line(a, b, width, colour) {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineWidth = width;
    ctx.strokeStyle = colour;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  /** Beads of current, spaced out along a lead and moving at its own rate. */
  function beads(a, b, amps, now) {
    if (!amps || Math.abs(amps) < 0.005) return;
    const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (span < 1) return;
    const gap = state.cell * 0.42;
    const speed = Math.min(0.32, 0.05 + Math.abs(amps) * 0.16) * state.cell;
    let phase = (now * speed / 1000) % gap;
    if (amps < 0) phase = gap - phase;
    ctx.fillStyle = GLOW;
    for (let along = phase; along < span; along += gap) {
      const t = amps < 0 ? 1 - along / span : along / span;
      ctx.beginPath();
      ctx.arc(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, state.cell * 0.075, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawWire(x, y, cell, now) {
    const centre = mid(x, y);
    const spokes = [];
    P.DIRS.forEach(function (dir) {
      const to = P.step(x, y, dir);
      const other = anchorAt(to[0], to[1]);
      if (!other) return;
      const wires = E.placedWires(other.cell, other.x, other.y);
      if (!wires.some(function (w) { return w.x === to[0] && w.y === to[1] && w.dir === P.facing(dir); })) return;
      spokes.push(dir);
    });
    if (!spokes.length) {
      ctx.fillStyle = "#cbbfa8";
      ctx.beginPath();
      ctx.arc(centre[0], centre[1], state.cell * 0.1, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    spokes.forEach(function (dir) {
      const end = edgePoint(x, y, dir);
      line(end, centre, state.cell * 0.16, "#b98a4e");
      line(end, centre, state.cell * 0.09, COPPER);
      const amps = (state.run.flow || {})[x + "," + y + "|" + dir];
      beads(end, centre, amps, now);
    });
    if (spokes.length > 2) {
      ctx.fillStyle = COPPER;
      ctx.beginPath();
      ctx.arc(centre[0], centre[1], state.cell * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function leads(x, y, cell, part, keep) {
    const centre = mid(x, y);
    E.placedWires(cell, x, y).forEach(function (w) {
      if (keep && keep.indexOf(w.n) === -1) return;
      const end = edgePoint(w.x, w.y, w.dir);
      const toward = [centre[0] + (end[0] - centre[0]) * 0.55, centre[1] + (end[1] - centre[1]) * 0.55];
      line(end, toward, state.cell * 0.09, COPPER);
    });
  }

  function drawBattery(x, y, cell, now) {
    const c = state.cell, centre = mid(x, y);
    leads(x, y, cell, P.list.battery);
    const wires = E.placedWires(cell, x, y);
    const plus = wires.find(function (w) { return w.n === "plus"; });
    const across = (plus.dir === "E" || plus.dir === "W");
    const sign = (plus.dir === "E" || plus.dir === "S") ? 1 : -1;
    for (let i = 0; i < 2; i++) {
      const off = (i === 0 ? -1 : 1) * c * 0.11 * sign;
      const tall = i === 0 ? c * 0.16 : c * 0.28;   // short plate is the minus
      ctx.strokeStyle = INK;
      ctx.lineWidth = c * 0.075;
      ctx.beginPath();
      if (across) {
        ctx.moveTo(centre[0] + off, centre[1] - tall);
        ctx.lineTo(centre[0] + off, centre[1] + tall);
      } else {
        ctx.moveTo(centre[0] - tall, centre[1] + off);
        ctx.lineTo(centre[0] + tall, centre[1] + off);
      }
      ctx.stroke();
    }
    ctx.fillStyle = INK;
    ctx.font = "600 " + Math.round(c * 0.22) + "px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Along the lead towards the plus end, then pushed sideways off the wire so
    // it reads as a plus sign rather than as part of the wiring.
    const mark = edgePoint(x, y, plus.dir);
    const along = [(mark[0] - centre[0]) * 0.5, (mark[1] - centre[1]) * 0.5];
    ctx.fillText("+", centre[0] + along[0] - along[1] * 0.62, centre[1] + along[1] + along[0] * 0.62);
  }

  function drawBulb(x, y, cell, at, now) {
    const c = state.cell, centre = mid(x, y);
    leads(x, y, cell, P.list.bulb);
    const lit = (state.run.lit || {})[at] || 0;
    if (lit > 0.01) {
      // A softer curve than the raw power, so a quarter-power bulb still looks
      // like something rather than nothing. The number under it is honest.
      const shine = Math.pow(lit, 0.55);
      const halo = ctx.createRadialGradient(centre[0], centre[1], c * 0.1, centre[0], centre[1], c * 0.62);
      halo.addColorStop(0, "rgba(255,214,74," + (0.85 * shine) + ")");
      halo.addColorStop(1, "rgba(255,214,74,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(centre[0], centre[1], c * 0.62, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(centre[0], centre[1], c * 0.26, 0, Math.PI * 2);
    ctx.fillStyle = lit > 0.01
      ? "rgba(255," + Math.round(228 - 40 * (1 - lit)) + ",120," + (0.35 + 0.65 * Math.pow(lit, 0.55)) + ")"
      : "#f3ecdd";
    ctx.fill();
    ctx.lineWidth = c * 0.055;
    ctx.strokeStyle = INK;
    ctx.stroke();
    const r = c * 0.185;
    line([centre[0] - r, centre[1] - r], [centre[0] + r, centre[1] + r], c * 0.045, INK);
    line([centre[0] + r, centre[1] - r], [centre[0] - r, centre[1] + r], c * 0.045, INK);
    beads(edgePoint(x, y, E.placedWires(cell, x, y)[0].dir), centre, (state.run.current || {})[at], now);
  }

  function drawMotor(x, y, cell, at, now) {
    const c = state.cell, centre = mid(x, y);
    leads(x, y, cell, P.list.motor);
    const amps = (state.run.current || {})[at] || 0;
    ctx.beginPath();
    ctx.arc(centre[0], centre[1], c * 0.26, 0, Math.PI * 2);
    ctx.fillStyle = "#e9e1cf";
    ctx.fill();
    ctx.lineWidth = c * 0.055;
    ctx.strokeStyle = INK;
    ctx.stroke();
    const spin = amps ? (Date.now() / 1000) * amps * 9 : 0;
    ctx.save();
    ctx.translate(centre[0], centre[1]);
    ctx.rotate(spin);
    for (let i = 0; i < 3; i++) {
      ctx.rotate((Math.PI * 2) / 3);
      line([0, 0], [0, -c * 0.19], c * 0.05, amps ? COPPER : "#a89b83");
    }
    ctx.restore();
  }

  function drawSwitch(x, y, cell, at, now) {
    const c = state.cell, centre = mid(x, y);
    const wires = E.placedWires(cell, x, y);
    const a = edgePoint(wires[0].x, wires[0].y, wires[0].dir);
    const b = edgePoint(wires[1].x, wires[1].y, wires[1].dir);
    const near = function (p) { return [centre[0] + (p[0] - centre[0]) * 0.5, centre[1] + (p[1] - centre[1]) * 0.5]; };
    line(a, near(a), c * 0.09, COPPER);
    line(b, near(b), c * 0.09, COPPER);
    const on = (cell.state || 0) === 1;
    if (on) {
      line(near(a), near(b), c * 0.09, COPPER);
      beads(a, b, (state.run.current || {})[at], now);
    } else {
      // Lift the lever off its contact so the gap is unmistakable.
      const lift = [near(b)[0] + (centre[1] - near(b)[1]) * 0.55, near(b)[1] + (near(b)[0] - centre[0]) * 0.55];
      line(near(a), lift, c * 0.09, "#8d7f68");
    }
    [near(a), near(b)].forEach(function (dot) {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(dot[0], dot[1], c * 0.055, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawSwitch3(x, y, cell, at, now) {
    const c = state.cell, centre = mid(x, y);
    const wires = E.placedWires(cell, x, y);
    const spot = {};
    wires.forEach(function (w) { spot[w.n] = edgePoint(w.x, w.y, w.dir); });
    const near = function (p) { return [centre[0] + (p[0] - centre[0]) * 0.55, centre[1] + (p[1] - centre[1]) * 0.55]; };
    ["common", "up", "down"].forEach(function (n) { line(spot[n], near(spot[n]), c * 0.09, COPPER); });
    const chosen = (cell.state || 0) === 0 ? "up" : "down";
    line(near(spot.common), near(spot[chosen]), c * 0.095, COPPER);
    ["up", "down"].forEach(function (n) {
      ctx.fillStyle = n === chosen ? COPPER : "#a89b83";
      ctx.beginPath();
      ctx.arc(near(spot[n])[0], near(spot[n])[1], c * 0.06, 0, Math.PI * 2);
      ctx.fill();
    });
    beads(spot.common, spot[chosen], (state.run.current || {})[at], now);
  }

  function drawSwitch4(x, y, cell, at, now) {
    const c = state.cell;
    const squares = E.occupies(cell, x, y);
    // The body, drawn as one block across all three of its squares.
    const xs = squares.map(function (s) { return s[0]; }), ys = squares.map(function (s) { return s[1]; });
    const x0 = Math.min.apply(null, xs) * c + c * 0.16, y0 = Math.min.apply(null, ys) * c + c * 0.16;
    const x1 = (Math.max.apply(null, xs) + 1) * c - c * 0.16, y1 = (Math.max.apply(null, ys) + 1) * c - c * 0.16;
    ctx.fillStyle = "#efe7d6";
    ctx.strokeStyle = INK;
    ctx.lineWidth = c * 0.05;
    ctx.beginPath();
    ctx.rect(x0, y0, x1 - x0, y1 - y0);
    ctx.fill();
    ctx.stroke();

    const wires = E.placedWires(cell, x, y);
    const spot = {};
    wires.forEach(function (w) { spot[w.n] = edgePoint(w.x, w.y, w.dir); });
    const inward = function (p) {
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      return [p[0] + (cx - p[0]) * 0.3, p[1] + (cy - p[1]) * 0.3];
    };
    ["inA", "outA", "inB", "outB"].forEach(function (n) { line(spot[n], inward(spot[n]), c * 0.09, COPPER); });
    const crossed = (cell.state || 0) === 1;
    const pairs = crossed ? [["inA", "outB"], ["inB", "outA"]] : [["inA", "outA"], ["inB", "outB"]];
    pairs.forEach(function (pair) {
      line(inward(spot[pair[0]]), inward(spot[pair[1]]), c * 0.085, COPPER);
      beads(spot[pair[0]], spot[pair[1]], (state.run.current || {})[at], now);
    });
  }

  function draw(now) {
    const c = state.cell;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Pegboard
    ctx.fillStyle = "#f7f1e4";
    ctx.fillRect(0, 0, state.level.w * c, state.level.h * c);
    ctx.fillStyle = "#e2d8c4";
    for (let y = 0; y < state.level.h; y++) {
      for (let x = 0; x < state.level.w; x++) {
        const centre = mid(x, y);
        ctx.beginPath();
        ctx.arc(centre[0], centre[1], 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Locked squares get a faint wash so it is clear what cannot be moved.
    ctx.fillStyle = "rgba(150,135,105,0.09)";
    Object.keys(state.locked).forEach(function (at) {
      const bits = at.split(",");
      ctx.fillRect(Number(bits[0]) * c, Number(bits[1]) * c, c, c);
    });

    state.board.cells.forEach(function (cell, at) {
      if (cell.link) return;
      const bits = at.split(",");
      const x = Number(bits[0]), y = Number(bits[1]);
      const part = P.list[cell.part];
      if (!part) return;
      if (part.kind === "wire") drawWire(x, y, cell, now);
      else if (cell.part === "battery") drawBattery(x, y, cell, now);
      else if (cell.part === "bulb") drawBulb(x, y, cell, at, now);
      else if (cell.part === "motor") drawMotor(x, y, cell, at, now);
      else if (part.kind === "switch") drawSwitch(x, y, cell, at, now);
      else if (part.kind === "switch3") drawSwitch3(x, y, cell, at, now);
      else if (part.kind === "switch4") drawSwitch4(x, y, cell, at, now);
    });

    if (state.run && state.run.short) {
      ctx.strokeStyle = "rgba(214,69,52,0.75)";
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, state.level.w * c - 4, state.level.h * c - 4);
    }

    // Where the keyboard is pointing.
    ctx.strokeStyle = "#7a5cd6";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(state.cursor.x * c + 2, state.cursor.y * c + 2, c - 4, c - 4);

    window.requestAnimationFrame(draw);
  }

  /* ---------------- Hands and keyboard ---------------- */

  function cellFromEvent(event) {
    const box = canvas.getBoundingClientRect();
    const point = event.touches ? event.touches[0] : event;
    return {
      x: Math.floor((point.clientX - box.left) / state.cell),
      y: Math.floor((point.clientY - box.top) / state.cell),
    };
  }

  canvas.addEventListener("click", function (event) {
    const at = cellFromEvent(event);
    state.cursor = at;
    act(at.x, at.y);
  });

  canvas.addEventListener("keydown", function (event) {
    const moves = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (moves[event.code] || moves[event.key]) {
      const move = moves[event.code] || moves[event.key];
      state.cursor.x = Math.max(0, Math.min(state.level.w - 1, state.cursor.x + move[0]));
      state.cursor.y = Math.max(0, Math.min(state.level.h - 1, state.cursor.y + move[1]));
      event.preventDefault();
      const found = anchorAt(state.cursor.x, state.cursor.y);
      say(state.cursor.x + 1 + " across, " + (state.cursor.y + 1) + " down: " +
        (found ? P.list[found.cell.part].name : "empty"));
      return;
    }
    if (event.key === "Enter" || event.code === "Space") {
      event.preventDefault();
      act(state.cursor.x, state.cursor.y);
      return;
    }
    if (event.key === "r" || event.key === "R") { turn(); event.preventDefault(); }
  });

  function turn() {
    state.rot = (state.rot + 1) % 4;
    say("Turned a quarter turn. New pieces go in " +
      ["the way up they came", "on their side", "upside down", "on their other side"][state.rot] + ".");
  }

  if (el.rotate) el.rotate.addEventListener("click", turn);
  if (el.reset) el.reset.addEventListener("click", function () { load(state.level); drawLevelList(); });
  if (el.next) el.next.addEventListener("click", function () {
    const all = LEVELS.concat([SANDBOX]);
    const at = all.findIndex(function (l) { return l.id === state.level.id; });
    load(all[Math.min(all.length - 1, at + 1)]);
    drawLevelList();
  });

  window.addEventListener("resize", fit);

  /* ---------------- Go ---------------- */

  const done = remembered();
  const first = LEVELS.find(function (l) { return done.indexOf(l.id) === -1; }) || LEVELS[0];
  load(first);
  drawLevelList();
  window.requestAnimationFrame(draw);

  window.CircuitsApp = { state: state, load: load, act: act, LEVELS: LEVELS, SANDBOX: SANDBOX, left: left };
})();
