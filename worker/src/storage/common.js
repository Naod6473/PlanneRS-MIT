// Outils communs aux stockages.
// Deux familles :
// - « source » (Google Drive, Dropbox, OneDrive, WebDAV) : là où l'on range ses fichiers.
//   Interface : test(env, cred, save) ; folder(cred, path, save) -> { id, url, files: [{ id, name, url, size }] } ; download(cred, id, range, save) -> Response
// - « hébergement » (GitHub Pages, R2/S3) : donne une adresse publique aux médias pour Instagram, Threads, Facebook.
//   Interface : test(env, cred) ; put(cred, path, bytes, type) -> url publique
// `save(cred)` enregistre des identifiants renouvelés (jeton qui tourne).

export const err = (msg, why, status) => Object.assign(new Error(msg), { why, status });

export async function okJson(name, r) {
  const t = await r.text();
  let j = null;
  try { j = t ? JSON.parse(t) : {}; } catch (e) { j = null; }
  if (!r.ok) {
    const m = (j && (j.error_description || (j.error && (j.error.message || j.error)) || j.message || j.error_summary)) || t.slice(0, 200) || r.statusText;
    if (r.status === 401) throw err(name + " : identifiants refusés.", typeof m === "string" ? m : JSON.stringify(m), 401);
    if (r.status === 403) throw err(name + " : accès interdit.", typeof m === "string" ? m : JSON.stringify(m), 403);
    if (r.status === 404) throw err(name + " : introuvable.", typeof m === "string" ? m : JSON.stringify(m), 404);
    throw err(name + " : erreur " + r.status + ".", typeof m === "string" ? m : JSON.stringify(m), r.status);
  }
  return j;
}

export const b64 = (bytes) => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
export const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
export const joinPath = (...p) => p.filter((x) => x != null && x !== "").map((x) => String(x).replace(/^\/+|\/+$/g, "")).filter(Boolean).join("/");
