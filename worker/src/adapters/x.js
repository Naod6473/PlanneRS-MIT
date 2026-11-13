// X (Twitter) : clés OAuth 1.0a de l'application + jeton d'accès de l'utilisateur (droits « Read and write »).
// Les jetons OAuth 1.0a n'expirent pas. Doc : https://docs.x.com/x-api/posts/manage-tweets/introduction
import { altOf, fetchMedia, jsonOrThrow, limitText, threadOf, replies, notConnected, isVideo, sleep, PublishError } from "./common.js";

export const id = "x";
export const fields = [
  { key: "apiKey", label: "API Key (clé de l'application)" },
  { key: "apiSecret", label: "API Key Secret", secret: true },
  { key: "accessToken", label: "Access Token (droits Read and write)" },
  { key: "accessSecret", label: "Access Token Secret", secret: true },
];

const API = "https://api.x.com/2/";
const pct = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

// Signature OAuth 1.0a (HMAC-SHA1). Seuls les paramètres d'adresse sont signés (corps JSON ou multipart : non).
export async function oauthHeader(cred, method, url, nonce, timestamp) {
  const u = new URL(url);
  const o = {
    oauth_consumer_key: cred.apiKey, oauth_nonce: nonce || crypto.randomUUID().replace(/-/g, ""),
    oauth_signature_method: "HMAC-SHA1", oauth_timestamp: String(timestamp || Math.floor(Date.now() / 1000)),
    oauth_token: cred.accessToken, oauth_version: "1.0",
  };
  const params = [...Object.entries(o), ...u.searchParams.entries()].map(([k, v]) => [pct(k), pct(v)]).sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1));
  const baseStr = method.toUpperCase() + "&" + pct(u.origin + u.pathname) + "&" + pct(params.map(([k, v]) => k + "=" + v).join("&"));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pct(cred.apiSecret) + "&" + pct(cred.accessSecret)), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(baseStr)))));
  o.oauth_signature = sig;
  return "OAuth " + Object.entries(o).map(([k, v]) => pct(k) + '="' + pct(v) + '"').join(", ");
}

async function call(cred, method, path, { json, form } = {}) {
  const url = API + path;
  const headers = { authorization: await oauthHeader(cred, method, url) };
  let body;
  if (json) { headers["content-type"] = "application/json"; body = JSON.stringify(json); }
  if (form) body = form;
  return jsonOrThrow("X", await fetch(url, { method, headers, body }));
}

async function uploadImage(cred, f) {
  const fd = new FormData();
  fd.append("media", new Blob([f.bytes], { type: f.type }), f.name);
  fd.append("media_category", "tweet_image");
  const r = await call(cred, "POST", "media/upload", { form: fd });
  return (r.data && r.data.id) || r.media_id_string;
}

async function uploadVideo(cred, f) {
  const init = await call(cred, "POST", "media/upload/initialize", { json: { media_type: f.type || "video/mp4", total_bytes: f.bytes.length, media_category: "tweet_video" } });
  const mid = init.data.id;
  const CHUNK = 4 * 1024 * 1024;
  for (let i = 0, k = 0; i < f.bytes.length; i += CHUNK, k++) {
    const fd = new FormData();
    fd.append("media", new Blob([f.bytes.subarray(i, i + CHUNK)], { type: "application/octet-stream" }), "part" + k);
    fd.append("segment_index", String(k));
    await call(cred, "POST", "media/upload/" + mid + "/append", { form: fd });
  }
  let info = (await call(cred, "POST", "media/upload/" + mid + "/finalize")).data.processing_info;
  for (let i = 0; info && info.state !== "succeeded" && i < 40; i++) {
    if (info.state === "failed") throw new PublishError("X n'a pas pu traiter la vidéo.", { why: (info.error && info.error.message) || "Traitement échoué.", todo: "Vérifie le format (MP4 H.264, 2 min 20 max), puis réessaie.", retryable: false });
    await sleep(Math.min((info.check_after_secs || 3) * 1000, 10000));
    info = (await call(cred, "GET", "media/upload?command=STATUS&media_id=" + mid)).data.processing_info;
  }
  if (info && info.state !== "succeeded") throw new PublishError("X traite encore la vidéo.", { why: "Traitement long.", todo: "Nouvel essai au prochain passage." });
  return mid;
}

export async function publish(env, post, cred) {
  if (!cred.apiKey || !cred.apiSecret || !cred.accessToken || !cred.accessSecret) throw notConnected("X");
  const parts = threadOf(post.caption), text = parts[0];
  parts.forEach((t) => limitText("X", t, Number(cred.maxChars) || 280));
  const media = (post.media || []).filter((m) => m.role !== "cover" && m.role !== "guide");
  const ids = [];
  if (media.some(isVideo)) ids.push(await uploadVideo(cred, await fetchMedia(env, media.find(isVideo))));
  else for (const m of media.slice(0, 4)) {
    const mid = await uploadImage(cred, await fetchMedia(env, m));
    ids.push(mid);
    // Texte alternatif : facultatif, un refus ne bloque pas la publication.
    if (altOf(post, m)) { try { await call(cred, "POST", "media/metadata", { json: { id: mid, metadata: { alt_text: { text: altOf(post, m).slice(0, 1000) } } } }); } catch (e) { /* sans texte alternatif */ } }
  }
  const body = { text };
  if (ids.length) body.media = { media_ids: ids };
  const r = await call(cred, "POST", "tweets", { json: body });
  const more = await replies("X", parts, r.data.id, async (t, prev) => (await call(cred, "POST", "tweets", { json: { text: t, reply: { in_reply_to_tweet_id: prev } } })).data.id);
  return Object.assign({ status: "ok", id: r.data.id, url: "https://x.com/i/status/" + r.data.id }, more);
}

export async function test(env, cred) {
  if (!cred.apiKey || !cred.accessToken) throw notConnected("X");
  const me = await call(cred, "GET", "users/me");
  return "Connecté à @" + me.data.username;
}
