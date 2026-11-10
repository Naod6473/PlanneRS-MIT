---
title: WebDAV (Nextcloud, ownCloud, NAS)
description: Relier un dossier WebDAV (Nextcloud, ownCloud, Synology, kDrive…) en lecture avec un mot de passe d'application.
category: Stockage
tags: [webdav, nextcloud, owncloud, synology, nas, kdrive, mot de passe d'application, lecture seule]
order: 5
updated: 2026-11-10
---

# WebDAV (Nextcloud, ownCloud, NAS)

| | |
|---|---|
| Accès | Adresse WebDAV + identifiant + mot de passe d'application |
| Prérequis | Serveur joignable depuis Internet en **https** |
| Sert à | « Ouvrir le dossier » d'un post, liens vers chaque fichier, copie automatique vers l'hébergement public |

## Nextcloud

1. **Paramètres personnels › Sécurité** › **Créer un nouveau mot de passe d'application**. Nom : « PlanneRs ». Copie le mot de passe.
2. Ton adresse WebDAV est affichée dans **Fichiers › Paramètres de fichiers** (en bas à gauche), au format `https://ton-serveur/remote.php/dav/files/ton-identifiant/`.

## Autres serveurs

| Service | Adresse WebDAV | Doc |
|---|---|---|
| ownCloud | `https://ton-serveur/remote.php/dav/files/ton-identifiant/` | [Accès WebDAV](https://doc.owncloud.com/server/next/classic_ui/files/access_webdav.html) |
| Synology | `https://ton-nas:5006/` (paquet WebDAV Server) | [WebDAV Server](https://kb.synology.com/fr-fr/DSM/help/WebDAVServer/webdav_server) |
| Infomaniak kDrive | `https://ID_KDRIVE.connect.kdrive.infomaniak.com/` | [kDrive en WebDAV](https://www.infomaniak.com/fr/support/faq/2409) |

## Champs dans PlanneRs

**Réglages › Stockage et médias › WebDAV** :

| Champ | Valeur |
|---|---|
| Adresse WebDAV | Voir ci-dessus, avec `/` final |
| Identifiant | Ton identifiant |
| Mot de passe d'application | Jamais ton mot de passe principal |
| Dossier racine | Par exemple `MesMedias` |
| Adresse pour ouvrir un dossier | Facultatif, par exemple `https://ton-serveur/apps/files/?dir=` |

Documentation officielle : [Nextcloud WebDAV](https://docs.nextcloud.com/server/latest/user_manual/fr/files/access_webdav.html) · [RFC 4918](https://www.rfc-editor.org/rfc/rfc4918).
