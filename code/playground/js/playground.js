/**
 * Code Playground — write HTML, CSS and JavaScript, see it run.
 *
 * The preview is a sandboxed iframe with allow-scripts and nothing else. No
 * allow-same-origin, deliberately: the child's code runs in its own opaque
 * origin, so it cannot reach this page's DOM, its localStorage, or the rest of
 * the site. The trade-off is that localStorage does not work inside the
 * preview either, which is noted in the help text.
 *
 * Errors and console.log are relayed out of the iframe by a small runtime
 * injected ahead of the child's script, and reported with the line number
 * translated back to a line of THEIR script.js rather than of the assembled
 * document.
 */
(function () {
  "use strict";

  const editor = document.getElementById("pg-code");
  if (!editor) return;

  const PROJECTS = Array.isArray(window.PlaygroundProjects) ? window.PlaygroundProjects : [];
  const STORE_KEY = "lwl-playground";
  const TICK_KEY = "lwl-playground-ticks";
  const RUN_DELAY = 700;
  const MAX_SHARE = 12000;    // browsers get unhappy with very long URLs

  const state = {
    files: { html: "", css: "", js: "" },
    current: "html",
    projectIndex: 0,
    jsStartLine: 1,
    ticks: {},
  };

  let runTimer = null;
  let toastTimer = null;

  const el = {
    code: editor,
    gutter: document.getElementById("pg-gutter"),
    lines: document.getElementById("pg-lines"),
    preview: document.getElementById("pg-preview"),
    rail: document.getElementById("pg-rail"),
    title: document.getElementById("pg-title"),
    kicker: document.getElementById("pg-kicker"),
    blurb: document.getElementById("pg-blurb"),
    tries: document.getElementById("pg-tries"),
    run: document.getElementById("btn-run"),
    stop: document.getElementById("btn-stop"),
    share: document.getElementById("btn-share"),
    reset: document.getElementById("btn-reset"),
    clear: document.getElementById("btn-clear"),
    autorun: document.getElementById("pg-autorun"),
    toast: document.getElementById("pg-toast"),
    status: document.getElementById("pg-status"),
  };

  /* ---------- storage (never load-bearing) ---------- */
  function save() {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify({ i: state.projectIndex, f: state.files }));
    } catch (err) { /* private browsing - the work just is not kept */ }
  }

  function load() {
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) { return null; }
  }

  function loadTicks() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(TICK_KEY) || "{}");
      state.ticks = parsed && typeof parsed === "object" ? parsed : {};
    } catch (err) { state.ticks = {}; }
  }

  function saveTicks() {
    try { window.localStorage.setItem(TICK_KEY, JSON.stringify(state.ticks)); } catch (err) { /* ok */ }
  }

  /* ---------- share links ---------- */
  function encode(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function decode(text) {
    const padded = text.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function toast(message) {
    el.toast.textContent = message;
    el.toast.classList.add("is-shown");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => el.toast.classList.remove("is-shown"), 2400);
  }

  function setStatus(text) { el.status.textContent = text; }

  /* ---------- the console panel ---------- */
  function clearConsole() {
    el.lines.innerHTML = "";
    const empty = document.createElement("p");
    empty.className = "pg-empty";
    empty.textContent = 'Nothing yet. Put console.log("hello") in your JavaScript and it turns up here.';
    el.lines.appendChild(empty);
  }

  /** Turn a raw JavaScript error into something a child can act on. */
  function friendlyHint(message) {
    const text = String(message);
    if (/is not defined/.test(text)) {
      return "JavaScript cannot find anything with that name. Check the spelling - capital letters count.";
    }
    if (/is not a function/.test(text)) {
      return "That name exists, but it is not something you can run with (). Check where you made it.";
    }
    if (/Cannot read propert|of null|of undefined/.test(text)) {
      return "You asked for something that is not on the page. Check the id in your JavaScript matches the one in your HTML.";
    }
    if (/Unexpected|missing|Invalid or unexpected token|unterminated/i.test(text)) {
      return "A bracket or a quote is probably missing. Every ( needs a ), and every \" needs a closing \".";
    }
    return "";
  }

  function addLine(kind, text, lineNo) {
    const empty = el.lines.querySelector(".pg-empty");
    if (empty) empty.remove();

    const row = document.createElement("div");
    row.className = "pg-line pg-line--" + (kind === "error" ? "error" : "log");

    const pip = document.createElement("span");
    pip.className = "pg-pip";
    pip.textContent = kind === "error" ? "✖" : "›";

    // Translate the line number in the assembled document back to a line of
    // the child's own script.js, which is the only number that means anything.
    let where = "";
    if (lineNo) {
      const n = lineNo - state.jsStartLine + 1;
      if (n >= 1 && n <= state.files.js.split("\n").length) where = "  (line " + n + " of script.js)";
    }

    const msg = document.createElement("span");
    msg.className = "pg-msg";
    msg.textContent = text + where;

    if (kind === "error") {
      const hint = friendlyHint(text);
      if (hint) {
        const help = document.createElement("span");
        help.className = "pg-hint";
        help.textContent = hint;
        msg.appendChild(help);
      }
    }

    row.appendChild(pip);
    row.appendChild(msg);
    el.lines.appendChild(row);
    el.lines.scrollTop = el.lines.scrollHeight;
  }

  // Only listen to OUR preview frame, not to any window that fancies posting.
  window.addEventListener("message", (event) => {
    if (!el.preview || event.source !== el.preview.contentWindow) return;
    const data = event.data;
    if (!data || data.__lwl !== 1) return;
    addLine(data.kind, data.text, data.line);
  });

  /* ---------- running ---------- */
  const RUNTIME = [
    "(function(){",
    'var send=function(kind,text,line){try{parent.postMessage({__lwl:1,kind:kind,text:text,line:line},"*")}catch(e){}};',
    'var show=function(v){try{return (typeof v==="object"&&v!==null)?JSON.stringify(v):String(v)}catch(e){return String(v)}};',
    '["log","info","warn"].forEach(function(k){var orig=console[k];console[k]=function(){',
    'send("log",Array.prototype.slice.call(arguments).map(show).join(" "));',
    "try{orig.apply(console,arguments)}catch(e){}}});",
    "var origErr=console.error;console.error=function(){",
    'send("error",Array.prototype.slice.call(arguments).map(show).join(" "));',
    "try{origErr.apply(console,arguments)}catch(e){}};",
    'window.onerror=function(m,src,line){send("error",m,line);return false};',
    'window.addEventListener("unhandledrejection",function(e){send("error",show(e.reason))});',
    "})();"
  ].join("");

  function buildDocument() {
    syncEditorToFiles();
    const open = "<scr" + "ipt>";
    const close = "</scr" + "ipt>";
    const prefix =
      '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      "<style>" + state.files.css + "</style></head><body>" +
      state.files.html +
      open + RUNTIME + close +
      open;
    state.jsStartLine = prefix.split("\n").length;
    return prefix + state.files.js + close + "</body></html>";
  }

  function run() {
    const doc = buildDocument();
    clearConsole();
    el.preview.srcdoc = doc;
    save();
    setStatus("Ran your code.");
  }

  function stop() {
    // Blanking the frame throws away whatever is running - the way out of a
    // loop that never ends.
    el.preview.srcdoc = '<!doctype html><html><body style="font-family:system-ui;padding:20px;color:#666">Stopped. Press Run to start it again.</body></html>';
    setStatus("Stopped the preview.");
  }

  function scheduleRun() {
    if (!el.autorun.checked) return;
    window.clearTimeout(runTimer);
    runTimer = window.setTimeout(run, RUN_DELAY);
  }

  /* ---------- editor ---------- */
  function syncEditorToFiles() { state.files[state.current] = el.code.value; }

  function syncGutter() {
    const count = el.code.value.split("\n").length;
    let out = "";
    for (let i = 1; i <= count; i++) out += i + "\n";
    el.gutter.textContent = out;
    el.gutter.scrollTop = el.code.scrollTop;
  }

  function showFile(name, skipSync) {
    if (!skipSync && name !== state.current) syncEditorToFiles();
    state.current = name;
    el.code.value = state.files[name];
    syncGutter();
    document.querySelectorAll("[data-file]").forEach((tab) => {
      const active = tab.dataset.file === name;
      tab.setAttribute("aria-selected", String(active));
      tab.classList.toggle("is-active", active);
    });
  }

  el.code.addEventListener("input", () => { syncGutter(); scheduleRun(); });
  el.code.addEventListener("scroll", () => { el.gutter.scrollTop = el.code.scrollTop; });

  el.code.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      event.preventDefault();
      const start = el.code.selectionStart;
      const end = el.code.selectionEnd;
      el.code.value = el.code.value.slice(0, start) + "  " + el.code.value.slice(end);
      el.code.selectionStart = el.code.selectionEnd = start + 2;
      syncGutter();
      scheduleRun();
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      run();
    }
  });

  document.querySelectorAll("[data-file]").forEach((tab) => {
    tab.addEventListener("click", () => showFile(tab.dataset.file));
  });

  /* ---------- projects ---------- */
  function renderBrief(project, index) {
    el.kicker.textContent = "Project " + (index + 1) + " of " + PROJECTS.length;
    el.title.textContent = project.name;
    el.blurb.textContent = project.blurb;

    el.tries.innerHTML = "";
    project.tries.forEach((text, i) => {
      const key = project.id + ":" + i;
      const item = document.createElement("li");

      const box = document.createElement("input");
      box.type = "checkbox";
      box.id = "pg-try-" + project.id + "-" + i;
      box.checked = Boolean(state.ticks[key]);
      box.addEventListener("change", () => {
        state.ticks[key] = box.checked;
        saveTicks();
      });

      const label = document.createElement("label");
      label.htmlFor = box.id;
      label.textContent = text;

      item.appendChild(box);
      item.appendChild(label);
      el.tries.appendChild(item);
    });
  }

  function loadProject(index, keepCode) {
    const project = PROJECTS[index];
    if (!project) return;
    state.projectIndex = index;
    if (!keepCode) {
      state.files = { html: project.html, css: project.css, js: project.js };
    }
    renderBrief(project, index);
    document.querySelectorAll(".pg-chip").forEach((chip, i) => {
      chip.setAttribute("aria-selected", String(i === index));
      chip.classList.toggle("is-active", i === index);
    });
    showFile("html", true);
    run();
  }

  PROJECTS.forEach((project, i) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "pg-chip";
    chip.textContent = project.name;
    chip.setAttribute("aria-selected", String(i === 0));
    chip.addEventListener("click", () => {
      loadProject(i, false);
      toast("Opened " + project.name);
    });
    el.rail.appendChild(chip);
  });

  /* ---------- buttons ---------- */
  el.run.addEventListener("click", run);
  el.stop.addEventListener("click", stop);
  el.clear.addEventListener("click", clearConsole);

  el.reset.addEventListener("click", () => {
    // Destroys whatever they have written, so ask first.
    if (!window.confirm("Throw away your changes and go back to the starting code?")) return;
    loadProject(state.projectIndex, false);
    toast("Back to the starting code");
  });

  el.share.addEventListener("click", () => {
    syncEditorToFiles();
    const payload = encode({ i: state.projectIndex, f: state.files });
    if (payload.length > MAX_SHARE) {
      toast("That project is too big to put in a link");
      setStatus("Share links hold about " + MAX_SHARE + " characters; this one is longer.");
      return;
    }
    const url = window.location.href.split("#")[0] + "#" + payload;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(
        () => toast("Link copied - send it to someone!"),
        () => { window.location.hash = payload; toast("Link is in the address bar"); }
      );
    } else {
      window.location.hash = payload;
      toast("Link is in the address bar");
    }
  });

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.view;
      document.getElementById("pg-bench").className = "pg-bench show-" + view;
      document.querySelectorAll("[data-view]").forEach((other) => {
        const active = other === button;
        other.setAttribute("aria-pressed", String(active));
        other.classList.toggle("is-active", active);
      });
    });
  });

  /* ---------- start ---------- */
  clearConsole();
  loadTicks();

  let started = false;
  if (window.location.hash.length > 3) {
    try {
      const shared = decode(window.location.hash.slice(1));
      if (shared && shared.f && typeof shared.f.html === "string") {
        state.files = { html: shared.f.html, css: String(shared.f.css || ""), js: String(shared.f.js || "") };
        loadProject(Number(shared.i) || 0, true);
        started = true;
        toast("Opened a shared project");
      }
    } catch (err) { /* a broken link just starts normally */ }
  }

  if (!started) {
    const saved = load();
    if (saved && saved.f && typeof saved.f.html === "string") {
      state.files = { html: saved.f.html, css: String(saved.f.css || ""), js: String(saved.f.js || "") };
      loadProject(Number(saved.i) || 0, true);
      setStatus("Picked up where you left off.");
    } else {
      loadProject(0, false);
    }
  }

  window.PlaygroundApp = {
    state, encode, decode, friendlyHint, buildDocument, run, stop,
    showFile, loadProject, syncEditorToFiles, PROJECTS, MAX_SHARE,
  };
})();
