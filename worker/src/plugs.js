// Actions automatiques après publication (Réglages › Automatisations).
// Une règle : « quand un post dépasse N likes sur Instagram ou Facebook, ajouter ce commentaire ».
// Vérifié à chaque relevé des statistiques (une fois par jour). Une règle ne s'applique qu'une fois par post.
import Core from "../../web/js/core.js";

export const MAX_AGE_DAYS = 14; // on ne revient pas sur les vieux posts
export const NETS = ["instagram", "facebook"];
const NAME = { instagram: "Instagram", facebook: "Facebook" };

export const valid = (r) => !!(r && r.id && NETS.includes(r.net) && +r.threshold > 0 && String(r.comment || "").trim() && r.enabled !== false);

// Ce qu'il y a à faire : [{ rule, post, media }] pour les posts publiés récents qui passent le seuil.
// keyOf(url) : clé commune entre l'adresse enregistrée dans le post et celle du relevé (stats.mediaKey).
export function due(rules, posts, stats, today, keyOf, dryRun) {
  const out = [], lim = Core.addDays(today, -MAX_AGE_DAYS);
  for (const rule of (rules || []).filter(valid)) {
    const byKey = {};
    (((stats || {})[rule.net] || {}).media || []).forEach((m) => { if (m.key) byKey[m.key] = m; });
    for (const p of posts || []) {
      if (p.status !== "published" || p.parent || p.format === "story" || !p.date || p.date < lim) continue;
      const mark = p.plugs && p.plugs[rule.id];
      if (mark && (dryRun || !/^simulation/.test(mark))) continue; // une simulation ne compte pas une fois le robot en réel
      const res = (p.results || {})[rule.net];
      const m = byKey[keyOf((res && res.url) || (rule.net === (p.networks || [])[0] ? p.url : ""))];
      if (m && (m.likes || 0) >= +rule.threshold) out.push({ rule, post: p, media: m });
    }
  }
  return out;
}

// deps : { adapters, cred(net), save(posts), log(entry), now, dryRun, settings }
export async function run(rules, posts, stats, deps, keyOf) {
  const todo = due(rules, posts, stats, deps.now.slice(0, 10), keyOf, deps.dryRun), changed = new Map();
  let done = 0;
  for (const { rule, post, media } of todo) {
    const ad = deps.adapters[rule.net], cred = ad && ad.comment ? await deps.cred(rule.net) : null;
    if (!cred) continue;
    const txt = Core.utm(String(rule.comment).trim(), rule.net, post, deps.settings);
    try {
      if (!deps.dryRun) await ad.comment(deps.env, media.id, txt, cred);
      post.plugs = Object.assign({}, post.plugs, { [rule.id]: (deps.dryRun ? "simulation " : "") + deps.now });
      changed.set(post.id, post); done++;
      await deps.log({ at: deps.now, level: "ok", text: (deps.dryRun ? "Simulation : un commentaire aurait été ajouté" : "Commentaire automatique ajouté") + " sur " + NAME[rule.net] + " (" + media.likes + " likes, seuil " + rule.threshold + ") : " + post.title, postId: post.id });
    } catch (e) {
      // Un refus ne se retente pas en boucle : on marque la règle comme passée pour ce post, et on l'explique.
      post.plugs = Object.assign({}, post.plugs, { [rule.id]: "échec " + deps.now });
      changed.set(post.id, post);
      await deps.log({ at: deps.now, level: "error", text: "Commentaire automatique impossible sur " + NAME[rule.net] + " : " + post.title, why: (e.why || e.message) + " Ajoute-le à la main.", postId: post.id });
    }
  }
  if (changed.size) await deps.save([...changed.values()]);
  return { done, seen: todo.length };
}
