---
title: OneDrive
description: Relier un dossier OneDrive (compte personnel ou Microsoft 365) en lecture seule via une application Microsoft Entra et un jeton de rafraîchissement.
category: Stockage
tags: [onedrive, microsoft, entra, azure, graph, oauth, refresh token, files.read, lecture seule]
order: 3
updated: 2026-11-10
---

# OneDrive

| | |
|---|---|
| Accès | Application Microsoft Entra + jeton de rafraîchissement (`Files.Read offline_access`) |
| Voit | Tout ton OneDrive en lecture ; PlanneRs se limite au dossier racine choisi |
| Sert à | « Ouvrir le dossier » d'un post, liens vers chaque fichier, copie automatique vers l'hébergement public |

## 1. Inscrire une application

1. [Microsoft Entra › Inscriptions d'applications](https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) › **Nouvelle inscription**.
2. Nom : « PlanneRs ». Types de comptes : **Comptes dans un annuaire d'organisation et comptes Microsoft personnels**.
3. URI de redirection : plateforme **Client public/natif (mobile et bureau)**, valeur `https://login.microsoftonline.com/common/oauth2/nativeclient`.
4. **Inscrire**, puis copie l'**ID d'application (client)**.
5. **Authentification** › **Autoriser les flux clients publics** : **Oui** › **Enregistrer**.
6. **Autorisations d'API** › **Ajouter une autorisation** › **Microsoft Graph** › **Autorisations déléguées** › coche `Files.Read` et `offline_access`.

## 2. Obtenir le jeton de rafraîchissement

Le plus simple est le flux « code d'appareil », depuis un terminal :

```bash
curl -s https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode \
  -d client_id=TON_ID_CLIENT -d scope="Files.Read offline_access"
```

1. Ouvre l'adresse affichée (`https://microsoft.com/devicelogin`) et saisis le code.
2. Connecte-toi et accepte.
3. Récupère le jeton :

```bash
curl -s https://login.microsoftonline.com/consumers/oauth2/v2.0/token \
  -d grant_type=urn:ietf:params:oauth:grant-type:device_code \
  -d client_id=TON_ID_CLIENT -d device_code=LE_DEVICE_CODE
```

Copie la valeur `refresh_token`. Pour un compte professionnel, remplace `consumers` par `organizations` ou par l'ID de ton organisation.

## Champs dans PlanneRs

**Réglages › Stockage et médias › OneDrive** :

| Champ | Valeur |
|---|---|
| ID d'application (client) | Étape 1.4 |
| Secret client | Vide pour une application publique |
| Jeton de rafraîchissement | Étape 2 |
| Locataire | `consumers` (compte perso), `common` ou l'ID de l'organisation |
| Dossier racine | Par exemple `Documents/MesMedias` |

PlanneRs renouvelle le jeton à chaque utilisation. S'il n'est pas utilisé pendant 90 jours, il expire : refais l'étape 2.

## Révoquer

[Compte Microsoft › Confidentialité › Applications et services](https://account.live.com/consent/Manage) › PlanneRs › **Supprimer ces autorisations**.

Documentation officielle : [Inscrire une application](https://learn.microsoft.com/entra/identity-platform/quickstart-register-app) · [Flux code d'appareil](https://learn.microsoft.com/entra/identity-platform/v2-oauth2-device-code) · [Lister un dossier (Graph)](https://learn.microsoft.com/graph/api/driveitem-list-children).
