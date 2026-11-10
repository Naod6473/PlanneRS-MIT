// Accès à la base D1. Chaque post est stocké en JSON, avec quelques colonnes pour les requêtes du robot.
import { seal, open } from "./crypto.js";

const row = (p) => [p.id, JSON.stringify(p), p.date || null, p.time || null, p.status || "draft", new Date().toISOString()];

export async function loadState(env) {
  const [posts, log, settings, robot, accounts, stats] = await env.DB.batch([
    env.DB.prepare("SELECT data FROM posts"),
    env.DB.prepare("SELECT at, level, text, why, post_id AS postId FROM log ORDER BY id DESC LIMIT 300"),
    env.DB.prepare("SELECT v FROM kv WHERE k = 'settings'"),
    env.DB.prepare("SELECT v FROM kv WHERE k = 'robot'"),
    env.DB.prepare("SELECT id, info FROM accounts"),
    env.DB.prepare("SELECT v FROM kv WHERE k = 'stats'"),
  ]);
  const acc = {};
  accounts.results.forEach((a) => { acc[a.id] = JSON.parse(a.info); });
  return {
    posts: posts.results.map((r) => JSON.parse(r.data)),
    log: log.results.map((l) => Object.fromEntries(Object.entries(l).filter(([, v]) => v != null))),
    settings: settings.results[0] ? JSON.parse(settings.results[0].v) : null,
    robot: robot.results[0] ? JSON.parse(robot.results[0].v) : null,
    stats: stats.results[0] ? JSON.parse(stats.results[0].v) : null,
    accounts: acc,
  };
}

export async function savePosts(env, posts) {
  if (!posts.length) return;
  const st = env.DB.prepare("INSERT INTO posts (id, data, date, time, status, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, date = excluded.date, time = excluded.time, status = excluded.status, updated_at = excluded.updated_at");
  await env.DB.batch(posts.map((p) => st.bind(...row(p))));
}

export const deletePost = (env, id) => env.DB.batch([
  env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(id),
  env.DB.prepare("DELETE FROM posts WHERE json_extract(data, '$.parent') = ?").bind(id),
]);

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
