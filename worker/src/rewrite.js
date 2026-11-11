// Réécrire la légende d'un post pour un réseau, avec Claude (clé ANTHROPIC_API_KEY dans les secrets du Worker).
// Le résultat n'est qu'un brouillon : il remplace la version du réseau dans l'éditeur, jamais validé tout seul.
// Le client est injecté (createClient) pour pouvoir le tester sans appel réseau.
import Core from "../../web/js/core.js";

export const MODEL = "claude-opus-5-5";

const STYLE = {
  instagram: "Instagram : accroche dans la première ligne (coupée après ~125 caractères), paragraphes courts, hashtags en fin de texte.",
  facebook: "Facebook : ton conversationnel, une question ou un appel à réagir, peu ou pas de hashtags.",
  x: "X : un seul message de 280 caractères maximum (un lien compte pour 23), direct, 0 à 2 hashtags.",
  bluesky: "Bluesky : 300 caractères maximum, ton naturel, hashtags rares.",
  threads: "Threads : 500 caractères maximum, ton conversationnel, au plus 1 hashtag.",
  mastodon: "Mastodon : 500 caractères maximum, hashtags en CamelCase pour l'accessibilité, pas de ton marketing.",
  linkedin: "LinkedIn : ton professionnel, une première ligne qui donne envie de lire la suite, paragraphes aérés, 3 hashtags maximum.",
  pinterest: "Pinterest : description de 500 caractères maximum, mots-clés utiles à la recherche, pas de hashtags.",
  youtube: "YouTube Shorts : description courte, la première phrase résume la vidéo, 3 hashtags maximum.",
  tiktok: "TikTok : texte court et rythmé, 3 à 5 hashtags.",
};
const NAME = { instagram: "Instagram", facebook: "Facebook", x: "X", bluesky: "Bluesky", threads: "Threads", mastodon: "Mastodon", linkedin: "LinkedIn", pinterest: "Pinterest", youtube: "YouTube", tiktok: "TikTok" };

export const SYSTEM = "Tu adaptes des légendes de publications pour les réseaux sociaux. Tu gardes le sens, les faits, les liens et la langue du texte d'origine, ainsi que le ton de la marque. Tu n'inventes rien : ni chiffre, ni promesse, ni lien. Tu réponds uniquement avec la légende adaptée, sans guillemets, sans titre ni commentaire.";

// Consigne envoyée à Claude pour un post et un réseau.
export function prompt(post, net, settings) {
  const max = Core.TEXT_MAX[net];
  const src = (post.caption || "").trim() || Core.capFor(post, "instagram");
  const brand = settings && settings.workspace && settings.workspace.name;
  return [
    "Adapte cette légende pour " + (NAME[net] || net) + ".",
    STYLE[net] || "",
    max ? "Limite stricte : " + max + " caractères." : "",
    "Sujet : " + (post.title || "") + (post.format ? " (" + (Core.FORMATS[post.format] || post.format) + ")" : "") + (brand ? ". Compte : " + brand : "") + ".",
    "",
    "<legende>",
    src,
    "</legende>",
  ].filter((l) => l !== "").join("\n").replace("\n<legende>", "\n\n<legende>");
}

// Texte de la réponse (blocs « text » seulement), ou une erreur claire.
export function textOf(res) {
  if (!res) throw new Error("Pas de réponse de Claude.");
  if (res.stop_reason === "refusal") throw new Error("Claude a refusé de réécrire ce texte.");
  const t = (res.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  if (!t) throw new Error("Réponse vide de Claude.");
  return t.replace(/^<legende>\s*|\s*<\/legende>$/g, "").trim();
}

// Appel à Claude. client : objet compatible avec le SDK Anthropic (beta.messages.create).
export async function rewrite(client, post, net, settings) {
  if (!(post.caption || "").trim() && !Object.values(post.captions || {}).some((c) => (c || "").trim())) throw new Error("Écris d'abord la légende commune : elle sert de base.");
  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: SYSTEM,
    messages: [{ role: "user", content: prompt(post, net, settings) }],
  });
  const text = textOf(res);
  const max = Core.TEXT_MAX[net];
  return { text, over: !!(max && [...text].length > max), model: res.model || MODEL };
}

// Réponse proposée à un commentaire. Jamais envoyée toute seule : elle arrive dans la zone de réponse.
export const REPLY_SYSTEM = "Tu proposes des réponses aux commentaires reçus sur les réseaux sociaux d'un compte. Réponse courte (une à trois phrases), chaleureuse, dans la langue du commentaire, au ton du compte, tutoiement si le compte tutoie. Tu réponds à la question posée sans rien inventer ; si tu ne sais pas, tu remercies et tu proposes d'en reparler. Pas de hashtag. Tu réponds uniquement avec le texte de la réponse.";

export function replyPrompt(c, post, settings) {
  const brand = settings && settings.workspace && settings.workspace.name;
  return [(brand ? "Compte : " + brand + "." : ""), post && post.title ? "Publication : " + post.title + "." : "",
    "", "<legende>", (post && post.caption) || c.caption || "", "</legende>", "", "Commentaire de @" + (c.user || "") + " :", "<commentaire>", c.text || "", "</commentaire>"]
    .filter((l, i, a) => l !== "" || (a[i - 1] !== "" && i > 0)).join("\n");
}

export async function suggestReply(client, c, post, settings) {
  const res = await client.beta.messages.create({
    model: MODEL, max_tokens: 2000, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default", output_config: { effort: "low" },
    system: REPLY_SYSTEM, messages: [{ role: "user", content: replyPrompt(c, post, settings) }],
  });
  return { text: textOf(res).replace(/^<\/?commentaire>|<\/?commentaire>$/g, "").trim() };
}
