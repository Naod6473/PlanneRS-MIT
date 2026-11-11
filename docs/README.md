---
title: Documentation de PlanneRs
description: Sommaire de la documentation, classée par catégorie, avec les mots-clés de chaque page.
category: Sommaire
tags: [sommaire, index, documentation]
order: 0
updated: 2026-11-11
---

# Documentation de PlanneRs

PlanneRs sert à planifier, valider, publier et suivre des publications sur les réseaux sociaux depuis un seul écran. On l'installe chez soi, sur Cloudflare.

Chaque page commence par un en-tête (`title`, `description`, `category`, `tags`, `updated`). Le fichier [`index.json`](index.json) les regroupe pour la recherche : `npm run docs:index` le régénère et vérifie les liens internes.

> Les écrans de PlanneRs sont en français ; la documentation aussi pour l'instant. *English documentation will follow.*

## Démarrage

| Page | Contenu |
|---|---|
| [Installation](demarrage/installation.md) | En une commande, par un bouton ou pas à pas : Cloudflare (Worker, D1, Access), domaine, secret de chiffrement |
| [Installer avec l'aide d'une IA](demarrage/installation-avec-une-ia.md) | Le texte à coller dans Claude Code ou Codex pour être guidé |
| [Premiers pas](demarrage/premiers-pas.md) | Créer son espace, créneaux, premier compte, premier post, passer en publication réelle |

## Utilisation

| Page | Contenu |
|---|---|
| [Aujourd'hui](utilisation/aujourdhui.md) | Tableau de bord, « À faire », manqués, raccourcis, dépôt de fichiers |
| [Calendrier](utilisation/calendrier.md) | Semaine par créneaux, mois, grille du profil, glisser-déposer, confirmation |
| [Contenus](utilisation/contenus.md) | Tableau Kanban (Idée → Publié), verrous, fiche d'un post, aperçu Instagram |
| [Stats](utilisation/stats.md) | Abonnés, vues, portée, meilleur Reel, tri des publications |
| [Activité et réglages](utilisation/activite-et-reglages.md) | Journal, état des comptes et du robot, créneaux, règles, notifications, import et export |
| [Automatisations](utilisation/automatisations.md) | Flux RSS repris en posts à relire, commentaire automatique au-delà d'un nombre de likes |

## Réseaux sociaux

| Page | Publication | Ce qu'il faut |
|---|---|---|
| [Application Meta et jetons](reseaux/meta.md) | (commun) | Une application Meta et un jeton de Page sans expiration |
| [Instagram](reseaux/instagram.md) | Automatique | Compte professionnel relié à une Page Facebook |
| [Page Facebook](reseaux/facebook.md) | Automatique (relais) | Jeton de la Page |
| [Threads](reseaux/threads.md) | Automatique | Jeton Threads de 60 jours |
| [LinkedIn](reseaux/linkedin.md) | Automatique | Jeton OAuth de 60 jours et identifiant de l'auteur |
| [X](reseaux/x.md) | Automatique | Quatre clés OAuth 1.0a, offre API adaptée |
| [Bluesky](reseaux/bluesky.md) | Automatique | Mot de passe d'application |
| [Mastodon](reseaux/mastodon.md) | Automatique | Jeton d'application de l'instance |
| [YouTube (Shorts)](reseaux/youtube.md) | Automatique | Client OAuth Google |
| [Pinterest](reseaux/pinterest.md) | Automatique | Jeton d'accès + tableau |
| [TikTok](reseaux/tiktok.md) | Automatique (vidéos, brouillon ou direct) | App développeur TikTok |
| [Buffer, à la main](reseaux/a-venir.md) | À la main (rappel) | Rien pour l'instant |

## Stockage des médias

| Page | Rôle |
|---|---|
| [Stockage : vue d'ensemble](stockage/README.md) | Stockage source ou hébergement public : lequel choisir |
| [Google Drive (lecture)](stockage/google-drive-lecture.md) | Ouvrir le dossier d'un post, liens vers les fichiers |
| [Google Drive (envoi de fichiers)](stockage/google-drive-envoi.md) | Envoyer des vidéos et photos depuis PlanneRs |
| [OneDrive / SharePoint](stockage/onedrive.md) | Source, lecture seule |
| [Dropbox](stockage/dropbox.md) | Source, lecture seule |
| [NAS ou Nextcloud (WebDAV)](stockage/webdav.md) | Source, lecture seule |
| [GitHub Pages](stockage/github-pages.md) | Hébergement public gratuit |
| [Cloudflare R2 / S3](stockage/cloudflare-r2.md) | Hébergement public, recommandé |

## Notifications

| Page | Usage |
|---|---|
| [ntfy](notifications/ntfy.md) | Notifications push sur téléphone, sans compte |
| [Telegram](notifications/telegram.md) | Messages d'un bot |
| [Webhook](notifications/webhook.md) | Prévenir un autre outil ou un assistant IA |

## Référence

| Page | Contenu |
|---|---|
| [Dépannage](reference/depannage.md) | Messages d'erreur des réseaux, causes, solutions |
| [Sécurité](reference/securite.md) | Chiffrement des identifiants, accès, révocation |
| [API](reference/api.md) | Lire le planning et créer des posts depuis n8n, Make, Zapier ou un script |
| [Architecture](reference/architecture.md) | Données, robot, écrire un connecteur |
| [Glossaire](reference/glossaire.md) | Statuts, créneau, relais, jeton, hébergement public… |

## Liens officiels utiles

| Service | Console | Documentation |
|---|---|---|
| Meta (Instagram, Facebook, Threads) | [Mes applications](https://developers.facebook.com/apps/) · [Explorateur de l'API Graph](https://developers.facebook.com/tools/explorer/) · [Outil de débogage des jetons](https://developers.facebook.com/tools/debug/accesstoken/) | [Instagram Platform](https://developers.facebook.com/docs/instagram-platform) · [Pages API](https://developers.facebook.com/docs/pages-api/) · [Threads API](https://developers.facebook.com/docs/threads) |
| LinkedIn | [Mes applications](https://www.linkedin.com/developers/apps) · [Générateur de jeton](https://www.linkedin.com/developers/tools/oauth/token-generator) | [Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api) |
| X | [Portail développeur](https://developer.x.com/en/portal/dashboard) | [Documentation X API](https://docs.x.com/) |
| Bluesky | [Mots de passe d'application](https://bsky.app/settings/app-passwords) | [Docs Bluesky](https://docs.bsky.app/) |
| Mastodon | Préférences › Développement de ton instance | [Docs Mastodon](https://docs.joinmastodon.org/) |
| Google | [Console Google Cloud](https://console.cloud.google.com/) | [Drive API](https://developers.google.com/workspace/drive/api/guides/about-sdk) |
| Cloudflare | [Tableau de bord](https://dash.cloudflare.com/) | [Workers](https://developers.cloudflare.com/workers/) · [D1](https://developers.cloudflare.com/d1/) · [Access](https://developers.cloudflare.com/cloudflare-one/policies/access/) |
