// Threads (Meta) : jeton d'accès Threads. Les médias sont récupérés par Meta via leur adresse publique, comme Instagram.
// Doc : https://developers.facebook.com/docs/threads/posts
import { jsonOrThrow, limitText, threadOf, replies, notConnected, publicUrl, isVideo, sleep, PublishError } from "./common.js";

export const id = "threads";
export const fields = [
  { key: "token", label: "Jeton d'accès Threads (longue durée, droits threads_basic + threads_content_publish)", secret: true },
  { key: "userId", label: "Identifiant de l'utilisateur Threads (facultatif, sinon « me »)", optional: true },
];

const API = "https://graph.threads.net/v1.0/";

async function call(method, path, params, token) {
  const url = new URL(API + path);
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) if (v != null) (method === "GET" ? url.searchParams : body).set(k, String(v));
  return jsonOrThrow("Threads", await fetch(url, { method, headers: { authorization: "Bearer " + token }, body: method === "GET" ? undefined : body }));
}

async function waitReady(id, token) {
  for (let i = 0; i < 30; i++) {
    const s = await call("GET", id, { fields: "status,error_message" }, token);
    if (s.status === "FINISHED" || s.status === "PUBLISHED") return true;
    if (s.status === "ERROR" || s.status === "EXPIRED") throw new PublishError("Threads n'a pas pu préparer le média.", { why: s.error_message || s.status, todo: "Vérifie le fichier, puis réessaie." });
    await sleep(5000);
  }
  return false;
}

const item = (env, m, carousel) => Object.assign(isVideo(m) ? { media_type: "VIDEO", video_url: publicUrl(env, m) } : { media_type: "IMAGE", image_url: publicUrl(env, m) }, carousel ? { is_carousel_item: "true" } : {});

export async function publish(env, post, cred, job) {
  if (!cred.token) throw notConnected("Threads");
  const uid = cred.userId || "me", tok = cred.token;
  const parts = threadOf(post.caption), text = parts[0];
  parts.forEach((t) => limitText("Threads", t, 500));
  let container = job && job.container;
  if (!container) {
    const media = (post.media || []).filter((m) => m.role !== "cover" && m.role !== "guide").slice(0, 20);
    if (media.length > 1) {
      const kids = [];
      for (const m of media) { const c = (await call("POST", uid + "/threads", item(env, m, true), tok)).id; await waitReady(c, tok); kids.push(c); }
      container = (await call("POST", uid + "/threads", { media_type: "CAROUSEL", children: kids.join(","), text }, tok)).id;
    } else if (media.length === 1) {
      container = (await call("POST", uid + "/threads", Object.assign(item(env, media[0], false), { text }), tok)).id;
    } else {
      container = (await call("POST", uid + "/threads", { media_type: "TEXT", text }, tok)).id;
    }
  }
  if (!(await waitReady(container, tok))) return { status: "pending", job: { container } };
  const pub = await call("POST", uid + "/threads_publish", { creation_id: container }, tok);
  let url = "";
  try { url = (await call("GET", pub.id, { fields: "permalink" }, tok)).permalink || ""; } catch (e) { /* lien facultatif */ }
  const more = await replies("Threads", parts, pub.id, async (t, prev) => {
    const c = (await call("POST", uid + "/threads", { media_type: "TEXT", text: t, reply_to_id: prev }, tok)).id;
    await waitReady(c, tok);
    return (await call("POST", uid + "/threads_publish", { creation_id: c }, tok)).id;
  });
  return Object.assign({ status: "ok", id: pub.id, url }, more);
}

export async function test(env, cred) {
  if (!cred.token) throw notConnected("Threads");
  const me = await call("GET", cred.userId || "me", { fields: "username" }, cred.token);
  return "Connecté à @" + me.username;
}
