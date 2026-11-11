// Captures d'écran des tutoriels (docs/img/tutos), prises dans l'espace de démonstration.
// Usage : npm run docs:shots      (demande Playwright avec Chromium : npx playwright install chromium)
// Les données de démo sont fictives et calées sur la date du jour : relancer après un changement d'écran.
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, join, normalize, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "web") + "/";
const out = resolve(here, "..", "docs", "img", "tutos");

let chromium, devices;
try { ({ chromium, devices } = await import("playwright")); } catch {
  try { ({ chromium, devices } = createRequire(import.meta.url)("playwright")); } catch {
    console.error("Playwright est nécessaire : npm i -D playwright && npx playwright install chromium"); process.exit(1);
  }
}

const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg" };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  try {
    const file = join(root, path.endsWith("/") ? path + "index.html" : path);
    if (!file.startsWith(root)) throw new Error();
    res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" }); res.end(await readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const base = "http://localhost:" + server.address().port + "/?demo";
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ args: ["--lang=fr-FR"], env: Object.assign({}, process.env, { LANG: "fr_FR.UTF-8", LANGUAGE: "fr_FR" }) });
const made = [];
async function page(opts) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 800 }, locale: "fr-FR", colorScheme: "light", deviceScaleFactor: 1 }, opts || {}));
  const p = await ctx.newPage();
  await p.addInitScript(() => { try { localStorage.setItem("planners-tour-done", "1"); localStorage.setItem("planners-lang", "fr"); } catch (e) { /* rien */ } });
  p.on("dialog", (d) => d.accept());
  p.go = async (hash) => { await p.goto(base + "#" + hash); await p.addStyleTag({ content: "#demo-note{display:none!important}.toast{display:none!important}" }); await p.waitForTimeout(500); };
  p.shot = async (name, clip) => { await p.waitForTimeout(350); await p.screenshot({ path: join(out, name + ".jpg"), type: "jpeg", quality: 82, clip }); made.push(name); };
  return p;
}

// 1. Programmer un post
{
  const p = await page();
  await p.go("calendar");
  await p.shot("programmer-1-calendrier");
  await p.keyboard.press("n"); await p.waitForTimeout(500);
  await p.fill("#cp-text", "Le levain, c'est juste de la farine et de l'eau. Vraiment ?\n\nOn t'explique en 30 secondes pourquoi il fait lever le pain. 🍞\n\n#boulangerie #levain");
  await p.dispatchEvent("#cp-text", "input");
  await p.shot("programmer-2-creation");
  await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  await p.locator(".pc.is-scheduled[data-open]").first().click(); await p.waitForTimeout(500);
  await p.shot("programmer-3-fiche");
  await p.close();
}
// 2. Valider la semaine
{
  const p = await page();
  await p.go("today");
  await p.shot("valider-1-aujourdhui");
  await p.evaluate(() => window.App.openReview()); await p.waitForTimeout(500);
  await p.shot("valider-2-relire");
  await p.close();
}
// 3. Poster à la main (ordinateur + téléphone)
{
  const p = await page();
  await p.go("today");
  const id = await p.evaluate(() => (window.Store.state.posts.find((x) => x.manual && x.date && x.status !== "published" && x.networks.some((n) => n === "linkedin" || n === "x")) || window.Store.state.posts.find((x) => x.manual && x.date && x.status !== "published") || {}).id);
  if (id) { await p.evaluate((i) => window.App.openManual(i), id); await p.waitForTimeout(500); await p.shot("main-1-aide"); }
  await p.close();
  const m = await page({ ...devices["iPhone 13"], locale: "fr-FR", colorScheme: "light", deviceScaleFactor: 2 });
  await m.go("today");
  const card = m.locator(".tcard[data-swipe]").first();
  if (await card.count()) await m.evaluate(() => { const c = document.querySelector(".tcard[data-swipe]"); window.scrollTo(0, c.getBoundingClientRect().top + window.scrollY - 70); });
  await m.shot("main-2-telephone");
  await m.close();
}
// 4. Republier un post qui a marché
{
  const p = await page();
  await p.go("calendar");
  await p.locator(".pc.is-published[data-open]").first().click(); await p.waitForTimeout(500);
  const id = await p.evaluate(() => document.querySelector(".pc.is-published[data-open]").dataset.open);
  await p.evaluate(() => window.App.closeLayer());
  await p.evaluate((i) => window.App.openRecycle(i), id); await p.waitForTimeout(500);
  await p.shot("republier-1");
  await p.close();
}
// 5. Retrouver un post et filtrer par série
{
  const p = await page();
  await p.go("calendar");
  await p.fill("[data-fq]", "levain"); await p.waitForTimeout(500);
  await p.shot("chercher-1-filtre");
  await p.keyboard.press("Escape");
  await p.locator("body").click({ position: { x: 5, y: 790 } });
  await p.keyboard.press("Control+k"); await p.waitForTimeout(300);
  await p.keyboard.type("fournil"); await p.waitForTimeout(400);
  await p.shot("chercher-2-palette");
  await p.close();
}
// 6. Remettre un post supprimé
{
  const p = await page();
  await p.go("contents");
  await p.locator(".kc .kopen").first().click(); await p.waitForTimeout(400);
  await p.locator(".moremenu summary").click(); await p.locator('[data-act="del"]').click(); await p.waitForTimeout(400);
  await p.go("settings");
  await p.locator('[data-settab="space"]').first().click(); await p.waitForTimeout(600);
  await p.locator("#trash-list").scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, -80));
  await p.shot("corbeille-1");
  await p.close();
}

await browser.close(); server.close();
console.log(made.length + " captures dans docs/img/tutos : " + made.join(", "));
