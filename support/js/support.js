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
    if (typeof url !== "string") return false;
    return /^https:\/\/open\.spotify\.com\/embed\//.test(url) ||
           /^https:\/\/www\.youtube-nocookie\.com\/embed\//.test(url);
  }

  /** YouTube ids are a fixed alphabet — anything else is not a video. */
  function isVideoId(id) {
    return typeof id === "string" && /^[A-Za-z0-9_-]{11}$/.test(id);
  }

  /**
   * youtube-nocookie.com, not youtube.com. The ordinary embed sets tracking
   * cookies as soon as it loads; this one does not until playback, and we do
   * not load it at all until someone presses a title.
   */
  function videoEmbed(id) {
    return "https://www.youtube-nocookie.com/embed/" + id + "?rel=0";
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

  function videoList(thing) {
    const wrap = document.createElement("div");
    wrap.className = "sp-videos";

    (thing.videos || []).filter((v) => isVideoId(v.id)).forEach((video) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sp-video";

      const icon = document.createElement("span");
      icon.className = "sp-video-icon";
      icon.textContent = "▶";
      const title = document.createElement("span");
      title.className = "sp-video-title";
      title.textContent = video.title;

      button.appendChild(icon);
      button.appendChild(title);
      button.setAttribute("aria-label", "Play " + video.title + ". Loads the YouTube player.");

      button.addEventListener("click", () => {
        const url = videoEmbed(video.id);
        if (!isAllowedEmbed(url)) return;
        const frame = document.createElement("iframe");
        frame.className = "sp-frame sp-frame--video";
        frame.src = url;
        frame.setAttribute("loading", "lazy");
        frame.setAttribute("frameborder", "0");
        frame.setAttribute("title", video.title);
        frame.setAttribute("allow", "encrypted-media; fullscreen; picture-in-picture");
        frame.setAttribute("allowfullscreen", "");
        button.replaceWith(frame);
        say("Playing " + video.title + ".");
      });

      wrap.appendChild(button);
    });

    const note = document.createElement("p");
    note.className = "sp-play-note";
    note.textContent = "Nothing is sent to YouTube until you press one of these.";
    wrap.appendChild(note);
    return wrap;
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

    if (item.kind === "videos") {
      box.appendChild(videoList(item));
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
    const usable = list.filter((item) => item && item.title &&
      (item.href || item.embed || (item.videos && item.videos.length)));
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

  window.SupportPage = { THINGS, WAYS, isAllowedEmbed, isVideoId, videoEmbed, render };
})();
