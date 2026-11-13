// Publication Instagram par l'API Graph (compte pro relié à une Page Facebook).
// Doc : https://developers.facebook.com/docs/instagram-platform/content-publishing
import { graph, sleep, isVideo, publicUrl, PublishError } from "./meta.js";
import { altOf } from "./common.js";

export const id = "instagram";
export const fields = [
  { key: "token", label: "Jeton d'accès (utilisateur système ou Page)", secret: true },
  { key: "accountId", label: "Identifiant du compte Instagram pro" },
  { key: "pageId", label: "Identifiant de la Page Facebook liée (facultatif : sert aussi au relais Facebook)", optional: true },
];

async function waitReady(env, container, token, maxMs) {
  const end = Date.now() + maxMs;
  while (Date.now() < end) {
    const s = await graph(env, "GET", container, { fields: "status_code,status" }, token);
    if (s.status_code === "FINISHED") return true;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED")
      throw new PublishError("Instagram n'a pas pu préparer le média.", { why: s.status || "Le traitement du média a échoué.", todo: "Vérifie le fichier (format, taille), puis réessaie." });
    await sleep(5000);
  }
  return false;
}

// Renvoie { status: "ok", url } ou { status: "pending", job } si le média n'est pas encore prêt.
export async function publish(env, post, cred, job) {
  const token = cred.token, acc = cred.accountId;
  if (!token || !acc) throw new PublishError("Compte Instagram pas connecté.", { why: "Il manque le jeton ou l'identifiant du compte.", todo: "Connecte Instagram dans Réglages › Comptes.", retryable: false });
  let container = job && job.container;
  if (!container) {
    const media = post.media || [];
    if (!media.length) throw new PublishError("Aucun média.", { why: "Instagram exige une image ou une vidéo.", todo: "Ajoute un média au post.", retryable: false });
    const caption = post.caption || "";
    // Texte alternatif des images (alt_text) : si l'API le refuse, on recrée le conteneur sans lui.
    const make = async (p, m) => { const alt = !isVideo(m) && altOf(post, m); if (!alt) return (await graph(env, "POST", acc + "/media", p, token)).id; try { return (await graph(env, "POST", acc + "/media", Object.assign({ alt_text: alt.slice(0, 1000) }, p), token)).id; } catch (e) { if (e.code === "190") throw e; return (await graph(env, "POST", acc + "/media", p, token)).id; } };
    if (post.format === "story") {
      const m = media[0];
      container = (await graph(env, "POST", acc + "/media", { media_type: "STORIES", [isVideo(m) ? "video_url" : "image_url"]: publicUrl(env, m) }, token)).id;
    } else if (post.format === "carousel" && media.length > 1) {
      const kids = [];
      for (const m of media.slice(0, 10)) {
        const p = isVideo(m) ? { media_type: "VIDEO", video_url: publicUrl(env, m), is_carousel_item: "true" } : { image_url: publicUrl(env, m), is_carousel_item: "true" };
        const c = await make(p, m);
        if (isVideo(m)) await waitReady(env, c, token, 120000);
        kids.push(c);
      }
      container = (await graph(env, "POST", acc + "/media", { media_type: "CAROUSEL", children: kids.join(","), caption }, token)).id;
    } else if (isVideo(media[0]) || post.format === "reel" || post.format === "video") {
      const cover = media.find((m) => m.role === "cover");
      container = (await graph(env, "POST", acc + "/media", { media_type: "REELS", video_url: publicUrl(env, media[0]), caption, share_to_feed: "true", cover_url: cover ? publicUrl(env, cover) : undefined }, token)).id;
    } else {
      container = await make({ image_url: publicUrl(env, media[0]), caption }, media[0]);
    }
  }
  const ready = await waitReady(env, container, token, 150000);
  if (!ready) return { status: "pending", job: { container } };
  const pub = await graph(env, "POST", acc + "/media_publish", { creation_id: container }, token);
  let url = "";
  try { url = (await graph(env, "GET", pub.id, { fields: "permalink" }, token)).permalink || ""; } catch (e) { /* lien facultatif */ }
  return { status: "ok", id: pub.id, url };
}

// Premier commentaire sous la publication (droit instagram_manage_comments).
export async function comment(env, mediaId, text, cred) {
  await graph(env, "POST", mediaId + "/comments", { message: text }, cred.token);
}

export async function test(env, cred) {
  const r = await graph(env, "GET", cred.accountId, { fields: "username" }, cred.token);
  return "Connecté à @" + r.username;
}
