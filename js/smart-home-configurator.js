/**
 * InstaBuilt — smart-home configurator (module).
 *
 * Two synced views:
 *   View 1 (House Diagram): clickable floor-plan rooms → a popover of features
 *                           grouped by category, each a toggle.
 *   View 2 (Control Panel): a mock smart-home app showing every selected
 *                           feature as a realistic (non-functional) control.
 * Selection saves (debounced) to `smart_home_selections`.
 */
import { ROOMS, CATEGORIES, FEATURES, FEATURE_BY_ID, CONTROL_ICON } from './smart-home-config.js';

(async function () {
  'use strict';

  const IB = window.INSTABUILT;
  if (!IB || !IB.supabase) return;

  const VIEW_W = 360;
  const VIEW_H = 330;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  const selected = new Set();
  let currentRoom = null;

  const floorplan = document.getElementById('floorplan');
  const wrap = document.getElementById('diagram-wrap');
  const popover = document.getElementById('popover');
  const popoverTitle = document.getElementById('popover-title');
  const popoverBody = document.getElementById('popover-body');
  const panel = document.getElementById('panel');
  const saveStatus = document.getElementById('save-status');

  // ---------- Build the floor plan ----------
  const dotEls = new Map(); // roomId -> {group, text}

  function svgEl(tag, attrs, text) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (text != null) el.textContent = text;
    return el;
  }

  ROOMS.forEach(function (room) {
    const fill = room.garden ? '#dde6d0' : '#f3f2ee';

    floorplan.appendChild(svgEl('rect', {
      x: room.x, y: room.y, width: room.w, height: room.h,
      rx: 4, fill: fill, stroke: '#d2d0c9', 'stroke-width': 1.5,
      'data-room': room.id, 'class': 'smart-room', 'role': 'button', 'tabindex': '0',
      'aria-label': room.label
    }));

    floorplan.appendChild(svgEl('text', {
      x: room.x + room.w / 2, y: room.y + room.h / 2,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      fill: '#6b6b68', 'font-size': 13, 'font-weight': 600,
      'font-family': 'Outfit, Segoe UI, sans-serif', 'class': 'smart-room-label'
    }, room.label));

    // selection dot (top-right corner of the room)
    const group = svgEl('g', { 'class': 'smart-dot', 'data-room': room.id, opacity: 0 });
    group.appendChild(svgEl('circle', { cx: room.x + room.w - 16, cy: room.y + 16, r: 9, fill: '#6b7c3f' }));
    const count = svgEl('text', {
      x: room.x + room.w - 16, y: room.y + 16,
      'text-anchor': 'middle', 'dominant-baseline': 'central',
      fill: '#ffffff', 'font-size': 11, 'font-weight': 700, 'font-family': 'Outfit, Segoe UI, sans-serif'
    });
    group.appendChild(count);
    floorplan.appendChild(group);
    dotEls.set(room.id, { group: group, text: count });
  });

  // ---------- Selection helpers ----------
  function roomFeatures(roomId) { return FEATURES.filter(function (f) { return f.room === roomId; }); }
  function roomCategories(roomId) {
    return CATEGORIES.filter(function (c) {
      return roomFeatures(roomId).some(function (f) { return f.category === c; });
    });
  }
  function selectedCount(roomId) {
    return roomFeatures(roomId).filter(function (f) { return selected.has(f.id); }).length;
  }

  function toggleFeature(id) {
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    renderDiagram();
    renderPanel();
    if (currentRoom) renderPopover(currentRoom);
    scheduleSave();
  }

  // ---------- View 1: diagram ----------
  function renderDiagram() {
    ROOMS.forEach(function (room) {
      const d = dotEls.get(room.id);
      const n = selectedCount(room.id);
      d.group.setAttribute('opacity', n > 0 ? '1' : '0');
      d.text.textContent = n;
    });
    document.getElementById('feature-count').textContent = selected.size + (selected.size === 1 ? ' feature' : ' features');
  }

  function renderPopover(roomId) {
    const room = ROOMS.find(function (r) { return r.id === roomId; });
    popoverTitle.textContent = room.label;
    popoverBody.innerHTML = '';
    roomCategories(roomId).forEach(function (cat) {
      const section = document.createElement('div');
      section.className = 'smart-popover-cat';
      const h = document.createElement('div');
      h.className = 'smart-popover-cat__title';
      h.textContent = cat;
      section.appendChild(h);
      roomFeatures(roomId).filter(function (f) { return f.category === cat; }).forEach(function (f) {
        const label = document.createElement('label');
        label.className = 'smart-feature';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.dataset.feature = f.id;
        input.checked = selected.has(f.id);
        const name = document.createElement('span');
        name.className = 'smart-feature__name';
        name.textContent = f.label;
        const price = document.createElement('span');
        price.className = 'smart-feature__price';
        price.textContent = '+€' + f.price.toLocaleString('en-US');
        label.appendChild(input);
        label.appendChild(name);
        label.appendChild(price);
        section.appendChild(label);
      });
      popoverBody.appendChild(section);
    });
  }

  function openPopover(roomId) {
    currentRoom = roomId;
    renderPopover(roomId);
    popover.hidden = false;
    positionPopover(ROOMS.find(function (r) { return r.id === roomId; }));
  }

  function closePopover() {
    popover.hidden = true;
    currentRoom = null;
  }

  function positionPopover(room) {
    const wrapRect = wrap.getBoundingClientRect();
    const svgRect = floorplan.getBoundingClientRect();
    const scale = svgRect.width / VIEW_W;
    const cx = (room.x + room.w / 2) * scale;
    const cy = (room.y + room.h / 2) * scale;
    const popW = popover.offsetWidth || 260;
    const popH = popover.offsetHeight || 340;
    let left = cx + 14;
    let top = cy - popH / 2;
    left = Math.min(left, wrapRect.width - popW - 10);
    top = Math.max(10, Math.min(top, wrapRect.height - popH - 10));
    popover.style.left = left + 'px';
    popover.style.top = top + 'px';
  }

  // ---------- View 2: control panel ----------
  function deviceBody(f) {
    switch (f.control) {
      case 'light':
      case 'entertainment':
        return '<input type="range" class="smart-range" min="0" max="100" value="' + (f.control === 'light' ? 80 : 55) + '" aria-label="' + f.label + ' level">';
      case 'thermostat':
        return '<div class="smart-dial-wrap">' +
          '<svg class="smart-dial" viewBox="0 0 80 80" aria-hidden="true">' +
          '<circle cx="40" cy="40" r="33" fill="none" stroke="#2c3137" stroke-width="6"/>' +
          '<circle cx="40" cy="40" r="33" fill="none" stroke="#6b7c3f" stroke-width="6" stroke-dasharray="150 207" stroke-linecap="round" transform="rotate(-120 40 40)"/>' +
          '<line x1="40" y1="40" x2="40" y2="17" stroke="#e8eaec" stroke-width="3" stroke-linecap="round" transform="rotate(15 40 40)"/>' +
          '<text x="40" y="58" text-anchor="middle" fill="#c7ccd1" font-size="13" font-family="Outfit, sans-serif">21.5°</text>' +
          '</svg></div>';
      case 'camera':
        return '<div class="smart-feed"><span class="smart-feed__dot"></span> Live preview</div>';
      case 'irrigation':
        return '<div class="smart-status">Zone · Auto</div>';
      case 'lock':
        return '<div class="smart-status">Locked</div>';
      case 'sensor':
        return '<div class="smart-readout">22.5° · 45% RH</div>';
      default:
        return '<div class="smart-status">Auto</div>';
    }
  }

  function renderPanel() {
    const ids = Array.from(selected);
    if (!ids.length) {
      panel.innerHTML = '<div class="smart-empty"><div class="smart-empty__icon">🏠</div>' +
        '<p>No smart features selected yet.</p>' +
        '<p class="smart-empty__sub">Switch to the House Diagram and click a room to add connected devices.</p></div>';
      return;
    }
    panel.innerHTML = '';
    CATEGORIES.forEach(function (cat) {
      const inCat = ids.map(function (id) { return FEATURE_BY_ID[id]; }).filter(function (f) { return f && f.category === cat; });
      if (!inCat.length) return;
      const section = document.createElement('section');
      section.className = 'smart-cat';
      const h = document.createElement('h3');
      h.className = 'smart-cat__title';
      h.textContent = cat;
      section.appendChild(h);
      const grid = document.createElement('div');
      grid.className = 'smart-cat__grid';
      inCat.forEach(function (f) {
        const card = document.createElement('div');
        card.className = 'smart-device';
        card.innerHTML =
          '<div class="smart-device__head">' +
            '<span class="smart-device__icon">' + (CONTROL_ICON[f.control] || '🔘') + '</span>' +
            '<span class="smart-device__name">' + f.label + '</span>' +
            '<button type="button" class="smart-device__switch is-on" data-toggle="' + f.id + '" aria-label="Remove ' + f.label + '"></button>' +
          '</div>' +
          '<div class="smart-device__body">' + deviceBody(f) + '</div>';
        grid.appendChild(card);
      });
      section.appendChild(grid);
      panel.appendChild(section);
    });
  }

  // ---------- Event delegation ----------
  floorplan.addEventListener('click', function (e) {
    const roomRect = e.target.closest && e.target.closest('rect[data-room]');
    if (!roomRect) { closePopover(); return; }
    const id = roomRect.getAttribute('data-room');
    openPopover(id);
  });
  floorplan.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.getAttribute && e.target.getAttribute('data-room')) {
      e.preventDefault();
      openPopover(e.target.getAttribute('data-room'));
    }
  });

  popoverBody.addEventListener('change', function (e) {
    if (e.target.dataset.feature) toggleFeature(e.target.dataset.feature);
  });
  document.getElementById('popover-close').addEventListener('click', closePopover);
  document.addEventListener('click', function (e) {
    if (!popover.hidden && !popover.contains(e.target) && !e.target.closest('rect[data-room]')) closePopover();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePopover(); });

  panel.addEventListener('click', function (e) {
    const sw = e.target.closest && e.target.closest('[data-toggle]');
    if (sw) toggleFeature(sw.getAttribute('data-toggle'));
  });

  // ---------- View toggle ----------
  document.querySelectorAll('[data-view]').forEach(function (b) {
    b.addEventListener('click', function () {
      const view = b.getAttribute('data-view');
      document.querySelectorAll('[data-view]').forEach(function (x) { x.classList.toggle('is-active', x === b); });
      document.getElementById('view-diagram').hidden = view !== 'diagram';
      document.getElementById('view-panel').hidden = view !== 'panel';
      if (view === 'panel') { closePopover(); renderPanel(); }
    });
  });

  // ---------- Debounced save ----------
  let designId = null;
  let saveTimer = null;
  let statusTimer = null;

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 500);
  }

  function showSaveStatus(ok, msg) {
    saveStatus.textContent = ok ? 'Selection saved ✓' : (msg || 'Could not save selection');
    saveStatus.classList.toggle('is-error', !ok);
    saveStatus.classList.add('is-visible');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { saveStatus.classList.remove('is-visible'); }, ok ? 2200 : 4500);
  }

  function save() {
    IB.supabase.from('smart_home_selections')
      .insert({
        user_id: session.user.id,
        house_design_id: designId || null,
        features: Array.from(selected)
      })
      .then(function (res) {
        if (res.error) showSaveStatus(false, res.error.message);
        else showSaveStatus(true);
      });
  }

  // ---------- Init ----------
  let session = null;
  try { session = await IB.ready; } catch (e) { /* redirected by guard */ }
  if (!session) return;

  async function loadState() {
    const res = await IB.supabase.from('smart_home_selections')
      .select('features')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (res.data && Array.isArray(res.data.features)) {
      res.data.features.forEach(function (id) { if (FEATURE_BY_ID[id]) selected.add(id); });
    }

    const design = await IB.supabase.from('house_designs')
      .select('id')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (design.data) designId = design.data.id;
  }

  await loadState();
  renderDiagram();
  renderPanel();

  window.addEventListener('resize', function () {
    if (!popover.hidden && currentRoom) positionPopover(ROOMS.find(function (r) { return r.id === currentRoom; }));
  });
})();
