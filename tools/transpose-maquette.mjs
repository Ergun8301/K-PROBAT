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
const menuItems = [['Accueil', '#hero'], ['Savoir-faire', '#savoirfaire'], ['Réalisations', '#realisations'], ['Béton cellulaire', '#beton-cellulaire'], ["L'artisan", '#artisan'], ['Contact', '#contact']]
  .map((a, i) => ({ label: a[0], href: a[1], n: '0' + (i + 1), delay: '0s' }));

// Les huit métiers et les huit réalisations viennent de src/contenu.json :
// c'est le fichier que le client modifie lui-même depuis /admin. Ordre, titres,
// sous-titres et photos s'y changent sans toucher au code.
const CONTENU = JSON.parse(readFileSync(new URL('../src/contenu.json', import.meta.url), 'utf8'));
const sv = CONTENU.savoirFaire.map((x, i) => ({
  ...x, n: String(i + 1).padStart(2, '0'), k: 's' + i,
}));

// Desktop : 4 colonnes de 2 cartes (le JS regroupe en 2 colonnes sous 860 px).
const NCOLS = 4, PER = sv.length / NCOLS;
const svColumns = Array.from({ length: NCOLS }, (_, i) => ({
  dir: i % 2 ? 'up' : 'down',
  cards: sv.slice(i * PER, (i + 1) * PER),
}));

// La MISE EN PAGE de la galerie (colonnes, proportions, décalages) reste ici :
// elle vient de la maquette et n'a pas à être touchée depuis /admin. Seuls la
// photo, le titre et l'année sont éditables — ils viennent de contenu.json.
const REA_MISE_EN_PAGE = [
  { col: '1 / span 7', ar: '16/10', mt: '0' },
  { col: '8 / span 5', ar: '4/5', mt: 'clamp(40px,6vw,110px)' },
  { col: '1 / span 4', ar: '4/5', mt: '0' },
  { col: '5 / span 8', ar: '16/9', mt: 'clamp(30px,4vw,80px)' },
  { col: '3 / span 8', ar: '21/9', mt: '0' },
  { col: '1 / span 6', ar: '16/10', mt: '0' },
  { col: '7 / span 6', ar: '16/10', mt: 'clamp(30px,4vw,80px)' },
  { col: '4 / span 6', ar: '3/2', mt: '0' },
];
const projects = CONTENU.realisations
  .slice(0, REA_MISE_EN_PAGE.length)
  .map((p, i) => ({ ...REA_MISE_EN_PAGE[i], ...p, k: 'p' + i }));

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
// La grille elle-même : les cases s'alignent en haut (sinon elles s'étirent à
// la hauteur de la rangée et laissent du vide sous les photos).
html = html.replace('<div style="display:grid;grid-template-columns:repeat(12,1fr);gap:clamp(12px,1.6vw,24px)">',
  '<div data-rea-grid style="display:grid;grid-template-columns:repeat(12,1fr);gap:clamp(12px,1.6vw,24px);align-items:start">');
// marqueurs pour le JS : rideau du menu et piste des colonnes savoir-faire
html = html.replace('<div style="position:fixed;inset:0;z-index:80;background:#221E19',
  '<div data-menu style="position:fixed;inset:0;z-index:80;background:#221E19');
html = html.replace('<div style="display:flex;gap:clamp(10px,1.5vw,20px);transform:rotate(-3deg) scale(1.12);align-items:stretch">',
  '<div data-svtrack style="display:flex;gap:clamp(10px,1.5vw,20px);transform:rotate(-3deg) scale(1.12);align-items:stretch">');

// ---- 6 quater. WhatsApp : message pré-rempli + position -------------------
// La maquette ne mettait aucun texte sur les liens WhatsApp hors formulaire.
// Phrase d'accroche UNIQUE, identique au bouton « Envoyer sur WhatsApp » du
// formulaire (voir MESSAGE_ACCROCHE dans assets/js/main.js) : le visiteur doit
// retrouver exactement le même message, quel que soit le bouton utilisé.
const WA_TEXT = encodeURIComponent(
  "Bonjour, je vous contacte depuis votre site K-ProBat. Je souhaite un devis pour un projet de maçonnerie.");
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

// ---- 6 septies. formulaire : envoi réel sans quitter la page ---------------
// La maquette n'avait pas de serveur. Le formulaire poste maintenant sur
// /api/devis (Worker Cloudflare) et affiche lui-même la confirmation.
{
  const FIELD = "background:transparent;border:none;border-bottom:1px solid rgba(34,30,25,.35);border-radius:0;padding:11px 0;font-family:'League Spartan',sans-serif;font-weight:500;font-size:17px;color:#221E19;outline:none";
  const LABEL = "font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.2em;color:rgba(34,30,25,.55)";

  // a) champ e-mail : nécessaire pour pouvoir accuser réception au visiteur
  const telLabelEnd = '<input id="kpb-tel" type="tel" placeholder="06 12 34 56 78" style="' + FIELD + '" style-focus="border-bottom:1px solid #D93916">\n      </label>';
  const emailField = telLabelEnd + `
      <label style="display:flex;flex-direction:column;gap:9px">
        <span style="${LABEL}">VOTRE E-MAIL <span style="opacity:.6">(FACULTATIF)</span></span>
        <input id="kpb-email" type="email" autocomplete="email" placeholder="prenom@exemple.fr" style="${FIELD}" style-focus="border-bottom:1px solid #D93916">
      </label>`;
  if (!html.includes(telLabelEnd)) { console.error('✗ champ téléphone introuvable'); process.exit(1); }
  html = html.replace(telLabelEnd, emailField);

  // b) piège à robots (invisible) + zone de message d'état
  const actionsOpen = '<div style="display:flex;flex-wrap:wrap;gap:14px;align-items:center">';
  const newActions = `<div aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden">
      <label>Ne pas remplir<input id="kpb-website" type="text" tabindex="-1" autocomplete="off"></label>
    </div>
    <div id="kpb-statut" role="status" aria-live="polite" style="display:none;padding:16px 18px;font-size:15px;line-height:1.5"></div>
    <div data-form-actions style="display:flex;flex-wrap:wrap;gap:14px;align-items:center">`;
  if (!html.includes(actionsOpen)) { console.error('✗ bloc des boutons du formulaire introuvable'); process.exit(1); }
  html = html.replace(actionsOpen, newActions);

  // c) bouton d'envoi principal, en tête des actions
  const waBtnStart = '<button id="sendWa"';
  const sendBtn = `<button id="kpb-envoyer" type="button" style="font-family:'League Spartan',sans-serif;font-weight:700;font-size:14px;letter-spacing:.04em;padding:18px 30px;background:var(--acc,#D93916);color:#EAE3D4;border:none;cursor:pointer;transition:background .3s" style-hover="background:#221E19">Envoyer ma demande</button>
      ` + waBtnStart;
  html = html.replace(waBtnStart, sendBtn);
}

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
<meta name="description" content="Maçonnerie générale &amp; gros œuvre à Montagnat, dans l'Ain. Béton cellulaire (Siporex, Ytong), fondations, murs, dalles, escaliers — dans les règles de l'art, depuis 1991.">
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
<meta property="og:description" content="Maçonnerie générale &amp; gros œuvre à Montagnat, dans l'Ain. Béton cellulaire (Siporex, Ytong), fondations, murs, dalles, escaliers — dans les règles de l'art, depuis 1991.">
<meta property="og:url" content="{{SITE_URL}}/">
<meta property="og:image" content="{{SITE_URL}}/assets/og/k-probat-og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="K-ProBat — Maçonnerie générale à Montagnat, dans l'Ain">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="K-ProBat — Maçonnerie générale à Montagnat (01)">
<meta name="twitter:description" content="Maçonnerie générale &amp; gros œuvre à Montagnat, dans l'Ain. Béton cellulaire (Siporex, Ytong), fondations, murs, dalles, escaliers — dans les règles de l'art, depuis 1991.">
<meta name="twitter:image" content="{{SITE_URL}}/assets/og/k-probat-og.jpg">
{{JSONLD}}
<link rel="stylesheet" href="assets/css/style.css">
<link rel="stylesheet" href="assets/css/hover.css">
</head>
<body>
`;
// Pied de page : bloc « zone d'intervention ». Discret, mais indispensable —
// sans ce lien entrant, les pages par commune (src/villes.json) seraient
// orphelines et les moteurs les exploreraient très mal. build.mjs le remplit.
html = html.replace('  {{SIGNATURE}}\n</footer>',
  '  <span data-zones style="flex-basis:100%;color:rgba(234,227,212,.38);letter-spacing:.1em;line-height:2">{{ZONES}}</span>\n  {{SIGNATURE}}\n</footer>');

// ── Recentrage sur les vraies spécialités ────────────────────────────────
// La maquette mettait « piscines » en avant (accroche, bandeau défilant,
// liste du formulaire). Le client n'en fait plus : on les remplace par ce
// qu'il veut vendre — le béton cellulaire et la rénovation. Fait ici, et
// pas dans tools/maquette-body.html, pour garder la maquette intacte.
// Le bandeau savoir-faire : la maquette l'inclinait de 3° ET l'agrandissait
// de 12 % pour qu'il déborde. Résultat mesuré : sur 1440 px, 4 titres de
// carte sur 8 sortaient de l'écran (« ...os œuvre & fondations »,
// « Clôtures & pilier... »), et pire encore sur téléphone. L'effet mangeait
// le contenu qu'il était censé mettre en valeur.
// On garde l'inclinaison, plus discrète, et on supprime l'agrandissement :
// le bandeau reste vivant, mais les huit intitulés se lisent en entier.
html = html.replace('transform:rotate(-3deg) scale(1.12)', 'transform:rotate(-1.5deg)');

html = html
  .replace("Fondations, murs, dalles, escaliers, piscines — dans les règles de l'art, depuis 1991.",
           "Béton cellulaire, fondations, murs, dalles, escaliers — dans les règles de l'art, depuis 1991.")
  .replace(/PISCINES(&nbsp;)/g, 'YTONG$1')
  .replace(/>Piscine maçonnée</g, '>Rénovation, reprise de maçonnerie<');

// ── Section « béton cellulaire / Siporex / Ytong » ────────────────────────
// Elle ne vient PAS de la maquette : c'est la spécialité que le client met en
// avant. Elle est ajoutée ICI, par l'outil de transposition, et non à la main
// dans src/index.html — sinon la prochaine régénération l'effacerait.
// Le lien pointe vers la page pilier, qui porte tout le contenu détaillé.
// Vocabulaire verrouillé : « partenaire », jamais « certifié », « agréé »,
// « labellisé » ni « officiel ». Aucun logo de marque. Aucun chiffre inventé.
// La section s'intercale en 03 : les deux suivantes sont donc renumérotées.
html = html.replace("03 / L'ARTISAN", "04 / L'ARTISAN")
           .replace('04 / CONTACT', '05 / CONTACT');

const SECTION_BC = `
<section id="beton-cellulaire" data-screen-label="Béton cellulaire" style="background:#EAE3D4;padding:clamp(70px,10vw,150px) clamp(18px,4vw,48px);display:flex;flex-direction:column;gap:clamp(24px,3vw,40px)">
  <span data-reveal="" style="font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.3em;color:var(--acc,#D93916)">03 / SPÉCIALITÉ — BÉTON CELLULAIRE</span>
  <h2 data-reveal="" style="margin:0;font-weight:900;font-size:clamp(30px,5vw,68px);line-height:.95;text-transform:uppercase;letter-spacing:-.015em;max-width:15ch">Béton cellulaire, <span style="color:var(--acc,#D93916)">Siporex &amp; Ytong</span></h2>
  <div style="display:flex;flex-wrap:wrap;gap:clamp(30px,5vw,80px);align-items:flex-start">
    <div style="flex:1 1 440px;min-width:290px;display:flex;flex-direction:column;gap:22px">
      <p data-reveal="" style="margin:0;font-size:clamp(15px,1.4vw,17px);line-height:1.7;color:rgba(34,30,25,.78);max-width:560px">${CONTENU.betonCellulaire.p1}</p>
      <p data-reveal="" style="margin:0;font-size:clamp(15px,1.4vw,17px);line-height:1.7;color:rgba(34,30,25,.78);max-width:560px">${CONTENU.betonCellulaire.p2}</p>
      <p data-reveal="" style="margin:0;font-size:clamp(15px,1.4vw,17px);line-height:1.7;color:rgba(34,30,25,.78);max-width:560px">${CONTENU.betonCellulaire.p3}</p>
      <a data-reveal="" href="maconnerie-beton-cellulaire-siporex-ytong.html" style="display:inline-flex;align-items:center;justify-content:center;width:fit-content;min-width:260px;min-height:52px;padding:0 26px;font-family:'League Spartan',sans-serif;font-weight:800;font-size:14px;letter-spacing:.06em;text-transform:uppercase;background:var(--acc,#D93916);color:#EAE3D4;text-decoration:none;transition:filter .3s" data-bc-cta>Tout savoir sur le béton cellulaire</a>
    </div>
    <div style="flex:1 1 320px;min-width:280px;display:flex;flex-direction:column;gap:3px;background:rgba(34,30,25,.14);border:1px solid rgba(34,30,25,.14)">
      <div data-reveal="" style="background:#EAE3D4;padding:clamp(20px,2vw,30px);display:flex;flex-direction:column;gap:8px">
        <span data-count="${CONTENU.betonCellulaire.chiffre}" style="font-weight:900;font-size:clamp(38px,4.5vw,64px);line-height:1">${CONTENU.betonCellulaire.chiffre}</span>
        <span style="font-size:14px;line-height:1.6;color:rgba(34,30,25,.7)">${CONTENU.betonCellulaire.chiffreTexte}</span>
      </div>
      <figure data-reveal="" style="margin:0;background:#EAE3D4;padding:0;overflow:hidden">
        <img src="assets/img/${CONTENU.betonCellulaire.img}" alt="${CONTENU.betonCellulaire.imgAlt}" loading="lazy" width="1600" height="900" style="width:100%;height:auto;display:block">
      </figure>
    </div>
  </div>
</section>

`;
html = html.replace('<section id="artisan"', SECTION_BC.trim() + '\n\n<section id="artisan"');

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
