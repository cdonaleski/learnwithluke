/**
 * The cube in three dimensions, with turns that actually turn.
 *
 * Twenty-six little cubes. A move gathers the nine (or eighteen, or all
 * twenty-six) that its slab covers into a pivot, swings the pivot through a
 * quarter turn, and then -- this is the part that matters -- throws the
 * animation away and repaints every sticker from the real cube state. The
 * picture can drift during a swing by a thousandth of a degree and it does not
 * matter, because nothing accumulates: the state says where every colour is,
 * and the state is arithmetic.
 *
 * Which way to swing is not guessed. cube.js defines each turn as an axis, a
 * set of slabs and a direction, and a quarter turn the cube.js way round is a
 * quarter turn of -way about that axis here. One definition, both views.
 */
(function () {
  "use strict";

  const C = window.Cube;

  const STICKER_HEX = {
    U: 0xffd500, D: 0xffffff, F: 0x009b48, B: 0x0046ad, L: 0xff5800, R: 0xb71234,
  };
  const BODY_HEX = 0x1c1a17;
  const AXIS_INDEX = { x: 0, y: 1, z: 2 };

  /**
   * Which mesh face of a box at `spot` shows sticker `i`, for every sticker.
   * Three.js orders a box's materials +x, -x, +y, -y, +z, -z.
   */
  function faceSlot(normal) {
    if (normal[0] === 1) return 0;
    if (normal[0] === -1) return 1;
    if (normal[1] === 1) return 2;
    if (normal[1] === -1) return 3;
    if (normal[2] === 1) return 4;
    return 5;
  }

  /** The paint plan: for each sticker number, which cubie and which face. */
  function paintPlan() {
    return C.STICKERS.map(function (s) {
      return { spot: s.spot, face: faceSlot(s.normal) };
    });
  }

  /** How one move animates: which cubies, about which axis, through what angle. */
  function swingOf(move) {
    const turn = C.TURNS[move.name];
    const quarter = -turn.way * Math.PI / 2;
    return {
      axis: turn.axis,
      slabs: turn.slabs,
      angle: move.back ? -quarter : quarter,
    };
  }

  function makeView(holder) {
    if (!window.THREE) return null;
    const view = {
      holder: holder,
      scene: new THREE.Scene(),
      cubies: [],
      pivot: new THREE.Group(),
      swing: null,
      plan: paintPlan(),
    };

    const width = holder.clientWidth || 320;
    const height = Math.round(width * 0.85);
    view.camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 100);
    view.camera.position.set(4.4, 4.6, 6.2);
    view.camera.lookAt(0, 0, 0);

    view.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    view.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    view.renderer.setSize(width, height);
    holder.appendChild(view.renderer.domElement);

    if (window.THREE.OrbitControls) {
      view.controls = new THREE.OrbitControls(view.camera, view.renderer.domElement);
      view.controls.enableZoom = false;
      view.controls.enablePan = false;
    }

    const light = new THREE.AmbientLight(0xffffff, 1.0);
    view.scene.add(light);
    const sun = new THREE.DirectionalLight(0xffffff, 0.35);
    sun.position.set(4, 8, 6);
    view.scene.add(sun);
    view.scene.add(view.pivot);

    // Twenty-six cubies (the middle of the middle is never seen, but one more
    // box costs nothing and keeps the indexing simple).
    const shape = new THREE.BoxGeometry(0.94, 0.94, 0.94);
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const materials = [];
          for (let f = 0; f < 6; f++) {
            materials.push(new THREE.MeshLambertMaterial({ color: BODY_HEX }));
          }
          const box = new THREE.Mesh(shape, materials);
          box.position.set(x, y, z);
          box.userData.home = [x, y, z];
          view.scene.add(box);
          view.cubies.push(box);
        }
      }
    }

    view.paint = function (state) {
      // Everything back to its grid place, all faces body-coloured...
      view.cubies.forEach(function (box) {
        box.position.set(box.userData.home[0], box.userData.home[1], box.userData.home[2]);
        box.rotation.set(0, 0, 0);
        box.material.forEach(function (m) { m.color.setHex(BODY_HEX); });
      });
      // ...then each sticker painted where the state says it is.
      view.plan.forEach(function (p, i) {
        const box = view.cubies.find(function (b) {
          return b.userData.home[0] === p.spot[0] && b.userData.home[1] === p.spot[1] &&
                 b.userData.home[2] === p.spot[2];
        });
        box.material[p.face].color.setHex(STICKER_HEX[state[i]]);
      });
    };

    /**
     * Swings one move over `ms`, then calls back. The caller repaints from the
     * new state afterwards, so nothing this does can leave a mark.
     */
    view.animate = function (move, ms, done) {
      if (view.swing) view.finishSwing();
      const plan = swingOf(move);
      const caught = view.cubies.filter(function (box) {
        return plan.slabs.indexOf(box.userData.home[AXIS_INDEX[plan.axis]]) !== -1;
      });
      caught.forEach(function (box) { view.pivot.attach(box); });
      view.swing = {
        caught: caught, axis: plan.axis, angle: plan.angle,
        started: performance.now(), ms: Math.max(1, ms), done: done,
      };
      // Frames stop in a tab nobody is looking at, and the swing lands on a
      // frame -- so without this, switching tabs mid-swing would leave the
      // player waiting for ever for a move that never finishes. Timers keep
      // running where frames do not, so the landing is guaranteed either way;
      // finishSwing does nothing if the frame got there first.
      window.setTimeout(view.finishSwing, ms + 200);
    };

    view.finishSwing = function () {
      const swing = view.swing;
      if (!swing) return;
      view.swing = null;
      swing.caught.forEach(function (box) { view.scene.attach(box); });
      view.pivot.rotation.set(0, 0, 0);
      if (swing.done) swing.done();
    };

    view.tick = function () {
      if (view.swing) {
        const swing = view.swing;
        const t = Math.min(1, (performance.now() - swing.started) / swing.ms);
        const eased = 1 - Math.pow(1 - t, 3);
        view.pivot.rotation.set(0, 0, 0);
        view.pivot.rotation[swing.axis] = swing.angle * eased;
        if (t >= 1) view.finishSwing();
      }
      if (view.controls) view.controls.update();
      view.renderer.render(view.scene, view.camera);
    };

    view.resize = function () {
      const w = holder.clientWidth || 320;
      const h = Math.round(w * 0.85);
      view.camera.aspect = w / h;
      view.camera.updateProjectionMatrix();
      view.renderer.setSize(w, h);
    };

    return view;
  }

  window.CFOP3D = { makeView: makeView, swingOf: swingOf, paintPlan: paintPlan, faceSlot: faceSlot };
})();
