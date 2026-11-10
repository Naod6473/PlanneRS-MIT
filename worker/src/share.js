// Lien de validation pour un client : une page publique, sans compte, limitée aux posts partagés.
// Adresse : /v/<jeton>. Le jeton est aléatoire, expire au bout de 30 jours, et ne permet que
// deux actions : valider une légende, ou laisser un commentaire.
// Cloudflare Access protège tout le domaine : il faut une règle « Bypass » sur le chemin /v/* (voir la doc).
import * as db from "./db.js";

const DAY = 864e5;
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const FORMATS = { reel: "Reel", carousel: "Carrousel", image: "Image", story: "Story", text: "Texte", video: "Vidéo", document: "Document" };
const NETS = { instagram: "Instagram", facebook: "Facebook", threads: "Threads", linkedin: "LinkedIn", x: "X", bluesky: "Bluesky", mastodon: "Mastodon", tiktok: "TikTok", youtube: "YouTube", pinterest: "Pinterest" };
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const longDate = (d) => { if (!d) return "sans date"; const [y, m, j] = d.split("-").map(Number); return j + " " + MONTHS[m - 1] + " " + y; };

export function newToken() {
  const b = new Uint8Array(24); crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Crée un lien pour une liste de posts. Renvoie le jeton.
export async function create(env, ids, by, workspace) {
  const token = newToken();
  await db.putKV(env, "share:" + token, { ids: ids.slice(0, 100), by: by || "", workspace: workspace || "", created: Date.now() });
  return token;
}

async function load(env, token) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token || "")) return null;
  const s = await db.getKV(env, "share:" + token);
  if (!s || Date.now() - s.created > 30 * DAY) return null;
  return s;
}

const CSS = `:root{--bg:#F4F4F1;--panel:#fff;--ink:#14171A;--ink2:#454C53;--line:#E2E3DE;--ok:#1B7F4B;--act:#14171A;--actfg:#fff;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#121416;--panel:#1B1E21;--ink:#ECEEE9;--ink2:#B4BAC0;--line:#2C3135;--ok:#5BC48A;--act:#ECEEE9;--actfg:#14171A;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 Inter,system-ui,sans-serif}
main{max-width:720px;margin:0 auto;padding:24px max(16px,env(safe-area-inset-left)) 48px}
h1{font-size:22px;margin:0 0 4px}.muted{color:var(--ink2)}
article{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px;margin-top:16px;display:grid;gap:10px}
article h2{font-size:17px;margin:0}article img{max-width:100%;border-radius:10px;max-height:360px;object-fit:cover}
pre{white-space:pre-wrap;font:inherit;margin:0;padding:12px;border-radius:10px;background:var(--bg)}
textarea{width:100%;min-height:70px;font:inherit;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--panel);color:var(--ink)}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
button{min-height:44px;padding:0 16px;border-radius:10px;border:1px solid var(--line);background:var(--panel);color:var(--ink);font:inherit;font-weight:600;cursor:pointer}
button.primary{background:var(--act);color:var(--actfg);border-color:var(--act)}
.ok{color:var(--ok);font-weight:700}`;

export function renderPage(share, posts, token) {
  const items = posts.map((p) => {
    const nets = (p.networks || []).map((n) => NETS[n] || n).join(", ");
    const img = /^https:\/\//.test(p.thumb || "") ? '<img src="' + esc(p.thumb) + '" alt="" loading="lazy">' : "";
    const done = p.captionValidated || p.status === "published";
    return '<article id="p-' + esc(p.id) + '"><div class="muted">' + esc(FORMATS[p.format] || "") + " · " + esc(nets) + " · " + esc(longDate(p.date)) + (p.time ? " à " + esc(p.time) : "") + "</div>" +
      "<h2>" + esc(p.title) + "</h2>" + img + (p.caption ? "<pre>" + esc(p.caption) + "</pre>" : "") +
      Object.entries(p.captions || {}).map(([n, c]) => '<div class="muted">Version ' + esc(NETS[n] || n) + " :</div><pre>" + esc(c) + "</pre>").join("") +
      (done ? '<p class="ok">✓ Validé</p>' :
        '<form method="post" action="/v/' + esc(token) + '"><input type="hidden" name="id" value="' + esc(p.id) + '"><div class="row"><button class="primary" name="action" value="validate">Valider</button></div>' +
        '<p class="muted" style="margin:12px 0 4px">Ou demander une modification :</p><textarea name="text" aria-label="Commentaire"></textarea><div class="row" style="margin-top:8px"><button name="action" value="comment">Envoyer le commentaire</button></div></form>') +
      "</article>";
  }).join("");
  return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Validation des publications</title><style>' + CSS + "</style></head><body><main>" +
    "<h1>Publications à valider</h1><p class=\"muted\">" + (share.workspace ? esc(share.workspace) + " · " : "") + "Relis chaque texte, puis valide-le ou laisse un commentaire. Lien valable 30 jours.</p>" +
    (items || "<p>Plus rien à valider ici.</p>") + "</main></body></html>";
}

const html = (body, status = 200) => new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex", "referrer-policy": "no-referrer" } });

export async function handle(request, env, token, nowLocal) {
  const share = await load(env, token);
  if (!share) return html("<!doctype html><meta charset=utf-8><title>Lien expiré</title><p style=\"font:16px system-ui;padding:24px\">Ce lien n'est plus valable. Demande un nouveau lien.</p>", 404);
  if (request.method === "POST") {
    const f = await request.formData();
    const id = String(f.get("id") || ""), action = String(f.get("action") || ""), text = String(f.get("text") || "").trim().slice(0, 2000);
    if (!share.ids.includes(id)) return html("Post inconnu.", 400);
    const p = await db.getPost(env, id);
    if (p && p.status !== "published") {
      if (action === "validate") {
        p.captionValidated = true; if (p.stage === "caption") p.stage = "ready";
        await db.savePosts(env, [p]); await db.addLog(env, { at: nowLocal, level: "change", text: "Légende validée par le client : " + p.title, postId: p.id });
      } else if (action === "comment" && text) {
        (p.comments = p.comments || []).push({ at: nowLocal, by: "Client", text });
        await db.savePosts(env, [p]); await db.addLog(env, { at: nowLocal, level: "info", text: "Commentaire du client sur « " + p.title + " » : " + text.slice(0, 140), postId: p.id });
      }
    }
    return Response.redirect(new URL("/v/" + token + "#p-" + encodeURIComponent(id), request.url).toString(), 303);
  }
  const posts = (await Promise.all(share.ids.map((id) => db.getPost(env, id)))).filter(Boolean);
  return html(renderPage(share, posts, token));
}
