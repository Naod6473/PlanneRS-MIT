---
title: API pour n8n, Make, Zapier ou un script
description: Lire le planning et créer des posts depuis un autre outil avec quatre adresses HTTP simples, protégées par un jeton de service Cloudflare Access.
category: Référence
tags: [api, rest, http, n8n, make, zapier, script, automatisation, jeton de service, cloudflare access, curl]
order: 6
updated: 2026-11-11
---

# API pour n8n, Make, Zapier ou un script

PlanneRs expose une petite API, pensée pour brancher un outil d'automatisation. Elle fait deux choses : **lire** le planning et **créer** des posts.

Un post créé par l'API n'est jamais validé. Il arrive « À valider » (s'il a une date) ou dans « Prêts à programmer », et attend ta relecture : rien ne part tout seul.

Dans l'autre sens, pour que PlanneRs prévienne ton outil (rappel d'un post à la main, échec), utilise le [webhook signé](../notifications/webhook.md).

## Accès

L'API passe par Cloudflare Access, comme le reste de l'application. Un outil s'identifie avec un **jeton de service** :

1. [Zero Trust](https://one.dash.cloudflare.com/) › **Access controls** › **Service credentials** › **Service Tokens** › **Create Service Token**. Note l'identifiant et le secret (le secret ne s'affiche qu'une fois).
2. Dans l'application Access de PlanneRs, ajoute une règle (policy) d'action **Service Auth** qui inclut ce jeton.
3. Dans ton outil, ajoute ces deux en-têtes à chaque appel :

```
CF-Access-Client-Id: <identifiant>
CF-Access-Client-Secret: <secret>
```

Doc officielle : [Service tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/).

## Les adresses

Toutes commencent par `https://ton-domaine/api/v1/` et répondent en JSON. Une erreur renvoie `{ "error": "…" }` avec un code 400, 401 ou 404.

| Méthode | Adresse | Rôle |
|---|---|---|
| `GET` | `today` | Ce qui demande attention : échecs, retards, légendes à valider, programme des 7 prochains jours |
| `GET` | `posts` | Liste des posts. Filtres : `from`, `to` (AAAA-MM-JJ), `status`, `query`, `limit` (50 par défaut, 200 au plus) |
| `GET` | `posts/<id>` | Tout le détail d'un post, avec ses contrôles avant envoi |
| `POST` | `posts` | Crée un post |

Statuts possibles pour le filtre `status` : `draft`, `ready`, `review` (à valider), `scheduled`, `manual`, `late`, `failed`, `published`.

## Créer un post

```bash
curl -X POST https://ton-domaine/api/v1/posts \
  -H "CF-Access-Client-Id: <identifiant>" \
  -H "CF-Access-Client-Secret: <secret>" \
  -H "content-type: application/json" \
  -d '{
    "title": "Nouvel article : le pain au levain",
    "caption": "Notre recette pas à pas est en ligne. https://exemple.fr/levain",
    "networks": ["linkedin", "facebook"],
    "format": "image",
    "date": "2026-11-20",
    "time": "12:30",
    "media": ["https://exemple.fr/img/levain.jpg"]
  }'
```

| Champ | Obligatoire | Détail |
|---|---|---|
| `title` | Oui | Titre pour toi, pas publié |
| `caption` | Non | Légende commune à tous les réseaux |
| `networks` | Non | `instagram`, `facebook`, `linkedin`, `x`, `threads`, `bluesky`, `mastodon`, `pinterest`, `youtube`, `tiktok`. Par défaut : ton premier réseau |
| `format` | Non | `reel`, `carousel`, `image`, `story`, `text`, `video`, `document`. Par défaut : `image` |
| `date`, `time` | Non | `AAAA-MM-JJ` et `HH:MM`, à l'heure de l'espace. Sans date, le post attend dans « Prêts à programmer ». Sans heure, il prend ton premier créneau |
| `media` | Non | Jusqu'à 10 adresses `https` publiques d'images ou de vidéos |
| `note` | Non | Consigne ou note interne |

La réponse (code 201) est le post créé, avec son `id` et la liste `checks` de ce qui l'empêche encore de partir.

## Exemples

**n8n** : nœud *HTTP Request*, méthode `POST`, adresse `https://ton-domaine/api/v1/posts`, les deux en-têtes dans *Headers*, le corps en JSON. Pour réagir à un échec, un nœud *Webhook* reçoit les événements du [webhook signé](../notifications/webhook.md).

**Make et Zapier** : même principe, avec le module *HTTP › Make a request* (Make) ou *Webhooks by Zapier › Custom Request* (Zapier).

**Lire les légendes à valider** :

```bash
curl "https://ton-domaine/api/v1/posts?status=review" \
  -H "CF-Access-Client-Id: <identifiant>" -H "CF-Access-Client-Secret: <secret>"
```

## Pour aller plus loin

Un assistant IA (Claude, ChatGPT, Codex) a plus d'outils que cette API : modifier un post, commenter, valider si tu l'y autorises. Voir [Assistants IA](assistants-ia.md).
