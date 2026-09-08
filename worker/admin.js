/* ============================================================================
 *  Interface d'administration — côté serveur.
 * ----------------------------------------------------------------------------
 *  Permet au client de changer les photos et les textes du site depuis
 *  /admin, sans passer par GitHub ni par un développeur.
 *
 *  COMMENT ÇA MARCHE, EN UNE PHRASE : la page /admin envoie ici les
 *  modifications, ce fichier les écrit dans le dépôt GitHub, et le
 *  déploiement automatique habituel reconstruit le site.
 *
 *  POURQUOI PASSER PAR GITHUB plutôt qu'écrire directement dans le site :
 *  le dépôt reste la source unique. Chaque modification traverse donc le
 *  build et TOUS ses contrôles (adresses en dur, JSON-LD, jetons non
 *  résolus…). Une modification faite depuis /admin est aussi sûre qu'une
 *  modification faite par un développeur, et elle est annulable — c'est un
 *  commit comme un autre.
 *
 *  CE QU'IL FAUT (voir MAINTENANCE.md) :
 *    ADMIN_MOT_DE_PASSE  Secret Cloudflare — le mot de passe de la page /admin
 *    GITHUB_TOKEN        Secret Cloudflare — jeton GitHub à portée
 *                        « Contents: read/write » sur le seul dépôt du site
 *    GITHUB_DEPOT        « vars » de wrangler.jsonc — « proprietaire/depot »
 *
 *  ATTENTION : GITHUB_DEPOT ne doit PAS être créé à la main dans le tableau
 *  de bord Cloudflare. Un déploiement wrangler réécrit la liste des variables
 *  Texte à partir de wrangler.jsonc et effacerait la valeur saisie à la main.
 *  Les Secrets, eux, ne sont pas touchés.
 *
 *  Sans ces trois valeurs, /admin refuse poliment de fonctionner plutôt que
 *  d'échouer en silence.
 * ========================================================================== */

const BRANCHE = 'main';
const DOSSIER_IMG = 'src/assets/img';
const DUREE_SESSION = 8 * 3600; // secondes
const MAX_IMAGE = 4 * 1024 * 1024;

const json = (data, status = 200, entetes = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...entetes },
});

/* ---- session : un cookie signé, pas de base de données ------------------ */

const octets = s => new TextEncoder().encode(s);
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function signer(valeur, cle) {
  const k = await crypto.subtle.importKey('raw', octets(cle), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', k, octets(valeur)));
}

// Comparaison à durée constante : sans elle, le temps de réponse trahirait
// combien de caractères du mot de passe sont corrects.
function egal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function creerSession(env) {
  const exp = Math.floor(Date.now() / 1000) + DUREE_SESSION;
  return `${exp}.${await signer(String(exp), env.ADMIN_MOT_DE_PASSE)}`;
}

async function sessionValide(request, env) {
  const cookie = (request.headers.get('cookie') || '')
    .split(';').map(c => c.trim()).find(c => c.startsWith('kpb_admin='));
  if (!cookie) return false;
  const [exp, sig] = decodeURIComponent(cookie.slice('kpb_admin='.length)).split('.');
  if (!exp || !sig || Number(exp) < Math.floor(Date.now() / 1000)) return false;
  return egal(sig, await signer(exp, env.ADMIN_MOT_DE_PASSE));
}

/* ---- dépôt GitHub -------------------------------------------------------- */

async function gh(env, chemin, options = {}) {
  const r = await fetch(`https://api.github.com/repos/${env.GITHUB_DEPOT}${chemin}`, {
    ...options,
    headers: {
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'k-probat-admin',
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!r.ok) throw new Error(`GitHub ${r.status} sur ${chemin} : ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

const lire = (env, chemin) => gh(env, `/contents/${chemin}?ref=${BRANCHE}`);

// Écrit un fichier. GitHub exige le « sha » de la version connue : c'est ce
// qui empêche d'écraser sans le voir une modification faite entre-temps.
async function ecrire(env, chemin, contenuBase64, message, sha) {
  return gh(env, `/contents/${chemin}`, {
    method: 'PUT',
    body: JSON.stringify({ message, content: contenuBase64, branch: BRANCHE, ...(sha ? { sha } : {}) }),
  });
}

const versBase64 = texte => {
  const o = new TextEncoder().encode(texte);
  let s = '';
  for (const b of o) s += String.fromCharCode(b);
  return btoa(s);
};
const depuisBase64 = b64 => new TextDecoder().decode(
  Uint8Array.from(atob(b64.replace(/\n/g, '')), c => c.charCodeAt(0)));

/* ---- garde-fous sur ce qui est enregistré -------------------------------- */

// On ne fait pas confiance à ce qui arrive : une page web peut envoyer
// n'importe quoi. On vérifie la FORME avant d'écrire dans le dépôt.
function verifierContenu(c) {
  const e = [];
  const texte = (v, ou) => { if (typeof v !== 'string' || !v.trim()) e.push(`${ou} : texte vide`); };
  if (!Array.isArray(c.bandeau) || c.bandeau.length !== 6) e.push('bandeau : il faut exactement 6 photos');
  else c.bandeau.forEach((b, i) => { texte(b.img, `bandeau ${i + 1} (photo)`); texte(b.alt, `bandeau ${i + 1} (description)`); });
  texte((c.partage || {}).img, 'aperçu de partage (image)');
  texte((c.partage || {}).alt, 'aperçu de partage (texte)');
  if (!Array.isArray(c.savoirFaire) || c.savoirFaire.length !== 8) e.push('savoirFaire : il en faut exactement 8');
  else c.savoirFaire.forEach((x, i) => { texte(x.t, `métier ${i + 1} (titre)`); texte(x.tech, `métier ${i + 1} (sous-titre)`); texte(x.img, `métier ${i + 1} (photo)`); });
  if (!Array.isArray(c.realisations) || c.realisations.length !== 8) e.push('realisations : il en faut exactement 8');
  else c.realisations.forEach((x, i) => { texte(x.t, `réalisation ${i + 1} (titre)`); texte(x.img, `réalisation ${i + 1} (photo)`); });
  for (const champ of ['p1', 'p2', 'p3', 'chiffre', 'chiffreTexte', 'img', 'imgAlt'])
    texte((c.betonCellulaire || {})[champ], `section béton cellulaire (${champ})`);
  for (const n of ['photo1', 'photo2', 'photo3']) {
    const ph = (c.pagePilier || {})[n] || {};
    texte(ph.img, `page Siporex — ${n} (photo)`); texte(ph.alt, `page Siporex — ${n} (description)`); texte(ph.legende, `page Siporex — ${n} (légende)`);
  }
  // Les phrases validées par le client engagent l'entreprise : on refuse les
  // mots qui affirmeraient une certification qui n'existe pas.
  const tout = JSON.stringify(c);
  const interdit = tout.match(/certifi[ée]|agréé|labellis|officiel/i);
  if (interdit) e.push(`le mot « ${interdit[0]} » est interdit sur ce site : K-ProBat est « partenaire », pas certifiée`);
  return e;
}

function verifierVilles(v) {
  const e = [];
  if (!Array.isArray(v) || !v.length) return ['aucune commune'];
  v.forEach((x, i) => {
    for (const champ of ['slug', 'nom', 'cp', 'distance', 'intro', 'contexte', 'chantier', 'question', 'reponse'])
      if (typeof x[champ] !== 'string' || !x[champ].trim()) e.push(`commune ${i + 1} : « ${champ} » vide`);
  });
  return e;
}

const nomImageValide = n => /^[a-z0-9][a-z0-9-]*\.(jpg|jpeg|png|webp)$/.test(n);

/* ---- points d'entrée ----------------------------------------------------- */

async function connexion(request, env) {
  const { motDePasse } = await request.json().catch(() => ({}));
  if (!egal(String(motDePasse || ''), env.ADMIN_MOT_DE_PASSE)) {
    await new Promise(r => setTimeout(r, 600)); // freine les essais en rafale
    return json({ ok: false, erreur: 'Mot de passe incorrect.' }, 401);
  }
  const s = await creerSession(env);
  return json({ ok: true }, 200, {
    'set-cookie': `kpb_admin=${encodeURIComponent(s)}; Path=/; Max-Age=${DUREE_SESSION}; HttpOnly; Secure; SameSite=Strict`,
  });
}

async function charger(env) {
  const [contenu, villes, images] = await Promise.all([
    lire(env, 'src/contenu.json'),
    lire(env, 'src/villes.json'),
    gh(env, `/contents/${DOSSIER_IMG}?ref=${BRANCHE}`),
  ]);
  return json({
    ok: true,
    contenu: JSON.parse(depuisBase64(contenu.content)),
    villes: JSON.parse(depuisBase64(villes.content)),
    photos: images.filter(f => f.type === 'file' && /\.(jpe?g|png|webp)$/i.test(f.name))
      .map(f => f.name).sort(),
  });
}

async function enregistrer(request, env) {
  const corps = await request.json().catch(() => null);
  if (!corps) return json({ ok: false, erreur: 'requête illisible' }, 400);

  const erreurs = [
    ...(corps.contenu ? verifierContenu(corps.contenu) : []),
    ...(corps.villes ? verifierVilles(corps.villes.villes) : []),
  ];
  if (erreurs.length) return json({ ok: false, erreur: 'Modification refusée :\n— ' + erreurs.join('\n— ') }, 400);

  const faits = [];
  for (const [cle, chemin] of [['contenu', 'src/contenu.json'], ['villes', 'src/villes.json']]) {
    if (!corps[cle]) continue;
    const actuel = await lire(env, chemin);
    const nouveau = JSON.stringify(corps[cle], null, 2) + '\n';
    if (depuisBase64(actuel.content) === nouveau) continue; // rien n'a bougé
    await ecrire(env, chemin, versBase64(nouveau), `Contenu modifié depuis /admin (${cle})`, actuel.sha);
    faits.push(chemin);
  }
  return json({
    ok: true,
    message: faits.length
      ? 'Modifications publiées. Le site se reconstruit, comptez une à deux minutes.'
      : 'Rien à publier : aucune modification depuis le dernier enregistrement.',
    fichiers: faits,
  });
}

async function envoyerPhoto(request, env) {
  const { nom, donnees, ecraser } = await request.json().catch(() => ({}));
  if (!nomImageValide(String(nom || '')))
    return json({ ok: false, erreur: 'Nom de fichier refusé. Minuscules, chiffres et tirets uniquement, en .jpg' }, 400);

  // Le navigateur doit envoyer un vrai JPEG encodé en base64. Un canvas qui
  // échoue renvoie « data:, » : sans ce contrôle, cette chaîne partait vers
  // GitHub comme si c'était une photo, et l'échec ressortait en « GitHub 422 »
  // incompréhensible pour le client. On refuse ici, avec une phrase lisible.
  const brut = String(donnees || '');
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(brut);
  if (!m) {
    return json({ ok: false, erreur:
      'La photo reçue est vide ou abîmée : le navigateur n\'a pas réussi à la '
      + 'convertir. Réessayez avec une photo plus légère.' }, 400);
  }
  const b64 = m[2];
  if (b64.length < 512)
    return json({ ok: false, erreur: 'La photo reçue est vide ou abîmée. Réessayez.' }, 400);
  if (b64.length * 0.75 > MAX_IMAGE)
    return json({ ok: false, erreur: 'Photo trop lourde (4 Mo maximum).' }, 400);

  const chemin = `${DOSSIER_IMG}/${nom}`;
  let sha;
  try { sha = (await lire(env, chemin)).sha; } catch { /* nouvelle photo */ }

  // Écraser une photo existante change le site PARTOUT où elle est utilisée.
  // Cela ne se fait donc que si l'interface a explicitement demandé et fait
  // confirmer le remplacement — jamais par défaut.
  if (sha && ecraser !== true) {
    return json({ ok: false, erreur:
      `Une photo nommée « ${nom} » existe déjà. Choisissez un autre nom, ou `
      + 'confirmez le remplacement.' }, 409);
  }

  await ecrire(env, chemin, b64,
    sha ? `Photo remplacée depuis /admin : ${nom}` : `Photo ajoutée depuis /admin : ${nom}`, sha);
  return json({ ok: true, nom, remplacee: Boolean(sha) });
}

/* ---- routeur ------------------------------------------------------------- */

export async function routerAdmin(request, env, url) {
  const manquants = ['ADMIN_MOT_DE_PASSE', 'GITHUB_TOKEN', 'GITHUB_DEPOT'].filter(v => !env[v]);
  if (manquants.length) {
    return json({
      ok: false,
      erreur: `L'administration n'est pas encore configurée dans Cloudflare (${manquants.join(', ')} manquant). Voir MAINTENANCE.md.`,
    }, 503);
  }

  const chemin = url.pathname.replace('/api/admin/', '');
  if (chemin === 'connexion') {
    if (request.method !== 'POST') return json({ ok: false, erreur: 'méthode non autorisée' }, 405);
    return connexion(request, env);
  }

  if (!(await sessionValide(request, env)))
    return json({ ok: false, erreur: 'Session expirée. Reconnectez-vous.' }, 401);

  try {
    if (chemin === 'contenu' && request.method === 'GET') return await charger(env);
    if (chemin === 'enregistrer' && request.method === 'POST') return await enregistrer(request, env);
    if (chemin === 'photo' && request.method === 'POST') return await envoyerPhoto(request, env);
    if (chemin === 'deconnexion') {
      return json({ ok: true }, 200, { 'set-cookie': 'kpb_admin=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict' });
    }
  } catch (e) {
    console.error('admin :', e && e.message);
    return json({ ok: false, erreur: 'Le dépôt a refusé la modification : ' + (e && e.message) }, 502);
  }
  return json({ ok: false, erreur: 'inconnu' }, 404);
}
