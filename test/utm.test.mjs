// Liens suivis (UTM).
import test from "node:test";
import assert from "node:assert/strict";
import Core from "../web/js/core.js";

test("UTM seulement sur tes sites, sans toucher aux liens déjà suivis", () => {
  const set = { utm: { domains: ["exemple.fr"] } };
  const p = { title: "Pain au levain", caption: "Recette : https://www.exemple.fr/pain. Autre : https://ailleurs.test/x et https://exemple.fr/?utm_source=a" };
  const out = Core.textOut(p, "instagram", set);
  assert.match(out, /https:\/\/www\.exemple\.fr\/pain\?utm_source=instagram&utm_medium=social&utm_campaign=pain-au-levain\. Autre/);
  assert.match(out, /https:\/\/ailleurs\.test\/x /);
  assert.match(out, /utm_source=a$/);
  assert.equal(Core.textOut(p, "x", {}), p.caption);
});
