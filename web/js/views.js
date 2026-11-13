/* PlanneRs : les 5 vues (Aujourd'hui, Calendrier, Contenus, Activité, Réglages). */
(function () {
  "use strict";
  // Icônes des tuiles de compteurs, dans le style du logo (img/menu/st-*.png ; incluses dans la démo autonome).
  const stPic = (k) => window.UI.pic("st-" + k);
  const C = window.Core, U = window.UI, S = window.Store;
  const { esc, safeUrl, icon, brand, brands, status, card } = U;
  const docsBase = () => (window.CONNECTOR_GUIDES || {}).base || "docs/";

  const A = (window.App = window.App || {});
  A.week = null; A.calMode = "week"; A.contentsMode = null; A.logFilter = "all"; A.setTab = "accounts";
  A.netOff = {}; A.pending = []; A.day = null;
  // Réseaux proposés partout (calendrier, création, stats) : sur ton instance, ceux dont le compte est connecté,
  // dans l'ordre des réglages puis du catalogue ; en démo (ou si rien n'est connecté), la liste des réglages.
  A.nets = function () {
    const base = (S.state.settings || {}).networks || ["instagram"];
    if (S.mode !== "api") return base;
    const acc = S.state.accounts || {}, on = (n) => acc[n] && (acc[n].status === "ok" || acc[n].status === "manual");
    const all = base.concat(((window.CONNECTORS || {}).social || []).map((c) => c.id).filter((n) => window.BRANDS[n] && !base.includes(n)));
    const out = all.filter(on);
    return out.length ? out : base;
  };

  const today = () => C.ymd(new Date());
  const settings = () => S.state.settings;
  const slots = () => settings().slots || [];
  A.isMobile = () => window.matchMedia("(max-width:760px)").matches;

  // Post « effectif » : avec les changements en attente appliqués.
  A.eff = function (p) {
    const ch = A.pending.find((c) => c.id === p.id) || A.pending.find((c) => c.id === p.parent);
    if (!ch) return p;
    if (ch.id === p.id) return Object.assign({}, p, ch.to);
    const parent = S.post(p.parent);
    if (!parent || !ch.to.date) return Object.assign({}, p, { date: null, time: null });
    const dd = (C.parseYmd(ch.to.date) - C.parseYmd(parent.date)) / 864e5;
    const dt = C.toMin(p.time) - C.toMin(parent.time);
    const m = C.toMin(ch.to.time) + dt;
    return Object.assign({}, p, { date: C.addDays(p.date, Math.round(dd)), time: C.pad(Math.floor(m / 60)) + ":" + C.pad(m % 60) });
  };
  const visible = (p) => (p.networks || []).some((n) => !A.netOff[n]);
  // Calendrier : filtre facultatif par statut (légende cliquable).
  // Recherche (titre, texte, n°…) et série : appliquées au calendrier et aux contenus.
  const shown = (p) => visible(p) && (!A.q || C.matchQuery(p, A.q)) && (!A.serie || C.seriesOf(p) === A.serie);
  const calVis = (p) => { if (!shown(p)) return false; if (!A.calSt) return true; const L = U.look(p); return L.st === A.calSt || L.al === A.calSt || (A.calSt === "alert" && !!L.al) || (A.calSt === "manual" && L.hand); };
  function fbar(opts) {
    const series = [...new Set(top().map(C.seriesOf).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
    if (A.serie && !series.includes(A.serie)) A.serie = "";
    let h = '<div class="fbar"><label class="lsearch">' + icon("search") + '<input type="search" data-fq placeholder="Chercher : titre, texte, n°, hashtag…" value="' + esc(A.q || "") + '" aria-label="Chercher dans les posts"></label>' +
      (series.length ? '<label class="fserie"><span class="sr">Série</span><select data-fserie aria-label="Série"><option value="">Toutes les séries</option>' + series.map((x) => '<option value="' + esc(x) + '"' + (A.serie === x ? " selected" : "") + ' data-noi18n>' + esc(x) + "</option>").join("") + "</select></label>" : "") +
      (A.q || A.serie ? '<button class="btn quiet sm" data-fclear>' + icon("x") + "Effacer</button>" : "") + "</div>";
    if ((A.q || A.serie) && opts && opts.results) {
      const hits = top().filter(shown).sort((a, b) => (C.at(a) || "9999").localeCompare(C.at(b) || "9999"));
      h += '<div class="fres"><span class="muted">' + hits.length + " résultat" + (hits.length > 1 ? "s" : "") + (hits.length > 8 ? " (les 8 premiers)" : "") + "</span>" +
        hits.slice(0, 8).map((p) => '<button class="chip sm" data-open="' + esc(p.id) + '">' + brands(p.networks) + '<span class="mono muted">' + (p.date ? esc(C.shortDay(p.date)) : "sans date") + '</span><span data-noi18n>' + esc(p.title.length > 40 ? p.title.slice(0, 39) + "…" : p.title) + "</span></button>").join("") + "</div>";
    }
    return h;
  }
  // Couverture d'un post : miniature enregistrée, sinon le média « cover », sinon la première image.
  const driveTh = (u) => { const id = (/drive\.google\.com\/.*(?:id=|\/d\/)([\w-]{20,})/.exec(u || "") || [])[1]; return id ? "https://drive.google.com/thumbnail?id=" + id + "&sz=w400" : u; };
  const coverOf = (p) => {
    if (p.thumb) return p.thumb;
    const m = (p.media || []).filter((x) => x.url && /^(https?:|data:image)/.test(x.url));
    const c = m.find((x) => x.role === "cover") || m.find((x) => /^image/.test(x.type || "") || /\.(jpe?g|png|webp|gif)$/i.test(x.name || x.url));
    return c ? driveTh(c.url) : "";
  };
  A.coverOf = coverOf;
  const posts = () => S.state.posts.map(A.eff);
  const top = () => posts().filter((p) => !p.parent);
  const kidsOf = (id) => posts().filter((p) => p.parent === id).sort((a, b) => (a.time || "").localeCompare(b.time || ""));

  // ---------------------------------------------------------------- Aujourd'hui
  A.todoList = function () {
    const now = C.nowStamp(), t = today();
    const all = top();
    const failed = all.filter((p) => (p.status === "failed" || p.needsAttention) && !p.ignored);
    const late = all.filter((p) => C.displayStatus(p, now) === "late" && !p.ignored && !C.missed(p, now));
    const missed = all.filter((p) => C.missed(p, now) && !p.ignored).sort((a, b) => C.at(b).localeCompare(C.at(a)));
    const review = all.filter((p) => C.displayStatus(p, now) === "review" && p.date && p.date >= t && p.date <= C.addDays(t, 14))
      .sort((a, b) => C.at(a).localeCompare(C.at(b)));
    const manual = all.filter((p) => p.date === t && (C.displayStatus(p, now) === "manual" ||
      (!p.manual && ["scheduled", "published"].includes(p.status) && C.pendingManual(p, S.state.settings).length && C.at(p) <= C.nowStamp(new Date(Date.now() + 36e5)))));
    const expiring = all.filter((p) => !p.date && p.expires && p.expires <= C.addDays(t, 3));
    return { failed, late, missed, review, manual, expiring, count: failed.length + late.length + (missed.length ? 1 : 0) + (review.length ? 1 : 0) + manual.length + expiring.length };
  };

  const failedNet = (p) => (Object.entries(p.results || {}).find(([, r]) => r.status !== "ok") || [p.networks[0]])[0];
  A.failedNet = failedNet;
  A.views = {};
  A.views.today = function () {
    const t = today(), now = C.nowStamp();
    const td = A.todoList();
    let todo = "";
    td.failed.forEach((p) => {
      todo += '<div class="tcard fail"><div class="head">' + brands(p.networks) + '<span class="muted">' + esc(C.FORMATS[p.format]) + " · " + esc(C.shortDay(p.date)) + " " + p.time + "</span>" + status("failed") + "</div>" +
        "<h3>" + esc(p.title) + "</h3><p>" + esc(p.failure ? p.failure.what : "L'envoi a échoué.") + "</p>" +
        (p.status === "failed" ? '<div class="acts"><button class="btn primary" data-retry="' + p.id + '">Réessayer</button><button class="btn" data-open="' + p.id + '">Comprendre</button></div></div>'
          : '<div class="acts"><button class="btn primary" data-manual="' + p.id + '" data-onet="' + esc(failedNet(p)) + '">Poster à la main</button><button class="btn" data-open="' + p.id + '">Comprendre</button><button class="btn quiet" data-ignore="' + p.id + '">Ignorer</button></div></div>');
    });
    td.late.forEach((p) => {
      todo += '<div class="tcard warn"><div class="head">' + brands(p.networks) + '<span class="muted">' + esc(C.FORMATS[p.format]) + "</span>" +
        '<span class="st st-late">' + icon("hand") + "En retard · " + (p.date === C.addDays(t, -1) ? "hier" : esc(C.shortDay(p.date))) + " " + p.time + "</span></div>" +
        "<h3>" + esc(p.title) + '</h3><div class="acts"><button class="btn primary" data-manual="' + p.id + '">Poster</button><button class="btn" data-open="' + p.id + '">Détails</button><button class="btn quiet" data-ignore="' + p.id + '">Ignorer</button></div></div>';
    });
    if (td.missed.length) {
      const m = td.missed, f = m[0];
      todo += '<a class="tcard warn link" href="#list/missed"><div class="head">' + brands([...new Set(m.flatMap((p) => p.networks))]) + '<span class="st st-late">' + icon("alert") + "Manqué" + (m.length > 1 ? "s" : "") + "</span></div>" +
        "<h3>" + m.length + " publication" + (m.length > 1 ? "s" : "") + " manquée" + (m.length > 1 ? "s" : "") + "</h3>" +
        "<p>Prévue" + (m.length > 1 ? "s" : "") + " il y a plus de 24 h, jamais partie" + (m.length > 1 ? "s" : "") + ". La dernière : " + esc(f.title) + " (" + esc(C.shortDay(f.date)) + " " + f.time + ").</p>" +
        '<span class="go">Reprogrammer ou ignorer ' + icon("right") + "</span></a>";
    }
    const mob = A.isMobile();
    // Téléphone : une carte par légende à valider (les 5 premières), à glisser à droite pour valider, à gauche pour reporter.
    if (mob && td.review.length && A.canValidate()) {
      td.review.slice(0, 5).forEach((p) => {
        todo += '<div class="tcard swipe" data-swipe="' + esc(p.id) + '" data-swipe-r="validate" data-swipe-l="later"><div class="head">' + brands(p.networks) + '<span class="st st-review">' + icon("eye") + "À valider · " + (p.date === t ? "" : esc(C.shortDay(p.date)) + " ") + p.time + "</span></div>" +
          "<h3>" + esc(p.title) + '</h3><p class="clamp2">' + esc((p.caption || "").slice(0, 160)) + '</p><div class="acts"><button class="btn primary" data-open="' + p.id + '">Relire</button></div></div>';
      });
      if (td.review.length > 5) todo += '<div class="acts" style="margin:-4px 0 4px"><button class="btn" data-review>Les ' + td.review.length + " légendes à valider</button></div>";
    } else if (td.review.length) {
      const f = td.review[0];
      const nets = [...new Set(td.review.flatMap((p) => p.networks))];
      todo += '<div class="tcard"><div class="head">' + brands(nets) + status("review") + "</div>" +
        "<h3>" + td.review.length + " légende" + (td.review.length > 1 ? "s" : "") + " à valider</h3>" +
        "<p>La première part " + (f.date === t ? "aujourd'hui" : esc(C.longDate(f.date))) + " à <b>" + f.time + "</b> : " + esc(f.title) + "</p>" +
        (A.canValidate() ? '<div class="acts"><button class="btn primary big" data-review>Relire et valider</button>' + (td.review.length > 1 ? '<button class="btn" data-valall>Tout valider</button>' : "") + '<button class="btn quiet" data-share-review>' + icon("send") + "Lien client</button></div>" : '<div class="acts"><a class="btn" href="#list/review">Voir la liste</a><button class="btn quiet" data-share-review>' + icon("send") + "Lien client</button></div>") + "</div>";
    }
    td.manual.forEach((p) => {
      const pm = C.pendingManual(p, S.state.settings);
      todo += '<div class="tcard' + (mob ? " swipe" : "") + '"' + (mob ? ' data-swipe="' + esc(p.id) + '" data-swipe-r="manual" data-swipe-l="later" data-onet="' + esc(pm[0] || "") + '"' : "") + '><div class="head">' + brands(pm.length ? pm : p.networks) + '<span class="st st-manual">' + icon("hand") + "À poster · " + p.time + "</span></div>" +
        "<h3>" + esc(p.title) + '</h3><div class="acts"><button class="btn primary" data-manual="' + p.id + '" data-onet="' + esc(pm[0] || "") + '">Poster</button><button class="btn" data-open="' + p.id + '">Détails</button></div></div>';
    });
    td.expiring.forEach((p) => {
      todo += '<div class="tcard warn"><div class="head">' + brands(p.networks) + '<span class="st st-ready">' + icon("clock") + "Se périme le " + esc(C.shortDay(p.expires)) + "</span></div>" +
        "<h3>" + esc(p.title) + '</h3><p>Contenu d\'actualité pas encore programmé.</p><div class="acts"><button class="btn primary" data-open="' + p.id + '">Programmer</button></div></div>';
    });
    if (!todo) todo = '<div class="empty" data-fx="party">Rien à faire pour l\'instant. Tout ce qui est programmé partira tout seul.</div>';

    const day = top().filter((p) => p.date === t && visible(p)).sort((a, b) => a.time.localeCompare(b.time));
    const pub = day.filter((p) => p.status === "published").length;
    const k = A.kpiData();
    const range = A.dashRange || "today";
    const seg = '<div class="seg" role="group" aria-label="Période affichée">' + [["today", "Aujourd'hui"], ["tomorrow", "Demain"], ["week", "7 jours"]]
      .map(([v, l]) => '<button data-dash="' + v + '" aria-pressed="' + (range === v) + '">' + l + "</button>").join("") + "</div>";
    let gal;
    if (range === "week") gal = progRows(k.span(t, C.addDays(t, 6)), true);
    else {
      const d = range === "today" ? t : C.addDays(t, 1);
      const list = top().filter((p) => p.date === d && visible(p)).sort((a, b) => a.time.localeCompare(b.time));
      gal = list.length ? progRows(list, false, d === t ? now.slice(11) : null)
        : '<div class="empty" data-fx="sleep">Aucune publication ' + (d === t ? "aujourd'hui" : "demain") + ".</div>";
    }
    const kpi = (key, val, lbl, cls) => '<a class="kpi' + (cls ? " " + cls : "") + '" href="#list/' + key + '"><b>' + val + "</b><span>" + lbl + "</span>" + icon("right", "go") + "</a>";

    return {
      title: "Aujourd'hui", sub: C.longDate(t),
      tools: '<span class="grow"></span><button class="btn primary" data-new aria-label="Nouveau post">' + icon("plus") + '<span class="lbl">Nouveau post</span></button>',
      html: nextStepCard(td, k) + '<div class="today dash"><section aria-labelledby="h-todo" class="dash-main">' + setupCard() + '<h2 class="sec-h" id="h-todo"><span>' + (mob ? "À faire maintenant" : "À faire") + "</span><span>" + td.count + "</span></h2>" +
        '<div class="todo">' + todo + "</div>" + (mob && todo.includes("data-swipe") ? '<p class="muted swipe-hint">Glisse une carte à droite pour valider (ou poster), à gauche pour reporter à demain.</p>' : "") + quickBar() + "</section>" +
        '<aside class="dash-side" aria-labelledby="h-prog"><div class="kpis two">' + kpi("today", pub + " / " + day.length, "publiés aujourd'hui", pub === day.length && day.length ? "ok" : "") +
        kpi("ahead", k.ahead + " j", "de planning d'avance" + (k.holes ? " · " + k.holes + " trou" + (k.holes > 1 ? "s" : "") : ""), k.holes ? "warn" : "") + "</div>" +
        '<div class="sec-row"><h2 class="sec-h" id="h-prog"><span>Au programme</span></h2>' + seg + "</div>" + gal + "</aside></div>",
    };
  };
  // « Prochaine étape » : une seule phrase, la chose la plus utile à faire maintenant, et son bouton.
  A.nextStep = function (td, k) {
    td = td || A.todoList(); k = k || A.kpiData();
    const en = (window.I18N || {}).lang === "en", t = today();
    const when = (p) => (p.date === t ? (en ? "today" : "aujourd'hui") : p.date === C.addDays(t, 1) ? (en ? "tomorrow" : "demain") : C.longDate(p.date)) + (en ? " at " : " à ") + p.time;
    const q = (p) => (en ? "“" + p.title + "”" : "« " + p.title + " »");
    if (td.failed.length) { const p = td.failed[0]; return { tone: "bad", text: en ? "Fix the failed post " + q(p) + "." : "Régler l'envoi raté de " + q(p) + ".", btn: "Comprendre", attr: 'data-open="' + esc(p.id) + '"' }; }
    if (td.late.length) { const p = td.late[0]; return { tone: "warn", text: en ? "Post " + q(p) + ", due " + when(p) + "." : "Poster " + q(p) + ", prévu " + when(p) + ".", btn: "Poster", attr: 'data-manual="' + esc(p.id) + '"' }; }
    if (td.manual.length) { const p = td.manual[0], pm = C.pendingManual(p, S.state.settings); return { tone: "warn", text: en ? "Post " + q(p) + " by hand " + when(p) + "." : "Poster " + q(p) + " à la main " + when(p) + ".", btn: "Poster", attr: 'data-manual="' + esc(p.id) + '" data-onet="' + esc(pm[0] || "") + '"' }; }
    if (td.review.length) { const n = td.review.length, f = td.review[0]; return { tone: "info", text: en ? "Review " + (n > 1 ? "your " + n + " captions" : "your caption") + ": the first one goes out " + when(f) + "." : "Relire " + (n > 1 ? "tes " + n + " légendes" : "ta légende") + " : la première part " + when(f) + ".", btn: "Relire", attr: "data-review", href: A.canValidate() ? "" : "#list/review" }; }
    if (td.missed.length) { const n = td.missed.length; return { tone: "warn", text: en ? "Reschedule or ignore " + n + " missed post" + (n > 1 ? "s" : "") + "." : "Reprogrammer ou ignorer " + n + " publication" + (n > 1 ? "s manquées" : " manquée") + ".", btn: "Voir", href: "#list/missed" }; }
    if (td.expiring.length) { const p = td.expiring[0]; return { tone: "warn", text: en ? "Schedule " + q(p) + " before " + C.shortDay(p.expires) + "." : "Programmer " + q(p) + " avant le " + C.shortDay(p.expires) + ".", btn: "Programmer", attr: 'data-open="' + esc(p.id) + '"' }; }
    if (k.holes) return { tone: "info", text: en ? "Fill the " + (k.holes > 1 ? k.holes + " empty days" : "empty day") + " in your plan." : "Remplir " + (k.holes > 1 ? "les " + k.holes + " jours vides" : "le jour vide") + " de ton planning.", btn: "Voir", href: "#list/ahead" };
    const nx = k.futur.filter((p) => p.time && C.at(p) > C.nowStamp()).sort((a, b) => C.at(a).localeCompare(C.at(b)))[0];
    if (nx) return { tone: "ok", text: en ? "Nothing to do: " + q(nx) + " goes out on its own " + when(nx) + "." : "Rien à faire : " + q(nx) + " part tout seul " + when(nx) + ".", btn: "Voir", attr: 'data-open="' + esc(nx.id) + '"' };
    return { tone: "ok", text: en ? "Your plan is empty: create your first post." : "Ton planning est vide : crée ton premier post.", btn: "Nouveau post", attr: "data-new" };
  };
  function nextStepCard(td, k) {
    const n = A.nextStep(td, k);
    return '<section class="nextstep t-' + n.tone + '" aria-labelledby="h-next"><span class="ns-ic">' + icon(n.tone === "ok" ? "check" : n.tone === "info" ? "spark" : "alert") + '</span>' +
      '<div class="ns-txt"><h2 id="h-next">Prochaine étape</h2><p data-noi18n>' + esc(n.text) + '</p></div>' + (n.href ? '<a class="btn primary" href="' + n.href + '">' + esc(n.btn) + icon("right") + "</a>" : '<button class="btn primary" ' + n.attr + ">" + esc(n.btn) + icon("right") + "</button>") + "</section>";
  }

  // « Bien démarrer » : les étapes d'installation, cochées toutes seules, puis la carte disparaît.
  A.setupSteps = function () {
    const st = S.state.settings || {}, acc = S.state.accounts || {}, CN = window.CONNECTORS || {};
    const has = (list) => (list || []).some((c) => acc[c.id] && acc[c.id].status && acc[c.id].status !== "off");
    return [
      ["Nommer ton espace", !!(st.workspace && st.workspace.name && st.workspace.name !== "Mon espace"), 'data-settab="space"'],
      ["Connecter un réseau", has(CN.social), 'data-settab="accounts"'],
      ["Relier tes médias (Drive, Dropbox…)", has(CN.storage), 'data-settab="storage"'],
      ["Choisir tes créneaux habituels", !!st.slotsSet, 'data-settab="slots"'],
      ["Créer un premier post", S.state.posts.length > 0, "data-new"],
      ["Passer en publication réelle", S.state.dryRun === false && (st.rules || {}).robotEnabled !== false, 'data-href="' + docsBase() + 'demarrage/premiers-pas.md#7-passer-en-publication-r%C3%A9elle"'],
    ];
  };
  function setupCard() {
    const st = S.state.settings || {};
    if (st.setupHidden) return "";
    const steps = A.setupSteps(), done = steps.filter((x) => x[1]).length;
    if (done === steps.length) return "";
    return '<section class="setup" aria-labelledby="h-setup"><div class="setup-h"><h2 id="h-setup">Bien démarrer</h2><span class="muted">' + done + " étape" + (done > 1 ? "s" : "") + " sur " + steps.length + '</span><button class="iconbtn sm" data-setup-hide aria-label="Masquer « Bien démarrer »" title="Masquer">' + icon("x") + "</button></div>" +
      '<div class="bar" aria-hidden="true"><i style="width:' + Math.round(done / steps.length * 100) + '%"></i></div><ol>' +
      steps.filter((x) => !x[1]).map(([l, , a]) => '<li><button class="lk" ' + a + ">" + icon("dot") + esc(l) + icon("right", "go") + "</button></li>").join("") + "</ol></section>";
  }

  // Programme compact : une ligne par contenu (heure, miniature, réseaux, titre, statut).
  function progRows(list, byDay, hm) {
    if (!list.length) return '<div class="empty" data-fx="sleep">Rien de prévu.</div>';
    const t = today(), now = C.nowStamp();
    let out = '<div class="prog">', cur = "", marked = !hm;
    list.slice().sort((a, b) => C.at(a).localeCompare(C.at(b))).forEach((p) => {
      if (byDay && p.date !== cur) { cur = p.date; out += '<h3 class="prog-d">' + esc(p.date === t ? "Aujourd'hui" : p.date === C.addDays(t, 1) ? "Demain" : C.longDate(p.date)) + "</h3>"; }
      if (!marked && p.time > hm) { marked = true; out += '<div class="prog-now" aria-label="Maintenant"><span>' + hm + "</span></div>"; }
      const L = U.look(p, now), kids = kidsOf(p.id).length;
      out += '<button class="prow ' + L.cls + (p.ignored ? " is-off" : "") + '" data-open="' + esc(p.id) + '"><span class="tm mono">' + (p.time || "") + "</span>" +
        (coverOf(p) ? '<img src="' + esc(coverOf(p)) + '" alt="" loading="lazy">' : '<span class="ph">' + icon(p.format === "reel" || p.format === "video" ? "film" : "contents") + "</span>") +
        '<span class="nm"><b>' + esc(p.title) + '</b><span class="sub">' + brands(p.networks) + esc(C.FORMATS[p.format] || "") + (kids ? " +" + kids : "") + "</span>" + U.abar(p, now) + "</span>" + U.badge(p, now) + "</button>";
    });
    return out + "</div>";
  }
  function quickBar() {
    const main = [["video", "film", "Ajouter une vidéo"], ["photo", "image", "Ajouter une photo"], ["idea", "bulb", "Proposer une idée"], ["link", "link", "Coller un lien d'actu"]];
    const more = [["hole", "calendar", "Remplir le prochain jour vide"], ["folder", "folder", "Dossier Drive du projet"]].concat(A.canDictate ? [["voice", "mic", "Dicter une idée"]] : []);
    const b = ([k, ic, l]) => '<button class="qb" data-quick="' + k + '">' + icon(ic) + "<span>" + l + "</span></button>";
    return '<section class="quick" aria-labelledby="h-quick"><h2 class="sec-h" id="h-quick"><span>Raccourcis</span>' + (A.isMobile() ? "" : "<span>Dépose un fichier sur la page pour l'ajouter</span>") + '</h2><div class="qgrid">' +
      main.map(b).join("") + "</div>" + '<details class="qmore"><summary>Autres raccourcis</summary><div class="qgrid">' + more.map(b).join("") + "</div></details></section>";
  }

  // Vignette d'un contenu : image, heure, réseaux et statut, teintée selon le statut.
  function tile(p, opts) {
    opts = opts || {};
    const L = U.look(p), st = L.st;
    const off = p.ignored ? " is-off" : "";
    const img = p.thumb ? '<img src="' + safeUrl(p.thumb) + '" alt="" loading="lazy">' : '<span class="ph">' + icon(p.format === "reel" || p.format === "video" ? "film" : "contents") + "<i>" + esc(C.FORMATS[p.format] || "") + "</i></span>";
    const kids = kidsOf(p.id).length;
    return '<button class="vg ' + L.cls + off + (opts.small ? " sm" : "") + '" data-open="' + esc(p.id) + '" title="' + esc(p.title + " · " + C.STATUS[st].label + (L.al ? " · " + C.STATUS[L.al].label : "")) + '">' +
      '<span class="pic">' + img + '<span class="tm">' + (p.time || "") + "</span>" + '<span class="sti c-' + st + '">' + icon(C.STATUS[st].icon) + "</span>" + likesBadge(p, opts.small) + "</span>" +
      (opts.small ? "" : '<span class="meta">' + brands(p.networks) + '<span class="fmt">' + esc(C.FORMATS[p.format] || "") + (kids ? " +" + kids : "") + "</span></span>" +
        '<span class="ttl">' + esc(p.title) + "</span>") + "</button>";
  }
  A.tile = tile;
  function likesBadge(p, small) {
    const s = A.postStats && A.postStats(p);
    if (!s) return "";
    const a = Object.values(s), l = a.reduce((n, m) => n + (m.likes || 0), 0), c = a.reduce((n, m) => n + (m.comments || 0), 0), v = a.reduce((n, m) => n + (m.views || 0), 0);
    return '<span class="lk" title="' + (v ? v + " vue(s), " : "") + l + " like(s), " + c + ' commentaire(s)">' + (v && !small ? icon("eye") + fmtN(v) + " " : "") + icon("heart") + l + (c && !small ? " " + icon("bubble") + c : "") + "</span>";
  }
  // hm : heure actuelle ; la première vignette à venir porte le repère « maintenant ».
  function tilesWithNow(list, hm, small) {
    let done = !hm;
    return list.map((p) => {
      let h = tile(p, { small });
      if (!done && p.time > hm) { done = true; h = h.replace('class="vg ', 'data-now="' + hm + '" class="vg next '); }
      return h;
    }).join("");
  }
  // Contenus regroupés par jour. empty : afficher aussi les jours sans rien (la frise).
  function dayGroups(list, opts) {
    opts = opts || {};
    const t = today(), hm = C.nowStamp().slice(11);
    const by = {};
    list.forEach((p) => { (by[p.date] = by[p.date] || []).push(p); });
    let days = Object.keys(by).sort();
    if (opts.empty && days.length) { days = []; for (let d = opts.from || t; d <= (opts.to || Object.keys(by).sort().pop()); d = C.addDays(d, 1)) days.push(d); }
    if (!days.length) return '<div class="empty" data-fx="seed">Rien ici pour l\'instant.</div>';
    return '<div class="days' + (opts.small ? " frise" : "") + '">' + days.map((d) => {
      const l = (by[d] || []).sort((a, b) => a.time.localeCompare(b.time));
      const lbl = d === t ? "Aujourd'hui" : d === C.addDays(t, 1) ? "Demain" : C.longDate(d);
      return '<section class="dayrow' + (l.length ? "" : " hole") + (d === t ? " is-today" : "") + '"><h3><span' + (d > C.addDays(t, 1) ? ' class="long"' : "") + ">" + esc(lbl) + "</span>" + (opts.small && d > C.addDays(t, 1) ? '<span class="short">' + esc(C.shortDay(d)) + "</span>" : "") +
        '<span class="n">' + (l.length ? l.length + " contenu" + (l.length > 1 ? "s" : "") : "Rien de prévu") + "</span></h3>" +
        (l.length ? '<div class="gal' + (opts.small ? " row" : "") + '">' + tilesWithNow(l, d === t ? hm : null, opts.small) + "</div>" : "") + "</section>";
    }).join("") + "</div>";
  }

  // Chiffres du tableau de bord (partagés avec les listes).
  A.kpiData = function () {
    const t = today();
    const all = top().filter(visible);
    const span = (a, b) => all.filter((p) => p.date && p.date >= a && p.date <= b);
    const next7 = all.filter((p) => p.date > t && p.date <= C.addDays(t, 7) && C.willSend(p));
    const futur = all.filter((p) => p.date && p.date >= t && p.status !== "published");
    const lastDate = futur.map((p) => p.date).sort().pop();
    const ahead = lastDate ? Math.max(0, Math.round((C.parseYmd(lastDate) - C.parseYmd(t)) / 864e5)) : 0;
    const used = new Set(futur.map((p) => p.date));
    let holes = 0;
    for (let d = t; lastDate && d <= lastDate; d = C.addDays(d, 1)) if (!used.has(d) && !all.some((p) => p.date === d)) holes++;
    return { span, next7, futur, lastDate, ahead, holes };
  };

  A.views.list = function () {
    const kind = location.hash.split("/")[1] || "today";
    const t = today(), k = A.kpiData();
    const back = '<a class="btn" href="#today">' + icon("left") + '<span class="lbl">Aujourd\'hui</span></a>';
    if (kind === "review") {
      const r = A.todoList().review;
      return { title: "Légendes à valider", sub: r.length + " sur les 14 prochains jours", tools: back,
        html: (r.length ? '<div class="lead"><p>Elles ne partiront pas tant qu\'elles ne sont pas validées.</p><div class="acts">' + (A.canValidate() ? '<button class="btn primary big" data-review>Relire et valider</button><button class="btn" data-valall>Tout valider</button>' : "") + '<button class="btn" data-share-review>' + icon("send") + "Lien de validation client</button></div></div>" : "") + dayGroups(r) };
    }
    if (kind === "missed") {
      const now = C.nowStamp();
      const all = top().filter((p) => C.missed(p, now)).sort((a, b) => C.at(b).localeCompare(C.at(a)));
      const open = all.filter((p) => !p.ignored), ign = all.filter((p) => p.ignored);
      const why = (p) => p.manual ? "Rappel à la main pas fait" : !p.captionValidated ? "Légende jamais validée" : "Pas parti (robot à l'arrêt ou publié ailleurs)";
      const row = (p) => '<div class="mrow' + (p.ignored ? " is-off" : "") + '">' + tile(p, { small: true }) +
        '<div class="mtxt"><b>' + esc(p.title) + "</b><span>" + brands(p.networks) + " " + esc(C.FORMATS[p.format] || "") + " · " + esc(C.longDate(p.date)) + " " + p.time + "</span><span class=\"muted\">" + why(p) + "</span></div>" +
        '<div class="acts">' + (p.ignored ? '<button class="btn" data-unignore="' + p.id + '">Remettre</button>'
          : '<button class="btn primary" data-resched="' + p.id + '">Reprogrammer</button><button class="btn" data-manual="' + p.id + '">Déjà posté</button><button class="btn quiet" data-ignore="' + p.id + '">Ignorer</button>') + "</div></div>";
      return { title: "Manqués", sub: open.length ? open.length + " à rattraper" : "Rien à rattraper", tools: back,
        html: '<div class="lead"><p>Publications dont l\'heure est passée depuis plus de 24 h sans que rien ne parte. Reprogramme-les, note-les comme déjà postées (avec le lien), ou ignore-les.</p></div>' +
          (open.length ? '<div class="mlist">' + open.map(row).join("") + "</div>" : '<div class="empty" data-fx="check">Aucune publication manquée. Tout ce qui était prévu est parti.</div>') +
          (ign.length ? '<details class="box" style="margin-top:18px"><summary style="cursor:pointer;font-weight:600">' + ign.length + " ignorée" + (ign.length > 1 ? "s" : "") + '</summary><div class="mlist" style="margin-top:10px">' + ign.map(row).join("") + "</div></details>" : "") };
    }
    if (kind === "next7") return { title: "Prêts à partir", sub: k.next7.length + " sur les 7 prochains jours", tools: back, html: '<div class="lead"><p>Validés, datés et automatiques : le robot les enverra seul.</p></div>' + dayGroups(k.next7) };
    if (kind === "ahead") {
      return { title: "Planning d'avance", sub: k.ahead + " jours · jusqu'au " + (k.lastDate ? C.longDate(k.lastDate) : "—"), tools: back,
        html: '<div class="lead"><p>' + k.futur.length + " contenus à venir" + (k.holes ? ", <b>" + k.holes + " jour" + (k.holes > 1 ? "s" : "") + " sans rien</b> (en orange)" : "") + ".</p>" + legend() + "</div>" +
          dayGroups(k.span(t, k.lastDate || t), { empty: true, small: true, from: t, to: k.lastDate || t }) };
    }
    const d = top().filter((p) => p.date === t && visible(p));
    return { title: "Publications du jour", sub: C.longDate(t), tools: back, html: '<div class="lead">' + legend() + "</div>" + dayGroups(d) };
  };
  function legend() {
    return '<div class="legend">' + C.STEPS.map(([s]) => s).concat(["manual", "failed"]).map((s) => '<span class="lg is-' + s + '"><i></i>' + C.STATUS[s].label + "</span>").join("") + "</div>";
  }

  // ---------------------------------------------------------------- Calendrier
  // Filtre des réseaux replié dans un menu : l'en-tête tient sur une ligne.
  function netMenu() {
    const nets = A.nets();
    const on = nets.filter((n) => !A.netOff[n]);
    return '<details class="netdd"' + (A.netOpen ? " open" : "") + '><summary class="btn">' + brands(on.length ? on : nets) + '<span class="lbl">Réseaux</span>' +
      (on.length < nets.length ? ' <span class="muted">' + on.length + "/" + nets.length + "</span>" : "") + "</summary>" +
      '<div class="pop">' + netChips() + "</div></details>";
  }

  function netChips() {
    return '<div class="filters" role="group" aria-label="Réseaux affichés">' + (A.nets()).map((n) =>
      '<button class="chip" data-net="' + n + '" aria-pressed="' + !A.netOff[n] + '">' + brand(n) + esc(window.BRANDS[n] ? window.BRANDS[n].title : n) + "</button>").join("") + "</div>";
  }

  A.views.calendar = function () {
    if (!A.week) A.week = C.mondayOf(today());
    const mob = A.isMobile();
    const mode = mob && A.calMode === "week" ? "agenda" : A.calMode;
    const range = mode === "month" ? monthTitle() : weekTitle();
    const tools = '<button class="iconbtn" data-nav="-1" aria-label="Période précédente">' + icon("left") + "</button>" + (mode === "grid" ? '<b style="min-width:150px">' + range + "</b>" : '<span class="sr">' + range + "</span>") +
      '<button class="iconbtn" data-nav="1" aria-label="Période suivante">' + icon("right") + "</button>" +
      '<button class="btn" data-nav="0" title="Aujourd\'hui">' + icon("calendar") + '<span class="lbl">Aujourd\'hui</span></button>' +
      '<div class="seg" role="group" aria-label="Affichage">' + [["week", "Semaine"], ["cols", "Vignettes"], ["month", "Mois"], ["grid", 'Grille<span class="lbl"> du profil</span>']].map(([k, l]) =>
        '<button data-calmode="' + k + '" aria-pressed="' + (A.calMode === k) + '">' + l + "</button>").join("") + "</div>" +
      '<span class="grow"></span>' + (mode === "week" || mode === "month" ? '<div class="seg small-seg" role="group" aria-label="Densité"><button data-caldense="1" aria-pressed="' + !!A.calCompact + '">Compact</button><button data-caldense="0" aria-pressed="' + !A.calCompact + '">Détaillé</button></div>' : "") + netMenu() +
      (mode === "agenda" && top().some((p) => !p.date && p.status === "ready") ? '<button class="btn" data-fillweek aria-label="Remplir la semaine">' + icon("spark") + '<span class="lbl">Remplir la semaine</span></button>' : "") +
      '<button class="btn primary desk" data-new>' + icon("plus") + "Nouveau post</button>";
    let html;
    if (mode === "agenda") html = agenda();
    else if (mode === "month") html = month();
    else if (mode === "grid") html = profileGrid();
    else if (mode === "cols") html = weekCols();
    else html = weekGrid();
    if (mode !== "grid") html = fbar({ results: true }) + periodBand(mode) + html;
    return { title: "Calendrier", tools, html };
  };

  function weekTitle() {
    const a = C.parseYmd(A.week), b = C.parseYmd(C.addDays(A.week, 6));
    return a.getDate() + (a.getMonth() !== b.getMonth() ? " " + C.MONTHS[a.getMonth()].slice(0, 4) + "." : "") + " – " + b.getDate() + " " + C.MONTHS[b.getMonth()];
  }
  // Bandeau de la période : la semaine (ou le mois) en toutes lettres, puis les chiffres par étape.
  // Chaque carte filtre le calendrier (un second clic enlève le filtre).
  function periodBand(mode) {
    const en = (window.I18N || {}).lang === "en";
    let a, b, phrase;
    if (mode === "month") {
      const mid = C.parseYmd(C.addDays(A.week, 3));
      a = C.ymd(new Date(mid.getFullYear(), mid.getMonth(), 1)); b = C.ymd(new Date(mid.getFullYear(), mid.getMonth() + 1, 0));
      phrase = (en ? "Your " + C.MONTHS[mid.getMonth()] + " " : "Ton mois de " + C.MONTHS[mid.getMonth()] + " ") + mid.getFullYear();
    } else {
      a = A.week; b = C.addDays(A.week, 6);
      const da = C.parseYmd(a), db = C.parseYmd(b);
      phrase = (en ? "" : "Du ") + C.DAYS[da.getDay()] + " " + da.getDate() + (da.getMonth() !== db.getMonth() ? " " + C.MONTHS[da.getMonth()] : "") + (en ? " to " : " au ") + C.DAYS[db.getDay()] + " " + db.getDate() + " " + C.MONTHS[db.getMonth()];
    }
    const now = C.nowStamp();
    const list = top().filter((p) => p.date && p.date >= a && p.date <= b && shown(p)).map((p) => U.look(p, now));
    const n = (f) => list.filter(f).length;
    const cards = [["prep", "à préparer", n((l) => l.st === "prep" || l.st === "idea")], ["review", "à valider", n((l) => l.st === "review")],
      ["scheduled", "programmés", n((l) => l.st === "scheduled")], ["published", "publiés", n((l) => l.st === "published")]];
    const hand = n((l) => l.hand), al = n((l) => !!l.al);
    if (hand) cards.push(["manual", "à la main", hand]);
    if (al) cards.push(["alert", "à régler", al]);
    const total = list.length;
    return '<section class="pband" aria-labelledby="h-period"><div class="pband-h"><h2 id="h-period" data-noi18n>' + esc(phrase) + '</h2><span class="muted">' + total + " contenu" + (total > 1 ? "s" : "") +
      (A.calSt ? ' · <button class="lk" data-calst="">' + icon("x") + "Tout afficher</button>" : "") + "</span></div>" +
      '<div class="pkpis" role="group" aria-label="Filtrer par étape">' + cards.map(([k, l, v]) => '<button class="pkpi c-' + k + (k === "alert" ? " is-alert" : "") + '" data-calst="' + k + '" aria-pressed="' + (A.calSt === k) + '">' +
        stPic(k === "alert" ? "fix" : k) + "<b>" + v + (k === "published" && total ? '<small> / ' + total + "</small>" : "") + "</b><span>" + l + "</span></button>").join("") + "</div></section>";
  }

  // Vue « Vignettes » : 7 colonnes, une carte avec image par contenu (façon planche).
  function weekCols() {
    const t = today(), now = C.nowStamp();
    const days = [...Array(7)].map((_, i) => C.addDays(A.week, i));
    const list = top().filter((p) => p.date && p.date >= days[0] && p.date <= days[6] && calVis(p));
    return '<div class="wcols" role="group" aria-label="Semaine en vignettes">' + days.map((d) => {
      const here = list.filter((p) => p.date === d).sort((x, y) => (x.time || "").localeCompare(y.time || ""));
      const dd = C.parseYmd(d);
      return '<section class="wcol' + (d === t ? " is-today" : "") + (d < t ? " past" : "") + '" data-day="' + d + '" aria-labelledby="wc-' + d + '"><h3 class="wcol-h" id="wc-' + d + '"><span>' + esc(C.DAYS[dd.getDay()]) + "</span><b>" + dd.getDate() + "</b>" +
        (d === t ? '<span class="sr"> (aujourd\'hui)</span>' : "") + '<span class="n">' + (here.length || "") + "</span></h3>" +
        here.map((p) => {
          const L = U.look(p, now), cov = coverOf(p), kids = kidsOf(p.id).length;
          return '<button class="wcard ' + L.cls + (p.ignored ? " is-off" : "") + '" data-open="' + esc(p.id) + '">' + U.abar(p, now, true) +
            '<span class="pic' + (cov ? "" : " noimg") + '">' + (cov ? '<img src="' + esc(cov) + '" alt="" loading="lazy" draggable="false">' : '<span class="ph">' + icon(p.format === "reel" || p.format === "video" ? "film" : "contents") + "</span>") +
            '<span class="tm">' + (p.time || "") + "</span></span>" +
            '<span class="ttl">' + esc(p.title) + '</span><span class="meta">' + brands(p.networks) + '<span class="fmt">' + esc(C.FORMATS[p.format] || "") + (kids ? " +" + kids : "") + "</span></span>" + U.badge(p, now) + "</button>";
        }).join("") +
        (!here.length ? (d >= t ? '<button class="wfree" data-free="' + d + "|" + ((slots()[0] || {}).time || "12:00") + '" aria-label="Ajouter un post le ' + esc(C.longDate(d)) + '">' + icon("plus") + "</button>" : '<p class="wnone">Rien</p>') : "") + "</section>";
    }).join("") + "</div>";
  }

  function monthTitle() {
    const d = C.parseYmd(C.addDays(A.week, 3));
    return C.MONTHS[d.getMonth()][0].toUpperCase() + C.MONTHS[d.getMonth()].slice(1) + " " + d.getFullYear();
  }

  function weekGrid() {
    const t = today(), now = C.nowStamp();
    const days = [...Array(7)].map((_, i) => C.addDays(A.week, i));
    const list = top().filter((p) => p.date && p.date >= days[0] && p.date <= days[6] && calVis(p));
    const rows = slots().map((s) => ({ time: s.time, label: s.label }));
    const off = list.filter((p) => !C.slotOf(p.time, slots()));
    let h = '<div class="slotgrid" role="group" aria-label="Semaine par créneaux" style="--rows:' + (rows.length + (off.length ? 1 : 0)) + '"><div class="h"></div>' +
      days.map((d) => '<div class="h' + (d === t ? " is-today" : "") + '">' + esc(C.shortDay(d)) + (d === t ? '<span class="sr"> (aujourd\'hui)</span>' : "") + "</div>").join("");
    rows.forEach((r) => {
      h += '<div class="s"><b>' + r.time + "</b><small>" + esc(r.label) + "</small></div>";
      days.forEach((d) => {
        const here = list.filter((p) => p.date === d && (C.slotOf(p.time, slots()) || {}).time === r.time);
        const past = d + "T" + r.time < now;
        h += '<div class="cell' + (past ? " past" : "") + '" data-day="' + d + '" data-time="' + r.time + '">' +
          here.map((p) => card(p, { size: "mini", kids: kidsOf(p.id), draggable: p.status !== "published" })).join("") +
          (!here.length && !past ? '<button class="free" data-free="' + d + "|" + r.time + '" aria-label="Créneau libre ' + esc(C.shortDay(d)) + " " + r.time + '">+</button>' : "") + "</div>";
      });
    });
    if (off.length) {
      h += '<div class="s"><b>Autres</b><small>hors créneaux</small></div>';
      days.forEach((d) => {
        h += '<div class="cell" data-day="' + d + '">' + off.filter((p) => p.date === d).map((p) => card(p, { size: "mini", kids: kidsOf(p.id), draggable: p.status !== "published" })).join("") + "</div>";
      });
    }
    h += "</div>";
    const ready = top().filter((p) => !p.date && p.status === "ready" && shown(p));
    const tray = A.trayClosed
      ? '<aside class="tray closed" data-tray aria-label="Prêts à programmer"><button class="traytg" data-tray-toggle aria-expanded="false" title="Afficher les posts prêts à programmer">' + icon("left") + '<span>Prêts à programmer · ' + ready.length + "</span></button></aside>"
      : '<aside class="tray" data-tray aria-label="Prêts à programmer"><h2 class="sec-h"><span>Prêts à programmer</span><span>' + ready.length +
        ' <button class="iconbtn sm" data-tray-toggle aria-expanded="true" title="Replier">' + icon("right") + "</button></span></h2>" +
        (ready.length ? '<button class="btn sm" data-fillweek style="width:100%;justify-content:center">' + icon("spark") + "Remplir la semaine</button>" : "") +
        '<div class="traylist">' + (ready.map((p) => card(p, { draggable: true })).join("") || '<p class="muted" style="font-size:12px">Rien en attente.</p>') + "</div>" +
        '<p class="muted" style="font-size:12px;margin:4px 0 0">Glisse une carte sur un créneau (au téléphone : appui long, puis glisse). Au clavier : ouvre la carte, puis « Changer la date ».</p></aside>';
    return '<div class="cal-wrap ' + (A.calCompact ? "fit" : "detailed") + '">' + h + tray + "</div>";
  }

  function month() {
    const t = today();
    const mid = C.parseYmd(C.addDays(A.week, 3));
    const first = C.ymd(new Date(mid.getFullYear(), mid.getMonth(), 1));
    const start = C.mondayOf(first);
    const now = C.nowStamp();
    let h = '<div class="month">' + [1, 2, 3, 4, 5, 6, 0].map((i) => C.DAYS[i].slice(0, 3)).map((d) => '<div class="h">' + d + "</div>").join("");
    for (let i = 0; i < 42; i++) {
      const d = C.addDays(start, i);
      if (i === 35 && C.parseYmd(d).getMonth() !== mid.getMonth()) break;
      const items = top().filter((p) => p.date === d && calVis(p)).sort((a, b) => a.time.localeCompare(b.time));
      const out = C.parseYmd(d).getMonth() !== mid.getMonth();
      h += '<div class="mday' + (out ? " out" : "") + (d === t ? " is-today" : "") + '" data-day="' + d + '"><span class="d">' + C.parseYmd(d).getDate() + "</span>" +
        items.slice(0, items.length > 5 ? 4 : 5).map((p) => { const L = U.look(p, now), st = L.al || L.st; return '<button class="mline ' + L.cls + '" data-open="' + p.id + '"' + (p.status !== "published" ? ' data-drag="' + p.id + '"' : "") + ' title="' + esc(C.STATUS[st].label + " · " + p.title) + '"><span class="ic c-' + st + '">' + icon(C.STATUS[st].icon) + "</span>" + brand(p.networks[0]) + '<span class="x"><span class="mono">' + p.time + "</span> " + esc(p.title) + "</span></button>"; }).join("") +
        (items.length > 5 ? '<button class="mline muted" data-gotoweek="' + d + '">+ ' + (items.length - 4) + " autres</button>" : "") + "</div>";
    }
    return h + "</div>";
  }

  function profileGrid() {
    const list = top().filter((p) => p.networks.includes("instagram") && ["reel", "carousel", "image"].includes(p.format) && (p.date || p.status === "published"))
      .sort((a, b) => (C.at(b) || "").localeCompare(C.at(a) || "")).slice(0, 30);
    const st = S.state.stats || (S.mode === "demo" ? (A._demoSt = A._demoSt || A.demoStats()) : null) || {};
    const ig = (st.instagram || {}).account || {};
    const acc = (S.state.accounts || {}).instagram || {};
    const name = ig.username || (String(acc.account || "").match(/«\s*([^»]+?)\s*»/) || [])[1] || (S.state.settings.name || "Mon compte");
    const fmt = (n) => (n == null ? "–" : n >= 10000 ? (n / 1000).toFixed(1).replace(".", ",") + " k" : String(n));
    const pub = list.filter((p) => p.status === "published").length, fut = list.length - pub;
    const badge = (p) => p.format === "reel" ? '<span class="pbadge" title="Reel">' + icon("film") + "</span>" : p.format === "carousel" ? '<span class="pbadge" title="Carrousel">' + icon("copy") + "</span>" : "";
    return '<div class="profile"><div class="phead"><span class="pav">' + esc([...name][0].toUpperCase()) + '</span><div class="pnums"><b>' + esc(name) + "</b><div>" +
      "<span><b>" + fmt(ig.media_count != null ? ig.media_count : pub) + "</b> publications</span><span><b>" + fmt(ig.followers) + "</b> abonnés</span><span><b>" + fut + "</b> à venir</span></div></div></div>" +
      '<p class="muted" style="margin:0 0 10px;font-size:13px">Les cases en pointillés ne sont pas encore publiées. Glisse une case à venir sur une autre pour échanger leurs dates.</p><div class="pgrid">' +
      list.map((p) => '<button data-open="' + p.id + '"' + (p.status === "published" ? "" : ' class="future" draggable="true" data-pswap="' + p.id + '"') + ' aria-label="' + esc(p.title) + '">' +
        (coverOf(p) ? '<img src="' + esc(coverOf(p)) + '" alt="" draggable="false">' : '<span class="ph">' + esc(p.title) + "</span>") + badge(p) +
        '<span class="lab">' + esc(C.shortDay(p.date)) + (p.status === "published" ? "" : " · " + esc(p.time || "")) + "</span></button>").join("") + "</div></div>";
  }
  // Échange les dates de deux posts à venir (glisser une case de la grille sur une autre).
  A.swapDates = async function (a, b) {
    const pa = S.state.posts.find((p) => p.id === a), pb = S.state.posts.find((p) => p.id === b);
    if (!pa || !pb || a === b || pa.status === "published" || pb.status === "published") return;
    const d = [pa.date, pa.time]; pa.date = pb.date; pa.time = pb.time; pb.date = d[0]; pb.time = d[1];
    await S.savePosts([pa, pb]);
    U.toast("Dates échangées : " + pa.title + " ↔ " + pb.title); A.render();
  };

  function agenda() {
    const t = today();
    if (!A.day || A.day < A.week || A.day > C.addDays(A.week, 6)) A.day = t >= A.week && t <= C.addDays(A.week, 6) ? t : A.week;
    const days = [...Array(7)].map((_, i) => C.addDays(A.week, i));
    const strip = '<div class="daystrip" role="group" aria-label="Jour">' + days.map((d) => { const x = C.parseYmd(d);
      return '<button data-day-pick="' + d + '" data-day="' + d + '" aria-pressed="' + (d === A.day) + '">' + C.DAYS[x.getDay()].slice(0, 3) + "<b>" + x.getDate() + "</b></button>"; }).join("") + "</div>";
    const items = top().filter((p) => p.date === A.day && calVis(p)).sort((a, b) => a.time.localeCompare(b.time));
    return strip + '<div class="agenda"><div class="day"><h2 class="day-h">' + esc(C.longDate(A.day)) + "</h2>" +
      '<div class="todo">' + (items.map((p) => '<div class="arow"><span class="atime">' + p.time + "</span>" + card(p, { kids: kidsOf(p.id), draggable: p.status !== "published" }) + "</div>").join("") || '<div class="empty">Rien ce jour-là.</div>') + "</div></div></div>";
  }

  // ---------------------------------------------------------------- Contenus
  // Colonne du Kanban d'un contenu.
  A.stageOf = (p) => C.step(p);
  function kcard(p, k) {
    const L = U.look(p);
    const locked = k === "published" || k === "scheduled";
    const dots = [["Texte", !!(p.caption || p.note)], ["Média", (p.media || []).length > 0], ["Validé", !!p.captionValidated]];
    const opts = C.STEPS.filter(([s]) => s !== "published" && s !== k).map(([s, l]) => '<option value="' + s + '">' + esc(l) + "</option>").join("");
    return '<div class="kc pc ' + L.cls + (locked ? " locked" : "") + '" data-open="' + esc(p.id) + '"' + (locked ? "" : ' data-kdrag="' + esc(p.id) + '"') + '>' + U.abar(p) +
      '<span class="row1">' + (p.thumb ? '<img class="thumb" src="' + safeUrl(p.thumb) + '" alt="" draggable="false">' : "") + brands(p.networks) +
      '<span class="fmt muted">' + esc(C.FORMATS[p.format] || "") + (p.date ? " · " + esc(C.shortDay(p.date)) + " " + (p.time || "") : "") + "</span>" + (L.hand ? '<span class="hand" title="À poster à la main">' + icon("hand") + "</span>" : "") + (locked ? '<span class="lk2" title="Verrouillé">' + icon("lock") + "</span>" : "") + "</span>" +
      '<button type="button" class="ttl kopen" data-open="' + esc(p.id) + '">' + esc(p.title) + "</button>" +
      '<span class="krow"><span class="kreq">' + dots.map(([l, ok]) => '<span class="' + (ok ? "ok" : "") + '" title="' + (ok ? l + " : fait" : l + " : pas encore") + '">' + icon(ok ? "check" : "dot") + l + "</span>").join("") + "</span>" +
      (!locked ? '<label class="kmove" title="Changer d\'étape">' + icon("swap") + '<select data-kmove="' + esc(p.id) + '" aria-label="Déplacer vers"><option value="">Déplacer vers…</option>' + opts + "</select></label>" : "") + "</span></div>";
  }

  A.views.contents = function () {
    const tools = '<div class="seg" role="group" aria-label="Affichage">' + [["board", "Tableau"], ["list", "Liste"], ["media", "Médias"]].map(([k, l]) =>
      '<button data-cmode="' + k + '" aria-pressed="' + (A.contentsMode === k) + '">' + l + "</button>").join("") + '</div><span class="grow"></span><button class="btn" data-best>' + icon("undo") + '<span class="lbl">Recycler le meilleur</span></button><button class="btn primary" data-new aria-label="Nouveau post">' + icon("plus") + '<span class="lbl">Nouveau post</span></button>';
    const all = top().filter(shown);
    let html;
    if (!A.contentsMode) A.contentsMode = A.isMobile() ? "list" : "board";
    if (A.contentsMode === "media") html = mediaLib();
    else if (A.contentsMode === "board") {
      const t = today();
      const fmts = [...new Set(all.map((p) => p.format))];
      const fOk = (p) => !A.kFormat || p.format === A.kFormat;
      const items0 = all.filter(fOk);
      html = (fmts.length > 1 ? '<div class="kfilters"><span class="muted">Format</span><div class="seg small-seg">' + [["", "Tous"]].concat(fmts.map((f) => [f, C.FORMATS[f] || f])).map(([k, l]) => '<button data-kformat="' + k + '" aria-pressed="' + ((A.kFormat || "") === k) + '">' + esc(l) + "</button>").join("") + "</div>" +
        '<span class="muted kh">Glisse une carte vers une autre colonne' + (A.isMobile() ? " (ou utilise ⇄)" : "") + ". Programmé et Publié sont verrouillés.</span></div>" : "") +
        '<div class="board fit kanban k5">' + C.STEPS.map(([k, l]) => {
        let items = items0.filter((p) => A.stageOf(p) === k);
        items = k === "published" ? items.sort((a, b) => (C.at(b) || "").localeCompare(C.at(a) || "")) : items.sort((a, b) => (C.at(a) || "z").localeCompare(C.at(b) || "z"));
        // Publié : seulement les 7 derniers jours (le reste dans la Liste, période « Passés »).
        const max = k === "published" ? Math.max(1, items.filter((p) => !p.date || p.date >= C.addDays(t, -7)).length) : 40;
        const lock = k === "scheduled" || k === "published";
        return '<section class="col' + (items.length || A.kAdd === k ? "" : " empty") + (lock ? " locked" : "") + '" data-stage="' + k + '"><h2 class="colh"><span>' + (lock ? icon("lock") : "") + l + '</span><span class="muted">' + items.length + "</span>" +
          (k !== "published" && k !== "scheduled" ? '<button class="iconbtn kadd" data-kadd="' + k + '" aria-label="Ajouter une carte dans ' + esc(l) + '">' + icon("plus") + "</button>" : "") + "</h2>" +
          (A.kAdd === k ? '<form class="knew" data-knew="' + k + '"><input name="t" placeholder="Titre de l\'idée ou du contenu" autocomplete="off" required><div class="acts"><button class="btn primary">Ajouter</button><button class="btn" type="button" data-kadd="">Annuler</button></div></form>' : "") +
          items.slice(0, max).map((p) => kcard(p, k)).join("") +
          (items.length > max ? (k === "published" ? '<button class="btn quiet" data-cmode="list" data-listper="past">Plus ancien (' + (items.length - max) + ")</button>" : '<p class="muted">+ ' + (items.length - max) + "</p>") : "") + "</section>";
      }).join("") + "</div>";
    } else {
      // Liste : une ligne par sujet, datée, avec chaque publication (réseau, format, statut). Filtre par période, tri par date.
      const t = today(), now = C.nowStamp();
      const per = A.listPer || "next", asc = per !== "past";
      const byRef = {};
      all.forEach((p) => { const k = p.ref || p.id; (byRef[k] = byRef[k] || []).push(p); });
      let rows = Object.values(byRef).map((ps) => { ps.sort((a, b) => (C.at(a) || "z").localeCompare(C.at(b) || "z")); return { ps, at: C.at(ps[0]) || "", d: ps[0].date }; });
      rows = rows.filter((r) => per === "all" || (per === "next" ? !r.d || r.d >= t : r.d && r.d < t));
      rows.sort((a, b) => (asc ? 1 : -1) * ((a.at || "9999").localeCompare(b.at || "9999")));
      const segP = '<div class="seg small-seg" role="group" aria-label="Période">' + [["next", "À venir"], ["past", "Passés"], ["all", "Tout"]].map(([k, l]) => '<button data-listper="' + k + '" aria-pressed="' + (per === k) + '">' + l + "</button>").join("") + "</div>";
      html = '<div class="listbar">' + segP + '<span class="muted">' + rows.length + " sujet" + (rows.length > 1 ? "s" : "") + " · tri " + (asc ? "du plus proche" : "du plus récent") + "</span></div>" +
        (A.sel && A.sel.size ? bulkBar() : "") +
        (rows.length ? '<div class="tablewrap"><table class="list"><thead><tr><th class="lsel"><input type="checkbox" data-selall aria-label="Tout sélectionner"' + (rows.length && rows.every((r) => r.ps.every((p) => A.sel && A.sel.has(p.id))) ? " checked" : "") + "></th><th>Date</th><th>Sujet</th><th>Publications</th></tr></thead><tbody>" +
        rows.map((r) => { const p0 = r.ps[0];
          const on = r.ps.every((p) => A.sel && A.sel.has(p.id));
          return '<tr class="clk' + (on ? " sel" : "") + '" data-open="' + p0.id + '"><td class="lsel"><input type="checkbox" data-sel="' + esc(r.ps.map((p) => p.id).join(",")) + '" aria-label="Sélectionner"' + (on ? " checked" : "") + '></td><td class="ld">' + (p0.date ? '<b>' + esc(C.shortDay(p0.date)) + '</b><span class="mono">' + (p0.time || "") + "</span>" : '<span class="muted">Sans date</span>') + "</td>" +
            '<td><span class="mono muted">' + esc(p0.ref || "") + "</span> " + esc(p0.title.replace(/ \(carrousel\)$/, "")) + (p0.category ? '<span class="lcat">' + esc(p0.category) + "</span>" : "") + "</td>" +
            '<td><div class="lpubs">' + r.ps.map((p) => '<span class="lpub" data-open="' + p.id + '">' + brands(p.networks) + '<span class="lfmt">' + esc(C.FORMATS[p.format] || "") + (p.date && p.date !== p0.date ? " · " + esc(C.shortDay(p.date)) : "") + (p.time && p !== p0 ? " " + p.time : "") + "</span>" + U.badge(p, now) + (C.alertOf(p, now) ? status(C.alertOf(p, now)) : "") + "</span>").join("") + "</div></td></tr>";
        }).join("") + "</tbody></table></div>" : '<div class="empty" data-fx="loupe">Rien ici.</div>');
    }
    if (A.contentsMode !== "media") html = fbar() + html;
    return { title: "Contenus", tools, html };
  };

  // Médiathèque : tous les médias des posts, pour retrouver ou réutiliser un fichier.
  function mediaLib() {
    const kind = A.mKind || "", q = (A.mQ || "").toLowerCase();
    const isVid = (m) => m.type === "video" || /\.(mp4|mov|webm)(\?|$)/i.test(m.name || m.url || "");
    const thumbOf = (m) => { const id = (/drive\.google\.com\/.*(?:id=|\/d\/)([\w-]{20,})/.exec(m.url || "") || [])[1]; return id ? "https://drive.google.com/thumbnail?id=" + id + "&sz=w400" : m.url; };
    const seen = new Map();
    posts().slice().sort((a, b) => (C.at(b) || "").localeCompare(C.at(a) || "")).forEach((p) => (p.media || []).forEach((m, i) => {
      if (m.role === "guide") return;
      const key = m.url || (p.folder || "") + "/" + m.name;
      if (!seen.has(key)) seen.set(key, { m, p, i, uses: 0 });
      seen.get(key).uses++;
    }));
    let items = [...seen.values()].filter((x) => (!kind || (kind === "video" ? isVid(x.m) : !isVid(x.m))) && (!q || (x.m.name + " " + x.p.title + " " + (x.m.alt || "")).toLowerCase().includes(q)));
    const total = items.length; items = items.slice(0, 120);
    const seg = '<div class="seg small-seg" role="group" aria-label="Type">' + [["", "Tout"], ["image", "Images"], ["video", "Vidéos"]].map(([k, l]) => '<button data-mkind="' + k + '" aria-pressed="' + (kind === k) + '">' + l + "</button>").join("") + "</div>";
    const card = (x) => { const m = x.m, v = isVid(m), u = /^https?:/.test(m.url || "") ? thumbOf(m) : "";
      return '<div class="mcard"><button class="mthumb" data-open="' + esc(x.p.id) + '" aria-label="Ouvrir le post ' + esc(x.p.title) + '">' + (v ? (x.p.thumb ? '<img src="' + esc(x.p.thumb) + '" alt="" loading="lazy">' : "") + '<span class="mvid">' + icon("film") + "</span>" : u ? '<img src="' + esc(u) + '" alt="' + esc(m.alt || "") + '" loading="lazy">' : '<span class="mnone">' + icon("image") + "</span>") + "</button>" +
        '<div class="mmeta"><b title="' + esc(m.name || "") + '">' + esc(m.name || "Média") + '</b><span class="muted">' + esc(x.p.title) + (x.uses > 1 ? " · " + x.uses + " posts" : "") + '</span></div><button class="btn quiet sm" data-reuse="' + esc(x.p.id) + ":" + x.i + '">' + icon("plus") + "Réutiliser</button></div>"; };
    return '<div class="listbar">' + seg + '<label class="lsearch">' + icon("search") + '<input type="search" data-mq placeholder="Nom du fichier, post…" value="' + esc(A.mQ || "") + '" aria-label="Chercher un média"></label><span class="muted">' + total + " média" + (total > 1 ? "s" : "") + "</span></div>" +
      (items.length ? '<div class="mgrid">' + items.map(card).join("") + "</div>" + (total > items.length ? '<p class="muted">Les ' + items.length + " plus récents. Affine la recherche pour voir les autres.</p>" : "") : '<div class="empty">' + (q || kind ? "Aucun média ne correspond." : "Aucun média. Ajoute des photos ou des vidéos aux posts (Aujourd\'hui › Ajouter une photo).") + "</div>");
  }

  // Barre d'actions de la sélection multiple (Contenus › Liste).
  function bulkBar() {
    const n = A.sel.size, nets = A.nets();
    return '<div class="bulkbar" role="toolbar" aria-label="Actions sur la sélection"><b>' + n + (n > 1 ? " sélectionnés" : " sélectionné") + "</b>" +
      '<span class="bk-grp"><label class="sr" for="bk-days">Décaler de</label><input id="bk-days" type="number" value="7" step="1" style="width:5em" aria-label="Nombre de jours"><button class="btn" data-bulk="shift">' + icon("calendar") + "Décaler (jours)</button></span>" +
      '<span class="bk-grp"><select id="bk-net" aria-label="Réseau">' + nets.map((x) => '<option value="' + x + '">' + esc((window.BRANDS[x] || { title: x }).title) + "</option>").join("") + '</select><button class="btn" data-bulk="addnet">' + icon("plus") + 'Ajouter</button><button class="btn" data-bulk="delnet">Retirer</button></span>' +
      '<button class="btn" data-bulk="validate">' + icon("check") + "Valider</button>" +
      '<button class="btn danger" data-bulk="delete">' + icon("trash") + "Supprimer</button>" +
      '<button class="btn quiet" data-bulk="clear">Désélectionner</button></div>';
  }

  // ---------------------------------------------------------------- Activité
  // Voyant de la barre latérale : mêmes comptes que « À faire » (échecs, retards, manqués) + état des comptes.
  A.health = function () {
    const acc = S.state.accounts || {};
    const td = A.todoList();
    const bad = Object.values(acc).filter((a) => a.status === "error").length + td.failed.length;
    const late = td.late.length + td.missed.length;
    const warn = Object.values(acc).filter((a) => a.status === "warn").length;
    if (bad) return { cls: "bad", text: bad + " problème" + (bad > 1 ? "s" : "") + " à régler" };
    if (late) return { cls: "warn", text: late + " post" + (late > 1 ? "s" : "") + " en retard" };
    if (warn) return { cls: "warn", text: "À surveiller" };
    return { cls: "", text: "Tout fonctionne" };
  };

  // ---------------------------------------------------------------- Stats
  const statKey = (url) => {
    const u = String(url || "");
    let m = /instagram\.com\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/([\w-]+)/.exec(u); if (m) return "ig:" + m[1];
    m = /facebook\.com\/.*?(\d{8,})/.exec(u); if (m) return "fb:" + m[1];
    m = /(?:youtube\.com\/(?:shorts\/|watch\?v=)|youtu\.be\/)([\w-]{6,})/.exec(u); return m ? "yt:" + m[1] : "";
  };
  // Chiffres d'une publication, par réseau : par l'adresse, sinon par l'heure (la plus proche, à 1 h près).
  A.postStats = function (p) {
    const st = S.state.stats || (S.mode === "demo" ? (A._demoSt = A._demoSt || A.demoStats()) : null);
    if (!st || p.status !== "published") return null;
    const out = {};
    for (const n of ["instagram", "facebook", "youtube"]) {
      const list = (st[n] && st[n].media) || [];
      if (!list.length || !(p.networks || []).includes(n)) continue;
      const r = (p.results || {})[n] || {};
      const k = statKey(r.url || (n === "instagram" ? p.url : ""));
      let hit = k && list.find((x) => x.key === k);
      if (!hit && p.date && p.time && p.format !== "story") {
        const t = C.parseYmd(p.date).getTime() + C.toMin(p.time) * 6e4;
        const taken = new Set(posts().filter((q) => q.id !== p.id && q.results && q.results[n] && q.results[n].url).map((q) => statKey(q.results[n].url)));
        hit = list.filter((x) => x.at && !taken.has(x.key)).map((x) => [Math.abs(new Date(x.at).getTime() - t), x]).filter(([d]) => d < 60 * 6e4).sort((a, b) => a[0] - b[0]).map(([, x]) => x)[0];
      }
      if (hit) out[n] = hit;
    }
    return Object.keys(out).length ? out : null;
  };
  const fmtN = (n) => (n == null ? "—" : n >= 10000 ? (n / 1000).toFixed(n >= 1e5 ? 0 : 1).replace(".", ",") + " k" : String(n));
  A.agoText = (iso) => agoText(iso);
  function agoText(iso) {
    if (!iso) return "jamais";
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 6e4);
    if (m < 2) return "à l'instant";
    const [n, u] = m < 60 ? [m, "minute"] : m < 1440 ? [Math.round(m / 60), "hour"] : [Math.round(m / 1440), "day"];
    try { return new Intl.RelativeTimeFormat((window.I18N && I18N.lang) || "fr", { style: "short" }).format(-n, u); } // « il y a 5 min », « 5 min ago »
    catch (e) { return "il y a " + n + " " + ({ minute: "min", hour: "h", day: "j" })[u]; }
  }
  // Petite courbe d'une seule série (une échelle), avec info-bulle sur chaque point.
  function spark(points, label) {
    const pts = points.filter((x) => x.v != null);
    if (pts.length < 2) return '<p class="muted small">La courbe apparaîtra après quelques jours de relevés.</p>';
    const W = 560, H = 120, P = 6;
    const vs = pts.map((x) => x.v), lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
    const X = (i) => P + (i * (W - 2 * P)) / (pts.length - 1), Y = (v) => H - P - ((v - lo) / span) * (H - 2 * P - 14);
    const d = pts.map((x, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(x.v).toFixed(1)).join(" ");
    return '<svg class="spark" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" role="img" aria-label="' + esc(label + " : de " + lo + " à " + hi) + '">' +
      '<line x1="0" x2="' + W + '" y1="' + (H - P) + '" y2="' + (H - P) + '" class="base"/><path d="' + d + '" class="ln"/>' +
      pts.map((x, i) => '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(x.v).toFixed(1) + '" r="' + (i === pts.length - 1 ? 4 : 2.5) + '"><title>' + esc(C.shortDay(x.d) + " : " + x.v) + "</title></circle>").join("") +
      "</svg>" + '<div class="spark-ax"><span>' + esc(C.shortDay(pts[0].d)) + "</span><span>" + esc(C.shortDay(pts[pts.length - 1].d)) + "</span></div>";
  }
  // ---------------------------------------------------------------- Bilan du mois
  A.reportData = function (month) {
    const st = S.state.stats || (S.mode === "demo" ? A.demoStats() : {}) || {};
    const first = month + "-01", last = C.ymd(new Date(+month.slice(0, 4), +month.slice(5, 7), 0));
    const inM = (d) => d && d >= first && d <= last;
    const pub = posts().filter((p) => !p.parent && p.status === "published" && inM(p.date));
    const byNet = {}; pub.forEach((p) => (p.networks || []).forEach((n) => { byNet[n] = (byNet[n] || 0) + 1; }));
    const byFmt = {}; pub.forEach((p) => { byFmt[p.format] = (byFmt[p.format] || 0) + 1; });
    const hist = (st.history || []).filter((h) => inM(h.d));
    const gain = (k) => { const h = hist.filter((x) => x[k] != null); return h.length > 1 ? h[h.length - 1][k] - h[0][k] : null; };
    const media = [].concat((st.instagram || {}).media || [], (st.facebook || {}).media || []).filter((m) => m.at && inM(m.at.slice(0, 10)));
    const sum = (k) => media.reduce((a, m) => a + (m[k] || 0), 0);
    const best = pub.map((p) => { const s = A.postStats(p); const v = s ? Object.values(s) : []; return { p, views: v.reduce((a, m) => a + (m.views || 0), 0), likes: v.reduce((a, m) => a + (m.likes || 0), 0), comments: v.reduce((a, m) => a + (m.comments || 0), 0) }; })
      .filter((x) => x.views || x.likes).sort((a, b) => b.views - a.views || b.likes - a.likes).slice(0, 5);
    const days = new Set(pub.map((p) => p.date)).size, nDays = +last.slice(8);
    return { first, last, pub, byNet, byFmt, igGain: gain("ig"), fbGain: gain("fb"), igFollowers: hist.length ? hist[hist.length - 1].ig : null, views: media.length ? sum("views") : null, likes: sum("likes"), comments: sum("comments"), best, days, nDays };
  };
  A.views.report = function () {
    const t = today(), def = +t.slice(8) <= 7 ? C.ymd(new Date(+t.slice(0, 4), +t.slice(5, 7) - 2, 1)).slice(0, 7) : t.slice(0, 7);
    const m = /^\d{4}-\d{2}$/.test(A.reportMonth || "") ? A.reportMonth : def;
    const r = A.reportData(m);
    const label = C.MONTHS[+m.slice(5, 7) - 1] + " " + m.slice(0, 4);
    const sign = (v) => (v == null ? "—" : (v > 0 ? "+" : "") + fmtN(v));
    const kpi = (val, lbl) => '<div class="kpi stat"><b>' + val + "</b><span>" + lbl + "</span></div>";
    const nets = Object.entries(r.byNet).sort((a, b) => b[1] - a[1]).map(([n, k]) => '<span class="chip">' + brand(n) + esc((window.BRANDS[n] || { title: n }).title) + " · " + k + "</span>").join(" ");
    const fmts = Object.entries(r.byFmt).sort((a, b) => b[1] - a[1]).map(([f, k]) => esc(C.FORMATS[f] || f) + " " + k).join(" · ");
    const best = r.best.map((x, i) => '<button class="srow" data-open="' + esc(x.p.id) + '"><span class="rk">' + (i + 1) + "</span>" + (x.p.thumb ? '<img src="' + safeUrl(x.p.thumb) + '" alt="">' : '<span class="noimg">' + icon("contents") + "</span>") +
      '<span class="nm"><b>' + esc(x.p.title) + '</b><span class="muted">' + esc(C.FORMATS[x.p.format] || "") + " · " + esc(C.shortDay(x.p.date)) + "</span></span>" +
      '<span class="nums"><span>' + icon("eye") + fmtN(x.views) + "</span><span>" + icon("heart") + fmtN(x.likes) + "</span><span>" + icon("bubble") + fmtN(x.comments) + "</span></span></button>").join("");
    const prev = C.ymd(new Date(+m.slice(0, 4), +m.slice(5, 7) - 2, 1)).slice(0, 7), next = C.ymd(new Date(+m.slice(0, 4), +m.slice(5, 7), 1)).slice(0, 7);
    const tools = '<button class="btn" data-report="' + prev + '" aria-label="Mois précédent">' + icon("left") + "</button><b class=\"rp-m\">" + esc(label) + '</b><button class="btn" data-report="' + next + '" aria-label="Mois suivant"' + (next > t.slice(0, 7) ? " disabled" : "") + ">" + icon("right") + "</button>" +
      '<button class="btn primary" data-report-share="' + m + '">' + icon("send") + '<span class="lbl">Partager en image</span></button>' +
      '<button class="btn" data-report-copy title="Copier le résumé" aria-label="Copier le résumé">' + icon("copy") + '<span class="lbl">Copier le résumé</span></button><button class="btn" data-report-print>' + icon("download") + '<span class="lbl">Imprimer ou PDF</span></button>';
    const html = '<div class="report"><section class="panel"><h2>Bilan · ' + esc(label) + ((settings().workspace || {}).name ? " · " + esc(settings().workspace.name) : "") + "</h2>" +
      '<div class="kpis">' + kpi(r.pub.length, "publications") + kpi(r.days + " / " + r.nDays, "jours avec au moins un post") + kpi(sign(r.igGain), "abonnés Instagram") + kpi(sign(r.fbGain), "abonnés Facebook") + kpi(fmtN(r.views), "vues") + kpi(fmtN(r.likes + r.comments), "likes et commentaires") + "</div>" +
      (nets ? '<p style="margin:12px 0 0">' + nets + "</p>" : "") + (fmts ? '<p class="muted" style="margin:6px 0 0">' + fmts + "</p>" : "") +
      (r.views == null ? '<p class="muted small" style="margin:10px 0 0">Les vues et les abonnés viennent des statistiques relevées chaque matin (Instagram et Facebook connectés).</p>' : "") + "</section>" +
      '<section class="panel"><h2 class="sec-h"><span>Meilleurs posts</span><span>' + r.best.length + "</span></h2>" + (best || '<div class="empty" data-fx="chart">Pas encore de chiffres pour les posts de ce mois.</div>') + "</section></div>";
    return { title: "Bilan du mois", tools, html };
  };
  A.reportText = function () {
    const t = today(), m = A.reportMonth || t.slice(0, 7), r = A.reportData(m);
    const label = C.MONTHS[+m.slice(5, 7) - 1] + " " + m.slice(0, 4);
    const s = (v) => (v == null ? "—" : (v > 0 ? "+" : "") + v);
    return ["Bilan de " + label, r.pub.length + " publications, sur " + r.days + " jours", "Abonnés Instagram : " + s(r.igGain) + " · Facebook : " + s(r.fbGain), "Vues : " + (r.views == null ? "—" : r.views) + " · Likes et commentaires : " + (r.likes + r.comments)]
      .concat(r.best.length ? ["Meilleurs posts :"].concat(r.best.map((x, i) => (i + 1) + ". " + x.p.title + " (" + x.views + " vues)")) : []).join("\n");
  };

  // Stats : tes chiffres, ou les Pépites (comptes suivis).
  const statTabs = () => '<div class="seg" role="group" aria-label="Affichage"><button data-stattab="" aria-pressed="' + !A.statTab + '">Mes chiffres</button><button data-stattab="ach" aria-pressed="' + (A.statTab === "ach") + '">Succès</button><button data-stattab="pep" aria-pressed="' + (A.statTab === "pep") + '">Pépites</button><button data-stattab="mv" aria-pressed="' + (A.statTab === "mv") + '">Ma version</button></div><span class="grow"></span>';
  A.views.stats = function () {
    if (A.statTab === "ach" && A.successHtml) return { title: "Stats", sub: "Tes paliers, à fêter et à partager", tools: statTabs(), html: A.successHtml() };
    if (A.statTab === "mv" && A.versionHtml) return { title: "Stats", sub: "Reprends la recette, pas la vidéo", tools: statTabs(), html: A.versionHtml() };
    if (A.statTab === "pep" && A.pepitesHtml) return { title: "Stats", sub: "Ce qui marche chez les comptes que tu suis", tools: statTabs() + A.pepitesTools(), html: A.pepitesHtml() };
    const v = statsMine();
    v.tools = statTabs() + v.tools;
    return v;
  };
  function statsMine() {
    const st = S.state.stats || (S.mode === "demo" ? A.demoStats() : {}) || {};
    const ig = st.instagram || {}, fb = st.facebook || {};
    const t = today();
    const tools = '<span class="muted">Relevé ' + esc(agoText(st.updated)) + '</span><a class="btn" href="#report" aria-label="Bilan du mois">' + icon("chart") + '<span class="lbl">Bilan du mois</span></a><button class="btn" data-export-csv title="Exporter les publications et leurs chiffres (CSV)">' + icon("download") + '<span class="lbl">CSV</span></button><button class="btn" data-stats-refresh title="Actualiser" aria-label="Actualiser les statistiques">' + icon("undo") + '<span class="lbl">Actualiser</span></button>';
    if (!st.updated) return { title: "Stats", tools, html: '<div class="empty" data-fx="chart">Pas encore de statistiques. Elles sont relevées chaque matin à partir de 7 h pour Instagram et Facebook (comptes connectés dans Réglages › Comptes). Tu peux aussi cliquer sur « Actualiser ».</div>' };

    // Publications de l'app avec leurs chiffres, triées au choix.
    const SORTS = [["views", "Vues"], ["likes", "Likes"], ["comments", "Commentaires"], ["reach", "Portée"], ["date", "Date"]];
    const sortBy = SORTS.some(([k]) => k === A.statSort) ? A.statSort : "views";
    const rows = posts().filter((p) => !p.parent && p.status === "published").map((p) => ({ p, s: A.postStats(p) })).filter((x) => x.s)
      .map((x) => { const a = Object.values(x.s); return Object.assign(x, { likes: a.reduce((n, m) => n + (m.likes || 0), 0), comments: a.reduce((n, m) => n + (m.comments || 0), 0), reach: a.reduce((n, m) => n + (m.reach || 0), 0), views: a.reduce((n, m) => n + (m.views || 0), 0), date: C.at(x.p) }); })
      .sort((a, b) => (sortBy === "date" ? b.date.localeCompare(a.date) : (b[sortBy] - a[sortBy]) || (b.views - a.views) || (b.likes - a.likes)));
    const cell = (x, k, ic, ttl) => '<span title="' + ttl + '"' + (sortBy === k ? ' class="on"' : "") + ">" + icon(ic) + fmtN(x[k] || 0) + "</span>";
    const top = rows.slice(0, 40).map((x, i) => '<button class="srow" data-open="' + esc(x.p.id) + '"><span class="rk">' + (i + 1) + "</span>" +
      (x.p.thumb ? '<img src="' + safeUrl(x.p.thumb) + '" alt="">' : '<span class="noimg">' + icon("contents") + "</span>") +
      '<span class="nm"><b>' + esc(x.p.title) + '</b><span class="muted">' + esc(C.FORMATS[x.p.format] || "") + " · " + esc(C.shortDay(x.p.date)) + " " + brands(Object.keys(x.s)) + "</span></span>" +
      '<span class="nums">' + cell(x, "views", "eye", "Vues") + cell(x, "likes", "heart", "Likes et réactions") + cell(x, "comments", "bubble", "Commentaires") + (sortBy === "reach" ? cell(x, "reach", "today", "Comptes touchés") : "") + "</span></button>").join("");
    // Hashtags qui marchent : vues moyennes des posts qui les utilisent (au moins 2 posts), comparées à la moyenne.
    const tagStats = {}, avgAll = rows.length ? rows.reduce((a, x) => a + x.views, 0) / rows.length : 0;
    rows.forEach((x) => { new Set(((x.p.caption || "") + " " + (x.p.firstComment || "")).match(/#[\p{L}\p{N}_]+/gu) || []).forEach((h) => { const k = h.toLowerCase(); const o = tagStats[k] = tagStats[k] || { tag: h, n: 0, views: 0, likes: 0 }; o.n++; o.views += x.views; o.likes += x.likes; }); });
    const tags = Object.values(tagStats).filter((o) => o.n >= 2).map((o) => Object.assign(o, { avg: o.views / o.n })).sort((a, b) => b.avg - a.avg);
    const tagRow = (o) => { const r = avgAll ? o.avg / avgAll : 1; return '<div class="htrow"><span class="ht">' + esc(o.tag) + '</span><span class="muted">' + o.n + " posts</span><span class=\"htbar\"><i style=\"width:" + Math.min(100, Math.round(r * 50)) + '%"></i></span><b>' + fmtN(Math.round(o.avg)) + '</b><span class="' + (r >= 1.1 ? "up" : r <= 0.9 ? "down" : "muted") + '">' + (r >= 1 ? "+" : "") + Math.round((r - 1) * 100) + " %</span></div>"; };
    const tagBox = tags.length ? '<section class="panel"><h2 class="sec-h"><span>Hashtags qui marchent</span><span>vues moyennes</span></h2><p class="muted small" style="margin:0 0 8px">Pour chaque hashtag utilisé au moins 2 fois : la moyenne des vues des posts qui le contiennent, comparée à ta moyenne (' + fmtN(Math.round(avgAll)) + " vues). C\'est une tendance, pas une preuve : le sujet et l\'heure comptent aussi.</p>" +
      tags.slice(0, 8).map(tagRow).join("") + (tags.length > 8 ? '<details><summary class="muted" style="cursor:pointer;margin-top:6px">Les ' + (tags.length - 8) + " autres</summary>" + tags.slice(8).map(tagRow).join("") + "</details>" : "") + "</section>" : "";
    // À republier : posts d'au moins 45 jours, au-dessus de la moyenne des vues, pas déjà repris.
    const since = C.addDays(t, -45), reposted = new Set(posts().map((p) => p.repostOf).filter(Boolean));
    const again = rows.filter((x) => x.p.date && x.p.date <= since && !reposted.has(x.p.id) && x.views >= avgAll && x.views > 0).sort((a, b) => b.views - a.views).slice(0, 5);
    const againBox = again.length ? '<section class="panel"><h2 class="sec-h"><span>À republier</span><span>' + again.length + '</span></h2><p class="muted small" style="margin:0 0 8px">Des posts qui ont bien marché il y a plus de 45 jours : tes nouveaux abonnés ne les ont sans doute pas vus.</p>' +
      again.map((x) => '<div class="rcrow">' + (x.p.thumb ? '<img src="' + safeUrl(x.p.thumb) + '" alt="">' : '<span class="noimg">' + icon("contents") + "</span>") + '<span class="nm"><b>' + esc(x.p.title) + '</b><span class="muted">' + esc(C.shortDay(x.p.date)) + " · " + fmtN(x.views) + ' vues</span></span><button class="btn" data-recycle="' + esc(x.p.id) + '">' + icon("undo") + "Republier</button></div>").join("") + "</section>" : "";
    const sortSeg = '<div class="seg small-seg" role="group" aria-label="Trier par">' + SORTS.map(([k, l]) => '<button data-stat-sort="' + k + '" aria-pressed="' + (sortBy === k) + '">' + l + "</button>").join("") + "</div>";

    // Le Reel le plus vu (parmi tous les Reels relevés sur Instagram).
    const reels = (ig.media || []).filter((m) => m.kind === "reel" && m.views != null).sort((a, b) => b.views - a.views);
    let best = "";
    if (reels[0]) {
      const m = reels[0];
      const bp = posts().find((p) => !p.parent && A.postStats(p) && Object.values(A.postStats(p)).includes(m));
      best = '<section class="panel best">' + (bp && bp.thumb ? '<img src="' + safeUrl(bp.thumb) + '" alt="">' : '<span class="noimg">' + icon("film") + "</span>") +
        '<div><h2 class="sec-h"><span>Reel le plus vu</span></h2><b class="bt">' + esc(bp ? bp.title : "Reel du " + C.shortDay(m.at.slice(0, 10))) + "</b>" +
        '<span class="nums"><span>' + icon("eye") + fmtN(m.views) + " vues</span><span>" + icon("heart") + (m.likes || 0) + "</span><span>" + icon("bubble") + (m.comments || 0) + "</span>" + (m.reach ? "<span>" + fmtN(m.reach) + " comptes touchés</span>" : "") + "</span>" +
        '<span class="acts">' + (bp ? '<button class="btn" data-open="' + esc(bp.id) + '">Détails</button>' : "") + '<a class="btn" href="' + safeUrl(m.url) + '" target="_blank" rel="noopener">' + icon("open") + "Voir sur Instagram</a></span></div></section>";
    }

    const warn = [ig.error && "Instagram : " + ig.error, (st.youtube || {}).error && "YouTube : " + st.youtube.error, ig.insightsError && "Instagram : la portée n'est pas disponible avec ce jeton (droit « instagram_manage_insights » à ajouter). " + ig.insightsError,
      fb.error && "Facebook : " + fb.error].filter(Boolean);
    const note = fb.mediaError ? '<p class="muted small" style="margin-top:12px">Facebook : seuls les abonnés de la Page sont relevés. Les réactions et commentaires des posts demandent le droit Meta « pages_read_user_content ».</p>' : "";
    return {
      title: "Stats", tools,
      html: (warn.length ? '<div class="banner warn">' + warn.map(esc).join("<br>") + "</div>" : "") +
        A.statCardsHtml(st, t) + best + A.bestTimesHtml() +
        '<div class="statgrid"><section class="panel"><div class="sec-row"><h2 class="sec-h"><span>Publications</span><span>' + rows.length + "</span></h2>" + sortSeg + "</div>" + (top ? top + '<p class="muted small" style="margin:10px 0 0">Un post a bien marché ? Ouvre-le et choisis « Republier » pour le reprogrammer quand tu veux.</p>' : '<div class="empty">Aucune publication reliée pour l\'instant.</div>') + "</section>" + againBox + tagBox + "</div>" + note,
    };
  }

  // Commentaires Instagram : ceux sans réponse d'abord, réponse sur place, proposition de Claude.
  const DEMO_COMMENTS = () => { const p = top().filter((x) => x.status === "published").slice(-3); const at = (h) => new Date(Date.now() - h * 3600e3).toISOString(); return { username: "demo", rewrite: true, comments: [
    { id: "d1", user: "marie.cuisine", text: "Super astuce ! Ça marche aussi avec de la farine de seigle ?", at: at(2), url: p[0] && p[0].url, key: "", post: p[0], replies: [], answered: false },
    { id: "d2", user: "thomas_b", text: "Vous êtes ouverts le dimanche matin ?", at: at(5), post: p[1], replies: [], answered: false },
    { id: "d3", user: "lea.v", text: "Le meilleur croissant du quartier 🥐", at: at(26), post: p[2], replies: [{ text: "Merci Léa, à très vite !", user: "demo", mine: true }], answered: true }] }; };
  function commentsBox() {
    const ig = (S.state.accounts || {}).instagram;
    if (S.mode === "api" && !(ig && ig.status === "ok")) return "";
    if (S.mode === "demo" && !A.comments) A.comments = DEMO_COMMENTS();
    if (S.mode === "api" && !A.comments && !A.commentsLoading) { A.commentsLoading = true; setTimeout(() => A.loadComments(), 0); }
    const data = A.comments, list = data && data.comments ? data.comments : [];
    const open = list.filter((c) => !c.answered), shown = A.cmAll ? list : open;
    const quick = ((settings().templates || {}).replies || []).filter(Boolean);
    const card = (c) => {
      const post = c.post || (c.postId && S.post(c.postId));
      return '<div class="cmt' + (c.answered ? " done" : "") + '"><div class="cm-h"><b data-noi18n>@' + esc(c.user) + '</b><time class="muted">' + esc(String(c.at || "").slice(8, 10) + "/" + String(c.at || "").slice(5, 7) + " " + String(c.at || "").slice(11, 16)) + "</time>" +
        (post ? '<button class="lk muted" data-open="' + esc(post.id) + '">sur « ' + esc(post.title) + " »</button>" : c.url ? '<a class="lk muted" href="' + safeUrl(c.url) + '" target="_blank" rel="noopener">voir la publication</a>' : "") + "</div>" +
        '<p data-noi18n>' + esc(c.text) + "</p>" + (c.replies || []).map((r) => '<p class="cm-rep' + (r.mine ? " mine" : "") + '" data-noi18n><b>@' + esc(r.user || "") + "</b> " + esc(r.text) + "</p>").join("") +
        (c.answered ? "" : '<div class="cm-new"><textarea rows="2" data-cm-text="' + esc(c.id) + '" aria-label="Réponse à @' + esc(c.user) + '" placeholder="Ta réponse…"></textarea><div class="cm-acts">' +
          (quick.length ? '<span class="cm-quick" role="group" aria-label="Réponses rapides">' + quick.map((r, i) => '<button type="button" class="chip sm" data-cm-quick="' + i + '" data-cm-for="' + esc(c.id) + '" title="' + esc(r) + '" data-noi18n>' + esc(r.length > 28 ? r.slice(0, 27) + "…" : r) + "</button>").join("") + "</span>" : "") +
          (data.rewrite ? '<button class="btn quiet sm" data-cm-suggest="' + esc(c.id) + '">' + icon("spark") + "Proposer une réponse</button>" : "") +
          '<button class="btn sm primary" data-cm-reply="' + esc(c.id) + '">' + icon("send") + "Répondre</button></div></div>") + "</div>";
    };
    return '<h2 class="sec-h"><span>Commentaires Instagram' + (open.length ? " · " + open.length + " sans réponse" : "") + '</span><span class="seg" role="group" aria-label="Filtrer les commentaires"><button data-cmall="0" aria-pressed="' + !A.cmAll + '">Sans réponse</button><button data-cmall="1" aria-pressed="' + !!A.cmAll + '">Tous</button></span><button class="iconbtn sm" data-cm-refresh aria-label="Actualiser les commentaires" title="Actualiser">' + icon("activity") + "</button></h2>" +
      (quick.length ? "" : '<p class="muted small" style="margin:0 0 8px"><button type="button" class="lk" data-settab="templates">Prépare des réponses rapides</button> (merci, lien en bio…) pour répondre en un clic.</p>') +
      '<div class="cmts">' + (!data ? '<p class="muted">Chargement des commentaires…</p>' : data.error ? '<p class="muted">' + esc(data.error) + "</p>" : shown.length ? shown.map(card).join("") : '<div class="empty">' + (A.cmAll ? "Aucun commentaire récent." : "Tu as répondu à tout le monde.") + "</div>") + "</div>";
  }

  A.views.activity = function () {
    const acc = S.state.accounts || {};
    const all = [].concat(window.CONNECTORS.social, window.CONNECTORS.storage, window.CONNECTORS.notify);
    const tiles = Object.entries(acc).map(([id, a]) => {
      const c = all.find((x) => x.id === id) || { name: id };
      const st = a.status === "ok" ? '<span class="st st-published">' + icon("check") + "OK</span>" : a.status === "warn" ? '<span class="st st-manual">' + icon("alert") + "À surveiller</span>" :
        a.status === "manual" ? '<span class="st st-scheduled">' + icon("hand") + "À la main</span>" : '<span class="st st-failed">' + icon("x") + "Problème</span>";
      return '<div class="tile"><div class="tt">' + brand(id) + esc(c.name) + '<span style="margin-left:auto">' + st + "</span></div><p>" + esc(a.account || "") + "</p><p>" + esc(a.detail || "") + "</p></div>";
    }).join("");
    const robot = S.state.robot || { last: null };
    const off = (settings().rules || {}).robotEnabled === false;
    const robotTile = '<div class="tile"><div class="tt">' + icon("clock") + "Robot de publication" + (off ? '<span class="st st-draft" style="margin-left:auto">À l\'arrêt</span>' : S.state.dryRun ? '<span class="st st-manual" style="margin-left:auto">Simulation</span>' : "") + "</div><p>" +
      (S.mode === "demo" ? "En démo, rien n'est envoyé. Une fois installé, il passe toutes les 5 minutes." : robot.last ? "Dernier passage : " + esc(robot.last) : "Pas encore passé.") + "</p>" +
      (off ? "<p>Il ne publie rien pour cet espace (Réglages › Règles).</p>" : S.state.dryRun ? "<p>Il simule les envois tant que DRY_RUN vaut « true ».</p>" : "") + "</div>";
    const filters = [["all", "Tout"], ["error", "Erreurs"], ["ok", "Publications"], ["change", "Changements"]];
    const lines = (S.state.log || []).filter((l) => A.logFilter === "all" || l.level === A.logFilter).slice(0, 200).map((l) => {
      const ic = l.level === "error" ? '<span class="c-failed">' + icon("x") + "</span>" : l.level === "ok" ? '<span class="c-published">' + icon("check") + "</span>" : l.level === "change" ? icon("pen") : icon("bell");
      return '<div class="logl"><span class="when">' + '<time datetime="' + esc(l.at) + '" title="' + esc(l.at.replace("T", " ")) + '">' + esc(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(l.at) ? C.shortDay(l.at.slice(0, 10)) + " " + l.at.slice(11, 16) : l.at) + "</time></span><span class=\"ic\">" + ic + "</span><div>" + esc(l.text) +
        (l.why ? '<div class="why">' + esc(l.why) + "</div>" : "") + (l.postId && S.post(l.postId) ? ' <button class="btn quiet" style="min-height:26px;padding:0 6px" data-open="' + l.postId + '">Voir le post</button>' : "") + "</div></div>";
    }).join("");
    return {
      title: "Activité",
      html: '<h2 class="sec-h"><span>État des connexions</span></h2><div class="tiles">' + robotTile + tiles + "</div>" +
        commentsBox() +
        '<h2 class="sec-h"><span>Journal</span><span class="seg" role="group" aria-label="Filtrer le journal">' + filters.map(([k, l]) => '<button data-logf="' + k + '" aria-pressed="' + (A.logFilter === k) + '">' + l + "</button>").join("") + "</span></h2>" +
        '<div class="log">' + (lines || '<div class="empty" data-fx="scroll">Rien dans le journal.</div>') + "</div>",
    };
  };

  // ---------------------------------------------------------------- Réglages
  A.views.settings = function () {
    const tabs = [["accounts", "Comptes"], ["storage", "Stockage et médias"], ["slots", "Créneaux"], ["templates", "Modèles"], ["auto", "Automatisations"], ["rules", "Règles et contrôles"], ["notify", "Notifications"], ["space", "Espace"]];
    // L'essentiel d'abord, le reste replié sous « Avancé » ; une recherche parcourt toutes les rubriques.
    const ESS = ["accounts", "slots", "rules", "notify"], ADV = ["storage", "templates", "auto", "space"];
    const lab = Object.fromEntries(tabs);
    const btn = (k) => '<button data-settab="' + k + '" aria-current="' + (A.setTab === k && !A.setQ) + '">' + lab[k] + "</button>";
    const nav = '<nav class="subnav" aria-label="Rubriques des réglages"><label class="lsearch setq">' + icon("search") + '<input type="search" data-setq placeholder="Chercher un réglage" value="' + esc(A.setQ || "") + '" aria-label="Chercher un réglage"></label>' +
      '<span class="subnav-h">Essentiel</span>' + ESS.map(btn).join("") + '<span class="subnav-h">Avancé</span>' + ADV.map(btn).join("") + "</nav>";
    let body;
    if (A.setQ && A.setQ.trim()) {
      const q = C.fold(A.setQ), box = document.createElement("div"), hits = [];
      ESS.concat(ADV).forEach((k) => {
        box.innerHTML = SET[k]();
        [...box.querySelectorAll("section.panel")].forEach((sec) => {
          if (C.fold(sec.textContent + " " + lab[k]).includes(q)) hits.push('<p class="set-from muted">' + esc(lab[k]) + "</p>" + sec.outerHTML);
        });
      });
      body = '<p class="muted" style="margin:0 0 10px">' + hits.length + " rubrique" + (hits.length > 1 ? "s" : "") + " pour « " + esc(A.setQ.trim()) + " »</p>" + (hits.join("") || '<div class="empty">Aucun réglage ne correspond.</div>');
    } else body = (SET[A.setTab] || SET.accounts)();
    return { title: "Réglages", html: '<div class="set">' + nav + "<div>" + body + "</div></div>" };
  };

  function accRow(c, a) {
    const st = a.status === "ok" ? '<span class="st st-published">' + icon("check") + "Connecté</span>" : a.status === "manual" ? '<span class="st st-scheduled">' + icon("hand") + "À la main</span>" :
      a.status === "pending" ? '<span class="st st-ready">' + icon("clock") + "À autoriser</span>" :
      a.status === "warn" ? '<span class="st st-manual">' + icon("alert") + "À surveiller</span>" : '<span class="st st-failed">' + icon("x") + "À reconnecter</span>";
    const left = a.expires ? Math.round((C.parseYmd(a.expires) - C.parseYmd(C.nowStamp().slice(0, 10))) / 864e5) : null;
    const exp = left == null ? "" : '<small class="' + (left <= 7 ? "exp-warn" : "muted") + '">' + (left < 0 ? "Jeton expiré : reconnecte le compte" : "Jeton valable jusqu'au " + esc(C.longDate(a.expires)) + (left <= 7 ? " : pense à le renouveler" : "")) + "</small>";
    const dl = a.dataAccess ? Math.round((C.parseYmd(a.dataAccess) - C.parseYmd(C.nowStamp().slice(0, 10))) / 864e5) : null;
    const health = (a.missing && a.missing.length ? '<small class="exp-warn">Droits manquants : <span data-noi18n>' + esc(a.missing.join(", ")) + "</span></small>" : "") +
      (dl != null && dl <= 14 ? '<small class="exp-warn">' + (dl < 0 ? "Accès aux données Meta terminé : reconnecte-toi" : "Accès aux données Meta jusqu'au " + esc(C.longDate(a.dataAccess)) + " : reconnecte-toi pour le prolonger") + "</small>" : "");
    const fix = (a.status === "error" || health || (left != null && left <= 7)) && A.hasWizard && A.hasWizard(c.id === "facebook" ? "instagram" : c.id) ? '<button class="btn primary" data-rewiz="' + (c.id === "facebook" ? "instagram" : c.id) + '">' + icon("undo") + "Reconnecter</button>" : "";
    return '<div class="acc">' + brand(c.logo === undefined ? c.id : c.logo || c.id, "lg") + "<div><b>" + esc(c.name) + "</b><small>" + esc(a.account || "") + (a.detail ? " · " + esc(a.detail) : "") + "</small>" + exp + health + "</div>" +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' + st + fix + '<button class="btn" data-conn="' + c.id + '">Gérer</button></div></div>';
  }
  function connGroup(kind, title, intro) {
    const acc = S.state.accounts || {};
    const list = window.CONNECTORS[kind];
    const on = list.filter((c) => acc[c.id]), off = list.filter((c) => !acc[c.id]);
    return '<section class="panel"><h2>' + title + "</h2><p>" + intro + "</p>" + (on.map((c) => accRow(c, acc[c.id])).join("") || '<div class="empty" data-fx="plug">Aucun compte connecté.</div>') + "</section>" +
      '<section class="panel"><h2>Ajouter</h2><p>Chaque service a sa fiche : ce qu\'il permet, ce qu\'il demande, et le lien vers sa documentation officielle.</p><div class="addlist">' +
      off.map((c) => '<button data-conn="' + c.id + '">' + brand(c.logo === undefined ? c.id : c.logo || c.id, "lg") + esc(c.name) + "</button>").join("") + "</div></section>";
  }
  // Meilleurs horaires d'après les stats : score moyen par heure et par jour de publication.
  // Score d'un post = vues (ou portée), sinon interactions (likes + 3 × commentaires), comparé à la moyenne de son réseau.
  A.bestTimes = function () {
    const st = S.state.stats || (S.mode === "demo" ? (A._demoSt = A._demoSt || A.demoStats()) : null); if (!st) return null;
    const media = [];
    ["instagram", "facebook", "youtube"].forEach((n) => {
      const ms = ((st[n] || {}).media || []).filter((m) => m.at).map((m) => ({ at: m.at, v: m.views != null ? +m.views : m.reach != null ? +m.reach : (+m.likes || 0) + 3 * (+m.comments || 0) }));
      const avg = ms.reduce((a, m) => a + m.v, 0) / (ms.length || 1);
      if (avg > 0) ms.forEach((m) => media.push({ at: m.at, r: m.v / avg }));
    });
    if (media.length < 8) return null;
    const hours = {}, days = {}, grid = {};
    media.forEach((m) => { const d = new Date(m.at), h = d.getHours(), w = (d.getDay() + 6) % 7;
      (hours[h] = hours[h] || []).push(m.r); (days[w] = days[w] || []).push(m.r); (grid[w + "-" + h] = grid[w + "-" + h] || []).push(m.r); });
    const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
    const rank = (o, min) => Object.entries(o).filter(([, v]) => v.length >= min).map(([k, v]) => ({ k: +k, n: v.length, gain: Math.round((mean(v) - 1) * 100) })).sort((a, b) => b.gain - a.gain);
    return { n: media.length, hours: rank(hours, 2), days: rank(days, 2), grid: Object.fromEntries(Object.entries(grid).map(([k, v]) => [k, { n: v.length, r: mean(v) }])) };
  };
  A.bestHours = function () { const b = A.bestTimes(); return b ? b.hours.slice(0, 3).map((x) => ({ h: x.k, n: x.n, gain: x.gain })) : null; };
  // Carte « Quand publier » de la page Stats : jours × heures, plus la case est foncée, mieux tes posts ont marché.
  A.bestTimesHtml = function () {
    const b = A.bestTimes(); if (!b) return "";
    const hs = [...new Set(Object.keys(b.grid).map((k) => +k.split("-")[1]))].sort((x, y) => x - y);
    if (!hs.length) return "";
    const D = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
    const max = Math.max(...Object.values(b.grid).map((c) => c.r));
    const cell = (w, h) => { const c = b.grid[w + "-" + h]; if (!c) return "<td></td>"; const g = Math.round((c.r - 1) * 100);
      return '<td style="--a:' + (0.12 + 0.88 * (c.r / max)).toFixed(2) + '" title="' + D[w] + " " + h + " h : " + (g >= 0 ? "+" : "") + g + " % · " + c.n + " post" + (c.n > 1 ? "s" : "") + '"><span>' + (g >= 0 ? "+" : "") + g + "</span></td>"; };
    const top = b.hours[0], day = b.days[0];
    return '<section class="panel"><h2 class="sec-h"><span>Quand publier</span><span class="muted" style="font-weight:400;font-size:13px">' + b.n + " posts analysés</span></h2>" +
      "<p>" + (top ? "Meilleure heure : <b>" + top.k + " h</b> (" + (top.gain >= 0 ? "+" : "") + top.gain + " % par rapport à ta moyenne)" : "") + (day ? ". Meilleur jour : <b>" + C.DAYS[(day.k + 1) % 7] + "</b> (" + (day.gain >= 0 ? "+" : "") + day.gain + " %)" : "") + ".</p>" +
      '<div class="heat-wrap"><table class="heat"><thead><tr><th><span class="sr">Jour</span></th>' + hs.map((h) => "<th>" + h + " h</th>").join("") + "</tr></thead><tbody>" +
      D.map((d, w) => "<tr><th>" + d + "</th>" + hs.map((h) => cell(w, h)).join("") + "</tr>").join("") + "</tbody></table></div>" +
      '<p class="muted" style="font-size:12px;margin:8px 0 0">Écart par rapport à ta moyenne (vues, sinon portée ou interactions). Une case vide : pas encore de post à ce moment-là.</p></section>';
  };
  function bestSlots() {
    const best = A.bestHours(); if (!best || !best.length) return "";
    const have = new Set(slots().map((s) => s.time.slice(0, 2)));
    return '<section class="panel"><h2>Meilleurs horaires</h2><p>D\'après tes posts récents : les heures où ils marchent le mieux.</p><div class="besth">' +
      best.map((b) => { const hh = String(b.h).padStart(2, "0"); return '<div><b class="mono">' + hh + ':00</b><span class="muted">' + (b.gain > 0 ? "+" + b.gain + " % par rapport à ta moyenne" : "dans la moyenne") + " · " + b.n + " posts</span>" +
        (have.has(hh) ? '<span class="st st-published">' + icon("check") + "Déjà un créneau</span>" : '<button class="btn sm" data-slot-suggest="' + hh + ':00">' + icon("plus") + "Ajouter</button>") + "</div>"; }).join("") + "</div></section>";
  }
  // Cases à cocher des réseaux de l'espace (ensembles, flux).
  function netChecks(attr, picked) {
    return (A.nets()).map((n) => '<label class="chip"><input type="checkbox" ' + attr + ' value="' + n + '"' + ((picked || []).includes(n) ? " checked" : "") + ">" + brand(n) + esc(window.BRANDS[n] ? window.BRANDS[n].title : n) + "</label>").join("");
  }
  // Où vont les fichiers déposés depuis PlanneRs : au choix parmi les stockages connectés qui savent écrire.
  function depositPanel() {
    const acc = S.state.accounts || {}, dv = settings().drive || {}, want = dv.target || "auto", cur = A.depositTarget && A.depositTarget();
    const opts = [["auto", "Automatique" + (want === "auto" && cur ? " (" + cur.label + ")" : "")]].concat((A.WRITERS || []).map(([id, l]) => [id, l + (acc[id] && acc[id].status === "ok" ? "" : " · pas connecté")]));
    return '<section class="panel"><h2>Dossier des dépôts</h2><p>Les vidéos et photos que tu déposes dans PlanneRs (La Fabrique, Aujourd\'hui, partage depuis le téléphone, fenêtre de création) partent dans le stockage de ton choix : Drive, OneDrive, Dropbox, ton NAS ou Nextcloud (WebDAV), ou directement en ligne (R2/S3, GitHub Pages). Tes fichiers restent chez toi.</p><div class="form">' +
      '<label>Stockage<select data-drive-target>' + opts.map(([v, l]) => '<option value="' + v + '"' + (v === want ? " selected" : "") + ">" + esc(l) + "</option>").join("") + "</select></label>" +
      (want !== "auto" && !cur ? '<p class="warnline">' + icon("alert") + "Ce stockage n'est pas connecté : les dépôts sont bloqués. Connecte-le plus bas ou repasse en automatique.</p>" : "") +
      '<label>Dossier<input value="' + esc(dv.inbox || "PlanneRs/depots") + '" data-drive-inbox placeholder="PlanneRs/depots"></label>' +
      '<p class="muted" style="margin:0;font-size:12px">Chemin dans le stockage, utilisé quand le fichier n\'est rattaché à aucun post. 95 Mo au plus par fichier envoyé depuis PlanneRs. Dropbox et OneDrive demandent le droit d\'écriture (voir leurs guides).</p></div></section>';
  }
  const SET = {
    accounts: () => connGroup("social", "Comptes connectés", "Les réseaux sur lesquels PlanneRs publie ou te rappelle de publier."),
    storage: () => {
      const acc = S.state.accounts || {};
      const sto = window.CONNECTORS.storage.find((c) => acc[c.id] && ["gdrive", "dropbox", "onedrive", "webdav"].includes(c.id));
      const pubh = window.CONNECTORS.storage.find((c) => acc[c.id] && ["r2", "ghpages"].includes(c.id));
      const lk = (c, label, fallback) => '<div class="link"><b>' + (c ? brand(c.logo === undefined ? c.id : c.logo || c.id) + esc(c.name) : icon("cloud") + fallback) + "</b><small class=\"muted\">" + label + "</small><div style=\"margin-top:6px\">" +
        (c ? (acc[c.id].status === "ok" ? status("published").replace("Publié", "OK") : '<span class="st st-manual">' + icon("alert") + esc(acc[c.id].detail || "À surveiller") + "</span>") : '<span class="st st-draft">' + icon("plus") + "À relier</span>") + "</div></div>";
      return '<section class="panel"><h2>Chemin des médias</h2><p>Instagram ne lit pas un lien Drive : il lui faut une adresse publique. Voici chaque maillon et son état.</p><div class="chain">' +
        lk(sto, "Là où tu ranges tes fichiers", "Stockage") + '<span class="arrow">' + icon("right") + "</span>" +
        lk(pubh, "Copie publique, le temps de publier", "Hébergement public") + '<span class="arrow">' + icon("right") + "</span>" +
        '<div class="link"><b>' + brands((A.nets()).filter((n) => acc[n] && acc[n].status === "ok")) + " Réseaux</b><small class=\"muted\">Récupèrent le média à l'heure prévue</small></div></div></section>" +
        depositPanel() +
        connGroup("storage", "Stockages connectés", "Tes dossiers de médias et l'hébergement public utilisé au moment de publier.");
    },
    slots: () => bestSlots() + '<section class="panel"><h2>Créneaux types</h2><p>Ils forment les lignes du calendrier. Un post déposé sur un créneau prend son heure.</p><div class="form" id="slots">' +
      slots().map((s, i) => '<div class="slotrow"><input type="time" value="' + s.time + '" data-slot-time="' + i + '" aria-label="Heure"><input value="' + esc(s.label) + '" data-slot-label="' + i + '" aria-label="Nom du créneau"><button class="iconbtn" data-slot-del="' + i + '" aria-label="Supprimer ce créneau">' + icon("trash") + "</button></div>").join("") +
      '<div><button class="btn" data-slot-add>' + icon("plus") + "Ajouter un créneau</button></div></div></section>",
    templates: () => {
      const t = settings().templates || {}, tags = t.tags || [];
      return '<section class="panel"><h2>Signature</h2><p>Le texte que tu ajoutes souvent en fin de légende (appel à l\'action, lien, mention). Un bouton l\'insère dans la légende.</p><div class="form">' +
        '<label>Signature<textarea rows="3" data-tpl-sig placeholder="Ex. : Et toi, tu en penses quoi ? Dis-le en commentaire !">' + esc(t.signature || "") + "</textarea></label></div></section>" +
        '<section class="panel"><h2>Groupes de hashtags</h2><p>Des séries de hashtags prêtes à insérer, par thème.</p><div class="form">' +
        tags.map((g, i) => '<div class="tplgroup"><input value="' + esc(g.name) + '" data-tpl-name="' + i + '" aria-label="Nom du groupe" placeholder="Nom (ex. : Recettes)"><textarea rows="2" data-tpl-text="' + i + '" aria-label="Hashtags du groupe" placeholder="#pain #boulangerie">' + esc(g.text) + '</textarea><button class="iconbtn" data-tpl-del="' + i + '" aria-label="Supprimer ce groupe">' + icon("trash") + "</button></div>").join("") +
        '<div><button class="btn" data-tpl-add>' + icon("plus") + "Ajouter un groupe</button></div></div></section>" +
        '<section class="panel"><h2>Réponses rapides</h2><p>Tes réponses habituelles aux commentaires, une par ligne. Dans Activité, un clic l\'insère dans la réponse ; {nom} est remplacé par le pseudo de la personne.</p><div class="form">' +
        '<label>Réponses<textarea rows="4" data-tpl-replies placeholder="Merci {nom} !&#10;Le lien est dans la bio 😉&#10;Bonne question, on en parle bientôt !">' + esc((t.replies || []).join("\n")) + "</textarea></label></div></section>" +
        '<section class="panel"><h2>Ensembles de réseaux</h2><p>Tes combinaisons habituelles (par exemple « Instagram + Facebook »). Dans un post, un bouton coche l\'ensemble d\'un coup.</p><div class="form">' +
        (t.sets || []).map((g, i) => '<div class="setrow"><input value="' + esc(g.name) + '" data-set-name="' + i + '" aria-label="Nom de l\'ensemble" placeholder="Nom (ex. : Partout)"><div class="filters">' + netChecks("data-set-net=\"" + i + "\"", g.networks) + '</div><button class="iconbtn" data-set-del="' + i + '" aria-label="Supprimer cet ensemble">' + icon("trash") + "</button></div>").join("") +
        '<div><button class="btn" data-set-add>' + icon("plus") + "Ajouter un ensemble</button></div></div></section>" +
        '<section class="panel"><h2>Liens suivis</h2><p>Pour savoir, dans les statistiques de ton site, ce que rapporte chaque réseau : au moment d\'envoyer, PlanneRs ajoute aux liens vers ton site les paramètres utm_source (le réseau), utm_medium et utm_campaign (le titre du post). Tes légendes ne changent pas.</p><div class="form">' +
        '<label>Tes sites (un domaine par ligne)<textarea rows="2" data-utm-domains placeholder="exemple.fr">' + esc(((settings().utm || {}).domains || []).join("\n")) + "</textarea></label>" +
        '<p class="muted" style="margin:0;font-size:12px">Vide : aucun lien n\'est modifié. Exemple : exemple.fr/recette devient exemple.fr/recette?utm_source=instagram&amp;utm_medium=social&amp;utm_campaign=pain-au-levain.</p></div></section>';
    },
    auto: () => {
      const au = settings().auto || {}, demo = S.mode === "demo";
      return '<section class="panel"><h2>Reprendre un flux RSS</h2><p>Chaque nouvel article de ton blog ou de ton site devient un post à relire, avec son titre, son lien et son image. Il arrive dans « Prêts à programmer » : rien ne part sans ta validation. Le flux est relu toutes les heures.</p><div class="form">' +
        (au.feeds || []).map((f, i) => '<div class="setrow"><input type="url" value="' + esc(f.url || "") + '" data-feed-url="' + i + '" aria-label="Adresse du flux" placeholder="https://exemple.fr/feed"><div class="filters">' + netChecks("data-feed-net=\"" + i + "\"", f.networks) + '</div><button class="iconbtn" data-feed-del="' + i + '" aria-label="Supprimer ce flux">' + icon("trash") + "</button></div>").join("") +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-feed-add>' + icon("plus") + "Ajouter un flux</button>" + ((au.feeds || []).length ? '<button class="btn quiet" data-feed-run>' + icon("swap") + "Relire maintenant</button>" : "") + "</div>" +
        '<p class="muted" style="margin:0;font-size:12px">' + (demo ? "En démo, les flux sont enregistrés mais pas relus : il faut PlanneRs installé sur ton serveur. " : "") + "À l'ajout d'un flux, les articles déjà en ligne ne sont pas repris : seuls les suivants le seront. Sans réseau coché, le post prend ton premier réseau.</p></div></section>" +
        '<section class="panel"><h2>Après la publication</h2><p>Quand un post dépasse un nombre de likes, PlanneRs ajoute un commentaire sous ce post (un lien, une question, une offre). Une seule fois par post, vérifié chaque jour avec les statistiques, sur les posts des 14 derniers jours.</p><div class="form">' +
        (au.plugs || []).map((r, i) => '<div class="plugrow"><select data-plug-net="' + i + '" aria-label="Réseau"><option value="instagram"' + (r.net !== "facebook" ? " selected" : "") + '>Instagram</option><option value="facebook"' + (r.net === "facebook" ? " selected" : "") + '>Facebook</option></select>' +
          '<label class="plugn">à partir de<input type="number" min="1" value="' + (+r.threshold || 100) + '" data-plug-n="' + i + '" aria-label="Nombre de likes"><span>likes</span></label>' +
          '<textarea rows="2" data-plug-text="' + i + '" aria-label="Commentaire à ajouter" placeholder="Ex. : La recette complète est ici : https://exemple.fr/recette">' + esc(r.comment || "") + '</textarea><button class="iconbtn" data-plug-del="' + i + '" aria-label="Supprimer cette règle">' + icon("trash") + "</button></div>").join("") +
        '<div><button class="btn" data-plug-add>' + icon("plus") + "Ajouter une règle</button></div>" +
        '<p class="muted" style="margin:0;font-size:12px">' + ((settings().rules || {}).robotEnabled === false ? "Le robot est à l'arrêt (Règles et contrôles) : aucune action automatique ne part. " : "") + (S.state.dryRun !== false && !demo ? "Robot en simulation : les commentaires sont seulement notés dans le journal. " : "") + "Une règle sans texte ne fait rien.</p></div></section>" +
        '<section class="panel"><h2>Brancher un autre outil</h2><p>n8n, Make, Zapier ou un script peuvent lire ton planning et créer des posts, qui attendent toujours ta validation. Dans l\'autre sens, le webhook (Notifications) prévient ton outil d\'un rappel ou d\'un échec.</p>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn" href="' + docsBase() + 'reference/api.md" target="_blank" rel="noopener">' + icon("right") + "Lire le guide de l'API</a></div></section>";
    },
    rules: () => {
      const r = settings().rules || {};
      return '<section class="panel"><h2>Règles d\'envoi</h2><p>Elles s\'appliquent à tous les posts de cet espace.</p><div class="form">' +
        '<label class="toggle"><input type="checkbox" data-rule="robotEnabled"' + (r.robotEnabled !== false ? " checked" : "") + "> Robot de publication en marche (décoche si un autre outil publie encore à sa place)</label>" +
        '<div><p style="margin:0 0 6px"><b>À poster à la main</b> : les réseaux sans connexion automatique (ou à l\'API payante). Le robot ne les envoie jamais ; à l\'heure prévue, tu reçois un rappel et la fiche « Poster à la main » prépare le texte (déjà écrit pour X, LinkedIn, Threads et Bluesky).</p><div class="filters">' + netChecks('data-rule-mnet=""', r.manualNets || []) + "</div></div>" +
        (r.robotEnabled === false ? '<div><p class="muted" style="margin:0 0 6px">Robot à l\'arrêt : envoyer quand même automatiquement vers ces réseaux (les autres restent à l\'outil qui publie à sa place).</p><div class="filters">' + netChecks('data-rule-net=""', r.robotNets || []) + "</div></div>" : "") +
        '<label class="toggle"><input type="checkbox" data-rule="requireValidation"' + (r.requireValidation !== false ? " checked" : "") + "> Ne rien envoyer sans légende validée</label>" +
        '<label class="toggle"><input type="checkbox" data-rule="confirmMoves"' + (r.confirmMoves !== false ? " checked" : "") + "> Demander une confirmation avant de déplacer un contenu (calendrier et Contenus)</label>" +
        '<label class="toggle"><input type="checkbox" data-rule="noRetryRelay"' + (r.noRetryRelay ? " checked" : "") + "> Ne pas relancer un relais si le réseau principal a déjà publié (évite les doublons)</label>" +
        '<label>Nombre maximal de hashtags (0 = pas de limite)<input type="number" min="0" max="30" value="' + (r.maxHashtags || 0) + '" data-rule-num="maxHashtags"></label></div></section>' +
        '<section class="panel"><h2>Contrôles personnalisés</h2><p>Un rappel s\'affiche si la légende ne contient pas le texte indiqué (par exemple une mention ou un crédit).</p><div class="form">' +
        (settings().customChecks || []).map((c, i) => '<div class="slotrow" style="grid-template-columns:1fr 1fr auto"><input value="' + esc(c.label) + '" data-chk-label="' + i + '" aria-label="Message"><input value="' + esc(c.contains) + '" data-chk-text="' + i + '" aria-label="Texte attendu"><button class="iconbtn" data-chk-del="' + i + '" aria-label="Supprimer">' + icon("trash") + "</button></div>").join("") +
        '<div><button class="btn" data-chk-add>' + icon("plus") + "Ajouter un contrôle</button></div></div></section>";
    },
    notify: () => {
      const n = settings().notify || {};
      return '<section class="panel"><h2>Quand te prévenir</h2><div class="form">' +
        '<label>Rappel avant un post à la main (minutes)<input type="number" min="0" value="' + (n.manualReminderMinutes || 0) + '" data-notify-num="manualReminderMinutes"></label>' +
        '<label class="toggle"><input type="checkbox" data-notify="onFailure"' + (n.onFailure ? " checked" : "") + "> Prévenir tout de suite en cas d'échec</label>" +
        '<label class="toggle"><input type="checkbox" data-notify="digest"' + (n.digest !== false ? " checked" : "") + "> Résumé du matin : légendes à valider, posts à la main, échecs, jetons qui expirent</label>" +
        '<label>Heure du résumé<input type="time" value="' + esc(n.digestTime || "08:00") + '" data-notify-time="digestTime"></label>' +
        '<p class="muted" style="margin:0;font-size:12px">Rien à signaler, pas de message. Chaque matin, PlanneRs vérifie aussi que tes comptes sont toujours connectés.</p>' +
        '<label class="toggle"><input type="checkbox" data-notify="weekly"' + (n.weekly !== false ? " checked" : "") + "> Bilan du dimanche soir : ce qui a marché, ce qui est prévu, les jours vides</label>" +
        '<label>Heure du bilan (le dimanche)<input type="time" value="' + esc(n.weeklyTime || "19:00") + '" data-notify-time="weeklyTime"></label>' +
        '<div><button class="btn quiet" data-weekly-preview>' + icon("eye") + 'Voir le bilan de cette semaine</button></div><pre class="wkprev" id="wk-prev" hidden></pre></div></section>' +
        '<section class="panel"><h2>Dans ton agenda</h2><p>Un lien à ajouter dans Google Agenda, Outlook ou Apple Calendrier : tes posts prévus s\'affichent à côté de tes rendez-vous, avec un rappel 15 minutes avant ceux à poster à la main.</p>' +
        (S.mode === "demo" ? '<p class="muted" style="margin:0">Disponible une fois PlanneRs installé sur ton serveur.</p>' : '<div id="ical-box"><p class="muted" style="margin:0">Chargement…</p></div>') + "</section>" +
        connGroup("notify", "Canaux de notification", "Où recevoir les rappels et les alertes.");
    },
    space: () => '<section class="panel"><h2>Espace</h2><p>Un espace regroupe des comptes, des réglages et un planning.</p><div class="form">' +
      '<label>Nom de l\'espace<input value="' + esc(settings().workspace.name) + '" data-ws-name></label>' +
      '<label>Langue · Language<select data-lang><option value="fr"' + (window.I18N && I18N.lang === "fr" ? " selected" : "") + '>Français</option><option value="en"' + (window.I18N && I18N.lang === "en" ? " selected" : "") + ">English</option></select></label>" +
      '<div class="accent-pick"><span class="lbl">Couleur de l\'appli</span><div class="swatches" role="group" aria-label="Couleur de l\'appli">' +
        U.ACCENTS.map(([hex, name]) => '<button type="button" class="sw' + (hex ? "" : " sw-def") + '" data-accent="' + hex + '" aria-pressed="' + ((settings().accent || "") === hex) + '" title="' + esc(name) + '" style="--sw:' + (hex || "var(--ink)") + '"><span class="sr">' + esc(name) + "</span></button>").join("") +
        '<label class="sw sw-custom" title="Autre couleur"><input type="color" value="' + esc(settings().accent || "#7C4DEB") + '" data-accent-custom aria-label="Autre couleur"></label></div>' +
        '<small class="muted">Les boutons principaux prennent cette couleur. Prends celle de ta marque.</small></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-export>' + icon("download") + "Exporter (JSON)</button>" +
      '<label class="btn" style="cursor:pointer">' + icon("plus") + 'Importer<input type="file" accept="application/json" data-import hidden></label>' +
      (S.mode === "demo" ? '<button class="btn danger" data-reset>Réinitialiser la démo</button>' : "") + "</div></div></section>" +
      '<section class="panel"><h2>Équipe</h2><p>' + (S.state.me ? "Connecté en tant que <b>" + esc(S.state.me) + "</b>. " : "") + "Les personnes qui ont accès à PlanneRs se gèrent dans Cloudflare Access (une adresse e-mail par personne).</p><div class=\"form\">" +
      '<label>Validateurs (une adresse e-mail par ligne)<textarea rows="3" data-team-validators placeholder="Vide : tout le monde peut valider"' + (A.canValidate() ? "" : ' disabled title="Seuls les validateurs peuvent changer cette liste"') + '>' + esc(((settings().team || {}).validators || []).join("\n")) + "</textarea></label>" +
      '<p class="muted" style="margin:0;font-size:12px">Si la liste est remplie, seules ces personnes peuvent valider une légende. Les autres préparent et commentent.</p></div></section>' +
      '<section class="panel"><h2>Corbeille</h2><p>Un post supprimé (avec sa story ou ce qui le suit) reste ici 30 jours. « Remettre » le replace tel quel, à sa date.</p>' +
      '<div id="trash-list" class="bklist"><p class="muted" style="margin:0">Chargement…</p></div></section>' +
      '<section class="panel"><h2>Sauvegardes</h2><p>Chaque semaine (le lundi), PlanneRs sauvegarde tes posts et tes réglages. Les 8 dernières sont gardées' + ((S.state.accounts || {}).gdrivewrite ? ", avec une copie dans ton Drive (dossier PlanneRs/sauvegardes)" : "") + ". Les identifiants des comptes ne sont jamais sauvegardés.</p>" +
      (S.mode === "demo" ? '<p class="muted" style="margin:0">En démo, utilise « Exporter (JSON) » ci-dessus.</p>' : '<div id="bk-list" class="bklist"><p class="muted" style="margin:0">Chargement…</p></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn" data-bk-now>' + icon("download") + "Sauvegarder maintenant</button></div>") + "</section>" +
      '<section class="panel"><h2>Assistant IA</h2><p>Claude, ChatGPT ou Codex peuvent préparer tes posts à ta place : idées, légendes, médias, dates. Adresse à donner à l\'assistant : <code data-noi18n>' + esc(location.origin + "/mcp") + "</code></p><div class=\"form\">" +
      '<label class="toggle"><input type="checkbox" data-ai-validate' + ((settings().ai || {}).validate ? " checked" : "") + (A.canValidate() ? "" : " disabled") + "> L'assistant peut aussi valider les légendes</label>" +
      '<p class="muted" style="margin:0;font-size:12px">' + ((settings().ai || {}).validate ? "Attention : un post validé par l'assistant part tout seul à l'heure prévue, sans relecture humaine." : "Conseillé : l'assistant prépare, et c'est toi qui valides dans « À valider ». Rien ne part sans ton accord.") + ' <a class="lk" href="' + docsBase() + 'reference/assistants-ia.md" target="_blank" rel="noopener">Comment le connecter</a></p>' +
      '<p class="muted" style="margin:0;font-size:12px">' + (S.state.rewrite ? "Réécriture des légendes par réseau avec Claude : active." : "Réécriture des légendes par réseau avec Claude : ajoute le secret ANTHROPIC_API_KEY au Worker pour l'activer.") + "</p></div></section>" +
      '<section class="panel"><h2>Importer ou exporter un planning</h2><p>Un fichier CSV (Excel, Google Sheets…) avec les colonnes date, heure, titre, format, reseaux, legende. Seul le titre est obligatoire. Reconnues aussi : statut (« Publié » : le post arrive comme publié), lien, n°, serie. Les lignes déjà dans l\'app sont ignorées. L\'export contient tout le planning avec les vues, likes et commentaires relevés, et se réimporte tel quel.</p><div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<label class="btn" style="cursor:pointer">' + icon("plus") + 'Importer un CSV<input type="file" accept=".csv,text/csv" data-import-csv hidden></label><button class="btn quiet" data-csv-model>' + icon("download") + "Modèle CSV</button><button class=\"btn\" data-export-csv>" + icon("download") + "Exporter le planning (CSV)</button></div>" +
      '<p style="margin:14px 0 8px">Tes publications Instagram faites avant PlanneRs (jusqu\'à 500) : elles arrivent comme « publiées », avec leur légende et leur lien, pour les retrouver dans le calendrier et les Stats et pouvoir les reprendre. Rien n\'est publié, rien n\'est recréé en double.</p>' +
      '<button class="btn" data-ig-history>' + brand("instagram") + "Récupérer l'historique Instagram</button></section>" +
      '<section class="panel"><h2>Aide</h2><p>La visite guidée présente chaque menu en une minute.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-tour>' + icon("today") + "Revoir la visite guidée</button>" +'<button class="btn" data-shortcuts>' + icon("today") + "Raccourcis clavier</button>" +
      '<a class="btn" href="' + docsBase() + 'README.md" target="_blank" rel="noopener">' + icon("right") + "Lire la documentation</a></div></section>",
  };
})();
