/**
 * The dice, as actual solids.
 *
 * Everything here is worked out rather than drawn: give it the corners of a
 * shape and it finds the faces, works out which way each one points, and
 * produces the CSS that stands each face up in 3D. So the d20 really is
 * twenty triangles arranged in space, not a picture of one.
 *
 * Coordinates follow the browser's: x to the right, y DOWNWARDS, z towards
 * you. "Up" is therefore [0, -1, 0], which trips up anyone reading this
 * expecting school maths.
 *
 * Every solid is scaled so its furthest corner is 1 unit from the middle, and
 * a die's box is 2 units across. That means a length in these coordinates is
 * half the die's width, and the CSS can be written in terms of --size so the
 * shapes stay right at any size.
 */
(function () {
  "use strict";

  const PHI = (1 + Math.sqrt(5)) / 2;
  const EPS = 1e-9;

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0],
  ];
  const len = (a) => Math.sqrt(dot(a, a));
  const unit = (a) => mul(a, 1 / len(a));
  const gap = (a, b) => len(sub(a, b));

  function middle(points) {
    const sum = points.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0]);
    return mul(sum, 1 / points.length);
  }

  /** Scales a set of corners so the furthest one sits exactly 1 unit out. */
  function fit(points) {
    const reach = Math.max.apply(null, points.map(len));
    return points.map((p) => mul(p, 1 / reach));
  }

  /* ---------- The corners ---------- */

  function tetrahedron() {
    return fit([[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]]);
  }

  function octahedron() {
    return fit([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]);
  }

  function icosahedron() {
    const out = [];
    [-1, 1].forEach((a) => [-1, 1].forEach((b) => {
      out.push([0, a, b * PHI], [a, b * PHI, 0], [b * PHI, 0, a]);
    }));
    return fit(out);
  }

  /**
   * Triangular faces, found rather than listed: on a solid built from equal
   * triangles, three corners form a face exactly when all three are as close
   * to each other as any two corners get.
   */
  function trianglesOf(points) {
    let shortest = Infinity;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) shortest = Math.min(shortest, gap(points[i], points[j]));
    }
    const touching = (i, j) => Math.abs(gap(points[i], points[j]) - shortest) < 1e-6;
    const faces = [];
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        if (!touching(i, j)) continue;
        for (let k = j + 1; k < points.length; k++) {
          if (touching(i, k) && touching(j, k)) faces.push([i, j, k]);
        }
      }
    }
    return faces;
  }

  /**
   * The twelve-sided die is the twenty-sided one turned inside out: put a
   * corner where each of the icosahedron's faces was, and the faces that
   * appear are the twelve pentagons.
   */
  function dodecahedron() {
    const ico = icosahedron();
    const corners = fit(trianglesOf(ico).map((f) => middle(f.map((i) => ico[i]))));
    const faces = ico.map(function (direction) {
      const towards = unit(direction);
      return corners
        .map((p, i) => [dot(p, towards), i])
        .sort((a, b) => b[0] - a[0])
        .slice(0, 5)
        .map((entry) => entry[1]);
    });
    return { points: corners, faces: faces };
  }

  /**
   * A ten-sided die is not a Platonic solid: it is two rings of five kites
   * meeting at a point top and bottom, which is why its edge zigzags round the
   * middle instead of running straight.
   */
  function trapezohedron() {
    const ring = 1, tip = 1.2;
    /**
     * Where the two rings sit is not free. For the kites to be flat -- and a
     * face that is not flat is not a face -- the rings have to sit this far
     * off the middle relative to the points, and no other distance will do.
     * Falls out of asking that one kite's four corners share a plane.
     */
    const band = tip * (1 - Math.cos(Math.PI / 5)) / (1 + Math.cos(Math.PI / 5));
    const points = [[0, -tip, 0], [0, tip, 0]];      // north (up is -y), south
    for (let i = 0; i < 5; i++) {
      const a = (i * 72) * Math.PI / 180;
      points.push([ring * Math.sin(a), -band, ring * Math.cos(a)]);
    }
    for (let i = 0; i < 5; i++) {
      const a = (i * 72 + 36) * Math.PI / 180;
      points.push([ring * Math.sin(a), band, ring * Math.cos(a)]);
    }
    const up = (i) => 2 + (i % 5), down = (i) => 7 + (i % 5);
    const faces = [];
    for (let i = 0; i < 5; i++) faces.push([0, up(i), down(i), up(i + 1)]);
    for (let i = 0; i < 5; i++) faces.push([1, down(i), up(i + 1), down(i + 1)]);
    return { points: fit(points), faces: faces };
  }

  /* ---------- Turning corners into faces ---------- */

  /** Puts a face's corners in order around its outward side. */
  function inOrder(indices, points, normal, centre) {
    const across = unit(sub(points[indices[0]], centre));
    const other = cross(normal, across);
    return indices.slice().sort(function (a, b) {
      const pa = sub(points[a], centre), pb = sub(points[b], centre);
      return Math.atan2(dot(pa, other), dot(pa, across)) -
             Math.atan2(dot(pb, other), dot(pb, across));
    });
  }

  /** The shortest distance from a face's middle to any of its edges. */
  function roomInside(corners2d) {
    let best = Infinity;
    for (let i = 0; i < corners2d.length; i++) {
      const a = corners2d[i], b = corners2d[(i + 1) % corners2d.length];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const span = dx * dx + dy * dy;
      let t = span ? -(a[0] * dx + a[1] * dy) / span : 0;
      t = Math.max(0, Math.min(1, t));
      best = Math.min(best, Math.hypot(a[0] + t * dx, a[1] + t * dy));
    }
    return best;
  }

  /** Is a point inside this face? Counts how often a ray leaving it crosses an edge. */
  function within(polygon, x, y) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j];
      if ((a[1] > y) !== (b[1] > y) &&
          x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }

  /**
   * The largest font this face can carry. Digits are roughly 0.58 of the font
   * size wide each and 0.74 tall, so the box grows until one of its corners
   * leaves the face.
   */
  function biggestNumber(polygon, digits) {
    let low = 0, high = 200;
    for (let step = 0; step < 40; step++) {
      const size = (low + high) / 2;
      const w = size * 0.58 * digits, h = size * 0.37;
      const fits = [[-w, -h], [w, -h], [-w, h], [w, h]]
        .every((c) => within(polygon, c[0], c[1]));
      if (fits) low = size; else high = size;
    }
    return Math.round(low * 0.92 * 10) / 10;   // a little breathing room
  }

  function describe(points, faceIndices) {
    return faceIndices.map(function (indices) {
      const corners = indices.map((i) => points[i]);
      const centre = middle(corners);
      let normal = unit(cross(sub(corners[1], corners[0]), sub(corners[2], corners[0])));
      if (dot(normal, centre) < 0) normal = mul(normal, -1);
      const ordered = inOrder(indices, points, normal, centre);

      // Which way is up on this face. Straight up, leaned into the face's own
      // plane -- so a number written on it comes out the right way round when
      // that face is the one you are looking at.
      const worldUp = [0, -1, 0];
      let up = sub(worldUp, mul(normal, dot(worldUp, normal)));
      if (len(up) < 1e-6) up = sub([0, 0, 1], mul(normal, dot([0, 0, 1], normal)));
      up = unit(up);
      const right = cross(normal, up);

      const flat = ordered.map(function (i) {
        const away = sub(points[i], centre);
        return [dot(away, right), -dot(away, up)];   // SVG's y runs downwards
      });

      return {
        corners: ordered, centre: centre, normal: normal, up: up, right: right,
        flat: flat, room: roomInside(flat),
      };
    });
  }

  /* ---------- Numbering ---------- */

  /**
   * Opposite faces add up to one more than the number of sides, as they do on
   * a real die. A tetrahedron has no opposite faces -- every face is across
   * from a corner -- so its numbers just run in order.
   */
  function numberFaces(faces) {
    const total = faces.length;
    const number = new Array(total).fill(0);
    let next = 1;
    for (let i = 0; i < total; i++) {
      if (number[i]) continue;
      const facing = faces.findIndex((f, j) => j !== i && dot(f.normal, faces[i].normal) < -0.999);
      number[i] = next;
      if (facing !== -1) number[facing] = total + 1 - next;
      next += 1;
      while (next <= total && number.indexOf(next) !== -1) next += 1;
    }
    return number;
  }

  /* ---------- CSS ---------- */

  const round = (n) => Math.round(n * 100000) / 100000;

  /** A rotation given as where it sends each axis, written the way CSS wants it. */
  function matrix3d(colX, colY, colZ) {
    return "matrix3d(" + [
      colX[0], colX[1], colX[2], 0,
      colY[0], colY[1], colY[2], 0,
      colZ[0], colZ[1], colZ[2], 0,
      0, 0, 0, 1,
    ].map(round).join(",") + ")";
  }

  /** Stands one face up in space: its own middle, pointing its own way. */
  function faceTransform(face) {
    const c = face.centre;
    // A length here is half the die's width, so the shape follows --size.
    const move = "translate3d(" +
      ["calc(var(--size) * " + round(c[0] / 2) + ")",
       "calc(var(--size) * " + round(c[1] / 2) + ")",
       "calc(var(--size) * " + round(c[2] / 2) + ")"].join(", ") + ")";
    // Across the face, down the face, out of the face.
    return move + " " + matrix3d(face.right, mul(face.up, -1), face.normal);
  }

  /**
   * How to turn the whole solid so a given face ends up facing you the right
   * way up. It is the face's own three directions read back off it.
   */
  function landingTransform(face) {
    const u = face.right, d = mul(face.up, -1), n = face.normal;
    return matrix3d([u[0], d[0], n[0]], [u[1], d[1], n[1]], [u[2], d[2], n[2]]);
  }

  /* ---------- Lighting ---------- */

  function rotX(deg) {
    const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return [[1, 0, 0], [0, c, -s], [0, s, c]];
  }
  function rotY(deg) {
    const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return [[c, 0, s], [0, 1, 0], [-s, 0, c]];
  }
  function times(m, n) {
    const out = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      out[i][j] = m[i][0] * n[0][j] + m[i][1] * n[1][j] + m[i][2] * n[2][j];
    }
    return out;
  }
  function apply(m, v) {
    return [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
  }

  /** Rotation matching a face's landing transform, for working out the light. */
  function landingMatrix(face) {
    return [face.right, mul(face.up, -1), face.normal];
  }

  const SOLIDS = {
    d4: function () { const p = tetrahedron(); return { points: p, faces: trianglesOf(p) }; },
    d8: function () { const p = octahedron(); return { points: p, faces: trianglesOf(p) }; },
    d10: trapezohedron,
    d12: dodecahedron,
    d20: function () { const p = icosahedron(); return { points: p, faces: trianglesOf(p) }; },
  };

  /** How much room a number needs, as a share of the die's width. */
  const DIGITS = { d4: 1, d8: 1, d10: 2, d12: 2, d20: 2 };

  const cache = {};

  function build(id) {
    if (cache[id]) return cache[id];
    const raw = SOLIDS[id]();
    const points = raw.points;
    const faces = describe(points, raw.faces);
    const numbers = numberFaces(faces);

    // How big the number can be is measured, not guessed: grow a box the shape
    // of the digits until a corner of it crosses an edge of the face. A d20's
    // triangles are small, so its numbers are small, exactly as on a real one.
    const font = Math.min.apply(null, faces.map(function (face) {
      return biggestNumber(face.flat.map((p) => [p[0] * 50, p[1] * 50]), DIGITS[id]);
    }));

    cache[id] = {
      id: id,
      sides: faces.length,
      faces: faces.map(function (face, i) {
        return {
          number: numbers[i],
          normal: face.normal,
          centre: face.centre,
          corners: face.corners.map((c) => points[c]),
          points: face.flat.map((p) => round(p[0] * 50) + "," + round(p[1] * 50)).join(" "),
          transform: faceTransform(face),
          landing: landingTransform(face),
          rotation: landingMatrix(face),
        };
      }),
      font: round(font),
    };
    return cache[id];
  }

  window.Polyhedra = {
    build: build,
    ids: Object.keys(SOLIDS),
    rotX: rotX, rotY: rotY, times: times, apply: apply,
    dot: dot, unit: unit, len: len, sub: sub, cross: cross, middle: middle,
  };
})();
