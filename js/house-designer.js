/**
 * InstaBuilt — House Designer (3D configurator) — entry module.
 *
 * Options panel (product line → size → material/colour → interior package →
 * smart-home → furniture), a live Three.js house, orbit + walkthrough modes,
 * and interior furnishing (click-to-place furniture). Saves the selected
 * options (not 3D state) to `house_designs`. WebGL-less browsers fall back to
 * the classic form (js/house-designer-fallback.js).
 */
import * as THREE from 'three';
import { PRODUCT_LINES, MATERIALS, INTERIOR_PACKAGES, SMART_HOME, DIMS, resolveConfig, toSavePayload } from './models-config.js';
import { createScene } from './three-scene.js';
import { createHouse, render, interiorBounds } from './house-configurator.js';
import { createOrbitMode } from './orbit-mode.js';
import { createWalkthroughMode } from './walkthrough-mode.js';
import { createInteriorDesigner, FURNITURE_CATALOG } from './interior-designer.js';

(async function () {
  'use strict';

  if (!document.documentElement.classList.contains('webgl')) return;

  const IB = window.INSTABUILT;
  if (!IB || !IB.supabase) return;

  // ---------- Options panel ----------
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

  const furnitureGroup = new THREE.Group();
  furnitureGroup.name = 'furniture';
  sceneCtx.scene.add(furnitureGroup);
  const interior = createInteriorDesigner(sceneCtx.scene, furnitureGroup, sceneCtx.renderer.domElement, sceneCtx.camera);

  let selection = readSelection();
  let config = resolveConfig(selection);
  render(house, config);

  const bounds = function () { return interiorBounds(resolveConfig(readSelection())); };
  interior.setBounds(bounds());

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
  const walkthrough = createWalkthroughMode(
    sceneCtx.camera,
    sceneCtx.renderer,
    bounds,
    function () { return interior.colliders(); }
  );

  const dv = defaultView();
  sceneCtx.camera.position.copy(dv.pos);
  orbit.setDefaults(dv.pos, dv.target);

  // ---------- Interior furnishing ----------
  const palette = document.getElementById('furniture-palette');
  const eraseBtn = document.getElementById('furniture-erase');
  let activeTool = null;

  function updateToolUI() {
    palette.querySelectorAll('.furniture-item').forEach(function (b) {
      b.classList.toggle('is-active', activeTool === 'place:' + b.dataset.id);
    });
    eraseBtn.classList.toggle('is-active', activeTool === 'erase');
  }

  function selectTool(kind, id) {
    if (kind === 'place' && activeTool === 'place:' + id) kind = null;
    else if (kind === 'erase' && activeTool === 'erase') kind = null;

    if (kind === 'place') {
      activeTool = 'place:' + id;
      interior.setTool({ kind: 'place', id: id });
      interior.showGhost(id);
    } else if (kind === 'erase') {
      activeTool = 'erase';
      interior.clearGhost();
      interior.setTool({ kind: 'erase' });
    } else {
      activeTool = null;
      interior.clearGhost();
      interior.setTool(null);
    }
    updateToolUI();
  }

  FURNITURE_CATALOG.forEach(function (def) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'furniture-item';
    b.dataset.id = def.id;
    b.textContent = def.label;
    b.addEventListener('click', function () { selectTool('place', def.id); });
    palette.appendChild(b);
  });
  eraseBtn.addEventListener('click', function () { selectTool('erase'); });

  // Seed a default furnished interior.
  function seedLayout() {
    const b = bounds();
    const cx = (b.minX + b.maxX) / 2;
    interior.placeAt('rug', cx - 0.6, b.minZ + 1.6);
    interior.placeAt('couch', cx - 1.4, b.minZ + 1.1);
    interior.placeAt('coffee-table', cx - 1.4, b.minZ + 2.3);
    interior.placeAt('floor-lamp', b.maxX - 1.1, b.minZ + 1.1);
    interior.placeAt('tv', cx + 1.3, b.minZ + 0.7);
  }

  function applyPackageAccent() {
    const pkg = INTERIOR_PACKAGES.find(function (p) { return p.id === readSelection().interiorId; }) || INTERIOR_PACKAGES[0];
    const b = bounds();
    if ((pkg.accent === 'kitchen' || pkg.accent === 'kitchen+bath') && !interior.hasItem('kitchen-counter')) {
      interior.placeAt('kitchen-counter', b.minX + 2.2, b.maxZ - 1.4);
    }
    if (pkg.accent === 'kitchen+bath' && !interior.hasItem('bathpod')) {
      interior.placeAt('bathpod', b.maxX - 1.6, b.minZ + 1.4);
    }
  }

  seedLayout();
  applyPackageAccent();

  // ---------- Modes ----------
  let mode = 'orbit';

  function setMode(next) {
    mode = next;
    document.querySelectorAll('[data-mode]').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-mode') === next);
    });
    const hint = document.getElementById('walkthrough-hint');
    if (next === 'walkthrough') {
      orbit.disable();
      interior.clearGhost();
      interior.setTool(null);
      activeTool = null;
      updateToolUI();
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

  viewer.addEventListener('click', function () {
    if (mode === 'walkthrough' && !walkthrough.isLocked()) walkthrough.requestLock();
  });

  document.getElementById('reset-view').addEventListener('click', function () {
    if (mode === 'walkthrough') walkthrough.enable();
    else {
      const d = defaultView();
      sceneCtx.camera.position.copy(d.pos);
      orbit.setTarget(d.target);
      orbit.update();
    }
  });

  // ---------- Live updates ----------
  function onSelectionChange() {
    selection = readSelection();
    config = resolveConfig(selection);
    render(house, config);
    interior.setBounds(bounds());
    interior.clampAll();
    const cy = (config.line.storeys * DIMS.wallHeight) / 2;
    if (mode === 'orbit') orbit.setTarget(new THREE.Vector3(0, cy, 0));
  }

  lineSel.addEventListener('change', function () { refreshSizes(); onSelectionChange(); });
  sizeSel.addEventListener('change', onSelectionChange);
  [materialGroup, interiorGroup, smartGroup].forEach(function (g) {
    g.addEventListener('change', onSelectionChange);
  });
  interiorGroup.addEventListener('change', applyPackageAccent);

  // ---------- Save flow ----------
  const status = document.querySelector('.designer-panel .form-status');
  function setStatus(msg, ok) {
    status.textContent = msg;
    status.className = 'form-status ' + (ok ? 'form-status--ok' : 'form-status--err') + ' is-visible';
  }

  document.getElementById('save-design').addEventListener('click', function (e) {
    const btn = e.currentTarget;
    const payload = toSavePayload(session.user.id, readSelection());
    interior.summary().forEach(function (s) { payload.interior_selections.push('Furniture: ' + s); });
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
