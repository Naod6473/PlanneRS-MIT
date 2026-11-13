// Succès : paliers de vues, abonnés, régularité, publications et réactions, avec leur date.
import test from "node:test";
import assert from "node:assert/strict";
import Core from "../web/js/core.js";

const pub = (id, date) => ({ id, title: id, status: "published", date, time: "12:30", format: "reel" });

test("achievements : paliers atteints, prochain palier et dates", () => {
  const posts = [pub("a", "2026-10-05"), pub("b", "2026-10-12"), pub("c", "2026-10-19"), pub("d", "2026-10-21"), pub("e", "2026-11-09"), { id: "x", status: "scheduled", date: "2026-11-20" }];
  const stats = { history: [{ d: "2026-10-01", ig: 90 }, { d: "2026-10-20", ig: 130 }],
    instagram: { account: { followers: 140 }, media: [{ views: 1200, likes: 40, comments: 15, at: "2026-10-19T10:30:00Z", url: "https://x/1", caption: "Top" }, { views: 300, likes: 70, comments: 1, at: "2026-10-05T10:00:00Z" }] } };
  const a = Core.achievements(posts, stats, "2026-11-13T09:00");
  const g = Object.fromEntries(a.groups.map((x) => [x.g, x]));
  assert.equal(g.views.value, 1200);
  assert.deepEqual(g.views.levels.filter((l) => l.got).map((l) => l.n), [100, 500, 1000]);
  assert.equal(g.views.levels[2].at, "2026-10-19"); assert.equal(g.views.next.n, 5000);
  assert.ok(Math.abs(g.views.progress - 0.24) < 1e-9);
  assert.equal(g.views.from.url, "https://x/1");
  assert.equal(g.likes.value, 71); assert.equal(g.likes.levels[0].got, true);
  assert.equal(g.followers.levels[0].at, "2026-10-20");
  assert.equal(g.posts.value, 5); assert.equal(g.posts.levels[0].at, "2026-10-05");
  assert.equal(g.streak.value, 3); assert.equal(g.streak.current, 1);
  assert.equal(g.streak.levels[0].at, "2026-10-12");
  assert.ok(a.unlocked.includes("views:1000")); assert.ok(!a.unlocked.includes("views:5000"));
  assert.equal(Core.achText(g.views, 1000), "1 000 vues sur une publication");
  assert.equal(Core.achText(g.posts, 1), "1 publication");
});

test("achievements : sans statistiques, rien ne casse", () => {
  const a = Core.achievements([], null, "2026-11-13T09:00");
  assert.equal(a.unlocked.length, 0); assert.ok(a.total > 20);
  assert.equal(a.groups[0].next.n, 100);
});
