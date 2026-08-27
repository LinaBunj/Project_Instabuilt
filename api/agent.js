/**
 * InstaBuilt — AI assistant serverless function (api/agent.js).
 *
 * Deployed to Vercel. The Anthropic API key lives ONLY in the Vercel
 * environment variable ANTHROPIC_API_KEY — never in any client-side file.
 *
 *   Vercel → Project Settings → Environment Variables → ANTHROPIC_API_KEY
 *   (optional) ANTHROPIC_MODEL to override the default model.
 *
 * Endpoint: POST /api/agent
 *   Body:    { "messages": [ { role, content }, ... ] }   (Anthropic format)
 *   Returns: { "type": "text", "text", "messages" }             — final answer
 *        or  { "type": "tool_use", "toolCalls", "messages" }    — tools to run client-side
 *
 * Tool use is executed on the FRONTEND (js/ai-agent.js): the assistant asks to
 * call set_house_option / navigate_to_page / get_current_estimate, we return the
 * tool_use block, the frontend runs it and sends the tool_result back in the
 * next request. This function stays stateless — it just forwards history to
 * Anthropic and relays the response.
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
Act as a warm, concise sales/support guide. The visitor usually arrives needing a home (their starting point is "I need a house"). Ask clarifying questions ONE AT A TIME to narrow down the right product: who it's for and household size, budget range, whether they already have land, location, and priorities (speed vs. customization, sustainability). Then recommend a product line and offer to configure or price it.

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
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    console.error('[agent] ANTHROPIC_API_KEY is not set');
    res.status(503).json({ error: 'ANTHROPIC_API_KEY is not set' });
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

  // ------------------------------------------------------------------
  // 3) Call Anthropic — wrapped in its own try/catch; log the FULL error.
  //    Model is configurable via ANTHROPIC_MODEL (e.g. claude-sonnet-4-5-20250929).
  // ------------------------------------------------------------------
  const payload = {
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: TOOLS,
    messages
  };

  let upstream;
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error('[agent] Network error calling Anthropic:', err);
    res.status(502).json({ error: 'Could not reach the Anthropic API: ' + (err && err.message) });
    return;
  }

  // Log status + body so auth / model / request-shape errors are visible.
  if (!upstream.ok) {
    const rawBody = await upstream.text().catch(() => '');
    console.error('[agent] Anthropic returned non-2xx:', upstream.status, rawBody);
    // DEBUG: return the real error message so it's visible in the browser
    // Network tab / console. Remove the detailed message before final deploy.
    res.status(502).json({ error: 'Anthropic API error ' + upstream.status + ': ' + rawBody });
    return;
  }

  let data;
  try {
    data = await upstream.json();
  } catch (err) {
    console.error('[agent] Anthropic returned non-JSON body:', err && err.message);
    res.status(502).json({ error: 'Anthropic API returned an invalid response.' });
    return;
  }

  const toolCalls = [];
  let text = '';
  (data.content || []).forEach((block) => {
    if (block.type === 'text') text += block.text;
    else if (block.type === 'tool_use') toolCalls.push({ id: block.id, name: block.name, input: block.input || {} });
  });

  const updatedMessages = messages.concat([{ role: 'assistant', content: data.content || [] }]);

  if (data.stop_reason === 'tool_use' && toolCalls.length) {
    res.status(200).json({ type: 'tool_use', toolCalls, messages: updatedMessages });
  } else {
    res.status(200).json({ type: 'text', text: text.trim(), messages: updatedMessages });
  }
};
