# K-ProBat — Spécifications techniques exactes de la maquette
Document de référence pour comparer l'implémentation production à la maquette `K-ProBat - Maquette.html`. Toutes les valeurs sont extraites du code source de la maquette.

---

## 1. TYPOGRAPHIE

### Polices
- **League Spartan**, variable 300→900 — Google Fonts. Poids réellement utilisés : 900 (grands titres), 800 (sous-titres, logo, menu, chiffres stats), 700 (boutons, légendes photos), 500 (champs formulaire), 400 (paragraphes).
- **IBM Plex Mono** 400 et 500 — Google Fonts. Usage : surtitres de section, labels, nav, mentions, footer, marquee.
- Chargement exact :
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=League+Spartan:wght@300..900&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
```

### Titre principal « K-PROBAT. » (hero)
- `font-size: clamp(44px, 13.5vw, 205px)` ; weight 900 ; uppercase ; `letter-spacing: -.02em` ; `line-height: .9` ; couleur #EAE3D4.
- Valeurs concrètes : 1920 px → **205 px** (plafond) ; 1440 px → 194 px ; 1280 px → 173 px ; 768 px → 104 px ; 390 px (mobile) → **52,7 px** ; plancher 44 px sous ~326 px.
- Structure : chaque caractère est un `<span data-ltr style="display:inline-block">` (9 spans : K, -, P, R, O, B, A, T, .) dans un wrapper `white-space:nowrap`, lui-même dans un span `display:block; overflow:hidden; padding-top:.08em` (masque pour l'animation lettre par lettre).
- Couleurs par lettre : « - » et « . » en accent `var(--acc, #D93916)` ; K, P, R, O pleines #EAE3D4.

### Effet contour sur B, A, T
- Technique exacte : `-webkit-text-stroke: 2.5px #EAE3D4; color: transparent;`
- Rendu attendu : lettres creuses, contour 2,5 px crème, fond de la mosaïque visible au travers.
- Support : Chrome, Safari, Edge, Firefox ≥ 49 (tous les navigateurs actuels). **Danger si non supporté** : `color:transparent` rend les lettres invisibles. Fallback à prévoir en prod :
```css
@supports not (-webkit-text-stroke: 1px #fff) {
  .ltr-outline { color: #EAE3D4; }
}
```

### Autres échelles typographiques
- h2 de section : 900, `clamp(30px,5vw,68px)`, `line-height:.95`, uppercase, `letter-spacing:-.015em`.
- Surtitre de section (« 01 / SAVOIR-FAIRE »…) : IBM Plex Mono 11 px, `letter-spacing:.3em`, couleur accent #D93916.
- Téléphone géant (contact) : 900, `clamp(38px,8.5vw,130px)`, `letter-spacing:-.02em`.
- Citation artisan : 800, `clamp(26px,3.4vw,46px)`, `line-height:1.1`, uppercase.
- Chiffres stats (1991, 35 ANS, 01) : 900, `clamp(38px,4.5vw,64px)`.
- Corps : 15–17 px (`clamp(15px,1.4vw,17px)`), `line-height:1.6–1.7`.
- Paragraphe hero : 400, `clamp(15px,1.6vw,19px)`, `line-height:1.55`, `max-width:520px`, couleur rgba(234,227,212,.9).

---

## 2. ANIMATIONS

### Librairies (versions exactes, CDN jsdelivr)
- **GSAP 3.12.5** + plugin **ScrollTrigger 3.12.5**
- **Lenis 1.1.18** (smooth scroll)
- Une seule animation CSS pure : le marquee (`@keyframes kmarq { from{translateX(0)} to{translateX(-50%)} }`).

### Séquence au chargement
**A. Loader** (overlay fixed plein écran, z-index 100) :
- Fond : 6 panneaux verticaux `flex:1` #221E19, séparés par `border-right:1px solid rgba(234,227,212,.05)`.
- Contenu centré : « K-PROBAT » (800, `clamp(26px,5vw,60px)`, #EAE3D4) ; barre de progression `min(320px,60vw)` × 2 px (piste rgba(234,227,212,.15), remplissage #D93916) ; compteur « COULAGE 000 » (Mono 11 px, `.3em`, #D93916).
- Timeline GSAP :
  1. Texte loader : opacity 0→1, y 20→0, **0.5 s**, `power2.out`.
  2. En parallèle (`'<'`) : compteur 0→100 en **1.5 s**, `power2.inOut` — texte « COULAGE NNN » (3 chiffres, padStart) + largeur barre en %.
  3. Texte loader sort : opacity→0, y→−20, **0.35 s**, `power2.in`.
  4. Panneaux : `yPercent:-101`, **0.8 s**, `power4.inOut`, **stagger 0.07** (glissent vers le haut, gauche→droite), chevauchement `-=.1`.
  5. `display:none` sur le loader, puis timeline hero ajoutée à `-=.55`.
- Durée totale avant hero : ≈ 2.3 s.

**B. Timeline hero** (defaults `ease: expo.out`) :
  1. Lettres `[data-ltr]` : `yPercent 115→0, rotate 4°→0`, **1.1 s**, **stagger 0.045** (masquées par l'overflow:hidden du parent).
  2. Cases mosaïque `[data-mos]` : `clip-path inset(100% 0 0 0) → inset(0% 0 0 0)`, **0.9 s**, **stagger 0.09**, `power4.out`, offset `-=.8`.
  3. Éléments `[data-fade]` (topbar, badge, paragraphe, boutons) : `y 24→0, opacity 0→1`, **0.8 s**, **stagger 0.07**, offset `-=.7`.
  4. Bandeau marquee `[data-marq]` : `yPercent 100→0`, **0.7 s**, offset `-=.7`.

**C. Marquee** : contenu dupliqué 2×, `animation: kmarq 26s linear infinite`.

### Animations au scroll (toutes ScrollTrigger)
- **Apparition sections** `[data-reveal]` : `y 44→0, opacity 0→1`, **0.9 s**, `power3.out`, déclencheur `start: 'top 88%'`, joue une fois (toggleActions par défaut), un trigger par élément.
- **Parallax photos réalisations** `[data-par]` : l'image fait `height:118%` de son cadre (`overflow:hidden`), animée `yPercent -9 → +9`, `ease:none`, **scrub:true**, trigger = le cadre parent, `start:'top bottom'`, `end:'bottom top'`.
- **Colonnes savoir-faire** : le conteneur porte `transform: rotate(-3deg) scale(1.12)` (statique). Chaque colonne `[data-svcol]` bouge `y: ±80px → ∓80px` (colonnes impaires montent, paires descendent), `ease:none`, **scrub:true**, sur la traversée du viewport.
- **Compteurs** `[data-count]` (1991, 35) : `start:'top 85%'`, `once:true`, 0→valeur en **1.6 s**, `power2.out`, arrondi entier.
- **Fil à plomb** (droite de l'écran) : ligne fixe 1 px rgba(34,30,25,.14) à `right:31px` ; carré 9×9 px #D93916 dont `top` va de 60 px à `innerHeight−80px` selon la progression globale du scroll (`start:0, end:'max'`).
- **Hover mosaïque hero** (listeners JS, desktop) : entrée → `filter: grayscale(0) brightness(.85) saturate(1.15)` + `scale(1.05)` ; sortie → `filter: grayscale(var(--gs,.5)) brightness(var(--dim,.5))` + `scale(1)`. Transitions : `filter .5s`, `transform .7s cubic-bezier(.19,1,.22,1)`.
- **Hover photos réalisations** : `filter: grayscale(.25) contrast(1.04)` → `grayscale(0) contrast(1.06)`, transition `.5s`.

### Smooth scroll
- **Lenis 1.1.18**, config : `{ lerp: 0.1, smoothWheel: true }`.
- Intégration GSAP : `lenis.on('scroll', ScrollTrigger.update)` ; `gsap.ticker.add(t => lenis.raf(t*1000))` ; `gsap.ticker.lagSmoothing(0)`.
- Navigation ancre : `lenis.scrollTo(cible, { offset: 0, duration: 1.4 })` ; fallback `window.scrollTo({ behavior:'smooth' })`. Si le menu est ouvert : fermeture d'abord, scroll après **350 ms**.
- Sur tactile, Lenis laisse le scroll natif (comportement normal de la lib).

---

## 3. BOUTONS ET ALIGNEMENTS

### Style commun
League Spartan **700, 14 px**, `letter-spacing:.04em`, **padding 18px 30px**, **angles droits** (aucun border-radius), hauteur résultante ≈ 50 px (cible tactile ok).

### Détail par bouton
| Bouton | Repos | Hover | Transition |
|---|---|---|---|
| Demander un devis (hero) | fond `var(--acc)` #D93916, texte #EAE3D4 | fond #EAE3D4, texte #221E19 | all .3s |
| Voir les chantiers (hero) | transparent, texte #EAE3D4, contour `box-shadow: inset 0 0 0 1.5px #EAE3D4` (pas de border → aucun décalage layout) | fond #EAE3D4, texte #221E19 | all .3s |
| Envoyer sur WhatsApp (formulaire) | fond #25D366, texte #fff, border none | fond #1DA851 | background .3s |
| Envoyer par e-mail (formulaire) | fond #221E19, texte #EAE3D4 | fond #D93916 | background .3s |

### Alignements et espacements
- Hero : les 2 boutons dans `display:flex; flex-wrap:wrap; align-items:center; gap:14px` ; ce bloc sous le paragraphe avec `gap:22px` (colonne alignée à gauche, `align-items:flex-start`).
- Formulaire : les 2 boutons + mention « RÉPONSE SOUS 24 H — MONTAGNAT & 30 KM » (Mono 12 px, `.12em`, rgba(34,30,25,.6)) dans `flex; flex-wrap:wrap; gap:14px; align-items:center`.
- Responsive : aucun changement de padding ; le `flex-wrap:wrap` fait passer les boutons à la ligne (gap 14 px vertical aussi). Jamais de largeur 100 %.

### Boutons système
- **Burger** : `position:fixed; top:0; right:0`, **64×64 px**, fond `var(--acc)`, z-index 90, hover fond #1a1713. Deux barres 24×2 px #EAE3D4, `gap:7px`. Ouvert : `translateY(±4.5px) rotate(±45deg)` (croix), transition `transform .35s cubic-bezier(.76,0,.24,1)`. Présent desktop **et** mobile (la topbar réserve `right:64px`).
- **WhatsApp flottant** : `fixed; bottom:80px; right:22px`, **56×56 px**, rond (`border-radius:50%` — seul élément arrondi du site), fond #25D366 hover #1DA851, icône SVG 28 px blanche, `box-shadow: 0 8px 24px rgba(34,30,25,.3)`, z-index 70.

### Champs de formulaire
Fond transparent, `border:none`, **seulement** `border-bottom:1px solid rgba(34,30,25,.35)`, `border-radius:0`, `padding:11px 0`, League Spartan 500 17 px #221E19. Focus → `border-bottom:1px solid #D93916` (pas d'outline). Placeholder rgba(34,30,25,.4). Labels : Mono 10 px `.2em` rgba(34,30,25,.55). Grille : `grid-template-columns: repeat(auto-fit, minmax(230px,1fr)); gap:26px 34px; max-width:880px`.

---

## 4. RESPONSIVE MOBILE VS DESKTOP

### Breakpoint
- **860 px**, géré **en JavaScript** (`window.innerWidth < 860`, réécouté au resize) — il n'y a **aucune media query CSS**. Les tailles se réduisent continûment via `clamp()`/vw ; seules les bascules structurelles passent par le JS.
- En prod avec media queries : `@media (max-width: 859px)` équivaut au mode mobile.

### Ce qui change à < 860 px
- **Topbar hero** : la nav centrale (liens Mono 11 px `.18em`, `gap:30px`, hover rouge) passe en `display:none`. Restent : logo « K-PROBAT » (800, 15 px) à gauche, téléphone à droite, burger. Le burger est le seul accès nav.
- **Hero** : mosaïque 4 col × 3 rangées inchangée en structure ; **photos affichées en couleur et lumineuses dès le chargement** : `--gs` forcé à **0** et `--dim` à **0.96** (desktop : `--gs:.5`, `--dim:.5`). Pas d'effet hover. H1 ≈ 53 px à 390 px.
- **Savoir-faire** : 8 cartes réparties en **4 colonnes desktop (2 cartes/colonne) → 2 colonnes mobile (4 cartes/colonne)**. L'inclinaison `rotate(-3deg) scale(1.12)` et le mouvement scrub restent.
- **Réalisations** : grille 12 colonnes ; desktop = placements asymétriques (`1/span 7`, `8/span 5`, `1/span 4`, `5/span 8`, `3/span 8`, `1/span 6`, `7/span 6`, `4/span 6`) avec décalages `margin-top` jusqu'à `clamp(40px,6vw,110px)` ; mobile = **chaque figure `grid-column: 1/-1`** (pleine largeur, empilées) et tous les `margin-top` à 0.
- **L'artisan** : flex wrap — colonne texte `flex:1 1 460px; min-width:300px`, grille stats `flex:1 1 300px; min-width:260px` → passage naturel en 1 colonne sous ~800 px. Stats : 2 colonnes, 3e carte `grid-column:1/-1`.
- **Contact** : formulaire `auto-fit minmax(230px,1fr)` → 3 colonnes desktop, 1 colonne mobile. Téléphone géant réduit par clamp.
- Paddings de section : verticaux `clamp(70px,10vw,140–160px)`, horizontaux `clamp(18px,4vw,48px)`.

### Menu overlay (burger)
- Panneau `fixed inset:0`, z-index 80 (sous le burger z-90), fond #221E19, `padding: clamp(20px,4vw,48px)`.
- **Ouverture** : `clip-path: inset(0 0 100% 0) → inset(0 0 0% 0)` — rideau qui descend — `transition .7s cubic-bezier(.76,0,.24,1)`. `pointer-events: none→auto`. Lenis `stop()` (page verrouillée) ; `start()` à la fermeture.
- **Items** (5 : Accueil, Savoir-faire, Réalisations, L'artisan, Contact) : numéro « 01 »–« 05 » Mono 12 px rouge + label 800 `clamp(34px,7.5vh,76px)` uppercase, chacun dans un masque `overflow:hidden`. Entrée : `translateY(110%)→0` + opacity 0→1, transition `.8s cubic-bezier(.19,1,.22,1)`, **délais échelonnés 0.15s + i×0.06s**. Hover : label rouge.
- **Fermeture** : mêmes transitions, délais à 0, le clip-path remonte. Clic sur un item : fermeture + scroll vers la section après 350 ms.
- Pied d'overlay : tél (rouge), WhatsApp, e-mail, adresse — Mono 12 px `.12em`.

---

## 5. POINTS DE VIGILANCE

1. **`-webkit-text-stroke` + `color:transparent`** (B, A, T) : supporté par tous les navigateurs actuels, mais si absent les lettres disparaissent. Ajouter le fallback `@supports` (§1).
2. **Dépendance CDN critique** : GSAP, ScrollTrigger et Lenis viennent de jsdelivr. Le code attend leur chargement en boucle (retry 40 ms) et **le loader reste affiché indéfiniment** si un script ne charge pas → écran sombre « K-PROBAT » figé, site apparemment cassé. En prod : servir les libs en local, et prévoir un timeout (~4 s) qui masque le loader et affiche les états finaux sans animation.
3. **États initiaux** : les éléments `[data-reveal]`/`[data-fade]`/`[data-ltr]` sont visibles dans le HTML (les états cachés sont posés par GSAP `fromTo`). Ne pas mettre `opacity:0` en CSS — sinon, sans JS, page blanche. Seul le loader recouvre la page sans JS.
4. **`::-webkit-scrollbar`** (piste #EAE3D4, pouce #c9c0ad, hover #D93916, 10 px) : Chrome/Edge/Safari seulement ; Firefox garde sa scrollbar (cosmétique, acceptable).
5. **`aspect-ratio`** (3/4, 16/10, 4/5, 16/9, 21/9, 3/2) : Safari ≥ 15. En dessous, les cadres photos s'effondrent — fallback `padding-top` si un support ancien est requis.
6. **`clip-path: inset()`** (menu + reveal mosaïque) : OK partout aujourd'hui (Safari ≥ 14).
7. **Hover sur tactile** : inexistant — c'est pourquoi le mobile force les photos en couleur (`--gs:0`, `--dim:.96`). Reproduire via le breakpoint ou `@media (hover:none)`.
8. **Images** : dans la maquette elles sont injectées par JS (dictionnaire base64 `window.KPB_IMGS` + attributs `data-ki`) — mécanisme propre à la maquette, **ne pas le reproduire** ; en prod, des `<img src>` normaux (WebP optimisés) avec les mêmes `object-fit:cover` et filtres.
9. **Fonts** : `display=swap` déjà actif ; le 900 très large peut provoquer un léger saut au chargement → `<link rel="preload">` des deux familles conseillé.
10. **Divers** : `overflow-x:clip` sur le wrapper racine (les colonnes inclinées débordent) ; `::selection` fond #D93916 texte #EAE3D4 ; fond page #EAE3D4, encre #221E19, fond sombre #1A1713/#221E19, accent `--acc:#D93916`.
