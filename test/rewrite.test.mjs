import test from "node:test";
import assert from "node:assert/strict";
import { prompt, textOf, rewrite, MODEL } from "../worker/src/rewrite.js";

const post = { id: "a", title: "Sauvegardes", format: "reel", caption: "Fais tes sauvegardes ! https://exemple.fr #cyber", networks: ["instagram", "x"] };
const fake = (reply, seen) => ({ beta: { messages: { create: async (req) => { if (seen) seen.push(req); return reply; } } } });

test("la consigne donne le réseau, la limite et la légende d'origine", () => {
  const t = prompt(post, "x", { workspace: { name: "Fournil" } });
  assert.match(t, /pour X\./);
  assert.match(t, /280 caractères/);
  assert.match(t, /<legende>\nFais tes sauvegardes/);
  assert.match(t, /Compte : Fournil/);
});

test("rewrite envoie le bon modèle, les fallbacks et rend le texte", async () => {
  const seen = [];
  const r = await rewrite(fake({ model: MODEL, stop_reason: "end_turn", content: [{ type: "thinking", thinking: "…" }, { type: "text", text: "Sauvegarde tes fichiers. https://exemple.fr" }] }, seen), post, "x", {});
  assert.equal(r.text, "Sauvegarde tes fichiers. https://exemple.fr");
  assert.equal(r.over, false);
  assert.equal(seen[0].model, "claude-opus-5-5");
  assert.equal(seen[0].fallbacks, "default");
  assert.deepEqual(seen[0].betas, ["server-side-fallback-2026-07-01"]);
});

test("texte trop long signalé, refus et légende vide expliqués", async () => {
  const r = await rewrite(fake({ stop_reason: "end_turn", content: [{ type: "text", text: "a".repeat(300) }] }), post, "x", {});
  assert.equal(r.over, true);
  assert.throws(() => textOf({ stop_reason: "refusal", content: [] }), /refusé/);
  await assert.rejects(rewrite(fake({}), { title: "x", caption: " " }, "x", {}), /légende commune/);
});

test("adaptAll : une proposition par réseau, un échec n'empêche pas les autres", async () => {
  const { adaptAll } = await import("../worker/src/rewrite.js");
  const client = { beta: { messages: { create: async (req) => {
    if (/pour X\./.test(req.messages[0].content)) throw new Error("panne");
    return { content: [{ type: "text", text: "Texte " + (req.messages[0].content.match(/pour (\w+)/) || [])[1] }] };
  } } } };
  const r = await adaptAll(client, { title: "T", caption: "Base #a" }, ["instagram", "x", "tiktok"], {});
  assert.equal(r.captions.instagram, "Texte Instagram");
  assert.equal(r.captions.tiktok, "Texte TikTok");
  assert.ok(r.failed.x);
  await assert.rejects(() => adaptAll(client, { caption: "" }, ["instagram"], {}));
});
