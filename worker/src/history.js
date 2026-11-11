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

// Rapprochement : un post prévu dans PlanneRs mais publié en dehors (à la main, par un script, par un assistant)
// passe en « publié » quand il apparaît sur Instagram, au même format, à moins de 90 minutes de l'heure prévue.
const FMT = { REELS: ["reel", "video"], STORY: ["story"], CAROUSEL_ALBUM: ["carousel"], IMAGE: ["image"], VIDEO: ["video", "reel"] };
export const WINDOW = 90;

export function formatOf(m) {
  if (m.media_product_type === "STORY") return "STORY";
  if (m.media_product_type === "REELS") return "REELS";
  return m.media_type || "IMAGE";
}

// Posts Instagram encore à publier, dont l'heure est passée depuis au plus 2 jours.
export function waiting(posts, now) {
  const from = new Date(Date.parse(now.slice(0, 10) + "T00:00:00Z") - 2 * 864e5).toISOString().slice(0, 10);
  return (posts || []).filter((p) => (p.networks || []).includes("instagram") && p.status !== "published" && p.status !== "draft" &&
    p.date && p.time && p.date >= from && (p.date + "T" + p.time) <= now);
}

// media : publications et stories récentes (champs id, permalink, timestamp, media_type, media_product_type).
// Renvoie la liste des posts modifiés (déjà mis à jour).
export function reconcile(media, posts, tz, now) {
  const todo = waiting(posts, now);
  if (!todo.length) return [];
  const known = new Set();
  (posts || []).forEach((p) => { [p.url, p.results && p.results.instagram && p.results.instagram.url].forEach((u) => { const k = mediaKey(u) || u; if (k) known.add(k); }); if (p.results && p.results.instagram && p.results.instagram.id) known.add(p.results.instagram.id); });
  const changed = [];
  const items = (media || []).slice().sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  for (const m of items) {
    if (known.has(m.id) || known.has(mediaKey(m.permalink) || m.permalink)) continue;
    const at = localNow(tz, new Date(m.timestamp)), date = at.slice(0, 10), time = at.slice(11, 16);
    const ok = FMT[formatOf(m)] || [];
    let best = null, bd = WINDOW + 1;
    for (const p of todo) {
      if (changed.includes(p) || !ok.includes(p.format)) continue;
      const d = Math.abs(minutes(p.date, p.time) - minutes(date, time));
      if (d < bd) { bd = d; best = p; }
    }
    if (!best) continue;
    const url = m.permalink || "";
    best.status = "published"; best.stage = "published"; if (url) best.url = url; best.publishedAt = at;
    best.results = Object.assign({}, best.results, { instagram: { status: "ok", url, id: m.id, at, detected: true } });
    delete best.failure;
    changed.push(best); known.add(m.id);
  }
  return changed;
}

// Publications et stories récentes du compte (2 appels).
export async function fetchRecent(env, cred) {
  const fields = "id,permalink,timestamp,media_product_type,media_type";
  const [a, b] = await Promise.all([
    graph(env, "GET", cred.accountId + "/media", { fields, limit: 25 }, cred.token),
    graph(env, "GET", cred.accountId + "/stories", { fields }, cred.token).catch(() => ({ data: [] })),
  ]);
  return (a.data || []).concat((b.data || []).map((s) => Object.assign({ media_product_type: "STORY" }, s)));
}
