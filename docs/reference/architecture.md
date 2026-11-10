---
title: Architecture
description: Comment PlanneRs est construit (Worker Cloudflare, D1, robot, connecteurs, stockages), le format d'un post et comment écrire un connecteur.
category: Référence
tags: [architecture, cloudflare workers, d1, cron, robot, adaptateur, connecteur, contribution, api, données]
order: 4
updated: 2026-11-10
---

# Architecture

```
Navigateur ──► Cloudflare Access ──► Worker (worker/src/index.js)
                                       ├─ /api/*  → D1 (posts, journal, réglages, comptes chiffrés)
                                       ├─ le reste → fichiers de web/ (Static Assets)
                                       └─ cron */5 → robot.js → adapters/* → API des réseaux
                                                         └─ storage/* → Drive, Dropbox, R2, GitHub Pages…
```

| Dossier | Contenu |
|---|---|
| `web/` | Interface (HTML, CSS, JS sans étape de build) ; `web/js/core.js` est partagé avec le serveur |
| `worker/src/index.js` | Routes `/api/*`, cron, OAuth Google |
| `worker/src/robot.js` | Choisit les posts à l'heure, publie le principal puis les relais |
| `worker/src/adapters/` | Un fichier par réseau, plus `notify.js` (ntfy, Telegram, webhook) |
| `worker/src/storage/` | Stockages sources (lecture) et hébergements publics (envoi) |
| `worker/src/crypto.js` | Chiffrement AES-GCM des identifiants |
| `worker/src/auth.js` | Vérification du jeton Cloudflare Access |
| `migrations/` | Schéma D1 |
| `docs/` | Cette documentation ; `docs/index.json` est généré par `npm run docs:index` |
| `test/` | Tests `node --test` |

## Données

Un **post** est un objet JSON (table `posts`, colonne `data`). Champs principaux :

| Champ | Rôle |
|---|---|
| `id`, `ref`, `title`, `category` | identification |
| `format` | `reel`, `carousel`, `image`, `story`, `text`, `video`, `document` |
| `networks` | ex. `["instagram", "facebook"]` : le premier est le **principal**, les suivants sont des relais |
| `date`, `time` | heure locale de l'espace (`settings.timezone`) ; vides = « Prêts à programmer » |
| `status` | `draft`, `ready`, `scheduled`, `published`, `failed` |
| `captionValidated` | sans lui, rien ne part |
| `manual` | rappel au lieu d'un envoi automatique |
| `parent`, `role` | un élément lié (ex. teaser story) suit son post dans le calendrier |
| `media[]` | `{ name, url, type, role }` |
| `results` | résultat par réseau : `ok`, `failed`, `skipped` |
| `failure` | `{ what, why, todo }` pour l'écran d'échec |

Le statut **affiché** (`À valider`, `En retard`, etc.) est calculé par `Core.displayStatus()` dans `web/js/core.js`, partagé entre l'interface et le serveur.

## Écrire un connecteur

```js
// worker/src/adapters/monreseau.js
export const fields = [{ key: "token", label: "Jeton", secret: true }];
export async function publish(env, post, cred, job) {
  // ... appelle l'API ; lance une PublishError({ why, todo, retryable }) en cas de refus
  return { status: "ok", url: "https://..." };   // ou { status: "pending", job } pour reprendre plus tard
}
export async function test(env, cred) { return "Connecté à ..."; }
```

Puis l'ajouter à `ADAPTERS` dans `worker/src/index.js`, sa fiche dans `web/js/catalog.js`, un test dans `test/` et une page dans `docs/reseaux/` (voir [Écrire la documentation](#écrire-la-documentation)).

Un stockage suit le même principe dans `worker/src/storage/` : `fields`, `test()`, puis `folder()` et `download()` pour une source, ou `put()` pour un hébergement public.

## Mode démo

Sans serveur (fichier ouvert seul, `?demo`, ou `npm run demo`), l'interface utilise `web/js/demo.js` et garde les changements dans le navigateur.

## Écrire la documentation

Chaque page de `docs/` est en Markdown avec un en-tête YAML :

```yaml
---
title: Nom de la page
description: Une phrase qui dit à quoi elle sert (affichée dans les résultats de recherche).
category: Réseaux sociaux   # Démarrage, Utilisation, Réseaux sociaux, Stockage, Notifications, Référence
tags: [mots, clés, recherchés]
order: 3                    # position dans sa catégorie
updated: AAAA-MM-JJ
---
```

`npm run docs:index` vérifie ces champs et tous les liens internes, puis génère `docs/index.json` (titre, description, catégorie, tags, chemin et intertitres de chaque page) pour la recherche.
