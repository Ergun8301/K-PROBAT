/* ============================================================================
 *  Module IPPYX « Google Analytics 4 + bandeau cookies »
 *
 *  Copié dans site/assets/cookies/ par build.mjs UNIQUEMENT si "ga4Id" est
 *  renseigné dans site.config.json. Sinon : aucun bandeau, aucun script,
 *  aucun lien « Gérer les cookies ».
 *
 *  Déroulé :
 *    1. le <head> pose Consent Mode v2 avec TOUT à « denied » (script en ligne
 *       injecté par build.mjs, avant tout le reste) ;
 *    2. ce fichier lance CookieConsent v3 (servi depuis le site) ;
 *    3. gtag.js n'est chargé QU'APRÈS acceptation de la mesure d'audience ;
 *    4. retrait du consentement → cookies _ga effacés et page rechargée.
 *  L'identifiant GA4 arrive par l'attribut data-ga4 de la balise <script>.
 * ========================================================================== */
(function () {
  var GA4_ID = document.currentScript && document.currentScript.getAttribute('data-ga4');
  if (!GA4_ID || !window.CookieConsent) return;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }

  var charge = false;
  function chargerGA() {
    if (charge) return;
    charge = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA4_ID);
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', GA4_ID);
  }

  function appliquer() {
    var ok = CookieConsent.acceptedCategory('analytics');
    gtag('consent', 'update', { analytics_storage: ok ? 'granted' : 'denied' });
    if (ok) chargerGA();
  }

  CookieConsent.run({
    guiOptions: {
      consentModal: { layout: 'box', position: 'bottom left', equalWeightButtons: true, flipButtons: false },
      preferencesModal: { layout: 'box', equalWeightButtons: true, flipButtons: false }
    },
    categories: {
      necessary: { enabled: true, readOnly: true },
      analytics: {
        autoClear: { cookies: [{ name: /^_ga/ }, { name: '_gid' }], reloadPage: true }
      }
    },
    onConsent: appliquer,
    onChange: appliquer,
    language: {
      default: 'fr',
      translations: {
        fr: {
          consentModal: {
            title: 'Cookies',
            description: 'Avec votre accord, nous mesurons l\'audience du site (Google Analytics) pour l\'améliorer. Rien n\'est déposé tant que vous n\'avez pas choisi. Vous pouvez changer d\'avis à tout moment via « Gérer les cookies » en bas de page.',
            acceptAllBtn: 'Tout accepter',
            acceptNecessaryBtn: 'Tout refuser',
            showPreferencesBtn: 'Personnaliser',
            footer: '<a href="confidentialite.html">Politique de confidentialité</a>'
          },
          preferencesModal: {
            title: 'Gérer les cookies',
            acceptAllBtn: 'Tout accepter',
            acceptNecessaryBtn: 'Tout refuser',
            savePreferencesBtn: 'Enregistrer mes choix',
            closeIconLabel: 'Fermer',
            sections: [
              {
                description: 'Choisissez les cookies que vous acceptez. Votre choix est conservé 6 mois.'
              },
              {
                title: 'Cookies nécessaires',
                description: 'Indispensables au fonctionnement du site et à la mémorisation de votre choix. Ils ne peuvent pas être désactivés.',
                linkedCategory: 'necessary'
              },
              {
                title: 'Mesure d\'audience',
                description: 'Google Analytics 4 : statistiques de visite (pages vues, durée, type d\'appareil). Cookies _ga et _ga_*, conservés 13 mois au plus.',
                linkedCategory: 'analytics'
              },
              {
                title: 'En savoir plus',
                description: 'Consultez notre <a href="confidentialite.html">politique de confidentialité</a>.'
              }
            ]
          }
        }
      }
    },
    cookie: { name: 'cc_cookie', expiresAfterDays: 182 }
  });
})();
