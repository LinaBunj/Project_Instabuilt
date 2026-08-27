/**
 * InstaBuilt — energy calculator.
 *
 * Estimates annual energy consumption (kWh/year) and running cost (€/year) for
 * a configured home. Same vanilla-JS pattern as the rest of the dashboard:
 * preset dropdowns + one slider, live recalculation on every change, and a
 * debounced save to the `energy_estimates` table.
 *
 * Formula (placeholder — swap real figures in ENERGY_CONFIG below):
 *   kWh = baseConsumption[insulation]  (kWh/m²/year)
 *       × houseSize (m²)
 *       × windowMultiplier
 *       × occupancyFactor
 *       × systemEfficiency
 *   cost = kWh × euroPerKwh
 */
import { parseArea } from './models-config.js';

(async function () {
  'use strict';

  const IB = window.INSTABUILT;
  if (!IB || !IB.supabase) return;

  /* =========================================================================
     ENERGY_CONFIG — placeholder energy figures.
     Replace these values with real InstaBuilt performance data when available.
     ========================================================================= */
  const ENERGY_CONFIG = {
    // Base heating + cooling consumption, kWh/m²/year, by insulation tier.
    baseConsumption: {
      'Standard': 120,
      'KfW40 Enhanced': 55,
      'Passive': 15
    },
    // Heating/cooling systems: `efficiency` is the multiplier applied to the
    // raw demand (< 1 = heat pumps deliver more than they consume; ~1 = direct
    // electric / boiler losses). `short` is the chart label.
    systems: {
      'Heat Pump': { efficiency: 0.30, short: 'Heat Pump' },
      'Gas Boiler': { efficiency: 1.05, short: 'Gas Boiler' },
      'Electric Resistance': { efficiency: 1.00, short: 'Electric' },
      'Geothermal': { efficiency: 0.22, short: 'Geothermal' }
    },
    // Window type multiplier (better glazing reduces demand).
    windowMultipliers: {
      'Single-glazed': 1.15,
      'Double-glazed': 1.0,
      'Triple-glazed': 0.90
    },
    // Occupancy adjustment: factor = base + perOccupant × (occupants − 1).
    occupancy: {
      base: 0.90,
      perOccupant: 0.04
    },
    // Local electricity price, EUR per kWh.
    euroPerKwh: 0.28
  };

  const INSULATION_OPTIONS = Object.keys(ENERGY_CONFIG.baseConsumption);
  const SYSTEM_OPTIONS = Object.keys(ENERGY_CONFIG.systems);
  const WINDOW_OPTIONS = Object.keys(ENERGY_CONFIG.windowMultipliers);
  const SIZES = ['28 m²', '52 m²', '104 m²', '150 m²', '250 m²', '500 m²'];
  const DEFAULT_SIZE = '104 m²'; // mid-size example when no saved design

  // ---------- UI ----------
  const systemSel = document.getElementById('system');
  const insulationSel = document.getElementById('insulation');
  const windowSel = document.getElementById('window');
  const occupancySlider = document.getElementById('occupancy');
  const occupancyValue = document.getElementById('occupancy-value');
  const sizeSel = document.getElementById('size');

  function fillSelect(sel, options) {
    sel.innerHTML = '';
    options.forEach(function (o) {
      const opt = document.createElement('option');
      opt.value = o;
      opt.textContent = o;
      sel.appendChild(opt);
    });
  }

  fillSelect(systemSel, SYSTEM_OPTIONS);
  fillSelect(insulationSel, INSULATION_OPTIONS);
  fillSelect(windowSel, WINDOW_OPTIONS);
  fillSelect(sizeSel, SIZES);
  sizeSel.value = DEFAULT_SIZE;

  function readSelection() {
    return {
      system: systemSel.value,
      insulation: insulationSel.value,
      window: windowSel.value,
      occupancy: parseInt(occupancySlider.value, 10) || 1,
      size: sizeSel.value
    };
  }

  function occupancyFactor(occupants) {
    return ENERGY_CONFIG.occupancy.base + ENERGY_CONFIG.occupancy.perOccupant * (occupants - 1);
  }

  // ---------- Compute ----------
  function money(n) {
    return '€' + Math.round(n).toLocaleString('en-US');
  }

  function compute(sel) {
    const base = ENERGY_CONFIG.baseConsumption[sel.insulation];
    const area = parseArea(sel.size);
    const win = ENERGY_CONFIG.windowMultipliers[sel.window];
    const occ = occupancyFactor(sel.occupancy);
    const eff = ENERGY_CONFIG.systems[sel.system].efficiency;
    const kwh = base * area * win * occ * eff;
    const cost = kwh * ENERGY_CONFIG.euroPerKwh;
    return { kwh: kwh, cost: cost, area: area };
  }

  // Cost/kWh for every system at the SAME config (for the comparison chart).
  function allSystems(sel) {
    return SYSTEM_OPTIONS.map(function (sys) {
      const base = ENERGY_CONFIG.baseConsumption[sel.insulation];
      const area = parseArea(sel.size);
      const win = ENERGY_CONFIG.windowMultipliers[sel.window];
      const occ = occupancyFactor(sel.occupancy);
      const eff = ENERGY_CONFIG.systems[sys].efficiency;
      const kwh = base * area * win * occ * eff;
      return { id: sys, short: ENERGY_CONFIG.systems[sys].short, kwh: kwh, cost: kwh * ENERGY_CONFIG.euroPerKwh };
    });
  }

  // ---------- Render ----------
  function render() {
    const sel = readSelection();
    const est = compute(sel);

    document.getElementById('headline-cost').textContent = '~' + money(est.cost) + ' / year';
    document.getElementById('headline-kwh').textContent = Math.round(est.kwh).toLocaleString('en-US') + ' kWh / year';

    const rows = allSystems(sel);
    const most = rows.reduce(function (a, b) { return b.cost < a.cost ? b : a; }, rows[0]);
    const least = rows.reduce(function (a, b) { return b.cost > a.cost ? b : a; }, rows[0]);
    const savingsPct = least.cost > 0 ? Math.round((least.cost - most.cost) / least.cost * 100) : 0;

    drawChart(rows, sel.system, most.id);

    document.getElementById('chart-caption').textContent =
      'Most efficient: ' + most.id + ' — saves ' + savingsPct + '% vs ' + least.id +
      ' at this configuration.';
  }

  function drawChart(rows, selectedId, mostId) {
    const canvas = document.getElementById('chart');
    const container = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(container.clientWidth, 280);
    const height = 220;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const pad = { top: 46, right: 12, bottom: 46, left: 58 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;
    const maxCost = Math.max.apply(null, rows.map(function (r) { return r.cost; })) || 1;

    // Y gridlines + labels (€)
    ctx.font = '11px Outfit, Segoe UI, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const val = maxCost * i / steps;
      const y = pad.top + chartH - (chartH * i / steps);
      ctx.strokeStyle = '#ececea';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + chartW, y);
      ctx.stroke();
      ctx.fillStyle = '#9a9a96';
      ctx.fillText('€' + Math.round(val).toLocaleString('en-US'), pad.left - 8, y);
    }

    // Bars
    const n = rows.length;
    const slot = chartW / n;
    const barW = Math.min(slot * 0.58, 88);
    rows.forEach(function (r, i) {
      const h = Math.max((r.cost / maxCost) * chartH, 2);
      const x = pad.left + i * slot + (slot - barW) / 2;
      const y = pad.top + chartH - h;

      const isSelected = r.id === selectedId;
      const isMost = r.id === mostId;
      ctx.fillStyle = isSelected ? '#6b7c3f' : (isMost ? '#58703a' : '#d8d8d3');
      ctx.fillRect(x, y, barW, h);

      // value above bar
      ctx.fillStyle = '#333333';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.font = '600 11px Outfit, Segoe UI, sans-serif';
      ctx.fillText('€' + Math.round(r.cost).toLocaleString('en-US'), x + barW / 2, y - 4);

      // star for most efficient
      if (isMost) {
        ctx.fillStyle = '#4d5c2b';
        ctx.font = '12px Outfit, Segoe UI, sans-serif';
        ctx.fillText('★', x + barW / 2, y - 20);
      }

      // label under bar
      ctx.fillStyle = '#707070';
      ctx.textBaseline = 'top';
      ctx.font = '11px Outfit, Segoe UI, sans-serif';
      ctx.fillText(r.short, x + barW / 2, pad.top + chartH + 8);
    });
  }

  // ---------- Debounced save ----------
  let designId = null;
  let saveTimer = null;
  let statusTimer = null;

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 500);
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
    const sel = readSelection();
    const est = compute(sel);
    IB.supabase.from('energy_estimates')
      .insert({
        user_id: session.user.id,
        house_design_id: designId || null,
        inputs: {
          system: sel.system,
          insulation: sel.insulation,
          window: sel.window,
          occupancy: sel.occupancy,
          size: sel.size
        },
        estimated_kwh: Math.round(est.kwh),
        estimated_cost: Math.round(est.cost * 100) / 100
      })
      .then(function (res) {
        if (res.error) showSaveStatus(false, res.error.message);
        else showSaveStatus(true);
      });
  }

  // ---------- Live recompute ----------
  function onAnyChange() {
    render();
    scheduleSave();
  }

  [systemSel, insulationSel, windowSel, sizeSel].forEach(function (el) {
    el.addEventListener('change', onAnyChange);
  });
  occupancySlider.addEventListener('input', function () {
    occupancyValue.textContent = occupancySlider.value;
    onAnyChange();
  });

  // ---------- Init ----------
  let session = null;
  try { session = await IB.ready; } catch (e) { /* redirected by guard */ }
  if (!session) return;

  async function loadDesign() {
    const res = await IB.supabase.from('house_designs')
      .select('size, id')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (res.data && res.data.size) {
      designId = res.data.id;
      if (SIZES.indexOf(res.data.size) !== -1) sizeSel.value = res.data.size;
    }
  }

  await loadDesign();
  occupancyValue.textContent = occupancySlider.value;
  render();

  window.addEventListener('resize', function () { render(); });
})();
