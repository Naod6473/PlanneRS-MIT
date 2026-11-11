// Actions après publication : un commentaire quand un post dépasse un seuil de likes, une seule fois.
import test from "node:test";
import assert from "node:assert/strict";
import { due, run, valid } from "../worker/src/plugs.js";
import { mediaKey } from "../worker/src/stats.js";

const rule = { id: "r1", net: "instagram", threshold: 100, comment: "Le lien : https://exemple.fr/recette" };
const stats = { instagram: { media: [{ id: "111", key: "ig:AAA", likes: 150 }, { id: "222", key: "ig:BBB", likes: 20 }] } };
const posts = () => [
  { id: "a", title: "Levain", status: "published", networks: ["instagram"], date: "2026-11-09", url: "https://www.instagram.com/reel/AAA/" },
  { id: "b", title: "Brioche", status: "published", networks: ["instagram"], date: "2026-11-10", url: "https://www.instagram.com/p/BBB/" },
  { id: "c", title: "Vieux", status: "published", networks: ["instagram"], date: "2026-09-01", url: "https://www.instagram.com/p/AAA/" },
  { id: "d", title: "Prévu", status: "scheduled", networks: ["instagram"], date: "2026-11-12" },
];
function deps(over) {
  const calls = [], logs = [], saved = [];
  return Object.assign({ calls, logs, saved, now: "2026-11-11T07:05", dryRun: false, settings: {}, env: {}, cred: async () => ({ token: "t" }),
    adapters: { instagram: { comment: async (env, id, text) => { calls.push([id, text]); } } }, save: async (ps) => saved.push(...ps), log: async (e) => logs.push(e) }, over);
}

test("règle valide ou non", () => {
  assert.equal(valid(rule), true);
  assert.equal(valid(Object.assign({}, rule, { net: "x" })), false);
  assert.equal(valid(Object.assign({}, rule, { comment: " " })), false);
  assert.equal(valid(Object.assign({}, rule, { enabled: false })), false);
});

test("seuls les posts publiés récents au-dessus du seuil sont retenus", () => {
  assert.deepEqual(due([rule], posts(), stats, "2026-11-11", mediaKey).map((x) => x.post.id), ["a"]);
});

test("le commentaire part une seule fois", async () => {
  const ps = posts(), d = deps();
  let r = await run([rule], ps, stats, d, mediaKey);
  assert.equal(r.done, 1);
  assert.deepEqual(d.calls, [["111", "Le lien : https://exemple.fr/recette"]]);
  assert.ok(ps[0].plugs.r1);
  r = await run([rule], ps, stats, d, mediaKey);
  assert.equal(r.done, 0);
  assert.equal(d.calls.length, 1);
});

test("en simulation rien n'est envoyé, et l'action se fera une fois en réel", async () => {
  const ps = posts(), sim = deps({ dryRun: true });
  await run([rule], ps, stats, sim, mediaKey);
  assert.equal(sim.calls.length, 0);
  assert.match(sim.logs[0].text, /^Simulation/);
  await run([rule], ps, stats, sim, mediaKey);
  assert.equal(sim.logs.length, 1);
  const real = deps();
  await run([rule], ps, stats, real, mediaKey);
  assert.equal(real.calls.length, 1);
});

test("un refus est expliqué et ne se retente pas", async () => {
  const ps = posts(), d = deps({ adapters: { instagram: { comment: async () => { throw new Error("Refusé par Instagram."); } } } });
  await run([rule], ps, stats, d, mediaKey);
  assert.equal(d.logs[0].level, "error");
  assert.equal((await run([rule], ps, stats, d, mediaKey)).seen, 0);
});
