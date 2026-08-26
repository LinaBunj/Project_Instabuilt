/**
 * InstaBuilt — Supabase client initialisation.
 *
 * STEP 1 — paste your project credentials below (Supabase Dashboard →
 * Project Settings → API):
 *   - "Project URL"        → SUPABASE_URL
 *   - "anon / public" key  → SUPABASE_ANON_KEY
 *
 * The anon key is designed to be public. It grants access only to what your
 * Row Level Security policies allow (see supabase/schema.sql) — data access
 * is enforced in the database, never by hiding this key.
 *
 * This file must be loaded AFTER the supabase-js CDN script:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://vumaeclogkcoheewyulp.supabase.co';
  var SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

  var isPlaceholder = /YOUR[-_]/.test(SUPABASE_URL) || /YOUR[-_]/.test(SUPABASE_ANON_KEY);

  window.INSTABUILT = window.INSTABUILT || {};
  window.INSTABUILT.config = {
    url: SUPABASE_URL,
    isPlaceholder: isPlaceholder,
  };

  if (isPlaceholder) {
    console.warn(
      '[InstaBuilt] Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY ' +
      'in js/supabase-client.js, then run supabase/schema.sql in your project.'
    );
  }

  window.INSTABUILT.supabase =
    window.supabase && typeof window.supabase.createClient === 'function'
      ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        })
      : null;

  if (!window.INSTABUILT.supabase) {
    console.error('[InstaBuilt] supabase-js failed to load — check the CDN <script> tag in this page.');
  }
})();
