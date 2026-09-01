/**
 * Shared navigation for Learn With Luke
 * Injects header + footer and highlights the active page.
 */
(function () {
  /**
   * The site's sections, in menu order. Adding one here is the only edit the
   * navigation needs — the folder name must match the `id`.
   */
  const SECTIONS = [
    { id: "cube", label: "The Cube" },
    { id: "puzzles", label: "Puzzles" },
    { id: "games", label: "Games" },
    { id: "tools", label: "Tools" },
    { id: "maths", label: "Maths" },
    { id: "scores", label: "Scores" },
    { id: "code", label: "Code" },
    { id: "science", label: "Science" },
    { id: "ai", label: "AI" },
  ];

  /**
   * The menu, grouped.
   *
   * Nine things in a row is not a menu, it is a list -- on a small laptop it
   * wrapped onto a second line and pushed the page down, and nothing in it
   * told you which things belonged together. Grouping says something true:
   * Maths, Science, Code and AI are the same kind of thing, and Puzzles and
   * Games are another. Every section still appears exactly once.
   *
   * A group with `sections` becomes a drop-down; anything else is a plain
   * link, and the group lights up when you are anywhere inside it.
   */
  const MENU = [
    { id: "cube", label: "The Cube" },
    { label: "Play", sections: ["puzzles", "games"] },
    { label: "STEM", sections: ["maths", "science", "code", "ai"] },
    { id: "tools", label: "Tools" },
    { id: "scores", label: "Scores" },
  ];

  const labelOf = function (id) {
    for (let i = 0; i < SECTIONS.length; i++) {
      if (SECTIONS[i].id === id) return SECTIONS[i].label;
    }
    return id;
  };

  /**
   * Every folder that sits directly under the site root — the menu sections
   * plus any page that is not in the menu, such as Support.
   *
   * This is what the "how far back up is the root" sum counts from, and it is
   * SEPARATE from SECTIONS on purpose. Leaving a folder out of here does not
   * merely hide it from the menu: the page is mistaken for the home page, no
   * `../` is added, and every link on it breaks. Add new top-level folders
   * here whether or not they belong in the menu.
   */
  const TOP_LEVEL = SECTIONS.map(function (section) { return section.id; })
    .concat(["support", "privacy", "signin", "admin", "books"]);
  const path = window.location.pathname;
  const segments = path.split("/").filter((segment) => segment && !segment.endsWith(".html"));

  /**
   * Which section folder this page lives in, searched from the end so a
   * parent folder that happens to share a section name can't win.
   * Counting from the section (instead of counting every URL segment) keeps
   * the menu correct when the site is served from a subfolder or opened
   * straight off disk with file://.
   */
  let sectionIndex = -1;
  for (let i = segments.length - 1; i >= 0; i--) {
    if (TOP_LEVEL.indexOf(segments[i]) !== -1) {
      sectionIndex = i;
      break;
    }
  }

  const atRoot = sectionIndex === -1;
  const activeSection = atRoot ? null : segments[sectionIndex];
  // Only the real home page highlights "Home"; Support highlights nothing.
  const isHome = atRoot;

  /** Path back to the site root (e.g. games/pong → "../../"). */
  const root = atRoot ? "" : "../".repeat(segments.length - sectionIndex);

  const navHTML = `
    <header class="site-header">
      <div class="nav-inner">
        <a href="${root}index.html" class="logo" aria-label="Learn With Luke home">
          <span class="logo-icon" aria-hidden="true">📚</span>
          Learn With Luke
        </a>
        <button class="nav-toggle" aria-label="Open menu" aria-expanded="false">☰</button>
        <ul class="nav-links" role="navigation" aria-label="Main navigation">
          <li><a href="${root}index.html"${isHome ? ' class="active" aria-current="page"' : ""}>Home</a></li>
          ${MENU.map((item, index) => {
            if (!item.sections) {
              const active = item.id === activeSection ? ' class="active" aria-current="page"' : "";
              return `<li><a href="${root}${item.id}/index.html"${active}>${item.label}</a></li>`;
            }
            const holdsActive = item.sections.indexOf(activeSection) !== -1;
            const menuId = `nav-group-${index}`;
            const children = item.sections.map((id) => {
              const active = id === activeSection ? ' class="active" aria-current="page"' : "";
              return `<li><a href="${root}${id}/index.html"${active}>${labelOf(id)}</a></li>`;
            }).join("");
            return `<li class="nav-group">
              <button type="button" class="nav-group-btn${holdsActive ? " active" : ""}"
                      aria-expanded="false" aria-controls="${menuId}">${item.label}<span class="nav-caret" aria-hidden="true">▾</span></button>
              <ul class="nav-submenu" id="${menuId}">${children}</ul>
            </li>`;
          }).join("\n          ")}
        </ul>
      </div>
    </header>
  `;

  const footerHTML = `
    <footer class="site-footer">
      <p>Made with ❤️ for curious kids · <strong>Learn With Luke</strong></p>
      <p class="footer-small">Free, no adverts, nothing tracked · <a class="footer-support" href="${root}support/index.html">Support this site</a> · <a href="${root}privacy/index.html">Privacy</a></p>
      <p class="footer-quiet"><a href="${root}signin/index.html">Club member sign in</a> · <a href="${root}books/index.html">My books</a></p>
    </footer>
  `;

  const headerPlaceholder = document.getElementById("site-header");
  const footerPlaceholder = document.getElementById("site-footer");

  if (headerPlaceholder) {
    headerPlaceholder.outerHTML = navHTML;
  }

  if (footerPlaceholder) {
    footerPlaceholder.outerHTML = footerHTML;
  }

  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");

  if (toggle && links) {
    toggle.addEventListener("click", () => {
      const isOpen = links.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
      toggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
    });

    /**
     * Drop-downs open on click, not on hover: hover menus are miserable on a
     * touchscreen, and this site is used on both. Opening one closes any other.
     */
    links.querySelectorAll(".nav-group-btn").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const group = button.parentElement;
        const wasOpen = group.classList.contains("is-open");
        links.querySelectorAll(".nav-group").forEach((other) => {
          other.classList.remove("is-open");
          const b = other.querySelector(".nav-group-btn");
          if (b) b.setAttribute("aria-expanded", "false");
        });
        if (!wasOpen) {
          group.classList.add("is-open");
          button.setAttribute("aria-expanded", "true");
        }
      });
    });

    // A click anywhere else, or Escape, puts the menus away again.
    document.addEventListener("click", () => {
      links.querySelectorAll(".nav-group").forEach((group) => {
        group.classList.remove("is-open");
        const b = group.querySelector(".nav-group-btn");
        if (b) b.setAttribute("aria-expanded", "false");
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      links.querySelectorAll(".nav-group").forEach((group) => {
        group.classList.remove("is-open");
        const b = group.querySelector(".nav-group-btn");
        if (b) b.setAttribute("aria-expanded", "false");
      });
    });

    links.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        links.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open menu");
      });
    });
  }
})();
