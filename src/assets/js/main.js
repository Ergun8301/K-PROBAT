(function () {
  'use strict';

  document.body.classList.add('js-loading');

  var mobile = window.innerWidth < 860;
  var menuOpen = false;
  var burger = document.getElementById('burger');
  var menuOverlay = document.getElementById('menuOverlay');
  var lenis = null;

  /* -------------------------------------------------------------
     Smooth scroll to section (works with or without Lenis)
     ------------------------------------------------------------- */
  function goTo(selector) {
    return function (e) {
      if (e) e.preventDefault();
      closeMenu();
      var delay = menuOpen ? 350 : 0;
      setTimeout(function () {
        var el = document.querySelector(selector);
        if (!el) return;
        if (lenis) {
          lenis.scrollTo(el, { offset: 0, duration: 1.4 });
        } else {
          window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' });
        }
      }, delay);
    };
  }

  document.querySelectorAll('[data-go]').forEach(function (a) {
    a.addEventListener('click', goTo(a.getAttribute('data-go')));
  });

  /* -------------------------------------------------------------
     Mobile navigation drawer
     ------------------------------------------------------------- */
  function openMenu() {
    menuOpen = true;
    menuOverlay.classList.add('open');
    burger.setAttribute('aria-expanded', 'true');
    burger.querySelector('[data-b1]').style.transform = 'translateY(4.5px) rotate(45deg)';
    burger.querySelector('[data-b2]').style.transform = 'translateY(-4.5px) rotate(-45deg)';
    if (lenis) lenis.stop();
  }
  function closeMenu() {
    menuOpen = false;
    menuOverlay.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
    burger.querySelector('[data-b1]').style.transform = 'none';
    burger.querySelector('[data-b2]').style.transform = 'none';
    if (lenis) lenis.start();
  }
  burger.addEventListener('click', function () {
    menuOpen ? closeMenu() : openMenu();
  });

  /* -------------------------------------------------------------
     Contact form → WhatsApp / mailto
     ------------------------------------------------------------- */
  function formVals() {
    var g = function (id) {
      var el = document.getElementById(id);
      return el && el.value ? el.value.trim() : '';
    };
    return { nom: g('kpb-nom'), tel: g('kpb-tel'), trav: g('kpb-trav'), msg: g('kpb-msg') };
  }
  function formMessage() {
    var v = formVals();
    var lines = ['Bonjour, je souhaite un devis gratuit.'];
    if (v.nom) lines.push('Nom : ' + v.nom);
    if (v.tel) lines.push('Téléphone : ' + v.tel);
    if (v.trav) lines.push('Travaux : ' + v.trav);
    if (v.msg) lines.push('Projet : ' + v.msg);
    return lines.join('\n');
  }
  document.getElementById('sendWa').addEventListener('click', function () {
    window.open('https://wa.me/33652373293?text=' + encodeURIComponent(formMessage()), '_blank');
  });
  document.getElementById('sendMail').addEventListener('click', function () {
    var v = formVals();
    var subject = 'Demande de devis' + (v.nom ? ' — ' + v.nom : '');
    window.location.href = 'mailto:k.probat01@gmail.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(formMessage());
  });
  document.getElementById('devisForm').addEventListener('submit', function (e) { e.preventDefault(); });

  /* -------------------------------------------------------------
     Savoir-faire : 4 colonnes (desktop) → 2 colonnes (mobile)
     Les 8 cartes sont écrites dans l'ordre 01→08 dans le HTML ; on les
     redistribue en tranches selon la largeur (SPECS-TECHNIQUES.md §4).
     ------------------------------------------------------------- */
  var svTrack = document.getElementById('svTrack');
  var svCards = svTrack ? Array.prototype.slice.call(svTrack.querySelectorAll('.sv-card')) : [];
  var svCols = null; // nombre de colonnes actuellement rendu

  function layoutSvColumns() {
    if (!svTrack || !svCards.length) return false;
    var cols = mobile ? 2 : 4;
    if (cols === svCols) return false;
    svCols = cols;
    var per = Math.ceil(svCards.length / cols);
    svTrack.innerHTML = '';
    for (var i = 0; i < cols; i++) {
      var col = document.createElement('div');
      col.className = 'sv-col';
      // colonnes paires : dérive vers le bas ; impaires : vers le haut
      col.setAttribute('data-svcol', i % 2 ? 'up' : 'down');
      svCards.slice(i * per, (i + 1) * per).forEach(function (c) { col.appendChild(c); });
      svTrack.appendChild(col);
    }
    return true;
  }

  // Dérive verticale des colonnes pendant le scroll (±80 px, scrub).
  // Rejouée après chaque changement de disposition : les anciens
  // ScrollTrigger de colonnes sont détruits avant d'en recréer.
  var svTriggers = [];
  function hookSvColumns() {
    if (!window.gsap || !window.ScrollTrigger || !svTrack) return;
    svTriggers.forEach(function (t) { t.kill(); });
    svTriggers = [];
    svTrack.querySelectorAll('[data-svcol]').forEach(function (col) {
      var dir = col.getAttribute('data-svcol') === 'up' ? 1 : -1;
      var tween = window.gsap.fromTo(col, { y: dir * 80 }, {
        y: dir * -80, ease: 'none',
        scrollTrigger: { trigger: col.parentElement, start: 'top bottom', end: 'bottom top', scrub: true }
      });
      if (tween.scrollTrigger) svTriggers.push(tween.scrollTrigger);
    });
  }

  /* -------------------------------------------------------------
     Resize watcher (mosaïque hero et colonnes savoir-faire diffèrent
     au-delà / en deçà de 860 px)
     ------------------------------------------------------------- */
  window.addEventListener('resize', function () {
    var m = window.innerWidth < 860;
    if (m === mobile) return;
    mobile = m;
    if (layoutSvColumns() && window.ScrollTrigger) hookSvColumns();
  });

  /* -------------------------------------------------------------
     Animations (GSAP + ScrollTrigger + Lenis) — degrade gracefully
     if the CDN scripts fail to load (offline, blocked, etc.)
     ------------------------------------------------------------- */
  function initAnimations() {
    var gsap = window.gsap;
    gsap.registerPlugin(window.ScrollTrigger);

    if (window.Lenis) {
      lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
      lenis.on('scroll', window.ScrollTrigger.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    }

    var loader = document.querySelector('[data-loader]');

    function heroTl() {
      var tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
      tl.fromTo('.ltr', { yPercent: 115, rotate: 4 }, { yPercent: 0, rotate: 0, duration: 1.1, stagger: 0.045 })
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
        .to(loader.querySelectorAll('.loader-panel'), { yPercent: -101, duration: 0.8, ease: 'power4.inOut', stagger: 0.07 }, '-=.1')
        .set(loader, { display: 'none' })
        .add(heroTl(), '-=.55');
    } else {
      heroTl();
    }

    document.querySelectorAll('[data-reveal]').forEach(function (el) {
      gsap.fromTo(el, { y: 44, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%' }
      });
    });

    document.querySelectorAll('[data-par]').forEach(function (img) {
      gsap.fromTo(img, { yPercent: -9 }, {
        yPercent: 9, ease: 'none',
        scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });

    document.querySelectorAll('[data-count]').forEach(function (el) {
      var end = +el.getAttribute('data-count');
      var o = { v: 0 };
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
  }

  // Filet de sécurité : si une librairie ne charge pas, on masque le chargeur
  // et on montre la page telle quelle, sans animation. Sans cela, le chargeur
  // resterait affiché indéfiniment (SPECS-TECHNIQUES.md §5.2).
  function fallbackReveal() {
    document.querySelectorAll('[data-reveal],[data-fade],.ltr').forEach(function (el) {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    var loader = document.querySelector('[data-loader]');
    if (loader) loader.style.display = 'none';
  }

  // Les librairies sont servies en local : elles sont donc présentes dès le
  // premier essai. La boucle (max 4 s) ne sert que de garde-fou.
  function waitForLibs(tries) {
    tries = tries || 0;
    if (window.gsap && window.ScrollTrigger) {
      initAnimations();
      document.body.classList.remove('js-loading');
    } else if (tries < 100) {
      setTimeout(function () { waitForLibs(tries + 1); }, 40);
    } else {
      fallbackReveal();
      document.body.classList.remove('js-loading');
    }
  }

  layoutSvColumns();
  waitForLibs();
})();
