---
title: GitHub Pages
description: Héberger gratuitement les médias dans un dépôt GitHub public servi par GitHub Pages, avec un jeton fine-grained limité à ce dépôt.
category: Stockage
tags: [github, github pages, hébergement public, jeton fine-grained, contents, dépôt public, jsdelivr]
order: 7
updated: 2026-11-10
---

# GitHub Pages

| | |
|---|---|
| Rôle | Hébergement public gratuit |
| Accès | Jeton GitHub fine-grained, un seul dépôt, `Contents : Read and write` |
| Attention | Dépôt **public** : les médias sont visibles par tous dès leur envoi, avant publication |

## 1. Créer le dépôt

1. [Nouveau dépôt](https://github.com/new) › nom : `mes-medias` › **Public** › coche **Add a README** › **Create repository**.
2. **Settings › Pages** › Source : **Deploy from a branch**, branche `main`, dossier `/ (root)` › **Save**.
3. Quelques minutes plus tard, l'adresse `https://ton-compte.github.io/mes-medias/` s'affiche.

## 2. Créer le jeton

1. [Jetons fine-grained](https://github.com/settings/personal-access-tokens/new).
2. Nom : « PlanneRs » ; expiration : 1 an (note la date).
3. **Repository access** › **Only select repositories** › `mes-medias`.
4. **Permissions › Repository permissions › Contents** : **Read and write**.
5. **Generate token** et copie-le.

## Champs dans PlanneRs

**Réglages › Stockage et médias › GitHub Pages** :

| Champ | Valeur |
|---|---|
| Jeton GitHub | Étape 2 |
| Dépôt | `ton-compte/mes-medias` |
| Branche | `main` (par défaut) |
| Dossier | `media` (par défaut) |
| Adresse publique | Facultatif ; par défaut `https://ton-compte.github.io/mes-medias/` |

Après chaque envoi, GitHub Pages met 30 s à 2 min à publier. PlanneRs attend que l'adresse réponde avant de publier sur les réseaux.

## Bon à savoir

- Limites : fichiers de 100 Mo maximum, site de 1 Go conseillé ([limites de Pages](https://docs.github.com/pages/getting-started-with-github-pages/github-pages-limits)).
- Secours possible : `https://cdn.jsdelivr.net/gh/ton-compte/mes-medias@main/<chemin>`. Instagram l'accepte souvent pour les images, mais le refuse régulièrement pour les vidéos. Voir [Dépannage](../reference/depannage.md#meta-instagram-facebook-threads).

Documentation officielle : [Créer un site GitHub Pages](https://docs.github.com/pages/getting-started-with-github-pages/creating-a-github-pages-site) · [Jetons fine-grained](https://docs.github.com/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) · [API Contents](https://docs.github.com/rest/repos/contents#create-or-update-file-contents).
