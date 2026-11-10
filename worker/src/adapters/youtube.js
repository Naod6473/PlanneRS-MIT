// YouTube (Shorts) : envoi d'une vidéo verticale de moins de 3 minutes par l'API YouTube Data v3.
// Doc : https://developers.google.com/youtube/v3/docs/videos/insert
// Connexion : un client OAuth Google (Application Web) puis « Autoriser avec Google » (droit youtube.upload).
// Quota : un envoi coûte 1 600 unités sur 10 000 par jour par défaut, soit environ 6 vidéos par jour.
import { fetchMedia, isVideo, notConnected, PublishError } from "./common.js";

export const id = "youtube";
export const SCOPE = "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly";
export const fields = [
  { key: "clientId", label: "ID client OAuth (Application Web)" },
  { key: "clientSecret", label: "Code secret du client", secret: true },
  { key: "privacy", label: "Visibilité : public, unlisted (non répertoriée) ou private (facultatif, public par défaut)", optional: true },
];

async function token(cred) {
  if (!cred.refreshToken) throw Object.assign(new PublishError("Étape 2 : autorise l'accès.", { why: "Clique sur « Autoriser avec Google » pour terminer.", retryable: false }), { pending: true });
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: cred.clientId, client_secret: cred.clientSecret, refresh_token: cred.refreshToken, grant_type: "refresh_token" }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new PublishError("Google refuse l'autorisation YouTube.", { why: j.error_description || j.error || String(r.status), todo: "Refais « Autoriser avec Google » dans Réglages › Comptes › YouTube.", retryable: false });
  return j.access_token;
}

export function ytTitle(post) {
  const line = String(post.caption || "").split("\n").map((x) => x.trim()).find((x) => x && !/^#/.test(x)) || post.title || "Vidéo";
  return [...line.replace(/[<>]/g, "")].slice(0, 100).join("");
}

export async function publish(env, post, cred) {
  if (!cred.clientId || !cred.clientSecret) throw notConnected("YouTube");
  const vid = (post.media || []).find((m) => isVideo(m) && m.role !== "guide");
  if (!vid) throw new PublishError("Aucune vidéo.", { why: "YouTube ne publie que des vidéos.", todo: "Ajoute une vidéo au post, ou retire YouTube de ses réseaux.", retryable: false });
  const t = await token(cred);
  const f = await fetchMedia(env, vid);
  const tags = (String(post.caption || "").match(/#[\p{L}\p{N}_]+/gu) || []).map((h) => h.slice(1)).slice(0, 15);
  const meta = { snippet: { title: ytTitle(post), description: [...String(post.caption || "").replace(/[<>]/g, "")].slice(0, 5000).join(""), tags, categoryId: "22" },
    status: { privacyStatus: ["public", "unlisted", "private"].includes(cred.privacy) ? cred.privacy : "public", selfDeclaredMadeForKids: false } };
  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST", headers: { authorization: "Bearer " + t, "content-type": "application/json; charset=UTF-8", "x-upload-content-type": f.type || "video/mp4", "x-upload-content-length": String(f.bytes.length) }, body: JSON.stringify(meta) });
  if (!init.ok) {
    const j = await init.json().catch(() => ({})), reason = (((j.error || {}).errors || [])[0] || {}).reason || "";
    if (reason === "quotaExceeded" || reason === "uploadLimitExceeded") throw new PublishError("Limite d'envois YouTube atteinte pour aujourd'hui.", { code: reason, why: "Le quota quotidien de l'API est épuisé.", todo: "Reprogramme à demain." });
    throw new PublishError("YouTube a refusé l'envoi (" + init.status + ").", { code: String(init.status), why: (j.error && j.error.message) || "Réponse inattendue.", todo: "Vérifie l'autorisation et la vidéo, puis réessaie.", retryable: init.status >= 500 });
  }
  const up = await fetch(init.headers.get("location"), { method: "PUT", headers: { "content-type": f.type || "video/mp4" }, body: f.bytes });
  const j = await up.json().catch(() => ({}));
  if (!up.ok || !j.id) throw new PublishError("L'envoi de la vidéo a échoué (" + up.status + ").", { why: (j.error && j.error.message) || "Envoi interrompu.", todo: "Nouvel essai au prochain passage." });
  return { status: "ok", id: j.id, url: "https://www.youtube.com/shorts/" + j.id };
}

export async function test(env, cred) {
  if (!cred.clientId || !cred.clientSecret) throw notConnected("YouTube");
  const t = await token(cred);
  const r = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { authorization: "Bearer " + t } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new PublishError("YouTube : accès refusé (" + r.status + ").", { why: (j.error && j.error.message) || "", retryable: false });
  const c = (j.items || [])[0];
  return c ? "Chaîne « " + c.snippet.title + " »" : "Aucune chaîne sur ce compte";
}
