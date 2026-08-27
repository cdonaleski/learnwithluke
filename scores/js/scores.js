/**
 * Hall of Fame — every leaderboard on this device, in one place.
 *
 * Reads the same localStorage keys the games write, via Leaderboard.readAll.
 * The GAMES list below is the only thing to edit when a game gains a board;
 * it has to mirror what that game passes to Leaderboard.create.
 */
(function () {
  "use strict";

  const listEl = document.getElementById("scores-list");
  if (!listEl || !window.Leaderboard) return;

  const GAMES = [
    { id: "snake", name: "Snake", icon: "🐍", href: "../games/snake/index.html",
      metric: { label: "Score", better: "higher", format: "number" },
      categories: [{ id: "slow", label: "Slow" }, { id: "normal", label: "Normal" }, { id: "fast", label: "Fast" }] },
    { id: "bubble-shooter", name: "Bubble Shooter", icon: "🫧", href: "../games/bubble-shooter/index.html",
      metric: { label: "Score", better: "higher", format: "number" },
      categories: [{ id: "classic", label: "Classic" }, { id: "math", label: "Math Mode" }] },
    { id: "memory", name: "Memory", icon: "🧠", href: "../games/memory/index.html",
      metric: { label: "Moves", better: "lower", format: "number" },
      categories: [{ id: "small", label: "Easy" }, { id: "medium", label: "Medium" }, { id: "large", label: "Hard" }] },
    { id: "mastermind", name: "Mastermind", icon: "🎨", href: "../games/mastermind/index.html",
      metric: { label: "Tries", better: "lower", format: "number" },
      categories: [{ id: "easy", label: "Easy" }, { id: "medium", label: "Medium" }, { id: "hard", label: "Hard" }] },
    { id: "battleship", name: "Battleship", icon: "🚢", href: "../games/battleship/index.html",
      metric: { label: "Shots", better: "lower", format: "number" },
      categories: [{ id: "all", label: "All" }] },
    { id: "connect-four", name: "Connect Four", icon: "🔴", href: "../games/connect-four/index.html",
      metric: { label: "Win streak", better: "higher", format: "number" },
      categories: [{ id: "easy", label: "Easy" }, { id: "medium", label: "Medium" }, { id: "hard", label: "Hard" }] },
    { id: "tic-tac-toe", name: "Tic Tac Toe", icon: "❌", href: "../games/tic-tac-toe/index.html",
      metric: { label: "Win streak", better: "higher", format: "number" },
      categories: [{ id: "easy", label: "Easy" }, { id: "medium", label: "Medium" }, { id: "hard", label: "Hard" }] },
    { id: "rock-paper-scissors", name: "Rock Paper Scissors", icon: "✊", href: "../games/rock-paper-scissors/index.html",
      metric: { label: "Win streak", better: "higher", format: "number" },
      categories: [{ id: "fair", label: "Fair" }, { id: "sharp", label: "Sharp" }] },
    { id: "hangman", name: "Word Guess", icon: "🚀", href: "../games/hangman/index.html",
      metric: { label: "Win streak", better: "higher", format: "number" },
      categories: [{ id: "all", label: "All" }] },
    { id: "maze", name: "Maze", icon: "🧭", href: "../games/maze/index.html",
      metric: { label: "Time", better: "lower", format: "time" },
      categories: [{ id: "small", label: "Small" }, { id: "medium", label: "Medium" }, { id: "large", label: "Large" }] },
    { id: "minesweeper", name: "Minesweeper", icon: "💣", href: "../games/minesweeper/index.html",
      metric: { label: "Time", better: "lower", format: "time" },
      categories: [{ id: "easy", label: "Easy" }, { id: "medium", label: "Medium" }, { id: "hard", label: "Hard" }] },
    { id: "lights-out", name: "Lights Out", icon: "💡", href: "../games/lights-out/index.html",
      metric: { label: "Moves", better: "lower", format: "number" },
      categories: [{ id: "small", label: "Easy" }, { id: "medium", label: "Medium" }, { id: "large", label: "Hard" }] },
    { id: "sudoku", name: "Sudoku", icon: "🔢", href: "../games/sudoku/index.html",
      metric: { label: "Time", better: "lower", format: "time" },
      categories: [{ id: "easy", label: "Easy" }, { id: "medium", label: "Medium" }, { id: "hard", label: "Hard" }] },
    { id: "tower-of-hanoi", name: "Tower of Hanoi", icon: "🗼", href: "../games/tower-of-hanoi/index.html",
      metric: { label: "Moves", better: "lower", format: "number" },
      categories: [3, 4, 5, 6, 7, 8].map(function (n) { return { id: String(n), label: n + " discs" }; }) },
    { id: "breakout", name: "Breakout", icon: "🧱", href: "../games/breakout/index.html",
      metric: { label: "Score", better: "higher", format: "number" },
      categories: [{ id: "easy", label: "Easy" }, { id: "medium", label: "Medium" }, { id: "hard", label: "Hard" }] },
    { id: "farkle", name: "Farkle", icon: "🎲", href: "../games/farkle/index.html",
      metric: { label: "Score", better: "higher", format: "number" },
      categories: [{ id: "all", label: "All" }] },
    { id: "tower-stack", name: "Tower Stack", icon: "🏗️", href: "../games/tower-stack/index.html",
      metric: { label: "Score", better: "higher", format: "number" },
      categories: [{ id: "all", label: "All" }] },
    { id: "frogger", name: "Frogger", icon: "🐸", href: "../games/frogger/index.html",
      metric: { label: "Score", better: "higher", format: "number" },
      categories: [{ id: "easy", label: "Easy" }, { id: "medium", label: "Medium" }, { id: "hard", label: "Hard" }] },
    { id: "number-memory", name: "Number Memory", icon: "🔢", href: "../games/number-memory/index.html",
      metric: { label: "Digits", better: "higher", format: "number" },
      categories: [{ id: "relaxed", label: "Relaxed" }, { id: "normal", label: "Normal" }, { id: "sharp", label: "Sharp" }] },
    { id: "mini-golf", name: "Mini Golf", icon: "⛳", href: "../games/mini-golf/index.html",
      metric: { label: "Shots", better: "lower", format: "number" },
      categories: [{ id: "all", label: "All" }] },
  ];

  const el = {
    list: listEl,
    empty: document.getElementById("scores-empty"),
    summary: document.getElementById("scores-summary"),
    clearAll: document.getElementById("btn-clear-all"),
  };

  function sortEntries(list, metric) {
    return list
      .filter((e) => e && typeof e.value === "number" && isFinite(e.value))
      .map((e) => ({ name: window.Leaderboard.cleanName(e.name), value: e.value }))
      .sort((a, b) => (metric.better === "lower" ? a.value - b.value : b.value - a.value));
  }

  function render() {
    el.list.innerHTML = "";
    let gamesWithScores = 0;
    let totalEntries = 0;
    const champions = new Map();

    GAMES.forEach((game) => {
      const stored = window.Leaderboard.readAll(game.id) || {};
      const rows = [];

      game.categories.forEach((cat) => {
        const list = Array.isArray(stored[cat.id]) ? sortEntries(stored[cat.id], game.metric) : [];
        if (!list.length) return;
        totalEntries += list.length;
        rows.push({ label: cat.label, best: list[0], count: list.length });
        const tally = champions.get(list[0].name) || 0;
        champions.set(list[0].name, tally + 1);
      });

      if (!rows.length) return;
      gamesWithScores += 1;

      const card = document.createElement("article");
      card.className = "score-card";

      const head = document.createElement("a");
      head.className = "score-card-head";
      head.href = game.href;

      const icon = document.createElement("span");
      icon.className = "score-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = game.icon;

      const title = document.createElement("h3");
      title.textContent = game.name;

      head.appendChild(icon);
      head.appendChild(title);
      card.appendChild(head);

      const table = document.createElement("ul");
      table.className = "score-rows";
      rows.forEach((row) => {
        const item = document.createElement("li");
        item.className = "score-row";

        const cat = document.createElement("span");
        cat.className = "score-cat";
        cat.textContent = row.label;

        const name = document.createElement("span");
        name.className = "score-name";
        name.textContent = row.best.name;      // textContent, never innerHTML

        const value = document.createElement("span");
        value.className = "score-value";
        value.textContent = window.Leaderboard.formatValue(row.best.value, game.metric);

        item.appendChild(cat);
        item.appendChild(name);
        item.appendChild(value);
        table.appendChild(item);
      });
      card.appendChild(table);

      const note = document.createElement("p");
      note.className = "score-note";
      note.textContent = "Best " + game.metric.label.toLowerCase() +
        " (" + (game.metric.better === "lower" ? "lower" : "higher") + " is better)";
      card.appendChild(note);

      el.list.appendChild(card);
    });

    el.empty.hidden = gamesWithScores > 0;
    el.list.hidden = gamesWithScores === 0;
    el.clearAll.hidden = gamesWithScores === 0;

    if (!gamesWithScores) {
      el.summary.textContent = "";
      return;
    }

    // Who holds the most first places?
    let topName = null, topCount = 0;
    champions.forEach((count, name) => { if (count > topCount) { topCount = count; topName = name; } });
    el.summary.textContent = totalEntries + " score" + (totalEntries === 1 ? "" : "s") +
      " across " + gamesWithScores + " game" + (gamesWithScores === 1 ? "" : "s") + "." +
      (topName ? " " + topName + " holds " + topCount + " top spot" + (topCount === 1 ? "" : "s") + "." : "");
  }

  el.clearAll.addEventListener("click", () => {
    if (!window.confirm("Clear every leaderboard on this device? This cannot be undone.")) return;
    GAMES.forEach((game) => {
      try { window.localStorage.removeItem(window.Leaderboard.PREFIX + game.id); } catch (err) { /* ok */ }
    });
    render();
  });

  render();

  window.ScoresPage = { GAMES, render };
})();
