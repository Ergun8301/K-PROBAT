# Guide de maintenance — site K-ProBat

Le site est en **HTML / CSS / JS standard**. Un petit script (`build.mjs`)
génère le dossier publié `site/` à partir des **sources** `src/`. Tout se
modifie avec un éditeur de texte (VS Code recommandé, gratuit).

> **Règle d'or : on modifie `src/`, jamais `site/`** (généré, écrasé à chaque
> build, non versionné). Et on modifie **le texte et les liens**, pas les
> `style="…"` autour, sauf si vous savez ce que vous faites.

---

## Arborescence du projet

```
repo/
├── site.config.json          ← LES 2 VALEURS propres au site : siteUrl, client
├── build.mjs                 ← génère site/ à partir de src/ (+ contrôles)
├── wrangler.jsonc             ← config Cloudflare Workers (nom du Worker, dossier publié)
├── .github/workflows/
│   └── deploy.yml            ← build + déploiement automatique à chaque push sur main
├── src/                      ← LES SOURCES : c'est ici qu'on travaille
│   ├── index.html            → page unique (accueil, savoir-faire, réalisations, artisan, contact)
│   ├── mentions-legales.html → Mentions légales (obligatoire)
│   ├── confidentialite.html  → Politique de confidentialité (obligatoire)
│   ├── partials/
│   │   ├── signature.html    → signature IPPYX + liens légaux (source unique, injectés dans toutes les pages)
│   │   ├── jsonld-localbusiness.html → fiche LocalBusiness (données structurées, toutes les pages)
│   │   └── jsonld-breadcrumb.html    → fil d'Ariane JSON-LD (pages légales)
│   ├── robots.txt · llms.txt · _headers → fichiers SEO / IA (copiés avec l'adresse du site)
│   └── assets/
│       ├── css/style.css     → tous les styles (couleur accent = 1 seule ligne, --acc)
│       ├── js/main.js        → menu, scroll fluide, animations, formulaire
│       ├── img/               → 22 photos réelles de chantiers
│       └── og/k-probat-og.jpg → image d'aperçu pour les partages (1200 × 630)
├── site/                     ← GÉNÉRÉ par build.mjs, publié tel quel (ne pas éditer)
└── README.md · MAINTENANCE.md
```

Dans les pages, quatre jetons sont remplacés au build : `{{SITE_URL}}` (par
`siteUrl`), `{{SIGNATURE}}` (bloc signature), `{{JSONLD}}` (fiche LocalBusiness)
et `{{BREADCRUMB}}` (fil d'Ariane, pages légales). `sitemap.xml` est généré.
**N'écrivez jamais l'adresse du site en dur** : le build refuse et explique
pourquoi.

---

## Cycle de travail (à chaque modification)

```bash
# 1. modifier les fichiers dans src/
node build.mjs                       # 2. génère site/ — échoue avec un message clair si problème
npx http-server site                 # 3. aperçu local (ou ouvrir site/index.html)
git add . && git commit -m "Mise à jour photos / textes" && git push   # 4. publier
```

Le déploiement se lance tout seul (onglet **Actions** sur GitHub, ~1 min) :
coche verte = en ligne ; croix rouge = le détail de l'erreur est affiché en
haut du run (annotation), inutile d'ouvrir le journal.

---

## 1) Remplacer / ajouter des photos

Les photos actuelles sont les vraies photos de chantier de K-ProBat, dans
`src/assets/img/`. Pour en changer une :

1. Déposez la nouvelle photo dans `src/assets/img/` (JPG, largeur ~1600 px,
   poids < 400 Ko — compressez sur [squoosh.app](https://squoosh.app)).
2. Dans `src/index.html`, repérez la balise `<img src="assets/img/…">`
   concernée et remplacez le nom de fichier.
3. Mettez à jour le texte `alt="…"` (description de la photo — utile pour
   Google).

Chaque photo apparaît généralement à deux ou trois endroits (mosaïque
d'accueil, carte savoir-faire, galerie réalisations) : un « Rechercher /
Remplacer dans tous les fichiers » sur son nom de fichier (VS Code :
`Ctrl+Maj+H`, dossier `src/`) permet de la changer partout d'un coup.

---

## 2) Modifier les textes

Ouvrez `src/index.html`, cherchez le texte (Ctrl+F) et éditez-le **entre les
balises**, sans toucher aux guillemets `style="…"`.

- Titre d'onglet et description Google : en haut du fichier, `<title>…</title>`
  et `<meta name="description" …>` (les balises Open Graph qui suivent ont
  leur propre titre/description, à garder cohérents).
- `<br>` force un retour à la ligne : gardez-le ou retirez-le selon le rendu.

---

## 3) Changer le numéro de téléphone / WhatsApp / e-mail

Le numéro apparaît sous **trois formes**. Faites un « Rechercher / Remplacer
dans tous les fichiers » (VS Code : `Ctrl+Maj+H`) **sur le dossier `src/`**,
pour chacune, dans cet ordre :

| Rechercher | Remplacer par (exemple 06 11 22 33 44) | Rôle |
|---|---|---|
| `06 52 37 32 93` | `06 11 22 33 44` | numéro affiché |
| `0652373293`     | `0611223344`    | lien « Appeler » `tel:` |
| `33652373293`    | `33611223344`   | lien WhatsApp `wa.me/…` |

> WhatsApp = indicatif **33** + le numéro sans le 0 initial.

L'**e-mail** `k.probat01@gmail.com` se change de la même façon, y compris
dans les pages légales.

---

## Le formulaire de devis — ce qui est branché, ce qui reste à brancher

Le formulaire de la section Contact envoie la demande **au site lui-même**
(`POST /api/devis`, traité par `worker/index.js`). Le visiteur **ne quitte
jamais la page** : la confirmation s'affiche sous le formulaire. Les boutons
WhatsApp et e-mail restent à côté, comme raccourcis facultatifs.

Une demande reçue suit trois canaux, **indépendants et facultatifs** :

| Canal | État | Ce qu'il faut faire |
|---|---|---|
| **Journal du Worker** | actif | rien — toute demande y est tracée, donc rien n'est jamais perdu. Cloudflare -> Workers -> `k-probat-site` -> *Logs* |
| **Enregistrement (KV)** | à activer | voir A ci-dessous — 2 minutes, aucun domaine requis |
| **E-mail à l'artisan** | à activer | voir B ci-dessous — nécessite le domaine définitif |

### A. Enregistrer les demandes (recommandé tout de suite)

1. Cloudflare -> *Stockage et bases de données -> KV* -> **Créer un espace**,
   nom : `LEADS`. Copier son identifiant.
2. Dans `wrangler.jsonc`, décommenter le bloc `kv_namespaces` et coller
   l'identifiant.
3. `git commit` + `git push` : les demandes sont dès lors consultables dans
   l'espace KV (une entrée par demande, clé `devis:<date>`).

### B. Envoyer les demandes par e-mail à l'artisan

Possible **seulement une fois le domaine définitif en place** (voir la section
« Passage au domaine définitif ») : Cloudflare n'envoie d'e-mail que depuis un
domaine qu'il gère.

1. Cloudflare -> le domaine -> *Email -> Email Routing* -> activer.
2. *Adresses de destination* -> ajouter `k.probat01@gmail.com` -> l'artisan
   valide le lien reçu par e-mail.
3. Dans `wrangler.jsonc`, décommenter les blocs `send_email` et `vars`
   (adresse `MAIL_FROM` sur le domaine, ex. `site@k-probat.fr`).
4. `git push`. Chaque demande part alors dans la boîte de l'artisan, avec
   l'adresse du visiteur en `Reply-To` (il répond directement).

### C. Accusé de réception au visiteur — limite à connaître

Cloudflare ne peut envoyer d'e-mail qu'à des adresses **vérifiées dans le
compte**. Écrire à un visiteur inconnu impose donc un service d'envoi tiers
(Brevo, Resend...). Aujourd'hui le visiteur a sa confirmation **à l'écran**
(« Votre demande est bien envoyée. Yasar vous rappelle sous 24 h. »), ce qui
couvre l'essentiel du besoin. Le champ e-mail du formulaire est déjà en place :
le jour où un service d'envoi est ajouté, il n'y aura que la fonction
`sendToArtisan` de `worker/index.js` à dupliquer pour le visiteur.

### Anti-spam

Un champ caché (« piège à robots ») est présent dans le formulaire : rempli, la
demande est ignorée silencieusement. Aucun captcha, donc aucune friction.

---

## 4) Mettre à jour le site (GitHub + Cloudflare)

Hébergement : **Cloudflare Workers**, compte Cloudflare dédié « K-ProBat ».
Déploiement **automatique** à chaque push sur `main` par
`.github/workflows/deploy.yml` (build → dry-run → déploiement).

**Mise en place (déjà faite, une seule fois) :**
1. Compte Cloudflare K-ProBat → jeton API (modèle « Modifier Cloudflare
   Workers », limité à ce seul compte).
2. GitHub → dépôt → *Settings → Secrets and variables → Actions* :
   `CLOUDFLARE_ACCOUNT_ID` et `CLOUDFLARE_API_TOKEN`.
3. `wrangler.jsonc` → ligne `"name"` = nom du Worker (`k-probat-site`).
4. `site.config.json` → `siteUrl` et `client`.

**À chaque modification ensuite** : voir « Cycle de travail » ci-dessus.

---

## 5) PASSAGE AU DOMAINE DÉFINITIF (ex. k-probat.fr) — procédure exacte

Aujourd'hui le site répond sur l'adresse `workers.dev` indiquée dans
`site.config.json`. Le jour du vrai domaine, **une seule ligne de code
change**. Suivez les étapes dans l'ordre.

**Pré-requis** : le domaine est géré dans le compte Cloudflare **K-ProBat**
(*Domaines → Ajouter un domaine*, puis pointer les serveurs de noms chez le
registrar si le domaine a été acheté ailleurs). Attendre l'état « Actif ».

**Étape A — Brancher le domaine sur le Worker (Cloudflare)**
1. Compte K-ProBat → *Calcul → Workers et Pages* → **k-probat-site**.
2. *Paramètres → Domaines et routes* → **+ Ajouter** → *Domaine personnalisé*.
3. Saisir `k-probat.fr` → Ajouter. Recommencer avec `www.k-probat.fr` si besoin.
4. Attendre que le domaine affiche « Actif » (certificat HTTPS automatique,
   quelques minutes).

**Étape B — Changer l'adresse dans le code (une ligne)**
- Fichier : **`site.config.json`**, ligne `"siteUrl"`.
- Avant : `"siteUrl": "https://k-probat-site.k-probat.workers.dev",`
- Après : `"siteUrl": "https://k-probat.fr",`
- Règles : commence par `https://`, **sans `/` final**, sans chemin. Choisir
  ici l'adresse principale (avec ou sans `www`), celle que Google doit retenir.

**Étape C — Générer et publier**
```bash
node build.mjs          # doit afficher : ✓ site/ généré … siteUrl = https://k-probat.fr
git add . && git commit -m "Passage au domaine définitif k-probat.fr" && git push
```

**Étape D — Vérifier (5 minutes, dans cet ordre)**
1. GitHub → *Actions* : le run est vert.
2. `https://k-probat.fr` s'ouvre, ainsi que `https://k-probat.fr/mentions-legales`.
3. Sur la page d'accueil : clic droit → *Afficher le code source* (Ctrl+U) →
   les lignes `<link rel="canonical" …>`, `og:url`, `og:image` et
   `twitter:image` commencent toutes par `https://k-probat.fr`.
4. `https://k-probat.fr/assets/og/k-probat-og.jpg` affiche l'image d'aperçu.
5. Partager `https://k-probat.fr/?v=2` dans WhatsApp : la vignette apparaît
   (le `?v=2` force un aperçu neuf ; WhatsApp garde les anciens en cache).
6. *(Recommandé)* Cloudflare → Worker → *Domaines et routes* → ligne
   `workers.dev` → **Désactiver** : seule l'adresse définitive sert le site
   (évite un doublon dans Google). L'ancienne adresse cesse alors de répondre.
7. GitHub → *Actions* → le run → l'annotation **« Site en ligne vérifié »**
   liste les contrôles faits depuis le nouveau domaine (200, types de contenu,
   JSON-LD). Si elle est rouge, le détail dit quel fichier ne répond pas.
8. [Google Search Console](https://search.google.com/search-console) : ajouter
   la propriété du nouveau domaine, puis *Sitemaps* → envoyer
   `https://k-probat.fr/sitemap.xml`.

**Si quelque chose est faux** : la seule ligne qui compte est `siteUrl` dans
`site.config.json`. Corrigez-la, `node build.mjs`, push.

---

## SEO local & assistants IA (JSON-LD, sitemap, robots, llms)

Tout est généré par `build.mjs` avec l'adresse du site : rien à mettre à jour
le jour du domaine.

| Quoi | Où | Rôle |
|---|---|---|
| Fiche **LocalBusiness** (JSON-LD) | `src/partials/jsonld-localbusiness.html` | Google / assistants : nom, téléphone, e-mail, ville, zone, prestations |
| Fil d'Ariane (JSON-LD) | `src/partials/jsonld-breadcrumb.html` + table `PAGE_NAMES` dans `build.mjs` | Pages légales uniquement |
| `sitemap.xml` | généré | Liste des pages (URL propres, date du dernier commit) |
| `robots.txt` | `src/robots.txt` | Tout autorisé, un groupe par robot (Google, Bing, GPTBot, ClaudeBot, Perplexity, CCBot…) + adresse du sitemap |
| `llms.txt` | `src/llms.txt` | Résumé du site pour les assistants IA (métier, zone, prestations, contact) |
| `_headers` | `src/_headers` | Force `charset=utf-8` sur les fichiers texte (sinon les accents cassent) |

**Règle d'or des données structurées : uniquement ce que le site affiche.**
Pas de SIRET, d'horaires précis, de note ni d'avis tant qu'ils ne sont pas
publiés sur le site. Pour ajouter une commune à la zone : la liste
`areaServed` du partial ; une prestation : `hasOfferCatalog`.

**Rappel robots.txt** : un robot qui trouve un groupe à son nom **ignore** le
groupe `*`. Toute exclusion doit être répétée dans chaque groupe.

À chaque déploiement, le workflow vérifie **en direct** que `/`,
`/mentions-legales`, `/confidentialite`, `/sitemap.xml`, `/robots.txt`,
`/llms.txt` et l'image de partage répondent en 200 avec le bon type de
contenu, et que le JSON-LD est servi (annotation « Site en ligne vérifié »
sur le run).

## Aperçu lors d'un partage (WhatsApp, Facebook, LinkedIn…)

Les 3 pages contiennent des balises **Open Graph / Twitter** (vignette au
partage d'un lien) et une balise `canonical`. Toutes leurs adresses sont
**générées** depuis `siteUrl` : rien à modifier à la main.
L'image est `src/assets/og/k-probat-og.jpg` (1200 × 630 px) : remplacez-la
par une nouvelle photo de chantier au même format si besoin.

---

## Pages légales (Mentions légales · Confidentialité)

Deux pages obligatoires, même structure que l'accueil :
`src/mentions-legales.html` (adresse `/mentions-legales`) et
`src/confidentialite.html` (adresse `/confidentialite`). Leurs liens sont
dans le pied de page de **toutes** les pages, à côté de la signature IPPYX,
via le partial `src/partials/signature.html` (rien à ajouter page par page).
Elles figurent dans `sitemap.xml` et sont contrôlées en direct par le
workflow.

**Ce qui est renseigné aujourd'hui** : Yasar Kilic, entrepreneur individuel,
maçonnerie générale et gros œuvre, 416 chemin des Buffets, 01250 Montagnat,
téléphone et e-mail du site, directeur de la publication Yasar Kilic,
hébergeur Cloudflare, Inc. (101 Townsend St, San Francisco, CA 94107),
conception IPPYX.

**SIRET** : non publié — mentionné « communiqué sur demande » dans les
mentions légales (cohérent avec le pied de page du site). **Dès que le
numéro est disponible**, remplacez « communiqué sur demande » par le
numéro réel dans `src/mentions-legales.html` (obligation légale) et, si
souhaité, dans le JSON-LD.

**Assurances** : le site indique seulement que l'entreprise est couverte
(décennale + RC Pro) et renvoie aux devis et factures pour les coordonnées de
l'assureur, comme l'exige la loi (art. 22-2 loi 96-603, obligation sur devis
et factures). Rien à compléter sur le site tant que ces coordonnées ne sont
pas fournies.

**Cookies** : le site n'utilise **aucun** cookie de suivi ni outil de mesure
d'audience (pas de Google Analytics, pas de pixel). Il n'y a donc **pas de
bandeau de consentement** — et il ne faut pas en ajouter tant qu'aucun outil
de mesure n'est ajouté. Ressources tierces déclarées dans la politique de
confidentialité : Google Fonts, GSAP/Lenis (jsDelivr), Cloudflare
(hébergement). Le formulaire ne passe par aucun service tiers : voir la
section « Le formulaire de devis » ci-dessus.

**Date** : la ligne « Dernière mise à jour » en haut de chaque page légale
est à changer à la main à chaque modification de son contenu.

---

## Signature IPPYX (bloc commun à tous les sites de l'agence)

Tout en bas du pied de page, centrée, sur sa propre ligne après le
copyright : « Mentions légales · Confidentialité · Site réalisé par IPPYX ».
La signature elle-même est **rigoureusement identique sur tous les sites
clients** ; les deux liens légaux qui la précèdent restent blancs (jamais
néon, réservé à la signature). Source unique : **`src/partials/signature.html`**,
injecté dans chaque page par `build.mjs` à l'emplacement `{{SIGNATURE}}`.

Couleurs de marque IPPYX : au repos **blanc, opacité 0,75** ; au survol
**néon `#D8FF3E`, opacité 1** ; transition 0,3 s ; le logo suit la couleur du
texte (`currentColor`). Ces couleurs **ne varient pas** d'un site à l'autre.

---

## 6) Faire évoluer le site plus tard (sans repartir de zéro)

- **Ajouter une réalisation** : dans `src/index.html`, section
  `#realisations`, dupliquez un bloc `<figure class="rea-item">…</figure>`
  et changez photo, titre, lieu, année.
- **Ajouter une prestation** : section `#savoirfaire`, dupliquez une
  `<div class="sv-card">…</div>` dans une des colonnes.
- **Ajouter une page** (au-delà du one-page) : dupliquez
  `src/mentions-legales.html` (il contient déjà en-tête, pied de page,
  signature et liens légaux), renommez-le, ajoutez son nom dans
  `PAGE_NAMES` (`build.mjs`) pour le fil d'Ariane. Elle entre d'elle-même
  dans `sitemap.xml`.
- **Charte graphique** : couleur d'accent `--acc` dans
  `src/assets/css/style.css`, polices via le lien Google Fonts en haut de
  chaque page (League Spartan + IBM Plex Mono).
- **Mettre à jour wrangler** : un seul numéro, `WRANGLER_VERSION` dans
  `.github/workflows/deploy.yml`.
