// Pinterest (API v5) : épingle image, carrousel d'images ou vidéo sur un tableau.
// Doc : https://developers.pinterest.com/docs/api/v5/pins-create
// Jeton : application Pinterest (developers.pinterest.com) › jeton d'accès ; avec l'ID et le secret de l'app et le jeton
// de rafraîchissement, PlanneRs renouvelle le jeton tout seul.
import { altOf, isVideo, jsonOrThrow, notConnected, sleep, PublishError, publicUrl } from "./common.js";

export const id = "pinterest";
export const fields = [
  { key: "token", label: "Jeton d'accès (droits pins:write, boards:read)", secret: true },
  { key: "boardId", label: "Identifiant du tableau où épingler" },
  { key: "refreshToken", label: "Jeton de rafraîchissement (facultatif, pour le renouvellement automatique)", secret: true, optional: true },
  { key: "appId", label: "ID de l'application (facultatif, avec le jeton de rafraîchissement)", optional: true },
  { key: "appSecret", label: "Secret de l'application (facultatif)", secret: true, optional: true },
];
const API = "https://api.pinterest.com/v5/";

async function call(cred, method, path, body, save) {
  const go = () => fetch(API + path, { method, headers: { authorization: "Bearer " + cred.token, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  let r = await go();
  if (r.status === 401 && cred.refreshToken && cred.appId && cred.appSecret) {
    const t = await fetch(API + "oauth/token", { method: "POST", headers: { authorization: "Basic " + btoa(cred.appId + ":" + cred.appSecret), "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: cred.refreshToken }) });
    const j = await jsonOrThrow("Pinterest", t);
    cred.token = j.access_token; if (j.refresh_token) cred.refreshToken = j.refresh_token;
    if (save) await save(cred);
    r = await go();
  }
  return jsonOrThrow("Pinterest", r);
}

// Titre public de l'épingle : la première ligne de la légende (100 caractères max), sinon le titre du post.
export function pinTitle(post) {
  const line = String(post.caption || "").split("\n").map((x) => x.replace(/#[\p{L}\p{N}_]+/gu, "").trim()).find(Boolean) || post.title || "";
  return [...line].slice(0, 100).join("");
}
const firstLink = (t) => ((String(t || "").match(/https?:\/\/[^\s<>"')\]]+/) || [""])[0]).replace(/[.,;:!?»]+$/, "");

async function uploadVideo(env, cred, m, save) {
  const reg = await call(cred, "POST", "media", { media_type: "video" }, save);
  const src = await fetch(publicUrl(env, m));
  if (!src.ok) throw new PublishError("Vidéo introuvable à son adresse publique.", { why: "Le fichier ne répond pas (" + src.status + ").", todo: "Vérifie l'hébergement public, puis réessaie." });
  const fd = new FormData();
  Object.entries(reg.upload_parameters || {}).forEach(([k, v]) => fd.append(k, v));
  fd.append("file", new Blob([await src.arrayBuffer()], { type: "video/mp4" }), m.name || "video.mp4");
  const up = await fetch(reg.upload_url, { method: "POST", body: fd });
  if (!up.ok && up.status !== 204) throw new PublishError("Pinterest a refusé l'envoi de la vidéo (" + up.status + ").", { why: "Envoi vers le stockage de Pinterest impossible.", todo: "Réessaie plus tard." });
  for (let i = 0; i < 40; i++) {
    const s = await call(cred, "GET", "media/" + reg.media_id, null, save);
    if (s.status === "succeeded") return reg.media_id;
    if (s.status === "failed") throw new PublishError("Pinterest n'a pas pu traiter la vidéo.", { why: "Format refusé.", todo: "Exporte en MP4 (H.264), entre 4 s et 15 min.", retryable: false });
    await sleep(3000);
  }
  return { pending: reg.media_id };
}

export async function publish(env, post, cred, job, save) {
  if (!cred.token || !cred.boardId) throw notConnected("Pinterest");
  const media = (post.media || []).filter((m) => m.role !== "guide");
  const main = media.filter((m) => m.role !== "cover");
  if (!main.length) throw new PublishError("Aucun média.", { why: "Une épingle demande une image ou une vidéo.", todo: "Ajoute un média au post.", retryable: false });
  const body = { board_id: cred.boardId, title: pinTitle(post), description: [...String(post.caption || "")].slice(0, 800).join("") };
  const link = firstLink(post.caption); if (link) body.link = link;
  const alt = altOf(post, main[0]); if (alt) body.alt_text = alt.slice(0, 500);
  if (isVideo(main[0])) {
    const cover = media.find((m) => m.role === "cover") || media.find((m) => !isVideo(m));
    if (!cover) throw new PublishError("Il manque une image de couverture.", { why: "Pinterest demande une couverture pour une épingle vidéo.", todo: "Ajoute une image (rôle « couverture ») au post.", retryable: false });
    let mid = job && job.media;
    if (!mid) { const r = await uploadVideo(env, cred, main[0], save); if (r && r.pending) return { status: "pending", job: { media: r.pending } }; mid = r; }
    else { const s = await call(cred, "GET", "media/" + mid, null, save); if (s.status !== "succeeded") return { status: "pending", job: { media: mid } }; }
    body.media_source = { source_type: "video_id", media_id: mid, cover_image_url: publicUrl(env, cover) };
  } else if (main.length > 1) {
    body.media_source = { source_type: "multiple_image_urls", items: main.slice(0, 5).map((m) => ({ url: publicUrl(env, m), title: body.title, description: altOf(post, m) || undefined })) };
  } else body.media_source = { source_type: "image_url", url: publicUrl(env, main[0]) };
  const r = await call(cred, "POST", "pins", body, save);
  return { status: "ok", id: r.id, url: "https://www.pinterest.com/pin/" + r.id + "/" };
}

export async function test(env, cred, save) {
  if (!cred.token || !cred.boardId) throw notConnected("Pinterest");
  const me = await call(cred, "GET", "user_account", null, save);
  const b = await call(cred, "GET", "boards/" + encodeURIComponent(cred.boardId), null, save);
  return "@" + (me.username || "?") + " · tableau « " + (b.name || cred.boardId) + " »";
}
