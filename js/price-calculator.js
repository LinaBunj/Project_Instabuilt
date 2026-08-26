/**
 * InstaBuilt — Price Calculator (Phase 2).
 * Reads a saved design (latest, or ?design=<id>) and shows a stub-formula
 * estimate, then persists it to `price_estimates` (linked to the design).
 */
(function () {
  'use strict';

  var IB = window.INSTABUILT;

  // Keep in sync with js/house-designer.js.
  var PRICING = {
    base: {
      'POP UP Solutions': 2200,
      'Multistory Multifamily': 2600,
      'Senior Housing': 2700,
      'Micro Apartments': 2400,
      'Traditional Homes': 2500,
      'Signature Homes': 3200,
      'Bathpods': 1800
    },
    materials: { 'Timber': 1.0, 'Render': 0.95, 'Brick-slip': 1.15, 'Metal': 1.25 },
    interiors: [
      { label: 'Full kitchen', cost: 12000, perArea: false },
      { label: 'Premium Bathpod', cost: 9000, perArea: false },
      { label: 'Smart-home package', cost: 8000, perArea: false },
      { label: 'Oak flooring', cost: 45, perArea: true },
      { label: 'Underfloor heating', cost: 55, perArea: true }
    ]
  };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function parseArea(size) {
    var m = /(\d+(?:\.\d+)?)/.exec(size || '');
    return m ? parseFloat(m[1]) : 0;
  }

  function money(n) {
    return '€' + Math.round(n).toLocaleString('en-US');
  }

  function compute(design) {
    var base = PRICING.base[design.product_line] || 2200;
    var area = parseArea(design.size);
    var mat = 1.0;
    (design.materials || []).forEach(function (m) {
      if (PRICING.materials[m]) mat = Math.max(mat, PRICING.materials[m]);
    });

    var lines = [];
    lines.push({
      label: design.product_line + ' · ' + design.size + ' · ' + area + ' m² @ €' + base + '/m²',
      amount: area * base
    });

    if (mat !== 1.0) {
      lines.push({ label: 'Material finish adjustment', amount: area * base * (mat - 1) });
    }

    var total = area * base * mat;
    (design.interior_selections || []).forEach(function (label) {
      var item = null;
      for (var i = 0; i < PRICING.interiors.length; i++) {
        if (PRICING.interiors[i].label === label) { item = PRICING.interiors[i]; break; }
      }
      if (item) {
        var amt = item.perArea ? item.cost * area : item.cost;
        lines.push({ label: label, amount: amt });
        total += amt;
      }
    });

    return { lines: lines, total: total, area: area, currency: 'EUR' };
  }

  function render(design) {
    var out = document.getElementById('estimate');
    if (!design) {
      out.innerHTML = '<p class="muted">No saved design found. <a href="house-designer.html">Create one first</a>.</p>';
      return;
    }

    var est = compute(design);

    document.getElementById('sum-line').textContent = design.product_line;
    document.getElementById('sum-size').textContent = design.size + ' · ' + est.area + ' m²';
    document.getElementById('sum-materials').textContent = (design.materials || []).join(', ') || '—';
    document.getElementById('sum-interior').textContent = (design.interior_selections || []).join(', ') || '—';

    var tbody = document.getElementById('breakdown');
    tbody.innerHTML = '';
    est.lines.forEach(function (l) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<th scope="row">' + esc(l.label) + '</th><td>' + money(l.amount) + '</td>';
      tbody.appendChild(tr);
    });
    document.getElementById('total').textContent = money(est.total);

    IB.supabase.from('price_estimates')
      .insert({
        design_id: design.id,
        estimate_amount: est.total,
        currency: est.currency,
        details: est.lines
      })
      .then(function (res) {
        var note = document.getElementById('save-note');
        if (res.error) {
          note.textContent = 'Estimate computed (not persisted: ' + res.error.message + ')';
        } else {
          note.textContent = 'Estimate saved to your account.';
        }
      });
  }

  function init(session) {
    var id = null;
    try { id = new URLSearchParams(window.location.search).get('design'); } catch (e) { /* ignore */ }

    var query = IB.supabase.from('house_designs')
      .select('*')
      .eq('user_id', session.user.id);

    if (id) {
      query = query.eq('id', id);
    } else {
      query = query.order('created_at', { ascending: false }).limit(1);
    }

    query.maybeSingle().then(function (res) {
      render(res.data);
    });
  }

  IB.ready.then(init);
})();
