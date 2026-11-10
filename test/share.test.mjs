// Lien de validation client : page publique limitée aux posts partagés.
import test from "node:test";
import assert from "node:assert/strict";
import * as share from "../worker/src/share.js";

function fakeEnv(posts) {
  const kv = new Map(), rows = new Map(posts.map((p) => [p.id, JSON.stringify(p)])), log = [];
  const stmt = (sql) => ({
    bind: (...a) => ({
      sql, a,
      first: async () => {
        if (sql.includes("FROM kv")) return kv.has(a[0]) ? { v: kv.get(a[0]) } : null;
        if (sql.includes("FROM posts")) return rows.has(a[0]) ? { data: rows.get(a[0]) } : null;
        return null;
      },
      run: async () => {
        if (sql.startsWith("INSERT INTO kv")) kv.set(a[0], a[1]);
        if (sql.startsWith("INSERT INTO log")) log.push(a[2]);
        return {};
      },
    }),
  });
  const DB = { prepare: stmt, batch: async (list) => { list.forEach((b) => { if (b.sql.startsWith("INSERT INTO posts")) rows.set(b.a[0], b.a[1]); }); return []; } };
  return { env: { DB }, rows, log };
}
const req = (url, form) => new Request(url, form ? { method: "POST", body: new URLSearchParams(form) } : {});

test("la page échappe le texte et n'affiche que les posts partagés", async () => {
  const { env } = fakeEnv([{ id: "a", title: "<b>Pain</b>", caption: "Texte <script>", networks: ["instagram"], date: "2026-12-01", time: "12:30" }, { id: "b", title: "Secret" }]);
  const t = await share.create(env, ["a"], "moi@exemple.fr", "Boulangerie");
  const r = await share.handle(req("https://x.test/v/" + t), env, t, "2026-11-10T10:00");
  const html = await r.text();
  assert.equal(r.status, 200);
  assert.ok(html.includes("&lt;b&gt;Pain&lt;/b&gt;") && !html.includes("<script>"));
  assert.ok(!html.includes("Secret"));
});

test("valider et commenter depuis le lien", async () => {
  const { env, rows, log } = fakeEnv([{ id: "a", title: "Pain", caption: "x", captionValidated: false, status: "scheduled" }, { id: "b", title: "Autre" }]);
  const t = await share.create(env, ["a"], "", "");
  let r = await share.handle(req("https://x.test/v/" + t, { id: "a", action: "comment", text: "Plus court ?" }), env, t, "2026-11-10T10:00");
  assert.equal(r.status, 303);
  assert.equal(JSON.parse(rows.get("a")).comments[0].text, "Plus court ?");
  r = await share.handle(req("https://x.test/v/" + t, { id: "a", action: "validate" }), env, t, "2026-11-10T10:01");
  assert.equal(JSON.parse(rows.get("a")).captionValidated, true);
  r = await share.handle(req("https://x.test/v/" + t, { id: "b", action: "validate" }), env, t, "2026-11-10T10:02");
  assert.equal(r.status, 400);
  assert.equal(log.length, 2);
});

test("jeton inconnu ou mal formé : page d'erreur", async () => {
  const { env } = fakeEnv([]);
  assert.equal((await share.handle(req("https://x.test/v/abc"), env, "abc", "")).status, 404);
  assert.equal((await share.handle(req("https://x.test/v/" + "A".repeat(32)), env, "A".repeat(32), "")).status, 404);
});
