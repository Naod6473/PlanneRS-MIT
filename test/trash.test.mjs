import test from "node:test";
import assert from "node:assert/strict";
import { pruneTrash, TRASH_DAYS } from "../worker/src/db.js";

test("corbeille : garde 30 jours, retire le plus vieux", () => {
  const now = Date.parse("2026-12-01T12:00:00Z");
  const e = (days) => ({ id: "x" + days, at: new Date(now - days * 864e5).toISOString(), posts: [{ id: "p", title: "t" }] });
  assert.equal(TRASH_DAYS, 30);
  const kept = pruneTrash([e(1), e(29), e(31), e(60)], now).map((x) => x.id);
  assert.deepEqual(kept, ["x1", "x29"]);
  assert.deepEqual(pruneTrash(null, now), []);
});
