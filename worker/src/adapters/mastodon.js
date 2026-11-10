// Mastodon (et compatibles) : adresse de l'instance + jeton d'application.
// Doc : https://docs.joinmastodon.org/methods/statuses/#create
import { altOf, fetchMedia, jsonOrThrow, limitText, notConnected, sleep, PublishError } from "./common.js";

export const id = "mastodon";
export const fields = [
  { key: "instance", label: "Adresse de l'instance (ex. https://mastodon.social)" },
  { key: "token", label: "Jeton d'accès (Préférences › Développement › Nouvelle application, droit write)", secret: true },
];

const base = (cred) => { const u = String(cred.instance || "").trim().replace(/\/$/, ""); return /^https?:\/\//.test(u) ? u : "https://" + u; };

export async function publish(env, post, cred) {
  if (!cred.instance || !cred.token) throw notConnected("Mastodon");
  const auth = { authorization: "Bearer " + cred.token };
  const text = post.caption || "";
  limitText("Mastodon", text, Number(cred.maxChars) || 500);
  const ids = [];
  for (const m of (post.media || []).filter((x) => x.role !== "cover" && x.role !== "guide").slice(0, 4)) {
    const f = await fetchMedia(env, m);
    const fd = new FormData();
    fd.append("file", new Blob([f.bytes], { type: f.type }), f.name);
    if (altOf(post, m)) fd.append("description", altOf(post, m));
    const up = await jsonOrThrow("Mastodon", await fetch(base(cred) + "/api/v2/media", { method: "POST", headers: auth, body: fd }));
    // Les vidéos sont traitées en arrière-plan : on attend que l'adresse soit prête.
    let ready = !!up.url;
    for (let i = 0; !ready && i < 30; i++) {
      await sleep(3000);
      const r = await fetch(base(cred) + "/api/v1/media/" + up.id, { headers: auth });
      if (r.status === 200) ready = true; else if (r.status !== 206) { await jsonOrThrow("Mastodon", r); ready = true; }
    }
    if (!ready) throw new PublishError("Mastodon traite encore le média.", { why: "Le traitement de la vidéo est long.", todo: "Nouvel essai au prochain passage." });
    ids.push(up.id);
  }
  const r = await jsonOrThrow("Mastodon", await fetch(base(cred) + "/api/v1/statuses", {
    method: "POST",
    headers: Object.assign({ "content-type": "application/json", "idempotency-key": "planners-" + post.id + "-" + (post.date || "") + (post.time || "") }, auth),
    body: JSON.stringify({ status: text, media_ids: ids, visibility: "public", language: "fr" }),
  }));
  return { status: "ok", id: r.id, url: r.url || "" };
}

export async function test(env, cred) {
  if (!cred.instance || !cred.token) throw notConnected("Mastodon");
  const me = await jsonOrThrow("Mastodon", await fetch(base(cred) + "/api/v1/accounts/verify_credentials", { headers: { authorization: "Bearer " + cred.token } }));
  return "Connecté à @" + me.acct + " sur " + new URL(base(cred)).host;
}
