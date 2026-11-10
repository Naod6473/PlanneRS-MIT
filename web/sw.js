/* PlanneRs : service worker minimal. Il ne met rien en cache : il sert uniquement à recevoir
   les photos, vidéos et liens partagés depuis le téléphone (« Partager › PlanneRs », app installée). */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "POST" || !u.pathname.endsWith("/share-target")) return;
  e.respondWith((async () => {
    const fd = await e.request.formData();
    const c = await caches.open("planners-share");
    for (const k of await c.keys()) await c.delete(k);
    const files = fd.getAll("media").filter((f) => f && typeof f !== "string" && f.size);
    await Promise.all(files.map((f, i) => c.put("shared/" + i, new Response(f, { headers: { "content-type": f.type || "application/octet-stream", "x-name": encodeURIComponent(f.name || "media") } }))));
    await c.put("shared/meta", new Response(JSON.stringify({ title: fd.get("title") || "", text: fd.get("text") || "", url: fd.get("url") || "", n: files.length })));
    return Response.redirect(new URL("./#share", self.registration.scope).href, 303);
  })());
});
