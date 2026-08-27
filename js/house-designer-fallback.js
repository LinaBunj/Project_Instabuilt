/**
 * InstaBuilt — House Designer fallback (no WebGL).
 * Classic preset-selector form shown when WebGL isn't supported, so the page
 * never breaks. Same save flow as the 3D configurator (house_designs table).
 */
(function () {
  'use strict';

  if (document.documentElement.classList.contains('webgl')) return;

  var IB = window.INSTABUILT;
  if (!IB) return;

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
  IB.pricing = PRICING;

  var SIZES = ['28 m²', '52 m²', '104 m²', '150 m²', '250 m²', '500 m²'];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function setStatus(form, msg, ok) {
    var status = form.querySelector('.form-status');
    status.textContent = msg;
    status.className = 'form-status ' + (ok ? 'form-status--ok' : 'form-status--err') + ' is-visible';
  }

  function populateSelect(id, options) {
    var sel = document.getElementById(id);
    if (!sel) return;
    options.forEach(function (label) {
      var opt = document.createElement('option');
      opt.value = label;
      opt.textContent = label;
      sel.appendChild(opt);
    });
  }

  function populateChecks(id, labels) {
    var group = document.getElementById(id);
    if (!group) return;
    labels.forEach(function (label) {
      var labelEl = document.createElement('label');
      labelEl.className = 'check-chip';
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.name = id;
      input.value = label;
      var span = document.createElement('span');
      span.textContent = label;
      labelEl.appendChild(input);
      labelEl.appendChild(span);
      group.appendChild(labelEl);
    });
  }

  function checkedValues(id) {
    var group = document.getElementById(id);
    if (!group) return [];
    var out = [];
    var inputs = group.querySelectorAll('input[type="checkbox"]:checked');
    for (var i = 0; i < inputs.length; i++) out.push(inputs[i].value);
    return out;
  }

  function loadSaved(session) {
    var list = document.getElementById('saved-designs-fb');
    if (!list) return;
    IB.supabase.from('house_designs')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(function (res) {
        if (res.error) { list.innerHTML = '<p class="muted">Could not load saved designs.</p>'; return; }
        var rows = res.data || [];
        if (!rows.length) { list.innerHTML = '<p class="muted">No saved designs yet — create your first above.</p>'; return; }
        list.innerHTML = '';
        rows.forEach(function (d) {
          var li = document.createElement('li');
          li.className = 'saved-design';
          var date = d.created_at ? new Date(d.created_at).toLocaleDateString() : '';
          li.innerHTML =
            '<span class="saved-design__meta"><strong>' + esc(d.product_line) + '</strong> · ' + esc(d.size) + '</span>' +
            '<span class="saved-design__date">' + esc(date) + '</span>' +
            '<a class="btn btn-sm btn-ghost" href="price-calculator.html?design=' + encodeURIComponent(d.id) + '">Estimate</a>';
          list.appendChild(li);
        });
      });
  }

  function init(session) {
    populateSelect('product_line_fb', Object.keys(PRICING.base));
    populateSelect('size_fb', SIZES);
    populateChecks('materials_fb', Object.keys(PRICING.materials));
    populateChecks('interiors_fb', PRICING.interiors.map(function (i) { return i.label; }));

    var form = document.getElementById('designer-form-fb');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var payload = {
        user_id: session.user.id,
        product_line: document.getElementById('product_line_fb').value,
        size: document.getElementById('size_fb').value,
        materials: checkedValues('materials_fb'),
        interior_selections: checkedValues('interiors_fb')
      };
      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      setStatus(form, 'Saving…', true);
      IB.supabase.from('house_designs')
        .insert(payload)
        .select()
        .single()
        .then(function (res) {
          if (res.error) { btn.disabled = false; setStatus(form, res.error.message, false); return; }
          setStatus(form, 'Design saved — opening your estimate…', true);
          window.location.href = 'price-calculator.html?design=' + encodeURIComponent(res.data.id);
        })
        .catch(function (err) {
          btn.disabled = false;
          setStatus(form, (err && err.message) || 'Could not save design.', false);
        });
    });

    loadSaved(session);
  }

  IB.ready.then(init);
})();
