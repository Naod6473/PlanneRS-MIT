---
title: Assistants IA (MCP)
description: Brancher Claude, Codex ou ChatGPT sur PlanneRs avec le serveur MCP intégré (/mcp), protégé par Cloudflare Access.
category: Référence
tags: [mcp, ia, claude, codex, chatgpt, assistant, oauth, cloudflare access, jeton de service, réécrire, légende par réseau, anthropic]
order: 5
updated: 2026-11-10
---

# Assistants IA (MCP)

PlanneRs contient un serveur [MCP](https://modelcontextprotocol.io/) (Model Context Protocol) à l'adresse `https://ton-domaine/mcp`. Un assistant IA branché dessus peut :

| Outil | Ce qu'il fait |
|---|---|
| `planners_today` | Ce qui demande attention, et le programme des 7 jours |
| `planners_list_posts`, `planners_get_post` | Lire le planning et le détail d'un post |
| `planners_create_post`, `planners_update_post` | Créer un post, modifier titre, date, réseaux, légende (commune ou par réseau) |
| `planners_validate_caption`, `planners_unvalidate_caption` | Valider une légende, ou retirer la validation |
| `planners_add_media`, `planners_remove_media` | Ajouter une image ou une vidéo (adresse https publique), en retirer une |
| `planners_delete_post` | Supprimer un post pas encore publié (le journal garde une trace) |
| `planners_comment` | Commenter un post |
| `planners_team` | Lire les rôles de l'équipe (Scénariste, Voix, Monteur, Sous-titres, Légendes, Contrôle qualité), leurs consignes et qui les tient ; `planners_production` accepte ensuite `role` pour signer « Claude · <rôle> » |
| `planners_fabrique`, `planners_production` | Voir les vidéos en fabrication ; faire avancer une étape (script, voix, montage, sous-titres, relu), remplir le storyboard, ajouter la vidéo finie ([La Fabrique](../utilisation/la-fabrique.md)) |
| `planners_settings`, `planners_update_settings` | Lire les réglages ; changer les créneaux et les modèles (signature, hashtags) |
| `planners_stats`, `planners_activity` | Derniers chiffres ; journal des envois et des échecs |

Ce qu'il ne peut pas faire : toucher aux comptes connectés ou aux identifiants, changer les droits, publier immédiatement. Une légende validée part à l'heure prévue, comme depuis l'interface. Modifier une légende retire sa validation. Les contrôles bloquants (média manquant, trop de hashtags…) refusent la validation.

**Qui valide ?** Par défaut, l'assistant prépare tout et ce sont les humains qui valident, dans « À valider » (ou « Tout valider »). Rien ne part sans cet accord. Pour laisser l'assistant valider lui-même : **Réglages › Espace › Assistant IA › L'assistant peut aussi valider les légendes**. Si une liste de validateurs est remplie ([Équipe](../utilisation/equipe-et-client.md)), il faut en plus que la personne connectée en fasse partie.

Chaque action de l'assistant apparaît dans l'Activité avec la mention « assistant IA ».

## 1. Autoriser la connexion (une fois)

Le serveur MCP est protégé par Cloudflare Access, comme le reste. Pour qu'un assistant puisse se connecter, active la connexion OAuth gérée par Access :

1. [Zero Trust](https://one.dash.cloudflare.com/) › **Access controls** › **Applications** › ton application PlanneRs › **Edit**.
2. Onglet **Advanced settings** › active **Managed OAuth** › **Save**.

Quand tu ajoutes le connecteur, l'assistant ouvre la page de connexion Access ; tu te connectes comme d'habitude, et il reçoit un jeton. Les règles d'accès restent les mêmes. Doc officielle : [Managed OAuth](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/managed-oauth/).

## 2. Ajouter le connecteur

### Claude (ordinateur, web, téléphone)

Sur [claude.ai](https://claude.ai) › **Paramètres** › **Connecteurs** › **Ajouter un connecteur personnalisé**. Nom : PlanneRs. URL : `https://ton-domaine/mcp`. Connecte-toi quand la fenêtre Access s'ouvre. Le connecteur est ensuite disponible dans les apps Claude pour ordinateur et téléphone. Doc officielle : [Connecteurs personnalisés](https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp).

Claude Code (terminal) : `claude mcp add --transport http planners https://ton-domaine/mcp`, puis `/mcp` pour te connecter.

### Codex (OpenAI)

Dans `~/.codex/config.toml` :

```toml
[mcp_servers.planners]
url = "https://ton-domaine/mcp"
```

Puis `codex mcp login planners` pour te connecter. Doc officielle : [Codex et MCP](https://developers.openai.com/codex/mcp).

### ChatGPT

Les connecteurs MCP personnalisés demandent le **mode développeur** : **Paramètres** › **Applications et connecteurs** › **Paramètres avancés** › **Mode développeur**, puis **Créer** un connecteur avec l'URL `https://ton-domaine/mcp` et l'authentification OAuth. Le nom exact des menus peut changer : cherche « Developer mode » dans l'aide d'OpenAI.

## Sans OAuth : un jeton de service

Pour un script, un robot ou un client qui ne gère pas OAuth mais sait envoyer des en-têtes :

1. Zero Trust › **Access controls** › **Service credentials** › **Service Tokens** › **Create Service Token**. Note l'identifiant et le secret (le secret ne s'affiche qu'une fois).
2. Dans l'application PlanneRs, ajoute une règle (policy) d'action **Service Auth** qui inclut ce jeton.
3. Le client envoie les en-têtes `CF-Access-Client-Id` et `CF-Access-Client-Secret` à chaque appel. Exemple Codex : `env_http_headers = { "CF-Access-Client-Id" = "PLANNERS_ID", "CF-Access-Client-Secret" = "PLANNERS_SECRET" }` (valeurs lues dans ces variables d'environnement). Exemple Claude Code : `--header "CF-Access-Client-Id: …" --header "CF-Access-Client-Secret: …"`.

Pour ces appels, la « personne connectée » est le nom du jeton : ajoute-le aux validateurs si une liste existe. Doc officielle : [Service tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/).

## Automatiser : l'assistant prépare, tu contrôles

Une fois le connecteur ajouté, une tâche planifiée de l'assistant peut faire tourner ton planning toute seule. Exemple de consigne, à lancer chaque lundi matin (tâche planifiée dans Claude, ou routine dans Codex) :

> Avec PlanneRs : regarde `planners_today`, `planners_stats` et les créneaux. Prépare les posts de la semaine prochaine sur mes créneaux habituels : un titre, une légende (5 hashtags maximum, ma signature), le format et les réseaux. Ajoute le média si tu as son adresse, sinon laisse un commentaire « média à fournir ». Ne valide rien. Termine par un résumé de ce qui m'attend dans « À valider ».

Et une autre, chaque jour :

> Avec PlanneRs : lis `planners_activity` et `planners_today`. S'il y a un échec ou un retard, explique la cause en commentaire du post et propose une correction.

Toi, tu ouvres **Aujourd'hui**, tu relis, tu corriges si besoin, tu valides (un par un ou « Tout valider »). PlanneRs publie à l'heure prévue.

## Réécrire une légende pour chaque réseau

Dans la fiche d'un post, onglet d'un réseau (X, LinkedIn…) sous « Légende » : **Réécrire pour X avec Claude** propose une version adaptée au réseau (longueur, ton, hashtags), à partir de la légende commune. La proposition remplace la version du réseau dans l'éditeur ; tu la relis, tu la corriges, puis tu l'enregistres. Elle n'est jamais validée toute seule.

Le bouton n'apparaît que si ton instance a une clé de l'API Claude :

1. Crée une clé sur [console.anthropic.com](https://console.anthropic.com/settings/keys) (l'usage est facturé par Anthropic, à la consommation).
2. Ajoute-la au Worker comme secret nommé `ANTHROPIC_API_KEY` : tableau de bord Cloudflare › Workers › ton Worker › **Settings** › **Variables and Secrets** › **Add** › type *Secret*. Ou en ligne de commande : `npx wrangler secret put ANTHROPIC_API_KEY`.
3. Recharge PlanneRs.

Détails : modèle `claude-opus-5-5` avec un effort faible ; si Claude refuse une demande, l'API la relance sur un autre modèle (option `fallbacks`). La clé reste dans les secrets du Worker, jamais dans le navigateur.

Sans clé, un assistant branché par MCP fait la même chose : « réécris la légende du post X pour LinkedIn et Bluesky » (outil `planners_update_post`, champ `captions`).

## Détails techniques

- Transport « Streamable HTTP » sans session : requêtes JSON-RPC en `POST /mcp`, réponses JSON. `GET` répond 405.
- Le Worker vérifie la signature du jeton Access (en-tête `Cf-Access-Jwt-Assertion`) comme pour l'API.
- Code : `worker/src/mcp.js`, tests : `test/mcp.test.mjs`.
