// Rapprochement : posts publiés en dehors de PlanneRs, repérés sur Instagram.
import test from "node:test";
import assert from "node:assert/strict";
import { reconcile, waiting } from "../worker/src/history.js";

const post = (id, date, time, format, extra) => Object.assign({ id, title: id, date, time, format, networks: ["instagram"], status: "scheduled" }, extra);
const tz = "Europe/Paris";

test("une story et un Reel publiés à côté passent en publié, au bon format et à la bonne heure", () => {
  const posts = [post("st", "2026-11-11", "09:05", "story"), post("reel", "2026-11-11", "12:30", "reel"), post("car", "2026-11-11", "18:00", "carousel"), post("vieux", "2026-11-11", "08:00", "image", { status: "published", url: "https://www.instagram.com/p/AAA/" })];
  const media = [
    { id: "1", permalink: "https://www.instagram.com/stories/x/1", timestamp: "2026-11-11T08:06:12+0000", media_product_type: "STORY", media_type: "IMAGE" },
    { id: "2", permalink: "https://www.instagram.com/reel/BBB/", timestamp: "2026-11-11T11:41:00+0000", media_product_type: "REELS", media_type: "VIDEO" },
    { id: "3", permalink: "https://www.instagram.com/p/AAA/", timestamp: "2026-11-11T07:00:00+0000", media_product_type: "FEED", media_type: "IMAGE" },
  ];
  const ch = reconcile(media, posts, tz, "2026-11-11T13:00");
  assert.deepEqual(ch.map((p) => p.id), ["st", "reel"]);
  assert.equal(posts[0].status, "published");
  assert.equal(posts[0].url, "https://www.instagram.com/stories/x/1");
  assert.equal(posts[1].results.instagram.id, "2");
  assert.equal(posts[2].status, "scheduled"); // pas encore l'heure, et rien de publié
});

test("rien n'est rapproché trop loin de l'heure prévue, ni deux fois", () => {
  const posts = [post("a", "2026-11-11", "09:00", "image"), post("b", "2026-11-11", "09:10", "image")];
  const media = [{ id: "9", permalink: "https://www.instagram.com/p/C/", timestamp: "2026-11-11T08:09:00+0000", media_type: "IMAGE" }, { id: "8", permalink: "https://www.instagram.com/p/D/", timestamp: "2026-11-11T13:00:00+0000", media_type: "IMAGE" }];
  const ch = reconcile(media, posts, tz, "2026-11-11T15:00");
  assert.deepEqual(ch.map((p) => p.id), ["b"]);
  assert.equal(reconcile(media, posts, tz, "2026-11-11T15:00").length, 0);
  assert.equal(waiting([post("brouillon", "2026-11-11", "09:00", "image", { status: "draft" })], "2026-11-11T15:00").length, 0);
});
