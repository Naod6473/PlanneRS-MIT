import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const Core = createRequire(import.meta.url)("../web/js/core.js");

const base = { title: "t", networks: ["instagram"], status: "scheduled", stage: "ready", date: "2026-11-20", time: "12:30", captionValidated: true };
const now = "2026-11-12T10:00";

test("5 étapes : idée, en préparation, à valider, programmé, publié", () => {
  assert.equal(Core.STEPS.length, 5);
  assert.equal(Core.step({ ...base, status: "draft", stage: "idea", date: null, captionValidated: false }), "idea");
  assert.equal(Core.step({ ...base, status: "draft", stage: "media", date: null, captionValidated: false }), "prep");
  assert.equal(Core.step({ ...base, status: "draft", stage: "caption", date: null, captionValidated: false }), "prep");
  assert.equal(Core.step({ ...base, stage: "caption", captionValidated: false }), "review");
  assert.equal(Core.step({ ...base, status: "ready", date: null, captionValidated: true }), "review");
  assert.equal(Core.step(base), "scheduled");
  assert.equal(Core.step({ ...base, manual: true, captionValidated: false }), "scheduled");
  assert.equal(Core.step({ ...base, status: "published" }), "published");
});

test("échec et retard sont des alertes, pas des étapes", () => {
  assert.equal(Core.alertOf(base, now), null);
  const f = { ...base, status: "failed" };
  assert.equal(Core.alertOf(f, now), "failed");
  assert.equal(Core.step(f), "scheduled");
  const late = { ...base, manual: true, date: "2026-11-12", time: "08:00" };
  assert.equal(Core.alertOf(late, now), "late");
  assert.equal(Core.step(late), "scheduled");
});

test("titre par réseau : #Shorts et 100 caractères max sur YouTube", () => {
  assert.equal(Core.titleFor({ title: "Le levain", format: "reel" }, "youtube"), "Le levain #Shorts");
  assert.equal(Core.titleFor({ title: "Le levain #shorts", format: "reel" }, "youtube"), "Le levain #shorts");
  assert.equal(Core.titleFor({ title: "Le levain", format: "carousel" }, "youtube"), "Le levain");
  assert.equal(Core.titleFor({ title: "Le levain", format: "reel" }, "tiktok"), "Le levain");
  const long = Core.titleFor({ title: "x".repeat(140), format: "video" }, "youtube");
  assert.ok(long.length <= 100 && long.endsWith("#Shorts"));
});
