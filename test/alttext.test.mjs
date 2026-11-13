// Texte alternatif proposé par Claude : image envoyée en base64, consigne, réponse nettoyée.
import test from "node:test";
import assert from "node:assert/strict";
import { suggestAlt, altPrompt, SYSTEM } from "../worker/src/alttext.js";

test("suggestAlt : image en base64, légende pour le contexte, guillemets retirés", async () => {
  const seen = [];
  const client = { beta: { messages: { create: async (req) => { seen.push(req); return { stop_reason: "end_turn", content: [{ type: "text", text: "« Une baguette dorée sur une planche. »" }] }; } } } };
  const alt = await suggestAlt(client, { bytes: new Uint8Array([255, 216, 255]), type: "image/jpeg" }, { title: "Pain", caption: "Mon pain #boulange" });
  assert.equal(alt, "Une baguette dorée sur une planche.");
  const c = seen[0].messages[0].content;
  assert.equal(c[0].type, "image"); assert.equal(c[0].source.data, "/9j/");
  assert.match(c[1].text, /<legende>/);
  assert.match(SYSTEM, /mot pour mot/);
  await assert.rejects(suggestAlt(client, { bytes: new Uint8Array(1), type: "video/mp4" }, {}), /images/);
  assert.doesNotMatch(altPrompt({}), /legende/);
});
