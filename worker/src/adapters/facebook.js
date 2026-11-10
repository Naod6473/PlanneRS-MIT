// Publication sur une Page Facebook (souvent en relais d'Instagram).
// Doc : https://developers.facebook.com/docs/pages-api/
import { graph, isVideo, publicUrl, PublishError } from "./meta.js";

export const id = "facebook";
export const fields = [
  { key: "token", label: "Jeton de la Page (ou d'un utilisateur qui la gère)", secret: true },
  { key: "pageId", label: "Identifiant de la Page" },
];

export async function pageToken(env, cred) {
  const me = await graph(env, "GET", "me", { fields: "id" }, cred.token);
  if (me.id === cred.pageId) return cred.token;
  let r = await graph(env, "GET", cred.pageId, { fields: "access_token" }, cred.token).catch(() => ({}));
  if (!r.access_token) {
    // Jeton utilisateur : on cherche la Page dans la liste des Pages gérées.
    const list = await graph(env, "GET", "me/accounts", { fields: "id,name,access_token", limit: 100 }, cred.token).catch(() => ({ data: [] }));
    r = (list.data || []).find((x) => x.id === String(cred.pageId)) || {};
  }
  if (!r.access_token) throw new PublishError("Pas d'accès à la Page.", { why: "Ce jeton ne donne pas accès à la Page " + cred.pageId + ". Utilise le jeton de la Page (champ access_token de me/accounts).", todo: "Reconnecte Facebook avec un compte qui gère la Page." });
  return r.access_token;
}
const link = async (env, objId, tok) => {
  try { const r = await graph(env, "GET", objId, { fields: "permalink_url" }, tok); const u = r.permalink_url || ""; return u.startsWith("/") ? "https://www.facebook.com" + u : u; }
  catch (e) { return "https://www.facebook.com/" + objId; }
};

export async function publish(env, post, cred) {
  if (!cred.token || !cred.pageId) throw new PublishError("Page Facebook pas connectée.", { why: "Il manque le jeton ou l'identifiant de la Page.", todo: "Connecte la Page dans Réglages › Comptes.", retryable: false });
  const tok = await pageToken(env, cred);
  const page = cred.pageId, msg = post.caption || "", media = post.media || [];
  if (post.format === "text" || !media.length) {
    const r = await graph(env, "POST", page + "/feed", { message: msg }, tok);
    return { status: "ok", id: r.id, url: await link(env, r.id, tok) };
  }
  if (post.format === "story") {
    if (isVideo(media[0])) throw new PublishError("Story vidéo non gérée sur Facebook.", { why: "Seules les stories photo sont prises en charge.", todo: "Poste la story vidéo à la main.", retryable: false });
    const ph = await graph(env, "POST", page + "/photos", { url: publicUrl(env, media[0]), published: "false" }, tok);
    const r = await graph(env, "POST", page + "/photo_stories", { photo_id: ph.id }, tok);
    return { status: "ok", id: r.post_id, url: "https://www.facebook.com/" + page };
  }
  if (isVideo(media[0])) {
    const r = await graph(env, "POST", page + "/videos", { file_url: publicUrl(env, media[0]), description: msg }, tok);
    return { status: "ok", id: r.id, url: await link(env, r.id, tok) };
  }
  const photos = media.filter((m) => !isVideo(m));
  if (photos.length === 1) {
    const r = await graph(env, "POST", page + "/photos", { url: publicUrl(env, photos[0]), message: msg }, tok);
    return { status: "ok", id: r.post_id || r.id, url: await link(env, r.post_id || r.id, tok) };
  }
  const ids = [];
  for (const m of photos) ids.push((await graph(env, "POST", page + "/photos", { url: publicUrl(env, m), published: "false" }, tok)).id);
  const params = { message: msg };
  ids.forEach((x, i) => { params["attached_media[" + i + "]"] = JSON.stringify({ media_fbid: x }); });
  const r = await graph(env, "POST", page + "/feed", params, tok);
  return { status: "ok", id: r.id, url: await link(env, r.id, tok) };
}

// Premier commentaire, posté par la Page juste après la publication (droit pages_manage_engagement).
export async function comment(env, objId, text, cred) {
  const tok = await pageToken(env, cred);
  await graph(env, "POST", objId + "/comments", { message: text }, tok);
}

export async function test(env, cred) {
  const tok = await pageToken(env, cred);
  const r = await graph(env, "GET", cred.pageId, { fields: "name" }, tok);
  return "Connecté à la Page « " + r.name + " »";
}
