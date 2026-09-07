/* ============================================================================
 *  Le site EN LIGNE dit-il vraiment ce que dit src/contenu.json ?
 * ----------------------------------------------------------------------------
 *  POURQUOI CE FICHIER EXISTE.
 *
 *  /admin écrit les modifications du client dans src/contenu.json, et rien
 *  d'autre. Entre ce fichier et la page que voit le visiteur, il y a deux
 *  moulinettes : tools/transpose-maquette.mjs, puis build.mjs. Si l'une des
 *  deux est oubliée dans le déploiement, /admin écrit dans le vide : le
 *  commit est là, le déploiement est vert, et le site n'a pas bougé d'un
 *  pixel. C'est arrivé.
 *
 *  Ce contrôle ferme la porte. Il ne regarde ni le dépôt, ni le dossier
 *  site/ : il télécharge les pages RÉELLEMENT SERVIES et vérifie, valeur par
 *  valeur, qu'elles disent exactement ce que dit contenu.json. Le moindre
 *  écart le fait échouer.
 *
 *  Il vérifie AUSSI la couverture dans les deux sens : un champ attendu qui
 *  n'existe pas dans la page, ou un data-champ servi que ce contrôle ne
 *  connaît pas, sont l'un comme l'autre des échecs. Ajouter un champ
 *  modifiable sans l'ajouter ici est donc impossible sans s'en apercevoir.
 *
 *  USAGE
 *    node tools/verifier-contenu-en-ligne.mjs                 → site en ligne
 *    node tools/verifier-contenu-en-ligne.mjs https://…       → une autre adresse
 *    node tools/verifier-contenu-en-ligne.mjs --local site    → le dossier généré
 *                                                               (sans réseau)
 * ========================================================================== */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url);
const CONTENU = JSON.parse(readFileSync(new URL('src/contenu.json', ROOT), 'utf8'));

/* ---- où atterrit chaque page ------------------------------------------- */
const ACCUEIL = '/';
const PILIER = '/maconnerie-beton-cellulaire-siporex-ytong';

/* ---- lecture des pages : réseau, ou dossier local pour un essai --------- */
const args = process.argv.slice(2);
const local = args[0] === '--local' ? (args[1] || 'site') : null;
const base = local ? null
  : (args[0] || JSON.parse(readFileSync(new URL('site.config.json', ROOT), 'utf8')).siteUrl)
      .replace(/\/$/, '');

const fichierLocal = chemin => join(local, chemin === '/' ? 'index.html' : chemin.slice(1) + '.html');

async function page(chemin) {
  if (local) return readFileSync(new URL(fichierLocal(chemin), ROOT), 'utf8');
  const rep = await fetch(base + chemin, { headers: { 'cache-control': 'no-cache' } });
  if (!rep.ok) throw new Error(`${chemin} → HTTP ${rep.status}`);
  return rep.text();
}

/* ---- petit lecteur de HTML, sans dépendance ----------------------------- */

// Le seul élément qui porte data-champ="…". Deux éléments pour le même champ,
// ou aucun, sont des anomalies : on le dit plutôt que de choisir au hasard.
function element(html, champ) {
  const marque = `data-champ="${champ}"`;
  const premier = html.indexOf(marque);
  if (premier < 0) return null;
  if (html.indexOf(marque, premier + 1) >= 0) throw new Error(`${champ} : servi plusieurs fois dans la page`);

  const debutBalise = html.lastIndexOf('<', premier);
  let i = premier, guillemet = null;
  for (; i < html.length; i++) {
    const c = html[i];
    if (guillemet) { if (c === guillemet) guillemet = null; }
    else if (c === '"' || c === "'") guillemet = c;
    else if (c === '>') break;
  }
  const ouvrante = html.slice(debutBalise, i + 1);
  const nom = /^<([a-zA-Z0-9]+)/.exec(ouvrante)[1];

  // Élément vide (img) : pas de contenu à lire.
  if (nom === 'img' || ouvrante.endsWith('/>')) return { ouvrante, interieur: null };

  // Sinon on avance jusqu'à la fermante correspondante, en comptant les
  // balises de même nom imbriquées.
  const re = new RegExp(`</?${nom}\\b`, 'gi');
  re.lastIndex = i + 1;
  let profondeur = 1, m;
  while ((m = re.exec(html))) {
    profondeur += m[0][1] === '/' ? -1 : 1;
    if (profondeur === 0) return { ouvrante, interieur: html.slice(i + 1, m.index) };
  }
  throw new Error(`${champ} : balise <${nom}> jamais refermée`);
}

const attribut = (ouvrante, nom) => {
  const m = new RegExp(`\\s${nom}="([^"]*)"`).exec(ouvrante);
  return m ? m[1] : null;
};

// Le HTML servi est échappé (&amp;, &quot;…) et parfois réindenté. contenu.json
// contient le texte brut. On ramène les deux à la même forme avant comparaison.
const decoder = s => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#x27;/gi, "'")
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&');           // en dernier, sinon &amp;lt; se décode deux fois
const normaliser = s => decoder(String(s)).replace(/\s+/g, ' ').trim();

/* ---- ce qu'on attend, construit depuis contenu.json --------------------- */

const attendus = [];   // { page, champ, quoi, attendu }
const att = (p, champ, quoi, attendu) => attendus.push({ page: p, champ, quoi, attendu });

CONTENU.bandeau.forEach((x, i) => {
  att(ACCUEIL, `bandeau.${i}.img`, 'src', x.img);
  att(ACCUEIL, `bandeau.${i}.img`, 'alt', x.alt);
});
CONTENU.savoirFaire.forEach((x, i) => {
  att(ACCUEIL, `savoirFaire.${i}.img`, 'src', x.img);
  att(ACCUEIL, `savoirFaire.${i}.t`, 'texte', x.t);
  att(ACCUEIL, `savoirFaire.${i}.tech`, 'texte', x.tech);
});
CONTENU.realisations.forEach((x, i) => {
  att(ACCUEIL, `realisations.${i}.img`, 'src', x.img);
  att(ACCUEIL, `realisations.${i}.img`, 'alt', x.alt !== undefined ? x.alt : null);
  att(ACCUEIL, `realisations.${i}.t`, 'texte', x.t);
  att(ACCUEIL, `realisations.${i}.meta`, 'texte', x.meta);
});
const bc = CONTENU.betonCellulaire;
att(ACCUEIL, 'betonCellulaire.img', 'src', bc.img);
att(ACCUEIL, 'betonCellulaire.img', 'alt', bc.imgAlt !== undefined ? bc.imgAlt : null);
att(ACCUEIL, 'betonCellulaire.chiffre', 'texte', bc.chiffre);
att(ACCUEIL, 'betonCellulaire.chiffreTexte', 'texte', bc.chiffreTexte);
Object.keys(bc).filter(k => /^p\d+$/.test(k)).forEach(k => att(ACCUEIL, `betonCellulaire.${k}`, 'texte', bc[k]));
[1, 2, 3].forEach(n => {
  const ph = CONTENU.pagePilier['photo' + n];
  if (!ph) return;
  att(PILIER, `pagePilier.photo${n}.img`, 'src', ph.img);
  att(PILIER, `pagePilier.photo${n}.img`, 'alt', ph.alt);
  att(PILIER, `pagePilier.photo${n}.legende`, 'texte', ph.legende);
});

/* ---- comparaison -------------------------------------------------------- */

const echecs = [];
const pages = [...new Set(attendus.map(a => a.page))];
const html = {};
for (const p of pages) html[p] = await page(p);

for (const a of attendus) {
  if (a.attendu === null || a.attendu === undefined) continue;  // champ absent du JSON : rien à comparer
  let el;
  try { el = element(html[a.page], a.champ); }
  catch (e) { echecs.push(`${a.page} ${a.champ} : ${e.message}`); continue; }
  if (!el) { echecs.push(`${a.page} ${a.champ} : aucun élément ne porte ce data-champ dans la page servie`); continue; }

  let servi;
  if (a.quoi === 'src') servi = attribut(el.ouvrante, 'src');
  else if (a.quoi === 'alt') servi = attribut(el.ouvrante, 'alt');
  else servi = el.interieur;

  if (servi === null || servi === undefined) {
    echecs.push(`${a.page} ${a.champ} : attribut « ${a.quoi} » absent de l'élément servi`);
    continue;
  }
  // Une photo est comparée sur son nom de fichier : le chemin peut être
  // relatif ou absolu selon la page, le nom, lui, ne ment pas.
  const ok = a.quoi === 'src'
    ? servi.replace(/[?#].*$/, '').endsWith('/' + a.attendu) || servi === a.attendu
    : normaliser(servi) === normaliser(a.attendu);

  if (!ok) {
    echecs.push(`${a.page} ${a.champ} (${a.quoi})\n      contenu.json : ${a.attendu}\n      site en ligne : ${a.quoi === 'src' ? servi : normaliser(servi)}`);
  }
}

/* ---- image de partage : pas de data-champ, elle vit dans les balises meta */
for (const p of pages) {
  const og = /<meta[^>]+property="og:image"[^>]+content="([^"]*)"/.exec(html[p])
          || /<meta[^>]+content="([^"]*)"[^>]+property="og:image"/.exec(html[p]);
  if (!og) { echecs.push(`${p} : balise og:image absente`); continue; }
  if (!og[1].endsWith('/' + CONTENU.partage.img)) {
    echecs.push(`${p} og:image\n      contenu.json : ${CONTENU.partage.img}\n      site en ligne : ${og[1]}`);
  }
}

/* ---- couverture : aucun champ modifiable ne doit échapper à ce contrôle -- */
const connus = new Set(attendus.map(a => a.champ));
for (const p of pages) {
  for (const m of html[p].matchAll(/data-champ="([^"]+)"/g)) {
    if (!connus.has(m[1])) {
      echecs.push(`${p} ${m[1]} : champ modifiable servi par le site, mais inconnu de ce contrôle`
        + ` — ajoutez-le dans tools/verifier-contenu-en-ligne.mjs`);
    }
  }
}

/* ---- verdict ------------------------------------------------------------ */
const compares = attendus.filter(a => a.attendu !== null && a.attendu !== undefined).length;
if (echecs.length) {
  console.error(`✗ le site en ligne ne correspond pas à src/contenu.json — ${echecs.length} écart(s) :\n`);
  for (const e of echecs) console.error('  ✗ ' + e);
  console.error(`\n  Cause la plus probable : le déploiement n'a pas relancé`
    + ` « node tools/transpose-maquette.mjs » avant « node build.mjs ».`);
  process.exit(1);
}
console.log(`✓ site en ligne conforme à contenu.json : ${compares} valeurs comparées`
  + ` sur ${pages.length} page(s), aucun écart.`);
