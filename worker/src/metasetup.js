// Assistant de connexion Meta : à partir du jeton que donne l'Explorateur de l'API Graph,
// PlanneRs fait lui-même les étapes pénibles du guide (allonger le jeton, retrouver la Page,
// son jeton et le compte Instagram relié) et vérifie les autorisations.
// Le code secret de l'application ne sert qu'à l'échange : il n'est jamais enregistré.
import { graph } from "./adapters/meta.js";
import { seal, open } from "./crypto.js";

export const REQUIRED = ["pages_show_list", "pages_read_engagement", "pages_manage_posts", "instagram_basic", "instagram_content_publish"];
export const OPTIONAL = ["instagram_manage_insights", "instagram_manage_comments", "business_management"];

export async function inspect(env, { userToken, appId, appSecret }) {
  let token = String(userToken || "").trim(), long = false;
  if (!token) throw new Error("Colle le jeton donné par l'Explorateur de l'API Graph.");
  if (appId && appSecret) {
    const r = await graph(env, "GET", "oauth/access_token", { grant_type: "fb_exchange_token", client_id: String(appId).trim(), client_secret: String(appSecret).trim(), fb_exchange_token: token });
    if (r.access_token) { token = r.access_token; long = true; }
  }
  const perms = await graph(env, "GET", "me/permissions", {}, token).catch(() => ({ data: [] }));
  const granted = (perms.data || []).filter((p) => p.status === "granted").map((p) => p.permission);
  const acc = await graph(env, "GET", "me/accounts", { fields: "id,name,access_token,instagram_business_account{id,username}", limit: 100 }, token);
  const pages = (acc.data || []).map((p) => ({ id: String(p.id), name: p.name || "", token: p.access_token || "", igId: (p.instagram_business_account && String(p.instagram_business_account.id)) || "", igUser: (p.instagram_business_account && p.instagram_business_account.username) || "" }));
  return {
    long, pages,
    missing: granted.length ? REQUIRED.filter((p) => !granted.includes(p)) : [],
    optionalMissing: granted.length ? OPTIONAL.filter((p) => !granted.includes(p)) : [],
  };
}
// Ce que la page reçoit : jamais les jetons.
export const publicView = (r) => ({ long: r.long, missing: r.missing, optionalMissing: r.optionalMissing, pages: r.pages.map(({ token, ...p }) => p) });

// « Se connecter avec Facebook » : la fenêtre de connexion de Meta, avec l'application de la personne.
// L'identifiant et la clé secrète restent chiffrés 15 minutes, le temps du retour, puis sont effacés.
export const LOGIN_TTL = 15 * 60000;
export const SCOPE = REQUIRED.concat(OPTIONAL.filter((p) => p !== "business_management")).join(",");
export const redirectUri = (origin) => origin + "/api/oauth/meta/callback";
export async function loginStart(env, db, origin, { appId, appSecret }) {
  appId = String(appId || "").trim(); appSecret = String(appSecret || "").trim();
  if (!/^\d{5,20}$/.test(appId) || !appSecret) throw new Error("Donne l'identifiant (des chiffres) et la clé secrète de l'application Meta.");
  const state = crypto.randomUUID();
  await db.putKV(env, "oauth-meta", { state, at: Date.now(), box: await seal(env, { appId, appSecret }) });
  const u = new URL("https://www.facebook.com/" + (env.GRAPH_VERSION || "v21.0") + "/dialog/oauth");
  u.searchParams.set("client_id", appId); u.searchParams.set("redirect_uri", redirectUri(origin));
  u.searchParams.set("state", state); u.searchParams.set("scope", SCOPE); u.searchParams.set("response_type", "code");
  return u.toString();
}
// Retour de Facebook : code → jeton, puis la même recherche que l'assistant. Les Pages trouvées
// (avec leurs jetons) sont gardées chiffrées 15 minutes, le temps de choisir la Page.
export async function loginCallback(env, db, origin, params) {
  const st = await db.getKV(env, "oauth-meta");
  if (params.get("error")) { await db.putKV(env, "oauth-meta", null); throw new Error("Connexion Facebook annulée"); }
  if (!st || st.state !== params.get("state") || Date.now() - st.at > LOGIN_TTL) throw new Error("Lien de connexion expiré, recommence");
  const { appId, appSecret } = await open(env, st.box);
  const r = await graph(env, "GET", "oauth/access_token", { client_id: appId, client_secret: appSecret, redirect_uri: redirectUri(origin), code: params.get("code") || "" });
  const found = await inspect(env, { userToken: r.access_token, appId, appSecret });
  await db.putKV(env, "oauth-meta", { at: Date.now(), found: await seal(env, found) });
  return found;
}
export async function pending(env, db) {
  const st = await db.getKV(env, "oauth-meta");
  if (!st || !st.found || Date.now() - st.at > LOGIN_TTL) throw new Error("La connexion Facebook a expiré : recommence avec « Se connecter avec Facebook ».");
  return open(env, st.found);
}

// Threads : même principe, avec l'identifiant et la clé de l'app Threads (cas d'usage « Threads » de l'app Meta).
export const threadsRedirect = (origin) => origin + "/api/oauth/threads/callback";
export async function threadsStart(env, db, origin, { appId, appSecret }) {
  appId = String(appId || "").trim(); appSecret = String(appSecret || "").trim();
  if (!/^\d{5,20}$/.test(appId) || !appSecret) throw new Error("Donne l'identifiant (des chiffres) et la clé secrète de l'app Threads.");
  const state = crypto.randomUUID();
  await db.putKV(env, "oauth-threads", { state, at: Date.now(), box: await seal(env, { appId, appSecret }) });
  const u = new URL("https://threads.net/oauth/authorize");
  u.searchParams.set("client_id", appId); u.searchParams.set("redirect_uri", threadsRedirect(origin));
  u.searchParams.set("scope", "threads_basic,threads_content_publish"); u.searchParams.set("response_type", "code"); u.searchParams.set("state", state);
  return u.toString();
}
export async function threadsCallback(env, db, origin, params) {
  const st = await db.getKV(env, "oauth-threads");
  await db.putKV(env, "oauth-threads", null);
  if (params.get("error")) throw new Error("Connexion Threads annulée");
  if (!st || st.state !== params.get("state") || Date.now() - st.at > LOGIN_TTL) throw new Error("Lien de connexion expiré, recommence");
  const { appId, appSecret } = await open(env, st.box);
  const post = await fetch("https://graph.threads.net/oauth/access_token", { method: "POST", body: new URLSearchParams({ client_id: appId, client_secret: appSecret, grant_type: "authorization_code", redirect_uri: threadsRedirect(origin), code: params.get("code") || "" }) });
  const short = await post.json().catch(() => ({}));
  if (!post.ok || !short.access_token) throw new Error("Threads a refusé la connexion" + (short.error_message || (short.error && short.error.message) ? " : " + (short.error_message || short.error.message) : ""));
  const u = new URL("https://graph.threads.net/access_token");
  u.searchParams.set("grant_type", "th_exchange_token"); u.searchParams.set("client_secret", appSecret); u.searchParams.set("access_token", short.access_token);
  const lr = await fetch(u); const long = await lr.json().catch(() => ({}));
  return { token: long.access_token || short.access_token, userId: String(short.user_id || ""), long: !!long.access_token };
}
