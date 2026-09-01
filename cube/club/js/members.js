/**
 * Drawing the members list.
 *
 * The logic lives out here in the open; the members themselves live inside the
 * encrypted file. That split is deliberate. Nothing in this script says who is
 * in the club, so it can be read by anybody without telling them anything, and
 * adding a member never means touching code -- you unlock the page, edit a
 * small block of JSON, and lock it again.
 *
 * Personal bests are worked out from the results rather than stored beside
 * them. Two copies of the same fact drift apart the moment somebody updates
 * one and forgets the other, and a child's personal best is exactly the sort
 * of thing that gets updated in a hurry.
 */
(function () {
  "use strict";

  /** "1:22.73" and "12.44" both become seconds. A DNF counts as worst. */
  function seconds(text) {
    if (text === null || text === undefined) return Infinity;
    const clean = String(text).trim();
    if (/^dn[fs]$/i.test(clean)) return Infinity;
    const parts = clean.split(":");
    if (parts.length === 2) return Number(parts[0]) * 60 + Number(parts[1]);
    return Number(clean);
  }

  /** Back to the way a cuber writes it. */
  function clock(value) {
    if (!isFinite(value)) return "DNF";
    const mins = Math.floor(value / 60);
    const secs = value - mins * 60;
    if (!mins) return secs.toFixed(2);
    return mins + ":" + (secs < 10 ? "0" : "") + secs.toFixed(2);
  }

  /**
   * The World Cube Association average of five: throw away the best and the
   * worst, take the mean of the middle three. Two DNFs and there is no
   * average at all, because only one of them can be the thrown-away worst.
   */
  function averageOfFive(solves) {
    const times = solves.map(seconds);
    if (times.length !== 5) return null;
    const dnfs = times.filter(function (t) { return !isFinite(t); }).length;
    if (dnfs > 1) return Infinity;
    const sorted = times.slice().sort(function (a, b) { return a - b; });
    const middle = sorted.slice(1, 4);
    return middle.reduce(function (a, b) { return a + b; }, 0) / 3;
  }

  /** Best single and best average across everything a member has done. */
  function bests(member) {
    const results = member.results || [];
    let single = Infinity, average = Infinity;
    results.forEach(function (r) {
      single = Math.min(single, seconds(r.single));
      average = Math.min(average, seconds(r.average));
    });
    const meetings = {};
    results.forEach(function (r) { meetings[r.competition] = true; });
    return {
      single: isFinite(single) ? clock(single) : "—",
      average: isFinite(average) ? clock(average) : "—",
      competitions: Object.keys(meetings).length,
    };
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function drawSolves(solves) {
    const times = solves.map(seconds);
    const best = Math.min.apply(null, times);
    const worst = Math.max.apply(null, times);
    let droppedBest = false, droppedWorst = false;
    const list = el("ul", "solve-list");
    solves.forEach(function (solve, i) {
      // One best and one worst are set aside, exactly as the average does it.
      const isBest = !droppedBest && times[i] === best;
      const isWorst = !isBest && !droppedWorst && times[i] === worst;
      if (isBest) droppedBest = true;
      if (isWorst) droppedWorst = true;
      const item = el("li", "solve" + (isBest || isWorst ? " solve--dropped" : ""),
        isBest || isWorst ? "(" + solve + ")" : solve);
      list.appendChild(item);
    });
    return list;
  }

  function drawMember(member) {
    const card = el("article", "member");
    const head = el("div", "member-head");
    head.appendChild(el("h3", "member-name", member.name));
    if (member.wcaId) {
      const link = el("a", "member-wca", member.wcaId);
      link.href = "https://www.worldcubeassociation.org/persons/" + member.wcaId;
      link.target = "_blank";
      link.rel = "noopener";
      link.title = "World Cube Association profile";
      head.appendChild(link);
    }
    if (member.role) head.appendChild(el("span", "member-role", member.role));
    card.appendChild(head);

    /**
     * Somebody who does not compete gets no results table. Showing them a row
     * of dashes under "Best single" would be a small unkindness, and would
     * also imply they had tried and failed rather than that they run the
     * thing, so the stats only appear for people who have times.
     */
    if ((member.results || []).length) {
      const summary = bests(member);
      const stats = el("div", "member-stats");
      [["Best single", summary.single], ["Best average", summary.average],
       ["Competitions", String(summary.competitions)]].forEach(function (pair) {
        const stat = el("div", "member-stat");
        stat.appendChild(el("span", "member-stat-label", pair[0]));
        stat.appendChild(el("span", "member-stat-value", pair[1]));
        stats.appendChild(stat);
      });
      card.appendChild(stats);
    }

    (member.results || []).forEach(function (r) {
      const row = el("div", "member-result");
      const where = el("p", "member-where");
      where.appendChild(el("strong", null, r.competition));
      where.appendChild(el("span", "member-round",
        " · " + [r.event, r.round].filter(Boolean).join(", ") +
        (r.place ? " · " + ordinal(r.place) : "")));
      row.appendChild(where);
      if (r.solves && r.solves.length === 5) row.appendChild(drawSolves(r.solves));
      card.appendChild(row);
    });

    /*
     * The parent's name shows for everybody -- knowing whose parent is whose
     * is ordinary club information. Their email and phone only arrive at all
     * if the database decided this reader may have them, so there is no test
     * here for who is allowed what: if it is absent, it was refused, and the
     * card simply has less on it.
     */
    if (member.parentName || member.parentContact) {
      const parent = el("div", "member-parent");
      parent.appendChild(el("span", "member-parent-label", "Parent"));
      parent.appendChild(el("span", "member-parent-name",
        member.parentName || "—"));

      const contact = member.parentContact;
      if (contact && (contact.email || contact.phone)) {
        const ways = el("ul", "contact-ways");
        if (contact.email) {
          const item = document.createElement("li");
          const link = el("a", null, contact.email);
          link.href = "mailto:" + contact.email;
          item.appendChild(link);
          ways.appendChild(item);
        }
        if (contact.phone) {
          const item = document.createElement("li");
          const link = el("a", null, contact.phone);
          link.href = "tel:+1" + String(contact.phone).replace(/[^0-9]/g, "");
          item.appendChild(link);
          ways.appendChild(item);
        }
        parent.appendChild(ways);
      } else if (member.parentName) {
        parent.appendChild(el("span", "member-parent-private",
          "Contact details not shared"));
      }
      card.appendChild(parent);
    }

    if (member.note) card.appendChild(el("p", "member-note", member.note));
    return card;
  }

  function ordinal(n) {
    const num = Number(n);
    if (!isFinite(num)) return String(n);
    const tens = num % 100;
    if (tens >= 11 && tens <= 13) return num + "th";
    const ends = { 1: "st", 2: "nd", 3: "rd" };
    return num + (ends[num % 10] || "th");
  }

  /**
   * Draws a list of members that somebody else fetched.
   *
   * Split out from render() when the members moved into the database: the
   * drawing is identical, only where the list came from changed. Keeping one
   * drawing function means the page cannot end up with two slightly different
   * ideas of what a member card looks like.
   */
  function drawInto(holder, members) {
    if (!holder) return 0;
    holder.innerHTML = "";
    (members || []).forEach(function (member) { holder.appendChild(drawMember(member)); });
    if (!members || !members.length) {
      holder.appendChild(el("p", "club-note", "No members listed yet."));
    }
    return (members || []).length;
  }

  /** Reads the member list out of the page and draws it. */
  function render(root) {
    const holder = (root || document).querySelector("#members-list");
    const source = (root || document).querySelector("#club-members");
    if (!holder || !source) return 0;
    let members = [];
    try { members = JSON.parse(source.textContent) || []; } catch (err) { members = []; }
    holder.innerHTML = "";
    members.forEach(function (member) { holder.appendChild(drawMember(member)); });
    if (!members.length) holder.appendChild(el("p", "club-note", "No members listed yet."));
    return members.length;
  }

  window.ClubMembers = {
    render: render, drawInto: drawInto, seconds: seconds, clock: clock,
    averageOfFive: averageOfFive, bests: bests, ordinal: ordinal,
  };
})();
