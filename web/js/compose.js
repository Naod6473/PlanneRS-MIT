/* PlanneRs : fenêtre de création et de modification d'un post.
   À gauche on écrit (réseaux, texte, médias, paramètres) ; à droite l'aperçu se met à jour en direct ;
   en bas, le jour, l'heure et les boutons. Rien n'est enregistré avant « Enregistrer » ou « Programmer ». */
(function () {
  "use strict";
  const C = window.Core, U = window.UI, S = window.Store, A = window.App;
  const { esc, icon, brand } = U;
  const layer = () => document.getElementById("layer");
  const T = (n) => (window.BRANDS[n] ? window.BRANDS[n].title : n);
  const isVid = (m) => m.type === "video" || /\.(mp4|mov|webm|m4v)(\?|$)/i.test(m.name || m.url || "");
  const isImg = (m) => !isVid(m) && (/^image/.test(m.type || "image")) && m.role !== "guide";
  const driveThumb = (u) => { const id = (/drive\.google\.com\/.*(?:id=|\/d\/)([\w-]{20,})/.exec(u || "") || [])[1]; return id ? "https://drive.google.com/thumbnail?id=" + id + "&sz=w800" : u; };

  // Format déduit des médias tant que la personne ne l'a pas choisi.
  A.mediaLibrary = function () {
    const seen = new Set(), out = [];
    S.state.posts.slice().sort((a, b) => ((b.date || "") + (b.time || "")).localeCompare((a.date || "") + (a.time || "")))
      .forEach((p) => (p.media || []).forEach((m) => {
        const k = m.drive || m.url;
        if (!k || m.local || /^blob:/.test(m.url || "") || m.role === "guide" || seen.has(k)) return;
        seen.add(k); out.push({ m, p });
      }));
    return out;
  };

  A.guessFormat = function (media) {
    const ms = (media || []).filter((m) => m.role !== "guide" && m.role !== "cover");
    if (ms.some(isVid)) return "reel";
    const n = ms.filter(isImg).length;
    return n > 1 ? "carousel" : n === 1 ? "image" : "text";
  };
  // Titre déduit de la première ligne utile du texte.
  A.guessTitle = (cap) => { const l = String(cap || "").split("\n").map((x) => x.trim()).find((x) => x && !/^[#@]/.test(x)); return l ? [...l].slice(0, 80).join("") : ""; };

  // Adresse affichable d'un média : fichier tout juste choisi, lien public, ou fichier du Drive relayé par l'instance.
  const srcOf = (m) => m._pv || (/^(https?:\/\/|blob:)/.test(m.url || "") ? m.url : "") || (m.drive && A.driveFileUrl ? A.driveFileUrl({ id: m.drive, name: m.name }) : "");
  function srcsOf(d) {
    const ms = d.media || [];
    const v = ms.find((m) => srcOf(m) && isVid(m));
    const cover = ms.find((m) => m.role === "cover" && srcOf(m));
    const imgs = ms.filter((m) => srcOf(m) && isImg(m) && m.role !== "cover").map((m) => driveThumb(srcOf(m)));
    const poster = d.thumb || (cover && srcOf(cover));
    return { video: v && srcOf(v), poster, images: imgs.length ? imgs : !v && poster ? [poster] : [] };
  }
  // Vidéo verticale (TikTok, YouTube Shorts) : cadre 9:16 et texte en bas.
  function vertPreview(d, net, srcs) {
    const cap = C.textOut(d, net, S.state.settings) || "";
    const title = net === "youtube" ? (A.guessTitle(cap) || d.title || "") : cap;
    const med = srcs.video ? '<video muted playsinline loop preload="metadata" src="' + esc(srcs.video) + '"' + (srcs.poster ? ' poster="' + esc(srcs.poster) + '"' : "") + "></video>"
      : srcs.images.length ? '<img src="' + esc(srcs.images[0]) + '" alt="">' : '<span class="igph">' + icon("film") + "Ajoute une vidéo</span>";
    return '<div class="cpvert">' + med + '<div class="cpvbot"><b>' + brand(net) + " " + esc(T(net)) + "</b><p>" + esc([...title].slice(0, 150).join("")) + ([...title].length > 150 ? "…" : "") + "</p></div></div>";
  }
  function preview(d, net) {
    const srcs = srcsOf(d);
    if (net === "instagram") return A.igPreview(Object.assign({}, d, { caption: C.textOut(d, "instagram", S.state.settings) }), srcs, d.format === "reel" || d.format === "video" ? "reel" : "feed");
    if (net === "tiktok" || net === "youtube") return vertPreview(d, net, srcs);
    if (A.netPreviewNets({ networks: [net] }).length) return A.netPreview(d, net, srcs);
    const cap = C.textOut(d, net, S.state.settings);
    return '<div class="nppost"><div class="npu">' + brand(net) + "<b>" + esc(T(net)) + '</b></div><p class="nptext">' + (cap ? esc(cap).replace(/\n/g, "<br>") : '<span class="muted">Pas encore de texte</span>') + "</p>" +
      (srcs.images[0] ? '<div class="npmed one"><img src="' + esc(srcs.images[0]) + '" alt=""></div>' : "") + "</div>";
  }

  A.compose = function (id) {
    const set = S.state.settings, nets0 = A.nets();
    const orig = id ? S.post(id) : null;
    if (id && !orig) return;
    const d = orig ? JSON.parse(JSON.stringify(orig)) : { id: "n" + Date.now().toString(36), ref: "", title: "", format: "", networks: [nets0[0]], date: null, time: null, caption: "", captionValidated: false, manual: false, media: [], stage: "idea", status: "draft" };
    const autoFormat = !orig, autoTitle = !orig || !orig.title || orig.title === "Nouveau post";
    const drafts = Object.assign({ "": d.caption || "" }, d.captions || {});
    let cur = "", pv = d.networks[0], dirty = false;
    const kids = orig ? S.state.posts.filter((k) => k.parent === orig.id) : [];
    const slots = set.slots || [];
    const isSlot = !d.time || slots.some((s) => s.time === d.time);
    const tpl = set.templates || {}, tags = tpl.tags || [], sets = (tpl.sets || []).filter((g) => g.name && (g.networks || []).length);
    const story = () => d.format === "story";

    const html = '<div class="cp-head"><h2>' + (orig ? "Modifier la publication" : "Créer une publication") + '</h2><span class="grow"></span>' +
      '<div class="seg cp-tabs" role="group" aria-label="Vue"><button type="button" data-cpview="edit" aria-pressed="true">Écrire</button><button type="button" data-cpview="pv" aria-pressed="false">Aperçu</button></div>' +
      '<button class="iconbtn" data-close aria-label="Fermer">' + icon("x") + "</button></div>" +
      '<div class="cp-main"><section class="cp-edit">' +
        '<div class="cp-nets" role="group" aria-label="Réseaux">' + nets0.map((n) => '<button type="button" class="cp-net n-' + n + '" data-cpnet="' + n + '" aria-pressed="' + d.networks.includes(n) + '" title="' + esc(T(n)) + '" style="--bc:' + (((window.BRANDS || {})[n] || {}).color || "var(--ink3)") + '">' + brand(n, "lg") + '<span class="lbl">' + esc(T(n)) + "</span></button>").join("") +
          (sets.length ? '<span class="cp-sets">' + sets.map((g, i) => '<button type="button" class="chip sm" data-cpset="' + i + '">' + esc(g.name) + "</button>").join("") + "</span>" : "") + "</div>" +
        '<div class="cp-box"><div class="cp-capt" role="tablist" aria-label="Texte par réseau"></div>' +
          '<textarea id="cp-text" class="cp-text" placeholder="Écris ton texte ici…" aria-label="Texte du post"></textarea>' +
          '<p class="muted cp-hint" id="cp-hint" hidden></p>' +
          '<div class="cp-media" id="cp-media"></div><ul class="cp-warn" id="cp-warn" hidden></ul>' +
          '<div class="cp-tools"><button type="button" class="btn sm" data-cp="media">' + icon("image") + "Insérer un média</button>" +
            (tpl.signature ? '<button type="button" class="btn sm quiet" data-cptpl="sig" title="Ajouter la signature">' + icon("pen") + "Signature</button>" : "") +
            tags.map((t, i) => '<button type="button" class="btn sm quiet" data-cptpl="' + i + '">#&nbsp;' + esc(t.name) + "</button>").join("") +
            '<button type="button" class="btn sm quiet" data-cp="rewrite" id="cp-rw" hidden>' + icon("spark") + "Réécrire avec Claude</button>" +
            '<button type="button" class="btn sm quiet" data-cp="adapt" id="cp-ad" hidden>' + icon("spark") + "Adapter pour chaque réseau</button>" +
            '<span class="grow"></span><span class="cp-count" id="cp-count"></span></div>' +
          '<div class="cp-add" id="cp-add" hidden><label class="btn sm">' + icon("download") + 'Depuis l\'appareil<input type="file" id="cp-file" accept="image/*,video/*" multiple hidden></label>' +
            '<button type="button" class="btn sm" data-cp="lib">' + icon("contents") + "Bibliothèque</button>" +
            '<input type="url" id="cp-url" pattern="https://.+" aria-describedby="cp-url-err" placeholder="ou colle le lien d\'une image ou d\'une vidéo (https://…)"><button type="button" class="btn sm" data-cp="addurl">Ajouter</button><span class="ferr" id="cp-url-err">Un lien qui commence par https://</span></div>' +
          '<div class="cp-lib" id="cp-lib" hidden><input type="search" id="cp-libq" placeholder="Chercher un média (nom du fichier ou titre du post)" aria-label="Chercher dans la bibliothèque"><div class="cp-libgrid" id="cp-libgrid"></div></div>' +
          '<div class="bar" id="cp-bar" hidden><i></i></div></div>' +
        '<details class="cp-set" id="cp-set"><summary>' + icon("settings") + "Paramètres</summary><div class=\"form\">" +
          '<label>Titre (pour toi, dans le calendrier)<input id="cp-title" placeholder="Pris dans la première ligne si tu le laisses vide"></label>' +
          A.seriesField("cp-series", d) +
          '<label>Format<select id="cp-format">' + Object.entries(C.FORMATS).map(([k, l]) => '<option value="' + k + '">' + l + "</option>").join("") + "</select></label>" +
          '<label class="toggle"><input type="checkbox" id="cp-manual"> Publier à la main (rappel au lieu d\'un envoi automatique)</label>' +
          '<label id="cp-fcl">Premier commentaire (Instagram, Facebook)<textarea id="cp-fc" rows="2" placeholder="Hashtags, lien… posté juste après la publication"></textarea></label>' +
          '<label>Description des images (texte alternatif)<textarea id="cp-alt" rows="2" placeholder="Ce qu\'on voit sur l\'image, pour les personnes qui ne la voient pas"></textarea></label>' +
          '<button type="button" class="btn sm quiet" data-cp="alt" id="cp-altgo">' + icon("spark") + "Proposer avec Claude</button>" +
        "</div></details></section>" +
        '<section class="cp-pv"><h3>Aperçu</h3><div class="seg cp-pvnets" role="group" aria-label="Aperçu sur"></div><div class="cp-pvbox" id="cp-pv"></div></section></div>' +
      '<div class="cp-foot"><div class="cp-when"><label><span class="sr">Jour</span><input type="date" id="cp-date"></label>' +
        '<label><span class="sr">Heure</span><select id="cp-slot"><option value="">Heure…</option>' + slots.map((s) => '<option value="' + s.time + '">' + s.time + " · " + esc(s.label) + "</option>").join("") + '<option value="other">Autre heure…</option></select></label>' +
        '<label id="cp-otherl" hidden><span class="sr">Heure précise</span><input type="time" id="cp-time"></label>' + bestChip() + "</div>" +
        (A.canValidate() ? '<label class="toggle cp-val"><input type="checkbox" id="cp-val"> Texte validé</label>' : "") +
        '<span class="grow"></span>' +
        (!orig || orig.status === "draft" ? '<button class="btn" data-cp="draft">Enregistrer en brouillon</button>' : "") +
        '<button class="btn primary" data-cp="go" id="cp-go"></button></div>';

    A.lastFocus = document.activeElement;
    layer().innerHTML = '<div class="scrim" data-close></div><div class="composer" role="dialog" aria-modal="true" aria-label="' + esc(orig ? "Modifier la publication" : "Créer une publication") + '">' + html + "</div>";
    U.modal(layer(), A.closeLayer);
    document.body.style.overflow = "hidden";
    const L = layer().querySelector(".composer"), $ = (s) => L.querySelector(s);
    const text = $("#cp-text");

    // Valeurs de départ.
    text.value = drafts[""];
    $("#cp-title").value = autoTitle ? "" : d.title;
    $("#cp-format").value = d.format || A.guessFormat(d.media);
    $("#cp-manual").checked = !!d.manual; $("#cp-fc").value = d.firstComment || ""; $("#cp-alt").value = d.alt || "";
    $("#cp-date").value = d.date || ""; $("#cp-slot").value = d.time ? (isSlot ? d.time : "other") : "";
    $("#cp-time").value = d.time || "12:00"; $("#cp-otherl").hidden = isSlot;
    if ($("#cp-val")) $("#cp-val").checked = !!d.captionValidated;
    if (!d.format) d.format = $("#cp-format").value;

    const when = () => { const sv = $("#cp-slot").value; return { date: $("#cp-date").value || null, time: sv === "other" ? $("#cp-time").value || null : sv || null }; };
    const goLabel = () => { const w = when(); $("#cp-go").innerHTML = icon(w.date ? "calendar" : "check") + (orig && orig.date && w.date ? "Enregistrer" : w.date ? "Programmer" : orig ? "Enregistrer" : "Ajouter à « Prêts à programmer »"); };

    function tabs() {
      const ad = $("#cp-ad"); if (ad) ad.hidden = !!cur || d.networks.length < 2 || story() || !(S.state.rewrite || S.mode !== "api");
      const box = $(".cp-capt");
      if (story() || d.networks.length < 2) { box.innerHTML = ""; if (cur) setTab(""); return; }
      const own = (n) => !!(drafts[n] && drafts[n].trim());
      box.innerHTML = '<button type="button" role="tab" data-cptab="" aria-selected="' + !cur + '">' + icon("dup") + "Tous les réseaux</button>" +
        d.networks.map((n) => '<button type="button" role="tab" data-cptab="' + n + '" aria-selected="' + (cur === n) + '" title="Texte propre à ' + esc(T(n)) + '">' + brand(n) + (own(n) ? '<i class="own" aria-label="texte propre"></i>' : "") + "</button>").join("");
    }
    function setTab(n) {
      drafts[cur] = text.value; cur = n; text.value = drafts[cur] || ""; text.placeholder = cur ? drafts[""] || "Texte propre à " + T(cur) : story() ? "Consigne pour la story (une story n'a pas de légende)" : "Écris ton texte ici…";
      const h = $("#cp-hint"); h.hidden = !cur; h.textContent = cur ? "Texte propre à " + T(cur) + ". Laisse vide pour reprendre le texte commun." : "";
      $("#cp-rw").hidden = !cur || !(S.state.rewrite || S.mode !== "api");
      if (cur) { pv = cur; }
      tabs(); count(); draw();
    }
    function count() {
      const lims = (cur ? [cur] : d.networks).map((n) => C.TEXT_MAX[n]).filter(Boolean);
      const max = lims.length ? Math.min.apply(null, lims) : 0, len = [...text.value].length;
      const c = $("#cp-count");
      c.textContent = (max ? len + " / " + max : len + " caractères") + " · " + C.hashtags(text.value) + " #";
      c.classList.toggle("over", !!(max && len > max));
      c.title = max ? "Limite la plus courte des réseaux choisis" : "";
    }
    function sync() {
      drafts[cur] = text.value;
      if (story()) d.note = drafts[""]; else d.caption = drafts[""];
      const own = {}; d.networks.forEach((n) => { const v = (drafts[n] || "").trim(); if (v && v !== (drafts[""] || "").trim()) own[n] = drafts[n]; });
      if (Object.keys(own).length) d.captions = own; else delete d.captions;
      d.title = $("#cp-title").value.trim() || A.guessTitle(drafts[""]) || (orig && !autoTitle ? orig.title : "Nouveau post");
      d.format = $("#cp-format").value; d.manual = $("#cp-manual").checked;
      { const sv = $("#cp-series").value.trim(); if (sv) d.series = sv; else delete d.series; }
      if (d.networks.length && !C.autoNets(Object.assign({}, d, { manual: false }), S.state.settings).length) d.manual = true; // tous les réseaux sont « à la main »
      const fc = $("#cp-fc").value.trim(); if (fc) d.firstComment = fc; else delete d.firstComment;
      const alt = $("#cp-alt").value.trim(); if (alt) d.alt = alt; else delete d.alt;
    }
    function draw() {
      warn();
      sync();
      if (!d.networks.includes(pv)) pv = d.networks[0];
      $(".cp-pvnets").innerHTML = d.networks.length > 1 ? d.networks.map((n) => '<button type="button" data-cppv="' + n + '" aria-pressed="' + (n === pv) + '">' + brand(n) + '<span class="lbl">' + esc(T(n)) + "</span></button>").join("") : "";
      // La vidéo déjà en lecture est gardée telle quelle : pas de clignotement à chaque lettre tapée.
      const old = $("#cp-pv video");
      $("#cp-pv").innerHTML = pv ? preview(d, pv) : '<p class="muted">Choisis au moins un réseau.</p>';
      const v = $("#cp-pv video");
      if (v && old && old.getAttribute("src") === v.getAttribute("src")) { old.className = v.className; v.replaceWith(old); }
      else if (v) { v.loop = true; v.play().catch(() => {}); }
      $("#cp-fcl").hidden = story() || !d.networks.some((n) => n === "instagram" || n === "facebook");
    }
    function media() {
      $("#cp-media").innerHTML = (d.media || []).map((m, i) => '<span class="cp-thumb">' + (isVid(m) ? (srcOf(m) ? '<video class="cp-vid" muted playsinline preload="metadata" src="' + esc(srcOf(m)) + '#t=1"></video>' : '<span class="cp-vid">' + icon("film") + "</span>") : srcOf(m) ? '<img src="' + esc(driveThumb(srcOf(m))) + '" alt="">' : '<span class="cp-vid">' + icon("image") + "</span>") +
        '<small title="' + esc(m.name || "") + '">' + esc(m.name || "média") + '</small><button type="button" class="iconbtn" data-cpdel="' + i + '" aria-label="Retirer ' + esc(m.name || "le média") + '">' + icon("x") + "</button></span>").join("");
      if (autoFormat) { $("#cp-format").value = A.guessFormat(d.media); }
      draw();
      (d.media || []).forEach((m) => { if (!m._probed) probe(m); });
    }
    // Durée, dimensions et poids d'un média, relevés dans le navigateur pour les contrôles par réseau.
    function probe(m) {
      m._probed = true;
      const src = srcOf(m); if (!src) return;
      const done = () => { warn(); };
      if (isVid(m)) {
        const v = document.createElement("video"); v.preload = "metadata"; v.muted = true;
        v.onloadedmetadata = () => { if (isFinite(v.duration)) m.dur = Math.round(v.duration * 10) / 10; if (v.videoWidth) { m.w = v.videoWidth; m.h = v.videoHeight; } done(); };
        v.src = src;
      } else {
        const im = new Image(); im.onload = () => { m.w = im.naturalWidth; m.h = im.naturalHeight; done(); }; im.src = src;
      }
    }
    // Problèmes de médias pour les réseaux cochés, en direct.
    function warn() {
      const box = $("#cp-warn"); if (!box) return;
      const fm = $("#cp-format") ? $("#cp-format").value || A.guessFormat(d.media) : d.format;
      const list = C.mediaChecks(Object.assign({}, d, { format: fm }));
      box.hidden = !list.length;
      box.innerHTML = list.map((c) => '<li class="' + c.level + '">' + icon(c.level === "block" ? "alert" : "eye") + "<span>" + esc(c.text) + "</span></li>").join("");
    }
    const touch = () => { dirty = true; };

    tabs(); count(); media(); goLabel();
    text.focus();

    text.addEventListener("input", () => { touch(); count(); draw(); tabs(); text.focus(); const v = $("#cp-val"); if (v && v.checked) { v.checked = false; U.toast("Texte modifié : coche « Texte validé » à nouveau quand il est bon"); } });
    L.querySelectorAll("#cp-title,#cp-fc,#cp-alt").forEach((x) => x.addEventListener("input", () => { touch(); draw(); }));
    L.querySelectorAll("#cp-format,#cp-manual").forEach((x) => x.addEventListener("change", () => { touch(); if (story()) setTab(""); tabs(); draw(); }));
    const bc = $("#cp-best"); if (bc) bc.addEventListener("click", () => {
      const hh = String(bc.dataset.h).padStart(2, "0"), sl = slots.find((x) => x.time.slice(0, 2) === hh);
      if (sl) { $("#cp-slot").value = sl.time; $("#cp-otherl").hidden = true; } else { $("#cp-slot").value = "other"; $("#cp-time").value = hh + ":00"; $("#cp-otherl").hidden = false; }
      touch(); goLabel();
    });
    $("#cp-slot").addEventListener("change", () => { $("#cp-otherl").hidden = $("#cp-slot").value !== "other"; touch(); goLabel(); });
    $("#cp-date").addEventListener("change", () => { if ($("#cp-date").value && !$("#cp-slot").value && slots[0]) $("#cp-slot").value = slots[0].time; touch(); goLabel(); });
    $("#cp-time").addEventListener("change", touch);
    $("#cp-file").addEventListener("change", (e) => { addFiles([...e.target.files]); e.target.value = ""; });
    L.addEventListener("dragover", (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) { e.preventDefault(); L.classList.add("drop"); } });
    L.addEventListener("dragleave", (e) => { if (e.target === L) L.classList.remove("drop"); });
    L.addEventListener("drop", (e) => { if (!e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); L.classList.remove("drop"); addFiles([...e.dataTransfer.files]); });

    L.addEventListener("click", async (e) => {
      let b;
      if ((b = e.target.closest("[data-cpnet]"))) {
        const n = b.dataset.cpnet, on = d.networks.includes(n);
        if (on && d.networks.length === 1) { U.toast("Garde au moins un réseau"); return; }
        d.networks = on ? d.networks.filter((x) => x !== n) : nets0.filter((x) => x === n || d.networks.includes(x));
        if (!on) pv = n;
        b.setAttribute("aria-pressed", String(!on)); touch();
        if (on && cur === n) setTab(""); else { tabs(); count(); draw(); }
        return;
      }
      if ((b = e.target.closest("[data-cpset]"))) {
        const g = sets[+b.dataset.cpset]; d.networks = nets0.filter((n) => g.networks.includes(n)); if (!d.networks.length) d.networks = [nets0[0]];
        L.querySelectorAll("[data-cpnet]").forEach((x) => x.setAttribute("aria-pressed", String(d.networks.includes(x.dataset.cpnet))));
        touch(); setTab(""); return;
      }
      if ((b = e.target.closest("[data-cptab]"))) { setTab(b.dataset.cptab); text.focus(); return; }
      if ((b = e.target.closest("[data-cppv]"))) { pv = b.dataset.cppv; draw(); return; }
      if ((b = e.target.closest("[data-cptpl]"))) {
        const t = b.dataset.cptpl === "sig" ? tpl.signature : (tags[+b.dataset.cptpl] || {}).text; if (!t) return;
        const v = text.value.replace(/\s+$/, ""); text.value = (v ? v + "\n\n" : "") + t; text.dispatchEvent(new Event("input")); return;
      }
      if ((b = e.target.closest("[data-cpdel]"))) { d.media.splice(+b.dataset.cpdel, 1); touch(); media(); return; }
      if ((b = e.target.closest("[data-cpview]"))) { L.dataset.view = b.dataset.cpview; L.querySelectorAll("[data-cpview]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); if (b.dataset.cpview === "pv") draw(); return; }
      if (!(b = e.target.closest("[data-cp]"))) return;
      const act = b.dataset.cp;
      if (act === "media") { const a = $("#cp-add"); a.hidden = !a.hidden; if (!a.hidden) $("#cp-url").focus(); return; }
      if (act === "lib") { const l = $("#cp-lib"); l.hidden = !l.hidden; if (!l.hidden) { lib(); $("#cp-libq").focus(); } return; }
      if (act === "libadd") {
        const x = libItems[+b.dataset.i]; if (!x) return;
        const m = JSON.parse(JSON.stringify(x.m)); delete m._pv; delete m._probed; delete m.role;
        d.media.push(m); touch(); media(); lib(); U.toast("Média ajouté"); return;
      }
      if (act === "addurl") {
        const u = $("#cp-url").value.trim();
        if (!/^https:\/\//i.test(u)) { U.toast("Le lien doit commencer par https://"); return; }
        const name = decodeURIComponent(u.split("?")[0].split("/").pop() || "média").slice(0, 200);
        d.media.push({ name, type: /\.(mp4|mov|webm|m4v)(\?|$)/i.test(u) ? "video" : "image", url: u });
        $("#cp-url").value = ""; touch(); media(); return;
      }
      if (act === "rewrite") return rewrite(b);
      if (act === "alt") return suggestAlt(b);
      if (act === "adapt") return adapt(b);
      if (act === "draft" || act === "go") return save(act);
    });

    // Bibliothèque : les médias déjà utilisés dans les posts, du plus récent au plus ancien, sans doublon.
    let libItems = [];
    function lib() {
      const norm = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const q = norm($("#cp-libq").value.trim());
      libItems = A.mediaLibrary().filter((x) => !q || norm(x.m.name).includes(q) || norm(x.p.title).includes(q));
      const have = new Set((d.media || []).map((m) => m.drive || m.url));
      const shown = libItems.slice(0, 48);
      $("#cp-libgrid").innerHTML = shown.length ? shown.map((x, i) => { const src = srcOf(x.m), v = isVid(x.m), on = have.has(x.m.drive || x.m.url);
        return '<button type="button" class="cp-libit" data-cp="libadd" data-i="' + i + '"' + (on ? ' aria-pressed="true" title="Déjà dans ce post"' : ' title="' + esc(x.m.name || "") + '"') + ">" +
          (v ? '<span class="cp-vid">' + icon("film") + "</span>" : src ? '<img loading="lazy" src="' + esc(driveThumb(src)) + '" alt="">' : '<span class="cp-vid">' + icon("image") + "</span>") +
          '<small data-noi18n>' + esc(x.m.name || "média") + '</small><small class="muted" data-noi18n>' + esc(x.p.title || "") + "</small></button>"; }).join("") +
          (libItems.length > shown.length ? '<p class="muted small">' + (libItems.length - shown.length) + " autres : précise ta recherche.</p>" : "")
        : '<p class="muted small">' + (q ? "Aucun média ne correspond." : "Pas encore de média dans tes posts.") + "</p>";
    }
    L.addEventListener("input", (e) => { if (e.target.id === "cp-libq") lib(); });

    async function addFiles(files) {
      files = files.filter((f) => /^(image|video)\//.test(f.type));
      if (!files.length) { U.toast("Choisis une image ou une vidéo"); return; }
      if (S.mode !== "api") {
        files.forEach((f) => d.media.push({ name: f.name, type: /^video/.test(f.type) ? "video" : "image", url: URL.createObjectURL(f), local: true, size: f.size, mime: f.type }));
        touch(); media(); U.toast("Mode démo : le fichier reste dans ce navigateur"); return;
      }
      if (!A.canDeposit()) { U.toast(A.depositHint); return; }
      const dest = (d.folder && !/^https?:/.test(d.folder) ? d.folder : (set.drive && set.drive.inbox) || "PlanneRs/depots");
      const bar = $("#cp-bar"); bar.hidden = false;
      for (const f of files) {
        try {
          const r = await A.deposit(f, dest, (f2) => { bar.firstChild.style.width = Math.round(f2 * 100) + "%"; });
          d.media.push(A.depositMedia(r, f, { _pv: URL.createObjectURL(f), size: f.size, mime: f.type }));
          if (!d.folder) d.folder = dest;
          if (r.where && !r.url && !d.store) d.store = r.where;
          touch(); media();
        } catch (er) { U.toast("Envoi impossible : " + er.message); }
      }
      bar.hidden = true; bar.firstChild.style.width = "0";
    }

    // Texte alternatif proposé par Claude d'après la première image ; à relire, rien n'est enregistré tout seul.
    async function suggestAlt(btn) {
      const img = (d.media || []).find((m) => m.role !== "guide" && m.role !== "cover" && !isVid(m));
      if (!img) { U.toast("Ajoute d'abord une image au post"); return; }
      const box = $("#cp-alt");
      if (S.mode !== "api") { box.value = "Une baguette dorée posée sur une planche en bois, à côté d'un pot de levain. Texte sur l'image : « 3 erreurs à éviter »."; U.toast("Mode démo : exemple de texte alternatif"); return; }
      if (!S.state.rewrite) { U.toast("Ajoute la clé ANTHROPIC_API_KEY au Worker pour que Claude propose le texte"); return; }
      btn.disabled = true; U.toast("Claude regarde l'image…");
      try { const r = await S.call("POST", "alt/suggest", { media: img, title: $("#cp-title") ? $("#cp-title").value : d.title, caption: drafts[""] || text.value || "" }); box.value = r.alt; box.focus(); U.toast("Proposition de Claude : relis-la avant d'enregistrer"); }
      catch (x) { U.toast("Proposition impossible : " + x.message); }
      finally { btn.disabled = false; }
    }
    async function rewrite(btn) {
      const net = cur; if (!net) return;
      if (S.mode !== "api") { U.toast("Mode démo : la réécriture demande une clé Claude sur ton instance"); return; }
      if (!orig) { U.toast("Enregistre d'abord le post, puis réécris-le pour " + T(net)); return; }
      btn.disabled = true; U.toast("Claude réécrit le texte…");
      try {
        const r = await S.call("POST", "posts/" + encodeURIComponent(d.id) + "/rewrite", { net, caption: drafts[""] || "" });
        if (cur === net) { text.value = r.text; text.dispatchEvent(new Event("input")); }
        U.toast(r.over ? "Proposition un peu trop longue : raccourcis-la" : "Proposition de Claude : relis-la avant d'enregistrer");
      } catch (x) { U.toast("Réécriture impossible : " + x.message); }
      finally { btn.disabled = false; }
    }

    // Un texte par réseau à partir du texte commun ; chaque proposition est à relire (la case « Texte validé » se décoche).
    async function adapt(btn) {
      drafts[cur] = text.value;
      const base = (drafts[""] || "").trim();
      if (!base) { U.toast("Écris d'abord le texte commun"); return; }
      const nets = d.networks.slice();
      let r;
      btn.disabled = true; U.toast("Claude adapte le texte pour " + nets.map(T).join(", ") + "…");
      try {
        if (S.mode !== "api") {
          const cut = (n, m) => { const t = [...base]; return t.length > m ? t.slice(0, m - 1).join("") + "…" : base; };
          r = { captions: Object.fromEntries(nets.map((n) => [n, n === "x" ? cut(base, 280) : n === "youtube" ? base.split("\n")[0] + "\n\n" + (base.match(/#[\p{L}\p{N}_]+/gu) || []).slice(0, 3).join(" ") : base])), over: [], failed: {} };
        } else r = await S.call("POST", "adapt", { title: $("#cp-title") ? $("#cp-title").value : d.title, format: d.format, caption: base, networks: nets });
        Object.entries(r.captions).forEach(([n, t]) => { drafts[n] = t; });
        touch(); const v = $("#cp-val"); if (v) v.checked = false;
        tabs(); count(); draw();
        const miss = Object.keys(r.failed || {});
        U.toast((S.mode !== "api" ? "Démo : " : "") + "Un texte par réseau (onglets) : relis chacun avant de valider" + (r.over && r.over.length ? ". Trop long : " + r.over.map(T).join(", ") : "") + (miss.length ? ". Pas fait : " + miss.map(T).join(", ") : ""));
      } catch (x) { U.toast("Adaptation impossible : " + x.message); }
      finally { btn.disabled = false; }
    }

    // Heure conseillée d'après les stats (si assez de posts publiés).
    function bestChip() {
      const b = A.bestTimes && A.bestTimes(); const h = b && b.hours[0];
      if (!h || h.gain <= 0) return "";
      return '<button type="button" class="cp-best" id="cp-best" data-h="' + h.k + '" title="D\'après tes stats : ' + h.n + ' posts publiés vers ' + h.k + ' h">Conseillé : <b>' + h.k + " h</b> (+" + h.gain + " %)</button>";
    }

    async function save(act) {
      sync();
      const w = when();
      if (act === "go" && w.date && !w.time) { U.toast("Choisis une heure"); $("#cp-slot").focus(); return; }
      if (d.media.some((m) => m.local)) { U.toast("Mode démo : les fichiers de cet appareil ne sont pas gardés"); d.media = d.media.filter((m) => !m.local); }
      const before = orig ? JSON.stringify([orig.caption || "", orig.captions || {}, orig.note || ""]) : "";
      const changedText = !orig || before !== JSON.stringify([d.caption || "", d.captions || {}, d.note || ""]);
      const val = $("#cp-val");
      d.captionValidated = val ? val.checked : changedText ? false : !!d.captionValidated;
      if (act === "draft") { d.status = "draft"; d.date = null; d.time = null; d.stage = (d.caption || d.note || "").trim() ? "caption" : d.media.length ? "media" : "idea"; }
      else if (d.status === "draft" || !orig) { d.status = "ready"; d.stage = d.captionValidated ? "ready" : "caption"; }
      if (d.stage === "caption" && d.captionValidated) d.stage = "ready";
      const moveLater = orig && kids.length && act === "go" && (w.date !== orig.date || w.time !== orig.time);
      if (act === "go" && !moveLater) { d.date = w.date; d.time = w.date ? w.time : null; }
      if (orig && orig.title !== d.title && !$("#cp-title").value.trim() && !autoTitle) d.title = orig.title;
      delete d.linkCheck;
      d.media.forEach((m) => { delete m._pv; delete m._probed; });
      await S.savePosts([d]);
      await S.log({ level: "change", text: (orig ? "Post modifié : " : "Nouveau post : ") + d.title + (changedText && !d.captionValidated ? " (texte à valider)" : ""), postId: d.id });
      dirty = false; A.beforeClose = null; A.closeLayer();
      if (moveLater) A.queueMove(d.id, { date: w.date, time: w.date ? w.time : null });
      A.render();
      U.toast(act === "draft" ? "Brouillon enregistré" : d.date ? (d.captionValidated ? "Programmé le " + C.shortDay(d.date) + " à " + d.time : "Programmé le " + C.shortDay(d.date) + " à " + d.time + " : texte à valider avant l'envoi") : moveLater ? "Enregistré : valide le changement de date en bas de l'écran" : "Enregistré dans « Prêts à programmer »",
        { label: "Ouvrir", fn: () => A.openPost(d.id) });
    }
    if ($("#cp-val")) $("#cp-val").addEventListener("change", touch);

    A.beforeClose = () => { if (!dirty) return true; if (confirm("Fermer sans enregistrer ? Tes modifications seront perdues.")) { dirty = false; return true; } return false; };
  };
})();
