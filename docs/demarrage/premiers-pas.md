---
title: Premiers pas
description: Configurer son espace après l'installation, connecter un premier compte, créer et programmer un premier post, puis passer en publication réelle.
category: Démarrage
tags: [démarrage, espace, créneaux, premier post, validation, simulation]
order: 2
updated: 2026-11-11
---

# Premiers pas

## Visite guidée

À la première ouverture, une visite présente chaque menu (Aujourd'hui, Calendrier, Contenus, Stats, Activité, Réglages) en une minute. Elle ne revient pas ensuite. Pour la revoir : **Réglages › Espace › Revoir la visite guidée**, ou Ctrl+K puis « visite ».

## 1. Nommer l'espace

Un **espace** regroupe des comptes, des réglages et un planning. Ouvre **Réglages › Espace** et donne-lui le nom de ta marque ou de ton projet.

## 2. Définir les créneaux

Les **créneaux** sont tes horaires de publication habituels (par exemple 12h30 « Reel », 18h « Carrousel »). Ils forment les lignes du calendrier : un post déposé sur un créneau prend son heure.

**Réglages › Créneaux** › « Ajouter un créneau ». L'heure est celle de ton fuseau.

## 3. Choisir les règles d'envoi

**Réglages › Règles et contrôles** :

| Règle | Conseil |
|---|---|
| Robot de publication en marche | Décoche-la si un autre outil publie encore à ta place. |
| Ne rien envoyer sans légende validée | Garde-la cochée : c'est la garantie que rien ne part sans ton accord. |
| Demander une confirmation avant de déplacer un contenu | Cochée par défaut. |
| Ne pas relancer un relais si le réseau principal a déjà publié | Évite les doublons. |
| Nombre maximal de hashtags | Mets 5 : Instagram limite désormais les hashtags à 5 par publication. |

Les **contrôles personnalisés** affichent un rappel si une légende ne contient pas un texte (une mention, un crédit, un lien).

## 4. Connecter un premier compte

**Réglages › Comptes** : chaque réseau a sa fiche, avec ce qu'il demande, les droits nécessaires et le lien vers sa documentation. Pour Instagram, YouTube, TikTok et Google Drive, **Me guider pas à pas** ouvre un assistant : une étape à la fois, le lien direct, les valeurs à copier en un clic, puis la vérification ; en cas d'échec, il te renvoie à l'étape à revoir. Commence par le réseau principal, puis son relais :

- Instagram et Facebook : [Application Meta et jetons](../reseaux/meta.md), puis [Instagram](../reseaux/instagram.md) et [Page Facebook](../reseaux/facebook.md).
- Les autres réseaux : voir le [sommaire](../README.md#réseaux-sociaux).

Après avoir collé les identifiants, PlanneRs fait un essai et affiche « Connecté à @ton-compte » ou une explication de l'erreur.

## 5. Ranger les médias

Instagram, Facebook et Threads vont chercher chaque image ou vidéo à une **adresse publique** (https). Deux solutions :

- donner l'adresse complète de chaque média dans la fiche du post ;
- ou connecter un **stockage source** (Google Drive, Dropbox…) et un **hébergement public** (Cloudflare R2, GitHub Pages) : le robot copie lui-même le média avant l'envoi.

Voir [Stockage : vue d'ensemble](../stockage/README.md).

## 6. Créer et programmer un post

1. **Contenus** › « + » dans la colonne Idée, ou **Aujourd'hui** › « Nouveau contenu ».
2. Ouvre la carte, puis **Modifier** : réseaux (le premier est le **principal**, les suivants sont des **relais**), texte, médias, et l'aperçu à côté (voir [Créer ou modifier un post](../utilisation/contenus.md#créer-ou-modifier-un-post)).
3. Vérifie le bloc **Avant envoi** : il liste ce qui bloque (légende non validée, média manquant, texte trop long…).
4. **Valider la légende**.
5. **Changer la date** › choisis le jour et le créneau, ou glisse la carte dans le calendrier.

Le post passe en **Planifié** : il partira à l'heure prévue.

## 7. Passer en publication réelle

Tant que `DRY_RUN = "true"`, le robot simule et l'écrit dans **Activité**. Fais un premier envoi réel sur un post sans risque, puis voir [Installation › Passer en publication réelle](installation.md#passer-en-publication-réelle).

## Sur le téléphone

PlanneRs s'installe comme une application : dans Chrome (Android), menu **⋮ › Installer l'application** ; dans Safari (iPhone), **Partager › Sur l'écran d'accueil**. Sur Android, l'app installée apparaît ensuite dans le menu **Partager** de la galerie : une photo ou une vidéo partagée vers PlanneRs part dans le Drive (si l'envoi vers le Drive est connecté) et crée une idée ; un lien partagé devient une idée. Sur iPhone, le partage vers une app web n'est pas possible : utilise le bouton **Ajouter une photo** d'Aujourd'hui.

## Et ensuite

- [Aujourd'hui](../utilisation/aujourdhui.md) : ce qui t'attend chaque jour.
- [Calendrier](../utilisation/calendrier.md) et [Contenus](../utilisation/contenus.md).
- [Notifications](../notifications/ntfy.md) : être prévenu d'un échec ou d'un post à faire à la main.
