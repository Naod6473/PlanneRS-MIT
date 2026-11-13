/* PlanneRs : onglet « Site » de l'écran Stats. Les visites du site vitrine et de la démo :
   combien de visiteurs, combien de temps, jusqu'où ils lisent, ce qu'ils cliquent, les vidéos regardées,
   le passage vers la démo et ce qu'ils y font. Données reçues par le Worker sur /t (worker/src/visites.js). */
(function () {
  "use strict";
  const C = window.Core, U = window.UI, S = window.Store, A = window.App;
  const { esc, icon } = U;
  A.visDays = A.visDays || 30;

  const dur = (ms) => { const s = Math.round((ms || 0) / 1000); if (s < 60) return s + " s"; const m = Math.floor(s / 60); return m < 60 ? m + " min " + String(s % 60).padStart(2, "0") + " s" : Math.floor(m / 60) + " h " + String(m % 60).padStart(2, "0"); };
  const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);
  const SEC = { hero: "Haut de page", videos: "Vidéos", tout: "Tour complet", prix: "Prix", fonctions: "Fonctions", chiffres: "Chiffres", collaboratif: "Collaboratif", connexions: "Connexions", installer: "Installer", questions: "Questions", fin: "Bas de page" };
  const SCR = { today: "Aujourd'hui", calendar: "Calendrier", contents: "Contenus", fabrique: "La Fabrique", stats: "Stats", activity: "Activité", settings: "Réglages", more: "Plus", report: "Bilan du mois", list: "Liste" };
  const DEV = { mobile: "Téléphone", tablet: "Tablette", desktop: "Ordinateur" };

  // Démo : des chiffres d'exemple, pour voir l'écran.
  function demo() {
    const days = A.visDays, t = new Date();
    const perDay = Array.from({ length: days }, (_, i) => { const d = new Date(t - (days - 1 - i) * 864e5).toISOString().slice(0, 10), w = 14 + Math.round(10 * Math.sin(i / 2.3) + (i % 7 === 5 ? 18 : 0)); return { d, site: w, demo: Math.round(w * 0.38) }; });
    const site = perDay.reduce((a, x) => a + x.site, 0), dm = perDay.reduce((a, x) => a + x.demo, 0);
    const ago = (m) => new Date(Date.now() - m * 6e4).toISOString();
    return {
      days, demo: true, updated: new Date().toISOString(),
      site: { visitors: site, views: Math.round(site * 1.2), avgMs: 96000, medMs: 64000, scroll: 58, demoClick: Math.round(site * 0.41) },
      demo: { visitors: dm, fromSite: Math.round(dm * 0.83), avgMs: 214000, medMs: 151000,
        screens: [{ k: "today", n: dm, ms: dm * 52000 }, { k: "calendar", n: Math.round(dm * 0.71), ms: dm * 61000 }, { k: "contents", n: Math.round(dm * 0.44), ms: dm * 30000 }, { k: "stats", n: Math.round(dm * 0.39), ms: dm * 27000 }, { k: "fabrique", n: Math.round(dm * 0.18), ms: dm * 15000 }],
        actions: [{ k: "fill-week", n: Math.round(dm * 0.33) }, { k: "new", n: Math.round(dm * 0.29) }, { k: "review", n: Math.round(dm * 0.21) }, { k: "stattab=pep", n: Math.round(dm * 0.08) }] },
      perDay,
      funnel: ["hero", "videos", "tout", "prix", "fonctions", "connexions", "installer", "questions", "fin"].map((k, i) => ({ k, n: Math.round(site * Math.pow(0.84, i)) })),
      clicks: [{ k: "demo:Essayer la démo", n: Math.round(site * 0.3) }, { k: "demo:Ouvrir la démo", n: Math.round(site * 0.11) }, { k: "github.com/Naod6473/PlanneRS-MIT", n: Math.round(site * 0.09) }, { k: "deploy.workers.cloudflare.com", n: Math.round(site * 0.05) }, { k: "question:q1", n: Math.round(site * 0.07) }],
      videos: [{ k: "video3-9x16", play: Math.round(site * 0.22), done: Math.round(site * 0.09), pct: 61 }, { k: "cle1", play: Math.round(site * 0.12), done: Math.round(site * 0.07), pct: 74 }, { k: "cle3", play: Math.round(site * 0.1), done: Math.round(site * 0.06), pct: 70 }, { k: "fonctions-16x9", play: Math.round(site * 0.08), done: Math.round(site * 0.02), pct: 38 }],
      refs: [{ k: "(direct)", n: Math.round(site * 0.4) }, { k: "instagram.com", n: Math.round(site * 0.22) }, { k: "x.com", n: Math.round(site * 0.12) }, { k: "github.com", n: Math.round(site * 0.1) }, { k: "google.com", n: Math.round(site * 0.08) }],
      countries: [{ k: "FR", n: Math.round(site * 0.62) }, { k: "BE", n: Math.round(site * 0.09) }, { k: "CA", n: Math.round(site * 0.08) }, { k: "US", n: Math.round(site * 0.07) }, { k: "CH", n: Math.round(site * 0.05) }],
      devices: [{ k: "mobile", n: Math.round(site * 0.64) }, { k: "desktop", n: Math.round(site * 0.33) }, { k: "tablet", n: Math.round(site * 0.03) }],
      langs: [{ k: "fr", n: Math.round(site * 0.81) }, { k: "en", n: Math.round(site * 0.19) }],
      calc: [{ k: "hootsuite:10:seul", n: 21 }, { k: "buffer:6:seul", n: 17 }, { k: "later:8:equipe", n: 9 }, { k: "metricool:12:seul", n: 6 }],
      sessions: [
        { first: ago(14), last: ago(6), src: ["site", "demo"], siteMs: 84000, demoMs: 312000, ref: "instagram.com", country: "FR", device: "mobile", lang: "fr", ev: [{ at: ago(14), src: "site", t: "view" }, { at: ago(13.5), src: "site", t: "video", l: "cle3:play" }, { at: ago(13), src: "site", t: "section", l: "prix" }, { at: ago(12.8), src: "site", t: "calc", l: "hootsuite:10:seul", v: 1022 }, { at: ago(12.5), src: "site", t: "click", l: "demo:Essayer la démo" }, { at: ago(12.4), src: "demo", t: "screen", l: "today" }, { at: ago(11), src: "demo", t: "action", l: "fill-week" }, { at: ago(9), src: "demo", t: "screen", l: "calendar" }] },
        { first: ago(48), last: ago(46), src: ["site"], siteMs: 41000, demoMs: 0, ref: "x.com", country: "BE", device: "desktop", lang: "fr", ev: [{ at: ago(48), src: "site", t: "view" }, { at: ago(47), src: "site", t: "section", l: "videos" }, { at: ago(46.5), src: "site", t: "click", l: "github.com/Naod6473/PlanneRS-MIT" }] },
        { first: ago(95), last: ago(91), src: ["site"], siteMs: 188000, demoMs: 0, ref: null, country: "CA", device: "mobile", lang: "en", ev: [{ at: ago(95), src: "site", t: "view" }, { at: ago(94), src: "site", t: "lang", l: "en" }, { at: ago(93), src: "site", t: "swipe", l: "3" }, { at: ago(92), src: "site", t: "video", l: "cle5en:stop", v: 48 }] },
      ],
    };
  }

  let loading = false;
  async function load(force) {
    if (S.mode !== "api") { A.visData = demo(); return; }
    if (loading || (!force && A.visData && A.visData.days === A.visDays && Date.now() - A.visAt < 60000)) return;
    loading = true;
    try { A.visData = await S.call("GET", "visites?days=" + A.visDays); A.visAt = Date.now(); A.visErr = null; }
    catch (e) { A.visErr = e.message; }
    loading = false;
    if (A.statTab === "site") A.render();
  }

  const bars = (list, total, fmt) => '<ul class="vis-bars">' + list.map((x) => '<li><span class="vis-k">' + fmt(x) + '</span><span class="vis-bar"><i style="width:' + Math.max(2, pct(x.n, total)) + '%"></i></span><b>' + x.n + "</b></li>").join("") + "</ul>";
  const none = '<p class="muted small">Rien pour l\'instant.</p>';
  const flag = (cc) => (/^[A-Z]{2}$/.test(cc || "") ? String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0))) + " " + cc : esc(cc || "?"));
  const evText = (e) => {
    const l = esc(e.l || "");
    if (e.t === "view") return e.src === "demo" ? "Ouvre la démo" : "Arrive sur le site";
    if (e.t === "section") return e.l === "scroll" ? "Lit jusqu'à " + e.v + " %" : "Voit « " + esc(SEC[e.l] || e.l) + " »";
    if (e.t === "screen") return "Écran " + esc(SCR[e.l] || e.l) + (e.v ? " (" + dur(e.v) + ")" : "");
    if (e.t === "video") { const [n, w] = String(e.l || "").split(":"); return (w === "play" ? "Lance la vidéo " : w === "end" ? "Finit la vidéo " : "Arrête la vidéo ") + esc(n) + (w === "stop" && e.v != null ? " à " + e.v + " %" : ""); }
    if (e.t === "calc") return "Compteur : " + l + (e.v ? " (" + e.v + " €/an)" : "");
    if (e.t === "lang") return "Passe en " + (e.l === "en" ? "anglais" : "français");
    if (e.t === "swipe") return "Fait glisser la pile (vidéo " + l + ")";
    if (e.t === "error") return "Erreur : " + l;
    return (e.t === "action" ? "Démo : " : "Clique : ") + l;
  };

  A.visitesTools = function () {
    return '<div class="seg" role="group" aria-label="Période">' + [7, 30, 90].map((d) => '<button data-vis-days="' + d + '" aria-pressed="' + (A.visDays === d) + '">' + d + " j</button>").join("") + "</div>" +
      '<button class="btn" data-vis-refresh title="Actualiser" aria-label="Actualiser">' + icon("undo") + '<span class="lbl">Actualiser</span></button>';
  };

  A.visitesHtml = function () {
    if (!A.visData || A.visData.days !== A.visDays) { load(); if (!A.visData) return '<p class="muted">Chargement des visites…</p>'; }
    const d = A.visData, s = d.site, m = d.demo;
    if (A.visErr && S.mode === "api") return '<div class="panel"><p>Visites illisibles : ' + esc(A.visErr) + "</p></div>";
    const empty = !s.visitors && !m.visitors;
    const head = (d.demo ? '<p class="note muted small">Mode démo : chiffres d\'exemple.</p>' : "") +
      (empty ? '<section class="panel"><h2 class="sec-h"><span>Rien reçu pour l\'instant</span></h2><p>Le suivi se met en route quand le site et la démo connaissent l\'adresse de réception : l\'adresse publique de ton Worker suivie de <code>/t</code>. Pour la page d\'accueil et la démo en ligne sur GitHub Pages, mets-la dans la variable de dépôt <code>STATS_URL</code>.</p><p class="muted small">Aucun cookie, aucune adresse IP gardée, un identifiant au hasard par onglet. Les navigateurs qui demandent à ne pas être suivis sont ignorés. Les événements sont effacés au bout de 180 jours.</p></section>' : "");
    const kpi = (v, l, e) => '<div class="kpi stat"><b>' + v + "</b><span>" + l + "</span>" + (e ? "<em>" + e + "</em>" : "") + "</div>";
    const kpis = '<div class="kpis">' +
      kpi(s.visitors, "Visiteurs du site", s.views + " pages vues") +
      kpi(dur(s.avgMs), "Temps moyen sur le site", "<span>médiane</span> " + dur(s.medMs)) +
      kpi(s.scroll + " %", "Lecture moyenne de la page") +
      kpi(pct(s.demoClick, s.visitors) + " %", "Ont cliqué vers la démo", s.demoClick + " visiteurs") +
      kpi(m.visitors, "Visiteurs de la démo", m.fromSite + " venus du site") +
      kpi(dur(m.avgMs), "Temps moyen dans la démo", "<span>médiane</span> " + dur(m.medMs)) + "</div>";
    const max = Math.max(1, ...d.perDay.map((x) => x.site + x.demo));
    const chart = '<section class="panel"><h2 class="sec-h"><span>Visiteurs par jour</span><span class="vis-leg"><i class="a"></i>Site <i class="b"></i>Démo</span></h2><div class="vis-days" role="img" aria-label="Visiteurs par jour sur ' + d.days + ' jours">' +
      d.perDay.map((x) => '<span title="' + esc(C.shortDay ? C.shortDay(x.d) : x.d) + " : " + x.site + " site, " + x.demo + ' démo"><i class="b" style="height:' + pct(x.demo, max) + '%"></i><i class="a" style="height:' + pct(x.site, max) + '%"></i></span>').join("") + "</div></section>";
    const funnel = '<section class="panel"><h2 class="sec-h"><span>Jusqu\'où ils descendent</span><span class="vis-hint">' + s.visitors + " visiteurs</span></h2>" + (d.funnel.some((x) => x.n) ? bars(d.funnel.filter((x) => x.n), s.visitors, (x) => esc(SEC[x.k] || x.k)) : none) + "</section>";
    const videos = '<section class="panel"><h2 class="sec-h"><span>Vidéos</span><span class="vis-hint">lancées · vues en moyenne · jusqu\'au bout</span></h2>' + (d.videos.length ? '<ul class="vis-bars">' + d.videos.map((v) => '<li><span class="vis-k" data-noi18n>' + esc(v.k) + '</span><span class="vis-bar"><i style="width:' + Math.max(2, v.pct) + '%"></i></span><b>' + v.play + " · " + v.pct + " % · " + v.done + "</b></li>").join("") + "</ul>" : none) + "</section>";
    const clicks = '<section class="panel"><h2 class="sec-h"><span>Clics sur le site</span></h2>' + (d.clicks.length ? bars(d.clicks, Math.max(...d.clicks.map((x) => x.n)), (x) => '<span data-noi18n>' + esc(x.k) + "</span>") : none) + "</section>";
    const scr = '<section class="panel"><h2 class="sec-h"><span>Dans la démo</span><span class="vis-hint">écrans ouverts · temps passé</span></h2>' + (m.screens.length ? '<ul class="vis-bars">' + m.screens.map((x) => '<li><span class="vis-k">' + esc(SCR[x.k] || x.k) + '</span><span class="vis-bar"><i style="width:' + Math.max(2, pct(x.n, m.visitors)) + '%"></i></span><b>' + x.n + " · " + dur(x.ms) + "</b></li>").join("") + "</ul>" : none) +
      (m.actions.length ? '<h3 class="sec-h" style="margin-top:14px"><span>Ce qu\'ils essaient</span></h3>' + bars(m.actions, Math.max(...m.actions.map((x) => x.n)), (x) => '<span data-noi18n>' + esc(x.k) + "</span>") : "") + "</section>";
    const small = (t, list, fmt) => '<section class="panel"><h2 class="sec-h"><span>' + t + "</span></h2>" + (list.length ? bars(list, list.reduce((a, x) => a + x.n, 0), fmt) : none) + "</section>";
    const from = '<div class="vis-grid">' + small("D'où ils viennent", d.refs, (x) => '<span data-noi18n>' + esc(x.k === "(direct)" ? "Accès direct" : x.k) + "</span>") + small("Pays", d.countries, (x) => flag(x.k)) +
      small("Appareil", d.devices, (x) => esc(DEV[x.k] || x.k)) + small("Langue", d.langs, (x) => (x.k === "en" ? "Anglais" : x.k === "fr" ? "Français" : esc(x.k))) +
      (d.calc.length ? small("Compteur d'économies", d.calc, (x) => '<span data-noi18n>' + esc(x.k) + "</span>") : "") + "</div>";
    const journal = '<section class="panel"><h2 class="sec-h"><span>Journal des visites</span><span class="vis-hint">les 40 dernières</span></h2>' + (d.sessions.length ? '<ul class="vis-log">' + d.sessions.map((x) =>
      "<li><details><summary><b>" + esc(C.shortDay ? C.shortDay(x.first.slice(0, 10)) : x.first.slice(0, 10)) + " " + esc(new Date(x.first).toTimeString().slice(0, 5)) + "</b>" +
      '<span class="muted">' + flag(x.country) + " · " + esc(DEV[x.device] || "?") + " · " + esc(x.ref || "Accès direct") + "</span>" +
      '<span class="vis-tags">' + (x.siteMs ? '<span class="chip">Site ' + dur(x.siteMs) + "</span>" : "") + (x.src.includes("demo") ? '<span class="chip ok">Démo ' + dur(x.demoMs) + "</span>" : "") + "</span></summary>" +
      '<ol class="vis-steps">' + x.ev.map((e) => "<li><time>" + esc(new Date(e.at).toTimeString().slice(0, 8)) + "</time>" + evText(e) + "</li>").join("") + "</ol></details></li>").join("") + "</ul>" : none) + "</section>";
    return head + kpis + chart + '<div class="vis-grid">' + funnel + videos + clicks + scr + "</div>" + from + journal;
  };

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-vis-days]"), r = e.target.closest("[data-vis-refresh]");
    if (b) { A.visDays = +b.dataset.visDays; A.visData = null; if (S.mode !== "api") A.visData = demo(); A.render(); load(true); return; }
    if (r) { load(true); U.toast("Visites actualisées"); }
  });
})();
