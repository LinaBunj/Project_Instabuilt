/**
 * InstaBuilt — House Designer (3D configurator) — entry module.
 *
 * Builds the options panel, lazy-inits the Three.js scene, drives orbit /
 * walkthrough modes, and saves the selected options (not 3D state) to the
 * `house_designs` table. If WebGL is unavailable the page falls back to the
 * classic preset form (js/house-designer-fallback.js).
 */
import * as THREE from 'three';
import { PRODUCT_LINES, MATERIALS, INTERIOR_PACKAGES, SMART_HOME, DIMS, resolveConfig, toSavePayload } from './models-config.js';
import { createScene } from './three-scene.js';
import { createHouse, render, interiorBounds } from './house-configurator.js';
import { createOrbitMode } from './orbit-mode.js';
import { createWalkthroughMode } from './walkthrough-mode.js';

(async function () {
  'use strict';

  if (!document.documentElement.classList.contains('webgl')) return;

  const IB = window.INSTABUILT;
  if (!IB || !IB.supabase) return;

  // ---------- Build the options panel ----------
  const lineSel = document.getElementById('product_line');
  const sizeSel = document.getElementById('size');
  const materialGroup = document.getElementById('materials');
  const interiorGroup = document.getElementById('interiors');
  const smartGroup = document.getElementById('smart');

  function fillSelect(sel, options) {
    sel.innerHTML = '';
    options.forEach(function (o) {
      const opt = document.createElement('option');
      opt.value = o;
      opt.textContent = o;
      sel.appendChild(opt);
    });
  }

  function fillChips(group, items, type, isMulti) {
    group.innerHTML = '';
    items.forEach(function (item, idx) {
      const label = document.createElement('label');
      label.className = 'chip';
      const input = document.createElement('input');
      input.type = isMulti ? 'checkbox' : 'radio';
      input.name = type;
      input.value = item.id;
      if (!isMulti && idx === 0) input.checked = true;
      const swatch = document.createElement('span');
      swatch.className = 'chip__swatch';
      if (type === 'material') swatch.style.background = '#' + item.wall.toString(16).padStart(6, '0');
      const text = document.createElement('span');
      text.className = 'chip__label';
      text.textContent = item.label;
      label.appendChild(input);
      if (type === 'material') label.appendChild(swatch);
      label.appendChild(text);
      group.appendChild(label);
    });
  }

  function refreshSizes() {
    const line = PRODUCT_LINES.find(function (l) { return l.label === lineSel.value; }) || PRODUCT_LINES[0];
    fillSelect(sizeSel, line.sizes);
  }

  fillSelect(lineSel, PRODUCT_LINES.map(function (l) { return l.label; }));
  refreshSizes();
  fillChips(materialGroup, MATERIALS, 'material', false);
  fillChips(interiorGroup, INTERIOR_PACKAGES, 'interior', false);
  fillChips(smartGroup, SMART_HOME, 'smart', true);

  // ---------- Read current selection ----------
  function readSelection() {
    const material = materialGroup.querySelector('input[name="material"]:checked');
    const interior = interiorGroup.querySelector('input[name="interior"]:checked');
    const smartIds = Array.prototype.map.call(
      smartGroup.querySelectorAll('input[name="smart"]:checked'),
      function (i) { return i.value; }
    );
    return {
      productLine: lineSel.value,
      size: sizeSel.value,
      materialId: material ? material.value : MATERIALS[0].id,
      interiorId: interior ? interior.value : INTERIOR_PACKAGES[0].id,
      smartIds: smartIds
    };
  }

  // Wait for auth
  let session = null;
  try { session = await IB.ready; } catch (e) { /* redirected by guard */ }
  if (!session) return;

  // ---------- Init 3D ----------
  const viewer = document.getElementById('viewer');
  const sceneCtx = createScene(viewer);
  const house = createHouse();
  sceneCtx.scene.add(house);

  let selection = readSelection();
  let config = resolveConfig(selection);
  render(house, config);

  const centerY = (config.line.storeys * DIMS.wallHeight) / 2;

  function defaultView() {
    const c = resolveConfig(readSelection());
    const dist = Math.max(c.width, c.depth) * 1.35 + 6;
    const h = c.line.storeys * DIMS.wallHeight;
    return {
      pos: new THREE.Vector3(dist * 0.9, h * 0.5 + dist * 0.45, dist),
      target: new THREE.Vector3(0, h * 0.35, 0)
    };
  }

  const orbit = createOrbitMode(sceneCtx.scene, sceneCtx.camera, sceneCtx.renderer);
  const walkthrough = createWalkthroughMode(sceneCtx.camera, sceneCtx.renderer, function () {
    return interiorBounds(resolveConfig(readSelection()));
  });

  const dv = defaultView();
  sceneCtx.camera.position.copy(dv.pos);
  orbit.setDefaults(dv.pos, dv.target);

  let mode = 'orbit';

  function setMode(next) {
    mode = next;
    document.querySelectorAll('[data-mode]').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-mode') === next);
    });
    const hint = document.getElementById('walkthrough-hint');
    if (next === 'walkthrough') {
      orbit.disable();
      walkthrough.enable();
      if (hint) hint.classList.add('is-visible');
    } else {
      walkthrough.disable();
      orbit.enable();
      const d = defaultView();
      sceneCtx.camera.position.copy(d.pos);
      orbit.setTarget(d.target);
      orbit.update();
      if (hint) hint.classList.remove('is-visible');
    }
  }

  document.querySelectorAll('[data-mode]').forEach(function (b) {
    b.addEventListener('click', function () { setMode(b.getAttribute('data-mode')); });
  });

  // Click to look in walkthrough (pointer lock)
  viewer.addEventListener('click', function () {
    if (mode === 'walkthrough' && !walkthrough.isLocked()) walkthrough.requestLock();
  });

  // Reset view
  document.getElementById('reset-view').addEventListener('click', function () {
    if (mode === 'walkthrough') walkthrough.enable();
    else {
      const d = defaultView();
      sceneCtx.camera.position.copy(d.pos);
      orbit.setTarget(d.target);
      orbit.update();
    }
  });

  // ---------- Live updates on selection change ----------
  function onSelectionChange() {
    selection = readSelection();
    config = resolveConfig(selection);
    render(house, config);
    const c = config;
    const cy = (c.line.storeys * DIMS.wallHeight) / 2;
    if (mode === 'orbit') orbit.setTarget(new THREE.Vector3(0, cy, 0));
  }

  [lineSel, sizeSel].forEach(function (el) { el.addEventListener('change', onSelectionChange); });
  [materialGroup, interiorGroup, smartGroup].forEach(function (g) {
    g.addEventListener('change', onSelectionChange);
  });
  lineSel.addEventListener('change', refreshSizes);

  // ---------- Save flow ----------
  const status = document.querySelector('.designer-panel .form-status');
  function setStatus(msg, ok) {
    status.textContent = msg;
    status.className = 'form-status ' + (ok ? 'form-status--ok' : 'form-status--err') + ' is-visible';
  }

  document.getElementById('save-design').addEventListener('click', function (e) {
    const btn = e.currentTarget;
    const payload = toSavePayload(session.user.id, readSelection());
    btn.disabled = true;
    setStatus('Saving…', true);
    IB.supabase.from('house_designs')
      .insert(payload)
      .select()
      .single()
      .then(function (res) {
        if (res.error) { btn.disabled = false; setStatus(res.error.message, false); return; }
        setStatus('Design saved — opening your estimate…', true);
        window.location.href = 'price-calculator.html?design=' + encodeURIComponent(res.data.id);
      })
      .catch(function (err) {
        btn.disabled = false;
        setStatus((err && err.message) || 'Could not save design.', false);
      });
  });

  // ---------- Start render loop + reveal ----------
  sceneCtx.start(function (dt) {
    if (mode === 'orbit') orbit.update();
    else walkthrough.update(dt);
  });

  const loading = document.getElementById('viewer-loading');
  if (loading) loading.classList.add('is-hidden');
  document.documentElement.classList.add('designer-3d-ready');
  window.INSTABUILT._designer3dReady = true;
})();
