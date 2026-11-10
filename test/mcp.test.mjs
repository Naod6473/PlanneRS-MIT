// Serveur MCP : protocole JSON-RPC et outils (sans Cloudflare).
import test from "node:test";
import assert from "node:assert/strict";
import { handleRpc, handleHttp, TOOLS } from "../worker/src/mcp.js";

function deps(over) {
  const st = {
    settings: { networks: ["instagram", "facebook"], slots: [{ time: "12:30", label: "Midi" }], rules: { requireValidation: true, maxHashtags: 5 }, ai: { validate: true } },
    accounts: { instagram: { status: "ok", account: "@demo" } },
    posts: [
      { id: "p1", title: "Pain", format: "image", networks: ["instagram"], date: "2026-11-12", time: "12:30", caption: "Bonjour #pain", captionValidated: false, media: [{ name: "a.jpg" }], status: "scheduled" },
      { id: "p2", title: "Sans média", format: "image", networks: ["instagram"], date: "2026-11-13", time: "12:30", caption: "x", captionValidated: false, media: [], status: "scheduled" },
    ],
  };
  const saved = [], logs = [];
  return Object.assign({ st, saved, logs, state: async () => st, save: async (ps) => { saved.push(...ps); ps.forEach((p) => { const i = st.posts.findIndex((x) => x.id === p.id); if (i < 0) st.posts.push(p); }); }, log: async (e) => logs.push(e), now: "2026-11-10T21:00", me: "moi@exemple.fr", canValidate: async () => true }, over);
}
const call = (d, name, args) => handleRpc({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, d).then((r) => r.result);

test("initialize, tools/list et notification", async () => {
  const d = deps();
  const init = await handleRpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }, d);
  assert.equal(init.result.serverInfo.name, "planners");
  assert.equal(await handleRpc({ jsonrpc: "2.0", method: "notifications/initialized" }, d), null);
  const list = await handleRpc({ jsonrpc: "2.0", id: 2, method: "tools/list" }, d);
  assert.equal(list.result.tools.length, TOOLS.length);
  const bad = await handleRpc({ jsonrpc: "2.0", id: 3, method: "nope" }, d);
  assert.equal(bad.error.code, -32601);
});

test("créer, modifier (légende → à valider), valider, commenter", async () => {
  const d = deps();
  const c = await call(d, "planners_create_post", { title: "Croissant", date: "2026-11-20", caption: "Miam" });
  assert.equal(c.isError, false);
  const id = c.structuredContent.created.id;
  assert.equal(c.structuredContent.created.time, "12:30");
  let r = await call(d, "planners_validate_caption", { id: "p1" });
  assert.equal(r.isError, false);
  assert.equal(d.st.posts[0].captionValidated, true);
  r = await call(d, "planners_update_post", { id: "p1", caption: "Nouvelle légende" });
  assert.equal(d.st.posts[0].captionValidated, false);
  r = await call(d, "planners_comment", { id, text: "Plus court ?" });
  assert.equal(r.structuredContent.comments, 1);
  assert.ok(d.logs.every((l) => /assistant IA/.test(l.text)));
});

test("validation refusée : contrôle bloquant ou validateur non désigné", async () => {
  let r = await call(deps(), "planners_validate_caption", { id: "p2" });
  assert.equal(r.isError, true); assert.match(r.content[0].text, /Aucun média/);
  r = await call(deps({ canValidate: async () => false }), "planners_validate_caption", { id: "p1" });
  assert.equal(r.isError, true);
});

test("aujourd'hui et liste", async () => {
  const d = deps();
  const t = (await call(d, "planners_today", {})).structuredContent;
  assert.equal(t.toValidate.length, 2);
  const l = (await call(d, "planners_list_posts", { query: "pain" })).structuredContent;
  assert.equal(l.total, 1);
});

test("HTTP : POST JSON, GET refusé, notification = 202", async () => {
  const d = deps();
  const post = (b) => handleHttp(new Request("https://x.test/mcp", { method: "POST", body: JSON.stringify(b) }), d);
  assert.equal((await handleHttp(new Request("https://x.test/mcp"), d)).status, 405);
  assert.equal((await post({ jsonrpc: "2.0", method: "notifications/initialized" })).status, 202);
  const r = await post({ jsonrpc: "2.0", id: 9, method: "ping" });
  assert.deepEqual(await r.json(), { jsonrpc: "2.0", id: 9, result: {} });
});

test("par défaut, ce sont les humains qui valident", async () => {
  const d = deps(); delete d.st.settings.ai;
  const r = await call(d, "planners_validate_caption", { id: "p1" });
  assert.equal(r.isError, true); assert.match(r.content[0].text, /humains/);
  assert.equal(d.st.posts[0].captionValidated, false);
});

test("médias, suppression, réglages, journal", async () => {
  let removed = null, set2 = null;
  const d = deps({ remove: async (id) => { removed = id; }, saveSettings: async (s) => { set2 = s; } });
  d.st.log = [{ at: "x", text: "y" }];
  let r = await call(d, "planners_add_media", { id: "p2", url: "http://pas-https.test/a.jpg" });
  assert.equal(r.isError, true);
  r = await call(d, "planners_add_media", { id: "p2", url: "https://cdn.test/photo%201.jpg" });
  assert.equal(r.structuredContent.media[0].name, "photo 1.jpg");
  assert.equal((await call(d, "planners_validate_caption", { id: "p2" })).isError, false);
  r = await call(d, "planners_remove_media", { id: "p2", index: 0 });
  assert.equal(r.structuredContent.media.length, 0);
  r = await call(d, "planners_delete_post", { id: "p1" });
  assert.equal(removed, "p1");
  r = await call(d, "planners_update_settings", { slots: [{ time: "18:00" }, { time: "09:05", label: "Matin" }], signature: "— la boulangerie" });
  assert.deepEqual(set2.slots.map((x) => x.time), ["09:05", "18:00"]);
  assert.equal(set2.templates.signature, "— la boulangerie");
  assert.equal(set2.ai.validate, true);
  assert.equal((await call(d, "planners_activity", {})).structuredContent.log.length, 1);
});
