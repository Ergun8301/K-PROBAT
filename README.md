# K-ProBat — Site vitrine

Site vitrine one-page pour **K-ProBat**, artisan maçon (Yasar Kilic) à Montagnat, dans l'Ain — maçonnerie générale et gros œuvre depuis 1991.

Le site utilise du HTML/CSS/JS standard, déployé sur Cloudflare Workers avec déploiement automatique à chaque push sur `main`.

## Configuration & build

Les valeurs propres au site sont dans `site.config.json` (adresse publique et identifiant client). Un script de build (`build.mjs`) génère le dossier publié (`site/`) à partir des sources — pages, sitemap, robots.txt, llms.txt et en-têtes — en refusant explicitement toute adresse écrite en dur.

## Structure des sources

Les sources sont organisées dans `src/` : la page d'accueil (one-page : savoir-faire, réalisations, artisan, contact) et les deux pages légales, avec `assets/` pour les styles, scripts et photos, et `partials/` pour les blocs communs (signature, données structurées JSON-LD).

## Déploiement

Le principe : modifier les fichiers dans `src/`, lancer le build en local pour vérifier, puis pousser sur `main`. Le déploiement se fait automatiquement via GitHub Actions et `wrangler` (Cloudflare Workers), sans passer par l'intégration automatique Git de Cloudflare.

## Maintenance

Un guide dédié (`MAINTENANCE.md`) couvre le remplacement des photos, les modifications de texte, les coordonnées, les pages légales et la gestion du domaine — il sert de référence centrale pour l'administration du site, y compris le **passage au domaine définitif**.

## Aperçu local

```bash
node build.mjs
npx http-server site
```

## Contact / formulaire

Le formulaire de la section Contact n'a pas de backend : il ouvre WhatsApp (`sendWa`) ou le client mail (`sendMail`) avec le message pré-rempli à partir des champs saisis. Coordonnées :

- Téléphone : 06 52 37 32 93
- WhatsApp : https://wa.me/33652373293
- E-mail : k.probat01@gmail.com
- Adresse : 416 chemin des Buffets — 01250 Montagnat

## Dépendances externes (CDN)

- Google Fonts : League Spartan, IBM Plex Mono
- GSAP + ScrollTrigger, Lenis (smooth scroll) — chargés depuis jsDelivr ; le site reste utilisable (sans les animations) si ces scripts ne se chargent pas.
