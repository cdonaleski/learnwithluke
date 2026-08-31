/**
 * Signing in, and knowing who is signed in.
 *
 * One rule runs through this file: nothing here decides what anybody is
 * ALLOWED to do. It decides what to show them. Every real refusal happens in
 * the database, where row-level security declines to return rows to a session
 * that should not have them. A determined visitor can edit this script in
 * their own browser and set isAdmin to true all day; the database will still
 * hand them nothing, because it never asked this code's opinion.
 *
 * That distinction is worth keeping in mind when reading anything below: these
 * are signposts, not locks.
 */
(function () {
  "use strict";

  const config = window.LWL_SUPABASE || {};
  const ready = Boolean(window.supabase && config.url &&
    config.anonKey && config.anonKey.indexOf("REPLACE_WITH") === -1);

  const client = ready
    ? window.supabase.createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          // The session lives in this browser only. Nothing is written to a
          // cookie that would travel with a request to anywhere else.
          storageKey: "lwl-auth",
        },
      })
    : null;

  const listeners = [];
  let current = { user: null, profile: null, loading: true };

  function announce() {
    listeners.forEach(function (fn) {
      try { fn(current); } catch (err) { /* a bad listener must not stop the rest */ }
    });
  }

  /** Who is signed in, and what the DATABASE says their role is. */
  async function refresh() {
    if (!client) {
      current = { user: null, profile: null, loading: false, unconfigured: true };
      announce();
      return current;
    }
    const session = await client.auth.getSession();
    const user = session.data.session ? session.data.session.user : null;
    let profile = null;
    if (user) {
      // The role is read back from the database rather than taken from the
      // token, so it is the same answer the policies will give.
      const answer = await client.from("profiles")
        .select("id, display_name, role").eq("id", user.id).maybeSingle();
      profile = answer.data || null;
    }
    current = { user: user, profile: profile, loading: false };
    announce();
    return current;
  }

  async function signIn(email, password) {
    if (!client) return { error: "Accounts are not set up yet." };
    const answer = await client.auth.signInWithPassword({
      email: String(email || "").trim(),
      password: String(password || ""),
    });
    if (answer.error) {
      // Supabase says "Invalid login credentials" for both a wrong password
      // and an address with no account, on purpose: saying which would let
      // somebody test whether a particular child has an account here.
      return { error: answer.error.message };
    }
    await refresh();
    return { user: answer.data.user };
  }

  async function signOut() {
    if (!client) return;
    await client.auth.signOut();
    await refresh();
  }

  function onChange(fn) {
    listeners.push(fn);
    if (!current.loading) fn(current);
    return function () {
      const at = listeners.indexOf(fn);
      if (at !== -1) listeners.splice(at, 1);
    };
  }

  if (client) {
    client.auth.onAuthStateChange(function () { refresh(); });
    refresh();
  } else {
    current = { user: null, profile: null, loading: false, unconfigured: true };
  }

  window.LWLAuth = {
    client: client,
    ready: ready,
    signIn: signIn,
    signOut: signOut,
    refresh: refresh,
    onChange: onChange,
    /** A signpost for the interface. Not a permission — see the note above. */
    isSignedIn: function () { return Boolean(current.user); },
    isAdmin: function () { return Boolean(current.profile && current.profile.role === "admin"); },
    who: function () { return current; },
  };
})();
