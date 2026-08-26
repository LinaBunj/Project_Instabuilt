/**
 * InstaBuilt — auth guard.
 *
 * Load on every dashboard/*.html page. Checks supabase.auth.getSession():
 *   - no session  → redirect to /login.html (with ?next= so login can return)
 *   - session     → mark the shell as authed and resolve INSTABUILT.ready
 *
 * The guard exposes INSTABUILT.guard(client) and honours an optional
 * INSTABUILT.redirect hook so the logic can be exercised without navigating.
 */
(function () {
  'use strict';

  var LOGIN_URL = '/login.html';
  var IB = (window.INSTABUILT = window.INSTABUILT || {});

  var resolveReady = null;
  IB.ready = new Promise(function (resolve) { resolveReady = resolve; });

  function redirect(url) {
    if (typeof IB.redirect === 'function') {
      IB.redirect(url);
      return;
    }
    // Preserve the intended destination so login can bounce back.
    var here = window.location.pathname + window.location.search;
    var target = url;
    if (here && here !== '/') {
      target += (url.indexOf('?') === -1 ? '?' : '&') + 'next=' + encodeURIComponent(here);
    }
    window.location.replace(target);
  }

  function onAuthed(session) {
    IB.session = session;
    document.documentElement.classList.add('authed');
    if (document.body) document.body.classList.add('authed');

    var els = document.querySelectorAll('[data-user-email]');
    for (var i = 0; i < els.length; i++) {
      els[i].textContent = (session.user && session.user.email) || '';
    }

    if (resolveReady) {
      resolveReady(session);
      resolveReady = null;
    }
    if (typeof IB.onAuth === 'function') IB.onAuth(session);
  }

  function guard(client) {
    if (!client || !client.auth) {
      redirect(LOGIN_URL);
      return;
    }
    client.auth.getSession()
      .then(function (res) {
        var session = res && res.data && res.data.session;
        if (!session) {
          redirect(LOGIN_URL);
          return;
        }
        onAuthed(session);
      })
      .catch(function () {
        redirect(LOGIN_URL);
      });
  }

  IB.guard = guard;

  // Auto-run against the real client.
  guard(IB.supabase);
})();
