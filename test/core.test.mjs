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
