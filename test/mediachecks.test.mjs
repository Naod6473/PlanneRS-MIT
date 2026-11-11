import test from "node:test";
import assert from "node:assert/strict";
import Core from "../web/js/core.js";

const v = (o) => ({ type: "video", name: "a.mp4", url: "https://x/a.mp4", ...o });
test("vidéo trop courte pour TikTok, trop longue pour X", () => {
  const out = Core.mediaChecks({ networks: ["tiktok", "x"], format: "reel", media: [v({ dur: 2 }), v({ dur: 200 })] });
  assert.ok(out.some((c) => c.level === "block" && /TikTok : vidéo trop courte/.test(c.text)));
  assert.ok(out.some((c) => c.level === "block" && /X : vidéo trop longue/.test(c.text)));
});
test("TikTok sans vidéo bloque ; image Instagram hors format bloque ; PNG prévenu", () => {
  const out = Core.mediaChecks({ networks: ["instagram", "tiktok"], format: "image", media: [{ type: "image", name: "a.png", w: 1000, h: 3000 }] });
  assert.ok(out.some((c) => /TikTok publie des vidéos seulement/.test(c.text)));
  assert.ok(out.some((c) => /hors format/.test(c.text)));
  assert.ok(out.some((c) => c.level === "warn" && /JPEG/.test(c.text)));
});
test("rien d'inconnu n'est bloqué ; YouTube horizontal = pas un Short", () => {
  assert.equal(Core.mediaChecks({ networks: ["instagram", "tiktok"], format: "reel", media: [v({})] }).length, 0);
  const out = Core.mediaChecks({ networks: ["youtube"], format: "reel", media: [v({ dur: 30, w: 1920, h: 1080 })] });
  assert.ok(out.some((c) => c.level === "warn" && /pas un Short/.test(c.text)));
});
test("les contrôles du post incluent les médias", () => {
  const out = Core.checks({ networks: ["tiktok"], format: "reel", captionValidated: true, date: "2026-12-01", media: [v({ dur: 1 })] }, { rules: {} });
  assert.ok(out.some((c) => /trop courte/.test(c.text)));
});
