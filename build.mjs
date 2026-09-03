#!/usr/bin/env node
// ============================================================================
//  build.mjs — génère le site publié (site/) à partir des sources (src/).
// ----------------------------------------------------------------------------
//  Les DEUX seules valeurs propres au site sont dans site.config.json :
//    siteUrl : adresse publique du site, sans / final  (ex. "https://k-probat.fr")
//    client  : identifiant du client → utm_source de la signature IPPYX
//
//  Ce que le build produit dans site/ :
//    - les pages HTML de src/, avec les jetons remplacés :
//        {{SITE_URL}}     adresse du site (canonical, Open Graph, JSON-LD…)
//        {{SIGNATURE}}    signature IPPYX      (src/partials/signature.html)
//        {{JSONLD}}       fiche LocalBusiness  (src/partials/jsonld-localbusiness.html)
//        {{BREADCRUMB}}   fil d'Ariane JSON-LD (src/partials/jsonld-breadcrumb.html)
//    - sitemap.xml, généré à partir de la liste réelle des pages ;
//    - robots.txt, llms.txt et _headers, copiés depuis src/ avec {{SITE_URL}} ;
//    - assets/ copié tel quel.
//
//  Le build ÉCHOUE (et donc le déploiement) si :
//    - une adresse du site ou un lien de signature traîne en dur dans src/ ;
//    - un {{JETON}} reste non résolu ;
//    - un bloc JSON-LD n'est pas du JSON valide, ou manque sur une page ;
//    - le résultat contient une URL absolue étrangère à siteUrl.
//
//  Usage : node build.mjs   (le workflow GitHub l'exécute avant wrangler)
// ============================================================================
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src'), OUT = join(ROOT, 'site');
const errors = [];
const fail = () => { if (errors.length) { console.error('✗ build annulé :\n - ' + errors.join('\n - ')); process.exit(1); } };

// Nom affiché dans le fil d'Ariane JSON-LD des pages internes (l'Accueil,
// one-page, n'en a pas). Une nouvelle page interne doit être ajoutée ici ET
// contenir le jeton {{BREADCRUMB}}.
const PAGE_NAMES = {
  'mentions-legales.html': 'Mentions légales', 'confidentialite.html': 'Politique de confidentialité',
};
const pagePath = f => (f === 'index.html' ? '/' : '/' + f.replace(/\.html$/, ''));
const TEXT_FILES = ['robots.txt', 'llms.txt', '_headers', 'manifest.webmanifest', 'sw.js'];

// ---- 1. configuration -------------------------------------------------------
const cfg = JSON.parse(readFileSync(join(ROOT, 'site.config.json'), 'utf8'));
if (!/^https:\/\/[a-z0-9.-]+$/i.test(cfg.siteUrl || ''))
  errors.push(`site.config.json → "siteUrl" doit être une adresse https sans chemin ni / final (ex. "https://k-probat.fr") — reçu : ${JSON.stringify(cfg.siteUrl)}`);
if (!/^[a-z0-9-]+$/.test(cfg.client || ''))
  errors.push(`site.config.json → "client" doit être en minuscules, chiffres et tirets (ex. "k-probat") — reçu : ${JSON.stringify(cfg.client)}`);
fail();
const SITE_URL = cfg.siteUrl, SITE_HOST = new URL(SITE_URL).host;
const SIGNATURE_URL = `https://ippyx.com/?utm_source=${cfg.client}&utm_medium=signature&utm_campaign=footer`;
const attr = s => s.replace(/&/g, '&amp;');
const hostOf = u => { try { return new URL(u).host; } catch { return ''; } };
const URL_RE = /https?:\/\/[^\s"'<>)]+/g;
const foreign = h => /\.(workers|pages)\.dev$/i.test(h) && h !== SITE_HOST;

// ---- 2. contrôle : rien en dur dans les sources ----------------------------
const pages = readdirSync(SRC).filter(f => f.endsWith('.html')).sort();
const partials = readdirSync(join(SRC, 'partials')).filter(f => f.endsWith('.html'));
const sources = [...pages.map(p => join('src', p)), ...partials.map(p => join('src', 'partials', p)), ...TEXT_FILES.filter(f => existsSync(join(SRC, f))).map(f => join('src', f))];
for (const f of sources) {
  for (const [u] of readFileSync(join(ROOT, f), 'utf8').matchAll(URL_RE)) {
    const h = hostOf(u);
    if (/\.(workers|pages)\.dev$/i.test(h) || h === SITE_HOST) errors.push(`${f} : adresse du site en dur « ${u} » → utiliser {{SITE_URL}}`);
    if (h === 'ippyx.com' && /utm_source=/.test(u)) errors.push(`${f} : lien de signature en dur « ${u} » → utiliser {{SIGNATURE_URL}} (partial)`);
  }
}
fail();

// ---- 3. génération -----------------------------------------------------------
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
const partial = n => readFileSync(join(SRC, 'partials', n), 'utf8').trim();
const signature = partial('signature.html').replace(/\{\{SIGNATURE_URL\}\}/g, attr(SIGNATURE_URL));
const jsonld = partial('jsonld-localbusiness.html');
const crumbTpl = partial('jsonld-breadcrumb.html');
const jsonText = s => JSON.stringify(s).slice(1, -1);

for (const p of pages) {
  let html = readFileSync(join(SRC, p), 'utf8')
    .replace(/\{\{SIGNATURE\}\}/g, () => signature)
    .replace(/\{\{JSONLD\}\}/g, () => jsonld)
    .replace(/\{\{BREADCRUMB\}\}/g, () => {
      const name = PAGE_NAMES[p];
      if (!name) { errors.push(`src/${p} : jeton {{BREADCRUMB}} mais page absente de PAGE_NAMES (build.mjs)`); return ''; }
      return crumbTpl.replace(/\{\{PAGE_NAME\}\}/g, jsonText(name)).replace(/\{\{PAGE_PATH\}\}/g, pagePath(p));
    })
    .replace(/\{\{SITE_URL\}\}/g, SITE_URL);
  const left = [...new Set([...html.matchAll(/\{\{[A-Z_]+\}\}/g)].map(m => m[0]))];
  if (left.length) errors.push(`src/${p} : jeton(s) non résolu(s) : ${left.join(', ')}`);
  html = html.replace(/^<!DOCTYPE html>\s*/i, `<!DOCTYPE html>\n<!-- Fichier GÉNÉRÉ par build.mjs à partir de src/${p} — ne pas modifier ici : modifiez la source, puis relancez node build.mjs -->\n`);
  writeFileSync(join(OUT, p), html);
}
fail();
cpSync(join(SRC, 'assets'), join(OUT, 'assets'), { recursive: true });

// Fichiers texte : robots.txt, llms.txt, _headers (adresse du site injectée).
for (const f of TEXT_FILES) {
  if (!existsSync(join(SRC, f))) { errors.push(`src/${f} manquant`); continue; }
  const txt = readFileSync(join(SRC, f), 'utf8').replace(/\{\{SITE_URL\}\}/g, SITE_URL);
  if (/\{\{[A-Z_]+\}\}/.test(txt)) errors.push(`src/${f} : jeton non résolu`);
  writeFileSync(join(OUT, f), txt);
}

// sitemap.xml : une entrée par page réellement présente dans src/ (URL propre,
// identique à la balise canonical). lastmod = date du dernier commit du fichier.
const today = new Date().toISOString().slice(0, 10);
const lastmod = f => { try { return execFileSync('git', ['log', '-1', '--format=%cs', '--', join('src', f)], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || today; } catch { return today; } };
const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + pages.map(p => `  <url>\n    <loc>${SITE_URL}${pagePath(p)}</loc>\n    <lastmod>${lastmod(p)}</lastmod>\n  </url>`).join('\n')
  + '\n</urlset>\n';
writeFileSync(join(OUT, 'sitemap.xml'), sitemap);
fail();

// ---- 4. contrôle du résultat ---------------------------------------------------
for (const p of pages) {
  const html = readFileSync(join(OUT, p), 'utf8');
  for (const [u] of html.matchAll(URL_RE)) if (foreign(hostOf(u))) errors.push(`site/${p} : URL absolue étrangère à siteUrl : ${u}`);
  for (const k of ['rel="canonical"', 'property="og:url"', 'property="og:image"', 'name="twitter:image"', 'class="ippyx-sig"', 'href="mentions-legales.html"', 'href="confidentialite.html"'])
    if (!html.includes(k)) errors.push(`site/${p} : élément attendu absent (${k})`);
  if ((html.match(/class="ippyx-sig"/g) || []).length !== 1) errors.push(`site/${p} : la signature doit apparaître exactement une fois`);
  // JSON-LD : chaque bloc doit être du JSON valide ; LocalBusiness partout, fil d'Ariane sur les pages internes.
  const types = [];
  for (const [, body] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { const d = JSON.parse(body); types.push(...[].concat(d['@type'])); }
    catch (e) { errors.push(`site/${p} : bloc JSON-LD invalide (${e.message})`); }
  }
  if (!types.includes('LocalBusiness')) errors.push(`site/${p} : JSON-LD LocalBusiness manquant (jeton {{JSONLD}} dans le <head>)`);
  if (p !== 'index.html' && !types.includes('BreadcrumbList')) errors.push(`site/${p} : JSON-LD BreadcrumbList manquant (jeton {{BREADCRUMB}} dans le <head>)`);
}
for (const f of [...TEXT_FILES, 'sitemap.xml']) {
  const txt = readFileSync(join(OUT, f), 'utf8');
  for (const [u] of txt.matchAll(URL_RE)) if (foreign(hostOf(u))) errors.push(`site/${f} : URL absolue étrangère à siteUrl : ${u}`);
}
fail();
console.log(`✓ site/ généré — ${pages.length} pages + sitemap.xml, robots.txt, llms.txt, _headers · siteUrl = ${SITE_URL} · signature utm_source = ${cfg.client}`);
