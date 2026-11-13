// Assistant Meta : jeton allongé, Pages et comptes Instagram retrouvés, autorisations vérifiées, jetons jamais renvoyés.
import test from "node:test";
import assert from "node:assert/strict";
import { inspect, publicView, REQUIRED } from "../worker/src/metasetup.js";

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
