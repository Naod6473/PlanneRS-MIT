// Serveur MCP (Model Context Protocol) de PlanneRs, à l'adresse /mcp.
// Il permet à un assistant IA (Claude, Codex, ChatGPT…) de lire le planning, créer et modifier des posts,
// commenter et valider des légendes. Transport « Streamable HTTP » sans session : une requête JSON-RPC
// en POST, une réponse JSON. L'accès passe par Cloudflare Access, comme le reste de l'application
// (connexion OAuth gérée par Access, ou jeton de service) : voir docs/reference/assistants-ia.md.
// La logique ne touche pas directement à la base : on lui passe des fonctions (deps), pour les tests.
import Core from "../../web/js/core.js";

const PROTOCOL = "2025-06-18";
const FORMATS = Object.keys(Core.FORMATS);

// Vue courte d'un post, pour les listes.
function brief(p, now) {
  return {
    id: p.id, ref: p.ref || undefined, title: p.title, format: p.format, networks: p.networks,
    date: p.date || null, time: p.time || null, status: Core.displayStatus(p, now),
    captionValidated: !!p.captionValidated, manual: !!p.manual || undefined,
    caption: (p.caption || "").slice(0, 160) + ((p.caption || "").length > 160 ? "…" : ""),
    comments: (p.comments || []).length || undefined, parent: p.parent || undefined,
  };
}
function full(p, now, settings) {
  const o = Object.assign({}, p, { status: Core.displayStatus(p, now) });
  delete o.job;
  o.checks = Core.checks(p, settings).filter((c) => c.level !== "ok").map((c) => c.level + " : " + c.text);
  return o;
}

const S = (props, required) => ({ type: "object", properties: props, required: required || [], additionalProperties: false });
const str = (d) => ({ type: "string", description: d });
const DATE = str("Date AAAA-MM-JJ"), TIME = str("Heure HH:MM (heure locale de l'espace)");
const NETS = { type: "array", items: { type: "string" }, description: "Réseaux : instagram, facebook, linkedin, x, threads, bluesky, mastodon, tiktok, youtube, pinterest" };

export const TOOLS = [
  { name: "planners_today", title: "Aujourd'hui", description: "Résumé de ce qui demande attention : échecs, retards, manqués, légendes à valider (14 jours), posts à la main du jour, et le programme des 7 prochains jours.", inputSchema: S({}), annotations: { readOnlyHint: true } },
  { name: "planners_list_posts", title: "Lister les posts", description: "Liste les posts, filtrés par période, statut ou texte. Statuts : draft, ready, review (à valider), scheduled, manual, late, failed, published.", inputSchema: S({ from: DATE, to: DATE, status: str("Statut affiché à filtrer"), query: str("Texte cherché dans le titre, la référence ou la légende"), limit: { type: "integer", minimum: 1, maximum: 200 } }), annotations: { readOnlyHint: true } },
  { name: "planners_get_post", title: "Lire un post", description: "Tout le détail d'un post : légende(s), médias, commentaires, contrôles avant envoi.", inputSchema: S({ id: str("Identifiant du post") }, ["id"]), annotations: { readOnlyHint: true } },
  { name: "planners_create_post", title: "Créer un post", description: "Crée un post. Sans date : il va dans les idées (ou « prêt » s'il a une légende). Avec date et heure : il est programmé, mais ne part pas tant que la légende n'est pas validée.", inputSchema: S({ title: str("Titre (pour soi, pas publié)"), format: { type: "string", enum: FORMATS }, networks: NETS, date: DATE, time: TIME, caption: str("Légende commune"), note: str("Consigne (stories) ou note") }, ["title"]) },
  { name: "planners_update_post", title: "Modifier un post", description: "Modifie un post pas encore publié. Changer une légende retire sa validation. « captions » donne une version par réseau (vide = légende commune).", inputSchema: S({ id: str("Identifiant du post"), title: str("Titre"), format: { type: "string", enum: FORMATS }, networks: NETS, date: { type: ["string", "null"], description: "AAAA-MM-JJ, ou null pour retirer du calendrier" }, time: TIME, caption: str("Légende commune"), captions: { type: "object", additionalProperties: { type: "string" }, description: "Légende par réseau, ex. {\"x\": \"…\"}" }, manual: { type: "boolean", description: "Publier à la main (rappel) au lieu d'un envoi automatique" }, alt: str("Description des images (texte alternatif, accessibilité)"), firstComment: str("Premier commentaire posté juste après la publication (Instagram, Facebook) ; vide pour l'enlever") }, ["id"]) },
  { name: "planners_validate_caption", title: "Valider une légende", description: "Valide la légende d'un post : il partira tout seul à l'heure prévue (sauf publication à la main). Refusé si un contrôle bloque (média manquant, trop de hashtags…) ou si l'espace réserve la validation aux humains (Réglages › Espace › Assistant IA).", inputSchema: S({ id: str("Identifiant du post") }, ["id"]) },
  { name: "planners_unvalidate_caption", title: "Retirer une validation", description: "Retire la validation d'une légende : le post ne partira pas.", inputSchema: S({ id: str("Identifiant du post") }, ["id"]) },
  { name: "planners_comment", title: "Commenter un post", description: "Ajoute un commentaire sur un post (visible dans sa fiche).", inputSchema: S({ id: str("Identifiant du post"), text: str("Commentaire") }, ["id", "text"]) },
  { name: "planners_settings", title: "Réglages utiles", description: "Créneaux habituels, réseaux, règles d'envoi, modèles (signature, hashtags) et comptes connectés (sans identifiants).", inputSchema: S({}), annotations: { readOnlyHint: true } },
  { name: "planners_add_media", title: "Ajouter un média", description: "Ajoute une image ou une vidéo à un post, par son adresse publique https (hébergement, lien de stockage déjà partagé…). Instagram exige un média.", inputSchema: S({ id: str("Identifiant du post"), url: str("Adresse https du fichier"), type: { type: "string", enum: ["image", "video"] }, name: str("Nom affiché (facultatif)"), alt: str("Description de l'image (texte alternatif)") }, ["id", "url"]) },
  { name: "planners_remove_media", title: "Retirer un média", description: "Retire un média d'un post (numéro dans la liste, à partir de 0).", inputSchema: S({ id: str("Identifiant du post"), index: { type: "integer", minimum: 0 } }, ["id", "index"]) },
  { name: "planners_delete_post", title: "Supprimer un post", description: "Supprime un post pas encore publié (et ses stories liées). Le journal garde une trace.", inputSchema: S({ id: str("Identifiant du post") }, ["id"]), annotations: { destructiveHint: true } },
  { name: "planners_update_settings", title: "Modifier les réglages", description: "Change les créneaux habituels et les modèles (signature, groupes de hashtags). Les comptes connectés et les droits ne se changent que dans l'application.", inputSchema: S({ slots: { type: "array", items: { type: "object", properties: { time: TIME, label: { type: "string" } }, required: ["time"] }, description: "Créneaux habituels, ex. [{\"time\":\"12:30\",\"label\":\"Midi\"}]" }, signature: str("Signature ajoutée en fin de légende"), hashtagGroups: { type: "array", items: { type: "object", properties: { name: { type: "string" }, text: { type: "string" } }, required: ["name", "text"] } } }) },
  { name: "planners_fabrique", title: "La Fabrique", description: "Les vidéos en cours de production (Reels et vidéos pas encore publiés) : étape en cours (script, voix, montage, sous-titres, relu), qui y travaille, durée du storyboard.", inputSchema: S({}), annotations: { readOnlyHint: true } },
  { name: "planners_production", title: "Avancer une vidéo", description: "Met à jour la fabrication d'une vidéo, affichée en direct dans La Fabrique : une étape (script, voice, edit, subs, check) passe à todo, doing ou done, avec qui y travaille (ex. « Claude · Monteur ») et une note ; le storyboard plan par plan ; la vidéo finie (adresse https, ajoutée aux médias). Ne valide jamais la légende.", inputSchema: S({ id: str("Identifiant du post"), step: { type: "string", enum: ["script", "voice", "edit", "subs", "check"] }, state: { type: "string", enum: ["todo", "doing", "done"] }, role: { type: "string", enum: ["script", "voice", "edit", "subs", "caption", "check"], description: "Ton rôle dans l'équipe (voir planners_team) : signe l'étape « Claude · <rôle> »" }, by: str("Qui travaille sur l'étape (ex. « Claude · Monteur »), si pas de rôle"), note: str("Note courte sur l'étape"), shots: { type: "array", description: "Storyboard, dans l'ordre : un objet par plan", items: { type: "object", properties: { dur: { type: "number", description: "Durée en secondes" }, screen: { type: "string", description: "Texte à l'écran" }, voice: { type: "string", description: "Réplique de la voix" }, visual: { type: "string", description: "Image ou plan filmé" }, music: { type: "string", description: "Musique ou bruitage" } } } }, maxSec: { type: "integer", minimum: 5, maximum: 600, description: "Durée maximale voulue (alerte au-delà), 30 par défaut" }, videoUrl: str("Adresse https de la vidéo finie") }, ["id"]) },
  { name: "planners_team", title: "L'équipe", description: "Les rôles de l'équipe qui fabrique les vidéos (Scénariste, Voix, Monteur, Sous-titres, Légendes, Contrôle qualité) : leurs consignes, qui les tient (Claude par MCP, clé API ou une personne) et les étapes qu'ils font. Lis-les avant de travailler sur une vidéo, puis passe « role » à planners_production.", inputSchema: S({}), annotations: { readOnlyHint: true } },
  { name: "planners_pepites", title: "Pépites", description: "Les publications des comptes suivis (Réglages des Pépites, 5 au plus) qui marchent bien mieux que d'habitude : score = fois la médiane du compte. Pour t'inspirer de la recette (accroche, structure, format), jamais pour copier : crée ensuite une idée avec planners_create_post en citant le lien d'origine dans la note.", inputSchema: S({}), annotations: { readOnlyHint: true } },
  { name: "planners_activity", title: "Journal", description: "Les dernières lignes du journal : envois, échecs, modifications.", inputSchema: S({ limit: { type: "integer", minimum: 1, maximum: 100 } }), annotations: { readOnlyHint: true } },
  { name: "planners_stats", title: "Statistiques", description: "Derniers chiffres relevés : abonnés, vues, et les publications récentes les plus vues.", inputSchema: S({}), annotations: { readOnlyHint: true } },
];

class ToolError extends Error {}
const need = (c, msg) => { if (!c) throw new ToolError(msg); };
const okDate = (d) => d == null || /^\d{4}-\d{2}-\d{2}$/.test(d);
const okTime = (t) => t == null || /^\d{2}:\d{2}$/.test(t);

// deps : { state() -> {posts, settings, accounts, stats}, save(posts), log(entry), now, me, canValidate() }
export async function callTool(name, args, deps) {
  args = args || {};
  const st = await deps.state();
  const set = st.settings || {}, now = deps.now, today = now.slice(0, 10);
  const posts = st.posts || [];
  const get = (id) => { const p = posts.find((x) => x.id === id); need(p, "Post introuvable : " + id); return p; };
  const who = deps.who || (deps.me ? " (assistant IA, " + deps.me + ")" : " (assistant IA)");
  const top = posts.filter((p) => !p.parent);

  switch (name) {
    case "planners_today": {
      const ds = (p) => Core.displayStatus(p, now);
      const in14 = Core.addDays(today, 14), in7 = Core.addDays(today, 6);
      return {
        failed: top.filter((p) => ds(p) === "failed" && !p.ignored).map((p) => brief(p, now)),
        late: top.filter((p) => ds(p) === "late" && !p.ignored && !Core.missed(p, now)).map((p) => brief(p, now)),
        missed: top.filter((p) => Core.missed(p, now) && !p.ignored).length,
        toValidate: top.filter((p) => ds(p) === "review" && p.date >= today && p.date <= in14).sort((a, b) => Core.at(a).localeCompare(Core.at(b))).map((p) => brief(p, now)),
        manualToday: top.filter((p) => p.date === today && ds(p) === "manual").map((p) => brief(p, now)),
        next7days: top.filter((p) => p.date >= today && p.date <= in7).sort((a, b) => Core.at(a).localeCompare(Core.at(b))).map((p) => brief(p, now)),
        now,
      };
    }
    case "planners_list_posts": {
      const q = (args.query || "").toLowerCase();
      const list = top.filter((p) => (!args.from || (p.date && p.date >= args.from)) && (!args.to || (p.date && p.date <= args.to)) &&
        (!args.status || Core.displayStatus(p, now) === args.status) &&
        (!q || [p.title, p.ref, p.caption].some((x) => (x || "").toLowerCase().includes(q))))
        .sort((a, b) => (Core.at(a) || "9").localeCompare(Core.at(b) || "9"));
      const lim = Math.min(200, args.limit || 50);
      return { total: list.length, posts: list.slice(0, lim).map((p) => brief(p, now)) };
    }
    case "planners_get_post": return full(get(args.id), now, set);
    case "planners_settings":
      return {
        workspace: (set.workspace || {}).name, timezone: set.timezone, slots: set.slots, networks: set.networks, rules: set.rules, templates: set.templates || {},
        validators: (set.team || {}).validators || [], accounts: Object.fromEntries(Object.entries(st.accounts || {}).map(([k, a]) => [k, { status: a.status, account: a.account }])),
      };
    case "planners_stats": {
      const s = st.stats || {}, ig = s.instagram || {}, fb = s.facebook || {};
      const media = [].concat(ig.media || [], fb.media || []).filter((m) => m.views != null).sort((a, b) => b.views - a.views).slice(0, 10);
      return { updated: s.updated || null, instagramFollowers: (ig.account || {}).followers, facebookFollowers: (fb.account || {}).followers, week: ig.week || null, top: media };
    }
    case "planners_create_post": {
      need((args.title || "").trim(), "Le titre est obligatoire.");
      need(okDate(args.date) && okTime(args.time), "Date (AAAA-MM-JJ) ou heure (HH:MM) illisible.");
      need(!args.format || FORMATS.includes(args.format), "Format inconnu.");
      const dated = !!args.date;
      const p = {
        id: "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ref: "", title: args.title.trim(),
        format: args.format || "image", networks: args.networks && args.networks.length ? args.networks : [(set.networks || ["instagram"])[0]],
        date: dated ? args.date : null, time: dated ? args.time || ((set.slots || [])[0] || {}).time || "12:00" : null,
        caption: args.caption || "", captionValidated: false, manual: false, media: [], note: args.note || undefined,
        stage: dated ? "scheduled" : args.caption ? "ready" : "idea", status: dated ? "scheduled" : args.caption ? "ready" : "draft",
      };
      await deps.save([p]); await deps.log({ at: now, level: "change", text: "Post créé" + who + " : " + p.title, postId: p.id });
      return { created: brief(p, now), note: dated ? "Programmé, mais il ne partira qu'une fois la légende validée." : "Pas encore daté." };
    }
    case "planners_update_post": {
      const p = get(args.id);
      need(p.status !== "published", "Ce post est déjà publié.");
      need(okDate(args.date) && okTime(args.time), "Date (AAAA-MM-JJ) ou heure (HH:MM) illisible.");
      need(!args.format || FORMATS.includes(args.format), "Format inconnu.");
      const changed = [];
      ["title", "format", "manual", "alt", "firstComment"].forEach((k) => { if (args[k] !== undefined) { p[k] = args[k]; changed.push(k); } });
      if (args.networks && args.networks.length) { p.networks = args.networks; changed.push("networks"); }
      if (args.date !== undefined) { p.date = args.date; if (!args.date) p.time = null; changed.push("date"); if (p.status === "draft" || p.status === "ready") p.status = args.date ? "scheduled" : p.status; if (args.date === null && p.status === "scheduled") p.status = "ready"; }
      if (args.time !== undefined && p.date) { p.time = args.time; changed.push("time"); }
      let capChanged = false;
      if (args.caption !== undefined && args.caption !== p.caption) { p.caption = args.caption; capChanged = true; }
      if (args.captions !== undefined) {
        const own = {}; Object.entries(args.captions || {}).forEach(([n, c]) => { if ((c || "").trim()) own[n] = c; });
        if (JSON.stringify(own) !== JSON.stringify(p.captions || {})) { if (Object.keys(own).length) p.captions = own; else delete p.captions; capChanged = true; }
      }
      if (capChanged) { p.captionValidated = false; delete p.linkCheck; changed.push("caption"); }
      need(changed.length, "Rien à modifier.");
      await deps.save([p]); await deps.log({ at: now, level: "change", text: "Post modifié" + who + " : " + p.title + " (" + changed.join(", ") + ")" + (capChanged ? ", légende à valider" : ""), postId: p.id });
      return { updated: brief(p, now), changed };
    }
    case "planners_validate_caption": {
      const p = get(args.id);
      need((set.ai || {}).validate === true, "Dans cet espace, ce sont les humains qui valident les légendes : prépare le post, il apparaîtra dans « À valider ». (Réglage : Réglages › Espace › Assistant IA.)");
      need(await deps.canValidate(), "Seuls les validateurs désignés peuvent valider (Réglages › Espace).");
      need(p.status !== "published", "Ce post est déjà publié.");
      const block = Core.checks(Object.assign({}, p, { captionValidated: true }), set).filter((c) => c.level === "block");
      need(!block.length, "Validation refusée : " + block.map((c) => c.text).join(" "));
      p.captionValidated = true; if (p.stage === "caption") p.stage = "ready";
      await deps.save([p]); await deps.log({ at: now, level: "change", text: "Légende validée" + who + " : " + p.title, postId: p.id });
      return { validated: brief(p, now), willSend: Core.willSend(p) };
    }
    case "planners_unvalidate_caption": {
      const p = get(args.id);
      p.captionValidated = false;
      await deps.save([p]); await deps.log({ at: now, level: "change", text: "Validation retirée" + who + " : " + p.title, postId: p.id });
      return { post: brief(p, now) };
    }
    case "planners_add_media": {
      const p = get(args.id), u = String(args.url || "").trim();
      need(p.status !== "published", "Ce post est déjà publié.");
      need(/^https:\/\/[^\s]+$/.test(u), "Il faut une adresse https publique.");
      const type = args.type || (/\.(mp4|mov|webm)(\?|$)/i.test(u) ? "video" : "image");
      const nm = (args.name || "").trim() || decodeURIComponent(u.split("?")[0].split("/").pop() || "media");
      (p.media = p.media || []).push(Object.assign({ name: nm.slice(0, 200), type, url: u }, args.alt ? { alt: String(args.alt).slice(0, 1000) } : {}));
      if (p.stage === "idea" || p.stage === "writing") p.stage = "media";
      await deps.save([p]); await deps.log({ at: now, level: "change", text: "Média ajouté" + who + " : " + p.title + " (" + nm + ")", postId: p.id });
      return { media: p.media.map((m, i) => ({ index: i, name: m.name, type: m.type, url: m.url })) };
    }
    case "planners_remove_media": {
      const p = get(args.id), m = (p.media || [])[args.index];
      need(p.status !== "published", "Ce post est déjà publié.");
      need(m, "Pas de média à ce numéro.");
      p.media.splice(args.index, 1);
      await deps.save([p]); await deps.log({ at: now, level: "change", text: "Média retiré" + who + " : " + p.title + " (" + m.name + ")", postId: p.id });
      return { media: p.media.map((x, i) => ({ index: i, name: x.name, type: x.type, url: x.url })) };
    }
    case "planners_delete_post": {
      const p = get(args.id);
      need(p.status !== "published", "Un post publié ne se supprime pas d'ici.");
      need(deps.remove, "Suppression indisponible.");
      await deps.remove(p.id);
      await deps.log({ at: now, level: "change", text: "Post supprimé" + who + " : " + p.title + (p.date ? " (prévu " + p.date + " " + (p.time || "") + ")" : ""), why: JSON.stringify(p).slice(0, 1900) });
      return { deleted: p.id };
    }
    case "planners_update_settings": {
      need(deps.saveSettings, "Réglages indisponibles.");
      const s2 = Object.assign({}, set), changed = [];
      if (args.slots) {
        need(args.slots.every((x) => x && okTime(x.time) && x.time), "Créneau illisible (HH:MM).");
        s2.slots = args.slots.map((x) => ({ time: x.time, label: String(x.label || "").slice(0, 40) })).sort((a, b) => a.time.localeCompare(b.time)); changed.push("créneaux");
      }
      if (args.signature !== undefined || args.hashtagGroups) {
        const t = Object.assign({}, s2.templates);
        if (args.signature !== undefined) t.signature = String(args.signature).slice(0, 500);
        if (args.hashtagGroups) t.tags = args.hashtagGroups.map((g) => ({ name: String(g.name).slice(0, 60), text: String(g.text).slice(0, 1000) }));
        s2.templates = t; changed.push("modèles");
      }
      need(changed.length, "Rien à modifier.");
      await deps.saveSettings(s2); await deps.log({ at: now, level: "change", text: "Réglages modifiés" + who + " : " + changed.join(", ") });
      return { slots: s2.slots, templates: s2.templates || {} };
    }
    case "planners_fabrique": {
      return { videos: posts.filter(Core.inFabrique).sort((a, b) => (Core.at(a) || "9999").localeCompare(Core.at(b) || "9999")).map((p) => {
        const pr = Core.prodOf(p);
        return Object.assign(brief(p, now), { done: pr.done + "/" + pr.total, ready: pr.ready, current: pr.current && { step: pr.current.key, state: pr.current.state, by: pr.current.by }, seconds: pr.duration, tooLong: pr.tooLong, hasVideo: !!pr.video });
      }) };
    }
    case "planners_pepites": {
      const pp = st.pepites || {};
      return { updated: pp.updated || null, followed: (set.rivals || []).map((r) => r.net + ":" + r.handle), errors: (pp.accounts || []).filter((a) => a.error).map((a) => a.handle + " : " + a.error), top: (pp.top || []).map((x) => ({ id: x.id, handle: x.handle, net: x.net, kind: x.kind, url: x.url, score: x.score, metric: x.metric, unit: x.unit, at: x.at, caption: (x.caption || "").slice(0, 300) })) };
    }
    case "planners_team":
      return { roles: Core.crewOf(set).map((r) => ({ key: r.key, name: r.name, steps: r.steps, who: r.who, whoLabel: Core.CREW_WHO[r.who], brief: r.brief, signAs: "Claude · " + r.name, done: Core.crewWork(posts, r).filter((x) => x.state === "done").length })) };
    case "planners_production": {
      const p = get(args.id), changed = [];
      need(p.status !== "published", "Ce post est déjà publié.");
      p.prod = Object.assign({}, p.prod); p.prod.steps = Object.assign({}, p.prod.steps);
      need(!args.role || Core.CREW.some((r) => r.key === args.role), "Rôle inconnu (voir planners_team).");
      if (args.step) {
        need(Core.PROD_STEPS.some(([k]) => k === args.step), "Étape inconnue (script, voice, edit, subs, check).");
        need(["todo", "doing", "done"].includes(args.state || "doing"), "État inconnu (todo, doing, done).");
        const role = args.role && Core.crewOf(set).find((r) => r.key === args.role);
        p.prod.steps[args.step] = { state: args.state || "doing", by: String(role ? "Claude · " + role.name : args.by || "Assistant IA").slice(0, 60), at: now, note: String(args.note || "").slice(0, 200) };
        changed.push(args.step + " → " + (args.state || "doing"));
      }
      if (Array.isArray(args.shots)) {
        p.prod.shots = args.shots.slice(0, 60).map((x) => ({ dur: Math.max(0, Math.min(600, +x.dur || 0)), screen: String(x.screen || "").slice(0, 300), voice: String(x.voice || "").slice(0, 600), visual: String(x.visual || "").slice(0, 300), music: String(x.music || "").slice(0, 120) }));
        changed.push("storyboard (" + p.prod.shots.length + " plans)");
      }
      if (args.maxSec) { const n = Math.round(+args.maxSec); need(n >= 5 && n <= 600, "Durée maximale entre 5 et 600 secondes."); p.prod.maxSec = n; changed.push("durée max"); }
      if (args.videoUrl) {
        const u = String(args.videoUrl).trim();
        need(/^https:\/\/[^\s]+$/.test(u), "Il faut une adresse https publique pour la vidéo.");
        p.media = (p.media || []).filter((m) => m.role !== "final");
        p.media.unshift({ name: decodeURIComponent(u.split("?")[0].split("/").pop() || "video.mp4").slice(0, 200), type: "video", url: u, role: "final" });
        changed.push("vidéo finie");
      }
      need(changed.length, "Rien à modifier.");
      await deps.save([p]); await deps.log({ at: now, level: "change", text: "Fabrique" + who + " : " + p.title + " (" + changed.join(", ") + ")", postId: p.id });
      const pr = Core.prodOf(p);
      return { post: brief(p, now), done: pr.done + "/" + pr.total, current: pr.current && pr.current.key, seconds: pr.duration, tooLong: pr.tooLong };
    }
    case "planners_activity":
      return { log: (st.log || []).slice(0, Math.min(100, args.limit || 30)) };
    case "planners_comment": {
      const p = get(args.id), text = (args.text || "").trim().slice(0, 2000);
      need(text, "Commentaire vide.");
      (p.comments = p.comments || []).push({ at: now, by: "Assistant IA" + (deps.me ? " (" + deps.me + ")" : ""), text });
      await deps.save([p]); await deps.log({ at: now, level: "info", text: "Commentaire" + who + " sur « " + p.title + " » : " + text.slice(0, 140), postId: p.id });
      return { comments: p.comments.length };
    }
  }
  throw new ToolError("Outil inconnu : " + name);
}

const rpc = (id, result) => ({ jsonrpc: "2.0", id, result });
const rpcErr = (id, code, message) => ({ jsonrpc: "2.0", id: id === undefined ? null : id, error: { code, message } });

// Traite un message JSON-RPC (ou un lot). Renvoie la réponse, ou null pour une notification.
export async function handleRpc(msg, deps) {
  if (Array.isArray(msg)) { const r = (await Promise.all(msg.map((m) => handleRpc(m, deps)))).filter(Boolean); return r.length ? r : null; }
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return rpcErr(msg && msg.id, -32600, "Requête invalide");
  const { id, method, params } = msg;
  if (id === undefined) return null; // notification (ex. notifications/initialized)
  switch (method) {
    case "initialize":
      return rpc(id, {
        protocolVersion: (params && params.protocolVersion) || PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "planners", title: "PlanneRs", version: "0.1.0" },
        instructions: "PlanneRs planifie des publications sur les réseaux sociaux. Une légende non validée ne part jamais. Commence par planners_today. Pour fabriquer une vidéo, lis d'abord ton rôle et ses consignes avec planners_team. Les dates sont en heure locale de l'espace (AAAA-MM-JJ, HH:MM). Avant de valider une légende, relis-la avec planners_get_post. Par défaut ce sont les humains qui valident : tu prépares (titre, légende, médias, date), ils contrôlent et valident dans l'application.",
      });
    case "ping": return rpc(id, {});
    case "tools/list": return rpc(id, { tools: TOOLS });
    case "tools/call": {
      const name = params && params.name;
      if (!TOOLS.some((t) => t.name === name)) return rpcErr(id, -32602, "Outil inconnu : " + name);
      try {
        const out = await callTool(name, params.arguments, deps);
        return rpc(id, { content: [{ type: "text", text: JSON.stringify(out, null, 1) }], structuredContent: out, isError: false });
      } catch (e) {
        return rpc(id, { content: [{ type: "text", text: e instanceof ToolError ? e.message : "Erreur : " + e.message }], isError: true });
      }
    }
    case "resources/list": return rpc(id, { resources: [] });
    case "prompts/list": return rpc(id, { prompts: [] });
    default: return rpcErr(id, -32601, "Méthode inconnue : " + method);
  }
}

// Point d'entrée HTTP (/mcp). L'accès a déjà été vérifié par l'appelant.
export async function handleHttp(request, deps) {
  const headers = { "content-type": "application/json", "cache-control": "no-store" };
  if (request.method === "GET" || request.method === "DELETE") return new Response(null, { status: 405, headers: { allow: "POST" } });
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST" } });
  let msg;
  try { msg = await request.json(); } catch (e) { return new Response(JSON.stringify(rpcErr(null, -32700, "JSON illisible")), { status: 400, headers }); }
  const out = await handleRpc(msg, deps);
  if (!out) return new Response(null, { status: 202 });
  return new Response(JSON.stringify(out), { status: 200, headers });
}
