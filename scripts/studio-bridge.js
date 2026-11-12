/* PlanneRs : pont entre le studio vidéo (otocut) et La Fabrique.
   Chaque vidéo exportée par le studio (et ses sous-titres ou sa transcription) est gardée de côté ;
   « Envoyer vers PlanneRs » les dépose dans La Fabrique, un post par vidéo. Rien ne change dans l'export lui-même. */
(function () {
  "use strict";
  const got = []; // { blob, name }
  const VIDEO = /\.(mp4|webm|mov)$/i, TEXT = /\.(srt|vtt|txt)$/i;
  const orig = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    try {
      const n = this.download || "";
      if (n && /^blob:/.test(this.href) && (VIDEO.test(n) || TEXT.test(n))) {
        const href = this.href;
        fetch(href).then((r) => r.blob()).then((b) => { got.push({ blob: b, name: n }); bar(); }).catch(() => {});
      }
    } catch (e) { /* l'export continue normalement */ }
    return orig.apply(this, arguments);
  };
  const en = () => /^en/.test(document.documentElement.lang || "");
  let box;
  function bar() {
    const vids = got.filter((x) => VIDEO.test(x.name)).length;
    if (!vids) return;
    if (!box) {
      box = document.createElement("div");
      box.setAttribute("role", "status");
      box.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483000;display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;background:#0E7490;color:#fff;font:600 14px system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25)";
      document.body.appendChild(box);
    }
    box.innerHTML = "";
    const t = document.createElement("span");
    t.textContent = (en() ? vids + " video" + (vids > 1 ? "s" : "") + " ready" : vids + " vidéo" + (vids > 1 ? "s" : "") + " prête" + (vids > 1 ? "s" : ""));
    const b = document.createElement("button");
    b.type = "button"; b.textContent = en() ? "Send to PlanneRs" : "Envoyer vers PlanneRs";
    b.style.cssText = "border:0;border-radius:999px;padding:8px 14px;background:#fff;color:#0E7490;font:700 14px system-ui,sans-serif;cursor:pointer";
    b.addEventListener("click", send);
    box.append(t, b);
  }
  async function send() {
    try {
      const c = await caches.open("planners-share");
      for (const k of await c.keys()) await c.delete(k);
      const vids = got.filter((x) => VIDEO.test(x.name)), texts = got.filter((x) => TEXT.test(x.name));
      const stem = (n) => n.replace(/\.[^.]+$/, "");
      const items = [];
      for (let i = 0; i < vids.length; i++) {
        const v = vids[i];
        // Sous-titres ou transcription du même nom (ou, à défaut, le seul fichier texte exporté).
        const tx = texts.find((x) => stem(x.name).startsWith(stem(v.name)) || stem(v.name).startsWith(stem(x.name))) || (texts.length === 1 ? texts[0] : null);
        await c.put("shared/" + i, new Response(v.blob, { headers: { "content-type": v.blob.type || "video/mp4", "x-name": encodeURIComponent(v.name) } }));
        items.push({ name: v.name, text: tx ? (await tx.blob.text()).slice(0, 20000) : "" });
      }
      await c.put("shared/meta", new Response(JSON.stringify({ source: "studio", n: vids.length, items })));
      location.href = "/#share";
    } catch (e) {
      alert((en() ? "Could not send to PlanneRs: " : "Envoi vers PlanneRs impossible : ") + e.message);
    }
  }
})();
