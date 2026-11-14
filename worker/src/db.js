// Accès à la base D1. Chaque post est stocké en JSON, avec quelques colonnes pour les requêtes du robot.
import { seal, open } from "./crypto.js";

const row = (p) => [p.id, JSON.stringify(p), p.date || null, p.time || null, p.status || "draft", new Date().toISOString()];

export async function loadState(env) {
  const [posts, log, settings, robot, accounts, stats, pep] = await env.DB.batch([
    env.DB.prepare("SELECT data FROM posts"),
    env.DB.prepare("SELECT at, level, text, why, post_id AS postId FROM log ORDER BY id DESC LIMIT 300"),
    env.DB.prepare("SELECT v FROM kv WHERE k = 'settings'"),
    env.DB.prepare("SELECT v FROM kv WHERE k = 'robot'"),
    env.DB.prepare("SELECT id, info FROM accounts"),
    env.DB.prepare("SELECT v FROM kv WHERE k = 'stats'"),
    env.DB.prepare("SELECT v FROM kv WHERE k = 'pepites'"),
  ]);
  const acc = {};
  accounts.results.forEach((a) => { acc[a.id] = JSON.parse(a.info); });
  return {
    posts: posts.results.map((r) => JSON.parse(r.data)),
    log: log.results.map((l) => Object.fromEntries(Object.entries(l).filter(([, v]) => v != null))),
    settings: settings.results[0] ? JSON.parse(settings.results[0].v) : null,
    robot: robot.results[0] ? JSON.parse(robot.results[0].v) : null,
    stats: stats.results[0] ? JSON.parse(stats.results[0].v) : null,
    pepites: pep.results[0] ? JSON.parse(pep.results[0].v) : null,
    accounts: acc,
  };
}

export async function savePosts(env, posts) {
  if (!posts.length) return;
  const st = env.DB.prepare("INSERT INTO posts (id, data, date, time, status, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, date = excluded.date, time = excluded.time, status = excluded.status, updated_at = excluded.updated_at");
  await env.DB.batch(posts.map((p) => st.bind(...row(p))));
}

// Corbeille : un post supprimé (avec ce qui le suit) y reste 30 jours, récupérable.
export const TRASH_DAYS = 30;
const TRASH_MAX = 300;
export function pruneTrash(list, nowMs) {
  const lim = (nowMs || Date.now()) - TRASH_DAYS * 864e5;
  return (list || []).filter((e) => Date.parse(e.at) >= lim).slice(0, TRASH_MAX);
}
export async function getTrash(env) { return pruneTrash(await getKV(env, "trash")); }
export async function deletePost(env, id, by) {
  const rows = (await env.DB.prepare("SELECT data FROM posts WHERE id = ? OR json_extract(data, '$.parent') = ?").bind(id, id).all()).results || [];
  const posts = rows.map((r) => JSON.parse(r.data));
  if (posts.length) {
    const t = await getTrash(env);
    t.unshift({ id: id + "@" + Date.now().toString(36), at: new Date().toISOString(), by: by || null, posts });
    await putKV(env, "trash", pruneTrash(t));
  }
  await env.DB.batch([
    env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(id),
    env.DB.prepare("DELETE FROM posts WHERE json_extract(data, '$.parent') = ?").bind(id),
  ]);
}
export async function restoreTrash(env, entryId) {
  const t = await getTrash(env);
  const e = t.find((x) => x.id === entryId);
  if (!e) return null;
  await savePosts(env, e.posts);
  await putKV(env, "trash", t.filter((x) => x !== e));
  return e;
}

export const addLog = (env, e) => env.DB.prepare("INSERT INTO log (at, level, text, why, post_id) VALUES (?, ?, ?, ?, ?)")
  .bind(e.at, e.level || "info", String(e.text || "").slice(0, 2000), e.why ? String(e.why).slice(0, 2000) : null, e.postId || null).run();

export const getKV = async (env, k) => { const r = await env.DB.prepare("SELECT v FROM kv WHERE k = ?").bind(k).first(); return r ? JSON.parse(r.v) : null; };
export const putKV = (env, k, v) => env.DB.prepare("INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(k, JSON.stringify(v)).run();

// Sauvegardes : découpées par paquets de 150 posts (une valeur D1 est limitée à 2 Mo).
const CHUNK = 150;
export async function saveBackup(env, id, snap) {
  const parts = Math.max(1, Math.ceil(snap.posts.length / CHUNK));
  for (let i = 0; i < parts; i++) await putKV(env, "bkp:" + id + ":" + i, snap.posts.slice(i * CHUNK, (i + 1) * CHUNK));
  await putKV(env, "backup:" + id, { at: snap.at, settings: snap.settings, count: snap.posts.length, parts });
}
export async function getBackup(env, id) {
  const h = await getKV(env, "backup:" + id);
  if (!h) return null;
  let posts = [];
  for (let i = 0; i < h.parts; i++) posts = posts.concat((await getKV(env, "bkp:" + id + ":" + i)) || []);
  return { at: h.at, settings: h.settings, posts };
}
export async function deleteBackup(env, id) {
  await env.DB.batch([env.DB.prepare("DELETE FROM kv WHERE k = ?").bind("backup:" + id), env.DB.prepare("DELETE FROM kv WHERE k LIKE ?").bind("bkp:" + id + ":%")]);
}

export const listKV = async (env, prefix) => ((await env.DB.prepare("SELECT k FROM kv WHERE k LIKE ? ORDER BY k").bind(prefix + "%").all()).results || []).map((r) => r.k);
export const delKV = (env, k) => env.DB.prepare("DELETE FROM kv WHERE k = ?").bind(k).run();

// Restauration d'une sauvegarde : remplace les posts et les réglages, garde le journal et les comptes.
export async function restore(env, snap) {
  await env.DB.prepare("DELETE FROM posts").run();
  await savePosts(env, snap.posts || []);
  if (snap.settings) await putKV(env, "settings", snap.settings);
}

export async function replaceAll(env, state) {
  await env.DB.batch([env.DB.prepare("DELETE FROM posts"), env.DB.prepare("DELETE FROM log")]);
  await savePosts(env, state.posts || []);
  if (state.settings) await putKV(env, "settings", state.settings);
}

export async function getCred(env, id) {
  const r = await env.DB.prepare("SELECT cred FROM accounts WHERE id = ?").bind(id).first();
  return r ? open(env, r.cred) : null;
}
export async function setAccount(env, id, info, cred) {
  const sealed = cred ? await seal(env, cred) : null;
  await env.DB.prepare("INSERT INTO accounts (id, info, cred) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET info = excluded.info, cred = COALESCE(excluded.cred, accounts.cred)")
    .bind(id, JSON.stringify(info), sealed).run();
}
export const deleteAccount = (env, id) => env.DB.prepare("DELETE FROM accounts WHERE id = ?").bind(id).run();
// Remplace les identifiants (ex. jeton renouvelé par le fournisseur) sans toucher à l'état affiché.
export async function updateCred(env, id, cred) {
  await env.DB.prepare("UPDATE accounts SET cred = ? WHERE id = ?").bind(await seal(env, cred), id).run();
}
export async function accountsInfo(env) {
  const { results } = await env.DB.prepare("SELECT id, info FROM accounts").all();
  return Object.fromEntries((results || []).map((r) => [r.id, JSON.parse(r.info || "{}")]));
}

export async function getPost(env, id) {
  const r = await env.DB.prepare("SELECT data FROM posts WHERE id = ?").bind(id).first();
  return r ? JSON.parse(r.data) : null;
}

// Schéma de la base (copie de migrations/0001_init.sql, vérifiée par les tests) : créé au premier passage
// s'il manque, pour une installation par le bouton « Deploy to Cloudflare » qui n'applique pas les migrations.
export const SCHEMA = "-- PlanneRs : sch\u00e9ma initial de la base D1.\nCREATE TABLE IF NOT EXISTS posts (\n  id TEXT PRIMARY KEY,\n  data TEXT NOT NULL,          -- le post complet, en JSON\n  date TEXT, time TEXT,        -- copies pour les requ\u00eates\n  status TEXT NOT NULL DEFAULT 'draft',\n  updated_at TEXT NOT NULL\n);\nCREATE INDEX IF NOT EXISTS posts_due ON posts (status, date, time);\n\nCREATE TABLE IF NOT EXISTS log (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  at TEXT NOT NULL, level TEXT NOT NULL, text TEXT NOT NULL, why TEXT, post_id TEXT\n);\n\nCREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);\n\n-- Comptes connect\u00e9s : info visible dans l'interface, identifiants chiffr\u00e9s (AES-GCM).\nCREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, info TEXT NOT NULL, cred TEXT);\n\n-- Visites du site vitrine et de la d\u00e9mo : des \u00e9v\u00e9nements anonymes, sans cookie ni adresse IP.\nCREATE TABLE IF NOT EXISTS visites (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  at TEXT NOT NULL, day TEXT NOT NULL,\n  sid TEXT NOT NULL,           -- identifiant tir\u00e9 au hasard pour un onglet, oubli\u00e9 \u00e0 sa fermeture\n  src TEXT NOT NULL,           -- site ou demo\n  page TEXT, type TEXT NOT NULL, label TEXT, value REAL,\n  ref TEXT, country TEXT, device TEXT, lang TEXT\n);\nCREATE INDEX IF NOT EXISTS visites_day ON visites (day, src);\nCREATE INDEX IF NOT EXISTS visites_sid ON visites (sid);\n\n-- Liste d'attente de la version h\u00e9berg\u00e9e : l'adresse e-mail laiss\u00e9e sur le site vitrine, rien d'autre.\nCREATE TABLE IF NOT EXISTS attente (\n  email TEXT PRIMARY KEY,\n  at TEXT NOT NULL,\n  lang TEXT,\n  note TEXT\n);\n";
export const schemaStatements = (sql) => sql.split("\n").map((l) => l.replace(/--.*$/, "")).join("\n").split(";").map((x) => x.trim()).filter(Boolean);
let schemaReady = null;
export function ensureSchema(env) {
  if (!env || !env.DB) return Promise.resolve();
  if (!schemaReady) schemaReady = env.DB.batch(schemaStatements(SCHEMA).map((q) => env.DB.prepare(q))).catch((e) => { schemaReady = null; throw e; });
  return schemaReady;
}
