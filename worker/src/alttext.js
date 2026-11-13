// Texte alternatif proposé par Claude (clé ANTHROPIC_API_KEY) : il regarde la première image du post
// et écrit une description courte pour les personnes qui ne voient pas l'image. Rien n'est enregistré tout seul.
import { MODEL, textOf } from "./rewrite.js";

export const SYSTEM = "Tu écris des textes alternatifs (attribut alt) pour des images publiées sur les réseaux sociaux. Tu décris ce qu'on voit, utile pour une personne aveugle : sujet principal, action, texte écrit sur l'image recopié mot pour mot, contexte. Pas de « Image de » ni de « Photo de » au début, pas d'interprétation, pas de hashtag, pas d'emoji. Une à trois phrases, 300 caractères au plus. Tu écris dans la langue de la légende (français par défaut).";
const B64_MAX = 5 * 1024 * 1024;

const b64 = (bytes) => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };

export function altPrompt(post) {
  return ["Écris le texte alternatif de cette image.", post && post.title ? "Sujet du post : " + post.title + "." : "", post && post.caption ? "Légende (pour le contexte et la langue, ne la recopie pas) :\n<legende>\n" + String(post.caption).slice(0, 1500) + "\n</legende>" : "", "Réponds uniquement avec le texte alternatif."].filter(Boolean).join("\n");
}
// image : { bytes: Uint8Array, type: "image/jpeg" }
export async function suggestAlt(client, image, post) {
  if (!/^image\/(jpeg|png|gif|webp)$/.test(image.type)) throw new Error("Seules les images JPEG, PNG, GIF ou WebP ont un texte alternatif proposé.");
  if (image.bytes.length > B64_MAX) throw new Error("Image trop lourde pour être lue (5 Mo au plus).");
  const res = await client.beta.messages.create({
    model: MODEL, max_tokens: 400, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default", output_config: { effort: "low" }, system: SYSTEM,
    messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: image.type, data: b64(image.bytes) } }, { type: "text", text: altPrompt(post) }] }],
  });
  return textOf(res).replace(/^["«\s]+|["»\s]+$/g, "").slice(0, 1000);
}
