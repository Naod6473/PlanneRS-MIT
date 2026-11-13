/* PlanneRs : suivi des visites du site vitrine et de la démo.
   Des événements anonymes : pas de cookie, pas d'adresse IP, un identifiant tiré au hasard par onglet.
   Réception publique sur /t (le site et la démo peuvent être hébergés ailleurs), lecture protégée par Access (api/visites). */

const MAX_BODY = 16000, MAX_EVENTS = 40, KEEP_DAYS = 180;
const TYPES = new Set(["view", "leave", "click", "section", "video", "screen", "action", "lang", "calc", "swipe", "error"]);
const clip = (v, n) => (v == null ? null : String(v).replace(/[\u0000-\u001f]/g, " ").slice(0, n));

export const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

// Nettoie un lot envoyé par le navigateur. Rien n'est cru sur parole : tout est borné.
export function clean(body, cf, now) {
  const b = body && typeof body === "object" ? body : {};
  const sid = clip(b.sid, 40);
  if (!sid || !/^[A-Za-z0-9_-]{8,40}$/.test(sid)) return [];
  const src = b.src === "demo" ? "demo" : "site";
  const at = now.toISOString(), day = at.slice(0, 10);
  const device = ["mobile", "tablet", "desktop"].includes(b.device) ? b.device : null;
  const lang = b.lang === "en" || b.lang === "fr" ? b.lang : clip(b.lang, 5);
  let ref = clip(b.ref, 120);
  if (ref) { try { ref = new URL(ref).hostname.replace(/^www\./, ""); } catch { ref = clip(ref.replace(/^https?:\/\//, "").split("/")[0], 80); } }
  const country = clip(cf && cf.country, 2);
  return (Array.isArray(b.ev) ? b.ev : []).slice(0, MAX_EVENTS).filter((e) => e && TYPES.has(e.t)).map((e) => ({
    at, day, sid, src, page: clip(e.p || b.page, 80), type: e.t, label: clip(e.l, 120),
    value: Number.isFinite(+e.v) ? Math.max(-1e9, Math.min(1e9, +e.v)) : null,
    ref: e.t === "view" ? ref : null, country, device, lang,
  }));
}

export async function collect(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") return new Response("POST", { status: 405, headers: CORS });
  const txt = await request.text();
  if (txt.length > MAX_BODY) return new Response(null, { status: 413, headers: CORS });
  let body; try { body = JSON.parse(txt); } catch { return new Response(null, { status: 400, headers: CORS }); }
  const rows = clean(body, request.cf, new Date());
  if (rows.length && env.DB) {
    const q = "INSERT INTO visites (at, day, sid, src, page, type, label, value, ref, country, device, lang) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)";
    await env.DB.batch(rows.map((r) => env.DB.prepare(q).bind(r.at, r.day, r.sid, r.src, r.page, r.type, r.label, r.value, r.ref, r.country, r.device, r.lang)));
  }
  return new Response(null, { status: 204, headers: CORS });
}

export async function purge(env) {
  if (!env.DB) return;
  const lim = new Date(Date.now() - KEEP_DAYS * 864e5).toISOString().slice(0, 10);
  await env.DB.prepare("DELETE FROM visites WHERE day < ?").bind(lim).run();
}

// Tableau de bord : calculé à partir des événements bruts de la période.
export function summarize(rows, days, today) {
  const by = (f) => { const m = new Map(); rows.forEach((r) => { const k = f(r); if (k == null) return; m.set(k, (m.get(k) || 0) + 1); }); return m; };
  const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n || 10).map(([k, c]) => ({ k, n: c }));
  const S = new Map(); // sessions
  rows.forEach((r) => {
    let s = S.get(r.sid);
    if (!s) S.set(r.sid, (s = { sid: r.sid, src: new Set(), first: r.at, last: r.at, siteMs: 0, demoMs: 0, ref: null, country: r.country, device: r.device, lang: r.lang, ev: [], demoClick: false, screens: new Set(), scroll: 0 }));
    s.src.add(r.src); if (r.at < s.first) s.first = r.at; if (r.at > s.last) s.last = r.at;
    if (r.ref && !s.ref) s.ref = r.ref;
    if (r.type === "leave") { if (r.src === "demo") s.demoMs = Math.max(s.demoMs, r.value || 0); else s.siteMs = Math.max(s.siteMs, r.value || 0); }
    if (r.type === "section" && r.label === "scroll") s.scroll = Math.max(s.scroll, r.value || 0);
    if (r.type === "click" && /demo/i.test(r.label || "")) s.demoClick = true;
    if (r.type === "screen" && r.src === "demo") s.screens.add(r.label);
    s.ev.push(r);
  });
  const ss = [...S.values()], site = ss.filter((s) => s.src.has("site")), demo = ss.filter((s) => s.src.has("demo"));
  const avg = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);
  const med = (a) => { if (!a.length) return 0; const b = [...a].sort((x, y) => x - y); return Math.round(b[Math.floor(b.length / 2)]); };
  const siteT = site.map((s) => s.siteMs).filter((x) => x > 0), demoT = demo.map((s) => s.demoMs).filter((x) => x > 0);
  const daysList = []; for (let i = days - 1; i >= 0; i--) daysList.push(new Date(Date.parse(today) - i * 864e5).toISOString().slice(0, 10));
  const perDay = daysList.map((d) => ({ d, site: new Set(rows.filter((r) => r.day === d && r.src === "site").map((r) => r.sid)).size, demo: new Set(rows.filter((r) => r.day === d && r.src === "demo").map((r) => r.sid)).size }));
  const sec = (name) => site.filter((s) => s.ev.some((e) => e.type === "section" && e.label === name)).length;
  const funnelNames = ["hero", "videos", "tout", "prix", "fonctions", "connexions", "installer", "questions", "fin"];
  const vids = new Map();
  rows.filter((r) => r.type === "video").forEach((r) => {
    const [name, what] = String(r.label || "").split(":");
    const v = vids.get(name) || { k: name, play: 0, done: 0, pct: [] };
    if (what === "play") v.play++; if (what === "end") v.done++; if (what === "stop" && r.value != null) v.pct.push(r.value);
    vids.set(name, v);
  });
  const watch = [...vids.values()].map((v) => ({ k: v.k, play: v.play, done: v.done, pct: avg(v.pct) })).sort((a, b) => b.play - a.play);
  const screenMs = new Map();
  rows.filter((r) => r.type === "screen" && r.src === "demo" && r.value > 0).forEach((r) => screenMs.set(r.label, (screenMs.get(r.label) || 0) + r.value));
  return {
    days, updated: new Date().toISOString(),
    site: { visitors: site.length, views: rows.filter((r) => r.src === "site" && r.type === "view").length, avgMs: avg(siteT), medMs: med(siteT), scroll: avg(site.map((s) => s.scroll).filter((x) => x > 0)), demoClick: site.filter((s) => s.demoClick).length },
    demo: { visitors: demo.length, fromSite: demo.filter((s) => s.src.has("site")).length, avgMs: avg(demoT), medMs: med(demoT), screens: top(by((r) => (r.src === "demo" && r.type === "screen" ? r.label : null)), 12).map((x) => Object.assign(x, { ms: screenMs.get(x.k) || 0 })), actions: top(by((r) => (r.src === "demo" && r.type === "action" ? r.label : null)), 12) },
    perDay,
    funnel: funnelNames.map((k) => ({ k, n: sec(k) })),
    clicks: top(by((r) => (r.src === "site" && r.type === "click" ? r.label : null)), 15),
    videos: watch,
    refs: top(by((r) => (r.type === "view" ? r.ref || "(direct)" : null)), 10),
    countries: top(by((r) => (r.type === "view" ? r.country || "?" : null)), 10),
    devices: top(by((r) => (r.type === "view" ? r.device || "?" : null)), 3),
    langs: top(by((r) => (r.type === "view" ? r.lang || "?" : null)), 4),
    calc: top(by((r) => (r.type === "calc" ? r.label : null)), 8),
    sessions: ss.sort((a, b) => (a.last < b.last ? 1 : -1)).slice(0, 40).map((s) => ({
      first: s.first, last: s.last, src: [...s.src], siteMs: s.siteMs, demoMs: s.demoMs, ref: s.ref, country: s.country, device: s.device, lang: s.lang,
      ev: s.ev.sort((a, b) => (a.at < b.at ? -1 : 1)).filter((e) => e.type !== "leave").slice(0, 60).map((e) => ({ at: e.at, src: e.src, t: e.type, l: e.label, v: e.value })),
    })),
  };
}

export async function report(env, days) {
  const d = Math.max(1, Math.min(180, Math.round(+days || 30)));
  const today = new Date().toISOString().slice(0, 10), from = new Date(Date.parse(today) - (d - 1) * 864e5).toISOString().slice(0, 10);
  const r = await env.DB.prepare("SELECT at, day, sid, src, page, type, label, value, ref, country, device, lang FROM visites WHERE day >= ? ORDER BY id LIMIT 50000").bind(from).all();
  return summarize(r.results || [], d, today);
}
