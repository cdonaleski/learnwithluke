/**
 * The console. Everything a signed-in person may change, in one place.
 *
 * The old shape was a page of tabs at /admin plus stray forms on the reading
 * pages, and each tab hand-rolled its own list, its own form and its own
 * saving. Eight sections written eight times is how they drift: one gets a
 * confirm on delete, another forgets it; one disables the button while saving,
 * another lets you double-submit.
 *
 * So the console is a registry. A section says what it is -- which table,
 * which fields, who may see it, how a row reads -- and one engine draws the
 * list, opens the drawer, saves, and deletes, identically for all of them.
 * The list comes first and the form appears only when asked for, because a
 * permanent form squatting above every list makes a console read like
 * paperwork. The few sections that are genuinely their own shape (families,
 * who-is-coming, who-is-in-which-club) say `render` and take over.
 *
 * As everywhere else: hiding a section is tidiness, a signpost rather than a
 * lock. This file only ever decides what to SHOW -- the database policies are
 * what actually refuse anybody, and they would refuse just as firmly if this
 * file lied about who can do what.
 */
(function () {
  "use strict";

  const auth = window.LWLAuth;
  const consoleEl = document.getElementById("console");
  const locked = document.getElementById("manage-locked");
  const lockedWhy = document.getElementById("manage-locked-why");
  if (!auth || !consoleEl) return;

  const db = auth.client;
  const state = {
    me: null, can: null, section: null, rows: [], extras: {},
    household: null, folk: [], people: [], clubs: [], editing: null, search: "",
  };

  /* ---------------- Small helpers ---------------- */

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

  function nameOf(id) {
    const person = state.folk.concat(state.people).find(function (p) { return p && p.id === id; });
    return person ? person.display_name : "somebody";
  }

  function rowCard(title, detail, onEdit, onRemove, badges) {
    const card = el("div", "admin-row");
    const words = el("div");
    const head = el("p", "admin-row-title", title);
    words.appendChild(head);
    if (detail) words.appendChild(el("p", "admin-row-detail", detail));
    if (badges && badges.length) {
      const strip = el("div", "book-marks");
      badges.forEach(function (b) { strip.appendChild(el("span", "book-mark", b)); });
      words.appendChild(strip);
    }
    card.appendChild(words);
    const actions = el("div", "admin-row-actions");
    if (onEdit) {
      const edit = el("button", "btn btn-secondary btn-small", "Edit");
      edit.type = "button";
      edit.addEventListener("click", onEdit);
      actions.appendChild(edit);
    }
    if (onRemove) {
      const drop = el("button", "btn btn-secondary btn-small", "Delete");
      drop.type = "button";
      drop.addEventListener("click", onRemove);
      actions.appendChild(drop);
    }
    card.appendChild(actions);
    return card;
  }

  /* ================================================================ */
  /* The registry. Order here is the order in the navigation.          */
  /* ================================================================ */

  const SECTIONS = [

    /* ---------------- Our Library ---------------- */
    {
      group: "Our Library", needs: "library",
      id: "books", icon: "📚", label: "Books",
      blurb: "The family's shelf: what is on it, whose it is, who is reading it.",
      empty: "The library is empty. Add the book somebody is reading now.",
      table: "books",
      select: "id, title, author, belongs_to, shared, book_readers (profile_id, status)",
      scope: function (q) { return q.eq("household_id", state.household.id); },
      order: [["updated_at", { ascending: false }]],
      searchable: true,
      fields: [
        { key: "title", label: "Title", type: "text", required: true },
        { key: "author", label: "Who wrote it", type: "text" },
        { key: "belongs_to", label: "Whose book is it", type: "select",
          options: function () {
            return [{ value: "", label: "The family's" }].concat(
              state.folk.map(function (p) { return { value: p.id, label: p.display_name + "'s" }; }));
          } },
        { key: "_readers", label: "Who is reading it", type: "people",
          hint: "tick more than one for reading together" },
        { key: "shared", label: "Show this one to the book club too. Everyone in the house sees it either way.",
          type: "checkbox" },
      ],
      toRecord: function (v) {
        return { household_id: state.household.id, title: v.title, author: v.author,
                 belongs_to: v.belongs_to || null, shared: v.shared,
                 updated_at: new Date().toISOString() };
      },
      fromRow: function (row) {
        return { title: row.title, author: row.author || "", belongs_to: row.belongs_to || "",
                 shared: Boolean(row.shared),
                 _readers: (row.book_readers || []).map(function (r) { return r.profile_id; }) };
      },
      title: function (row) { return row.title + (row.author ? " — " + row.author : ""); },
      detail: function (row) {
        const readers = (row.book_readers || []).map(function (r) { return nameOf(r.profile_id); });
        return (row.belongs_to ? nameOf(row.belongs_to) + "'s" : "The family's") +
          (readers.length ? " · being read by " + readers.join(" and ") : " · nobody yet");
      },
      confirm: function (row) { return "Take " + row.title + " out of the library?"; },
      /**
       * Readers are saved as a follow-up, and only the NEWLY ticked ones are
       * written. Upserting everybody ticked would stamp "reading" over a
       * status somebody already set -- edit a book and your child's
       * "finished" quietly becomes "reading" again. Unticking is left alone
       * for the same reason: taking someone off a book is theirs to do.
       */
      afterSave: async function (id, v, row) {
        const before = row ? (row.book_readers || []).map(function (r) { return r.profile_id; }) : [];
        const refused = [];
        for (let i = 0; i < (v._readers || []).length; i++) {
          const person = v._readers[i];
          if (before.indexOf(person) !== -1) continue;
          const put = await db.from("book_readers").upsert({
            book_id: id, profile_id: person, status: "reading",
            updated_at: new Date().toISOString(),
          }, { onConflict: "book_id,profile_id" });
          if (put.error) refused.push(nameOf(person));
        }
        if (refused.length) {
          say("Saved, but you cannot start a book for " + refused.join(" or ") + ".", true);
        }
      },
    },

    /* ---------------- Speedcube Club ---------------- */
    {
      group: "Speedcube Club", needs: "runsClub",
      id: "roster", icon: "🧑‍🤝‍🧑", label: "Roster",
      blurb: "The club's members, their parents, and whose details are shared.",
      empty: "No members yet.",
      table: "club_members",
      select: "id, name, role, wca_id, note, parent_name, share_parent_contact, profile_id",
      order: [["sort_order"], ["name"]],
      searchable: true,
      fields: [
        { key: "name", label: "Name", type: "text", required: true },
        { key: "role", label: "Role", type: "text", hint: "blank for a competing member" },
        { key: "wca_id", label: "WCA id", type: "text", placeholder: "2025DONA02" },
        { key: "note", label: "Note", type: "text" },
        { key: "parent_name", label: "Parent's name", type: "text" },
        { key: "_parent_email", label: "Parent's email", type: "email" },
        { key: "_parent_phone", label: "Parent's phone", type: "text", placeholder: "555-0100" },
        { key: "profile_id", label: "Linked account", type: "select",
          hint: "lets this family RSVP for themselves",
          onlyIf: function () { return state.can.site; },
          options: function () {
            return [{ value: "", label: "Nobody yet" }].concat(
              state.people.map(function (p) {
                return { value: p.id, label: p.display_name + (p.role === "admin" ? " (admin)" : "") };
              }));
          } },
        { key: "share_parent_contact",
          label: "Let other members see this parent's email and phone. The child's name and times are visible to the club either way.",
          type: "checkbox" },
      ],
      toRecord: function (v) {
        const record = { name: v.name, role: v.role, wca_id: v.wca_id, note: v.note,
                         parent_name: v.parent_name, share_parent_contact: v.share_parent_contact };
        if (state.can.site) record.profile_id = v.profile_id || null;
        return record;
      },
      fromRow: function (row) {
        const contact = state.extras.contacts[row.id] || {};
        return { name: row.name, role: row.role || "", wca_id: row.wca_id || "",
                 note: row.note || "", parent_name: row.parent_name || "",
                 _parent_email: contact.email || "", _parent_phone: contact.phone || "",
                 profile_id: row.profile_id || "",
                 share_parent_contact: Boolean(row.share_parent_contact) };
      },
      extraLoad: async function () {
        const contacts = await db.from("club_member_contacts").select("member_id, email, phone");
        const map = {};
        (contacts.data || []).forEach(function (c) { map[c.member_id] = c; });
        state.extras.contacts = map;
      },
      title: function (row) { return row.name + (row.role ? " — " + row.role : ""); },
      detail: function (row) {
        const parent = row.parent_name
          ? "parent: " + row.parent_name +
            (row.share_parent_contact ? " (shared with members)" : " (only organisers see their details)")
          : "no parent recorded";
        return [row.wca_id, parent].filter(Boolean).join(" · ");
      },
      confirm: function (row) { return "Delete " + row.name + "? This cannot be undone."; },
      afterSave: async function (id, v) {
        const email = (v._parent_email || "").trim();
        const phone = (v._parent_phone || "").trim();
        if (email || phone) {
          const kept = await db.from("club_member_contacts")
            .upsert({ member_id: id, email: email || null, phone: phone || null },
                    { onConflict: "member_id" });
          if (kept.error) say("Member saved, but the parent's details were not: " + kept.error.message, true);
        } else {
          // Emptied on purpose means removed, not left behind as a blank row.
          await db.from("club_member_contacts").delete().eq("member_id", id);
        }
      },
    },

    {
      group: "Speedcube Club", needs: "runsClub",
      id: "events", icon: "🏆", label: "Competitions",
      blurb: "Real WCA competitions: where, when, and the deadline to enter.",
      empty: "No competitions listed.",
      table: "club_events",
      select: "id, name, slug, held_on, register_by, venue, city, address, url, starts_at, ends_at, fee, capacity, note, kind",
      scope: function (q) { return q.eq("kind", "competition"); },
      order: [["held_on"]],
      defaults: { kind: "competition" },
      fields: [
        { key: "name", label: "Name", type: "text", required: true },
        { key: "held_on", label: "Date", type: "date", required: true },
        { key: "register_by", label: "Last day to enter", type: "date" },
        { key: "slug", label: "WCA competition id", type: "text",
          hint: "the bit at the end of its web address" },
        { key: "url", label: "Web page", type: "url" },
        { key: "venue", label: "Venue", type: "text" },
        { key: "city", label: "Town", type: "text" },
        { key: "address", label: "Full address", type: "text",
          hint: "this is what goes into a calendar entry" },
        { key: "starts_at", label: "Starts at", type: "time" },
        { key: "ends_at", label: "Ends at", type: "time" },
        { key: "fee", label: "Fee", type: "text", placeholder: "$35" },
        { key: "capacity", label: "Competitor limit", type: "number" },
        { key: "note", label: "Note", type: "text", wide: true },
      ],
      title: function (row) { return row.held_on + " — " + row.name; },
      detail: function (row) {
        return [row.city, row.fee, row.register_by ? "enter by " + row.register_by : null]
          .filter(Boolean).join(" · ");
      },
      confirm: function (row) { return "Delete " + row.name + "?"; },
    },

    {
      group: "Speedcube Club", needs: "runsClub",
      id: "meetups", icon: "☕", label: "Meet-ups",
      blurb: "The club getting together — no entry fee, no governing body.",
      empty: "No meet-ups arranged. The club page says so plainly.",
      table: "club_events",
      select: "id, name, held_on, venue, city, address, starts_at, ends_at, note, kind",
      scope: function (q) { return q.eq("kind", "meetup"); },
      order: [["held_on"]],
      defaults: { kind: "meetup" },
      fields: [
        { key: "name", label: "What it is", type: "text", required: true, placeholder: "Saturday practice" },
        { key: "held_on", label: "Date", type: "date", required: true },
        { key: "venue", label: "Where", type: "text" },
        { key: "city", label: "Town", type: "text" },
        { key: "address", label: "Full address", type: "text" },
        { key: "starts_at", label: "Starts at", type: "time" },
        { key: "ends_at", label: "Ends at", type: "time" },
        { key: "note", label: "Anything else", type: "text", wide: true,
          placeholder: "2pm until 4pm. Bring your own cube." },
      ],
      title: function (row) { return row.held_on + " — " + row.name; },
      detail: function (row) { return [row.venue, row.city, row.note].filter(Boolean).join(" · "); },
      confirm: function (row) { return "Delete " + row.name + "?"; },
    },

    {
      group: "Speedcube Club", needs: "runsClub",
      id: "alerts", icon: "📢", label: "Alerts",
      blurb: "A short notice at the top of the club page. Dated ones take themselves down.",
      empty: "No alerts. The club page shows none.",
      table: "club_alerts",
      select: "id, message, level, starts_on, ends_on, created_at",
      order: [["created_at", { ascending: false }]],
      fields: [
        { key: "message", label: "What it says", type: "text", required: true, wide: true,
          placeholder: "Saturday's practice is cancelled — hall is double booked." },
        { key: "level", label: "How loud", type: "select",
          options: [{ value: "info", label: "Ordinary notice" }, { value: "warning", label: "Important" }] },
        { key: "starts_on", label: "Show from", type: "date", hint: "blank for straight away" },
        { key: "ends_on", label: "Stop showing after", type: "date", hint: "blank to keep until deleted" },
      ],
      check: function (v) {
        if (v.starts_on && v.ends_on && v.ends_on < v.starts_on) {
          return "That alert would finish before it started.";
        }
        return null;
      },
      title: function (row) { return row.message; },
      detail: function (row) {
        const today = new Date().toISOString().slice(0, 10);
        const when = row.starts_on && row.starts_on > today ? "starts " + row.starts_on
          : row.ends_on && row.ends_on < today ? "finished " + row.ends_on
          : row.ends_on ? "showing until " + row.ends_on : "showing now";
        return (row.level === "warning" ? "Important · " : "") + when;
      },
      confirm: function () { return "Delete that alert?"; },
    },

    {
      group: "Speedcube Club", needs: "runsClub",
      id: "going", icon: "✅", label: "Who's coming",
      blurb: "Families answer for themselves once linked to an account; you can answer for anybody.",
      render: renderGoing,
    },

    {
      group: "Speedcube Club", needs: "runsClub",
      id: "contact", icon: "✉️", label: "Contact",
      blurb: "Who members should ask, and how. Kept in the database on purpose — the page would hand it to strangers.",
      empty: "No contact details. The club page will say so.",
      table: "club_contact",
      select: "id, name, role, email, phone, note",
      order: [["sort_order"]],
      fields: [
        { key: "name", label: "Name", type: "text", required: true },
        { key: "role", label: "Who they are", type: "text", placeholder: "Luke's dad" },
        { key: "email", label: "Email", type: "email" },
        { key: "phone", label: "Phone", type: "text", placeholder: "555-0100" },
        { key: "note", label: "Note", type: "text", wide: true },
      ],
      title: function (row) { return row.name + (row.role ? " — " + row.role : ""); },
      detail: function (row) { return [row.email, row.phone].filter(Boolean).join(" · "); },
      confirm: function (row) { return "Delete " + row.name + "?"; },
    },

    /* ---------------- The site ---------------- */
    {
      group: "The site", needs: "site",
      id: "families", icon: "👪", label: "Accounts & families",
      blurb: "Every account, what it may do, and which grown-up is responsible for it.",
      render: renderFamilies,
    },

    {
      group: "The site", needs: "site",
      id: "clubs", icon: "🏛️", label: "Clubs",
      blurb: "The clubs themselves, and who belongs to which.",
      empty: "No clubs yet.",
      table: "clubs",
      select: "id, slug, name, blurb",
      order: [["name"]],
      fields: [
        { key: "name", label: "Name", type: "text", required: true, placeholder: "Book Club" },
        { key: "slug", label: "Short name", type: "text", required: true,
          hint: "used in addresses; letters and dashes", placeholder: "books" },
        { key: "blurb", label: "What it is", type: "text", wide: true },
      ],
      toRecord: function (v) {
        return { name: v.name, blurb: v.blurb,
                 slug: String(v.slug || "").toLowerCase()
                   .replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") };
      },
      check: function (v) {
        const slug = String(v.slug || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
        return slug ? null : "That short name has no letters in it.";
      },
      title: function (row) { return row.name; },
      detail: function (row) { return row.slug + (row.blurb ? " · " + row.blurb : ""); },
      confirm: function (row) { return "Delete " + row.name + "?"; },
      afterList: renderMemberships,
    },
  ];

  /* ================================================================ */
  /* The engine                                                        */
  /* ================================================================ */

  function visibleSections() {
    return SECTIONS.filter(function (s) { return state.can && state.can[s.needs]; });
  }

  function drawNav() {
    const nav = document.getElementById("console-nav");
    nav.innerHTML = "";
    const groups = {};
    visibleSections().forEach(function (sec) {
      (groups[sec.group] = groups[sec.group] || []).push(sec);
    });
    Object.keys(groups).forEach(function (name) {
      const holder = el("div");
      holder.appendChild(el("p", "console-group-name", name));
      groups[name].forEach(function (sec) {
        const item = el("button",
          "console-nav-item" + (state.section === sec ? " is-on" : ""));
        item.type = "button";
        item.appendChild(el("span", null, sec.icon));
        item.appendChild(el("span", null, sec.label));
        item.addEventListener("click", function () { openSection(sec); });
        holder.appendChild(item);
      });
      nav.appendChild(holder);
    });
  }

  function openSection(sec) {
    state.section = sec;
    state.editing = null;
    state.search = "";
    try { window.location.hash = sec.id; } catch (err) { /* fine */ }
    drawNav();

    document.getElementById("section-title").textContent = sec.icon + " " + sec.label;
    document.getElementById("section-blurb").textContent = sec.blurb || "";
    closeDrawer();

    const add = document.getElementById("section-add");
    const search = document.getElementById("section-search");
    add.hidden = !sec.table;
    search.hidden = !sec.searchable;
    search.value = "";

    const list = document.getElementById("section-list");
    list.innerHTML = "";
    if (sec.render) { sec.render(list); return; }
    loadList();
  }

  async function loadList() {
    const sec = state.section;
    if (sec.extraLoad) await sec.extraLoad();
    let query = db.from(sec.table).select(sec.select);
    if (sec.scope) query = sec.scope(query);
    (sec.order || []).forEach(function (o) {
      query = Array.isArray(o) ? query.order(o[0], o[1]) : query.order(o);
    });
    const answer = await query;
    if (answer.error) { say("Could not load: " + answer.error.message, true); return; }
    state.rows = answer.data || [];
    drawList();
  }

  function drawList() {
    const sec = state.section;
    const list = document.getElementById("section-list");
    list.innerHTML = "";

    const hunt = state.search.trim().toLowerCase();
    const rows = state.rows.filter(function (row) {
      if (!hunt) return true;
      return (sec.title(row) + " " + (sec.detail ? sec.detail(row) : ""))
        .toLowerCase().indexOf(hunt) !== -1;
    });

    rows.forEach(function (row) {
      list.appendChild(rowCard(
        sec.title(row),
        sec.detail ? sec.detail(row) : "",
        function () { openDrawer(row); },
        async function () {
          if (!window.confirm(sec.confirm ? sec.confirm(row) : "Delete this?")) return;
          const gone = await db.from(sec.table).delete().eq("id", row.id);
          if (gone.error) { say("Not deleted: " + gone.error.message, true); return; }
          say("Deleted.");
          loadList();
        }));
    });

    if (!rows.length) {
      const emptyBox = el("div", "console-empty");
      emptyBox.appendChild(el("span", "console-empty-icon", sec.icon));
      emptyBox.appendChild(el("p", null, hunt ? "Nothing matches that." : (sec.empty || "Nothing here yet.")));
      list.appendChild(emptyBox);
    }
    if (sec.afterList) sec.afterList(list);
  }

  /* ---------------- The drawer ---------------- */

  function closeDrawer() {
    document.getElementById("drawer").hidden = true;
    state.editing = null;
  }

  function openDrawer(row) {
    const sec = state.section;
    state.editing = row || null;
    const drawer = document.getElementById("drawer");
    const form = document.getElementById("drawer-form");
    form.innerHTML = "";

    const values = row
      ? (sec.fromRow ? sec.fromRow(row) : row)
      : {};

    sec.fields.forEach(function (field) {
      if (field.onlyIf && !field.onlyIf()) return;
      form.appendChild(buildField(field, values[field.key]));
    });

    const actions = el("div", "game-actions");
    const save = el("button", "btn btn-primary", row ? "Save changes" : "Add it");
    save.type = "submit";
    const cancel = el("button", "btn btn-secondary", "Cancel");
    cancel.type = "button";
    cancel.addEventListener("click", closeDrawer);
    actions.appendChild(save);
    actions.appendChild(cancel);
    form.appendChild(actions);

    form.onsubmit = saveDrawer;
    drawer.hidden = false;
    const first = form.querySelector("input, select, textarea");
    if (first) { try { first.focus(); } catch (err) { /* fine */ } }
    try { drawer.scrollIntoView({ block: "nearest" }); } catch (err) { /* fine */ }
  }

  function buildField(field, value) {
    const wrap = el("div", "field" + (field.wide || field.type === "checkbox" || field.type === "people" ? " field--wide" : ""));

    if (field.type === "checkbox") {
      const label = el("label", "admin-check");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.dataset.key = field.key;
      box.checked = Boolean(value);
      label.appendChild(box);
      label.appendChild(el("span", null, field.label));
      wrap.appendChild(label);
      return wrap;
    }

    if (field.type === "people") {
      const picks = el("fieldset", "reader-picks");
      const legend = el("legend", null, field.label);
      if (field.hint) legend.appendChild(el("span", "admin-hint", " (" + field.hint + ")"));
      picks.appendChild(legend);
      const row = el("div");
      row.dataset.key = field.key;
      row.dataset.people = "yes";
      state.folk.forEach(function (p) {
        const label = el("label", "reader-pick");
        const box = document.createElement("input");
        box.type = "checkbox";
        box.value = p.id;
        box.checked = value ? value.indexOf(p.id) !== -1 : p.id === state.me;
        label.appendChild(box);
        label.appendChild(el("span", null, p.display_name));
        row.appendChild(label);
      });
      picks.appendChild(row);
      wrap.appendChild(picks);
      return wrap;
    }

    const label = el("label", null, field.label);
    if (field.hint) label.appendChild(el("span", "admin-hint", " (" + field.hint + ")"));
    wrap.appendChild(label);

    let input;
    if (field.type === "select") {
      input = document.createElement("select");
      const options = typeof field.options === "function" ? field.options() : field.options;
      (options || []).forEach(function (o) {
        const option = document.createElement("option");
        option.value = o.value;
        option.textContent = o.label;
        input.appendChild(option);
      });
    } else if (field.type === "textarea") {
      input = document.createElement("textarea");
      input.rows = 3;
    } else {
      input = document.createElement("input");
      input.type = field.type || "text";
    }
    input.dataset.key = field.key;
    if (field.required) input.required = true;
    if (field.placeholder) input.placeholder = field.placeholder;
    input.value = value === undefined || value === null ? "" : value;
    wrap.appendChild(input);
    return wrap;
  }

  function collectValues() {
    const values = {};
    const form = document.getElementById("drawer-form");
    Array.prototype.forEach.call(form.querySelectorAll("[data-key]"), function (node) {
      const key = node.dataset.key;
      if (node.dataset.people === "yes") {
        values[key] = Array.prototype.slice.call(node.querySelectorAll("input:checked"))
          .map(function (b) { return b.value; });
      } else if (node.type === "checkbox") {
        values[key] = node.checked;
      } else if (node.type === "number") {
        values[key] = node.value ? Number(node.value) : null;
      } else {
        values[key] = node.value.trim() || null;
      }
    });
    return values;
  }

  async function saveDrawer(event) {
    event.preventDefault();
    const sec = state.section;
    const values = collectValues();

    if (sec.check) {
      const complaint = sec.check(values);
      if (complaint) { say(complaint, true); return; }
    }

    let record = sec.toRecord ? sec.toRecord(values) : {};
    if (!sec.toRecord) {
      sec.fields.forEach(function (field) {
        if (field.key.charAt(0) === "_") return;      // helper fields, saved by hooks
        if (field.onlyIf && !field.onlyIf()) return;
        record[field.key] = values[field.key];
      });
    }
    Object.assign(record, sec.defaults || {});

    const editing = state.editing;
    const saved = editing
      ? await db.from(sec.table).update(record).eq("id", editing.id).select("id")
      : await db.from(sec.table).insert(record).select("id");
    if (saved.error) { say("Not saved: " + saved.error.message, true); return; }

    const id = editing ? editing.id : (saved.data && saved.data[0] && saved.data[0].id);
    if (sec.afterSave && id) await sec.afterSave(id, values, editing);

    say("Saved.");
    closeDrawer();
    loadList();
  }

  /* ================================================================ */
  /* The sections that are their own shape                             */
  /* ================================================================ */

  /** Who's coming: an answer per member per event, set or cleared. */
  function renderGoing(list) {
    const form = el("form", "admin-form");
    const pickEvent = document.createElement("select");
    const pickMember = document.createElement("select");
    const pickStatus = document.createElement("select");
    [["going", "Going / registered"], ["maybe", "Maybe"], ["not", "Not going"]]
      .forEach(function (pair) {
        const option = document.createElement("option");
        option.value = pair[0];
        option.textContent = pair[1];
        pickStatus.appendChild(option);
      });

    [["Which event", pickEvent], ["Which member", pickMember], ["Answer", pickStatus]]
      .forEach(function (pair) {
        const wrap = el("div", "field");
        wrap.appendChild(el("label", null, pair[0]));
        wrap.appendChild(pair[1]);
        form.appendChild(wrap);
      });

    const actions = el("div", "game-actions");
    const save = el("button", "btn btn-primary", "Save answer");
    save.type = "submit";
    actions.appendChild(save);
    form.appendChild(actions);
    list.appendChild(form);

    const answers = el("div", "admin-list");
    list.appendChild(answers);

    async function loadChoices() {
      const events = await db.from("club_events").select("id, name, held_on, kind").order("held_on");
      pickEvent.innerHTML = "";
      (events.data || []).forEach(function (row) {
        const option = document.createElement("option");
        option.value = row.id;
        option.textContent = row.held_on + " — " + row.name + (row.kind === "meetup" ? " (meet-up)" : "");
        pickEvent.appendChild(option);
      });
      const members = await db.from("club_members").select("id, name").order("sort_order");
      pickMember.innerHTML = "";
      (members.data || []).forEach(function (row) {
        const option = document.createElement("option");
        option.value = row.id;
        option.textContent = row.name;
        pickMember.appendChild(option);
      });
    }

    async function loadAnswers() {
      const answer = await db.from("club_attendance")
        .select("id, status, event_id, member_id, club_events (name, held_on), club_members (name)")
        .order("updated_at", { ascending: false });
      answers.innerHTML = "";
      const words = { going: "going", maybe: "maybe", not: "not going" };
      (answer.data || []).forEach(function (row) {
        answers.appendChild(rowCard(
          (row.club_members ? row.club_members.name : "Someone") + " — " + (words[row.status] || row.status),
          ((row.club_events || {}).held_on || "") + " " + ((row.club_events || {}).name || ""),
          null,
          async function () {
            if (!window.confirm("Delete that answer?")) return;
            const gone = await db.from("club_attendance").delete().eq("id", row.id);
            if (gone.error) { say("Not deleted: " + gone.error.message, true); return; }
            loadAnswers();
          }));
      });
      if (!answer.data || !answer.data.length) {
        answers.appendChild(el("p", "console-empty", "Nobody has answered for anything yet."));
      }
    }

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!pickEvent.value || !pickMember.value) { say("Pick an event and a member first.", true); return; }
      // Answering twice changes the answer rather than adding another.
      const put = await db.from("club_attendance").upsert({
        event_id: pickEvent.value, member_id: pickMember.value,
        status: pickStatus.value, updated_at: new Date().toISOString(),
      }, { onConflict: "event_id,member_id" });
      if (put.error) { say("Not saved: " + put.error.message, true); return; }
      say("Answer saved.");
      loadAnswers();
    });

    loadChoices();
    loadAnswers();
  }

  /** Accounts and families: roles, guardians, names, and recorded consent. */
  function renderFamilies(list) {
    const callout = el("div", "admin-callout");
    callout.appendChild(el("h3", null, "Making a new account"));
    const how = el("p");
    how.innerHTML = "Accounts are created in the Supabase dashboard, under " +
      "<strong>Authentication → Users → Add user</strong>, with <em>Auto Confirm User</em> " +
      "ticked. Doing it from here would need a key that bypasses every security rule " +
      "in the database, and a key like that must never be in a web page.";
    callout.appendChild(how);
    callout.appendChild(el("p", null,
      "The new account then appears below by itself. Set what it may do, and who is responsible for it, here."));
    list.appendChild(callout);

    const people = el("div", "admin-list");
    list.appendChild(people);

    const ROLES = [["child", "Child"], ["parent", "Parent"], ["admin", "Runs the site"], ["member", "Member (old)"]];

    async function loadPeople() {
      const answer = await db.from("profiles")
        .select("id, display_name, role, guardian_id, consent_at")
        .order("display_name");
      if (answer.error) { say("Could not load the accounts: " + answer.error.message, true); return; }
      state.people = answer.data || [];
      people.innerHTML = "";
      state.people.forEach(function (person) { people.appendChild(drawPerson(person)); });
    }

    function drawPerson(person) {
      const card = el("div", "person");
      const who = el("div");

      /*
       * A new account's display name is the email it signed up with, and
       * "ldonaleski@icloud.com's reading" is a miserable thing to greet a
       * child with -- so the name is editable right here.
       */
      const name = document.createElement("input");
      name.type = "text";
      name.className = "person-name";
      name.value = person.display_name || "";
      name.placeholder = "What to call them";
      name.setAttribute("aria-label", "Display name");
      who.appendChild(name);
      if (person.guardian_id) {
        const guardian = state.people.find(function (p) { return p.id === person.guardian_id; });
        who.appendChild(el("p", "person-mail",
          "looked after by " + (guardian ? guardian.display_name : "somebody")));
      }
      card.appendChild(who);

      /* Consent is shown, not just stored: a child account without a recorded
         "a parent agreed" is the one thing here worth noticing at a glance. */
      const consent = el("span");
      if (person.role === "child") {
        const agreed = Boolean(person.consent_at && person.guardian_id);
        consent.className = "person-consent" + (agreed ? "" : " is-missing");
        consent.textContent = agreed
          ? "consent recorded " + String(person.consent_at).slice(0, 10)
          : "no consent recorded";
      }
      card.appendChild(consent);

      const controls = el("div", "person-controls");
      controls.appendChild(el("span", "person-mail", "May:"));
      const role = document.createElement("select");
      ROLES.forEach(function (pair) {
        const option = document.createElement("option");
        option.value = pair[0];
        option.textContent = pair[1];
        role.appendChild(option);
      });
      role.value = person.role;
      controls.appendChild(role);

      controls.appendChild(el("span", "person-mail", "Grown-up:"));
      const guardian = document.createElement("select");
      const none = document.createElement("option");
      none.value = "";
      none.textContent = "Nobody";
      guardian.appendChild(none);
      state.people
        .filter(function (p) { return p.id !== person.id && p.role !== "child"; })
        .forEach(function (p) {
          const option = document.createElement("option");
          option.value = p.id;
          option.textContent = p.display_name || "(no name)";
          guardian.appendChild(option);
        });
      guardian.value = person.guardian_id || "";
      controls.appendChild(guardian);

      const save = el("button", "btn btn-secondary btn-small", "Save");
      save.type = "button";
      save.addEventListener("click", function () {
        savePerson(person, role.value, guardian.value, name.value);
      });
      controls.appendChild(save);
      card.appendChild(controls);
      return card;
    }

    async function savePerson(person, role, guardianId, displayName) {
      const record = { role: role, guardian_id: guardianId || null };
      const called = String(displayName || "").trim();
      if (called) record.display_name = called;

      /*
       * The guardian link IS the moment an adult takes responsibility, so
       * consent is stamped then, by whoever is signed in doing it -- and never
       * cleared afterwards: that a parent once agreed remains true even if
       * the arrangement changes.
       */
      if (role === "child" && guardianId && !person.consent_at) {
        record.consent_at = new Date().toISOString();
        const me = auth.who();
        record.consent_by = me.user ? me.user.id : null;
      }

      const saved = await db.from("profiles").update(record).eq("id", person.id);
      if (saved.error) { say("Not saved: " + saved.error.message, true); return; }
      say("Saved " + (called || "that account") + ".");
      loadPeople();
    }

    loadPeople();
  }

  /** Below the club list: who belongs to which club. */
  function renderMemberships(list) {
    const head = el("h3", "admin-subhead", "Who is in which");
    list.appendChild(head);

    const form = el("form", "admin-form");
    const pickClub = document.createElement("select");
    const pickPerson = document.createElement("select");
    [["Club", pickClub], ["Person", pickPerson]].forEach(function (pair) {
      const wrap = el("div", "field");
      wrap.appendChild(el("label", null, pair[0]));
      wrap.appendChild(pair[1]);
      form.appendChild(wrap);
    });

    // Organiser is a club-sized job, so it is given here, not by making
    // somebody an administrator of the whole site.
    const pickRole = document.createElement("select");
    [["member", "Member — reads the club"], ["organiser", "Organiser — also runs it"]]
      .forEach(function (pair) {
        const option = document.createElement("option");
        option.value = pair[0];
        option.textContent = pair[1];
        pickRole.appendChild(option);
      });
    const roleWrap = el("div", "field");
    roleWrap.appendChild(el("label", null, "As"));
    roleWrap.appendChild(pickRole);
    form.appendChild(roleWrap);

    const actions = el("div", "game-actions");
    const add = el("button", "btn btn-primary", "Add them");
    add.type = "submit";
    actions.appendChild(add);
    form.appendChild(actions);
    list.appendChild(form);

    const joined = el("div", "admin-list");
    list.appendChild(joined);

    async function loadChoices() {
      const clubs = await db.from("clubs").select("id, name").order("name");
      pickClub.innerHTML = "";
      (clubs.data || []).forEach(function (row) {
        const option = document.createElement("option");
        option.value = row.id;
        option.textContent = row.name;
        pickClub.appendChild(option);
      });
      const people = await db.from("profiles").select("id, display_name, role").order("display_name");
      pickPerson.innerHTML = "";
      (people.data || []).forEach(function (row) {
        const option = document.createElement("option");
        option.value = row.id;
        option.textContent = (row.display_name || "(no name)") + " — " + row.role;
        pickPerson.appendChild(option);
      });
    }

    async function loadJoined() {
      const answer = await db.from("club_memberships")
        .select("club_id, profile_id, club_role, clubs (name), profiles (display_name)");
      joined.innerHTML = "";
      (answer.data || []).forEach(function (row) {
        const person = row.profiles ? row.profiles.display_name : "somebody";
        const club = row.clubs ? row.clubs.name : "a club";
        joined.appendChild(rowCard(
          person + " — " + club + (row.club_role === "organiser" ? " (organiser)" : ""),
          "",
          null,
          async function () {
            if (!window.confirm("Take " + person + " out of " + club + "?")) return;
            const gone = await db.from("club_memberships").delete()
              .eq("club_id", row.club_id).eq("profile_id", row.profile_id);
            if (gone.error) { say("Not removed: " + gone.error.message, true); return; }
            say("Removed " + person + " from " + club + ".");
            loadJoined();
          }));
      });
      if (!answer.data || !answer.data.length) {
        joined.appendChild(el("p", "console-empty", "Nobody is in a club yet."));
      }
    }

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!pickClub.value || !pickPerson.value) { say("Pick a club and a person first.", true); return; }
      // Adding somebody twice should be a shrug, not an error.
      const put = await db.from("club_memberships").upsert({
        club_id: pickClub.value, profile_id: pickPerson.value, club_role: pickRole.value,
      }, { onConflict: "club_id,profile_id" });
      if (put.error) { say("Not added: " + put.error.message, true); return; }
      say("Added them.");
      loadJoined();
    });

    loadChoices();
    loadJoined();
  }

  /* ================================================================ */
  /* Boot                                                              */
  /* ================================================================ */

  document.getElementById("section-add").addEventListener("click", function () { openDrawer(null); });
  document.getElementById("section-search").addEventListener("input", function (event) {
    state.search = event.target.value;
    drawList();
  });

  async function loadFamily() {
    const home = await db.from("households").select("id, name").limit(1).maybeSingle();
    state.household = home.data || null;
    if (!state.household) return;
    const folk = await db.from("household_members")
      .select("profiles (id, display_name)").eq("household_id", state.household.id);
    state.folk = (folk.data || []).map(function (r) { return r.profiles; }).filter(Boolean);
  }

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
      consoleEl.hidden = true;
      return;
    }
    state.me = who.user.id;
    state.can = await window.AccountBar.whatTheyCanDo();
    locked.hidden = true;
    consoleEl.hidden = false;

    await loadFamily();
    if (state.can.site) {
      const people = await db.from("profiles").select("id, display_name, role").order("display_name");
      state.people = people.data || [];
    }

    // The address remembers where you were, so a refresh lands you back there.
    const sections = visibleSections();
    const wanted = (window.location.hash || "").replace("#", "");
    const opening = sections.find(function (s) { return s.id === wanted; }) || sections[0];
    if (opening) openSection(opening); else drawNav();
  });

  window.ManagePage = { SECTIONS: SECTIONS, visible: visibleSections, state: state };
})();
