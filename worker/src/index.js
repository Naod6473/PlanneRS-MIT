// PlanneRs : point d'entrée du Worker Cloudflare.
// - /api/* : l'API utilisée par l'interface (protégée par Cloudflare Access)
// - le reste : les fichiers de l'interface (dossier web/, servi par Workers Static Assets)
// - scheduled() : le robot de publication, toutes les 5 minutes
import { checkAccess } from "./auth.js";
import * as share from "./share.js";
import * as mcp from "./mcp.js";
import * as db from "./db.js";
import { runRobot, sendPost, localNow } from "./robot.js";
import * as instagram from "./adapters/instagram.js";
import * as facebook from "./adapters/facebook.js";
import { channels } from "./adapters/notify.js";
import * as gdrive from "./storage/gdrive.js";
import * as gdrivewrite from "./storage/gdrivewrite.js";
import * as dropbox from "./storage/dropbox.js";
import * as onedrive from "./storage/onedrive.js";
import * as webdav from "./storage/webdav.js";
import * as ghpages from "./storage/ghpages.js";
import * as s3 from "./storage/s3.js";
import { joinPath } from "./storage/common.js";
import { PublishError } from "./adapters/meta.js";
import { collect as collectStats, mediaKey } from "./stats.js";
import * as threads from "./adapters/threads.js";
import * as bluesky from "./adapters/bluesky.js";
import * as mastodon from "./adapters/mastodon.js";
import * as x from "./adapters/x.js";
import * as linkedin from "./adapters/linkedin.js";
import * as pinterest from "./adapters/pinterest.js";
import * as youtube from "./adapters/youtube.js";
import * as tiktok from "./adapters/tiktok.js";
import * as daily from "./daily.js";
import Core from "../../web/js/core.js";
import * as ical from "./ical.js";
import * as links from "./links.js";
import * as rewriter from "./rewrite.js";
import * as agent from "./agent.js";
import * as pepites from "./pepites.js";
import { aiClient } from "./ai.js";
import * as igHistory from "./history.js";
import * as igComments from "./comments.js";
import { graph } from "./adapters/meta.js";
import * as rss from "./rss.js";
import * as plugs from "./plugs.js";

const ADAPTERS = { instagram, facebook, threads, linkedin, x, bluesky, mastodon, pinterest, youtube, tiktok };
const STORAGE = { gdrive, gdrivewrite, onedrive, dropbox, webdav, ghpages, r2: s3 };
const SOURCES = ["gdrive", "onedrive", "dropbox", "webdav"], HOSTS = ["ghpages", "r2"];

// Premier stockage connecté (état « ok ») d'une famille, avec ses identifiants.
async function pick(env, ids) {
  const info = await db.accountsInfo(env);
  for (const id of ids) if (info[id] && info[id].status === "ok") { const cred = await db.getCred(env, id); if (cred) return { id, mod: STORAGE[id], cred, save: (c) => db.updateCred(env, id, c) }; }
  return null;
}

// Où déposer un fichier : le stockage choisi s'il est connecté, sinon le premier qui sait écrire.
// Google Drive écrit par sa connexion « envoi » ; R2/S3 et GitHub Pages donnent directement une adresse publique.
const WRITERS = ["gdrivewrite", "onedrive", "dropbox", "webdav", "r2", "ghpages"];
async function uploadTarget(env, target) {
  const want = target === "gdrive" ? "gdrivewrite" : target;
  const order = WRITERS.includes(want) ? [want] : WRITERS;
  const d = await pick(env, order);
  return d ? Object.assign(d, { host: HOSTS.includes(d.id) }) : null;
}

// Avant d'envoyer : un média sans adresse publique est copié depuis le stockage source vers l'hébergement public.
async function ensurePublic(env, p) {
  const need = (p.media || []).filter((m) => !/^https:\/\//.test(m.url || "") && m.role !== "guide");
  if (!need.length) return false;
  const src = await pick(env, p.store && SOURCES.includes(p.store) ? [p.store] : SOURCES), host = await pick(env, HOSTS);
  if (!src || !host || !p.folder || /^https?:/.test(p.folder)) throw new PublishError("Un média n'a pas d'adresse publique.", { why: "Il faut un stockage (Drive, Dropbox…) ET un hébergement public (GitHub Pages ou R2) connectés pour copier les fichiers automatiquement.", todo: "Connecte-les dans Réglages › Stockage et médias, ou poste à la main.", retryable: false });
  const dir = await src.mod.folder(src.cred, p.folder, src.save);
  for (const m of need) {
    const f = dir.files.find((x) => x.name === m.name);
    if (!f) throw new PublishError("« " + m.name + " » introuvable dans " + p.folder + ".", { why: "Le fichier a été renommé ou déplacé.", todo: "Corrige le nom dans le post ou remets le fichier, puis réessaie.", retryable: false });
    const r = await src.mod.download(src.cred, f.id, null, src.save);
    if (!r.ok) throw new PublishError("Téléchargement de « " + m.name + " » impossible (" + r.status + ").", { why: "Le stockage n'a pas rendu le fichier.", todo: "Réessaie dans quelques minutes." });
    const bytes = new Uint8Array(await r.arrayBuffer());
    m.url = await host.mod.put(host.cred, joinPath(p.folder, m.name), bytes, r.headers.get("content-type") || undefined);
  }
  // GitHub Pages met une à deux minutes à publier : on attend que les adresses répondent.
  for (const m of need) {
    let ok = false;
    for (let i = 0; i < 12 && !ok; i++) { ok = (await fetch(m.url, { method: "HEAD" })).ok; if (!ok) await new Promise((res) => setTimeout(res, 10000)); }
    if (!ok) throw new PublishError("Le média vient d'être mis en ligne mais ne répond pas encore.", { why: "L'hébergement public met du temps à publier le fichier.", todo: "Nouvel essai au prochain passage." });
  }
  return true;
}
const DEFAULT_SETTINGS = {
  workspace: { name: "Mon espace" }, timezone: "Europe/Paris",
  slots: [{ time: "09:00", label: "Matin" }, { time: "12:30", label: "Midi" }, { time: "18:00", label: "Soir" }],
  networks: ["instagram", "facebook", "linkedin", "x"],
  rules: { requireValidation: true, maxHashtags: 5, noRetryRelay: true }, customChecks: [], categories: [],
  notify: { manualReminderMinutes: 15, onFailure: true },
  drive: { inbox: "PlanneRs/depots" },
};

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const err = (msg, status = 400) => json({ error: msg }, status);

async function state(env) {
  const s = await db.loadState(env);
  s.settings = Object.assign({}, DEFAULT_SETTINGS, s.settings || {});
  s.adapters = Object.fromEntries([
    ...Object.entries(ADAPTERS).map(([k, a]) => [k, a.fields.map(({ key, label, secret, optional, file }) => ({ key, label, secret: !!secret, optional: !!optional, file: file || undefined }))]),
    ...Object.entries(STORAGE).map(([k, a]) => [k, a.fields.map(({ key, label, secret, optional, file }) => ({ key, label, secret: !!secret, optional: !!optional, file: file || undefined }))]),
    ...Object.entries(channels).map(([k, c]) => [k, c.fields.map(({ key, label, secret, optional, file }) => ({ key, label, secret: !!secret, optional: !!optional, file: file || undefined }))]),
  ]);
  s.dryRun = env.DRY_RUN !== "false";
  s.rewrite = !!env.ANTHROPIC_API_KEY;
  return s;
}

async function notifier(env, settings) {
  const s = await db.loadState(env);
  const origin = await db.getKV(env, "origin");
  return async (n) => {
    // Lien cliquable : un rappel « à la main » ouvre directement la marche à suivre du post.
    if (!n.url && origin) n = Object.assign({}, n, { url: origin + (n.event === "manual" && n.post ? "/#poster-" + encodeURIComponent(n.post.id) : "/#today") });
    if (n.event === "failed" && settings.notify && settings.notify.onFailure === false) return;
    for (const id of Object.keys(channels)) {
      if (!s.accounts[id]) continue;
      try { await channels[id].send(env, await db.getCred(env, id), n); }
      catch (e) { await db.addLog(env, { at: localNow(settings.timezone), level: "error", text: "Notification " + id + " impossible.", why: e.message }); }
    }
  };
}

function robotDeps(env, s) {
  return {
    env, settings: s.settings, posts: s.posts, now: localNow(s.settings.timezone), adapters: ADAPTERS, dryRun: env.DRY_RUN !== "false",
    cred: (n) => credFor(env, n), save: (ps) => db.savePosts(env, ps), log: (e) => db.addLog(env, e), saveCred: (n, c) => db.updateCred(env, n, c),
    ensurePublic: async (p) => { if (await ensurePublic(env, p)) await db.savePosts(env, [p]); },
  };
}

// Facebook peut réutiliser la connexion Instagram (même jeton Meta, Page liée) : un seul jeton à saisir.
async function credFor(env, n) {
  const c = await db.getCred(env, n);
  if (n === "facebook" && (!c || !c.token)) {
    const ig = await db.getCred(env, "instagram");
    if (ig && ig.token && ig.pageId) return { token: ig.token, pageId: ig.pageId };
  }
  return c;
}

// Si des validateurs sont désignés, seuls eux peuvent valider une légende.
async function canValidate(env, email) {
  const set = (await db.getKV(env, "settings")) || {};
  const list = ((set.team || {}).validators || []).map((x) => x.toLowerCase());
  return !list.length || list.includes(String(email || "").toLowerCase()) || email === "local";
}

async function api(request, env, path, url, auth) {
  const m = request.method;
  const me = (auth && auth.email) || "";
  let r0;
  const body = m === "GET" || m === "DELETE" || path === "drive/upload" ? null : await request.json().catch(() => null);
  if (path === "state" && m === "GET") {
    if ((await db.getKV(env, "origin")) !== url.origin) await db.putKV(env, "origin", url.origin); // pour les liens des notifications
    return json(Object.assign(await state(env), { me }));
  }
  if (path === "backups" && m === "GET") {
    const keys = (await db.listKV(env, "backup:")).reverse();
    const list = [];
    for (const k of keys) { const b = await db.getKV(env, k); list.push({ id: k.slice(7), at: b && b.at, posts: (b && b.count) || 0 }); }
    return json({ backups: list });
  }
  if (path === "backups" && m === "POST") { const st = (await db.getKV(env, "settings")) || {}; return json(await backup(env, localNow(st.timezone), "manuelle")); }
  if ((r0 = path.match(/^backups\/([A-Za-z0-9-]+)\/restore$/)) && m === "POST") {
    const b = await db.getBackup(env, r0[1]);
    if (!b || !Array.isArray(b.posts)) return err("Sauvegarde introuvable", 404);
    const st = (await db.getKV(env, "settings")) || {}, now = localNow(st.timezone);
    await backup(env, now, "avant-restauration");
    await db.restore(env, b);
    await db.addLog(env, { at: now, level: "change", text: "Restauration de la sauvegarde du " + r0[1] + " (" + b.posts.length + " posts)" + (me ? " par " + me : "") + "." });
    return json({ ok: true });
  }
  if ((r0 = path.match(/^posts\/([^/]+)\/rewrite$/)) && m === "POST") {
    if (!env.ANTHROPIC_API_KEY) return err("Pour réécrire avec Claude, ajoute le secret ANTHROPIC_API_KEY au Worker (voir la documentation « Assistants IA »).", 409);
    const p = await db.getPost(env, decodeURIComponent(r0[1]));
    if (!p) return err("Post introuvable", 404);
    const net = String((body && body.net) || "");
    if (!ADAPTERS[net]) return err("Réseau inconnu");
    const st = (await db.getKV(env, "settings")) || {};
    const draft = Object.assign({}, p, typeof (body && body.caption) === "string" ? { caption: body.caption } : {});
    try { return json(await rewriter.rewrite(aiClient(env), draft, net, st)); }
    catch (e) { return err(e.status === 401 ? "Clé ANTHROPIC_API_KEY refusée : vérifie-la dans les secrets du Worker." : e.status === 429 ? "Trop de demandes à Claude : réessaie dans une minute." : e.status === 529 || e.status >= 500 ? "Claude est surchargé ou indisponible : réessaie dans un instant." : e.message, 502); }
  }
  // Équipe d'agents (clé API) : le Scénariste écrit le storyboard, Légendes propose une légende. Jamais validé tout seul.
  if ((r0 = path.match(/^posts\/([^/]+)\/agent$/)) && m === "POST") {
    if (!env.ANTHROPIC_API_KEY) return err("Pour faire travailler l'équipe avec la clé API, ajoute le secret ANTHROPIC_API_KEY au Worker (voir la documentation « Assistants IA »).", 409);
    const p = await db.getPost(env, decodeURIComponent(r0[1]));
    if (!p) return err("Post introuvable", 404);
    const st = (await db.getKV(env, "settings")) || {}, role = String((body && body.role) || "");
    try {
      const r = await agent.work(aiClient(env), role, p, st, localNow(st.timezone));
      await db.savePosts(env, [r.post]);
      await db.addLog(env, { at: localNow(st.timezone), level: "change", text: "Équipe : " + (Core.CREW.find((x) => x.key === role) || {}).name + " (clé API) sur « " + p.title + " » : " + r.summary + (me ? " (lancé par " + me + ")" : ""), postId: p.id });
      return json({ post: r.post, summary: r.summary });
    } catch (e) { return err(e.status === 401 ? "Clé ANTHROPIC_API_KEY refusée : vérifie-la dans les secrets du Worker." : e.status === 429 ? "Trop de demandes à Claude : réessaie dans une minute." : e.status >= 500 ? "Claude est surchargé ou indisponible : réessaie dans un instant." : e.message, e.status ? 502 : 400); }
  }
  // Une vidéo, tous les réseaux : un texte adapté par réseau à partir du texte commun (jamais validé tout seul).
  if (path === "adapt" && m === "POST") {
    if (!env.ANTHROPIC_API_KEY) return err("Pour adapter avec Claude, ajoute le secret ANTHROPIC_API_KEY au Worker (voir la documentation « Assistants IA »).", 409);
    const nets = [...new Set(((body && body.networks) || []).map(String))].filter((n) => ADAPTERS[n]).slice(0, 8);
    if (!nets.length) return err("Choisis au moins un réseau.");
    const st = (await db.getKV(env, "settings")) || {};
    const draft = { title: String((body && body.title) || ""), format: String((body && body.format) || ""), caption: String((body && body.caption) || "") };
    try {
      const out = await rewriter.adaptAll(aiClient(env), draft, nets, st);
      return json(out);
    } catch (e) { return err(e.status === 401 ? "Clé ANTHROPIC_API_KEY refusée : vérifie-la dans les secrets du Worker." : e.status === 429 ? "Trop de demandes à Claude : réessaie dans une minute." : e.status >= 500 ? "Claude est surchargé ou indisponible : réessaie dans un instant." : e.message, 502); }
  }
  if ((r0 = path.match(/^posts\/([^/]+)\/links$/)) && m === "POST") {
    const p = await db.getPost(env, decodeURIComponent(r0[1]));
    if (!p) return err("Post introuvable", 404);
    const st = (await db.getKV(env, "settings")) || {};
    p.linkCheck = { at: localNow(st.timezone), bad: await links.checkPost(p) };
    await db.savePosts(env, [p]);
    return json({ post: p });
  }
  if (path === "import/instagram" && m === "POST") {
    const cred = await db.getCred(env, "instagram");
    if (!cred || !cred.token || !cred.accountId) return err("Instagram n'est pas connecté (Réglages › Comptes).", 409);
    const st = Object.assign({}, DEFAULT_SETTINGS, (await db.getKV(env, "settings")) || {});
    let media;
    try { media = await igHistory.fetchAll(env, cred); } catch (e) { return err(e.why || e.message, 502); }
    const s = await db.loadState(env);
    const r = igHistory.toPosts(media, s.posts, st.timezone);
    if (r.created.length) {
      await db.savePosts(env, r.created);
      await db.addLog(env, { at: localNow(st.timezone), level: "change", text: "Historique Instagram récupéré : " + r.created.length + " publications ajoutées" + (r.skipped ? ", " + r.skipped + " déjà présentes" : "") + (me ? " (par " + me + ")" : "") + "." });
    }
    return json({ created: r.created.length, skipped: r.skipped, posts: r.created });
  }
  // Commentaires Instagram : liste (gardée 10 minutes, ?fresh=1 pour relire), réponse, proposition de Claude.
  if (path === "comments" && m === "GET") {
    const cred = await db.getCred(env, "instagram");
    if (!cred || !cred.token || !cred.accountId) return err("Instagram n'est pas connecté (Réglages › Comptes).", 409);
    const cache = await db.getKV(env, "comments");
    const link = async (r) => { const ps = (await db.loadState(env)).posts, k = {}; ps.forEach((p) => { const x = mediaKey(p.url); if (x && !p.parent) k[x] = p.id; }); r.comments.forEach((c) => { c.postId = k[c.key] || null; }); return json(Object.assign({ rewrite: !!env.ANTHROPIC_API_KEY }, r)); };
    if (cache && !url.searchParams.get("fresh") && Date.now() - Date.parse(cache.at) < 10 * 60000) return link(cache);
    try { const r = await igComments.fetchRecent(env, cred); await db.putKV(env, "comments", r); return link(r); }
    catch (e) { return err((e.why || e.message) + " Il faut l'autorisation « instagram_manage_comments » sur le jeton Meta.", 502); }
  }
  if ((r0 = path.match(/^comments\/([0-9]+)\/reply$/)) && m === "POST") {
    const text = String((body && body.text) || "").trim().slice(0, 2200);
    if (!text) return err("Écris une réponse");
    const cred = await db.getCred(env, "instagram");
    if (!cred || !cred.token) return err("Instagram n'est pas connecté.", 409);
    try { await igComments.reply(env, cred, r0[1], text); } catch (e) { return err(e.why || e.message, 502); }
    const cache = await db.getKV(env, "comments");
    if (cache) { const c = cache.comments.find((x) => x.id === r0[1]); if (c) { c.answered = true; c.replies.push({ text, user: cache.username, at: new Date().toISOString(), mine: true }); await db.putKV(env, "comments", cache); } }
    const st = (await db.getKV(env, "settings")) || {};
    await db.addLog(env, { at: localNow(st.timezone), level: "change", text: "Réponse à un commentaire Instagram" + (me ? " (par " + me + ")" : "") + " : " + text.slice(0, 140) });
    return json({ ok: true });
  }
  if ((r0 = path.match(/^comments\/([0-9]+)\/suggest$/)) && m === "POST") {
    if (!env.ANTHROPIC_API_KEY) return err("Pour une proposition de Claude, ajoute le secret ANTHROPIC_API_KEY au Worker.", 409);
    const cache = await db.getKV(env, "comments"), c = cache && cache.comments.find((x) => x.id === r0[1]);
    if (!c) return err("Commentaire introuvable : actualise la liste.", 404);
    const s = await db.loadState(env), post = s.posts.find((p) => c.key && (mediaKey(p.url) === c.key));
    try { return json(await rewriter.suggestReply(aiClient(env), c, post, s.settings || {})); } catch (e) { return err(e.message, 502); }
  }
  // API simple pour n8n, Make, Zapier ou un script (voir docs/reference/api.md). Même contrôle d'accès que le reste
  // (jeton de service Cloudflare Access) ; un post créé par l'API n'est jamais validé : il attend une relecture.
  if (path === "v1" || path.startsWith("v1/")) {
    const s0 = await state(env);
    const deps = { state: async () => s0, save: async (ps) => { ps.forEach((p) => { if (!s0.posts.includes(p)) s0.posts.push(p); }); await db.savePosts(env, ps); }, log: (e) => db.addLog(env, e), now: localNow(s0.settings.timezone), me, who: " (API" + (me ? ", " + me : "") + ")", canValidate: async () => false };
    const q = Object.fromEntries(url.searchParams), sub = path.slice(3);
    try {
      if (sub === "today" && m === "GET") return json(await mcp.callTool("planners_today", {}, deps));
      if (sub === "posts" && m === "GET") return json(await mcp.callTool("planners_list_posts", { from: q.from, to: q.to, status: q.status, query: q.query, limit: q.limit ? +q.limit : undefined }, deps));
      if (sub === "posts" && m === "POST") {
        const b = body || {};
        const c = await mcp.callTool("planners_create_post", { title: b.title, format: b.format, networks: b.networks, date: b.date, time: b.time, caption: b.caption, note: b.note }, deps);
        for (const u of [].concat(b.media || []).slice(0, 10)) await mcp.callTool("planners_add_media", typeof u === "string" ? { id: c.created.id, url: u } : { id: c.created.id, url: u && u.url, type: u && u.type, alt: u && u.alt }, deps);
        return json(await mcp.callTool("planners_get_post", { id: c.created.id }, deps), 201);
      }
      if ((r0 = sub.match(/^posts\/([^/]+)$/)) && m === "GET") return json(await mcp.callTool("planners_get_post", { id: decodeURIComponent(r0[1]) }, deps));
    } catch (e) { return err(e.message, /introuvable/i.test(e.message) ? 404 : 400); }
    return err("Introuvable. Voir docs/reference/api.md", 404);
  }
  if (path === "rss/run" && m === "POST") return json(await runRss(env, true));
  if (path === "ical" && m === "GET") { const c = (await db.getKV(env, "ical")) || {}; return json(c.token ? { url: url.origin + "/cal/" + c.token + ".ics" } : {}); }
  if (path === "ical" && m === "POST") { const token = share.newToken(); await db.putKV(env, "ical", { token, by: me }); return json({ url: url.origin + "/cal/" + token + ".ics" }); }
  if (path === "ical" && m === "DELETE") { await db.putKV(env, "ical", {}); return json({ ok: true }); }
  if (path === "daily/run" && m === "POST") return json((await runDaily(env, true)) || {});
  if (path === "weekly/run" && m === "POST") return json((await runWeekly(env, body && body.send ? "send" : "preview")) || {});
  if (path === "share" && m === "POST") {
    if (!body || !Array.isArray(body.ids) || !body.ids.length) return err("ids manquant");
    const set = (await db.getKV(env, "settings")) || {};
    const token = await share.create(env, body.ids, me, (set.workspace || {}).name);
    return json({ url: url.origin + "/v/" + token });
  }
  if (path === "state" && m === "PUT") {
    if (!body || !Array.isArray(body.posts)) return err("Format attendu : { posts, settings }");
    if (!(await canValidate(env, me))) return err("Seuls les validateurs désignés peuvent remplacer tout l'espace.", 403);
    await db.replaceAll(env, body); return json({ ok: true });
  }
  if (path === "posts" && m === "PUT") {
    if (!body || !Array.isArray(body.posts)) return err("posts manquant");
    if (!(await canValidate(env, me))) {
      for (const p of body.posts) {
        const old = await db.getPost(env, p.id);
        if (p.captionValidated && !(old && old.captionValidated)) return err("Seuls les validateurs désignés peuvent valider une légende.", 403);
      }
    }
    await db.savePosts(env, body.posts); return json({ ok: true });
  }
  if (path === "settings" && m === "PUT") {
    if (!body || typeof body !== "object" || Array.isArray(body)) return err("Réglages illisibles");
    // Les droits (validateurs, ce que l'assistant IA peut faire) ne changent que par un validateur.
    if (!(await canValidate(env, me))) { const old = (await db.getKV(env, "settings")) || {}; body.team = old.team; body.ai = old.ai; }
    await db.putKV(env, "settings", body); return json({ ok: true });
  }
  if (path === "log" && m === "POST") { await db.addLog(env, body || {}); return json({ ok: true }); }
  let r;
  if ((r = path.match(/^posts\/([^/]+)$/)) && m === "DELETE") { await db.deletePost(env, decodeURIComponent(r[1]), me); return json({ ok: true }); }
  if (path === "trash" && m === "GET") return json({ trash: (await db.getTrash(env)).map((e) => ({ id: e.id, at: e.at, by: e.by, title: (e.posts[0] || {}).title || "", date: (e.posts[0] || {}).date || null, count: e.posts.length })) });
  if (path === "trash" && m === "DELETE") { await db.putKV(env, "trash", []); return json({ ok: true }); }
  if ((r = path.match(/^trash\/([^/]+)\/restore$/)) && m === "POST") {
    const e = await db.restoreTrash(env, decodeURIComponent(r[1]));
    if (!e) return err("Introuvable dans la corbeille (plus de 30 jours ?)", 404);
    return json({ ok: true, posts: e.posts });
  }
  if ((r = path.match(/^posts\/([^/]+)\/retry$/)) && m === "POST") {
    const s = await state(env);
    const p = s.posts.find((x) => x.id === decodeURIComponent(r[1]));
    if (!p) return err("Post introuvable", 404);
    const done = Object.entries(p.results || {}).filter(([, x]) => x.status === "ok").map(([n]) => n);
    if (done.length && s.settings.rules.noRetryRelay) return err("Un réseau a déjà publié ce post : relancer créerait un doublon. Publie le reste à la main.", 409);
    const deps = robotDeps(env, s); deps.notify = await notifier(env, s.settings);
    p.attempts = 1; // pas de nouvel essai automatique caché derrière un essai manuel
    const summary = { sent: 0, failed: 0, pending: 0 };
    await sendPost(p, deps, s.settings.rules, summary);
    await db.savePosts(env, [p]);
    if (p.status !== "published") return err((p.failure && p.failure.why) || "Toujours en échec", 502);
    return json({ ok: true, post: p });
  }
  if ((r = path.match(/^connect\/([a-z0-9]+)$/))) {
    const id = r[1];
    const ad = ADAPTERS[id] || channels[id] || STORAGE[id];
    if (m === "DELETE") { await db.deleteAccount(env, id); return json({ ok: true }); }
    if (m !== "POST") return err("Méthode non prise en charge", 405);
    if (!ad) return err("Ce connecteur n'est pas encore disponible.", 404);
    const cred = {};
    for (const f of ad.fields) { const v = body && body[f.key]; if (v) cred[f.key] = String(v).trim(); }
    if (id === "gdrivewrite" && !cred.rootFolderId) cred.rootFolderId = await defaultRoot(env);
    let info;
    try {
      const detail = ad.test ? await ad.test(env, cred, null) : "Enregistré";
      info = { status: "ok", account: detail, detail: "Connecté le " + localNow().replace("T", " à ") };
    } catch (e) { info = { status: e.pending ? "pending" : "error", account: e.pending ? "En attente de l'autorisation " + (id === "tiktok" ? "TikTok" : "Google") : "", detail: e.why || e.message }; }
    if (channels[id] && info.status === "ok") {
      try { await channels[id].send(env, cred, { event: "test", title: "PlanneRs", text: "Notifications activées." }); info.account = "Message de test envoyé"; }
      catch (e) { info = { status: "error", account: "", detail: e.message }; }
    }
    await db.setAccount(env, id, info, cred);
    let relay = null;
    if (id === "instagram" && info.status === "ok" && cred.pageId) {
      try { relay = { status: "ok", account: await facebook.test(env, { token: cred.token, pageId: cred.pageId }), detail: "Utilise la connexion Instagram" }; }
      catch (e) { relay = { status: "error", account: "", detail: "Relais Facebook : " + (e.why || e.message) }; }
      await db.setAccount(env, "facebook", relay, null);
    }
    if (relay) info.relay = relay;
    return json({ ok: info.status !== "error", info }, info.status !== "error" ? 200 : 400);
  }
  if ((r = path.match(/^connect\/([a-z0-9]+)\/test$/)) && m === "POST") {
    const id = r[1], ad = ADAPTERS[id] || STORAGE[id];
    if (!ad) return err("Pas de test pour ce connecteur", 404);
    try { const detail = await ad.test(env, await credFor(env, id), (c) => db.updateCred(env, id, c)); return json({ ok: true, detail }); }
    catch (e) { return err(e.why || e.message, 502); }
  }
  // Google Drive : contenu d'un dossier (chemin relatif à la racine) et téléchargement relayé.
  if (path === "drive/folder" && m === "GET") {
    const src = await pick(env, SOURCES);
    if (!src) return err("Aucun stockage connecté.", 404);
    try { return json(Object.assign({ source: src.id }, await src.mod.folder(src.cred, url.searchParams.get("path") || "", src.save))); }
    catch (e) { return err(e.message, e.status && e.status < 600 ? e.status : 502); }
  }
  if ((r = path.match(/^drive\/file\/(.+)$/)) && m === "GET") {
    const src = await pick(env, SOURCES);
    if (!src) return err("Aucun stockage connecté.", 404);
    const up = await src.mod.download(src.cred, decodeURIComponent(r[1]), request.headers.get("range"), src.save);
    if (!up.ok && up.status !== 206) return err("Fichier Drive inaccessible (" + up.status + ")", up.status === 404 ? 404 : 502);
    const h = new Headers();
    for (const k of ["content-type", "content-length", "content-range", "accept-ranges"]) if (up.headers.get(k)) h.set(k, up.headers.get(k));
    const name = url.searchParams.get("name");
    if (name) h.set("content-disposition", "inline; filename*=UTF-8''" + encodeURIComponent(name));
    h.set("cache-control", "private, max-age=3600");
    return new Response(up.body, { status: up.status, headers: h });
  }
  // Google Drive en écriture : autorisation OAuth, puis envoi de fichiers.
  if (path === "oauth/google/start" && m === "GET") {
    // Même client OAuth Google pour l'envoi vers le Drive et pour YouTube (?for=youtube).
    const target = url.searchParams.get("for") === "youtube" ? "youtube" : "gdrivewrite";
    const cred = await db.getCred(env, target);
    if (!cred || !cred.clientId) return err("Enregistre d'abord l'ID client et le secret dans Réglages.", 400);
    const state = crypto.randomUUID();
    await db.putKV(env, "oauth-state", { state, at: Date.now(), target });
    return Response.redirect(gdrivewrite.authUrl(cred, url.origin, state, target === "youtube" ? youtube.SCOPE : null), 302);
  }
  if (path === "oauth/google/callback" && m === "GET") {
    const st = await db.getKV(env, "oauth-state");
    const back = (msg) => Response.redirect(url.origin + "/#settings/" + encodeURIComponent(msg), 302);
    if (url.searchParams.get("error")) return back("Autorisation Google refusée");
    if (!st || st.state !== url.searchParams.get("state") || Date.now() - st.at > 15 * 60000) return back("Lien d'autorisation expiré, recommence");
    const target = st.target === "youtube" ? "youtube" : "gdrivewrite", mod = target === "youtube" ? youtube : gdrivewrite;
    const cred = await db.getCred(env, target);
    let info;
    try {
      cred.refreshToken = await gdrivewrite.exchange(cred, url.origin, url.searchParams.get("code"));
      info = { status: "ok", account: await mod.test(env, cred), detail: "Autorisé le " + localNow().replace("T", " à ") };
    } catch (e) { info = { status: "error", account: "", detail: e.why || e.message }; }
    await db.setAccount(env, target, info, cred);
    await db.putKV(env, "oauth-state", null);
    return back(info.status === "ok" ? (target === "youtube" ? "YouTube autorisé" : "Drive autorisé") : "Échec : " + info.detail);
  }
  // TikTok : même principe que Google (client de l'app, puis autorisation du compte).
  if (path === "oauth/tiktok/start" && m === "GET") {
    const cred = await db.getCred(env, "tiktok");
    if (!cred || !cred.clientKey) return err("Enregistre d'abord la Client key et le Client secret dans Réglages › Comptes › TikTok.", 400);
    const state = crypto.randomUUID();
    await db.putKV(env, "oauth-state", { state, at: Date.now(), target: "tiktok" });
    return Response.redirect(tiktok.authUrl(cred, url.origin, state), 302);
  }
  if (path === "oauth/tiktok/callback" && m === "GET") {
    const st = await db.getKV(env, "oauth-state");
    const back = (msg) => Response.redirect(url.origin + "/#settings/" + encodeURIComponent(msg), 302);
    if (url.searchParams.get("error")) return back("Autorisation TikTok refusée");
    if (!st || st.target !== "tiktok" || st.state !== url.searchParams.get("state") || Date.now() - st.at > 15 * 60000) return back("Lien d'autorisation expiré, recommence");
    const cred = await db.getCred(env, "tiktok");
    let info;
    try {
      await tiktok.exchange(cred, url.origin, url.searchParams.get("code"));
      info = { status: "ok", account: await tiktok.test(env, cred, null), detail: "Autorisé le " + localNow().replace("T", " à ") };
    } catch (e) { info = { status: "error", account: "", detail: e.why || e.message }; }
    await db.setAccount(env, "tiktok", info, cred);
    await db.putKV(env, "oauth-state", null);
    return back(info.status === "ok" ? "TikTok autorisé" : "Échec : " + info.detail);
  }
  // Dépôt d'un fichier (vidéo, photo) dans le stockage choisi (Réglages › Stockage › Dossier des dépôts).
  if ((path === "storage/upload" || path === "drive/upload") && m === "POST") {
    const st = (await db.getKV(env, "settings")) || {};
    const name = (url.searchParams.get("name") || "fichier").replace(/[\\/]/g, "_").slice(0, 200);
    const dest = await uploadTarget(env, (st.drive && st.drive.target) || "auto");
    if (!dest) return err("Aucun stockage où déposer les fichiers. Connecte-en un dans Réglages › Stockage et médias (Drive en envoi, Dropbox, OneDrive, NAS en WebDAV, R2/S3 ou GitHub Pages).", 409);
    const bytes = await request.arrayBuffer(), type = request.headers.get("content-type") || undefined, folder = url.searchParams.get("path") || "";
    try {
      if (dest.host) {
        const pub = await dest.mod.put(dest.cred, joinPath(folder, name), new Uint8Array(bytes), type);
        return json({ where: dest.id, name, url: pub });
      }
      const r = await dest.mod.upload(dest.cred, folder, name, bytes, type, dest.save);
      return json({ where: dest.id === "gdrivewrite" ? "gdrive" : dest.id, id: r.id, name: r.name || name, webUrl: r.webUrl || "", folderUrl: r.folderUrl || "" });
    } catch (e) { return err(e.why ? e.message + " " + e.why : e.message, e.status === 403 || e.status === 401 ? 403 : 502); }
  }
  if (path === "instagram/sync" && m === "POST") { try { return json(await syncInstagram(env, true)); } catch (e) { return err(e.why || e.message, 502); } }
  if (path === "robot/run" && m === "POST") return json(await robot(env));
  // Pépites : comptes suivis, relevé une fois par jour avec les statistiques, ou à la demande.
  if (path === "pepites" && m === "GET") return json((await db.getKV(env, "pepites")) || {});
  if (path === "pepites/refresh" && m === "POST") return json(await refreshPepites(env));
  if (path === "pepites/remix" && m === "POST") {
    const pp = (await db.getKV(env, "pepites")) || {}, id = String((body && body.id) || "");
    const item = (pp.accounts || []).flatMap((a) => a.items || []).find((x) => x.id === id);
    if (!item) return err("Pépite introuvable : actualise la liste.", 404);
    const st = Object.assign({}, DEFAULT_SETTINGS, (await db.getKV(env, "settings")) || {}), now = localNow(st.timezone);
    let recipe = "", why = "";
    if (env.ANTHROPIC_API_KEY) { try { recipe = await pepites.remix(aiClient(env), item, st); } catch (e) { why = e.message; } }
    const p = pepites.ideaOf(item, recipe, now);
    p.networks = (st.networks || ["instagram"]).filter((n) => n === "instagram" || n === "facebook" || n === "youtube" || n === "tiktok");
    if (!p.networks.length) p.networks = ["instagram"];
    await db.savePosts(env, [p]);
    await db.addLog(env, { at: now, level: "change", text: "Pépite de @" + item.handle + " transformée en idée : " + p.title + (me ? " (par " + me + ")" : ""), postId: p.id });
    return json({ post: p, recipe: !!recipe, why });
  }
  if (path === "stats" && m === "GET") return json((await db.getKV(env, "stats")) || {});
  if (path === "stats/refresh" && m === "POST") return json(await stats(env));
  return err("Introuvable", 404);
}

async function robot(env) {
  const s = await state(env);
  const deps = robotDeps(env, s);
  deps.notify = await notifier(env, s.settings);
  const summary = await runRobot(deps);
  await db.putKV(env, "robot", { last: deps.now.replace("T", " "), summary, dryRun: deps.dryRun });
  return summary;
}

// Dossier racine du Drive : celui de la connexion en lecture, sinon celui des réglages.
async function defaultRoot(env) {
  const g = await db.getCred(env, "gdrive").catch(() => null);
  if (g && g.rootFolderId) return g.rootFolderId;
  const st = (await db.getKV(env, "settings")) || {};
  return (st.connectDefaults && st.connectDefaults.gdrive && st.connectDefaults.gdrive.rootFolderId) || "";
}

// Vérifie chaque réseau connecté : jeton encore valable, date d'expiration (Meta), renouvellement (Threads).
async function checkConnections(env, today) {
  const info = await db.accountsInfo(env);
  for (const [id, a] of Object.entries(info)) {
    const ad = ADAPTERS[id];
    if (!ad || !ad.test || !a || a.status === "pending") continue;
    if (id === "facebook" && /Instagram/.test(a.detail || "")) continue; // relais : vérifié avec Instagram
    const cred = await db.getCred(env, id).catch(() => null);
    if (!cred) continue;
    const next = Object.assign({}, a);
    try {
      if (id === "threads" && cred.token && (!a.refreshed || daily.daysLeft(a.refreshed, today) <= -7)) {
        try { const t = await daily.refreshThreads(cred.token); await db.updateCred(env, id, Object.assign({}, cred, { token: t.token })); cred.token = t.token; next.expires = t.expires; next.refreshed = today; }
        catch (e) { /* jeton trop récent ou non renouvelable : on garde l'ancien */ }
      }
      await ad.test(env, cred, (c) => db.updateCred(env, id, c));
      if ((id === "instagram" || id === "facebook") && cred.token) {
        const exp = await daily.metaExpiry(graph, env, cred.token).catch(() => null);
        if (exp === "expired") throw new Error("Le jeton Meta a expiré.");
        if (exp != null) next.expires = exp || undefined;
      }
      next.status = "ok"; next.checked = today;
    } catch (e) { next.status = "error"; next.detail = "Vérifié le " + today + " : " + (e.why || e.message); }
    if (JSON.stringify(next) !== JSON.stringify(a)) await db.setAccount(env, id, next, null);
    info[id] = next;
  }
  return info;
}

// Sauvegarde : dans la base (8 dernières), et dans le Drive si l'envoi vers le Drive est connecté.
async function backup(env, now, label) {
  const s = await db.loadState(env);
  const snap = daily.snapshot(s, now);
  const id = now.slice(0, 10) + (label ? "-" + label : ""), key = "backup:" + id;
  await db.saveBackup(env, id, snap);
  const old = await db.listKV(env, "backup:");
  for (const k of old.slice(0, -8)) await db.deleteBackup(env, k.slice(7));
  let drive = false;
  const info = (await db.accountsInfo(env)).gdrivewrite;
  if (info && info.status === "ok") {
    try { await gdrivewrite.upload(await db.getCred(env, "gdrivewrite"), "PlanneRs/sauvegardes", "planners-" + key.slice(7) + ".json", new TextEncoder().encode(JSON.stringify(snap)), "application/json"); drive = true; }
    catch (e) { await db.addLog(env, { at: now, level: "error", text: "Sauvegarde vers le Drive impossible.", why: e.why || e.message }); }
  }
  await db.addLog(env, { at: now, level: "ok", text: "Sauvegarde faite : " + snap.posts.length + " posts" + (drive ? " (copie dans le Drive, dossier PlanneRs/sauvegardes)" : "") + "." });
  return { key: key.slice(7), posts: snap.posts.length, drive };
}

// Une fois par jour : connexions, résumé du matin, sauvegarde de la semaine.
async function runDaily(env, force) {
  const settings = Object.assign({}, DEFAULT_SETTINGS, (await db.getKV(env, "settings")) || {});
  const now = localNow(settings.timezone), today = now.slice(0, 10);
  const mark = (await db.getKV(env, "daily")) || {};
  if (!force && !daily.due(now, settings, mark.day)) return null;
  await db.putKV(env, "daily", Object.assign({}, mark, { day: today }));
  const out = {};
  try {
    const info = await checkConnections(env, today);
    const alerts = daily.connectionAlerts(info, today);
    out.alerts = alerts.length;
    if ((settings.notify || {}).digest !== false) {
      const s = await db.loadState(env);
      const d = daily.digest(s.posts, settings, now, alerts);
      if (d) { const origin = await db.getKV(env, "origin"); await (await notifier(env, settings))({ event: "digest", title: d.title, text: d.text, url: origin ? origin + "/#today" : undefined }); out.digest = d.count; }
    }
  } catch (e) { await db.addLog(env, { at: now, level: "error", text: "Vérification du matin incomplète.", why: e.message }); }
  // Liens des légendes des 3 prochains jours.
  try {
    const s = await db.loadState(env), lim = Core.addDays(today, 3), changed = [];
    for (const p of s.posts.filter((x) => x.date && x.date >= today && x.date <= lim && x.status !== "published" && !x.parent)) {
      if (!links.extract([p.caption, p.firstComment, ...Object.values(p.captions || {})].join("\n")).length && !p.linkCheck) continue;
      const bad = await links.checkPost(p);
      p.linkCheck = { at: now, bad }; changed.push(p);
      if (bad.length) await db.addLog(env, { at: now, level: "error", text: "Lien qui ne répond pas dans « " + p.title + " » : " + bad.map((b) => b.url).join(", "), postId: p.id });
    }
    if (changed.length) await db.savePosts(env, changed);
    out.links = changed.length;
  } catch (e) { /* vérification des liens facultative */ }
  try { if (daily.backupDue(today, settings, mark.backup)) { out.backup = await backup(env, now); await db.putKV(env, "daily", Object.assign({}, mark, { day: today, backup: today })); } }
  catch (e) { await db.addLog(env, { at: now, level: "error", text: "Sauvegarde impossible.", why: e.message }); }
  return out;
}

// Posts publiés en dehors de PlanneRs (à la main, script, assistant) : repérés sur Instagram et passés en « publié ».
// Seulement s'il reste un post Instagram en attente dont l'heure est passée, et au plus toutes les 10 minutes.
async function syncInstagram(env, force) {
  const settings = Object.assign({}, DEFAULT_SETTINGS, (await db.getKV(env, "settings")) || {});
  const now = localNow(settings.timezone);
  const s = await db.loadState(env);
  if (!igHistory.waiting(s.posts, now).length) return { changed: 0 };
  const last = await db.getKV(env, "igsync");
  if (!force && last && Date.now() - last.at < 10 * 60000) return { changed: 0 };
  await db.putKV(env, "igsync", { at: Date.now() });
  const info = (await db.accountsInfo(env)).instagram, cred = await db.getCred(env, "instagram");
  if (!info || info.status !== "ok" || !cred || !cred.token || !cred.accountId) return { changed: 0 };
  const changed = igHistory.reconcile(await igHistory.fetchRecent(env, cred), s.posts, settings.timezone, now);
  if (changed.length) {
    await db.savePosts(env, changed);
    for (const p of changed) await db.addLog(env, { at: now, level: "ok", text: "Repéré sur Instagram, publié en dehors de PlanneRs : " + p.title, postId: p.id });
  }
  return { changed: changed.length };
}

// Bilan du dimanche soir (Réglages › Notifications), envoyé une fois par semaine.
async function runWeekly(env, force) {
  const settings = Object.assign({}, DEFAULT_SETTINGS, (await db.getKV(env, "settings")) || {});
  const now = localNow(settings.timezone), mark = (await db.getKV(env, "weekly")) || {};
  if (!force && !daily.weeklyDue(now, settings, mark.day)) return null;
  if (!force) await db.putKV(env, "weekly", { day: now.slice(0, 10) });
  const s = await db.loadState(env);
  const w = daily.weekly(s.posts, await db.getKV(env, "stats"), settings, now, mediaKey);
  if (!force || force === "send") await (await notifier(env, settings))({ event: "weekly", title: w.title, text: w.text });
  return w;
}

// Flux RSS (Réglages › Automatisations) : relus une fois par heure. Un nouvel article devient un post à relire.
async function runRss(env, force) {
  const settings = Object.assign({}, DEFAULT_SETTINGS, (await db.getKV(env, "settings")) || {});
  const feeds = ((settings.auto || {}).feeds || []).filter((f) => f && f.url);
  const mark = (await db.getKV(env, "rss")) || {};
  if (!feeds.length || (!force && mark.at && Date.now() - mark.at < 55 * 60000)) return { created: 0, errors: 0, feeds: feeds.length };
  await db.putKV(env, "rss", Object.assign({}, mark, { at: Date.now() }));
  const r = await rss.run(feeds, mark.memo, settings, {
    now: localNow(settings.timezone), save: (ps) => db.savePosts(env, ps), log: (e) => db.addLog(env, e),
    fetch: async (u) => { const x = await fetch(u, { headers: { accept: "application/rss+xml, application/atom+xml, application/xml, text/xml", "user-agent": "PlanneRs" }, signal: AbortSignal.timeout(15000) }); if (!x.ok) throw new Error("Le site a répondu " + x.status + "."); return (await x.text()).slice(0, 2e6); },
  });
  await db.putKV(env, "rss", { at: Date.now(), memo: r.memo });
  return { created: r.created, errors: r.errors, feeds: feeds.length };
}

// Actions après publication (Réglages › Automatisations), après chaque relevé des statistiques.
// Robot à l'arrêt : aucune action automatique.
async function runPlugs(env, st) {
  const s = await state(env);
  const rules = (s.settings.auto || {}).plugs || [];
  if (!rules.length || (s.settings.rules || {}).robotEnabled === false) return { done: 0 };
  return plugs.run(rules, s.posts, st, { env, adapters: ADAPTERS, cred: (n) => credFor(env, n), save: (ps) => db.savePosts(env, ps), log: (e) => db.addLog(env, e), now: localNow(s.settings.timezone), dryRun: env.DRY_RUN !== "false", settings: s.settings }, mediaKey);
}

// Relevé des pépites (comptes suivis). Sans compte suivi, rien n'est appelé.
async function refreshPepites(env) {
  const st = Object.assign({}, DEFAULT_SETTINGS, (await db.getKV(env, "settings")) || {});
  const rivals = pepites.cleanRivals(st.rivals);
  if (!rivals.length) { await db.putKV(env, "pepites", {}); return {}; }
  const out = await pepites.collect(env, rivals, rivals.some((r) => r.net === "instagram") ? await credFor(env, "instagram") : null, localNow(st.timezone).slice(0, 10));
  await db.putKV(env, "pepites", out);
  return out;
}

// Relevé des statistiques : une fois par jour à partir de 7 h (heure de l'espace), ou à la demande.
async function stats(env, onlyIfDue) {
  const settings = Object.assign({}, DEFAULT_SETTINGS, (await db.getKV(env, "settings")) || {});
  const now = localNow(settings.timezone), today = now.slice(0, 10);
  const prev = await db.getKV(env, "stats");
  if (onlyIfDue && (now.slice(11, 13) < "07" || (prev && prev.day === today))) return prev;
  const s = await collectStats(env, (n) => credFor(env, n), prev, today);
  s.day = today;
  await db.putKV(env, "stats", s);
  if (onlyIfDue) await runPlugs(env, s).catch(() => null);
  if (onlyIfDue) await refreshPepites(env).catch(() => null);
  return s;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Adresse publique (sans Cloudflare Access) : elle ne sert que la page de présentation,
    // demandée par Google et TikTok pour vérifier l'app. Tout le reste y est refusé.
    if (env.PUBLIC_HOST && url.hostname === env.PUBLIC_HOST) {
      if (url.pathname === "/" || url.pathname === "/accueil.html" || url.pathname === "/accueil") {
        return env.ASSETS.fetch(new Request(new URL("/accueil", url), { method: "GET" }));
      }
      // Page de présentation et ses images.
      if (url.pathname === "/presentation" || url.pathname === "/presentation.html") return env.ASSETS.fetch(new Request(new URL("/presentation", url), { method: "GET" }));
      if (/^\/img\/(presentation\/[\w-]+\.jpg|logo\.png)$/.test(url.pathname) || url.pathname === "/favicon.svg") return env.ASSETS.fetch(new Request(url, { method: "GET" }));
      return Response.redirect(url.origin + "/", 302);
    }
    // Lien de validation client : public, limité aux posts partagés (voir share.js).
    const v = url.pathname.match(/^\/v\/([A-Za-z0-9_-]+)\/?$/);
    if (v) {
      const set = Object.assign({}, DEFAULT_SETTINGS, (await db.getKV(env, "settings")) || {});
      return share.handle(request, env, v[1], localNow(set.timezone));
    }
    // Calendrier à brancher dans un agenda : public, protégé par un jeton secret (voir ical.js).
    const cal = url.pathname.match(/^\/cal\/([A-Za-z0-9_-]+)\.ics$/);
    if (cal) {
      const set = Object.assign({}, DEFAULT_SETTINGS, (await db.getKV(env, "settings")) || {});
      return ical.handle(env, cal[1], db, localNow(set.timezone), url.searchParams.get("only"));
    }
    // Serveur MCP pour les assistants IA : même contrôle d'accès que l'API (voir mcp.js).
    if (url.pathname === "/mcp") {
      const a = await checkAccess(request, env);
      if (!a.ok) return err(a.why, 401);
      const s0 = await state(env);
      return mcp.handleHttp(request, {
        state: async () => state(env), save: (ps) => db.savePosts(env, ps), log: (e) => db.addLog(env, e),
        remove: (id) => db.deletePost(env, id, a.email), saveSettings: (s) => db.putKV(env, "settings", s),
        now: localNow(s0.settings.timezone), me: a.email, canValidate: () => canValidate(env, a.email),
      });
    }
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    // Une page d'un autre site ne peut pas agir au nom de la personne connectée.
    const origin = request.headers.get("origin");
    if (!["GET", "HEAD"].includes(request.method) && origin && origin !== url.origin) return err("Origine refusée.", 403);
    const auth = await checkAccess(request, env);
    if (!auth.ok) return err(auth.why, 401);
    try { return await api(request, env, url.pathname.slice(5), url, auth); }
    catch (e) { return err("Erreur du serveur : " + e.message, 500); }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(robot(env).finally(() => syncInstagram(env).catch(() => null)).finally(() => stats(env, true).catch(() => null)).finally(() => runDaily(env).catch(() => null)).finally(() => runWeekly(env).catch(() => null)).finally(() => runRss(env).catch(() => null)));
  },
};
