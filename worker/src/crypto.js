// Chiffrement des identifiants de connexion (AES-GCM) avant stockage dans D1.
// La clé vient du secret ENCRYPTION_KEY (wrangler secret put ENCRYPTION_KEY).
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (u8) => btoa(String.fromCharCode(...u8));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function key(env) {
  if (!env.ENCRYPTION_KEY) throw new Error("Secret ENCRYPTION_KEY manquant : lance « npx wrangler secret put ENCRYPTION_KEY ».");
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(env.ENCRYPTION_KEY));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function seal(env, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(env), enc.encode(JSON.stringify(obj))));
  return b64(iv) + "." + b64(ct);
}
export async function open(env, s) {
  if (!s) return {};
  const [iv, ct] = s.split(".");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await key(env), unb64(ct));
  return JSON.parse(dec.decode(pt));
}
