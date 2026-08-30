/**
 * The rolling cube, on its own so more than one page can use it.
 *
 * This was built for the Dice Roller and then wanted again by Number Knockout.
 * Rather than a second cube that looks nearly the same and drifts away from the
 * first, there is one cube here and both pages ask for it. The styles that go
 * with it live in css/dice3d.css, and the two belong together: the faces are
 * pushed out by half of --size, which the stylesheet sets.
 *
 * Opposite faces add up to seven, as they do on a real die.
 */
(function () {
  "use strict";

  /** Which pips are lit for each number, as positions in a three-by-three grid. */
  const PIPS = {
    1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
  };

  /**
   * Which face of the cube carries which number. Opposite faces of a real die
   * add up to 7, and these do: 1/6 front and back, 3/4 right and left,
   * 2/5 top and bottom.
   */
  const CUBE_FACES = [
    { value: 1, side: "front" }, { value: 6, side: "back" },
    { value: 3, side: "right" }, { value: 4, side: "left" },
    { value: 2, side: "top" }, { value: 5, side: "bottom" },
  ];

  /**
   * How far to turn the whole cube to bring each number to the front. These are
   * the inverses of the face placements: the top face is pushed up by
   * rotateX(90deg), so tipping the cube back by -90deg brings it forward.
   */
  const CUBE_ANGLES = {
    1: [0, 0], 2: [-90, 0], 3: [0, -90], 4: [0, 90], 5: [90, 0], 6: [0, -180],
  };

  /** One fair die. Math.floor over a uniform random gives every face equal odds. */
  function rollDie(sides) {
    return 1 + Math.floor(Math.random() * (sides || 6));
  }

  /** A cube, six faces of pips, ready to be dropped into a tray. */
  function buildCube() {
    const cube = document.createElement("span");
    cube.className = "die-cube";
    CUBE_FACES.forEach(function (face) {
      const side = document.createElement("span");
      side.className = "cube-face cube-face--" + face.side;
      for (let i = 0; i < 9; i++) {
        const pip = document.createElement("span");
        pip.className = "pip" + (PIPS[face.value].indexOf(i) !== -1 ? " is-on" : "");
        side.appendChild(pip);
      }
      cube.appendChild(side);
    });
    return cube;
  }

  /**
   * The transform that brings `value` to the front, plus whatever spin the die
   * has built up. Whole extra turns land on the same face but make the cube
   * spin to get there.
   */
  function cubeTransform(value, die) {
    const angles = CUBE_ANGLES[value] || CUBE_ANGLES[1];
    return "rotateX(" + ((die.spinX || 0) + angles[0]) + "deg) rotateY(" +
      ((die.spinY || 0) + angles[1]) + "deg)";
  }

  /**
   * A whole die: the outer box that hops, the stage that holds it at an angle,
   * and the cube itself. Returns the pieces the caller needs to spin it.
   */
  function makeDie(extraClass) {
    const root = document.createElement("span");
    root.className = "die die--cube" + (extraClass ? " " + extraClass : "");
    const stage = document.createElement("span");
    stage.className = "die-stage";
    const cube = buildCube();
    stage.appendChild(cube);
    root.appendChild(stage);
    return { root: root, cube: cube, spinX: 0, spinY: 0 };
  }

  /** Spins a die to show `value`, adding whole turns so it tumbles on the way. */
  function spinTo(die, value, still) {
    if (!still) {
      die.spinX += 360 * (1 + Math.floor(Math.random() * 2));
      die.spinY += 360 * (2 + Math.floor(Math.random() * 2));
      die.root.classList.add("is-rolling");
    }
    die.cube.style.transform = cubeTransform(value, die);
  }

  function settle(die) {
    die.root.classList.remove("is-rolling");
  }

  window.Dice3D = {
    PIPS: PIPS, CUBE_FACES: CUBE_FACES, CUBE_ANGLES: CUBE_ANGLES,
    rollDie: rollDie, buildCube: buildCube, cubeTransform: cubeTransform,
    makeDie: makeDie, spinTo: spinTo, settle: settle,
  };
})();
