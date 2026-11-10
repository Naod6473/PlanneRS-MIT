// Cloudflare R2 ou tout stockage compatible S3 : dépôt des médias + adresse publique (domaine du bucket).
// Signature AWS Signature Version 4. Doc R2 : https://developers.cloudflare.com/r2/api/s3/api/
import { err, hex, joinPath } from "./common.js";

export const kind = "host";
export const fields = [
  { key: "endpoint", label: "Point d'accès S3 (R2 : https://<id du compte>.r2.cloudflarestorage.com)" },
  { key: "bucket", label: "Nom du bucket" },
  { key: "accessKeyId", label: "Access Key ID" },
  { key: "secretAccessKey", label: "Secret Access Key", secret: true },
  { key: "publicBaseUrl", label: "Adresse publique du bucket (R2 : domaine personnalisé ou https://pub-….r2.dev)" },
  { key: "region", label: "Région (facultatif, « auto » pour R2)", optional: true },
  { key: "folder", label: "Dossier (facultatif, par défaut media)", optional: true },
];

const enc = new TextEncoder();
const sha256 = async (data) => hex(await crypto.subtle.digest("SHA-256", typeof data === "string" ? enc.encode(data) : data));
async function hmac(key, data) {
  const k = await crypto.subtle.importKey("raw", typeof key === "string" ? enc.encode(key) : key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
}
const uriEnc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

// Renvoie les en-têtes signés. `headers` : en-têtes à signer (host ajouté automatiquement).
export async function sign({ method, url, headers = {}, payloadHash, accessKeyId, secretAccessKey, region, service = "s3", amzDate }) {
  const u = new URL(url);
  amzDate = amzDate || new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const day = amzDate.slice(0, 8);
  const h = Object.assign({}, headers, { host: u.host, "x-amz-date": amzDate });
  const names = Object.keys(h).map((k) => k.toLowerCase()).sort();
  const lower = Object.fromEntries(Object.entries(h).map(([k, v]) => [k.toLowerCase(), String(v).trim()]));
  const query = [...u.searchParams.entries()].map(([k, v]) => [uriEnc(k), uriEnc(v)]).sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1)).map(([k, v]) => k + "=" + v).join("&");
  const canonical = [method, u.pathname.split("/").map((x) => uriEnc(decodeURIComponent(x))).join("/") || "/", query,
    names.map((n) => n + ":" + lower[n] + "\n").join(""), names.join(";"), payloadHash].join("\n");
  const scope = day + "/" + region + "/" + service + "/aws4_request";
  const toSign = "AWS4-HMAC-SHA256\n" + amzDate + "\n" + scope + "\n" + (await sha256(canonical));
  let k = await hmac("AWS4" + secretAccessKey, day);
  k = await hmac(k, region); k = await hmac(k, service); k = await hmac(k, "aws4_request");
  const sig = hex(await hmac(k, toSign));
  return Object.assign(h, { authorization: "AWS4-HMAC-SHA256 Credential=" + accessKeyId + "/" + scope + ", SignedHeaders=" + names.join(";") + ", Signature=" + sig });
}

const base = (cred) => cred.endpoint.replace(/\/$/, "") + "/" + encodeURIComponent(cred.bucket);

async function s3(cred, method, path, body, type) {
  const url = base(cred) + path;
  const payloadHash = body ? await sha256(body) : await sha256("");
  const headers = { "x-amz-content-sha256": payloadHash };
  if (type) headers["content-type"] = type;
  const signed = await sign({ method, url, headers, payloadHash, accessKeyId: cred.accessKeyId, secretAccessKey: cred.secretAccessKey, region: cred.region || "auto" });
  delete signed.host;
  return fetch(url, { method, headers: signed, body });
}

export async function test(env, cred) {
  for (const k of ["endpoint", "bucket", "accessKeyId", "secretAccessKey", "publicBaseUrl"]) if (!cred[k]) throw err("Il manque : " + k + ".", "Remplis tous les champs obligatoires.");
  const r = await s3(cred, "GET", "?list-type=2&max-keys=1");
  if (r.status === 403 || r.status === 401) throw err("Clés refusées par le stockage.", (await r.text()).slice(0, 200));
  if (r.status === 404) throw err("Bucket introuvable.", "Vérifie le nom du bucket et le point d'accès.");
  if (!r.ok) throw err("Stockage : erreur " + r.status + ".", (await r.text()).slice(0, 200));
  return "Bucket « " + cred.bucket + " » · adresse publique " + cred.publicBaseUrl;
}

export async function put(cred, path, bytes, type) {
  const key = joinPath(cred.folder || "media", path);
  const r = await s3(cred, "PUT", "/" + key.split("/").map(uriEnc).join("/"), bytes, type || "application/octet-stream");
  if (!r.ok) throw err("Envoi refusé par le stockage (" + r.status + ").", (await r.text()).slice(0, 200));
  return cred.publicBaseUrl.replace(/\/$/, "") + "/" + key.split("/").map(encodeURIComponent).join("/");
}
