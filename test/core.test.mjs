import { test } from "node:test";
import assert from "node:assert/strict";
import Core from "../web/js/core.js";

const base = { id: "a", networks: ["instagram"], format: "reel", date: "2026-11-12", time: "12:30", status: "scheduled", captionValidated: true, manual: false, media: [{ name: "a.mp4" }], caption: "Bonjour #a" };

test("statut affiché", () => {
  const now = "2026-11-12T10:00";
  assert.equal(Core.displayStatus(base, now), "scheduled");
  assert.equal(Core.displayStatus({ ...base, captionValidated: false }, now), "review");
  assert.equal(Core.displayStatus({ ...base, manual: true }, now), "manual");
  assert.equal(Core.displayStatus({ ...base, manual: true }, "2026-11-12T13:00"), "late");
  assert.equal(Core.displayStatus({ ...base, date: null, status: "ready" }, now), "ready");
  assert.equal(Core.displayStatus({ ...base, status: "failed" }, now), "failed");
});

test("rien ne part sans validation", () => {
  assert.equal(Core.willSend(base), true);
  assert.equal(Core.willSend({ ...base, captionValidated: false }), false);
  assert.equal(Core.willSend({ ...base, manual: true }), false);
  const c = Core.checks({ ...base, captionValidated: false }, { rules: {} });
  assert.ok(c.some((x) => x.level === "block" && /validée/.test(x.text)));
});

test("contrôles : hashtags, média, longueur", () => {
  const s = { rules: { maxHashtags: 2 } };
  assert.ok(Core.checks({ ...base, caption: "#a #b #c" }, s).some((x) => x.level === "block" && /hashtags/.test(x.text)));
  assert.ok(Core.checks({ ...base, media: [] }, s).some((x) => x.level === "block" && /média/i.test(x.text)));
  assert.ok(Core.checks({ ...base, networks: ["x"], caption: "x".repeat(300) }, s).some((x) => /280/.test(x.text)));
});

test("créneaux et dates", () => {
  const slots = [{ time: "12:30" }, { time: "18:00" }];
  assert.equal(Core.slotOf("12:35", slots).time, "12:30");
  assert.equal(Core.slotOf("15:00", slots), null);
  assert.equal(Core.mondayOf("2026-11-15"), "2026-11-09");
  assert.equal(Core.addDays("2026-11-30", 1), "2026-12-01");
});

test("contenus intemporels : publiés il y a plus de 2 mois, pas repris récemment, jamais l'actu", () => {
  const posts = [
    { id: "a", title: "A", evergreen: true, status: "published", date: "2026-08-01" },
    { id: "b", title: "B", evergreen: true, status: "published", date: "2026-07-01" },
    { id: "c", title: "C", evergreen: true, status: "published", date: "2026-07-01", expires: "2026-07-05" },
    { id: "d", title: "D", status: "published", date: "2026-06-01" },
    { id: "e", title: "E", evergreen: true, status: "published", date: "2026-10-20" },
    { id: "k1", title: "B (reprise)", repostOf: "b", status: "published", date: "2026-10-01" },
  ];
  assert.deepEqual(Core.evergreen(posts, "2026-11-13").map((p) => p.id), ["a"]);
  assert.deepEqual(Core.evergreen(posts, "2026-12-15").map((p) => p.id), ["a", "b"]);
  const c = Core.repostOf(Object.assign({ url: "x", results: {} }, posts[0]), "2026-11-20", "12:30", "k2");
  assert.equal(c.title, "A (reprise)"); assert.equal(c.repostOf, "a"); assert.equal(c.captionValidated, false);
  assert.ok(!("url" in c) && !("evergreen" in c));
});

test("dates des autres outils : ISO, jour/mois, AM/PM américain, UTC", () => {
  assert.deepEqual(Core.parseWhen("2026-11-13 12:30"), { date: "2026-11-13", time: "12:30" });
  assert.deepEqual(Core.parseWhen("13/11/2026 12h30"), { date: "2026-11-13", time: "12:30" });
  assert.deepEqual(Core.parseWhen("11/13/2026 1:30 PM"), { date: "2026-11-13", time: "13:30" });
  assert.deepEqual(Core.parseWhen("05/11/2026 12:05 AM"), { date: "2026-05-11", time: "00:05" });
  assert.deepEqual(Core.parseWhen("05/11/2026"), { date: "2026-11-05", time: null });
  assert.equal(Core.parseWhen("2026-13-01"), null);
  assert.equal(Core.parseWhen("demain"), null);
  assert.equal(Core.parseWhen("2026-11-13T11:30:00Z").date, "2026-11-13");
});
