---
title: Bluesky
description: Connecter un compte Bluesky avec un mot de passe d'application pour publier texte et images, sans validation d'application.
category: Réseaux sociaux
tags: [bluesky, at protocol, mot de passe d'application, app password, publication]
order: 7
updated: 2026-11-10
---

# Bluesky

| | |
|---|---|
| Publie | Texte (300 caractères), jusqu'à 4 images (1 Mo chacune) |
| Ne publie pas encore | Vidéo : mets ces posts en « Publier à la main » |
| Identifiants | Identifiant + **mot de passe d'application** (jamais ton vrai mot de passe) |
| Validation | Aucune |

## Obtenir le mot de passe d'application

1. Ouvre [Mots de passe d'application](https://bsky.app/settings/app-passwords) (Paramètres › Confidentialité et sécurité).
2. **Ajouter un mot de passe d'application**, nomme-le « PlanneRs ». Ne coche pas l'accès aux messages privés.
3. Copie le mot de passe affiché (format `xxxx-xxxx-xxxx-xxxx`) : il n'est montré qu'une fois.

## Champs dans PlanneRs

| Champ | Valeur |
|---|---|
| Identifiant | Ton nom complet, par exemple `moncompte.bsky.social` ou ton domaine |
| Mot de passe d'application | Celui de l'étape 3 |
| Serveur | Facultatif : seulement si ton compte est sur un autre serveur que `https://bsky.social` |

Pour révoquer l'accès, supprime le mot de passe d'application dans Bluesky.

## Documentation officielle

- [Créer un post](https://docs.bsky.app/docs/advanced-guides/posts)
- [Docs Bluesky](https://docs.bsky.app/)
