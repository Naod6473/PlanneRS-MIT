---
title: Telegram
description: Recevoir les rappels et alertes de PlanneRs dans Telegram avec ton propre bot (BotFather) et l'identifiant de la discussion.
category: Notifications
tags: [telegram, bot, botfather, chat id, notification, rappel, alerte]
order: 2
updated: 2026-11-10
---

# Telegram

| | |
|---|---|
| Accès | Jeton d'un bot créé avec @BotFather + identifiant de la discussion |
| Reçoit | Rappels des posts à la main, alertes d'échec, message de test |

## 1. Créer le bot

1. Ouvre [@BotFather](https://t.me/BotFather) › `/newbot`.
2. Donne un nom (« PlanneRs ») puis un identifiant qui finit par `bot`.
3. Copie le **jeton** affiché (`123456:ABC…`).

## 2. Trouver l'identifiant de la discussion

1. Ouvre ton bot dans Telegram et envoie-lui un message (« bonjour »). Pour un groupe, ajoute le bot au groupe et écris-y.
2. Ouvre dans ton navigateur, en remplaçant le jeton : `https://api.telegram.org/botTON_JETON/getUpdates`
3. Repère `"chat":{"id": ...}` : c'est l'identifiant (négatif pour un groupe).

## Champs dans PlanneRs

**Réglages › Notifications › Telegram** :

| Champ | Valeur |
|---|---|
| Jeton du bot | Étape 1 |
| Identifiant de la discussion | Étape 2 |

## Révoquer

@BotFather › `/revoke` (nouveau jeton) ou `/deletebot`.

Documentation officielle : [Bots Telegram](https://core.telegram.org/bots/tutorial) · [sendMessage](https://core.telegram.org/bots/api#sendmessage) · [getUpdates](https://core.telegram.org/bots/api#getupdates).
