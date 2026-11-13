import test from "node:test";
import assert from "node:assert/strict";
import { oauthHeader } from "../worker/src/adapters/x.js";
import * as x from "../worker/src/adapters/x.js";
import { facets } from "../worker/src/adapters/bluesky.js";
import * as bluesky from "../worker/src/adapters/bluesky.js";
import * as mastodon from "../worker/src/adapters/mastodon.js";
import * as threads from "../worker/src/adapters/threads.js";
import { littleText, defaultVersion } from "../worker/src/adapters/linkedin.js";
import * as linkedin from "../worker/src/adapters/linkedin.js";

const env = {};
const J = (o, status = 200, h = {}) => new Response(JSON.stringify(o), { status, headers: Object.assign({ "content-type": "application/json" }, h) });
const img = () => new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } });
function route(table) {
  const calls = [];
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url); calls.push({ url: u, opts });
    for (const [re, fn] of table) if (re.test(u)) return fn(u, opts);
    throw new Error("appel inattendu : " + u);
  };
  return calls;
}
const post = (o) => Object.assign({ id: "p1", title: "Titre", caption: "Bonjour #test https://ex.fr", media: [{ url: "https://cdn.ex/a.jpg", name: "a.jpg" }] }, o);

test("X : signature OAuth 1.0a conforme à l'exemple officiel", async () => {
  const cred = { apiKey: "xvz1evFS4wEEPTGEFPHBog", apiSecret: "kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw", accessToken: "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb", accessSecret: "LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE" };
  const h = await oauthHeader(cred, "POST", "https://api.twitter.com/1.1/statuses/update.json?include_entities=true&status=" + encodeURIComponent("Hello Ladies + Gentlemen, a signed OAuth request!"), "kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg", 1318622958);
  assert.match(h, /oauth_signature="hCtSmYh%2BiHYCEqBWrE7C7hYmtUk%3D"/);
});

test("X : image envoyée puis post publié", async () => {
  const calls = route([[/cdn\.ex/, img], [/media\/upload$/, () => J({ data: { id: "m1" } })], [/2\/tweets$/, () => J({ data: { id: "99" } })]]);
  const r = await x.publish(env, post(), { apiKey: "a", apiSecret: "b", accessToken: "c", accessSecret: "d" });
  assert.equal(r.url, "https://x.com/i/status/99");
  assert.deepEqual(JSON.parse(calls.at(-1).opts.body).media.media_ids, ["m1"]);
  await assert.rejects(x.publish(env, post({ caption: "a".repeat(281) }), { apiKey: "a", apiSecret: "b", accessToken: "c", accessSecret: "d" }), /trop long/);
});

test("Bluesky : liens et hashtags cliquables (octets UTF-8)", () => {
  const f = facets("Été #cyber https://ex.fr.");
  assert.deepEqual(f.find((x) => x.features[0].tag).index, { byteStart: 6, byteEnd: 12 });
  assert.equal(f.find((x) => x.features[0].uri).features[0].uri, "https://ex.fr");
});

test("Bluesky : session, image, publication", async () => {
  const calls = route([[/cdn\.ex/, img], [/createSession/, () => J({ accessJwt: "jwt", did: "did:plc:1", handle: "moi.bsky.social" })], [/uploadBlob/, () => J({ blob: { ref: "b" } })], [/createRecord/, () => J({ uri: "at://did:plc:1/app.bsky.feed.post/abc" })]]);
  const r = await bluesky.publish(env, post(), { identifier: "moi.bsky.social", appPassword: "x" });
  assert.equal(r.url, "https://bsky.app/profile/moi.bsky.social/post/abc");
  assert.equal(JSON.parse(calls.at(-1).opts.body).record.embed.images.length, 1);
});

test("Mastodon : média puis statut avec clé d'idempotence", async () => {
  const calls = route([[/cdn\.ex/, img], [/api\/v2\/media/, () => J({ id: "7", url: "https://m/7.jpg" })], [/statuses/, () => J({ id: "1", url: "https://m.social/@moi/1" })]]);
  const r = await mastodon.publish(env, post(), { instance: "m.social", token: "t" });
  assert.equal(r.url, "https://m.social/@moi/1");
  assert.ok(calls.at(-1).opts.headers["idempotency-key"]);
});

test("Threads : conteneur, attente, publication", async () => {
  route([[/\/me\/threads_publish/, () => J({ id: "T1" })], [/\/me\/threads/, () => J({ id: "C1" })], [/C1\?/, () => J({ status: "FINISHED" })], [/T1\?/, () => J({ permalink: "https://www.threads.net/@moi/post/1" })]]);
  const r = await threads.publish(env, post(), { token: "t" });
  assert.equal(r.url, "https://www.threads.net/@moi/post/1");
});

test("LinkedIn : texte échappé, image, post", async () => {
  assert.equal(littleText("Salut (toi) #cyber"), "Salut \\(toi\\) {hashtag|\\#|cyber}");
  assert.match(defaultVersion(new Date("2026-11-10")), /^202609$/);
  const calls = route([[/cdn\.ex/, img], [/images\?action=initializeUpload/, () => J({ value: { uploadUrl: "https://up.li/1", image: "urn:li:image:1" } })], [/up\.li/, () => new Response("", { status: 201 })], [/rest\/posts/, () => new Response("", { status: 201, headers: { "x-restli-id": "urn:li:share:5" } })]]);
  const r = await linkedin.publish(env, post(), { token: "t", author: "urn:li:organization:1" });
  assert.equal(r.url, "https://www.linkedin.com/feed/update/urn:li:share:5/");
  assert.equal(JSON.parse(calls.at(-1).opts.body).content.media.id, "urn:li:image:1");
});

test("Fil : X publie chaque message en réponse au précédent", async () => {
  let n = 0;
  const calls = route([[/2\/tweets$/, () => J({ data: { id: "t" + (++n) } })]]);
  const r = await x.publish(env, post({ media: [], caption: "Un.\n---\nDeux.\n---\nTrois." }), { apiKey: "a", apiSecret: "b", accessToken: "c", accessSecret: "d" });
  assert.equal(r.url, "https://x.com/i/status/t1");
  const bodies = calls.map((c) => JSON.parse(c.opts.body));
  assert.deepEqual(bodies.map((b) => b.text), ["Un. 1/3", "Deux. 2/3", "Trois. 3/3"]);
  assert.equal(bodies[2].reply.in_reply_to_tweet_id, "t2");
});

test("Fil : une réponse refusée n'annule pas le premier message", async () => {
  let n = 0;
  route([[/2\/tweets$/, () => (++n === 1 ? J({ data: { id: "t1" } }) : J({ detail: "non" }, 403))]]);
  const r = await x.publish(env, post({ media: [], caption: "Un.\n---\nDeux." }), { apiKey: "a", apiSecret: "b", accessToken: "c", accessSecret: "d" });
  assert.equal(r.status, "ok");
  assert.match(r.warning, /Fil incomplet sur X : 1 message/);
});

test("Fil : Bluesky, Mastodon et Threads chaînent les réponses", async () => {
  let k = 0;
  let calls = route([[/createSession/, () => J({ accessJwt: "jwt", did: "did:plc:1", handle: "moi" })], [/createRecord/, () => J({ uri: "at://x/p/" + (++k), cid: "c" + k })]]);
  await bluesky.publish(env, post({ media: [], caption: "A\n---\nB" }), { identifier: "moi", appPassword: "x" });
  const rec = JSON.parse(calls.at(-1).opts.body).record;
  assert.equal(rec.text, "B 2/2"); assert.equal(rec.reply.root.uri, "at://x/p/1");
  k = 0;
  calls = route([[/statuses/, () => J({ id: "s" + (++k) })]]);
  await mastodon.publish(env, post({ media: [], caption: "A\n---\nB" }), { instance: "m.social", token: "t" });
  assert.equal(JSON.parse(calls.at(-1).opts.body).in_reply_to_id, "s1");
  k = 0;
  calls = route([[/threads_publish/, () => J({ id: "P" + (++k) })], [/\/me\/threads/, () => J({ id: "C" + k })], [/\?/, () => J({ status: "FINISHED" })]]);
  await threads.publish(env, post({ media: [], caption: "A\n---\nB" }), { token: "t" });
  assert.ok(calls.some((c) => /reply_to_id=P1/.test(String(c.opts.body))));
});
