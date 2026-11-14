import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanEmail, join } from "../worker/src/attente.js";

test("attente : adresses e-mail nettoyées", () => {
  assert.equal(cleanEmail("  Lea.Martin@Exemple.FR "), "lea.martin@exemple.fr");
  for (const bad of ["", "pas-une-adresse", "a@b", "a@@b.fr", "<x>@y.fr", "a..b@c.fr", "x".repeat(70) + "@y.fr", null]) assert.equal(cleanEmail(bad), null, String(bad));
});

test("attente : formulaire public (origine, robot, enregistrement)", async () => {
  const runs = [];
  const DB = { prepare: (q) => ({ bind: (...a) => ({ run: async () => runs.push([q, a]) }), first: async () => ({ n: 0 }) }) };
  const env = { PUBLIC_HOST: "info.example.org", DB };
  const req = (body, origin, ip) => new Request("https://info.example.org/attente", { method: "POST", body: JSON.stringify(body), headers: { origin: origin || "https://info.example.org", "cf-connecting-ip": ip || "9.9.9.1" } });
  assert.equal((await join(req({ email: "a@b.fr" }, "https://pirate.example"), env)).status, 403);
  assert.equal((await join(req({ email: "nope" }), env)).status, 400);
  assert.equal((await join(req({ email: "bot@b.fr", website: "x" }), env)).status, 204);
  assert.equal(runs.length, 0, "rien d'enregistré pour un robot");
  assert.equal((await join(req({ email: "Sam@Example.com", lang: "en" }), env)).status, 204);
  assert.equal(runs.length, 1);
  assert.deepEqual(runs[0][1].slice(0, 1).concat(runs[0][1].slice(2, 3)), ["sam@example.com", "en"]);
});
