// Fournisseur de connexion « Composio » : Composio garde les jetons des réseaux, PlanneRs ne garde que
// l'identifiant de la connexion. Les appels aux API des réseaux passent par le relais de Composio
// (POST /tools/execute/proxy), qui ajoute lui-même le jeton : on réutilise donc tels quels les modules
// Instagram et Facebook de PlanneRs.
// Clé : secret Worker COMPOSIO_API_KEY (clé de projet « ak_… »), jamais dans le dépôt ni dans le journal.
// Une instance PlanneRs = un client = un projet Composio ; l'identifiant d'utilisateur Composio de l'instance
// est tiré au hasard la première fois et gardé dans la base.
// Doc : https://docs.composio.dev/reference/v3/api-reference
import { PublishError, explain } from "../adapters/meta.js";
import { threadOf, replies, limitText } from "../adapters/common.js";

export const BASE = "https://backend.composio.dev/api/v3/";

// Réseaux PlanneRs → toolkits Composio. Seuls ceux-ci sont proposés « via Composio ».
export const TOOLKITS = { instagram: "instagram", facebook: "facebook", x: "twitter" };
export const NETWORKS = Object.keys(TOOLKITS);

// États d'une connexion Composio → états PlanneRs.
export function statusOf(s) {
  const k = String(s || "").toUpperCase();
  if (k === "ACTIVE") return "ok";
  if (k === "INITIATED" || k === "INITIALIZING") return "pending";
  if (k === "EXPIRED") return "expired";
  return "error"; // FAILED, INACTIVE, REVOKED…
}

// Ne jamais laisser passer une clé dans un message (journal, écran, notification).
export const scrub = (s) => String(s == null ? "" : s).replace(/\bak_[A-Za-z0-9_-]+/g, "ak_…").replace(/x-api-key[^,}\n]*/gi, "x-api-key: …").slice(0, 500);

export class ComposioError extends PublishError {}

function needKey(env) {
  if (!env.COMPOSIO_API_KEY) throw new ComposioError("Composio n'est pas configuré.", { why: "Le secret COMPOSIO_API_KEY manque dans le Worker.", todo: "Ajoute-le : npx wrangler secret put COMPOSIO_API_KEY (clé de projet « ak_… »).", retryable: false });
  return env.COMPOSIO_API_KEY;
}

// Appel à l'API Composio. Les erreurs sont traduites, sans jamais reprendre la clé.
export async function api(env, method, path, body) {
  const key = needKey(env);
  let r;
  try {
    r = await fetch(BASE + path.replace(/^\//, ""), { method, headers: { "x-api-key": key, accept: "application/json", "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  } catch (e) { throw new ComposioError("Composio ne répond pas.", { why: scrub(e.message), todo: "Nouvel essai au prochain passage." }); }
  const txt = await r.text();
  let data = {};
  try { data = txt ? JSON.parse(txt) : {}; } catch (e) { data = { message: txt }; }
  if (!r.ok) {
    const er = data.error || data;
    const msg = scrub(er.message || er.detail || r.statusText);
    if (r.status === 401) throw new ComposioError("Clé Composio refusée (401).", { code: "composio-401", why: "La clé COMPOSIO_API_KEY n'est pas valable ou n'a pas les droits nécessaires.", todo: "Vérifie la clé de projet (droits lecture + écriture sur les comptes connectés).", retryable: false });
    if (r.status === 429) throw new ComposioError("Trop de demandes à Composio (429).", { code: "composio-429", why: msg, todo: "Nouvel essai au prochain passage." });
    if (r.status >= 500) throw new ComposioError("Composio est en panne (" + r.status + ").", { code: "composio-" + r.status, why: msg, todo: "Nouvel essai au prochain passage." });
    const expired = /expired|inactive|revoked|re-?auth/i.test(msg);
    throw new ComposioError(expired ? "La connexion Composio a expiré." : "Composio a refusé la demande (" + r.status + ").", { code: expired ? "composio-expired" : "composio-" + r.status, why: msg, todo: expired ? "Reconnecte le compte dans Réglages › Comptes (bouton « Se reconnecter »)." : "Vérifie la connexion dans Réglages › Comptes.", retryable: false });
  }
  return data;
}

// Identifiant d'utilisateur Composio de cette instance (un par client).
export async function userId(env, db) {
  const cur = await db.getKV(env, "composio");
  if (cur && cur.userId) return cur.userId;
  const id = "planners-" + crypto.randomUUID();
  await db.putKV(env, "composio", Object.assign({}, cur, { userId: id }));
  return id;
}

// Configuration d'authentification du toolkit : la première existante, sinon une gérée par Composio.
export async function authConfig(env, toolkit) {
  const list = await api(env, "GET", "auth_configs?toolkit_slug=" + encodeURIComponent(toolkit) + "&limit=20");
  const items = (list.items || list.data || []).filter((a) => !a.status || String(a.status).toUpperCase() === "ENABLED");
  if (items.length) return items[0].id;
  try {
    const r = await api(env, "POST", "auth_configs", { toolkit: { slug: toolkit }, auth_config: { type: "use_composio_managed_auth" } });
    const id = (r.auth_config && r.auth_config.id) || r.id;
    if (id) return id;
  } catch (e) { /* message plus clair ci-dessous */ }
  throw new ComposioError("Aucune configuration « " + toolkit + " » dans Composio.", { why: "Composio a besoin d'une « auth config » pour ce réseau.", todo: "Crée-la dans le tableau de bord Composio (Auth Configs › " + toolkit + "), puis réessaie.", retryable: false });
}

// Étape 1 : lien d'autorisation vers le réseau, hébergé par Composio.
export async function link(env, db, network, callbackUrl) {
  const toolkit = TOOLKITS[network];
  if (!toolkit) throw new ComposioError("Ce réseau ne passe pas par Composio dans PlanneRs.", { retryable: false });
  const uid = await userId(env, db);
  const r = await api(env, "POST", "connected_accounts/link", { auth_config_id: await authConfig(env, toolkit), user_id: uid, callback_url: callbackUrl, alias: "planners-" + network + "-" + crypto.randomUUID().slice(0, 8) }); // alias unique : Composio refuse un alias déjà pris (essai précédent abandonné)
  if (!r.redirect_url || !r.connected_account_id) throw new ComposioError("Réponse inattendue de Composio.", { why: "Pas de lien d'autorisation.", retryable: false });
  return { url: r.redirect_url, cred: { provider: "composio", connectedAccountId: r.connected_account_id, userId: uid, toolkit } };
}

export const getAccount = (env, cred) => api(env, "GET", "connected_accounts/" + encodeURIComponent(cred.connectedAccountId));
export const removeAccount = (env, cred) => api(env, "DELETE", "connected_accounts/" + encodeURIComponent(cred.connectedAccountId));

// État de la connexion : { status: ok|pending|expired|error, raw }.
export async function status(env, cred) {
  const a = await getAccount(env, cred);
  return { status: statusOf(a.status), raw: String(a.status || "") };
}

// Relais Composio : appelle l'API du réseau avec le jeton gardé par Composio.
export async function proxy(env, cred, method, endpoint, params, body) {
  const parameters = Object.entries(params || {}).filter(([, v]) => v != null).map(([name, value]) => ({ name, value: String(value), type: "query" }));
  const r = await api(env, "POST", "tools/execute/proxy", { connected_account_id: cred.connectedAccountId, user_id: cred.userId, endpoint, method, body: body || null, parameters });
  return { status: Number(r.status) || 200, data: r.data == null ? {} : r.data };
}

// « Jeton » à passer aux modules Meta (graph() de adapters/meta.js le reconnaît) : chaque appel Graph
// passe par Composio. Chemins relatifs, sans numéro de version : c'est Composio qui choisit l'hôte.
export function graphVia(env, cred) {
  return {
    via: "composio",
    async call(method, path, params) {
      const p = Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]));
      const r = await proxy(env, cred, method, "/" + path.replace(/^\//, ""), method === "GET" ? p : null, method === "GET" ? null : p);
      if (r.status >= 400 || (r.data && r.data.error)) {
        const e = (r.data && r.data.error) || { message: "Erreur " + r.status, code: r.status };
        const x = explain(e);
        throw new PublishError("Meta a refusé la demande (" + (x.code || r.status) + ", via Composio).", { code: x.code, why: x.why, todo: x.code === "190" ? "Reconnecte le compte via Composio dans Réglages › Comptes." : x.todo, retryable: x.code !== "190" });
      }
      return r.data;
    },
  };
}

// Identifiants à passer au module « direct » d'un réseau Meta.
export function metaCred(env, cred) {
  const token = graphVia(env, cred);
  return cred.toolkit === "facebook" ? { token, pageId: cred.pageId } : { token, accountId: cred.accountId, pageId: cred.pageId };
}

// Après l'autorisation : retrouve le compte Instagram pro ou la Page derrière la connexion.
// Instagram Login (graph.instagram.com) : « me » donne directement le compte. Facebook Login : on passe par les Pages.
export async function discover(env, network, cred, graph) {
  const tok = graphVia(env, cred);
  if (network === "instagram") {
    const me = await graph(env, "GET", "me", { fields: "user_id,username" }, tok).catch(() => null);
    if (me && me.username) return { accountId: String(me.user_id || me.id), account: "@" + me.username };
    const pages = await graph(env, "GET", "me/accounts", { fields: "id,name,instagram_business_account{id,username}", limit: 50 }, tok);
    const pg = (pages.data || []).find((p) => p.instagram_business_account);
    if (!pg) throw new ComposioError("Aucun compte Instagram pro trouvé.", { why: "Composio fonctionne seulement avec un compte Instagram Business ou Créateur.", todo: "Passe le compte en pro (Créateur ou Entreprise), puis reconnecte-le.", retryable: false });
    return { accountId: pg.instagram_business_account.id, pageId: pg.id, account: "@" + pg.instagram_business_account.username };
  }
  if (network === "facebook") {
    const pages = await graph(env, "GET", "me/accounts", { fields: "id,name", limit: 50 }, tok);
    const pg = (pages.data || [])[0];
    if (!pg) throw new ComposioError("Aucune Page Facebook trouvée.", { why: "Le compte autorisé ne gère aucune Page.", todo: "Reconnecte-toi avec un compte qui gère la Page.", retryable: false });
    return { pageId: pg.id, account: "Page « " + pg.name + " »" };
  }
  if (network === "x") {
    const r = await proxy(env, cred, "GET", "/2/users/me");
    const u = r.data && (r.data.data || r.data);
    if (r.status >= 400 || !u || !u.username) throw new ComposioError("X ne répond pas via Composio (" + r.status + ").", { why: scrub(JSON.stringify(r.data)), todo: "Si Composio n'a plus d'identifiants X gérés, crée ta propre appli X dans Composio (auth config), ou connecte X en direct.", retryable: false });
    return { account: "@" + u.username };
  }
  return { account: "" };
}

// X via Composio : texte et fils. Les médias (envoi des octets) ne passent pas encore par le relais.
export async function publishX(env, post, cred) {
  const media = (post.media || []).filter((m) => m.role !== "cover" && m.role !== "guide");
  if (media.length) throw new PublishError("Médias X via Composio : pas encore gérés.", { why: "PlanneRs publie seulement le texte sur X quand la connexion passe par Composio.", todo: "Connecte X en direct (ta propre appli X) pour les images et vidéos, ou poste-le à la main.", retryable: false });
  const parts = threadOf(post.caption);
  parts.forEach((t) => limitText("X", t, 280));
  const send = async (json) => {
    const r = await proxy(env, cred, "POST", "/2/tweets", null, json);
    if (r.status >= 400 || !(r.data && r.data.data && r.data.data.id)) {
      const d = scrub(JSON.stringify(r.data));
      throw new PublishError("X a refusé la publication via Composio (" + r.status + ").", { code: String(r.status), why: d, todo: r.status === 401 || r.status === 403 ? "Reconnecte X via Composio, ou connecte X en direct avec ta propre appli." : "Vérifie le texte, puis réessaie.", retryable: r.status >= 500 || r.status === 429 });
    }
    return r.data.data.id;
  };
  const first = await send({ text: parts[0] });
  const more = await replies("X", parts, first, (t, prev) => send({ text: t, reply: { in_reply_to_tweet_id: prev } }));
  return Object.assign({ status: "ok", id: first, url: "https://x.com/i/status/" + first }, more);
}
