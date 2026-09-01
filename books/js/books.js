/**
 * The family library.
 *
 * Most reading apps give every account its own private shelf and treat sharing
 * as the exception. That is wrong for a household: the books belong to the
 * family. Whose book it is, and who is reading it, are tags ON a book rather
 * than the thing a book belongs to -- which is also the only way two children
 * reading the same copy can each keep their own progress.
 *
 * So: one shelf, filtered by whose it is; a reading record per person per
 * book; and "reading together" is simply more than one person on the same one.
 */
(function () {
  "use strict";

  const auth = window.LWLAuth;
  const gate = document.getElementById("books-gate");
  const gateWhy = document.getElementById("books-gate-why");
  const body = document.getElementById("books-body");
  if (!auth || !body) return;

  const db = auth.client;
  const state = {
    me: null, household: null, folk: [], books: [],
    showing: "all", whose: "everyone",
  };

  const WORDS = { want: "Wants to read", reading: "Reading", finished: "Finished", stopped: "Gave up" };
  const SHELVES = [
    { id: "all", label: "Everything" },
    { id: "reading", label: "📖 Being read" },
    { id: "finished", label: "✅ Finished" },
    { id: "want", label: "🔖 Waiting" },
    { id: "unread", label: "🌱 Nobody yet" },
  ];

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

  function nameOf(id) {
    const person = state.folk.find(function (p) { return p.id === id; });
    return person ? person.display_name : "somebody";
  }

  /* ---------------- Loading ---------------- */

  async function load() {
    const home = await db.from("households").select("id, name").limit(1).maybeSingle();
    if (home.error || !home.data) {
      gateWhy.textContent = "You are not part of a family library yet. Ask Luke's dad to add you to one.";
      gate.hidden = false;
      body.hidden = true;
      return;
    }
    state.household = home.data;

    const folk = await db.from("household_members")
      .select("profile_id, profiles (id, display_name, role)")
      .eq("household_id", state.household.id);
    state.folk = (folk.data || [])
      .map(function (row) { return row.profiles; })
      .filter(Boolean);

    const books = await db.from("books")
      .select("id, title, author, belongs_to, shared, updated_at, book_readers (profile_id, status, rating, notes)")
      .eq("household_id", state.household.id)
      .order("updated_at", { ascending: false });
    if (books.error) { say("Could not load the library: " + books.error.message, true); return; }
    state.books = books.data || [];

    drawEverything();
  }

  function drawEverything() {
    drawWhose();
    drawShelves();
    drawStats();
    drawList();
    fillBelongsTo();
    fillReaders();
  }

  /* ---------------- The shelf ---------------- */

  /** Books left after both filters: whose it is, and how it is going. */
  function showing() {
    return state.books.filter(function (book) {
      if (state.whose === "family" && book.belongs_to) return false;
      if (state.whose !== "everyone" && state.whose !== "family" &&
          book.belongs_to !== state.whose) return false;

      const readers = book.book_readers || [];
      if (state.showing === "all") return true;
      if (state.showing === "unread") return readers.length === 0;
      return readers.some(function (r) { return r.status === state.showing; });
    });
  }

  function drawWhose() {
    const holder = document.getElementById("book-whose");
    if (!holder) return;
    holder.innerHTML = "";
    const options = [{ id: "everyone", label: "Everyone's" }]
      .concat(state.folk.map(function (p) { return { id: p.id, label: p.display_name + "'s" }; }))
      .concat([{ id: "family", label: "The family's" }]);
    options.forEach(function (option) {
      const button = el("button", "chip" + (state.whose === option.id ? " is-on" : ""), option.label);
      button.type = "button";
      button.setAttribute("aria-pressed", String(state.whose === option.id));
      button.addEventListener("click", function () {
        state.whose = option.id;
        drawWhose();
        drawStats();
        drawList();
      });
      holder.appendChild(button);
    });
  }

  function drawShelves() {
    const holder = document.getElementById("book-filters");
    if (!holder) return;
    holder.innerHTML = "";
    SHELVES.forEach(function (shelf) {
      const button = el("button", "chip" + (state.showing === shelf.id ? " is-on" : ""), shelf.label);
      button.type = "button";
      button.setAttribute("aria-pressed", String(state.showing === shelf.id));
      button.addEventListener("click", function () {
        state.showing = shelf.id;
        drawShelves();
        drawList();
      });
      holder.appendChild(button);
    });
  }

  function drawStats() {
    const holder = document.getElementById("book-stats");
    if (!holder) return;
    holder.innerHTML = "";
    const mine = state.books.filter(function (b) {
      return (b.book_readers || []).some(function (r) { return r.profile_id === state.me; });
    });
    const together = state.books.filter(function (b) { return (b.book_readers || []).length > 1; });
    [[state.books.length, "in the library"],
     [mine.length, "you have picked up"],
     [together.length, "read together"]].forEach(function (pair) {
      const stat = el("span", "book-stat");
      stat.appendChild(el("strong", null, String(pair[0])));
      stat.appendChild(document.createTextNode(" " + pair[1]));
      holder.appendChild(stat);
    });
  }

  function drawList() {
    const holder = document.getElementById("book-list");
    if (!holder) return;
    holder.innerHTML = "";
    const books = showing();
    books.forEach(function (book) { holder.appendChild(drawBook(book)); });
    if (!books.length) {
      holder.appendChild(el("p", "club-note", state.books.length
        ? "No books on that shelf."
        : "The library is empty. Add the book somebody is reading now."));
    }
  }

  function drawBook(book) {
    const readers = book.book_readers || [];
    const mine = readers.find(function (r) { return r.profile_id === state.me; });
    const card = el("article", "book book--" + (mine ? mine.status : "none"));
    card.appendChild(el("div", "book-spine"));

    const middle = el("div");
    middle.appendChild(el("p", "book-title", book.title));
    if (book.author) middle.appendChild(el("p", "book-author", "by " + book.author));

    const marks = el("div", "book-marks");
    marks.appendChild(el("span", "book-mark book-owner",
      book.belongs_to ? nameOf(book.belongs_to) + "'s" : "The family's"));
    if (readers.length > 1) marks.appendChild(el("span", "book-mark book-together", "📚 Read together"));
    if (book.shared) marks.appendChild(el("span", "book-mark", "Shown to the book club"));
    middle.appendChild(marks);

    // Who is on it, and how they are getting on. This is the bit a private
    // shelf could never show.
    if (readers.length) {
      const who = el("ul", "book-readers");
      readers.forEach(function (r) {
        const line = el("li", "book-reader");
        line.appendChild(el("span", "book-reader-name", nameOf(r.profile_id)));
        line.appendChild(el("span", "book-reader-status", WORDS[r.status] || r.status));
        if (r.rating) line.appendChild(el("span", "book-stars", "★".repeat(r.rating)));
        who.appendChild(line);
      });
      middle.appendChild(who);
    } else {
      middle.appendChild(el("p", "book-nobody", "Nobody has started it."));
    }

    // Your own shelf-mark on this book, changeable by you.
    const mineRow = el("div", "book-mine");
    mineRow.appendChild(el("span", "book-mine-label", "You:"));
    [["want", "Want to"], ["reading", "Reading"], ["finished", "Finished"], ["stopped", "Gave up"]]
      .forEach(function (pair) {
        const button = el("button", "rsvp" + (mine && mine.status === pair[0] ? " is-on" : ""), pair[1]);
        button.type = "button";
        button.addEventListener("click", function () { setMyStatus(book, pair[0], button); });
        mineRow.appendChild(button);
      });
    if (mine) {
      const off = el("button", "rsvp", "Not me");
      off.type = "button";
      off.addEventListener("click", function () { clearMyStatus(book, off); });
      mineRow.appendChild(off);
    }
    middle.appendChild(mineRow);
    card.appendChild(middle);

    // No Edit or Remove here. Changing the library happens in one place, and
    // a shelf with delete buttons on every book is a shelf you edit by
    // accident.
    return card;
  }

  /* ---------------- Changing things ---------------- */

  async function setMyStatus(book, status, button) {
    if (button) button.disabled = true;
    const saved = await db.from("book_readers").upsert({
      book_id: book.id, profile_id: state.me, status: status,
      updated_at: new Date().toISOString(),
    }, { onConflict: "book_id,profile_id" });
    if (button) button.disabled = false;
    if (saved.error) { say("Not saved: " + saved.error.message, true); return; }
    await load();
  }

  async function clearMyStatus(book, button) {
    if (button) button.disabled = true;
    const gone = await db.from("book_readers").delete()
      .eq("book_id", book.id).eq("profile_id", state.me);
    if (button) button.disabled = false;
    if (gone.error) { say("Not changed: " + gone.error.message, true); return; }
    await load();
  }

  function fields() {
    const get = function (id) { return document.getElementById(id); };
    return { id: get("book-id"), title: get("book-title"), author: get("book-author"),
             belongs: get("book-belongs"), shared: get("book-shared"),
             readers: get("book-readers-pick") };
  }

  function fillBelongsTo() {
    const select = document.getElementById("book-belongs");
    if (!select) return;
    const had = select.value;
    select.innerHTML = "";
    const family = document.createElement("option");
    family.value = "";
    family.textContent = "The family's";
    select.appendChild(family);
    state.folk.forEach(function (person) {
      const option = document.createElement("option");
      option.value = person.id;
      option.textContent = person.display_name + "'s";
      select.appendChild(option);
    });
    if (had) select.value = had;
  }

  /** Tick boxes for who is reading it, so "together" is one action. */
  function fillReaders() {
    const holder = document.getElementById("book-readers-pick");
    if (!holder) return;
    holder.innerHTML = "";
    state.folk.forEach(function (person) {
      const label = el("label", "reader-pick");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.value = person.id;
      if (person.id === state.me) box.checked = true;
      label.appendChild(box);
      label.appendChild(el("span", null, person.display_name));
      holder.appendChild(label);
    });
  }

  function pickedReaders() {
    const holder = document.getElementById("book-readers-pick");
    if (!holder) return [];
    return Array.prototype.slice.call(holder.querySelectorAll("input:checked"))
      .map(function (box) { return box.value; });
  }

  function fill(book) {
    const f = fields();
    if (!f.title) { window.location.href = "../manage/index.html"; return; }
    f.id.value = book.id;
    f.title.value = book.title || "";
    f.author.value = book.author || "";
    f.belongs.value = book.belongs_to || "";
    f.shared.checked = Boolean(book.shared);
    const on = (book.book_readers || []).map(function (r) { return r.profile_id; });
    Array.prototype.forEach.call(f.readers.querySelectorAll("input"), function (box) {
      box.checked = on.indexOf(box.value) !== -1;
    });
    f.title.focus();
  }

  async function remove(book) {
    if (!window.confirm("Take " + book.title + " out of the library?")) return;
    const gone = await db.from("books").delete().eq("id", book.id);
    if (gone.error) { say("Not removed: " + gone.error.message, true); return; }
    say("Removed " + book.title + ".");
    load();
  }

  /*
   * There is no add form on this page any more. Reading pages are for reading;
   * everything you can CHANGE lives in one console. What stays here is the one
   * thing that is not management -- marking what you yourself are reading,
   * which belongs beside the book rather than three clicks away.
   */
  const form = document.getElementById("book-form");
  if (form) {
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      const f = fields();
      const record = {
        household_id: state.household.id,
        title: f.title.value.trim(),
        author: f.author.value.trim() || null,
        belongs_to: f.belongs.value || null,
        shared: Boolean(f.shared.checked),
        updated_at: new Date().toISOString(),
      };
      const saved = f.id.value
        ? await db.from("books").update(record).eq("id", f.id.value).select("id")
        : await db.from("books").insert(record).select("id");
      if (saved.error) { say("Not saved: " + saved.error.message, true); return; }

      const bookId = f.id.value || (saved.data && saved.data[0] && saved.data[0].id);
      const wanted = pickedReaders();

      /*
       * Readers are saved one at a time, and only for people this account may
       * speak for. A parent can start a book for their child; nobody can mark
       * a sibling's book finished, which is a small indignity that starts
       * arguments. Anything refused is reported rather than silently skipped.
       */
      if (bookId) {
        const refused = [];
        for (let i = 0; i < wanted.length; i++) {
          const put = await db.from("book_readers").upsert({
            book_id: bookId, profile_id: wanted[i], status: "reading",
            updated_at: new Date().toISOString(),
          }, { onConflict: "book_id,profile_id" });
          if (put.error) refused.push(nameOf(wanted[i]));
        }
        if (refused.length) {
          say("Saved, but you cannot start a book for " + refused.join(" or ") + ".", true);
        } else {
          say("Saved " + record.title + ".");
        }
      }
      form.reset();
      f.id.value = "";
      await load();
    });
    document.getElementById("book-clear").addEventListener("click", function () {
      form.reset();
      fields().id.value = "";
      fillReaders();
    });
  }

  /* ---------------- Who is here ---------------- */

  auth.onChange(function (who) {
    if (who.unconfigured) {
      gateWhy.textContent = "Accounts are not switched on yet.";
      gate.hidden = false;
      return;
    }
    if (who.loading) return;
    if (!who.user) {
      gateWhy.textContent = "The family library is for people in the family, so you need to be signed in.";
      gate.hidden = false;
      body.hidden = true;
      return;
    }
    state.me = who.user.id;
    gate.hidden = true;
    body.hidden = false;
    load().then(function () {
      const hello = document.getElementById("books-hello");
      if (hello && state.household) {
        hello.textContent = state.household.name + " — everyone in the house can see all of it.";
      }
    });
  });

  window.BooksPage = { WORDS: WORDS, SHELVES: SHELVES, showing: showing, state: state };
})();
