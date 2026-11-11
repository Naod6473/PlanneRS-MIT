// Installation en une commande : lecture des sorties de wrangler et réglages de wrangler.toml.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { findDbId, tomlGet, tomlSet, cleanToml, findUrl, cleanTeam, newKey } from "../scripts/install.mjs";

const ID = "3f2a1b4c-0d9e-4f8a-b7c6-5d4e3f2a1b0c";

test("identifiant de la base : sortie de « d1 create » (ancienne et nouvelle forme) et de « d1 list »", () => {
  assert.equal(findDbId('✅ Successfully created DB\n[[d1_databases]]\nbinding = "DB"\ndatabase_name = "planners"\ndatabase_id = "' + ID + '"', "planners"), ID);
  assert.equal(findDbId('{\n  "d1_databases": [\n    { "binding": "DB", "database_name": "planners", "database_id": "' + ID + '" }\n  ]\n}', "planners"), ID);
  assert.equal(findDbId(JSON.stringify([{ uuid: "x", name: "autre" }, { uuid: ID, name: "planners" }]), "planners"), ID);
  assert.equal(findDbId(JSON.stringify([{ uuid: "x", name: "autre" }]), "planners"), "");
  assert.equal(findDbId("erreur", "planners"), "");
});

test("wrangler.toml : lire, écrire, remettre à zéro", () => {
  const toml = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
  const t = tomlSet(tomlSet(toml, "database_id", ID), "ACCESS_AUD", "abc");
  assert.equal(tomlGet(t, "database_id"), ID);
  assert.equal(tomlGet(t, "ACCESS_AUD"), "abc");
  assert.equal(tomlGet(t, "database_name"), "planners");
  assert.match(t, /# .*base/i, "le commentaire de la ligne est gardé");
  const c = cleanToml('routes = [{ pattern = "a.exemple.fr", custom_domain = true }]\nworkers_dev = false\n' + t);
  assert.equal(tomlGet(c, "database_id"), "");
  assert.equal(tomlGet(c, "ACCESS_TEAM_DOMAIN"), "");
  assert.equal(tomlGet(c, "ACCESS_AUD"), "");
  assert.doesNotMatch(c, /^routes\s*=/m);
  assert.doesNotMatch(c, /^workers_dev\s*=/m);
  assert.match(c, /^main = "worker\/src\/index\.js"/m);
});

test("adresse du site, domaine d'équipe, clé", () => {
  assert.equal(findUrl("Uploaded planners (3.2 sec)\nDeployed planners triggers\n  https://planners.lise.workers.dev\n  schedule: */5 * * * *"), "https://planners.lise.workers.dev");
  assert.equal(findUrl("rien"), "");
  assert.equal(cleanTeam(" mon-equipe "), "mon-equipe.cloudflareaccess.com");
  assert.equal(cleanTeam("https://mon-equipe.cloudflareaccess.com/"), "mon-equipe.cloudflareaccess.com");
  assert.equal(cleanTeam(""), "");
  assert.notEqual(newKey(), newKey());
  assert.ok(newKey().length >= 40);
});
