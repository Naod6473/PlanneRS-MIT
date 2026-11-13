// Bluesky (protocole AT) : identifiant + mot de passe d'application.
// Doc : https://docs.bsky.app/docs/advanced-guides/posts
import { altOf, fetchMedia, jsonOrThrow, limitText, threadOf, replies, noVideo, notConnected, isVideo, PublishError } from "./common.js";

export const id = "bluesky";
export const fields = [
  { key: "identifier", label: "Identifiant (ex. moncompte.bsky.social)" },
  { key: "appPassword", label: "Mot de passe d'application (Réglages › Confidentialité › Mots de passe d'application)", secret: true },
  { key: "service", label: "Serveur (facultatif, par défaut https://bsky.social)", optional: true },
];

const base = (cred) => (cred.service || "https://bsky.social").replace(/\/$/, "");

async function session(cred) {
  if (!cred.identifier || !cred.appPassword) throw notConnected("Bluesky");
  const r = await fetch(base(cred) + "/xrpc/com.atproto.server.createSession", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier: cred.identifier.replace(/^@/, ""), password: cred.appPassword }),
  });
  return jsonOrThrow("Bluesky", r);
}

// Liens et hashtags cliquables : positions en octets UTF-8.
export function facets(text) {
  const enc = new TextEncoder();
  const byteAt = (i) => enc.encode(text.slice(0, i)).length;
  const out = [];
  for (const m of text.matchAll(/https?:\/\/[^\s)\]]+/g)) {
    const url = m[0].replace(/[.,;:!?]+$/, "");
    out.push({ index: { byteStart: byteAt(m.index), byteEnd: byteAt(m.index + url.length) }, features: [{ $type: "app.bsky.richtext.facet#link", uri: url }] });
  }
  for (const m of text.matchAll(/(^|\s)#([\p{L}\p{N}_]+)/gu)) {
    const start = m.index + m[1].length;
    out.push({ index: { byteStart: byteAt(start), byteEnd: byteAt(start + 1 + m[2].length) }, features: [{ $type: "app.bsky.richtext.facet#tag", tag: m[2] }] });
  }
  return out;
}

export async function publish(env, post, cred) {
  const parts = threadOf(post.caption), text = parts[0];
  parts.forEach((t) => limitText("Bluesky", t, 300));
  const media = (post.media || []).filter((m) => m.role !== "cover" && m.role !== "guide");
  if (media.some(isVideo)) throw noVideo("Bluesky");
  const s = await session(cred);
  const auth = { authorization: "Bearer " + s.accessJwt };
  const images = [];
  for (const m of media.slice(0, 4)) {
    const f = await fetchMedia(env, m);
    if (f.bytes.length > 1000000) throw new PublishError("Image trop lourde pour Bluesky (" + Math.round(f.bytes.length / 1024) + " Ko).", { why: "Bluesky accepte des images jusqu'à 1 Mo.", todo: "Réduis l'image, puis réessaie.", retryable: false });
    const up = await jsonOrThrow("Bluesky", await fetch(base(cred) + "/xrpc/com.atproto.repo.uploadBlob", { method: "POST", headers: Object.assign({ "content-type": f.type }, auth), body: f.bytes }));
    images.push({ alt: altOf(post, m), image: up.blob });
  }
  const record = { $type: "app.bsky.feed.post", text, createdAt: new Date().toISOString(), langs: ["fr"] };
  const fc = facets(text); if (fc.length) record.facets = fc;
  if (images.length) record.embed = { $type: "app.bsky.embed.images", images };
  const r = await jsonOrThrow("Bluesky", await fetch(base(cred) + "/xrpc/com.atproto.repo.createRecord", {
    method: "POST", headers: Object.assign({ "content-type": "application/json" }, auth),
    body: JSON.stringify({ repo: s.did, collection: "app.bsky.feed.post", record }),
  }));
  const rkey = String(r.uri || "").split("/").pop();
  const root = { uri: r.uri, cid: r.cid };
  const more = await replies("Bluesky", parts, root, async (t, parent) => {
    const rec = { $type: "app.bsky.feed.post", text: t, createdAt: new Date().toISOString(), langs: ["fr"], reply: { root, parent } };
    const f = facets(t); if (f.length) rec.facets = f;
    const x = await jsonOrThrow("Bluesky", await fetch(base(cred) + "/xrpc/com.atproto.repo.createRecord", { method: "POST", headers: Object.assign({ "content-type": "application/json" }, auth), body: JSON.stringify({ repo: s.did, collection: "app.bsky.feed.post", record: rec }) }));
    return { uri: x.uri, cid: x.cid };
  });
  return Object.assign({ status: "ok", id: r.uri, url: "https://bsky.app/profile/" + s.handle + "/post/" + rkey }, more);
}

export async function test(env, cred) {
  const s = await session(cred);
  return "Connecté à @" + s.handle;
}
