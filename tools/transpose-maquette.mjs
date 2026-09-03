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

// ---- 6 quater. WhatsApp : message pré-rempli + position -------------------
// La maquette ne mettait aucun texte sur les liens WhatsApp hors formulaire.
const WA_TEXT = encodeURIComponent(
  "Bonjour, je vous contacte depuis votre site K-ProBat. Je souhaite un devis gratuit pour un projet de maçonnerie.");
html = html.replace(/href="https:\/\/wa\.me\/33652373293"/g, `href="https://wa.me/33652373293?text=${WA_TEXT}"`);
// Bouton flottant : en bas à DROITE (comme sur les autres sites de l'agence).
// Le fil à plomb décoratif est masqué sur mobile (style.css) pour éviter que
// la barre verticale ne vienne toucher la bulle.
// Marges IDENTIQUES au retrait horizontal des sections (clamp(18px,4vw,48px)) :
// le bouton s'aligne ainsi exactement sous les boutons de l'accueil.
html = html.replace('position:fixed;bottom:80px;right:22px;z-index:70',
  'position:fixed;bottom:clamp(18px,4vw,48px);right:clamp(18px,4vw,48px);z-index:70');

// marqueur pour aligner les deux boutons d'accueil sur mobile
html = html.replace('<div data-fade="" style="display:flex;flex-wrap:wrap;align-items:center;gap:14px;pointer-events:auto">',
  '<div data-fade="" data-hero-cta style="display:flex;flex-wrap:wrap;align-items:center;gap:14px;pointer-events:auto">');

// ---- 6 quinquies. l'équipe familiale ---------------------------------------
// Ajout hors maquette, demandé par le client (référencement local : les noms
// de l'artisan et de ses fils). Rédigé à partir des seules informations
// fournies : fondateur + deux fils maçons expérimentés. Aucune date inventée.
{
  const anchor = "Intervention à Montagnat et dans un rayon de 30 km — Bourg-en-Bresse, Ceyzériat, Péronnas, Saint-Denis-lès-Bourg.</p>";
  const para = '\n      <p data-reveal="" style="margin:0;font-size:clamp(15px,1.4vw,17px);line-height:1.7;color:rgba(234,227,212,.75);max-width:560px">'
    + 'Aujourd\'hui, <strong style="color:#EAE3D4;font-weight:700">Yasar Kilic</strong> travaille avec ses deux fils, '
    + '<strong style="color:#EAE3D4;font-weight:700">Oktay</strong> et <strong style="color:#EAE3D4;font-weight:700">Okan</strong>, '
    + 'maçons expérimentés formés sur les chantiers de l\'entreprise. Trois artisans, un seul nom sur le devis.</p>';
  if (!html.includes(anchor)) { console.error('✗ paragraphe « zone d\'intervention » introuvable'); process.exit(1); }
  html = html.replace(anchor, anchor + para);
}

// ---- 6 sexies. contact : 3 boutons d'action alignés ------------------------
// Demandé par le client, sur le modèle du site MC Crépi : Appeler / WhatsApp /
// E-mail, empilés, TOUS de la même largeur (aucun décalage). Ils remplacent le
// lien e-mail en texte, qui faisait doublon.
{
  // (l'attribut style-hover est encore présent : la conversion en CSS a lieu plus bas)
  const mailLink = '<a data-reveal="" href="mailto:k.probat01@gmail.com" style="font-family:\'IBM Plex Mono\',monospace;font-size:clamp(14px,1.8vw,20px);letter-spacing:.1em;color:#221E19;text-decoration:none;width:fit-content;transition:color .3s" style-hover="color:var(--acc,#D93916)">K.PROBAT01@GMAIL.COM</a>';
  const ICON = 'width:18px;height:18px;flex:none';
  const base = 'display:flex;align-items:center;justify-content:center;gap:12px;padding:18px 30px;'
    + 'font-family:\'League Spartan\',sans-serif;font-weight:700;font-size:14px;letter-spacing:.04em;'
    + 'text-decoration:none;transition:all .3s;min-height:56px';
  const group = `  <div data-reveal="" data-contact-actions style="display:flex;flex-direction:column;gap:12px;max-width:420px;width:100%">
    <a href="tel:0652373293" style="${base};background:#221E19;color:#EAE3D4">
      <svg style="${ICON}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
      06 52 37 32 93</a>
    <a href="https://wa.me/33652373293" target="_blank" rel="noopener" style="${base};background:#EAE3D4;color:#221E19;box-shadow:inset 0 0 0 1.5px rgba(34,30,25,.25)">
      <svg style="${ICON}" viewBox="0 0 24 24" fill="#25D366"><path d="M12.04 2a9.9 9.9 0 0 0-8.51 14.9L2 22l5.27-1.48A9.9 9.9 0 1 0 12.04 2m0 1.67a8.23 8.23 0 1 1-4.2 15.3l-.3-.18-3.12.88.86-3.04-.2-.31a8.23 8.23 0 0 1 6.96-12.65m-3.5 3.6c-.16 0-.43.06-.65.3-.23.24-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.57.12.16 1.72 2.75 4.25 3.75 2.1.83 2.53.66 2.99.62.45-.04 1.47-.6 1.68-1.18.2-.58.2-1.08.15-1.18-.06-.1-.23-.16-.48-.29-.25-.12-1.47-.72-1.7-.8-.22-.09-.39-.13-.55.12-.17.25-.64.8-.78.97-.14.16-.29.18-.53.06-.25-.13-1.05-.39-2-1.24-.73-.65-1.23-1.46-1.37-1.7-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.43-.06-.13-.55-1.35-.77-1.84-.2-.48-.4-.42-.55-.42z"></path></svg>
      WHATSAPP DIRECT</a>
    <a href="mailto:k.probat01@gmail.com" style="${base};background:transparent;color:#221E19;box-shadow:inset 0 0 0 1.5px #221E19">
      <svg style="${ICON}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="m2 7 10 6 10-6"></path></svg>
      K.PROBAT01@GMAIL.COM</a>
  </div>`;
  if (!html.includes(mailLink)) { console.error('✗ lien e-mail du contact introuvable'); process.exit(1); }
  html = html.replace(mailLink, group);
}

// ---- 6 septies. boutons du formulaire : même largeur, alignés --------------
html = html.replace('<div style="display:flex;flex-wrap:wrap;gap:14px;align-items:center">',
  '<div data-form-actions style="display:flex;flex-wrap:wrap;gap:14px;align-items:center">');

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
<link rel="icon" href="/assets/icons/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/assets/icons/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#221E19">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="K-ProBat">
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
