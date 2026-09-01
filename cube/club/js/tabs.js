/**
 * Tab strips.
 *
 * Pulled out of the old password gate when the club page stopped being a blob
 * of decrypted markup. Same behaviour, one copy: click or arrow-key between
 * tabs, one panel showing at a time.
 */
(function () {
  "use strict";

  function wire(root) {
    if (!root) return;
    const strip = root.querySelector(".tab-strip");
    if (!strip) return;
    const tabs = Array.prototype.slice.call(strip.querySelectorAll(".tab"));

    function show(tab) {
      tabs.forEach(function (other) {
        const panel = document.getElementById(other.getAttribute("aria-controls"));
        const chosen = other === tab;
        other.setAttribute("aria-selected", String(chosen));
        other.tabIndex = chosen ? 0 : -1;
        other.classList.toggle("is-on", chosen);
        if (panel) panel.hidden = !chosen;
      });
    }

    tabs.forEach(function (tab, index) {
      if (tab.dataset.wired === "yes") return;
      tab.dataset.wired = "yes";
      tab.addEventListener("click", function () { show(tab); });
      tab.addEventListener("keydown", function (event) {
        let next = null;
        if (event.key === "ArrowRight") next = tabs[(index + 1) % tabs.length];
        if (event.key === "ArrowLeft") next = tabs[(index - 1 + tabs.length) % tabs.length];
        if (event.key === "Home") next = tabs[0];
        if (event.key === "End") next = tabs[tabs.length - 1];
        if (!next) return;
        event.preventDefault();
        show(next);
        next.focus();
      });
    });
  }

  window.ClubTabs = { wire: wire };
})();
