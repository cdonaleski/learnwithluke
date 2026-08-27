/**
 * Robot Blocks — the puzzles.
 *
 * ADDING A LEVEL
 * --------------
 * Copy a block below. One new idea per level, and never two at once.
 *
 *   id       unique lowercase key (used to remember which levels are done)
 *   name     what the level button says
 *   teaches  one short line naming the new idea, shown above the grid
 *   grid     rows of characters, read top to bottom:
 *              "."  floor        "#"  wall
 *              "R"  robot start  "T"  treasure
 *   facing   which way the robot starts: "up" "right" "down" "left"
 *   blocks   which blocks the palette offers for this level
 *   par      the fewest blocks it can be done in - three stars if matched
 *   solution a known-good program, ONLY used by the offline tests to prove
 *            the level is solvable in `par` blocks. Never shown to the child.
 *
 * A level whose solution does not reach the treasure, or needs more blocks
 * than its par, fails the tests rather than reaching a child who would then
 * be stuck on something impossible.
 */
(function () {
  "use strict";

  window.RobotLevels = [
    {
      id: "straight",
      name: "1. Straight On",
      teaches: "A program is a list of steps. The robot does them in order.",
      grid: ["#####", "#R..T", "#####"],
      facing: "right",
      blocks: ["forward"],
      par: 3,
      solution: [{ type: "forward" }, { type: "forward" }, { type: "forward" }]
    },
    {
      id: "corner",
      name: "2. Round the Corner",
      teaches: "Turning does not move the robot. It only changes which way it faces.",
      grid: [
        "#####",
        "#..T#",
        "#.###",
        "#R###",
        "#####"
      ],
      facing: "up",
      blocks: ["forward", "right", "left"],
      par: 5,
      solution: [
        { type: "forward" }, { type: "forward" },
        { type: "right" }, { type: "forward" }, { type: "forward" }
      ]
    },
    {
      id: "hall",
      name: "3. The Long Hall",
      teaches: "Repeat does the same step again and again, so you only write it once.",
      grid: ["########", "#R.....T", "########"],
      facing: "right",
      blocks: ["forward", "repeat"],
      par: 2,
      solution: [{ type: "repeat", times: 6, body: [{ type: "forward" }] }]
    },
    {
      id: "steps",
      name: "4. Up the Steps",
      teaches: "A repeat can hold several steps. Find the bit that keeps happening.",
      grid: [
        "######",
        "###.T#",
        "##..##",
        "#..###",
        "#R####",
        "######"
      ],
      facing: "up",
      blocks: ["forward", "right", "left", "repeat"],
      par: 5,
      solution: [
        { type: "repeat", times: 3, body: [
          { type: "forward" }, { type: "right" }, { type: "forward" }, { type: "left" }
        ] }
      ]
    },
    {
      id: "staircase",
      name: "5. Down the Steps",
      teaches: "The same idea, going the other way. Change the turns around.",
      grid: [
        "########",
        "##T.####",
        "###..###",
        "####..##",
        "#####..#",
        "######R#",
        "########"
      ],
      facing: "up",
      blocks: ["forward", "right", "left", "repeat"],
      par: 5,
      solution: [
        { type: "repeat", times: 4, body: [
          { type: "forward" }, { type: "left" }, { type: "forward" }, { type: "right" }
        ] }
      ]
    },
    {
      id: "sensing",
      name: "6. Feel Your Way",
      teaches: "If path ahead only moves when the way is clear, so the robot can walk to a wall without counting.",
      grid: [
        "########",
        "#R.....#",
        "######.#",
        "######.#",
        "######T#",
        "########"
      ],
      facing: "right",
      blocks: ["forward", "right", "left", "repeat", "ifPath"],
      par: 7,
      solution: [
        { type: "repeat", times: 8, body: [{ type: "ifPath", body: [{ type: "forward" }] }] },
        { type: "right" },
        { type: "repeat", times: 8, body: [{ type: "ifPath", body: [{ type: "forward" }] }] }
      ]
    },
    {
      id: "untilfound",
      name: "7. Keep Going",
      teaches: "Until keeps going as long as it needs to. You do not have to count at all.",
      grid: ["##########", "#R.......T", "##########"],
      facing: "right",
      blocks: ["forward", "right", "left", "until"],
      par: 2,
      solution: [{ type: "until", body: [{ type: "forward" }] }]
    },
    {
      id: "maze",
      name: "8. The Long Way Round",
      teaches: "Everything at once. Walk to each wall, turn, and walk again.",
      grid: [
        "########",
        "#R.....#",
        "######.#",
        "#......#",
        "#.######",
        "#.....T#",
        "########"
      ],
      facing: "right",
      blocks: ["forward", "right", "left", "repeat", "until", "ifPath"],
      par: 19,
      solution: [
        { type: "repeat", times: 8, body: [{ type: "ifPath", body: [{ type: "forward" }] }] },
        { type: "right" },
        { type: "repeat", times: 8, body: [{ type: "ifPath", body: [{ type: "forward" }] }] },
        { type: "right" },
        { type: "repeat", times: 8, body: [{ type: "ifPath", body: [{ type: "forward" }] }] },
        { type: "left" },
        { type: "repeat", times: 8, body: [{ type: "ifPath", body: [{ type: "forward" }] }] },
        { type: "left" },
        { type: "repeat", times: 8, body: [{ type: "ifPath", body: [{ type: "forward" }] }] }
      ]
    }
  ];
})();
