// Google Drive en écriture : envoyer des fichiers dans les dossiers du projet depuis PlanneRs.
// Un compte de service ne peut pas écrire dans un Drive personnel (pas d'espace de stockage) :
// on passe donc par le compte Google de l'utilisateur (OAuth « Application Web », jeton de rafraîchissement).
// Doc : https://developers.google.com/workspace/drive/api/guides/manage-uploads#resumable
import { err } from "./common.js";

export const kind = "upload";
export const fields = [
  { key: "clientId", label: "ID client OAuth (Application Web)" },
  { key: "clientSecret", label: "Code secret du client", secret: true },
  { key: "rootFolderId", label: "Identifiant du dossier racine (facultatif : celui de Google Drive lecture)", optional: true },
];
export const SCOPE = "https://www.googleapis.com/auth/drive";
const API = "https://www.googleapis.com/drive/v3", UP = "https://www.googleapis.com/upload/drive/v3";
const FOLDER = "application/vnd.google-apps.folder";

export const redirectUri = (origin) => origin + "/api/oauth/google/callback";
export function authUrl(cred, origin, state, scope) {
  const q = new URLSearchParams({ client_id: cred.clientId, redirect_uri: redirectUri(origin), response_type: "code", scope: scope || SCOPE, access_type: "offline", prompt: "consent", include_granted_scopes: "true", state });
  return "https://accounts.google.com/o/oauth2/v2/auth?" + q;
}
export async function exchange(cred, origin, code) {
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: cred.clientId, client_secret: cred.clientSecret, redirect_uri: redirectUri(origin), grant_type: "authorization_code" }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.refresh_token) throw err("Google n'a pas donné d'autorisation durable.", j.error_description || j.error || "Réessaie « Autoriser avec Google » (le consentement doit être redemandé).");
  return j.refresh_token;
}

const cache = new Map();
async function token(cred) {
  const hit = cache.get(cred.refreshToken);
  if (hit && hit.exp > Date.now() + 60000) return hit.t;
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: cred.clientId, client_secret: cred.clientSecret, refresh_token: cred.refreshToken, grant_type: "refresh_token" }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw err("Google refuse l'autorisation.", (j.error_description || j.error || r.status) + " · Refais « Autoriser avec Google » dans Réglages.");
  cache.set(cred.refreshToken, { t: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 });
  return j.access_token;
}
async function api(t, path, init) {
  const r = await fetch(API + path, Object.assign({}, init, { headers: Object.assign({ authorization: "Bearer " + t }, (init && init.headers) || {}) }));
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw err("Drive : erreur " + r.status + ".", (j.error && j.error.message) || "");
  return j;
}

export async function test(env, cred) {
  if (!cred.clientId || !cred.clientSecret) throw err("Identifiants incomplets.", "Il faut l'ID client et le code secret.");
  if (!cred.refreshToken) throw Object.assign(err("Étape 2 : autorise l'accès.", "Clique sur « Autoriser avec Google » pour terminer."), { pending: true });
  if (!cred.rootFolderId) throw err("Dossier racine inconnu.", "Connecte d'abord « Google Drive » (lecture) ou indique l'identifiant du dossier.");
  const t = await token(cred);
  const f = await api(t, "/files/" + encodeURIComponent(cred.rootFolderId) + "?fields=id,name,capabilities(canAddChildren)&supportsAllDrives=true");
  if (f.capabilities && !f.capabilities.canAddChildren) throw err("Ce compte ne peut pas écrire dans « " + f.name + " ».", "Utilise le compte Google propriétaire du dossier.");
  return "Envoi de fichiers dans « " + f.name + " »";
}

// Dossier « a/b/c » sous la racine, créé s'il manque.
async function ensureFolder(t, root, path) {
  let id = root;
  for (const name of String(path || "").split("/").map((x) => x.trim()).filter(Boolean)) {
    const q = "'" + id + "' in parents and mimeType = '" + FOLDER + "' and name = '" + name.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "' and trashed = false";
    const r = await api(t, "/files?" + new URLSearchParams({ q, fields: "files(id,name)", supportsAllDrives: "true", includeItemsFromAllDrives: "true" }));
    id = r.files && r.files[0] ? r.files[0].id : (await api(t, "/files?supportsAllDrives=true&fields=id", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, mimeType: FOLDER, parents: [id] }) })).id;
  }
  return id;
}

// Envoi en reprise (« resumable ») : valable pour les gros fichiers.
export async function upload(cred, path, name, bytes, type, save, size) {
  const t = await token(cred);
  const parent = await ensureFolder(t, cred.rootFolderId, path);
  const init = await fetch(UP + "/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,webViewLink", { method: "POST",
    headers: { authorization: "Bearer " + t, "content-type": "application/json; charset=UTF-8", "x-upload-content-type": type || "application/octet-stream", "x-upload-content-length": String(size || bytes.byteLength) },
    body: JSON.stringify({ name, parents: [parent] }) });
  if (!init.ok) throw err("Drive refuse l'envoi (" + init.status + ").", (await init.text()).slice(0, 200));
  const r = await fetch(init.headers.get("location"), { method: "PUT", headers: { "content-type": type || "application/octet-stream" }, body: bytes });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw err("Envoi interrompu (" + r.status + ").", (j.error && j.error.message) || "Réessaie.");
  return { id: j.id, name: j.name, webUrl: j.webViewLink, folderId: parent, folderUrl: "https://drive.google.com/drive/folders/" + parent };
}
