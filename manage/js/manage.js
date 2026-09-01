/**
 * One place to change things.
 *
 * Managing used to be scattered: adding a book happened on the library page,
 * running the club happened at /admin, and the two had nothing to do with each
 * other. Worse, /admin was all-or-nothing -- the only way to let somebody help
 * run the cube club was to hand them the whole site.
 *
 * So: reading pages are for reading, and everything you may CHANGE lives here,
 * in areas that appear only if you may use them. Nothing on this page leads to
 * a refusal, because a thing you cannot do is never drawn.
 *
 * The permissions come from the database every time, not from a list kept in
 * the browser. Hiding an area is only tidiness -- the policies are what stop
 * anybody, and they would stop them just as firmly if this file lied.
 */
(function () {
  "use strict";

  const auth = window.LWLAuth;
  const body = document.getElementById("manage-body");
  const locked = document.getElementById("manage-locked");
  const lockedWhy = document.getElementById("manage-locked-why");
  const intro = document.getElementById("manage-intro");
  if (!auth || !body) return;

  const db = auth.client;
  const state = { me: null, can: null, area: null, household: null, folk: [] };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function say(text, bad) {
    const note = document.getElementById("manage-message");
    if (!note) return;
    note.textContent = text;
    note.className = "admin-message" + (bad ? " is-bad" : "");
    if (text) window.setTimeout(function () {
      if (note.textContent === text) note.textContent = "";
    }, 4000);
  }

  /* ---------------- Which areas this person gets ---------------- */

  function areas() {
    const list = [];
    if (state.can.library) {
      list.push({ id: "library", name: "📚 Our Library",
                  why: "Books, whose they are, who is reading them" });
    }
    if (state.can.runsClub) {
      list.push({ id: "club", name: "⏱️ Speedcube Club",
                  why: "Competitions, meet-ups, alerts and who is coming" });
    }
    if (state.can.site) {
      list.push({ id: "site", name: "🛠️ The site",
                  why: "Accounts, families and clubs" });
    }
    return list;
  }

  function drawAreas() {
    const holder = document.getElementById("manage-areas");
    holder.innerHTML = "";
    const list = areas();
    list.forEach(function (area) {
      const button = el("button", "manage-area" + (state.area === area.id ? " is-on" : ""));
      button.type = "button";
      button.appendChild(el("span", "manage-area-name", area.name));
      button.appendChild(el("span", "manage-area-why", area.why));
      button.addEventListener("click", function () {
        state.area = area.id;
        drawAreas();
        drawArea();
      });
      holder.appendChild(button);
    });
    // With one area there is nothing to choose between, so do not pretend.
    holder.hidden = list.length < 2;
  }

  /* ---------------- Our Library ---------------- */

  async function loadFamily() {
    const home = await db.from("households").select("id, name").limit(1).maybeSingle();
    state.household = home.data || null;
    if (!state.household) return;
    const folk = await db.from("household_members")
      .select("profiles (id, display_name)").eq("household_id", state.household.id);
    state.folk = (folk.data || []).map(function (r) { return r.profiles; }).filter(Boolean);
  }

  function nameOf(id) {
    const person = state.folk.find(function (p) { return p.id === id; });
    return person ? person.display_name : "somebody";
  }

  async function drawLibrary(panel) {
    if (!state.household) {
      panel.appendChild(el("p", "manage-empty",
        "You are not part of a family library yet. Ask Luke's dad to put you in one."));
      return;
    }

    panel.appendChild(el("h2", null, state.household.name));

    const form = el("form", "admin-form books-form");
    form.innerHTML = "";
    const hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.id = "m-book-id";
    form.appendChild(hidden);

    function field(id, label, type, hint) {
      const l = el("label", null, label);
      l.setAttribute("for", id);
      if (hint) {
        const small = el("span", "admin-hint", " " + hint);
        l.appendChild(small);
      }
      const input = document.createElement(type === "select" ? "select" : "input");
      if (type !== "select") input.type = type;
      input.id = id;
      form.appendChild(l);
      form.appendChild(input);
      return input;
    }

    const title = field("m-book-title", "Title", "text");
    title.required = true;
    field("m-book-author", "Who wrote it", "text");
    const belongs = field("m-book-belongs", "Whose book is it", "select");

    const family = document.createElement("option");
    family.value = "";
    family.textContent = "The family's";
    belongs.appendChild(family);
    state.folk.forEach(function (p) {
      const option = document.createElement("option");
      option.value = p.id;
      option.textContent = p.display_name + "'s";
      belongs.appendChild(option);
    });

    const picks = el("fieldset", "reader-picks");
    const legend = el("legend", null, "Who is reading it");
    legend.appendChild(el("span", "admin-hint", " (tick more than one for reading together)"));
    picks.appendChild(legend);
    const pickRow = el("div");
    pickRow.id = "m-readers";
    state.folk.forEach(function (p) {
      const label = el("label", "reader-pick");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.value = p.id;
      if (p.id === state.me) box.checked = true;
      label.appendChild(box);
      label.appendChild(el("span", null, p.display_name));
      pickRow.appendChild(label);
    });
    picks.appendChild(pickRow);
    form.appendChild(picks);

    const shareLabel = el("label", "admin-check");
    const shareBox = document.createElement("input");
    shareBox.type = "checkbox";
    shareBox.id = "m-book-shared";
    shareLabel.appendChild(shareBox);
    shareLabel.appendChild(el("span", null,
      "Show this one to the book club too. Everyone in the house sees it either way."));
    form.appendChild(shareLabel);

    const actions = el("div", "game-actions");
    const save = el("button", "btn btn-primary", "Save book");
    save.type = "submit";
    const clear = el("button", "btn btn-secondary", "Clear");
    clear.type = "button";
    clear.addEventListener("click", function () {
      form.reset();
      hidden.value = "";
    });
    actions.appendChild(save);
    actions.appendChild(clear);
    form.appendChild(actions);
    panel.appendChild(form);

    const list = el("div", "admin-list");
    list.id = "m-book-list";
    panel.appendChild(list);

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      const record = {
        household_id: state.household.id,
        title: document.getElementById("m-book-title").value.trim(),
        author: document.getElementById("m-book-author").value.trim() || null,
        belongs_to: document.getElementById("m-book-belongs").value || null,
        shared: document.getElementById("m-book-shared").checked,
        updated_at: new Date().toISOString(),
      };
      const id = hidden.value;
      const saved = id
        ? await db.from("books").update(record).eq("id", id).select("id")
        : await db.from("books").insert(record).select("id");
      if (saved.error) { say("Not saved: " + saved.error.message, true); return; }

      const bookId = id || (saved.data && saved.data[0] && saved.data[0].id);
      const wanted = Array.prototype.slice
        .call(document.querySelectorAll("#m-readers input:checked"))
        .map(function (b) { return b.value; });
      const refused = [];
      for (let i = 0; i < wanted.length; i++) {
        const put = await db.from("book_readers").upsert({
          book_id: bookId, profile_id: wanted[i], status: "reading",
          updated_at: new Date().toISOString(),
        }, { onConflict: "book_id,profile_id" });
        if (put.error) refused.push(nameOf(wanted[i]));
      }
      say(refused.length
        ? "Saved, but you cannot start a book for " + refused.join(" or ") + "."
        : "Saved " + record.title + ".", refused.length > 0);
      form.reset();
      hidden.value = "";
      loadBooks();
    });

    async function loadBooks() {
      const answer = await db.from("books")
        .select("id, title, author, belongs_to, shared, book_readers (profile_id, status)")
        .eq("household_id", state.household.id)
        .order("updated_at", { ascending: false });
      list.innerHTML = "";
      if (answer.error) { say("Could not load the library: " + answer.error.message, true); return; }
      (answer.data || []).forEach(function (book) {
        const readers = (book.book_readers || []).map(function (r) { return nameOf(r.profile_id); });
        list.appendChild(rowCard(
          book.title + (book.author ? " — " + book.author : ""),
          (book.belongs_to ? nameOf(book.belongs_to) + "'s" : "The family's") +
            (readers.length ? " · being read by " + readers.join(" and ") : " · nobody yet"),
          function () {
            hidden.value = book.id;
            document.getElementById("m-book-title").value = book.title;
            document.getElementById("m-book-author").value = book.author || "";
            document.getElementById("m-book-belongs").value = book.belongs_to || "";
            document.getElementById("m-book-shared").checked = Boolean(book.shared);
            const on = (book.book_readers || []).map(function (r) { return r.profile_id; });
            Array.prototype.forEach.call(document.querySelectorAll("#m-readers input"), function (box) {
              box.checked = on.indexOf(box.value) !== -1;
            });
            document.getElementById("m-book-title").focus();
          },
          async function () {
            if (!window.confirm("Take " + book.title + " out of the library?")) return;
            const gone = await db.from("books").delete().eq("id", book.id);
            if (gone.error) { say("Not removed: " + gone.error.message, true); return; }
            say("Removed " + book.title + ".");
            loadBooks();
          }));
      });
      if (!answer.data || !answer.data.length) {
        list.appendChild(el("p", "club-note", "The library is empty."));
      }
    }
    loadBooks();
  }

  /* ---------------- Club and site: the existing portal ---------------- */

  function drawElsewhere(panel, where, words) {
    panel.appendChild(el("p", "manage-empty", words));
    const actions = el("div", "game-actions");
    const go = el("a", "btn btn-primary", "Open it");
    go.href = where;
    actions.appendChild(go);
    panel.appendChild(actions);
  }

  /* ---------------- Shared bits ---------------- */

  function rowCard(title, detail, onEdit, onRemove) {
    const card = el("div", "admin-row");
    const words = el("div");
    words.appendChild(el("p", "admin-row-title", title));
    if (detail) words.appendChild(el("p", "admin-row-detail", detail));
    card.appendChild(words);
    const actions = el("div", "admin-row-actions");
    const edit = el("button", "btn btn-secondary btn-small", "Edit");
    edit.type = "button";
    edit.addEventListener("click", onEdit);
    const drop = el("button", "btn btn-secondary btn-small", "Delete");
    drop.type = "button";
    drop.addEventListener("click", onRemove);
    actions.appendChild(edit);
    actions.appendChild(drop);
    card.appendChild(actions);
    return card;
  }

  function drawArea() {
    const panels = document.getElementById("manage-panels");
    panels.innerHTML = "";
    const panel = el("section", "game-panel");
    panels.appendChild(panel);

    if (state.area === "library") { drawLibrary(panel); return; }
    if (state.area === "club") {
      drawElsewhere(panel, "../admin/index.html",
        "Competitions, meet-ups, alerts, who is coming, the roster and contact details.");
      return;
    }
    if (state.area === "site") {
      drawElsewhere(panel, "../admin/index.html",
        "Accounts, families and clubs.");
      return;
    }
    panel.appendChild(el("p", "manage-empty", "Pick something above."));
  }

  /* ---------------- Who is here ---------------- */

  auth.onChange(async function (who) {
    if (who.unconfigured) {
      lockedWhy.textContent = "Accounts are not switched on yet.";
      locked.hidden = false;
      return;
    }
    if (who.loading) return;
    if (!who.user) {
      lockedWhy.textContent = "You need to be signed in to change anything.";
      locked.hidden = false;
      body.hidden = true;
      return;
    }
    state.me = who.user.id;
    state.can = await window.AccountBar.whatTheyCanDo();
    locked.hidden = true;
    body.hidden = false;

    const list = areas();
    intro.textContent = list.length === 1
      ? "Everything you can change is here."
      : "Everything you can change, in one place.";
    if (!state.area) state.area = list.length ? list[0].id : null;

    await loadFamily();
    drawAreas();
    drawArea();
  });

  window.ManagePage = { areas: areas, state: state };
})();
