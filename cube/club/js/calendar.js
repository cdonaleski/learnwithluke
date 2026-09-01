/**
 * "Add to calendar" links.
 *
 * Google takes an event as a URL with the times run together in UTC-ish form:
 * 20260905T140000/20260905T170000. The fiddly parts are that the end must come
 * after the start, that an all-day entry uses plain dates and an END OF THE
 * NEXT DAY -- Google treats the end as exclusive, so a one-day event written
 * with the same date at both ends shows as no days at all -- and that every
 * piece of text has to be escaped or an address with an ampersand in it
 * silently truncates the rest of the link.
 *
 * All of which is why this is a plain function with tests rather than a
 * template string built at the point of use.
 */
(function () {
  "use strict";

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  /** "2026-09-05" and "14:30" become "20260905T143000". */
  function stamp(date, time) {
    const day = String(date || "").replace(/-/g, "");
    if (!day) return null;
    if (!time) return day;
    const bits = String(time).split(":");
    const hh = pad(Number(bits[0] || 0));
    const mm = pad(Number(bits[1] || 0));
    const ss = pad(Number(bits[2] || 0));
    return day + "T" + hh + mm + ss;
  }

  /** The day after, so an all-day entry covers the day it is actually on. */
  function dayAfter(date) {
    const d = new Date(String(date) + "T00:00:00");
    d.setDate(d.getDate() + 1);
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
  }

  /**
   * The dates parameter. With times, start/end as given -- and if no end was
   * given, an hour after the start rather than a zero-length event. Without
   * times, the day and the day after, because Google's end is exclusive.
   */
  function span(event) {
    if (!event || !event.date) return null;
    if (!event.startsAt) return stamp(event.date) + "/" + dayAfter(event.date);
    const from = stamp(event.date, event.startsAt);
    let to = event.endsAt ? stamp(event.date, event.endsAt) : null;
    if (!to || to <= from) {
      const bits = String(event.startsAt).split(":");
      const later = pad((Number(bits[0] || 0) + 1) % 24) + pad(Number(bits[1] || 0)) + "00";
      to = stamp(event.date) + "T" + later;
    }
    return from + "/" + to;
  }

  /** Where it is: the full address if we have one, the town if not. */
  function place(event) {
    return [event.venue, event.address || event.city].filter(Boolean).join(", ");
  }

  function googleUrl(event) {
    const dates = span(event);
    if (!dates) return null;
    const bits = {
      action: "TEMPLATE",
      text: event.name || "Cube competition",
      dates: dates,
      location: place(event),
      details: [event.note, event.url].filter(Boolean).join("\n\n"),
    };
    const query = Object.keys(bits)
      .filter(function (key) { return bits[key]; })
      // Every value is escaped. An address with an "&" in it would otherwise
      // cut the link off at that point and lose everything after.
      .map(function (key) { return key + "=" + encodeURIComponent(bits[key]); })
      .join("&");
    return "https://calendar.google.com/calendar/render?" + query;
  }

  window.ClubCalendar = { googleUrl: googleUrl, span: span, stamp: stamp, place: place, dayAfter: dayAfter };
})();
