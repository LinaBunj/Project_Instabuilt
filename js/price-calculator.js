/**
 * InstaBuilt — live price calculator.
 *
 * Embeds the same preset selectors as the house designer (product line → size →
 * material → interior package → add-ons) and recalculates the price instantly
 * on every change (no "Calculate" button). Each change is debounce-saved to the
 * `price_estimates` table, linked to the user's latest `house_designs` row.
 *
 * Works standalone: if the user has no saved design, it starts from the base
 * configuration and creates a default design row to link estimates to.
 *
 * To swap in real InstaBuilt pricing, edit PRICING_CONFIG below — nothing else.
 */
import { PRODUCT_LINES, MATERIALS, INTERIOR_PACKAGES, SMART_HOME, parseArea } from './models-config.js';
import { FEATURES, FEATURE_BY_ID } from './smart-home-config.js';

(async function () {
  'use strict';

  const IB = window.INSTABUILT;
  if (!IB || !IB.supabase) return;

  /* =========================================================================
     PRICING_CONFIG — placeholder pricing formula.
     Each option maps to a cost that is summed together:
       total = area × basePerSqm[line] × materialMultiplier
             + interiorPackages[pkg] + Σ addons
     Replace these values with real InstaBuilt pricing when it's available.
     ========================================================================= */
  const PRICING_CONFIG = {
    // Base build cost, EUR per square metre, by product line.
    basePerSqm: {
      'POP UP Solutions': 2200,
      'Multistory Multifamily': 2600,
      'Senior Housing': 2700,
      'Micro Apartments': 2400,
      'Traditional Homes': 2500,
      'Signature Homes': 3200,
      'Bathpods': 1800
    },
    // Exterior material multiplier (1.0 = no change), keyed by material key.
    materialMultipliers: {
      'Timber': 1.0,
      'Render': 0.95,
      'Brick-slip': 1.15,
      'Metal': 1.25
    },
    // Interior package fixed add-on, EUR.
    interiorPackages: {
      'Standard': 0,
      'Comfort': 21000,
      'Premium': 39000
    },
    // Optional add-ons, fixed cost each, EUR.
    addons: {
      'Smart-home package': 8000,
      'Solar roof': 6000,
      'Battery storage': 4000
    },
    // Granular smart-home devices (EUR), sourced from js/smart-home-config.js.
    smartHomeFeatures: FEATURES.reduce(function (m, f) { m[f.id] = f.price; return m; }, {})
  };

  // ---------- UI ----------
  const lineSel = document.getElementById('product_line');
  const sizeSel = document.getElementById('size');
  const materialGroup = document.getElementById('materials');
  const interiorGroup = document.getElementById('interiors');
  const addonGroup = document.getElementById('addons');

  function fillSelect(sel, options) {
    sel.innerHTML = '';
    options.forEach(function (o) {
      const opt = document.createElement('option');
      opt.value = o;
      opt.textContent = o;
      sel.appendChild(opt);
    });
  }

  function fillChips(group, items, type, isMulti, swatchKey) {
    group.innerHTML = '';
    items.forEach(function (item, idx) {
      const label = document.createElement('label');
      label.className = 'chip';
      const input = document.createElement('input');
      input.type = isMulti ? 'checkbox' : 'radio';
      input.name = type;
      input.value = item.id;
      if (!isMulti && idx === 0) input.checked = true;
      label.appendChild(input);
      if (swatchKey) {
        const swatch = document.createElement('span');
        swatch.className = 'chip__swatch';
        swatch.style.background = '#' + item[swatchKey].toString(16).padStart(6, '0');
        label.appendChild(swatch);
      }
      const text = document.createElement('span');
      text.className = 'chip__label';
      text.textContent = item.label;
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
  fillChips(materialGroup, MATERIALS, 'material', false, 'wall');
  fillChips(interiorGroup, INTERIOR_PACKAGES, 'interior', false, null);
  fillChips(addonGroup, SMART_HOME, 'addon', true, null);

  function readSelection() {
    const material = materialGroup.querySelector('input[name="material"]:checked');
    const interior = interiorGroup.querySelector('input[name="interior"]:checked');
    const addonIds = Array.prototype.map.call(
      addonGroup.querySelectorAll('input[name="addon"]:checked'),
      function (i) { return i.value; }
    );
    return {
      productLine: lineSel.value,
      size: sizeSel.value,
      materialId: material ? material.value : MATERIALS[0].id,
      interiorId: interior ? interior.value : INTERIOR_PACKAGES[0].id,
      addonIds: addonIds
    };
  }

  function materialFor(sel) { return MATERIALS.find(function (m) { return m.id === sel.materialId; }) || MATERIALS[0]; }
  function interiorFor(sel) { return INTERIOR_PACKAGES.find(function (p) { return p.id === sel.interiorId; }) || INTERIOR_PACKAGES[0]; }

  // ---------- Compute ----------
  function money(n) {
    return '€' + Math.round(n).toLocaleString('en-US');
  }

  function compute(sel) {
    const line = PRODUCT_LINES.find(function (l) { return l.label === sel.productLine; }) || PRODUCT_LINES[0];
    const area = parseArea(sel.size);
    const material = materialFor(sel);
    const interior = interiorFor(sel);
    const addons = sel.addonIds.map(function (id) { return SMART_HOME.find(function (s) { return s.id === id; }); }).filter(Boolean);

    const baseRate = PRICING_CONFIG.basePerSqm[line.label] || 2200;
    const base = area * baseRate;
    const mult = PRICING_CONFIG.materialMultipliers[material.key] != null ? PRICING_CONFIG.materialMultipliers[material.key] : 1;
    const materialAdj = base * (mult - 1);
    const interiorCost = PRICING_CONFIG.interiorPackages[interior.label] || 0;
    const addonCost = addons.reduce(function (sum, a) { return sum + (PRICING_CONFIG.addons[a.label] || 0); }, 0);
    let total = base + materialAdj + interiorCost + addonCost;

    const lines = [];
    lines.push({ label: 'Base build — ' + line.label + ' · ' + sel.size + ' (' + area + ' m² @ ' + money(baseRate) + '/m²)', amount: base });
    if (Math.abs(materialAdj) > 0.5) lines.push({ label: 'Material finish — ' + material.label, amount: materialAdj });
    if (interiorCost > 0) lines.push({ label: 'Interior package — ' + interior.label, amount: interiorCost });
    addons.forEach(function (a) {
      const c = PRICING_CONFIG.addons[a.label] || 0;
      if (c > 0) lines.push({ label: 'Add-on — ' + a.label, amount: c });
    });

    // Smart-home devices selected in the Smart-Home Configurator.
    smartHomeIds.forEach(function (id) {
      const price = PRICING_CONFIG.smartHomeFeatures[id];
      if (price) {
        const f = FEATURE_BY_ID[id];
        lines.push({ label: 'Smart-home — ' + (f ? f.label : id), amount: price });
        total += price;
      }
    });

    return { lines: lines, total: total, area: area, currency: 'EUR' };
  }

  function render(est) {
    const tbody = document.getElementById('breakdown');
    tbody.innerHTML = '';
    est.lines.forEach(function (l) {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.setAttribute('scope', 'row');
      th.textContent = l.label;
      const td = document.createElement('td');
      td.textContent = money(l.amount);
      tr.appendChild(th);
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
    document.getElementById('total').textContent = money(est.total);
  }

  // ---------- Debounced save to price_estimates ----------
  let designId = null;
  let smartHomeIds = [];
  let saveTimer = null;
  let statusTimer = null;
  const SAVE_DEBOUNCE_MS = 500;

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, SAVE_DEBOUNCE_MS);
  }

  function showSaveStatus(ok, msg) {
    const el = document.getElementById('save-status');
    if (!el) return;
    el.textContent = ok ? 'Estimate saved ✓' : (msg || 'Could not save estimate');
    el.classList.toggle('is-error', !ok);
    el.classList.add('is-visible');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { el.classList.remove('is-visible'); }, ok ? 2200 : 4500);
  }

  function save() {
    if (!designId) return;
    const est = compute(readSelection());

    // Persist only the estimate, linked to the user's design row. (The design
    // itself is owned by the house designer; we don't overwrite it here.)
    IB.supabase.from('price_estimates')
      .insert({
        design_id: designId,
        estimate_amount: Math.round(est.total),
        currency: est.currency,
        details: { lines: est.lines, area: est.area }
      })
      .then(function (res) {
        if (res.error) showSaveStatus(false, res.error.message);
        else showSaveStatus(true);
      });
  }

  // ---------- Live recompute on change ----------
  function onAnyChange() {
    render(compute(readSelection()));
    scheduleSave();
  }

  lineSel.addEventListener('change', function () { refreshSizes(); onAnyChange(); });
  sizeSel.addEventListener('change', onAnyChange);
  [materialGroup, interiorGroup, addonGroup].forEach(function (g) { g.addEventListener('change', onAnyChange); });

  // ---------- Init ----------
  let session = null;
  try { session = await IB.ready; } catch (e) { /* redirected by guard */ }
  if (!session) return;

  function applyDesign(design) {
    if (PRODUCT_LINES.some(function (l) { return l.label === design.product_line; })) {
      lineSel.value = design.product_line;
      refreshSizes();
    }
    if (Array.prototype.some.call(sizeSel.options, function (o) { return o.value === design.size; })) {
      sizeSel.value = design.size;
    }

    const matKey = (design.materials && design.materials[0]) || '';
    const matToken = (design.materials && design.materials[1]) || '';
    const mat = MATERIALS.find(function (m) { return m.key === matKey && m.token === matToken; }) ||
                MATERIALS.find(function (m) { return m.key === matKey; });
    if (mat) {
      const input = materialGroup.querySelector('input[value="' + mat.id + '"]');
      if (input) input.checked = true;
    }

    const stored = design.interior_selections || [];
    const sorted = INTERIOR_PACKAGES.slice().sort(function (a, b) { return b.items.length - a.items.length; });
    let pkg = INTERIOR_PACKAGES[0];
    for (const p of sorted) {
      if (p.items.length && p.items.every(function (i) { return stored.indexOf(i) !== -1; })) { pkg = p; break; }
    }
    const pinput = interiorGroup.querySelector('input[value="' + pkg.id + '"]');
    if (pinput) pinput.checked = true;

    SMART_HOME.forEach(function (s) {
      if (stored.indexOf(s.label) !== -1) {
        const input = addonGroup.querySelector('input[value="' + s.id + '"]');
        if (input) input.checked = true;
      }
    });
  }

  async function loadDesign() {
    const params = new URLSearchParams(window.location.search);
    const designParam = params.get('design');

    let query = IB.supabase.from('house_designs').select('*').eq('user_id', session.user.id);
    if (designParam) query = query.eq('id', designParam);
    else query = query.order('created_at', { ascending: false }).limit(1);

    const res = await query.maybeSingle();
    if (res.data) {
      designId = res.data.id;
      applyDesign(res.data);
      return;
    }

    // No saved design yet — create a default one to link estimates to.
    const sel = readSelection();
    const created = await IB.supabase.from('house_designs')
      .insert({
        user_id: session.user.id,
        product_line: sel.productLine,
        size: sel.size,
        materials: [materialFor(sel).key, materialFor(sel).token],
        interior_selections: interiorFor(sel).items.slice()
      })
      .select()
      .single();
    if (!created.error && created.data) designId = created.data.id;
  }

  async function loadSmartHome() {
    const res = await IB.supabase.from('smart_home_selections')
      .select('features')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (res.data && Array.isArray(res.data.features)) smartHomeIds = res.data.features;
  }

  await loadDesign();
  await loadSmartHome();
  render(compute(readSelection()));
})();
