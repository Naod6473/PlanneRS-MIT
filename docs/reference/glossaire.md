---
title: Glossaire
description: Les mots de PlanneRs et des API des réseaux sociaux, expliqués simplement (statuts, relais, créneau, jeton, scope, adresse publique…).
category: Référence
tags: [glossaire, vocabulaire, statut, relais, créneau, jeton, scope, oauth, dry_run, manqué]
order: 3
updated: 2026-11-10
---

# Glossaire

## Dans PlanneRs

| Mot | Sens |
|---|---|
| **Espace** | Un compte de marque ou un projet, avec ses réseaux, créneaux et réglages. |
| **Post** | Une publication prévue : titre, format, légende, médias, réseaux, date et heure. |
| **Réseau principal** | Le premier réseau coché ; il est publié en premier. |
| **Relais** | Les réseaux suivants, publiés après le principal (par exemple Facebook après Instagram). |
| **Créneau** | Une heure habituelle de publication (par exemple 12:30 en semaine), proposée par défaut. |
| **Prêts à programmer** | Posts prêts, sans date ; on les glisse dans le calendrier. |
| **Légende validée** | Case obligatoire : sans elle, rien ne part. |
| **À la main** | Le robot n'envoie rien ; il te rappelle de poster toi-même. |
| **En retard** | L'heure est passée et le post n'est pas parti. |
| **Manqué** | En retard de plus de 24 h ; à reprogrammer, marquer comme posté ou ignorer. |
| **Robot** | La tâche qui passe toutes les 5 minutes et publie ce qui est à l'heure. |
| **DRY_RUN** | Mode simulation : le robot fait tout sauf publier. |
| **Stockage source** | L'endroit où tu ranges tes fichiers (Drive, Dropbox…). |
| **Hébergement public** | L'endroit qui donne une adresse https publique aux médias (R2, GitHub Pages). |
| **Dossier du post** | Chemin relatif au dossier racine où se trouvent ses médias. |

## Côté réseaux et API

| Mot | Sens |
|---|---|
| **API** | La porte d'entrée qu'un service ouvre aux programmes. |
| **OAuth** | La méthode « Se connecter avec… » : tu autorises une application sans lui donner ton mot de passe. |
| **Jeton (token)** | La clé qui prouve l'autorisation. Certains expirent (60 jours pour LinkedIn et Threads). |
| **Jeton de rafraîchissement** | Sert à obtenir de nouveaux jetons sans te reconnecter. |
| **Scope / permission** | Ce que le jeton a le droit de faire (`instagram_content_publish`, `w_member_social`…). |
| **Compte de service** | Un compte Google pour les programmes, sans boîte mail ni espace de stockage. |
| **Conteneur (Meta)** | Brouillon de média créé chez Instagram avant publication. |
| **Graph API** | L'API de Meta pour Instagram, Facebook et Threads. |
| **Bearer** | Le mot placé devant un jeton dans l'en-tête `Authorization`. |
| **Webhook** | Un appel HTTP envoyé automatiquement à ton adresse quand un événement se produit. |
| **HMAC** | Une signature calculée avec un secret partagé pour prouver qu'un message vient bien de PlanneRs. |
| **Cloudflare Access** | Le portail qui vérifie ton identité avant d'ouvrir PlanneRs. |
| **D1** | La base de données SQLite de Cloudflare qui garde tes posts. |
| **Worker** | Le programme qui fait tourner PlanneRs chez Cloudflare. |
