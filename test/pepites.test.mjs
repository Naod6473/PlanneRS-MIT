// Pépites : comptes suivis, score par rapport à la médiane, flux YouTube, Business Discovery, idée « Faire ma version ».
import test from "node:test";
import assert from "node:assert/strict";
import { cleanRivals, median, score, parseFeed, channelIdOf, collect, ideaOf, remixPrompt, remix } from "../worker/src/pepites.js";

const FEED = `<?xml version="1.0"?><feed><title>Pain Maison</title>
<entry><yt:videoId>aaa111</yt:videoId><title>Levain &amp; farine</title><link rel="alternate" href="https://www.youtube.com/shorts/aaa111"/><published>2026-11-10T10:00:00+00:00</published>
<media:group><media:title>Levain &amp; farine</media:title><media:thumbnail url="https://i.ytimg.com/vi/aaa111/hq.jpg" width="480"/><media:community><media:starRating count="900"/><media:statistics views="50000"/></media:community></media:group></entry>
<entry><yt:videoId>bbb222</yt:videoId><title>Autre</title><link rel="alternate" href="https://www.youtube.com/watch?v=bbb222"/><published>2026-11-05T10:00:00+00:00</published><media:group><media:statistics views="10000"/></media:group></entry>
<entry><yt:videoId>ccc333</yt:videoId><title>Encore</title><published>2026-11-01T10:00:00+00:00</published><media:group><media:statistics views="12000"/></media:group></entry>
</feed>`;

test("comptes suivis : nettoyés, sans doublon, 5 au plus", () => {
  const l = cleanRivals([{ net: "instagram", handle: "@Boulange" }, { net: "instagram", handle: "https://www.instagram.com/boulange/" }, { net: "youtube", handle: "@PainMaison" }, { handle: "pas bon !" },
    { handle: "a" }, { handle: "b" }, { handle: "c" }, { handle: "d" }]);
  assert.deepEqual(l.slice(0, 2), [{ net: "instagram", handle: "Boulange" }, { net: "youtube", handle: "PainMaison" }]);
  assert.equal(l.length, 5);
});

test("score : fois la médiane du compte, 60 derniers jours", () => {
  assert.equal(median([3, 1, 2, 0]), 2);
  const s = score([{ id: 1, metric: 100, at: "2026-11-10" }, { id: 2, metric: 10, at: "2026-11-09" }, { id: 3, metric: 20, at: "2026-11-08" }, { id: 4, metric: 999, at: "2026-08-01" }], "2026-11-12");
  assert.deepEqual(s.map((x) => x.id), [1, 3, 2]);
  assert.equal(s[0].score, 5);
});

test("YouTube : identifiant de chaîne et flux public", () => {
  assert.equal(channelIdOf('xx"channelId":"UCabcdefghijklmnopqrstuv"yy'), "UCabcdefghijklmnopqrstuv");
  const f = parseFeed(FEED);
  assert.equal(f.name, "Pain Maison");
  assert.equal(f.items[0].caption, "Levain & farine"); assert.equal(f.items[0].views, 50000); assert.equal(f.items[0].kind, "short");
  assert.equal(f.items[2].url, "https://www.youtube.com/watch?v=ccc333");
});

test("collect : YouTube et Instagram, un compte en échec n'arrête pas les autres", async () => {
  const fetchFn = async (u) => ({ ok: true, text: async () => (/feeds/.test(u) ? FEED : '"channelId":"UCabcdefghijklmnopqrstuv"') });
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u) => {
    if (/sanscle/.test(decodeURIComponent(String(u)))) return { ok: false, statusText: "x", status: 400, json: async () => ({ error: { message: "Invalid user", code: 110 } }) };
    assert.match(decodeURIComponent(String(u)), /business_discovery\.username\(boulange\)/);
    return { ok: true, json: async () => ({ business_discovery: { username: "boulange", followers_count: 1200, media: { data: [
      { id: "1", caption: "Top", like_count: 300, comments_count: 20, media_type: "VIDEO", media_product_type: "REELS", permalink: "https://instagram.com/reel/1", timestamp: "2026-11-11T08:00:00+0000" },
      { id: "2", caption: "Bof", like_count: 40, comments_count: 2, media_type: "IMAGE", permalink: "https://instagram.com/p/2", timestamp: "2026-11-09T08:00:00+0000" },
      { id: "3", caption: "Moyen", like_count: 50, comments_count: 1, media_type: "CAROUSEL_ALBUM", permalink: "https://instagram.com/p/3", timestamp: "2026-11-08T08:00:00+0000" }] } } }) };
  };
  try {
    const r = await collect({}, [{ net: "youtube", handle: "PainMaison" }, { net: "instagram", handle: "boulange" }, { net: "instagram", handle: "sanscle" }], { token: "t", accountId: "17" }, "2026-11-12", fetchFn);
    assert.equal(r.accounts[0].name, "Pain Maison");
    assert.equal(r.accounts[1].followers, 1200);
    assert.equal(r.top[0].id, "ig:1"); assert.equal(r.top[0].kind, "reel");
    assert.ok(r.top.every((x) => x.score >= 2));
    const r2 = await collect({}, [{ net: "instagram", handle: "x" }], null, "2026-11-12", fetchFn);
    assert.match(r2.accounts[0].error, /Connecte ton compte Instagram/);
  } finally { globalThis.fetch = realFetch; }
});

test("Faire ma version : la recette de Claude, sans copie, et une idée avec le lien d'origine", async () => {
  const item = { id: "ig:1", handle: "boulange", net: "instagram", kind: "reel", caption: "3 erreurs de baguette #pain", url: "https://instagram.com/reel/1", score: 5, metric: 360, unit: "interactions" };
  const t = remixPrompt(item, { workspace: { name: "Fournil" }, crew: { script: { brief: "Tutoie." } } });
  assert.match(t, /Mon compte : Fournil/); assert.match(t, /Tutoie\./); assert.match(t, /3 erreurs de baguette/);
  const seen = [];
  const recipe = await remix({ beta: { messages: { create: async (q) => { seen.push(q); return { content: [{ type: "text", text: "Pourquoi ça marche : …\nMa version : Le levain qui rate\nAccroche…" }] }; } } } }, item, {});
  assert.match(seen[0].system, /ne copies jamais/);
  const p = ideaOf(item, recipe, "2026-11-12T08:00");
  assert.equal(p.title, "Le levain qui rate"); assert.equal(p.date, null); assert.equal(p.stage, "idea");
  assert.match(p.note, /^Inspiration : https:\/\/instagram\.com\/reel\/1/);
  const sans = ideaOf(item, "", "2026-11-12T08:00");
  assert.equal(sans.title, "Ma version : 3 erreurs de baguette");
  assert.match(sans.note, /à ne pas copier/);
});
