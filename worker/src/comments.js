// Commentaires Instagram dans PlanneRs : lire les commentaires récents, voir ceux sans réponse, répondre.
// Droit Meta nécessaire : instagram_manage_comments (sinon l'API répond « autorisation manquante »).
import { graph } from "./adapters/meta.js";
import { mediaKey } from "./stats.js";

const FIELDS = "id,text,username,timestamp,like_count,replies{id,text,username,timestamp}";

// Commentaires des publications récentes qui en ont. max : nombre de publications lues.
export async function fetchRecent(env, cred, max = 12) {
  const me = await graph(env, "GET", cred.accountId, { fields: "username" }, cred.token);
  const list = await graph(env, "GET", cred.accountId + "/media", { fields: "id,permalink,timestamp,caption,comments_count,media_product_type,media_type", limit: 25 }, cred.token);
  const media = (list.data || []).filter((m) => m.comments_count > 0).slice(0, max);
  const out = [];
  for (const m of media) {
    const r = await graph(env, "GET", m.id + "/comments", { fields: FIELDS, limit: 50 }, cred.token);
    out.push({ media: { id: m.id, url: m.permalink, at: m.timestamp, caption: (m.caption || "").slice(0, 300) }, comments: (r.data || []) });
  }
  return shape(out, me.username);
}

// Liste à plat, la plus récente d'abord. answered : le compte a déjà répondu (ou le commentaire est le sien).
export function shape(groups, username) {
  const own = String(username || "").toLowerCase(), list = [];
  for (const g of groups) for (const c of g.comments) {
    const replies = (c.replies && c.replies.data) || [];
    const mine = String(c.username || "").toLowerCase() === own;
    if (mine) continue;
    list.push({ id: c.id, text: c.text || "", user: c.username || "", at: c.timestamp, likes: c.like_count || 0,
      media: g.media.id, url: g.media.url, key: mediaKey(g.media.url), caption: g.media.caption,
      replies: replies.map((x) => ({ id: x.id, text: x.text, user: x.username, at: x.timestamp, mine: String(x.username || "").toLowerCase() === own })),
      answered: replies.some((x) => String(x.username || "").toLowerCase() === own) });
  }
  return { username, at: new Date().toISOString(), comments: list.sort((a, b) => String(b.at).localeCompare(String(a.at))) };
}

export async function reply(env, cred, commentId, text) {
  const r = await graph(env, "POST", commentId + "/replies", { message: text }, cred.token);
  return r && r.id;
}
