/* PlanneRs : La Fabrique. Les vidéos en cours de production (script, voix, montage, sous-titres, relu),
   faites par toi ou par une IA, leur storyboard et la vidéo finie à regarder avant de valider. */
(function () {
  "use strict";
  const C = window.Core, U = window.UI, S = window.Store, A = window.App;
  const { esc, safeUrl, icon, brands } = U;
  const today = () => C.ymd(new Date());
  const en = () => (window.I18N || {}).lang === "en";
  const COLS = C.PROD_STEPS.map(([k, l]) => [k, l]).concat([["ready", "Prêtes"]]);
  const colOf = (pr) => (pr.ready ? "ready" : pr.current.key);
  const fmtDur = (s) => (s >= 60 ? Math.floor(s / 60) + " min " + C.pad(Math.round(s % 60)) + " s" : Math.round(s) + " s");

  const list = () => S.state.posts.filter(C.inFabrique).sort((a, b) => (C.at(a) || "9999").localeCompare(C.at(b) || "9999"));

  function bar(pr) {
    return '<span class="fbar-steps" aria-hidden="true">' + pr.steps.map((x) => '<i class="s-' + x.state + '"></i>').join("") + "</span>";
  }
  function who(pr) {
    if (pr.ready) return '<span class="fwho ok">' + icon("check") + "Prête à valider</span>";
    const c = pr.current;
    if (c.state === "doing") return '<span class="fwho doing"><span class="pulse" aria-hidden="true"></span>' + esc(c.by || "Quelqu'un") + " · " + esc(c.label) + "</span>";
    return '<span class="fwho">' + icon("clock") + "À faire : " + esc(c.label) + "</span>";
  }
  function card(p) {
    const pr = C.prodOf(p), cov = A.coverOf ? A.coverOf(p) : "";
    return '<button class="fcard" data-fab="' + esc(p.id) + '"><span class="pic' + (cov ? "" : " noimg") + '">' + (cov ? '<img src="' + safeUrl(cov) + '" alt="" loading="lazy">' : '<span class="ph">' + icon("film") + "</span>") +
      (p.date ? '<span class="tm">' + esc(C.shortDay(p.date)) + " " + (p.time || "") + "</span>" : '<span class="tm">' + "Sans date" + "</span>") + "</span>" +
      '<span class="ttl" data-noi18n>' + esc(p.title) + '</span><span class="meta">' + brands(p.networks) + '<span class="fmt">' + esc(C.FORMATS[p.format] || "") + (pr.duration ? " · " + fmtDur(pr.duration) : "") + "</span></span>" +
      bar(pr) + who(pr) + "</button>";
  }

  A.views.fabrique = function () {
    const all = list().map((p) => ({ p, pr: C.prodOf(p) }));
    const by = {}; COLS.forEach(([k]) => (by[k] = []));
    all.forEach((x) => by[colOf(x.pr)].push(x));
    const working = all.filter((x) => x.pr.current && x.pr.current.state === "doing").length;
    const f = A.fabSt || "";
    const kpis = COLS.map(([k, l]) => '<button class="pkpi c-' + (k === "ready" ? "published" : "fab") + '" data-fabst="' + k + '" aria-pressed="' + (f === k) + '"><span class="ic">' + icon(k === "ready" ? "check" : k === "script" ? "contents" : k === "voice" ? "mic" : k === "edit" ? "film" : k === "subs" ? "bubble" : "eye") + "</span><b>" + by[k].length + "</b><span>" + esc(l.toLowerCase()) + "</span></button>").join("");
    const cols = COLS.filter(([k]) => !f || f === k).map(([k, l]) => '<section class="wcol fcol" aria-labelledby="fc-' + k + '"><h3 class="wcol-h" id="fc-' + k + '"><span>' + esc(l) + '</span><span class="n">' + (by[k].length || "") + "</span></h3>" +
      (by[k].map((x) => card(x.p)).join("") || '<p class="wnone">Rien</p>') + "</section>").join("");
    const phrase = all.length ? (en() ? all.length + " video" + (all.length > 1 ? "s" : "") + " in production" + (working ? ", " + working + " being worked on right now" : "") : all.length + " vidéo" + (all.length > 1 ? "s" : "") + " en fabrication" + (working ? ", dont " + working + " en cours de travail en ce moment" : "")) : "";
    return {
      title: "La Fabrique",
      sub: "Tes vidéos, de l'idée à la vidéo finie",
      tools: '<span class="grow"></span>' + ('<label class="btn" title="Une vidéo finie à relire : elle part dans ton stockage et devient un Reel dans La Fabrique">' + icon("cloud") + '<span class="lbl">Déposer des vidéos</span><input type="file" accept="video/*" multiple hidden data-fabdrop aria-label="Déposer des vidéos"></label>') + (A.hasStudio ? '<button class="btn" data-cutvideo aria-label="Couper une vidéo (blancs et euh)">' + icon("film") + '<span class="lbl">Couper une vidéo</span></button>' : "") + '<button class="btn primary" data-new aria-label="Nouveau post">' + icon("plus") + '<span class="lbl">Nouveau post</span></button>',
      html: all.length ? '<section class="pband" aria-labelledby="h-fab"><div class="pband-h"><h2 id="h-fab" data-noi18n>' + esc(phrase) + "</h2>" + (f ? '<span class="muted"><button class="lk" data-fabst="">' + icon("x") + "Tout afficher</button></span>" : "") + "</div>" +
        '<div class="pkpis" role="group" aria-label="Filtrer par étape">' + kpis + "</div></section>" +
        '<div class="wcols fcols' + (f ? " one" : "") + '" role="group" aria-label="Vidéos par étape">' + cols + "</div>" +
        '<p class="muted small fhelp">Les étapes se cochent ici, ou toutes seules quand une IA (Claude par le lien MCP) avance sur une vidéo. Ouvre une carte pour voir le storyboard et regarder la vidéo finie.</p>'
        : '<div class="empty">Aucune vidéo en fabrication. Les Reels et vidéos pas encore publiés apparaissent ici, avec leur avancement.</div>',
    };
  };

  // Fiche de fabrication : étapes, storyboard, vidéo finie, validation.
  A.openFab = function (id) {
    const p = S.post(id); if (!p) return;
    const pr = C.prodOf(p);
    const steps = '<ol class="fsteps">' + pr.steps.map((x) => '<li class="s-' + x.state + '"><button class="fstep" data-fabstep="' + x.key + '" aria-label="' + esc(x.label) + " : " + (x.state === "done" ? "fait" : x.state === "doing" ? "en cours" : "à faire") + '. Changer">' +
      '<span class="dot">' + icon(x.state === "done" ? "check" : x.state === "doing" ? "clock" : "dot") + "</span><b>" + esc(x.label) + "</b>" +
      '<span class="muted">' + (x.state === "done" ? "Fait" : x.state === "doing" ? "En cours" : "À faire") + (x.by ? " · " + esc(x.by) : "") + "</span>" + (x.note ? '<span class="fnote" data-noi18n>' + esc(x.note) + "</span>" : "") + "</button></li>").join("") + "</ol>";
    const v = pr.video, vurl = v && /^https?:/.test(v.url || "") ? v.url : "";
    const player = vurl ? '<video class="fvideo" src="' + safeUrl(vurl) + '" controls playsinline preload="metadata"></video>'
      : '<div class="fvideo empty-v">' + icon("film") + "<span>" + (v ? "Vidéo « " + esc(v.name || "") + " » sans adresse publique : ajoute son lien pour la regarder ici." : "La vidéo finie apparaîtra ici à la fin du montage.") + "</span></div>";
    const sb = pr.shots.length ? '<div class="tablewrap" tabindex="0" role="region" aria-label="Storyboard"><table class="sb"><thead><tr><th scope="col">Plan</th><th scope="col">Durée</th><th scope="col">À l\'écran</th><th scope="col">Voix</th><th scope="col">Image</th><th scope="col">Son</th></tr></thead><tbody>' +
      pr.shots.map((x) => '<tr><td class="mono">' + x.n + '</td><td class="mono">' + (x.dur ? x.dur + " s" : "") + '</td><td data-noi18n>' + esc(x.screen) + '</td><td data-noi18n>' + esc(x.voice) + '</td><td data-noi18n>' + esc(x.visual) + '</td><td data-noi18n>' + esc(x.music) + "</td></tr>").join("") +
      "</tbody></table></div>" + '<p class="sbtot' + (pr.tooLong ? " warn" : "") + '">' + icon(pr.tooLong ? "alert" : "clock") + "Durée totale : " + fmtDur(pr.duration) + (pr.tooLong ? " (plus de " + ((p.prod && p.prod.maxSec) || 30) + " s)" : "") + "</p>"
      : '<p class="muted">Pas encore de storyboard. Une IA peut le remplir plan par plan (texte à l\'écran, voix, image, son).</p>';
    A.openLayer('<div class="sh-top"><b data-noi18n>' + esc(p.title) + '</b><span class="muted">' + (p.date ? esc(C.longDate(p.date)) + " " + (p.time || "") : "Sans date") + '</span><span style="flex:1"></span><button class="iconbtn" data-close aria-label="Fermer">' + icon("x") + "</button></div>" +
      '<div class="sh-body fab"><div class="fab-grid"><div class="fab-left">' + player + "</div>" +
      '<div class="fab-right"><h3 class="bh">Avancement · ' + pr.done + "/" + pr.total + "</h3>" + steps + "</div></div>" +
      '<h3 class="bh">Storyboard</h3>' + sb + "</div>" +
      '<div class="sh-foot">' + (pr.ready ? "" : '<button class="btn primary" data-fabok>' + icon("check") + "Vidéo finie et relue</button>") +
      '<button class="btn" data-fabpost>' + icon("contents") + "Fiche du post</button><button class=\"btn quiet\" data-close>Fermer</button></div>", "Fabrication : " + p.title);
    const L = document.getElementById("layer");
    L.querySelector(".sheet").classList.add("wide");
    L.querySelectorAll("[data-fabstep]").forEach((b) => b.addEventListener("click", () => setStep(p.id, b.dataset.fabstep)));
    const ok = L.querySelector("[data-fabok]"); if (ok) ok.addEventListener("click", () => finish(p.id));
    L.querySelector("[data-fabpost]").addEventListener("click", () => { A.closeLayer(); A.openPost(p.id); });
  };

  const me = () => (typeof S.state.me === "string" && S.state.me) || "Toi";
  async function setStep(id, key) {
    const p = S.post(id); if (!p) return;
    const pr = C.prodOf(p), cur = pr.steps.find((x) => x.key === key);
    const next = cur.state === "todo" ? "doing" : cur.state === "doing" ? "done" : "todo";
    p.prod = p.prod || {}; p.prod.steps = Object.assign({}, p.prod.steps);
    // Toutes les étapes affichées sont figées (sinon une étape « devinée » changerait toute seule).
    pr.steps.forEach((x) => { if (!p.prod.steps[x.key]) p.prod.steps[x.key] = { state: x.state }; });
    p.prod.steps[key] = { state: next, by: next === "todo" ? "" : me(), at: C.nowStamp() };
    await S.savePosts([p]);
    await S.log({ level: "change", text: "Fabrique : " + cur.label + " " + (next === "done" ? "fait" : next === "doing" ? "en cours" : "à refaire") + " sur « " + p.title + " »", postId: p.id });
    A.openFab(id); A.render();
  }
  async function finish(id) {
    const p = S.post(id); if (!p) return;
    p.prod = p.prod || {}; p.prod.steps = Object.assign({}, p.prod.steps);
    C.PROD_STEPS.forEach(([k]) => { const o = p.prod.steps[k] || {}; if (o.state !== "done") p.prod.steps[k] = { state: "done", by: o.by || me(), at: C.nowStamp() }; });
    await S.savePosts([p]);
    await S.log({ level: "change", text: "Fabrique : vidéo finie et relue, « " + p.title + " »", postId: p.id });
    A.closeLayer(); A.render();
    U.toast(p.captionValidated ? "Vidéo prête" : "Vidéo prête. Reste à valider la légende", p.captionValidated ? null : { label: "Relire", fn: () => A.openPost(p.id) });
  }

  // Studio vidéo : présent seulement dans la version privée (dossier web/studio/).
  // Le résultat est retenu : le bouton reste là même si la vérification échoue un jour (hors ligne, session expirée).
  try { A.hasStudio = localStorage.getItem("planners-studio") === "1"; } catch (e) { A.hasStudio = false; }
  fetch("studio/VERSION", { cache: "no-store", credentials: "same-origin" }).then((r) => {
    const ok = r.ok && !r.redirected && !/html/i.test(r.headers.get("content-type") || ""); // une page de connexion n'est pas le studio
    if (r.status === 404) { A.hasStudio = false; try { localStorage.removeItem("planners-studio"); } catch (e) { /* rien */ } }
    else if (ok) { const was = A.hasStudio; A.hasStudio = true; try { localStorage.setItem("planners-studio", "1"); } catch (e) { /* rien */ } if (!was && A.ready && /fabrique/.test(location.hash)) A.render(); }
  }).catch(() => { /* hors ligne : on garde le dernier état connu */ });

  // Couper une vidéo (blancs et « euh ») : écran et moteur dans web/studio/, chargés à la demande.
  A.openCut = function () {
    import(new URL("studio/ui.js", document.baseURI).href).then((m) => m.open())
      .catch((e) => U.toast("Le module de découpe ne s'est pas chargé : " + e.message));
  };

  // Vidéos reçues du studio : une par post, dans La Fabrique, montage et sous-titres faits, à relire.
  // La transcription sert de script : une IA peut en tirer les descriptions par réseau.
  A.receiveStudio = async function (meta) {
    const files = meta.files || [], items = meta.items || [];
    if (!files.length) return;
    location.hash = "#fabrique";
    const dest = (S.state.settings.drive && S.state.settings.drive.inbox) || "PlanneRs/depots";
    const nets = (S.state.settings.networks || ["instagram"]).filter((n) => ["instagram", "facebook", "tiktok", "youtube"].includes(n));
    const made = [];
    for (let i = 0; i < files.length; i++) {
      const fl = files[i], it = items[i] || {};
      if (S.mode === "api") U.toast((files.length > 1 ? "Vidéo " + (i + 1) + "/" + files.length + " : " : "") + "envoi de " + fl.name + "…");
      let media = { name: fl.name, type: "video", role: "final" }, store = "";
      if (S.mode === "api" && !A.canDeposit()) U.toast(A.depositHint);
      else if (S.mode === "api") {
        try {
          const r = await A.deposit(fl, dest);
          media = A.depositMedia(r, fl, { type: "video", role: "final" });
          if (r.where && !r.url) store = r.where;
        } catch (e) { U.toast("Envoi de " + fl.name + " impossible : " + e.message + ". La vidéo est gardée sans fichier : ajoute-la à la main."); }
      }
      const by = "Studio", steps = meta.steps || { script: { state: "done", by }, voice: { state: "done", by }, edit: { state: "done", by }, subs: { state: "done", by }, check: { state: "todo" } };
      const p = {
        id: "s" + Date.now().toString(36) + i, title: fl.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim(), format: "reel",
        networks: nets.length ? nets : ["instagram"], date: null, time: null, caption: "", captionValidated: false, manual: false,
        media: [media], stage: "caption", status: "draft", folder: dest, ...(store ? { store } : {}),
        note: it.note ? String(it.note).slice(0, 6000) : it.text ? "Transcription (studio) :\n" + it.text.replace(/^\d+\s*$/gm, "").replace(/^[\d:,.\s]+-->[\d:,.\s]+$/gm, "").replace(/\n{2,}/g, "\n").trim().slice(0, 4000) : "",
        prod: { steps: Object.assign({}, steps, { edit: Object.assign({}, steps.edit, { at: C.nowStamp() }) }) },
      };
      made.push(p);
    }
    await S.savePosts(made);
    await S.log({ level: "change", text: made.length + " vidéo" + (made.length > 1 ? "s reçues" : " reçue") + (meta.source === "drop" ? " par dépôt : " : " du studio : ") + made.map((p) => p.title).join(", ") });
    A.render();
    U.toast(made.length + " vidéo" + (made.length > 1 ? "s" : "") + " dans La Fabrique, à relire." + (items.some((it) => it.text) ? " Une IA peut écrire les descriptions à partir de la transcription." : ""));
    if (made.length === 1) A.openFab(made[0].id);
  };

  // Dépôt de vidéos finies : bouton, ou glisser-déposer sur La Fabrique
  A.dropVideos = function (list) {
    const files = [...list].filter((f) => /^video\//.test(f.type) || /\.(mp4|mov|m4v|webm)$/i.test(f.name));
    if (!files.length) { U.toast("Dépose des fichiers vidéo (MP4, MOV, WebM)"); return; }
    const by = "Dépôt";
    return A.receiveStudio({ source: "drop", files, items: [], steps: { script: { state: "done", by }, voice: { state: "done", by }, edit: { state: "done", by }, subs: { state: "todo" }, check: { state: "todo" } } });
  };
  document.addEventListener("change", (e) => { if (e.target.matches("[data-fabdrop]") && e.target.files.length) { A.dropVideos(e.target.files); e.target.value = ""; } });
  const onFab = () => /^#fabrique/.test(location.hash) && !document.querySelector("#layer .sheet");
  document.addEventListener("dragover", (e) => { if (onFab() && e.dataTransfer && [...e.dataTransfer.types].includes("Files")) { e.preventDefault(); document.body.classList.add("fabdrag"); } });
  document.addEventListener("dragleave", (e) => { if (!e.relatedTarget) document.body.classList.remove("fabdrag"); });
  document.addEventListener("drop", (e) => { if (!onFab() || !e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); document.body.classList.remove("fabdrag"); A.dropVideos(e.dataTransfer.files); });

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-cutvideo]")) { A.lastFocus = e.target.closest("[data-cutvideo]"); A.openCut(); return; }
    const t = e.target.closest("[data-fab],[data-fabst]");
    if (!t) return;
    if (t.dataset.fab) { A.lastFocus = t; A.openFab(t.dataset.fab); return; }
    A.fabSt = t.dataset.fabst && A.fabSt !== t.dataset.fabst ? t.dataset.fabst : ""; A.render();
  });
})();
