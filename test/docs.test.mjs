import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build, slug, frontmatter } from "../scripts/docs-index.mjs";

test("documentation : en-têtes complets et liens internes valides", () => {
  const { errors } = build();
  assert.deepEqual(errors, []);
});

test("documentation : docs/index.json est à jour (npm run docs:index)", () => {
  const { index } = build();
  const saved = JSON.parse(readFileSync(new URL("../docs/index.json", import.meta.url), "utf8"));
  assert.deepEqual(saved, JSON.parse(JSON.stringify(index)));
});

test("documentation : ancres et en-tête", () => {
  assert.equal(slug("Meta (Instagram, Facebook, Threads)"), "meta-instagram-facebook-threads");
  assert.equal(slug("Écrire un connecteur"), "écrire-un-connecteur");
  const fm = frontmatter("---\ntitle: A\ntags: [x, y]\norder: 2\n---\n# A\n");
  assert.deepEqual(fm.data, { title: "A", tags: ["x", "y"], order: 2 });
});

test("documentation : aucune donnée personnelle", () => {
  const { index } = build();
  const all = JSON.stringify(index) + index.pages.map((p) => readFileSync(new URL("../docs/" + p.path, import.meta.url), "utf8")).join("");
  assert.doesNotMatch(all, /\b\d{15,}\b|\b[0-9a-f]{64}\b/i); // pas d'identifiant de compte ni de tag Access réels
});
