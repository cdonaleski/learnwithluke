/**
 * Code Playground — starter projects.
 *
 * ADDING A PROJECT
 * ----------------
 * Copy a block below and change the fields. The project rail, the brief and
 * the editor all read from this list, so nothing else needs editing.
 *
 *   id      unique lowercase key, no spaces (used to remember tick boxes)
 *   name    what the chip says
 *   blurb   one or two sentences explaining the idea, in plain words
 *   tries   three things to change, easiest first - these become tick boxes
 *   html / css / js   the starting code
 *
 * Write the code as an array of lines joined with "\n". It keeps the quoting
 * sane and makes diffs readable. Every project's JavaScript is checked by the
 * offline tests to make sure it actually parses - a starter that will not run
 * is worse than no starter at all.
 */
(function () {
  "use strict";

  window.PlaygroundProjects = [
    {
      id: "hello",
      name: "Hello, World",
      blurb: "Every coder starts here. This page has a heading, a sentence, and a button that changes the page when you click it.",
      tries: [
        "Change the name in the heading to yours.",
        "Change the heading colour to purple.",
        "Change what the button says after you click it."
      ],
      html: [
        '<h1 id="title">Hi, I am Luke!</h1>',
        '<p>I made this page with code. Press the button.</p>',
        '<button onclick="cheer()">Press me</button>'
      ].join("\n"),
      css: [
        'body {',
        '  font-family: system-ui, sans-serif;',
        '  text-align: center;',
        '  padding: 40px 20px;',
        '}',
        '',
        'h1 {',
        '  color: crimson;',
        '  font-size: 44px;',
        '}',
        '',
        'button {',
        '  font-size: 20px;',
        '  padding: 12px 24px;',
        '  border: none;',
        '  border-radius: 999px;',
        '  background: teal;',
        '  color: white;',
        '  cursor: pointer;',
        '}'
      ].join("\n"),
      js: [
        'function cheer() {',
        '  var title = document.getElementById("title");',
        '  title.textContent = "You clicked it!";',
        '  console.log("The button was clicked");',
        '}'
      ].join("\n")
    },
    {
      id: "story",
      name: "Silly Story Machine",
      blurb: "Lists hold words. Random picks one. Put them together and the computer writes a new story every single time.",
      tries: [
        "Add three more animals to the animals list.",
        "Add a list called endings and put it at the end of the story.",
        "Make the button write two stories instead of one."
      ],
      html: [
        '<h1>Silly Story Machine</h1>',
        '<p id="story">...</p>',
        '<button onclick="makeStory()">New story</button>'
      ].join("\n"),
      css: [
        'body {',
        '  font-family: system-ui, sans-serif;',
        '  padding: 30px;',
        '  background: #fff8e7;',
        '}',
        '',
        '#story {',
        '  font-size: 24px;',
        '  line-height: 1.4;',
        '  min-height: 70px;',
        '}',
        '',
        'button {',
        '  font-size: 18px;',
        '  padding: 10px 20px;',
        '  cursor: pointer;',
        '}'
      ].join("\n"),
      js: [
        'var animals = ["llama", "goldfish", "T-rex"];',
        'var actions = ["danced", "sneezed", "ate 40 pancakes"];',
        'var places = ["on the moon", "in a taco truck", "in grandma\'s attic"];',
        '',
        'function pick(list) {',
        '  var spot = Math.floor(Math.random() * list.length);',
        '  return list[spot];',
        '}',
        '',
        'function makeStory() {',
        '  var story = "A " + pick(animals) + " " + pick(actions) + " " + pick(places) + ".";',
        '  document.getElementById("story").textContent = story;',
        '}',
        '',
        'makeStory();'
      ].join("\n")
    },
    {
      id: "buttons",
      name: "Button Factory",
      blurb: "No JavaScript at all here. This is pure CSS: colour, shape, and what happens when the mouse hovers over something.",
      tries: [
        "Change the candy button to your favourite colour.",
        "Make the wiggle button wiggle faster (try 0.2s).",
        "Copy one of the buttons and make a fourth style of your own."
      ],
      html: [
        '<h1>Button Factory</h1>',
        '<button class="candy">Candy</button>',
        '<button class="ghost">Ghost</button>',
        '<button class="wiggle">Wiggle</button>'
      ].join("\n"),
      css: [
        'body {',
        '  font-family: system-ui, sans-serif;',
        '  padding: 30px;',
        '  display: flex;',
        '  flex-direction: column;',
        '  gap: 14px;',
        '  align-items: flex-start;',
        '}',
        '',
        'button {',
        '  font-size: 18px;',
        '  padding: 12px 26px;',
        '  border-radius: 10px;',
        '  cursor: pointer;',
        '}',
        '',
        '.candy {',
        '  border: none;',
        '  background: hotpink;',
        '  color: white;',
        '  transition: transform 0.2s;',
        '}',
        '.candy:hover { transform: scale(1.15); }',
        '',
        '.ghost {',
        '  border: 3px dashed slateblue;',
        '  background: none;',
        '  color: slateblue;',
        '}',
        '.ghost:hover { background: slateblue; color: white; }',
        '',
        '.wiggle {',
        '  border: none;',
        '  background: orange;',
        '}',
        '.wiggle:hover { animation: shake 0.4s infinite; }',
        '',
        '@keyframes shake {',
        '  0% { transform: rotate(-6deg); }',
        '  50% { transform: rotate(6deg); }',
        '  100% { transform: rotate(-6deg); }',
        '}'
      ].join("\n"),
      js: [
        '// This project does not need any JavaScript.',
        '// The whole thing is done with CSS. Try the style.css tab!'
      ].join("\n")
    },
    {
      id: "bughunt",
      name: "Bug Hunt",
      blurb: "This one is broken on purpose. Three small mistakes stop it working. Read the messages under the page, find them, and fix them.",
      tries: [
        "Fix the first error. Read the red message - it tells you the name it cannot find.",
        "The button does nothing. Compare the id in the HTML with the one in the JavaScript.",
        "The counter goes up by the wrong amount. Find the number and fix it."
      ],
      html: [
        '<h1>Bug Hunt</h1>',
        '<p>Clicks: <b id="count">0</b></p>',
        '<button onclick="addOne()">Click me</button>',
        '<p id="mesage">Nothing yet.</p>'
      ].join("\n"),
      css: [
        'body {',
        '  font-family: system-ui, sans-serif;',
        '  text-align: center;',
        '  padding: 30px;',
        '}',
        '',
        'b {',
        '  font-size: 40px;',
        '  color: seagreen;',
        '}',
        '',
        'button {',
        '  font-size: 20px;',
        '  padding: 10px 24px;',
        '  cursor: pointer;',
        '}'
      ].join("\n"),
      js: [
        '// Three things are wrong. Can you find them all?',
        'var clicks = 0;',
        '',
        'function addOne() {',
        '  clicks = clicks + 10;',
        '  document.getElementById("count").textContent = clicks;',
        '  document.getElementById("message").textContent = "You clicked!";',
        '}',
        '',
        'consle.log("Ready to hunt bugs");'
      ].join("\n")
    },
    {
      id: "dice",
      name: "Dice Roller",
      blurb: "A function is a set of steps you can run again and again. This one rolls a die and keeps score of every roll.",
      tries: [
        "Turn it into a 20-sided die.",
        "Roll two dice and show the total.",
        "Show a message when you roll the highest number."
      ],
      html: [
        '<h1>Dice Roller</h1>',
        '<div id="face">-</div>',
        '<button onclick="roll()">Roll</button>',
        '<p id="history">Rolls so far: none</p>'
      ].join("\n"),
      css: [
        'body {',
        '  font-family: system-ui, sans-serif;',
        '  text-align: center;',
        '  padding: 24px;',
        '}',
        '',
        '#face {',
        '  font-size: 90px;',
        '  font-weight: bold;',
        '  color: darkslateblue;',
        '}',
        '',
        'button {',
        '  font-size: 20px;',
        '  padding: 10px 30px;',
        '  cursor: pointer;',
        '}'
      ].join("\n"),
      js: [
        'var rolls = [];',
        '',
        'function roll() {',
        '  var number = Math.floor(Math.random() * 6) + 1;',
        '  document.getElementById("face").textContent = number;',
        '  rolls.push(number);',
        '  document.getElementById("history").textContent = "Rolls so far: " + rolls.join(", ");',
        '  console.log("Rolled a " + number);',
        '}'
      ].join("\n")
    },
    {
      id: "catch",
      name: "Catch the Donut",
      blurb: "A real game. A timer counts down, the donut jumps somewhere new every time you catch it, and the score goes up.",
      tries: [
        "Give yourself 30 seconds instead of 15.",
        "Make the donut smaller so it is harder to click.",
        "Make every catch worth 5 points instead of 1."
      ],
      html: [
        '<h1>Catch the Donut</h1>',
        '<p>Score: <b id="score">0</b> &nbsp; Time: <b id="time">15</b></p>',
        '<div id="area"><span id="donut" onclick="catchIt()">D</span></div>'
      ].join("\n"),
      css: [
        'body {',
        '  font-family: system-ui, sans-serif;',
        '  padding: 16px;',
        '  text-align: center;',
        '}',
        '',
        '#area {',
        '  position: relative;',
        '  height: 240px;',
        '  border: 4px solid #333;',
        '  border-radius: 12px;',
        '  background: #e8f5ff;',
        '  overflow: hidden;',
        '}',
        '',
        '#donut {',
        '  position: absolute;',
        '  top: 90px;',
        '  left: 130px;',
        '  font-size: 44px;',
        '  font-weight: bold;',
        '  color: chocolate;',
        '  cursor: pointer;',
        '  user-select: none;',
        '}'
      ].join("\n"),
      js: [
        'var score = 0;',
        'var time = 15;',
        'var donut = document.getElementById("donut");',
        '',
        'function catchIt() {',
        '  if (time <= 0) { return; }',
        '  score = score + 1;',
        '  document.getElementById("score").textContent = score;',
        '  move();',
        '}',
        '',
        'function move() {',
        '  var area = document.getElementById("area");',
        '  donut.style.left = Math.random() * (area.clientWidth - 50) + "px";',
        '  donut.style.top = Math.random() * (area.clientHeight - 50) + "px";',
        '}',
        '',
        'setInterval(function () {',
        '  if (time > 0) {',
        '    time = time - 1;',
        '    document.getElementById("time").textContent = time;',
        '    if (time === 0) {',
        '      donut.textContent = "Done!";',
        '      console.log("Final score: " + score);',
        '    }',
        '  }',
        '}, 1000);'
      ].join("\n")
    },
    {
      id: "draw",
      name: "Drawing Pad",
      blurb: "A canvas is a blank rectangle you paint on with code. This one follows the mouse and draws a line behind it.",
      tries: [
        "Make the brush thicker by changing lineWidth.",
        "Add a fourth colour button.",
        "Make the brush pick a random colour on every click."
      ],
      html: [
        '<h1>Drawing Pad</h1>',
        '<canvas id="pad" width="380" height="240"></canvas>',
        '<div>',
        '  <button onclick="setColor(\'crimson\')">Red</button>',
        '  <button onclick="setColor(\'seagreen\')">Green</button>',
        '  <button onclick="setColor(\'royalblue\')">Blue</button>',
        '  <button onclick="clearPad()">Clear</button>',
        '</div>'
      ].join("\n"),
      css: [
        'body {',
        '  font-family: system-ui, sans-serif;',
        '  padding: 16px;',
        '  text-align: center;',
        '}',
        '',
        '#pad {',
        '  border: 4px solid #333;',
        '  border-radius: 10px;',
        '  background: white;',
        '  cursor: crosshair;',
        '  touch-action: none;',
        '  max-width: 100%;',
        '}',
        '',
        'button {',
        '  font-size: 16px;',
        '  padding: 8px 16px;',
        '  margin: 8px 4px 0;',
        '  cursor: pointer;',
        '}'
      ].join("\n"),
      js: [
        'var pad = document.getElementById("pad");',
        'var pen = pad.getContext("2d");',
        'var drawing = false;',
        '',
        'pen.lineWidth = 6;',
        'pen.lineCap = "round";',
        'pen.strokeStyle = "crimson";',
        '',
        'function setColor(colour) {',
        '  pen.strokeStyle = colour;',
        '}',
        '',
        'function clearPad() {',
        '  pen.clearRect(0, 0, pad.width, pad.height);',
        '}',
        '',
        'pad.addEventListener("pointerdown", function (e) {',
        '  drawing = true;',
        '  pen.beginPath();',
        '  pen.moveTo(e.offsetX, e.offsetY);',
        '});',
        '',
        'pad.addEventListener("pointermove", function (e) {',
        '  if (!drawing) { return; }',
        '  pen.lineTo(e.offsetX, e.offsetY);',
        '  pen.stroke();',
        '});',
        '',
        'window.addEventListener("pointerup", function () {',
        '  drawing = false;',
        '});'
      ].join("\n")
    }
  ];
})();
