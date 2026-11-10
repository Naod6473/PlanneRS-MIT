// Outils communs aux API Meta (Instagram et Pages Facebook).
// Les messages d'erreur sont traduits en français pour l'écran « Échec ».

export const graphBase = (env) => "https://graph.facebook.com/" + (env.GRAPH_VERSION || "v21.0");

export class PublishError extends Error {
  constructor(message, { code, why, todo, retryable = true } = {}) {
    super(message);
    this.code = code; this.why = why; this.todo = todo; this.retryable = retryable;
  }
}

// Explications des erreurs courantes de l'API Graph.
const KNOWN = {
  "2207052": ["Le média n'a pas pu être récupéré depuis son adresse publique.", "Vérifie que le fichier est bien en ligne (hébergement public), puis réessaie dans quelques minutes."],
  "2207076": ["Instagram a refusé de télécharger la vidéo depuis cet hébergement.", "Essaie un autre hébergement public pour les vidéos (par exemple R2 ou GitHub Pages)."],
  "2207077": ["Instagram a refusé de télécharger la vidéo depuis cet hébergement.", "Essaie un autre hébergement public pour les vidéos."],
  "2207026": ["Le format de la vidéo n'est pas accepté.", "Exporte en MP4 (H.264, AAC), 9:16, moins de 15 minutes."],
  "2207004": ["L'image est trop lourde.", "Réduis l'image sous 8 Mo (JPEG)."],
  "2207009": ["Le format de l'image n'est pas accepté.", "Utilise une image JPEG au ratio 4:5 à 1,91:1."],
  "190": ["La connexion au compte a expiré.", "Reconnecte le compte dans Réglages › Comptes."],
  "10": ["Le compte n'a pas l'autorisation nécessaire.", "Reconnecte le compte en acceptant toutes les autorisations demandées."],
  "200": ["Le compte n'a pas l'autorisation nécessaire.", "Reconnecte le compte en acceptant toutes les autorisations demandées."],
  "4": ["Trop de requêtes envoyées à Meta.", "Attends une heure avant de réessayer."],
  "9": ["Limite de publications atteinte (100 par 24 h sur Instagram).", "Reprogramme à demain."],
};

export function explain(err) {
  const code = String(err.error_subcode || err.code || "");
  const k = KNOWN[code] || KNOWN[String(err.code || "")];
  return { code, why: k ? k[0] : err.error_user_msg || err.message || "Erreur inconnue de l'API.", todo: k ? k[1] : "Réessaie ; si ça recommence, poste à la main." };
}

export async function graph(env, method, path, params, token) {
  const url = new URL(graphBase(env) + "/" + path.replace(/^\//, ""));
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) if (v != null) (method === "GET" ? url.searchParams : body).set(k, String(v));
  const headers = { accept: "application/json" };
  if (token) headers.authorization = "Bearer " + token;
  const r = await fetch(url, { method, headers, body: method === "GET" ? undefined : body });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.error) {
    const e = data.error || { message: r.statusText, code: r.status };
    const x = explain(e);
    throw new PublishError("Meta a refusé la demande (" + (x.code || r.status) + ").", { code: x.code, why: x.why, todo: x.todo, retryable: x.code !== "190" });
  }
  return data;
}

export const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
export const isVideo = (m) => (m.type || "").startsWith("video") || /\.(mp4|mov)$/i.test(m.url || m.name || "");

export function publicUrl(env, m) {
  if (m.url && /^https:\/\//.test(m.url)) return m.url;
  if (env.MEDIA_BASE_URL && m.name) return env.MEDIA_BASE_URL.replace(/\/$/, "") + "/" + encodeURI(m.path || m.name);
  throw new PublishError("Le média « " + (m.name || "?") + " » n'a pas d'adresse publique.", {
    why: "Instagram et Facebook récupèrent les médias par une adresse publique (https). Ce fichier n'en a pas.",
    todo: "Relie un hébergement public dans Réglages › Stockage, ou poste à la main.", retryable: false });
}
