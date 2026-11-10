---
title: TikTok et Buffer
description: TikTok et Buffer, sans module de publication pour l'instant, à gérer en « publier à la main » avec rappel, et ce que demandera leur future connexion.
category: Réseaux sociaux
tags: [tiktok, buffer, à la main, rappel, feuille de route]
order: 9
updated: 2026-11-10
---

# TikTok et Buffer

TikTok et Buffer ont leur fiche dans **Réglages › Comptes**, mais pas encore de module de publication.

## En attendant : publier à la main

1. Dans la fiche du post : **Titre, format et réseaux** › coche **Publier à la main**.
2. À l'heure prévue (ou plus tôt, voir **Réglages › Notifications**), tu reçois un rappel.
3. **Poster** ouvre l'aide pas à pas : enregistrer le média, copier le texte, ouvrir l'application, puis **C'est posté** (avec le lien du post).

## Ce que demandera chaque connexion

| Réseau | Accès | Point d'attention | Documentation |
|---|---|---|---|
| TikTok | OAuth TikTok, `video.publish` ou `video.upload` | Application à faire valider par TikTok ; sans validation, les vidéos sont privées | [Content Posting API](https://developers.tiktok.com/doc/content-posting-api-get-started) |
| Buffer (relais) | Clé API Buffer | Pour passer par Buffer quand un réseau n'a pas d'accès direct | [API Buffer](https://buffer.com/developer-api) |

YouTube (Shorts) et Pinterest sont désormais publiés automatiquement : voir [YouTube](youtube.md) et [Pinterest](pinterest.md).

Une contribution est bienvenue : voir [Architecture › Écrire un connecteur](../reference/architecture.md#écrire-un-connecteur).
