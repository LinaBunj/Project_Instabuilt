/* End-to-end test for api/agent.js — mimics the browser widget's tool loop. */
const fs = require('fs');
const path = require('path');

// 1) Load .env into process.env (Vercel injects these; local test reads the file)
const envPath = path.join(__dirname, '..', '.env');
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
console.log('GROQ_API_KEY set:', !!process.env.GROQ_API_KEY, '| model:', process.env.GROQ_MODEL);

// 2) Mock req/res
function makeRes() {
  const state = { status: 200, body: null };
  return {
    state,
    setHeader() {},
    status(c) { state.status = c; return this; },
    json(b) { state.body = b; },
  };
}

async function run() {
  const handler = require(path.join(__dirname, '..', 'api', 'agent.js'));
  let messages = [];

  // --- Turn 1: plain question (freestyle about houses) ---
  let res = makeRes();
  await handler({ method: 'POST', body: { messages: [{ role: 'user', content: 'What is modular construction and why is it faster than building on site?' }] } }, res);
  console.log('\n[TURN 1] status:', res.state.status, '| type:', res.state.body && res.state.body.type);
  console.log('[TURN 1] answer:', res.state.body && res.state.body.text && res.state.body.text.slice(0, 220));
  messages = res.state.body.messages;
  if (res.state.body.type !== 'text') throw new Error('TURN 1 expected text');

  // --- Turn 2: navigation request → expect tool_use ---
  messages = messages.concat([{ role: 'user', content: 'Can you take me to the price calculator?' }]);
  res = makeRes();
  await handler({ method: 'POST', body: { messages } }, res);
  console.log('\n[TURN 2] status:', res.state.status, '| type:', res.state.body && res.state.body.type);
  console.log('[TURN 2] toolCalls:', JSON.stringify(res.state.body && res.state.body.toolCalls));
  messages = res.state.body.messages;
  if (res.state.body.type !== 'tool_use') throw new Error('TURN 2 expected tool_use');

  // --- Turn 3: frontend ran the tool → send tool_result back ---
  const call = res.state.body.toolCalls[0];
  messages = messages.concat([{
    role: 'user',
    content: [{ type: 'tool_result', tool_use_id: call.id, content: 'Will take the visitor to ' + call.input.page + '.' }],
  }]);
  res = makeRes();
  await handler({ method: 'POST', body: { messages } }, res);
  console.log('\n[TURN 3] status:', res.state.status, '| type:', res.state.body && res.state.body.type);
  console.log('[TURN 3] final answer:', res.state.body && res.state.body.text && res.state.body.text.slice(0, 220));
  if (res.state.body.type !== 'text') throw new Error('TURN 3 expected text');

  // --- Turn 4: missing key behaviour (env cleared) ---
  const savedKey = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;
  res = makeRes();
  await handler({ method: 'POST', body: { messages: [{ role: 'user', content: 'hi' }] } }, res);
  console.log('\n[TURN 4] (no key) status:', res.state.status, '| error:', res.state.body && res.state.body.error);
  process.env.GROQ_API_KEY = savedKey;

  console.log('\nALL HANDLER TESTS PASSED');
}

run().catch((e) => { console.error('TEST FAILED:', e.message); process.exit(1); });
