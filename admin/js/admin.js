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
    const get = function (id) { return document.getElementById(id); };
    return {
      id: get("member-id"), name: get("member-name"), role: get("member-role"),
      wca: get("member-wca"), note: get("member-note"),
      parent: get("member-parent"), parentEmail: get("member-parent-email"),
      parentPhone: get("member-parent-phone"), share: get("member-share"),
      account: get("member-account"),
    };
  }

  async function loadMembers() {
    const answer = await db.from("club_members")
      .select("id, name, role, wca_id, note, parent_name, share_parent_contact, profile_id")
      .order("sort_order").order("name");
    if (answer.error) { say("Could not load members: " + answer.error.message, true); return; }
    const contacts = await db.from("club_member_contacts").select("member_id, email, phone");
    const contactFor = {};
    (contacts.data || []).forEach(function (row) { contactFor[row.member_id] = row; });

    memberList.innerHTML = "";
    (answer.data || []).forEach(function (row) {
      row.contact = contactFor[row.id] || null;
      const parentBit = row.parent_name
        ? "parent: " + row.parent_name +
          (row.share_parent_contact ? " (shared with members)" : " (only you can see their details)")
        : "no parent recorded";
      memberList.appendChild(rowCard(
        row.name + (row.role ? " — " + row.role : ""),
        [row.wca_id, parentBit].filter(Boolean).join(" · "),
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
    f.parent.value = row.parent_name || "";
    f.parentEmail.value = (row.contact && row.contact.email) || "";
    f.parentPhone.value = (row.contact && row.contact.phone) || "";
    f.share.checked = Boolean(row.share_parent_contact);
    if (f.account) f.account.value = row.profile_id || "";
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
        parent_name: f.parent.value.trim() || null,
        share_parent_contact: Boolean(f.share.checked),
        profile_id: (f.account && f.account.value) || null,
      };
      const answer = f.id.value
        ? await db.from("club_members").update(record).eq("id", f.id.value).select("id")
        : await db.from("club_members").insert(record).select("id");
      if (answer.error) { say("Not saved: " + answer.error.message, true); return; }

      // The parent's details live in their own table, so they are saved
      // separately -- and removed entirely if both boxes were emptied, rather
      // than left behind as a blank row nobody can see.
      const memberId = f.id.value || (answer.data && answer.data[0] && answer.data[0].id);
      const email = f.parentEmail.value.trim();
      const phone = f.parentPhone.value.trim();
      if (memberId) {
        if (email || phone) {
          const kept = await db.from("club_member_contacts")
            .upsert({ member_id: memberId, email: email || null, phone: phone || null },
                    { onConflict: "member_id" });
          if (kept.error) { say("Member saved, but the parent's details were not: " + kept.error.message, true); return; }
        } else {
          await db.from("club_member_contacts").delete().eq("member_id", memberId);
        }
      }
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
             address: get("event-address"), url: get("event-url"),
             registerBy: get("event-register-by"),
             starts: get("event-starts"), ends: get("event-ends"),
             fee: get("event-fee"), capacity: get("event-capacity"), note: get("event-note") };
  }

  async function loadEvents() {
    const answer = await db.from("club_events")
      .select("id, name, slug, held_on, register_by, venue, city, address, url, starts_at, ends_at, fee, capacity, note, kind")
      .eq("kind", "competition")
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
    f.address.value = row.address || "";
    f.url.value = row.url || "";
    f.registerBy.value = row.register_by || "";
    f.starts.value = row.starts_at || "";
    f.ends.value = row.ends_at || "";
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
        address: f.address.value.trim() || null,
        url: f.url.value.trim() || null,
        register_by: f.registerBy.value || null,
        starts_at: f.starts.value || null,
        ends_at: f.ends.value || null,
        fee: f.fee.value.trim() || null,
        capacity: f.capacity.value ? Number(f.capacity.value) : null,
        note: f.note.value.trim() || null,
        kind: "competition",
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

  /* ---------------- Meet-ups ---------------- */

  const meetupForm = document.getElementById("meetup-form");
  const meetupList = document.getElementById("meetup-list");

  function meetupFields() {
    const get = function (id) { return document.getElementById(id); };
    return { id: get("meetup-id"), name: get("meetup-name"), date: get("meetup-date"),
             venue: get("meetup-venue"), city: get("meetup-city"), address: get("meetup-address"),
             starts: get("meetup-starts"), ends: get("meetup-ends"), note: get("meetup-note") };
  }

  async function loadMeetups() {
    if (!meetupList) return;
    const answer = await db.from("club_events")
      .select("id, name, held_on, venue, city, address, starts_at, ends_at, note, kind")
      .eq("kind", "meetup")
      .order("held_on");
    if (answer.error) { say("Could not load meet-ups: " + answer.error.message, true); return; }
    meetupList.innerHTML = "";
    (answer.data || []).forEach(function (row) {
      meetupList.appendChild(rowCard(
        row.held_on + " — " + row.name,
        [row.venue, row.city, row.note].filter(Boolean).join(" · "),
        function () { fillMeetup(row); },
        function () { removeRow("club_events", row.id, loadMeetups, row.name); }
      ));
    });
    if (!answer.data || !answer.data.length) {
      meetupList.appendChild(emptyNote("No meet-ups arranged. The club page says so plainly."));
    }
  }

  function fillMeetup(row) {
    const f = meetupFields();
    f.id.value = row.id;
    f.name.value = row.name || "";
    f.date.value = row.held_on || "";
    f.venue.value = row.venue || "";
    f.city.value = row.city || "";
    f.address.value = row.address || "";
    f.starts.value = row.starts_at || "";
    f.ends.value = row.ends_at || "";
    f.note.value = row.note || "";
    f.name.focus();
  }

  if (meetupForm) {
    meetupForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      const f = meetupFields();
      const record = {
        name: f.name.value.trim(),
        held_on: f.date.value,
        venue: f.venue.value.trim() || null,
        city: f.city.value.trim() || null,
        address: f.address.value.trim() || null,
        starts_at: f.starts.value || null,
        ends_at: f.ends.value || null,
        note: f.note.value.trim() || null,
        kind: "meetup",
      };
      const answer = f.id.value
        ? await db.from("club_events").update(record).eq("id", f.id.value)
        : await db.from("club_events").insert(record);
      if (answer.error) { say("Not saved: " + answer.error.message, true); return; }
      say("Saved " + record.name + ".");
      meetupForm.reset();
      f.id.value = "";
      loadMeetups();
    });
    document.getElementById("meetup-clear").addEventListener("click", function () {
      meetupForm.reset();
      meetupFields().id.value = "";
    });
  }

  /* ---------------- Alerts ---------------- */

  const alertForm = document.getElementById("alert-form");
  const alertList = document.getElementById("alert-list");

  function alertFields() {
    const get = function (id) { return document.getElementById(id); };
    return { id: get("alert-id"), message: get("alert-message"), level: get("alert-level"),
             starts: get("alert-starts"), ends: get("alert-ends") };
  }

  /** Says whether an alert is on screen right now, and why not if it is not. */
  function alertWhen(row) {
    const today = new Date().toISOString().slice(0, 10);
    if (row.starts_on && row.starts_on > today) return "starts " + row.starts_on;
    if (row.ends_on && row.ends_on < today) return "finished " + row.ends_on;
    return row.ends_on ? "showing until " + row.ends_on : "showing now";
  }

  async function loadAlerts() {
    if (!alertList) return;
    const answer = await db.from("club_alerts")
      .select("id, message, level, starts_on, ends_on")
      .order("created_at", { ascending: false });
    if (answer.error) { say("Could not load alerts: " + answer.error.message, true); return; }
    alertList.innerHTML = "";
    (answer.data || []).forEach(function (row) {
      alertList.appendChild(rowCard(
        row.message,
        (row.level === "warning" ? "Important · " : "") + alertWhen(row),
        function () { fillAlert(row); },
        function () { removeRow("club_alerts", row.id, loadAlerts, "that alert"); }
      ));
    });
    if (!answer.data || !answer.data.length) {
      alertList.appendChild(emptyNote("No alerts. The club page shows none."));
    }
  }

  function fillAlert(row) {
    const f = alertFields();
    f.id.value = row.id;
    f.message.value = row.message || "";
    f.level.value = row.level || "info";
    f.starts.value = row.starts_on || "";
    f.ends.value = row.ends_on || "";
    f.message.focus();
  }

  if (alertForm) {
    alertForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      const f = alertFields();
      const record = {
        message: f.message.value.trim(),
        level: f.level.value,
        starts_on: f.starts.value || null,
        ends_on: f.ends.value || null,
      };
      if (record.starts_on && record.ends_on && record.ends_on < record.starts_on) {
        say("That alert would finish before it started.", true);
        return;
      }
      const answer = f.id.value
        ? await db.from("club_alerts").update(record).eq("id", f.id.value)
        : await db.from("club_alerts").insert(record);
      if (answer.error) { say("Not saved: " + answer.error.message, true); return; }
      say("Alert saved.");
      alertForm.reset();
      f.id.value = "";
      loadAlerts();
    });
    document.getElementById("alert-clear").addEventListener("click", function () {
      alertForm.reset();
      alertFields().id.value = "";
    });
  }

  /* ---------------- Who is coming ---------------- */

  const goingForm = document.getElementById("going-form");
  const goingList = document.getElementById("going-list");

  /** Fills a <select> without losing what was already chosen. */
  function fillChoices(select, rows, label) {
    if (!select) return;
    const had = select.value;
    select.innerHTML = "";
    rows.forEach(function (row) {
      const option = document.createElement("option");
      option.value = row.id;
      option.textContent = label(row);
      select.appendChild(option);
    });
    if (had) select.value = had;
  }

  async function loadChoices() {
    const events = await db.from("club_events")
      .select("id, name, held_on, kind").order("held_on");
    fillChoices(document.getElementById("going-event"), events.data || [], function (row) {
      return row.held_on + " — " + row.name + (row.kind === "meetup" ? " (meet-up)" : "");
    });

    const members = await db.from("club_members").select("id, name").order("sort_order");
    fillChoices(document.getElementById("going-member"), members.data || [], function (row) {
      return row.name;
    });

    // Accounts a member record can be linked to, so that family can answer for
    // themselves. Only an administrator can read this list.
    const people = await db.from("profiles").select("id, display_name, role").order("display_name");
    const select = document.getElementById("member-account");
    if (select) {
      const had = select.value;
      select.innerHTML = "";
      const none = document.createElement("option");
      none.value = "";
      none.textContent = "Nobody yet";
      select.appendChild(none);
      (people.data || []).forEach(function (row) {
        const option = document.createElement("option");
        option.value = row.id;
        option.textContent = row.display_name + (row.role === "admin" ? " (admin)" : "");
        select.appendChild(option);
      });
      if (had) select.value = had;
    }
  }

  async function loadGoing() {
    if (!goingList) return;
    const answer = await db.from("club_attendance")
      .select("id, status, event_id, member_id, club_events (name, held_on, kind), club_members (name)")
      .order("updated_at", { ascending: false });
    if (answer.error) { say("Could not load answers: " + answer.error.message, true); return; }
    goingList.innerHTML = "";
    const words = { going: "going", maybe: "maybe", not: "not going" };
    (answer.data || []).forEach(function (row) {
      const event = row.club_events || {};
      goingList.appendChild(rowCard(
        (row.club_members ? row.club_members.name : "Someone") + " — " + (words[row.status] || row.status),
        (event.held_on || "") + " " + (event.name || ""),
        function () {
          document.getElementById("going-event").value = row.event_id;
          document.getElementById("going-member").value = row.member_id;
          document.getElementById("going-status").value = row.status;
        },
        function () { removeRow("club_attendance", row.id, loadGoing, "that answer"); }
      ));
    });
    if (!answer.data || !answer.data.length) {
      goingList.appendChild(emptyNote("Nobody has answered for anything yet."));
    }
  }

  if (goingForm) {
    goingForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      const record = {
        event_id: document.getElementById("going-event").value,
        member_id: document.getElementById("going-member").value,
        status: document.getElementById("going-status").value,
        updated_at: new Date().toISOString(),
      };
      if (!record.event_id || !record.member_id) {
        say("Pick an event and a member first.", true);
        return;
      }
      // Answering twice changes the answer rather than adding another, which
      // is what the unique constraint on the table is for.
      const answer = await db.from("club_attendance")
        .upsert(record, { onConflict: "event_id,member_id" });
      if (answer.error) { say("Not saved: " + answer.error.message, true); return; }
      say("Answer saved.");
      loadGoing();
    });
  }

  /* ---------------- Contact details ---------------- */

  const contactForm = document.getElementById("contact-form");
  const contactList = document.getElementById("contact-list-admin");

  function contactFields() {
    const get = function (id) { return document.getElementById(id); };
    return { id: get("contact-id"), name: get("contact-name"), role: get("contact-role"),
             email: get("contact-email"), phone: get("contact-phone"), note: get("contact-note") };
  }

  async function loadContacts() {
    if (!contactList) return;
    const answer = await db.from("club_contact")
      .select("id, name, role, email, phone, note").order("sort_order");
    if (answer.error) { say("Could not load contacts: " + answer.error.message, true); return; }
    contactList.innerHTML = "";
    (answer.data || []).forEach(function (row) {
      contactList.appendChild(rowCard(
        row.name + (row.role ? " — " + row.role : ""),
        [row.email, row.phone].filter(Boolean).join(" · "),
        function () { fillContact(row); },
        function () { removeRow("club_contact", row.id, loadContacts, row.name); }
      ));
    });
    if (!answer.data || !answer.data.length) {
      contactList.appendChild(emptyNote("No contact details. The club page will say so."));
    }
  }

  function fillContact(row) {
    const f = contactFields();
    f.id.value = row.id;
    f.name.value = row.name || "";
    f.role.value = row.role || "";
    f.email.value = row.email || "";
    f.phone.value = row.phone || "";
    f.note.value = row.note || "";
    f.name.focus();
  }

  if (contactForm) {
    contactForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      const f = contactFields();
      const record = {
        name: f.name.value.trim(),
        role: f.role.value.trim() || null,
        email: f.email.value.trim() || null,
        phone: f.phone.value.trim() || null,
        note: f.note.value.trim() || null,
      };
      const answer = f.id.value
        ? await db.from("club_contact").update(record).eq("id", f.id.value)
        : await db.from("club_contact").insert(record);
      if (answer.error) { say("Not saved: " + answer.error.message, true); return; }
      say("Saved " + record.name + ".");
      contactForm.reset();
      f.id.value = "";
      loadContacts();
    loadChoices();
    loadGoing();
    });
    document.getElementById("contact-clear").addEventListener("click", function () {
      contactForm.reset();
      contactFields().id.value = "";
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
    loadMeetups();
    loadAlerts();
    loadContacts();
    loadChoices();
    loadGoing();
  });
})();
