// Assistant de connexion Meta : à partir du jeton que donne l'Explorateur de l'API Graph,
// PlanneRs fait lui-même les étapes pénibles du guide (allonger le jeton, retrouver la Page,
// son jeton et le compte Instagram relié) et vérifie les autorisations.
// Le code secret de l'application ne sert qu'à l'échange : il n'est jamais enregistré.
import { graph } from "./adapters/meta.js";

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
