// Tâches du matin : heure, alertes de jetons, résumé, sauvegarde.
import test from "node:test";
import assert from "node:assert/strict";
import * as daily from "../worker/src/daily.js";

test("heure du résumé : une fois par jour, à partir de l'heure choisie", () => {
  assert.equal(daily.due("2026-11-10T07:55", {}, null), false);
  assert.equal(daily.due("2026-11-10T08:00", {}, null), true);
  assert.equal(daily.due("2026-11-10T09:00", {}, "2026-11-10"), false);
  assert.equal(daily.due("2026-11-10T06:30", { notify: { digestTime: "06:30" } }, "2026-11-09"), true);
});

test("alertes : jeton qui expire, expiré, connexion cassée", () => {
  const a = daily.connectionAlerts({
    instagram: { status: "ok", expires: "2026-11-15" }, threads: { status: "ok", expires: "2027-01-01" },
    x: { status: "error" }, bluesky: { status: "ok", expires: "2026-11-09" }, ntfy: { status: "error" },
  }, "2026-11-10");
  assert.equal(a.length, 3);
  assert.match(a.find((x) => x.net === "instagram").text, /dans 5 jours/);
  assert.equal(a.find((x) => x.net === "bluesky").level, "error");
  assert.match(a.find((x) => x.net === "x").text, /cassée/);
});

test("résumé : rien à dire = pas de message", () => {
  const posts = [
    { id: "a", title: "Pain", date: "2026-11-10", time: "12:30", status: "scheduled", captionValidated: false, networks: ["instagram"] },
    { id: "b", title: "Brioche", date: "2026-11-10", time: "18:00", status: "scheduled", captionValidated: true, networks: ["instagram"] },
    { id: "c", title: "Story", date: "2026-11-10", time: "19:00", status: "scheduled", manual: true, networks: ["instagram"] },
  ];
  const d = daily.digest(posts, {}, "2026-11-10T08:00", []);
  assert.equal(d.count, 2);
  assert.match(d.text, /1 légende à valider/);
  assert.match(d.text, /1 post à publier à la main/);
  assert.match(d.text, /1 post partira tout seul/);
  assert.equal(daily.digest([posts[1]], {}, "2026-11-10T08:00", []), null);
});

test("sauvegarde : le lundi, ou si la dernière a plus de 8 jours", () => {
  assert.equal(daily.backupDue("2026-11-09", {}, "2026-11-02"), true); // lundi
  assert.equal(daily.backupDue("2026-11-09", {}, "2026-11-09"), false);
  assert.equal(daily.backupDue("2026-11-10", {}, "2026-11-09"), false); // mardi
  assert.equal(daily.backupDue("2026-11-10", {}, null), true); // jamais faite
  assert.equal(daily.backupDue("2026-11-12", {}, "2026-11-03"), true);
  assert.equal(daily.backupDue("2026-11-09", { backup: { enabled: false } }, null), false);
  const s = daily.snapshot({ posts: [{ id: 1 }], settings: { a: 1 }, accounts: { x: {} } }, "t");
  assert.equal(s.accounts, undefined);
});

test("expiration Meta via debug_token", async () => {
  const g = (r) => async () => r;
  assert.equal(await daily.metaExpiry(g({ data: { is_valid: true, expires_at: 0 } }), {}, "t"), "");
  assert.equal(await daily.metaExpiry(g({ data: { is_valid: true, expires_at: Date.UTC(2026, 11, 25) / 1000 } }), {}, "t"), "2026-12-25");
  assert.equal(await daily.metaExpiry(g({ data: { is_valid: false } }), {}, "t"), "expired");
});

test("santé des comptes : droits manquants, fin de l'accès aux données Meta, bilan du dimanche", async () => {
  const al = daily.connectionAlerts({ instagram: { status: "ok", missing: ["instagram_content_publish"], dataAccess: "2026-11-20" } }, "2026-11-15");
  assert.equal(al.length, 2);
  assert.match(al[0].text, /instagram_content_publish/);
  assert.match(al[1].text, /dans 5 jours/);
  const tk = await daily.metaToken(async () => ({ data: { is_valid: true, expires_at: 0, data_access_expires_at: 1795000000, scopes: ["instagram_basic"] } }), {}, "T");
  assert.equal(tk.exp, ""); assert.equal(tk.data, "2026-11-18"); assert.deepEqual(tk.scopes, ["instagram_basic"]);
  assert.equal(await daily.metaExpiry(async () => ({ data: { is_valid: false } }), {}, "T"), "expired");
  const ok = daily.weekly([], null, {}, "2026-11-15T19:00", null, { instagram: { status: "ok" }, threads: { status: "ok" } });
  assert.match(ok.text, /2 comptes vérifiés, tout va bien/);
  const bad = daily.weekly([], null, {}, "2026-11-15T19:00", null, { instagram: { status: "error" } });
  assert.match(bad.text, /Comptes à surveiller :\n- Instagram : connexion cassée/);
});
