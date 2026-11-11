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
  A.guessFormat = function (media) {
    const ms = (media || []).filter((m) => m.role !== "guide" && m.role !== "cover");
    if (ms.some(isVid)) return "reel";
    const n = ms.filter(isImg).length;
    return n > 1 ? "carousel" : n === 1 ? "image" : "text";
  };
  // Titre déduit de la première ligne utile du texte.
  A.guessTitle = (cap) => { const l = String(cap || "").split("\n").map((x) => x.trim()).find((x) => x && !/^[#@]/.test(x)); return l ? [...l].slice(0, 80).join("") : ""; };

  function srcsOf(d) {
    const v = (d.media || []).find((m) => m.url && isVid(m));
    const imgs = (d.media || []).filter((m) => m.url && isImg(m) && m.role !== "cover").map((m) => driveThumb(m.url));
    return { video: v && v.url, poster: d.thumb, images: imgs.length ? imgs : !v && d.thumb ? [d.thumb] : [] };
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
    const set = S.state.settings, nets0 = set.networks || ["instagram"];
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
        '<div class="cp-nets" role="group" aria-label="Réseaux">' + nets0.map((n) => '<button type="button" class="cp-net" data-cpnet="' + n + '" aria-pressed="' + d.networks.includes(n) + '" title="' + esc(T(n)) + '">' + brand(n, "lg") + "</button>").join("") +
          (sets.length ? '<span class="cp-sets">' + sets.map((g, i) => '<button type="button" class="chip sm" data-cpset="' + i + '">' + esc(g.name) + "</button>").join("") + "</span>" : "") + "</div>" +
        '<div class="cp-box"><div class="cp-capt" role="tablist" aria-label="Texte par réseau"></div>' +
          '<textarea id="cp-text" class="cp-text" placeholder="Écris ton texte ici…" aria-label="Texte du post"></textarea>' +
          '<p class="muted cp-hint" id="cp-hint" hidden></p>' +
          '<div class="cp-media" id="cp-media"></div>' +
          '<div class="cp-tools"><button type="button" class="btn sm" data-cp="media">' + icon("image") + "Insérer un média</button>" +
            (tpl.signature ? '<button type="button" class="btn sm quiet" data-cptpl="sig" title="Ajouter la signature">' + icon("pen") + "Signature</button>" : "") +
            tags.map((t, i) => '<button type="button" class="btn sm quiet" data-cptpl="' + i + '">#&nbsp;' + esc(t.name) + "</button>").join("") +
            '<button type="button" class="btn sm quiet" data-cp="rewrite" id="cp-rw" hidden>' + icon("spark") + "Réécrire avec Claude</button>" +
            '<span class="grow"></span><span class="cp-count" id="cp-count"></span></div>' +
          '<div class="cp-add" id="cp-add" hidden><label class="btn sm">' + icon("download") + 'Depuis l\'appareil<input type="file" id="cp-file" accept="image/*,video/*" multiple hidden></label>' +
            '<input type="url" id="cp-url" placeholder="ou colle le lien d\'une image ou d\'une vidéo (https://…)"><button type="button" class="btn sm" data-cp="addurl">Ajouter</button></div>' +
          '<div class="bar" id="cp-bar" hidden><i></i></div></div>' +
        '<details class="cp-set" id="cp-set"><summary>' + icon("settings") + "Paramètres</summary><div class=\"form\">" +
          '<label>Titre (pour toi, dans le calendrier)<input id="cp-title" placeholder="Pris dans la première ligne si tu le laisses vide"></label>' +
          '<label>Format<select id="cp-format">' + Object.entries(C.FORMATS).map(([k, l]) => '<option value="' + k + '">' + l + "</option>").join("") + "</select></label>" +
          '<label class="toggle"><input type="checkbox" id="cp-manual"> Publier à la main (rappel au lieu d\'un envoi automatique)</label>' +
          '<label id="cp-fcl">Premier commentaire (Instagram, Facebook)<textarea id="cp-fc" rows="2" placeholder="Hashtags, lien… posté juste après la publication"></textarea></label>' +
          '<label>Description des images (texte alternatif)<textarea id="cp-alt" rows="2" placeholder="Ce qu\'on voit sur l\'image, pour les personnes qui ne la voient pas"></textarea></label>' +
        "</div></details></section>" +
        '<section class="cp-pv"><h3>Aperçu</h3><div class="seg cp-pvnets" role="group" aria-label="Aperçu sur"></div><div class="cp-pvbox" id="cp-pv"></div></section></div>' +
      '<div class="cp-foot"><div class="cp-when"><label><span class="sr">Jour</span><input type="date" id="cp-date"></label>' +
        '<label><span class="sr">Heure</span><select id="cp-slot"><option value="">Heure…</option>' + slots.map((s) => '<option value="' + s.time + '">' + s.time + " · " + esc(s.label) + "</option>").join("") + '<option value="other">Autre heure…</option></select></label>' +
        '<label id="cp-otherl" hidden><span class="sr">Heure précise</span><input type="time" id="cp-time"></label></div>' +
        (A.canValidate() ? '<label class="toggle cp-val"><input type="checkbox" id="cp-val"> Texte validé</label>' : "") +
        '<span class="grow"></span>' +
        (!orig || orig.status === "draft" ? '<button class="btn" data-cp="draft">Enregistrer en brouillon</button>' : "") +
        '<button class="btn primary" data-cp="go" id="cp-go"></button></div>';

    A.lastFocus = document.activeElement;
    layer().innerHTML = '<div class="scrim" data-close></div><div class="composer" role="dialog" aria-modal="true" aria-label="' + esc(orig ? "Modifier la publication" : "Créer une publication") + '">' + html + "</div>";
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
      const fc = $("#cp-fc").value.trim(); if (fc) d.firstComment = fc; else delete d.firstComment;
      const alt = $("#cp-alt").value.trim(); if (alt) d.alt = alt; else delete d.alt;
    }
    function draw() {
      sync();
      if (!d.networks.includes(pv)) pv = d.networks[0];
      $(".cp-pvnets").innerHTML = d.networks.length > 1 ? d.networks.map((n) => '<button type="button" data-cppv="' + n + '" aria-pressed="' + (n === pv) + '">' + brand(n) + '<span class="lbl">' + esc(T(n)) + "</span></button>").join("") : "";
      $("#cp-pv").innerHTML = pv ? preview(d, pv) : '<p class="muted">Choisis au moins un réseau.</p>';
      const v = $("#cp-pv video"); if (v) v.play().catch(() => {});
      $("#cp-fcl").hidden = story() || !d.networks.some((n) => n === "instagram" || n === "facebook");
    }
    function media() {
      $("#cp-media").innerHTML = (d.media || []).map((m, i) => '<span class="cp-thumb">' + (isVid(m) ? '<span class="cp-vid">' + icon("film") + "</span>" : m.url ? '<img src="' + esc(driveThumb(m.url)) + '" alt="">' : '<span class="cp-vid">' + icon("image") + "</span>") +
        '<small title="' + esc(m.name || "") + '">' + esc(m.name || "média") + '</small><button type="button" class="iconbtn" data-cpdel="' + i + '" aria-label="Retirer ' + esc(m.name || "le média") + '">' + icon("x") + "</button></span>").join("");
      if (autoFormat) { $("#cp-format").value = A.guessFormat(d.media); }
      draw();
    }
    const touch = () => { dirty = true; };

    tabs(); count(); media(); goLabel();
    text.focus();

    text.addEventListener("input", () => { touch(); count(); draw(); tabs(); text.focus(); const v = $("#cp-val"); if (v && v.checked) { v.checked = false; U.toast("Texte modifié : coche « Texte validé » à nouveau quand il est bon"); } });
    L.querySelectorAll("#cp-title,#cp-fc,#cp-alt").forEach((x) => x.addEventListener("input", () => { touch(); draw(); }));
    L.querySelectorAll("#cp-format,#cp-manual").forEach((x) => x.addEventListener("change", () => { touch(); if (story()) setTab(""); tabs(); draw(); }));
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
      if (act === "addurl") {
        const u = $("#cp-url").value.trim();
        if (!/^https:\/\//i.test(u)) { U.toast("Le lien doit commencer par https://"); return; }
        const name = decodeURIComponent(u.split("?")[0].split("/").pop() || "média").slice(0, 200);
        d.media.push({ name, type: /\.(mp4|mov|webm|m4v)(\?|$)/i.test(u) ? "video" : "image", url: u });
        $("#cp-url").value = ""; touch(); media(); return;
      }
      if (act === "rewrite") return rewrite(b);
      if (act === "draft" || act === "go") return save(act);
    });

    async function addFiles(files) {
      files = files.filter((f) => /^(image|video)\//.test(f.type));
      if (!files.length) { U.toast("Choisis une image ou une vidéo"); return; }
      if (S.mode !== "api") {
        files.forEach((f) => d.media.push({ name: f.name, type: /^video/.test(f.type) ? "video" : "image", url: URL.createObjectURL(f), local: true }));
        touch(); media(); U.toast("Mode démo : le fichier reste dans ce navigateur"); return;
      }
      const w = (S.state.accounts || {}).gdrivewrite;
      if (!w || w.status !== "ok") { U.toast("Pour envoyer un fichier, connecte d'abord « Google Drive (envoi) » dans Réglages › Stockage. Sinon colle un lien."); return; }
      const dest = (d.folder && !/^https?:/.test(d.folder) ? d.folder : (set.drive && set.drive.inbox) || "PlanneRs/depots");
      const bar = $("#cp-bar"); bar.hidden = false;
      for (const f of files) {
        try {
          const r = await new Promise((ok, ko) => {
            const x = new XMLHttpRequest();
            x.open("POST", "api/drive/upload?path=" + encodeURIComponent(dest) + "&name=" + encodeURIComponent(f.name));
            x.setRequestHeader("content-type", f.type || "application/octet-stream");
            x.upload.onprogress = (ev) => { if (ev.lengthComputable) bar.firstChild.style.width = Math.round(ev.loaded / ev.total * 100) + "%"; };
            x.onload = () => { let j = {}; try { j = JSON.parse(x.responseText); } catch (er) { /* rien */ } if (x.status < 300) ok(j); else ko(new Error(j.error || x.statusText)); };
            x.onerror = () => ko(new Error("Réseau indisponible"));
            x.send(f);
          });
          d.media.push({ name: f.name, type: /^video/.test(f.type) ? "video" : "image", drive: r.id, url: r.url || "" });
          if (!d.folder) d.folder = dest;
          touch(); media();
        } catch (er) { U.toast("Envoi impossible : " + er.message); }
      }
      bar.hidden = true; bar.firstChild.style.width = "0";
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
