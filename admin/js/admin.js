/**
 * The admin portal.
 *
 * Everything here is a convenience for one person. It is NOT what stops
 * anybody else editing the club: that is row-level security in the database,
 * which refuses a write from a session whose profile does not say admin. If
 * somebody strips the guard out of this file in their own browser, every
 * request it then makes comes back empty-handed.
 *
 * Which is why the guard below is written as "show the work" rather than
 * "allow the work". It is a signpost.
 */
(function () {
  "use strict";

  const auth = window.LWLAuth;
  const intro = document.getElementById("admin-intro");
  const locked = document.getElementById("admin-locked");
  const lockedWhy = document.getElementById("admin-locked-why");
  const work = document.getElementById("admin-work");
  const message = document.getElementById("admin-message");
  if (!auth || !work) return;

  const db = auth.client;

  function say(text, bad) {
    if (!message) return;
    message.textContent = text;
    message.className = "admin-message" + (bad ? " is-bad" : "");
    if (text) window.setTimeout(function () {
      if (message.textContent === text) message.textContent = "";
    }, 4000);
  }

  function showLocked(why) {
    intro.textContent = "Club administration.";
    lockedWhy.textContent = why;
    locked.hidden = false;
    work.hidden = true;
  }

  /* ---------------- Tabs ---------------- */

  function wireTabs() {
    const tabs = Array.prototype.slice.call(document.querySelectorAll(".tab-strip .tab"));
    tabs.forEach(function (tab, index) {
      tab.addEventListener("click", function () {
        tabs.forEach(function (other) {
          const panel = document.getElementById(other.getAttribute("aria-controls"));
          const chosen = other === tab;
          other.classList.toggle("is-on", chosen);
          other.setAttribute("aria-selected", String(chosen));
          other.tabIndex = chosen ? 0 : -1;
          if (panel) panel.hidden = !chosen;
        });
      });
      tab.addEventListener("keydown", function (event) {
        let next = null;
        if (event.key === "ArrowRight") next = tabs[(index + 1) % tabs.length];
        if (event.key === "ArrowLeft") next = tabs[(index - 1 + tabs.length) % tabs.length];
        if (!next) return;
        event.preventDefault();
        next.click();
        next.focus();
      });
    });
  }

  /* ---------------- Members ---------------- */

  const memberForm = document.getElementById("member-form");
  const memberList = document.getElementById("member-list");

  function memberFields() {
    return {
      id: document.getElementById("member-id"),
      name: document.getElementById("member-name"),
      role: document.getElementById("member-role"),
      wca: document.getElementById("member-wca"),
      note: document.getElementById("member-note"),
    };
  }

  async function loadMembers() {
    const answer = await db.from("club_members")
      .select("id, name, role, wca_id, note").order("sort_order").order("name");
    if (answer.error) { say("Could not load members: " + answer.error.message, true); return; }
    memberList.innerHTML = "";
    (answer.data || []).forEach(function (row) {
      memberList.appendChild(rowCard(
        row.name + (row.role ? " — " + row.role : ""),
        [row.wca_id, row.note].filter(Boolean).join(" · "),
        function () { fillMember(row); },
        function () { removeRow("club_members", row.id, loadMembers, row.name); }
      ));
    });
    if (!answer.data || !answer.data.length) {
      memberList.appendChild(emptyNote("No members yet."));
    }
  }

  function fillMember(row) {
    const f = memberFields();
    f.id.value = row.id;
    f.name.value = row.name || "";
    f.role.value = row.role || "";
    f.wca.value = row.wca_id || "";
    f.note.value = row.note || "";
    f.name.focus();
  }

  if (memberForm) {
    memberForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      const f = memberFields();
      const record = {
        name: f.name.value.trim(),
        role: f.role.value.trim() || null,
        wca_id: f.wca.value.trim() || null,
        note: f.note.value.trim() || null,
      };
      const answer = f.id.value
        ? await db.from("club_members").update(record).eq("id", f.id.value)
        : await db.from("club_members").insert(record);
      if (answer.error) { say("Not saved: " + answer.error.message, true); return; }
      say("Saved " + record.name + ".");
      memberForm.reset();
      f.id.value = "";
      loadMembers();
    });
    document.getElementById("member-clear").addEventListener("click", function () {
      memberForm.reset();
      memberFields().id.value = "";
    });
  }

  /* ---------------- Competitions ---------------- */

  const eventForm = document.getElementById("event-form");
  const eventList = document.getElementById("event-list");

  function eventFields() {
    const get = function (id) { return document.getElementById(id); };
    return { id: get("event-id"), name: get("event-name"), date: get("event-date"),
             slug: get("event-slug"), venue: get("event-venue"), city: get("event-city"),
             fee: get("event-fee"), capacity: get("event-capacity"), note: get("event-note") };
  }

  async function loadEvents() {
    const answer = await db.from("club_events")
      .select("id, name, slug, held_on, venue, city, fee, capacity, note")
      .order("held_on");
    if (answer.error) { say("Could not load competitions: " + answer.error.message, true); return; }
    eventList.innerHTML = "";
    (answer.data || []).forEach(function (row) {
      eventList.appendChild(rowCard(
        row.held_on + " — " + row.name,
        [row.city, row.fee].filter(Boolean).join(" · "),
        function () { fillEvent(row); },
        function () { removeRow("club_events", row.id, loadEvents, row.name); }
      ));
    });
    if (!answer.data || !answer.data.length) {
      eventList.appendChild(emptyNote("No competitions listed."));
    }
  }

  function fillEvent(row) {
    const f = eventFields();
    f.id.value = row.id;
    f.name.value = row.name || "";
    f.date.value = row.held_on || "";
    f.slug.value = row.slug || "";
    f.venue.value = row.venue || "";
    f.city.value = row.city || "";
    f.fee.value = row.fee || "";
    f.capacity.value = row.capacity || "";
    f.note.value = row.note || "";
    f.name.focus();
  }

  if (eventForm) {
    eventForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      const f = eventFields();
      const record = {
        name: f.name.value.trim(),
        held_on: f.date.value,
        slug: f.slug.value.trim() || null,
        venue: f.venue.value.trim() || null,
        city: f.city.value.trim() || null,
        fee: f.fee.value.trim() || null,
        capacity: f.capacity.value ? Number(f.capacity.value) : null,
        note: f.note.value.trim() || null,
      };
      const answer = f.id.value
        ? await db.from("club_events").update(record).eq("id", f.id.value)
        : await db.from("club_events").insert(record);
      if (answer.error) { say("Not saved: " + answer.error.message, true); return; }
      say("Saved " + record.name + ".");
      eventForm.reset();
      f.id.value = "";
      loadEvents();
    });
    document.getElementById("event-clear").addEventListener("click", function () {
      eventForm.reset();
      eventFields().id.value = "";
    });
  }

  /* ---------------- Pages ---------------- */

  const pageForm = document.getElementById("page-form");

  async function loadPage(key) {
    const answer = await db.from("club_pages").select("key, title, body").eq("key", key).maybeSingle();
    if (answer.error) { say("Could not load that page: " + answer.error.message, true); return; }
    document.getElementById("page-title").value = answer.data ? answer.data.title : "";
    document.getElementById("page-body").value = answer.data ? answer.data.body : "";
  }

  if (pageForm) {
    document.getElementById("page-key").addEventListener("change", function (event) {
      loadPage(event.target.value);
    });
    pageForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      const record = {
        key: document.getElementById("page-key").value,
        title: document.getElementById("page-title").value.trim(),
        body: document.getElementById("page-body").value,
        updated_at: new Date().toISOString(),
      };
      const answer = await db.from("club_pages").upsert(record, { onConflict: "key" });
      if (answer.error) { say("Not saved: " + answer.error.message, true); return; }
      say("Saved the " + record.key + " page.");
    });
  }

  /* ---------------- Shared bits ---------------- */

  function rowCard(title, detail, onEdit, onRemove) {
    const card = document.createElement("div");
    card.className = "admin-row";
    const words = document.createElement("div");
    const strong = document.createElement("p");
    strong.className = "admin-row-title";
    strong.textContent = title;
    words.appendChild(strong);
    if (detail) {
      const small = document.createElement("p");
      small.className = "admin-row-detail";
      small.textContent = detail;
      words.appendChild(small);
    }
    card.appendChild(words);
    const actions = document.createElement("div");
    actions.className = "admin-row-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "btn btn-secondary btn-small";
    edit.textContent = "Edit";
    edit.addEventListener("click", onEdit);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn btn-secondary btn-small";
    remove.textContent = "Delete";
    remove.addEventListener("click", onRemove);
    actions.appendChild(edit);
    actions.appendChild(remove);
    card.appendChild(actions);
    return card;
  }

  function emptyNote(text) {
    const p = document.createElement("p");
    p.className = "club-note";
    p.textContent = text;
    return p;
  }

  /** Deleting is the one thing here that cannot be undone, so it asks first. */
  async function removeRow(table, id, reload, name) {
    if (!window.confirm("Delete " + name + "? This cannot be undone.")) return;
    const answer = await db.from(table).delete().eq("id", id);
    if (answer.error) { say("Not deleted: " + answer.error.message, true); return; }
    say("Deleted " + name + ".");
    reload();
  }

  /* ---------------- Who is here ---------------- */

  auth.onChange(function (state) {
    if (state.unconfigured) {
      showLocked("Accounts are not switched on yet.");
      return;
    }
    if (state.loading) return;
    if (!state.user) {
      showLocked("You need to be signed in to see this.");
      return;
    }
    if (!auth.isAdmin()) {
      // Said plainly rather than pretending the page does not exist: they are
      // signed in, so they are somebody we know.
      showLocked("Your account is not an administrator, so there is nothing here for you.");
      return;
    }
    intro.textContent = "Signed in as " +
      ((state.profile && state.profile.display_name) || state.user.email) + ".";
    locked.hidden = true;
    work.hidden = false;
    wireTabs();
    loadMembers();
    loadEvents();
    loadPage("welcome");
  });
})();
