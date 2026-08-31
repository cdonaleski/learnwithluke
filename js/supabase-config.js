/**
 * Where the accounts live.
 *
 * The key below is the PUBLISHABLE (anon) key. It is meant to be in the page —
 * every visitor's browser needs it to talk to Supabase at all — and it grants
 * nothing on its own. What protects the club's data is row-level security in
 * the database, which refuses to hand rows to a request without a session it
 * recognises. See supabase/migrations/0001_club_schema.sql.
 *
 * The SERVICE ROLE key is a different thing entirely: it bypasses every policy
 * in the database. It must never appear in this file, in this repository, or
 * anywhere a browser can reach. If one is ever pasted here by mistake, treat it
 * as compromised and rotate it in the Supabase dashboard immediately.
 */
window.LWL_SUPABASE = {
  url: "https://fqedetfaoslykoihxgow.supabase.co",
  anonKey: "REPLACE_WITH_PUBLISHABLE_ANON_KEY",
};
