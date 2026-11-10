---
title: Cloudflare R2 (ou S3)
description: Donner une adresse publique aux médias avec un bucket Cloudflare R2 ou tout service compatible S3 (clés d'accès, domaine public).
category: Stockage
tags: [cloudflare, r2, s3, bucket, hébergement public, adresse publique, access key, r2.dev, domaine personnalisé]
order: 6
updated: 2026-11-10
---

# Cloudflare R2 (ou S3)

| | |
|---|---|
| Rôle | Hébergement public : chaque média reçoit une adresse https lisible par les réseaux |
| Accès | Jeton d'API R2 (Access Key ID + Secret Access Key), droits limités au bucket |
| Coût | R2 : 10 Go gratuits par mois, pas de frais de sortie ([tarifs](https://developers.cloudflare.com/r2/pricing/)) |

## 1. Créer le bucket

1. [Tableau de bord Cloudflare › R2](https://dash.cloudflare.com/?to=/:account/r2/overview) › **Créer un bucket**. Nom : `planners-media`.
2. Ouvre le bucket › **Paramètres** › **Accès public** :
   - **Domaine personnalisé** › **Connecter un domaine** (par exemple `media.exemple.fr`), recommandé ;
   - ou **URL de développement public R2.dev** › **Autoriser** (limité en débit, pour tester).
3. Copie l'adresse publique obtenue.

## 2. Créer les clés d'accès

1. [R2 › Gérer les jetons d'API](https://dash.cloudflare.com/?to=/:account/r2/api-tokens) › **Créer un jeton d'API**.
2. Autorisation : **Lecture et écriture d'objets**, appliquée **au bucket `planners-media` uniquement**.
3. **Créer**, puis copie l'**Access Key ID**, le **Secret Access Key** et le **point de terminaison** (`https://<id du compte>.r2.cloudflarestorage.com`). Le secret n'est affiché qu'une fois.

## Champs dans PlanneRs

**Réglages › Stockage et médias › Cloudflare R2 / S3** :

| Champ | Valeur |
|---|---|
| Point d'accès S3 | `https://<id du compte>.r2.cloudflarestorage.com` |
| Nom du bucket | `planners-media` |
| Access Key ID / Secret Access Key | Étape 2 |
| Adresse publique du bucket | Étape 1.3, par exemple `https://media.exemple.fr` |
| Région | `auto` pour R2 |
| Dossier | Facultatif, `media` par défaut |

Le test vérifie les clés et l'accès au bucket, puis rappelle l'adresse publique utilisée.

## Autres services S3

Amazon S3, Scaleway, OVHcloud, Backblaze B2… : renseigne leur point d'accès et leur région. Le bucket doit autoriser la lecture publique des objets.

Documentation officielle : [Buckets publics R2](https://developers.cloudflare.com/r2/buckets/public-buckets/) · [Jetons d'API R2](https://developers.cloudflare.com/r2/api/tokens/) · [Compatibilité S3](https://developers.cloudflare.com/r2/api/s3/api/).
