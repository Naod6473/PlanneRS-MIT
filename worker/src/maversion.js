// « Ma version », mode clé API : Claude lit la recette d'une publication qui a marché, puis la refait
// à la sauce du compte. Sans clé, la page devine la recette et part d'un modèle (web/js/recette.js).
// Le client est injecté pour pouvoir le tester sans appel réseau.
import Core from "../../web/js/core.js";
import R from "../../web/js/recette.js";
import { MODEL, textOf } from "./rewrite.js";
import { jsonOf } from "./agent.js";

export const SYSTEM = "Tu aides un créateur de contenu à reprendre la recette d'une publication qui a marché, jamais son contenu. La recette, c'est la forme : type d'accroche, structure dans le temps, format, ressort émotionnel, façon de finir. Tu ne recopies ni phrase ni image. Si le créateur garde le même sujet, tu peux reprendre les informations et les idées de l'original, toujours reformulées avec ses mots et dans son angle ; sinon tu changes de sujet. Tu n'inventes ni chiffre ni source : si une information manque, tu l'écris entre crochets [à vérifier]. Tu écris en français.";

const ask = async (client, content, max) => textOf(await client.beta.messages.create({
  model: MODEL, max_tokens: max || 4000, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default", output_config: { effort: "low" },
  system: SYSTEM, messages: [{ role: "user", content }],
}));

export function recipePrompt(src) {
  return [
    "Publication " + (src.type === "post" ? "du compte lui-même (un de ses succès)" : "de @" + (src.handle || "?")) + " (" + (src.kind || "reel") + ")" + (src.score ? ", " + src.score + " fois la moyenne du compte" : "") + ".",
    "", "<texte_original>", String(src.caption || src.text || "(pas de texte)").slice(0, 3000), "</texte_original>", "",
    "Décris sa recette, sans reprendre son contenu. Réponds uniquement avec un objet JSON :",
    '{"name": "nom court de la recette (3 à 5 mots)", "hook": {"type": "type d\'accroche", "pattern": "le moule de l\'accroche avec des [trous]"}, "structure": [{"part": "Accroche", "sec": 2}], "format": "reel ou carousel", "spring": "le ressort émotionnel", "ending": "la façon de finir", "why": ["3 raisons courtes du succès"]}',
    "Pour un carrousel, sec vaut 0 et chaque part est une slide.",
  ].join("\n");
}
export async function extractRecipe(client, src) {
  return R.cleanRecipe(jsonOf(await ask(client, recipePrompt(src))), src);
}

export function versionPrompt(recipe, sauce, settings, tooClose) {
  const crew = Core.crewOf(settings).find((r) => r.key === "script");
  const brand = settings && settings.workspace && settings.workspace.name;
  const max = Math.max(10, Math.min(90, +sauce.maxSec || 30));
  return [
    brand ? "Mon compte : " + brand + "." : "", crew && crew.brief ? "Mes consignes de script : " + crew.brief : "",
    sauce.same ? "Même sujet que l'original : " + (sauce.subject || R.sourceSubject(recipe)) + ". Reprends les informations et les idées utiles de l'original, mais avec tes mots, dans l'ordre de mon angle et dans mon ton : aucune phrase recopiée. Vérifie les chiffres ; s'ils ne sont pas sûrs, écris [à vérifier]." : "Mon sujet : " + (sauce.subject || "[à choisir]") + ".",
    sauce.same && String(sauce.material || (recipe.from || {}).text || "").trim() ? "\n<contenu_original>\n" + String(sauce.material || (recipe.from || {}).text).slice(0, R.MAT_MAX) + "\n</contenu_original>\n" : "",
    "Angle : " + (R.ANGLES[sauce.angle] || R.ANGLES.top) + ".",
    sauce.format === "carousel" ? "Format : carrousel (un plan par slide, dur 0)." : "Format : Reel de " + max + " secondes au plus.",
    "", "Recette à suivre (la forme seulement) :", JSON.stringify({ name: recipe.name, hook: recipe.hook, structure: recipe.structure, spring: recipe.spring, ending: recipe.ending }),
    tooClose ? "\nTa première version reprenait trop de mots de l'original (" + tooClose + " % original) : réécris tout avec tes propres mots, sur mon sujet." : "",
    "", "Réponds uniquement avec un objet JSON :",
    '{"title": "titre", "hook": "première phrase, 8 mots au plus", "shots": [{"dur": 2, "screen": "texte à l\'écran", "voice": "réplique", "visual": "image ou plan", "music": "musique ou bruitage"}], "caption": "légende"}',
  ].filter((l) => l !== "").join("\n");
}
// Version de Claude ; si elle reprend trop l'original, une seconde tentative avec la note d'originalité.
export async function makeVersion(client, recipe, sauce, settings) {
  let v = R.cleanVersion(jsonOf(await ask(client, versionPrompt(recipe, sauce, settings), 8000)), sauce);
  let orig = R.checkOrig(recipe, sauce, v);
  if (orig < R.ORIG_MIN) {
    v = R.cleanVersion(jsonOf(await ask(client, versionPrompt(recipe, sauce, settings, orig), 8000)), sauce);
    orig = R.checkOrig(recipe, sauce, v);
  }
  if (v.format === "reel") R.fitDurations(v.shots, Math.max(10, Math.min(90, +sauce.maxSec || 30)));
  return Object.assign(v, { originality: orig });
}
