/* PlanneRs : démarrage, navigation, événements et glisser-déposer. */
(function () {
  "use strict";
  const C = window.Core, U = window.UI, S = window.Store, A = window.App;
  const { esc, safeUrl, icon } = U;

  const NAV = [["today", "Aujourd'hui", "today"], ["calendar", "Calendrier", "calendar"], ["contents", "Contenus", "contents"], ["stats", "Stats", "chart"], ["activity", "Activité", "activity"], ["settings", "Réglages", "settings"]];
  const route = () => (location.hash.replace("#", "").split("/")[0] || "today");
  const navOf = (r) => (r === "list" ? "today" : r === "report" ? "stats" : r);

  function shell() {
    const r = route();
    const n = A.todoList().count;
    const h = A.health();
    document.getElementById("nav").innerHTML = NAV.map(([k, l, ic]) => '<a href="#' + k + '"' + (navOf(r) === k ? ' aria-current="page"' : "") + ">" + icon(ic) + l +
      (k === "today" && n ? '<span class="count" aria-label="' + n + ' à faire">' + n + "</span>" : "") + "</a>").join("");
    document.getElementById("ws-name").textContent = S.state.settings.workspace.name;
    const hl = document.getElementById("health");
    hl.innerHTML = '<span class="dot ' + h.cls + '"></span><span><b>' + esc(h.text) + "</b>" + "Voir l'activité" + "</span>";
    const tabs = [["today", "Aujourd'hui", "today"], ["calendar", "Calendrier", "calendar"], ["contents", "Contenus", "contents"], ["more", "Plus", "more"]];
    document.getElementById("tabbar").innerHTML = tabs.map(([k, l, ic]) => '<a href="#' + k + '"' + ((navOf(r) === k || (k === "more" && ["stats", "activity", "settings", "more"].includes(r))) ? ' aria-current="page"' : "") + ">" + icon(ic) + l +
      (k === "today" && n ? '<span class="badge">' + n + "</span>" : "") + (k === "more" && h.cls === "bad" ? '<span class="badge" style="background:var(--fail)">!</span>' : "") + "</a>").join("");
  }

  A.render = function () {
    const r = route();
    let v;
    if (r === "more") {
      const h = A.health();
      v = { title: "Plus", html: '<div class="morelist"><a href="#stats">' + icon("chart") + "Stats</a><a href=\"#activity\">" + icon("activity") + "Activité<span class=\"muted\" style=\"margin-left:auto;font-weight:400\">" + esc(h.text) + "</span></a>" +
        '<a href="#settings">' + icon("settings") + "Réglages</a>" + '<a href="#" data-search>' + icon("search") + "Rechercher</a>" + '<a href="#" data-theme-toggle>' + icon("moon") + "Changer de thème</a>" + '<a href="#" data-tour>' + icon("today") + "Visite guidée</a></div>" };
    } else v = (A.views[r] || A.views.today)();
    document.getElementById("title").textContent = v.title;
    document.title = v.title + " · PlanneRs";
    document.getElementById("tools").innerHTML = (v.sub ? '<span class="muted">' + esc(v.sub) + "</span>" : "") + (v.tools || "");
    const view = document.getElementById("view");
    view.innerHTML = v.html;
    shell();
    A.renderPending();
    if (document.getElementById("bk-list")) A.loadBackups();
    if (document.getElementById("ical-box")) A.loadIcal();
  };

  // Actions sur plusieurs posts à la fois.
  A.bulk = async function (act) {
    const ids = [...(A.sel || [])], ps = ids.map((id) => S.post(id)).filter(Boolean);
    if (act === "clear" || !ps.length) { A.sel = new Set(); return A.render(); }
    const open = ps.filter((p) => p.status !== "published");
    if (act === "validate") return A.validateAll(open.map((p) => p.id));
    const before = JSON.parse(JSON.stringify(ps));
    const undo = { label: "Annuler", fn: async () => { await S.savePosts(before); A.render(); U.toast("Modifications annulées"); } };
    if (act === "shift") {
      const d = Math.round(+document.getElementById("bk-days").value || 0); if (!d) return U.toast("Indique un nombre de jours");
      const today = C.ymd(new Date()), moved = open.filter((p) => p.date).map((p) => Object.assign(p, { date: C.addDays(p.date, d) }));
      const kids = S.state.posts.filter((k) => k.parent && moved.some((p) => p.id === k.parent) && k.date && !ids.includes(k.id)).map((k) => Object.assign(k, { date: C.addDays(k.date, d) }));
      if (!moved.length) return U.toast("Aucun post daté à décaler");
      await S.savePosts(moved.concat(kids)); await S.log({ level: "change", text: moved.length + " posts décalés de " + d + " jour" + (Math.abs(d) > 1 ? "s" : "") });
      A.render(); return U.toast(moved.length + " posts décalés" + (moved.some((p) => p.date < today) ? " (certains sont maintenant dans le passé)" : ""), undo);
    }
    if (act === "addnet" || act === "delnet") {
      const n = document.getElementById("bk-net").value, ch = [];
      open.forEach((p) => { const has = p.networks.includes(n); if (act === "addnet" && !has) { p.networks = p.networks.concat(n); ch.push(p); } if (act === "delnet" && has && p.networks.length > 1) { p.networks = p.networks.filter((x) => x !== n); ch.push(p); } });
      if (!ch.length) return U.toast("Rien à changer");
      await S.savePosts(ch); await S.log({ level: "change", text: "Réseaux modifiés sur " + ch.length + " posts" });
      A.render(); return U.toast(ch.length + " posts modifiés", undo);
    }
    if (act === "delete") {
      if (!open.length) return U.toast("Les posts publiés ne se suppriment pas d'ici");
      if (!confirm("Supprimer " + open.length + " post" + (open.length > 1 ? "s" : "") + " ? Les posts publiés de la sélection sont gardés.")) return;
      const kids = S.state.posts.filter((k) => open.some((p) => p.id === k.parent));
      const gone = JSON.parse(JSON.stringify(open.concat(kids)));
      for (const p of open) await S.deletePost(p.id);
      await S.log({ level: "change", text: open.length + " posts supprimés" });
      A.sel = new Set(); A.render();
      return U.toast(open.length + " posts supprimés", { label: "Annuler", fn: async () => { await S.savePosts(gone); A.render(); U.toast("Posts rétablis"); } });
    }
  };

  // Commentaires Instagram (Activité).
  A.loadComments = async function (fresh) {
    try { A.comments = await S.call("GET", "comments" + (fresh ? "?fresh=1" : "")); }
    catch (e) { A.comments = { error: "Commentaires indisponibles : " + e.message, comments: [] }; }
    A.commentsLoading = false;
    if ((location.hash || "#today") === "#activity") A.render();
  };

  // Lien d'agenda (Réglages › Notifications).
  A.loadIcal = async function (r) {
    const box = document.getElementById("ical-box");
    if (!box || S.mode !== "api") return;
    try {
      r = r || await S.call("GET", "ical");
      box.innerHTML = r.url
        ? '<div class="form"><label>Tous les posts<span class="row"><input readonly value="' + esc(r.url) + '" data-noi18n style="flex:1"><button class="btn" data-copyval="' + esc(r.url) + '">' + icon("copy") + "Copier</button></span></label>" +
          '<label>Seulement ceux à poster à la main<span class="row"><input readonly value="' + esc(r.url + "?only=manual") + '" data-noi18n style="flex:1"><button class="btn" data-copyval="' + esc(r.url + "?only=manual") + '">' + icon("copy") + "Copier</button></span></label>" +
          '<p class="muted" style="margin:0;font-size:12px">Ce lien est secret : qui l\'a voit ton planning. Dans Google Agenda : Autres agendas › + › À partir de l\'URL. Si PlanneRs est protégé par Cloudflare Access, il faut une règle « Bypass » pour /cal/ (voir la documentation).</p>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-ical="new">Recréer le lien (coupe l\'ancien)</button><button class="btn quiet danger" data-ical="off">Désactiver</button></div></div>'
        : '<button class="btn" data-ical="new">' + icon("calendar") + "Créer le lien d'agenda</button>";
    } catch (e) { box.innerHTML = '<p class="muted" style="margin:0">Indisponible : ' + esc(e.message) + "</p>"; }
  };

  // Sauvegardes (Réglages › Espace) : liste et restauration.
  A.loadBackups = async function () {
    const box = document.getElementById("bk-list");
    if (!box || S.mode !== "api") return;
    try {
      const r = await S.call("GET", "backups");
      const fmt = (b) => { const d = b.id.slice(0, 10); return C.longDate(d) + (/avant-restauration/.test(b.id) ? " (avant restauration)" : /manuelle/.test(b.id) ? " (manuelle)" : ""); };
      box.innerHTML = r.backups.length ? r.backups.map((b) => '<div class="bk"><span>' + esc(fmt(b)) + ' <span class="muted">· ' + b.posts + " posts</span></span><button class=\"btn quiet\" data-bk-restore=\"" + esc(b.id) + '" data-bk-label="' + esc(fmt(b)) + '">Restaurer</button></div>').join("") : '<p class="muted" style="margin:0">Pas encore de sauvegarde : la première sera faite lundi matin, ou maintenant avec le bouton.</p>';
    } catch (e) { box.innerHTML = '<p class="muted" style="margin:0">Liste indisponible : ' + esc(e.message) + "</p>"; }
  };

  try { A.trayClosed = localStorage.getItem("planners-tray") === "1"; A.dashRange = localStorage.getItem("planners-dash") || "today"; } catch (x) { /* rien */ }
  document.addEventListener("toggle", (e) => { if (e.target.matches && e.target.matches(".netdd")) A.netOpen = e.target.open; }, true);
  document.addEventListener("click", (e) => { const dd = document.querySelector(".netdd[open]"); if (dd && !dd.contains(e.target)) { dd.open = false; A.netOpen = false; } });

  // ------------------------------------------------------------ Clics
  document.addEventListener("click", async (e) => {
    const t = e.target;
    const g = (sel) => t.closest(sel);
    let b;
    // Sélection multiple (Contenus › Liste) : avant l'ouverture de la ligne.
    if ((b = g("[data-sel], [data-selall]"))) {
      e.stopPropagation(); A.sel = A.sel || new Set();
      const ids = b.matches("[data-selall]") ? [...document.querySelectorAll("[data-sel]")].flatMap((x) => x.dataset.sel.split(",")) : b.dataset.sel.split(",");
      ids.forEach((id) => (b.checked ? A.sel.add(id) : A.sel.delete(id)));
      return A.render();
    }
    if (g("td.lsel")) return;
    if ((b = g("[data-bulk]"))) return A.bulk(b.dataset.bulk);
    if ((b = g("[data-mkind]"))) { A.mKind = b.dataset.mkind; return A.render(); }
    if ((b = g("[data-reuse]"))) {
      const [pid, i] = b.dataset.reuse.split(":"), src = S.post(pid), m = src && (src.media || [])[+i];
      if (!m) return;
      const p = { id: "u" + Date.now().toString(36), ref: "", title: (m.name || "Média").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "), format: /video/.test(m.type || "") || /\.(mp4|mov|webm)$/i.test(m.name || "") ? "reel" : "image",
        networks: [A.nets()[0]], date: null, time: null, caption: "", captionValidated: false, manual: false, media: [JSON.parse(JSON.stringify(m))], folder: src.folder, stage: "media", status: "draft" };
      await S.savePosts([p]); await S.log({ level: "change", text: "Nouveau post à partir d'un média de « " + src.title + " »", postId: p.id });
      A.render(); A.openPost(p.id); return U.toast("Nouveau post créé avec ce média");
    }
    if ((b = g("[data-cmall]"))) { A.cmAll = b.dataset.cmall === "1"; return A.render(); }
    if ((b = g("[data-cm-refresh]"))) { if (S.mode !== "api") return U.toast("Mode démo : commentaires fictifs"); A.comments = null; A.render(); return A.loadComments(true); }
    if ((b = g("[data-cm-suggest]"))) {
      const id = b.dataset.cmSuggest, ta = document.querySelector('[data-cm-text="' + CSS.escape(id) + '"]');
      if (S.mode !== "api") { ta.value = "Merci pour ton message ! Oui, ça marche aussi, avec un peu plus d'eau. Dis-nous ce que ça donne 😊"; return U.toast("Proposition de Claude (exemple de démo) : relis-la avant d'envoyer"); }
      b.disabled = true; U.toast("Claude prépare une réponse…");
      try { const r = await S.call("POST", "comments/" + encodeURIComponent(id) + "/suggest"); ta.value = r.text; ta.focus(); U.toast("Proposition de Claude : relis-la avant d'envoyer"); }
      catch (x) { U.toast("Proposition impossible : " + x.message); } finally { b.disabled = false; }
      return;
    }
    if ((b = g("[data-cm-reply]"))) {
      const id = b.dataset.cmReply, ta = document.querySelector('[data-cm-text="' + CSS.escape(id) + '"]'), text = (ta.value || "").trim();
      if (!text) { ta.focus(); return U.toast("Écris une réponse"); }
      const c = A.comments.comments.find((x) => x.id === id);
      if (S.mode === "api") { b.disabled = true; try { await S.call("POST", "comments/" + encodeURIComponent(id) + "/reply", { text }); } catch (x) { b.disabled = false; return U.toast("Réponse impossible : " + x.message); } }
      if (c) { c.answered = true; c.replies = (c.replies || []).concat({ text, user: A.comments.username, mine: true }); }
      A.render(); return U.toast(S.mode === "api" ? "Réponse publiée sur Instagram" : "Mode démo : rien n'est publié");
    }
    if ((b = g("[data-weekly-preview]"))) {
      if (S.mode !== "api") { U.toast("Mode démo : le bilan est calculé sur ton serveur"); return; }
      const box = document.getElementById("wk-prev");
      try { const r = await S.call("POST", "weekly/run", {}); box.textContent = r.title + "\n\n" + r.text; box.hidden = false; } catch (x) { U.toast("Bilan impossible : " + x.message); }
      return;
    }
    if ((b = g("[data-copyval]"))) { try { await navigator.clipboard.writeText(b.dataset.copyval); U.toast("Lien copié"); } catch (x) { const i = b.parentElement.querySelector("input"); if (i) { i.select(); U.toast("Copie le lien sélectionné"); } } return; }
    if ((b = g("[data-ig-history]"))) {
      if (S.mode !== "api") { U.toast("Mode démo : rien à récupérer"); return; }
      if (!confirm("Récupérer tes publications Instagram passées dans PlanneRs ? Elles arrivent comme « publiées » ; rien n'est publié.")) return;
      b.disabled = true; U.toast("Récupération en cours…");
      try {
        const r = await S.call("POST", "import/instagram");
        if (r.posts && r.posts.length) { S.state.posts = S.state.posts.concat(r.posts); }
        U.toast(r.created ? r.created + " publications récupérées" + (r.skipped ? " (" + r.skipped + " déjà présentes)" : "") : "Rien de nouveau : tout est déjà dans PlanneRs", r.created ? { label: "Voir", fn: () => { location.hash = "#calendar"; } } : null);
      } catch (x) { U.toast("Récupération impossible : " + x.message); }
      b.disabled = false; return A.render();
    }
    if ((b = g("[data-report]"))) { A.reportMonth = b.dataset.report; return A.render(); }
    if ((b = g("[data-report-copy]"))) { try { await navigator.clipboard.writeText(A.reportText()); U.toast("Résumé copié"); } catch (x) { U.toast("Copie impossible"); } return; }
    if ((b = g("[data-report-print]"))) { window.print(); return; }
    if ((b = g("[data-ical]"))) {
      if (b.dataset.ical === "off") { if (!confirm("Désactiver le lien d'agenda ? Les agendas abonnés ne verront plus tes posts.")) return; await S.call("DELETE", "ical"); U.toast("Lien d'agenda désactivé"); return A.loadIcal({}); }
      if (b.closest("#ical-box").querySelector("input") && !confirm("Recréer le lien ? L'ancien ne marchera plus : il faudra mettre le nouveau dans ton agenda.")) return;
      return A.loadIcal(await S.call("POST", "ical"));
    }
    if ((b = g("[data-bk-now]"))) { b.disabled = true; try { const r = await S.call("POST", "backups"); U.toast("Sauvegarde faite : " + r.posts + " posts" + (r.drive ? ", copie dans le Drive" : "")); } catch (x) { U.toast("Sauvegarde impossible : " + x.message); } b.disabled = false; return A.loadBackups(); }
    if ((b = g("[data-bk-restore]"))) {
      if (!confirm("Remplacer tous les posts et les réglages par la sauvegarde du " + b.dataset.bkLabel + " ? L'état actuel est sauvegardé juste avant, tu pourras revenir en arrière.")) return;
      b.disabled = true;
      try { await S.call("POST", "backups/" + encodeURIComponent(b.dataset.bkRestore) + "/restore"); await S.init(); U.toast("Sauvegarde restaurée"); return A.render(); }
      catch (x) { b.disabled = false; return U.toast("Restauration impossible : " + x.message); }
    }
    if (A.dragJustEnded) { A.dragJustEnded = false; if (g("[data-drag]")) return; }
    if (g("select, .kmove")) return;
    if ((b = g("[data-unlock]"))) { A.unlockPost(b.dataset.unlock); return; }
    if ((b = g("[data-kadd]"))) { A.kAdd = b.dataset.kadd || null; A.render(); const i = document.querySelector(".knew input"); if (i) i.focus(); return; }
    if ((b = g("[data-kformat]"))) { A.kFormat = b.dataset.kformat || null; A.render(); return; }
    if ((b = g("[data-close]"))) { A.closeLayer(); return; }
    if ((b = g("[data-open]"))) { A.openPost(b.dataset.open); return; }
    if ((b = g("[data-retry]"))) { const p = S.post(b.dataset.retry); try { await S.retry(p.id); await S.log({ level: "ok", text: "Nouvel essai réussi : " + p.title, postId: p.id }); U.toast("Publié"); } catch (err) { U.toast("Toujours en échec"); } A.render(); return; }
    if ((b = g("[data-manual]"))) { A.openManual(b.dataset.manual, b.dataset.onet); return; }
    if ((b = g("[data-unignore]"))) { const p = S.post(b.dataset.unignore); p.ignored = false; await S.savePosts([p]); A.render(); U.toast("Remis dans les manqués"); return; }
    if ((b = g("[data-resched]"))) { A.openPost(b.dataset.resched); setTimeout(() => { const L = document.querySelector(".sheet [data-act=showmove]"); L && L.click(); }, 60); return; }
    if ((b = g("[data-ignore]"))) { const p = S.post(b.dataset.ignore); p.ignored = true; await S.savePosts([p]); await S.log({ level: "change", text: "Rappel ignoré : " + p.title, postId: p.id }); A.render(); return; }
    if ((b = g("[data-review]"))) { A.openReview(); return; }
    if ((b = g("[data-share-review]"))) { A.lastFocus = b; A.shareLink(A.todoList().review.map((p) => p.id)); return; }
    if ((b = g("[data-valall]"))) { A.validateAll(); return; }
    if ((b = g("[data-tour]"))) { e.preventDefault(); A.tour(); return; }
    if ((b = g("[data-stats-refresh]"))) { b.disabled = true; b.textContent = "Relevé en cours…"; try { if (S.mode === "api") S.state.stats = await S.call("POST", "stats/refresh"); else { S.state.stats = A.demoStats(); U.toast("Mode démo : chiffres d'exemple"); } } catch (err) { U.toast("Relevé impossible : " + err.message); } A.render(); return; }
    if ((b = g("[data-quick]"))) { A.quick(b.dataset.quick); return; }
    if ((b = g("[data-stat-chan]"))) { A.statChan = b.dataset.statChan; A.render(); return; }
    if ((b = g("[data-stat-sort]"))) { A.statSort = b.dataset.statSort; A.render(); return; }
    if ((b = g("[data-dash]"))) { A.dashRange = b.dataset.dash; try { localStorage.setItem("planners-dash", A.dashRange); } catch (x) { /* rien */ } A.render(); return; }
    if ((b = g("[data-calst]"))) { A.calSt = b.dataset.calst && A.calSt !== b.dataset.calst ? b.dataset.calst : ""; A.render(); return; }
    if ((b = g("[data-new]"))) { A.newPost(); return; }
    if ((b = g("[data-free]"))) { const [d, tm] = b.dataset.free.split("|"); A.openFree(d, tm); return; }
    if ((b = g("[data-tray-toggle]"))) { A.trayClosed = !A.trayClosed; try { localStorage.setItem("planners-tray", A.trayClosed ? "1" : ""); } catch (x) { /* rien */ } A.render(); return; }
    if ((b = g("[data-net]"))) { const n = b.dataset.net; A.netOff[n] = !A.netOff[n]; A.render(); return; }
    if ((b = g("[data-nav]"))) { const k = +b.dataset.nav; const step = A.calMode === "month" ? 35 : 7;
      if (k === 0) { A.week = C.mondayOf(C.ymd(new Date())); A.day = null; } else if (A.calMode === "month") { const d = C.parseYmd(C.addDays(A.week, 3)); d.setMonth(d.getMonth() + k, 1); A.week = C.mondayOf(C.ymd(d)); } else A.week = C.addDays(A.week, k * step);
      A.render(); return; }
    if ((b = g("[data-calmode]"))) { A.calMode = b.dataset.calmode; A.render(); return; }
    if ((b = g("[data-gotoweek]"))) { A.week = C.mondayOf(b.dataset.gotoweek); A.calMode = "week"; A.render(); return; }
    if ((b = g("[data-day-pick]"))) { A.day = b.dataset.dayPick; A.render(); return; }
    if ((b = g("[data-listper]"))) { A.listPer = b.dataset.listper; if (b.dataset.cmode) A.contentsMode = b.dataset.cmode; A.render(); return; }
    if ((b = g("[data-cmode]"))) { A.contentsMode = b.dataset.cmode; A.render(); return; }
    if ((b = g("[data-logf]"))) { A.logFilter = b.dataset.logf; A.render(); return; }
    if ((b = g("[data-setup-hide]"))) { S.state.settings.setupHidden = true; await S.saveSettings(S.state.settings); A.render(); U.toast("« Bien démarrer » masqué", { label: "Annuler", fn: async () => { S.state.settings.setupHidden = false; await S.saveSettings(S.state.settings); A.render(); } }); return; }
    if ((b = g("[data-href]"))) { window.open(b.dataset.href, "_blank", "noopener"); return; }
    if ((b = g("[data-settab]"))) { if (b.dataset.settab === "slots" && !S.state.settings.slotsSet) { S.state.settings.slotsSet = true; S.saveSettings(S.state.settings); } A.setTab = b.dataset.settab; if (route() !== "settings") location.hash = "#settings"; else A.render(); return; }
    if ((b = g("[data-conn]"))) { A.openConn(b.dataset.conn); return; }
    if ((b = g("[data-pend]"))) {
      const a = b.dataset.pend;
      if (a === "apply") await A.applyPending();
      else if (a === "cancel") { A.pending = []; A.render(); }
      else { A.pending.pop(); A.render(); }
      return;
    }
    if ((b = g("[data-search]"))) { e.preventDefault(); A.openSearch(); return; }
    if ((b = g("[data-theme-toggle]"))) { e.preventDefault(); toggleTheme(); return; }
    if ((b = g("[data-set-add]"))) { const t = (S.state.settings.templates = S.state.settings.templates || {}); (t.sets = t.sets || []).push({ name: "", networks: A.nets().slice(0, 2) }); await saveSet(); const i = document.querySelectorAll("[data-set-name]"); if (i.length) i[i.length - 1].focus(); return; }
    if ((b = g("[data-set-del]"))) { S.state.settings.templates.sets.splice(+b.dataset.setDel, 1); await saveSet(); return; }
    if ((b = g("[data-feed-add]"))) { const au = (S.state.settings.auto = S.state.settings.auto || {}); (au.feeds = au.feeds || []).push({ url: "", networks: [] }); await saveSet(); const i = document.querySelectorAll("[data-feed-url]"); if (i.length) i[i.length - 1].focus(); return; }
    if ((b = g("[data-feed-del]"))) { S.state.settings.auto.feeds.splice(+b.dataset.feedDel, 1); await saveSet(); return; }
    if ((b = g("[data-feed-run]"))) {
      if (S.mode !== "api") { U.toast("Mode démo : les flux sont relus sur ton serveur"); return; }
      b.disabled = true;
      try { const r = await S.call("POST", "rss/run", {}); await S.init(); A.render(); U.toast(r.errors ? r.errors + (r.errors > 1 ? " flux illisibles" : " flux illisible") + " : voir Activité" : r.created ? r.created + (r.created > 1 ? " nouveaux posts à relire" : " nouveau post à relire") : "Flux relus : rien de nouveau"); }
      catch (x) { b.disabled = false; U.toast("Lecture impossible : " + x.message); }
      return;
    }
    if ((b = g("[data-plug-add]"))) { const au = (S.state.settings.auto = S.state.settings.auto || {}); (au.plugs = au.plugs || []).push({ id: "k" + Date.now().toString(36), net: "instagram", threshold: 100, comment: "" }); await saveSet(); const i = document.querySelectorAll("[data-plug-text]"); if (i.length) i[i.length - 1].focus(); return; }
    if ((b = g("[data-plug-del]"))) { S.state.settings.auto.plugs.splice(+b.dataset.plugDel, 1); await saveSet(); return; }
    if ((b = g("[data-tpl-add]"))) { const t = (S.state.settings.templates = S.state.settings.templates || {}); (t.tags = t.tags || []).push({ name: "", text: "" }); await saveSet(); const i = document.querySelectorAll("[data-tpl-name]"); if (i.length) i[i.length - 1].focus(); return; }
    if ((b = g("[data-tpl-del]"))) { S.state.settings.templates.tags.splice(+b.dataset.tplDel, 1); await saveSet(); return; }
    if ((b = g("[data-slot-suggest]"))) { S.state.settings.slots.push({ time: b.dataset.slotSuggest, label: "Bon horaire" }); S.state.settings.slotsSet = true; await saveSet(); U.toast("Créneau " + b.dataset.slotSuggest + " ajouté"); return; }
    if ((b = g("[data-csv-model]"))) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\uFEFF" + A.csvTemplate], { type: "text/csv" })); a.download = "planning-modele.csv"; a.click(); return; }
    if ((b = g("[data-slot-add]"))) { S.state.settings.slots.push({ time: "20:00", label: "Nouveau créneau" }); await saveSet(); return; }
    if ((b = g("[data-slot-del]"))) { S.state.settings.slots.splice(+b.dataset.slotDel, 1); await saveSet(); return; }
    if ((b = g("[data-chk-add]"))) { (S.state.settings.customChecks = S.state.settings.customChecks || []).push({ label: "Mention du crédit absente", contains: "Crédit" }); await saveSet(); return; }
    if ((b = g("[data-chk-del]"))) { S.state.settings.customChecks.splice(+b.dataset.chkDel, 1); await saveSet(); return; }
    if ((b = g("[data-export]"))) {
      const blob = new Blob([JSON.stringify(S.state, null, 2)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "planners-" + C.ymd(new Date()) + ".json"; a.click(); return;
    }
    if ((b = g("[data-reset]"))) { if (confirm("Remettre la démo à zéro ?")) { S.resetDemo(); A.pending = []; A.render(); U.toast("Démo réinitialisée"); } return; }
  });

  async function saveSet() {
    S.state.settings.slots.sort((a, b) => a.time.localeCompare(b.time));
    await S.saveSettings(S.state.settings); A.render();
  }
  document.addEventListener("change", async (e) => {
    if (e.target.matches && e.target.matches("[data-stat-days]")) { A.statDays = +e.target.value; A.render(); return; }
    const t = e.target, d = t.dataset, st = S.state.settings;
    if (t.matches("[data-lang]")) { I18N.set(t.value); return; }
    if (t.matches("[data-utm-domains]")) { const d = t.value.split(/[\s,;]+/).map((x) => x.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase()).filter((x) => x.includes(".")); st.utm = Object.assign({ medium: "social" }, st.utm, { domains: d }); await S.saveSettings(st); U.toast(d.length ? "Liens suivis activés" : "Liens suivis désactivés"); return; }
    if (t.matches("[data-drive-inbox]")) { const v = t.value.trim().replace(/^\/+|\/+$/g, ""); st.drive = Object.assign({}, st.drive, { inbox: v || "PlanneRs/depots" }); await S.saveSettings(st); U.toast("Dossier enregistré"); return; }
    if (t.matches("[data-ai-validate]")) {
      if (t.checked && !confirm("Les posts validés par l'assistant partiront tout seuls, sans relecture humaine. Continuer ?")) { t.checked = false; return; }
      st.ai = Object.assign({}, st.ai, { validate: t.checked }); await S.saveSettings(st); U.toast(t.checked ? "L'assistant peut valider" : "Seuls les humains valident"); return A.render();
    }
    if (t.matches("[data-team-validators]")) { st.team = Object.assign({}, st.team, { validators: t.value.split(/[\s,;]+/).map((x) => x.trim()).filter((x) => x.includes("@")) }); await S.saveSettings(st); U.toast("Validateurs enregistrés"); return A.render(); }
    if (d.setName != null) { st.templates.sets[+d.setName].name = t.value.trim(); return S.saveSettings(st); }
    if (d.setNet != null) { const g0 = st.templates.sets[+d.setNet]; g0.networks = A.nets().filter((n) => (n === t.value ? t.checked : (g0.networks || []).includes(n))); return S.saveSettings(st); }
    if (d.feedUrl != null) { const v = t.value.trim(); if (v && !/^https?:\/\/\S+\.\S+/.test(v)) { U.toast("Adresse du flux : elle doit commencer par https://"); return; } st.auto.feeds[+d.feedUrl].url = v; await S.saveSettings(st); if (v) U.toast("Flux enregistré"); return; }
    if (d.feedNet != null) { const f = st.auto.feeds[+d.feedNet]; f.networks = A.nets().filter((n) => (n === t.value ? t.checked : (f.networks || []).includes(n))); return S.saveSettings(st); }
    if (d.plugNet != null) { st.auto.plugs[+d.plugNet].net = t.value; return S.saveSettings(st); }
    if (d.plugN != null) { st.auto.plugs[+d.plugN].threshold = Math.max(1, Math.round(+t.value) || 1); t.value = st.auto.plugs[+d.plugN].threshold; return S.saveSettings(st); }
    if (d.plugText != null) { st.auto.plugs[+d.plugText].comment = t.value.trim().slice(0, 2000); await S.saveSettings(st); if (t.value.trim()) U.toast("Règle enregistrée"); return; }
    if (t.matches("[data-tpl-sig]")) { (st.templates = st.templates || {}).signature = t.value; return S.saveSettings(st); }
    if (d.tplName != null) { st.templates.tags[+d.tplName].name = t.value.trim(); return S.saveSettings(st); }
    if (d.tplText != null) { st.templates.tags[+d.tplText].text = t.value.trim(); return S.saveSettings(st); }
    if (d.slotTime != null) { st.slots[+d.slotTime].time = t.value; return saveSet(); }
    if (d.slotLabel != null) { st.slots[+d.slotLabel].label = t.value; return saveSet(); }
    if (d.ruleNet != null) { st.rules.robotNets = A.nets().filter((n) => (n === t.value ? t.checked : (st.rules.robotNets || []).includes(n))); return saveSet(); }
    if (d.rule) { st.rules[d.rule] = t.checked; return saveSet(); }
    if (d.ruleNum) { st.rules[d.ruleNum] = Math.max(0, +t.value || 0); return saveSet(); }
    if (d.chkLabel != null) { st.customChecks[+d.chkLabel].label = t.value; return saveSet(); }
    if (d.chkText != null) { st.customChecks[+d.chkText].contains = t.value; return saveSet(); }
    if (d.notify) { st.notify[d.notify] = t.checked; return saveSet(); }
    if (d.notifyNum) { st.notify[d.notifyNum] = +t.value || 0; return saveSet(); }
    if (d.notifyTime) { if (/^\d{2}:\d{2}$/.test(t.value)) { st.notify[d.notifyTime] = t.value; return saveSet(); } return; }
    if (t.hasAttribute("data-ws-name")) { st.workspace.name = t.value || st.workspace.name; return saveSet(); }
    if (t.hasAttribute("data-import-csv") && t.files[0]) { const txt = await t.files[0].text(); t.value = ""; A.lastFocus = document.activeElement; A.openCsvImport(txt); return; }
    if (t.hasAttribute("data-import") && t.files[0]) {
      try { const data = JSON.parse(await t.files[0].text()); if (!data.posts || !data.settings) throw new Error("format");
        S.state = Object.assign({ log: [], accounts: {} }, data); S.persist(); if (S.mode === "api") await S.call("PUT", "state", S.state); A.render(); U.toast("Import terminé");
      } catch (err) { U.toast("Fichier non reconnu"); }
    }
  });
  // Liste : filtre par texte, sans perdre la saisie.
  document.addEventListener("input", (e) => {
    const sel = e.target.matches("[data-listq]") ? "[data-listq]" : e.target.matches("[data-mq]") ? "[data-mq]" : null;
    if (!sel) return;
    if (sel === "[data-mq]") A.mQ = e.target.value; else A.listQ = e.target.value;
    const pos = e.target.selectionStart;
    A.render();
    const i = document.querySelector(sel); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (x) { /* rien */ } }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches(".tl[data-open]")) { A.openPost(e.target.dataset.open); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); A.openSearch(); return; }
    if (e.key === "Escape" && document.getElementById("layer").innerHTML && !document.querySelector(".review")) { A.closeLayer(); return; }
    // Piège à focus : Tab reste dans la fiche, la fenêtre ou la validation ouverte.
    if (e.key === "Tab") {
      const dlg = [...document.querySelectorAll('#layer [role="dialog"]')].pop();
      if (dlg) {
        const items = [...dlg.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null || el === document.activeElement);
        if (items.length) {
          const first = items[0], last = items[items.length - 1];
          if (!dlg.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
          else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && A.pending.length && !/INPUT|TEXTAREA/.test(e.target.tagName)) { e.preventDefault(); A.pending.pop(); A.render(); }
  });

  // ------------------------------------------------------------ Kanban : changer de colonne
  const IDX = Object.fromEntries(C.STAGES.map(([k], i) => [k, i]));
  const label = (k) => (C.STAGES.find(([s]) => s === k) || [k, k])[1];
  A.moveStage = async function (id, to) {
    const p = S.post(id); if (!p) return;
    const from = A.stageOf(p);
    if (from === to) return;
    if (from === "published") { U.toast("Une publication publiée ne bouge plus."); return; }
    if (from === "scheduled") { U.toast("Programmé est verrouillé : clique sur « Débloquer » d'abord."); return; }
    if (to === "published") { U.toast("Publié se remplit tout seul (robot ou « C'est posté »)."); return; }
    if (!(await A.confirmMove("Déplacer ce contenu ?", "« " + p.title + " » : " + label(from) + " → " + label(to) + (to !== "scheduled" && IDX[to] <= IDX.caption && p.captionValidated ? ". La légende devra être revalidée." : "."), "Déplacer"))) { A.render(); return; }
    const before = JSON.parse(JSON.stringify(p));
    if (to === "scheduled") {
      if (!p.captionValidated) { U.toast("Valide d'abord la légende, puis choisis la date."); A.openPost(p.id); return; }
      if (!p.date || !p.time) { p.stage = "ready"; await S.savePosts([p]); A.render(); U.toast("Choisis la date et le créneau pour programmer."); A.openPost(p.id); return; }
      p.status = "scheduled"; p.stage = "scheduled";
    } else {
      p.stage = to;
      if (p.status === "failed") p.status = "draft";
      if (IDX[to] <= IDX.caption && p.captionValidated) p.captionValidated = false;
    }
    await S.savePosts([p]);
    await S.log({ level: "change", text: "« " + p.title + " » : " + label(from) + " → " + label(to), postId: p.id });
    A.render();
    U.toast("Déplacé vers " + label(to) + (to === "caption" || IDX[to] < IDX.caption ? " · légende à revalider" : ""), { label: "Annuler", fn: async () => { await S.savePosts([before]); A.render(); } });
  };
  A.unlockPost = async function (id) {
    const p = S.post(id); if (!p) return;
    const before = JSON.parse(JSON.stringify(p));
    p.status = "draft"; p.stage = "ready";
    await S.savePosts([p]);
    await S.log({ level: "change", text: "Débloqué (ne partira plus tout seul) : " + p.title, postId: p.id });
    A.render();
    U.toast("Débloqué : il ne partira plus tout seul.", { label: "Annuler", fn: async () => { await S.savePosts([before]); A.render(); } });
  };
  document.addEventListener("change", (e) => {
    const sel = e.target.closest && e.target.closest("[data-kmove]");
    if (sel && sel.value) A.moveStage(sel.dataset.kmove, sel.value);
  });
  document.addEventListener("submit", async (e) => {
    const f = e.target.closest("[data-knew]"); if (!f) return;
    e.preventDefault();
    const title = f.t.value.trim(); if (!title) return;
    const p = { id: "n" + Date.now().toString(36), ref: "", title, format: "reel", networks: [A.nets()[0]],
      date: null, time: null, caption: "", captionValidated: false, manual: false, media: [], stage: f.dataset.knew, status: "draft" };
    await S.savePosts([p]); await S.log({ level: "change", text: "Nouvelle carte : " + title, postId: p.id });
    A.kAdd = null; A.render(); U.toast("Ajouté dans " + label(p.stage));
  });

  // ------------------------------------------------------------ Déposer un fichier sur Aujourd'hui
  window.addEventListener("dragover", (e) => { if (route() === "today" && e.dataTransfer && [...e.dataTransfer.types].includes("Files")) { e.preventDefault(); document.body.classList.add("filedrop"); } });
  window.addEventListener("dragleave", (e) => { if (!e.relatedTarget) document.body.classList.remove("filedrop"); });
  window.addEventListener("drop", (e) => {
    document.body.classList.remove("filedrop");
    if (route() !== "today" || !e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault(); const f = e.dataTransfer.files[0];
    A.quick(/^video/.test(f.type) ? "video" : /^image/.test(f.type) ? "photo" : "file", f);
  });

  // ------------------------------------------------------------ Glisser-déposer (souris ; au doigt : appui long)
  let drag = null, press = null;
  const startDrag = (d) => {
    d.on = true; d.el.classList.add("dragging");
    d.ghost = d.el.cloneNode(true); d.ghost.classList.add("drag-ghost"); d.ghost.removeAttribute("data-open"); d.ghost.removeAttribute("data-drag"); d.ghost.removeAttribute("data-kdrag");
    d.ghost.style.width = Math.min(d.el.offsetWidth, 260) + "px";
    document.body.appendChild(d.ghost);
    document.body.classList.add("dragging-any"); if (d.kanban) document.body.classList.add("kdragging");
    if (d.touch && navigator.vibrate) try { navigator.vibrate(15); } catch (_) {}
  };
  const endDrag = (d) => {
    if (d.ghost) d.ghost.remove(); d.el.classList.remove("dragging"); document.body.classList.remove("kdragging", "dragging-any");
    document.querySelectorAll(".over").forEach((x) => x.classList.remove("over"));
  };
  document.addEventListener("pointerdown", (e) => {
    if (e.target.closest("select, .kmove, [data-unlock], .iconbtn")) return;
    const c = e.target.closest("[data-drag], [data-kdrag]");
    if (!c || (e.pointerType === "mouse" && e.button !== 0)) return;
    const d = { id: c.dataset.drag || c.dataset.kdrag, kanban: !!c.dataset.kdrag, el: c, x: e.clientX, y: e.clientY, on: false, touch: e.pointerType !== "mouse" };
    if (d.touch) {
      // Au doigt : il faut un appui long, sinon on laisse défiler la page.
      press = { d, t: setTimeout(() => { if (press && press.d === d) { drag = d; press = null; startDrag(d); moveDrag(d.x, d.y); } }, 380) };
      return;
    }
    e.preventDefault(); drag = d;
  });
  function moveDrag(x, y) {
    drag.ghost.style.left = x + 8 + "px"; drag.ghost.style.top = y + 8 + "px";
    document.querySelectorAll(".over").forEach((o) => o.classList.remove("over"));
    const under = document.elementFromPoint(x, y);
    const tgt = under && (drag.kanban ? under.closest(".col[data-stage]") : (under.closest("[data-day]") || under.closest("[data-tray]")));
    if (tgt) tgt.classList.add("over");
    drag.tgt = tgt; drag.lx = x; drag.ly = y;
  }
  document.addEventListener("pointermove", (e) => {
    if (press) { if (Math.hypot(e.clientX - press.d.x, e.clientY - press.d.y) > 8) { clearTimeout(press.t); press = null; } return; }
    if (!drag) return;
    if (!drag.on) { if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) return; startDrag(drag); }
    moveDrag(e.clientX, e.clientY);
  });
  // Pendant un glisser au doigt, la page ne défile pas.
  document.addEventListener("touchmove", (e) => { if (drag && drag.on) e.preventDefault(); }, { passive: false });
  document.addEventListener("contextmenu", (e) => { if (drag || press) e.preventDefault(); });
  document.addEventListener("pointerup", () => {
    if (press) { clearTimeout(press.t); press = null; }
    if (!drag) return;
    const d = drag; drag = null;
    if (!d.on) return;
    endDrag(d);
    A.dragJustEnded = true; setTimeout(() => { A.dragJustEnded = false; }, 50);
    if (!d.tgt) return;
    if (d.kanban) { A.moveStage(d.id, d.tgt.dataset.stage); return; }
    const p = A.eff(S.post(d.id));
    if (d.tgt.hasAttribute("data-tray")) { A.askMove(d.id, { date: null, time: null }); return; }
    const day = d.tgt.dataset.day, time = d.tgt.dataset.time || p.time || "12:00";
    if (day === p.date && time === p.time) return;
    if (day + "T" + time < C.nowStamp()) { U.toast("Ce créneau est déjà passé"); return; }
    A.askMove(d.id, { date: day, time });
  });
  document.addEventListener("pointercancel", () => { if (press) { clearTimeout(press.t); press = null; } if (drag && drag.on) endDrag(drag); drag = null; });
  document.addEventListener("dragstart", (e) => { if (e.target.closest && e.target.closest("[data-drag], [data-kdrag]")) e.preventDefault(); });

  // ------------------------------------------------------------ Thème
  function toggleTheme() {
    const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("planners-theme", next); } catch (e) { /* rien */ }
  }
  try { const th = localStorage.getItem("planners-theme"); if (th) document.documentElement.dataset.theme = th; } catch (e) { /* rien */ }

  // Retour de l'autorisation Google : #settings/<message>
  function hashNote() {
    const m = /^#settings\/(.+)$/.exec(location.hash);
    if (m) { A.setTab = "storage"; setTimeout(() => U.toast(decodeURIComponent(m[1])), 300); history.replaceState(null, "", "#settings"); }
  }
  hashNote();
  // Lien d'un rappel « à poster à la main » : #poster-<id> ouvre directement la marche à suivre.
  A.posterHash = function () {
    const m = /^#poster-(.+)$/.exec(location.hash); if (!m) return false;
    const id = decodeURIComponent(m[1]);
    history.replaceState(null, "", "#today"); A.render();
    if (S.post(id)) A.openManual(id); else U.toast("Ce post n'existe plus");
    return true;
  };
  window.addEventListener("hashchange", () => { if (!A.ready) return; if (A.posterHash()) return; A.closeLayer(); A.render(); window.scrollTo(0, 0); if (location.hash === "#share") A.receiveShare(); });

  // Partage reçu depuis le téléphone : une photo ou une vidéo → envoi dans le Drive ; un lien ou un texte → une idée.
  A.receiveShare = async function () {
    history.replaceState(null, "", "#today");
    let c, meta = null, file = null;
    try {
      c = await caches.open("planners-share");
      const m = await c.match("shared/meta"); if (m) meta = await m.json();
      const r = await c.match("shared/0");
      if (r) { const b = await r.blob(); file = new File([b], decodeURIComponent(r.headers.get("x-name") || "media"), { type: b.type }); }
      for (const k of await c.keys()) await c.delete(k);
    } catch (e) { /* rien de reçu */ }
    A.render();
    if (!meta) return;
    if (file) { A.quick(/^video/.test(file.type) ? "video" : /^image/.test(file.type) ? "photo" : "file", file); if (meta.n > 1) U.toast("Un fichier à la fois : seul le premier a été repris"); return; }
    const url = meta.url || ((meta.text || "").match(/https?:\/\/\S+/) || [""])[0];
    const f = () => document.querySelector("#q-form");
    if (url) { A.quick("link"); if (f()) { f().url.value = url; if (meta.title) f().title.value = meta.title; } return; }
    A.quick("idea"); if (f()) f().title.value = (meta.title || meta.text || "").trim().slice(0, 200);
  };
  let wasMobile = null;
  window.addEventListener("resize", () => { if (!A.ready) return; const m = A.isMobile(); if (m !== wasMobile) { wasMobile = m; A.render(); } });

  // Démo : chiffres d'exemple fabriqués à partir des posts publiés (rien n'est appelé).
  A.demoStats = function () {
    let seed = 7; const rnd = (a, b) => { seed = (seed * 9301 + 49297) % 233280; return a + Math.floor((seed / 233280) * (b - a)); };
    const pub = S.state.posts.filter((p) => !p.parent && p.status === "published" && p.date && p.time && p.format !== "story");
    const at = (p) => new Date(C.parseYmd(p.date).getTime() + C.toMin(p.time) * 6e4).toISOString();
    const media = (n) => pub.filter((p) => (p.networks || []).includes(n)).map((p, i) => {
      const reel = p.format === "reel", views = reel ? rnd(300, 4200) : rnd(80, 900);
      return { key: n + ":demo" + i, at: at(p), kind: reel ? "reel" : p.format, views, likes: Math.round(views * rnd(3, 9) / 100), comments: rnd(0, 14), reach: Math.round(views * 0.7), url: n === "instagram" ? "https://www.instagram.com/" : "https://www.facebook.com/" };
    });
    const t = C.ymd(new Date()); let ig = 410, fb = 120; const history = [];
    for (let i = 95; i >= 0; i--) { ig += rnd(0, 9); fb += rnd(0, 3); const v = rnd(400, 2600); history.push({ d: C.addDays(t, -i), ig, fb, igViews: v, igReach: Math.round(v * rnd(55, 80) / 100), igLikes: Math.round(v * rnd(2, 6) / 100), igComments: rnd(0, 9), igShares: rnd(0, 12), igSaves: rnd(0, 15), igProfile: rnd(3, 40) }); }
    return { updated: new Date().toISOString(), history,
      instagram: { media: media("instagram"), day: { views: history[history.length - 1].igViews }, account: { followers: ig, username: "boulangerie.demo" } },
      facebook: { account: { followers: fb, name: "Boulangerie (démo)" }, media: media("facebook") } };
  };

  (async function boot() {
    await S.init();
    wasMobile = A.isMobile();
    A.ready = true;
    if (S.mode === "demo") document.getElementById("demo-note").hidden = false;
    A.render();
    if (location.hash === "#share") A.receiveShare(); else if (!A.posterHash()) A.maybeTour();
    // App installée : le service worker reçoit les partages du téléphone (voir sw.js).
    if ("serviceWorker" in navigator && S.mode === "api") navigator.serviceWorker.register("sw.js").catch(() => null);
    // Rafraîchit la ligne de l'heure et les statuts chaque minute.
    setInterval(() => { if (!document.getElementById("layer").innerHTML && !A.pending.length && !(document.getElementById("tour") || {}).innerHTML) A.render(); }, 60000);
  })();
})();

// Grille du profil : glisser une case à venir sur une autre échange leurs dates (ordinateur).
(function () {
  let from = null;
  document.addEventListener("dragstart", (e) => { const b = e.target.closest && e.target.closest("[data-pswap]"); if (!b) return; from = b.dataset.pswap; e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", from); } catch (x) { /* rien */ } });
  document.addEventListener("dragover", (e) => { const b = from && e.target.closest && e.target.closest("[data-pswap]"); if (!b) return; e.preventDefault(); document.querySelectorAll(".pgrid .over").forEach((x) => x !== b && x.classList.remove("over")); b.classList.add("over"); });
  document.addEventListener("drop", (e) => { const b = from && e.target.closest && e.target.closest("[data-pswap]"); if (!b) return; e.preventDefault(); const a = from; from = null; if (a !== b.dataset.pswap) window.App.swapDates(a, b.dataset.pswap); });
  document.addEventListener("dragend", () => { from = null; document.querySelectorAll(".pgrid .over").forEach((x) => x.classList.remove("over")); });
})();
