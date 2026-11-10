// Google Drive (lecture seule) via un compte de service Google.
// L'administrateur partage le dossier des médias avec l'adresse du compte de service (rôle « Lecteur »).
// Pas de jeton qui expire : le Worker signe lui-même une demande de jeton (JWT RS256) à chaque besoin.

export const kind = "storage";
export const fields = [
  { key: "serviceAccount", label: "Clé JSON du compte de service", secret: true, file: ".json,application/json" },
  { key: "rootFolderId", label: "Identifiant du dossier racine (la fin de l'adresse du dossier Drive)" },
];

const API = "https://www.googleapis.com/drive/v3";
const FOLDER = "application/vnd.google-apps.folder";
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlStr = (s) => b64url(new TextEncoder().encode(s));

function parseKey(cred) {
  let sa;
  try { sa = typeof cred.serviceAccount === "string" ? JSON.parse(cred.serviceAccount) : cred.serviceAccount; }
  catch (e) { throw Object.assign(new Error("Clé JSON illisible."), { why: "Colle tout le contenu du fichier .json téléchargé depuis Google Cloud, accolades comprises." }); }
  if (!sa || !sa.client_email || !sa.private_key) throw Object.assign(new Error("Clé incomplète."), { why: "Le fichier doit contenir client_email et private_key (clé de compte de service)." });
  return sa;
}

// Jetons gardés en mémoire du Worker (environ une heure).
const cache = new Map();
export async function token(cred) {
  const sa = parseKey(cred);
  const hit = cache.get(sa.client_email);
  if (hit && hit.exp > Date.now() + 60000) return hit.token;
  const now = Math.floor(Date.now() / 1000);
  const head = b64urlStr(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64urlStr(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/drive.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(head + "." + body));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" + head + "." + body + "." + b64url(sig),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error("Google refuse la clé."), { why: j.error_description || j.error || "Erreur " + r.status });
  cache.set(sa.client_email, { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 });
  return j.access_token;
}

async function call(cred, path, params) {
  const t = await token(cred);
  const qs = new URLSearchParams(Object.assign({ supportsAllDrives: "true" }, params || {}));
  const r = await fetch(API + path + "?" + qs, { headers: { authorization: "Bearer " + t } });
  if (r.status === 404) throw Object.assign(new Error("Introuvable dans le Drive."), { why: "Le dossier n'est pas partagé avec le compte de service, ou l'identifiant est faux.", status: 404 });
  if (!r.ok) {
    const t = await r.text(); let e = {};
    try { e = (JSON.parse(t).error) || {}; } catch (x) { /* texte brut */ }
    const reason = ((e.details || []).find((d) => d.reason) || {}).reason || ((e.errors || [])[0] || {}).reason || "";
    if (reason === "SERVICE_DISABLED" || reason === "accessNotConfigured") {
      const proj = (/project=(\d+)/.exec(t) || [])[1];
      throw Object.assign(new Error("L'API Google Drive n'est pas activée."), { why: "Active « Google Drive API » dans le projet Google Cloud du compte de service" + (proj ? " : https://console.cloud.google.com/apis/api/drive.googleapis.com/overview?project=" + proj : "") + ", attends 2 minutes, puis reconnecte." });
    }
    throw Object.assign(new Error("Drive : erreur " + r.status), { why: e.message || t.slice(0, 200) });
  }
  return r.json();
}

const FILE_FIELDS = "id,name,mimeType,size,webViewLink,thumbnailLink,modifiedTime";

export async function test(env, cred) {
  const sa = parseKey(cred);
  if (!cred.rootFolderId) throw Object.assign(new Error("Dossier manquant."), { why: "Indique l'identifiant du dossier racine." });
  try {
    const f = await call(cred, "/files/" + encodeURIComponent(cred.rootFolderId), { fields: "id,name,mimeType" });
    if (f.mimeType !== FOLDER) throw Object.assign(new Error("Ce n'est pas un dossier."), { why: "L'identifiant indiqué désigne un fichier, pas un dossier." });
    return "Dossier « " + f.name + " » (lecture seule)";
  } catch (e) {
    if (e.status === 404) e.why = "Partage le dossier avec " + sa.client_email + " (rôle Lecteur), puis réessaie.";
    throw e;
  }
}

export async function children(cred, folderId) {
  const out = [];
  let pageToken;
  do {
    const r = await call(cred, "/files", { q: "'" + folderId.replace(/'/g, "") + "' in parents and trashed = false", fields: "nextPageToken,files(" + FILE_FIELDS + ")", pageSize: "200", includeItemsFromAllDrives: "true", pageToken: pageToken || "" });
    out.push(...r.files);
    pageToken = r.nextPageToken;
  } while (pageToken);
  return out;
}

// Chemin relatif au dossier racine, ex. « 02_Sujets/004_SOC/reel ».
export async function folderByPath(cred, path) {
  let id = cred.rootFolderId;
  const parts = String(path || "").split("/").map((s) => s.trim()).filter(Boolean);
  for (const name of parts) {
    const kids = await children(cred, id);
    const next = kids.find((k) => k.mimeType === FOLDER && k.name === name) || kids.find((k) => k.mimeType === FOLDER && k.name.toLowerCase() === name.toLowerCase());
    if (!next) throw Object.assign(new Error("Dossier « " + name + " » introuvable dans le Drive."), { status: 404 });
    id = next.id;
  }
  return id;
}

export async function folder(cred, path) {
  const id = await folderByPath(cred, path);
  const files = (await children(cred, id)).filter((f) => f.mimeType !== FOLDER);
  return {
    id, url: "https://drive.google.com/drive/folders/" + id,
    files: files.map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, size: f.size ? +f.size : null, url: f.webViewLink, modified: f.modifiedTime })),
  };
}

// Téléchargement relayé par le Worker (même origine que l'app : aperçus et « Enregistrer dans Photos »).
export async function download(cred, fileId, range) {
  const t = await token(cred);
  const headers = { authorization: "Bearer " + t };
  if (range) headers.range = range;
  return fetch(API + "/files/" + encodeURIComponent(fileId) + "?alt=media&supportsAllDrives=true", { headers });
}
