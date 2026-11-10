// Calendrier à brancher dans Google Agenda, Outlook ou Apple Calendrier (format iCalendar, RFC 5545).
// Adresse secrète /cal/<jeton>.ics : l'agenda la relit tout seul (en général toutes les quelques heures).
// Le jeton se crée dans Réglages › Notifications ; le recréer coupe l'ancienne adresse.
import Core from "../../web/js/core.js";

const LABEL = { review: "À valider", manual: "À la main", late: "En retard", failed: "Échec", published: "Publié", draft: "Brouillon" };
const NET = { instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", x: "X", threads: "Threads", bluesky: "Bluesky", mastodon: "Mastodon", tiktok: "TikTok", youtube: "YouTube", pinterest: "Pinterest" };

export const esc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// Lignes de 75 octets maximum (les suivantes commencent par une espace).
export function fold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = []; let cur = "", n = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (n + b > (out.length ? 74 : 75)) { out.push(cur); cur = ""; n = 0; }
    cur += ch; n += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

const stamp = (d, t) => d.replace(/-/g, "") + "T" + (t || "00:00").replace(":", "") + "00";

// opts : { only: "manual" | "all", now, origin, name }
export function build(posts, settings, opts) {
  const now = opts.now, today = now.slice(0, 10), tz = (settings && settings.timezone) || "Europe/Paris";
  const from = Core.addDays(today, -30), to = Core.addDays(today, 120);
  const list = (posts || []).filter((p) => !p.parent && p.date && p.time && p.date >= from && p.date <= to && p.status !== "draft")
    .filter((p) => opts.only !== "manual" || p.manual);
  const dtstamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PlanneRs//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:" + esc("PlanneRs" + (opts.name ? " · " + opts.name : "") + (opts.only === "manual" ? " (à la main)" : "")), "X-WR-TIMEZONE:" + tz, "REFRESH-INTERVAL;VALUE=DURATION:PT1H"];
  for (const p of list) {
    const st = Core.displayStatus(p, now), tag = LABEL[st];
    const nets = (p.networks || []).map((n) => NET[n] || n).join(", ");
    const desc = [nets + (p.format ? " · " + (Core.FORMATS[p.format] || p.format) : ""), tag ? "Statut : " + tag : "", (p.caption || "").slice(0, 500), opts.origin ? opts.origin + "/#today" : ""].filter(Boolean).join("\n");
    lines.push("BEGIN:VEVENT", "UID:" + esc(p.id) + "@planners", "DTSTAMP:" + dtstamp,
      "DTSTART;TZID=" + tz + ":" + stamp(p.date, p.time), "DURATION:PT15M",
      "SUMMARY:" + esc((tag && st !== "published" ? "[" + tag + "] " : "") + p.title), "DESCRIPTION:" + esc(desc),
      st === "published" ? "STATUS:CONFIRMED" : "STATUS:TENTATIVE");
    if (p.url) lines.push("URL:" + p.url);
    if (p.manual && st !== "published") lines.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + esc("À poster à la main : " + p.title), "TRIGGER:-PT15M", "END:VALARM");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

// Route publique /cal/<jeton>.ics (le jeton est le seul secret).
export async function handle(env, token, db, now, only) {
  const set = (await db.getKV(env, "settings")) || {};
  const cal = (await db.getKV(env, "ical")) || {};
  if (!cal.token || token.length < 20 || token !== cal.token) return new Response("Introuvable", { status: 404 });
  const s = await db.loadState(env);
  const origin = await db.getKV(env, "origin");
  const body = build(s.posts, set, { now, origin, only: only === "manual" ? "manual" : "all", name: (set.workspace || {}).name });
  return new Response(body, { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "private, max-age=900", "x-robots-tag": "noindex" } });
}
