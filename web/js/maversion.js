/* PlanneRs : « Ma version ». L'atelier où l'on reprend la recette d'une publication qui a marché
   (une pépite d'un compte suivi, ou un de tes propres succès), jamais son contenu, et où on la refait
   à ta sauce : sujet, angle, format, durée. Note d'originalité (80 % au moins pour envoyer), carnet de
   recettes, mélange de deux recettes, et la boucle : les recettes qui marchent chez toi passent en tête.
   La partie sans écran est dans recette.js (partagée avec le Worker). Onglet « Ma version » des Stats. */
(function () {
  "use strict";
  const C = window.Core, U = window.UI, S = window.Store, A = window.App, R = window.Recette;
  const { esc, safeUrl, icon, brands } = U;
  const ORDER = ["myth", "before", "top", "qa"];
  const COLORS = ["#6D28D9", "#8B5CF6", "#A78BFA", "#C4B5FD", "#DDD6FE"];
  let M = null; // atelier ouvert
  let mixA = ""; // première recette choisie pour un mélange

  const book = () => (S.state.settings.recipes || []).filter((r) => r && r.id && Array.isArray(r.structure));
  const xs = (n) => "×" + String(n).replace(".", ",");
  async function saveBook(list) { await S.saveSettings(Object.assign({}, S.state.settings, { recipes: list })); }

  // ------------------------------------------------------------ Tes chiffres, la boucle
  function rows() {
    return (S.state.posts || []).filter((p) => !p.parent && p.status === "published").map((p) => {
      const s = A.postStats ? A.postStats(p) : null, v = s ? Object.values(s) : [];
      return { post: p, value: v.reduce((n, m) => n + (+m.likes || 0) + (+m.comments || 0) + (+m.shares || 0), 0) };
    });
  }
  const rank = () => R.ranking(rows());

  // ------------------------------------------------------------ Ouverture
  // src : { type: "pepite", item } | { type: "post", post, score } | { recipe }
  A.openVersion = async function (src) {
    const st = S.state.settings || {};
    M = { src, recipe: src.recipe || null, ai: false, why: "", version: null, busy: !src.recipe, saved: !!(src.recipe && book().some((r) => r.id === src.recipe.id)), focus: document.activeElement,
      sauce: { same: !!src.item, material: "", subject: "", angle: "myth", format: "reel", maxSec: (st.crew && st.crew.maxSec) || 30 } };
    let el = document.getElementById("mv");
    if (!el) { el = document.createElement("dialog"); el.id = "mv"; el.className = "mv mh"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Ma version"); document.body.appendChild(el); }
    el.hidden = false; document.body.style.overflow = "hidden";
    U.modal(el, close);
    if (M.recipe) { M.sauce.format = M.recipe.format || "reel"; if (M.sauce.same) M.sauce.subject = R.sourceSubject(M.recipe); }
    draw();
    if (!M.recipe) {
      const one = M;
      try {
        if (S.mode !== "api") { await new Promise((r) => setTimeout(r, 500)); one.recipe = R.guessRecipe(srcOf(src)); }
        else {
          const r = await S.call("POST", "maversion/recipe", { source: src.type === "link" ? { type: "link", url: src.item.url, caption: src.item.caption, handle: src.item.handle } : { type: src.type, id: src.type === "post" ? src.post.id : src.item.id, score: src.score || 0 } });
          one.recipe = r.recipe; one.ai = r.ai; one.why = r.why || "";
        }
        one.sauce.format = one.recipe.format || "reel";
        if (one.sauce.same && !one.sauce.subject) one.sauce.subject = R.sourceSubject(one.recipe);
      } catch (e) { one.error = e.message; }
      one.busy = false;
      if (M === one) draw();
    }
    const f = el.querySelector("#mv-subject") || el.querySelector("[data-mv-close]");
    if (f) f.focus();
  };
  function srcOf(src) {
    if (src.type === "post") { const p = src.post; return { type: "post", id: p.id, title: p.title, kind: p.format, score: src.score || 0, caption: [p.caption || "", ...((p.prod && p.prod.shots) || []).map((x) => x.voice || "")].filter(Boolean).join("\n") }; }
    return Object.assign({ type: src.type === "link" ? "link" : "pepite" }, src.item);
  }
  function close() {
    const el = document.getElementById("mv"); if (el) { el.hidden = true; el.innerHTML = ""; U.unmodal(el); }
    document.body.style.overflow = "";
    const f = M && M.focus; M = null;
    if (f && f.focus && document.contains(f)) f.focus();
  }

  // ------------------------------------------------------------ Dessin
  function bar(structure) {
    const st = structure || [], total = st.reduce((n, x) => n + (x.sec || 0), 0);
    return '<div class="mv-bar" role="img" aria-label="' + esc(st.map((x) => x.part + (x.sec ? " " + x.sec + " s" : "")).join(", ")) + '">' +
      st.map((x, i) => '<span style="flex:' + (total ? Math.max(x.sec, 1) : 1) + ";background:" + COLORS[Math.min(i, COLORS.length - 1)] + (i >= 3 ? ";color:#2E1065" : "") + '" title="' + esc(x.part) + '">' + esc(x.sec ? x.sec + " s" : String(i + 1)) + "</span>").join("") + "</div>";
  }
  function source() {
    const f = (M.recipe && M.recipe.from) || {}, it = M.src.item, p = M.src.post;
    const head = M.src.type === "post" ? "Ton succès" + (M.src.score ? " · " + xs(M.src.score) + " ta médiane" : "") : it ? (it.handle ? "@" + it.handle : "Lien partagé") : f.handle ? "@" + f.handle : "Recette du carnet";
    const text = M.src.type === "post" ? p.title : it ? it.caption : f.text || "";
    const score = it ? it.score : f.score;
    return '<div class="mv-card mv-src"><div class="mv-row"><span class="mv-play">' + icon(it && (it.kind === "carousel" || it.kind === "image") ? "contents" : "film") + '</span><div class="mv-col"><b data-noi18n>' + esc(head) + "</b>" +
      '<span class="muted small">' + esc(it ? (M.src.type === "link" ? (R.FORMATS[it.kind] || it.kind || "") + " · " + (R.netOfUrl(it.url) || "lien") : (it.kind || "") + " · " + it.metric + " " + it.unit) : M.recipe && M.recipe.mix ? "Mélange de deux recettes" : M.src.type === "post" ? "Publié" + (p.date ? " le " + C.shortDay(p.date) : "") : "") + "</span></div>" +
      (score && M.src.type !== "post" ? '<span class="mv-x">' + xs(score) + "</span>" : "") + "</div>" +
      (text ? '<p class="mv-quote" data-noi18n>« ' + esc(String(text).split("\n")[0].slice(0, 160)) + " »</p>" : "") +
      (M.src.type === "link" && !it.caption ? '<p class="muted small">Le lien seul ne dit pas ce que raconte la vidéo : colle sa légende ou sa transcription dans « Ce que dit l\'original », la version sera plus juste.</p>' : "") +
      '<span class="muted small">' + (M.src.type === "post" ? "On garde ce qui a marché chez toi, sur un nouveau sujet." : "Le lien d'origine reste en note privée. Aucune image ni phrase de l'original n'est reprise telle quelle.") + "</span></div>";
  }
  function recipeCard() {
    if (M.busy) return '<div class="mv-card mv-grow"><h2 class="mv-h">La recette</h2><div class="mv-wait"><span class="mv-spin" aria-hidden="true"></span>' + (S.mode === "api" ? "Claude lit la recette…" : "Lecture de la recette…") + "</div></div>";
    if (M.error) return '<div class="mv-card mv-grow"><h2 class="mv-h">La recette</h2><div class="banner warn">' + esc(M.error) + "</div></div>";
    const r = M.recipe;
    return '<div class="mv-card mv-grow"><div class="mv-row"><h2 class="mv-h">' + (M.ai ? "La recette, vue par Claude" : "La recette") + '</h2><span class="mv-step s1">1</span></div>' +
      '<b class="mv-name" data-noi18n>' + esc(r.name) + "</b>" +
      '<div class="mv-col"><span class="mv-lbl">Structure dans le temps</span>' + bar(r.structure) + "</div>" +
      '<dl class="mv-dl"><dt>Accroche</dt><dd data-noi18n>' + esc(r.hook.type) + (r.hook.pattern ? ' <span class="muted">· ' + esc(r.hook.pattern) + "</span>" : "") + "</dd>" +
      "<dt>Format</dt><dd>" + esc(R.FORMATS[r.format] || r.format) + (r.structure[0] && r.structure[0].sec ? ", " + r.structure.reduce((n, x) => n + x.sec, 0) + " s" : ", " + r.structure.length + " slides") + "</dd>" +
      '<dt>Ressort</dt><dd data-noi18n>' + esc(r.spring) + '</dd><dt>Fin</dt><dd data-noi18n>' + esc(r.ending) + "</dd></dl>" +
      (r.why && r.why.length ? '<details class="mv-why"><summary>Pourquoi ça marche</summary><ul>' + r.why.map((w) => "<li data-noi18n>" + esc(w) + "</li>").join("") + "</ul></details>" : "") +
      (!M.ai && r.guessed ? '<p class="muted small">' + (S.mode === "api" ? "Recette devinée sans Claude" + (M.why ? " (" + esc(M.why) + ")" : " : ajoute la clé API pour une vraie lecture") + "." : "Mode démo : recette devinée. Sur ton instance, Claude la lit avec la clé API.") + "</p>" : "") +
      '<span class="grow"></span><button class="btn' + (M.saved ? " mv-saved" : "") + '" data-mv-keep aria-pressed="' + M.saved + '">' + icon(M.saved ? "check" : "bookmark") + (M.saved ? "Gardée dans ton carnet" : "Garder dans mon carnet") + "</button></div>";
  }
  function sauce() {
    const s = M.sauce, seg = (name, list, cur) => '<div class="mv-seg" role="group" aria-label="' + esc(name) + '">' + list.map(([k, l]) => '<button data-mv-' + (name === "Format" ? "fmt" : name === "Sujet" ? "same" : "max") + '="' + k + '" aria-pressed="' + (String(cur) === String(k)) + '">' + esc(l) + "</button>").join("") + "</div>";
    const st = S.state.settings || {}, crew = C.crewOf(st).find((r) => r.key === "script");
    const applied = ["les consignes du " + crew.name + " de l'Équipe" + (crew.custom ? "" : " (par défaut)"), st.workspace && st.workspace.name ? "ton compte « " + st.workspace.name + " »" : "", (st.rules && st.rules.maxHashtags ? st.rules.maxHashtags + " hashtags au plus" : ""), "la durée max choisie"].filter(Boolean);
    return '<section class="mv-card mv-sauce"><div class="mv-row"><h2 class="mv-h">Ta sauce</h2><span class="mv-step s2">2</span></div>' +
      '<div class="mv-col"><span class="mv-lbl">Sujet</span>' + seg("Sujet", [["same", "Le même que l'original"], ["new", "Un autre sujet"]], s.same ? "same" : "new") + "</div>" +
      '<label class="mv-field">' + (s.same ? "Le sujet repris" : "Ton sujet") + '<input id="mv-subject" data-noi18n value="' + esc(s.subject) + '" placeholder="' + (s.same ? "Le sujet de l'original" : "Ex. : les mots de passe au bureau") + '" maxlength="120"></label>' +
      (s.same ? '<label class="mv-field"><span>Ce que dit l\'original <span class="muted small">(facultatif)</span></span><textarea id="mv-material" data-noi18n rows="4" maxlength="' + R.MAT_MAX + '" placeholder="Colle la transcription ou tes notes : les infos sont reprises, avec tes mots.">' + esc(s.material) + "</textarea>" +
        '<span class="muted small mv-note">On reprend le sujet et les infos, réécrits à ta façon. Pas d\'image ni de phrase de l\'original : la note d\'originalité compare aussi ce texte.</span></label>' : "") +
      '<div class="mv-col"><span class="mv-lbl">Réarranger avec l\'angle</span><div class="mv-chips">' + ORDER.map((k) => '<button class="mv-chip" data-mv-angle="' + k + '" aria-pressed="' + (s.angle === k) + '">' + esc(R.ANGLES[k]) + "</button>").join("") + "</div></div>" +
      '<div class="mv-col"><span class="mv-lbl">Format</span>' + seg("Format", [["reel", "Reel"], ["carousel", "Carrousel"]], s.format) + "</div>" +
      (s.format === "reel" ? '<div class="mv-col"><span class="mv-lbl">Durée max</span>' + seg("Durée max", [[15, "15 s"], [30, "30 s"], [45, "45 s"], [60, "60 s"]], s.maxSec) + "</div>" : "") +
      '<div class="mv-auto"><b>Appliqué tout seul</b><span>' + esc(applied.join(" · ")) + "</span></div>" +
      '<button class="btn primary" data-mv-make' + (M.busy || M.error ? " disabled" : "") + ">" + icon("spark") + (M.version ? "Refaire avec cette sauce" : "Préparer ma version") + "</button></section>";
  }
  function versionCard() {
    const v = M.version;
    if (M.making) return '<section class="mv-card mv-ver"><div class="mv-row"><span class="mv-step s3 wide">3 · Ta version</span></div><div class="mv-wait"><span class="mv-spin" aria-hidden="true"></span>' + (S.mode === "api" ? "Claude écrit ta version…" : "Préparation…") + "</div></section>";
    if (!v) return '<section class="mv-card mv-ver"><div class="mv-row"><span class="mv-step s3 wide">3 · Ta version</span></div><div class="mv-empty">' + icon("spark") + "<p>Choisis ton sujet et un angle, puis « Préparer ma version ». La recette reste, tout le reste est à toi.</p></div></section>";
    const o = orig(), ok = o >= R.ORIG_MIN, reel = v.format === "reel", total = v.shots.reduce((n, x) => n + (+x.dur || 0), 0);
    return '<section class="mv-card mv-ver"><div class="mv-row"><span class="mv-step s3 wide">3 · Ta version</span><span class="grow"></span><span class="muted small">Originalité</span>' +
      '<span class="mv-meter' + (ok ? "" : " low") + '" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + o + '" aria-label="Originalité"><span style="width:' + o + '%"></span></span><b class="mv-pct' + (ok ? "" : " low") + '" id="mv-pct">' + o + " %</b></div>" +
      '<h2 class="mv-title" contenteditable="plaintext-only" data-mv-edit="title" data-noi18n spellcheck="true">' + esc(v.title) + "</h2>" +
      '<p class="muted mv-hint">' + esc(R.ANGLES[v.angle] || "") + (v.draft ? " · modèle : remplace les [crochets] par ton contenu, ici ou dans La Fabrique." : " · tu peux retoucher chaque case avant l'envoi.") + "</p>" +
      '<div class="mv-sb" role="table" aria-label="Storyboard"><div class="mv-tr mv-th" role="row"><span role="columnheader">' + (reel ? "Plan" : "Slide") + '</span><span role="columnheader">' + (reel ? "Durée" : "") + '</span><span role="columnheader">À l\'écran</span><span role="columnheader">Voix</span></div>' +
      v.shots.map((x, i) => '<div class="mv-tr" role="row"><b role="cell">' + (i + 1) + '</b><span role="cell" class="mono muted">' + (reel ? (x.dur || 0) + " s" : "") + '</span><span role="cell" contenteditable="plaintext-only" data-mv-edit="screen" data-i="' + i + '" data-noi18n>' + esc(x.screen) + '</span><span role="cell" class="mv-voice" contenteditable="plaintext-only" data-mv-edit="voice" data-i="' + i + '" data-noi18n>' + esc(x.voice) + "</span></div>").join("") + "</div>" +
      '<details class="mv-cap"><summary>Légende proposée</summary><p contenteditable="plaintext-only" data-mv-edit="caption" data-noi18n>' + esc(v.caption) + "</p></details>" +
      '<div class="mv-row mv-foot"><span class="muted small">' + (reel ? "Durée totale : " + total + " s (max " + M.sauce.maxSec + " s)" : v.shots.length + " slides") + '</span><span class="grow"></span>' +
      '<button class="btn" data-mv-other>' + icon("undo") + "Autre angle</button>" +
      '<button class="btn primary" data-mv-send' + (ok ? "" : ' disabled aria-describedby="mv-low"') + ">" + icon("send") + "Envoyer à La Fabrique</button></div>" +
      (ok ? "" : '<div class="banner warn" id="mv-low">Trop proche de l\'original : ' + o + " % original, " + R.ORIG_MIN + " % au moins. Réécris les cases en gris, ou change d'angle.</div>") + "</section>";
  }
  function orig() { return M && M.version ? R.checkOrig(M.recipe, M.sauce, M.version) : 100; }
  function draw() {
    const el = document.getElementById("mv"); if (!el || !M) return;
    const steps = '<ol class="mv-steps"><li class="s1"><span>1</span>La recette</li><li class="s2"><span>2</span>Ta sauce</li><li class="s3"><span>3</span>Ta version</li></ol>';
    el.innerHTML = '<header class="mv-top"><div class="mv-col grow"><span class="eyebrow">' + (M.src.type === "post" ? "Tes succès" : M.src.type === "link" ? "Lien partagé" : M.src.item ? "Pépites" : "Carnet") + ' › Ma version</span><h1>Reprends la recette, pas la vidéo</h1></div>' + steps +
      '<button class="iconbtn" data-mv-close aria-label="Fermer">' + icon("x") + "</button></header>" +
      '<div class="mv-grid"><section class="mv-col mv-left">' + source() + recipeCard() + "</section>" + sauce() + versionCard() + "</div>";
  }

  // ------------------------------------------------------------ Actions
  async function make() {
    if (!M || !M.recipe || M.making) return;
    const one = M; one.making = true; draw();
    try {
      if (S.mode !== "api") { await new Promise((r) => setTimeout(r, 400)); one.version = R.draftVersion(one.recipe, one.sauce); one.vai = false; }
      else {
        const r = await S.call("POST", "maversion/version", { recipe: one.recipe, sauce: one.sauce });
        one.version = r.version; one.vai = r.ai;
        if (r.why) U.toast("Claude indisponible, modèle à compléter (" + r.why + ")");
      }
    } catch (e) { U.toast("Impossible : " + e.message); }
    one.making = false;
    if (M === one) { draw(); const v = document.querySelector(".mv-ver"); if (v && one.version && window.innerWidth < 1100 && v.scrollIntoView) v.scrollIntoView({ block: "start", behavior: "smooth" }); }
  }
  async function send() {
    if (!M || !M.version) return;
    const st = S.state.settings || {}, crew = C.crewOf(st).find((r) => r.key === "script");
    let nets = (st.networks || ["instagram"]).filter((n) => n === "instagram" || n === "facebook" || n === "youtube" || n === "tiktok");
    if (!nets.length) nets = ["instagram"];
    let p;
    try { p = R.postOf(M.version, M.recipe, M.sauce, { now: C.nowStamp(), by: M.vai ? "Claude · " + crew.name : "PlanneRs · modèle", networks: nets }); } catch (e) { U.toast(e.message); return; }
    if (!M.saved) { await saveBook(R.keep(book(), M.recipe, new Date().toISOString())); M.saved = true; }
    await S.savePosts([p]);
    close(); A.render();
    U.toast("Dans La Fabrique : storyboard " + (p.prod.steps.script.state === "done" ? "signé " + p.prod.steps.script.by : "à compléter") + ". Recette gardée dans ton carnet.", { label: "Ouvrir", fn: () => A.openPost(p.id) });
  }
  async function keepToggle() {
    if (!M || !M.recipe) return;
    M.saved = !M.saved;
    await saveBook(M.saved ? R.keep(book(), M.recipe, new Date().toISOString()) : book().filter((r) => r.id !== M.recipe.id));
    draw(); U.toast(M.saved ? "Recette gardée dans ton carnet (Stats › Ma version)" : "Recette retirée du carnet");
  }

  document.addEventListener("click", (e) => {
    const t = e.target, g = (s) => t.closest(s);
    let b;
    // Pépites : « Faire ma version » ouvre l'atelier.
    if ((b = g("[data-pep-remix]"))) {
      e.stopImmediatePropagation(); e.preventDefault();
      const d = S.mode === "demo" ? A.pepDemo : S.state.pepites, item = ((d && d.top) || []).find((x) => x.id === b.dataset.pepRemix);
      if (item) A.openVersion({ type: "pepite", item });
      return;
    }
    if ((b = g("[data-mv-redo]"))) { const p = S.state.posts.find((x) => x.id === b.dataset.mvRedo); if (p) A.openVersion({ type: "post", post: p, score: +b.dataset.score || 0 }); return; }
    if ((b = g("[data-lib-use]"))) { const r = (lib || []).find((x) => x.id === b.dataset.libUse); if (r) A.openVersion({ recipe: Object.assign({}, r) }); return; }
    if ((b = g("[data-lib-keep]"))) { const r = (lib || []).find((x) => x.id === b.dataset.libKeep); if (r) saveBook(R.keep(book(), r, new Date().toISOString())).then(() => { A.render(); U.toast("Recette gardée dans ton carnet"); }); return; }
    if ((b = g("[data-mv-use]"))) { const r = book().find((x) => x.id === b.dataset.mvUse); if (r) A.openVersion({ recipe: r }); return; }
    if ((b = g("[data-mv-del]"))) { const id = b.dataset.mvDel, old = book(); saveBook(old.filter((r) => r.id !== id)).then(() => { A.render(); U.toast("Recette retirée", { label: "Annuler", fn: () => saveBook(old).then(A.render) }); }); return; }
    if ((b = g("[data-mv-mix]"))) {
      const id = b.dataset.mvMix;
      if (!mixA || mixA === id) { mixA = mixA === id ? "" : id; A.render(); if (mixA) U.toast("Choisis la 2e recette : sa structure, avec l'accroche de la 1re"); return; }
      const a = book().find((r) => r.id === mixA), c = book().find((r) => r.id === id); mixA = "";
      if (!a || !c) return;
      const mix = R.mixRecipes(a, c);
      saveBook(R.keep(book(), mix, new Date().toISOString())).then(() => { A.render(); A.openVersion({ recipe: Object.assign({}, mix) }); });
      return;
    }
    if (!M) return;
    if (g("[data-mv-close]")) { close(); return; }
    if ((b = g("[data-mv-angle]"))) { M.sauce.angle = b.dataset.mvAngle; draw(); return; }
    if ((b = g("[data-mv-fmt]"))) { M.sauce.format = b.dataset.mvFmt; draw(); return; }
    if ((b = g("[data-mv-same]"))) { const same = b.dataset.mvSame === "same"; if (same !== M.sauce.same) { M.sauce.same = same; M.sauce.subject = same ? R.sourceSubject(M.recipe) : ""; } draw(); return; }
    if ((b = g("[data-mv-max]"))) { M.sauce.maxSec = +b.dataset.mvMax; draw(); return; }
    if (g("[data-mv-make]")) { make(); return; }
    if (g("[data-mv-other]")) { M.sauce.angle = ORDER[(ORDER.indexOf(M.sauce.angle) + 1) % ORDER.length]; make(); return; }
    if (g("[data-mv-send]")) { send(); return; }
    if (g("[data-mv-keep]")) { keepToggle(); return; }
  }, true);
  document.addEventListener("input", (e) => {
    if (!M) return;
    if (e.target.id === "mv-subject") { M.sauce.subject = e.target.value; return; }
    if (e.target.id === "mv-material") { M.sauce.material = e.target.value; return; }
    const ed = e.target.closest && e.target.closest("[data-mv-edit]");
    if (!ed || !M.version) return;
    const k = ed.dataset.mvEdit, txt = ed.innerText.trim();
    if (k === "title" || k === "caption") M.version[k] = txt; else M.version.shots[+ed.dataset.i][k] = txt;
    // Note d'originalité en direct, sans redessiner (le curseur reste en place).
    const o = orig(), ok = o >= R.ORIG_MIN, pct = document.getElementById("mv-pct"), meter = document.querySelector(".mv-meter"), btn = document.querySelector("[data-mv-send]");
    if (pct) { pct.textContent = o + " %"; pct.classList.toggle("low", !ok); }
    if (meter) { meter.classList.toggle("low", !ok); meter.setAttribute("aria-valuenow", o); meter.firstChild.style.width = o + "%"; }
    if (btn) btn.disabled = !ok;
    const warn = document.getElementById("mv-low"); if (warn && ok) warn.remove();
  });
  document.addEventListener("keydown", (e) => { if (M && e.key === "Escape") { e.stopPropagation(); close(); } }, true);

  // ------------------------------------------------------------ Onglet Stats › Ma version
  // ------------------------------------------------------------ Bibliothèque partagée
  // Des recettes (la forme seulement, jamais de contenu) proposées par la communauté dans le dépôt public.
  // Chacun peut y ajouter les siennes : « Partager » ouvre une proposition sur GitHub, relue avant d'entrer.
  const LIB_REPO = "https://github.com/Naod6473/PlanneRS-MIT";
  let lib = null, libLoading = false;
  function loadLib() {
    if (lib || libLoading) return; libLoading = true;
    const done = (d) => { lib = (d && Array.isArray(d.recipes) ? d.recipes : []).map((r) => { try { return Object.assign(R.cleanRecipe(r, null), { id: String(r.id || ""), by: r.by || "", tags: r.tags || [], lib: true, from: { type: "lib" } }); } catch (e) { return null; } }).filter((r) => r && r.id); libLoading = false; A.render(); };
    if (window.PLANNERS_LIBRARY) return done(window.PLANNERS_LIBRARY);
    (S.mode === "api" ? S.call("GET", "recipes/library") : fetch("recettes/bibliotheque.json").then((r) => (r.ok ? r.json() : null))).then(done).catch(() => done(null));
  }
  A.recipeLibrary = () => lib;
  function shareUrl(r) {
    const o = { name: r.name, hook: r.hook, structure: r.structure, format: r.format, spring: r.spring, ending: r.ending, why: r.why || [] };
    const body = "Recette proposée depuis PlanneRs (la forme seulement, sans contenu d'origine).\n\nPour quel type de compte ou de sujet marche-t-elle ? [à compléter]\n\n```json\n" + JSON.stringify(o, null, 1) + "\n```";
    return LIB_REPO + "/issues/new?labels=recette&title=" + encodeURIComponent("Recette : " + r.name) + "&body=" + encodeURIComponent(body);
  }
  A.versionHtml = function () {
    const rk = rank(), list = R.sortBook(book(), rk), tops = R.ownTops(rows()).filter((r) => !r.post.remix).slice(0, 6);
    const pep = ((S.mode === "demo" ? A.pepDemo : S.state.pepites) || {}).top || [];
    const intro = '<section class="panel mv-intro"><div><h2>Ma version</h2><p class="muted">Garde la recette d\'une publication qui a marché (accroche, structure, format, ressort, fin) et refais-la à ta sauce : sur le même sujet, avec ses infos réécrites à ta façon, ou sur un autre. Sous 80 % d\'originalité, l\'envoi est bloqué.</p></div>' +
      '<div class="mv-srcs"><button class="btn" data-stattab="pep">' + icon("spark") + "Pépites des comptes suivis" + (pep.length ? " (" + pep.length + ")" : "") + "</button></div></section>";
    const recipeCardHtml = (r) => {
      const s = rk.byRecipe[r.id], f = r.from || {};
      return '<article class="mv-rc' + (mixA === r.id ? " picked" : "") + '"><div class="mv-row"><b data-noi18n>' + esc(r.name) + "</b>" + (s ? '<span class="mv-x" title="Score moyen de tes versions publiées">' + xs(s.score) + " chez toi</span>" : "") + "</div>" +
        bar(r.structure) + '<span class="muted small" data-noi18n>' + esc(r.hook.type + " · " + r.spring) + "</span>" +
        '<span class="muted small">' + (r.mix ? "Mélange de deux recettes" : f.handle ? "D'après @" + esc(f.handle) + (f.score ? " (" + xs(f.score) + ")" : "") : f.type === "post" ? "D'après ton succès" : "") + (s ? " · " + s.n + (s.n > 1 ? " versions publiées" : " version publiée") : "") + "</span>" +
        '<span class="acts"><button class="btn sm primary" data-mv-use="' + esc(r.id) + '">' + icon("spark") + 'Utiliser</button><button class="btn sm" data-mv-mix="' + esc(r.id) + '" aria-pressed="' + (mixA === r.id) + '">' + (mixA && mixA !== r.id ? "Mélanger avec" : mixA === r.id ? "Choisie" : "Mélanger") + '</button>' +
        (r.lib ? "" : '<a class="btn sm quiet" href="' + esc(shareUrl(r)) + '" target="_blank" rel="noopener" title="Proposer cette recette à la bibliothèque partagée (sur GitHub)">' + icon("send") + "Partager</a>") +
        '<button class="iconbtn sm" data-mv-del="' + esc(r.id) + '" aria-label="Retirer ' + esc(r.name) + '">' + icon("trash") + "</button></span></article>";
    };
    const carnet = '<section class="panel"><h2 class="sec-h"><span>Ton carnet de recettes</span><span>' + list.length + "</span></h2>" +
      (list.length ? (Object.keys(rk.byRecipe).length ? '<p class="muted small mv-loop">' + icon("chart") + "La boucle : les recettes qui marchent chez toi passent en tête (score = interactions de tes versions, comparées à ta médiane).</p>" : "") + '<div class="mv-rcs">' + list.map(recipeCardHtml).join("") + "</div>"
        : '<div class="empty" data-fx="notepad">Ton carnet est vide. Ouvre une pépite ou un de tes succès, puis « Garder dans mon carnet » : la recette se réutilise sur un autre sujet, ou se mélange avec une autre.</div>') + "</section>";
    const own = '<section class="panel"><h2 class="sec-h"><span>Tes succès à refaire</span><span>' + tops.length + "</span></h2>" +
      (tops.length ? '<div class="mv-tops">' + tops.map((r) => '<article class="mv-top1"><span class="mv-x">' + xs(r.score) + '</span><div class="mv-col grow"><b data-noi18n>' + esc(r.post.title || "Sans titre") + '</b><span class="muted small">' + esc((C.FORMATS[r.post.format] || r.post.format) + (r.post.date ? " · " + C.shortDay(r.post.date) : "") + " · " + r.value + " interactions") + '</span></div><button class="btn sm" data-mv-redo="' + esc(r.post.id) + '" data-score="' + r.score + '">' + icon("spark") + "Refaire à ma sauce</button></article>").join("") + "</div>"
        : '<p class="muted">Quand une de tes publications fait 1,5 fois ta médiane d\'interactions, elle arrive ici : refais ce qui a marché chez toi, sur un nouveau sujet.</p>') + "</section>";
    loadLib();
    const have = new Set(book().map((r) => r.id)), shared = (lib || []).filter((r) => !have.has(r.id));
    const libBox = '<section class="panel"><h2 class="sec-h"><span>Bibliothèque partagée</span><span>' + (lib ? shared.length : "…") + "</span></h2>" +
      '<p class="muted small" style="margin:0 0 8px">Des recettes qui marchent, proposées par la communauté : la forme seulement (accroche, structure, ressort, fin), jamais de contenu. Ajoute la tienne avec « Partager » sur une recette de ton carnet.</p>' +
      (lib == null ? '<div class="mv-wait"><span class="mv-spin" aria-hidden="true"></span>Chargement…</div>' : shared.length ? '<div class="mv-rcs">' + shared.map((r) => '<article class="mv-rc"><div class="mv-row"><b data-noi18n>' + esc(r.name) + "</b>" + (r.format === "carousel" ? '<span class="chip">Carrousel</span>' : "") + "</div>" + bar(r.structure) +
        '<span class="muted small" data-noi18n>' + esc(r.hook.type + " · " + r.spring) + '</span><span class="muted small" data-noi18n>' + esc(r.hook.pattern) + "</span>" +
        '<span class="acts"><button class="btn sm primary" data-lib-use="' + esc(r.id) + '">' + icon("spark") + 'Utiliser</button><button class="btn sm" data-lib-keep="' + esc(r.id) + '">' + icon("bookmark") + "Garder</button></span></article>").join("") + "</div>"
        : '<p class="muted">Toutes les recettes de la bibliothèque sont déjà dans ton carnet.</p>') +
      '<p class="muted small" style="margin:8px 0 0"><a href="' + LIB_REPO + '/issues?q=label%3Arecette" target="_blank" rel="noopener">Voir les recettes proposées</a></p></section>';
    return intro + carnet + libBox + own;
  };
})();
