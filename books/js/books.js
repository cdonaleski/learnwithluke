/**
 * A reading log.
 *
 * Deliberately not a catalogue of every book that exists. It records what one
 * person is reading, has read, wants to read, and gave up on -- and "gave up"
 * is offered as a perfectly respectable answer, because a child who thinks
 * abandoning a book is a failure will keep grinding through one they hate and
 * then stop reading altogether.
 *
 * Who may see what is decided by the database, not here: your own books, your
 * children's if you are their parent, and anybody's that they chose to share.
 * This file draws whatever came back.
 */
(function () {
  "use strict";

  const auth = window.LWLAuth;
  const gate = document.getElementById("books-gate");
  const gateWhy = document.getElementById("books-gate-why");
  const body = document.getElementById("books-body");
  if (!auth || !body) return;

  const db = auth.client;
  const state = { showing: "all", me: null, books: [] };

  const KINDS = [
    { id: "all", label: "Everything" },
    { id: "reading", label: "📖 Reading now" },
    { id: "finished", label: "✅ Finished" },
    { id: "want", label: "🔖 Want to read" },
    { id: "stopped", label: "🤷 Gave up" },
  ];

  const WORDS = {
    want: "Want to read", reading: "Reading now",
    finished: "Finished", stopped: "Gave up on it",
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function say(text, bad) {
    const note = document.getElementById("books-message");
    if (!note) return;
    note.textContent = text;
    note.className = "admin-message" + (bad ? " is-bad" : "");
    if (text) window.setTimeout(function () {
      if (note.textContent === text) note.textContent = "";
    }, 4000);
  }

  function fields() {
    const get = function (id) { return document.getElementById(id); };
    return { id: get("book-id"), title: get("book-title"), author: get("book-author"),
             status: get("book-status"), rating: get("book-rating"),
             notes: get("book-notes"), shared: get("book-shared") };
  }

  /* ---------------- Drawing ---------------- */

  function stars(n) {
    let out = "";
    for (let i = 0; i < 5; i++) out += i < n ? "★" : "☆";
    return out;
  }

  function drawBook(book, mine) {
    const card = el("article", "book book--" + book.status);
    card.appendChild(el("div", "book-spine"));

    const middle = el("div");
    middle.appendChild(el("p", "book-title", book.title));
    if (book.author) middle.appendChild(el("p", "book-author", "by " + book.author));

    const marks = el("div", "book-marks");
    marks.appendChild(el("span", "book-mark", WORDS[book.status] || book.status));
    if (book.rating) {
      const rated = el("span", "book-mark book-stars", stars(book.rating));
      marks.appendChild(rated);
    }
    if (mine && book.shared) marks.appendChild(el("span", "book-mark", "Shared"));
    middle.appendChild(marks);

    if (book.notes) middle.appendChild(el("p", "book-notes", book.notes));
    if (!mine && book.whose) middle.appendChild(el("p", "book-whose", book.whose + "'s book"));
    card.appendChild(middle);

    if (mine) {
      const actions = el("div", "book-actions");
      const edit = el("button", "btn btn-secondary btn-small", "Edit");
      edit.type = "button";
      edit.addEventListener("click", function () { fill(book); });
      const drop = el("button", "btn btn-secondary btn-small", "Delete");
      drop.type = "button";
      drop.addEventListener("click", function () { remove(book); });
      actions.appendChild(edit);
      actions.appendChild(drop);
      card.appendChild(actions);
    }
    return card;
  }

  function drawStats() {
    const holder = document.getElementById("book-stats");
    if (!holder) return;
    holder.innerHTML = "";
    const counts = { want: 0, reading: 0, finished: 0, stopped: 0 };
    state.books.forEach(function (b) { counts[b.status] = (counts[b.status] || 0) + 1; });
    [["finished", "read"], ["reading", "on the go"], ["want", "waiting"], ["stopped", "put down"]]
      .forEach(function (pair) {
        const stat = el("span", "book-stat");
        stat.appendChild(el("strong", null, String(counts[pair[0]] || 0)));
        stat.appendChild(document.createTextNode(" " + pair[1]));
        holder.appendChild(stat);
      });
  }

  function drawFilters() {
    const holder = document.getElementById("book-filters");
    if (!holder) return;
    holder.innerHTML = "";
    KINDS.forEach(function (kind) {
      const button = el("button", "chip" + (state.showing === kind.id ? " is-on" : ""), kind.label);
      button.type = "button";
      button.setAttribute("aria-pressed", String(state.showing === kind.id));
      button.addEventListener("click", function () {
        state.showing = kind.id;
        drawFilters();
        drawList();
      });
      holder.appendChild(button);
    });
  }

  function drawList() {
    const holder = document.getElementById("book-list");
    if (!holder) return;
    holder.innerHTML = "";
    const showing = state.books.filter(function (b) {
      return state.showing === "all" || b.status === state.showing;
    });
    showing.forEach(function (book) { holder.appendChild(drawBook(book, true)); });
    if (!showing.length) {
      holder.appendChild(el("p", "club-note", state.books.length
        ? "Nothing under that heading yet."
        : "No books yet. Add the one you are reading now."));
    }
  }

  /* ---------------- Loading and saving ---------------- */

  async function load() {
    const answer = await db.from("books")
      .select("id, owner_id, title, author, status, rating, notes, shared, updated_at")
      .order("updated_at", { ascending: false });
    if (answer.error) { say("Could not load your books: " + answer.error.message, true); return; }

    // Mine, and other people's shared ones, come back together -- the database
    // decided which. Split them for display.
    const all = answer.data || [];
    state.books = all.filter(function (b) { return b.owner_id === state.me; });
    const others = all.filter(function (b) { return b.owner_id !== state.me; });

    drawStats();
    drawFilters();
    drawList();

    const panel = document.getElementById("others-panel");
    const list = document.getElementById("others-list");
    if (panel && list) {
      panel.hidden = others.length === 0;
      list.innerHTML = "";
      others.forEach(function (book) { list.appendChild(drawBook(book, false)); });
    }
  }

  function fill(book) {
    const f = fields();
    f.id.value = book.id;
    f.title.value = book.title || "";
    f.author.value = book.author || "";
    f.status.value = book.status || "reading";
    f.rating.value = book.rating ? String(book.rating) : "";
    f.notes.value = book.notes || "";
    f.shared.checked = Boolean(book.shared);
    f.title.focus();
  }

  async function remove(book) {
    if (!window.confirm("Take " + book.title + " off your shelf?")) return;
    const gone = await db.from("books").delete().eq("id", book.id);
    if (gone.error) { say("Not deleted: " + gone.error.message, true); return; }
    say("Removed " + book.title + ".");
    load();
  }

  const form = document.getElementById("book-form");
  if (form) {
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      const f = fields();
      const record = {
        owner_id: state.me,
        title: f.title.value.trim(),
        author: f.author.value.trim() || null,
        status: f.status.value,
        rating: f.rating.value ? Number(f.rating.value) : null,
        notes: f.notes.value.trim() || null,
        shared: Boolean(f.shared.checked),
        updated_at: new Date().toISOString(),
      };
      // Stars only mean something once it has been read.
      if (record.status !== "finished") record.rating = null;

      const saved = f.id.value
        ? await db.from("books").update(record).eq("id", f.id.value)
        : await db.from("books").insert(record);
      if (saved.error) { say("Not saved: " + saved.error.message, true); return; }
      say("Saved " + record.title + ".");
      form.reset();
      f.id.value = "";
      f.status.value = "reading";
      load();
    });
    document.getElementById("book-clear").addEventListener("click", function () {
      form.reset();
      fields().id.value = "";
    });
  }

  /* ---------------- Who is here ---------------- */

  auth.onChange(function (state2) {
    if (state2.unconfigured) {
      gateWhy.textContent = "Accounts are not switched on yet.";
      gate.hidden = false;
      return;
    }
    if (state2.loading) return;
    if (!state2.user) {
      gateWhy.textContent = "Your books are yours, so you need to be signed in to see them.";
      gate.hidden = false;
      body.hidden = true;
      return;
    }
    state.me = state2.user.id;
    gate.hidden = true;
    body.hidden = false;
    const name = (state2.profile && state2.profile.display_name) || state2.user.email;
    const hello = document.getElementById("books-hello");
    if (hello) hello.textContent = name + "'s reading. Only you and your grown-up can see it, unless you share a book.";
    load();
  });

  window.BooksPage = { stars: stars, KINDS: KINDS, WORDS: WORDS };
})();
