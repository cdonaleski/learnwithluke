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
    { id: "puzzles", label: "Puzzles" },
    { id: "games", label: "Games" },
    { id: "tools", label: "Tools" },
    { id: "scores", label: "Scores" },
    { id: "code", label: "Code" },
  ];
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
    if (SECTIONS.some((section) => section.id === segments[i])) {
      sectionIndex = i;
      break;
    }
  }

  const isHome = sectionIndex === -1;
  const activeSection = isHome ? null : segments[sectionIndex];

  /** Path back to the site root (e.g. games/pong → "../../"). */
  const root = isHome ? "" : "../".repeat(segments.length - sectionIndex);

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
          ${SECTIONS.map((section) => {
            const active = section.id === activeSection ? ' class="active" aria-current="page"' : "";
            return `<li><a href="${root}${section.id}/index.html"${active}>${section.label}</a></li>`;
          }).join("\n          ")}
        </ul>
      </div>
    </header>
  `;

  const footerHTML = `
    <footer class="site-footer">
      <p>Made with ❤️ for curious kids · <strong>Learn With Luke</strong></p>
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

    links.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        links.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open menu");
      });
    });
  }
})();
