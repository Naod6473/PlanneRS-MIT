// Pépites : les publications des comptes que tu suis (5 au plus) qui marchent bien mieux que d'habitude.
// Instagram : « Business Discovery » de l'API Meta, avec ton compte connecté (likes et commentaires seulement,
//   pas les vues ; le compte suivi doit être professionnel). YouTube : le flux public de la chaîne (vues, sans clé).
// TikTok n'a pas d'accès public : pas de suivi possible.
// Une pépite = une publication au moins deux fois au-dessus de la médiane récente de son compte.
// « Faire ma version » en tire une idée : la recette (accroche, structure, format), jamais une copie.
import { graph } from "./adapters/meta.js";
import { MODEL, textOf } from "./rewrite.js";

export const MAX_RIVALS = 5;
export const MIN_SCORE = 2;
export const MIN_ITEMS = 5; // moins de publications récentes : pas assez pour parler de moyenne
const DAYS = 60;

export function median(v) {
  const a = v.filter((x) => x > 0).sort((x, y) => x - y);
  if (!a.length) return 0;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

// Nettoie la liste saisie : réseau connu, identifiant sans @ ni adresse, sans doublon, 5 au plus.
export function cleanRivals(list) {
  const seen = new Set(), out = [];
  for (const r of Array.isArray(list) ? list : []) {
    const net = r && r.net === "youtube" ? "youtube" : "instagram";
    let h = String((r && r.handle) || "").trim().replace(/^https?:\/\/((www|m)\.)?(instagram\.com|youtube\.com)\//i, "").replace(/^(channel|c|user)\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "");
    if (!/^[\w.-]{1,60}$/.test(h)) continue;
    const k = net + ":" + h.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k); out.push({ net, handle: h });
    if (out.length >= MAX_RIVALS) break;
  }
  return out;
}

// Score de chaque publication par rapport à la médiane de son compte. Ne garde que les 60 derniers jours.
export function score(items, today) {
  const since = today ? new Date(new Date(today).getTime() - DAYS * 864e5).toISOString().slice(0, 10) : "";
  const recent = items.filter((x) => !since || (x.at || "").slice(0, 10) >= since);
  if (recent.length < MIN_ITEMS) return recent.map((x) => Object.assign({}, x, { median: 0, score: 0 }));
  const med = median(recent.map((x) => x.metric));
  return recent.map((x) => Object.assign({}, x, { median: med, score: med ? Math.round((x.metric / med) * 10) / 10 : 0 })).sort((a, b) => b.score - a.score);
}

// --- Instagram (Business Discovery) -------------------------------------------------------
const IG_FIELDS = "username,name,followers_count,media_count,profile_picture_url,media.limit(30){id,caption,like_count,comments_count,media_type,media_product_type,permalink,timestamp,thumbnail_url,media_url}";
export async function instagram(env, cred, handle) {
  if (!cred || !cred.token || !cred.accountId) throw new Error("Connecte ton compte Instagram (Réglages › Comptes) pour suivre des comptes Instagram.");
  const r = await graph(env, "GET", cred.accountId, { fields: "business_discovery.username(" + handle + "){" + IG_FIELDS + "}" }, cred.token);
  const b = r.business_discovery || {};
  const items = ((b.media && b.media.data) || []).map((m) => ({
    id: "ig:" + m.id, url: m.permalink || "", caption: (m.caption || "").slice(0, 600), at: m.timestamp || "",
    kind: m.media_product_type === "REELS" ? "reel" : m.media_type === "CAROUSEL_ALBUM" ? "carousel" : m.media_type === "VIDEO" ? "video" : "image",
    thumb: m.thumbnail_url || (m.media_type === "IMAGE" ? m.media_url : "") || "", likes: m.like_count || 0, comments: m.comments_count || 0,
    metric: (m.like_count || 0) + 3 * (m.comments_count || 0), unit: "interactions",
  }));
  return { name: b.name || b.username || handle, followers: b.followers_count || null, items };
}

// --- YouTube (flux public, sans clé) -------------------------------------------------------
const decode = (s) => String(s || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
export function channelIdOf(html) {
  const m = /"(?:channelId|externalId)":"(UC[\w-]{22})"/.exec(html) || /channel\/(UC[\w-]{22})/.exec(html);
  return m ? m[1] : "";
}
export function parseFeed(xml) {
  const title = decode((/<title>([^<]*)<\/title>/.exec(xml) || [])[1]);
  const items = (xml.match(/<entry>[\s\S]*?<\/entry>/g) || []).map((e) => {
    const g = (re) => (re.exec(e) || [])[1] || "";
    const id = g(/<yt:videoId>([^<]+)</), url = decode(g(/<link rel="alternate" href="([^"]+)"/)) || "https://www.youtube.com/watch?v=" + id;
    const views = +g(/<media:statistics views="(\d+)"/) || 0;
    return { id: "yt:" + id, url, caption: decode(g(/<media:title>([^<]*)</) || g(/<title>([^<]*)</)).slice(0, 600), at: g(/<published>([^<]+)</), kind: /\/shorts\//.test(url) ? "short" : "video",
      thumb: decode(g(/<media:thumbnail url="([^"]+)"/)), views, likes: +g(/<media:starRating count="(\d+)"/) || 0, metric: views, unit: "vues" };
  });
  return { name: title, items };
}
export async function youtube(handle, fetchFn = fetch) {
  let id = /^UC[\w-]{22}$/.test(handle) ? handle : "";
  if (!id) {
    const r = await fetchFn("https://www.youtube.com/@" + encodeURIComponent(handle), { headers: { "accept-language": "fr" } });
    if (!r.ok) throw new Error("Chaîne YouTube introuvable (@" + handle + ").");
    id = channelIdOf(await r.text());
    if (!id) throw new Error("Chaîne YouTube introuvable (@" + handle + ").");
  }
  const f = await fetchFn("https://www.youtube.com/feeds/videos.xml?channel_id=" + id);
  if (!f.ok) throw new Error("Flux YouTube indisponible pour @" + handle + ".");
  return Object.assign(parseFeed(await f.text()), { followers: null, channelId: id });
}

// Relevé complet. Un compte en échec n'empêche pas les autres.
export async function collect(env, rivals, igCred, today, fetchFn = fetch) {
  const accounts = [];
  for (const r of cleanRivals(rivals)) {
    try {
      const a = r.net === "youtube" ? await youtube(r.handle, fetchFn) : await instagram(env, igCred, r.handle);
      const items = score(a.items, today).map((x) => Object.assign(x, { net: r.net, handle: r.handle }));
      accounts.push({ net: r.net, handle: r.handle, name: a.name, followers: a.followers, median: items.length ? items[0].median : 0, count: items.length, items: items.slice(0, 12) });
    } catch (e) { accounts.push({ net: r.net, handle: r.handle, error: (e && (e.why || e.message)) || "Erreur" }); }
  }
  const top = accounts.flatMap((a) => a.items || []).filter((x) => x.score >= MIN_SCORE).sort((a, b) => b.score - a.score).slice(0, 24);
  return { updated: new Date().toISOString(), day: today, accounts, top };
}

// --- Faire ma version -----------------------------------------------------------------------
export const SYSTEM = "Tu aides un créateur de contenu à s'inspirer d'une publication qui a très bien marché chez un autre compte. Tu expliques la recette (accroche, structure, format, durée, émotion, appel à réagir) puis tu proposes une version originale pour le compte du créateur, sur son sujet et dans son ton. Tu ne copies jamais : ni le texte, ni les images, ni l'idée exacte. Tu n'inventes ni chiffre ni source.";
export function remixPrompt(item, settings) {
  const brand = settings && settings.workspace && settings.workspace.name;
  const script = settings && settings.crew && settings.crew.script && settings.crew.script.brief;
  return [
    (brand ? "Mon compte : " + brand + "." : ""), script ? "Mes consignes de script : " + script : "",
    "Publication de @" + item.handle + " (" + (item.net === "youtube" ? "YouTube" : "Instagram") + ", " + item.kind + ") : " + item.score + " fois sa moyenne (" + item.metric + " " + item.unit + ").",
    "", "<texte_original>", item.caption || "(pas de texte)", "</texte_original>", "",
    "Réponds en trois parties courtes, en texte simple :", "Pourquoi ça marche : 3 points.", "Ma version : un titre, une accroche (première phrase), puis le déroulé en 4 à 6 étapes.", "À éviter : ce qui ferait copie.",
  ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
}
export async function remix(client, item, settings) {
  const res = await client.beta.messages.create({
    model: MODEL, max_tokens: 4000, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default", output_config: { effort: "low" },
    system: SYSTEM, messages: [{ role: "user", content: remixPrompt(item, settings) }],
  });
  return textOf(res);
}

// Idée créée à partir d'une pépite : lien d'origine, chiffres, et la recette si Claude l'a écrite.
export function ideaOf(item, recipe, now) {
  const hook = (item.caption || "").split("\n")[0].replace(/#[\p{L}\p{N}_]+/gu, "").trim().slice(0, 70);
  const title = (recipe && (/Ma version\s*:?\s*\n?\s*(?:Titre\s*:\s*)?(.+)/i.exec(recipe) || [])[1] || "").replace(/^[«"\s*]+|[»"\s*]+$/g, "").slice(0, 90) || "Ma version : " + (hook || "@" + item.handle);
  return {
    id: "pp" + Date.now().toString(36), title, format: item.kind === "carousel" ? "carousel" : item.kind === "image" ? "image" : "reel",
    networks: ["instagram"], date: null, time: null, caption: "", captionValidated: false, media: [], status: "draft", stage: "idea",
    note: ["Inspiration : " + item.url, "@" + item.handle + " · " + item.score + "× sa moyenne (" + item.metric + " " + item.unit + ")", "", recipe || "Texte d'origine (pour mémoire, à ne pas copier) :\n" + (item.caption || "")].join("\n").slice(0, 6000),
    source: { url: item.url, handle: item.handle, net: item.net, at: now },
  };
}
