// Outils communs aux connecteurs hors Meta : récupération des médias, erreurs HTTP expliquées.
import { PublishError, publicUrl, isVideo, sleep } from "./meta.js";

export { PublishError, publicUrl, isVideo, sleep };

// Télécharge un média depuis son adresse publique (les API de Bluesky, Mastodon, X et LinkedIn veulent les octets).
// Texte alternatif d'une image (accessibilité) : celui du média, sinon celui du post.
export const altOf = (post, m) => String((m && m.alt) || (post && post.alt) || "").trim().slice(0, 1000);

export async function fetchMedia(env, m) {
  const url = publicUrl(env, m);
  const r = await fetch(url);
  if (!r.ok) throw new PublishError("Le média « " + (m.name || url) + " » n'a pas pu être téléchargé (" + r.status + ").", { why: "L'adresse publique du fichier ne répond pas.", todo: "Vérifie que le fichier est bien en ligne, puis réessaie." });
  const bytes = new Uint8Array(await r.arrayBuffer());
  const type = (r.headers.get("content-type") || "").split(";")[0] || (isVideo(m) ? "video/mp4" : /\.png$/i.test(url) ? "image/png" : "image/jpeg");
  return { bytes, type, name: m.name || url.split("/").pop() };
}

// Explique une réponse HTTP refusée par un réseau, en français.
export function httpError(net, status, detail) {
  const d = typeof detail === "string" ? detail.slice(0, 300) : JSON.stringify(detail || {}).slice(0, 300);
  if (status === 401) return new PublishError(net + " : connexion refusée (401).", { code: "401", why: "Le jeton ou le mot de passe n'est plus valable.", todo: "Reconnecte " + net + " dans Réglages › Comptes.", retryable: false });
  if (status === 403) return new PublishError(net + " : action interdite (403).", { code: "403", why: "Le compte n'a pas l'autorisation de publier. " + d, todo: "Vérifie les autorisations accordées à l'application, puis reconnecte le compte.", retryable: false });
  if (status === 429) return new PublishError(net + " : trop de demandes (429).", { code: "429", why: "Limite de l'API atteinte.", todo: "Attends un peu ; nouvel essai au prochain passage." });
  if (status >= 500) return new PublishError(net + " : le service ne répond pas (" + status + ").", { code: String(status), why: "Panne passagère chez " + net + ".", todo: "Nouvel essai au prochain passage." });
  return new PublishError(net + " a refusé la demande (" + status + ").", { code: String(status), why: d || "Réponse inattendue.", todo: "Vérifie le texte et les médias ; sinon, poste à la main.", retryable: false });
}

export async function jsonOrThrow(net, r) {
  const txt = await r.text();
  let data = null;
  try { data = txt ? JSON.parse(txt) : {}; } catch (e) { data = txt; }
  if (!r.ok) throw httpError(net, r.status, data && (data.message || data.error_description || data.error || data.detail || data.title || data));
  return data;
}

// Test de connexion qui ne bloque pas sur un manque de droits de LECTURE : 401 = jeton invalide, 403 = jeton accepté.
export function limitText(net, text, max) {
  const n = [...(text || "")].length;
  if (n > max) throw new PublishError("Texte trop long pour " + net + " (" + n + " caractères, " + max + " max).", { why: net + " limite les messages à " + max + " caractères.", todo: "Raccourcis le texte du post, puis réessaie.", retryable: false });
}

export function noVideo(net) {
  return new PublishError("Vidéo non gérée sur " + net + " pour l'instant.", { why: "Ce connecteur publie le texte et les images.", todo: "Poste la vidéo à la main sur " + net + ".", retryable: false });
}

export function notConnected(net) {
  return new PublishError(net + " n'est pas connecté.", { why: "Il manque les identifiants.", todo: "Connecte " + net + " dans Réglages › Comptes.", retryable: false });
}
