// Statistiques Instagram et Facebook, relevées une fois par jour (et à la demande).
// Instagram : abonnés, portée et interactions du compte (insights), likes et commentaires par publication.
// Facebook : abonnés de la Page, réactions, commentaires et partages par publication.
// Chaque partie échoue seule : un jeton sans droit « insights » donne quand même les abonnés et les likes.
// Docs : https://developers.facebook.com/docs/instagram-platform/insights
//        https://developers.facebook.com/docs/graph-api/reference/page/published_posts/
import { graph } from "./adapters/meta.js";
import { pageToken } from "./adapters/facebook.js";
import { token as ytToken } from "./adapters/youtube.js";

const HISTORY_DAYS = 120;
const MEDIA_INSIGHTS = 20; // nombre de publications récentes dont on lit la portée (limite d'appels par exécution)

// Une valeur « end_time » de l'API couvre la journée qui se termine à cette heure : on la range au jour d'avant.
export const dayBefore = (iso) => new Date(new Date(iso).getTime() - 12 * 3600e3).toISOString().slice(0, 10);
const why = (e) => (e && (e.why || e.message)) || "Erreur inconnue";
const sum = (v) => (v && v.total_value ? v.total_value.value : Array.isArray(v && v.values) ? v.values.reduce((a, x) => a + (+x.value || 0), 0) : 0);

// Clé commune entre une adresse de publication enregistrée dans PlanneRs et celle que renvoie l'API.
export function mediaKey(url) {
  const u = String(url || "");
  let m = /instagram\.com\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/([\w-]+)/.exec(u);
  if (m) return "ig:" + m[1];
  m = /facebook\.com\/.*?(\d{8,})/.exec(u);
  if (m) return "fb:" + m[1];
  m = /(?:youtube\.com\/(?:shorts\/|watch\?v=)|youtu\.be\/)([\w-]{6,})/.exec(u);
  if (m) return "yt:" + m[1];
  return "";
}

// prev : relevé Instagram précédent. Les chiffres par publication non relus cette fois sont repris de là.
export async function instagram(env, cred, prev) {
  const out = { at: new Date().toISOString() };
  const tok = cred.token, id = cred.accountId;
  const a = await graph(env, "GET", id, { fields: "username,followers_count,follows_count,media_count" }, tok);
  out.account = { username: a.username, followers: a.followers_count, follows: a.follows_count, media: a.media_count };
  // Totaux du compte sur une fenêtre [aujourd'hui - from ; aujourd'hui - to] (30 jours au plus par appel).
  // Liste complète d'abord ; si l'API la refuse (version ou droits), la liste d'origine.
  const FULL = "reach,views,likes,comments,shares,saves,replies,total_interactions,profile_views,accounts_engaged";
  const BASIC = "reach,profile_views,accounts_engaged,total_interactions,views";
  let metrics = FULL;
  const range = async (from, to = 0) => {
    const now = Math.floor(Date.now() / 1000), until = now - to * 86400, since = now - from * 86400;
    let r;
    try { r = await graph(env, "GET", id + "/insights", { metric: metrics, period: "day", metric_type: "total_value", since, until }, tok); }
    catch (e) { if (metrics === BASIC) throw e; metrics = BASIC; r = await graph(env, "GET", id + "/insights", { metric: metrics, period: "day", metric_type: "total_value", since, until }, tok); }
    return Object.fromEntries((r.data || []).map((x) => [x.name, sum(x)]));
  };
  try {
    out.day = await range(1); out.week = await range(7); out.month = await range(30);
    try { out.prevWeek = await range(14, 7); out.prevMonth = await range(60, 30); } catch (e) { /* comparaison indisponible */ }
  } catch (e) { out.insightsError = why(e); }
  // Portée jour par jour sur 30 jours (seule mesure du compte disponible en série) : remplit la courbe dès le premier relevé.
  if (!out.insightsError) {
    try {
      const until = Math.floor(Date.now() / 1000), since = until - 30 * 86400;
      const r = await graph(env, "GET", id + "/insights", { metric: "reach", period: "day", since, until }, tok);
      const v = ((r.data || [])[0] || {}).values || [];
      out.reachDaily = v.filter((x) => x.end_time).map((x) => ({ d: dayBefore(x.end_time), v: +x.value || 0 }));
    } catch (e) { /* facultatif */ }
  }
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

// YouTube : abonnés et vues de la chaîne, puis vues, likes et commentaires des 50 dernières vidéos (API Data v3).
export async function youtube(env, cred) {
  const out = { at: new Date().toISOString() };
  const t = await ytToken(cred), H = { authorization: "Bearer " + t };
  const get = async (path) => { const r = await fetch("https://www.googleapis.com/youtube/v3/" + path, { headers: H }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error((j.error && j.error.message) || "YouTube " + r.status); return j; };
  const c = ((await get("channels?part=snippet,statistics,contentDetails&mine=true")).items || [])[0];
  if (!c) throw new Error("Aucune chaîne sur ce compte Google.");
  const st = c.statistics || {};
  out.account = { name: c.snippet.title, followers: st.hiddenSubscriberCount ? null : +st.subscriberCount || 0, views: +st.viewCount || 0, videos: +st.videoCount || 0 };
  const up = ((c.contentDetails || {}).relatedPlaylists || {}).uploads;
  out.media = [];
  if (up) {
    const ids = ((await get("playlistItems?part=contentDetails&maxResults=50&playlistId=" + encodeURIComponent(up))).items || []).map((x) => x.contentDetails.videoId).filter(Boolean);
    if (ids.length) out.media = ((await get("videos?part=snippet,statistics&id=" + ids.join(","))).items || []).map((v) => ({
      net: "youtube", id: v.id, key: "yt:" + v.id, url: "https://www.youtube.com/shorts/" + v.id, at: v.snippet.publishedAt, kind: "short", title: v.snippet.title,
      views: +v.statistics.viewCount || 0, likes: +v.statistics.likeCount || 0, comments: +v.statistics.commentCount || 0 }));
  }
  return out;
}

// Relevé complet. getCred(net) renvoie les identifiants ; prev : relevé précédent (pour l'historique).
export async function collect(env, getCred, prev, today) {
  const s = { updated: new Date().toISOString(), history: (prev && prev.history) || [] };
  const ig = await getCred("instagram");
  if (ig && ig.token && ig.accountId) { try { s.instagram = await instagram(env, ig, prev && prev.instagram); } catch (e) { s.instagram = { error: why(e) }; } }
  const fb = await getCred("facebook");
  if (fb && fb.token && fb.pageId) { try { s.facebook = await facebook(env, fb); } catch (e) { s.facebook = { error: why(e) }; } }
  const yt = await getCred("youtube");
  if (yt && yt.clientId && yt.refreshToken) { try { s.youtube = await youtube(env, yt); } catch (e) { s.youtube = { error: why(e) }; } }
  const point = { d: today };
  if (s.youtube && s.youtube.account) {
    point.yt = s.youtube.account.followers; point.ytViews = s.youtube.account.views;
    // Vues du jour = écart avec le dernier relevé de la veille ou d'avant (la chaîne ne donne qu'un total).
    const last = [...s.history].reverse().find((h) => h.d < today && h.ytViews != null);
    if (last) point.ytViewsDay = Math.max(0, point.ytViews - last.ytViews);
  }
  if (s.instagram && s.instagram.account) { point.ig = s.instagram.account.followers; if (s.instagram.day) { const d = s.instagram.day; point.igReach = d.reach; point.igEng = d.accounts_engaged; point.igViews = d.views; point.igProfile = d.profile_views;
    for (const [k, f] of [["likes", "igLikes"], ["comments", "igComments"], ["shares", "igShares"], ["saves", "igSaves"], ["replies", "igReplies"]]) if (d[k] != null) point[f] = d[k]; } }
  if (s.facebook && s.facebook.account) point.fb = s.facebook.account.followers;
  if (point.ig != null || point.fb != null || point.yt != null || point.ytViews != null) s.history = s.history.filter((h) => h.d !== today).concat(point).slice(-HISTORY_DAYS);
  // Portée des 30 derniers jours : complète les jours sans relevé (le relevé du jour garde la priorité).
  const rd = (s.instagram && s.instagram.reachDaily) || [];
  if (rd.length) {
    const byDay = new Map(s.history.map((h) => [h.d, h]));
    for (const x of rd) { if (x.d >= today) continue; const h = byDay.get(x.d); if (h) { if (h.igReach == null) h.igReach = x.v; } else byDay.set(x.d, { d: x.d, igReach: x.v }); }
    s.history = [...byDay.values()].sort((a, b) => a.d.localeCompare(b.d)).slice(-HISTORY_DAYS);
  }
  return s;
}
