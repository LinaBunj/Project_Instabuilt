/**
 * InstaBuilt — auth logic (signup / login / logout) + shared helpers.
 * Loaded on login.html, signup.html and every dashboard/*.html page.
 */
(function () {
  'use strict';

  var IB = (window.INSTABUILT = window.INSTABUILT || {});
  var AUTH_FLAG = 'instabuilt_authed'; // client-side hint for public pages

  function client() {
    return IB.supabase;
  }

  function setAuthFlag(v) {
    try {
      if (v) localStorage.setItem(AUTH_FLAG, '1');
      else localStorage.removeItem(AUTH_FLAG);
    } catch (e) { /* private mode */ }
  }

  /* ---------- form status helpers ---------- */
  function setStatus(form, msg, ok) {
    var status = form.querySelector('.form-status');
    if (!status) return;
    status.textContent = msg;
    status.className = 'form-status ' + (ok ? 'form-status--ok' : 'form-status--err') + ' is-visible';
  }

  function clearStatus(form) {
    var status = form.querySelector('.form-status');
    if (status) {
      status.textContent = '';
      status.className = 'form-status';
    }
  }

  function disableSubmit(form, disabled) {
    var btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = disabled;
  }

  /* ---------- auth actions ---------- */
  function signup(email, password, meta) {
    var c = client();
    if (!c) {
      return Promise.reject(new Error(
        'Supabase is not configured. Set your URL and anon key in js/supabase-client.js.'
      ));
    }
    return c.auth.signUp({ email: email, password: password, options: { data: meta || {} } });
  }

  function login(email, password) {
    var c = client();
    if (!c) {
      return Promise.reject(new Error(
        'Supabase is not configured. Set your URL and anon key in js/supabase-client.js.'
      ));
    }
    return c.auth.signInWithPassword({ email: email, password: password });
  }

  function logout() {
    var c = client();
    var p = c ? c.auth.signOut() : Promise.resolve();
    return p.then(function () { setAuthFlag(false); }, function () { setAuthFlag(false); });
  }

  /** Returns a validated in-app destination from ?next=, or null. */
  function safeNext() {
    try {
      var next = new URLSearchParams(window.location.search).get('next') || '';
      if (next.indexOf('/dashboard/') === 0) return next;
    } catch (e) { /* ignore */ }
    return null;
  }

  /* Keep the public-page "logged in" hint in sync with the real session. */
  var c = client();
  if (c && c.auth && typeof c.auth.onAuthStateChange === 'function') {
    c.auth.onAuthStateChange(function (event, session) {
      setAuthFlag(!!session);
    });
  }

  /* Delegated sign-out (any element with [data-signout]). */
  document.addEventListener('click', function (e) {
    var target = e.target;
    var btn = target && target.closest ? target.closest('[data-signout]') : null;
    if (!btn) return;
    e.preventDefault();
    logout().finally(function () {
      window.location.href = '/login.html';
    });
  });

  IB.auth = {
    signup: signup,
    login: login,
    logout: logout,
    setStatus: setStatus,
    clearStatus: clearStatus,
    disableSubmit: disableSubmit,
    setAuthFlag: setAuthFlag,
    safeNext: safeNext,
  };
})();
