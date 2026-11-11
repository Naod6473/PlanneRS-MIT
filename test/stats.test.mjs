import test from "node:test";
import assert from "node:assert/strict";
import { collect, mediaKey } from "../worker/src/stats.js";

const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
function route(table) {
  globalThis.fetch = async (url) => { const u = String(url); for (const [re, fn] of table) if (re.test(u)) return fn(u); throw new Error("appel inattendu : " + u); };
}

test("Stats : clé commune entre adresses Instagram et Facebook", () => {
  assert.equal(mediaKey("https://www.instagram.com/reel/DfZSr6dCalc/"), "ig:DfZSr6dCalc");
  assert.equal(mediaKey("https://www.instagram.com/moncompte/p/DfkZRTMDeqB/?img_index=1"), "ig:DfkZRTMDeqB");
  assert.equal(mediaKey("https://www.facebook.com/reel/2343972173070019/"), "fb:2343972173070019");
  assert.equal(mediaKey("https://example.com"), "");
});

test("Stats : relevé Instagram + Facebook, historique du jour", async () => {
  route([
    [/17841\/insights/, () => J({ data: [{ name: "reach", total_value: { value: 120 } }, { name: "profile_views", total_value: { value: 8 } }] })],
    [/17841\/media/, () => J({ data: [{ id: "m1", permalink: "https://www.instagram.com/reel/AbC/", timestamp: "2026-11-10T11:30:00+0000", media_product_type: "REELS", media_type: "VIDEO", like_count: 4, comments_count: 1 }] })],
    [/m1\/insights/, () => J({ data: [{ name: "reach", values: [{ value: 90 }] }, { name: "views", values: [{ value: 150 }] }] })],
    [/17841\?/, () => J({ username: "moncompte", followers_count: 9, follows_count: 0, media_count: 51 })],
    [/\/me\?/, () => J({ id: "PAGE" })],
    [/PAGE\/published_posts/, () => J({ data: [{ id: "PAGE_555", permalink_url: "https://www.facebook.com/reel/123456789012/", created_time: "2026-11-10T11:31:00+0000", reactions: { summary: { total_count: 3 } }, comments: { summary: { total_count: 0 } } }] })],
    [/PAGE\?/, () => J({ name: "Ma page", followers_count: 5, fan_count: 4 })],
  ]);
  const creds = { instagram: { token: "t", accountId: "17841" }, facebook: { token: "t", pageId: "PAGE" } };
  const s = await collect({}, async (n) => creds[n], { history: [{ d: "2026-11-09", ig: 8 }] }, "2026-11-10");
  assert.equal(s.instagram.account.followers, 9);
  assert.equal(s.instagram.day.reach, 120);
  assert.deepEqual([s.instagram.media[0].key, s.instagram.media[0].likes, s.instagram.media[0].views], ["ig:AbC", 4, 150]);
  assert.equal(s.facebook.account.followers, 5);
  assert.deepEqual([s.facebook.media[0].key, s.facebook.media[0].likes], ["fb:123456789012", 3]);
  assert.deepEqual(s.history.map((h) => [h.d, h.ig, h.fb]), [["2026-11-09", 8, undefined], ["2026-11-10", 9, 5]]);
});

test("Stats : sans droit insights, on garde abonnés et likes", async () => {
  route([
    [/17841\/insights/, () => J({ error: { message: "(#10) permission", code: 10 } }, 400)],
    [/17841\/media/, () => J({ data: [{ id: "m1", permalink: "https://www.instagram.com/p/X1/", like_count: 2 }] })],
    [/17841\?/, () => J({ followers_count: 9 })],
  ]);
  const s = await collect({}, async (n) => (n === "instagram" ? { token: "t", accountId: "17841" } : null), null, "2026-11-10");
  assert.ok(s.instagram.insightsError);
  assert.equal(s.instagram.media[0].likes, 2);
  assert.equal(s.facebook, undefined);
});

test("Stats : périodes 7/30 jours, période précédente, portée jour par jour", async () => {
  const seen = [];
  route([
    [/17841\/insights/, (u) => {
      const q = new URL(u).searchParams; seen.push(q.get("metric"));
      if (q.get("metric") === "reach" && !q.get("metric_type")) return J({ data: [{ name: "reach", values: [{ value: 40, end_time: "2026-11-08T08:00:00+0000" }, { value: 55, end_time: "2026-11-09T08:00:00+0000" }] }] });
      if (/likes/.test(q.get("metric"))) return J({ error: { message: "metric not supported" } }, 400);
      return J({ data: [{ name: "reach", total_value: { value: 300 } }, { name: "views", total_value: { value: 500 } }] });
    }],
    [/17841\/media/, () => J({ data: [] })],
    [/17841\?/, () => J({ username: "moncompte", followers_count: 9 })],
  ]);
  const s = await collect({}, async (n) => (n === "instagram" ? { token: "t", accountId: "17841" } : null), { history: [{ d: "2026-11-08", ig: 8 }] }, "2026-11-10");
  assert.equal(s.instagram.week.views, 500); assert.equal(s.instagram.month.reach, 300); assert.equal(s.instagram.prevWeek.reach, 300);
  assert.ok(seen.filter((m) => /likes/.test(m)).length === 1, "la liste complète n'est tentée qu'une fois");
  assert.deepEqual(s.history.map((h) => [h.d, h.ig, h.igReach]), [["2026-11-07", undefined, 40], ["2026-11-08", 8, 55], ["2026-11-10", 9, 300]]);
});
