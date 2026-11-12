// La Fabrique : état de production d'une vidéo (core) et outils MCP.
import test from "node:test";
import assert from "node:assert/strict";
import Core from "../web/js/core.js";
import { handleRpc } from "../worker/src/mcp.js";

test("prodOf : étapes devinées, puis enregistrées ; durée et alerte", () => {
  const vide = Core.prodOf({ format: "reel", media: [] });
  assert.equal(vide.done, 0); assert.equal(vide.current.key, "script");
  const fini = Core.prodOf({ format: "reel", caption: "x", captionValidated: true, media: [{ name: "a.mp4", type: "video" }] });
  assert.equal(fini.ready, true);
  const p = { format: "reel", caption: "x", media: [], prod: { steps: { voice: { state: "doing", by: "Voix IA" } }, shots: [{ dur: 20 }, { dur: 15 }] } };
  const pr = Core.prodOf(p);
  assert.equal(pr.current.key, "voice"); assert.equal(pr.current.by, "Voix IA");
  assert.equal(pr.duration, 35); assert.equal(pr.tooLong, true);
  p.prod.maxSec = 60; assert.equal(Core.prodOf(p).tooLong, false);
  assert.equal(Core.inFabrique({ format: "reel", status: "scheduled" }), true);
  assert.equal(Core.inFabrique({ format: "reel", status: "published" }), false);
  assert.equal(Core.inFabrique({ format: "carousel", status: "scheduled" }), false);
});

test("MCP : avancer une vidéo, storyboard, vidéo finie, liste de la Fabrique", async () => {
  const st = { settings: {}, posts: [{ id: "v1", title: "Levain", format: "reel", networks: ["instagram"], date: "2026-11-20", time: "12:30", caption: "", media: [], status: "scheduled" }] };
  const logs = [];
  const d = { state: async () => st, save: async () => {}, log: async (e) => logs.push(e), now: "2026-11-12T21:00", canValidate: async () => true };
  const call = (name, args) => handleRpc({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, d).then((r) => r.result);
  let r = await call("planners_production", { id: "v1", step: "script", state: "done", by: "Claude · Scénariste", shots: [{ dur: 10, screen: "Accroche" }, { dur: 12 }] });
  assert.equal(r.isError, false);
  assert.equal(r.structuredContent.current, "voice");
  assert.equal(r.structuredContent.seconds, 22);
  r = await call("planners_production", { id: "v1", videoUrl: "http://pas-sur.fr/v.mp4" });
  assert.equal(r.isError, true);
  r = await call("planners_production", { id: "v1", step: "edit", state: "doing", by: "Claude · Monteur", videoUrl: "https://exemple.fr/v1.mp4" });
  assert.equal(st.posts[0].media[0].role, "final");
  assert.equal(st.posts[0].captionValidated, undefined);
  r = await call("planners_fabrique", {});
  assert.equal(r.structuredContent.videos[0].current.step, "edit");
  assert.equal(r.structuredContent.videos[0].current.by, "Claude · Monteur");
  assert.ok(logs.some((l) => /Fabrique/.test(l.text)));
});
