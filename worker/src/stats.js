// Statistiques Instagram et Facebook, relevées une fois par jour (et à la demande).
// Instagram : abonnés, portée et interactions du compte (insights), likes et commentaires par publication.
// Facebook : abonnés de la Page, réactions, commentaires et partages par publication.
// Chaque partie échoue seule : un jeton sans droit « insights » donne quand même les abonnés et les likes.
// Docs : https://developers.facebook.com/docs/instagram-platform/insights
//        https://developers.facebook.com/docs/graph-api/reference/page/published_posts/
import { graph } from "./adapters/meta.js";
import { pageToken } from "./adapters/facebook.js";

const HISTORY_DAYS = 120;
const MEDIA_INSIGHTS = 20; // nombre de publications récentes dont on lit la portée (limite d'appels par exécution)

const why = (e) => (e && (e.why || e.message)) || "Erreur inconnue";
const sum = (v) => (v && v.total_value ? v.total_value.value : Array.isArray(v && v.values) ? v.values.reduce((a, x) => a + (+x.value || 0), 0) : 0);

// Clé commune entre une adresse de publication enregistrée dans PlanneRs et celle que renvoie l'API.
export function mediaKey(url) {
  const u = String(url || "");
  let m = /instagram\.com\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/([\w-]+)/.exec(u);
  if (m) return "ig:" + m[1];
  m = /facebook\.com\/.*?(\d{8,})/.exec(u);
  if (m) return "fb:" + m[1];
  return "";
}

// prev : relevé Instagram précédent. Les chiffres par publication non relus cette fois sont repris de là.
export async function instagram(env, cred, prev) {
  const out = { at: new Date().toISOString() };
  const tok = cred.token, id = cred.accountId;
  const a = await graph(env, "GET", id, { fields: "username,followers_count,follows_count,media_count" }, tok);
  out.account = { username: a.username, followers: a.followers_count, follows: a.follows_count, media: a.media_count };
  const range = async (days) => {
    const until = Math.floor(Date.now() / 1000), since = until - days * 86400;
    const r = await graph(env, "GET", id + "/insights", { metric: "reach,profile_views,accounts_engaged,total_interactions,views", period: "day", metric_type: "total_value", since, until }, tok);
    return Object.fromEntries((r.data || []).map((x) => [x.name, sum(x)]));
  };
  try { out.day = await range(1); out.week = await range(7); } catch (e) { out.insightsError = why(e); }
  const list = await graph(env, "GET", id + "/media", { fields: "id,permalink,timestamp,media_product_type,media_type,like_count,comments_count", limit: 100 }, tok);
  out.media = (list.data || []).map((x) => ({ net: "instagram", id: x.id, key: mediaKey(x.permalink), url: x.permalink, at: x.timestamp, kind: x.media_product_type === "REELS" ? "reel" : x.media_type === "CAROUSEL_ALBUM" ? "carousel" : "image", likes: x.like_count || 0, comments: x.comments_count || 0 }));
  const old = Object.fromEntries(((prev && prev.media) || []).map((m) => [m.id, m]));
  const KEEP = ["reach", "views", "saved", "shares", "ins"];
  for (const m of out.media) if (old[m.id]) for (const k of KEEP) if (old[m.id][k] != null) m[k] = old[m.id][k];
  if (!out.insightsError) {
    // Les plus récentes à chaque relevé, puis celles relues il y a le plus longtemps (limite d'appels par exécution).
    const recent = out.media.slice(0, Math.ceil(MEDIA_INSIGHTS / 2));
    const rest = out.media.slice(recent.length).sort((x, y) => String(x.ins || "").localeCompare(String(y.ins || ""))).slice(0, MEDIA_INSIGHTS - recent.length);
    for (const m of recent.concat(rest)) {
      try {
        const r = await graph(env, "GET", m.id + "/insights", { metric: "reach,views,saved,shares" }, tok);
        for (const x of r.data || []) m[x.name] = sum(x);
        m.ins = out.at;
      } catch (e) { m.insightsError = why(e); }
    }
  }
  return out;
}

export async function facebook(env, cred) {
  const out = { at: new Date().toISOString() };
  const tok = await pageToken(env, cred);
  const p = await graph(env, "GET", cred.pageId, { fields: "name,followers_count,fan_count" }, tok);
  out.account = { name: p.name, followers: p.followers_count != null ? p.followers_count : p.fan_count, fans: p.fan_count };
  // Réactions et commentaires : droit « pages_read_user_content ». Sans lui, on garde la liste des posts sans les chiffres.
  const full = "id,permalink_url,created_time,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),shares";
  let r;
  try { r = await graph(env, "GET", cred.pageId + "/published_posts", { fields: full, limit: 30 }, tok); }
  catch (e) {
    out.mediaError = why(e);
    try { r = await graph(env, "GET", cred.pageId + "/published_posts", { fields: "id,permalink_url,created_time,shares", limit: 30 }, tok); } catch (e2) { r = { data: [] }; }
  }
  out.media = (r.data || []).map((x) => {
    const url = String(x.permalink_url || "").replace(/^\//, "https://www.facebook.com/");
    const m = { net: "facebook", id: x.id, key: mediaKey(url) || "fb:" + String(x.id).split("_").pop(), url, at: x.created_time, shares: (x.shares && x.shares.count) || 0 };
    if (x.reactions) m.likes = (x.reactions.summary && x.reactions.summary.total_count) || 0;
    if (x.comments) m.comments = (x.comments.summary && x.comments.summary.total_count) || 0;
    return m;
  });
  return out;
}

// Relevé complet. getCred(net) renvoie les identifiants ; prev : relevé précédent (pour l'historique).
export async function collect(env, getCred, prev, today) {
  const s = { updated: new Date().toISOString(), history: (prev && prev.history) || [] };
  const ig = await getCred("instagram");
  if (ig && ig.token && ig.accountId) { try { s.instagram = await instagram(env, ig, prev && prev.instagram); } catch (e) { s.instagram = { error: why(e) }; } }
  const fb = await getCred("facebook");
  if (fb && fb.token && fb.pageId) { try { s.facebook = await facebook(env, fb); } catch (e) { s.facebook = { error: why(e) }; } }
  const point = { d: today };
  if (s.instagram && s.instagram.account) { point.ig = s.instagram.account.followers; if (s.instagram.day) { point.igReach = s.instagram.day.reach; point.igEng = s.instagram.day.accounts_engaged; point.igViews = s.instagram.day.views; point.igProfile = s.instagram.day.profile_views; } }
  if (s.facebook && s.facebook.account) point.fb = s.facebook.account.followers;
  if (point.ig != null || point.fb != null) s.history = s.history.filter((h) => h.d !== today).concat(point).slice(-HISTORY_DAYS);
  return s;
}
