// Parcours de bout en bout dans la démo (navigateur réel). Lancer : npm run test:e2e
// Demande Playwright avec Chromium (npx playwright install chromium) ; sans lui, les tests sont sautés.
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { createRequire } from "node:module";

let chromium = null;
try { ({ chromium } = await import("playwright")); } catch { try { ({ chromium } = createRequire(import.meta.url)("playwright")); } catch { /* pas de Playwright : tests sautés */ } }
const skip = chromium ? false : "Playwright absent (npm i -D playwright)";

const root = new URL("../../web/", import.meta.url).pathname;
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".json": "application/json", ".png": "image/png" };
let server, base, browser;

test.before(async () => {
  if (skip) return;
  server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
    try {
      const file = join(root, path.endsWith("/") ? path + "index.html" : path);
      if (!file.startsWith(root)) throw new Error();
      res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" }); res.end(await readFile(file));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(0, r));
  base = "http://localhost:" + server.address().port + "/?demo";
  browser = await chromium.launch();
});
test.after(async () => { if (browser) await browser.close(); if (server) server.close(); });

// Nouvelle page de démo, sans visite guidée ; collecte les erreurs JavaScript.
async function open(opts = {}) {
  const page = await browser.newPage(opts.mobile ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  await page.addInitScript((lang) => { try { localStorage.clear(); localStorage.setItem("planners-tour-done", "1"); localStorage.setItem("planners-lang", lang); } catch { /* rien */ } }, opts.lang || "fr");
  await page.goto(base);
  await page.waitForFunction(() => window.App && document.querySelector("main h1"));
  return { page, errors };
}
const go = (page, hash) => page.evaluate((h) => { location.hash = h; }, hash).then(() => page.waitForTimeout(250));

test("chaque écran s'affiche sans erreur, en français et en anglais", { skip }, async () => {
  for (const lang of ["fr", "en"]) {
    const { page, errors } = await open({ lang });
    for (const h of ["#today", "#calendar", "#contents", "#stats", "#report", "#activity", "#settings"]) {
      await go(page, h);
      assert.ok((await page.locator("main h1").innerText()).length > 0, h);
    }
    for (const tab of ["accounts", "storage", "templates", "notify", "space"]) {
      await page.evaluate((t) => { App.setTab = t; location.hash = "#settings"; App.render(); }, tab);
      await page.waitForTimeout(150);
    }
    for (const mode of ["board", "list", "media"]) { await go(page, "#contents"); await page.click('[data-cmode="' + mode + '"]'); }
    assert.deepEqual(errors, [], lang);
    await page.close();
  }
});

test("relire et valider une légende la fait passer en programmé", { skip }, async () => {
  const { page, errors } = await open();
  const id = await page.evaluate(() => {
    const d = new Date(), now = new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
    const p = Store.state.posts.find((x) => !x.parent && x.date && x.media && x.media.length && x.format !== "story" && Core.displayStatus(x, now) === "review");
    return p && p.id;
  });
  assert.ok(id, "un post à valider existe dans la démo");
  await page.evaluate((i) => App.openPost(i), id);
  await page.locator('.sheet [data-act="validate"]').first().click();
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate((i) => Store.post(i).captionValidated, id), true);
  assert.deepEqual(errors, []);
  await page.close();
});

test("légende par réseau : une version X se garde à part", { skip }, async () => {
  const { page, errors } = await open();
  const id = await page.evaluate(() => { const p = Store.state.posts.find((x) => !x.parent && x.status !== "published" && x.format !== "story"); p.networks = ["instagram", "x"]; return p.id; });
  await page.evaluate((i) => App.openPost(i, { edit: true }), id);
  await page.click('[data-capnet="x"]');
  await page.fill("#cap", "Version courte pour X");
  await page.click("#savecap");
  await page.waitForTimeout(300);
  const p = await page.evaluate((i) => Store.post(i), id);
  assert.equal(p.captions.x, "Version courte pour X");
  assert.notEqual(p.caption, "Version courte pour X");
  assert.equal(p.captionValidated, false);
  assert.deepEqual(errors, []);
  await page.close();
});

test("sélection multiple : décaler de 7 jours, puis annuler", { skip }, async () => {
  const { page, errors } = await open();
  await go(page, "#contents");
  await page.click('[data-cmode="list"]');
  const boxes = page.locator("[data-sel]");
  const ids = [];
  for (let i = 0; ids.length < 2 && i < 20; i++) {
    const row = (await boxes.nth(i).getAttribute("data-sel")).split(",");
    if (row.length === 1 && await page.evaluate((x) => { const p = Store.post(x); return !!(p && p.date && p.status !== "published"); }, row[0])) { await boxes.nth(i).click(); ids.push(row[0]); }
  }
  assert.equal(ids.length, 2);
  const before = await page.evaluate((xs) => xs.map((x) => Store.post(x).date), ids);
  await page.fill("#bk-days", "7");
  await page.click('[data-bulk="shift"]');
  await page.waitForTimeout(300);
  const after = await page.evaluate((xs) => xs.map((x) => Store.post(x).date), ids);
  after.forEach((d, i) => assert.notEqual(d, before[i]));
  await page.locator(".toast .tact").last().click();
  await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate((xs) => xs.map((x) => Store.post(x).date), ids), before);
  assert.deepEqual(errors, []);
  await page.close();
});

test("médiathèque : réutiliser un média crée un brouillon", { skip }, async () => {
  const { page, errors } = await open();
  await go(page, "#contents");
  await page.click('[data-cmode="media"]');
  const n = await page.evaluate(() => Store.state.posts.length);
  await page.locator("[data-reuse]").first().click();
  await page.waitForTimeout(300);
  const last = await page.evaluate(() => Store.state.posts[Store.state.posts.length - 1]);
  assert.equal(await page.evaluate(() => Store.state.posts.length), n + 1);
  assert.equal(last.status, "draft");
  assert.equal(last.media.length, 1);
  assert.deepEqual(errors, []);
  await page.close();
});

test("téléphone : navigation et fiche d'un post", { skip }, async () => {
  const { page, errors } = await open({ mobile: true });
  for (const h of ["#today", "#calendar", "#contents", "#settings"]) await go(page, h);
  const id = await page.evaluate(() => Store.state.posts.find((x) => !x.parent).id);
  await page.evaluate((i) => App.openPost(i), id);
  assert.ok(await page.locator(".sheet").isVisible());
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert.ok(overflow <= 1, "pas de défilement horizontal (" + overflow + " px)");
  assert.deepEqual(errors, []);
  await page.close();
});

test("fenêtre de création : écrire, choisir les réseaux, voir l'aperçu, programmer", { skip }, async () => {
  for (const mobile of [false, true]) {
    const { page, errors } = await open({ mobile });
    const n0 = await page.evaluate(() => Store.state.posts.length);
    await page.evaluate(() => App.newPost());
    await page.fill("#cp-text", "Le DNS en 30 secondes\n\n#dns");
    await page.click('[data-cpnet="x"]');
    await page.click('[data-cptab="x"]');
    await page.fill("#cp-text", "Version courte pour X");
    if (mobile) await page.click('[data-cpview="pv"]');
    await page.click('[data-cppv="x"]');
    assert.match(await page.locator("#cp-pv").innerText(), /Version courte pour X/);
    if (mobile) await page.click('[data-cpview="edit"]');
    await page.fill("#cp-date", "2026-12-01"); await page.dispatchEvent("#cp-date", "change");
    await page.click("#cp-go");
    await page.waitForTimeout(300);
    const p = await page.evaluate(() => Store.state.posts[Store.state.posts.length - 1]);
    assert.equal(await page.evaluate(() => Store.state.posts.length), n0 + 1);
    assert.equal(p.title, "Le DNS en 30 secondes"); assert.equal(p.date, "2026-12-01"); assert.ok(p.time);
    assert.ok(p.networks.includes("x")); assert.equal(p.captions.x, "Version courte pour X"); assert.equal(p.captionValidated, false);
    // Modifier rouvre la même fenêtre avec le texte.
    await page.evaluate((i) => App.compose(i), p.id);
    assert.equal(await page.inputValue("#cp-text"), "Le DNS en 30 secondes\n\n#dns");
    assert.deepEqual(errors, [], mobile ? "mobile" : "ordinateur");
    await page.close();
  }
});

test("stats : cartes par compte et par période", { skip }, async () => {
  for (const mobile of [false, true]) {
    const { page, errors } = await open({ mobile });
    await go(page, "#stats");
    assert.ok(await page.locator(".sc-card").count() >= 6);
    await page.selectOption("[data-stat-days]", "30");
    assert.equal(await page.inputValue("[data-stat-days]"), "30");
    await page.click('[data-stat-chan="facebook"]');
    assert.ok(await page.locator(".sc-card").count() >= 2);
    const w = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(w <= 0, "pas de débordement horizontal");
    assert.deepEqual(errors, []);
    await page.close();
  }
});

test("revue en pile : à droite on valide, à gauche on renvoie en retouche, puis on annule", { skip }, async () => {
  const { page, errors } = await open({ mobile: true });
  const [a, b] = await page.evaluate(() => Core.reviewPile(Store.state.posts).filter((p) => !Core.reviewOf(p, Store.state.settings).blocked).slice(0, 2).map((p) => p.id));
  assert.ok(a && b, "deux cartes validables dans la démo");
  await page.evaluate((ids) => App.openReview(ids), [a, b]);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate((i) => Store.post(i).captionValidated, a), true);
  await page.keyboard.press("ArrowLeft");
  await page.locator('[data-plr="Trop long"]').click();
  await page.locator("#pl-txt").fill("Coupe la fin");
  await page.locator('[data-pl="send"]').click();
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate((i) => Core.needsFix(Store.post(i)), b), true);
  assert.match(await page.evaluate((i) => Store.post(i).comments.slice(-1)[0].text, b), /Trop long[\s\S]*Coupe la fin/);
  assert.match(await page.locator(".pl-end h2").innerText(), /Pile terminée/);
  await page.keyboard.press("z");
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate((i) => Core.needsFix(Store.post(i)), b), false);
  assert.deepEqual(errors, []);
  await page.close();
});

test("ma version : pépite, recette, ta sauce, puis envoi à La Fabrique et carnet", { skip }, async () => {
  for (const mobile of [false, true]) {
    const { page, errors } = await open({ mobile });
    await go(page, "#stats");
    await page.click('[data-stattab="pep"]');
    await page.locator("[data-pep-remix]").first().click();
    await page.locator(".mv-name").waitFor();
    await page.fill("#mv-subject", "les mots de passe au bureau");
    await page.click('[data-mv-angle="qa"]');
    await page.click("[data-mv-make]");
    await page.locator("[data-mv-send]").waitFor();
    assert.ok(+(await page.locator("#mv-pct").innerText()).replace(/\D/g, "") >= 80);
    const w = await page.evaluate(() => document.getElementById("mv").scrollWidth - document.getElementById("mv").clientWidth);
    assert.ok(w <= 0, "pas de débordement horizontal");
    await page.click("[data-mv-send]");
    await page.waitForTimeout(400);
    const p = await page.evaluate(() => { const x = Store.state.posts.find((q) => q.remix); return x && { inF: Core.inFabrique(x), shots: x.prod.shots.length, note: x.note, book: Store.state.settings.recipes.length }; });
    assert.ok(p && p.inF && p.shots >= 3 && p.book === 1);
    assert.match(p.note, /Inspiration : https:/);
    await page.click('[data-stattab="mv"]');
    assert.equal(await page.locator(".mv-rc").count(), 1);
    assert.deepEqual(errors, []);
    await page.close();
  }
});
