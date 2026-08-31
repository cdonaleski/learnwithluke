/**
 * The sign-in page.
 *
 * Deliberately dull. There is no sign-up link, no password reset, and no way
 * to discover whether a particular email address has an account here -- a
 * wrong password and an address that does not exist give exactly the same
 * answer, because saying which would let somebody test whether a particular
 * child is a member.
 */
(function () {
  "use strict";

  const form = document.getElementById("signin-form");
  const message = document.getElementById("signin-message");
  const done = document.getElementById("signin-done");
  const who = document.getElementById("signin-who");
  const adminLink = document.getElementById("link-admin");
  const button = document.getElementById("btn-signin");
  const signOutButton = document.getElementById("btn-signout");
  if (!form || !window.LWLAuth) return;

  function say(text, bad) {
    message.textContent = text;
    message.className = "signin-message" + (bad ? " is-bad" : "");
  }

  function showSignedIn(state) {
    const name = (state.profile && state.profile.display_name) ||
      (state.user && state.user.email) || "you";
    who.textContent = "Signed in as " + name + ".";
    form.hidden = true;
    done.hidden = false;
    // The admin link is a signpost only. Somebody who unhides it by hand still
    // gets nothing: the database refuses to return rows to a session whose
    // profile does not say admin.
    if (adminLink) adminLink.hidden = !window.LWLAuth.isAdmin();
    say("");
  }

  function showSignedOut() {
    form.hidden = false;
    done.hidden = true;
  }

  window.LWLAuth.onChange(function (state) {
    if (state.unconfigured) {
      say("Accounts are not switched on yet.", true);
      if (button) button.disabled = true;
      return;
    }
    if (state.loading) return;
    if (state.user) showSignedIn(state); else showSignedOut();
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (button) button.disabled = true;
    say("Checking…");
    const answer = await window.LWLAuth.signIn(
      document.getElementById("email").value,
      document.getElementById("password").value
    );
    if (button) button.disabled = false;
    if (answer.error) {
      say("That email and password do not match an account.", true);
      return;
    }
    say("");
  });

  if (signOutButton) {
    signOutButton.addEventListener("click", async function () {
      await window.LWLAuth.signOut();
      showSignedOut();
      say("Signed out.");
    });
  }
})();
