import { test } from "node:test";
import assert from "node:assert/strict";
import Core from "../web/js/core.js";

const LONG = "Le levain, c'est de la farine et de l'eau. Vraiment ? Pas tout à fait. Il faut des jours de soin, une température stable et beaucoup de patience. " +
  "Au fournil, on le nourrit deux fois par jour depuis 2004. Sans lui, pas de mie alvéolée ni de croûte qui chante. " +
  "Voici comment on s'y prend, étape par étape, avec les gestes et les erreurs à éviter. Première étape : 50 g de farine et 50 g d'eau tiède. #levain #pain #fournil";

test("fil : découpe à la bonne longueur, numéros compris", () => {
  const f = Core.splitThread(LONG, 280);
  assert.ok(Core.isThread(f));
  const parts = Core.threadParts(f, true);
  assert.ok(parts.length >= 2);
  parts.forEach((p) => assert.ok([...p].length <= 280, p.length + " caractères"));
  assert.match(parts[0], / 1\/\d+$/);
  assert.equal(Core.unthread(f).includes("---"), false);
});

test("fil : recollé pour les réseaux qui n'en publient pas", () => {
  const p = { caption: "Un.\n---\nDeux.", networks: ["x", "linkedin"] };
  assert.equal(Core.textOut(p, "linkedin", {}), "Un.\n\nDeux.");
  assert.equal(Core.textOut(p, "x", {}), "Un.\n---\nDeux.");
  assert.equal(Core.isThread("Pas de fil ici."), false);
});

test("contrôles : un fil n'est pas « trop long » pour X tant que chaque message tient", () => {
  const p = { networks: ["x"], format: "text", caption: Core.splitThread(LONG, 280), captionValidated: true, date: "2026-11-20", status: "scheduled" };
  assert.equal(Core.checks(p, {}).some((c) => /trop long/.test(c.text)), false);
  assert.equal(Core.checks(Object.assign({}, p, { caption: LONG }), {}).some((c) => /trop long pour X/.test(c.text)), true);
});

test("versions sans IA : X tient en 280, LinkedIn aéré avec 3 hashtags au plus", () => {
  const x = Core.versionFor(LONG, "x");
  assert.ok([...x].length <= 280);
  assert.equal((x.match(/#/g) || []).length, 2);
  const li = Core.versionFor(LONG, "linkedin");
  assert.ok(li.includes("\n\n"));
  assert.equal((li.match(/#/g) || []).length, 3);
  assert.match(li, /\?/);
});

test("coupure « voir plus »", () => {
  assert.equal(Core.foldOf("court", "linkedin"), null);
  const f = Core.foldOf(LONG, "linkedin");
  assert.equal([...f.shown].length, 210);
  assert.ok(f.hidden > 0);
});

test("créneaux texte : LinkedIn mardi et jeudi 08:30, seulement pour un post LinkedIn sans média", () => {
  const ts = [{ net: "linkedin", days: [2, 4], time: "08:30" }, { net: "x", days: [1], time: "12:00" }];
  const p = { networks: ["linkedin"], format: "text", media: [] };
  assert.deepEqual(Core.textSlotsFor(p, "2026-11-16", ts).map((x) => x.date + " " + x.time), ["2026-11-17 08:30", "2026-11-19 08:30"]);
  assert.equal(Core.isTextPost(p), true);
  assert.equal(Core.isTextPost({ format: "reel", media: [{ type: "video", url: "a.mp4" }] }), false);
});
