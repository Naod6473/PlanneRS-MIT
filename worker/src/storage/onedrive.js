// OneDrive / SharePoint par Microsoft Graph.
// Application enregistrée dans Microsoft Entra, droit délégué Files.Read + offline_access, jeton de rafraîchissement.
// Dépôt de fichiers : Files.ReadWrite au lieu de Files.Read.
// Microsoft renouvelle le jeton de rafraîchissement à chaque usage : on enregistre le nouveau (save).
// Doc : https://learn.microsoft.com/graph/api/driveitem-list-children
import { err, okJson, joinPath } from "./common.js";

export const kind = "source";
export const fields = [
  { key: "clientId", label: "ID d'application (client)" },
  { key: "clientSecret", label: "Secret client (facultatif pour une application publique)", secret: true, optional: true },
  { key: "refreshToken", label: "Jeton de rafraîchissement (scope Files.Read offline_access)", secret: true },
  { key: "tenant", label: "Locataire (facultatif : consumers pour un compte perso, common ou l'ID de l'organisation)", optional: true },
  { key: "root", label: "Dossier racine (facultatif, ex. Documents/MesMedias)", optional: true },
];

const GRAPH = "https://graph.microsoft.com/v1.0";
const cache = new Map();

async function token(cred, save, write = false) {
  const hit = cache.get((write ? "w" : "") + cred.clientId + cred.refreshToken);
  if (hit && hit.exp > Date.now() + 60000) return hit.t;
  const body = new URLSearchParams({ client_id: cred.clientId, grant_type: "refresh_token", refresh_token: cred.refreshToken, scope: (write ? "Files.ReadWrite" : "Files.Read") + " offline_access" });
  if (cred.clientSecret) body.set("client_secret", cred.clientSecret);
  const j = await okJson("OneDrive", await fetch("https://login.microsoftonline.com/" + (cred.tenant || "common") + "/oauth2/v2.0/token", { method: "POST", body }));
  cache.set((write ? "w" : "") + cred.clientId + (j.refresh_token || cred.refreshToken), { t: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 });
  if (j.refresh_token && j.refresh_token !== cred.refreshToken) { cred.refreshToken = j.refresh_token; if (save) await save(cred); }
  return j.access_token;
}

const itemPath = (cred, path) => { const p = joinPath(cred.root || "", path); return p ? "/me/drive/root:/" + p.split("/").map(encodeURIComponent).join("/") + ":" : "/me/drive/root"; };

export async function test(env, cred, save) {
  if (!cred.clientId || !cred.refreshToken) throw err("Identifiants incomplets.", "Il faut l'ID d'application et le jeton de rafraîchissement.");
  const t = await token(cred, save);
  const d = await okJson("OneDrive", await fetch(GRAPH + itemPath(cred, ""), { headers: { authorization: "Bearer " + t } }));
  return "Dossier « " + d.name + " »";
}

export async function folder(cred, path, save) {
  const t = await token(cred, save);
  const h = { authorization: "Bearer " + t };
  const me = await okJson("OneDrive", await fetch(GRAPH + itemPath(cred, path), { headers: h }));
  const files = [];
  let next = GRAPH + itemPath(cred, path) + "/children?$top=200&$select=id,name,size,webUrl,file";
  while (next) {
    const r = await okJson("OneDrive", await fetch(next, { headers: h }));
    for (const f of r.value) if (f.file) files.push({ id: f.id, name: f.name, size: f.size, url: f.webUrl });
    next = r["@odata.nextLink"];
  }
  return { id: me.id, url: me.webUrl, files };
}

export async function download(cred, id, range, save) {
  const t = await token(cred, save);
  const headers = { authorization: "Bearer " + t };
  if (range) headers.range = range;
  return fetch(GRAPH + "/me/drive/items/" + encodeURIComponent(id) + "/content", { headers });
}

// Dépôt (envoi simple, jusqu'à 250 Mo) : les dossiers manquants sont créés par OneDrive.
export async function upload(cred, path, name, bytes, type, save) {
  let t;
  try { t = await token(cred, save, true); }
  catch (e) { throw err("OneDrive : pas de droit d'écriture.", "Ajoute le droit délégué Files.ReadWrite à l'application, puis refais le jeton de rafraîchissement.", 403); }
  const r = await fetch(GRAPH + itemPath(cred, joinPath(path, name)) + "/content?@microsoft.graph.conflictBehavior=rename", { method: "PUT", headers: { authorization: "Bearer " + t, "content-type": type || "application/octet-stream" }, body: bytes });
  if (r.status === 403 || r.status === 401) throw err("OneDrive : écriture refusée.", "Ajoute le droit délégué Files.ReadWrite à l'application, puis refais le jeton de rafraîchissement.", 403);
  const j = await okJson("OneDrive", r);
  return { id: j.id, name: j.name, webUrl: j.webUrl };
}
