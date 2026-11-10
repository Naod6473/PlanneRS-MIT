---
title: YouTube (Shorts)
description: Connecter une chaîne YouTube avec un client OAuth Google pour publier des Shorts et des vidéos à l'heure prévue.
category: Réseaux sociaux
tags: [youtube, shorts, vidéo, oauth, google cloud, quota]
order: 8
updated: 2026-11-10
---

# YouTube (Shorts)

| | |
|---|---|
| Publie | Une vidéo par post. Verticale et de moins de 3 minutes, elle devient un Short |
| Titre | La première ligne de la légende (100 caractères), sans les lignes de hashtags |
| Description | La légende (5 000 caractères) ; les hashtags deviennent aussi des mots-clés |
| Visibilité | Publique par défaut ; « unlisted » (non répertoriée) ou « private » au choix |
| Limite | Quota de l'API : environ 6 envois par jour avec le quota par défaut |

## 1. Préparer Google Cloud

Si tu as déjà configuré [Google Drive (envoi)](../stockage/google-drive-envoi.md), réutilise le même client OAuth.

1. [Google Cloud Console](https://console.cloud.google.com/) › ton projet › **API et services** › **Bibliothèque** › active **YouTube Data API v3**.
2. **Identifiants** › **Créer des identifiants** › **ID client OAuth** › type **Application Web**.
3. **URI de redirection autorisés** : `https://ton-domaine/api/oauth/google/callback`.
4. **Écran de consentement OAuth** : ajoute ton compte Google dans les utilisateurs de test tant que l'application n'est pas publiée.

## 2. Connecter dans PlanneRs

**Réglages › Comptes › YouTube (Shorts)** : colle l'ID client et le code secret, puis **Autoriser avec Google** et choisis le compte qui possède la chaîne.

## Bon à savoir

- Une application Google non vérifiée peut voir ses vidéos bloquées en privé : voir [Audits et quotas](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits).
- Quota épuisé : l'envoi échoue avec « Limite d'envois YouTube atteinte » ; reprogramme au lendemain.

Doc officielle : [videos.insert](https://developers.google.com/youtube/v3/docs/videos/insert).
