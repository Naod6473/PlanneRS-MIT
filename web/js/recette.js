/* PlanneRs : « Ma version ». La partie sans écran, partagée par la page et le Worker.
   On garde la recette d'une publication qui a marché (accroche, structure, format, ressort, fin),
   jamais son contenu, puis on la refait à la sauce du compte : sujet, angle, format, durée.
   - guessRecipe : recette devinée sans Claude (démo, ou instance sans clé API) ;
   - draftVersion : une version à partir d'un modèle, à compléter ;
   - originality : part du texte qui ne reprend pas l'original (suites de 3 mots), 80 % au moins pour envoyer ;
   - mixRecipes : l'accroche d'une recette, la structure d'une autre ;
   - ranking : la boucle, les recettes qui marchent chez toi passent en tête. */
(function (root) {
  "use strict";
  const ANGLES = { myth: "Mythe ou réalité", before: "Avant / après", top: "Top 3 perso", qa: "Question de ta communauté" };
  const FORMATS = { reel: "Reel", carousel: "Carrousel" };
  const ORIG_MIN = 80, MAX_RECIPES = 100;
  const clip = (v, n) => String(v == null ? "" : v).slice(0, n);
  const fold = (x) => String(x == null ? "" : x).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const words = (s) => fold(s).replace(/[#@][\w.]+/g, " ").match(/[a-z0-9]+/g) || [];
  const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // Part du texte qui ne reprend pas l'original : on compte les suites de 3 mots déjà présentes dans la source.
  // ignore : texte dont les suites de mots ne comptent pas (le sujet repris tel quel, en mode « même sujet »).
  function originality(source, text, ignore) {
    const s = words(source), t = words(text);
    if (t.length < 3 || s.length < 3) return 100;
    const grams = (w) => { const out = []; for (let i = 0; i + 2 < w.length; i++) out.push(w[i] + " " + w[i + 1] + " " + w[i + 2]); return out; };
    const skip = new Set(grams(words(ignore))), have = new Set(grams(s)), mine = grams(t).filter((g) => !skip.has(g));
    if (!mine.length) return 100;
    const shared = mine.filter((g) => have.has(g)).length;
    return Math.max(0, Math.min(100, Math.round(100 * (1 - shared / mine.length))));
  }
  // Sujet de l'original : le titre (tes succès), sinon la première ligne du texte, sans hashtags.
  const sourceSubject = (recipe) => { const f = (recipe && recipe.from) || {}; return clip(f.title || String(f.text || "").split("\n")[0].replace(/[#@][\p{L}\p{N}_.]+/gu, "").replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim(), 120); };
  // Note d'originalité d'une version : comparée au texte d'origine ET au contenu collé (transcription, notes).
  const MAT_MAX = 6000;
  function checkOrig(recipe, sauce, version) {
    sauce = sauce || {};
    return originality([((recipe && recipe.from) || {}).text || "", clip(sauce.material, MAT_MAX)].join("\n"), versionText(version), sauce.same ? sauce.subject : "");
  }
  // Tout le texte d'une version : titre, accroche, plans, légende.
  const versionText = (v) => [v && v.title, v && v.hook, ...((v && v.shots) || []).map((x) => [x.screen, x.voice].join(" ")), v && v.caption].filter(Boolean).join("\n");

  // ------------------------------------------------------------ Recette devinée (sans Claude)
  const HOOKS = [
    { re: /(^|\s)\d+\s+(erreurs?|astuces?|raisons?|choses?|fa[cç]ons?|[ée]tapes?|secrets?|outils?|conseils?|signes?|r[eè]gles?)/i, type: "Liste chiffrée", pattern: "[nombre] [erreurs / astuces] qui [problème du public]", spring: "Se sentir concerné : « est-ce que je fais pareil ? »" },
    { re: /\b(test[ée]?|essay[ée]|compar[ée])/i, type: "Test en direct", pattern: "J'ai testé [plusieurs choses] : [le résultat surprend]", spring: "Suspense : on reste pour le verdict" },
    { re: /\?/, type: "Question directe", pattern: "[question que ton public se pose] ?", spring: "Débat : chacun a son avis" },
    { re: /^(pourquoi|comment)\b/i, type: "Le pourquoi", pattern: "Pourquoi [phénomène que tout le monde voit] (et ce qu'on peut y faire)", spring: "Comprendre enfin quelque chose de familier" },
  ];
  const TEASE = /\((la|le)\s+\d+e?[^)]*\)|tout le monde/i;
  function structureFor(type, kind) {
    if (kind === "carousel" || kind === "image") {
      const s = type === "Liste chiffrée" ? ["Couverture : la promesse", "Point 1", "Point 2 (la surprise)", "Point 3", "Ce qu'il faut retenir", "Question au public"] : ["Couverture : la question", "Le contexte", "La réponse", "La preuve", "Question au public"];
      return s.map((part) => ({ part, sec: 0 }));
    }
    const s = {
      "Liste chiffrée": [["Accroche", 2], ["Point 1", 5], ["Point 2 (la surprise)", 6], ["Point 3", 5], ["Fin + question", 4]],
      "Test en direct": [["Accroche", 2], ["Ce qu'on teste", 4], ["Essai 1", 5], ["Essai 2", 5], ["Verdict", 4], ["Question", 3]],
      "Question directe": [["La question", 2], ["Ce qu'on croit", 5], ["Ce qui est vrai", 7], ["La preuve", 5], ["Ton avis ?", 3]],
      "Le pourquoi": [["Accroche", 2], ["Ce qu'on voit tous", 4], ["L'explication", 8], ["Ce qu'on peut faire", 5], ["Question", 3]],
    }[type] || [["Accroche", 2], ["Le problème", 5], ["La solution", 8], ["La preuve", 5], ["Question", 3]];
    return s.map(([part, sec]) => ({ part, sec }));
  }
  function guessRecipe(src) {
    const cap = String((src && src.caption) || ""), first = cap.split("\n")[0].replace(/#[\p{L}\p{N}_]+/gu, "").trim();
    const h = HOOKS.find((x) => x.re.test(first)) || { type: "Promesse claire", pattern: "[bénéfice concret] en [temps court]", spring: "Bénéfice immédiat" };
    const kind = (src && src.kind) === "short" ? "reel" : (src && src.kind) || "reel", tease = TEASE.test(first);
    const why = [
      "Accroche « " + h.type.toLowerCase() + " » : on sait en 2 secondes ce qu'on va apprendre.",
      tease ? "Un détail qui pique la curiosité (« la 2e, tout le monde la fait ») : on reste pour savoir." : "Une seule idée par publication, facile à suivre.",
      (kind === "reel" ? "Format court" : "Format à faire défiler") + (src && src.score ? ", " + String(src.score).replace(".", ",") + " fois la moyenne du compte." : "."),
    ];
    return {
      id: uid("rc"), name: h.type + (tease ? " + aveu" : ""), hook: { type: h.type, pattern: h.pattern + (tease ? " (la [n]e, tout le monde la fait)" : "") },
      structure: structureFor(h.type, kind), format: kind === "carousel" || kind === "image" ? "carousel" : "reel", spring: tease ? "Curiosité + se sentir concerné" : h.spring,
      ending: /\?\s*$/.test(cap.trim()) ? "Question au public" : "Appel à commenter", why, guessed: true,
      from: fromOf(src),
    };
  }
  function fromOf(src) {
    src = src || {};
    return { type: src.type || "pepite", id: clip(src.id, 80), handle: clip(src.handle, 60), net: clip(src.net, 20), url: clip(src.url, 400), score: +src.score || 0, kind: clip(src.kind, 20), text: clip(src.caption || src.text, 1200), title: clip(src.title, 120) };
  }
  // Recette rendue par Claude : on garde les champs connus, bornés.
  function cleanRecipe(o, src) {
    o = o || {};
    const st = (Array.isArray(o.structure) ? o.structure : []).slice(0, 12).map((x) => ({ part: clip(x && x.part, 80), sec: Math.max(0, Math.min(120, +(x && x.sec) || 0)) })).filter((x) => x.part);
    if (!st.length) throw new Error("Claude n'a pas rendu de recette lisible.");
    const hook = o.hook && typeof o.hook === "object" ? o.hook : { type: "Accroche", pattern: o.hook };
    return {
      id: uid("rc"), name: clip(o.name || hook.type || "Recette", 60), hook: { type: clip(hook.type, 60), pattern: clip(hook.pattern, 200) },
      structure: st, format: o.format === "carousel" ? "carousel" : "reel", spring: clip(o.spring, 160), ending: clip(o.ending, 160),
      why: (Array.isArray(o.why) ? o.why : []).slice(0, 4).map((x) => clip(x, 200)).filter(Boolean), from: fromOf(src),
    };
  }

  // ------------------------------------------------------------ Version à partir d'un modèle
  const T = {
    myth: { title: (s) => "Mythe ou réalité : " + s, hook: (s) => "Ce qu'on t'a dit sur " + s + " est faux.", items: ["Idée reçue : [ce que tout le monde croit]", "Réalité : [ce qui est vrai, en une phrase]", "La preuve : [un exemple concret]", "Ce que tu peux faire : [un geste simple]"], cap: (s) => "Tu y croyais aussi ? On démêle le vrai du faux sur " + s + "." },
    before: { title: (s) => s + " : avant / après", hook: (s) => "Avant, " + s + " me prenait des heures.", items: ["Avant : [la situation qui agace]", "Le déclic : [ce qui a changé]", "Après : [le résultat, avec un chiffre vérifié]", "Comment faire pareil : [l'étape à copier]"], cap: (s) => "Avant / après sur " + s + " : le changement tient en une étape." },
    top: { title: (s) => "Mon top 3 : " + s, hook: (s) => "3 choses que j'aurais aimé savoir sur " + s + ".", items: ["N° 3 : [le plus simple]", "N° 2 : [celui qu'on oublie]", "N° 1 : [celui qui change tout]", "Bonus : [une astuce rapide]"], cap: (s) => "Mon top 3 sur " + s + ". Tu ajouterais quoi ?" },
    qa: { title: (s) => "Vous m'avez demandé : " + s, hook: (s) => "On me pose souvent cette question sur " + s + ".", items: ["La question : [telle qu'on te l'a posée]", "La réponse courte : [en une phrase]", "Le détail qui compte : [l'exemple]", "À retenir : [la phrase à garder]"], cap: (s) => "Votre question de la semaine sur " + s + ". La prochaine, c'est la tienne ?" },
  };
  const ENDS = { "Question au public": "Et toi, tu en penses quoi ? Dis-le en commentaire !", "Appel à commenter": "Dis-moi en commentaire ce que tu veux voir la prochaine fois !" };
  function draftVersion(recipe, sauce) {
    sauce = sauce || {};
    const s = clip(sauce.subject || (sauce.same ? sourceSubject(recipe) : "") || (recipe.from && recipe.from.title) || "ton sujet", 120).trim() || "ton sujet";
    const angle = T[sauce.angle] ? sauce.angle : "top", t = T[angle], fmt = sauce.format === "carousel" ? "carousel" : "reel";
    const max = Math.max(10, Math.min(90, +sauce.maxSec || 30));
    const parts = (recipe.structure && recipe.structure.length ? recipe.structure : structureFor("", fmt)).slice(0, 8);
    const end = ENDS[recipe.ending] || ENDS["Question au public"];
    const shots = parts.map((x, i) => {
      const last = i === parts.length - 1 && parts.length > 2;
      const line = i === 0 ? t.hook(s) : last ? end : t.items[(i - 1) % t.items.length];
      return { dur: x.sec || 0, screen: i === 0 ? t.title(s) : last ? "Et toi ?" : line.split(" : ")[0], voice: line, visual: i === 0 ? "[hook visuel animé dès la 1re image]" : "[image ou plan]", music: i === 0 ? "[bruitage d'accroche]" : "" };
    });
    if (fmt === "reel") fitDurations(shots, max); else shots.forEach((x) => { x.dur = 0; });
    return { title: t.title(s), angle, format: fmt, hook: t.hook(s), shots, caption: t.cap(s) + "\n\n" + end, draft: true };
  }
  // Durées ramenées sous le maximum (2 s au moins par plan).
  function fitDurations(shots, max) {
    const total = shots.reduce((n, x) => n + (+x.dur || 3), 0);
    const k = total > max ? max / total : 1;
    shots.forEach((x) => { x.dur = Math.max(2, Math.floor((+x.dur || 3) * k)); });
    let over = shots.reduce((n, x) => n + x.dur, 0) - max;
    for (let i = shots.length - 1; over > 0 && i >= 0; i--) { const cut = Math.min(over, shots[i].dur - 2); shots[i].dur -= cut; over -= cut; }
    return shots;
  }
  function cleanVersion(o, sauce) {
    o = o || {};
    const shots = (Array.isArray(o.shots) ? o.shots : []).slice(0, 30).map((x) => ({ dur: Math.max(0, Math.min(120, +x.dur || 0)), screen: clip(x.screen, 300), voice: clip(x.voice, 600), visual: clip(x.visual, 300), music: clip(x.music, 120) }));
    if (!shots.length) throw new Error("Claude n'a proposé aucun plan.");
    return { title: clip(o.title, 120) || "Ma version", angle: ANGLES[(sauce || {}).angle] ? sauce.angle : "top", format: (sauce || {}).format === "carousel" ? "carousel" : "reel", hook: clip(o.hook || shots[0].voice, 200), shots, caption: clip(o.caption, 2200) };
  }

  // ------------------------------------------------------------ Carnet, mélange, boucle
  function mixRecipes(a, b) {
    return {
      id: uid("rc"), name: clip(a.name + " × " + b.name, 60), hook: a.hook, structure: b.structure, format: b.format, spring: a.spring, ending: b.ending,
      why: [].concat((a.why || []).slice(0, 2), (b.why || []).slice(0, 1)), from: a.from, mix: [a.id, b.id],
    };
  }
  // Ajoute (ou remplace) une recette dans le carnet ; les plus récentes d'abord, 100 au plus.
  function keep(book, recipe, now) {
    const r = Object.assign({}, recipe, { saved: recipe.saved || now || new Date().toISOString() });
    return [r].concat((book || []).filter((x) => x.id !== r.id)).slice(0, MAX_RECIPES);
  }
  const median = (v) => { const s = v.slice().sort((a, b) => a - b), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0; };
  // rows : [{ post, value }] pour les publications du compte (value = vues, sinon réactions).
  // Renvoie, par recette, le nombre de versions publiées et leur score moyen (fois la médiane du compte).
  function ranking(rows) {
    const all = (rows || []).filter((r) => r.value > 0), med = median(all.map((r) => r.value)) || 0, out = {};
    all.filter((r) => r.post && r.post.remix && r.post.remix.recipeId).forEach((r) => {
      const k = r.post.remix.recipeId, o = out[k] || (out[k] = { n: 0, sum: 0, posts: [] });
      o.n++; o.sum += med ? r.value / med : 0; o.posts.push({ id: r.post.id, title: r.post.title, score: med ? Math.round((r.value / med) * 10) / 10 : 0, source: r.post.remix.sourceScore || 0 });
    });
    Object.values(out).forEach((o) => { o.score = Math.round((o.sum / o.n) * 10) / 10; delete o.sum; });
    return { median: med, byRecipe: out };
  }
  // Tes propres succès : tes publications au moins 1,5 fois au-dessus de ta médiane.
  function ownTops(rows, min) {
    const all = (rows || []).filter((r) => r.value > 0), med = median(all.map((r) => r.value));
    return all.map((r) => Object.assign({}, r, { score: med ? Math.round((r.value / med) * 10) / 10 : 0 })).filter((r) => r.score >= (min || 1.5)).sort((a, b) => b.score - a.score);
  }
  // Ordre du carnet : celles qui marchent chez toi d'abord, puis les plus récentes.
  function sortBook(book, rank) {
    const sc = (r) => ((rank && rank.byRecipe[r.id]) || {}).score || 0;
    return (book || []).slice().sort((a, b) => sc(b) - sc(a) || String(b.saved || "").localeCompare(String(a.saved || "")));
  }
  // Post de La Fabrique créé à partir d'une version : storyboard signé, recette et lien d'origine en note.
  function postOf(version, recipe, sauce, opts) {
    opts = opts || {};
    const f = recipe.from || {}, orig = checkOrig(recipe, sauce, version), mat = clip(sauce && sauce.material, MAT_MAX).trim();
    if (orig < ORIG_MIN) throw new Error("Trop proche de l'original (" + orig + " % original, " + ORIG_MIN + " % au moins) : change d'angle ou réécris les plans.");
    const now = opts.now || "", by = opts.by || "PlanneRs · modèle";
    return {
      id: uid("mv"), title: version.title, format: version.format === "carousel" ? "carousel" : "reel", networks: opts.networks || ["instagram"],
      date: null, time: null, caption: version.caption || "", captionValidated: false, media: [], status: "draft", stage: "idea",
      note: ["Ma version · recette « " + recipe.name + " »" + (f.url ? "\nInspiration : " + f.url : "") + (f.handle ? " (@" + f.handle + (f.score ? ", ×" + String(f.score).replace(".", ",") : "") + ")" : ""),
        "Accroche : " + (recipe.hook && recipe.hook.type) + " · Ressort : " + recipe.spring + " · Fin : " + recipe.ending,
        "Angle : " + (ANGLES[version.angle] || version.angle) + (sauce && sauce.same ? " · Même sujet que l'original" : "") + " · Originalité : " + orig + " %",
        mat ? "\nContenu de l'original (à reformuler, ne pas recopier) :\n" + mat.slice(0, 3000) : ""].filter(Boolean).join("\n").slice(0, 6000),
      prod: { maxSec: version.format === "carousel" ? undefined : Math.max(10, Math.min(90, +(sauce && sauce.maxSec) || 30)), shots: version.shots, steps: { script: { state: version.draft ? "doing" : "done", by, at: now, note: clip((version.draft ? "Modèle à compléter (les [crochets]) : " : "Ma version : ") + (version.hook || version.title), 200) } } },
      remix: { recipeId: recipe.id, recipeName: recipe.name, angle: version.angle, same: !!(sauce && sauce.same), originality: orig, sourceUrl: f.url || "", sourceScore: f.score || 0, at: now },
    };
  }

  const api = { MAT_MAX, sourceSubject, checkOrig, ANGLES, FORMATS, ORIG_MIN, MAX_RECIPES, originality, versionText, guessRecipe, cleanRecipe, draftVersion, fitDurations, cleanVersion, mixRecipes, keep, ranking, ownTops, sortBook, postOf, median };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Recette = api;
})(typeof self !== "undefined" ? self : this);
