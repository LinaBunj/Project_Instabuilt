/**
 * InstaBuilt — project tracking (module).
 *
 * Replaces the "coming soon" placeholder with a live build-tracking view:
 *   - horizontal progress bar (6 fixed stages, completed/current/upcoming)
 *   - vertical timeline (one card per stage with status + description)
 *
 * There is no real order system yet, so the build auto-simulates:
 *   - on first visit with a saved house design but no tracking row, a row is
 *     created at Stage 1;
 *   - on load + on a lightweight interval, the stage advances once enough time
 *     has passed (DEMO_STAGE_DURATION_MS), capped at Stage 6, and the new
 *     stage + timestamp are written back to Supabase.
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
    journeyStatus: document.getElementById('track-journey-status')
  };

  let session = null;
  let row = null;       // the active project_tracking row
  let pollTimer = null;

  function statusOf(stageNum) {
    if (stageNum < row.current_stage) return 'Completed';
    if (stageNum === row.current_stage) return 'In Progress';
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
    buildSteps(el.progress, STAGES, row.current_stage - 1);
  }

  // ---------- Company build journey (started? which phase?) ----------
  function renderJourney() {
    el.journeyStatus.textContent = journeyStatus(row.current_stage);
    buildSteps(el.journey, JOURNEY, journeyIndex(row.current_stage));
  }

  // ---------- Vertical timeline ----------
  function renderTimeline() {
    el.timeline.innerHTML = '';
    STAGES.forEach(function (s, i) {
      const num = i + 1;
      const li = document.createElement('li');
      li.className = 'track-card';
      if (num < row.current_stage) li.classList.add('is-done');
      else if (num === row.current_stage) li.classList.add('is-current');
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
    el.stageLine.textContent = 'Stage ' + row.current_stage + ' of ' + MAX_STAGE + ' \u2014 ' + statusOf(row.current_stage);
    renderProgress();
    renderJourney();
    renderTimeline();
  }

  function showEmpty() {
    el.empty.hidden = false;
    el.content.hidden = true;
  }

  function showContent() {
    el.empty.hidden = true;
    el.content.hidden = false;
  }

  // ---------- Auto-advance ----------
  // Advances the stage by however many full DEMO_STAGE_DURATION_MS windows have
  // elapsed since stage_started_at (capped at Stage 6), then persists the new
  // stage + timestamp to Supabase.
  async function sync() {
    const started = row.stage_started_at ? new Date(row.stage_started_at).getTime() : Date.now();
    const elapsed = Date.now() - started;
    const steps = Math.floor(elapsed / DEMO_STAGE_DURATION_MS);
    const stage = Math.min(MAX_STAGE, row.current_stage + steps);

    if (stage !== row.current_stage) {
      const newStartedAt = new Date(started + steps * DEMO_STAGE_DURATION_MS).toISOString();
      const res = await IB.supabase.from('project_tracking')
        .update({ current_stage: stage, stage_started_at: newStartedAt })
        .eq('id', row.id);
      if (res.error) return; // keep local state; retry next tick
      row.current_stage = stage;
      row.stage_started_at = newStartedAt;
    }
    render();
  }

  // ---------- Init ----------
  (async function () {
    try { session = await IB.ready; } catch (e) { /* redirected by guard */ }
    if (!session) return;

    const userId = session.user.id;

    // A tracking project requires a saved house design.
    const design = await IB.supabase.from('house_designs')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!design.data) { showEmpty(); return; }

    // Load the latest tracking row (or create one at Stage 1).
    const loaded = await IB.supabase.from('project_tracking')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    row = loaded.data;

    if (!row) {
      const created = await IB.supabase.from('project_tracking')
        .insert({
          user_id: userId,
          house_design_id: design.data.id,
          current_stage: 1,
          stage_started_at: new Date().toISOString()
        })
        .select()
        .single();
      if (created.error) { showEmpty(); return; }
      row = created.data;
    }

    showContent();
    el.demoNote.textContent = 'Demo mode \u2014 stages advance automatically every ' + (DEMO_STAGE_DURATION_MS / 1000) + ' seconds.';
    await sync();
    pollTimer = setInterval(sync, POLL_INTERVAL_MS);
  })();
})();
