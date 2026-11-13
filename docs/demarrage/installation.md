---
title: Installation sur Cloudflare
description: Installer PlanneRs sur un Worker Cloudflare avec une base D1, protéger l'accès avec Cloudflare Access et le mettre en ligne sur son domaine.
category: Démarrage
tags: [installation, cloudflare, worker, d1, access, domaine, wrangler, déploiement, une commande, npx, windows, mac, linux]
order: 1
updated: 2026-11-11
---

# Installation sur Cloudflare

Il te faut :

- un compte Cloudflare, l'offre gratuite suffit : [créer un compte](https://dash.cloudflare.com/sign-up) ;
- pour l'installation en une commande, [Node.js](https://nodejs.org) 20 ou plus ;
- pour l'installation sans terminal, un compte GitHub.

Compte 10 à 20 minutes. À la fin, PlanneRs tourne à ton adresse, seules les personnes autorisées peuvent l'ouvrir, et le robot de publication est en **simulation** : rien ne part tant que tu ne l'as pas décidé.

Trois façons de faire, de la plus rapide à la plus manuelle : [une commande](#en-une-commande), [un bouton](#sans-terminal--le-bouton-de-déploiement) si tu ne veux pas de terminal, ou [pas à pas](#méthode-b--en-ligne-de-commande). Tu peux aussi te faire [guider par une IA](installation-avec-une-ia.md).

## En une commande

La même sur Windows (PowerShell), macOS et Linux. Ouvre un terminal dans le dossier où tu veux garder le code, puis :

```bash
npx github:Naod6473/PlanneRS-MIT
```

Le script fait tout dans l'ordre et t'explique chaque étape :

1. il copie le code dans un dossier `planners` ;
2. il installe les outils ;
3. il te connecte à Cloudflare : une page s'ouvre dans ton navigateur, tu cliques sur **Allow** ;
4. il crée la base de données et ses tables ;
5. il met le site en ligne et affiche son adresse ;
6. il génère la clé de chiffrement et te l'affiche une fois : garde-la dans ton gestionnaire de mots de passe ;
7. il t'indique comment [protéger l'accès](#protéger-laccès-avec-cloudflare-access) et enregistre les deux valeurs si tu les colles.

Si une étape échoue (connexion coupée, fenêtre fermée), relance la même commande : elle reprend où elle en est et ne recrée rien. Une clé de chiffrement déjà en place n'est jamais remplacée.

Pour voir ce que le script ferait sans rien lancer : `npx github:Naod6473/PlanneRS-MIT --dry-run`. Le code du script est dans [`scripts/install.mjs`](../../scripts/install.mjs).

Garde le dossier `planners` : pour une mise à jour, remplace le code par la nouvelle version (en gardant ton `wrangler.toml`) puis lance `npm run deploy` dedans.

## Sans terminal : le bouton de déploiement

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Naod6473/PlanneRS-MIT)

1. Clique sur le bouton et connecte tes comptes Cloudflare et GitHub.
2. Garde les noms proposés (Worker `planners`, base D1 `planners`). La page demande la **clé de chiffrement** `ENCRYPTION_KEY` : mets une longue phrase au hasard et garde-la de côté. Lance le déploiement : Cloudflare copie le dépôt sur ton GitHub, crée la base et met le site en ligne. Les tables sont créées toutes seules à la première visite.
3. Si la page n'a pas demandé la clé : ton Worker › **Settings** › **Variables and Secrets** › **Add** › type **Secret**, nom `ENCRYPTION_KEY`, valeur : une longue phrase au hasard.
4. Protège l'accès : voir [Protéger l'accès](#protéger-laccès-avec-cloudflare-access). Tant que ce n'est pas fait, le site s'ouvre mais l'API refuse tout.

Chaque modification poussée ensuite sur ta copie redéploie le site. Doc officielle : [Deploy to Cloudflare](https://developers.cloudflare.com/workers/platform/deploy-buttons/).

## Méthode A : sans terminal, depuis GitHub

1. Fais une copie du dépôt sur ton compte GitHub : bouton **Fork** du dépôt.
2. Crée la base de données : [D1](https://dash.cloudflare.com/?to=/:account/workers/d1) › **Create database** › nom `planners`. Copie son identifiant (**Database ID**).
3. Dans ta copie du dépôt, ouvre `wrangler.toml` et remplace la valeur de `database_id` par cet identifiant. Enregistre (commit).
4. Ouvre [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages) › **Create** › **Import a repository**, choisis ta copie, branche `main`.
5. Commande de build : `npm ci`. Commande de déploiement : `npx wrangler d1 migrations apply planners --remote && npx wrangler deploy`.
6. Une fois le premier déploiement fini : ton Worker › **Settings** › **Variables and Secrets** › **Add** › type **Secret**, nom `ENCRYPTION_KEY`, valeur : une longue phrase au hasard (voir l'étape 3 de la méthode B).
7. Protège l'accès : voir [Protéger l'accès](#protéger-laccès-avec-cloudflare-access).

Ensuite, chaque modification poussée sur `main` redéploie le site tout seul. Doc officielle : [Builds Workers (intégration Git)](https://developers.cloudflare.com/workers/ci-cd/builds/).

## Méthode B : en ligne de commande

### 1. Récupérer le code

```bash
git clone https://github.com/Naod6473/PlanneRS-MIT.git planners
cd planners
npm install
npx wrangler login
```

### 2. Créer la base de données

```bash
npx wrangler d1 create planners
```

Copie le `database_id` affiché dans `wrangler.toml`, puis crée les tables :

```bash
npm run db:init
```

Doc officielle : [Cloudflare D1](https://developers.cloudflare.com/d1/get-started/).

### 3. Secret de chiffrement

Les identifiants des comptes (jetons, clés) sont chiffrés avant d'être enregistrés dans la base. Choisis une longue phrase au hasard, par exemple le résultat de `openssl rand -base64 32` :

```bash
npx wrangler secret put ENCRYPTION_KEY
```

Garde-la dans ton gestionnaire de mots de passe. Si tu la perds, il faudra reconnecter tous les comptes.

### 4. Déployer

```bash
npm run deploy
```

Wrangler affiche l'adresse du site (`https://planners.<ton-compte>.workers.dev`). À ce stade, l'API refuse tout accès : c'est voulu, tant que Cloudflare Access n'est pas configuré.

## Utiliser ton propre domaine

Facultatif, mais nécessaire pour la connexion Google en écriture (Google demande un domaine vérifié pour l'écran de consentement).

1. Le domaine doit être géré par Cloudflare : [ajouter un site](https://developers.cloudflare.com/fundamentals/setup/manage-domains/add-site/).
2. Dans `wrangler.toml`, décommente ou ajoute :

   ```toml
   routes = [{ pattern = "planners.exemple.fr", custom_domain = true }]
   workers_dev = false
   ```

3. Redéploie. Doc officielle : [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

## Protéger l'accès avec Cloudflare Access

PlanneRs n'a pas d'écran de connexion à lui : c'est Cloudflare Access qui filtre les visiteurs, avant même qu'ils atteignent le site.

1. Ouvre [Zero Trust](https://one.dash.cloudflare.com/) › **Access** › **Applications** › **Add an application** › **Self-hosted**.
2. **Application domain** : l'adresse du site (ton domaine ou l'adresse `workers.dev`).
3. **Policy** : action *Allow*, règle *Emails*, ton adresse e-mail et celles des personnes autorisées.
4. Enregistre, puis dans l'application créée, copie **Application Audience (AUD) Tag**.
5. Note aussi ton domaine d'équipe : **Settings** › **Custom Pages**, de la forme `mon-equipe.cloudflareaccess.com`.
6. Dans `wrangler.toml`, renseigne :

   ```toml
   ACCESS_TEAM_DOMAIN = "mon-equipe.cloudflareaccess.com"
   ACCESS_AUD = "le-tag-copié"
   ```

7. Redéploie.

Le Worker vérifie lui-même la signature d'Access sur chaque appel. Si l'un des deux réglages manque, l'API reste fermée. Doc officielle : [Applications auto-hébergées](https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-public-app/).

## Passer en publication réelle

Le robot passe toutes les 5 minutes. Tant que `DRY_RUN = "true"` dans `wrangler.toml`, il **simule** : le journal indique « Simulation : … aurait été publié ». Quand tes comptes sont connectés et testés :

```toml
DRY_RUN = "false"
```

puis redéploie. Tu peux aussi arrêter le robot sans redéployer : Réglages › Règles et contrôles › « Robot de publication en marche ». C'est utile si un autre outil publie encore à sa place, pour éviter les doublons.

## Développement local

```bash
cp .dev.vars.example .dev.vars          # puis enlève le # devant ALLOW_NO_AUTH=true (pris en compte en local seulement)
npx wrangler d1 migrations apply planners --local
npm run dev                              # http://localhost:8787
```

Pour lancer le robot à la main : `npx wrangler dev --test-scheduled`, puis ouvre `http://localhost:8787/__scheduled?cron=*/5+*+*+*+*`.

## Essayer sans rien installer

`npm run build:demo` crée `dist/demo.html`, un seul fichier à ouvrir dans le navigateur. Les données sont fictives et restent dans ton navigateur.

## Étape suivante

[Premiers pas](premiers-pas.md) : créneaux, premier compte, premier post.
