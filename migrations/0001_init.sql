-- PlanneRs : schéma initial de la base D1.
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,          -- le post complet, en JSON
  date TEXT, time TEXT,        -- copies pour les requêtes
  status TEXT NOT NULL DEFAULT 'draft',
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS posts_due ON posts (status, date, time);

CREATE TABLE IF NOT EXISTS log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL, level TEXT NOT NULL, text TEXT NOT NULL, why TEXT, post_id TEXT
);

CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);

-- Comptes connectés : info visible dans l'interface, identifiants chiffrés (AES-GCM).
CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, info TEXT NOT NULL, cred TEXT);
