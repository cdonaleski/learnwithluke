/**
 * Shared navigation for Learn With Luke
 * Injects header + footer and highlights the active page.
 */
(function () {
  const path = window.location.pathname;
  const isPuzzles = path.includes("/puzzles");
  const isGames = path.includes("/games");
  const isCode = path.includes("/code");
  const isHome = !isPuzzles && !isGames && !isCode;

  /** Depth from site root (e.g. puzzles/rubiks-cube → "../../"). */
  function getRoot() {
    const segments = path.split("/").filter((segment) => segment && !segment.endsWith(".html"));
    if (segments.length === 0) return "";
    return "../".repeat(segments.length);
  }

  const root = isHome ? "" : getRoot();

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
          <li><a href="${root}puzzles/index.html"${isPuzzles ? ' class="active" aria-current="page"' : ""}>Puzzles</a></li>
          <li><a href="${root}games/index.html"${isGames ? ' class="active" aria-current="page"' : ""}>Games</a></li>
          <li><a href="${root}code/index.html"${isCode ? ' class="active" aria-current="page"' : ""}>Code</a></li>
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
