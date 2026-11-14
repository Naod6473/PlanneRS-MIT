-- Liste d'attente de la version hébergée : l'adresse e-mail laissée sur le site vitrine, rien d'autre.
CREATE TABLE IF NOT EXISTS attente (
  email TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  lang TEXT,
  note TEXT
);
