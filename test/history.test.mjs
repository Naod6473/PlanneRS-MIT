// Historique Instagram : pas de doublon, posts « publiés » complets.
import test from "node:test";
import assert from "node:assert/strict";
import { toPosts } from "../worker/src/history.js";

test("historique : crée les absents, saute les connus", () => {
  const media = [
    { id: "1", caption: "#tag\nLe pain au levain\nsuite", permalink: "https://www.instagram.com/reel/AAA/", timestamp: "2026-10-30T11:30:00+0000", media_product_type: "REELS", media_type: "VIDEO" },
    { id: "2", caption: "Déjà là", permalink: "https://www.instagram.com/p/BBB/", timestamp: "2026-10-31T17:00:00+0000", media_product_type: "FEED", media_type: "CAROUSEL_ALBUM" },
    { id: "3", caption: "Sans lien enregistré", permalink: "https://www.instagram.com/p/CCC/", timestamp: "2026-11-01T11:31:00+0000", media_product_type: "FEED", media_type: "IMAGE" },
  ];
  const posts = [
    { id: "x", networks: ["instagram"], status: "published", url: "https://www.instagram.com/p/BBB/", date: "2026-10-31", time: "18:00" },
    { id: "y", networks: ["instagram", "facebook"], status: "published", date: "2026-11-01", time: "12:30" },
  ];
  const r = toPosts(media, posts, "Europe/Paris");
  assert.equal(r.created.length, 1); assert.equal(r.skipped, 2);
  const p = r.created[0];
  assert.equal(p.title, "Le pain au levain"); assert.equal(p.format, "reel");
  assert.equal(p.date, "2026-10-30"); assert.equal(p.time, "12:30");
  assert.equal(p.status, "published"); assert.equal(p.results.instagram.url, media[0].permalink);
  assert.equal(toPosts(media, posts.concat(r.created), "Europe/Paris").created.length, 0);
});
