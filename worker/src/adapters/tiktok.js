// TikTok : envoi d'une vidéo par la Content Posting API.
// Doc : https://developers.tiktok.com/doc/content-posting-api-get-started
// Connexion : une app sur developers.tiktok.com (Login Kit + Content Posting API), sa « Client key » et son
// « Client secret », puis « Autoriser avec TikTok ». Le jeton d'accès dure 24 h ; il est renouvelé tout seul.
// Deux modes :
//   brouillon (défaut) : la vidéo arrive dans la boîte de réception TikTok, tu appuies sur Publier dans l'appli ;
//   direct : la vidéo est publiée. Tant que TikTok n'a pas audité l'app, seule la visibilité « privé » est permise.
// L'envoi de la vidéo est fait en plusieurs morceaux si besoin ; TikTok la traite ensuite (état vérifié au passage suivant).
import { fetchMedia, isVideo, notConnected, PublishError } from "./common.js";

export const id = "tiktok";
export const SCOPE = "user.info.basic,video.upload,video.publish";
const API = "https://open.tiktokapis.com/v2/";
export const fields = [
  { key: "clientKey", label: "Client key de l'app TikTok" },
  { key: "clientSecret", label: "Client secret", secret: true },
  { key: "mode", label: "Mode : brouillon (la vidéo arrive dans l'appli, tu publies toi-même) ou direct (facultatif, brouillon par défaut)", optional: true },
  { key: "privacy", label: "En direct, visibilité : public, amis, abonnés ou privé (facultatif, public par défaut)", optional: true },
];

export const redirectUri = (origin) => origin + "/api/oauth/tiktok/callback";
export const isDirect = (cred) => /^direct/i.test(String((cred && cred.mode) || "").trim());
const PRIVACY = { public: "PUBLIC_TO_EVERYONE", amis: "MUTUAL_FOLLOW_FRIENDS", abonnes: "FOLLOWER_OF_CREATOR", "abonnés": "FOLLOWER_OF_CREATOR", prive: "SELF_ONLY", "privé": "SELF_ONLY" };
export const privacyOf = (cred) => { const v = String((cred && cred.privacy) || "").trim(); return PRIVACY[v.toLowerCase()] || (/^[A-Z_]+$/.test(v) ? v : "PUBLIC_TO_EVERYONE"); };

export function authUrl(cred, origin, state) {
  const q = new URLSearchParams({ client_key: cred.clientKey, redirect_uri: redirectUri(origin), state, response_type: "code", scope: SCOPE });
  return "https://www.tiktok.com/v2/auth/authorize/?" + q;
}

// Découpage imposé par TikTok : un seul morceau jusqu'à 64 Mo, sinon des morceaux de 10 Mo, le dernier prenant le reste.
export function chunks(size) {
  const MB = 1024 * 1024;
  if (size <= 64 * MB) return { chunk_size: size, total_chunk_count: 1 };
  const c = 10 * MB;
  return { chunk_size: c, total_chunk_count: Math.floor(size / c) };
}
export function ranges(size, plan) {
  const out = [];
  for (let i = 0; i < plan.total_chunk_count; i++) {
    const start = i * plan.chunk_size, end = i === plan.total_chunk_count - 1 ? size - 1 : start + plan.chunk_size - 1;
    out.push([start, end]);
  }
  return out;
}
// Légende TikTok : 2 200 caractères au plus.
export const ttTitle = (post) => [...String(post.caption || post.title || "")].slice(0, 2200).join("");

function fail(what, why, todo, retryable = false, code = "") { return new PublishError(what, { why, todo, retryable, code }); }

async function call(path, token, body) {
  const r = await fetch(API + path, { method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json; charset=UTF-8" }, body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => ({}));
  const e = j.error || {};
  if (!r.ok || (e.code && e.code !== "ok")) throw explain(r.status, e.code || "", e.message || "");
  return j.data || {};
}
export function explain(status, code, msg) {
  const why = (msg || code || String(status)).slice(0, 300);
  if (code === "access_token_invalid" || status === 401) return fail("TikTok : connexion expirée.", why, "Refais « Autoriser avec TikTok » dans Réglages › Comptes › TikTok.", false, code);
  if (code === "scope_not_authorized") return fail("TikTok : autorisation manquante.", why, "Dans l'app TikTok (portail développeur), ajoute Content Posting API, puis refais « Autoriser avec TikTok ».", false, code);
  if (code === "unaudited_client_can_only_post_to_private_accounts" || code === "privacy_level_option_mismatch") return fail("TikTok refuse cette visibilité.", why + " Tant que l'app n'est pas auditée par TikTok, une publication directe doit être privée.", "Passe le mode en « brouillon » (ou la visibilité en « privé ») dans Réglages › Comptes › TikTok.", false, code);
  if (code === "spam_risk_too_many_pending_share" || code === "spam_risk_too_many_posts" || code === "rate_limit_exceeded" || status === 429) return fail("TikTok : limite d'envois atteinte.", why + " (5 brouillons en attente au plus sur 24 h.)", "Publie ou supprime les brouillons en attente dans l'appli, puis réessaie plus tard.", true, code);
  if (status >= 500) return fail("TikTok ne répond pas (" + status + ").", why, "Nouvel essai au prochain passage.", true, code);
  return fail("TikTok a refusé la demande.", why, "Vérifie la vidéo (MP4, 3 s à 10 min) et la connexion, puis réessaie.", false, code);
}

async function tokenCall(form) {
  const r = await fetch(API + "oauth/token/", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(form) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw fail("TikTok refuse l'autorisation.", j.error_description || j.error || String(r.status), "Refais « Autoriser avec TikTok » dans Réglages › Comptes › TikTok.");
  return j;
}
function keep(cred, j, now) {
  cred.accessToken = j.access_token;
  cred.expiresAt = now + Math.max(60, (+j.expires_in || 86400) - 300) * 1000;
  if (j.refresh_token) cred.refreshToken = j.refresh_token;
  if (j.scope) cred.scope = j.scope;
  return cred;
}

// Code reçu au retour de TikTok -> jetons rangés dans cred.
export async function exchange(cred, origin, code) {
  return keep(cred, await tokenCall({ client_key: cred.clientKey, client_secret: cred.clientSecret, code, grant_type: "authorization_code", redirect_uri: redirectUri(origin) }), Date.now());
}

async function token(cred, saveCred) {
  if (!cred.refreshToken) throw Object.assign(fail("Étape 2 : autorise l'accès.", "Clique sur « Autoriser avec TikTok » pour terminer."), { pending: true });
  if (cred.accessToken && +cred.expiresAt > Date.now()) return cred.accessToken;
  keep(cred, await tokenCall({ client_key: cred.clientKey, client_secret: cred.clientSecret, grant_type: "refresh_token", refresh_token: cred.refreshToken }), Date.now());
  if (saveCred) await saveCred(cred);
  return cred.accessToken;
}

const postUrl = (cred, id) => (cred.username ? "https://www.tiktok.com/@" + cred.username + "/video/" + id : "https://www.tiktok.com/video/" + id);

// Suivi d'un envoi : TikTok traite la vidéo, on regarde où il en est au passage suivant (une heure au plus).
async function check(cred, t, job) {
  const d = await call("post/publish/status/fetch/", t, { publish_id: job.publishId });
  const st = d.status || "";
  if (st === "FAILED") throw fail("TikTok n'a pas pu traiter la vidéo.", d.fail_reason || "Échec du traitement.", "Vérifie la vidéo (MP4 H.264, 3 s à 10 min), puis réessaie.", false, d.fail_reason || "FAILED");
  if (st === "SEND_TO_USER_INBOX") return { status: "ok", id: job.publishId, url: "", draft: true };
  if (st === "PUBLISH_COMPLETE") {
    const pid = (d.publicaly_available_post_id || d.publicly_available_post_id || [])[0];
    return { status: "ok", id: String(pid || job.publishId), url: pid ? postUrl(cred, pid) : "", draft: false };
  }
  if (Date.now() - (job.at || 0) > 60 * 60000) throw fail("TikTok traite la vidéo depuis plus d'une heure.", "État : " + (st || "inconnu") + ".", "Regarde dans l'appli TikTok si elle est arrivée avant de relancer, pour éviter un doublon.");
  return { status: "pending", job };
}

export async function publish(env, post, cred, job, saveCred) {
  if (!cred || !cred.clientKey || !cred.clientSecret) throw notConnected("TikTok");
  const t = await token(cred, saveCred);
  if (job && job.publishId) return check(cred, t, job);
  const vid = (post.media || []).find((m) => isVideo(m) && m.role !== "guide");
  if (!vid) throw fail("Aucune vidéo.", "Ce connecteur TikTok publie des vidéos seulement.", "Ajoute une vidéo au post, ou retire TikTok de ses réseaux (les carrousels se postent à la main).");
  const f = await fetchMedia(env, vid), size = f.bytes.length, plan = chunks(size);
  const source_info = Object.assign({ source: "FILE_UPLOAD", video_size: size }, plan);
  let d;
  if (isDirect(cred)) {
    const want = privacyOf(cred);
    const info = await call("post/publish/creator_info/query/", t, {});
    const opts = info.privacy_level_options || [];
    if (opts.length && !opts.includes(want)) throw fail("TikTok refuse la visibilité « " + want + " ».", "Visibilités permises pour ce compte : " + opts.join(", ") + ". Tant que l'app n'est pas auditée, seule SELF_ONLY (privé) l'est.", "Passe le mode en « brouillon », ou la visibilité en « privé », dans Réglages › Comptes › TikTok.", false, "privacy_level_option_mismatch");
    d = await call("post/publish/video/init/", t, { post_info: { title: ttTitle(post), privacy_level: want, disable_duet: false, disable_comment: false, disable_stitch: false, video_cover_timestamp_ms: 1000 }, source_info });
  } else d = await call("post/publish/inbox/video/init/", t, { source_info });
  if (!d.publish_id || !d.upload_url) throw fail("TikTok n'a pas ouvert l'envoi.", "Réponse sans adresse d'envoi.", "Réessaie au prochain passage.", true);
  for (const [a, b] of ranges(size, plan)) {
    const up = await fetch(d.upload_url, { method: "PUT", headers: { "content-type": f.type && /^video\//.test(f.type) ? f.type : "video/mp4", "content-length": String(b - a + 1), "content-range": "bytes " + a + "-" + b + "/" + size }, body: f.bytes.subarray(a, b + 1) });
    if (![200, 201, 206].includes(up.status)) throw fail("L'envoi de la vidéo vers TikTok a échoué (" + up.status + ").", "Morceau " + a + "-" + b + " refusé.", "Nouvel essai au prochain passage.", up.status >= 500 || up.status === 429, String(up.status));
  }
  return { status: "pending", job: { publishId: d.publish_id, at: Date.now() } };
}

export async function test(env, cred, saveCred) {
  if (!cred || !cred.clientKey || !cred.clientSecret) throw notConnected("TikTok");
  const t = await token(cred, saveCred);
  const r = await fetch(API + "user/info/?fields=open_id,display_name,username", { headers: { authorization: "Bearer " + t } });
  const j = await r.json().catch(() => ({}));
  const e = j.error || {};
  if (!r.ok || (e.code && e.code !== "ok")) throw explain(r.status, e.code || "", e.message || "");
  const u = (j.data || {}).user || {};
  if (u.username && u.username !== cred.username) { cred.username = u.username; if (saveCred) await saveCred(cred); }
  const scopes = String(cred.scope || "");
  const warn = scopes && !/video\.upload/.test(scopes) ? " (droit video.upload absent : ajoute Content Posting API à l'app)" : "";
  return "Compte « " + (u.display_name || u.username || "TikTok") + " »" + (u.username ? " (@" + u.username + ")" : "") + (isDirect(cred) ? ", publication directe" : ", envoi en brouillon") + warn;
}
