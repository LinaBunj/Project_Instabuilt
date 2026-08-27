/**
 * InstaBuilt — project tracking (module).
 *
 * Replaces the "coming soon" placeholder with a live build-tracking view:
 *   - "Is your build underway?" journey line (started? which phase?)
 *   - horizontal progress bar (6 fixed stages, completed/current/upcoming)
 *   - vertical timeline (one card per stage with status + description)
 *
 * There is no real order system yet, so the build auto-simulates:
 *   - on first visit with a saved house design but no tracking row, a row is
 *     created at Stage 1;
 *   - on load + on a lightweight interval, the stage advances once enough time
 *     has passed (DEMO_STAGE_DURATION_MS), capped at Stage 6, and the new
 *     stage + timestamp are written back to Supabase.
 *
 * Diagnostics: every Supabase step is logged to the console ([track] prefix)
 * and mirrored to a one-line #track-debug element for quick on-page testing.
 */
(function () {
  'use strict';

  const IB = window.INSTABUILT;
  if (!IB || !IB.supabase) return;

  // ---- Demo timing (tune to speed the simulation up/down) ------------------
  const DEMO_STAGE_DURATION_MS = 45 * 1000; // 45s per stage — easy to lower
  const POLL_INTERVAL_MS = 5000;            // re-check every 5s
  const MAX_STAGE = 6;

  // ---- The six build stages (fixed order) ----------------------------------
  const STAGES = [
    { name: 'Contract Signed',                     short: 'Contract',   desc: 'Your contract is signed and the build is officially confirmed.' },
    { name: 'Factory Production of Modular Parts', short: 'Factory',    desc: 'Your home\u2019s modular components are precision-manufactured at our factory.' },
    { name: 'Foundation Preparation on Site',      short: 'Foundation', desc: 'The site is prepared and the foundation laid, ready for assembly.' },
    { name: 'Utility Infrastructure Connection',   short: 'Utilities',  desc: 'Water, power and other utilities are connected to your plot.' },
    { name: 'House Assembly on Site',              short: 'Assembly',   desc: 'The modular components are craned into place and assembled into your home.' },
    { name: 'Handover / Delivery',                 short: 'Handover',   desc: 'Final quality checks complete \u2014 your keys are handed over.' }
  ];

  // ---- Company build journey (is it underway, and which phase?) ----
  // Maps the 6 admin stages onto the customer-facing pipeline:
  //   not started -> being built -> getting shipped -> building on site -> delivered
  const JOURNEY = [
    { short: 'Not started',      name: 'construction has not begun yet' },
    { short: 'Being built',      name: 'your home is being built at the factory' },
    { short: 'Getting shipped',  name: 'your modules are being shipped to your site' },
    { short: 'Building on site', name: 'your home is being built on site' },
    { short: 'Delivered',        name: 'your home is delivered' }
  ];

  function journeyIndex(stage) {
    if (stage <= 1) return 0;   // not started
    if (stage === 2) return 1;  // being built (factory)
    if (stage <= 4) return 2;   // getting shipped (site prep runs in parallel)
    if (stage === 5) return 3;  // building on site
    return 4;                   // delivered
  }

  function journeyStatus(stage) {
    if (stage >= 6) return 'Delivered \u2014 your home is complete and handed over.';
    const idx = journeyIndex(stage);
    return (stage >= 2 ? 'In progress' : 'Not started') + ' \u2014 ' + JOURNEY[idx].name + '.';
  }

  const el = {
    empty: document.getElementById('track-empty'),
    content: document.getElementById('track-content'),
    stageLine: document.getElementById('track-stage-line'),
    progress: document.getElementById('track-progress'),
    timeline: document.getElementById('track-timeline'),
    demoNote: document.getElementById('track-demo-note'),
    journey: document.getElementById('track-journey'),
    journeyStatus: document.getElementById('track-journey-status'),
    debug: document.getElementById('track-debug')
  };

  let session = null;
  let row = null;       // the active project_tracking row
  let pollTimer = null;

  // Normalized 1..6 stage number — never NaN, even if the DB returns a string
  // or an unexpected value.
  function currentStage() {
    if (!row) return 1;
    const n = Number(row.current_stage);
    return Math.max(1, Math.min(MAX_STAGE, isFinite(n) && n > 0 ? Math.round(n) : 1));
  }

  function statusOf(stageNum) {
    const cur = currentStage();
    if (stageNum < cur) return 'Completed';
    if (stageNum === cur) return 'In Progress';
    return 'Upcoming';
  }

  // ---------- Shared stepper builder ----------
  function buildSteps(container, items, currentIndex) {
    container.innerHTML = '';
    items.forEach(function (s, i) {
      const li = document.createElement('li');
      li.className = 'track-step';
      if (i < currentIndex) li.classList.add('is-done');
      else if (i === currentIndex) li.classList.add('is-current');
      else li.classList.add('is-upcoming');

      if (i > 0) {
        const conn = document.createElement('span');
        conn.className = 'track-step__connector' + (i <= currentIndex ? ' is-filled' : '');
        conn.setAttribute('aria-hidden', 'true');
        li.appendChild(conn);
      }

      const node = document.createElement('span');
      node.className = 'track-step__node';
      node.setAttribute('aria-hidden', 'true');
      node.textContent = i < currentIndex ? '\u2713' : (i + 1);
      li.appendChild(node);

      const label = document.createElement('span');
      label.className = 'track-step__label';
      label.textContent = s.short;
      li.appendChild(label);

      container.appendChild(li);
    });
  }

  // ---------- Progress bar (6 admin stages) ----------
  function renderProgress() {
    buildSteps(el.progress, STAGES, currentStage() - 1);
  }

  // ---------- Company build journey (started? which phase?) ----------
  function renderJourney() {
    const stage = currentStage();
    el.journeyStatus.textContent = journeyStatus(stage);
    buildSteps(el.journey, JOURNEY, journeyIndex(stage));
  }

  // ---------- Vertical timeline ----------
  function renderTimeline() {
    el.timeline.innerHTML = '';
    STAGES.forEach(function (s, i) {
      const num = i + 1;
      const li = document.createElement('li');
      li.className = 'track-card';
      if (num < currentStage()) li.classList.add('is-done');
      else if (num === currentStage()) li.classList.add('is-current');
      else li.classList.add('is-upcoming');

      const rail = document.createElement('div');
      rail.className = 'track-card__rail';
      const dot = document.createElement('span');
      dot.className = 'track-card__dot';
      dot.setAttribute('aria-hidden', 'true');
      rail.appendChild(dot);

      const body = document.createElement('div');
      body.className = 'track-card__body';

      const head = document.createElement('div');
      head.className = 'track-card__head';
      const h = document.createElement('h3');
      h.textContent = s.name;
      const status = document.createElement('span');
      status.className = 'track-card__status';
      status.textContent = statusOf(num);
      head.appendChild(h);
      head.appendChild(status);

      const p = document.createElement('p');
      p.textContent = s.desc;

      // Media slot — empty for now. Add an <img>/<video> here later; the CSS
      // `.track-media:not(:empty)` block handles layout so no redesign needed.
      const media = document.createElement('div');
      media.className = 'track-media';

      body.appendChild(head);
      body.appendChild(p);
      body.appendChild(media);

      li.appendChild(rail);
      li.appendChild(body);
      el.timeline.appendChild(li);
    });
  }

  function render() {
    if (!row) {
      console.error('[track] render called with no row');
      showEmpty('No tracking data to display.');
      return;
    }
    const stage = currentStage();
    el.stageLine.textContent = 'Stage ' + stage + ' of ' + MAX_STAGE + ' \u2014 ' + statusOf(stage);
    renderProgress();
    renderJourney();
    renderTimeline();
    const nodes = el.progress.children.length;
    const cards = el.timeline.children.length;
    console.log('[track] rendered \u2014 progress nodes:', nodes, '\u00b7 timeline cards:', cards);
    setDebug('Rendered stage ' + stage + ' \u00b7 bar ' + nodes + ' nodes \u00b7 timeline ' + cards + ' cards');
  }

  // DEBUG (temporary): visible one-line status for quick testing.
  function setDebug(msg) {
    if (el.debug) el.debug.textContent = msg || '';
  }

  function showEmpty(msg) {
    el.empty.hidden = false;
    el.content.hidden = true;
    const h = el.empty.querySelector('h2');
    const p = el.empty.querySelector('p');
    if (msg) {
      h.textContent = 'Tracking unavailable';
      p.textContent = msg;
    } else {
      h.textContent = 'Start your project first';
      p.textContent = 'Create and save a house design to begin tracking your build.';
    }
  }

  function showContent() {
    el.empty.hidden = true;
    el.content.hidden = false;
  }

  // ---------- Auto-advance ----------
  // Advances the stage by however many full DEMO_STAGE_DURATION_MS windows have
  // elapsed since stage_started_at (capped at Stage 6), then persists the new
  // stage + timestamp to Supabase. ALWAYS renders afterwards — even if the
  // update fails, the local state is shown so the page is never empty.
  async function sync() {
    if (!row) { render(); return; }
    const cur = currentStage();
    const started = row.stage_started_at ? new Date(row.stage_started_at).getTime() : Date.now();
    const elapsed = Date.now() - started;
    const steps = Math.floor(elapsed / DEMO_STAGE_DURATION_MS);
    const stage = Math.min(MAX_STAGE, cur + steps);

    if (stage !== cur) {
      const newStartedAt = new Date(started + steps * DEMO_STAGE_DURATION_MS).toISOString();
      const res = await IB.supabase.from('project_tracking')
        .update({ current_stage: stage, stage_started_at: newStartedAt })
        .eq('id', row.id);
      if (res.error) {
        console.error('[track] stage advance update failed:', res.error);
        setDebug('Advance update error: ' + res.error.message + ' (showing local stage)');
      } else {
        row.current_stage = stage;
        row.stage_started_at = newStartedAt;
      }
    }
    render();
  }

  // ---------- Init ----------
  (async function () {
    try { session = await IB.ready; } catch (e) { /* redirected by guard */ }
    if (!session) return;

    try {
      // Fresh auth — don't trust a possibly stale guard session; ask Supabase.
      let user = null;
      try {
        const got = await IB.supabase.auth.getUser();
        if (got && got.error) console.error('[track] auth.getUser error:', got.error);
        user = (got && got.data && got.data.user) || null;
      } catch (e) {
        console.error('[track] auth.getUser threw:', e);
      }
      if (!user) user = session.user;
      const userId = user.id;
      console.log('[track] user_id =', userId);
      setDebug('user ' + userId + ' \u00b7 loading design\u2026');

      // ---- 1) Find the latest saved house design ----
      const designQuery = IB.supabase.from('house_designs')
        .select('id, product_line, size, user_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);
      const design = await designQuery.maybeSingle();
      console.log('[track] house_designs result:', { data: design.data, error: design.error });

      if (design.error) {
        console.error('[track] house_designs query failed:', design.error);
        setDebug('Design query error: ' + design.error.message);
        showEmpty('Could not load your design: ' + design.error.message);
        return;
      }
      if (!design.data) {
        setDebug('Design found: no \u00b7 rows returned: 0');
        showEmpty();
        return;
      }
      setDebug('Design found: yes \u00b7 rows returned: 1 \u00b7 design id ' + design.data.id);

      // ---- 2) Load the latest tracking row (or auto-create one at Stage 1) ----
      console.log('[track] auto-create check: querying latest project_tracking row for user...');
      const loaded = await IB.supabase.from('project_tracking')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      console.log('[track] project_tracking load result:', { data: loaded.data, error: loaded.error });

      if (loaded.error) {
        console.error('[track] project_tracking query failed:', loaded.error);
        setDebug('Tracking query error: ' + loaded.error.message);
        showEmpty('Could not load your tracking data: ' + loaded.error.message);
        return;
      }
      row = loaded.data;

      if (!row) {
        // Auto-create: insert row with current_stage = 1, stage_started_at = now(),
        // linked to the user's house_designs row.
        console.log('[track] auto-create: no existing row \u2014 inserting (current_stage=1, stage_started_at=now(), house_design_id=' + design.data.id + ')...');
        const created = await IB.supabase.from('project_tracking')
          .insert({
            user_id: userId,
            house_design_id: design.data.id,
            current_stage: 1,
            stage_started_at: new Date().toISOString()
          })
          .select()
          .single();
        console.log('[track] auto-create insert result:', { data: created.data, error: created.error });

        if (created.error) {
          console.error('[track] auto-create insert failed:', created.error);
          setDebug('Tracking create error: ' + created.error.message);
          showEmpty('Could not start tracking: ' + created.error.message);
          return;
        }
        row = created.data;

        if (!row) {
          // Insert succeeded but select-back returned nothing (e.g. a missing
          // SELECT policy on project_tracking) — re-fetch the row.
          console.warn('[track] insert succeeded but no row returned \u2014 re-fetching...');
          const refetch = await IB.supabase.from('project_tracking')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          console.log('[track] re-fetch result:', { data: refetch.data, error: refetch.error });
          if (refetch.error) {
            console.error('[track] re-fetch failed:', refetch.error);
            setDebug('Re-fetch error: ' + refetch.error.message);
            showEmpty('Could not read back the tracking row: ' + refetch.error.message);
            return;
          }
          row = refetch.data;
        }
        if (!row) {
          console.error('[track] auto-create: row is still null after insert + re-fetch');
          setDebug('Auto-create produced no readable row (check RLS SELECT policy on project_tracking)');
          showEmpty('Could not read back the tracking row after creating it. Check RLS policies on project_tracking.');
          return;
        }
        console.log('[track] auto-create OK \u2014 full row:', row);
        setDebug('Tracking row created at Stage 1.');
      } else {
        console.log('[track] existing row found \u2014 full row:', row);
        setDebug('Tracking row loaded \u00b7 stage ' + currentStage());
      }

      const activeIdx = Math.max(0, Math.min(5, currentStage() - 1));
      console.log('[track] current_stage =', row.current_stage, '\u2192 active stage label:', STAGES[activeIdx].name, '(stage 1 = "Contract Signed")');

      showContent();
      el.demoNote.textContent = 'Demo mode \u2014 stages advance automatically every ' + (DEMO_STAGE_DURATION_MS / 1000) + ' seconds.';
      await sync();
      pollTimer = setInterval(sync, POLL_INTERVAL_MS);
    } catch (err) {
      console.error('[track] init failed:', err);
      setDebug('Init error: ' + (err && err.message));
      showEmpty('Something went wrong while loading tracking: ' + (err && err.message));
    }
  })();
})();
