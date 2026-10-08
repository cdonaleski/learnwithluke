/**
 * The Year at a Glance.
 *
 * Twenty-four weeks down, the strands across — the same grid as the page at
 * the front of the Foundations Guide, because that is the picture the family
 * already has in their heads. It does the job the old week picker did (pick
 * what to work on) and the job no screen was doing at all: showing where you
 * actually are. "0 of 657 learned" is a number. A wall of cells going green,
 * week by week, is a position.
 *
 * Every cell is a way in: a cell is one strand in one week, a row number is
 * the whole week across every strand, a column heading is one strand across
 * the whole year.
 */
(function () {
  "use strict";

  const CC = window.CC;
  const root = document.getElementById("cc-glance");
  if (!CC || !root) return;

  const WEEKS = 24;
  const REACHED_STORE = "cc-week-reached";

  function reached() {
    let saved = 0;
    try { saved = Number(window.localStorage.getItem(REACHED_STORE)); } catch (err) { saved = 0; }
    return (!saved || saved < 1 || saved > WEEKS) ? WEEKS : saved;
  }

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function practiceHref(params) {
    const query = Object.keys(params)
      .filter(function (key) { return params[key] !== undefined && params[key] !== ""; })
      .map(function (key) { return key + "=" + encodeURIComponent(params[key]); });
    return "practice/index.html?" + query.join("&");
  }

  /**
   * Not started / on the way / learned, as a quarter-step ramp. It moves
   * with every right answer in Recite, not only when a card reaches three,
   * so the first session already shows.
   */
  function fillOf(sum) {
    if (!sum.total) return null;
    if (sum.steps === 0) return 0;
    if (sum.learned === sum.total) return 4;
    const part = sum.steps / sum.of;
    return part < 0.34 ? 1 : part < 0.67 ? 2 : 3;
  }

  function draw(cycleNumber) {
    const cycle = CC.cycleOf(cycleNumber);
    root.innerHTML = "";
    if (!cycle) return;

    const strands = CC.strandsWithCards(cycleNumber);
    const upTo = reached();
    const plan = CC.reviewDay(new Date(), upTo);
    const todayWeeks = plan.kind === "weeks" ? plan.weeks : [];

    const table = make("table", "cc-glance");
    table.setAttribute("aria-label", "Progress through " + cycle.label + ", week by week");

    const head = make("thead");
    const headRow = make("tr");
    headRow.appendChild(make("th", "cc-glance-corner", "Week"));
    strands.forEach(function (strand) {
      const cell = make("th", "cc-glance-strand");
      cell.scope = "col";
      const link = make("a", null);
      link.href = practiceHref({ cycle: cycleNumber, strand: strand.id });
      link.appendChild(make("span", "cc-glance-icon", strand.icon));
      link.appendChild(make("span", "cc-glance-name", strand.label));
      link.title = "Practice all of " + strand.label;
      cell.appendChild(link);
      headRow.appendChild(cell);
    });
    head.appendChild(headRow);
    table.appendChild(head);

    const body = make("tbody");
    for (let week = 1; week <= WEEKS; week++) {
      const row = make("tr", "cc-glance-row" +
        (todayWeeks.indexOf(week) !== -1 ? " is-today" : "") +
        (week > upTo ? " is-ahead" : ""));

      const weekCell = make("th", "cc-glance-week");
      weekCell.scope = "row";
      const weekLink = make("a", null, String(week));
      weekLink.href = practiceHref({ cycle: cycleNumber, weeks: week });
      weekLink.title = "Practice everything in week " + week;
      weekCell.appendChild(weekLink);
      if (todayWeeks.indexOf(week) !== -1) {
        weekCell.appendChild(make("span", "cc-glance-star", "★"));
      }
      row.appendChild(weekCell);

      strands.forEach(function (strand) {
        const cards = CC.pick(cycleNumber, strand.id, [week]);
        const sum = CC.tally(cards);
        const fill = fillOf(sum);
        const cell = make("td", "cc-glance-cell");

        if (fill === null) {
          cell.classList.add("is-empty");
          cell.setAttribute("aria-label", strand.label + ", week " + week + ": nothing");
          row.appendChild(cell);
          return;
        }

        // The link is a finger-sized target; the dot inside it is drawn small
        // so twenty-four rows still read as one picture.
        const link = make("a", "cc-glance-hit");
        link.appendChild(make("span", "cc-glance-dot is-fill-" + fill));
        // Geography is practiced on the map, where the proof is: states and
        // capitals for weeks 1-10, the physical features after that.
        link.href = strand.id !== "geography"
          ? practiceHref({ cycle: cycleNumber, strand: strand.id, weeks: week })
          : week <= 10 ? "map/index.html?weeks=" + week : "map/features.html?weeks=" + week;
        link.title = strand.label + ", week " + week + " — " + CC.progressLine(sum);
        // The title is a tooltip and a tooltip is not an answer for anyone on
        // a phone or a screen reader, so the state is in the label as well.
        link.setAttribute("aria-label", link.title);
        cell.appendChild(link);
        row.appendChild(cell);
      });
      body.appendChild(row);
    }
    table.appendChild(body);
    root.appendChild(table);

    const all = CC.tally(CC.pick(cycleNumber, "all", []));
    const footer = make("p", "cc-glance-total");
    footer.appendChild(make("strong", null, all.learned + " of " + all.total));
    footer.appendChild(document.createTextNode(
      " learned" + (all.started ? " · " + all.started + " on the way" : "") +
      (all.left ? " · " + all.left + " to go" : " — the whole cycle")));
    root.appendChild(footer);

    const key = make("p", "cc-glance-key");
    key.appendChild(document.createTextNode("★ today’s review · "));
    [0, 1, 2, 3, 4].forEach(function (step) {
      key.appendChild(make("span", "cc-glance-dot is-fill-" + step + " is-key"));
    });
    key.appendChild(document.createTextNode(" none → all"));
    root.appendChild(key);
  }

  draw(3);
  window.CCGlance = { draw: draw };
})();
