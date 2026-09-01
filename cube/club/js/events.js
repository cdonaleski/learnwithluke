/**
 * Drawing the competitions, and working out which one is next.
 *
 * The dates used to be written into the page as words -- "5 Sep 2026" beside a
 * hand-typed warning that it was days away. That is true for about a week, and
 * then the page is quietly lying: a competition that has been and gone still
 * sits at the top looking like something you could go to, and nobody notices
 * until somebody asks about it.
 *
 * So the events are data with real dates, and everything the reader sees is
 * worked out from today: how many days away it is, whether it has passed, and
 * which one is next. The page stays right on its own.
 *
 * As with the members, the logic is out here in the open and the events live
 * inside the encrypted file.
 */
(function () {
  "use strict";

  const DAY = 24 * 60 * 60 * 1000;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  /** Midnight, so a competition is "today" all day rather than until 00:01. */
  function midnight(value) {
    const d = value instanceof Date ? new Date(value) : new Date(value + "T00:00:00");
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /** Whole days from today to the date, negative once it has passed. */
  function daysUntil(date, today) {
    const from = midnight(today || new Date());
    const to = midnight(date);
    return Math.round((to - from) / DAY);
  }

  /** How far off it is, said the way a person would say it. */
  function whenWords(days) {
    if (days === 0) return "today";
    if (days === 1) return "tomorrow";
    if (days === -1) return "yesterday";
    if (days < 0) return Math.abs(days) + " days ago";
    if (days < 14) return "in " + days + " days";
    if (days < 60) return "in " + Math.round(days / 7) + " weeks";
    return "in " + Math.round(days / 30) + " months";
  }

  /** "14:30:00" reads as "2:30pm", which is how anybody would say it. */
  function tidyTime(value) {
    const bits = String(value || "").split(":");
    if (bits.length < 2) return String(value || "");
    let hour = Number(bits[0]);
    const mins = bits[1];
    const suffix = hour >= 12 ? "pm" : "am";
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return hour + (mins === "00" ? "" : ":" + mins) + suffix;
  }

  function dayOf(date) { return midnight(date).getDate(); }
  function monthOf(date) {
    const d = midnight(date);
    return MONTHS[d.getMonth()] + " " + d.getFullYear();
  }

  /** Soonest first, and anything already past sorted to the end. */
  function order(events, today) {
    return events.slice().sort(function (a, b) {
      const da = daysUntil(a.date, today), db = daysUntil(b.date, today);
      const aPast = da < 0, bPast = db < 0;
      if (aPast !== bPast) return aPast ? 1 : -1;
      return aPast ? db - da : da - db;
    });
  }

  /** The next one that has not happened yet, or null. */
  function nextUp(events, today) {
    const coming = order(events, today).filter(function (e) {
      return daysUntil(e.date, today) >= 0;
    });
    return coming.length ? coming[0] : null;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function wcaLink(slug) {
    return "https://www.worldcubeassociation.org/competitions/" + slug;
  }

  function drawEvent(event, today, onAnswer) {
    const days = daysUntil(event.date, today);
    const past = days < 0;
    const soon = !past && days <= 7;

    const card = el("article", "event" + (soon ? " event--soon" : "") + (past ? " event--past" : ""));

    const when = el("div", "event-when");
    when.appendChild(el("span", "event-day", String(dayOf(event.date))));
    when.appendChild(el("span", "event-month", monthOf(event.date)));
    card.appendChild(when);

    const what = el("div", "event-what");
    const title = el("h3");
    if (event.slug) {
      const link = el("a", null, event.name);
      link.href = wcaLink(event.slug);
      link.target = "_blank";
      link.rel = "noopener";
      title.appendChild(link);
    } else {
      title.textContent = event.name;
    }
    what.appendChild(title);

    // The whole address if we have it, so somebody could actually drive there.
    what.appendChild(el("p", "event-where",
      [event.venue, event.address || event.city].filter(Boolean).join(" — ")));

    if (event.startsAt) {
      what.appendChild(el("p", "event-time",
        "Starts " + tidyTime(event.startsAt) +
        (event.endsAt ? ", until " + tidyTime(event.endsAt) : "")));
    }

    const facts = el("ul", "event-facts");
    facts.appendChild(el("li", past ? "" : "event-when-chip", whenWords(days)));
    if (event.fee) facts.appendChild(el("li", null, event.fee + " to enter"));
    if (event.limit) facts.appendChild(el("li", null, event.limit + " competitors"));
    if (soon) facts.appendChild(el("li", "event-warn", "Very soon"));

    // The deadline matters more than the date itself: miss it and the day is
    // no use to you. So it is said in the same words, and said louder once it
    // is close or gone.
    if (!past && event.registerBy) {
      const left = daysUntil(event.registerBy, today);
      if (left < 0) {
        facts.appendChild(el("li", "event-warn", "Entries closed"));
      } else {
        facts.appendChild(el("li", left <= 7 ? "event-warn" : "event-when-chip",
          "Enter by " + dayOf(event.registerBy) + " " + monthOf(event.registerBy) +
          " (" + whenWords(left) + ")"));
      }
    }
    what.appendChild(facts);

    if (event.note) what.appendChild(el("p", "event-note", event.note));

    // Who is coming. Drawn even when nobody is, because "nobody yet" is worth
    // knowing -- it is the nudge that makes somebody be the first.
    const going = (event.attendance || []).filter(function (a) { return a.status === "going"; });
    const maybe = (event.attendance || []).filter(function (a) { return a.status === "maybe"; });
    const who = el("p", "event-going");
    if (going.length) {
      who.appendChild(el("span", "event-going-label",
        event.kind === "meetup" ? "Coming: " : "Registered: "));
      who.appendChild(el("span", null, going.map(function (a) { return a.name; }).join(", ")));
      if (maybe.length) {
        who.appendChild(el("span", "event-maybe",
          " · maybe " + maybe.map(function (a) { return a.name; }).join(", ")));
      }
    } else if (maybe.length) {
      who.appendChild(el("span", "event-going-label", "Maybe: "));
      who.appendChild(el("span", null, maybe.map(function (a) { return a.name; }).join(", ")));
    } else {
      who.appendChild(el("span", "event-going-none",
        event.kind === "meetup" ? "Nobody has said yet." : "No one registered yet."));
    }
    what.appendChild(who);

    // Somewhere to go, and a way to remember it. Neither is offered for a
    // competition that has already happened.
    if (!past) {
      const links = el("p", "event-links");
      const site = event.url || (event.slug ? wcaLink(event.slug) : null);
      if (site) {
        const page = el("a", "event-link", "Competition page");
        page.href = site;
        page.target = "_blank";
        page.rel = "noopener";
        links.appendChild(page);
      }
      if (window.ClubCalendar) {
        const calendar = window.ClubCalendar.googleUrl(event);
        if (calendar) {
          const add = el("a", "event-link", "📅 Add to calendar");
          add.href = calendar;
          add.target = "_blank";
          add.rel = "noopener";
          links.appendChild(add);
        }
      }
      // Answering for your own children. The buttons only exist for members
      // this reader may speak for; the database would refuse the rest anyway,
      // so offering them would only be a way of being told no.
      if (typeof onAnswer === "function" && (event.mine || []).length) {
        const asking = el("div", "event-rsvp");
        asking.appendChild(el("span", "event-rsvp-label",
          event.kind === "meetup" ? "Coming?" : "Entered?"));
        (event.mine || []).forEach(function (member) {
          const row = el("div", "event-rsvp-row");
          row.appendChild(el("span", "event-rsvp-name", member.name));
          [["going", event.kind === "meetup" ? "Yes" : "Registered"],
           ["maybe", "Maybe"],
           ["not", "No"]].forEach(function (pair) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "rsvp" + (member.status === pair[0] ? " is-on" : "");
            button.textContent = pair[1];
            button.addEventListener("click", function () {
              onAnswer(event, member, pair[0], button);
            });
            row.appendChild(button);
          });
          asking.appendChild(row);
        });
        what.appendChild(asking);
      }

      if (links.childNodes.length) what.appendChild(links);
    }

    card.appendChild(what);
    return card;
  }

  /**
   * Draws events somebody else fetched, optionally filling a "next up" banner.
   *
   * Used for competitions and for meet-ups alike, because they are the same
   * shape: a thing with a date. `emptyWords` is what to say when there are
   * none, which differs -- no competitions is unusual, no meet-ups is the
   * normal state of a club that has not started.
   */
  function drawInto(holder, events, banner, emptyWords, today, onAnswer) {
    if (!holder) return null;
    const sorted = order(events || [], today);
    holder.innerHTML = "";
    sorted.forEach(function (event) { holder.appendChild(drawEvent(event, today, onAnswer)); });
    if (!sorted.length) {
      holder.appendChild(el("p", "club-note", emptyWords || "Nothing on the calendar yet."));
    }
    if (banner) fillBanner(banner, nextUp(events || [], today), today);
    return { shown: sorted.length, next: nextUp(events || [], today) };
  }

  /** The "next up" line: what is soonest, and how far off. */
  function fillBanner(banner, next, today) {
    banner.innerHTML = "";
    if (!next) {
      banner.appendChild(el("span", "next-up-label", "Nothing booked"));
      banner.appendChild(el("span", "next-up-when",
        "No competition on the calendar just now."));
      banner.hidden = false;
      return;
    }
    const days = daysUntil(next.date, today);
    banner.appendChild(el("span", "next-up-label", "Next up"));
    const link = el("a", "next-up-name", next.name);
    link.href = "#events-title";
    link.addEventListener("click", function (event) {
      const target = document.getElementById("events-title");
      if (!target) return;
      event.preventDefault();
      let still = false;
      try {
        still = Boolean(window.matchMedia &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      } catch (err) { still = false; }
      target.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    });
    banner.appendChild(link);
    banner.appendChild(el("span", "next-up-when", whenWords(days) +
      " · " + dayOf(next.date) + " " + monthOf(next.date)));
    banner.hidden = false;
  }

  /** Draws the list from JSON embedded in the page. */
  function render(root, today) {
    const scope = root || document;
    const holder = scope.querySelector("#events-list");
    const source = scope.querySelector("#club-events");
    if (!holder || !source) return null;

    let events = [];
    try { events = JSON.parse(source.textContent) || []; } catch (err) { events = []; }

    holder.innerHTML = "";
    const sorted = order(events, today);
    sorted.forEach(function (event) { holder.appendChild(drawEvent(event, today)); });
    if (!sorted.length) holder.appendChild(el("p", "club-note", "Nothing on the calendar yet."));

    const next = nextUp(events, today);
    const banner = scope.querySelector("#next-up");
    if (banner) {
      banner.innerHTML = "";
      if (next) {
        const days = daysUntil(next.date, today);
        banner.appendChild(el("span", "next-up-label", "Next up"));
        const link = el("a", "next-up-name", next.name);
        link.href = "#events-title";
        /**
         * Scrolled rather than jumped, for two reasons. The site header is
         * sticky, so a plain anchor jump parks the heading underneath it and
         * the reader lands looking at the wrong thing; and a jump that moves
         * two screens without warning is disorienting, where a scroll shows
         * you where you went. Anyone who has asked for less motion gets the
         * jump instead, which is the honest trade.
         */
        link.addEventListener("click", function (event) {
          const target = document.getElementById("events-title");
          if (!target) return;
          event.preventDefault();
          let still = false;
          try {
            still = Boolean(window.matchMedia &&
              window.matchMedia("(prefers-reduced-motion: reduce)").matches);
          } catch (err) { still = false; }
          target.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
        });
        banner.appendChild(link);
        banner.appendChild(el("span", "next-up-when", whenWords(days) +
          " · " + dayOf(next.date) + " " + monthOf(next.date)));
        banner.hidden = false;
      } else {
        banner.appendChild(el("span", "next-up-label", "Nothing booked"));
        banner.appendChild(el("span", "next-up-when",
          "No competition or meet-up on the calendar just now."));
        banner.hidden = false;
      }
    }
    return { shown: sorted.length, next: next };
  }

  window.ClubEvents = {
    render: render, tidyTime: tidyTime, drawInto: drawInto, fillBanner: fillBanner, daysUntil: daysUntil, whenWords: whenWords,
    order: order, nextUp: nextUp, monthOf: monthOf, dayOf: dayOf,
  };
})();
