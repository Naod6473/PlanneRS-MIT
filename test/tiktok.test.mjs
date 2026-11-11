// TikTok : découpage de la vidéo, modes brouillon et direct, suivi de l'envoi (sans réseau).
import test from "node:test";
import assert from "node:assert/strict";
import * as tt from "../worker/src/adapters/tiktok.js";

const MB = 1024 * 1024;
test("TikTok : découpage en morceaux", () => {
  assert.deepEqual(tt.chunks(20 * MB), { chunk_size: 20 * MB, total_chunk_count: 1 });
  const p = tt.chunks(95 * MB);
  assert.deepEqual(p, { chunk_size: 10 * MB, total_chunk_count: 9 });
  const r = tt.ranges(95 * MB, p);
  assert.equal(r.length, 9); assert.deepEqual(r[0], [0, 10 * MB - 1]); assert.deepEqual(r[8], [80 * MB, 95 * MB - 1]);
});
test("TikTok : mode et visibilité", () => {
  assert.equal(tt.isDirect({}), false); assert.equal(tt.isDirect({ mode: "Direct" }), true);
  assert.equal(tt.privacyOf({}), "PUBLIC_TO_EVERYONE"); assert.equal(tt.privacyOf({ privacy: "privé" }), "SELF_ONLY");
  assert.match(tt.authUrl({ clientKey: "ck" }, "https://p.ex", "s1"), /client_key=ck.*redirect_uri=https%3A%2F%2Fp.ex%2Fapi%2Foauth%2Ftiktok%2Fcallback.*scope=user.info.basic%2Cvideo.upload%2Cvideo.publish/);
});

function fake(handler) {
  const calls = [], orig = globalThis.fetch;
  globalThis.fetch = async (url, o = {}) => { calls.push({ url: String(url), o }); return handler(String(url), o); };
  return { calls, done: () => { globalThis.fetch = orig; } };
}
const ok = (data) => new Response(JSON.stringify({ data, error: { code: "ok" } }), { status: 200 });
const cred = () => ({ clientKey: "ck", clientSecret: "cs", refreshToken: "r", accessToken: "a", expiresAt: Date.now() + 3600e3, username: "mon.compte" });
const post = { title: "T", caption: "Le DNS en 30 s #dns", media: [{ url: "https://h/v.mp4", type: "video", name: "v.mp4" }] };

test("TikTok : brouillon puis suivi jusqu'à la boîte de réception", async () => {
  const f = fake((url, o) => {
    if (url === "https://h/v.mp4") return new Response(new Uint8Array(1000), { headers: { "content-type": "video/mp4" } });
    if (url.endsWith("inbox/video/init/")) return ok({ publish_id: "P1", upload_url: "https://up/x" });
    if (url === "https://up/x") return new Response("", { status: 201 });
    if (url.endsWith("status/fetch/")) return ok({ status: "SEND_TO_USER_INBOX" });
    throw new Error("inattendu " + url);
  });
  try {
    const r = await tt.publish({}, post, cred(), null, null);
    assert.equal(r.status, "pending"); assert.equal(r.job.publishId, "P1");
    const init = JSON.parse(f.calls[1].o.body);
    assert.deepEqual(init.source_info, { source: "FILE_UPLOAD", video_size: 1000, chunk_size: 1000, total_chunk_count: 1 });
    assert.equal(f.calls[2].o.headers["content-range"], "bytes 0-999/1000");
    const r2 = await tt.publish({}, post, cred(), r.job, null);
    assert.deepEqual(r2, { status: "ok", id: "P1", url: "", draft: true });
  } finally { f.done(); }
});

test("TikTok : direct refusé si la visibilité n'est pas permise (app non auditée)", async () => {
  const f = fake((url) => {
    if (url === "https://h/v.mp4") return new Response(new Uint8Array(10));
    if (url.endsWith("creator_info/query/")) return ok({ privacy_level_options: ["SELF_ONLY"] });
    throw new Error("inattendu " + url);
  });
  try {
    await assert.rejects(tt.publish({}, post, Object.assign(cred(), { mode: "direct" }), null, null), (e) => e.code === "privacy_level_option_mismatch" && e.retryable === false);
  } finally { f.done(); }
});

test("TikTok : publication directe terminée donne le lien de la vidéo ; jeton renouvelé", async () => {
  let saved = null;
  const f = fake((url) => {
    if (url.endsWith("oauth/token/")) return new Response(JSON.stringify({ access_token: "a2", expires_in: 86400, refresh_token: "r2" }));
    if (url.endsWith("status/fetch/")) return ok({ status: "PUBLISH_COMPLETE", publicaly_available_post_id: [123] });
    throw new Error("inattendu " + url);
  });
  try {
    const c = Object.assign(cred(), { accessToken: "", expiresAt: 0 });
    const r = await tt.publish({}, post, c, { publishId: "P2", at: Date.now() }, async (x) => { saved = x; });
    assert.equal(r.url, "https://www.tiktok.com/@mon.compte/video/123");
    assert.equal(saved.refreshToken, "r2"); assert.equal(saved.accessToken, "a2");
  } finally { f.done(); }
});

test("TikTok : pas de vidéo, pas d'envoi", async () => {
  await assert.rejects(tt.publish({}, { caption: "x", media: [{ url: "https://h/a.jpg" }] }, cred(), null, null), /Aucune vidéo/);
});
