// Pinterest et YouTube : contenu envoyé (sans réseau).
import test from "node:test";
import assert from "node:assert/strict";
import * as pinterest from "../worker/src/adapters/pinterest.js";
import { ytTitle } from "../worker/src/adapters/youtube.js";

test("Pinterest : titre, lien, texte alternatif, carrousel", async () => {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, o) => { calls.push({ url, body: o && o.body ? JSON.parse(o.body) : null }); return new Response(JSON.stringify({ id: "99" }), { status: 201 }); };
  try {
    const post = { title: "Interne", caption: "#pain\nLe pain au levain maison\nRecette : https://exemple.fr/pain.", alt: "Une miche dorée", media: [{ url: "https://h/a.jpg" }, { url: "https://h/b.jpg" }] };
    const r = await pinterest.publish({}, post, { token: "t", boardId: "b1" });
    assert.equal(r.url, "https://www.pinterest.com/pin/99/");
    const b = calls[0].body;
    assert.equal(b.title, "Le pain au levain maison"); assert.equal(b.link, "https://exemple.fr/pain");
    assert.equal(b.alt_text, "Une miche dorée"); assert.equal(b.media_source.source_type, "multiple_image_urls");
  } finally { globalThis.fetch = orig; }
});

test("YouTube : titre = première ligne utile", () => {
  assert.equal(ytTitle({ caption: "#shorts\nLe levain <en> 30 s\nsuite" }), "Le levain en 30 s");
  assert.equal(ytTitle({ title: "Titre", caption: "" }), "Titre");
});
