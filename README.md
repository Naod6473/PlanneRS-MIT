# PlanneRs

Planifier, valider et suivre ses publications sur les réseaux sociaux, depuis un seul écran.
Auto-hébergé sur Cloudflare (gratuit pour un usage personnel), sans abonnement ni service tiers.

*Plan, approve and track your social media posts from one screen. Self-hosted on Cloudflare. The interface is available in French and English (Settings › Workspace › Language); the documentation is in French for now.*

[![Vidéo de présentation de PlanneRs : tous tes réseaux, un seul écran](docs/img/video-presentation.jpg)](https://youtu.be/mzCHU1rWABg)

▶ [Voir la vidéo de présentation sur YouTube](https://youtu.be/mzCHU1rWABg) *(watch the intro video)*

## Ce que ça fait

- **Aujourd'hui** : ce qui t'attend d'abord (échecs, posts manqués, posts à faire à la main, légendes à valider), puis le programme du jour.
- **Calendrier** : une grille par créneaux (tes horaires types en lignes, les jours en colonnes). Glisser-déposer à la souris et au doigt (appui long), avec confirmation désactivable. Vues Mois et Grille du profil Instagram.
- **Contenus** : tableau de production (idée → publié), liste sujet × réseaux, aperçu Instagram de chaque post.
- **Stats** : abonnés, vues, portée et classement des publications.
- **Activité** : état des comptes et du robot, journal en clair.
- **Réglages** : comptes, stockage des médias, créneaux, modèles, règles d'envoi, notifications, équipe.
- **Assistants IA** : un serveur MCP intégré (`/mcp`) pour Claude, Codex ou ChatGPT : lire le planning, préparer, modifier et valider des posts ([guide](docs/reference/assistants-ia.md)).

Principes :

- **Rien ne part sans validation.** Une légende non validée est affichée « À valider » et le robot ne l'envoie pas.
- **Un échec s'explique** en trois lignes : ce qui s'est passé, pourquoi, ce que tu peux faire.
- **Pas de doublon** : si le réseau principal a publié et qu'un relais échoue, on ne relance pas.
- **Le statut se lit** avec un mot et une icône, pas seulement une couleur.

## Réseaux pris en charge

| Réseau | Publication automatique | Sinon |
|---|---|---|
| Instagram (Reels, carrousels, images, stories) | Oui, API Graph | |
| Page Facebook | Oui, API Pages | |
| Threads, LinkedIn, X, Bluesky, Mastodon, Pinterest, YouTube (Shorts) | Oui | |
| TikTok | Pas encore | Rappel « à poster à la main » avec copie du texte |

Stockage des médias : Google Drive, OneDrive, Dropbox, WebDAV (source) ; Cloudflare R2 / S3, GitHub Pages (hébergement public).
Notifications : ntfy, Telegram, webhook signé (pour brancher un autre outil ou un assistant IA).

## Documentation

Tout est dans [docs/](docs/README.md), classé par catégorie : installation, utilisation, configuration de chaque réseau (avec les liens vers les consoles et la documentation officielle), stockage, notifications, dépannage, sécurité. Chaque page a un en-tête (titre, description, catégorie, mots-clés) ; `npm run docs:index` vérifie les liens et régénère [docs/index.json](docs/index.json) pour la recherche.

## Essayer sans rien installer

```bash
npm run demo        # puis ouvre http://localhost:8787/?demo
```

Ou `npm run build:demo` pour obtenir `dist/demo.html`, un seul fichier à ouvrir dans le navigateur. Les données de démo sont fictives et restent dans ton navigateur.

## Installer

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Naod6473/PlanneRS-MIT)

Le bouton copie le dépôt sur ton GitHub, crée la base D1 et déploie le Worker sur ton compte Cloudflare. Il reste deux réglages : la clé `ENCRYPTION_KEY` et Cloudflare Access. Le guide complet, avec les autres méthodes : [docs/demarrage/installation.md](docs/demarrage/installation.md). Compter 10 à 20 minutes.

## Organisation du code

```
web/              interface (HTML, CSS, JavaScript sans étape de compilation)
  js/core.js      règles partagées avec le serveur (statuts, contrôles, créneaux)
worker/src/       serveur Cloudflare Worker
  index.js        API /api/* et déclencheur planifié
  robot.js        robot de publication (testé dans test/robot.test.mjs)
  adapters/       un module par réseau, plus les notifications
  storage/        stockages sources et hébergements publics
migrations/       schéma de la base D1
docs/             documentation en Markdown (voir docs/README.md)
```

Ajouter un réseau = écrire `worker/src/adapters/<réseau>.js` avec `fields`, `publish()` et `test()`. Voir [docs/reference/architecture.md](docs/reference/architecture.md#écrire-un-connecteur).

## Tests

```bash
npm test            # tests unitaires
npm run test:e2e    # parcours dans la démo, avec Playwright (npx playwright install chromium)
```

## Licence

MIT. Les logos des réseaux viennent de [Simple Icons](https://simpleicons.org) (CC0) ; les marques appartiennent à leurs détenteurs et servent seulement à identifier les services.
