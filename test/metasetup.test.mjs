// Assistant Meta : jeton allongé, Pages et comptes Instagram retrouvés, autorisations vérifiées, jetons jamais renvoyés.
import test from "node:test";
import assert from "node:assert/strict";
import { inspect, publicView, REQUIRED, loginStart, loginCallback, pending, threadsStart, threadsCallback } from "../worker/src/metasetup.js";

function stub(routes, seen) {
  globalThis.fetch = async (url) => {
    const u = new URL(String(url)); seen.push(u.pathname + u.search);
    const hit = Object.entries(routes).find(([k]) => u.pathname.endsWith(k));
    const body = hit ? hit[1](u) : { error: { message: "inconnu", code: 100 } };
    return new Response(JSON.stringify(body), { status: body.error ? 400 : 200, headers: { "content-type": "application/json" } });
  };
}

test("inspect : échange du jeton, Pages avec Instagram, autorisations manquantes", async () => {
  const seen = [];
  stub({
    "/oauth/access_token": (u) => { assert.equal(u.searchParams.get("client_secret"), "sec"); return { access_token: "LONG" }; },
    "/me/permissions": () => ({ data: REQUIRED.filter((p) => p !== "pages_manage_posts").map((permission) => ({ permission, status: "granted" })) }),
    "/me/accounts": () => ({ data: [{ id: 11, name: "Ma Page", access_token: "PAGE", instagram_business_account: { id: 22, username: "mon.compte" } }, { id: 33, name: "Autre", access_token: "P2" }] }),
  }, seen);
  const r = await inspect({}, { userToken: "COURT", appId: "123", appSecret: "sec" });
  assert.equal(r.long, true);
  assert.deepEqual(r.missing, ["pages_manage_posts"]);
  assert.equal(r.pages[0].igUser, "mon.compte");
  assert.equal(r.pages[0].token, "PAGE");
  assert.equal(r.pages[1].igId, "");
  const v = publicView(r);
  assert.ok(!JSON.stringify(v).includes("PAGE") && !JSON.stringify(v).includes("P2"));
  assert.ok(seen.some((x) => x.includes("me/accounts")));
});

test("inspect : sans clé d'application, jeton court ; sans jeton, message clair", async () => {
  stub({ "/me/permissions": () => ({ data: [] }), "/me/accounts": () => ({ data: [] }) }, []);
  const r = await inspect({}, { userToken: "COURT" });
  assert.equal(r.long, false);
  assert.deepEqual(r.pages, []);
  await assert.rejects(inspect({}, { userToken: " " }), /Colle le jeton/);
});

const memDb = () => { const kv = {}; return { kv, getKV: async (_e, k) => kv[k] ?? null, putKV: async (_e, k, v) => { kv[k] = v; } }; };
const ENV = { ENCRYPTION_KEY: "cle-de-test" };

test("Se connecter avec Facebook : clé chiffrée, retour vérifié, Pages gardées 15 min", async () => {
  const db = memDb();
  const u = new URL(await loginStart(ENV, db, "https://app.test", { appId: "123456", appSecret: "sec" }));
  assert.equal(u.searchParams.get("redirect_uri"), "https://app.test/api/oauth/meta/callback");
  assert.ok(!JSON.stringify(db.kv).includes("sec"), "clé jamais en clair");
  await assert.rejects(loginStart(ENV, db, "https://app.test", { appId: "abc", appSecret: "x" }), /identifiant/);
  stub({
    "/oauth/access_token": (q) => q.searchParams.get("code") ? { access_token: "COURT" } : { access_token: "LONG" },
    "/me/permissions": () => ({ data: [] }),
    "/me/accounts": () => ({ data: [{ id: 11, name: "Ma Page", access_token: "PAGE", instagram_business_account: { id: 22, username: "moi" } }] }),
  }, []);
  await assert.rejects(loginCallback(ENV, db, "https://app.test", new URLSearchParams({ state: "faux", code: "c" })), /expiré/);
  const f = await loginCallback(ENV, db, "https://app.test", new URLSearchParams({ state: u.searchParams.get("state"), code: "c" }));
  assert.equal(f.long, true); assert.equal(f.pages[0].igId, "22");
  assert.ok(!JSON.stringify(db.kv).includes("PAGE"), "jetons chiffrés");
  assert.equal((await pending(ENV, db)).pages[0].token, "PAGE");
  db.kv["oauth-meta"].at -= 16 * 60000;
  await assert.rejects(pending(ENV, db), /expiré/);
});

test("Threads : connexion par la fenêtre Threads, jeton long", async () => {
  const db = memDb();
  const u = new URL(await threadsStart(ENV, db, "https://app.test", { appId: "987654", appSecret: "ts" }));
  assert.equal(u.hostname, "threads.net");
  globalThis.fetch = async (url, o) => {
    const x = new URL(String(url));
    const b = x.pathname === "/oauth/access_token" ? { access_token: "C", user_id: 42 } : { access_token: "L", expires_in: 5e6 };
    if (x.pathname === "/oauth/access_token") assert.equal(new URLSearchParams(o.body).get("client_secret"), "ts");
    return new Response(JSON.stringify(b), { status: 200 });
  };
  const t = await threadsCallback(ENV, db, "https://app.test", new URLSearchParams({ state: u.searchParams.get("state"), code: "c" }));
  assert.deepEqual(t, { token: "L", userId: "42", long: true });
  assert.equal(db.kv["oauth-threads"], null);
});
