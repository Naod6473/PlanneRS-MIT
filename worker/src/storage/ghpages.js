// GitHub Pages : publie les médias dans un dépôt servi par GitHub Pages, ce qui leur donne une adresse publique.
// Jeton « fine-grained » limité à ce dépôt, droit Contents : Read and write.
// Doc : https://docs.github.com/rest/repos/contents#create-or-update-file-contents
import { err, okJson, b64, joinPath } from "./common.js";

export const kind = "host";
export const fields = [
  { key: "token", label: "Jeton GitHub (fine-grained, dépôt choisi, Contents : Read and write)", secret: true },
  { key: "repo", label: "Dépôt (propriétaire/nom), servi par GitHub Pages" },
  { key: "branch", label: "Branche publiée (facultatif, par défaut main)", optional: true },
  { key: "folder", label: "Dossier dans le dépôt (facultatif, par défaut media)", optional: true },
  { key: "baseUrl", label: "Adresse publique du site (facultatif, par défaut https://propriétaire.github.io/nom/)", optional: true },
];

const gh = (cred, path, init = {}) => fetch("https://api.github.com/" + path, Object.assign({}, init, {
  headers: Object.assign({ authorization: "Bearer " + cred.token, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "PlanneRs" }, init.headers || {}),
}));

export function publicBase(cred) {
  if (cred.baseUrl) return cred.baseUrl.replace(/\/?$/, "/");
  const [owner, name] = String(cred.repo || "").split("/");
  return name && name.toLowerCase() === owner.toLowerCase() + ".github.io" ? "https://" + name.toLowerCase() + "/" : "https://" + owner.toLowerCase() + ".github.io/" + name + "/";
}

export async function test(env, cred) {
  if (!cred.token || !/^[\w.-]+\/[\w.-]+$/.test(cred.repo || "")) throw err("Dépôt ou jeton manquant.", "Indique le dépôt sous la forme propriétaire/nom.");
  const r = await okJson("GitHub", await gh(cred, "repos/" + cred.repo));
  if (r.permissions && !r.permissions.push) throw err("Ce jeton ne peut pas écrire dans " + cred.repo + ".", "Donne au jeton le droit Contents : Read and write sur ce dépôt.");
  return (r.private ? "Dépôt privé " : "Dépôt ") + r.full_name + " · médias publiés sur " + publicBase(cred);
}

// Envoie (ou remplace) un fichier et renvoie son adresse publique.
export async function put(cred, path, bytes, type) {
  if (bytes.length > 95 * 1024 * 1024) throw err("Fichier trop lourd pour GitHub (100 Mo max).", "Compresse la vidéo ou utilise R2.");
  const file = joinPath(cred.folder || "media", path);
  const enc = file.split("/").map(encodeURIComponent).join("/");
  const branch = cred.branch || "main";
  let sha;
  const cur = await gh(cred, "repos/" + cred.repo + "/contents/" + enc + "?ref=" + encodeURIComponent(branch));
  if (cur.ok) sha = (await cur.json()).sha;
  await okJson("GitHub", await gh(cred, "repos/" + cred.repo + "/contents/" + enc, {
    method: "PUT", headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "PlanneRs : " + file, content: b64(bytes), branch, sha }),
  }));
  return publicBase(cred) + enc;
}
