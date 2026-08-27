/**
 * Mini Golf — the course.
 *
 * ADDING A HOLE
 * -------------
 * Copy a block below. The course is 640 x 440 with a wall round the edge
 * already, so you only list the obstacles inside it.
 *
 *   name   what the scoreboard calls it
 *   tee    where the ball starts, [x, y]
 *   cup    where the hole is, [x, y]
 *   par    how many shots it should take
 *   walls  blocks to bounce off, each [x, y, width, height]
 *
 * The offline tests rasterise every hole and check the cup can actually be
 * reached from the tee without passing through a wall, and that neither the
 * ball nor the cup starts inside one. A hole that cannot be finished is the
 * one fault a child cannot work around.
 */
(function () {
  "use strict";

  window.GolfHoles = [
    {
      name: "1. Straight Away",
      tee: [80, 220], cup: [560, 220], par: 2,
      walls: []
    },
    {
      name: "2. The Gate",
      tee: [80, 220], cup: [560, 220], par: 2,
      walls: [[310, 20, 20, 150], [310, 270, 20, 150]]
    },
    {
      name: "3. Dog Leg",
      tee: [80, 360], cup: [560, 90], par: 3,
      walls: [[180, 20, 20, 280], [380, 160, 20, 260]]
    },
    {
      name: "4. The Corridor",
      tee: [70, 220], cup: [570, 220], par: 3,
      walls: [[200, 20, 20, 160], [200, 260, 20, 160],
              [400, 20, 20, 160], [400, 260, 20, 160]]
    },
    {
      name: "5. Island Block",
      tee: [80, 220], cup: [560, 220], par: 3,
      walls: [[280, 150, 80, 140]]
    },
    {
      name: "6. Zig Zag",
      tee: [70, 370], cup: [570, 70], par: 4,
      walls: [[150, 120, 20, 300], [300, 20, 20, 300], [450, 120, 20, 300]]
    },
    {
      name: "7. The Room",
      tee: [80, 370], cup: [520, 110], par: 4,
      walls: [[380, 40, 20, 160], [380, 200, 180, 20]]
    },
    {
      name: "8. Pinball",
      tee: [80, 220], cup: [570, 220], par: 4,
      walls: [[220, 90, 60, 60], [220, 290, 60, 60], [380, 190, 60, 60]]
    },
    {
      name: "9. The Long Way",
      tee: [70, 70], cup: [570, 370], par: 5,
      walls: [[140, 20, 20, 300], [280, 140, 20, 300], [420, 20, 20, 300]]
    }
  ];
})();
