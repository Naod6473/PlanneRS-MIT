// Commentaires Instagram : tri, « sans réponse », proposition de réponse.
import test from "node:test";
import assert from "node:assert/strict";
import { shape } from "../worker/src/comments.js";
import { suggestReply, replyPrompt } from "../worker/src/rewrite.js";

const groups = [{ media: { id: "m1", url: "https://www.instagram.com/reel/AAA/", caption: "Le levain expliqué" }, comments: [
  { id: "1", text: "Et avec du seigle ?", username: "marie", timestamp: "2026-11-11T08:00:00+0000" },
  { id: "2", text: "Merci !", username: "paul", timestamp: "2026-11-11T09:00:00+0000", replies: { data: [{ id: "3", text: "Avec plaisir", username: "MonCompte", timestamp: "2026-11-11T09:30:00+0000" }] } },
  { id: "4", text: "Mon propre commentaire", username: "moncompte", timestamp: "2026-11-11T10:00:00+0000" },
] }];

test("liste : la plus récente d'abord, mes commentaires exclus, réponse repérée", () => {
  const r = shape(groups, "moncompte");
  assert.deepEqual(r.comments.map((c) => c.id), ["2", "1"]);
  assert.equal(r.comments[0].answered, true);
  assert.equal(r.comments[0].replies[0].mine, true);
  assert.equal(r.comments[1].answered, false);
  assert.equal(r.comments[1].key, "ig:AAA");
});

test("proposition de réponse : consigne complète, texte rendu tel quel", async () => {
  const c = shape(groups, "moncompte").comments[1];
  assert.match(replyPrompt(c, { title: "Levain", caption: "Le levain expliqué" }, { workspace: { name: "Fournil" } }), /Compte : Fournil\.[\s\S]*<commentaire>\nEt avec du seigle \?\n<\/commentaire>/);
  const seen = [];
  const client = { beta: { messages: { create: async (q) => { seen.push(q); return { stop_reason: "end_turn", content: [{ type: "text", text: "Oui, ça marche aussi !" }] }; } } } };
  assert.deepEqual(await suggestReply(client, c, null, {}), { text: "Oui, ça marche aussi !" });
  assert.equal(seen[0].fallbacks, "default");
});
