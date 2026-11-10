// Vérification des liens d'une légende : un lien qui ne répond plus est signalé dans les contrôles du post.
// On ne signale que les vraies pannes (404, 410, erreurs serveur, site introuvable) : beaucoup de sites
// refusent les robots (401, 403, 429) alors qu'ils marchent très bien dans un navigateur.

export function extract(text) {
  return [...new Set((String(text || "").match(/https?:\/\/[^\s<>"')\]]+/g) || []).map((u) => u.replace(/[.,;:!?»]+$/, "")))].slice(0, 10);
}

export async function checkUrl(url, fetchFn) {
  const f = fetchFn || fetch;
  const go = (method) => f(url, { method, redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (compatible; PlanneRs link check)" }, signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined });
  try {
    let r = await go("HEAD");
    if (r.status === 405 || r.status === 501 || r.status === 400) r = await go("GET");
    const bad = r.status === 404 || r.status === 410 || r.status >= 500;
    return { url, ok: !bad, status: r.status };
  } catch (e) {
    return { url, ok: false, status: 0, error: "Le site ne répond pas" };
  }
}

// Vérifie tous les liens d'un post (légende commune, versions par réseau, premier commentaire).
export async function checkPost(p, fetchFn) {
  const texts = [p.caption, p.firstComment, ...Object.values(p.captions || {})];
  const urls = extract(texts.join("\n"));
  const res = await Promise.all(urls.map((u) => checkUrl(u, fetchFn)));
  return res.filter((r) => !r.ok).map((r) => ({ url: r.url, status: r.status }));
}
