// Fournisseur de connexion « Postiz » : le client a déjà un Postiz (cloud ou auto-hébergé) avec ses réseaux
// connectés. PlanneRs garde sa propre file : à l'heure prévue, il demande à Postiz de publier tout de suite
// (type « now »), puis relit l'état du post (QUEUE → PUBLISHED ou ERROR) aux passages suivants.
// Identifiants : adresse de l'API + clé d'API Postiz (chiffrées comme les autres connexions).
// Limite Postiz : 30 appels par heure sur l'API publique.
// Doc : https://docs.postiz.com/public-api/introduction
import { PublishError, publicUrl, threadOf } from "../adapters/common.js";
import Core from "../../../web/js/core.js";

export const kind = "provider";
export const fields = [
  { key: "baseUrl", label: "Adresse de Postiz (ex. https://postiz.mondomaine.fr, ou https://api.postiz.com pour Postiz Cloud)" },
  { key: "apiKey", label: "Clé d'API Postiz (Réglages › API publique dans Postiz)", secret: true },
];

// Identifiants Postiz des réseaux (« providerIdentifier ») → réseaux PlanneRs.
export const IDENTIFIERS = {
  instagram: "instagram", "instagram-standalone": "instagram", facebook: "facebook", x: "x",
  linkedin: "linkedin", "linkedin-page": "linkedin", threads: "threads", bluesky: "bluesky", mastodon: "mastodon",
  pinterest: "pinterest", youtube: "youtube", tiktok: "tiktok",
};
export const networkOf = (identifier) => IDENTIFIERS[String(identifier || "").toLowerCase()] || null;

// Adresse de l'API publique : Postiz Cloud = api.postiz.com/public/v1, auto-hébergé = <domaine>/api/public/v1.
export function apiBase(baseUrl) {
  const u = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (!/^https:\/\//i.test(u)) throw new PublishError("Adresse Postiz invalide.", { why: "Elle doit commencer par https://.", todo: "Corrige l'adresse dans Réglages › Comptes › Postiz.", retryable: false });
  if (/\/public\/v1$/.test(u)) return u + "/";
  if (/^https:\/\/api\.postiz\.com$/i.test(u)) return u + "/public/v1/";
  return u + "/api/public/v1/";
}

export async function api(cfg, method, path, body) {
  let r;
  try {
    r = await fetch(apiBase(cfg.baseUrl) + path.replace(/^\//, ""), { method, headers: { authorization: cfg.apiKey, accept: "application/json", "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  } catch (e) {
    if (e instanceof PublishError) throw e;
    throw new PublishError("Postiz ne répond pas.", { why: e.message, todo: "Vérifie que ton Postiz est joignable depuis Internet ; nouvel essai au prochain passage." });
  }
  const txt = await r.text();
  let data = {};
  try { data = txt ? JSON.parse(txt) : {}; } catch (e) { data = { message: txt.slice(0, 200) }; }
  if (!r.ok) {
    const msg = String((data && (data.message || data.error)) || r.statusText).slice(0, 300);
    if (r.status === 401) throw new PublishError("Clé Postiz refusée (401).", { code: "postiz-401", why: msg, todo: "Vérifie la clé d'API dans Réglages › Comptes › Postiz.", retryable: false });
    if (r.status === 429) throw new PublishError("Trop de demandes à Postiz (429).", { code: "postiz-429", why: "L'API publique de Postiz accepte 30 appels par heure.", todo: "Nouvel essai au prochain passage." });
    throw new PublishError("Postiz a refusé la demande (" + r.status + ").", { code: "postiz-" + r.status, why: msg, todo: "Vérifie le post et la chaîne dans Postiz.", retryable: r.status >= 500 });
  }
  return data;
}

export async function integrations(cfg) {
  const list = await api(cfg, "GET", "integrations");
  return (Array.isArray(list) ? list : list.integrations || []).map((i) => ({ id: i.id, name: i.name, identifier: i.identifier || i.providerIdentifier, picture: i.picture, disabled: !!i.disabled, refreshNeeded: !!i.refreshNeeded, network: networkOf(i.identifier || i.providerIdentifier) }));
}

export async function test(env, cfg) {
  if (!cfg.baseUrl || !cfg.apiKey) throw new PublishError("Adresse ou clé Postiz manquante.", { retryable: false });
  const list = await integrations(cfg);
  const ok = list.filter((i) => i.network && !i.disabled);
  return "Postiz : " + ok.length + (ok.length > 1 ? " chaînes utilisables" : " chaîne utilisable") + (ok.length ? " (" + [...new Set(ok.map((i) => i.network))].join(", ") + ")" : "");
}

// Lien pour connecter une nouvelle chaîne dans Postiz (ouvert dans le navigateur de l'utilisateur).
export async function connectUrl(cfg, identifier) {
  const r = await api(cfg, "GET", "social/" + encodeURIComponent(identifier));
  return r.url;
}

// État de la chaîne choisie : ok, expired (à reconnecter dans Postiz), error (supprimée).
export async function status(cfg, cred) {
  const it = (await integrations(cfg)).find((i) => i.id === cred.integrationId);
  if (!it) return { status: "error", why: "Cette chaîne n'existe plus dans Postiz." };
  if (it.disabled || it.refreshNeeded) return { status: "expired", why: "Postiz demande de reconnecter « " + it.name + " »." };
  return { status: "ok", name: it.name };
}

// Réglages propres à chaque réseau demandés par Postiz (valeurs neutres ; les champs obligatoires d'abord).
export function settingsFor(identifier, post) {
  const t = String(identifier || "").toLowerCase(), net = networkOf(t);
  const s = { __type: t };
  if (net === "instagram") Object.assign(s, { post_type: post.format === "story" ? "story" : "post", collaborators: [] });
  if (net === "x") Object.assign(s, { who_can_reply_post: "everyone" });
  if (net === "youtube") Object.assign(s, { title: Core.titleFor(post, "youtube"), type: "public" });
  if (net === "tiktok") Object.assign(s, { privacy_level: "PUBLIC_TO_EVERYONE", duet: false, stitch: false, comment: true, autoAddMusic: "no", brand_content_toggle: false, brand_organic_toggle: false, content_posting_method: "DIRECT_POST" });
  if (net === "pinterest" && post.pinterestBoard) s.board = post.pinterestBoard;
  return s;
}

// Contenu du post au format Postiz : un élément par message (fil), les médias sur le premier.
export function valueOf(post, net, images) {
  const parts = ["x", "threads", "bluesky", "mastodon"].includes(net) ? threadOf(post.caption) : [String(post.caption || "")];
  return parts.map((content, i) => ({ content, image: i === 0 ? images : [] }));
}

// Publie (étape 1) ou relit l'état (étapes suivantes). cred = { provider:"postiz", integrationId, identifier }.
export async function publish(env, network, post, cred, job, cfg) {
  if (!cfg || !cfg.apiKey) throw new PublishError("Postiz n'est pas connecté.", { why: "Il manque l'adresse ou la clé d'API de Postiz.", todo: "Connecte Postiz dans Réglages › Comptes.", retryable: false });
  if (job && job.postiz) return follow(cfg, job);
  const media = (post.media || []).filter((m) => m.role !== "guide" && (m.role !== "cover" || network === "instagram"));
  const images = [];
  for (const m of media.filter((x) => x.role !== "cover").slice(0, 10)) {
    const up = await api(cfg, "POST", "upload-from-url", { url: publicUrl(env, m) });
    images.push({ id: up.id, path: up.path });
  }
  const at = new Date().toISOString();
  const r = await api(cfg, "POST", "posts", {
    type: "now", date: at, shortLink: false, tags: [],
    posts: [{ integration: { id: cred.integrationId }, value: valueOf(post, network, images), settings: settingsFor(cred.identifier, post) }],
  });
  const id = Array.isArray(r) && r[0] && r[0].postId;
  if (!id) throw new PublishError("Réponse inattendue de Postiz.", { why: "Pas d'identifiant de post.", todo: "Regarde dans Postiz si le post est parti avant de réessayer (risque de doublon).", retryable: false });
  return { status: "pending", job: { postiz: id, at } };
}

// Relit l'état du post dans Postiz.
export async function follow(cfg, job) {
  const t = Date.parse(job.at) || Date.now();
  const q = "posts?startDate=" + encodeURIComponent(new Date(t - 864e5).toISOString()) + "&endDate=" + encodeURIComponent(new Date(t + 864e5).toISOString());
  const list = (await api(cfg, "GET", q)).posts || [];
  const p = list.find((x) => x.id === job.postiz);
  if (!p) {
    if (Date.now() - t > 6 * 3600e3) throw new PublishError("Post introuvable dans Postiz.", { why: "Il a peut-être été supprimé dans Postiz.", todo: "Vérifie dans Postiz, puis reprogramme-le si besoin.", retryable: false });
    return { status: "pending", job };
  }
  if (p.state === "PUBLISHED") return { status: "ok", id: String(p.releaseId || p.id), url: p.releaseURL || "" };
  if (p.state === "ERROR") throw new PublishError("Postiz n'a pas pu publier.", { code: "postiz-error", why: String(p.error || "Erreur inconnue côté Postiz.").slice(0, 300), todo: "Regarde le détail dans Postiz ; corrige, puis reprogramme-le.", retryable: false });
  return { status: "pending", job };
}
