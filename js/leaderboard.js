/**
 * Leaderboard — shared by every game on the site.
 *
 * WHERE THE SCORES LIVE
 * Scores are kept in this browser's localStorage, so a board is per-device,
 * not shared over the internet. On a family tablet that is exactly what you
 * want: everyone who plays on it appears on the same board. It also means the
 * site keeps working with no connection, which the rest of the site relies on.
 * Sharing boards between devices would need a server.
 *
 * USING IT FROM A GAME
 *   const board = Leaderboard.create({
 *     gameId: "snake",            // storage key - never reuse across games
 *     gameName: "Snake",
 *     metric: { label: "Score", better: "higher" },
 *     categories: [{ id: "normal", label: "Normal" }],   // optional
 *   });
 *   board.mount(document.getElementById("leaderboard-panel"));
 *   board.setCategory("fast");    // when the player changes difficulty
 *   board.offer(score);           // at game over - asks for a name if it qualifies
 */
(function () {
  "use strict";

  const PREFIX = "lwl-leaderboard-";
  const NAME_KEY = "lwl-player-name";
  const SIZE = 10;
  const MAX_NAME = 14;

  function readStore(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      /* Private browsing, or the quota is full - scores just will not persist. */
    }
  }

  function rememberedName() {
    try {
      return window.localStorage.getItem(NAME_KEY) || "";
    } catch (err) {
      return "";
    }
  }

  function rememberName(name) {
    try {
      window.localStorage.setItem(NAME_KEY, name);
    } catch (err) { /* not important */ }
  }

  /**
   * Names are typed by whoever is playing and go straight back onto the page,
   * so they are cleaned on the way IN as well as being written with
   * textContent on the way out. Control characters and angle brackets are
   * dropped, whitespace collapsed, length capped, and the result is never
   * empty.
   */
  function cleanName(raw) {
    const source = String(raw === null || raw === undefined ? "" : raw);
    let text = "";
    for (let i = 0; i < source.length; i++) {
      const code = source.charCodeAt(i);
      const char = source.charAt(i);
      const isControl = code < 32 || code === 127;
      text += (isControl || char === "<" || char === ">") ? " " : char;
    }
    const tidy = text.replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
    return tidy || "Player";
  }

  function formatValue(value, metric) {
    if (metric && metric.format === "time") {
      const total = Math.max(0, Math.floor(value / 1000));
      return Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
    }
    return String(value);
  }

  function medal(rank) {
    return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : String(rank);
  }

  function create(config) {
    const gameId = config.gameId;
    const gameName = config.gameName || gameId;
    const metric = Object.assign({ label: "Score", better: "higher", format: "number" }, config.metric);
    const categories = (config.categories && config.categories.length)
      ? config.categories.slice()
      : [{ id: "all", label: "All" }];
    const size = config.size || SIZE;
    const storageKey = PREFIX + gameId;

    let currentCategory = categories[0].id;
    let container = null;
    let pending = null;
    let justSaved = -1;

    function allBoards() {
      const data = readStore(storageKey, {});
      return (data && typeof data === "object" && !Array.isArray(data)) ? data : {};
    }

    /** Best first, and defensively cleaned - storage can be edited by hand. */
    function entries(categoryId) {
      const list = allBoards()[categoryId || currentCategory];
      if (!Array.isArray(list)) return [];
      return list
        .filter((e) => e && typeof e.value === "number" && isFinite(e.value))
        .map((e) => ({ name: cleanName(e.name), value: e.value, at: e.at || null }))
        .sort((a, b) => (metric.better === "lower" ? a.value - b.value : b.value - a.value))
        .slice(0, size);
    }

    function isBetter(a, b) {
      return metric.better === "lower" ? a < b : a > b;
    }

    /** Would this make the board? A full board must be beaten, not matched. */
    function qualifies(value, categoryId) {
      if (typeof value !== "number" || !isFinite(value)) return false;
      const list = entries(categoryId);
      if (list.length < size) return true;
      return isBetter(value, list[list.length - 1].value);
    }

    function rankOf(value, categoryId) {
      let rank = 1;
      entries(categoryId).forEach((entry) => { if (isBetter(entry.value, value)) rank += 1; });
      return rank;
    }

    function save(name, value, categoryId) {
      const category = categoryId || currentCategory;
      const data = allBoards();
      const list = Array.isArray(data[category]) ? data[category].slice() : [];
      list.push({ name: cleanName(name), value: value, at: Date.now() });
      list.sort((a, b) => (metric.better === "lower" ? a.value - b.value : b.value - a.value));
      data[category] = list.slice(0, size);
      writeStore(storageKey, data);
      return data[category];
    }

    function clear(categoryId) {
      const data = allBoards();
      delete data[categoryId || currentCategory];
      writeStore(storageKey, data);
      render();
    }

    function render() {
      if (!container) return;
      container.innerHTML = "";
      container.className = "game-panel leaderboard";

      const heading = document.createElement("h2");
      heading.textContent = "🏆 " + gameName + " Leaderboard";
      container.appendChild(heading);

      if (categories.length > 1) {
        const tabs = document.createElement("div");
        tabs.className = "lb-tabs";
        tabs.setAttribute("role", "group");
        tabs.setAttribute("aria-label", "Leaderboard category");
        categories.forEach((cat) => {
          const tab = document.createElement("button");
          tab.type = "button";
          tab.className = "option-btn" + (cat.id === currentCategory ? " is-active" : "");
          tab.textContent = cat.label;
          tab.setAttribute("aria-pressed", String(cat.id === currentCategory));
          tab.addEventListener("click", () => { currentCategory = cat.id; justSaved = -1; render(); });
          tabs.appendChild(tab);
        });
        container.appendChild(tabs);
      }

      if (pending) container.appendChild(buildNameForm());

      const list = entries();
      if (!list.length) {
        const empty = document.createElement("p");
        empty.className = "lb-empty";
        empty.textContent = "No scores yet - be the first to get on the board!";
        container.appendChild(empty);
      } else {
        const table = document.createElement("ol");
        table.className = "lb-list";
        list.forEach((entry, i) => {
          const row = document.createElement("li");
          row.className = "lb-row" + (i === justSaved ? " is-new" : "") + (i < 3 ? " is-podium" : "");

          const rank = document.createElement("span");
          rank.className = "lb-rank";
          rank.textContent = medal(i + 1);

          const name = document.createElement("span");
          name.className = "lb-name";
          name.textContent = entry.name;

          const value = document.createElement("span");
          value.className = "lb-value";
          value.textContent = formatValue(entry.value, metric);

          row.appendChild(rank);
          row.appendChild(name);
          row.appendChild(value);
          table.appendChild(row);
        });
        container.appendChild(table);
      }

      const footer = document.createElement("div");
      footer.className = "lb-footer";

      const note = document.createElement("p");
      note.className = "lb-note";
      note.textContent = "Best " + metric.label.toLowerCase() +
        " (" + (metric.better === "lower" ? "lower" : "higher") + " is better). " +
        "Saved on this device only.";
      footer.appendChild(note);

      if (list.length) {
        const clearBtn = document.createElement("button");
        clearBtn.type = "button";
        clearBtn.className = "option-btn";
        clearBtn.textContent = "🧹 Clear this board";
        clearBtn.addEventListener("click", () => {
          if (window.confirm("Clear the " + gameName + " leaderboard on this device?")) clear();
        });
        footer.appendChild(clearBtn);
      }

      container.appendChild(footer);
    }

    function buildNameForm() {
      const form = document.createElement("form");
      form.className = "lb-form";

      const title = document.createElement("p");
      title.className = "lb-form-title";
      title.textContent = "🎉 You made the leaderboard at number " +
        rankOf(pending.value, pending.category) + "! What is your name?";
      form.appendChild(title);

      const row = document.createElement("div");
      row.className = "lb-form-row";

      const label = document.createElement("label");
      label.className = "visually-hidden";
      label.setAttribute("for", "lb-name-input");
      label.textContent = "Your name";

      const input = document.createElement("input");
      input.type = "text";
      input.id = "lb-name-input";
      input.className = "lb-input";
      input.maxLength = MAX_NAME;
      input.placeholder = "Your name";
      input.setAttribute("autocomplete", "off");
      input.value = rememberedName();

      const saveBtn = document.createElement("button");
      saveBtn.type = "submit";
      saveBtn.className = "btn btn-primary";
      saveBtn.textContent = "Save my score";

      row.appendChild(label);
      row.appendChild(input);
      row.appendChild(saveBtn);
      form.appendChild(row);

      form.addEventListener("submit", (event) => {
        if (event && typeof event.preventDefault === "function") event.preventDefault();
        commit(input.value);
      });

      window.setTimeout(() => { try { input.focus(); input.select(); } catch (err) { /* ok */ } }, 30);
      return form;
    }

    function commit(rawName) {
      if (!pending) return;
      const name = cleanName(rawName);
      const value = pending.value;
      const category = pending.category;
      rememberName(name);
      const saved = save(name, value, category);
      pending = null;
      currentCategory = category;
      justSaved = saved.findIndex((e) => e.name === name && e.value === value);
      render();
      if (typeof config.onSaved === "function") config.onSaved(name, saved);
    }

    /**
     * Called by the game when a run ends. If the score is good enough the name
     * form appears inside the leaderboard panel; otherwise nothing happens.
     * Returns true if it qualified.
     */
    function offer(value, categoryId) {
      const category = categoryId || currentCategory;
      justSaved = -1;
      if (!qualifies(value, category)) {
        render();
        return false;
      }
      currentCategory = category;
      pending = { value: value, category: category };
      render();
      if (container && typeof container.scrollIntoView === "function") {
        try { container.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch (err) { /* ok */ }
      }
      return true;
    }

    return {
      mount(el) { container = el; render(); },
      setCategory(id) {
        if (categories.some((c) => c.id === id)) { currentCategory = id; justSaved = -1; render(); }
      },
      offer, qualifies, rankOf, entries, clear, render, commit,
      get category() { return currentCategory; },
      get pending() { return pending; },
      gameId, gameName, metric, categories,
    };
  }

  /** Every board stored for one game, for the Hall of Fame page. */
  function readAll(gameId) {
    return readStore(PREFIX + gameId, {});
  }

  window.Leaderboard = { create, readAll, cleanName, formatValue, PREFIX, NAME_KEY, SIZE, MAX_NAME };
})();
