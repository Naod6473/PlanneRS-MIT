import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const C = createRequire(import.meta.url)("../web/js/core.js");

test("série déduite du titre, ou champ series", () => {
  assert.equal(C.seriesOf({ title: "L'IA, de zéro à pro · ép. 2/7 : parler à un modèle" }), "L'IA, de zéro à pro");
  assert.equal(C.seriesOf({ title: "Série GitHub · épisode 4 : les actions" }), "Série GitHub");
  assert.equal(C.seriesOf({ title: "Le pain au levain" }), "");
  assert.equal(C.seriesOf({ title: "x", series: " Recettes " }), "Recettes");
});

test("recherche : tous les mots, sans accents ni majuscules", () => {
  const p = { title: "Le pain", caption: "Levain maison #boulangerie", ref: "042" };
  assert.ok(C.matchQuery(p, "PAIN levain"));
  assert.ok(C.matchQuery(p, "042"));
  assert.ok(C.matchQuery(p, "boulangérie"));
  assert.ok(!C.matchQuery(p, "pain croissant"));
  assert.ok(C.matchQuery(p, "  "));
});

test("CSV : aller-retour avec guillemets, retours à la ligne et formules neutralisées", () => {
  const csv = C.toCsv([["titre", "legende", "vues"], ["A;B", 'Il a dit "oui"\nligne 2', 12], ["=SOMME(1)", "-3", "-x"]]);
  const rows = C.parseCsv("﻿" + csv);
  assert.deepEqual(rows[0], ["titre", "legende", "vues"]);
  assert.deepEqual(rows[1], ["A;B", 'Il a dit "oui"\nligne 2', "12"]);
  assert.deepEqual(rows[2], ["'=SOMME(1)", "-3", "'-x"]);
});

test("CSV : virgule comme séparateur", () => {
  assert.deepEqual(C.parseCsv("a,b\n1,\"2,5\"\n"), [["a", "b"], ["1", "2,5"]]);
});
