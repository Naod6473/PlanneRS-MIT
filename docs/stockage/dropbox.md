---
title: Dropbox
description: Relier un dossier Dropbox en lecture seule avec une application Dropbox (App key, App secret) et un jeton de rafraîchissement hors ligne.
category: Stockage
tags: [dropbox, oauth, app key, app secret, refresh token, offline, lecture seule]
order: 4
updated: 2026-11-10
---

# Dropbox

| | |
|---|---|
| Accès | Application Dropbox + jeton de rafraîchissement (`token_access_type=offline`) |
| Droits | `files.metadata.read`, `files.content.read`, `account_info.read` |
| Sert à | « Ouvrir le dossier » d'un post, liens vers chaque fichier, copie automatique vers l'hébergement public |

## 1. Créer l'application

1. [Dropbox App Console](https://www.dropbox.com/developers/apps) › **Create app**.
2. **Scoped access**, puis **Full Dropbox** (ou **App folder** pour limiter l'accès à un seul dossier). Nom : « PlanneRs-ton-nom ».
3. Onglet **Permissions** : coche `files.metadata.read`, `files.content.read`, `account_info.read` › **Submit**.
4. Onglet **Settings** : copie l'**App key** et l'**App secret**.

## 2. Obtenir le jeton de rafraîchissement

1. Ouvre, en remplaçant `TON_APP_KEY` :
   `https://www.dropbox.com/oauth2/authorize?client_id=TON_APP_KEY&response_type=code&token_access_type=offline`
2. **Continuer** › **Autoriser**, puis copie le code affiché.
3. Échange-le dans un terminal :

```bash
curl -s https://api.dropboxapi.com/oauth2/token \
  -d code=LE_CODE -d grant_type=authorization_code \
  -u TON_APP_KEY:TON_APP_SECRET
```

Copie la valeur `refresh_token` (elle n'expire pas).

## Champs dans PlanneRs

**Réglages › Stockage et médias › Dropbox** :

| Champ | Valeur |
|---|---|
| App key | Étape 1.4 |
| App secret | Étape 1.4 |
| Jeton de rafraîchissement | Étape 2 |
| Dossier racine | Par exemple `/MesMedias` (vide pour la racine) |

## Révoquer

[Dropbox › Paramètres › Applications connectées](https://www.dropbox.com/account/connected_apps) › PlanneRs › **Déconnecter**.

Documentation officielle : [Guide OAuth Dropbox](https://developers.dropbox.com/oauth-guide) · [API HTTP](https://www.dropbox.com/developers/documentation/http/documentation).
