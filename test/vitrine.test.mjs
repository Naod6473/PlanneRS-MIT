import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/src/index.js";

const env = {
  PUBLIC_HOST: "info.example.org",
  ASSETS: { fetch: async (req) => { const p = new URL(req.url).pathname; return new Response(p === "/" ? "<html><head></head><body>app</body></html>" : "asset:" + p, { status: 200 }); } },
};
const go = (path, init) => worker.fetch(new Request("https://info.example.org" + path, init), env);

test("adresse publique : vitrine à la racine, démo sur /demo/, rien d'autre de l'instance", async () => {
  assert.equal(await (await go("/")).text(), "asset:/vitrine/");
  assert.equal(await (await go("/cle1.mp4")).text(), "asset:/vitrine/cle1.mp4");
  assert.equal(await (await go("/img/g-semaine.png")).text(), "asset:/vitrine/img/g-semaine.png");
  assert.equal(await (await go("/accueil")).text(), "asset:/accueil");
  const d = await (await go("/demo/?ps=abcdef0123456789")).text();
  assert.match(d, /PLANNERS_FORCE_DEMO = true/);
  assert.match(d, /\/js\/suivi\.js/);
  assert.equal(await (await go("/demo/js/app.js")).text(), "asset:/js/app.js");
  assert.equal(await (await go("/js/suivi.js")).text(), "asset:/js/suivi.js");
  for (const p of ["/api/state", "/demo/api/state", "/vitrine/../wrangler.toml", "/sw.js", "/mcp"]) {
    const r = await go(p);
    assert.equal(r.status, 302, p);
  }
  const c = await go("/confidentialite");
  assert.equal(c.status, 301);
  assert.equal(c.headers.get("location"), "https://info.example.org/accueil#confidentialite");
  const t = await go("/t", { method: "OPTIONS" });
  assert.equal(t.status, 204);
  assert.equal(t.headers.get("access-control-allow-origin"), "*");
});
