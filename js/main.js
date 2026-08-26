/* =========================================================================
   InstaBuilt — main.js
   Nav behaviour · sticky header · scroll reveals · form capture (Phase 1)
   No dependencies. Vanilla ES6+.
   ========================================================================= */
(function () {
  'use strict';

  var mqMobile = window.matchMedia('(max-width: 1023px)');

  /* ---------- Sticky header shadow ---------- */
  var header = document.getElementById('site-header');
  function onScroll() {
    if (!header) return;
    if (window.scrollY > 8) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Mobile nav toggle ---------- */
  var toggle = document.getElementById('nav-toggle');
  function closeMobileNav() {
    document.body.classList.remove('nav-open');
    if (toggle) {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
    }
  }
  if (toggle) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      toggle.setAttribute('aria-label', open ? 'Open menu' : 'Close menu');
      document.body.classList.toggle('nav-open', !open);
    });
  }

  /* ---------- Dropdowns ---------- */
  // Mobile: click toggles an accordion; desktop: hover/focus reveal via CSS.
  document.querySelectorAll('.has-dropdown > .nav-link').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      if (!mqMobile.matches) return;
      e.preventDefault();
      var dd = btn.parentElement;
      var willOpen = !dd.classList.contains('open');
      // close any sibling dropdown first
      if (dd.parentElement) {
        dd.parentElement.querySelectorAll('.has-dropdown.open').forEach(function (open) {
          if (open !== dd) {
            open.classList.remove('open');
            var b = open.querySelector('.nav-link');
            if (b) b.setAttribute('aria-expanded', 'false');
          }
        });
      }
      dd.classList.toggle('open', willOpen);
      btn.setAttribute('aria-expanded', String(willOpen));
    });
  });

  // Desktop: keep aria-expanded in sync with hover/focus open state.
  document.querySelectorAll('.has-dropdown').forEach(function (dd) {
    var btn = dd.querySelector('.nav-link');
    if (!btn) return;
    var set = function (v) { btn.setAttribute('aria-expanded', String(v)); };
    dd.addEventListener('mouseenter', function () { if (!mqMobile.matches) set(true); });
    dd.addEventListener('mouseleave', function () { if (!mqMobile.matches) set(false); });
    dd.addEventListener('focusin', function () { if (!mqMobile.matches) set(true); });
    dd.addEventListener('focusout', function (e) {
      if (!mqMobile.matches && !dd.contains(e.relatedTarget)) set(false);
    });
  });

  // Close the mobile drawer after choosing a destination.
  document.querySelectorAll('.site-nav a').forEach(function (a) {
    a.addEventListener('click', function () {
      if (mqMobile.matches) closeMobileNav();
    });
  });

  // Escape closes the drawer.
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.body.classList.contains('nav-open')) closeMobileNav();
  });

  /* ---------- Scroll reveal ---------- */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ---------- Form capture (no backend in Phase 1) ---------- */
  document.querySelectorAll('form[data-capture]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var data = new FormData(form);
      var payload = {};
      data.forEach(function (v, k) { payload[k] = String(v); });
      // Capture-only for now: the payload is logged; backend wiring arrives in Phase 2.
      if (window.console) console.log('[InstaBuilt] form captured:', payload);
      var status = form.querySelector('.form-status');
      if (status) {
        status.textContent = form.getAttribute('data-success') ||
          'Thank you — your details have been captured. We will be in touch shortly.';
        status.className = 'form-status form-status--ok is-visible';
      }
      form.reset();
    });
  });

  /* ---------- Design-CTA rewiring (Phase 2) ---------- */
  // "Design yours" links on product pages resolve to the dashboard when the
  // user is signed in, otherwise to login. The flag is set/cleared by auth.js
  // and mirrored against the real session via onAuthStateChange; the ultimate
  // gate is auth-guard.js on the dashboard itself.
  var isAuthed = false;
  try { isAuthed = window.localStorage.getItem('instabuilt_authed') === '1'; } catch (e) { /* ignore */ }
  document.querySelectorAll('a.js-design-cta').forEach(function (a) {
    if (isAuthed) a.setAttribute('href', 'dashboard/house-designer.html');
  });
  // Nav sign-in link: "Sign in" when logged out, "Dashboard" when logged in.
  document.querySelectorAll('a.header-signin').forEach(function (a) {
    if (isAuthed) {
      a.setAttribute('href', 'dashboard/index.html');
      a.textContent = 'Dashboard';
    }
  });

  /* ---------- Footer year ---------- */
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
