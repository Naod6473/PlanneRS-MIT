---
title: "Stockage : vue d'ensemble"
description: Différence entre stockage source et hébergement public, ce dont les réseaux ont besoin pour lire un média, et quelle combinaison choisir.
category: Stockage
tags: [stockage, médias, hébergement public, adresse publique, google drive, dropbox, onedrive, r2, github pages, copie automatique]
order: 0
updated: 2026-11-13
---

# Stockage : vue d'ensemble

## Pourquoi c'est important

Instagram, Facebook et Threads ne reçoivent pas le fichier : ils vont le **chercher à une adresse publique https** au moment de publier. Un lien de partage Google Drive, Dropbox ou OneDrive ne marche pas, car il mène à une page web, pas au fichier.

LinkedIn, X, Bluesky et Mastodon, eux, reçoivent le fichier : PlanneRs le télécharge depuis son adresse publique, puis l'envoie.

## Deux familles

| Famille | Services | Rôle |
|---|---|---|
| **Stockage source** (lecture seule) | [Google Drive](google-drive-lecture.md), [OneDrive](onedrive.md), [Dropbox](dropbox.md), [WebDAV](webdav.md) | Là où tu ranges tes fichiers. Bouton « Ouvrir le dossier » de chaque post, liens vers les fichiers, « Enregistrer » sur le téléphone. |
| **Envoi de fichiers** | [Google Drive (envoi)](google-drive-envoi.md), et aussi [OneDrive](onedrive.md), [Dropbox](dropbox.md), [WebDAV](webdav.md) avec le droit d'écriture | Envoyer vidéos et photos depuis PlanneRs (La Fabrique, raccourcis d'Aujourd'hui, fenêtre de création). |
| **Hébergement public** | [Cloudflare R2 / S3](cloudflare-r2.md), [GitHub Pages](github-pages.md) | Donne une adresse publique aux médias. |

Si plusieurs stockages sources sont connectés, PlanneRs utilise le premier dans cet ordre : Google Drive, OneDrive, Dropbox, WebDAV.

## Où vont les fichiers déposés

**Réglages › Stockage et médias › Dossier des dépôts** : choisis le stockage qui reçoit les vidéos et photos déposées dans PlanneRs, ou laisse **Automatique** (le premier connecté dans cet ordre : Google Drive en envoi, OneDrive, Dropbox, WebDAV, R2/S3, GitHub Pages). Avec R2/S3 ou GitHub Pages, le fichier est directement en ligne. Avec un stockage source, il reste chez toi et n'est copié en public qu'au moment de publier.

Un fichier envoyé depuis PlanneRs fait 95 Mo au plus. Au-delà, dépose-le directement dans ton stockage et ajoute-le au post par son nom.

## Copie automatique

Avec un stockage source **et** un hébergement public connectés, le robot s'occupe de tout : si un média n'a pas d'adresse publique, il le cherche dans le dossier du post, l'envoie sur l'hébergement, attend que l'adresse réponde, puis publie.

Le **dossier** d'un post est un chemin relatif au dossier racine, par exemple `Sujets/012_mon-sujet/reel`.

## Que choisir ?

| Situation | Combinaison |
|---|---|
| Je commence, je veux faire simple | Google Drive (lecture) + Cloudflare R2 |
| Je ne veux pas de compte Cloudflare R2 | Google Drive (lecture) + GitHub Pages (dépôt public : médias visibles avant publication) |
| J'ai déjà mes médias en ligne | Rien : colle l'adresse publique de chaque média dans la fiche du post |
| Je veux déposer des fichiers depuis mon téléphone | Ajoute Google Drive (envoi) |

Autre possibilité, sans connecteur : la variable `MEDIA_BASE_URL` dans `wrangler.toml`. Un média `nom.jpg` sera lu à `MEDIA_BASE_URL/nom.jpg`.
