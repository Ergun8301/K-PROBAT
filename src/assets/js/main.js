/* ============================================================================
 *  K-ProBat — comportements de la page d'accueil.
 *
 *  Transposition fidèle du composant de la maquette Claude Design : mêmes
 *  librairies (GSAP 3.12.5 + ScrollTrigger, Lenis 1.1.18), mêmes durées, mêmes
 *  décalages, mêmes déclencheurs. Voir SPECS-TECHNIQUES.md §2.
 *
 *  Différences assumées avec la maquette, et pourquoi :
 *    - les librairies sont servies en local (§5.2) ;
 *    - un filet de sécurité masque le chargeur si une librairie manque, au lieu
 *      de le laisser affiché indéfiniment (§5.2) ;
 *    - le regroupement des colonnes savoir-faire (4 → 2 sous 860 px) se fait en
 *      déplaçant les cartes, là où la maquette re-rendait son gabarit (§4).
 * ========================================================================== */
(function () {
  'use strict';

  var BREAKPOINT = 860;
  var mobile = window.innerWidth < BREAKPOINT;
  var menuOpen = false;
  var lenis = null;

  var burger = document.getElementById('burger');
  var menu = document.querySelector('[data-menu]');
  var menuLinks = menu ? menu.querySelectorAll('nav a') : [];
  var svTrack = document.querySelector('[data-svtrack]');

  /* ---------------------------------------------------------------------
     Navigation par ancre — scroll fluide via Lenis quand il est présent.
     Menu ouvert : on ferme d'abord, on défile 350 ms après (comme la maquette).
     --------------------------------------------------------------------- */
  function goTo(selector) {
    return function (e) {
      if (e) e.preventDefault();
      var wasOpen = menuOpen;
      closeMenu();
      setTimeout(function () {
        var el = document.querySelector(selector);
        if (!el) return;
        if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.4 });
        else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' });
      }, wasOpen ? 350 : 0);
    };
  }
  document.querySelectorAll('[data-go]').forEach(function (a) {
    a.addEventListener('click', goTo(a.getAttribute('data-go')));
  });

  /* ---------------------------------------------------------------------
     Menu plein écran : rideau clip-path, items décalés de 0,15 s + i × 0,06 s.
     --------------------------------------------------------------------- */
  function setMenu(open) {
    menuOpen = open;
    if (!menu) return;
    menu.style.clipPath = open ? 'inset(0 0 0% 0)' : 'inset(0 0 100% 0)';
    menu.style.pointerEvents = open ? 'auto' : 'none';
    menuLinks.forEach(function (a, i) {
      var d = (open ? 0.15 + i * 0.06 : 0) + 's';
      a.style.transition = 'transform .8s cubic-bezier(.19,1,.22,1) ' + d + ',opacity .5s ' + d + ',color .25s';
      a.style.transform = open ? 'translateY(0%)' : 'translateY(110%)';
      a.style.opacity = open ? 1 : 0;
    });
    if (burger) {
      var bars = burger.querySelectorAll('span');
      if (bars[0]) bars[0].style.transform = open ? 'translateY(4.5px) rotate(45deg)' : 'none';
      if (bars[1]) bars[1].style.transform = open ? 'translateY(-4.5px) rotate(-45deg)' : 'none';
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    if (lenis) open ? lenis.stop() : lenis.start();
  }
  function closeMenu() { if (menuOpen) setMenu(false); }
  if (burger) burger.addEventListener('click', function () { setMenu(!menuOpen); });

  /* ---------------------------------------------------------------------
     Formulaire de devis — sans serveur : le message est pré-rempli, puis
     ouvert dans WhatsApp ou dans le logiciel de messagerie du visiteur.
     --------------------------------------------------------------------- */
  function formVals() {
    var g = function (id) { var el = document.getElementById(id); return el && el.value ? el.value.trim() : ''; };
    return { nom: g('kpb-nom'), tel: g('kpb-tel'), email: g('kpb-email'), trav: g('kpb-trav'), msg: g('kpb-msg') };
  }
  // Même phrase que les boutons WhatsApp directs de la page : le message reçu
  // par l'artisan est identique quel que soit le chemin emprunté.
  var MESSAGE_ACCROCHE = 'Bonjour, je vous contacte depuis votre site K-ProBat. Je souhaite un devis pour un projet de maçonnerie.';
  function formMessage() {
    var v = formVals(), L = [MESSAGE_ACCROCHE, ''];
    if (v.nom) L.push('Nom : ' + v.nom);
    if (v.tel) L.push('Téléphone : ' + v.tel);
    if (v.email) L.push('E-mail : ' + v.email);
    if (v.trav) L.push('Travaux : ' + v.trav);
    if (v.msg) L.push('Projet : ' + v.msg);
    return L.join('\n');
  }
  /* Envoi vers le site lui-même (Worker /api/devis) : le visiteur NE QUITTE PAS
     la page — la confirmation s'affiche sous le formulaire. */
  var statut = document.getElementById('kpb-statut');
  function afficherStatut(texte, succes) {
    if (!statut) return;
    statut.style.display = 'block';
    statut.textContent = texte;
    statut.style.background = succes ? 'rgba(37,211,102,.12)' : 'rgba(217,57,22,.1)';
    statut.style.boxShadow = 'inset 0 0 0 1.5px ' + (succes ? '#25D366' : 'var(--acc,#D93916)');
    statut.style.color = '#221E19';
  }
  var envoyer = document.getElementById('kpb-envoyer');
  if (envoyer) envoyer.addEventListener('click', function () {
    var v = formVals();
    if (!v.nom || !v.tel) {
      afficherStatut('Merci d\'indiquer au moins votre nom et votre téléphone.', false);
      return;
    }
    var libelle = envoyer.textContent;
    envoyer.disabled = true;
    envoyer.textContent = 'Envoi en cours…';
    var piege = document.getElementById('kpb-website');
    fetch('/api/devis', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        nom: v.nom, tel: v.tel, email: v.email, travaux: v.trav, message: v.msg,
        website: piege ? piege.value : ''
      })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (res.ok && res.d.ok) {
          afficherStatut(res.d.message || 'Votre demande est bien envoyée.', true);
          ['kpb-nom', 'kpb-tel', 'kpb-email', 'kpb-msg'].forEach(function (id) {
            var el = document.getElementById(id); if (el) el.value = '';
          });
          var sel = document.getElementById('kpb-trav'); if (sel) sel.selectedIndex = 0;
        } else {
          afficherStatut(res.d.erreur || 'L\'envoi a échoué. Appelez-nous au 06 52 37 32 93.', false);
        }
      })
      .catch(function () {
        afficherStatut('L\'envoi a échoué (connexion). Utilisez WhatsApp ou appelez le 06 52 37 32 93.', false);
      })
      .then(function () { envoyer.disabled = false; envoyer.textContent = libelle; });
  });

  var waBtn = document.getElementById('sendWa');
  if (waBtn) waBtn.addEventListener('click', function () {
    window.open('https://wa.me/33652373293?text=' + encodeURIComponent(formMessage()), '_blank');
  });
  var mailBtn = document.getElementById('sendMail');
  if (mailBtn) mailBtn.addEventListener('click', function () {
    var v = formVals();
    window.location.href = 'mailto:k.probat01@gmail.com?subject='
      + encodeURIComponent('Demande de devis' + (v.nom ? ' — ' + v.nom : ''))
      + '&body=' + encodeURIComponent(formMessage());
  });

  /* ---------------------------------------------------------------------
     Savoir-faire : 4 colonnes (desktop) → 2 colonnes (mobile).
     --------------------------------------------------------------------- */
  var svCards = svTrack ? Array.prototype.slice.call(svTrack.querySelectorAll('[data-svcol] > div')) : [];
  var svColStyle = svTrack && svTrack.firstElementChild ? svTrack.firstElementChild.getAttribute('style') : '';
  var svRendered = null;

  function layoutSvColumns() {
    if (!svTrack || !svCards.length) return false;
    var cols = mobile ? 2 : 4;
    if (cols === svRendered) return false;
    svRendered = cols;
    var per = Math.ceil(svCards.length / cols);
    svTrack.innerHTML = '';
    for (var i = 0; i < cols; i++) {
      var col = document.createElement('div');
      col.setAttribute('style', svColStyle);
      col.setAttribute('data-svcol', i % 2 ? 'up' : 'down');
      svCards.slice(i * per, (i + 1) * per).forEach(function (c) { col.appendChild(c); });
      svTrack.appendChild(col);
    }
    return true;
  }

  // Dérive verticale des colonnes pendant le défilement (±80 px, scrub).
  var svTriggers = [];
  function hookSvColumns() {
    if (!window.gsap || !window.ScrollTrigger || !svTrack) return;
    svTriggers.forEach(function (t) { t.kill(); });
    svTriggers = [];
    svTrack.querySelectorAll('[data-svcol]').forEach(function (col) {
      var d = col.getAttribute('data-svcol') === 'up' ? 1 : -1;
      var tw = window.gsap.fromTo(col, { y: d * 80 }, {
        y: d * -80, ease: 'none',
        scrollTrigger: { trigger: col.parentElement, start: 'top bottom', end: 'bottom top', scrub: true }
      });
      if (tw.scrollTrigger) svTriggers.push(tw.scrollTrigger);
    });
  }

  window.addEventListener('resize', function () {
    var m = window.innerWidth < BREAKPOINT;
    if (m === mobile) return;
    mobile = m;
    if (layoutSvColumns()) hookSvColumns();
  });

  /* ---------------------------------------------------------------------
     Animations — identiques à la maquette (SPECS-TECHNIQUES.md §2).
     --------------------------------------------------------------------- */
  function initAnimations() {
    var gsap = window.gsap;
    gsap.registerPlugin(window.ScrollTrigger);

    if (window.Lenis) {
      lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
      lenis.on('scroll', window.ScrollTrigger.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    }

    var q = function (s) { return document.querySelectorAll(s); };
    var loader = document.querySelector('[data-loader]');

    function heroTl() {
      var tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
      tl.fromTo('[data-ltr]', { yPercent: 115, rotate: 4 }, { yPercent: 0, rotate: 0, duration: 1.1, stagger: 0.045 })
        .fromTo('[data-mos]', { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)', duration: 0.9, stagger: 0.09, ease: 'power4.out' }, '-=.8')
        .fromTo('[data-fade]', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.07 }, '-=.7')
        .fromTo('[data-marq]', { yPercent: 100 }, { yPercent: 0, duration: 0.7 }, '-=.7');
      return tl;
    }

    if (loader) {
      var cnt = { v: 0 };
      var cEl = loader.querySelector('[data-counter]');
      var bar = loader.querySelector('[data-loadbar]');
      var tl = gsap.timeline();
      tl.fromTo(loader.querySelector('[data-loadtxt]'), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' })
        .to(cnt, {
          v: 100, duration: 1.5, ease: 'power2.inOut',
          onUpdate: function () {
            if (cEl) cEl.textContent = 'COULAGE ' + String(Math.round(cnt.v)).padStart(3, '0');
            if (bar) bar.style.width = cnt.v + '%';
          }
        }, '<')
        .to(loader.querySelector('[data-loadtxt]'), { opacity: 0, y: -20, duration: 0.35, ease: 'power2.in' })
        .to(q('[data-panel]'), { yPercent: -101, duration: 0.8, ease: 'power4.inOut', stagger: 0.07 }, '-=.1')
        .set(loader, { display: 'none' })
        .add(heroTl(), '-=.55');
    } else {
      heroTl();
    }

    q('[data-reveal]').forEach(function (el) {
      gsap.fromTo(el, { y: 44, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%' }
      });
    });

    q('[data-par]').forEach(function (img) {
      gsap.fromTo(img, { yPercent: -9 }, {
        yPercent: 9, ease: 'none',
        scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });

    q('[data-count]').forEach(function (el) {
      var end = +el.getAttribute('data-count'), o = { v: 0 };
      window.ScrollTrigger.create({
        trigger: el, start: 'top 85%', once: true,
        onEnter: function () {
          gsap.to(o, { v: end, duration: 1.6, ease: 'power2.out', onUpdate: function () { el.textContent = Math.round(o.v); } });
        }
      });
    });

    hookSvColumns();

    var bead = document.querySelector('[data-bead]');
    if (bead) {
      window.ScrollTrigger.create({
        start: 0, end: 'max',
        onUpdate: function (s) { bead.style.top = (60 + s.progress * (window.innerHeight - 140)) + 'px'; }
      });
    }

    // Survol de la mosaïque d'accueil (desktop uniquement : sur tactile, les
    // photos sont déjà en couleur — voir style.css).
    q('[data-mos] img').forEach(function (im) {
      im.addEventListener('mouseenter', function () {
        if (mobile) return;
        im.style.filter = 'grayscale(0) brightness(.85) saturate(1.15)';
        im.style.transform = 'scale(1.05)';
      });
      im.addEventListener('mouseleave', function () {
        im.style.filter = 'grayscale(var(--gs,.5)) brightness(var(--dim,.5))';
        im.style.transform = 'scale(1)';
      });
    });
  }

  // Filet de sécurité : si une librairie manque, on masque le chargeur et on
  // montre la page telle quelle, sans animation (SPECS-TECHNIQUES.md §5.2).
  function fallbackReveal() {
    var loader = document.querySelector('[data-loader]');
    if (loader) loader.style.display = 'none';
    document.querySelectorAll('[data-reveal],[data-fade],[data-ltr]').forEach(function (el) {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
  }

  function waitForLibs(tries) {
    tries = tries || 0;
    if (window.gsap && window.ScrollTrigger) initAnimations();
    else if (tries < 100) setTimeout(function () { waitForLibs(tries + 1); }, 40);
    else fallbackReveal();
  }

  /* ---------------------------------------------------------------------
     Service worker : rend le site installable comme application et
     consultable hors connexion. Ignoré en local (http non sécurisé).
     --------------------------------------------------------------------- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () { /* sans effet si indisponible */ });
    });
  }

  layoutSvColumns();
  waitForLibs();
})();
