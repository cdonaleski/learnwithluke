/**
 * Support — what we make, and how people can help.
 *
 * TWO LISTS TO EDIT
 * -----------------
 * THINGS  what you make and sell. Each one:
 *   id       unique lowercase key
 *   kind     "music" (shows a player) or "link" (shows a button)
 *   title    what it is called
 *   blurb    a sentence or two, written for a grown-up
 *   icon     one emoji
 *   embed    for kind "music": a Spotify embed URL. Leave out for no player.
 *   href     where the button goes
 *   cta      what the button says
 *
 * SUPPORT  the ways people can chip in. Each one:
 *   id, icon, title, blurb, href, cta
 *
 * Leave `href` empty and the entry is hidden rather than rendered as a dead
 * button, so half-finished entries never reach the page.
 *
 * ABOUT THE MUSIC PLAYER
 * Spotify's embed is loaded ONLY when someone presses play. Dropping the
 * iframe straight into the page would let Spotify set cookies and track every
 * visitor the moment it opened, children included — which is exactly what this
 * site otherwise avoids. The placeholder card is ours; nothing reaches Spotify
 * until a deliberate tap.
 */
(function () {
  "use strict";

  window.SupportThings = [
    {
      id: "music",
      kind: "music",
      icon: "🎵",
      title: "Our music",
      blurb: "We write and record our own music. Having a listen costs nothing, " +
             "and streams and follows genuinely help keep this site free.",
      // Base embed URL only — the tracking parameters from Spotify's copied
      // snippet are stripped on purpose.
      embed: "https://open.spotify.com/embed/artist/2RBeJLK3YJFZtO3l4lCA0T",
      href: "https://open.spotify.com/artist/2RBeJLK3YJFZtO3l4lCA0T",
      cta: "Open in Spotify"
    }
  ];

  window.SupportWays = [
    {
      id: "donate",
      icon: "☕",
      title: "Buy us a coffee",
      blurb: "A one-off tip towards the running costs. There is no subscription " +
             "and nothing is locked behind it — the whole site stays free either way.",
      href: "",            // ← put your Ko-fi / Buy Me a Coffee / PayPal link here
      cta: "Chip in"
    },
    {
      id: "share",
      icon: "💬",
      title: "Tell someone",
      blurb: "Genuinely the most useful thing. If your child liked something here, " +
             "pass it to another parent or a teacher.",
      href: "share",       // handled in the page: copies the link
      cta: "Copy the link"
    }
  ];
})();
