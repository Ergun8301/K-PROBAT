#!/usr/bin/env node
// ============================================================================
//  transpose-maquette.mjs — outil ponctuel, gardé pour la traçabilité.
// ----------------------------------------------------------------------------
//  Transpose le corps de la maquette Claude Design (`K-ProBat - Maquette.html`)
//  en HTML statique, SANS le réécrire : les styles en ligne sont conservés au
//  caractère près. Seuls les éléments propres au moteur de la maquette sont
//  résolus :
//    - <sc-for> / <sc-if>      → boucles déroulées avec les données réelles
//    - {{ liaisons }}          → valeurs de l'état initial (menu fermé, desktop)
//    - sc-camel-on-click="…"   → href d'ancre ou id repris par assets/js/main.js
//    - style-hover / style-focus → vraies règles CSS (fichier hover.css)
//    - data-ki + GIF 1×1 base64 → <img src> vers les photos réelles
//
//  Entrée  : tools/maquette-body.html  (corps extrait de la maquette)
//  Sorties : src/index.html            (page d'accueil complète)
//            src/assets/css/hover.css  (règles :hover / :focus extraites)
//
//  Usage : node tools/transpose-maquette.mjs
// ============================================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IN = join(ROOT, 'tools', 'maquette-body.html');
const OUT_HTML = join(ROOT, 'src', 'index.html');
const OUT_CSS = join(ROOT, 'src', 'assets', 'css', 'hover.css');

// ---- données réelles, reprises telles quelles du composant de la maquette ----
const IMG = 'assets/img/';
const menuItems = [['Accueil', '#hero'], ['Savoir-faire', '#savoirfaire'], ['Réalisations', '#realisations'], ["L'artisan", '#artisan'], ['Contact', '#contact']]
  .map((a, i) => ({ label: a[0], href: a[1], n: '0' + (i + 1), delay: '0s' }));

const sv = [
  { n: '01', t: 'Gros œuvre & fondations', tech: 'FOUILLES — SEMELLES', img: 'fondations-reseaux.jpg' },
  { n: '02', t: 'Coffrage & béton armé', tech: 'FERRAILLAGE — LINTEAUX', img: 'ferraillage-fondations.jpg' },
  { n: '03', t: 'Briques & parpaings', tech: 'POROTHERM — WIENERBERGER', img: 'porotherm-chantier.jpg' },
  { n: '04', t: 'Béton cellulaire — Siporex', tech: 'MURS — CLOISONS', img: 'siporex-1.jpg' },
  { n: '05', t: 'Escaliers béton', tech: 'SUR MESURE', img: 'escalier-coffrage.jpg' },
  { n: '06', t: 'Piscines maçonnées', tech: 'RADIER — PAROIS', img: 'piscine-parpaings.jpg' },
  { n: '07', t: 'Clôtures & piliers', tech: 'MURETS — PORTAILS', img: 'cloture-composite.jpg' },
  { n: '08', t: 'Terrasses, dalles & VS', tech: 'VS — VIDE SANITAIRE', img: 'plancher-isole.jpg' },
].map((x, i) => ({ ...x, k: 's' + i }));

// Desktop : 4 colonnes de 2 cartes (le JS regroupe en 2 colonnes sous 860 px).
const NCOLS = 4, PER = sv.length / NCOLS;
const svColumns = Array.from({ length: NCOLS }, (_, i) => ({
  dir: i % 2 ? 'up' : 'down',
  cards: sv.slice(i * PER, (i + 1) * PER),
}));

const projects = [
  { img: 'briques-elevation.jpg', t: 'Maison individuelle — élévation briques', meta: 'AIN (01) — 2020', col: '1 / span 7', ar: '16/10', mt: '0' },
  { img: 'siporex-2.jpg', t: 'Villa neuve — béton cellulaire', meta: 'AIN (01) — 2022', col: '8 / span 5', ar: '4/5', mt: 'clamp(40px,6vw,110px)' },
  { img: 'escalier-vue-haut.jpg', t: 'Escalier béton brut', meta: 'AIN (01) — 2020', col: '1 / span 4', ar: '4/5', mt: '0' },
  { img: 'plancher-isole.jpg', t: 'Plancher isolé — vide sanitaire', meta: 'AIN (01) — 2022', col: '5 / span 8', ar: '16/9', mt: 'clamp(30px,4vw,80px)' },
  { img: 'dalle-bassin.jpg', t: 'Dalle & bassin — béton brut', meta: 'AIN (01) — 2021', col: '3 / span 8', ar: '21/9', mt: '0' },
  { img: 'siporex-1.jpg', t: 'Murs Siporex — béton cellulaire', meta: 'AIN (01) — 2023', col: '1 / span 6', ar: '16/10', mt: '0' },
  { img: 'mur-soutenement.jpg', t: 'Murs de soutènement — enduit blanc', meta: 'AIN (01) — 2020', col: '7 / span 6', ar: '16/10', mt: 'clamp(30px,4vw,80px)' },
  { img: 'porotherm-chantier.jpg', t: 'Élévation briques & poutres', meta: 'AIN (01) — 2015', col: '4 / span 6', ar: '3/2', mt: '0' },
].map((p, i) => ({ ...p, k: 'p' + i }));

// Photos de la mosaïque d'accueil (valeurs par défaut des réglages de la maquette).
const heroImgs = {
  h0: 'briques-elevation.jpg', h1: 'siporex-2.jpg', h2: 'escalier-spirale.jpg',
  h3: 'dalle-bassin.jpg', h4: 'cloture-grillage.jpg', h5: 'siporex-1.jpg',
};
const imgByKey = { ...heroImgs };
sv.forEach(c => { imgByKey[c.k] = c.img; });
projects.forEach(p => { imgByKey[p.k] = p.img; });

// Gestionnaires de clic de la maquette → ancre ou identifiant repris par le JS.
const anchors = { goSavoir: '#savoirfaire', goRea: '#realisations', goArtisan: "#artisan", goContact: '#contact' };
const ids = { toggleMenu: 'burger', sendWa: 'sendWa', sendMail: 'sendMail' };

// État initial rendu dans le HTML : menu fermé, largeur desktop.
const state = {
  b1: 'none', b2: 'none',
  menuClip: 'inset(0 0 100% 0)', menuPE: 'none',
  menuY: 'translateY(110%)', menuOp: '0',
  navDisp: 'flex',
};

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let html = readFileSync(IN, 'utf8');

// ---- 1. <sc-if value="{{ projectsReady }}"> : toujours vrai → on déballe -----
html = html.replace(/<sc-if value="\{\{ projectsReady \}\}"[^>]*>([\s\S]*?)<\/sc-if>/g, '$1');
html = html.replace(/<sc-if value="\{\{ waFloat \}\}"[^>]*>([\s\S]*?)<\/sc-if>/g, '$1');

// ---- 2. <sc-for> : boucles déroulées ---------------------------------------
// Recherche la boucle nommée en respectant l'imbrication : on avance dans le
// texte en comptant les <sc-for> ouverts jusqu'au </sc-for> correspondant.
function loopBlock(src, listName) {
  const open = new RegExp(`<sc-for list="\\{\\{ ${listName} \\}\\}"[^>]*>`);
  const m = src.match(open);
  if (!m) throw new Error(`boucle introuvable : ${listName}`);
  const startTag = m[0], startIdx = m.index, bodyIdx = startIdx + startTag.length;
  const token = /<sc-for\b[^>]*>|<\/sc-for>/g;
  token.lastIndex = bodyIdx;
  let depth = 1, t;
  while ((t = token.exec(src))) {
    depth += t[0] === '</sc-for>' ? -1 : 1;
    if (depth === 0) {
      return { full: src.slice(startIdx, t.index + t[0].length), inner: src.slice(bodyIdx, t.index) };
    }
  }
  throw new Error(`boucle non fermée : ${listName}`);
}

// menuItems
{
  const { full, inner } = loopBlock(html, 'menuItems');
  const out = menuItems.map(mi => inner
    .replace(/sc-camel-on-click="\{\{ mi\.go \}\}"/g, `href="${mi.href}" data-go="${mi.href}"`)
    .replace(/\{\{ mi\.delay \}\}/g, mi.delay)
    .replace(/\{\{ mi\.n \}\}/g, mi.n)
    .replace(/\{\{ mi\.label \}\}/g, esc(mi.label))
    .replace(/\{\{ menuY \}\}/g, state.menuY)
    .replace(/\{\{ menuOp \}\}/g, state.menuOp)
  ).join('');
  html = html.replace(full, out);
}

// svColumns (boucle imbriquée : colonnes puis cartes)
{
  const { full, inner } = loopBlock(html, 'svColumns');
  const card = loopBlock(inner, 'col.cards');
  const out = svColumns.map(col => {
    const cards = col.cards.map(c => card.inner
      .replace(/<img([^>]*?)data-ki="\{\{ c\.k \}\}"([^>]*?)src="data:image\/gif;base64,[^"]*"/g,
        `<img$1data-ki="${c.k}"$2src="${IMG}${imgByKey[c.k]}" loading="lazy"`)
      .replace(/\{\{ c\.t \}\}/g, esc(c.t))
      .replace(/\{\{ c\.n \}\}/g, c.n)
      .replace(/\{\{ c\.tech \}\}/g, esc(c.tech))
    ).join('');
    return inner
      .replace(card.full, cards)
      .replace(/\{\{ col\.dir \}\}/g, col.dir);
  }).join('');
  html = html.replace(full, out);
}

// projects
{
  const { full, inner } = loopBlock(html, 'projects');
  const out = projects.map(p => inner
    .replace(/<img([^>]*?)data-ki="\{\{ p\.k \}\}"([^>]*?)src="data:image\/gif;base64,[^"]*"/g,
      `<img$1data-ki="${p.k}"$2src="${IMG}${imgByKey[p.k]}" loading="lazy"`)
    .replace(/\{\{ p\.col \}\}/g, p.col)
    .replace(/\{\{ p\.mt \}\}/g, p.mt)
    .replace(/\{\{ p\.ar \}\}/g, p.ar)
    .replace(/\{\{ p\.t \}\}/g, esc(p.t))
    .replace(/\{\{ p\.meta \}\}/g, esc(p.meta))
  ).join('');
  html = html.replace(full, out);
}

// ---- 3. photos de la mosaïque d'accueil (data-ki="h0"…"h5") -----------------
html = html.replace(/<img([^>]*?)data-ki="(h[0-5])"([^>]*?)src="data:image\/gif;base64,[^"]*"/g,
  (m, a, k, b) => `<img${a}data-ki="${k}"${b}src="${IMG}${imgByKey[k]}"`);

// ---- 4. gestionnaires de clic ----------------------------------------------
for (const [handler, href] of Object.entries(anchors)) {
  html = html.replace(new RegExp(`sc-camel-on-click="\\{\\{ ${handler} \\}\\}"`, 'g'), `href="${href}" data-go="${href}"`);
}
for (const [handler, id] of Object.entries(ids)) {
  html = html.replace(new RegExp(`sc-camel-on-click="\\{\\{ ${handler} \\}\\}"`, 'g'), `id="${id}"`);
}

// ---- 5. état initial --------------------------------------------------------
for (const [k, v] of Object.entries(state)) {
  html = html.replace(new RegExp(`\\{\\{ ${k} \\}\\}`, 'g'), v);
}

// ---- 6. attributs du moteur → attributs HTML standard ----------------------
html = html.replace(/<sc-raw-select /g, '<select ').replace(/<\/sc-raw-select>/g, '</select>');
html = html.replace(/sc-camel-view-box=/g, 'viewBox=');

// ---- 6 ter. marqueurs repris par les règles responsive de style.css --------
// (la maquette pilotait ces bascules en JS ; en production ce sont des règles
//  CSS, qui ont besoin d'un sélecteur stable — voir style.css §3)
html = html.replace('<nav data-fade="" style="display:flex;gap:30px;align-items:center">',
  '<nav data-fade="" data-nav-hero style="display:flex;gap:30px;align-items:center">');
html = html.replace(/<figure data-reveal="" style="grid-column:/g,
  '<figure data-reveal="" data-rea style="grid-column:');
// marqueurs pour le JS : rideau du menu et piste des colonnes savoir-faire
html = html.replace('<div style="position:fixed;inset:0;z-index:80;background:#221E19',
  '<div data-menu style="position:fixed;inset:0;z-index:80;background:#221E19');
html = html.replace('<div style="display:flex;gap:clamp(10px,1.5vw,20px);transform:rotate(-3deg) scale(1.12);align-items:stretch">',
  '<div data-svtrack style="display:flex;gap:clamp(10px,1.5vw,20px);transform:rotate(-3deg) scale(1.12);align-items:stretch">');

// ---- 6 bis. pied de page : SIRET réel + signature IPPYX (jeton du build) ----
html = html.replace('SIRET SUR DEMANDE — ASSURANCE DÉCENNALE', 'SIRET 380 490 680 00028 — ASSURANCE DÉCENNALE');
html = html.replace('</footer>', '  {{SIGNATURE}}\n</footer>');

// ---- 7. style-hover / style-focus → vraies règles CSS ----------------------
// La maquette applique ces styles via son moteur ; en production ce sont des
// règles :hover / :focus classiques, sur un attribut data-hx / data-fx.
const cssRules = [];
let hx = 0, fx = 0;
html = html.replace(/\s+style-hover="([^"]*)"/g, (m, decls) => {
  const id = 'h' + (hx++);
  cssRules.push(`[data-hx="${id}"]:hover{${decls.replace(/&quot;/g, '"')}}`);
  return ` data-hx="${id}"`;
});
html = html.replace(/\s+style-focus="([^"]*)"/g, (m, decls) => {
  const id = 'f' + (fx++);
  cssRules.push(`[data-fx="${id}"]:focus{${decls.replace(/&quot;/g, '"')}}`);
  return ` data-fx="${id}"`;
});

// ---- 8. contrôles ----------------------------------------------------------
// {{SIGNATURE}} est volontaire : c'est le jeton résolu ensuite par build.mjs.
const leftovers = [...new Set([...html.matchAll(/\{\{[^}]+\}\}/g)].map(m => m[0]))].filter(t => t !== '{{SIGNATURE}}');
if (leftovers.length) { console.error('✗ liaisons non résolues :', leftovers.join(', ')); process.exit(1); }
const scTags = [...new Set([...html.matchAll(/<sc-[a-z-]+/g)].map(m => m[0]))];
if (scTags.length) { console.error('✗ balises du moteur restantes :', scTags.join(', ')); process.exit(1); }
if (/data:image\/gif;base64/.test(html)) { console.error('✗ images fictives restantes'); process.exit(1); }

// ---- 9. assemblage de src/index.html (en-tête SEO + corps + scripts) -------
const HEAD = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>K-ProBat — Maçonnerie générale à Montagnat (01) — Devis gratuit</title>
<meta name="description" content="Maçonnerie générale &amp; gros œuvre à Montagnat, dans l'Ain. Fondations, murs, dalles, escaliers, piscines — dans les règles de l'art, depuis 1991.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&amp;family=League+Spartan:wght@300..900&amp;display=swap">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&amp;family=League+Spartan:wght@300..900&amp;display=swap" rel="stylesheet">
<link rel="canonical" href="{{SITE_URL}}/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="K-ProBat">
<meta property="og:locale" content="fr_FR">
<meta property="og:title" content="K-ProBat — Maçonnerie générale à Montagnat (01)">
<meta property="og:description" content="Maçonnerie générale &amp; gros œuvre à Montagnat, dans l'Ain. Fondations, murs, dalles, escaliers, piscines — dans les règles de l'art, depuis 1991.">
<meta property="og:url" content="{{SITE_URL}}/">
<meta property="og:image" content="{{SITE_URL}}/assets/og/k-probat-og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="K-ProBat — Maçonnerie générale à Montagnat, dans l'Ain">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="K-ProBat — Maçonnerie générale à Montagnat (01)">
<meta name="twitter:description" content="Maçonnerie générale &amp; gros œuvre à Montagnat, dans l'Ain. Fondations, murs, dalles, escaliers, piscines — dans les règles de l'art, depuis 1991.">
<meta name="twitter:image" content="{{SITE_URL}}/assets/og/k-probat-og.jpg">
{{JSONLD}}
<link rel="stylesheet" href="assets/css/style.css">
<link rel="stylesheet" href="assets/css/hover.css">
</head>
<body>
`;
const TAIL = `
<!-- Librairies servies EN LOCAL (jamais depuis un CDN) : si un CDN tombe ou est
     bloqué, le chargeur resterait affiché et le site paraîtrait cassé.
     Voir SPECS-TECHNIQUES.md §5.2. Versions : GSAP 3.12.5, Lenis 1.1.18. -->
<script src="assets/js/vendor/gsap.min.js"></script>
<script src="assets/js/vendor/ScrollTrigger.min.js"></script>
<script src="assets/js/vendor/lenis.min.js"></script>
<script src="assets/js/main.js"></script>
</body>
</html>
`;
writeFileSync(OUT_HTML, HEAD + html.trim() + '\n' + TAIL);
writeFileSync(OUT_CSS, '/* Règles :hover / :focus extraites des attributs style-hover /\n'
  + '   style-focus de la maquette par tools/transpose-maquette.mjs.\n'
  + '   Ne pas modifier à la main : relancer l\'outil. */\n' + cssRules.join('\n') + '\n');
console.log(`✓ corps transposé — ${svColumns.length} colonnes savoir-faire, ${projects.length} réalisations, ${cssRules.length} règles hover/focus`);
