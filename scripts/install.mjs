#!/usr/bin/env node
// Installation de PlanneRs en une commande, sur ton compte Cloudflare (Windows, macOS, Linux).
//   npx github:Naod6473/PlanneRS-MIT
// Ce que fait le script, dans l'ordre : copie le code dans ./planners, installe les outils, te connecte à Cloudflare
// (une page s'ouvre dans le navigateur), crée la base D1 et ses tables, met le site en ligne, génère la clé de
// chiffrement, puis t'aide à protéger l'accès. Relancer la commande est sans danger : elle reprend là où elle en est.
// Options : --dir <dossier> (défaut : planners), --dry-run (affiche les commandes sans rien lancer).
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";

// ---------------------------------------------------------------- fonctions pures (testées dans test/install.test.mjs)

// Identifiant de la base dans la sortie de « wrangler d1 create » ou « wrangler d1 list --json ».
export function findDbId(out, name) {
  try {
    const list = JSON.parse(out);
    if (Array.isArray(list)) { const d = list.find((x) => x.name === name); return d ? d.uuid || d.database_id || "" : ""; }
  } catch (e) { /* pas du JSON : sortie de « create » */ }
  const m = /database_id["'\s:=]+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(out) || /\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i.exec(out);
  return m ? m[1] : "";
}
// Lit et écrit une valeur « clé = "valeur" » de wrangler.toml, sans toucher au reste du fichier.
export const tomlGet = (toml, key) => { const m = new RegExp("^" + key + '\\s*=\\s*"([^"]*)"', "m").exec(toml); return m ? m[1] : ""; };
export const tomlSet = (toml, key, value) => toml.replace(new RegExp("^(" + key + '\\s*=\\s*)"[^"]*"', "m"), (_, a) => a + JSON.stringify(String(value)));
// Remet une configuration à zéro : aucune base, aucun domaine, aucun réglage d'accès d'une autre installation.
export function cleanToml(toml) {
  let t = tomlSet(tomlSet(tomlSet(toml, "database_id", ""), "ACCESS_TEAM_DOMAIN", ""), "ACCESS_AUD", "");
  t = t.replace(/^routes\s*=.*\n/gm, "").replace(/^workers_dev\s*=.*\n/gm, "");
  return t;
}
// Adresse du site dans la sortie de « wrangler deploy ».
export const findUrl = (out) => { const m = /https:\/\/[a-z0-9.-]+\.workers\.dev/i.exec(out) || /^\s*([a-z0-9.-]+\.[a-z]{2,})\s+\(custom domain\)/im.exec(out); return m ? (m[0].startsWith("http") ? m[0] : "https://" + m[1]) : ""; };
export const cleanTeam = (s) => { const v = String(s || "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, ""); return !v ? "" : v.includes(".") ? v : v + ".cloudflareaccess.com"; };
export const newKey = () => randomBytes(32).toString("base64");

// ---------------------------------------------------------------- déroulé

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch((e) => { console.error("\n✗ " + e.message + "\n  Corrige, puis relance la même commande : elle reprend où elle en est."); process.exit(1); });

async function main() {
  const args = process.argv.slice(2), dry = args.includes("--dry-run");
  const dirArg = args.includes("--dir") ? args[args.indexOf("--dir") + 1] : "";
  const say = (s) => console.log(s), step = (n, s) => console.log("\n" + n + ". " + s);
  if (+process.versions.node.split(".")[0] < 20) throw new Error("Il faut Node.js 20 ou plus (tu as " + process.versions.node + "). Installe-le depuis https://nodejs.org puis relance.");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (q) => (dry || !process.stdin.isTTY ? "" : (await rl.question(q)).trim());
  // Lance une commande. show : la personne voit la sortie en direct ; sinon on la récupère.
  const run = (cmd, a, o = {}) => {
    const line = [cmd].concat(a).join(" ");
    if (dry) { say("   [simulation] " + line); return { ok: true, out: o.fake || "" }; }
    const r = spawnSync(cmd, a, { cwd: o.cwd, shell: true, encoding: "utf8", input: o.input, env: Object.assign({}, process.env, o.env), stdio: o.show ? "inherit" : [o.input != null ? "pipe" : "inherit", "pipe", "pipe"] });
    const out = (r.stdout || "") + (r.stderr || "");
    if (r.status !== 0 && !o.soft) throw new Error("La commande « " + line + " » a échoué." + (out.trim() ? "\n" + out.trim().split("\n").slice(-8).join("\n") : ""));
    return { ok: r.status === 0, out };
  };

  say("PlanneRs : installation sur ton compte Cloudflare" + (dry ? " (simulation : rien n'est lancé)" : "") + "\nCompte gratuit suffisant. Durée : 5 à 10 minutes.");

  // 1. Le code
  const src = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const here = existsSync(join(process.cwd(), "wrangler.toml")) && existsSync(join(process.cwd(), "worker", "src", "index.js"));
  const dir = dirArg ? resolve(dirArg) : here ? process.cwd() : resolve("planners");
  const tomlPath = join(dir, "wrangler.toml");
  step(1, "Le code");
  if (existsSync(tomlPath)) say("   Déjà là : " + dir);
  else if (dry) say("   [simulation] copie du code dans " + dir);
  else {
    const skip = new Set(["node_modules", ".git", ".wrangler", ".dev.vars", "dist"]);
    cpSync(src, dir, { recursive: true, filter: (f) => !f.slice(src.length).split(sep).some((x) => skip.has(x)) });
    writeFileSync(tomlPath, cleanToml(readFileSync(tomlPath, "utf8")));
    say("   Copié dans " + dir);
  }
  const toml = () => (existsSync(tomlPath) ? readFileSync(tomlPath, "utf8") : readFileSync(join(src, "wrangler.toml"), "utf8"));
  const save = (t) => { if (!dry) writeFileSync(tomlPath, t); };
  const name = (/^name\s*=\s*"([^"]+)"/m.exec(toml()) || [])[1] || "planners";
  const dbName = tomlGet(toml(), "database_name") || "planners";
  const w = (a, o) => run("npx", ["wrangler"].concat(a), Object.assign({ cwd: dir }, o));

  // 2. Les outils
  step(2, "Les outils (une à deux minutes)");
  if (existsSync(join(dir, "node_modules", "wrangler"))) say("   Déjà installés.");
  else run("npm", ["install", "--no-fund", "--no-audit"], { cwd: dir, show: true });

  // 3. Cloudflare
  step(3, "Connexion à Cloudflare");
  if (w(["whoami"], { soft: true }).out.match(/not authenticated|You are not logged in/i)) {
    say("   Une page s'ouvre dans ton navigateur : connecte-toi (ou crée un compte gratuit) puis clique sur « Allow ».");
    w(["login"], { show: true });
  } else say("   Déjà connecté.");

  // 4. La base
  step(4, "La base de données");
  let id = tomlGet(toml(), "database_id");
  if (id) say("   Déjà créée (" + id + ").");
  else {
    const c = w(["d1", "create", dbName], { soft: true, fake: "database_id = \"00000000-0000-0000-0000-000000000000\"" });
    id = c.ok ? findDbId(c.out, dbName) : findDbId(w(["d1", "list", "--json"], { soft: true }).out, dbName);
    if (!id) throw new Error("Impossible de créer la base « " + dbName + " »." + (c.out.trim() ? "\n" + c.out.trim().split("\n").slice(-6).join("\n") : ""));
    save(tomlSet(toml(), "database_id", id));
    say("   Base « " + dbName + " » prête.");
  }
  w(["d1", "migrations", "apply", dbName, "--remote"], { env: { CI: "1" } });
  say("   Tables créées.");

  // 5. Mise en ligne
  step(5, "Mise en ligne (quelques secondes)");
  const dep = w(["deploy"], { env: { CI: "1" }, fake: "https://" + name + ".exemple.workers.dev" });
  let url = findUrl(dep.out);
  say("   En ligne" + (url ? " : " + url : "."));

  // 6. Clé de chiffrement
  step(6, "Clé de chiffrement des comptes");
  // Jamais remplacée : une nouvelle clé rendrait illisibles les comptes déjà connectés.
  const sec = w(["secret", "list"], { soft: true, fake: "[]" });
  if (/"ENCRYPTION_KEY"/.test(sec.out)) say("   Déjà en place.");
  else if (!sec.ok || !/^\s*\[/m.test(sec.out)) say("   Impossible de savoir si elle existe déjà : je n'y touche pas. Si c'est une première installation, lance « npx wrangler secret put ENCRYPTION_KEY » dans " + dir + ".");
  else {
    const key = newKey();
    w(["secret", "put", "ENCRYPTION_KEY"], { input: key + "\n" });
    say("   Créée. Garde-la dans ton gestionnaire de mots de passe : sans elle, il faudra reconnecter tous les comptes.\n\n     " + (dry ? "(générée au vrai lancement)" : key));
  }

  // 7. Accès
  step(7, "Protéger l'accès");
  if (tomlGet(toml(), "ACCESS_AUD")) say("   Déjà réglé.");
  else {
    say("   Pour l'instant le site s'ouvre mais refuse tout : c'est voulu. Il reste à dire qui a le droit d'entrer.\n" +
      "   a. Ouvre https://one.dash.cloudflare.com › Access › Applications › Add an application › Self-hosted.\n" +
      "   b. Application domain : " + (url || "l'adresse du site").replace(/^https:\/\//, "") + "\n" +
      "   c. Policy : action Allow, règle Emails, ton adresse e-mail. Enregistre.\n" +
      "   d. Copie « Application Audience (AUD) Tag » et le nom de ton équipe (Settings › Custom Pages).");
    const team = cleanTeam(await ask("\n   Nom ou domaine de l'équipe (Entrée pour le faire plus tard) : "));
    const aud = team ? await ask("   Application Audience (AUD) Tag : ") : "";
    if (team && aud) {
      save(tomlSet(tomlSet(toml(), "ACCESS_TEAM_DOMAIN", team), "ACCESS_AUD", aud));
      url = findUrl(w(["deploy"], { env: { CI: "1" } }).out) || url;
      say("   Accès protégé.");
    } else say("   Plus tard : relance cette commande quand tu as les deux valeurs, ou suis docs/demarrage/installation.md.");
  }
  rl.close();

  say("\n✓ Terminé." + (url ? " Ton PlanneRs : " + url : "") +
    "\n  Le robot est en simulation : rien ne part tant que tu ne passes pas DRY_RUN à \"false\" dans wrangler.toml." +
    "\n  Dossier du code : " + dir + " (garde-le : « npm run deploy » depuis ce dossier remet le site en ligne après une mise à jour)." +
    "\n  Suite : docs/demarrage/premiers-pas.md");
}
