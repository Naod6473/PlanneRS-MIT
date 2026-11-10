// Calendrier iCalendar : contenu, échappement, lignes repliées.
import test from "node:test";
import assert from "node:assert/strict";
import { build, fold, esc } from "../worker/src/ical.js";

const posts = [
  { id: "a", title: "Pain, levain; et croissants", date: "2026-11-12", time: "12:30", status: "scheduled", captionValidated: false, networks: ["instagram"], format: "reel", caption: "Bonjour\nà tous" },
  { id: "b", title: "Story sondage", date: "2026-11-12", time: "19:00", status: "scheduled", manual: true, networks: ["instagram"], format: "story" },
  { id: "c", title: "Brouillon", date: "2026-11-13", time: "12:30", status: "draft", networks: ["instagram"] },
  { id: "d", title: "Vieux", date: "2026-01-01", time: "12:30", status: "published", networks: ["instagram"] },
];

test("agenda : posts datés, statut, rappel pour ceux à la main", () => {
  const ics = build(posts, { timezone: "Europe/Paris" }, { now: "2026-11-10T21:00", origin: "https://exemple.test" });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.match(ics, /DTSTART;TZID=Europe\/Paris:20261112T123000/);
  assert.match(ics, /SUMMARY:\[À valider\] Pain\\, levain\\; et croissants/);
  assert.match(ics, /BEGIN:VALARM/);
  assert.ok(ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75));
  const manual = build(posts, {}, { now: "2026-11-10T21:00", only: "manual" });
  assert.equal((manual.match(/BEGIN:VEVENT/g) || []).length, 1);
});

test("repli des lignes et échappement", () => {
  assert.equal(esc("a,b;c\nd\\"), "a\\,b\\;c\\nd\\\\");
  const l = fold("DESCRIPTION:" + "é".repeat(80));
  assert.ok(l.split("\r\n").every((x) => new TextEncoder().encode(x).length <= 75));
  assert.equal(l.replace(/\r\n /g, ""), "DESCRIPTION:" + "é".repeat(80));
});
