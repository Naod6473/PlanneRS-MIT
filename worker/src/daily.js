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
    if (a.status === "expired") { out.push({ net: id, level: "error", text: nm(id) + " : la connexion " + (a.provider === "postiz" ? "Postiz" : a.provider === "composio" ? "Composio" : "") + " a expiré. Reconnecte-toi dans Réglages › Comptes (bouton « Se reconnecter »)." }); return; }
    if (a.status === "error") { out.push({ net: id, level: "error", text: nm(id) + " : connexion cassée. Reconnecte le compte dans Réglages › Comptes." }); return; }
    if (a.missing && a.missing.length) out.push({ net: id, level: "warn", text: nm(id) + " : il manque " + (a.missing.length > 1 ? "les droits " : "le droit ") + a.missing.join(", ") + ". Refais l'assistant dans Réglages › Comptes." });
    const da = daysLeft(a.dataAccess, today);
    if (da != null && da <= WARN_DAYS) out.push({ net: id, level: da < 0 ? "error" : "warn", text: nm(id) + " : l'accès aux données Meta " + (da < 0 ? "a pris fin" : "prend fin " + (da === 0 ? "aujourd'hui" : da === 1 ? "demain" : "dans " + da + " jours")) + ". Reconnecte-toi une fois avec l'assistant (Réglages › Comptes) pour le prolonger de 90 jours." });
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
  return (await metaToken(graphFn, env, token)).exp;
}
// Droits indispensables par réseau (vérifiés chaque jour sur le jeton).
export const META_NEEDS = { instagram: ["instagram_basic", "instagram_content_publish"], facebook: ["pages_manage_posts", "pages_read_engagement"] };
// Jeton Meta : expiration, fin de l'accès aux données (renouvelé à chaque connexion, 90 jours) et droits accordés.
export async function metaToken(graphFn, env, token) {
  const r = await graphFn(env, "GET", "debug_token", { input_token: token }, token);
  const d = r && r.data;
  if (!d) return { exp: null };
  if (d.is_valid === false) return { exp: "expired" };
  const day = (t) => (t ? new Date(t * 1000).toISOString().slice(0, 10) : "");
  const t = d.data_access_expires_at && (!d.expires_at || d.expires_at === 0) ? 0 : d.expires_at;
  return { exp: day(t), data: day(d.data_access_expires_at), scopes: Array.isArray(d.scopes) ? d.scopes : null };
}

// Jeton Threads longue durée : on le renouvelle s'il a plus de 7 jours (il repart pour 60 jours).
export async function refreshThreads(token, fetchFn) {
  const r = await (fetchFn || fetch)("https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=" + encodeURIComponent(token));
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) throw new Error((d.error && d.error.message) || "Renouvellement refusé (" + r.status + ")");
  return { token: d.access_token, expires: new Date(Date.now() + (d.expires_in || 5184000) * 1000).toISOString().slice(0, 10) };
}

// Bilan du dimanche soir : la semaine écoulée, et ce qui attend la semaine prochaine.
export function weeklyDue(now, settings, lastDay) {
  const n = (settings && settings.notify) || {};
  if (n.weekly === false) return false;
  const t = /^\d{2}:\d{2}$/.test(n.weeklyTime || "") ? n.weeklyTime : "19:00";
  const today = now.slice(0, 10);
  return Core.parseYmd(today).getDay() === 0 && today !== lastDay && now.slice(11, 16) >= t;
}

const plural = (n, one, many) => n + " " + (n > 1 ? many : one);
const dayName = (d) => ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"][Core.parseYmd(d).getDay()];

export function weekly(posts, stats, settings, now, mediaKeyFn, accounts) {
  const today = now.slice(0, 10), from = Core.addDays(today, -6), next1 = Core.addDays(today, 1), next7 = Core.addDays(today, 7);
  const top = (posts || []).filter((p) => !p.parent);
  const past = top.filter((p) => p.date && p.date >= from && p.date <= today);
  const done = past.filter((p) => p.status === "published");
  const missed = past.filter((p) => p.status !== "published" && p.status !== "draft" && !p.ignored && ["failed", "late"].includes(Core.displayStatus(p, now)));
  const lines = ["Cette semaine : " + plural(done.length, "publication", "publications") + (missed.length ? ", " + plural(missed.length, "post manqué ou en échec", "posts manqués ou en échec") : "") + "."];
  const ig = stats && stats.instagram, hist = (stats && stats.history) || [];
  const first = hist.find((h) => h.d >= from && h.ig != null), last = hist.slice().reverse().find((h) => h.ig != null);
  if (first && last && last.d > first.d) { const g = last.ig - first.ig; lines.push("Abonnés Instagram : " + last.ig + " (" + (g >= 0 ? "+" : "") + g + " en 7 jours)."); }
  const reach = hist.filter((h) => h.d >= from && h.igReach != null).reduce((a, h) => a + h.igReach, 0);
  if (reach) lines.push("Comptes touchés : " + reach + ".");
  const byKey = {}; top.forEach((p) => { const k = mediaKeyFn && mediaKeyFn(p.url); if (k) byKey[k] = p; });
  const best = ((ig && ig.media) || []).filter((m) => m.at && m.at.slice(0, 10) >= from && (m.views || m.reach)).sort((a, b) => (b.views || b.reach || 0) - (a.views || a.reach || 0)).slice(0, 3);
  if (best.length) lines.push("Le top : " + best.map((m) => { const p = byKey[m.key]; return (p ? p.title : (Core.FORMATS[m.kind] || "Post") + " du " + m.at.slice(8, 10) + "/" + m.at.slice(5, 7)) + " (" + (m.views ? m.views + " vues" : m.reach + " comptes") + ")"; }).join(", ") + ".");
  const coming = top.filter((p) => p.date && p.date >= next1 && p.date <= next7 && p.status !== "draft");
  const review = coming.filter((p) => Core.displayStatus(p, now) === "review"), manual = coming.filter((p) => p.manual && p.status !== "published");
  lines.push("Semaine prochaine : " + plural(coming.length, "post prévu", "posts prévus") + (review.length ? ", dont " + plural(review.length, "légende à valider", "légendes à valider") : "") + (manual.length ? ", " + plural(manual.length, "post à faire à la main", "posts à faire à la main") : "") + ".");
  const empty = []; for (let d = next1; d <= next7; d = Core.addDays(d, 1)) if (!coming.some((p) => p.date === d)) empty.push(dayName(d));
  if (empty.length) lines.push("Rien de prévu " + (empty.length > 1 ? "les jours suivants : " : "") + empty.join(", ") + ".");
  // Santé des comptes : une ligne, ou le détail de ce qui cloche.
  if (accounts) {
    const on = Object.entries(accounts).filter(([id, a]) => NAMES[id] && a && a.status !== "manual" && a.status !== "pending");
    const al = connectionAlerts(accounts, today);
    if (on.length) lines.push(al.length ? "Comptes à surveiller :\n" + al.map((x) => "- " + x.text).join("\n") : "Comptes : " + plural(on.length, "compte vérifié", "comptes vérifiés") + ", tout va bien.");
  }
  return { title: "PlanneRs · ta semaine", text: lines.join("\n") };
}
