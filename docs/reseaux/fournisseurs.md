---
title: Fournisseurs de connexion (Composio, Postiz)
description: Relier un réseau sans créer sa propre appli développeur, en passant par Composio ou par un Postiz existant. PlanneRs garde le planning.
category: Réseaux sociaux
tags: [composio, postiz, connexion, fournisseur, instagram, x, expiration]
order: 10
updated: 2026-11-13
---

# Fournisseurs de connexion (Composio, Postiz)

Chaque réseau peut être relié de trois façons. On choisit **réseau par réseau** :

| Fournisseur | Ce qu'il faut | Réseaux | Ce qui reste à PlanneRs |
|---|---|---|---|
| **Direct** | Ta propre appli développeur (Meta, X…) | Tous | Tout |
| **Composio** | Une clé de projet Composio | Instagram, Page Facebook, X (texte) | La file, l'heure d'envoi, l'historique |
| **Postiz** | Ton Postiz (cloud ou auto-hébergé) et sa clé d'API | Tous ceux de ton Postiz | La file, l'heure d'envoi, l'historique |

Dans tous les cas, **PlanneRs planifie** : à l'heure prévue, le robot demande au fournisseur de publier tout de suite. Ni Composio ni Postiz ne programment rien de leur côté.

## Composio

1. Crée un projet sur [Composio](https://composio.dev) et une **clé de projet** (elle commence par `ak_`) avec les droits : lecture + écriture sur les comptes connectés, lecture sur les toolkits.
2. Ajoute-la au Worker, jamais dans le dépôt :
   ```
   npx wrangler secret put COMPOSIO_API_KEY
   ```
3. Dans **Réglages › Comptes › Fournisseurs de connexion**, ouvre **Composio** et clique sur **Se connecter** : PlanneRs vérifie la clé.
4. Ouvre la fiche du réseau (par exemple Instagram) et clique sur **Via Composio**. Tu autorises l'accès sur la page de Composio, puis tu reviens dans PlanneRs.

PlanneRs ne garde que l'identifiant de la connexion : **les jetons restent chez Composio**, qui les renouvelle. Si Composio indique que la connexion a **expiré**, PlanneRs le signale (résumé du matin, Réglages › Comptes) avec un bouton **Se reconnecter**.

Chaque instance de PlanneRs a son propre identifiant d'utilisateur Composio, tiré au hasard à la première connexion : un client = une instance = son propre projet Composio.

**À savoir**
- Instagram : compte **Business ou Créateur** seulement.
- Les stats, les commentaires et la synchro Instagram passent aussi par Composio.
- X : selon le moment, Composio fournit ou non des identifiants X « gérés ». S'il n'en a plus, crée ta propre appli X dans Composio (auth config), ou connecte X en direct. Via Composio, PlanneRs publie le **texte et les fils** ; pour les images et vidéos, connecte X en direct.
- Si Composio ne trouve pas d'« auth config » pour le réseau, PlanneRs essaie d'en créer une gérée par Composio ; sinon, crée-la dans le tableau de bord Composio.

## Postiz

1. Dans ton Postiz, récupère la **clé d'API publique** (Réglages › API publique).
2. Dans **Réglages › Comptes › Fournisseurs de connexion**, ouvre **Postiz**, colle l'adresse de ton Postiz (`https://api.postiz.com` pour Postiz Cloud) et la clé.
3. Ouvre la fiche d'un réseau, clique sur **Via Postiz** et choisis la chaîne. S'il n'y en a pas, **Connecter une chaîne dans Postiz** ouvre la bonne page.

**À savoir**
- L'API publique de Postiz accepte **30 appels par heure** : chaque publication en coûte un par média, un pour l'envoi, puis un à chaque vérification.
- Pas de premier commentaire ni de stats via Postiz.
- Une chaîne que Postiz demande de reconnecter apparaît **Expirée** dans PlanneRs.

## Changer de fournisseur

Ouvre la fiche du réseau : **Changer de fournisseur** propose les autres façons de le relier. La nouvelle connexion remplace l'ancienne seulement quand elle fonctionne.
