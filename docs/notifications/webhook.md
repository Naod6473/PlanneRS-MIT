---
title: Webhook signé
description: Envoyer les événements de PlanneRs (rappel, échec, test) en JSON vers ton adresse HTTPS, signés en HMAC SHA-256, pour Slack, Discord, n8n, Make ou ton propre serveur.
category: Notifications
tags: [webhook, hmac, sha-256, signature, json, n8n, make, zapier, discord, slack, intégration]
order: 3
updated: 2026-11-10
---

# Webhook signé

| | |
|---|---|
| Accès | Adresse HTTPS + secret de signature (facultatif mais conseillé) |
| Méthode | `POST`, corps JSON |
| Événements | `manual` (rappel d'un post à la main), `failed` (échec), `test` |

## Corps envoyé

```json
{
  "event": "failed",
  "title": "Échec : Mon post",
  "text": "Ce qui s'est passé. Ce qu'il faut faire.",
  "post": { "id": "…", "title": "Mon post", "date": "2026-11-12", "time": "12:30", "networks": ["instagram"] },
  "at": "2026-11-12T11:30:04.000Z"
}
```

`post` vaut `null` pour l'événement `test`.

## Vérifier la signature

Avec un secret, chaque requête porte l'en-tête `x-planners-signature: sha256=<hex>`, HMAC SHA-256 du corps brut avec le secret.

```js
import { createHmac, timingSafeEqual } from "node:crypto";
const attendu = "sha256=" + createHmac("sha256", SECRET).update(corpsBrut).digest("hex");
const ok = timingSafeEqual(Buffer.from(attendu), Buffer.from(req.headers["x-planners-signature"] || ""));
```

Compare toujours le **corps brut** (avant analyse JSON) et en temps constant.

## Champs dans PlanneRs

**Réglages › Notifications › Webhook** :

| Champ | Valeur |
|---|---|
| Adresse HTTPS | Celle de ton service |
| Secret de signature | Une longue chaîne aléatoire (`openssl rand -hex 32`) |

Une réponse autre que 2xx est comptée comme un échec d'envoi.

## Exemples de destinations

| Service | Doc |
|---|---|
| n8n | [Nœud Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/) |
| Make | [Webhooks](https://www.make.com/en/help/tools/webhooks) |
| Zapier | [Webhooks by Zapier](https://help.zapier.com/hc/en-us/articles/8496288690317) |

Discord et Slack attendent leur propre format : passe par n8n ou Make pour reformater le message.
