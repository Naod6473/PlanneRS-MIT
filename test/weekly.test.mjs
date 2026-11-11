// Bilan du dimanche soir.
import test from "node:test";
import assert from "node:assert/strict";
import { weekly, weeklyDue } from "../worker/src/daily.js";
import { mediaKey } from "../worker/src/stats.js";

test("le bilan part le dimanche après l'heure choisie, une seule fois", () => {
  assert.equal(weeklyDue("2026-11-15T19:05", {}, null), true); // dimanche
  assert.equal(weeklyDue("2026-11-15T18:00", {}, null), false);
  assert.equal(weeklyDue("2026-11-15T20:00", {}, "2026-11-15"), false);
  assert.equal(weeklyDue("2026-11-14T20:00", {}, null), false); // samedi
  assert.equal(weeklyDue("2026-11-15T20:00", { notify: { weekly: false } }, null), false);
  assert.equal(weeklyDue("2026-11-15T09:30", { notify: { weeklyTime: "09:00" } }, null), true);
});

test("le bilan résume la semaine, le top et les jours vides", () => {
  const P = (id, date, status, extra) => Object.assign({ id, title: id, date, time: "12:30", status, format: "reel", networks: ["instagram"], captionValidated: true }, extra);
  const posts = [
    P("Reel A", "2026-11-10", "published", { url: "https://www.instagram.com/reel/AAA/" }), P("Reel B", "2026-11-12", "published"),
    P("Raté", "2026-11-13", "failed"),
    P("Lundi", "2026-11-16", "scheduled"), P("Mardi", "2026-11-17", "scheduled", { captionValidated: false }), P("Mercredi", "2026-11-18", "scheduled", { manual: true }),
    P("Jeudi", "2026-11-19", "scheduled"), P("Vendredi", "2026-11-20", "scheduled"),
  ];
  const stats = { history: [{ d: "2026-11-09", ig: 9, igReach: 100 }, { d: "2026-11-15", ig: 14, igReach: 50 }],
    instagram: { media: [{ key: "ig:AAA", at: "2026-11-10T11:30:00+0000", kind: "reel", views: 900 }, { key: "ig:ZZZ", at: "2026-11-11T11:30:00+0000", kind: "carousel", reach: 40 }] } };
  const w = weekly(posts, stats, {}, "2026-11-15T19:00", mediaKey);
  assert.match(w.text, /Cette semaine : 2 publications, 1 post manqué ou en échec\./);
  assert.match(w.text, /Abonnés Instagram : 14 \(\+5 en 7 jours\)/);
  assert.match(w.text, /Comptes touchés : 150\./);
  assert.match(w.text, /Le top : Reel A \(900 vues\), Carrousel du 11\/11 \(40 comptes\)\./);
  assert.match(w.text, /Semaine prochaine : 5 posts prévus, dont 1 légende à valider, 1 post à faire à la main\./);
  assert.match(w.text, /Rien de prévu les jours suivants : samedi, dimanche\./);
});
