/**
 * The club page, once there are real accounts.
 *
 * The password gate is gone. Not improved -- gone. It hid its contents behind
 * something anybody who knew the word could pass on, and every member shared
 * the same one. Now the database decides: it hands the rows to a session it
 * recognises and refuses everybody else, and nothing in this file can talk it
 * round. Read it knowing that: this draws what the database gave, and if the
 * database gives nothing there is nothing to draw.
 */
(function () {
  "use strict";

  /**
   * Is this alert on screen today?
   *
   * Declared up here, and exported below, BEFORE the check that gives up when
   * there is no session. Otherwise the only way to test the dates would be to
   * have a live login, and date arithmetic is exactly the sort of thing that
   * should be testable on its own -- an alert about a cancelled practice must
   * not still be sitting there in March.
   *
   * A missing start means "already showing"; a missing end means "until it is
   * deleted". Both boundary days count as showing.
   */
  function showing(alert, today) {
    const day = today || new Date().toISOString().slice(0, 10);
    if (alert.starts_on && alert.starts_on > day) return false;
    if (alert.ends_on && alert.ends_on < day) return false;
    return true;
  }

  window.ClubPage = { showing: showing };

  const auth = window.LWLAuth;
  const gate = document.getElementById("club-gate");
  const gateWhy = document.getElementById("club-gate-why");
  const body = document.getElementById("club-body");
  if (!auth || !body) return;

  const db = auth.client;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function showGate(why) {
    gateWhy.textContent = why;
    gate.hidden = false;
    body.hidden = true;
  }

  /* ---------------- Alerts ---------------- */

  async function drawAlerts() {
    const holder = document.getElementById("club-alerts");
    if (!holder) return;
    const answer = await db.from("club_alerts")
      .select("id, message, level, starts_on, ends_on")
      .order("created_at", { ascending: false });
    holder.innerHTML = "";
    if (answer.error) return;
    // An alert with a date that has passed retires itself rather than sitting
    // there telling people about a practice that happened last month.
    (answer.data || []).filter(function (a) { return showing(a); })
      .forEach(function (alert) {
        const note = el("p", "club-alert club-alert--" + alert.level, alert.message);
        note.setAttribute("role", alert.level === "warning" ? "alert" : "status");
        holder.appendChild(note);
      });
  }

  /* ---------------- Members ---------------- */

  async function drawMembers() {
    const holder = document.getElementById("members-list");
    if (!holder) return;
    /*
     * Two requests, not one join, and deliberately so. The children are
     * readable by every member; a parent's email and phone are readable only
     * where the parent said so, or by an administrator. Asking separately
     * means the second request simply returns fewer rows for most people --
     * the database applies the rule, and this code never has to decide who
     * deserves to see what.
     */
    const answer = await db.from("club_members")
      .select("id, name, role, wca_id, note, parent_name, share_parent_contact, sort_order, club_results (competition, event, round, place, single, average, solves)")
      .order("sort_order");
    const contacts = await db.from("club_member_contacts").select("member_id, email, phone, note");
    const contactFor = {};
    (contacts.data || []).forEach(function (row) { contactFor[row.member_id] = row; });
    if (answer.error) { holder.appendChild(el("p", "club-note", "Could not load the members just now.")); return; }

    // The renderer built for the old page still applies: it takes members with
    // their results and works the personal bests out rather than storing them.
    const members = (answer.data || []).map(function (row) {
      return {
        name: row.name, role: row.role, wcaId: row.wca_id, note: row.note,
        parentName: row.parent_name, parentContact: contactFor[row.id] || null,
        results: (row.club_results || []).map(function (r) {
          return { competition: r.competition, event: r.event, round: r.round,
                   place: r.place, single: r.single, average: r.average,
                   solves: r.solves || [] };
        }),
      };
    });
    holder.innerHTML = "";
    if (window.ClubMembers) window.ClubMembers.drawInto(holder, members);
  }

  /* ---------------- Who to ask ---------------- */

  async function drawContact() {
    const holder = document.getElementById("contact-list");
    if (!holder) return;
    const answer = await db.from("club_contact")
      .select("name, role, email, phone, note").order("sort_order");
    holder.innerHTML = "";
    if (answer.error) {
      holder.appendChild(el("p", "club-note", "Could not load the contact details just now."));
      return;
    }
    (answer.data || []).forEach(function (row) {
      const card = el("div", "contact-card");
      card.appendChild(el("p", "contact-name", row.name));
      if (row.role) card.appendChild(el("p", "contact-role", row.role));
      const ways = el("ul", "contact-ways");
      if (row.email) ways.appendChild(contactWay("Email", "mailto:" + row.email, row.email));
      if (row.phone) {
        const dialable = "+1" + String(row.phone).replace(/[^0-9]/g, "");
        ways.appendChild(contactWay("Phone", "tel:" + dialable, row.phone));
      }
      card.appendChild(ways);
      if (row.note) card.appendChild(el("p", "member-note", row.note));
      holder.appendChild(card);
    });
    if (!answer.data || !answer.data.length) {
      holder.appendChild(el("p", "club-note", "No contact details listed yet."));
    }
  }

  function contactWay(label, href, text) {
    const item = document.createElement("li");
    item.appendChild(el("span", "contact-label", label));
    const link = el("a", null, text);
    link.href = href;
    item.appendChild(link);
    return item;
  }

  /* ---------------- Competitions and meet-ups ---------------- */

  async function drawEvents() {
    const answer = await db.from("club_events")
      .select("id, name, slug, held_on, venue, city, address, fee, capacity, note, kind, url, starts_at, ends_at")
      .order("held_on");
    if (answer.error) return;

    const all = (answer.data || []).map(function (row) {
      return { name: row.name, slug: row.slug, date: row.held_on, venue: row.venue,
               city: row.city, address: row.address, fee: row.fee, limit: row.capacity,
               note: row.note, kind: row.kind, url: row.url,
               startsAt: row.starts_at, endsAt: row.ends_at };
    });

    if (window.ClubEvents) {
      window.ClubEvents.drawInto(
        document.getElementById("events-list"),
        all.filter(function (e) { return e.kind !== "meetup"; }),
        document.getElementById("next-up"));
      window.ClubEvents.drawInto(
        document.getElementById("meetups-list"),
        all.filter(function (e) { return e.kind === "meetup"; }),
        null,
        "Nothing arranged yet. When a meet-up is fixed it will appear here, with the date, the place and the time.");
    }
  }

  /* ---------------- Who is here ---------------- */

  auth.onChange(async function (state) {
    if (state.unconfigured) {
      showGate("Accounts are not switched on yet.");
      return;
    }
    if (state.loading) return;
    if (!state.user) {
      showGate("This page is for club members. You need to be signed in to read it.");
      return;
    }
    if (!state.profile) {
      // Signed in, but nobody has made them a member. Said plainly, because
      // they are somebody we know rather than a stranger.
      showGate("You are signed in, but your account is not an active club member yet. Ask Luke's dad to add you.");
      return;
    }
    gate.hidden = true;
    body.hidden = false;
    const name = state.profile.display_name || state.user.email;
    const hello = document.getElementById("club-hello");
    if (hello) hello.textContent = "Signed in as " + name + ".";
    await Promise.all([drawAlerts(), drawMembers(), drawEvents(), drawContact()]);
    if (window.ClubTabs) window.ClubTabs.wire(document.getElementById("club-tabs"));
  });

})();
