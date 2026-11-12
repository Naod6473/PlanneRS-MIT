// Équipe d'agents : rôles et consignes (core), outil MCP planners_team, travail avec la clé API (agent.js).
import test from "node:test";
import assert from "node:assert/strict";
import Core from "../web/js/core.js";
import { handleRpc } from "../worker/src/mcp.js";
import { work, prompt, jsonOf } from "../worker/src/agent.js";

const fake = (text, seen) => ({ beta: { messages: { create: async (req) => { if (seen) seen.push(req); return { stop_reason: "end_turn", content: [{ type: "text", text }] }; } } } });

test("crewOf : rôles par défaut, consignes personnalisées, clé API seulement pour l'écriture", () => {
  const def = Core.crewOf({});
  assert.deepEqual(def.map((r) => r.key), ["script", "voice", "edit", "subs", "caption", "check"]);
  assert.equal(def.find((r) => r.key === "check").who, "me");
  const own = Core.crewOf({ crew: { script: { who: "api", brief: "Toujours 3 plans." }, edit: { who: "api" }, subs: { brief: "  " } } });
  assert.equal(own[0].who, "api"); assert.equal(own[0].brief, "Toujours 3 plans."); assert.equal(own[0].custom, true);
  assert.equal(own.find((r) => r.key === "edit").who, "mcp"); // pas de clé API pour le montage
  assert.equal(own.find((r) => r.key === "subs").custom, false);
});

test("crewWork : les étapes signées du nom du rôle", () => {
  const posts = [{ id: "a", title: "A", prod: { steps: { script: { state: "done", by: "Claude · Scénariste", at: "2026-11-10T10:00" }, edit: { state: "doing", by: "Claude · Monteur" } } } },
    { id: "b", title: "B", prod: { steps: { script: { state: "doing", by: "claude · scénariste", at: "2026-11-11T10:00" } } } }];
  const w = Core.crewWork(posts, Core.CREW[0]);
  assert.deepEqual(w.map((x) => x.id), ["b", "a"]);
});

test("MCP : planners_team donne les consignes, role signe l'étape", async () => {
  const st = { settings: { crew: { script: { brief: "Ton complice." } } }, posts: [{ id: "v1", title: "Levain", format: "reel", networks: ["instagram"], caption: "", media: [], status: "draft" }] };
  const d = { state: async () => st, save: async () => {}, log: async () => {}, now: "2026-11-12T21:00", canValidate: async () => true };
  const call = (name, args) => handleRpc({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, d).then((r) => r.result.structuredContent);
  const t = await call("planners_team", {});
  assert.equal(t.roles[0].brief, "Ton complice."); assert.equal(t.roles[0].signAs, "Claude · Scénariste");
  await call("planners_production", { id: "v1", step: "script", state: "doing", role: "script" });
  assert.equal(st.posts[0].prod.steps.script.by, "Claude · Scénariste");
  assert.equal((await call("planners_team", {})).roles[0].done, 0);
});

test("clé API : le Scénariste remplit le storyboard avec ses consignes", async () => {
  const seen = [], post = { id: "v1", title: "Levain", format: "reel", note: "Transcription : le levain vit.", prod: { maxSec: 20 } };
  const reply = '```json\n{"note":"Le levain expliqué","shots":[{"dur":3,"screen":"Le levain ?","voice":"Tu sais ce que c\'est ?"},{"dur":"5","visual":"Bocal"}]}\n```';
  const r = await work(fake(reply, seen), "script", post, { crew: { script: { brief: "Tutoie." } } }, "2026-11-12T21:00");
  assert.match(seen[0].messages[0].content, /Tutoie\./);
  assert.match(seen[0].messages[0].content, /20 secondes/);
  assert.match(seen[0].messages[0].content, /le levain vit/);
  assert.equal(seen[0].model, "claude-opus-5-5");
  assert.equal(r.post.prod.shots.length, 2); assert.equal(r.post.prod.shots[1].dur, 5);
  assert.equal(r.post.prod.steps.script.by, "Claude · Scénariste");
  assert.equal(r.post.prod.maxSec, 20);
  assert.equal(post.prod.shots, undefined); // l'original n'est pas modifié
  assert.throws(() => jsonOf("pas de json"), /storyboard/);
});

test("clé API : la légende ne remplace jamais un texte existant ni ne se valide", async () => {
  const vide = await work(fake("Le levain, c'est vivant. Et toi ?"), "caption", { id: "a", title: "Levain", caption: "" }, {}, "2026-11-12T21:00");
  assert.equal(vide.post.caption, "Le levain, c'est vivant. Et toi ?"); assert.equal(vide.post.captionValidated, false);
  const plein = await work(fake("Autre"), "caption", { id: "b", title: "Levain", caption: "Mon texte", captionValidated: true }, {}, "2026-11-12T21:00");
  assert.equal(plein.post.caption, "Mon texte"); assert.match(plein.post.comments[0].text, /Proposition de légende :\nAutre/);
  await assert.rejects(work(fake("x"), "edit", { id: "c" }, {}, ""), /clé API/);
  await assert.rejects(work(fake("x"), "script", { id: "c", status: "published" }, {}, ""), /publié/);
  assert.match(prompt(Core.CREW[4], { title: "T" }, {}), /uniquement avec la légende/);
});
