/* ============================================================================
 *  Worker Cloudflare — sert le site ET reçoit les demandes de devis.
 * ----------------------------------------------------------------------------
 *  Tout ce qui n'est pas /api/devis est servi tel quel depuis site/ (assets
 *  statiques). POST /api/devis reçoit le formulaire SANS que le visiteur quitte
 *  la page : la réponse est du JSON, la page affiche elle-même la confirmation.
 *
 *  Que devient une demande :
 *    1. LEADS (KV)         — canal durable. Branché : espace « kprobat-leads ».
 *       La demande y est rangée et reste consultable dans le tableau de bord.
 *    2. SEND_EMAIL         — canal durable. Actif seulement si Email Routing
 *       l'est (donc une fois le domaine définitif en place).
 *    3. journal du Worker  — trace de dépannage, PAS un canal : il ne se lit
 *       qu'en direct et s'efface. On n'y compte jamais pour rassurer le visiteur.
 *
 *  RÈGLE : la confirmation « votre demande est bien reçue » n'est envoyée au
 *  visiteur que si au moins un canal DURABLE a réussi. Sinon il reçoit une
 *  erreur avec le téléphone, et le bouton WhatsApp reste à sa portée. On ne
 *  lui annonce jamais une demande reçue que personne ne recevra.
 *  Étapes de configuration : voir MAINTENANCE.md.
 * ========================================================================== */

const ARTISAN_EMAIL = 'k.probat01@gmail.com';
const MAX_FIELD = 2000;

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

const clean = v => (typeof v === 'string' ? v.trim().slice(0, MAX_FIELD) : '');

function buildMessage(d) {
  const L = ['Nouvelle demande de devis depuis le site K-ProBat.', ''];
  L.push('Nom : ' + d.nom);
  L.push('Téléphone : ' + d.tel);
  if (d.email) L.push('E-mail : ' + d.email);
  if (d.travaux) L.push('Type de travaux : ' + d.travaux);
  if (d.message) L.push('', 'Projet :', d.message);
  L.push('', 'Reçue le ' + new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }));
  return L.join('\n');
}

// Envoi par Email Workers. Nécessite Email Routing (donc un domaine) et une
// adresse de destination vérifiée. Sans le binding, on ne fait rien.
async function sendToArtisan(env, d, text) {
  if (!env.SEND_EMAIL || !env.MAIL_FROM) return 'non configuré';
  try {
    const { EmailMessage } = await import('cloudflare:email');
    const raw = [
      'From: K-ProBat <' + env.MAIL_FROM + '>',
      'To: <' + ARTISAN_EMAIL + '>',
      d.email ? 'Reply-To: <' + d.email + '>' : '',
      'Subject: =?UTF-8?B?' + btoa(unescape(encodeURIComponent('Demande de devis — ' + d.nom))) + '?=',
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      text,
    ].filter(Boolean).join('\r\n');
    await env.SEND_EMAIL.send(new EmailMessage(env.MAIL_FROM, ARTISAN_EMAIL, raw));
    return 'envoyé';
  } catch (e) {
    console.error('envoi e-mail impossible :', e && e.message);
    return 'échec';
  }
}

async function handleDevis(request, env) {
  if (request.method !== 'POST') return json({ ok: false, erreur: 'méthode non autorisée' }, 405);

  // Même origine seulement : bloque les envois depuis un autre site.
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return json({ ok: false, erreur: 'origine non autorisée' }, 403);
  }

  let body;
  try { body = await request.json(); } catch { return json({ ok: false, erreur: 'requête illisible' }, 400); }

  // Piège à robots : un champ caché que seul un automate remplit.
  if (clean(body.website)) return json({ ok: true, message: 'Demande enregistrée.' });

  const d = {
    nom: clean(body.nom),
    tel: clean(body.tel),
    email: clean(body.email),
    travaux: clean(body.travaux),
    message: clean(body.message),
  };
  if (!d.nom || !d.tel) {
    return json({ ok: false, erreur: 'Merci d\'indiquer au moins votre nom et votre téléphone.' }, 400);
  }
  if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) {
    return json({ ok: false, erreur: 'L\'adresse e-mail saisie n\'est pas valide.' }, 400);
  }

  const text = buildMessage(d);
  console.log('DEMANDE DE DEVIS\n' + text); // toujours dans le journal du Worker

  // Enregistrement durable. Le journal du Worker ne compte PAS comme canal :
  // il n'est consultable qu'en direct et s'efface. Seuls le KV et l'e-mail
  // laissent une trace que l'artisan retrouvera plus tard.
  let enregistre = false;
  if (env.LEADS) {
    try {
      await env.LEADS.put('devis:' + new Date().toISOString() + ':' + crypto.randomUUID().slice(0, 8),
        JSON.stringify({ ...d, recuLe: new Date().toISOString() }));
      enregistre = true;
    } catch (e) {
      console.error('enregistrement impossible :', e && e.message);
    }
  } else {
    console.error('aucun espace KV branché (binding LEADS) : la demande n\'est pas enregistrée');
  }

  const mail = await sendToArtisan(env, d, text);
  console.log('notification artisan :', mail);

  // Ne jamais annoncer au visiteur une demande « bien reçue » si RIEN ne l'a
  // gardée : il repartirait confiant alors que personne ne le rappellera.
  // Dans ce cas on le dit franchement et on lui donne le téléphone ; le bouton
  // WhatsApp est juste à côté du formulaire, ses champs restent remplis.
  if (!enregistre && mail !== 'envoyé') {
    return json({
      ok: false,
      erreur: 'Votre demande n\'a pas pu être enregistrée. Appelez le 06 52 37 32 93 '
        + 'ou utilisez le bouton WhatsApp ci-dessous — vos réponses sont conservées.',
    }, 503);
  }

  return json({
    ok: true,
    message: 'Merci, votre demande est bien reçue. Nous vous rappelons sous 24 h. Pour une urgence : 06 52 37 32 93.',
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/devis') return handleDevis(request, env);
    return env.ASSETS.fetch(request);
  },
};
