// Contrôle d'accès : l'application est placée derrière Cloudflare Access (Zero Trust).
// Le Worker vérifie lui-même le jeton signé par Access, pour ne jamais être exposé par erreur.
// Doc : https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/
let certCache = { at: 0, keys: [] };

const b64url = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

async function keys(team, fresh) {
  if (!fresh && Date.now() - certCache.at < 3600e3 && certCache.keys.length) return certCache.keys;
  const r = await fetch("https://" + team + "/cdn-cgi/access/certs");
  const j = await r.json();
  certCache = { at: Date.now(), keys: j.keys || [] };
  return certCache.keys;
}

export async function checkAccess(request, env) {
  // Sans contrôle d'accès : seulement en local (wrangler dev), jamais sur une adresse publique.
  if (env.ALLOW_NO_AUTH === "true" && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(request.url).hostname)) return { ok: true, email: "local" };
  const team = env.ACCESS_TEAM_DOMAIN, aud = env.ACCESS_AUD;
  if (!team || !aud) return { ok: false, why: "Accès non configuré : renseigne ACCESS_TEAM_DOMAIN et ACCESS_AUD (voir docs/demarrage/installation.md)." };
  const jwt = request.headers.get("cf-access-jwt-assertion") || (request.headers.get("cookie") || "").match(/CF_Authorization=([^;]+)/)?.[1];
  if (!jwt) return { ok: false, why: "Connexion requise." };
  const [h, p, s] = jwt.split(".");
  try {
    const header = JSON.parse(new TextDecoder().decode(b64url(h)));
    const payload = JSON.parse(new TextDecoder().decode(b64url(p)));
    // Clé inconnue : Access a peut-être changé de clé depuis la dernière lecture.
    const jwk = (await keys(team)).find((k) => k.kid === header.kid) || (Date.now() - certCache.at > 60e3 ? (await keys(team, true)).find((k) => k.kid === header.kid) : null);
    if (!jwk) return { ok: false, why: "Clé de signature inconnue." };
    const k = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", k, b64url(s), new TextEncoder().encode(h + "." + p));
    const audOk = [].concat(payload.aud).includes(aud);
    if (!valid || !audOk || payload.exp * 1000 < Date.now() || payload.iss !== "https://" + team) return { ok: false, why: "Jeton d'accès invalide." };
    return { ok: true, email: payload.email || payload.common_name || "" }; // common_name : jeton de service
  } catch (e) {
    return { ok: false, why: "Jeton d'accès illisible." };
  }
}
