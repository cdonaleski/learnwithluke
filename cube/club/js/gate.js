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

  async function unlock(password) {
    const locked = await (await fetch("locked.json", { cache: "no-store" })).json();
    const key = await keyFrom(password, bytes(locked.salt), locked.rounds);
    const plain = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes(locked.iv) }, key, bytes(locked.data));
    return new TextDecoder().decode(plain);
  }

  function reveal(html) {
    hold.innerHTML = html;
    hold.hidden = false;
    if (gate) gate.hidden = true;
  }

  async function tryPassword(password, quietly) {
    if (!quietly) {
      message.textContent = "Checking…";
      message.className = "gate-message";
    }
    try {
      const html = await unlock(password);
      reveal(html);
      try { window.sessionStorage.setItem(REMEMBER, password); } catch (err) { /* fine */ }
      return true;
    } catch (err) {
      // A wrong password and a corrupted file look the same from here, and
      // saying "wrong password" is the useful guess either way.
      if (!quietly) {
        message.textContent = "That is not the password. Ask Luke.";
        message.className = "gate-message is-bad";
        input.select();
      }
      try { window.sessionStorage.removeItem(REMEMBER); } catch (err2) { /* fine */ }
      return false;
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
