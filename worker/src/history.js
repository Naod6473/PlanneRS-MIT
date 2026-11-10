// Récupérer l'historique Instagram : les publications faites avant PlanneRs (ou en dehors) deviennent des posts
// « publiés » dans l'application, avec leur légende et leur lien. Elles apparaissent dans le calendrier et les Stats,
// et peuvent être reprises plus tard. Ce qui est déjà dans PlanneRs n'est pas recréé.
import { graph } from "./adapters/meta.js";
import { mediaKey } from "./stats.js";
import { localNow } from "./robot.js";

export const MAX = 500;

export async function fetchAll(env, cred) {
  const out = []; let after = null;
  do {
    const r = await graph(env, "GET", cred.accountId + "/media", { fields: "id,caption,permalink,timestamp,media_product_type,media_type", limit: 100, after: after || undefined }, cred.token);
    out.push(...(r.data || []));
    after = r.paging && r.paging.next && r.paging.cursors ? r.paging.cursors.after : null;
  } while (after && out.length < MAX);
  return out.slice(0, MAX);
}

const minutes = (d, t) => Date.parse(d + "T" + t + ":00Z") / 60000;

export function toPosts(media, posts, tz) {
  const known = new Set();
  const pub = (posts || []).filter((p) => (p.networks || []).includes("instagram") && p.status === "published");
  pub.forEach((p) => { [p.url, p.results && p.results.instagram && p.results.instagram.url].forEach((u) => { const k = mediaKey(u); if (k) known.add(k); }); });
  const created = []; let skipped = 0;
  for (const m of media || []) {
    const key = mediaKey(m.permalink);
    const at = localNow(tz, new Date(m.timestamp)), date = at.slice(0, 10), time = at.slice(11, 16);
    // Déjà là : même lien, ou un post publié sur Instagram à moins d'une heure sans lien enregistré.
    if ((key && known.has(key)) || (posts || []).some((p) => p.id === "h" + m.id) ||
      pub.some((p) => !mediaKey(p.url) && p.date === date && p.time && Math.abs(minutes(p.date, p.time) - minutes(date, time)) < 60)) { skipped++; continue; }
    const cap = m.caption || "";
    const line = cap.split("\n").map((x) => x.trim()).find((x) => x && !/^#/.test(x)) || "";
    const format = m.media_product_type === "REELS" ? "reel" : m.media_product_type === "STORY" ? "story" : m.media_type === "CAROUSEL_ALBUM" ? "carousel" : m.media_type === "VIDEO" ? "video" : "image";
    created.push({
      id: "h" + m.id, ref: "", title: line ? [...line].slice(0, 60).join("") + ([...line].length > 60 ? "…" : "") : "Publication Instagram",
      format, networks: ["instagram"], date, time, caption: cap, captionValidated: true, manual: false, media: [],
      status: "published", stage: "published", url: m.permalink, results: { instagram: { status: "ok", url: m.permalink, id: m.id } },
      imported: true, note: "Récupéré depuis Instagram (publié en dehors de PlanneRs). Le média est sur Instagram : " + m.permalink,
    });
  }
  return { created, skipped };
}
