import { test } from "node:test";
import assert from "node:assert/strict";
import { clean, summarize } from "../worker/src/visites.js";

const now = new Date("2026-11-13T20:00:00Z");

test("visites : un lot est nettoyé et borné", () => {
  assert.deepEqual(clean({ sid: "x", ev: [{ t: "view" }] }, {}, now), [], "identifiant trop court refusé");
  const rows = clean({ sid: "abcdef0123456789", src: "site", device: "mobile", lang: "fr", ref: "https://www.instagram.com/p/xyz", ev: [{ t: "view" }, { t: "pirate" }, { t: "click", l: "a".repeat(500) }, { t: "leave", v: "12000" }] }, { country: "FR" }, now);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].ref, "instagram.com");
  assert.equal(rows[0].country, "FR");
  assert.equal(rows[1].ref, null);
  assert.equal(rows[1].label.length, 120);
  assert.equal(rows[2].value, 12000);
  assert.equal(rows[0].day, "2026-11-13");
  assert.equal(clean({ sid: "abcdef0123456789", ev: Array(100).fill({ t: "click" }) }, {}, now).length, 40);
});

test("visites : tableau de bord (temps, démo, entonnoir, vidéos)", () => {
  const r = (sid, src, type, label, value, at) => ({ at: at || "2026-11-13T10:00:00Z", day: "2026-11-13", sid, src, page: "/", type, label: label || null, value: value == null ? null : value, ref: type === "view" ? "x.com" : null, country: "FR", device: "mobile", lang: "fr" });
  const rows = [
    r("s1aaaaaaaa", "site", "view"), r("s1aaaaaaaa", "site", "section", "videos"), r("s1aaaaaaaa", "site", "video", "cle1:play"), r("s1aaaaaaaa", "site", "video", "cle1:stop", 40),
    r("s1aaaaaaaa", "site", "click", "demo:Essayer la démo"), r("s1aaaaaaaa", "site", "leave", null, 60000), r("s1aaaaaaaa", "demo", "view"), r("s1aaaaaaaa", "demo", "screen", "calendar", 30000), r("s1aaaaaaaa", "demo", "leave", null, 90000),
    r("s2bbbbbbbb", "site", "view"), r("s2bbbbbbbb", "site", "leave", null, 20000), r("s2bbbbbbbb", "site", "leave", null, 30000),
  ];
  const s = summarize(rows, 7, "2026-11-13");
  assert.equal(s.site.visitors, 2);
  assert.equal(s.site.avgMs, 45000);
  assert.equal(s.site.demoClick, 1);
  assert.equal(s.demo.visitors, 1);
  assert.equal(s.demo.fromSite, 1);
  assert.equal(s.demo.avgMs, 90000);
  assert.equal(s.demo.screens[0].k, "calendar");
  assert.equal(s.funnel.find((x) => x.k === "videos").n, 1);
  assert.deepEqual(s.videos[0], { k: "cle1", play: 1, done: 0, pct: 40 });
  assert.equal(s.perDay.length, 7);
  assert.equal(s.perDay[6].site, 2);
  assert.equal(s.sessions.length, 2);
});

test("visites : un autre site ne peut pas envoyer", async () => {
  const { collect } = await import("../worker/src/visites.js");
  const env = { PUBLIC_HOST: "info.example.org" };
  const body = JSON.stringify({ sid: "abcdef0123456789", ev: [{ t: "view" }] });
  const bad = await collect(new Request("https://info.example.org/t", { method: "POST", body, headers: { origin: "https://pirate.example" } }), env);
  assert.equal(bad.status, 403);
  const ok = await collect(new Request("https://info.example.org/t", { method: "POST", body, headers: { origin: "https://info.example.org" } }), env);
  assert.equal(ok.status, 204);
});

test("visites : trop d'envois depuis la même adresse sont refusés", async () => {
  const { allow } = await import("../worker/src/visites.js");
  const t0 = 1_800_000_000_000;
  let ok = 0; for (let i = 0; i < 40; i++) if (allow("1.2.3.4", t0)) ok++;
  assert.equal(ok, 30);
  assert.equal(allow("5.6.7.8", t0), true, "une autre adresse passe");
  assert.equal(allow("1.2.3.4", t0 + 60000), true, "la minute suivante repasse");
});
