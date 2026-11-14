/* PlanneRs : liste d'attente de la version hébergée.
   Le site vitrine envoie une adresse e-mail sur /attente (public, même contrôle d'origine et même limite que /t).
   Lecture et suppression protégées par Access (api/attente). On ne garde que l'adresse, la date, la langue et un mot facultatif. */
import { CORS, allow, originOk } from "./visites.js";

const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;

export function cleanEmail(v) {
  const e = String(v == null ? "" : v).trim().toLowerCase();
  return e.length <= 254 && EMAIL.test(e) && !e.includes("..") ? e : null;
}

export async function join(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") return new Response("POST", { status: 405, headers: CORS });
  if (!originOk(request, env)) return new Response(null, { status: 403, headers: CORS });
  if (!allow("a:" + (request.headers.get("cf-connecting-ip") || "?"), Date.now())) return new Response(null, { status: 429, headers: CORS });
  const txt = await request.text();
  if (txt.length > 2000) return new Response(null, { status: 413, headers: CORS });
  let b; try { b = JSON.parse(txt); } catch { return new Response(null, { status: 400, headers: CORS }); }
  if (b && b.website) return new Response(null, { status: 204, headers: CORS }); // champ piège rempli par les robots
  const email = cleanEmail(b && b.email);
  if (!email) return new Response(JSON.stringify({ error: "email" }), { status: 400, headers: { ...CORS, "content-type": "application/json" } });
  const lang = b.lang === "en" ? "en" : "fr", note = b.note ? String(b.note).replace(/[\u0000-\u001f]/g, " ").slice(0, 200) : null;
  if (env.DB) {
    const c = await env.DB.prepare("SELECT COUNT(*) AS n FROM attente").first();
    if (c && c.n >= 20000) return new Response(null, { status: 429, headers: CORS });
    await env.DB.prepare("INSERT OR IGNORE INTO attente (email, at, lang, note) VALUES (?,?,?,?)").bind(email, new Date().toISOString(), lang, note).run();
  }
  return new Response(null, { status: 204, headers: CORS });
}

export async function list(env) {
  const r = await env.DB.prepare("SELECT email, at, lang, note FROM attente ORDER BY at DESC LIMIT 5000").all();
  return r.results || [];
}

export async function remove(env, email) {
  const e = cleanEmail(email);
  if (!e) return false;
  await env.DB.prepare("DELETE FROM attente WHERE email = ?").bind(e).run();
  return true;
}
