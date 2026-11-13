-- Visites du site vitrine et de la démo : des événements anonymes, sans cookie ni adresse IP.
CREATE TABLE IF NOT EXISTS visites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL, day TEXT NOT NULL,
  sid TEXT NOT NULL,           -- identifiant tiré au hasard pour un onglet, oublié à sa fermeture
  src TEXT NOT NULL,           -- site ou demo
  page TEXT, type TEXT NOT NULL, label TEXT, value REAL,
  ref TEXT, country TEXT, device TEXT, lang TEXT
);
CREATE INDEX IF NOT EXISTS visites_day ON visites (day, src);
CREATE INDEX IF NOT EXISTS visites_sid ON visites (sid);
