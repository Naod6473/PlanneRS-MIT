// Ma version : recette, version à ta sauce, note d'originalité, carnet, mélange et boucle.
import test from "node:test";
import assert from "node:assert/strict";
import R from "../web/js/recette.js";
import { extractRecipe, makeVersion, recipePrompt, versionPrompt } from "../worker/src/maversion.js";

const SRC = { type: "pepite", id: "in:a1", handle: "boulangerie.martin", net: "instagram", kind: "reel", score: 5.8, url: "https://example.com/a/1", caption: "3 erreurs qui ratent ta baguette (la 2e, tout le monde la fait)" };
const fake = (texts, seen) => ({ beta: { messages: { create: async (req) => { seen.push(req); return { stop_reason: "end_turn", content: [{ type: "text", text: texts[Math.min(seen.length - 1, texts.length - 1)] }] }; } } } });

test("originality : 100 % sans reprise, 0 % pour une copie, entre les deux pour un mélange", () => {
  assert.equal(R.originality(SRC.caption, "Ce qu'on t'a dit sur les mots de passe est faux, et voici pourquoi."), 100);
  assert.equal(R.originality(SRC.caption, SRC.caption.toUpperCase()), 0);
  const half = R.originality(SRC.caption, "3 erreurs qui ratent ta baguette, mais je parle de mots de passe au bureau aujourd'hui");
  assert.ok(half > 0 && half < R.ORIG_MIN, String(half));
  assert.equal(R.originality("", "peu importe le texte ici"), 100);
});

test("guessRecipe : liste chiffrée avec aveu, structure dans le temps, source gardée", () => {
  const r = R.guessRecipe(SRC);
  assert.equal(r.hook.type, "Liste chiffrée");
  assert.match(r.name, /aveu/);
  assert.equal(r.format, "reel");
  assert.ok(r.structure.length >= 4 && r.structure.every((x) => x.sec > 0));
  assert.equal(r.from.url, SRC.url);
  assert.equal(r.from.text, SRC.caption);
  assert.equal(R.guessRecipe({ kind: "carousel", caption: "Pourquoi le pain sèche si vite" }).structure[0].sec, 0);
  assert.equal(R.guessRecipe({ caption: "Le levain : vivant ou mort ?" }).hook.type, "Question directe");
});

test("draftVersion : l'angle choisi, la durée max respectée, original", () => {
  const r = R.guessRecipe(SRC);
  for (const angle of Object.keys(R.ANGLES)) {
    const v = R.draftVersion(r, { subject: "les mots de passe", angle, format: "reel", maxSec: 15 });
    assert.equal(v.angle, angle);
    assert.ok(v.shots.reduce((n, x) => n + x.dur, 0) <= 15);
    assert.ok(v.shots.every((x) => x.dur >= 2));
    assert.ok(R.originality(SRC.caption, R.versionText(v)) >= R.ORIG_MIN);
  }
  const c = R.draftVersion(r, { subject: "x", angle: "top", format: "carousel" });
  assert.ok(c.shots.every((x) => x.dur === 0));
});

test("postOf : post de La Fabrique signé, lien d'origine en note, refus sous 80 %", () => {
  const r = R.guessRecipe(SRC), v = R.draftVersion(r, { subject: "les mots de passe", angle: "myth", maxSec: 30 });
  const p = R.postOf(v, r, { maxSec: 30 }, { now: "2026-11-13T10:00", by: "PlanneRs · modèle", networks: ["instagram", "facebook"] });
  assert.equal(p.stage, "idea");
  assert.equal(p.prod.steps.script.state, "doing"); // modèle à compléter
  assert.equal(p.prod.shots.length, v.shots.length);
  assert.match(p.note, /Inspiration : https:\/\/example\.com\/a\/1/);
  assert.equal(p.remix.recipeId, r.id);
  assert.equal(p.captionValidated, false);
  const done = R.postOf(Object.assign({}, v, { draft: false }), r, {}, { by: "Claude · Scénariste" });
  assert.equal(done.prod.steps.script.state, "done");
  const copy = Object.assign({}, v, { title: SRC.caption, hook: SRC.caption, caption: SRC.caption, shots: [{ dur: 5, screen: SRC.caption, voice: SRC.caption }] });
  assert.throws(() => R.postOf(copy, r, {}, {}), /Trop proche/);
});

test("carnet, mélange et boucle : les recettes qui marchent chez toi passent en tête", () => {
  const a = R.guessRecipe(SRC), b = R.guessRecipe({ kind: "reel", caption: "J'ai testé 5 farines : le résultat m'a surpris" });
  let book = R.keep([], a, "2026-11-01"); book = R.keep(book, b, "2026-11-02"); book = R.keep(book, a, "2026-11-03");
  assert.deepEqual(book.map((r) => r.id), [a.id, b.id]);
  const m = R.mixRecipes(a, b);
  assert.equal(m.hook, a.hook); assert.equal(m.structure, b.structure); assert.deepEqual(m.mix, [a.id, b.id]);
  const post = (id, rid) => ({ id, title: id, remix: rid ? { recipeId: rid, sourceScore: 5 } : null });
  const rows = [{ post: post("p1"), value: 100 }, { post: post("p2"), value: 100 }, { post: post("p3", b.id), value: 300 }, { post: post("p4", a.id), value: 50 }, { post: post("p5"), value: 0 }];
  const rk = R.ranking(rows);
  assert.equal(rk.median, 100);
  assert.equal(rk.byRecipe[b.id].score, 3);
  assert.equal(rk.byRecipe[a.id].n, 1);
  assert.deepEqual(R.sortBook(book, rk).map((r) => r.id), [b.id, a.id]);
  assert.deepEqual(R.ownTops(rows).map((r) => r.post.id), ["p3"]);
  for (let i = 0; i < 120; i++) book = R.keep(book, Object.assign({}, a, { id: "x" + i }));
  assert.equal(book.length, R.MAX_RECIPES);
});

test("Worker : recette lue par Claude (JSON nettoyé), sans recopier le texte", async () => {
  const seen = [];
  const json = '{"name":"Liste + aveu","hook":{"type":"Liste chiffrée","pattern":"[n] erreurs qui [problème]"},"structure":[{"part":"Accroche","sec":2},{"part":"Point 1","sec":5},{"part":"x","sec":"999"}],"format":"reel","spring":"Curiosité","ending":"Question","why":["a","b","c"]}';
  const r = await extractRecipe(fake(["Voici :\n```json\n" + json + "\n```"], seen), SRC);
  assert.equal(r.name, "Liste + aveu");
  assert.equal(r.structure[2].sec, 120);
  assert.equal(r.from.handle, "boulangerie.martin");
  assert.equal(seen[0].model, "claude-opus-5-5");
  assert.match(seen[0].system, /jamais son contenu/);
  assert.match(recipePrompt(SRC), /<texte_original>/);
  await assert.rejects(extractRecipe(fake(['{"name":"vide"}'], []), SRC), /recette lisible/);
});

test("Worker : version à ta sauce, seconde tentative si trop proche de l'original", async () => {
  const r = R.guessRecipe(SRC), seen = [];
  const close = JSON.stringify({ title: SRC.caption, hook: SRC.caption, shots: [{ dur: 10, screen: SRC.caption, voice: SRC.caption }], caption: SRC.caption });
  const good = JSON.stringify({ title: "Mots de passe : vrai ou faux ?", hook: "On t'a menti sur tes mots de passe.", shots: [{ dur: 20, screen: "VRAI OU FAUX", voice: "Changer tous les mois, ça protège ? Faux." }, { dur: 20, screen: "Et toi ?", voice: "Dis-le en commentaire !" }], caption: "Le vrai du faux." });
  const v = await makeVersion(fake([close, good], seen), r, { subject: "les mots de passe", angle: "myth", format: "reel", maxSec: 30 }, { workspace: { name: "Mon compte" } });
  assert.equal(seen.length, 2);
  assert.match(seen[1].messages[0].content, /trop de mots de l'original/);
  assert.ok(v.originality >= R.ORIG_MIN);
  assert.ok(v.shots.reduce((n, x) => n + x.dur, 0) <= 30);
  assert.equal(v.angle, "myth");
  const pr = versionPrompt(r, { subject: "les mots de passe", angle: "qa", format: "carousel" }, {});
  assert.match(pr, /Question de ta communauté/); assert.match(pr, /carrousel/); assert.match(pr, /Scénariste|script/);
});

test("même sujet : le sujet repris ne compte pas, le contenu collé est comparé, Claude reçoit le contenu", () => {
  const r = R.guessRecipe(SRC);
  assert.equal(R.sourceSubject(r), "3 erreurs qui ratent ta baguette");
  const subject = "3 erreurs qui ratent ta baguette";
  const sauce = { same: true, subject, material: "Première erreur : une eau trop chaude qui tue la levure. Deuxième erreur : pas assez de repos." };
  const v = { title: subject + " : vrai ou faux ?", hook: "Ta baguette est plate ? Voilà pourquoi.", shots: [{ dur: 5, screen: subject, voice: "L'eau brûlante, c'est fini : vise 25 degrés pour garder la levure en vie." }], caption: "Le repos change tout." };
  assert.ok(R.checkOrig(r, sauce, v) >= R.ORIG_MIN, String(R.checkOrig(r, sauce, v)));
  assert.ok(R.checkOrig(r, Object.assign({}, sauce, { same: false }), v) < R.checkOrig(r, sauce, v));
  const copied = Object.assign({}, v, { shots: [{ dur: 5, screen: "x", voice: sauce.material }] });
  assert.ok(R.checkOrig(r, sauce, copied) < R.ORIG_MIN);
  const p = R.postOf(v, r, sauce, {});
  assert.equal(p.remix.same, true);
  assert.match(p.note, /Même sujet[\s\S]*Contenu de l'original/);
  const d = R.draftVersion(r, { same: true, angle: "top" });
  assert.match(d.title, /baguette/);
  const pr = versionPrompt(r, sauce, {});
  assert.match(pr, /Même sujet que l'original/); assert.match(pr, /<contenu_original>[\s\S]*eau trop chaude/);
});
