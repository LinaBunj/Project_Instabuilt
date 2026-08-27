/**
 * InstaBuilt — AI assistant serverless function (api/agent.js).
 *
 * Deployed to Vercel. The Groq API key lives ONLY in the environment
 * variable GROQ_API_KEY — never in any client-side file.
 *
 *   Local dev:  copy .env.example → .env  (vercel dev reads it automatically)
 *   Vercel:     Project Settings → Environment Variables → GROQ_API_KEY
 *   (optional)  GROQ_MODEL to override the default model
 *               (default: openai/gpt-oss-120b)
 *
 * Endpoint: POST /api/agent
 *   Body:    { "messages": [ { role, content }, ... ] }   (Anthropic format)
 *   Returns: { "type": "text", "text", "messages" }             — final answer
 *        or  { "type": "tool_use", "toolCalls", "messages" }    — tools to run client-side
 *
 * The frontend (js/ai-agent.js) speaks Anthropic-shaped messages and expects
 * Anthropic-shaped responses; this function is a translation layer that
 * converts between that shape and Groq's OpenAI-compatible API, so the
 * widget itself needed no changes.
 *
 * Tool use is executed on the FRONTEND: the assistant asks to call
 * set_house_option / navigate_to_page / get_current_estimate, we return the
 * tool_use block, the frontend runs it and sends the tool_result back in the
 * next request. This function stays stateless — it just forwards history to
 * Groq and relays the response.
 */

const SYSTEM_PROMPT = `You are InstaBuilt's on-site sales and support assistant. InstaBuilt designs, engineers and manufactures modular and offsite buildings (Germany, Switzerland, Austria, Kosovo; Texas and Delaware in the US). Every building is made in a factory and assembled on site up to 75% faster, engineered to KfW40 energy standard.

PRODUCT LINES (the 7 things we build):
- POP UP Solutions — rapidly deployable single-storey units, 28–104 m² (housing, hospitality, offices, emergency).
- Multistory Multifamily — prefabricated mid/high-rise residential buildings.
- Senior Housing — accessible, community-focused homes.
- Micro Apartments — compact urban studios.
- Traditional Homes — classic single-family homes.
- Signature Homes — bespoke, architect-led residences.
- Bathpods — factory-finished bathroom pods.

SITE FEATURES you can point people to:
- House Designer (dashboard/house-designer.html) — 3D configurator to pick product line, size, materials and interior, then walk through it.
- Price Calculator (dashboard/price-calculator.html) — a live, indicative price estimate for a saved design.
- Energy Calculator (dashboard/energy-calculator.html) — estimated annual energy use and running cost.
- Smart-Home Configurator (dashboard/smart-home-configurator.html) — choose connected lighting, climate, security and more.
- Project Tracking (dashboard/project-tracking.html) — follows a build through 6 stages: Contract Signed → Factory Production of Modular Parts → Foundation Preparation → Utility Infrastructure → House Assembly → Handover/Delivery. It shows a progress bar (completed stages filled, the current stage highlighted, future stages greyed out) and a timeline. Use this to tell people how to see their build's progress in plain language.

YOUR JOB:
Be a warm, knowledgeable assistant who knows InstaBuilt AND homes in general. Answer questions about houses, home buying, architecture, modular and offsite construction, energy efficiency and renovation naturally — you do not need to force InstaBuilt into every answer. When the visitor's need matches what InstaBuilt builds (they usually arrive needing a home), guide them: ask clarifying questions ONE AT A TIME to narrow down the right product — who it's for and household size, budget range, whether they already have land, location, and priorities (speed vs. customization, sustainability) — then recommend a product line and offer to configure or price it. Keep the conversation natural and conversational, not scripted.

TOOL GUIDANCE:
- set_house_option(product_line, size, material, interior_package) — record a choice the visitor has made. product_line must be one of the 7 product-line names above. size is like "104 m²". material is like "Timber — Charcoal". interior_package is "Standard", "Comfort" or "Premium".
- get_current_estimate(kind: "price" | "energy") — read the visitor's real saved estimate so you can reference actual numbers instead of guessing.
- navigate_to_page(page) — send the visitor somewhere useful (e.g. "dashboard/house-designer.html", "dashboard/price-calculator.html", "dashboard/project-tracking.html", "contact.html"). Prefer navigating only after choices are made.

RULES:
- Never invent prices; call get_current_estimate to reference real numbers when relevant.
- Keep answers short and plain-language; use bullet lists sparingly.
- If asked how to see build progress, explain the tracking dashboard simply and offer navigate_to_page("dashboard/project-tracking.html").
- If you cannot help, point to the contact page or hello@instabuilt.com.`;

const TOOLS = [
  {
    name: 'set_house_option',
    description: "Apply a product-line, size, material or interior-package choice to the visitor's saved house design.",
    input_schema: {
      type: 'object',
      properties: {
        product_line: { type: 'string', description: 'One of the InstaBuilt product-line names.' },
        size: { type: 'string', description: 'House size label, e.g. "104 m²".' },
        material: { type: 'string', description: 'Material/finish choice, e.g. "Timber — Charcoal".' },
        interior_package: { type: 'string', description: '"Standard", "Comfort" or "Premium".' }
      }
    }
  },
  {
    name: 'navigate_to_page',
    description: 'Redirect the visitor to a page on the InstaBuilt site or dashboard.',
    input_schema: {
      type: 'object',
      properties: { page: { type: 'string', description: 'Relative page path, e.g. "dashboard/price-calculator.html".' } },
      required: ['page']
    }
  },
  {
    name: 'get_current_estimate',
    description: "Read the visitor's most recent saved price or energy estimate so you can reference real numbers.",
    input_schema: {
      type: 'object',
      properties: { kind: { type: 'string', enum: ['price', 'energy'] } },
      required: ['kind']
    }
  }
];

// Drop leading orphaned tool_result blocks (a tool_result must always follow the
// tool_use it answers — trimming from the front can otherwise break that).
function trimMessages(list, max) {
  let arr = list.slice(-max);
  while (
    arr.length &&
    arr[0] && arr[0].role === 'user' &&
    Array.isArray(arr[0].content) &&
    arr[0].content.some((b) => b && b.type === 'tool_result')
  ) {
    arr = arr.slice(1);
  }
  return arr;
}

// ---- Anthropic-shaped messages → OpenAI (Groq) chat format ----
function toOpenAI(messages) {
  const out = [];
  for (const m of messages) {
    if (!m || !m.role) continue;
    if (m.role === 'system') {
      out.push({ role: 'system', content: String(m.content) });
    } else if (m.role === 'user') {
      if (typeof m.content === 'string') {
        out.push({ role: 'user', content: m.content });
      } else if (Array.isArray(m.content)) {
        for (const b of m.content) {
          if (!b) continue;
          if (b.type === 'tool_result') {
            // one tool message per result, referencing the original tool call
            out.push({ role: 'tool', tool_call_id: b.tool_use_id, content: String(b.content == null ? '' : b.content) });
          } else if (b.type === 'text') {
            out.push({ role: 'user', content: b.text });
          }
        }
      }
    } else if (m.role === 'assistant') {
      let text = '';
      const toolCalls = [];
      const blocks = Array.isArray(m.content) ? m.content : [{ type: 'text', text: String(m.content) }];
      for (const b of blocks) {
        if (!b) continue;
        if (b.type === 'text') text += b.text;
        else if (b.type === 'tool_use') {
          toolCalls.push({ id: b.id, type: 'function', function: { name: b.name, arguments: JSON.stringify(b.input || {}) } });
        }
      }
      const msg = { role: 'assistant', content: text || null };
      if (toolCalls.length) msg.tool_calls = toolCalls;
      out.push(msg);
    }
    // anything else is dropped — the tool loop never produces it
  }
  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  // ------------------------------------------------------------------
  // 1) Config check — the API key MUST be present and non-empty.
  //    Log clearly so a missing env var is obvious in Vercel logs.
  // ------------------------------------------------------------------
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    console.error('[agent] GROQ_API_KEY is not set');
    res.status(503).json({ error: 'GROQ_API_KEY is not set' });
    return;
  }

  // ------------------------------------------------------------------
  // 2) Parse + validate the request body. Log any malformed body.
  // ------------------------------------------------------------------
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {
      console.error('[agent] Invalid JSON body:', e && e.message);
      res.status(400).json({ error: 'Invalid JSON body: ' + (e && e.message) });
      return;
    }
  }
  const rawMessages = body && Array.isArray(body.messages) ? body.messages : [];
  if (!rawMessages.length) {
    console.error('[agent] No messages provided in request body');
    res.status(400).json({ error: 'No messages provided.' });
    return;
  }

  const messages = trimMessages(rawMessages, 40);
  const openaiMessages = toOpenAI(messages);

  // ------------------------------------------------------------------
  // 3) Call Groq (OpenAI-compatible chat completions) — wrapped in its
  //    own try/catch; log the FULL error. Model is configurable via
  //    GROQ_MODEL (default: openai/gpt-oss-120b).
  // ------------------------------------------------------------------
  const payload = {
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    max_tokens: 1024,
    temperature: 0.7,
    messages: [{ role: 'system', content: SYSTEM_PROMPT }].concat(openaiMessages),
    tools: TOOLS.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.input_schema }
    }))
  };

  let upstream;
  try {
    upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + apiKey,
        'user-agent': 'instabuilt-agent/1.0'
      },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error('[agent] Network error calling Groq:', err);
    res.status(502).json({ error: 'Could not reach the Groq API: ' + (err && err.message) });
    return;
  }

  // Log status + body so auth / model / request-shape errors are visible.
  if (!upstream.ok) {
    const rawBody = await upstream.text().catch(() => '');
    console.error('[agent] Groq returned non-2xx:', upstream.status, rawBody);
    res.status(502).json({ error: 'Groq API error ' + upstream.status + ': ' + rawBody });
    return;
  }

  let data;
  try {
    data = await upstream.json();
  } catch (err) {
    console.error('[agent] Groq returned non-JSON body:', err && err.message);
    res.status(502).json({ error: 'Groq API returned an invalid response.' });
    return;
  }

  const choice = data.choices && data.choices[0];
  const msg = (choice && choice.message) || {};
  let text = typeof msg.content === 'string' ? msg.content : '';

  // ---- OpenAI tool_calls → Anthropic-shaped tool_use blocks ----
  const toolCalls = (msg.tool_calls || []).map((tc) => {
    let input = {};
    try { input = JSON.parse(tc.function.arguments || '{}'); } catch (e) { input = {}; }
    return { id: tc.id, name: tc.function.name, input };
  });

  const content = [];
  if (text) content.push({ type: 'text', text });
  for (const tc of toolCalls) content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input });

  const updatedMessages = messages.concat([{ role: 'assistant', content }]);

  if (choice && choice.finish_reason === 'tool_calls' && toolCalls.length) {
    res.status(200).json({ type: 'tool_use', toolCalls, messages: updatedMessages });
  } else {
    res.status(200).json({ type: 'text', text: text.trim(), messages: updatedMessages });
  }
};
