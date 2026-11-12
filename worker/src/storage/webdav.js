// NAS ou Nextcloud par WebDAV (lecture, et dépôt de fichiers) : adresse + identifiant + mot de passe d'application.
// Nextcloud : https://ton-serveur/remote.php/dav/files/<utilisateur>/
// Le serveur doit être joignable depuis Internet.
import { err, joinPath } from "./common.js";

export const kind = "source";
export const fields = [
  { key: "url", label: "Adresse WebDAV (ex. https://cloud.exemple.fr/remote.php/dav/files/moi/)" },
  { key: "username", label: "Identifiant" },
  { key: "password", label: "Mot de passe d'application", secret: true },
  { key: "root", label: "Dossier racine (facultatif, ex. MesMedias)", optional: true },
  { key: "webUrl", label: "Adresse pour ouvrir un dossier dans le navigateur (facultatif)", optional: true },
];

const auth = (cred) => "Basic " + btoa(unescape(encodeURIComponent(cred.username + ":" + cred.password)));
const baseUrl = (cred) => new URL(cred.url.replace(/\/?$/, "/"));
const dirUrl = (cred, path) => { const p = joinPath(cred.root || "", path); return new URL(p ? p.split("/").map(encodeURIComponent).join("/") + "/" : "", baseUrl(cred)); };

// Réponse PROPFIND : on lit href, nom, taille et type sans analyseur XML (indisponible dans les Workers).
export function parseMultistatus(xml) {
  const out = [];
  for (const m of xml.matchAll(/<(?:\w+:)?response\b[\s\S]*?<\/(?:\w+:)?response>/g)) {
    const r = m[0];
    const href = ((/<(?:\w+:)?href>([^<]+)<\/(?:\w+:)?href>/.exec(r) || [])[1] || "").trim();
    const isDir = /<(?:\w+:)?collection\s*\/>/.test(r);
    const size = +((/<(?:\w+:)?getcontentlength>(\d+)</.exec(r) || [])[1] || 0);
    out.push({ href, isDir, size, name: decodeURIComponent(href.replace(/\/$/, "").split("/").pop() || "") });
  }
  return out;
}

async function propfind(cred, url) {
  const r = await fetch(url, { method: "PROPFIND", headers: { authorization: auth(cred), depth: "1", "content-type": "application/xml" },
    body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getcontentlength/></d:prop></d:propfind>' });
  if (r.status === 401) throw err("WebDAV : identifiants refusés.", "Vérifie l'identifiant et le mot de passe d'application.", 401);
  if (r.status === 404) throw err("WebDAV : dossier introuvable.", url.pathname, 404);
  if (r.status !== 207 && !r.ok) throw err("WebDAV : erreur " + r.status + ".", (await r.text()).slice(0, 200), r.status);
  return parseMultistatus(await r.text());
}

export async function test(env, cred) {
  if (!cred.url || !cred.username || !cred.password) throw err("Identifiants incomplets.", "Il faut l'adresse, l'identifiant et le mot de passe.");
  const items = await propfind(cred, dirUrl(cred, ""));
  return "Dossier joignable · " + Math.max(0, items.length - 1) + " éléments";
}

export async function folder(cred, path) {
  const url = dirUrl(cred, path);
  const items = await propfind(cred, url);
  const files = items.filter((i) => !i.isDir).map((i) => ({ id: new URL(i.href, url).pathname, name: i.name, size: i.size, url: cred.webUrl ? cred.webUrl : new URL(i.href, url).href }));
  return { id: url.pathname, url: cred.webUrl || url.href, files };
}

export async function download(cred, id, range) {
  const headers = { authorization: auth(cred) };
  if (range) headers.range = range;
  const base = new URL(baseUrl(cred)), u = new URL(id, base);
  // Seulement des fichiers du même serveur : jamais les identifiants envoyés ailleurs.
  if (u.origin !== base.origin) return new Response(null, { status: 404 });
  return fetch(u, { headers });
}

// Dépôt : crée les dossiers manquants (MKCOL, 405 = existe déjà) puis envoie le fichier (PUT).
export async function upload(cred, path, name, bytes, type) {
  const parts = joinPath(cred.root || "", path).split("/").filter(Boolean);
  let at = baseUrl(cred);
  for (const part of parts) {
    at = new URL(encodeURIComponent(part) + "/", at);
    const r = await fetch(at, { method: "MKCOL", headers: { authorization: auth(cred) } });
    if (r.status === 401) throw err("WebDAV : identifiants refusés.", "Vérifie l'identifiant et le mot de passe d'application.", 401);
    if (!r.ok && r.status !== 405 && r.status !== 301) throw err("WebDAV : impossible de créer le dossier « " + part + " » (" + r.status + ").", "Le compte a-t-il le droit d'écrire ?", r.status);
  }
  const file = new URL(encodeURIComponent(name), at);
  const r = await fetch(file, { method: "PUT", headers: { authorization: auth(cred), "content-type": type || "application/octet-stream" }, body: bytes });
  if (r.status === 401 || r.status === 403) throw err("WebDAV : écriture refusée (" + r.status + ").", "Le compte n'a que le droit de lecture sur ce dossier.", r.status);
  if (!r.ok) throw err("WebDAV : envoi refusé (" + r.status + ").", (await r.text()).slice(0, 200), r.status);
  return { id: file.pathname, name, webUrl: cred.webUrl || "" };
}
