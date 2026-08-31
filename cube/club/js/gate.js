/**
 * The club page, kept behind a password.
 *
 * This site has no server, so there is nobody to check a password for us. The
 * usual trick -- hide the page with JavaScript and compare a password in the
 * source -- protects nothing at all: the text is sitting in the file, and
 * anyone who picks View Source reads it without ever typing the password.
 *
 * So the content is genuinely encrypted instead. locked.json holds nothing but
 * ciphertext; the words do not exist anywhere in what the server sends until a
 * correct password derives the key that unlocks them. AES-GCM also authenticates,
 * so a wrong password fails loudly rather than producing plausible rubbish.
 *
 * What this still cannot do: stop somebody who KNOWS the password from passing
 * it on, and stop a determined person guessing a short one offline. 250,000
 * rounds of PBKDF2 make each guess cost something, but that is a speed bump,
 * not a wall. Fine for keeping a club page to club members; not the place for
 * anything that would matter if it got out.
 */
(function () {
  "use strict";

  const form = document.getElementById("gate-form");
  const input = document.getElementById("gate-password");
  const message = document.getElementById("gate-message");
  const gate = document.getElementById("gate");
  const hold = document.getElementById("club-content");
  if (!form || !hold) return;

  const REMEMBER = "club-unlocked";

  function bytes(base64) {
    const raw = window.atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  /** Turns the typed password into the key, the slow way, on purpose. */
  async function keyFrom(password, salt, rounds) {
    const material = await window.crypto.subtle.importKey(
      "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
    return window.crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: salt, iterations: rounds, hash: "SHA-256" },
      material, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  }

  /**
   * Fetching the locked file and decrypting it are two different jobs that
   * fail for two different reasons, and the first version treated them as
   * one: any failure at all was reported as "that is not the password". So if
   * the file had not finished deploying, or the connection dropped, the page
   * told you your perfectly correct password was wrong -- which is a horrible
   * thing to be told, because there is nothing you can do about it.
   */
  async function fetchLocked() {
    let response;
    try {
      response = await fetch("locked.json", { cache: "no-store" });
    } catch (err) {
      throw { kind: "network" };
    }
    if (!response.ok) throw { kind: "network", status: response.status };
    try {
      return await response.json();
    } catch (err) {
      throw { kind: "network" };
    }
  }

  async function unlock(password) {
    const locked = await fetchLocked();
    let plain;
    try {
      const key = await keyFrom(password, bytes(locked.salt), locked.rounds);
      plain = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: bytes(locked.iv) }, key, bytes(locked.data));
    } catch (err) {
      throw { kind: "password" };
    }
    return new TextDecoder().decode(plain);
  }

  /**
   * Tabs inside the unlocked content.
   *
   * The content arrives as a string and is written in with innerHTML, so any
   * script inside it would never run -- the wiring has to be done from out
   * here, after the writing.
   */
  function wireTabs() {
    const strip = hold.querySelector(".tab-strip");
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
      tab.classList.toggle("is-on", tab.getAttribute("aria-selected") === "true");
      tab.addEventListener("click", function () { show(tab); });
      // Left and right move between tabs, which is what a screen reader user
      // and a keyboard user both expect of a tab strip.
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

  function reveal(html) {
    hold.innerHTML = html;
    hold.hidden = false;
    if (gate) gate.hidden = true;
    // The locked page has its own title and "enter the password" note. Once
    // you are in, that note is answered and the title would simply appear
    // twice, so it goes with the gate.
    const lockedHeading = document.getElementById("locked-heading");
    if (lockedHeading) lockedHeading.hidden = true;
    const unlockedHeading = document.getElementById("unlocked-heading");
    if (unlockedHeading) unlockedHeading.hidden = false;
    wireTabs();
    // The member list is data inside the content and code out here, so it has
    // to be drawn once the content has actually arrived.
    if (window.ClubMembers) window.ClubMembers.render(hold);
  }

  const button = form.querySelector("button");

  /**
   * Opened straight off the disk, this page cannot work at all, and no
   * password will ever make it.
   *
   * Two separate things block it. fetch() refuses to read a neighbouring file
   * over file://, treating it as a cross-origin request; and crypto.subtle --
   * the whole basis of the decryption -- is only handed to a "secure context",
   * which file:// is not. Both are the browser protecting you, and neither can
   * be argued with from inside the page.
   *
   * Saying so is the only useful thing to do. Reporting a correct password as
   * wrong, which is what happened before this, sends somebody off hunting for
   * a problem that is not there.
   */
  function cannotWorkHere() {
    if (window.location.protocol === "file:") return "file";
    if (!window.isSecureContext) return "insecure";
    if (!window.crypto || !window.crypto.subtle) return "nocrypto";
    return null;
  }

  const blocked = cannotWorkHere();
  if (blocked) {
    message.className = "gate-message is-bad";
    message.innerHTML = blocked === "file"
      ? "This page is open straight from a file on your computer, and browsers " +
        "will not let a file decrypt anything — no password can work here. " +
        'Open <a href="https://learnwithluke.com/cube/club/index.html">the live ' +
        "page</a> instead, or serve the folder over http."
      : "Your browser will not do the decrypting on this address — it only " +
        'offers that over https. Try <a href="https://learnwithluke.com/cube/club/index.html">' +
        "the live page</a>.";
    if (button) button.disabled = true;
    input.disabled = true;
    return;
  }

  async function tryPassword(password, quietly) {
    if (!quietly) {
      // Deriving the key is deliberately slow -- a second or two on a phone --
      // so say so, and stop the button being pressed again meanwhile.
      message.textContent = "Checking… this takes a moment.";
      message.className = "gate-message";
      if (button) button.disabled = true;
    }
    try {
      const html = await unlock(password);
      reveal(html);
      message.textContent = "";
      try { window.sessionStorage.setItem(REMEMBER, password); } catch (err) { /* fine */ }
      return true;
    } catch (err) {
      try { window.sessionStorage.removeItem(REMEMBER); } catch (err2) { /* fine */ }
      if (!quietly) {
        if (err && err.kind === "network") {
          message.textContent = "Could not load the page just now — check your " +
            "connection and try again in a moment. Your password may be perfectly fine.";
        } else {
          message.textContent = "That is not the password. Ask Luke.";
          input.select();
        }
        message.className = "gate-message is-bad";
      }
      return false;
    } finally {
      if (button) button.disabled = false;
    }
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const password = input.value.trim();
    if (!password) return;
    tryPassword(password, false);
  });

  // Already let in this visit? Do not ask again until the tab closes.
  let remembered = null;
  try { remembered = window.sessionStorage.getItem(REMEMBER); } catch (err) { /* fine */ }
  if (remembered) tryPassword(remembered, true);

  window.ClubGate = { unlock: unlock, tryPassword: tryPassword };
})();
