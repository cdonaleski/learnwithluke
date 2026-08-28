/**
 * Support page — shows what we make and how people can help.
 *
 * The music player is CLICK-TO-LOAD. Nothing is requested from Spotify until
 * someone presses play, so simply opening this page sends nothing anywhere and
 * sets no cookies. That keeps the promise the rest of the site makes.
 */
(function () {
  "use strict";

  const thingsEl = document.getElementById("sp-things");
  if (!thingsEl) return;

  const THINGS = Array.isArray(window.SupportThings) ? window.SupportThings : [];
  const WAYS = Array.isArray(window.SupportWays) ? window.SupportWays : [];

  const el = {
    things: thingsEl,
    ways: document.getElementById("sp-ways"),
    status: document.getElementById("sp-status"),
  };

  let toastTimer = null;

  function say(text) {
    el.status.textContent = text;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { el.status.textContent = ""; }, 4000);
  }

  /** Only ever allow embeds we recognise, so a typo cannot inject a frame. */
  function isAllowedEmbed(url) {
    return typeof url === "string" && /^https:\/\/open\.spotify\.com\/embed\//.test(url);
  }

  function playerCard(thing) {
    const holder = document.createElement("div");
    holder.className = "sp-player";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "sp-play";

    const icon = document.createElement("span");
    icon.className = "sp-play-icon";
    icon.textContent = "▶";
    const label = document.createElement("span");
    label.className = "sp-play-label";
    label.textContent = "Play our music";
    const note = document.createElement("span");
    note.className = "sp-play-note";
    note.textContent = "Loads the Spotify player. Nothing is sent to Spotify until you press this.";

    button.appendChild(icon);
    button.appendChild(label);
    button.appendChild(note);

    button.addEventListener("click", () => {
      const frame = document.createElement("iframe");
      frame.className = "sp-frame";
      frame.src = thing.embed;
      frame.width = "100%";
      frame.height = "352";
      frame.setAttribute("loading", "lazy");
      frame.setAttribute("frameborder", "0");
      frame.setAttribute("title", thing.title + " on Spotify");
      frame.setAttribute("allow", "encrypted-media; clipboard-write; fullscreen; picture-in-picture");
      holder.innerHTML = "";
      holder.appendChild(frame);
      say("Player loaded.");
    });

    holder.appendChild(button);
    return holder;
  }

  function card(item, isWay) {
    const box = document.createElement("article");
    box.className = "sp-card";

    const head = document.createElement("div");
    head.className = "sp-card-head";
    const icon = document.createElement("span");
    icon.className = "sp-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = item.icon || "•";
    const title = document.createElement("h3");
    title.textContent = item.title;
    head.appendChild(icon);
    head.appendChild(title);
    box.appendChild(head);

    const blurb = document.createElement("p");
    blurb.textContent = item.blurb;
    box.appendChild(blurb);

    if (item.kind === "music" && isAllowedEmbed(item.embed)) {
      box.appendChild(playerCard(item));
    }

    if (item.href === "share") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-secondary";
      button.textContent = item.cta || "Copy the link";
      button.addEventListener("click", () => {
        const url = window.location.origin + "/";
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(
            () => say("Link copied — thank you!"),
            () => say(url)
          );
        } else {
          say(url);
        }
      });
      box.appendChild(button);
    } else if (item.href) {
      const link = document.createElement("a");
      link.className = "btn " + (isWay ? "btn-primary" : "btn-secondary");
      link.href = item.href;
      link.target = "_blank";
      // noopener/noreferrer: the new tab gets no handle on this page, and no
      // referrer is leaked.
      link.rel = "noopener noreferrer";
      link.textContent = item.cta || "Open";
      box.appendChild(link);
    }

    return box;
  }

  function render(list, container, isWay) {
    container.innerHTML = "";
    const usable = list.filter((item) => item && item.title && (item.href || item.embed));
    if (!usable.length) {
      const empty = document.createElement("p");
      empty.className = "sp-empty";
      empty.textContent = "Nothing here yet.";
      container.appendChild(empty);
      return;
    }
    usable.forEach((item) => container.appendChild(card(item, isWay)));
  }

  render(THINGS, el.things, false);
  render(WAYS, el.ways, true);

  window.SupportPage = { THINGS, WAYS, isAllowedEmbed, render };
})();
