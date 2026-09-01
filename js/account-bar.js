/**
 * The strip that tells you who you are and where you may go.
 *
 * Before this, a signed-in person had no idea what they had access to. The
 * club page and the library sat in different corners of the site with no
 * thread between them, and the only way to discover you could manage
 * something was to already know the address.
 *
 * So every members' page carries the same strip: your name, the places you
 * are allowed, one Manage button, and Sign out. What it offers is worked out
 * from what the DATABASE says you may do, not from a list kept here -- so a
 * person who is not in the cube club is not shown a door that would refuse
 * them.
 */
(function () {
  "use strict";

  const auth = window.LWLAuth;
  if (!auth) return;

  /** Where the site root is, from this page's depth. */
  function rootPath() {
    const bits = window.location.pathname.split("/").filter(function (b) {
      return b && b.indexOf(".html") === -1;
    });
    const known = ["cube", "books", "manage", "admin", "signin", "privacy", "support",
                   "puzzles", "games", "tools", "maths", "scores", "code", "science", "ai"];
    let depth = 0;
    for (let i = bits.length - 1; i >= 0; i--) {
      if (known.indexOf(bits[i]) !== -1) { depth = bits.length - i; break; }
    }
    return depth ? "../".repeat(depth) : "";
  }

  /** What this person may actually reach. Asked of the database, not assumed. */
  async function whatTheyCanDo() {
    const db = auth.client;
    const can = { library: false, club: false, runsClub: false, site: false };
    if (!db) return can;
    can.library = true;                       // every signed-in person has one
    can.site = auth.isAdmin();

    const clubs = await db.from("club_memberships")
      .select("club_role, clubs (slug, name)");
    (clubs.data || []).forEach(function (row) {
      if (!row.clubs) return;
      if (row.clubs.slug === "speedcube") {
        can.club = true;
        if (row.club_role === "organiser") can.runsClub = true;
      }
    });
    if (can.site) can.runsClub = true;
    return can;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  async function draw(state) {
    const holder = document.getElementById("account-bar");
    if (!holder) return;
    holder.innerHTML = "";
    if (!state.user) { holder.hidden = true; return; }
    holder.hidden = false;

    const root = rootPath();
    const can = await whatTheyCanDo();

    const who = el("span", "account-who",
      (state.profile && state.profile.display_name) || state.user.email);
    holder.appendChild(who);

    const places = el("nav", "account-places");
    places.setAttribute("aria-label", "Where you can go");

    function link(href, label, here) {
      const a = el("a", "account-link" + (here ? " is-here" : ""), label);
      a.href = root + href;
      if (here) a.setAttribute("aria-current", "page");
      places.appendChild(a);
    }

    const path = window.location.pathname;
    if (can.library) link("books/index.html", "📚 Our Library", /\/books\//.test(path));
    if (can.club) link("cube/club/index.html", "⏱️ Speedcube Club", /\/cube\/club\//.test(path));
    // Only offered when there is something behind it to manage.
    if (can.library || can.runsClub || can.site) {
      link("manage/index.html", "⚙️ Manage", /\/manage\//.test(path));
    }
    holder.appendChild(places);

    const out = el("button", "account-out", "Sign out");
    out.type = "button";
    out.addEventListener("click", async function () {
      await auth.signOut();
      window.location.href = root + "index.html";
    });
    holder.appendChild(out);
  }

  auth.onChange(function (state) {
    if (state.loading) return;
    draw(state);
  });

  window.AccountBar = { rootPath: rootPath, whatTheyCanDo: whatTheyCanDo };
})();
