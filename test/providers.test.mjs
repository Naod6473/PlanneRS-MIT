// Fournisseurs de connexion (direct, Composio, Postiz) : aiguillage, relais Composio, file Postiz (sans réseau).
import test from "node:test";
import assert from "node:assert/strict";
import * as providers from "../worker/src/providers/index.js";
import * as composio from "../worker/src/providers/composio.js";
import * as postiz from "../worker/src/providers/postiz.js";
import * as instagram from "../worker/src/adapters/instagram.js";
import * as facebook from "../worker/src/adapters/facebook.js";
import * as x from "../worker/src/adapters/x.js";
import { connectionAlerts } from "../worker/src/daily.js";

const KEY = "ak_secretDeTest123";
const env = { COMPOSIO_API_KEY: KEY };
function fake(handler) {
  const calls = [], orig = globalThis.fetch;
  globalThis.fetch = async (url, o = {}) => { calls.push({ url: String(url), o, body: o.body ? JSON.parse(o.body) : null }); return handler(String(url), o, calls[calls.length - 1].body); };
  return { calls, done: () => { globalThis.fetch = orig; } };
}
const res = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
const ADS = { instagram, facebook, x };
const ccred = { provider: "composio", connectedAccountId: "ca_1", userId: "planners-u1", toolkit: "instagram", accountId: "IG1" };

test("Composio : états et clé jamais recopiée", () => {
  assert.equal(composio.statusOf("ACTIVE"), "ok");
  assert.equal(composio.statusOf("INITIATED"), "pending");
  assert.equal(composio.statusOf("EXPIRED"), "expired");
  assert.equal(composio.statusOf("FAILED"), "error");
  assert.equal(composio.statusOf("INACTIVE"), "error");
  assert.ok(!composio.scrub("clé " + KEY + " refusée").includes(KEY));
});

test("Composio : Instagram publié par le relais, module Instagram inchangé", async () => {
  const f = fake((url, o, b) => {
    assert.equal(url, composio.BASE + "tools/execute/proxy");
    assert.equal(o.headers["x-api-key"], KEY);
    assert.equal(b.connected_account_id, "ca_1"); assert.equal(b.user_id, "planners-u1");
    if (b.endpoint === "/IG1/media") return res({ status: 200, data: { id: "C1" } });
    if (b.endpoint === "/C1") return res({ status: 200, data: { status_code: "FINISHED" } });
    if (b.endpoint === "/IG1/media_publish") return res({ status: 200, data: { id: "M1" } });
    if (b.endpoint === "/M1") return res({ status: 200, data: { permalink: "https://www.instagram.com/p/M1/" } });
    throw new Error("inattendu " + b.endpoint);
  });
  try {
    const ad = providers.routed(ADS, async () => null).instagram;
    const r = await ad.publish(env, { caption: "Bonjour", format: "image", media: [{ url: "https://h/a.jpg", name: "a.jpg" }] }, ccred, null);
    assert.deepEqual(r, { status: "ok", id: "M1", url: "https://www.instagram.com/p/M1/" });
    const create = f.calls[0].body;
    assert.equal(create.method, "POST"); assert.equal(create.body.image_url, "https://h/a.jpg"); assert.equal(create.body.caption, "Bonjour");
    assert.deepEqual(f.calls[1].body.parameters.find((p) => p.name === "fields"), { name: "fields", value: "status_code,status", type: "query" });
    // Aucun jeton réseau dans les appels : seul Composio l'ajoute.
    assert.ok(f.calls.every((c) => !/access_token|authorization/i.test(JSON.stringify(c.body))));
  } finally { f.done(); }
});

test("Composio : erreur Meta traduite, connexion expirée signalée", async () => {
  let f = fake(() => res({ status: 400, data: { error: { code: 190, message: "Session expired" } } }));
  try {
    await assert.rejects(providers.routed(ADS, async () => null).instagram.publish(env, { caption: "x", media: [{ url: "https://h/a.jpg" }] }, ccred), (e) => e.code === "190" && e.retryable === false && /Composio/.test(e.todo));
  } finally { f.done(); }
  f = fake(() => res({ error: { message: "Connected account ca_1 is EXPIRED, key " + KEY } }, 400));
  try {
    await assert.rejects(composio.status(env, ccred), (e) => e.code === "composio-expired" && !JSON.stringify([e.message, e.why, e.todo]).includes(KEY));
  } finally { f.done(); }
  f = fake(() => res({ error: { message: "bad key" } }, 401));
  try { await assert.rejects(composio.api(env, "GET", "auth_configs"), (e) => e.code === "composio-401" && e.retryable === false); } finally { f.done(); }
  await assert.rejects(composio.api({}, "GET", "x"), /pas configuré/);
});

test("Composio : lien d'autorisation (auth config existante, user_id de l'instance)", async () => {
  const kv = {};
  const db = { getKV: async (e, k) => kv[k] || null, putKV: async (e, k, v) => { kv[k] = v; } };
  const f = fake((url, o, b) => {
    if (url.includes("auth_configs?toolkit_slug=instagram")) return res({ items: [{ id: "ac_9", status: "ENABLED" }] });
    if (url.endsWith("connected_accounts/link")) { assert.equal(b.auth_config_id, "ac_9"); assert.match(b.user_id, /^planners-/); assert.equal(b.callback_url, "https://p.ex/cb"); return res({ redirect_url: "https://connect.composio.dev/x", connected_account_id: "ca_2" }, 201); }
    throw new Error("inattendu " + url);
  });
  try {
    const l = await composio.link(env, db, "instagram", "https://p.ex/cb");
    assert.equal(l.url, "https://connect.composio.dev/x");
    assert.deepEqual(Object.keys(l.cred).sort(), ["connectedAccountId", "provider", "toolkit", "userId"]);
    const again = await composio.userId(env, db);
    assert.equal(again, l.cred.userId); // le même identifiant pour toute l'instance
  } finally { f.done(); }
  await assert.rejects(composio.link(env, db, "tiktok", "https://p.ex/cb"), /ne passe pas par Composio/);
});

test("Composio : X en texte et en fil ; médias refusés proprement", async () => {
  let n = 0;
  const f = fake((url, o, b) => { assert.equal(b.endpoint, "/2/tweets"); n++; return res({ status: 201, data: { data: { id: "T" + n } } }); });
  try {
    const r = await providers.routed(ADS, async () => null).x.publish(env, { caption: "Un\n---\nDeux" }, Object.assign({}, ccred, { toolkit: "twitter" }));
    assert.equal(r.id, "T1"); assert.equal(f.calls.length, 2);
    assert.equal(f.calls[1].body.body.reply.in_reply_to_tweet_id, "T1");
  } finally { f.done(); }
  await assert.rejects(composio.publishX(env, { caption: "x", media: [{ url: "https://h/a.jpg" }] }, ccred), /pas encore gérés/);
});

test("Postiz : adresse de l'API", () => {
  assert.equal(postiz.apiBase("https://api.postiz.com"), "https://api.postiz.com/public/v1/");
  assert.equal(postiz.apiBase("https://postiz.ex.fr/"), "https://postiz.ex.fr/api/public/v1/");
  assert.equal(postiz.apiBase("https://postiz.ex.fr/api/public/v1"), "https://postiz.ex.fr/api/public/v1/");
  assert.throws(() => postiz.apiBase("http://x"), /invalide/);
  assert.equal(postiz.networkOf("instagram-standalone"), "instagram");
  assert.equal(postiz.networkOf("linkedin-page"), "linkedin");
});

test("Postiz : publication « now » puis suivi de l'état", async () => {
  const cfg = { baseUrl: "https://pz.ex", apiKey: "pk" };
  const pcred = { provider: "postiz", integrationId: "I1", identifier: "instagram" };
  let state = "QUEUE";
  const f = fake((url, o, b) => {
    assert.equal(o.headers.authorization, "pk");
    if (url.endsWith("/upload-from-url")) return res({ id: "U1", path: "https://pz.ex/u/a.jpg" });
    if (url.endsWith("/posts") && o.method === "POST") return res([{ postId: "P1", integration: "I1" }]);
    if (url.includes("/posts?startDate=")) return res({ posts: [{ id: "P1", state, releaseURL: state === "PUBLISHED" ? "https://instagram.com/p/Z" : null, error: state === "ERROR" ? "Refusé par Instagram" : null }] });
    throw new Error("inattendu " + url);
  });
  try {
    const ad = providers.routed(ADS, async (id) => (id === "postiz" ? cfg : null)).instagram;
    const post = { caption: "Hello", format: "reel", media: [{ url: "https://h/v.mp4", name: "v.mp4" }] };
    const r1 = await ad.publish({}, post, pcred, null);
    assert.equal(r1.status, "pending"); assert.equal(r1.job.postiz, "P1");
    const sent = f.calls[1].body;
    assert.equal(sent.type, "now"); assert.equal(sent.posts[0].integration.id, "I1");
    assert.deepEqual(sent.posts[0].value, [{ content: "Hello", image: [{ id: "U1", path: "https://pz.ex/u/a.jpg" }] }]);
    assert.equal(sent.posts[0].settings.__type, "instagram"); assert.equal(sent.posts[0].settings.post_type, "post");
    assert.equal((await ad.publish({}, post, pcred, r1.job)).status, "pending");
    state = "PUBLISHED";
    assert.deepEqual(await ad.publish({}, post, pcred, r1.job), { status: "ok", id: "P1", url: "https://instagram.com/p/Z" });
    state = "ERROR";
    await assert.rejects(ad.publish({}, post, pcred, r1.job), (e) => e.retryable === false && /Refusé/.test(e.why));
    await assert.rejects(ad.comment({}, "P1", "merci", pcred), /Postiz/);
  } finally { f.done(); }
});

test("Postiz : fil sur X, un élément par message", () => {
  assert.deepEqual(postiz.valueOf({ caption: "A\n---\nB" }, "x", []).map((v) => v.content), ["A 1/2", "B 2/2"]);
  assert.equal(postiz.valueOf({ caption: "A\n---\nB" }, "linkedin", []).length, 1);
  assert.equal(postiz.settingsFor("x", {}).who_can_reply_post, "everyone");
});

test("Direct : aiguillage sans changement", async () => {
  const fakeAd = { fields: [], publish: async (e, p, c) => ({ status: "ok", id: c.token }), test: async () => "ok" };
  const ad = providers.routed({ linkedin: fakeAd }, async () => null).linkedin;
  assert.deepEqual(await ad.publish({}, {}, { token: "t" }), { status: "ok", id: "t" });
  assert.equal(ad.comment, undefined);
});

test("Alerte : connexion expirée chez un fournisseur", () => {
  const al = connectionAlerts({ instagram: { status: "expired", provider: "composio" } }, "2026-11-13");
  assert.equal(al.length, 1); assert.equal(al[0].level, "error"); assert.match(al[0].text, /Composio a expiré/);
});
