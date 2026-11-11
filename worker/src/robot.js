// Le robot de publication. Appelé toutes les 5 minutes par le déclencheur planifié (cron).
// Toute la logique est ici, sans accès direct à la base : on lui passe des fonctions (deps),
// ce qui permet de la tester sans Cloudflare (voir test/robot.test.mjs).
import Core from "../../web/js/core.js";

export const LATE_LIMIT_MIN = 6 * 60; // au-delà, on n'envoie plus : on signale.

// Heure locale de l'espace, au format "YYYY-MM-DDTHH:MM".
export function localNow(tz, date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz || "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(date || new Date()).reduce((o, p) => ((o[p.type] = p.value), o), {});
  return parts.year + "-" + parts.month + "-" + parts.day + "T" + parts.hour + ":" + parts.minute;
}
const minutesBetween = (a, b) => (Date.parse(b + ":00Z") - Date.parse(a + ":00Z")) / 60000;
const netName = (n) => ({ instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", x: "X", threads: "Threads", bluesky: "Bluesky", mastodon: "Mastodon", pinterest: "Pinterest", youtube: "YouTube" }[n] || n);

/**
 * deps = {
 *   posts, settings, now,                       // état
 *   adapters: { instagram: {publish}, ... },    // modules de publication
 *   cred(network) -> Promise<object|null>,      // identifiants déchiffrés
 *   save(posts[]), log(entry), notify({event,title,text,post})
 *   dryRun: bool
 * }
 */
export async function runRobot(deps) {
  const { settings, now } = deps;
  const rules = settings.rules || {};
  const changed = new Map();
  const touch = (p) => changed.set(p.id, p);
  const summary = { sent: 0, failed: 0, reminded: 0, pending: 0 };
  // Robot à l'arrêt pour cet espace (ex. publications encore faites par un autre outil) : il n'envoie rien,
  // mais les rappels « à poster à la main » continuent.
  const off = rules.robotEnabled === false;
  if (off) summary.off = true;

  for (const p of deps.posts) {
    // 1. Rappels pour les posts à la main (le post entier, ou tous ses réseaux réglés « à la main »).
    const allManual = p.manual || ((p.networks || []).length > 0 && !Core.autoNets(p, settings).length);
    if (allManual && p.status === "scheduled" && p.date && p.time && !p.reminded) {
      const before = (settings.notify && settings.notify.manualReminderMinutes) || 0;
      if (minutesBetween(now, Core.at(p)) <= before && minutesBetween(Core.at(p), now) < 120) {
        p.reminded = true; touch(p); summary.reminded++;
        await deps.notify({ event: "manual", title: "À poster à la main · " + p.time, text: p.title, post: p });
      }
      continue;
    }
    if (allManual) continue;
    // 1 bis. Réseaux « à la main » d'un post qui part aussi en automatique (ex. Instagram auto, X à la main) :
    // un rappel à l'heure, même si le robot est à l'arrêt ou si le post a été publié ailleurs.
    const pm = Core.pendingManual(p, settings);
    if (pm.length && !p.remindedManual && ["scheduled", "published"].includes(p.status) && p.captionValidated && p.date && p.time) {
      const before = (settings.notify && settings.notify.manualReminderMinutes) || 0;
      if (minutesBetween(now, Core.at(p)) <= before && minutesBetween(Core.at(p), now) < 120) {
        p.remindedManual = true; touch(p); summary.reminded++;
        await deps.notify({ event: "manual", title: "À poster à la main sur " + pm.map(netName).join(", ") + " · " + p.time, text: p.title, post: p });
      }
    }
    // Robot à l'arrêt : seuls les réseaux cochés dans « Envoyer quand même vers » partent (ex. TikTok,
    // pendant qu'un autre outil publie encore Instagram). Le statut du post n'est pas touché.
    const only = off ? (rules.robotNets || []) : null;
    if (off && !only.length) continue;
    // 2. Posts automatiques arrivés à l'heure (ou un envoi en cours).
    const due = Core.willSend(p) && Core.at(p) <= now;
    if (!due) continue;
    const late = minutesBetween(Core.at(p), now);
    if (off) {
      const res = p.results || {}, job = p.job || {};
      const nets = Core.autoNets(p, settings).filter((n) => only.includes(n) && (!res[n] || job[n]));
      if (!nets.length) continue;
      if (late > LATE_LIMIT_MIN && !nets.some((n) => job[n])) {
        p.results = res;
        nets.forEach((n) => { res[n] = { status: "failed", error: "Heure passée depuis plus de 6 h : rien envoyé." }; });
        p.needsAttention = true; touch(p); summary.failed++;
        await deps.log({ at: now, level: "error", text: "Pas envoyé à temps sur " + nets.map(netName).join(", ") + " : " + p.title, postId: p.id });
        continue;
      }
      await sendPost(p, deps, rules, summary, nets, true);
      touch(p);
      continue;
    }
    if (late > LATE_LIMIT_MIN && !p.job) {
      p.status = "failed"; touch(p); summary.failed++;
      p.failure = { what: "Rien n'a été envoyé : l'heure prévue est passée depuis plus de 6 h.", why: "Le robot n'a pas pu passer à temps (serveur arrêté ou en panne).", todo: "Reprogramme-le ou poste-le à la main." };
      await deps.log({ at: now, level: "error", text: "Pas envoyé à temps : " + p.title, postId: p.id });
      continue;
    }
    await sendPost(p, deps, rules, summary);
    touch(p);
  }
  if (changed.size) await deps.save([...changed.values()]);
  return summary;
}

// Envoie un post : d'abord le réseau principal (le premier), puis les relais.
export async function sendPost(p, deps, rules, summary, onlyNets, partial) {
  const { now } = deps;
  p.results = p.results || {};
  // Les réseaux « à la main » ne partent jamais par le robot ; le principal est le premier réseau automatique.
  const auto = Core.autoNets(p, deps.settings), lead = auto[0];
  const nets = auto.filter((n) => !onlyNets || onlyNets.includes(n));
  // Médias sans adresse publique : copie automatique vers l'hébergement public (si configuré).
  if (!deps.dryRun && deps.ensurePublic && (p.media || []).some((m) => !/^https:\/\//.test(m.url || "") && m.role !== "guide")) {
    try { await deps.ensurePublic(p); }
    catch (e) {
      const n0 = lead;
      if (e.retryable !== false && !(p.attempts > 0)) {
        p.attempts = 1;
        await deps.log({ at: now, level: "error", text: "Médias pas encore prêts pour « " + p.title + " » : nouvel essai au prochain passage.", why: e.why || e.message, postId: p.id });
        return;
      }
      if (partial) {
        nets.forEach((n) => { p.results[n] = { status: "failed", error: e.why || e.message }; });
        p.needsAttention = true; summary.failed++;
        p.failure = { what: "Pas publié sur " + nets.map(netName).join(", ") + ".", why: e.why || e.message, todo: e.todo || "Corrige le média, puis reprogramme-le." };
        await deps.log({ at: now, level: "error", text: "Médias refusés pour « " + p.title + " ».", why: e.why || e.message, postId: p.id });
        return deps.notify({ event: "failed", title: "Échec : " + p.title, text: p.failure.what + " " + p.failure.todo, post: p });
      }
      p.results[n0] = { status: "failed", error: e.why || e.message };
      return fail(p, deps, summary, n0, e);
    }
  }
  for (let i = 0; i < nets.length; i++) {
    const n = nets[i];
    const primary = !partial && n === lead;
    if (p.results[n] && p.results[n].status === "ok") continue;
    const ad = deps.adapters[n];
    const cred = ad ? await deps.cred(n) : null;
    if (!ad || !cred) {
      const why = ad ? netName(n) + " n'est pas connecté dans Réglages › Comptes." : "Aucun module de publication pour ce réseau.";
      p.results[n] = { status: "skipped", error: why + " À poster à la main." };
      if (primary) return fail(p, deps, summary, n, { message: netName(n) + " n'est pas publié automatiquement.", why, todo: "Connecte le compte, ou poste-le à la main.", retryable: false });
      p.needsAttention = true;
      continue;
    }
    try {
      if (deps.dryRun) {
        p.results[n] = { status: "ok", simulated: true };
        await deps.log({ at: now, level: "ok", text: "Simulation : " + p.title + " aurait été publié sur " + netName(n) + (p.firstComment && ad.comment && p.format !== "story" ? ", avec son premier commentaire" : "") + ".", postId: p.id });
        continue;
      }
      // Légende propre à ce réseau si elle existe.
      const pn = Object.assign({}, p, { caption: Core.textOut(p, n, deps.settings) });
      const r = await ad.publish(deps.env, pn, cred, p.job && p.job[n], deps.saveCred ? (c) => deps.saveCred(n, c) : null);
      if (r.status === "pending") {
        p.job = Object.assign({}, p.job, { [n]: r.job }); summary.pending++;
        await deps.log({ at: now, level: "info", text: netName(n) + " prépare encore le média de « " + p.title + " » : envoi au prochain passage.", postId: p.id });
        return; // on reprend au prochain passage, sans envoyer les relais avant
      }
      p.results[n] = { status: "ok", url: r.url || "", id: r.id || "" };
      if (r.draft) p.results[n].draft = true;
      if (p.job) delete p.job[n];
      if (primary && r.url) p.url = r.url;
      await deps.log({ at: now, level: "ok", text: (r.draft ? "Envoyé dans les brouillons " + netName(n) + " (à publier depuis l'appli) : " : "Publié sur " + netName(n) + " : ") + p.title, postId: p.id });
      // Premier commentaire (option du post) : un refus ne remet pas la publication en cause.
      const fc = Core.utm((p.firstComment || "").trim(), n, p, deps.settings);
      if (fc && r.id && ad.comment && p.format !== "story") {
        try { await ad.comment(deps.env, r.id, fc, cred); p.results[n].comment = true; await deps.log({ at: now, level: "ok", text: "Premier commentaire ajouté sur " + netName(n) + " : " + p.title, postId: p.id }); }
        catch (e) { p.results[n].comment = false; await deps.log({ at: now, level: "error", text: "Premier commentaire impossible sur " + netName(n) + " : " + p.title, why: (e.why || e.message) + " Ajoute-le à la main.", postId: p.id }); }
      }
    } catch (e) {
      p.results[n] = { status: "failed", code: e.code || "", error: e.why || e.message };
      if (primary) {
        // Un seul nouvel essai automatique, au passage suivant, si l'erreur s'y prête.
        if (e.retryable !== false && !(p.attempts > 0)) {
          p.attempts = 1;
          await deps.log({ at: now, level: "error", text: netName(n) + " a refusé « " + p.title + " » : nouvel essai au prochain passage.", why: e.why || e.message, postId: p.id });
          return;
        }
        return fail(p, deps, summary, n, e);
      }
      if (partial) {
        // Réseau envoyé seul (robot à l'arrêt pour les autres) : un nouvel essai si l'erreur s'y prête.
        p.tries = p.tries || {};
        if (e.retryable !== false && !p.tries[n]) {
          p.tries[n] = 1; delete p.results[n];
          await deps.log({ at: now, level: "error", text: netName(n) + " a refusé « " + p.title + " » : nouvel essai au prochain passage.", why: e.why || e.message, postId: p.id });
          continue;
        }
        p.needsAttention = true; summary.failed++;
        p.failure = { what: "Pas publié sur " + netName(n) + ".", why: e.why || e.message, todo: e.todo || "Réessaie, ou poste-le à la main." };
        await deps.log({ at: now, level: "error", text: netName(n) + " a refusé « " + p.title + " ».", why: (e.code ? "Erreur " + e.code + " : " : "") + (e.why || e.message), postId: p.id });
        await deps.notify({ event: "failed", title: "Échec : " + p.title, text: p.failure.what + " " + p.failure.todo, post: p });
        continue;
      }
      // Relais en échec : le principal est publié, on ne relance pas (évite les doublons).
      p.needsAttention = true;
      p.failure = { what: "Publié sur " + netName(lead) + ", mais pas sur " + netName(n) + ".", why: e.why || e.message, todo: rules.noRetryRelay ? "Publie-le à la main sur " + netName(n) + " : relancer créerait un doublon." : (e.todo || "Réessaie.") };
      await deps.log({ at: now, level: "error", text: "Relais " + netName(n) + " en échec : " + p.title, why: e.why || e.message, postId: p.id });
      await deps.notify({ event: "failed", title: "Relais " + netName(n) + " en échec", text: p.title + " : " + p.failure.todo, post: p });
    }
  }
  const allOk = auto.every((n) => p.results[n] && ["ok", "skipped"].includes(p.results[n].status));
  if (partial) {
    if (auto.every((n) => p.results[n] && p.results[n].status === "ok")) { p.status = "published"; p.stage = "published"; delete p.job; }
    if (nets.some((n) => p.results[n] && p.results[n].status === "ok")) summary.sent++;
    return;
  }
  if (lead && p.results[lead] && p.results[lead].status === "ok") {
    p.status = "published"; p.stage = "published"; delete p.job; summary.sent++;
    if (allOk && !Object.values(p.results).some((r) => r.status === "skipped")) { delete p.failure; p.needsAttention = false; }
  }
}

async function fail(p, deps, summary, n, e) {
  p.status = "failed"; summary.failed++;
  Core.autoNets(p, deps.settings).forEach((m) => { if (m !== n && !p.results[m]) p.results[m] = { status: "skipped", error: "Non tenté : il part après " + netName(n) + "." }; });
  p.failure = { what: netName(n) + " a refusé la publication.", why: e.why || e.message, todo: e.todo || "Réessaie, ou poste-le à la main." };
  await deps.log({ at: deps.now, level: "error", text: netName(n) + " a refusé « " + p.title + " ».", why: (e.code ? "Erreur " + e.code + " : " : "") + (e.why || e.message), postId: p.id });
  await deps.notify({ event: "failed", title: "Échec : " + p.title, text: p.failure.what + " " + p.failure.todo, post: p });
}
