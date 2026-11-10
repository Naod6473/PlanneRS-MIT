---
title: Pinterest
description: Connecter un compte Pinterest professionnel avec un jeton d'accès pour publier des épingles image, carrousel ou vidéo sur un tableau.
category: Réseaux sociaux
tags: [pinterest, épingle, pin, tableau, board, api v5]
order: 8
updated: 2026-11-10
---

# Pinterest

| | |
|---|---|
| Publie | Épingle image, carrousel (jusqu'à 5 images), épingle vidéo (avec une image de couverture) |
| Titre | La première ligne de la légende (100 caractères), sans hashtags |
| Lien | Le premier lien de la légende (avec les [liens suivis](../utilisation/activite-et-reglages.md#modèles) si tu les utilises) |
| Texte alternatif | La description des images du post |
| Identifiants | Jeton d'accès + identifiant du tableau |

## 1. Créer l'application

1. Passe ton compte en [compte professionnel](https://help.pinterest.com/fr/business/article/get-a-business-account).
2. Sur [developers.pinterest.com](https://developers.pinterest.com/apps/), crée une application et demande l'accès (droits `pins:write`, `boards:read`, `user_accounts:read`).
3. Génère un jeton d'accès pour ton compte.

## 2. Trouver l'identifiant du tableau

Avec le jeton, l'API [Lister les tableaux](https://developers.pinterest.com/docs/api/v5/boards-list) renvoie chaque tableau et son `id`.

## 3. Connecter dans PlanneRs

**Réglages › Comptes › Pinterest** : jeton d'accès et identifiant du tableau. Le jeton dure 30 jours. Pour qu'il se renouvelle tout seul, ajoute le jeton de rafraîchissement, l'ID et le secret de l'application.

Doc officielle : [Créer une épingle](https://developers.pinterest.com/docs/api/v5/pins-create).
