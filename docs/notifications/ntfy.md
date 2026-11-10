---
title: ntfy
description: Recevoir les rappels « à poster à la main » et les alertes d'échec en notification push sur ton téléphone avec ntfy, sans compte.
category: Notifications
tags: [ntfy, push, notification, téléphone, rappel, alerte, échec, auto-hébergé]
order: 1
updated: 2026-11-10
---

# ntfy

| | |
|---|---|
| Accès | Un sujet (topic) ntfy ; jeton facultatif pour un serveur protégé |
| Reçoit | Rappels des posts à la main, alertes d'échec, message de test |
| Coût | Gratuit sur ntfy.sh ; auto-hébergeable |

## Étapes

1. Installe l'application ntfy : [Android (Google Play)](https://play.google.com/store/apps/details?id=io.heckel.ntfy), [F-Droid](https://f-droid.org/packages/io.heckel.ntfy/) ou [iOS](https://apps.apple.com/app/ntfy/id1625396347).
2. Choisis un nom de sujet **long et imprévisible** (sur ntfy.sh, toute personne qui connaît le nom peut lire les messages), par exemple `planners-7f3k9q2xw`.
3. Dans l'application : **+** › colle ce nom › **S'abonner**.

## Champs dans PlanneRs

**Réglages › Notifications › ntfy** :

| Champ | Valeur |
|---|---|
| Sujet ntfy | `https://ntfy.sh/planners-7f3k9q2xw` (ou l'adresse de ton serveur) |
| Jeton | Facultatif : jeton d'accès si ton serveur exige une connexion |

**Tester** envoie « Notifications activées. ».

Documentation officielle : [Démarrer avec ntfy](https://docs.ntfy.sh/) · [Publier un message](https://docs.ntfy.sh/publish/) · [Contrôle d'accès](https://docs.ntfy.sh/config/#access-control).
