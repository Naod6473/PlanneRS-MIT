---
title: Installer avec l'aide d'une IA
description: Un texte à coller dans Claude Code, Codex ou un autre assistant qui a accès à un terminal, pour qu'il installe PlanneRs sur ton compte Cloudflare en te guidant.
category: Démarrage
tags: [installation, ia, claude code, codex, assistant, terminal, cloudflare, guidé]
order: 3
updated: 2026-11-11
---

# Installer avec l'aide d'une IA

Si tu utilises un assistant qui peut lancer des commandes sur ton ordinateur (Claude Code, Codex, Cursor…), il peut faire l'installation à ta place et t'expliquer chaque étape. Il te faut Node.js 20 ou plus et un compte Cloudflare, l'offre gratuite suffit.

## Le texte à coller

Copie ce texte tel quel dans ton assistant :

```text
Installe PlanneRs sur mon compte Cloudflare. Le dépôt est https://github.com/Naod6473/PlanneRS-MIT/ et le
guide d'installation est dans docs/demarrage/installation.md.

1. Lance « npx github:Naod6473/PlanneRS-MIT » dans un dossier vide. Le script copie le code dans ./planners,
   me connecte à Cloudflare (une page s'ouvre dans mon navigateur), crée la base D1, met le site en ligne
   et génère la clé de chiffrement.
2. Si une étape échoue, lis le message, corrige et relance la même commande : elle reprend où elle en est.
3. Quand le script affiche la clé de chiffrement, rappelle-moi de la garder dans mon gestionnaire de mots
   de passe. Ne l'écris dans aucun fichier.
4. Guide-moi pas à pas pour protéger l'accès avec Cloudflare Access (section « Protéger l'accès » du guide) :
   c'est moi qui clique dans le tableau de bord, toi tu me dis où. Reporte ensuite le domaine d'équipe et
   le « AUD Tag » dans wrangler.toml, puis relance « npm run deploy » dans ./planners.
5. Vérifie que le site répond, puis donne-moi son adresse et la suite : docs/demarrage/premiers-pas.md.

Règles : laisse DRY_RUN à "true" (le robot reste en simulation), ne me demande aucun mot de passe ni
jeton dans la discussion, et explique chaque commande avant de la lancer.
```

## Ce que l'assistant ne peut pas faire seul

- **Te connecter à Cloudflare** : la page s'ouvre dans ton navigateur, c'est toi qui valides.
- **Créer la règle d'accès** : elle se règle dans le tableau de bord Zero Trust. L'assistant te guide, tu cliques.
- **Connecter tes réseaux sociaux** : cela se fait ensuite dans PlanneRs, Réglages › Comptes, avec le guide de chaque réseau.

## Sans assistant

La même commande marche très bien toute seule : voir [Installation](installation.md#en-une-commande).
