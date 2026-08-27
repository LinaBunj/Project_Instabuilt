/**
 * InstaBuilt — floating AI assistant widget (js/ai-agent.js).
 *
 * Self-contained vanilla-JS chat widget, bottom-right on every page. Talks to a
 * Vercel serverless function at /api/agent (see api/agent.js), which calls the
 * Anthropic API. The API key lives ONLY in the Vercel env var ANTHROPIC_API_KEY
 * and is never shipped to the browser.
 *
 * The widget also executes the agent's tool calls locally:
 *   - set_house_option()     → stores choices + updates the saved house design
 *   - navigate_to_page()     → redirects (deferred until after the confirmation)
 *   - get_current_estimate() → reads the latest saved price/energy estimate
 */
(function () {
  'use strict';

  var IB = window.INSTABUILT || {};
  var API_ENDPOINT = (IB.config && IB.config.agentEndpoint) || '/api/agent';
  var STORAGE_KEY = 'instabuilt.ai.messages';
  var META_KEY = 'instabuilt.ai.meta';
  var OPTS_KEY = 'instabuilt.aiOptions';

  var GREETING =
    "Hi, I'm InstaBuilt's assistant \uD83D\uDC4B Are you looking for a home? " +
    "Tell me a little about what you need \u2014 who it's for, your budget, and " +
    "whether you already have land \u2014 and I'll point you to the right product.";

  var FALLBACK =
    "I'm having trouble connecting right now \u2014 please try again in a moment. " +
    "You can also reach us at hello@instabuilt.com or through the contact form.";

  // ---- state ----
  var messages = [];   // Anthropic-format history (sent with each request)
  var greeted = false; // whether the proactive greeting has been shown
  var isOpen = false;
  var busy = false;
  var pendingNavigation = null;
  var typingEl = null;
  var els = {};

  // ---- DOM ----
  function buildDom() {
    var root = document.createElement('div');
    root.className = 'ai-agent';
    root.setAttribute('aria-label', 'InstaBuilt assistant');

    root.innerHTML =
      '<button class="ai-agent__toggle" type="button" aria-expanded="false" aria-controls="ai-agent-panel" aria-label="Open chat">' +
        '<svg class="ai-agent__open" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3C6.5 3 2 6.9 2 11.7c0 2.6 1.4 4.9 3.6 6.4-.1 1.1-.5 2.2-1.2 3.1-.2.2 0 .5.3.5 2-.3 3.9-1 5.3-2.1.7.1 1.3.2 2 .2 5.5 0 10-3.9 10-8.7S17.5 3 12 3z"/></svg>' +
        '<svg class="ai-agent__close" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.3 5.7a1 1 0 0 0-1.4 0L12 10.6 7.1 5.7a1 1 0 1 0-1.4 1.4L10.6 12l-4.9 4.9a1 1 0 1 0 1.4 1.4L12 13.4l4.9 4.9a1 1 0 0 0 1.4-1.4L13.4 12l4.9-4.9a1 1 0 0 0 0-1.4z"/></svg>' +
      '</button>' +
      '<div class="ai-agent__panel" id="ai-agent-panel" role="dialog" aria-label="Chat with the InstaBuilt assistant">' +
        '<div class="ai-agent__head">' +
          '<span class="ai-agent__avatar" aria-hidden="true">A</span>' +
          '<span class="ai-agent__head-text">' +
            '<span class="ai-agent__head-title">InstaBuilt Assistant</span>' +
            '<span class="ai-agent__head-sub">Typically replies instantly</span>' +
          '</span>' +
        '</div>' +
        '<div class="ai-agent__messages" role="log" aria-live="polite"></div>' +
        '<div class="ai-agent__input">' +
          '<textarea id="ai-agent-input" rows="1" placeholder="Type a message\u2026" aria-label="Message the assistant"></textarea>' +
          '<button class="ai-agent__send" type="button" aria-label="Send message">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(root);

    els.root = root;
    els.toggle = root.querySelector('.ai-agent__toggle');
    els.messages = root.querySelector('.ai-agent__messages');
    els.input = root.querySelector('#ai-agent-input');
    els.send = root.querySelector('.ai-agent__send');
  }

  // ---- rendering ----
  function appendBubble(role, text) {
    var wrap = document.createElement('div');
    wrap.className = 'ai-msg ai-msg--' + role;
    var bubble = document.createElement('div');
    bubble.className = 'ai-msg__bubble';
    bubble.textContent = text; // textContent → no HTML injection
    wrap.appendChild(bubble);
    els.messages.insertBefore(wrap, typingEl || null);
    scrollToBottom();
  }

  function appendMessage(role, text) { appendBubble(role, text); }

  // Convert an Anthropic-format message into something displayable (or null).
  function messageToDisplay(m) {
    if (m.role === 'user') {
      return typeof m.content === 'string' ? { role: 'user', text: m.content } : null;
    }
    if (m.role === 'assistant') {
      var blocks = Array.isArray(m.content) ? m.content : [{ type: 'text', text: String(m.content) }];
      var text = blocks.filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('\n');
      return text ? { role: 'assistant', text: text } : null;
    }
    return null; // tool_result / tool_use are not shown
  }

  function renderAll() {
    typingEl = null;
    els.messages.innerHTML = '';
    if (greeted) appendBubble('assistant', GREETING);
    messages.forEach(function (m) {
      var d = messageToDisplay(m);
      if (d) appendBubble(d.role, d.text);
    });
    scrollToBottom();
  }

  function scrollToBottom() {
    els.messages.scrollTop = els.messages.scrollHeight;
  }

  function showTyping() {
    hideTyping();
    typingEl = document.createElement('div');
    typingEl.className = 'ai-msg ai-msg--assistant ai-typing';
    var b = document.createElement('div');
    b.className = 'ai-msg__bubble';
    b.innerHTML = '<span class="ai-dot"></span><span class="ai-dot"></span><span class="ai-dot"></span>';
    typingEl.appendChild(b);
    els.messages.appendChild(typingEl);
    scrollToBottom();
  }

  function hideTyping() {
    if (typingEl) { typingEl.remove(); typingEl = null; }
  }

  // ---- persistence (browser session) ----
  function persist() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch (e) { /* ignore */ }
  }

  function persistMeta() {
    try { sessionStorage.setItem(META_KEY, JSON.stringify({ greeted: greeted })); } catch (e) { /* ignore */ }
  }

  function restore() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) messages = parsed;
      }
      var meta = sessionStorage.getItem(META_KEY);
      if (meta) {
        var m = JSON.parse(meta);
        if (m && m.greeted) greeted = true;
      }
    } catch (e) { /* ignore */ }
  }

  // ---- tool execution (local) ----
  function navigateToPage(input) {
    var page = input && input.page;
    if (!page || typeof page !== 'string') return 'No page was specified.';
    if (/^([a-z][a-z0-9+.-]*:)?\/\//i.test(page) || /^javascript:/i.test(page)) {
      return 'Refused to navigate to an external or unsafe URL.';
    }
    pendingNavigation = page;
    appendMessage('sys', '\u21B3 Opening ' + page + '\u2026');
    return 'Will take the visitor to ' + page + '.';
  }

  async function setHouseOption(input) {
    var opts = {};
    var applied = [];
    if (input && input.product_line) { opts.productLine = String(input.product_line); applied.push('product line \u2014 ' + input.product_line); }
    if (input && input.size) { opts.size = String(input.size); applied.push('size \u2014 ' + input.size); }
    if (input && input.material) { opts.material = String(input.material); applied.push('material \u2014 ' + input.material); }
    if (input && input.interior_package) { opts.interiorPackage = String(input.interior_package); applied.push('interior package \u2014 ' + input.interior_package); }

    if (!applied.length) return 'No options were provided to save.';

    // Store locally in the session so it survives navigation (and the house
    // designer can read it back later).
    try { sessionStorage.setItem(OPTS_KEY, JSON.stringify(opts)); } catch (e) { /* ignore */ }

    // If signed in, also update the latest house_designs row (best-effort).
    var savedToAccount = false;
    var supabase = IB && IB.supabase;
    var session = IB && IB.session;
    if (supabase && session) {
      try {
        var design = await supabase.from('house_designs')
          .select('id')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (design.data) {
          var patch = {};
          if (opts.productLine) patch.product_line = opts.productLine;
          if (opts.size) patch.size = opts.size;
          if (Object.keys(patch).length) {
            await supabase.from('house_designs').update(patch).eq('id', design.data.id);
            savedToAccount = true;
          }
        }
      } catch (e) { /* non-fatal */ }
    }

    appendMessage('sys', '\u21B3 Saved: ' + applied.join('; '));
    return 'Saved: ' + applied.join(', ') +
      (savedToAccount ? ' \u2014 applied to their saved house design.' : ' \u2014 stored locally (they are not signed in).');
  }

  async function getCurrentEstimate(input) {
    var kind = input && input.kind;
    var supabase = IB && IB.supabase;
    var session = IB && IB.session;
    if (!supabase || !session) {
      return 'No estimate is available \u2014 the visitor is not signed in (estimates are saved to their account).';
    }
    try {
      var uid = session.user.id;
      if (kind === 'price') {
        var design = await supabase.from('house_designs')
          .select('id').eq('user_id', uid).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (!design.data) return 'No saved house design yet, so there is no price estimate to reference.';
        var pe = await supabase.from('price_estimates')
          .select('estimate_amount, currency').eq('design_id', design.data.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (!pe.data || pe.data.estimate_amount == null) return 'No price estimate has been saved yet for the current design.';
        return 'Current price estimate: \u20AC' + Number(pe.data.estimate_amount).toLocaleString('en-US') + ' (' + (pe.data.currency || 'EUR') + ').';
      }
      var ee = await supabase.from('energy_estimates')
        .select('estimated_kwh, estimated_cost').eq('user_id', uid).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!ee.data || ee.data.estimated_kwh == null) return 'No energy estimate has been saved yet.';
      return 'Current energy estimate: about ' + Number(ee.data.estimated_kwh).toLocaleString('en-US') +
        ' kWh/year (about \u20AC' + Number(ee.data.estimated_cost).toLocaleString('en-US') + '/year).';
    } catch (e) {
      return 'I could not read the estimate right now \u2014 please check the calculator page.';
    }
  }

  async function executeToolCalls(toolCalls) {
    var results = [];
    for (var i = 0; i < toolCalls.length; i++) {
      var call = toolCalls[i];
      var content;
      if (call.name === 'navigate_to_page') content = navigateToPage(call.input);
      else if (call.name === 'set_house_option') content = await setHouseOption(call.input);
      else if (call.name === 'get_current_estimate') content = await getCurrentEstimate(call.input);
      else content = 'Unknown tool: ' + call.name;
      results.push({ id: call.id, content: content });
    }
    return results;
  }

  // ---- the agent loop ----
  async function runAgent() {
    busy = true;
    els.send.disabled = true;
    showTyping();
    try {
      var guard = 0;
      while (guard++ < 8) {
        var res = await fetch(API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: messages })
        });
        var data;
        try { data = await res.json(); } catch (e) { data = {}; }
        if (!res.ok) throw new Error(data.error || 'Request failed (' + res.status + ')');

        if (Array.isArray(data.messages)) messages = data.messages;
        persist();

        if (data.type === 'text') {
          hideTyping();
          if (data.text) appendMessage('assistant', data.text);
          break;
        }
        if (data.type === 'tool_use' && Array.isArray(data.toolCalls)) {
          var results = await executeToolCalls(data.toolCalls);
          messages.push({
            role: 'user',
            content: results.map(function (r) { return { type: 'tool_result', tool_use_id: r.id, content: r.content }; })
          });
          persist();
          continue;
        }
        throw new Error('Unexpected response from the assistant.');
      }
      if (guard >= 8) throw new Error('The assistant got stuck in a loop.');
    } catch (err) {
      hideTyping();
      appendMessage('assistant', FALLBACK);
    } finally {
      busy = false;
      els.send.disabled = false;
    }

    // Deferred navigation — happens only after the confirmation has rendered.
    if (pendingNavigation) {
      var target = pendingNavigation;
      pendingNavigation = null;
      setTimeout(function () { window.location.href = target; }, 900);
    }
  }

  function send() {
    var text = els.input.value.replace(/\s+$/, '');
    if (!text || busy) return;
    els.input.value = '';
    autoResize();
    appendMessage('user', text);
    messages.push({ role: 'user', content: text });
    persist();
    runAgent();
  }

  // ---- open / close ----
  function open() {
    isOpen = true;
    els.root.classList.add('is-open');
    els.toggle.setAttribute('aria-expanded', 'true');
    if (!greeted) { greeted = true; persistMeta(); }
    renderAll();
    els.input.focus();
  }

  function close() {
    isOpen = false;
    els.root.classList.remove('is-open');
    els.toggle.setAttribute('aria-expanded', 'false');
  }

  function autoResize() {
    els.input.style.height = 'auto';
    els.input.style.height = Math.min(els.input.scrollHeight, 120) + 'px';
  }

  // ---- init ----
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }
    if (document.querySelector('.ai-agent')) return; // already mounted
    buildDom();
    restore();
    els.toggle.addEventListener('click', function () { isOpen ? close() : open(); });
    els.send.addEventListener('click', send);
    els.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
    els.input.addEventListener('input', autoResize);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen) { close(); els.toggle.focus(); }
    });
  }

  init();
})();
