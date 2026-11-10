---
title: X (Twitter)
description: Connecter un compte X avec les quatre clés OAuth 1.0a pour publier texte, images et vidéo.
category: Réseaux sociaux
tags: [x, twitter, oauth 1.0a, api key, access token, read and write, tweet, post]
order: 6
updated: 2026-11-10
---

# X (Twitter)

| | |
|---|---|
| Publie | Texte (280 caractères), jusqu'à 4 images ou 1 vidéo |
| Identifiants | 4 clés OAuth 1.0a, **sans expiration** |
| Coût | L'API d'écriture dépend de l'offre X choisie (gratuite limitée ou payante) : voir le [portail](https://developer.x.com/en/portal/dashboard) |

## 1. Créer l'application

1. Ouvre le [portail développeur X](https://developer.x.com/en/portal/dashboard) et inscris-toi (choix de l'offre).
2. Dans ton **Project**, ouvre l'**App** › **Settings** › **User authentication settings** › **Set up**.
3. **App permissions** : **Read and write**. Type : **Web App, Automated App or Bot**. Callback et site web : l'adresse de ton PlanneRs suffit.
4. Enregistre.

## 2. Générer les clés

Onglet **Keys and tokens** :

1. **API Key and Secret** › **Regenerate** : copie l'**API Key** et l'**API Key Secret**.
2. **Access Token and Secret** › **Generate** : copie l'**Access Token** et l'**Access Token Secret**.

Important : génère l'Access Token **après** être passé en « Read and write ». Un jeton créé avant reste en lecture seule ; il faut alors le régénérer.

## Champs dans PlanneRs

| Champ | Valeur |
|---|---|
| API Key | Clé de l'application |
| API Key Secret | Secret de l'application |
| Access Token | Jeton de ton compte |
| Access Token Secret | Secret du jeton |

## Documentation officielle

- [Publier un post](https://docs.x.com/x-api/posts/manage-tweets/introduction)
- [Envoyer un média](https://docs.x.com/x-api/media/introduction)
- [Documentation X API](https://docs.x.com/)
