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

| Canal | Durable ? | État | Ce qu'il faut faire |
|---|---|---|---|
| **Enregistrement (KV)** | oui | **actif** | rien — voir A : où lire les demandes |
| **E-mail à l'artisan** | oui | **actif** | rien — arrive dans `k.probat01@gmail.com`, expéditeur « K-ProBat » |
| **Journal du Worker** | **non** | actif | dépannage seulement : il ne se lit qu'en direct et s'efface. Cloudflare -> Workers -> `k-probat-site` -> *Logs* |

**La règle du site :** le visiteur ne voit « votre demande est bien reçue » que
si au moins un canal **durable** a réussi. Le journal ne compte pas : on ne
rassure jamais quelqu'un sur une trace qui va disparaître.

### A. Lire les demandes de devis — POUR L'AGENCE UNIQUEMENT

⚠️ **Ne pas transmettre cette procédure au client.** Un artisan n'a pas à ouvrir
un tableau de bord technique pour lire ses propres demandes : ce serait lui
refiler notre plomberie. Il les reçoit **par e-mail** (section B, désormais
active) et n'a rien d'autre à connaître.

Le KV reste l'**archive** de l'agence : il garde tout, même si un e-mail se
perd ou part en indésirables.

**Procédure, pas à pas :**

1. Aller sur **dash.cloudflare.com** et se connecter.
2. En haut à gauche, vérifier que le compte affiché est bien **K-ProBat**.
3. Dans le menu de gauche : **Stockage et bases de données** → **Travailleurs KV**.
4. Cliquer sur **kprobat-leads**.
5. Onglet **Paires KV** (à côté de « Mesures »).

Chaque ligne est **une demande**. La colonne de gauche (la « clé ») commence par
`devis:` suivi de la date et de l'heure de réception — les plus récentes sont
donc en bas de la liste par ordre alphabétique.

Cliquer sur une ligne affiche le contenu, sous cette forme :

```
{"nom":"Dupont Jean","tel":"06 12 34 56 78","email":"jean@exemple.fr",
 "travaux":"Dalle & terrasse","message":"Bonjour, je souhaite…",
 "recuLe":"2026-09-04T09:12:44.000Z"}
```

Se lisent ainsi : `nom` le nom, `tel` le téléphone à rappeler, `email`
l'adresse (facultative), `travaux` le type de chantier choisi dans la liste,
`message` le texte libre, `recuLe` la date et l'heure (en heure universelle :
**ajouter 2 h l'été, 1 h l'hiver** pour l'heure française).

**Rappeler sous 24 h**, c'est ce que le site promet au visiteur.

Une fois la demande traitée, la ligne peut être supprimée (bouton à droite) ou
laissée : il n'y a aucune limite de place en pratique.

> Le jour où le domaine définitif sera en place, les demandes arriveront **aussi
> par e-mail** (section B). Ce tableau restera l'archive.

**Côté technique.** L'espace KV `kprobat-leads` est relié au Worker sous le nom
`LEADS` (bloc `kv_namespaces` de `wrangler.jsonc`).

**Le visiteur n'est jamais trompé :** si l'enregistrement échoue *et* que
l'e-mail n'est pas actif, le site n'affiche PAS « demande bien reçue ». Il
affiche un message d'erreur avec le téléphone, garde les réponses saisies et
laisse le bouton WhatsApp à portée de clic (`worker/index.js`). Une confirmation
à l'écran signifie donc toujours qu'une trace existe réellement.

### B. Envoyer les demandes par e-mail à l'artisan — FAIT

Chaque demande part dans la boîte **k.probat01@gmail.com**, avec l'adresse du
visiteur en `Reply-To` : l'artisan répond directement depuis son téléphone.

Ce qui est en place :

- Email Routing actif sur la zone **k-probat.fr** (MX, SPF, DKIM, DMARC).
- Adresse de destination `k.probat01@gmail.com` **vérifiée** dans le compte.
- Binding `send_email` et variable `MAIL_FROM` (`site@k-probat.fr`) dans
  `wrangler.jsonc`.

⚠️ **L'ancien SPF hérité d'Infomaniak (`v=spf1 -all`) a été supprimé** : il
interdisait tout envoi depuis le domaine. Il ne doit y avoir **qu'un seul**
enregistrement SPF, celui de Cloudflare. Si un jour les e-mails cessent
d'arriver, c'est la première chose à revérifier.

`MAIL_FROM` est l'expéditeur affiché, **pas une boîte à relever** : personne ne
lit `site@k-probat.fr`, les réponses partent vers le visiteur.

### B bis. Vérifier que la chaîne fonctionne (contrôle de bout en bout)

Onglet **Actions** du dépôt → **« Vérifier le formulaire (demande de test) »** →
*Run workflow*.

Le contrôle envoie une vraie demande marquée `TEST IPPYX`, puis prouve son
arrivée : réponse du site, ligne du journal du Worker indiquant si l'e-mail est
parti, et relecture de l'entrée réellement écrite dans le KV. Il échoue si l'un
des maillons est rompu.

Ce contrôle **n'est pas automatique** : on ne veut pas d'une fausse demande à
chaque déploiement.

Pour retirer les demandes de test du KV : onglet **Actions** →
**« Nettoyer les demandes de test »** → *Run workflow*. Il relit chaque entrée
avant de la supprimer et n'efface que celles dont le nom commence par
`TEST IPPYX` — une vraie demande de client ne peut pas partir par erreur.

**Chaîne vérifiée de bout en bout le 6 septembre 2026** : réponse du site
`200`, journal du Worker `notification artisan : envoyé`, entrée relue dans le
KV, et réception confirmée dans la boîte de l'artisan — en boîte de réception
principale, pas en indésirables.

### C. Accusé de réception au visiteur — limite à connaître

Cloudflare ne peut envoyer d'e-mail qu'à des adresses **vérifiées dans le
compte**. Écrire à un visiteur inconnu impose donc un service d'envoi tiers
(Brevo, Resend...). Aujourd'hui le visiteur a sa confirmation **à l'écran**
(« Merci, votre demande est bien reçue. Nous vous rappelons sous 24 h. »), ce qui
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

## 5) PASSAGE AU DOMAINE DÉFINITIF — FAIT (k-probat.fr)

### État de la production

| Élément | État |
|---|---|
| Adresse officielle | **https://k-probat.fr** (et `www.k-probat.fr`) |
| `kilicyasar.fr` | zone active, **redirection 301** vers `k-probat.fr` |
| `siteUrl` (`site.config.json`) | `https://k-probat.fr` |
| Worker | `k-probat-site`, servi sur les deux noms |
| Enregistrement des demandes | espace KV `kprobat-leads` |
| E-mail des demandes | Email Routing → `k.probat01@gmail.com` |
| Adresse `.workers.dev` | encore active — **à couper**, voir ci-dessous |

`siteUrl` est la source unique : canonical, Open Graph, JSON-LD, sitemap,
robots.txt et llms.txt en découlent. Le build échoue si une adresse traîne en
dur ou si une adresse `.workers.dev` subsiste dans le résultat.

**Couper l'adresse `.workers.dev`** — Cloudflare → *Workers* → `k-probat-site`
→ *Paramètres* → *Domaines et routes* → désactiver le sous-domaine
`workers.dev`. Le site continue de répondre sur `k-probat.fr` : c'est une
adresse en plus, pas l'hébergement. À faire maintenant que la chaîne est
vérifiée : deux adresses servant le même contenu diluent le référencement, et
celle-ci n'a plus d'utilité.

Ne jamais déclarer une autre adresse que `https://k-probat.fr` à Google.

La procédure ci-dessous est conservée pour un futur site de l'agence.

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

## L'administration du site : /admin

**https://k-probat.fr/admin** — le client change ses photos et ses textes
lui-même, sans développeur et sans toucher à GitHub.

### Ce qu'on peut y faire

| Onglet | Ce qui se modifie |
|---|---|
| **Bandeau d'accueil** | les 6 photos de la mosaïque du haut + l'image de partage |
| **Accueil** | les 8 métiers (photo, titre, sous-titre) + la section béton cellulaire |
| **Réalisations** | les 8 chantiers (photo, titre, lieu et année) |
| **Page Siporex** | les 3 photos et leurs légendes |
| **Pages villes** | les 12 communes (intro, bâti local, chantier, question/réponse) |

On y ajoute aussi des photos depuis un téléphone ou un ordinateur : elles sont
**redimensionnées et compressées dans le navigateur** avant l'envoi, donc une
photo de 8 Mo devient une photo de 250 Ko sans intervention.

### Comment ça marche

`/admin` n'écrit PAS dans le site en direct. Elle écrit dans le dépôt GitHub
(`src/contenu.json`, `src/villes.json`, `src/assets/img/`), et le déploiement
habituel reconstruit le site — avec **tous ses contrôles**. Une modification
faite depuis `/admin` est donc aussi sûre qu'une modification faite par un
développeur, et elle s'annule comme n'importe quel commit.

### L'aperçu est direct

Chaque élément modifiable du site porte un attribut `data-champ` dont la valeur
est le chemin exact dans `contenu.json` (`savoirFaire.2.t`, `bandeau.0.img`…).
L'aperçu est une iframe de la même origine : l'interface y retrouve l'élément
par ce chemin et le met à jour **à la frappe**. Pas d'attente.

Ces attributs sont posés par `tools/transpose-maquette.mjs` et `build.mjs`. Un
attribut `data-*` n'a aucun effet visuel et n'est pas lu par les moteurs :
vérifié en comparant le site généré avec et sans — **identique octet pour
octet** une fois les `data-champ` retirés.

### ⚠️ La chaîne complète : contenu.json → site en ligne

`/admin` écrit dans `src/contenu.json`, et **rien d'autre**. Entre ce fichier
et la page vue par le visiteur, il y a **deux** moulinettes, dans cet ordre :

```
src/contenu.json
   ↓  node tools/transpose-maquette.mjs     ← régénère src/index.html
src/index.html  (fichier GÉNÉRÉ, jamais à modifier à la main)
   ↓  node build.mjs                        ← src/ → site/
site/  → déployé sur Cloudflare
```

**Oublier la première étape casse tout `/admin` en silence** : le commit part,
le déploiement passe au vert, et le site ne bouge pas. C'est exactement la
panne qu'on a eue — le déploiement ne lançait que `build.mjs`.

Deux garde-fous sont en place depuis :

1. Le déploiement lance `tools/transpose-maquette.mjs` **avant** `build.mjs`.
2. Après la mise en ligne, `tools/verifier-contenu-en-ligne.mjs` télécharge les
   pages réellement servies et compare **chaque valeur** à `contenu.json`.
   Le moindre écart fait échouer le déploiement en rouge.

Ce second contrôle vérifie aussi la couverture : un champ modifiable servi par
le site mais inconnu du contrôle est un échec. On ne peut donc pas ajouter un
champ éditable en oubliant de le faire vérifier.

Pour l'essayer sans réseau, après `node tools/transpose-maquette.mjs && node build.mjs` :

```
node tools/verifier-contenu-en-ligne.mjs --local site
```

Le libellé au-dessus de l'aperçu dit toujours ce qu'on regarde :
« Aperçu de vos modifications (non publiées) » ou « Version en ligne ».
Le bouton *Revoir la version en ligne* recharge la page publiée pour comparer.

Le site en ligne, lui, met une à deux minutes à se reconstruire après
publication — mais on n'a plus besoin d'attendre pour voir.

### Les deux réglages à faire une fois, dans Cloudflare

Cloudflare → *Workers* → `k-probat-site` → *Paramètres* → *Variables et secrets*.
**Deux Secrets, et rien d'autre :**

| Nom | Type | Valeur |
|---|---|---|
| `ADMIN_MOT_DE_PASSE` | **Secret** | le mot de passe de la page /admin |
| `GITHUB_TOKEN` | **Secret** | jeton GitHub (voir ci-dessous) |

La troisième valeur, `GITHUB_DEPOT` = `Ergun8301/K-PROBAT`, n'est **pas** à
créer dans le tableau de bord : elle est déclarée dans `wrangler.jsonc`
(`"vars"`). Voir l'avertissement ci-dessous — c'est important.

**Créer le jeton GitHub** : github.com → photo de profil → *Settings* →
*Developer settings* → *Personal access tokens* → **Fine-grained tokens** →
*Generate new token*.
- *Repository access* : **Only select repositories** → `K-PROBAT`
- *Permissions* → *Repository permissions* → **Contents : Read and write**
- Rien d'autre. Ce jeton ne peut donc RIEN faire en dehors de ce dépôt.

Tant que ces valeurs manquent, `/admin` l'annonce clairement au lieu
d'échouer en silence.

### ⚠️ Ne JAMAIS créer une variable Texte à la main dans Cloudflare

**Toute variable de type « Texte » créée à la main dans le tableau de bord
Cloudflare sera effacée au déploiement suivant.**

Pourquoi : chaque déploiement passe par `wrangler deploy`, qui **réécrit
intégralement** la liste des variables Texte du Worker à partir du bloc
`"vars"` de `wrangler.jsonc`. Ce qui n'y figure pas disparaît.

Les **Secrets** ne sont pas concernés : `wrangler` n'y touche pas.

La règle, donc :

| Type de valeur | Où elle vit | Exemple |
|---|---|---|
| non sensible | `"vars"` dans `wrangler.jsonc` | `MAIL_FROM`, `GITHUB_DEPOT` |
| sensible | **Secret** Cloudflare, jamais dans le dépôt | `ADMIN_MOT_DE_PASSE`, `GITHUB_TOKEN` |

C'est exactement ce qui s'est passé une fois : `GITHUB_DEPOT` avait été créé
à la main en variable Texte, le déploiement suivant l'a effacé, et `/admin`
répondait « L'administration n'est pas encore configurée dans Cloudflare ».

Le déploiement contrôle maintenant ce point tout seul : après chaque mise en
ligne, il envoie un mauvais mot de passe sur `/api/admin/connexion` et exige
la réponse « Mot de passe incorrect » (401). Si une variable manquait, la
réponse serait une erreur de configuration (503) et le déploiement
échouerait en rouge.

### Sécurité

- La page est en `noindex` : elle n'apparaîtra jamais dans Google.
- Sans mot de passe, aucun point d'entrée ne répond.
- La session dure 8 heures, dans un cookie signé (`HttpOnly`, `Secure`).
- Le mot de passe est comparé à durée constante : le temps de réponse ne
  trahit pas combien de caractères sont corrects.
- Le serveur **revérifie tout** avant d'écrire : 8 métiers, 8 réalisations,
  aucun champ vide, et les mots interdits (« certifié », « agréé »,
  « labellisé », « officiel ») sont refusés là aussi.

### Donner l'accès au client

Il suffit de lui donner l'adresse et le mot de passe. Pour le lui retirer :
changer `ADMIN_MOT_DE_PASSE` dans Cloudflare.

⚠️ Le client peut modifier les phrases partenaires validées. Elles sont
signalées comme telles dans l'interface, mais rien ne l'empêche techniquement
de les réécrire : c'est un choix, il est chez lui.

### Réutiliser sur un autre site de l'agence

`worker/admin.js` et `src/admin.html` sont génériques. Pour un nouveau client :
copier ces deux fichiers, créer un `src/contenu.json` avec les champs de SON
site, adapter les quatre fonctions de vue de `admin.html`, poser les trois
réglages Cloudflare. Compter une heure, pas une journée.

## Prévisualisation d'une PR, avant de mettre en ligne

Chaque *pull request* publie automatiquement une **prévisualisation** :
`.github/workflows/preview.yml` construit le site de la branche et l'envoie à
Cloudflare comme *Version* (`wrangler versions upload`), **jamais** comme
*Deploy*. Concrètement :

- k-probat.fr **n'est pas concerné**, jamais — aucun trafic n'est routé vers
  cette version tant que personne ne fait `wrangler versions deploy`.
- L'adresse de prévisualisation (`…workers.dev`) est déposée en commentaire
  sur la PR, mise à jour à chaque nouveau commit.
- Rien à régler dans le tableau de bord Cloudflare : cette étape utilise les
  deux mêmes secrets que le vrai déploiement.

⚠️ La prévisualisation partage le même espace KV et la même adresse
d'envoi que le site en ligne. Le formulaire de devis n'y est donc **pas**
testé automatiquement (ce serait une vraie demande) — seul le contenu
affiché (textes, photos) est vérifié, avec le même contrôle que le site en
ligne (`tools/verifier-contenu-en-ligne.mjs`).

## Page béton cellulaire (page pilier) — règles strictes

Adresse : `/maconnerie-beton-cellulaire-siporex-ytong`.
Source : `src/maconnerie-beton-cellulaire-siporex-ytong.html`.

**Une seule page pour les trois mots.** « Béton cellulaire » est le nom du
matériau ; « Siporex » et « Ytong » sont deux marques du groupe Xella. Trois
pages séparées seraient du contenu dupliqué et se pénaliseraient entre elles :
tout tient sur cette page, et c'est justement pour ça qu'elle se positionne sur
les trois recherches.

⚠️ **Siporex n'a PAS été renommé Ytong.** Les deux marques appartiennent au même
groupe et existent toujours en parallèle, sur des circuits de distribution
différents. Ne jamais écrire le contraire.

### Vocabulaire verrouillé

| Interdit | À écrire |
|---|---|
| certifié, agréé, labellisé, officiel | **partenaire** |

Aucun de ces organismes — Habitat Libre, Maisons Axial, Siporex, Ytong, Xella —
ne délivre de certification à l'entreprise. Écrire le contraire serait faux et
juridiquement risqué.

**Pas de logo** Habitat Libre, Maisons Axial, Siporex, Ytong ni Xella.

### Les trois phrases validées par le client — à reprendre au mot près

- « Maçon partenaire d'Habitat Libre et de Maisons Axial, constructeurs de maisons individuelles dans l'Ain. »
- « Nous réalisons le gros œuvre en béton cellulaire des maisons Habitat Libre depuis plus de 15 ans. »
- « Plus de 100 maisons en béton cellulaire réalisées dans l'Ain. »

**N'inventer aucun autre chiffre, aucune autre durée, aucun autre nom
d'entreprise.** Pas même une reformulation « équivalente » : ces phrases
engagent le client.

### La section de l'accueil

Elle n'est PAS écrite dans `src/index.html` : elle est ajoutée par
`tools/transpose-maquette.mjs` (constante `SECTION_BC`), avec l'entrée de menu
et la renumérotation des sections suivantes. C'est le seul endroit à modifier —
une retouche directe dans `src/index.html` serait effacée à la prochaine
régénération.

### Photos de la page béton cellulaire

Deux emplacements sont marqués `data-photo-a-remplacer` dans la source et
utilisent pour l'instant des photos de chantier existantes.

**Où déposer les nouvelles photos :** `src/assets/img/`, puis remplacer le
`src` (et le `alt`) dans la source de la page.

| Critère | Valeur |
|---|---|
| Format | JPEG (`.jpg`) |
| Largeur | 1600 px environ (1200 px minimum) |
| Poids | 250 Ko maximum par photo — au-delà, la page rame sur mobile |
| Cadrage | horizontal (paysage) |
| Nom de fichier | en minuscules, sans accent ni espace : `beton-cellulaire-<sujet>-<commune>.jpg` |

Penser à mettre `width` et `height` à jour dans la balise `<img>` : ce sont ces
deux valeurs qui empêchent la page de sauter pendant le chargement.

**Le texte `alt` décrit la photo, pas la page** : ce qu'on voit, le matériau et
la commune quand c'est pertinent. Exemple : « Élévation de murs en béton
cellulaire sur un chantier de maison individuelle à Péronnas ».

## Pages par commune (référencement local)

Douze pages, une par commune : `/maconnerie-bourg-en-bresse`, `/maconnerie-montagnat`, etc.
Elles ne sont **pas** dans le menu du site : elles existent pour être trouvées sur
Google (« maçon à … »).

**Où se trouve le contenu :** `src/villes.json`. Une commune = un bloc.
**Le gabarit :** `src/partials/ville.html`. On n'y touche que pour changer la mise en page.

Ajouter une commune : ajoutez un bloc dans `src/villes.json`, puis `node build.mjs`.
La page, le sitemap, le `llms.txt` et le bloc « zone d'intervention » du pied de page
se mettent à jour tout seuls.

⚠️ **Règle absolue :** chaque commune doit avoir un texte **réellement différent**
(`intro`, `contexte`, `chantier`, `question`, `reponse`). Des pages quasi identiques où
seul le nom de la ville change sont traitées par Google comme des « pages satellites »
(*doorway pages*) et peuvent faire chuter tout le site. Ne jamais copier-coller un
paragraphe d'une commune à l'autre.

ℹ️ Le petit bloc gris **ZONE D'INTERVENTION** en bas de l'accueil est volontaire :
sans ce lien, ces pages seraient orphelines et Google les explorerait très mal.

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
