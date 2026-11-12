// Dropbox : clé et secret de l'application + jeton de rafraîchissement (n'expire pas).
// Lecture : files.content.read. Dépôt de fichiers : files.content.write en plus.
// Doc : https://www.dropbox.com/developers/documentation/http/documentation
import { err, okJson, joinPath } from "./common.js";

export const kind = "source";
export const fields = [
  { key: "appKey", label: "App key" },
  { key: "appSecret", label: "App secret", secret: true },
  { key: "refreshToken", label: "Jeton de rafraîchissement (refresh token, accès « offline »)", secret: true },
  { key: "root", label: "Dossier racine (facultatif, ex. /MesMedias)", optional: true },
];

const cache = new Map();
async function token(cred) {
  const hit = cache.get(cred.refreshToken);
  if (hit && hit.exp > Date.now() + 60000) return hit.t;
  const r = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", authorization: "Basic " + btoa(cred.appKey + ":" + cred.appSecret) },
    body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(cred.refreshToken),
  });
  const j = await okJson("Dropbox", r);
  cache.set(cred.refreshToken, { t: j.access_token, exp: Date.now() + (j.expires_in || 14400) * 1000 });
  return j.access_token;
}
const full = (cred, path) => { const p = "/" + joinPath(cred.root || "", path); return p === "/" ? "" : p; };

export async function test(env, cred) {
  if (!cred.appKey || !cred.appSecret || !cred.refreshToken) throw err("Identifiants incomplets.", "Il faut l'App key, l'App secret et le refresh token.");
  const t = await token(cred);
  const me = await okJson("Dropbox", await fetch("https://api.dropboxapi.com/2/users/get_current_account", { method: "POST", headers: { authorization: "Bearer " + t } }));
  return "Compte " + (me.name && me.name.display_name || me.email) + (cred.root ? " · dossier " + cred.root : "") + "";
}

export async function folder(cred, path) {
  const t = await token(cred);
  const files = [];
  let r = await okJson("Dropbox", await fetch("https://api.dropboxapi.com/2/files/list_folder", { method: "POST", headers: { authorization: "Bearer " + t, "content-type": "application/json" }, body: JSON.stringify({ path: full(cred, path) }) }));
  for (;;) {
    for (const e of r.entries) if (e[".tag"] === "file") files.push({ id: e.path_lower, name: e.name, size: e.size, url: "https://www.dropbox.com/home" + encodeURI(e.path_display.split("/").slice(0, -1).join("/")) + "?preview=" + encodeURIComponent(e.name) });
    if (!r.has_more) break;
    r = await okJson("Dropbox", await fetch("https://api.dropboxapi.com/2/files/list_folder/continue", { method: "POST", headers: { authorization: "Bearer " + t, "content-type": "application/json" }, body: JSON.stringify({ cursor: r.cursor }) }));
  }
  return { id: full(cred, path), url: "https://www.dropbox.com/home" + encodeURI(full(cred, path)), files };
}

export async function download(cred, id, range) {
  const t = await token(cred);
  const headers = { authorization: "Bearer " + t, "dropbox-api-arg": JSON.stringify({ path: id }).replace(/[\u007f-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0")) };
  if (range) headers.range = range;
  return fetch("https://content.dropboxapi.com/2/files/download", { method: "POST", headers });
}

// Dépôt (jusqu'à 150 Mo en un envoi) : un fichier du même nom est gardé, le nouveau est renommé.
export async function upload(cred, path, name, bytes) {
  const t = await token(cred);
  const arg = JSON.stringify({ path: full(cred, path) + "/" + name, mode: "add", autorename: true }).replace(/[\u007f-\uffff]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
  const r = await fetch("https://content.dropboxapi.com/2/files/upload", { method: "POST", headers: { authorization: "Bearer " + t, "content-type": "application/octet-stream", "dropbox-api-arg": arg }, body: bytes });
  if (r.status === 401 || r.status === 403 || r.status === 400) {
    const t2 = await r.text();
    if (/scope|files\.content\.write/i.test(t2)) throw err("Dropbox : l'application n'a pas le droit d'écrire.", "Coche « files.content.write » dans l'onglet Permissions de l'application, puis refais le jeton de rafraîchissement.", 403);
    throw err("Dropbox refuse l'envoi (" + r.status + ").", t2.slice(0, 200), r.status);
  }
  const j = await okJson("Dropbox", r);
  return { id: j.path_lower, name: j.name, webUrl: "https://www.dropbox.com/home" + encodeURI(j.path_display.split("/").slice(0, -1).join("/")) + "?preview=" + encodeURIComponent(j.name) };
}
