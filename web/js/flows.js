/* PlanneRs : fiche d'un post, validation en lot, poster à la main, échec, recherche, fiches de connexion. */
(function () {
  "use strict";
  const C = window.Core, U = window.UI, S = window.Store, A = window.App;
  const { esc, safeUrl, icon, brand, brands, status } = U;

  const layer = () => document.getElementById("layer");
  A.closeLayer = function () { if (A.beforeClose && A.beforeClose() === false) return; A.beforeClose = null; layer().innerHTML = ""; document.body.style.overflow = ""; if (A.lastFocus) { try { A.lastFocus.focus(); } catch (e) { /* rien */ } } };
  A.openLayer = (h, l) => openLayer(h, l);
  function openLayer(html, label) {
    A.lastFocus = document.activeElement;
    layer().innerHTML = '<div class="scrim" data-close></div><div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(label) + '">' + html + "</div>";
    document.body.style.overflow = "hidden";
    const f = layer().querySelector("[autofocus],.sh-body button,.sh-body textarea,.sh-top button");
    if (f) f.focus();
  }

  const APP_URL = { instagram: "https://www.instagram.com/", facebook: "https://www.facebook.com/", linkedin: "https://www.linkedin.com/feed/", x: "https://x.com/compose/post", threads: "https://www.threads.net/", tiktok: "https://www.tiktok.com/upload", bluesky: "https://bsky.app/", youtube: "https://studio.youtube.com/" };

  // ------------------------------------------------------------ Google Drive (si connecté)
  const relPath = (f) => !!f && !/^https?:\/\//.test(f);
  const driveOn = () => S.mode === "api" && ["gdrive", "onedrive", "dropbox", "webdav"].some((k) => S.state.accounts && S.state.accounts[k] && S.state.accounts[k].status === "ok");
  const driveCache = {};
  A.driveFolder = (path) => driveCache[path] || (driveCache[path] = S.call("GET", "drive/folder?path=" + encodeURIComponent(path)).catch((e) => { delete driveCache[path]; throw e; }));
  A.driveFileUrl = (f) => "api/drive/file/" + encodeURIComponent(f.id) + "?name=" + encodeURIComponent(f.name);

  // ------------------------------------------------------------ Fiche d'un post
  // Aperçu façon Instagram : fil (4:5), Reel (9:16) ou case de la grille du profil (3:4).
  const igUser = () => { const a = (S.state.accounts || {}).instagram; const m = a && /@([\w.]+)/.exec(a.account || ""); return m ? m[1] : ((S.state.settings || {}).spaceName || "mon.compte").toLowerCase().replace(/\s+/g, "."); };
  const igText = (t) => esc(t).replace(/(^|\s)([#@][\p{L}\p{N}_.]+)/gu, '$1<span class="igtag">$2</span>').replace(/\n/g, "<br>");
  function igPreview(p, srcs, mode) {
    const u = igUser(), cap = p.format === "story" ? "" : (p.caption || "");
    const short = cap.length > 125 || (cap.match(/\n/g) || []).length > 1;
    const head = cap.split("\n").slice(0, 2).join("\n").slice(0, 125);
    const capHtml = cap ? '<p class="igcap"><b>' + esc(u) + "</b> " + '<span class="igshort">' + igText(head) + (short ? '… <button class="igmore" type="button">plus</button>' : "") + "</span>" +
      (short ? '<span class="iglong" hidden>' + igText(cap) + "</span>" : "") + "</p>" : "";
    const media = (cls) => srcs.video ? '<video class="' + cls + '" muted playsinline loop preload="metadata" src="' + esc(srcs.video) + '"' + (srcs.poster ? ' poster="' + esc(srcs.poster) + '"' : "") + "></video>"
      : srcs.images.length ? '<img class="' + cls + '" src="' + esc(srcs.images[0]) + '" alt="">' : '<span class="' + cls + ' igph">' + icon("image") + "Pas encore de média</span>";
    const av = '<span class="igav"><i>' + esc(u.charAt(0).toUpperCase()) + "</i></span>";
    const n = srcs.images.length;
    if (mode === "grid") return '<div class="iggrid">' + [0, 1, 2, 3, 4, 5].map((i) => i === 0 ? '<div class="igcell me">' + media("igm") + (srcs.video ? '<span class="igri">' + icon("film") + "</span>" : n > 1 ? '<span class="igri">' + icon("dup") + "</span>" : "") + "</div>" : '<div class="igcell"></div>').join("") +
      '</div><p class="muted igcap">Case du profil en 3:4 : vérifie que le texte important de la couverture reste dans ce cadre.</p>';
    if (mode === "reel") return '<div class="igreel">' + media("igm") + '<div class="igside">' + icon("heart") + icon("bubble") + icon("send") + "</div>" +
      '<div class="igbot"><div class="igu">' + av + "<b>" + esc(u) + '</b><span class="igfollow">Suivre</span></div>' + (cap ? '<p class="igcap1">' + igText(head.split("\n")[0].slice(0, 60)) + (cap.length > 60 ? "… <b>plus</b>" : "") + "</p>" : "") + "</div></div>";
    return '<div class="igpost"><div class="igu">' + av + "<b>" + esc(u) + '</b><span style="flex:1"></span>' + icon("more") + "</div>" +
      '<div class="igframe">' + media("igm") + (n > 1 ? '<span class="igcount">1/' + n + "</span>" : "") + "</div>" +
      '<div class="igacts">' + icon("heart") + icon("bubble") + icon("send") + (n > 1 ? '<span class="igdots">' + Array.from({ length: Math.min(n, 10) }, (_, i) => "<i" + (i ? "" : ' class="on"') + "></i>").join("") + "</span>" : '<span style="flex:1"></span>') + icon("bookmark") + "</div>" +
      capHtml + '<p class="igtime">' + (p.date ? esc(C.longDate(p.date)) : "Pas encore daté") + "</p></div>";
  }
  A.igPreview = igPreview;

  // Aperçu des autres réseaux : la carte telle qu'elle apparaît dans le fil, avec la coupure « voir plus »
  // et ce qui dépasse la limite de caractères en rouge.
  const NETPV = { x: { max: 280, imgs: 4 }, bluesky: { max: 300, imgs: 4 }, threads: { max: 500, imgs: 10 }, mastodon: { max: 500, imgs: 4 }, linkedin: { max: 3000, more: 210, imgs: 1 }, facebook: { more: 480, imgs: 4 } };
  A.netPreviewNets = (p) => (p.networks || []).filter((n) => NETPV[n]);
  function netPreview(p, net, srcs) {
    const cfg = NETPV[net], b = window.BRANDS[net] || { title: net };
    const name = ((S.state.settings || {}).workspace || {}).name || "Mon compte";
    const acc = ((S.state.accounts || {})[net] || {}).account || "";
    const handle = (/@[\w.:-]+/.exec(acc) || [""])[0] || "@" + name.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const text = C.textOut(p, net, S.state.settings), chars = [...text];
    let body;
    if (cfg.max && chars.length > cfg.max) body = igText(chars.slice(0, cfg.max).join("")) + '<mark class="npover">' + igText(chars.slice(cfg.max).join("")) + "</mark>";
    else if (cfg.more && chars.length > cfg.more) body = igText(chars.slice(0, cfg.more).join("")) + '<span class="npmore">… voir plus</span>';
    else body = igText(text);
    const imgs = srcs.images.slice(0, cfg.imgs);
    const med = srcs.video ? '<div class="npmed one"><video muted playsinline preload="metadata" src="' + esc(srcs.video) + '"' + (srcs.poster ? ' poster="' + esc(srcs.poster) + '"' : "") + "></video></div>"
      : imgs.length ? '<div class="npmed ' + (imgs.length === 1 ? "one" : "n" + Math.min(imgs.length, 4)) + '">' + imgs.slice(0, 4).map((u) => '<img src="' + esc(u) + '" alt="">').join("") + "</div>" : "";
    const lim = cfg.max ? '<p class="muted npcount' + (chars.length > cfg.max ? " over" : "") + '">' + chars.length + " / " + cfg.max + " caractères" + (srcs.images.length > cfg.imgs ? " · " + cfg.imgs + (cfg.imgs > 1 ? " images max" : " image affichée") : "") + "</p>" : "";
    return '<div class="nppost np-' + net + '"><div class="npu"><span class="npav">' + esc(name.charAt(0).toUpperCase()) + "</span><span><b>" + esc(name) + '</b><small>' + esc(net === "linkedin" || net === "facebook" ? "À l'instant" : handle) + "</small></span>" + brand(net) + "</div>" +
      '<p class="nptext">' + (body || '<span class="muted">Pas encore de texte</span>') + "</p>" + med + "</div>" + lim;
  }
  A.netPreview = netPreview;

  A.openPost = function (id, opts) {
    opts = opts || {};
    const p0 = S.post(id); if (!p0) return;
    const p = A.eff(p0);
    const now = C.nowStamp();
    const st = C.displayStatus(p, now);
    const done = p.status === "published";
    const set = S.state.settings;
    const kids = S.state.posts.filter((k) => k.parent === p.id);
    const parent = p.parent ? S.post(p.parent) : null;
    const checks = C.checks(p, set);
    // Brouillon pas encore programmé : la liste reste neutre, elle passe au rouge au clic sur « Programmer ».
    const soft = (p.status === "draft" || p.status === "ready") && !p.date && !(A.strict || {})[p.id];
    const vid = (p.media || []).find((m) => m.url && (m.type === "video" || /\.(mp4|mov|webm)$/i.test(m.name || m.url)));
    const imgs = (p.media || []).filter((m) => m.url && m !== vid && m.role !== "cover" && m.role !== "guide" && /^image/.test(m.type || "image") && !/\.(mp4|mov|webm)$/i.test(m.url));
    const driveThumb = (u, w) => { const id = (/drive\.google\.com\/.*(?:id=|\/d\/)([\w-]{20,})/.exec(u) || [])[1]; return id ? "https://drive.google.com/thumbnail?id=" + id + "&sz=w" + (w || 600) : u; };
    const isImg = (m) => /^image/.test(m.type || "") || /\.(jpe?g|png|gif|webp|avif|heic)$/i.test(m.name || m.url || "");
    const lbAttr = (url, name) => ' data-lb="' + esc(driveThumb(url, 1600)) + '" data-lbname="' + esc(name || "") + '" data-lborig="' + safeUrl(url) + '"';
    const isUrl = (u) => /^https?:\/\//.test(u || "");
    const preview = vid ? '<video class="pv" controls preload="none" playsinline src="' + esc(vid.url) + '"' + (p.thumb ? ' poster="' + safeUrl(p.thumb) + '"' : "") + "></video>"
      : imgs.length ? imgs.map((m, i) => '<a href="' + safeUrl(m.url) + '"' + lbAttr(m.url, m.name) + ' aria-label="Agrandir l\'image ' + (i + 1) + (imgs.length > 1 ? " sur " + imgs.length : "") + '"><img src="' + esc(driveThumb(m.url)) + '" alt="' + esc(m.name || "") + '" loading="lazy"></a>').join("")
      : (p.thumb ? '<a href="' + safeUrl(p.thumb) + '"' + lbAttr(p.thumb, "Couverture") + ' aria-label="Agrandir la couverture"><img src="' + safeUrl(p.thumb) + '" alt="Couverture"></a>' : "");
    const folder = p.folder ? (isUrl(p.folder) ? '<p><a href="' + safeUrl(p.folder) + '" target="_blank" rel="noopener">Ouvrir le dossier</a></p>' : '<p class="muted" id="drv" data-post="' + esc(p.id) + '">Dossier : ' + esc(p.folder) + (driveOn() ? " · recherche…" : "") + "</p>") : "";
    const media = (p.media || []).length ? (preview ? '<div class="media">' + preview + "</div>" : "") +
      '<div class="box"><h4>Fichiers</h4><p id="drv-files">' + p.media.map((m) => isUrl(m.url) ? '<a href="' + safeUrl(m.url) + '"' + (isImg(m) ? lbAttr(m.url, m.name) : ' target="_blank" rel="noopener"') + ">" + esc(m.name) + "</a>" : esc(m.name)).join("<br>") + "</p>" + folder + "</div>" : "";
    const igSrc = { video: vid && vid.url, poster: p.thumb, images: imgs.map((m) => driveThumb(m.url)).concat(!imgs.length && !vid && p.thumb ? [p.thumb] : []) };
    const igModes = p.format === "reel" || p.format === "video" ? [["reel", "Reel"], ["feed", "Fil"], ["grid", "Profil"]] : p.format === "story" ? [] : [["feed", "Fil"], ["grid", "Profil"]];
    const igBox = (p.networks || []).includes("instagram") && igModes.length ? '<details class="box igbox"><summary style="cursor:pointer;font-weight:600">' + icon("eye") + " Aperçu sur Instagram</summary>" +
      '<div class="seg" role="group" aria-label="Vue" style="margin:10px 0">' + igModes.map(([v, l], i) => '<button type="button" data-igmode="' + v + '" aria-pressed="' + !i + '">' + l + "</button>").join("") + "</div>" +
      '<div class="igwrap">' + igPreview(p, igSrc, igModes[0][0]) + "</div></details>" : "";
    const npNets = p.format === "story" ? [] : A.netPreviewNets(p);
    const netBox = npNets.length ? '<details class="box netbox"><summary style="cursor:pointer;font-weight:600">' + icon("eye") + " Aperçu sur " + (npNets.length === 1 ? esc(window.BRANDS[npNets[0]].title) : "les autres réseaux") + "</summary>" +
      (npNets.length > 1 ? '<div class="seg" role="group" aria-label="Réseau" style="margin:10px 0">' + npNets.map((n, i) => '<button type="button" data-npnet="' + n + '" aria-pressed="' + !i + '">' + esc(window.BRANDS[n].title) + "</button>").join("") + "</div>" : '<div style="height:10px"></div>') +
      '<div class="npwrap">' + netPreview(p, npNets[0], igSrc) + "</div></details>" : "";
    let fail = "";
    if (p.status === "failed") {
      const f = p.failure || {};
      fail = '<div class="box" style="border-color:var(--fail)"><h4>Ce qui s\'est passé</h4><p>' + esc(f.what || "L'envoi a échoué.") + "</p><h4>Pourquoi</h4><p>" + esc(f.why || "Voir le journal.") + "</p><h4>Ce que tu peux faire</h4><p>" + esc(f.todo || "Réessayer, poster à la main, ou reprogrammer.") + "</p></div>";
    }
    const res = p.results ? '<div class="box"><h4>Par réseau</h4><div class="netres">' + Object.entries(p.results).map(([n, r]) =>
      "<div>" + brand(n) + "<span>" + (r.status === "ok" ? "Publié" : r.status === "failed" ? "Échec" + (r.code ? " (" + esc(r.code) + ")" : "") : r.status === "skipped" ? "Non tenté" : esc(r.status)) +
      (r.error ? ' <span class="muted">· ' + esc(r.status === "skipped" ? String(r.error).replace(/^Non tenté\s*:\s*/i, "") : r.error) + "</span>" : "") + (r.url ? ' · <a href="' + safeUrl(r.url) + '" target="_blank" rel="noopener">voir</a>' : "") + "</span></div>").join("") + "</div></div>" : "";
    const slotOpts = S.state.settings.slots.map((s) => '<option value="' + s.time + '"' + (p.time === s.time ? " selected" : "") + ">" + s.time + " · " + esc(s.label) + "</option>").join("");
    const isSlot = !p.time || S.state.settings.slots.some((s) => s.time === p.time);
    const move = done ? "" : '<details class="box" id="mv"' + (opts.move ? " open" : "") + '><summary style="cursor:pointer;font-weight:600">' + icon("calendar") + " Changer la date</summary><div class=\"form\" style=\"margin-top:10px\">" +
      '<label>Jour<input type="date" id="mv-date" value="' + (p.date || "") + '"></label>' +
      '<label>Créneau<select id="mv-slot">' + slotOpts + '<option value="other"' + (isSlot ? "" : " selected") + '>Autre heure…</option></select></label>' +
      '<label id="mv-other"' + (isSlot ? " hidden" : "") + '>Heure<input type="time" id="mv-time" value="' + (p.time || "12:00") + '"></label>' +
      (kids.length ? '<p class="muted" style="margin:0;font-size:12px">' + kids.length + " élément" + (kids.length > 1 ? "s liés suivent" : " lié suit") + " (" + kids.map((k) => esc(C.FORMATS[k.format]) + " " + k.time).join(", ") + ").</p>" : "") +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-act="move">Déplacer</button>' + (p.date ? '<button class="btn" data-act="unschedule">Retirer du calendrier</button>' : "") + "</div></div></details>";
    const fresh = p.status === "draft" && !p.date && !(p.caption || "").trim();
    const info = done ? "" : '<details class="box" id="ed"' + (fresh || opts.edit ? " open" : "") + '><summary style="cursor:pointer;font-weight:600">' + icon("pen") + ' Titre, format, réseaux et options</summary><div class="form" style="margin-top:10px">' +
      '<label>Titre<input id="ed-title" value="' + esc(p.title) + '"></label>' +
      '<label>Format<select id="ed-format">' + Object.entries(C.FORMATS).map(([k, l]) => '<option value="' + k + '"' + (p.format === k ? " selected" : "") + ">" + l + "</option>").join("") + "</select></label>" +
      '<fieldset style="border:0;padding:0;margin:0"><legend style="font-weight:600;font-size:13px;margin-bottom:4px">Réseaux</legend><div class="filters">' +
      A.nets().map((n) => '<label class="chip"><input type="checkbox" data-ed-net="' + n + '"' + (p.networks.includes(n) ? " checked" : "") + ">" + brand(n) + esc(window.BRANDS[n].title) + "</label>").join("") + "</div>" +
      (((set.templates || {}).sets || []).filter((g) => g.name && (g.networks || []).length).length ? '<div class="tplrow"><span class="muted">Ensembles</span>' + (set.templates.sets || []).map((g, i) => (g.name && (g.networks || []).length ? '<button type="button" class="chip sm" data-ed-set="' + i + '" title="' + esc(g.networks.map((n) => (window.BRANDS[n] ? window.BRANDS[n].title : n)).join(", ")) + '">' + esc(g.name) + "</button>" : "")).join("") + "</div>" : "") + "</fieldset>" +
      '<label class="toggle"><input type="checkbox" id="ed-manual"' + (p.manual ? " checked" : "") + "> Publier à la main (rappel au lieu d'un envoi automatique)</label>" +
      (p.format === "story" || !p.networks.some((n) => n === "instagram" || n === "facebook") ? "" : '<label>Premier commentaire (facultatif)<textarea id="ed-fc" rows="2" placeholder="Hashtags, lien… posté juste après la publication">' + esc(p.firstComment || "") + "</textarea></label>" +
        '<p class="muted" style="margin:-6px 0 0;font-size:12px">Ajouté sous le post sur Instagram et Facebook. S\'il est refusé, le post reste publié et l\'Activité te le dit.</p>') +
      (p.format === "text" ? "" : '<label>Description des images (texte alternatif)<textarea id="ed-alt" rows="2" placeholder="Ce qu\'on voit sur l\'image, pour les personnes qui ne la voient pas">' + esc(p.alt || "") + "</textarea></label>" +
        '<p class="muted" style="margin:-6px 0 0;font-size:12px">Envoyée à Bluesky, Mastodon, X et LinkedIn, lue par les lecteurs d\'écran.</p>') +
      '<div><button class="btn" data-act="saveinfo">Enregistrer</button></div></div></details>';

    let foot = "";
    if (st === "failed") {
      const relayBlocked = set.rules && set.rules.noRetryRelay && p.results && Object.values(p.results).some((r) => r.status === "ok");
      foot = '<button class="btn primary" data-act="retry"' + (relayBlocked ? " disabled" : "") + ">Réessayer maintenant</button><button class=\"btn\" data-act=\"manual\">Poster à la main</button><button class=\"btn\" data-act=\"showmove\">Reprogrammer</button>" +
        (relayBlocked ? '<p class="muted" style="font-size:12px;margin:4px 0 0;width:100%">Réessayer est désactivé : un réseau a déjà publié, relancer créerait un doublon. Publie le relais à la main.</p>' : "");
    } else if (st === "review" && !A.canValidate()) foot = '<span class="muted" style="font-size:13px">En attente d\'un validateur</span><button class="btn" data-act="showmove">Changer la date</button>';
    else if (st === "review") foot = '<button class="btn primary" data-act="validate">' + (p.format === "story" ? "Valider la story" : "Valider la légende") + '</button><button class="btn" data-act="showmove">Changer la date</button>';
    else if (st === "manual" || st === "late") foot = '<button class="btn primary" data-act="manual">Poster à la main</button><button class="btn" data-act="showmove">Changer la date</button>' + (st === "late" ? '<button class="btn" data-act="ignore">Ignorer</button>' : "");
    else if (st === "scheduled") foot = '<button class="btn" data-act="showmove">Changer la date</button><button class="btn" data-act="unvalidate">Retirer la validation</button>' + (A.stageOf && A.stageOf(p) === "scheduled" ? '<button class="btn" data-unlock="' + esc(p.id) + '">' + icon("unlock") + "Débloquer</button>" : "");
    else if (st === "ready" || st === "draft") foot = '<button class="btn primary" data-act="showmove">Programmer</button>' + (st === "draft" ? '<button class="btn" data-act="toready">Marquer prêt</button>' : "");
    else if (done) foot = (p.url ? '<a class="btn primary" href="' + safeUrl(p.url) + '" target="_blank" rel="noopener">' + icon("open") + "Voir le post</a>" : "") + (p.parent ? "" : '<button class="btn" data-act="recycle">' + icon("undo") + "Reprendre plus tard</button>");
    if (!done) foot += '<button class="btn" data-act="compose">' + icon("pen") + "Modifier</button>";
    foot += '<span style="flex:1"></span><details class="moremenu"><summary class="btn quiet" aria-label="Plus d\'actions">' + icon("more") + '<span class="lbl2">Plus</span></summary><div class="mm-list" role="menu">' +
      '<button class="btn quiet" role="menuitem" data-act="dup">' + icon("dup") + "Dupliquer</button>" +
      (done ? "" : '<button class="btn quiet" role="menuitem" data-act="share">' + icon("send") + "Lien de validation client</button>") +
      (p.date && !p.parent ? '<button class="btn quiet" role="menuitem" data-act="repeat">' + icon("calendar") + "Répéter…</button>" : "") +
      (done ? "" : '<button class="btn quiet danger" role="menuitem" data-act="del">' + icon("trash") + "Supprimer</button>") + "</div></details>";

    // Légende par réseau : onglets « Tous » + un par réseau (vide = même légende).
    const own = (n) => !!(p.captions && p.captions[n] && p.captions[n].trim());
    const capTabs = p.format !== "story" && p.networks.length > 1 ? '<div class="captabs" role="tablist" aria-label="Légende par réseau"><button type="button" role="tab" data-capnet="" aria-selected="true">Tous</button>' +
      p.networks.map((n) => '<button type="button" role="tab" data-capnet="' + n + '" aria-selected="false" title="Version pour ' + esc(window.BRANDS[n] ? window.BRANDS[n].title : n) + '">' + brand(n) + (own(n) ? '<i class="own" aria-label="version propre"></i>' : "") + "</button>").join("") + "</div>" : "";
    const tpl = set.templates || {}, tags = tpl.tags || [];
    const tplRow = done || p.format === "story" ? "" : (tpl.signature || tags.length)
      ? '<div class="tplrow"><span class="muted">Insérer</span>' + (tpl.signature ? '<button type="button" class="chip sm" data-tpl="sig">' + icon("pen") + "Signature</button>" : "") + tags.map((t, i) => '<button type="button" class="chip sm" data-tpl="' + i + '">#&nbsp;' + esc(t.name) + "</button>").join("") + "</div>"
      : '<div class="tplrow"><button type="button" class="lk muted" data-settab="templates">' + icon("plus") + "Modèles de signature et de hashtags</button></div>";
    const html = '<div class="sh-top">' + brands(p.networks, "lg") + '<span class="muted" style="font-size:13px">' + esc(C.FORMATS[p.format] || "") + (p.date ? " · " + esc(C.longDate(p.date)) + " · " + p.time : " · sans date") + "</span>" +
      '<span style="flex:1"></span><button class="iconbtn" data-close aria-label="Fermer">' + icon("x") + "</button></div>" +
      '<div class="sh-body"><div class="meta">' + status(st) + (p.ref ? '<span class="mono">' + esc(p.ref) + "</span>" : "") + (p.category ? "<span>" + esc(p.category) + "</span>" : "") + "</div>" +
      "<h2>" + esc(p.title) + "</h2>" +
      (parent ? '<p class="muted" style="margin:0">Lié à <button class="btn quiet" style="min-height:24px;padding:0 4px" data-open="' + parent.id + '">' + esc(parent.title) + "</button> : il suit ses déplacements.</p>" : "") +
      fail + res + (done ? "" : info) + media + igBox + netBox +
      (p.format === "story" ? '<div class="box"><h4>Consigne</h4><p>' + (p.note ? esc(p.note) : "Aucune.") + '</p><p class="muted">Une story n\'a pas de légende : rien n\'est écrit sous l\'image.</p></div>' :
      '<div><div class="caphead"><label for="cap" style="font-weight:600;font-size:13px">Légende</label>' + capTabs + "</div>" + '<p class="muted caphint" id="caphint" hidden></p>' + (done ? "" : '<button type="button" class="lk muted rwbtn" id="rw" data-act="rewrite" hidden>' + icon("spark") + '<span>Réécrire avec Claude</span></button>') + '<textarea id="cap" class="caption"' + (done ? " readonly" : "") + ">" + esc(p.caption || "") + "</textarea>" + tplRow + '<div class="cmeta"><span id="capn">' + (p.caption || "").length + " caractères · " + C.hashtags(p.caption) + ' hashtags</span><span><button class="btn quiet" style="min-height:26px" data-act="copy">' + icon("copy") + "Copier</button>" +
      (done ? "" : '<button class="btn sm primary" data-act="savecap" id="savecap" hidden>' + icon("check") + "Enregistrer la légende</button>" + (opts.saved ? '<span class="saved" role="status">' + icon("check") + "Enregistré</span>" : "")) + "</span></div></div>") +
      move + '<div><h3 class="sec-h"><span id="chk-h">' + (soft ? "À compléter avant de programmer" : "Avant envoi") + '</span></h3><ul class="checks">' + checks.map((c) => '<li class="' + (soft && c.level !== "ok" ? "todo" : c.level) + '" data-level="' + c.level + '">' + icon(c.level === "ok" ? "check" : soft ? "pen" : c.level === "block" ? "x" : "alert") + "<span>" + esc(c.text) + "</span></li>").join("") + "</ul>" +
        (!done && /https?:\/\//.test([p.caption, p.firstComment].concat(Object.values(p.captions || {})).join(" ")) ? '<button type="button" class="lk muted" data-act="links">' + icon("link") + (p.linkCheck ? "Liens vérifiés " + esc(String(p.linkCheck.at || "").slice(11, 16) ? "le " + C.shortDay(p.linkCheck.at.slice(0, 10)) + " à " + p.linkCheck.at.slice(11, 16) : "") + " · revérifier" : "Vérifier les liens") + "</button>" : "") + "</div>" +
      '<div class="comments"><h3 class="sec-h"><span>Commentaires' + ((p.comments || []).length ? " · " + p.comments.length : "") + "</span></h3>" +
      (p.comments || []).map((c) => '<div class="cm"><div class="cm-h"><b>' + esc(c.by || "Quelqu'un") + '</b><time class="muted">' + esc(C.shortDay(String(c.at).slice(0, 10))) + " " + esc(String(c.at).slice(11, 16)) + "</time></div><p>" + esc(c.text) + "</p></div>").join("") +
      '<div class="cm-new"><textarea id="cm-text" rows="2" placeholder="Écrire un commentaire…" aria-label="Nouveau commentaire"></textarea><button class="btn sm" data-act="comment">Envoyer</button></div></div>' +
      (kids.length ? '<div class="box"><h4>Suit ce post</h4>' + kids.map((k) => '<p><button class="btn quiet kidlink" data-open="' + k.id + '">' + brands(k.networks) + " " + esc(C.FORMATS[k.format]) + " " + k.time + " · " + esc(k.title) + "</button></p>").join("") + "</div>" : "") +
      "</div><div class=\"sh-foot\">" + foot + "</div>";
    openLayer(html, p.title);
    const L = layer();
    if (relPath(p.folder) && driveOn()) A.driveFolder(p.folder).then((d) => {
      const el = L.querySelector('#drv[data-post="' + CSS.escape(p.id) + '"]'); if (!el) return;
      el.classList.remove("muted");
      el.innerHTML = '<a href="' + safeUrl(d.url) + '" target="_blank" rel="noopener">' + icon("open") + " Ouvrir le dossier</a>";
      const fl = L.querySelector("#drv-files");
      if (fl) fl.innerHTML = p.media.map((m) => { const f = d.files.find((x) => x.name === m.name); const lk = (u) => (isImg(m) ? lbAttr(u, m.name) : ' target="_blank" rel="noopener"'); return f ? '<a href="' + safeUrl(f.url) + '"' + lk(f.url) + ">" + esc(m.name) + "</a>" : /^https?:/.test(m.url || "") ? '<a href="' + safeUrl(m.url) + '"' + lk(m.url) + ">" + esc(m.name) + "</a>" : esc(m.name) + " (absent du dossier)"; }).join("<br>");
    }).catch((e) => { const el = L.querySelector("#drv"); if (el) el.textContent = "Dossier : " + p.folder + " (" + e.message.replace(/^\{.*"error":"([^"]+)".*$/, "$1") + ")"; });
    const cap = L.querySelector("#cap");
    // Brouillons de légende : "" = commune, sinon par réseau.
    const drafts = L._drafts = Object.assign({ "": p0.caption || "" }, p0.captions || {});
    L._cur = "";
    const count = () => {
      const n = L._cur, max = n && C.TEXT_MAX[n], len = [...cap.value].length;
      const capn = L.querySelector("#capn");
      capn.textContent = (max ? len + " / " + max : len) + " caractères · " + C.hashtags(cap.value) + " hashtags";
      capn.classList.toggle("over", !!(max && len > max));
      const sb = L.querySelector("#savecap"); if (sb) sb.hidden = !capsDirty(L, p0);
    };
    cap && cap.addEventListener("input", () => { drafts[L._cur] = cap.value; count(); });
    L.querySelectorAll("[data-capnet]").forEach((b) => b.addEventListener("click", () => {
      drafts[L._cur] = cap.value; L._cur = b.dataset.capnet;
      L.querySelectorAll("[data-capnet]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      cap.value = drafts[L._cur] || ""; cap.placeholder = L._cur ? drafts[""] : "";
      const h = L.querySelector("#caphint"), nm = L._cur && window.BRANDS[L._cur] ? window.BRANDS[L._cur].title : L._cur;
      h.hidden = !L._cur; h.textContent = L._cur ? "Version pour " + nm + ". Laisse vide pour reprendre la légende commune." : "";
      const rw = L.querySelector("#rw"); if (rw) { rw.hidden = !L._cur || !(S.state.rewrite || S.mode !== "api"); rw.lastChild.textContent = "Réécrire pour " + nm + " avec Claude"; }
      count(); cap.focus();
    }));
    L.querySelectorAll("[data-ed-set]").forEach((b) => b.addEventListener("click", () => {
      const g = ((set.templates || {}).sets || [])[+b.dataset.edSet]; if (!g) return;
      L.querySelectorAll("[data-ed-net]").forEach((x) => { x.checked = g.networks.includes(x.dataset.edNet); });
      U.toast("Réseaux cochés : " + g.name + ". Enregistre pour appliquer.");
    }));
    L.querySelectorAll("[data-tpl]").forEach((b) => b.addEventListener("click", () => {
      const t = b.dataset.tpl === "sig" ? tpl.signature : (tags[+b.dataset.tpl] || {}).text;
      if (!t) return;
      const v = cap.value.replace(/\s+$/, "");
      cap.value = (v ? v + "\n\n" : "") + t; drafts[L._cur] = cap.value; count(); cap.focus();
    }));
    const igb = L.querySelector(".igbox");
    if (igb) igb.addEventListener("click", (e) => {
      const m = e.target.closest("[data-igmode]");
      if (m) { igb.querySelectorAll("[data-igmode]").forEach((x) => x.setAttribute("aria-pressed", String(x === m))); const cur = Object.assign({}, A.eff(S.post(p.id))); if (cap) cur.caption = cap.value; igb.querySelector(".igwrap").innerHTML = igPreview(cur, igSrc, m.dataset.igmode); return; }
      if (e.target.closest(".igmore")) { const c = e.target.closest(".igcap"); c.querySelector(".igshort").hidden = true; c.querySelector(".iglong").hidden = false; }
    });
    const npb = L.querySelector(".netbox");
    const npDraw = (net) => { const cur = Object.assign({}, A.eff(S.post(p.id))); if (cap && L._drafts) { L._drafts[L._cur || ""] = cap.value; cur.caption = L._drafts[""] != null ? L._drafts[""] : cur.caption; const own = {}; cur.networks.forEach((n) => { if ((L._drafts[n] || "").trim()) own[n] = L._drafts[n]; }); cur.captions = own; } npb.querySelector(".npwrap").innerHTML = netPreview(cur, net, igSrc); };
    if (npb) {
      npb.addEventListener("click", (e) => { const m = e.target.closest("[data-npnet]"); if (!m) return; npb.querySelectorAll("[data-npnet]").forEach((x) => x.setAttribute("aria-pressed", String(x === m))); npDraw(m.dataset.npnet); });
      npb.addEventListener("toggle", () => { if (npb.open) { const on = npb.querySelector('[data-npnet][aria-pressed="true"]'); npDraw(on ? on.dataset.npnet : npNets[0]); } });
    }
    if (igb) igb.addEventListener("toggle", () => { const v = igb.querySelector("video"); if (v && igb.open) v.play().catch(() => {}); });
    const sel = L.querySelector("#mv-slot");
    sel && sel.addEventListener("change", () => { L.querySelector("#mv-other").hidden = sel.value !== "other"; });
    L.querySelector(".sheet").addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]"); if (!b) return;
      sheetAction(b.dataset.act, p0, L);
    });
  };

  // Les légendes ont-elles changé (commune ou par réseau) ?
  function capsDirty(L, p) {
    const d = L._drafts; if (!d) return false;
    const cap = L.querySelector("#cap"); if (cap) d[L._cur] = cap.value;
    if ((d[""] || "") !== (p.caption || "")) return true;
    return p.networks.some((n) => (d[n] || "").trim() !== ((p.captions || {})[n] || "").trim());
  }
  function applyCaps(L, p) {
    const d = L._drafts; p.caption = d[""] || "";
    const own = {}; p.networks.forEach((n) => { const v = (d[n] || "").trim(); if (v && v !== p.caption.trim()) own[n] = d[n]; });
    if (Object.keys(own).length) p.captions = own; else delete p.captions;
    delete p.linkCheck; // la légende a changé : les liens seront revérifiés
  }
  async function sheetAction(act, p, L) { // eslint-disable-line no-param-reassign
    const cap = L.querySelector("#cap");
    const capChanged = cap && capsDirty(L, p);
    switch (act) {
      case "copy": U.copy(cap ? cap.value : p.caption || ""); return;
      case "compose": A.closeLayer(); A.compose(p.id); return;
      case "savecap":
        applyCaps(L, p); p.captionValidated = false;
        await S.savePosts([p]); await S.log({ level: "change", text: "Légende modifiée : " + p.title + " (à valider)", postId: p.id });
        U.toast("Légende enregistrée, à valider"); A.render(); A.openPost(p.id, { saved: true }); return;
      case "validate":
        if (A.denyValidate()) return;
        if (capChanged) applyCaps(L, p);
        p.captionValidated = true; if (p.stage === "caption") p.stage = "ready";
        await S.savePosts([p]); await S.log({ level: "change", text: "Légende validée : " + p.title, postId: p.id });
        U.toast("Légende validée : il partira à l'heure prévue"); break;
      case "unvalidate": p.captionValidated = false; await S.savePosts([p]); U.toast("Validation retirée : il ne partira pas"); break;
      case "showmove": {
        if (!(A.strict || {})[p.id] && L.querySelector(".checks li.todo")) { (A.strict = A.strict || {})[p.id] = true; A.openPost(p.id, { move: true }); L = layer(); }
        (A.strict = A.strict || {})[p.id] = true;
        const d = L.querySelector("#mv"); d.open = true; d.scrollIntoView({ block: "center" }); L.querySelector("#mv-date").focus(); return; }
      case "move": {
        const date = L.querySelector("#mv-date").value;
        const sv = L.querySelector("#mv-slot").value;
        const time = sv === "other" ? L.querySelector("#mv-time").value : sv;
        if (!date || !time) { U.toast("Choisis un jour et une heure"); return; }
        const cur = A.eff(p);
        if (cur.date === date && cur.time === time) { U.toast("Même jour et même heure : rien à changer"); return; }
        A.queueMove(p.id, { date, time }); A.closeLayer(); A.render(); return;
      }
      case "unschedule": A.queueMove(p.id, { date: null, time: null }); A.closeLayer(); A.render(); return;
      case "retry": {
        U.toast("Nouvel essai en cours…");
        try { await S.retry(p.id); await S.log({ level: "ok", text: "Nouvel essai réussi : " + p.title, postId: p.id }); U.toast("Publié"); }
        catch (e) { await S.log({ level: "error", text: "Nouvel essai refusé : " + p.title, why: String(e.message || e), postId: p.id }); U.toast("Toujours en échec : voir le journal"); }
        break;
      }
      case "manual": A.closeLayer(); A.openManual(p.id); return;
      case "ignore": p.ignored = true; await S.savePosts([p]); await S.log({ level: "change", text: "Rappel ignoré : " + p.title, postId: p.id }); break;
      case "toready": p.status = "ready"; p.stage = "ready"; await S.savePosts([p]); break;
      case "saveinfo": {
        p.title = L.querySelector("#ed-title").value.trim() || p.title;
        p.format = L.querySelector("#ed-format").value;
        const nets = [...L.querySelectorAll("[data-ed-net]")].filter((x) => x.checked).map((x) => x.dataset.edNet);
        if (!nets.length) { U.toast("Choisis au moins un réseau"); return; }
        p.networks = nets; p.manual = L.querySelector("#ed-manual").checked;
        const fc = L.querySelector("#ed-fc"); if (fc) { if (fc.value.trim()) p.firstComment = fc.value.trim(); else delete p.firstComment; }
        const alt = L.querySelector("#ed-alt"); if (alt) { if (alt.value.trim()) p.alt = alt.value.trim(); else delete p.alt; }
        await S.savePosts([p]); U.toast("Enregistré"); A.render(); A.openPost(p.id, { saved: true }); return;
      }
      case "dup": {
        const c = JSON.parse(JSON.stringify(p));
        c.id = "c" + Date.now().toString(36); c.status = "ready"; c.date = null; c.time = null; c.captionValidated = false;
        delete c.results; delete c.failure; delete c.url; c.title = p.title + " (copie)"; c.stage = "ready";
        await S.savePosts([c]); U.toast("Copie ajoutée dans « Prêts à programmer »"); A.closeLayer(); A.render(); A.openPost(c.id); return;
      }
      case "repeat": A.openRepeat(p.id); return;
      case "recycle": A.openRecycle(p.id); return;
      case "links": {
        if (S.mode !== "api") { U.toast("Mode démo : les liens ne sont pas vérifiés"); return; }
        U.toast("Vérification des liens…");
        try { const r = await S.call("POST", "posts/" + encodeURIComponent(p.id) + "/links"); Object.assign(p, { linkCheck: r.post.linkCheck }); S.persist(); const n = (p.linkCheck.bad || []).length; U.toast(n ? (n > 1 ? n + " liens ne répondent pas" : "Un lien ne répond pas") : "Tous les liens répondent"); A.render(); A.openPost(p.id); }
        catch (x) { U.toast("Vérification impossible : " + x.message); }
        return;
      }
      case "rewrite": {
        const net = L._cur, btn = L.querySelector("#rw"); if (!net || !cap) return;
        if (S.mode !== "api") { U.toast("Mode démo : la réécriture demande une clé Claude sur ton instance"); return; }
        L._drafts[net] = cap.value;
        if (cap.value.trim() && !confirm("Remplacer la version actuelle par une proposition de Claude ?")) return;
        btn.disabled = true; U.toast("Claude réécrit la légende…");
        try {
          const r = await S.call("POST", "posts/" + encodeURIComponent(p.id) + "/rewrite", { net, caption: L._drafts[""] || "" });
          if (L._cur !== net) return;
          cap.value = r.text; L._drafts[net] = r.text; cap.dispatchEvent(new Event("input"));
          U.toast(r.over ? "Proposition un peu trop longue : raccourcis-la avant d'enregistrer" : "Proposition de Claude : relis-la, puis enregistre la légende");
        } catch (x) { U.toast("Réécriture impossible : " + x.message); }
        finally { btn.disabled = false; }
        return;
      }
      case "share": A.shareLink([p.id]); return;
      case "comment": {
        const ta = L.querySelector("#cm-text"), txt = ta && ta.value.trim(); if (!txt) return;
        (p.comments = p.comments || []).push({ at: C.nowStamp(), by: A.me() || "Moi", text: txt });
        await S.savePosts([p]); await S.log({ level: "info", text: "Commentaire sur « " + p.title + " » : " + txt.slice(0, 140), postId: p.id });
        A.render(); A.openPost(p.id); const n = layer().querySelector("#cm-text"); if (n) n.scrollIntoView({ block: "center" }); return;
      }
      case "del":
        if (!confirm("Supprimer « " + p.title + " » ?")) return;
        await S.deletePost(p.id); await S.log({ level: "change", text: "Post supprimé : " + p.title }); A.closeLayer(); A.render(); return;
    }
    A.render(); A.openPost(p.id);
  }

  // ------------------------------------------------------------ Changements en attente
  A.queueMove = function (id, to) {
    const p = S.post(id);
    if (!p) return;
    A.pending = A.pending.filter((c) => c.id !== id);
    if (p.date !== to.date || p.time !== to.time) A.pending.push({ id, to });
    A.renderPending();
  };
  A.describe = function (c) {
    const p = S.post(c.id);
    const kids = S.state.posts.filter((k) => k.parent === p.id);
    const from = p.date ? C.shortDay(p.date) + " " + p.time : "réserve";
    const to = c.to.date ? C.shortDay(c.to.date) + " " + c.to.time : "« Prêts à programmer »";
    const relays = (p.networks || []).slice(1).map((n) => "relais " + window.BRANDS[n].title);
    const extra = relays.concat(kids.map((k) => (k.role === "teaser" ? "teaser" : C.FORMATS[k.format]) + " " + (c.to.date ? "suit" : "retiré aussi")));
    return (p.ref ? p.ref + " " : "") + p.title + " : " + from + " → " + to + (extra.length ? ", avec " + extra.join(" et ") : "");
  };
  A.renderPending = function () {
    const bar = document.getElementById("pending");
    if (!A.pending.length) { bar.hidden = true; bar.innerHTML = ""; return; }
    bar.hidden = false;
    bar.innerHTML = '<div class="txt"><b>' + A.pending.length + " changement" + (A.pending.length > 1 ? "s" : "") + " en attente</b><span class=\"muted\">Rien ne bouge avant « Appliquer ».</span><ul>" +
      A.pending.map((c) => "<li>" + esc(A.describe(c)) + "</li>").join("") + "</ul></div>" +
      '<button class="btn quiet" data-pend="undo" title="Annuler le dernier (Ctrl+Z)">' + icon("undo") + '<span class="sr">Annuler le dernier</span></button><button class="btn" data-pend="cancel">Tout annuler</button><button class="btn primary" data-pend="apply">Appliquer</button>';
  };
  // Confirmation avant un déplacement (désactivable : Réglages › Règles d'envoi).
  A.confirmMove = function (title, text, ok) {
    const rules = (S.state.settings.rules = S.state.settings.rules || {});
    if (rules.confirmMoves === false) return Promise.resolve(true);
    return new Promise((resolve) => {
      openLayer('<div class="sh-top"><b>' + esc(title) + '</b><span style="flex:1"></span><button class="iconbtn" data-close aria-label="Fermer">' + icon("x") + "</button></div>" +
        '<div class="sh-body"><p style="margin:0">' + esc(text) + '</p><label class="toggle" style="font-size:13px"><input type="checkbox" id="cm-never"> Ne plus demander (réactivable dans Réglages › Règles d\'envoi)</label></div>' +
        '<div class="sh-foot"><button class="btn primary" id="cm-ok" autofocus>' + esc(ok || "Confirmer") + '</button><button class="btn" data-close>Annuler</button></div>', title);
      const L = layer(); L.querySelector(".sheet").classList.add("ask");
      let done = false;
      const finish = async (v) => {
        if (done) return; done = true; mo.disconnect();
        if (v && L.querySelector("#cm-never").checked) { rules.confirmMoves = false; await S.saveSettings(S.state.settings); U.toast("Confirmation désactivée"); }
        if (L.innerHTML) A.closeLayer();
        resolve(v);
      };
      L.querySelector("#cm-ok").addEventListener("click", () => finish(true));
      L.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => finish(false)));
      const mo = new MutationObserver(() => { if (!L.innerHTML) finish(false); }); mo.observe(L, { childList: true });
    });
  };
  // Déplacement depuis le calendrier : avec confirmation, il s'applique tout de suite ; sans, il attend « Appliquer ».
  A.askMove = async function (id, to) {
    const rules = S.state.settings.rules || {};
    if (rules.confirmMoves === false) { A.queueMove(id, to); A.render(); return; }
    const txt = A.describe({ id, to });
    if (!(await A.confirmMove("Déplacer ce contenu ?", txt, "Déplacer"))) return;
    A.pending = A.pending.filter((c) => c.id !== id);
    const keep = A.pending; A.pending = [];
    A.queueMove(id, to);
    await A.applyPending();
    A.pending = keep; A.render();
  };
  A.applyPending = async function () {
    const changed = [];
    A.pending.forEach((c) => {
      const p = S.post(c.id);
      S.state.posts.filter((k) => k.parent === p.id).forEach((k) => {
        const e = A.eff(k); k.date = e.date; k.time = e.time; if (!k.date) k.status = "ready"; changed.push(k);
      });
      p.date = c.to.date; p.time = c.to.time;
      if (!p.date && p.status === "scheduled") { p.status = "ready"; p.stage = "ready"; }
      if (p.date && p.status === "ready") { p.status = "scheduled"; p.stage = "scheduled"; }
      if (p.status === "failed" && p.date) { p.status = "scheduled"; delete p.failure; }
      changed.push(p);
    });
    const n = A.pending.length, txt = A.pending.map(A.describe);
    A.pending = [];
    await S.savePosts(changed);
    await S.log({ level: "change", text: n + " changement" + (n > 1 ? "s appliqués" : " appliqué") + " dans le calendrier.", why: txt.join(" ; ") });
    U.toast(n > 1 ? n + " changements appliqués" : "Changement appliqué");
    A.render();
  };

  // ------------------------------------------------------------ Créneau libre : choisir un post prêt
  A.openFree = function (day, time, why) {
    const ready = S.state.posts.filter((p) => !p.parent && !p.date && (p.status === "ready" || p.status === "draft"));
    openLayer('<div class="sh-top"><b>' + esc(C.longDate(day)) + " · " + time + '</b><span style="flex:1"></span><button class="iconbtn" data-close aria-label="Fermer">' + icon("x") + "</button></div>" +
      '<div class="sh-body">' + (why ? '<p style="margin:0"><b>' + esc(why) + "</b></p>" : "") + '<p class="muted" style="margin:0">Choisis ce qui part sur ce créneau.</p><div class="todo">' +
      (ready.map((p) => '<button class="pc" data-place="' + p.id + '">' + '<span class="row1">' + brands(p.networks) + '<span class="ref">' + esc(p.ref || "") + '</span></span><span class="ttl">' + esc(p.title) + "</span>" + status(C.displayStatus(p, C.nowStamp())) + "</button>").join("") ||
        '<div class="empty">Rien n\'est prêt. Crée un post depuis « Contenus ».</div>') + "</div></div>", "Créneau libre");
    layer().querySelectorAll("[data-place]").forEach((b) => b.addEventListener("click", () => { A.queueMove(b.dataset.place, { date: day, time }); A.closeLayer(); A.render(); }));
  };

  // ------------------------------------------------------------ Raccourcis (Aujourd'hui)
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  A.canDictate = !!SR;
  const top = (html, title) => '<div class="sh-top"><b>' + esc(title) + '</b><span style="flex:1"></span><button class="iconbtn" data-close aria-label="Fermer">' + icon("x") + "</button></div>" + html;
  const defaultNets = () => [A.nets()[0]];
  async function addIdea(o) {
    const p = Object.assign({ id: "n" + Date.now().toString(36), ref: "", format: "reel", networks: defaultNets(), date: null, time: null, caption: "", captionValidated: false, manual: false, media: [], stage: "idea", status: "draft" }, o);
    await S.savePosts([p]); await S.log({ level: "change", text: "Nouvelle idée : " + p.title, postId: p.id });
    return p;
  }
  A.rootFolderUrl = function () {
    const st = S.state.settings || {};
    const id = (st.connectDefaults && st.connectDefaults.gdrive && st.connectDefaults.gdrive.rootFolderId) || (st.drive && st.drive.rootFolderId);
    return id ? "https://drive.google.com/drive/folders/" + encodeURIComponent(id) : null;
  };
  A.quick = function (kind, file) {
    if (kind === "new") return A.newPost();
    if (kind === "folder") { const u = A.rootFolderUrl(); if (u) window.open(u, "_blank", "noopener"); else U.toast("Aucun dossier Drive relié (Réglages › Stockage)"); return; }
    if (kind === "hole") {
      const k = A.kpiData(), t = C.ymd(new Date());
      const used = new Set(S.state.posts.filter((p) => p.date).map((p) => p.date));
      let d = C.addDays(t, 1); while (used.has(d) && d <= (k.lastDate || t)) d = C.addDays(d, 1);
      const slots = S.state.settings.slots || [];
      const sl = slots.find((x) => /reel/i.test(x.label || "")) || slots[0] || { time: "12:30" };
      return A.openFree(d, sl.time, "Prochain jour sans aucune publication, sur le créneau « " + (sl.label || sl.time) + " ».");
    }
    if (kind === "idea" || kind === "voice") {
      openLayer(top('<form class="sh-body form" id="q-form"><label>Idée<input name="title" required autofocus placeholder="Ex. : les QR codes piégés sur les parkings"></label>' +
        '<label>Note (facultatif)<textarea name="note" rows="4" placeholder="Angle, source, ce que tu veux montrer…"></textarea></label>' +
        '<label>Format<select name="format">' + [["reel", "Reel"], ["carousel", "Carrousel"], ["story", "Story"], ["image", "Image"]].map(([v, l]) => '<option value="' + v + '">' + l + "</option>").join("") + "</select></label>" +
        (SR ? '<button type="button" class="btn big" id="q-mic">' + icon("mic") + "Dicter au micro</button>" : "") +
        '<button class="btn primary big">' + icon("plus") + "Ajouter dans Idées</button></form>", "Proposer une idée"), "Proposer une idée");
      const f = layer().querySelector("#q-form");
      const mic = layer().querySelector("#q-mic");
      if (mic) mic.addEventListener("click", () => {
        const r = new SR(); r.lang = "fr-FR"; r.interimResults = false;
        mic.textContent = "J'écoute… parle maintenant"; mic.classList.add("rec");
        r.onresult = (e) => { const txt = Array.from(e.results).map((x) => x[0].transcript).join(" ").trim(); if (!f.title.value) f.title.value = txt.charAt(0).toUpperCase() + txt.slice(1); else f.note.value = (f.note.value + " " + txt).trim(); };
        r.onend = () => { mic.innerHTML = icon("mic") + "Dicter au micro"; mic.classList.remove("rec"); };
        r.onerror = () => U.toast("Micro indisponible");
        r.start();
      });
      if (kind === "voice" && mic) mic.click();
      f.addEventListener("submit", async (e) => { e.preventDefault(); await addIdea({ title: f.title.value.trim(), note: f.note.value.trim(), format: f.format.value }); A.closeLayer(); A.render(); U.toast("Idée ajoutée dans le tableau", { label: "Voir", fn: () => { location.hash = "#contents"; } }); });
      return;
    }
    if (kind === "link") {
      openLayer(top('<form class="sh-body form" id="q-form"><label>Lien de l\'article ou de l\'alerte<span class="row"><input name="url" type="url" required autofocus placeholder="https://…" style="flex:1">' +
        (navigator.clipboard && navigator.clipboard.readText ? '<button type="button" class="btn" id="q-paste">' + icon("copy") + "Coller</button>" : "") + "</span></label>" +
        '<label>Titre (facultatif)<input name="title" placeholder="Ex. : fuite de données chez…"></label>' +
        '<label>Catégorie<input name="cat" value="' + esc((S.state.settings.categories || [])[0] || "Actu") + '"></label><p class="muted small">L\'idée se périme dans 3 jours : elle apparaîtra dans « À faire » si elle n\'est pas programmée d\'ici là.</p>' +
        '<button class="btn primary big">' + icon("plus") + "Ajouter dans Idées</button></form>", "Coller un lien d'actu"), "Coller un lien d'actu");
      const f = layer().querySelector("#q-form");
      const ps = layer().querySelector("#q-paste");
      if (ps) ps.addEventListener("click", async () => { try { f.url.value = (await navigator.clipboard.readText()).trim(); } catch (e) { U.toast("Colle le lien avec un appui long"); } });
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        const url = f.url.value.trim(); let host = ""; try { host = new URL(url).hostname.replace(/^www\./, ""); } catch (x) { /* rien */ }
        await addIdea({ title: f.title.value.trim() || (f.cat.value || "Actu") + " : " + host, note: "Source : " + url, source: url, category: f.cat.value.trim(), expires: C.addDays(C.ymd(new Date()), 3) });
        A.closeLayer(); A.render(); U.toast("Lien ajouté dans Idées", { label: "Voir", fn: () => { location.hash = "#contents"; } });
      });
      return;
    }
    if (kind === "video" || kind === "photo" || kind === "file") {
      const accept = kind === "video" ? "video/*" : kind === "photo" ? "image/*" : "image/*,video/*,application/pdf";
      const targets = S.state.posts.filter((p) => !p.parent && p.status !== "published").sort((a, b) => (C.at(a) || "z").localeCompare(C.at(b) || "z")).slice(0, 80);
      openLayer(top('<form class="sh-body form" id="q-form"><label>Fichier<input name="file" type="file" accept="' + accept + '"' + (file ? "" : " required") + "></label>" +
        (file ? '<p class="muted small" id="q-dropped">Fichier déposé : <b>' + esc(file.name) + "</b> (" + Math.round(file.size / 1048576 * 10) / 10 + " Mo)</p>" : "") +
        '<label>Pour quel contenu ?<select name="target"><option value="">Nouvelle idée (titre = nom du fichier)</option>' +
        targets.map((p) => '<option value="' + esc(p.id) + '">' + esc((p.date ? C.shortDay(p.date) + " · " : "") + p.title) + "</option>").join("") + "</select></label>" +
        '<p class="muted small" id="q-dest"></p><div class="bar" id="q-bar" hidden><i></i></div>' +
        '<button class="btn primary big" id="q-go">' + icon("cloud") + "Envoyer dans le Drive</button></form>", kind === "video" ? "Ajouter une vidéo" : kind === "photo" ? "Ajouter une photo" : "Ajouter un fichier"), "Ajouter un média");
      const f = layer().querySelector("#q-form");
      const dest = () => { const p = S.post(f.target.value); return (p && p.folder && !/^https?:/.test(p.folder) ? p.folder : (S.state.settings.drive && S.state.settings.drive.inbox) || "PlanneRs/depots"); };
      const showDest = () => { layer().querySelector("#q-dest").textContent = "Dossier Drive : " + dest(); };
      f.target.addEventListener("change", showDest); showDest();
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fl = (f.file.files && f.file.files[0]) || file; if (!fl) return;
        if (S.mode !== "api") { U.toast("Mode démo : aucun fichier n'est envoyé"); return; }
        const go = layer().querySelector("#q-go"), bar = layer().querySelector("#q-bar");
        go.disabled = true; go.textContent = "Envoi…"; bar.hidden = false;
        try {
          const r = await new Promise((ok, ko) => {
            const x = new XMLHttpRequest();
            x.open("POST", "api/drive/upload?path=" + encodeURIComponent(dest()) + "&name=" + encodeURIComponent(fl.name));
            x.setRequestHeader("content-type", fl.type || "application/octet-stream");
            x.upload.onprogress = (ev) => { if (ev.lengthComputable) bar.firstChild.style.width = Math.round(ev.loaded / ev.total * 100) + "%"; };
            x.onload = () => { let j = {}; try { j = JSON.parse(x.responseText); } catch (er) { /* rien */ } if (x.status < 300) ok(j); else ko(new Error(j.error || j.what || x.statusText)); };
            x.onerror = () => ko(new Error("Réseau indisponible"));
            x.send(fl);
          });
          let p = S.post(f.target.value);
          if (!p) p = await addIdea({ title: fl.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "), format: /^video/.test(fl.type) ? "reel" : "image", stage: "media" });
          p.media = (p.media || []).concat([{ name: fl.name, type: /^video/.test(fl.type) ? "video" : /^image/.test(fl.type) ? "image" : "file", drive: r.id, url: r.url || "" }]);
          if (!p.folder) p.folder = dest();
          await S.savePosts([p]); await S.log({ level: "change", text: "Fichier ajouté dans le Drive : " + fl.name, postId: p.id });
          A.closeLayer(); A.render(); U.toast("Envoyé dans " + dest(), r.webUrl ? { label: "Ouvrir", fn: () => window.open(r.webUrl, "_blank", "noopener") } : null);
        } catch (er) { go.disabled = false; go.innerHTML = icon("cloud") + "Réessayer"; U.toast("Envoi impossible : " + er.message); }
      });
    }
  };

  // ------------------------------------------------------------ Nouveau post
  A.newPost = function () { A.compose(); };

  // ------------------------------------------------------------ Poster à la main
  A.openManual = function (id, onlyNet) {
    const p = S.post(id); if (!p) return;
    const net = onlyNet || (p.status === "failed" || p.needsAttention ? A.failedNet(p) : p.networks[0]);
    const appName = window.BRANDS[net] ? window.BRANDS[net].title : net;
    const m = (p.media || [])[0];
    const guideM = (p.media || []).find((x) => x.role === "guide" && x.url);
    let k = 0; // numéro affiché : les étapes sans contenu sont retirées
    const step = (n, title, body, doneFlag) => '<div class="step' + (doneFlag ? " done" : "") + '" data-step="' + n + '"><span class="n">' + (doneFlag ? icon("check") : ++k) + "</span><div><h4>" + title + "</h4>" + body + "</div></div>";
    const has2 = p.format === "story" ? !!p.note : !!C.capFor(p, net).trim();
    openLayer('<div class="sh-top">' + brands(p.networks, "lg") + '<span class="muted" style="font-size:13px">' + esc(C.FORMATS[p.format]) + " · " + (p.date ? esc(C.shortDay(p.date)) + " " + p.time : "") + ' · à la main</span><span style="flex:1"></span><button class="iconbtn" data-close aria-label="Fermer">' + icon("x") + "</button></div>" +
      '<div class="sh-body"><h2>' + esc(p.title) + '</h2>' +
      '<div class="onego" id="m-onego" hidden><button class="btn primary big" data-onego>' + icon("send") + "Poster en un geste</button><p class=\"muted\">" + (p.format === "story" ? (p.note ? "Copie la consigne et ouvre" : "Ouvre") : C.capFor(p, net).trim() ? "Copie le texte et ouvre" : "Ouvre") + " le menu Partager avec le fichier : choisis " + esc(appName) + ".</p></div>" +
      '<div class="steps">' +
      step(1, "Enregistrer le média", "<p>" + (m ? esc(m.name) : "Aucun fichier rattaché.") + "</p>" + (m && /^https?:/.test(m.url || "") ? '<a class="btn big" id="m-dl" href="' + safeUrl(m.url) + '" download data-mstep="1">' + icon("download") + "Enregistrer</a>" : (m && relPath(p.folder) && driveOn() ? '<a class="btn big" id="m-dl" href="#" data-mstep="1">' + icon("download") + "Recherche du fichier…</a>" : (p.folder && !relPath(p.folder) ? '<a class="btn big" href="' + safeUrl(p.folder) + '" target="_blank" rel="noopener" data-mstep="1">' + icon("open") + "Ouvrir le dossier</a>" : '<button class="btn big" data-mstep="1">C\'est fait</button>'))) + (guideM ? '<p><a href="' + safeUrl(guideM.url) + '" target="_blank" rel="noopener">Voir les repères (où placer les autocollants)</a></p>' : "") + '<p id="m-folder">' + (p.folder && !relPath(p.folder) && m && m.url ? '<a href="' + safeUrl(p.folder) + '" target="_blank" rel="noopener">Ouvrir le dossier</a>' : "") + "</p>") +
      (!has2 ? "" : p.format === "story" ? step(2, "Préparer la story", (p.note ? '<div class="quote">' + esc(p.note) + "</div>" : "<p>Aucune consigne.</p>") + "<p class=\"muted\">Pas de légende sur une story.</p>" + (p.note ? '<button class="btn big" data-mstep="2" data-copy>' + icon("copy") + "Copier la consigne</button>" : '<button class="btn big" data-mstep="2">C\'est fait</button>'))
        : step(2, "Copier le texte", (C.capFor(p, net) ? '<div class="quote">' + esc(C.textOut(p, net, S.state.settings)) + "</div>" : "<p>Pas de texte pour ce post.</p>") + '<button class="btn big" data-mstep="2" data-copy>' + icon("copy") + "Copier</button>")) +
      step(3, "Ouvrir " + esc(appName), (p.format === "story" ? "<p>Publie l'image en story, puis ajoute l'autocollant de la consigne.</p>" : "<p>Publie le média avec le texte copié.</p>") + '<a class="btn big" href="' + safeUrl(APP_URL[net] || "#") + '" target="_blank" rel="noopener" data-mstep="3">' + icon("open") + "Ouvrir " + esc(appName) + "</a>") +
      step(4, "Revenir ici", '<p>Confirme quand c\'est en ligne. Le lien est facultatif.</p><label class="form"><input id="m-url" type="url" placeholder="Lien du post (facultatif)"></label>') +
      '</div></div><div class="sh-foot"><button class="btn primary big" data-posted>' + icon("check") + "C'est posté</button>" +
      '<button class="btn quiet" data-later style="width:100%">Reporter à demain</button></div>', "Poster à la main");
    const L = layer();
    // Sur téléphone : prépare le fichier pour le menu Partager (« Enregistrer l'image » / « Enregistrer la vidéo » => Photos).
    let shareFile = null;
    const prepShare = (url) => {
      if (!navigator.canShare) return;
      fetch(url).then((r) => (r.ok ? r.blob() : null)).then((bl) => {
        if (!bl) return;
        const f = new File([bl], m.name || "media", { type: bl.type || (m.type === "video" ? "video/mp4" : "image/jpeg") });
        if (navigator.canShare({ files: [f] })) { shareFile = f; const og = L.querySelector("#m-onego"); if (og) og.hidden = false; }
      }).catch(() => {});
    };
    if (m && /^https?:/.test(m.url || "")) prepShare(m.url);
    else if (m && relPath(p.folder) && driveOn()) A.driveFolder(p.folder).then((d) => {
      const b = L.querySelector("#m-dl"), fo = L.querySelector("#m-folder"); if (!b) return;
      const f = d.files.find((x) => x.name === m.name);
      if (fo) fo.innerHTML = '<a href="' + safeUrl(d.url) + '" target="_blank" rel="noopener">Ouvrir le dossier</a>';
      if (!f) { b.innerHTML = icon("open") + "Fichier absent : ouvrir le dossier"; b.href = d.url; b.target = "_blank"; return; }
      b.href = A.driveFileUrl(f); b.setAttribute("download", f.name); b.innerHTML = icon("download") + "Enregistrer";
      prepShare(A.driveFileUrl(f));
    }).catch(() => { const b = L.querySelector("#m-dl"); if (b) { b.textContent = "Stockage inaccessible"; } });
    const doneStep = (n) => { const s = L.querySelector('[data-step="' + n + '"]'); if (s) { s.classList.add("done"); s.querySelector(".n").innerHTML = icon("check"); } };
    const og = L.querySelector("[data-onego]");
    if (og) og.addEventListener("click", () => {
      if (!shareFile) return;
      const txt = (p.format === "story" ? p.note : C.textOut(p, net, S.state.settings)) || "";
      if (txt) U.copy(txt);
      navigator.share({ files: [shareFile] }).then(() => { [1, 2, 3].forEach(doneStep); U.toast(txt ? "Texte copié : colle-le dans " + appName : "Fichier envoyé à " + appName); }).catch(() => {});
    });
    L.querySelectorAll("[data-mstep]").forEach((b) => b.addEventListener("click", (e) => {
      if (b.getAttribute("href") === "#") { e.preventDefault(); return; }
      if (b.dataset.mstep === "1" && shareFile) { e.preventDefault(); navigator.share({ files: [shareFile] }).catch(() => {}); }
      if (b.hasAttribute("data-copy")) U.copy((p.format === "story" ? p.note : C.textOut(p, net, S.state.settings)) || "");
      const s = L.querySelector('[data-step="' + b.dataset.mstep + '"]'); s.classList.add("done"); s.querySelector(".n").innerHTML = icon("check");
    }));
    L.querySelector("[data-posted]").addEventListener("click", async () => {
      p.status = "published"; p.stage = "published"; const u = L.querySelector("#m-url").value.trim(); if (u && !p.url) p.url = u;
      p.results = Object.assign({}, p.results || {}, { [net]: { status: "ok", url: u || undefined, manual: true } });
      if (Object.values(p.results).every((r) => r.status === "ok")) { p.needsAttention = false; delete p.failure; }
      await S.savePosts([p]); await S.log({ level: "ok", text: "Posté à la main : " + p.title, postId: p.id });
      A.closeLayer(); U.toast("Noté comme publié"); A.render();
    });
    L.querySelector("[data-later]").addEventListener("click", async () => {
      p.date = C.addDays(C.ymd(new Date()), 1); p.ignored = false;
      await S.savePosts([p]); await S.log({ level: "change", text: "Reporté à demain : " + p.title, postId: p.id });
      A.closeLayer(); U.toast("Reporté à demain " + p.time); A.render();
    });
  };

  // ------------------------------------------------------------ Validation en lot
  A.openReview = function () {
    if (A.denyValidate()) return;
    const list = A.todoList().review.map((p) => p.id);
    if (!list.length) { U.toast("Aucune légende à valider"); return; }
    let i = 0, ok = 0;
    A.lastFocus = document.activeElement;
    const draw = () => {
      if (i >= list.length) {
        layer().innerHTML = '<div class="review" role="dialog" aria-modal="true" aria-label="Validation terminée"><div class="rv-body" style="place-content:center"><div style="text-align:center"><h2>' + ok + " légende" + (ok > 1 ? "s validées" : " validée") + "</h2><p class=\"muted\">Elles partiront à l'heure prévue.</p><button class=\"btn primary\" data-rv=\"close\" autofocus>Terminer</button></div></div></div>";
        layer().querySelector("[data-rv]").focus(); return;
      }
      const p = A.eff(S.post(list[i]));
      const checks = C.checks(Object.assign({}, p, { captionValidated: true }), S.state.settings).filter((c) => c.level !== "ok");
      layer().innerHTML = '<div class="review" role="dialog" aria-modal="true" aria-label="Valider les légendes"><div class="rv-top"><b>Valider les légendes</b><span class="muted">' + (i + 1) + " sur " + list.length + '</span><div class="bar"><i style="width:' + Math.round(i / list.length * 100) + '%"></i></div><span style="flex:1"></span><span class="muted desk kbdhint" style="font-size:12px">V valider · → plus tard · Échap fermer</span>' + (list.length - i > 1 ? '<button class="btn sm" data-rv="all">' + icon("check") + "Tout valider (" + (list.length - i) + ")</button>" : "") + '<button class="iconbtn" data-rv="close" aria-label="Fermer">' + icon("x") + "</button></div>" +
        '<div class="rv-body' + (p.thumb ? "" : " solo") + '">' + (p.thumb ? '<div class="phone" aria-hidden="true"><div class="ph-media"><img src="' + safeUrl(p.thumb) + '" alt=""></div><div class="ph-cap" id="rv-prev">' + esc(p.caption) + "</div></div>" : '<span id="rv-prev" hidden></span>') +
        '<div><div class="meta">' + brands(p.networks, "lg") + "<span>" + esc(C.FORMATS[p.format]) + " · " + esc(C.longDate(p.date)) + " · " + p.time + "</span></div><h2 style=\"margin:8px 0 12px\">" + esc(p.title) + "</h2>" +
        '<label for="rv-cap" style="font-weight:600;font-size:13px">Légende (modifiable)</label><textarea id="rv-cap" class="caption" style="min-height:240px">' + esc(p.caption) + "</textarea>" +
        '<div class="cmeta"><span id="rv-n">' + p.caption.length + " caractères · " + C.hashtags(p.caption) + " hashtags</span></div>" +
        (checks.length ? '<ul class="checks" style="margin-top:10px">' + checks.map((c) => '<li class="' + c.level + '">' + icon(c.level === "block" ? "x" : "alert") + "<span>" + esc(c.text) + "</span></li>").join("") + "</ul>" : "") +
        '</div></div><div class="rv-foot"><button class="btn" data-rv="prev"' + (i ? "" : " disabled") + ">" + icon("left") + 'Précédente</button><button class="btn" data-rv="skip">Plus tard</button><button class="btn primary" data-rv="ok">' + icon("check") + "Valider et suivante</button></div></div>";
      const ta = layer().querySelector("#rv-cap");
      ta.addEventListener("input", () => { layer().querySelector("#rv-prev").textContent = ta.value; layer().querySelector("#rv-n").textContent = ta.value.length + " caractères · " + C.hashtags(ta.value) + " hashtags"; });
      layer().querySelector('[data-rv="ok"]').focus();
    };
    const act = async (a) => {
      if (a === "close") { A.closeLayer(); A.render(); document.removeEventListener("keydown", key); return; }
      if (a === "prev") { i = Math.max(0, i - 1); return draw(); }
      if (a === "skip") { i++; return draw(); }
      if (a === "all") {
        const p = S.post(list[i]); const ta = layer().querySelector("#rv-cap");
        if (ta && ta.value !== p.caption) { p.caption = ta.value; await S.savePosts([p]); }
        document.removeEventListener("keydown", key); A.closeLayer(); A.validateAll(list.slice(i)); return;
      }
      if (a === "ok") {
        const p = S.post(list[i]); const ta = layer().querySelector("#rv-cap");
        if (ta) p.caption = ta.value;
        p.captionValidated = true; ok++;
        await S.savePosts([p]); await S.log({ level: "change", text: "Légende validée : " + p.title, postId: p.id });
        i++; draw();
      }
    };
    const key = (e) => {
      if (!layer().querySelector(".review")) { document.removeEventListener("keydown", key); return; }
      const inText = e.target.tagName === "TEXTAREA";
      if (e.key === "Escape") act("close");
      else if ((e.key === "Enter" && (e.ctrlKey || e.metaKey)) || (!inText && (e.key === "v" || e.key === "V"))) { e.preventDefault(); act(i >= list.length ? "close" : "ok"); }
      else if (!inText && e.key === "ArrowRight") act("skip");
      else if (!inText && e.key === "ArrowLeft") act("prev");
    };
    document.addEventListener("keydown", key);
    layer().onclick = (e) => { const b = e.target.closest("[data-rv]"); if (b) act(b.dataset.rv); };
    draw();
  };

  // ------------------------------------------------------------ Équipe
  A.me = () => S.state.me || "";
  A.validators = () => ((S.state.settings.team || {}).validators || []).map((x) => x.toLowerCase());
  A.canValidate = () => { const v = A.validators(); return S.mode !== "api" || !v.length || v.includes(A.me().toLowerCase()); };
  A.denyValidate = () => { if (A.canValidate()) return false; U.toast("Seuls les validateurs désignés peuvent valider (Réglages › Espace)"); return true; };

  // Lien de validation pour un client (page publique /v/<jeton>, valable 30 jours).
  A.shareLink = async function (ids) {
    if (!ids.length) { U.toast("Rien à partager"); return; }
    if (S.mode !== "api") { U.toast("Le lien client marche une fois PlanneRs installé (pas en démo)"); return; }
    let r; try { r = await S.call("POST", "share", { ids }); } catch (e) { U.toast("Lien impossible : " + e.message); return; }
    await S.log({ level: "change", text: "Lien de validation client créé (" + ids.length + " post" + (ids.length > 1 ? "s" : "") + ")" });
    A.lastFocus = A.lastFocus || document.activeElement;
    openLayer('<div class="sh-top"><b>Lien pour ton client</b><span style="flex:1"></span><button class="iconbtn" data-close aria-label="Fermer">' + icon("x") + "</button></div>" +
      '<div class="sh-body"><p style="margin:0">Il relit ' + (ids.length > 1 ? "les " + ids.length + " posts" : "le post") + ", puis valide ou laisse un commentaire, sans compte. Lien valable 30 jours.</p>" +
      '<div class="form"><input id="sh-url" readonly value="' + esc(r.url) + '" aria-label="Lien"></div>' +
      '<p class="muted" style="margin:0;font-size:12px">Cloudflare Access doit laisser passer le chemin /v/ : voir le guide « Lien de validation client ».</p></div>' +
      '<div class="sh-foot"><button class="btn primary" id="sh-copy">' + icon("copy") + 'Copier le lien</button><button class="btn" data-close>Fermer</button></div>', "Lien pour ton client");
    const L = layer(); L.querySelector(".sheet").classList.add("ask");
    L.querySelector("#sh-copy").addEventListener("click", () => U.copy(r.url));
    L.querySelector("#sh-url").addEventListener("focus", (e) => e.target.select());
  };

  // ------------------------------------------------------------ Répéter un post
  // Crée des copies du post à intervalle régulier (même heure, mêmes réseaux, même légende).
  A.openRepeat = function (id) {
    const p = S.post(id); if (!p || !p.date) return;
    openLayer('<div class="sh-top"><b>Répéter ce post</b><span style="flex:1"></span><button class="iconbtn" data-close aria-label="Fermer">' + icon("x") + "</button></div>" +
      '<div class="sh-body"><p style="margin:0">Des copies de « ' + esc(p.title) + " » à " + p.time + ", à partir du " + esc(C.longDate(p.date)) + '.</p><div class="form">' +
      '<label>Fréquence<select id="rp-every"><option value="7">Chaque semaine</option><option value="14">Toutes les 2 semaines</option><option value="m">Chaque mois</option></select></label>' +
      '<label>Nombre de copies<input id="rp-n" type="number" min="1" max="26" value="4"></label></div>' +
      '<p class="muted" id="rp-sum" style="margin:0"></p>' + (p.captionValidated ? '<p class="muted" style="margin:0">La légende est déjà validée : les copies le seront aussi.</p>' : "") + "</div>" +
      '<div class="sh-foot"><button class="btn primary" id="rp-ok">Créer les copies</button><button class="btn" data-close>Annuler</button></div>', "Répéter ce post");
    const L = layer(); L.querySelector(".sheet").classList.add("ask");
    const dates = () => {
      const ev = L.querySelector("#rp-every").value, n = Math.max(1, Math.min(26, +L.querySelector("#rp-n").value || 1)), out = [];
      for (let k = 1; k <= n; k++) {
        if (ev === "m") { const d = C.parseYmd(p.date); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + k); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); out.push(C.ymd(d)); }
        else out.push(C.addDays(p.date, k * +ev));
      }
      const t = C.ymd(new Date());
      return out.filter((d) => d >= t);
    };
    const sum = () => { const d = dates(); L.querySelector("#rp-ok").disabled = !d.length; L.querySelector("#rp-sum").textContent = !d.length ? "Aucune date à venir." : d.length === 1 ? "1 copie : le " + C.longDate(d[0]) + "." : d.length + " copies : du " + C.longDate(d[0]) + " au " + C.longDate(d[d.length - 1]) + "."; };
    L.querySelectorAll("#rp-every, #rp-n").forEach((x) => x.addEventListener("input", sum)); sum();
    L.querySelector("#rp-ok").focus();
    L.querySelector("#rp-ok").addEventListener("click", async () => {
      const base = Date.now().toString(36);
      const copies = dates().map((d, k) => {
        const c = JSON.parse(JSON.stringify(p));
        c.id = "r" + base + k; c.date = d; c.status = p.status === "draft" ? "draft" : "scheduled"; c.stage = p.stage === "published" ? "scheduled" : p.stage;
        delete c.results; delete c.failure; delete c.url; delete c.job; delete c.ignored; delete c.needsAttention;
        return c;
      });
      await S.savePosts(copies);
      await S.log({ level: "change", text: copies.length + " copies de « " + p.title + " » programmées", postId: p.id });
      A.closeLayer(); A.render();
      U.toast(copies.length + " copies programmées", { label: "Annuler", fn: async () => { for (const c of copies) await S.deletePost(c.id); A.render(); U.toast("Copies supprimées"); } });
    });
  };

  // Reprendre un post publié qui a bien marché : une copie à une date future, légende à relire.
  A.openRecycle = function (id) {
    const p = S.post(id); if (!p) return;
    const t = C.ymd(new Date());
    let d0 = C.addDays(p.date && p.date > C.addDays(t, -42) ? p.date : t, 42);
    if (p.date) while (C.parseYmd(d0).getDay() !== C.parseYmd(p.date).getDay()) d0 = C.addDays(d0, 1);
    const slots = S.state.settings.slots || [];
    openLayer('<div class="sh-top"><b>Reprendre plus tard</b><span style="flex:1"></span><button class="iconbtn" data-close aria-label="Fermer">' + icon("x") + "</button></div>" +
      '<div class="sh-body"><p style="margin:0">Une copie de « <b data-noi18n>' + esc(p.title) + '</b> » avec ses médias et sa légende. La légende sera à relire et à valider : c\'est l\'occasion de la rafraîchir.</p><div class="form">' +
      '<label>Jour<input type="date" id="rc-date" min="' + t + '" value="' + d0 + '"></label>' +
      '<label>Créneau<select id="rc-time">' + slots.map((s) => '<option value="' + s.time + '"' + (s.time === p.time ? " selected" : "") + ">" + s.time + " · " + esc(s.label) + "</option>").join("") + (p.time && !slots.some((s) => s.time === p.time) ? '<option value="' + p.time + '" selected>' + p.time + "</option>" : "") + "</select></label></div></div>" +
      '<div class="sh-foot"><button class="btn primary" id="rc-ok">Programmer la reprise</button><button class="btn" data-close>Annuler</button></div>', "Reprendre plus tard");
    const L = layer(); L.querySelector(".sheet").classList.add("ask");
    L.querySelector("#rc-ok").focus();
    L.querySelector("#rc-ok").addEventListener("click", async () => {
      const d = L.querySelector("#rc-date").value;
      if (!d || d < t) { U.toast("Choisis une date à venir"); return; }
      const c = JSON.parse(JSON.stringify(p));
      c.id = "k" + Date.now().toString(36); c.date = d; c.time = L.querySelector("#rc-time").value || p.time || "12:00";
      c.status = "scheduled"; c.stage = "caption"; c.captionValidated = false; c.title = p.title.replace(/ \(reprise\)$/, "") + " (reprise)";
      ["results", "failure", "url", "job", "ignored", "needsAttention", "reminded", "attempts", "comments", "ref"].forEach((k) => delete c[k]);
      await S.savePosts([c]);
      await S.log({ level: "change", text: "Reprise de « " + p.title + " » programmée le " + C.longDate(d), postId: c.id });
      A.closeLayer(); A.render();
      U.toast("Reprise programmée, légende à valider", { label: "Annuler", fn: async () => { await S.deletePost(c.id); A.render(); U.toast("Reprise supprimée"); } });
    });
  };

  // ------------------------------------------------------------ Import d'un planning CSV
  // Colonnes reconnues (en-tête, séparateur « ; » ou « , ») : date, heure, titre, format, réseaux, légende.
  function parseCsv(txt) {
    txt = txt.replace(/^﻿/, "");
    const first = txt.split(/\r?\n/)[0] || "", sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ";" : ",";
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < txt.length; i++) {
      const ch = txt[i];
      if (q) { if (ch === '"') { if (txt[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && txt[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((c) => c.trim()));
  }
  const norm = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  A.csvToPosts = function (txt) {
    const rows = parseCsv(txt); if (rows.length < 2) return { posts: [], errors: ["Le fichier est vide ou n'a pas d'en-tête."] };
    const head = rows[0].map(norm);
    const col = (...names) => head.findIndex((h) => names.includes(h));
    const ci = { date: col("date", "jour"), time: col("heure", "time", "horaire"), title: col("titre", "title", "sujet"), format: col("format", "type"), nets: col("reseaux", "reseau", "networks", "network"), cap: col("legende", "caption", "texte", "text") };
    if (ci.title < 0) return { posts: [], errors: ["Colonne « titre » introuvable."] };
    const fmts = Object.entries(C.FORMATS), brandsAll = Object.entries(window.BRANDS || {});
    const posts = [], errors = [], base = Date.now().toString(36);
    rows.slice(1).forEach((r, k) => {
      const line = k + 2, get = (i) => (i >= 0 ? (r[i] || "").trim() : "");
      const title = get(ci.title); if (!title) { errors.push("Ligne " + line + " : pas de titre."); return; }
      let date = get(ci.date) || null;
      if (date) { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(date); if (m) date = m[3] + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0"); }
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) { errors.push("Ligne " + line + " : date illisible (« " + date + " »)."); return; }
      let time = get(ci.time).replace(/h$/i, ":00").replace("h", ":") || null;
      if (time && /^\d{1,2}:\d{2}$/.test(time)) time = time.padStart(5, "0"); else if (time) { errors.push("Ligne " + line + " : heure illisible (« " + time + " »)."); return; }
      const fv = norm(get(ci.format)); const fm = fmts.find(([key, l]) => norm(key) === fv || norm(l) === fv);
      const nets = get(ci.nets).split(/[+|,/ ]+/).map(norm).filter(Boolean).map((n) => (brandsAll.find(([id, b]) => norm(id) === n || norm(b.title) === n) || [])[0]).filter(Boolean);
      posts.push({ id: "i" + base + k, ref: "", title, format: fm ? fm[0] : "image", networks: nets.length ? [...new Set(nets)] : [A.nets()[0]],
        date, time: date ? time || ((S.state.settings.slots || [])[0] || {}).time || "12:00" : null, caption: get(ci.cap), captionValidated: false, manual: false, media: [],
        stage: date ? "scheduled" : "ready", status: date ? "scheduled" : "ready" });
    });
    return { posts, errors };
  };
  A.openCsvImport = function (txt) {
    const { posts, errors } = A.csvToPosts(txt);
    const n = posts.length;
    openLayer('<div class="sh-top"><b>Importer un planning</b><span style="flex:1"></span><button class="iconbtn" data-close aria-label="Fermer">' + icon("x") + "</button></div>" +
      '<div class="sh-body"><p style="margin:0">' + (n ? n + " post" + (n > 1 ? "s" : "") + " trouvé" + (n > 1 ? "s" : "") + ". Les légendes seront à valider." : "Aucun post à importer.") + "</p>" +
      (n ? '<ul class="vall">' + posts.slice(0, 50).map((p) => "<li><b>" + esc(p.title) + '</b><span class="muted">' + (p.date ? esc(C.shortDay(p.date)) + " " + p.time : "sans date") + " · " + esc(C.FORMATS[p.format]) + " · " + p.networks.map((x) => esc(window.BRANDS[x] ? window.BRANDS[x].title : x)).join(", ") + "</span></li>").join("") + "</ul>" : "") +
      (errors.length ? '<p class="muted" style="margin:0">' + errors.length + " ligne" + (errors.length > 1 ? "s" : "") + ' ignorée' + (errors.length > 1 ? "s" : "") + " :</p><ul class=\"vall ko\">" + errors.slice(0, 20).map((e) => "<li>" + esc(e) + "</li>").join("") + "</ul>" : "") + "</div>" +
      '<div class="sh-foot">' + (n ? '<button class="btn primary" id="csv-ok">Importer ' + n + " post" + (n > 1 ? "s" : "") + "</button>" : "") + '<button class="btn" data-close>Annuler</button></div>', "Importer un planning");
    const L = layer(); L.querySelector(".sheet").classList.add("ask");
    const b = L.querySelector("#csv-ok"); if (!b) return; b.focus();
    b.addEventListener("click", async () => {
      await S.savePosts(posts); await S.log({ level: "change", text: n + " posts importés depuis un fichier CSV" });
      A.closeLayer(); A.render();
      U.toast(n + " posts importés", { label: "Annuler", fn: async () => { for (const p of posts) await S.deletePost(p.id); A.render(); U.toast("Import annulé"); } });
    });
  };
  A.csvTemplate = "date;heure;titre;format;reseaux;legende\n2026-12-01;12:30;Mon premier post;reel;instagram+facebook;\"Une légende, avec des #hashtags\"\n;;Une idée sans date;carrousel;instagram;\n";

  // ------------------------------------------------------------ Tout valider
  // Valide d'un coup les légendes en attente, après un écran de confirmation.
  // Les posts qui ont un problème bloquant (média manquant, trop de hashtags…) sont laissés de côté.
  A.validateAll = function (ids) {
    if (A.denyValidate()) return;
    ids = ids || A.todoList().review.map((p) => p.id);
    const ps = ids.map((id) => A.eff(S.post(id))).filter(Boolean);
    if (!ps.length) { U.toast("Aucune légende à valider"); return; }
    const blocking = (p) => C.checks(Object.assign({}, p, { captionValidated: true }), S.state.settings).find((c) => c.level === "block");
    const ok = ps.filter((p) => !blocking(p)), ko = ps.filter((p) => blocking(p));
    const row = (p, why) => "<li><b>" + esc(p.title) + '</b><span class="muted">' + esc(C.shortDay(p.date)) + " " + (p.time || "") + (why ? " · " + esc(why.text) : "") + "</span></li>";
    const n = ok.length, s = n > 1 ? "s" : "";
    A.lastFocus = A.lastFocus || document.activeElement;
    openLayer('<div class="sh-top"><b>Tout valider</b><span style="flex:1"></span><button class="iconbtn" data-close aria-label="Fermer">' + icon("x") + "</button></div>" +
      '<div class="sh-body">' + (n ? "<p style=\"margin:0\">" + n + " légende" + s + " " + (n > 1 ? "partiront" : "partira") + " à l'heure prévue, sans relecture une par une.</p>" +
        '<ul class="vall">' + ok.map((p) => row(p)).join("") + "</ul>" : "<p style=\"margin:0\">Aucune légende ne peut être validée telle quelle.</p>") +
      (ko.length ? '<p class="muted" style="margin:0">' + ko.length + " laissée" + (ko.length > 1 ? "s" : "") + " de côté, à corriger d'abord :</p><ul class=\"vall ko\">" + ko.map((p) => row(p, blocking(p))).join("") + "</ul>" : "") + "</div>" +
      '<div class="sh-foot">' + (n ? '<button class="btn primary" id="va-ok">' + icon("check") + "Valider " + (n > 1 ? "les " + n + " légendes" : "la légende") + "</button>" : "") +
      '<button class="btn" data-close>' + (n ? "Annuler" : "Fermer") + "</button></div>", "Tout valider");
    const L = layer(); L.querySelector(".sheet").classList.add("ask");
    const b = L.querySelector("#va-ok"); if (b) b.focus();
    if (!b) return;
    b.addEventListener("click", async () => {
      const changed = ok.map((e) => { const p = S.post(e.id); p.captionValidated = true; if (p.stage === "caption") p.stage = "ready"; return p; });
      await S.savePosts(changed);
      await S.log({ level: "change", text: n + " légende" + s + " validée" + s + " en une fois : " + changed.map((p) => p.title).join(", ") });
      A.closeLayer(); A.render();
      U.toast(n + " légende" + s + " validée" + s, { label: "Annuler", fn: async () => {
        changed.forEach((p) => { p.captionValidated = false; });
        await S.savePosts(changed); await S.log({ level: "change", text: "Validation en lot annulée (" + n + " légende" + s + ")" });
        A.render(); U.toast("Validation annulée");
      } });
    });
  };

  // ------------------------------------------------------------ Recherche (Ctrl+K)
  A.openSearch = function () {
    A.lastFocus = document.activeElement;
    layer().innerHTML = '<div class="scrim" data-close></div><div class="palette" role="dialog" aria-modal="true" aria-label="Rechercher"><input id="q" placeholder="Rechercher un post, un numéro, une vue…" autocomplete="off" aria-label="Rechercher"><div class="res" id="qr" role="listbox"></div></div>';
    const q = layer().querySelector("#q"), r = layer().querySelector("#qr");
    const views = [["#today", "Aujourd'hui"], ["#calendar", "Calendrier"], ["#contents", "Contenus"], ["#stats", "Stats"], ["#activity", "Activité"], ["#settings", "Réglages"]];
    const acts = [["new", "Nouveau post", "plus", () => A.newPost()], ["review", "Valider les légendes", "eye", () => A.openReview()], ["valall", "Tout valider", "check", () => A.validateAll()], ["tour", "Revoir la visite guidée", "today", () => A.tour()], ["idea", "Proposer une idée", "bulb", () => A.quick("idea")], ["hole", "Remplir le prochain jour vide", "calendar", () => A.quick("hole")]];
    let sel = 0;
    const draw = () => {
      const v = q.value.trim().toLowerCase();
      const vs = acts.filter(([, l]) => !v || l.toLowerCase().includes(v)).map(([k, l, ic]) => '<button data-sact="' + k + '">' + icon(ic) + l + "</button>")
        .concat(views.filter(([, l]) => !v || l.toLowerCase().includes(v)).map(([h, l]) => '<button data-go="' + h + '">' + icon("right") + "Aller à " + l + "</button>"));
      const ps = S.state.posts.filter((p) => v && (p.title.toLowerCase().includes(v) || (p.ref || "").includes(v))).slice(0, 20)
        .map((p) => '<button data-open="' + p.id + '">' + brands(p.networks) + '<span class="mono muted">' + esc(p.ref || "") + "</span> " + esc(p.title) + '<span class="muted" style="margin-left:auto;font-size:12px">' + (p.date ? esc(C.shortDay(p.date)) + " " + p.time : "sans date") + "</span></button>");
      r.innerHTML = vs.concat(ps).join("") || '<p class="muted" style="padding:10px 14px">Aucun résultat.</p>';
      sel = 0; mark();
    };
    const mark = () => r.querySelectorAll("button").forEach((b, k) => b.classList.toggle("sel", k === sel));
    q.addEventListener("input", draw);
    q.addEventListener("keydown", (e) => {
      const bs = r.querySelectorAll("button");
      if (e.key === "ArrowDown") { sel = Math.min(bs.length - 1, sel + 1); mark(); e.preventDefault(); }
      if (e.key === "ArrowUp") { sel = Math.max(0, sel - 1); mark(); e.preventDefault(); }
      if (e.key === "Enter" && bs[sel]) bs[sel].click();
    });
    r.addEventListener("click", (e) => {
      const a = e.target.closest("[data-sact]"); if (a) { const x = acts.find(([k]) => k === a.dataset.sact); A.closeLayer(); x[3](); return; }
      const b = e.target.closest("[data-go]"); if (b) { A.closeLayer(); location.hash = b.dataset.go; }
    });
    draw(); q.focus();
  };

  // ------------------------------------------------------------ Fiche d'un connecteur
  A.openConn = function (id) {
    const all = [].concat(window.CONNECTORS.social, window.CONNECTORS.storage, window.CONNECTORS.notify);
    const c = all.find((x) => x.id === id); if (!c) return;
    const a = (S.state.accounts || {})[id];
    const logo = c.logo === undefined ? c.id : c.logo || c.id;
    const fields = S.mode === "api" && S.state.adapters ? S.state.adapters[id] : null;
    const pending = a && a.status === "pending";
    const form = fields && !(a && (a.status === "ok" || pending)) ? '<form class="box form" id="cf" onsubmit="return false"><h4>Identifiants</h4>' + fields.map((f) =>
      (f.file ? "<label>" + esc(f.label) + '<textarea name="' + esc(f.key) + '" rows="4" autocomplete="off" spellcheck="false" style="font-family:var(--mono,monospace);font-size:12px"' + (f.optional ? "" : " required") + ' placeholder="Choisis le fichier ci-dessous, ou colle son contenu ici"></textarea></label>' +
        '<label class="btn" style="display:flex;justify-content:center;align-items:center;gap:6px;cursor:pointer">' + icon("download") + 'Choisir le fichier<input type="file" accept="' + esc(f.file) + '" data-fill="' + esc(f.key) + '" hidden></label>'
      : "<label>" + esc(f.label) + '<input name="' + esc(f.key) + '" type="' + (f.secret ? "password" : "text") + '" autocomplete="off" value="' + esc(((S.state.settings.connectDefaults || {})[id] || {})[f.key] || "") + '"' + (f.optional ? "" : " required") + "></label>")).join("") +
      '<p class="muted" style="font-size:12px;margin:0">Ils sont chiffrés avant d\'être enregistrés et ne sont jamais renvoyés à l\'interface.</p></form>' : "";
    openLayer('<div class="sh-top">' + brand(logo, "lg") + "<b>" + esc(c.name) + '</b><span style="flex:1"></span><button class="iconbtn" data-close aria-label="Fermer">' + icon("x") + "</button></div>" +
      '<div class="sh-body">' + (a ? '<div class="box"><h4>Compte</h4><p>' + esc(a.account || "") + "</p><p class=\"muted\">" + esc(a.detail || "") + "</p></div>" : "") +
      '<div class="box"><h4>Ce que ça permet</h4><p>' + c.can.map(esc).join(" · ") + "</p>" + (c.limits ? "<h4>À savoir</h4><p>" + esc(c.limits) + "</p>" : "") + "</div>" +
      '<div class="box"><h4>Connexion</h4><p>' + esc(c.auth) + "</p><h4>Autorisations demandées</h4><p>" + c.perms.map(esc).join("<br>") + "</p></div>" +
      (c.docs.length ? '<div class="box"><h4>Documentation officielle</h4>' + c.docs.map(([l, u]) => '<p><a href="' + safeUrl(u) + '" target="_blank" rel="noopener">' + esc(l) + " " + icon("open") + "</a></p>").join("") + "</div>" : "") +
      (window.CONNECTOR_GUIDES && window.CONNECTOR_GUIDES[id] ? '<div class="box"><h4>Guide pas à pas</h4><p><a href="' + safeUrl(window.CONNECTOR_GUIDES.base + window.CONNECTOR_GUIDES[id]) + '" target="_blank" rel="noopener">Configurer ' + esc(c.name) + " " + icon("open") + "</a></p></div>" : "") +
      ((id === "gdrivewrite" || id === "youtube") && S.mode === "api" ? '<div class="box"><h4>URI de redirection à déclarer dans Google Cloud</h4><p class="mono" style="word-break:break-all">' + esc(location.origin + "/api/oauth/google/callback") + "</p></div>" : "") +
      (id === "tiktok" && S.mode === "api" ? '<div class="box"><h4>URI de redirection à déclarer dans l\'app TikTok</h4><p class="mono" style="word-break:break-all">' + esc(location.origin + "/api/oauth/tiktok/callback") + "</p></div>" : "") +
      form + '</div><div class="sh-foot">' + (pending ? id === "tiktok" ? '<a class="btn primary big" href="api/oauth/tiktok/start">' + icon("open") + 'Autoriser avec TikTok</a><button class="btn danger" data-cact="off">Recommencer</button>' : '<a class="btn primary big" href="api/oauth/google/start' + (id === "youtube" ? "?for=youtube" : "") + '">' + icon("open") + 'Autoriser avec Google</a><button class="btn danger" data-cact="off">Recommencer</button>' : a && a.status !== "error" ? '<button class="btn" data-cact="test">Tester la connexion</button><button class="btn danger" data-cact="off">Déconnecter</button>' :
        (S.mode === "api" && !fields ? '<p class="muted" style="margin:0">Ce connecteur n\'est pas encore disponible dans cette version.</p>' : (A.hasWizard && A.hasWizard(id) && !(a && a.status === "ok") ? '<button class="btn primary big" data-cact="wizard">' + icon("spark") + "Me guider pas à pas</button>" : "") + '<button class="btn' + (A.hasWizard && A.hasWizard(id) ? "" : " primary big") + '" data-cact="on">Se connecter à ' + esc(c.name) + "</button>")) + "</div>", c.name);
    layer().querySelectorAll("input[data-fill]").forEach((inp) => inp.addEventListener("change", async () => {
      const file = inp.files && inp.files[0]; if (!file) return;
      const ta = layer().querySelector('[name="' + inp.dataset.fill + '"]'); ta.value = (await file.text()).trim();
      U.toast("Fichier chargé : " + file.name);
    }));
    layer().querySelector(".sh-foot").addEventListener("click", async (e) => {
      const b = e.target.closest("[data-cact]"); if (!b) return;
      if (b.dataset.cact === "wizard") { A.wizard(id); return; }
      if (S.mode === "api" && b.dataset.cact === "on") {
        const f = layer().querySelector("#cf"); if (!f || !f.reportValidity()) return;
        const body = Object.fromEntries(new FormData(f).entries());
        b.disabled = true; U.toast("Vérification…");
        try { const r = await S.call("POST", "connect/" + id, body); S.state.accounts[id] = r.info; if (r.info.relay) S.state.accounts.facebook = r.info.relay; if (r.info.status === "pending") { U.toast("Étape 2 : autorise l'accès Google"); A.openConn(id); return; } U.toast("Connecté"); A.closeLayer(); A.render(); }
        catch (err) { b.disabled = false; let m = err.message; try { m = JSON.parse(m).info.detail; } catch (e2) { /* texte brut */ } U.toast("Échec : " + m); }
        return;
      }
      if (S.mode === "api" && b.dataset.cact === "off") { await S.call("DELETE", "connect/" + id); delete S.state.accounts[id]; A.closeLayer(); A.render(); return; }
      if (b.dataset.cact === "on") { S.state.accounts[id] = { status: "ok", account: "Compte de démo", detail: "Connexion simulée (démo)" }; U.toast("Démo : connexion simulée"); }
      if (b.dataset.cact === "off") { delete S.state.accounts[id]; U.toast("Déconnecté"); }
      if (b.dataset.cact === "test") { U.toast(S.mode === "demo" ? "Démo : connexion OK" : "Test en cours…"); if (S.mode === "api") { try { await S.call("POST", "connect/" + id + "/test"); U.toast("Connexion OK"); } catch (err) { U.toast("Échec : " + err.message); } } return; }
      S.persist(); A.closeLayer(); A.render();
    });
  };

  // ------------------------------------------------------------ Visionneuse d'images (carrousels)
  // Un clic sur un élément [data-lb] ouvre l'image dans une fenêtre au-dessus de la page,
  // avec les autres images du même groupe (aperçu ou liste de fichiers) : flèches, clavier, glisser du doigt.
  A.lightbox = function (items, start) {
    if (!items.length) return;
    let i = Math.max(0, Math.min(start || 0, items.length - 1));
    const prevFocus = document.activeElement;
    const box = document.createElement("div");
    box.className = "lb";
    box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-label", "Visionneuse d'images");
    document.body.appendChild(box);
    const many = items.length > 1;
    const draw = () => {
      const it = items[i];
      box.innerHTML = '<div class="lb-top"><span class="lb-n">' + (many ? (i + 1) + " / " + items.length + " · " : "") + esc(it.name || "") + '</span><span style="flex:1"></span>' +
        '<a class="iconbtn" href="' + safeUrl(it.orig || it.src) + '" target="_blank" rel="noopener" title="Ouvrir l\'original" aria-label="Ouvrir l\'original dans un onglet">' + icon("open") + "</a>" +
        '<button class="iconbtn" data-lbx="close" aria-label="Fermer">' + icon("x") + "</button></div>" +
        '<div class="lb-stage" data-lbx="bg">' + (many ? '<button class="lb-nav prev" data-lbx="prev" aria-label="Image précédente"' + (i ? "" : " disabled") + ">" + icon("left") + "</button>" : "") +
        '<img src="' + esc(it.src) + '" alt="' + esc(it.name || "Image " + (i + 1)) + '" draggable="false">' +
        (many ? '<button class="lb-nav next" data-lbx="next" aria-label="Image suivante"' + (i < items.length - 1 ? "" : " disabled") + ">" + icon("right") + "</button>" : "") + "</div>" +
        (many ? '<div class="lb-dots" role="tablist" aria-label="Images">' + items.map((x, k) => '<button role="tab" aria-selected="' + (k === i) + '" aria-label="Image ' + (k + 1) + '" data-lbgo="' + k + '"></button>').join("") + "</div>" : "");
      const im = box.querySelector("img");
      im.addEventListener("error", () => { if (it.orig && im.src !== it.orig) im.src = it.orig; }, { once: true });
      (box.querySelector('[data-lbx="next"]:not([disabled])') || box.querySelector('[data-lbx="close"]')).focus({ preventScroll: true });
    };
    const go = (d) => { const n = i + d; if (n >= 0 && n < items.length) { i = n; draw(); } };
    const close = () => { document.removeEventListener("keydown", key, true); box.remove(); try { prevFocus && prevFocus.focus(); } catch (e) { /* rien */ } };
    const key = (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); e.stopPropagation(); go(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); e.stopPropagation(); go(-1); }
      else if (e.key === "Tab") {
        const f = [...box.querySelectorAll("a[href],button:not([disabled])")]; if (!f.length) return;
        e.stopPropagation();
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
        else if (!box.contains(document.activeElement)) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener("keydown", key, true);
    box.addEventListener("click", (e) => {
      const g = e.target.closest("[data-lbgo]"); if (g) { i = +g.dataset.lbgo; draw(); return; }
      const b = e.target.closest("[data-lbx]"); if (!b) return;
      const a = b.dataset.lbx;
      if (a === "close" || (a === "bg" && e.target === b)) close(); else if (a === "prev") go(-1); else if (a === "next") go(1);
    });
    let sx = null, sy = 0;
    box.addEventListener("touchstart", (e) => { if (e.touches.length === 1) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; } }, { passive: true });
    box.addEventListener("touchend", (e) => {
      if (sx == null) return; const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
      else if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.5) close();
    }, { passive: true });
    draw();
  };
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-lb]"); if (!a || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    const group = a.closest(".media, #drv-files, .box, .sheet") || document;
    const all = [...group.querySelectorAll("[data-lb]")];
    A.lightbox(all.map((x) => ({ src: x.dataset.lb, orig: x.dataset.lborig, name: x.dataset.lbname })), all.indexOf(a));
  });
})();
