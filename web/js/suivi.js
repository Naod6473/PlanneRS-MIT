/* PlanneRs : suivi des visites du site et de la démo, sans cookie.
   Un identifiant tiré au hasard vit le temps de l'onglet (sessionStorage), aucune adresse IP n'est gardée.
   Rien ne part si le navigateur demande à ne pas être suivi (Do Not Track, Global Privacy Control),
   ni si aucune adresse de réception n'est configurée (<meta name="planners-stats" content="https://…/t">). */
(function () {
  "use strict";
  var meta = document.querySelector('meta[name="planners-stats"]');
  var URL_T = window.PLANNERS_STATS_URL || (meta && meta.content) || "";
  if (!URL_T || !window.fetch) return;
  if (navigator.doNotTrack === "1" || window.doNotTrack === "1" || navigator.globalPrivacyControl) return;

  var demo = !!window.PLANNERS_FORCE_DEMO, src = demo ? "demo" : "site";
  var DEMO_LINK = /(^|\/)demo\/?(index\.html)?([?#]|$)/;
  function rnd() { var a = new Uint8Array(12); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 256; }); return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); }
  var sid = null;
  try { var q = new URLSearchParams(location.search).get("ps"); if (q && /^[A-Za-z0-9_-]{8,40}$/.test(q)) sessionStorage.setItem("ps-sid", q); sid = sessionStorage.getItem("ps-sid"); } catch (e) {}
  if (!sid) { sid = rnd(); try { sessionStorage.setItem("ps-sid", sid); } catch (e) {} }
  var w = Math.min(screen.width || innerWidth, innerWidth), device = /iPad|Tablet/i.test(navigator.userAgent) || (w >= 700 && w < 1024 && "ontouchstart" in window) ? "tablet" : w < 700 ? "mobile" : "desktop";
  function lang() { return (document.documentElement.lang || navigator.language || "").slice(0, 2).toLowerCase(); }
  function page() { return demo ? (location.hash.replace("#", "").split("/")[0] || "today") : location.pathname.replace(/index\.html$/, "") || "/"; }

  var queue = [], timer = null;
  function send(beacon) {
    if (!queue.length) return;
    var body = JSON.stringify({ sid: sid, src: src, device: device, lang: lang(), page: page(), ref: document.referrer && document.referrer.indexOf(location.host) < 0 ? document.referrer : "", ev: queue.splice(0, 40) });
    try {
      if (beacon && navigator.sendBeacon) navigator.sendBeacon(URL_T, new Blob([body], { type: "text/plain" }));
      else fetch(URL_T, { method: "POST", body: body, headers: { "content-type": "text/plain" }, keepalive: true, mode: "cors", credentials: "omit" }).catch(function () {});
    } catch (e) {}
    if (queue.length) send(beacon);
  }
  function track(t, l, v, p) {
    queue.push({ t: t, l: l == null ? null : String(l).slice(0, 120), v: v == null ? null : v, p: p || page() });
    if (!timer) timer = setTimeout(function () { timer = null; send(false); }, 4000);
  }
  window.PlanneRsTrack = track; // pour la page : track("calc", "hootsuite:12:equipe", 6161)

  // Temps réellement passé à regarder la page (onglet visible), et profondeur de lecture.
  var shown = 0, since = document.visibilityState === "visible" ? Date.now() : 0, depth = 0;
  function visible() { return shown + (since ? Date.now() - since : 0); }
  function scrolled() {
    var h = document.documentElement.scrollHeight - innerHeight;
    if (h > 0) depth = Math.max(depth, Math.min(100, Math.round(scrollY / h * 100)));
  }
  addEventListener("scroll", scrolled, { passive: true });
  function leave() {
    if (since) { shown += Date.now() - since; since = 0; }
    if (demo) screenDone();
    else track("section", "scroll", depth);
    track("leave", null, Math.round(visible()));
    send(true);
  }
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") leave();
    else since = Date.now();
  });
  addEventListener("pagehide", leave);

  track("view", demo ? "demo" : document.title, null);

  // Sections vues (site) : une fois chacune.
  if (!demo && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (!e.isIntersecting) return; track("section", e.target.getAttribute("data-sec") || e.target.id); io.unobserve(e.target); });
    }, { threshold: 0.35 });
    document.querySelectorAll("[data-sec], main section[id]").forEach(function (el) { io.observe(el); });
  }

  // Écrans de la démo : lequel, et combien de temps.
  var scr = demo ? page() : null, scrAt = Date.now();
  function screenDone() { if (!scr) return; var ms = Date.now() - scrAt; if (ms > 400) track("screen", scr, ms, scr); scrAt = Date.now(); }
  if (demo) {
    track("screen", scr, 0, scr);
    addEventListener("hashchange", function () { var n = page(); if (n === scr) return; screenDone(); scr = n; track("screen", scr, 0, scr); });
  }

  // Clics : liens, boutons. Les liens vers la démo emportent l'identifiant, pour suivre le passage site → démo.
  function name(el) {
    if (el.getAttribute("data-track")) return el.getAttribute("data-track");
    if (el.tagName === "A") {
      var href = el.getAttribute("href") || "";
      if (DEMO_LINK.test(href)) return "demo:" + (el.textContent || "").trim().slice(0, 40);
      if (href.charAt(0) === "#") return "ancre:" + href.slice(1);
      try { var u = new URL(href, location.href); return (u.host === location.host ? "" : u.host.replace(/^www\./, "")) + u.pathname.replace(/\/$/, ""); } catch (e) { return href.slice(0, 80); }
    }
    for (var i = 0; i < el.attributes.length; i++) { var a = el.attributes[i].name; if (/^data-/.test(a) && !/^data-(t|i18n|tip)$/.test(a)) return a.slice(5) + (el.attributes[i].value && el.attributes[i].value.length < 24 ? "=" + el.attributes[i].value : ""); }
    return (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60);
  }
  document.addEventListener("click", function (e) {
    var el = e.target.closest && e.target.closest("a, button, summary, [role=button]");
    if (!el) return;
    if (el.hasAttribute("data-lang")) { track("lang", el.getAttribute("data-lang")); return; }
    if (el.tagName === "SUMMARY") { track("click", "question:" + (el.getAttribute("data-t") || el.textContent.trim().slice(0, 40))); return; }
    track(demo ? "action" : "click", name(el));
    if (el.tagName === "A" && DEMO_LINK.test(el.getAttribute("href") || "")) {
      try { var u = new URL(el.href); u.searchParams.set("ps", sid); el.href = u.toString(); } catch (x) {}
      send(true);
    }
  }, true);

  // Vidéos : lancée, arrêtée (à quel pourcentage), vue jusqu'au bout. L'aperçu muet au survol ne compte pas comme une lecture.
  document.addEventListener("play", function (e) {
    var v = e.target; if (!v || v.tagName !== "VIDEO" || v.muted) return;
    track("video", vname(v) + ":play");
  }, true);
  document.addEventListener("pause", function (e) {
    var v = e.target; if (!v || v.tagName !== "VIDEO" || v.muted || v.ended || !v.duration) return;
    track("video", vname(v) + ":stop", Math.round(v.currentTime / v.duration * 100));
  }, true);
  document.addEventListener("ended", function (e) { var v = e.target; if (v && v.tagName === "VIDEO" && !v.muted) track("video", vname(v) + ":end", 100); }, true);
  function vname(v) { return v.getAttribute("data-track") || (v.currentSrc || v.src || "").split("/").pop().replace(/\.mp4.*$/, ""); }

  // Erreurs de la page : utiles pour savoir si quelque chose casse chez un visiteur.
  var errs = 0;
  addEventListener("error", function (e) { if (errs++ < 3 && e.message) track("error", e.message + (e.lineno ? " @" + e.lineno : "")); });
})();
