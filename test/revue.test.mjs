// Revue en pile : ce qui entre dans la pile, la note sur 10, les raisons proposées, le retour après retouche.
import test from "node:test";
import assert from "node:assert/strict";
import Core from "../web/js/core.js";

const vid = { type: "video", url: "https://x.test/v.mp4", name: "v.mp4", dur: 24 };
const base = (o) => Object.assign({ id: "a", title: "A", format: "reel", networks: ["instagram"], caption: "Le levain #pain", captionValidated: false, media: [vid], status: "scheduled", date: "2026-11-20", time: "12:30" }, o);

test("reviewPile : légendes à valider et vidéos pas relues, rien de publié ni de vide", () => {
  const posts = [base({ id: "b", date: "2026-11-21" }), base({ id: "a" }), base({ id: "pub", status: "published" }), base({ id: "ok", captionValidated: true, format: "post" }),
    base({ id: "empty", caption: "", media: [] }), base({ id: "kid", parent: "a" }), base({ id: "nodate", date: null, time: null, status: "draft" }),
    base({ id: "fab", captionValidated: true, prod: { steps: { check: { state: "todo" } } } })];
  assert.deepEqual(Core.reviewPile(posts).map((p) => p.id), ["a", "fab", "b", "nodate"]);
});

test("needsFix : une vidéo en retouche revient après un nouveau travail", () => {
  const p = base({ prod: { review: { at: "2026-11-13T09:00" }, steps: { edit: { state: "done", at: "2026-11-12T10:00" }, check: { state: "todo", at: "2026-11-13T09:00" } } } });
  assert.equal(Core.needsFix(p), true);
  assert.deepEqual(Core.reviewPile([p]), []);
  p.prod.steps.edit = { state: "done", at: "2026-11-13T15:00", by: "Claude · Monteur" };
  assert.equal(Core.needsFix(p), false);
  assert.equal(Core.reviewPile([p]).length, 1);
});

test("reviewOf : note sur 10, blocages, raisons proposées", () => {
  const good = Core.reviewOf(base(), { rules: {} });
  assert.equal(good.score, 10); assert.equal(good.blocked, false);
  assert.ok(good.good.some((c) => c.text === "Vidéo 24 s")); assert.ok(good.good.some((c) => c.text === "1 hashtag"));
  const empty = Core.reviewOf(base({ caption: "" }), { rules: {} });
  assert.equal(empty.blocked, true); assert.match(empty.issues[0].text, /Légende vide/);
  const noMedia = Core.reviewOf(base({ media: [] }), { rules: {} });
  assert.equal(noMedia.blocked, true); assert.ok(noMedia.score <= 6);
  const tags = Core.reviewOf(base({ caption: "#a #b #c #d #e #f" }), { rules: { maxHashtags: 5 } });
  assert.ok(tags.hints.includes("Légende à revoir"));
  const story = Core.reviewOf(base({ format: "story", caption: "" }), { rules: {} });
  assert.equal(story.blocked, false);
});
