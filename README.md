# K-ProBat — Site vitrine

Site vitrine one-page pour **K-ProBat**, artisan maçon (Yasar Kilic) à Montagnat, dans l'Ain — maçonnerie générale &amp; gros œuvre depuis 1991.

Implémentation fidèle de la maquette Claude Design (`K-ProBat - Maquette.html`), recréée en HTML/CSS/JS statique avec les photos de chantier en fichiers optimisés séparés.

## Structure

```
index.html            page unique (hero, savoir-faire, réalisations, artisan, contact)
assets/css/style.css   tous les styles (design tokens, responsive, animations CSS)
assets/js/main.js      menu mobile, scroll fluide, animations GSAP/ScrollTrigger/Lenis, formulaire
assets/img/*.jpg       22 photos de chantier réelles
```

## Aperçu local

Le site est 100 % statique, aucun build n'est nécessaire :

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Déploiement

Compatible avec n'importe quel hébergement statique (GitHub Pages, Netlify, Vercel, OVH, etc.) : il suffit de servir le dossier tel quel.

## Contact / formulaire

Le formulaire de la section Contact n'a pas de backend : il ouvre WhatsApp (`sendWa`) ou le client mail (`sendMail`) avec le message pré-rempli à partir des champs saisis. Coordonnées :

- Téléphone : 06 52 37 32 93
- WhatsApp : https://wa.me/33652373293
- E-mail : k.probat01@gmail.com
- Adresse : 416 chemin des Buffets — 01250 Montagnat

## Dépendances externes (CDN)

- Google Fonts : League Spartan, IBM Plex Mono
- GSAP + ScrollTrigger, Lenis (smooth scroll) — chargés depuis jsDelivr ; le site reste utilisable (sans les animations) si ces scripts ne se chargent pas.
