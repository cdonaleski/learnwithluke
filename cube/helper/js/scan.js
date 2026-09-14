/**
 * Scanning a cube with the camera -- no AI, and no pictures kept.
 *
 * The hard part of "read a cube from a photo" is finding the cube in the
 * photo. So we don't. A three-by-three guide sits over the picture, the kid
 * lines the face up in it -- half a second for a person, a research problem
 * for code -- and we read the colour at the middle of each of the nine
 * cells. Live from the camera the kid moves the cube into the guide; on a
 * photo they took already, they drag and size the guide onto the face.
 *
 * Telling the colours apart is where naive versions fail, always on red
 * against orange, always because of the light in the room. Two old tricks
 * fix most of it without a model:
 *
 *   1. The six CENTRE stickers are known colours as seen under THIS light --
 *      the centre of the green face is green, whatever the lamp is doing. So
 *      every other sticker is classified by which centre it is nearest to,
 *      not by a fixed idea of what "red" looks like.
 *   2. A cube has exactly nine of each colour. The fifty-four stickers are
 *      assigned all together under that rule, as a real minimum-cost
 *      assignment, so an orange that looked a bit red gets pushed to orange
 *      once red is full.
 *
 * Nobody holds the cube the way they were told, so after reading, every
 * turn of every face is tried and the one that makes a real cube is kept.
 * Then the Helper's own check has the final say, and a wrong sticker is
 * fixed the same way a mis-painted one is: tap it. The scanner names the
 * stickers it was least sure of, so the kid knows where to look.
 *
 * Faces once captured are kept until the kid says Start over (or resets the
 * Helper). Cancel only hides the scanner; a slip of the finger costs one
 * tap on the face to redo, never the other five.
 *
 * Privacy is built in rather than promised. A frame is drawn to a scratch
 * canvas, nine colours are read from it, and the canvas is wiped and its
 * memory released in the same call. A photo chosen from the gallery is
 * shown only until its face is read, then its reference is dropped and its
 * object URL revoked. Nothing image-shaped is stored, sent, or kept past
 * that moment; the camera is stopped the instant the scanner closes. There
 * are no image files anywhere to purge, because none are ever made. The one
 * thing a kid can choose to copy out is fifty-four colour numbers -- data,
 * not a picture -- so a mis-read can be fixed with real evidence.
 */
(function () {
  "use strict";

  /* ================================================================ */
  /* The pure part: turning colours into a cube. Testable on its own.  */
  /* ================================================================ */

  /**
   * `top` is the colour that should be at the TOP EDGE of the square for
   * that face: white for the four sides; and when the white top is tipped
   * towards the camera its back (blue) edge is uppermost, when the yellow
   * bottom is, its front (green) edge is. Shown on the guide itself, since
   * it is the one thing the words cannot point at.
   */
  const FACE_ORDER = [
    { face: "F", colour: "green",  top: "U", say: "Hold the cube with WHITE on top and the GREEN face towards the camera." },
    { face: "R", colour: "red",    top: "U", say: "Turn the cube to the left so the RED face is towards the camera. Keep white on top." },
    { face: "B", colour: "blue",   top: "U", say: "Keep turning — BLUE towards the camera, white still on top." },
    { face: "L", colour: "orange", top: "U", say: "Once more — ORANGE towards the camera, white on top." },
    { face: "U", colour: "white",  top: "B", say: "Green in front again. Now tip the cube back so the WHITE top faces the camera — blue edge at the top." },
    { face: "D", colour: "yellow", top: "F", say: "Tip it the other way so the YELLOW bottom faces the camera — green edge at the top." },
  ];

  const SWATCH = { U: "#f5f5f5", D: "#ffd500", F: "#009b48", B: "#0046ad", L: "#ff5800", R: "#b71234" };
  const NAME = { U: "white", D: "yellow", F: "green", B: "blue", L: "orange", R: "red" };
  const FACES = ["U", "R", "F", "D", "L", "B"];

  /**
   * A colour as three numbers the light in the room changes least: how red
   * and how green it is as a share of its brightness, and then a little of
   * the brightness itself -- enough to tell white from the rest, not so much
   * that a shadow moves a sticker across colours.
   */
  function features(rgb) {
    const sum = rgb[0] + rgb[1] + rgb[2] || 1;
    return [rgb[0] / sum, rgb[1] / sum, 0.5 * (sum / 3) / 255];
  }

  function distance(a, b) {
    const d0 = a[0] - b[0], d1 = a[1] - b[1], d2 = a[2] - b[2];
    return Math.sqrt(d0 * d0 + d1 * d1 + d2 * d2);
  }

  /** The middle value of each channel over a patch -- one glint does not sway it. */
  function medianOf(pixels) {
    const out = [];
    for (let ch = 0; ch < 3; ch++) {
      const sorted = pixels.map(function (p) { return p[ch]; }).sort(function (a, b) { return a - b; });
      out.push(sorted[Math.floor(sorted.length / 2)]);
    }
    return out;
  }

  /**
   * The cheapest way to give every row its own column -- the Hungarian
   * algorithm, in the compact form with potentials. Square cost matrix in,
   * one column per row out.
   *
   * It matters that this is the real thing and not "take the closest pairs
   * first": a very reddish orange can match red BETTER than some genuine
   * reds do, and a greedy pass hands it a red slot and pushes a true red into
   * orange later. Minimising the total cost sees that the swap costs more
   * overall and keeps both where they belong.
   */
  function hungarian(cost) {
    const n = cost.length;
    const INF = Number.POSITIVE_INFINITY;
    const u = new Array(n + 1).fill(0), v = new Array(n + 1).fill(0);
    const p = new Array(n + 1).fill(0), way = new Array(n + 1).fill(0);
    for (let i = 1; i <= n; i++) {
      p[0] = i;
      let j0 = 0;
      const minv = new Array(n + 1).fill(INF);
      const used = new Array(n + 1).fill(false);
      do {
        used[j0] = true;
        const i0 = p[j0];
        let delta = INF, j1 = 0;
        for (let j = 1; j <= n; j++) {
          if (used[j]) continue;
          const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
        for (let j = 0; j <= n; j++) {
          if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
          else minv[j] -= delta;
        }
        j0 = j1;
      } while (p[j0] !== 0);
      do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
    }
    const out = new Array(n);
    for (let j = 1; j <= n; j++) if (p[j]) out[p[j] - 1] = j - 1;
    return out;
  }

  /**
   * Six faces of nine sampled colours in, a cube state out.
   *
   * samples: { U: [[r,g,b] x9], R: ..., F, D, L, B }, each in the order the
   * Helper reads that face. The centres (index 4) are the references and are
   * fixed first, because they cannot be anything but themselves. The other
   * forty-eight stickers are then assigned to forty-eight slots -- eight per
   * colour -- so that the total distance to the references is as small as it
   * can be. That is the nine-of-each rule, applied properly.
   */
  function classify(samples) {
    const refs = {};
    FACES.forEach(function (f) { refs[f] = features(samples[f][4]); });

    const state = {};
    FACES.forEach(function (f) { state[f] = new Array(9).fill(null); state[f][4] = f; });

    const items = [];
    FACES.forEach(function (f) {
      samples[f].forEach(function (rgb, i) {
        if (i !== 4) items.push({ face: f, i: i, here: features(rgb) });
      });
    });
    const slots = [];
    FACES.forEach(function (colour) { for (let k = 0; k < 8; k++) slots.push(colour); });

    const cost = items.map(function (item) {
      return slots.map(function (colour) { return distance(item.here, refs[colour]); });
    });
    const chosen = hungarian(cost);
    items.forEach(function (item, r) { state[item.face][item.i] = slots[chosen[r]]; });
    return state;
  }

  /**
   * The stickers the reading was least sure of: the colour it was given is
   * barely nearer than another, or it sits unusually far from any centre at
   * all (a patch that missed the sticker reads like that). Named so the kid
   * knows exactly where to look, rather than being told "check it".
   */
  function doubts(samples, state) {
    const refs = {};
    FACES.forEach(function (f) { refs[f] = features(samples[f][4]); });
    const rows = [];
    FACES.forEach(function (f) {
      samples[f].forEach(function (rgb, i) {
        if (i === 4) return;
        const here = features(rgb);
        const given = state[f][i];
        const dGiven = distance(here, refs[given]);
        let alt = null, dAlt = Number.POSITIVE_INFINITY;
        FACES.forEach(function (c) {
          if (c === given) return;
          const d = distance(here, refs[c]);
          if (d < dAlt) { dAlt = d; alt = c; }
        });
        rows.push({ face: f, i: i, given: given, alt: alt, dGiven: dGiven, margin: dAlt - dGiven });
      });
    });
    const typical = rows.map(function (r) { return r.dGiven; }).sort(function (a, b) { return a - b; })[Math.floor(rows.length / 2)];
    return rows.filter(function (r) { return r.margin < 0.035 || r.dGiven > Math.max(0.12, typical * 3); })
      .sort(function (a, b) { return a.margin - b.margin; });
  }

  /** A face's nine stickers turned a quarter clockwise, k times. */
  function rotateFace(nine, k) {
    let out = nine;
    for (let t = 0; t < (k % 4 + 4) % 4; t++) {
      out = [out[6], out[3], out[0], out[7], out[4], out[1], out[8], out[5], out[2]];
    }
    return out;
  }

  /**
   * Nobody holds the cube the way they were told, and the fix is not to
   * nag them. Turning a face does not change which colours are on it, only
   * where they sit -- so the colours read are right and each face is simply
   * off by some quarter-turn. Four ways per face, 4,096 for six, and a real
   * cube is so constrained (every corner a genuine corner, every edge a
   * genuine edge) that nearly always exactly one of them is possible. So:
   * try them all and keep the one the Helper's own checker accepts.
   *
   * A face that is all one colour looks the same however it is turned, so
   * its turns are collapsed to one before the search -- and the way it was
   * actually held is tried first, so a correct capture is kept as it is.
   */
  /** A face's nine stickers seen in a mirror: left and right columns swapped. */
  function mirrorFace(nine) {
    return [nine[2], nine[1], nine[0], nine[5], nine[4], nine[3], nine[8], nine[7], nine[6]];
  }

  function searchTurns(state, check) {
    const options = FACES.map(function (f) {
      const seen = {}, list = [];
      for (let k = 0; k < 4; k++) {
        const turned = rotateFace(state[f], k);
        const key = turned.join("");
        if (!seen[key]) { seen[key] = true; list.push({ k: k, nine: turned }); }
      }
      return list;
    });

    const found = [];
    const seenStates = {};
    const idx = [0, 0, 0, 0, 0, 0];
    for (;;) {
      const cand = {}, turns = {};
      FACES.forEach(function (f, i) { cand[f] = options[i][idx[i]].nine; turns[f] = options[i][idx[i]].k; });
      const key = FACES.map(function (f) { return cand[f].join(""); }).join("|");
      if (!seenStates[key]) {
        seenStates[key] = true;
        if (check(cand).valid) found.push({ state: cand, turns: turns });
      }
      let p = 5;
      while (p >= 0) {
        idx[p] += 1;
        if (idx[p] < options[p].length) break;
        idx[p] = 0;
        p -= 1;
      }
      if (p < 0) break;
    }
    return found;
  }

  /**
   * Nobody holds the cube the way they were told, and the fix is not to
   * nag them. Turning a face does not change which colours are on it, only
   * where they sit -- so the colours read are right and each face is simply
   * off by some quarter-turn. Four ways per face, 4,096 for six, and a real
   * cube is so constrained (every corner a genuine corner, every edge a
   * genuine edge) that nearly always exactly one of them is possible. So:
   * try them all and keep the one the Helper's own checker accepts.
   *
   * A face that is all one colour looks the same however it is turned, so
   * its turns are collapsed to one before the search -- and the way it was
   * actually held is tried first, so a correct capture is kept as it is.
   *
   * A mirror is not a turn, and no amount of turning undoes one. The camera
   * is read un-mirrored, but some phones save a selfie the way a mirror
   * shows it -- so the whole cube is also mirrored and searched. Both
   * searches always run: about one mirrored scan in a hundred turns out to
   * form some OTHER real cube by coincidence, and if only the straight
   * search ran that wrong cube would be handed over silently. Running both
   * and counting every answer makes that case "more than one way -- check
   * it", which is the truth. Straight answers come first, because most
   * photographs are not mirrors.
   */
  function orient(state, check) {
    const straight = searchTurns(state, check);
    const flipped = {};
    FACES.forEach(function (f) { flipped[f] = mirrorFace(state[f]); });
    const viaMirror = searchTurns(flipped, check);
    // A cube that is its own mirror image -- a solved one, say -- is found by
    // both searches; that is one answer, not two.
    const seen = {};
    const found = straight.concat(viaMirror).filter(function (f) {
      const key = FACES.map(function (face) { return f.state[face].join(""); }).join("|");
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
    return {
      state: found.length ? found[0].state : null,
      turns: found.length ? found[0].turns : null,
      count: found.length,
      mirrored: straight.length === 0 && viaMirror.length > 0,
      candidates: found.map(function (f) { return f.state; }),
    };
  }

  /**
   * Nine colours from a drawable picture (a video frame or an image), read
   * inside one square of it: `square` is {left, top, side} in source pixels,
   * or absent for the centred 70% square the live guide shows. Each cell's
   * patch is the middle 40% of it, so a slightly wobbly hand still lands
   * inside the sticker.
   *
   * The picture is drawn to a scratch canvas, read, and the canvas is wiped
   * and sized to zero so the browser frees the bitmap -- the picture exists
   * for the length of this function and no longer.
   */
  function readNine(source, width, height, flip, square) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(source, 0, 0, width, height);

    const sq = square || (function () {
      const side = Math.min(width, height) * 0.7;
      return { left: (width - side) / 2, top: (height - side) / 2, side: side };
    })();
    const cell = sq.side / 3, patch = Math.max(2, cell * 0.4), step = Math.max(1, Math.floor(patch / 12));

    const out = [];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const c = flip ? 2 - col : col;
        const x0 = Math.round(sq.left + c * cell + (cell - patch) / 2);
        const y0 = Math.round(sq.top + row * cell + (cell - patch) / 2);
        const size = Math.max(1, Math.round(patch));
        const data = ctx.getImageData(x0, y0, size, size).data;
        const pixels = [];
        for (let y = 0; y < size; y += step) {
          for (let x = 0; x < size; x += step) {
            const k = (y * size + x) * 4;
            pixels.push([data[k], data[k + 1], data[k + 2]]);
          }
        }
        out.push(medianOf(pixels));
      }
    }

    ctx.clearRect(0, 0, width, height);
    canvas.width = 0;
    canvas.height = 0;
    return out;
  }

  window.CubeScan = {
    FACE_ORDER: FACE_ORDER, features: features, medianOf: medianOf, classify: classify,
    doubts: doubts, rotateFace: rotateFace, mirrorFace: mirrorFace, orient: orient, readNine: readNine,
  };

  /* ================================================================ */
  /* The page part: camera, guide, capture, review, hand-over.          */
  /* ================================================================ */

  const el = {
    open: document.getElementById("btn-scan"),
    reset: document.getElementById("btn-reset"),
    panel: document.getElementById("scan"),
    step: document.getElementById("scan-step"),
    stage: document.getElementById("scan-stage"),
    video: document.getElementById("scan-video"),
    photo: document.getElementById("scan-photo"),
    guide: document.getElementById("scan-guide"),
    handle: document.getElementById("scan-handle"),
    top: document.getElementById("scan-top"),
    centre: document.getElementById("scan-centre"),
    faces: document.getElementById("scan-faces"),
    capture: document.getElementById("scan-capture"),
    read: document.getElementById("scan-read"),
    file: document.getElementById("scan-file"),
    fileLabel: document.getElementById("scan-file-label"),
    use: document.getElementById("scan-use"),
    copy: document.getElementById("scan-copy"),
    restart: document.getElementById("scan-restart"),
    cancel: document.getElementById("scan-cancel"),
    note: document.getElementById("scan-note"),
    numbers: document.getElementById("scan-numbers"),
  };
  if (!el.open || !el.panel || !window.CubeHelper) return;

  const state = {
    stream: null, mirrored: false,
    at: 0,                 // which face is being asked for; 6 means all six are in
    samples: {},           // face letter -> nine colours; kept until Start over
    photo: null,           // {url, width, height} while a chosen photo is on screen
    guide: null,           // {x, y, size} in stage pixels while a photo is on screen
  };

  function say(text, bad) {
    el.note.textContent = text || "";
    el.note.hidden = !text;
    el.note.classList.toggle("is-bad", Boolean(bad));
  }

  /* ---------------- Camera ---------------- */

  async function startCamera() {
    if (state.stream) return;
    // Browsers hide the camera API on any address that is not "secure" --
    // localhost and https are; http://192.168... and file:// are not. Say so,
    // or a laptop with a perfectly good webcam gets told it has none.
    if (window.isSecureContext === false) {
      say("The camera only works on a secure address. On this computer open " +
          "http://localhost:8000/… ; on a phone use the live site (https). " +
          "Or pick a photo instead.", true);
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      say("This browser has no camera I can use — pick a photo instead.", true);
      return;
    }
    try {
      state.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
    } catch (err) {
      say("The camera said no. You can still pick a photo, or paint the stickers by hand.", true);
      return;
    }
    // A front camera's frame is NOT a mirror: a face held up to it reads the
    // way a person at the camera would read it, which is exactly how the
    // Helper reads a face. What feels like a mirror is that apps flip the
    // PREVIEW so moving your hand right moves it right on screen. So the
    // preview is flipped for comfort, and the pixels are read as they are --
    // flipping the read too would mirror every face, and no turn undoes a
    // mirror.
    const track = state.stream.getVideoTracks()[0];
    const settings = track && track.getSettings ? track.getSettings() : {};
    state.mirrored = settings.facingMode !== "environment";
    el.video.classList.toggle("is-mirrored", state.mirrored);
    el.video.srcObject = state.stream;
    try { await el.video.play(); } catch (err) { /* autoplay may need the tap; the guide still shows */ }
  }

  function stopCamera() {
    if (state.stream) state.stream.getTracks().forEach(function (t) { t.stop(); });
    state.stream = null;
    el.video.srcObject = null;
  }

  /* ---------------- Live capture ---------------- */

  function captureFromCamera() {
    if (!state.stream || !el.video.videoWidth) {
      say("No camera picture yet — give it a second, or pick a photo.", true);
      return;
    }
    // Read as the camera sees it -- never flipped, whatever the preview does.
    took(readNine(el.video, el.video.videoWidth, el.video.videoHeight, false));
  }

  /* ---------------- A photo, with the guide placed by hand ---------------- */

  function showPhoto(file) {
    if (!file || state.at >= FACE_ORDER.length) return;
    dropPhoto();
    const url = URL.createObjectURL(file);
    el.photo.onload = function () {
      state.photo = { url: url, width: el.photo.naturalWidth, height: el.photo.naturalHeight };
      el.video.hidden = true;
      el.photo.hidden = false;
      // Start the guide as the centred square; the kid drags it onto the face.
      const w = el.stage.clientWidth, h = el.stage.clientHeight;
      const size = Math.min(w, h) * 0.6;
      state.guide = { x: (w - size) / 2, y: (h - size) / 2, size: size };
      placeGuide();
      el.guide.classList.add("is-movable");
      el.handle.hidden = false;
      el.capture.hidden = true;
      el.read.hidden = false;
      say("Drag the square onto the " + FACE_ORDER[state.at].colour +
          " face and pull the corner to fit it, then press Read this face.");
    };
    el.photo.onerror = function () {
      URL.revokeObjectURL(url);
      say("I could not read that photo. Try another, or use the camera.", true);
    };
    el.photo.src = url;
    // Drop the browser's hold on the file the moment it has been handed over.
    el.file.value = "";
  }

  /** The photo leaves the screen and memory together. Nothing else changes. */
  function dropPhoto() {
    if (state.photo) URL.revokeObjectURL(state.photo.url);
    state.photo = null;
    state.guide = null;
    // Emptying the src fires the image's error handler, which would announce
    // a photo that "could not be read" when it was simply finished with.
    el.photo.onload = null;
    el.photo.onerror = null;
    el.photo.src = "";
    el.photo.hidden = true;
    el.video.hidden = false;
    el.guide.classList.remove("is-movable");
    el.guide.style.cssText = "";
    el.handle.hidden = true;
  }

  function placeGuide() {
    const g = state.guide;
    el.guide.style.left = g.x + "px";
    el.guide.style.top = g.y + "px";
    el.guide.style.width = g.size + "px";
    el.guide.style.height = g.size + "px";
    el.guide.style.inset = "auto";
  }

  /** Where the photo actually sits inside the stage (it is fitted, not cropped). */
  function photoRect() {
    const w = el.stage.clientWidth, h = el.stage.clientHeight;
    const scale = Math.min(w / state.photo.width, h / state.photo.height);
    const dw = state.photo.width * scale, dh = state.photo.height * scale;
    return { left: (w - dw) / 2, top: (h - dh) / 2, scale: scale };
  }

  function readFromPhoto() {
    if (!state.photo || !state.guide) return;
    const r = photoRect();
    const square = {
      left: (state.guide.x - r.left) / r.scale,
      top: (state.guide.y - r.top) / r.scale,
      side: state.guide.size / r.scale,
    };
    const nine = readNine(el.photo, state.photo.width, state.photo.height, false, square);
    dropPhoto();
    took(nine);
  }

  // Dragging the guide, and pulling its corner to size it. Pointer events
  // cover mouse and finger alike.
  let drag = null;
  function onDown(event) {
    if (!state.guide) return;
    const isHandle = event.target === el.handle;
    drag = { mode: isHandle ? "size" : "move", x: event.clientX, y: event.clientY, start: Object.assign({}, state.guide) };
    if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }
  function onMove(event) {
    if (!drag || !state.guide) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    const w = el.stage.clientWidth, h = el.stage.clientHeight;
    if (drag.mode === "move") {
      state.guide.x = Math.max(0, Math.min(w - state.guide.size, drag.start.x + dx));
      state.guide.y = Math.max(0, Math.min(h - state.guide.size, drag.start.y + dy));
    } else {
      const room = Math.min(w - drag.start.x, h - drag.start.y);
      state.guide.size = Math.max(40, Math.min(room, drag.start.size + Math.max(dx, dy)));
    }
    placeGuide();
  }
  function onUp() { drag = null; }

  /* ---------------- The six faces, kept until told otherwise ---------------- */

  /** The first face still to be read, or six when they are all in. */
  function nextMissing() {
    for (let i = 0; i < FACE_ORDER.length; i++) {
      if (!state.samples[FACE_ORDER[i].face]) return i;
    }
    return FACE_ORDER.length;
  }

  function took(nine) {
    state.samples[FACE_ORDER[state.at].face] = nine;
    say("");
    state.at = nextMissing();
    drawStep();
  }

  /**
   * Tap any face to read that one next -- done or not. Nothing is forgotten
   * by choosing; a face already in is only replaced when it is read again.
   * After it, the scanner goes on to the next face still missing, so
   * choosing out of order costs nothing.
   */
  function selectFace(i) {
    dropPhoto();
    state.at = i;
    say("");
    drawStep();
  }

  function drawStep() {
    const reviewing = state.at >= FACE_ORDER.length;
    el.capture.hidden = reviewing || Boolean(state.photo);
    el.read.hidden = reviewing || !state.photo;
    el.fileLabel.hidden = reviewing;
    el.use.hidden = !reviewing;
    el.copy.hidden = !reviewing;
    el.restart.hidden = Object.keys(state.samples).length === 0;
    el.guide.hidden = reviewing;
    el.numbers.hidden = true;

    if (reviewing) {
      el.step.textContent = "All six read. Check the little faces against your cube — " +
        "tap any that looks wrong to read it again. Then use it.";
    } else {
      const which = FACE_ORDER[state.at];
      el.step.textContent = "Face " + (state.at + 1) + " of 6 — " + which.say;
      el.centre.style.borderColor = SWATCH[which.face];
      el.centre.style.background = SWATCH[which.face] + "55";
      if (el.top) {
        el.top.textContent = NAME[which.top].toUpperCase() + " on top";
        el.top.style.background = SWATCH[which.top];
        el.top.style.color = which.top === "U" || which.top === "D" ? "#1f1d1a" : "#fff";
      }
    }
    drawFaces();
  }

  /** The faces done so far, as the colours actually read -- so a bad capture is visible at once. */
  function drawFaces() {
    el.faces.innerHTML = "";
    FACE_ORDER.forEach(function (which, i) {
      const done = Boolean(state.samples[which.face]);
      const box = document.createElement("button");
      box.type = "button";
      box.setAttribute("aria-label", (done ? "Read the " : "Read the ") + which.colour + " face" + (done ? " again" : " next"));
      box.setAttribute("aria-pressed", String(i === state.at));
      box.addEventListener("click", function () { selectFace(i); });
      box.className = "scan-face" + (i === state.at ? " is-now" : "") + (done ? " is-done" : "");
      box.title = done ? "Tap to read the " + which.colour + " face again" : "Tap to read the " + which.colour + " face next";
      const grid = document.createElement("div");
      grid.className = "scan-face-grid";
      const nine = state.samples[which.face];
      for (let k = 0; k < 9; k++) {
        const cell = document.createElement("span");
        if (nine) cell.style.background = "rgb(" + nine[k].join(",") + ")";
        grid.appendChild(cell);
      }
      box.appendChild(grid);
      const label = document.createElement("span");
      label.className = "scan-face-label";
      label.textContent = which.colour;
      box.appendChild(label);
      el.faces.appendChild(box);
    });
  }

  /** Where a sticker is, in words a kid can follow with a finger. */
  function whereIs(face, i) {
    const row = ["top", "middle", "bottom"][Math.floor(i / 3)];
    const col = ["left", "middle", "right"][i % 3];
    return NAME[face] + " face, " + (row === "middle" && col === "middle" ? "centre" : row + " " + col);
  }

  function finish() {
    const read = classify(state.samples);
    const fixed = orient(read, window.CubeHelper.check);
    const cube = fixed.state || read;
    const unsure = doubts(state.samples, read);

    window.CubeHelper.applyState(cube);
    hide();   // the faces stay; scanning again picks up at the review

    const hint = document.getElementById("cube-view-hint");
    if (!hint) return;
    let words;
    if (!fixed.state) {
      words = "<strong>Scanned, but</strong> no way of turning these six faces makes a real cube, " +
        "so a colour was mis-read. Pick the right colour and tap the wrong sticker — or open the " +
        "scanner again and tap the face to read it again.";
    } else if (fixed.count > 1) {
      words = "<strong>Scanned!</strong> More than one way of turning the faces made a real cube, " +
        "so I picked one — check it against yours, and tap any sticker that is wrong.";
    } else {
      words = "<strong>Scanned!</strong> Check it against your cube — if a sticker is wrong, " +
        "pick its colour and tap it, just like painting.";
    }
    if (fixed.state && fixed.mirrored) {
      words += " <em>Those pictures were mirror images (some phones save them that way) — " +
        "I have un-mirrored them.</em>";
    }
    if (unsure.length) {
      const named = unsure.slice(0, 4).map(function (d) {
        return whereIs(d.face, d.i) + " (read " + NAME[d.given] + ", might be " + NAME[d.alt] + ")";
      });
      words += " <em>Least sure about: " + named.join("; ") +
        (unsure.length > 4 ? "; and " + (unsure.length - 4) + " more" : "") + " — as they were in the photo.</em>";
    }
    hint.innerHTML = words;
  }

  /**
   * The numbers behind the reading -- fifty-four colour triples and what
   * they were called -- as text, for pasting to whoever is tuning this.
   * Data, not a picture: nothing here can be turned back into a photo.
   */
  function copyNumbers() {
    const text = JSON.stringify({ samples: state.samples, read: classify(state.samples) });
    el.numbers.value = text;
    el.numbers.hidden = false;
    el.numbers.select();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { say("Copied. Paste it wherever it is being looked at."); },
        function () { say("Select the text below and copy it."); });
    } else {
      say("Select the text below and copy it.");
    }
  }

  /* ---------------- Open, hide, start over ---------------- */

  function open() {
    state.at = nextMissing();    // carry on from wherever we were
    say("");
    el.panel.hidden = false;
    drawStep();
    startCamera();
    try { el.panel.scrollIntoView({ block: "start", behavior: "smooth" }); } catch (err) { /* fine */ }
  }

  /** Put the scanner away. The faces read so far are kept. */
  function hide() {
    stopCamera();
    dropPhoto();
    el.numbers.value = "";
    el.numbers.hidden = true;
    el.panel.hidden = true;
  }

  /** Forget every face. The only thing that does. */
  function startOver() {
    if (Object.keys(state.samples).length &&
        !window.confirm("Forget all the faces read so far and start again?")) return;
    dropPhoto();
    state.samples = {};
    state.at = 0;
    say("");
    if (!el.panel.hidden) drawStep();
  }

  el.open.addEventListener("click", open);
  el.capture.addEventListener("click", captureFromCamera);
  el.read.addEventListener("click", readFromPhoto);
  el.file.addEventListener("change", function () { showPhoto(el.file.files && el.file.files[0]); });
  el.use.addEventListener("click", finish);
  el.copy.addEventListener("click", copyNumbers);
  el.restart.addEventListener("click", startOver);
  el.cancel.addEventListener("click", hide);
  el.guide.addEventListener("pointerdown", onDown);
  el.guide.addEventListener("pointermove", onMove);
  el.guide.addEventListener("pointerup", onUp);
  el.guide.addEventListener("pointercancel", onUp);
  // The Helper's own Reset means "start fresh" -- for the scan too.
  if (el.reset) el.reset.addEventListener("click", function () { state.samples = {}; state.at = 0; dropPhoto(); });

  /**
   * Space captures. Holding a cube up to a camera with one hand and finding
   * a button with the other is the awkward part of the whole thing; the
   * biggest key on the board, hit without looking, is not. It reads the
   * photo if one is up, captures the frame otherwise, and does nothing on
   * the review screen -- using the cube is a decision, not a reflex.
   */
  window.addEventListener("keydown", function (event) {
    if (event.key !== " " || el.panel.hidden) return;
    const tag = event.target && event.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (state.at >= FACE_ORDER.length) return;
    event.preventDefault();
    if (state.photo) readFromPhoto(); else captureFromCamera();
  });
  // Leaving the page must not leave the camera light on.
  window.addEventListener("pagehide", stopCamera);
})();
