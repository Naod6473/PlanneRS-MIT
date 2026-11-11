// Flux RSS : lecture (RSS 2.0, Atom) et création des posts à relire.
import test from "node:test";
import assert from "node:assert/strict";
import { parse, toPosts, run, MAX_NEW } from "../worker/src/rss.js";

const RSS = `<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>Le blog du Fournil</title><link>https://exemple.fr</link>
<item><title><![CDATA[Pain au levain &amp; patience]]></title><link>https://exemple.fr/levain</link><guid>g2</guid><pubDate>Wed, 11 Nov 2026 08:00:00 GMT</pubDate><media:content url="https://exemple.fr/img/levain.jpg" medium="image"/></item>
<item><title>Nos horaires d&#39;hiver</title><link>https://exemple.fr/horaires</link><guid isPermaLink="false">g1</guid><description>&lt;p&gt;&lt;img src="https://exemple.fr/img/h.png"&gt; Bonjour&lt;/p&gt;</description></item>
</channel></rss>`;
const ATOM = `<feed xmlns="http://www.w3.org/2005/Atom"><title>Atelier</title><entry><title>Nouvelle fournée</title><link rel="alternate" href="https://exemple.fr/a?x=1&amp;y=2"/><id>tag:a1</id><updated>2026-11-11T08:00:00Z</updated></entry></feed>`;

test("lit un flux RSS 2.0 : titre, lien, image", () => {
  const f = parse(RSS);
  assert.equal(f.title, "Le blog du Fournil");
  assert.deepEqual(f.items.map((i) => i.id), ["g2", "g1"]);
  assert.equal(f.items[0].title, "Pain au levain & patience");
  assert.equal(f.items[0].image, "https://exemple.fr/img/levain.jpg");
  assert.equal(f.items[1].title, "Nos horaires d'hiver");
  assert.equal(f.items[1].image, "https://exemple.fr/img/h.png");
});

test("lit un flux Atom", () => {
  const f = parse(ATOM);
  assert.equal(f.items.length, 1);
  assert.equal(f.items[0].link, "https://exemple.fr/a?x=1&y=2");
  assert.equal(f.items[0].id, "tag:a1");
});

test("premier passage : rien n'est créé, tout est retenu", () => {
  const r = toPosts(parse(RSS).items, { url: "u" }, undefined, { networks: ["instagram"] });
  assert.equal(r.posts.length, 0);
  assert.deepEqual(r.seen, ["g2", "g1"]);
});

test("un nouvel article devient un post sans date ni validation", () => {
  const r = toPosts(parse(RSS).items, { url: "u", networks: ["linkedin", "x"] }, ["g1"], { networks: ["instagram"] }, 1000);
  assert.equal(r.posts.length, 1);
  const p = r.posts[0];
  assert.equal(p.title, "Pain au levain & patience");
  assert.equal(p.caption, "Pain au levain & patience\n\nhttps://exemple.fr/levain");
  assert.deepEqual(p.networks, ["linkedin", "x"]);
  assert.equal(p.captionValidated, false);
  assert.equal(p.date, null);
  assert.equal(p.status, "ready");
  assert.equal(p.format, "image");
  assert.equal(p.media[0].url, "https://exemple.fr/img/levain.jpg");
  assert.deepEqual(r.seen, ["g2", "g1"]);
  // Deuxième passage : plus rien de neuf.
  assert.equal(toPosts(parse(RSS).items, { url: "u" }, r.seen, {}).posts.length, 0);
});

test("pas plus de " + MAX_NEW + " posts par passage, et un flux en panne n'efface pas sa mémoire", async () => {
  const many = "<rss><channel>" + Array.from({ length: 9 }, (_, i) => "<item><title>T" + i + "</title><guid>n" + i + "</guid></item>").join("") + "</channel></rss>";
  const saved = [], logs = [];
  const deps = { now: "2026-11-11T10:00", save: async (ps) => saved.push(...ps), log: async (e) => logs.push(e), fetch: async (u) => { if (u.includes("panne")) throw new Error("Le site a répondu 500."); return many; } };
  const r = await run([{ url: "https://a.fr/rss" }, { url: "https://panne.fr/rss" }, { url: "pas-une-adresse" }], { "https://a.fr/rss": [], "https://panne.fr/rss": ["x"] }, { networks: ["facebook"] }, deps);
  assert.equal(r.created, MAX_NEW);
  assert.equal(saved.length, MAX_NEW);
  assert.equal(new Set(saved.map((p) => p.id)).size, MAX_NEW);
  assert.equal(saved[0].format, "text");
  assert.deepEqual(saved[0].networks, ["facebook"]);
  assert.equal(r.errors, 1);
  assert.deepEqual(r.memo["https://panne.fr/rss"], ["x"]);
  assert.ok(logs.some((l) => l.level === "error" && /Flux illisible/.test(l.text)));
});
