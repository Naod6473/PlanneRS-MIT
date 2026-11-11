---
title: TikTok
description: Connecter un compte TikTok avec une app développeur pour envoyer des vidéos, en brouillon (à publier depuis l'appli) ou en publication directe.
category: Réseaux sociaux
tags: [tiktok, vidéo, oauth, brouillon, audit, content posting api]
order: 8
updated: 2026-11-11
---

# TikTok

| | |
|---|---|
| Publie | Une vidéo par post (MP4, de 3 s à 10 min) |
| Texte | La légende (2 200 caractères), en mode direct seulement |
| Mode brouillon (par défaut) | La vidéo arrive dans la boîte de réception de l'appli TikTok ; tu ajoutes le son et tu publies toi-même |
| Mode direct | La vidéo est publiée à l'heure prévue. Tant que TikTok n'a pas audité ton app, elle reste **privée** |
| Limite | 5 brouillons en attente au plus sur 24 h |
| Pas encore | Photos et carrousels : publie-les à la main (voir [Publier à la main](a-venir.md)) |

## 1. Créer l'app TikTok

1. Ouvre [developers.tiktok.com/apps](https://developers.tiktok.com/apps) et connecte-toi avec le compte TikTok qui publiera.
2. **Create app** (type « Individual » suffit). Remplis le nom, l'icône, la catégorie, et les adresses des conditions d'utilisation et de confidentialité (une page de ton site suffit).
3. **Add products** › ajoute **Login Kit** puis **Content Posting API**.
4. Dans **Login Kit** › **Redirect URI**, colle l'adresse affichée dans PlanneRs (Réglages › Comptes › TikTok), de la forme `https://<ton domaine>/api/oauth/tiktok/callback`.
5. Dans **Scopes**, vérifie la présence de `user.info.basic`, `video.upload` et `video.publish`.
6. Si tu veux le mode direct : dans **Content Posting API**, active **Direct Post**.
7. Envoie l'app en revue (**Submit for review**). En attendant, ajoute ton compte dans **Sandbox › Target users** pour pouvoir l'autoriser tout de suite.
8. Copie la **Client key** et le **Client secret**.

## 2. Connecter dans PlanneRs

1. **Réglages › Comptes › TikTok** › **Se connecter à TikTok**.
2. Colle la Client key et le Client secret. Laisse « Mode » vide pour le brouillon, ou écris `direct`.
3. **Autoriser avec TikTok**, puis accepte avec le bon compte.
4. La fiche affiche « Compte « … » (@…) ». **Tester la connexion** le vérifie à tout moment.

## Comment se passe un envoi

1. À l'heure prévue, le robot envoie la vidéo à TikTok (en plusieurs morceaux si elle dépasse 64 Mo).
2. TikTok la traite. Au passage suivant du robot, PlanneRs regarde où elle en est.
3. Brouillon : **Activité** indique « Envoyé dans les brouillons TikTok ». Ouvre l'appli : une notification t'attend.
4. Direct : le post passe en **Publié** avec le lien de la vidéo.

Si TikTok traite la vidéo depuis plus d'une heure, le post passe en échec : regarde dans l'appli avant de relancer, pour éviter un doublon.

## Erreurs fréquentes

| Message | Ce qu'il faut faire |
|---|---|
| TikTok refuse cette visibilité | App pas encore auditée : passe en mode brouillon, ou en visibilité « privé » |
| Autorisation manquante | Ajoute Content Posting API à l'app, puis refais « Autoriser avec TikTok » |
| Limite d'envois atteinte | Publie ou supprime les brouillons en attente dans l'appli |
| Connexion expirée | Refais « Autoriser avec TikTok » (l'autorisation dure un an) |

Documentation officielle : [Content Posting API](https://developers.tiktok.com/doc/content-posting-api-get-started).
