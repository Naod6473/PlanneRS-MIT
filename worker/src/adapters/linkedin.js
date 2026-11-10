// LinkedIn (profil ou page) : jeton OAuth (w_member_social ou w_organization_social) + auteur (URN).
// API « Posts » versionnée. Doc : https://learn.microsoft.com/linkedin/marketing/community-management/shares/posts-api
// Le jeton dure 60 jours : la fiche rappelle de le renouveler.
import { altOf, fetchMedia, jsonOrThrow, httpError, limitText, notConnected, isVideo, PublishError } from "./common.js";

export const id = "linkedin";
export const fields = [
  { key: "token", label: "Jeton d'accès OAuth (w_organization_social pour une page)", secret: true },
  { key: "author", label: "Auteur : urn:li:organization:123456 (page) ou urn:li:person:… (profil)" },
  { key: "version", label: "Version de l'API (AAAAMM, facultatif)", optional: true },
];

const API = "https://api.linkedin.com/rest/";
// LinkedIn n'accepte que les versions récentes (environ un an) : par défaut, celle d'il y a deux mois.
export function defaultVersion(d = new Date()) { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 2, 1)); return x.getUTCFullYear() + String(x.getUTCMonth() + 1).padStart(2, "0"); }
const headers = (cred, extra) => Object.assign({ authorization: "Bearer " + cred.token, "linkedin-version": cred.version || defaultVersion(), "x-restli-protocol-version": "2.0.0" }, extra || {});

// Texte « little text » : caractères réservés échappés, hashtags convertis.
export function littleText(t) {
  return String(t || "").replace(/[\\|{}@\[\]()<>#*_~]/g, (c) => "\\" + c)
    .replace(/(^|\s)\\#([\p{L}\p{N}_]+)/gu, (m, sp, tag) => sp + "{hashtag|\\#|" + tag + "}");
}

async function upload(cred, kind, f) {
  if (kind === "videos") {
    const init = await jsonOrThrow("LinkedIn", await fetch(API + "videos?action=initializeUpload", { method: "POST", headers: headers(cred, { "content-type": "application/json" }), body: JSON.stringify({ initializeUploadRequest: { owner: cred.author, fileSizeBytes: f.bytes.length, uploadCaptions: false, uploadThumbnail: false } }) }));
    const v = init.value, etags = [];
    for (const ins of v.uploadInstructions) {
      const r = await fetch(ins.uploadUrl, { method: "PUT", headers: { "content-type": "application/octet-stream" }, body: f.bytes.subarray(ins.firstByte, ins.lastByte + 1) });
      if (!r.ok) throw httpError("LinkedIn", r.status, await r.text());
      etags.push(r.headers.get("etag"));
    }
    const fin = await fetch(API + "videos?action=finalizeUpload", { method: "POST", headers: headers(cred, { "content-type": "application/json" }), body: JSON.stringify({ finalizeUploadRequest: { video: v.video, uploadToken: v.uploadToken || "", uploadedPartIds: etags } }) });
    if (!fin.ok) throw httpError("LinkedIn", fin.status, await fin.text());
    return v.video;
  }
  const init = await jsonOrThrow("LinkedIn", await fetch(API + kind + "?action=initializeUpload", { method: "POST", headers: headers(cred, { "content-type": "application/json" }), body: JSON.stringify({ initializeUploadRequest: { owner: cred.author } }) }));
  const r = await fetch(init.value.uploadUrl, { method: "PUT", headers: { authorization: "Bearer " + cred.token, "content-type": "application/octet-stream" }, body: f.bytes });
  if (!r.ok) throw httpError("LinkedIn", r.status, await r.text());
  return init.value.image || init.value.document;
}

const isPdf = (m) => /\.pdf$/i.test(m.url || m.name || "") || m.type === "application/pdf";

export async function publish(env, post, cred) {
  if (!cred.token || !cred.author) throw notConnected("LinkedIn");
  limitText("LinkedIn", post.caption || "", 3000);
  const media = (post.media || []).filter((m) => m.role !== "cover" && m.role !== "guide");
  const body = {
    author: cred.author, commentary: littleText(post.caption), visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED", isReshareDisabledByAuthor: false,
  };
  const pdf = media.find(isPdf), vid = media.find(isVideo);
  if (pdf) body.content = { media: { title: post.title || pdf.name || "Document", id: await upload(cred, "documents", await fetchMedia(env, pdf)) } };
  else if (vid) body.content = { media: { title: post.title || "", id: await upload(cred, "videos", await fetchMedia(env, vid)) } };
  else if (media.length === 1) body.content = { media: Object.assign({ id: await upload(cred, "images", await fetchMedia(env, media[0])) }, altOf(post, media[0]) ? { altText: altOf(post, media[0]).slice(0, 300) } : {}) };
  else if (media.length > 1) {
    const images = [];
    for (const m of media.slice(0, 20)) images.push(Object.assign({ id: await upload(cred, "images", await fetchMedia(env, m)) }, altOf(post, m) ? { altText: altOf(post, m).slice(0, 300) } : {}));
    body.content = { multiImage: { images } };
  }
  const r = await fetch(API + "posts", { method: "POST", headers: headers(cred, { "content-type": "application/json" }), body: JSON.stringify(body) });
  if (!r.ok) {
    const t = await r.text();
    if (r.status === 426 || /version/i.test(t)) throw new PublishError("LinkedIn refuse la version de l'API.", { why: t.slice(0, 200), todo: "Indique une version récente (AAAAMM) dans la connexion LinkedIn.", retryable: false });
    throw httpError("LinkedIn", r.status, t);
  }
  const urn = r.headers.get("x-restli-id") || "";
  return { status: "ok", id: urn, url: urn ? "https://www.linkedin.com/feed/update/" + urn + "/" : "" };
}

// LinkedIn n'offre pas de « qui suis-je » sans droits de lecture : 401 = jeton refusé, sinon le jeton est accepté.
export async function test(env, cred) {
  if (!cred.token || !cred.author) throw notConnected("LinkedIn");
  if (!/^urn:li:(organization|person):/.test(cred.author)) throw new PublishError("Auteur invalide.", { why: "L'auteur doit ressembler à urn:li:organization:123456 ou urn:li:person:abc.", retryable: false });
  const r = await fetch("https://api.linkedin.com/v2/userinfo", { headers: { authorization: "Bearer " + cred.token } });
  if (r.status === 401) throw httpError("LinkedIn", 401, await r.text());
  return "Jeton accepté · " + cred.author + " (pense à le renouveler tous les 60 jours)";
}
