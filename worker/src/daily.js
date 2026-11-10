// Tâches quotidiennes, lancées par le déclencheur planifié une fois par jour (heure du résumé, 8 h par défaut) :
// 1. vérifier les connexions aux réseaux et l'expiration des jetons (alerte 7 jours avant) ;
// 2. envoyer le résumé du matin (légendes à valider, posts à la main, échecs) ;
// 3. sauvegarder les posts et les réglages une fois par semaine.
// La logique pure est ici (testée dans test/daily.test.mjs) ; l'accès à la base est dans index.js.
import Core from "../../web/js/core.js";

export const WARN_DAYS = 7;
const NAMES = { instagram: "Instagram", facebook: "Facebook", threads: "Threads", linkedin: "LinkedIn", x: "X", bluesky: "Bluesky", mastodon: "Mastodon", pinterest: "Pinterest", youtube: "YouTube" };
const nm = (n) => NAMES[n] || n;

// L'heure du jour est-elle venue ? (une seule fois par jour)
export function due(now, settings, lastDay) {
  const n = (settings && settings.notify) || {};
  const t = /^\d{2}:\d{2}$/.test(n.digestTime || "") ? n.digestTime : "08:00";
  return now.slice(0, 10) !== lastDay && now.slice(11, 16) >= t;
}

// Jours restants avant expiration (expires : "AAAA-MM-JJ"), ou null.
export function daysLeft(expires, today) {
  if (!expires) return null;
  return Math.round((Core.parseYmd(expires) - Core.parseYmd(today)) / 864e5);
}

// Alertes de connexion à partir de l'état des comptes : [{ net, level, text }].
export function connectionAlerts(accounts, today) {
  const out = [];
  Object.entries(accounts || {}).forEach(([id, a]) => {
    if (!NAMES[id] || !a) return;
    if (a.status === "error") { out.push({ net: id, level: "error", text: nm(id) + " : connexion cassée. Reconnecte le compte dans Réglages › Comptes." }); return; }
    const d = daysLeft(a.expires, today);
    if (d != null && d <= WARN_DAYS) out.push({ net: id, level: d < 0 ? "error" : "warn", text: d < 0 ? nm(id) + " : le jeton a expiré. Reconnecte le compte dans Réglages › Comptes." : nm(id) + " : le jeton expire " + (d === 0 ? "aujourd'hui" : d === 1 ? "demain" : "dans " + d + " jours") + ". Renouvelle-le dans Réglages › Comptes." });
  });
  return out;
}

// Résumé du matin. Renvoie { title, text, count } ou null s'il n'y a rien à dire.
export function digest(posts, settings, now, alerts) {
  const today = now.slice(0, 10), tomorrow = Core.addDays(today, 1);
  const top = (posts || []).filter((p) => !p.parent);
  const ds = (p) => Core.displayStatus(p, now);
  const review = top.filter((p) => ds(p) === "review" && p.date >= today && p.date <= tomorrow);
  const manual = top.filter((p) => p.date === today && p.manual && p.status === "scheduled");
  const failed = top.filter((p) => ds(p) === "failed" && !p.ignored);
  const planned = top.filter((p) => p.date === today && Core.willSend(p));
  const lines = [];
  if (review.length) lines.push(review.length + (review.length > 1 ? " légendes à valider" : " légende à valider") + " pour aujourd'hui et demain : " + review.slice(0, 4).map((p) => p.time + " " + p.title).join(", ") + (review.length > 4 ? "…" : "") + ".");
  if (manual.length) lines.push(manual.length + (manual.length > 1 ? " posts à publier à la main" : " post à publier à la main") + " : " + manual.map((p) => p.time + " " + p.title).join(", ") + ".");
  if (failed.length) lines.push(failed.length + (failed.length > 1 ? " envois en échec" : " envoi en échec") + " à regarder.");
  (alerts || []).forEach((a) => lines.push(a.text));
  if (!lines.length) return null;
  if (planned.length) lines.push(planned.length + (planned.length > 1 ? " posts partiront" : " post partira") + " tout seul" + (planned.length > 1 ? "s" : "") + " aujourd'hui.");
  const count = review.length + manual.length + failed.length + (alerts || []).length;
  return { title: "PlanneRs · " + count + (count > 1 ? " choses à voir" : " chose à voir") + " aujourd'hui", text: lines.join("\n"), count };
}

// Sauvegarde hebdomadaire : le jour (0 = dimanche … 1 = lundi) est-il venu, et pas encore fait cette semaine ?
export function backupDue(today, settings, lastBackup) {
  const b = (settings && settings.backup) || {};
  if (b.enabled === false) return false;
  const day = b.day == null ? 1 : +b.day;
  if (Core.parseYmd(today).getDay() !== day) return lastBackup ? daysLeft(lastBackup, today) <= -8 : true;
  return lastBackup !== today;
}

// Contenu d'une sauvegarde : posts et réglages (jamais d'identifiants).
export function snapshot(state, now) {
  return { app: "planners", version: 1, at: now, posts: state.posts || [], settings: state.settings || {} };
}

// Jeton Meta (Instagram, Facebook) : date d'expiration via debug_token. "" = n'expire pas.
export async function metaExpiry(graphFn, env, token) {
  const r = await graphFn(env, "GET", "debug_token", { input_token: token }, token);
  const d = r && r.data;
  if (!d) return null;
  if (d.is_valid === false) return "expired";
  const t = d.data_access_expires_at && (!d.expires_at || d.expires_at === 0) ? 0 : d.expires_at;
  return t ? new Date(t * 1000).toISOString().slice(0, 10) : "";
}

// Jeton Threads longue durée : on le renouvelle s'il a plus de 7 jours (il repart pour 60 jours).
export async function refreshThreads(token, fetchFn) {
  const r = await (fetchFn || fetch)("https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=" + encodeURIComponent(token));
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) throw new Error((d.error && d.error.message) || "Renouvellement refusé (" + r.status + ")");
  return { token: d.access_token, expires: new Date(Date.now() + (d.expires_in || 5184000) * 1000).toISOString().slice(0, 10) };
}
