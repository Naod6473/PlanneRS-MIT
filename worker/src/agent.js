// Équipe d'agents, mode « clé API » : PlanneRs appelle Claude lui-même pour les rôles d'écriture.
// Scénariste : script + storyboard plan par plan. Légendes : une proposition de légende.
// Rien n'est jamais validé : la légende proposée reste à relire, comme pour la réécriture.
// Le client est injecté pour pouvoir le tester sans appel réseau.
import Core from "../../web/js/core.js";
import { MODEL, textOf } from "./rewrite.js";

export const SYSTEM = "Tu fais partie de l'équipe qui fabrique les vidéos courtes d'un compte sur les réseaux sociaux. Tu suis les consignes de ton rôle et la charte du compte. Tu n'inventes ni chiffre, ni source, ni lien : si une information manque, tu l'écris entre crochets [à vérifier]. Tu écris dans la langue du sujet.";

function context(post, settings) {
  const brand = settings && settings.workspace && settings.workspace.name;
  return [
    "Sujet : " + (post.title || "") + (post.format ? " (" + (Core.FORMATS[post.format] || post.format) + ")" : "") + (brand ? ". Compte : " + brand : "") + ".",
    (post.note || "").trim() ? "\n<notes>\n" + String(post.note).slice(0, 6000) + "\n</notes>" : "",
    (post.caption || "").trim() ? "\n<legende_actuelle>\n" + post.caption + "\n</legende_actuelle>" : "",
  ].filter(Boolean).join("\n");
}

// Consigne envoyée à Claude pour un rôle.
export function prompt(role, post, settings) {
  const max = (post.prod && post.prod.maxSec) || 30;
  if (role.key === "script") return [
    "Rôle : " + role.name + ".", "Consignes : " + role.brief, "Durée maximale de la vidéo : " + max + " secondes.", "", context(post, settings), "",
    "Réponds uniquement avec un objet JSON, sans texte autour :",
    '{"note": "le script en une ou deux phrases", "shots": [{"dur": 3, "screen": "texte à l\'écran", "voice": "réplique", "visual": "image ou plan", "music": "musique ou bruitage"}]}',
  ].join("\n");
  return ["Rôle : " + role.name + ".", "Consignes : " + role.brief, "", context(post, settings), "", "Réponds uniquement avec la légende, sans guillemets ni commentaire."].join("\n");
}

// Premier objet JSON de la réponse (Claude l'entoure parfois d'un bloc de code).
export function jsonOf(text) {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("Claude n'a pas rendu de storyboard lisible.");
  try { return JSON.parse(text.slice(a, b + 1)); } catch (e) { throw new Error("Claude n'a pas rendu de storyboard lisible."); }
}

const clip = (v, n) => String(v == null ? "" : v).slice(0, n);
export function shotsOf(o) {
  const shots = (Array.isArray(o && o.shots) ? o.shots : []).slice(0, 60).map((x) => ({ dur: Math.max(0, Math.min(600, +x.dur || 0)), screen: clip(x.screen, 300), voice: clip(x.voice, 600), visual: clip(x.visual, 300), music: clip(x.music, 120) }));
  if (!shots.length) throw new Error("Claude n'a proposé aucun plan.");
  return shots;
}

// Fait travailler un rôle sur un post. Renvoie le post modifié et un résumé ; à l'appelant d'enregistrer.
export async function work(client, roleKey, post, settings, now, opts = {}) {
  const role = Core.crewOf(settings).find((r) => r.key === roleKey);
  if (!role || !role.api) throw new Error("Ce rôle ne travaille pas avec la clé API (seulement Scénariste et Légendes).");
  if (role.who !== "api") throw new Error("Dans l'Équipe, ce rôle n'est pas confié à la clé API : change « Qui tient ce rôle » d'abord.");
  if (post.status === "published") throw new Error("Ce post est déjà publié.");
  if (role.key === "script" && ((post.prod && post.prod.shots) || []).length && !opts.force) { const e = new Error("Cette vidéo a déjà un storyboard : le remplacer ?"); e.code = "exists"; throw e; }
  const res = await client.beta.messages.create({
    model: MODEL, max_tokens: 8000, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default", output_config: { effort: "low" },
    system: SYSTEM, messages: [{ role: "user", content: prompt(role, post, settings) }],
  });
  const text = textOf(res), by = "Claude · " + role.name, p = Object.assign({}, post);
  p.prod = Object.assign({}, p.prod); p.prod.steps = Object.assign({}, p.prod.steps);
  if (role.key === "script") {
    const o = jsonOf(text);
    p.prod.shots = shotsOf(o);
    p.prod.steps.script = { state: "done", by, at: now, note: clip(o.note, 200) };
    const sec = p.prod.shots.reduce((n, x) => n + x.dur, 0);
    return { post: p, summary: p.prod.shots.length + " plans, " + Math.round(sec) + " s" };
  }
  // Légendes : la proposition remplace une légende vide ; sinon elle arrive en commentaire, pour ne rien écraser.
  if (!(p.caption || "").trim()) { p.caption = text.slice(0, 5000); p.captionValidated = false; }
  else p.comments = (p.comments || []).concat([{ at: now, by, text: "Proposition de légende :\n" + text.slice(0, 5000) }]);
  return { post: p, summary: (post.caption || "").trim() ? "proposition en commentaire" : "légende proposée, à relire" };
}
