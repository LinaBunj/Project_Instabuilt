# InstaBuilt — Public Website + Client Dashboard

Static site for **InstaBuilt**, a modular / offsite construction company.
Phase 1 (public marketing site) + Phase 2 (Supabase auth + protected client
dashboard). No framework, no build step, no backend server — deploy as-is to
Vercel.

## Stack

- Plain semantic HTML5 + CSS3 (custom properties, grid, flexbox)
- Vanilla JavaScript (ES6+)
- **Supabase** (auth + Postgres) via CDN — `@supabase/supabase-js@2`
- Google Fonts: **Fraunces** (display) + **Manrope** (text)

## Structure

```
/
├── index.html … contact.html     Public marketing pages (Phase 1)
├── login.html · signup.html      Auth screens
├── dashboard/
│   ├── index.html                Dashboard home (protected)
│   ├── house-designer.html       Design a build (protected)
│   ├── price-calculator.html     Estimate from a saved design (protected)
│   ├── profile.html              Account + saved designs (protected)
│   └── coming-soon.html          Placeholder: Energy / Smart-Home / Tracking / AI
├── css/main.css · dashboard.css
├── js/
│   ├── main.js                   Nav, scroll reveals, form capture, CTA rewiring
│   ├── supabase-client.js        Supabase init (URL + anon key) — EDIT ME
│   ├── auth.js                   signup / login / logout
│   ├── auth-guard.js             Protects dashboard/*, redirects to /login.html
│   ├── house-designer.js         Designer UI → house_designs
│   └── price-calculator.js       Estimate → price_estimates
├── images/                       Labelled placeholder SVGs (see images/README.md)
└── supabase/schema.sql           Tables + Row Level Security policies
```

## Supabase setup (2 steps)

1. **Paste your credentials** into `js/supabase-client.js`:
   - `SUPABASE_URL` ← Project URL (Dashboard → Project Settings → API)
   - `SUPABASE_ANON_KEY` ← `anon` / `public` key
2. **Create the schema** — open Supabase → SQL Editor → paste and run
   `supabase/schema.sql`.

That's it. The anon key is safe to ship; data access is enforced by **RLS**
(`supabase/schema.sql`), not by hiding the key. Each user can only read/write
their own rows in `house_designs` and `price_estimates`.

> Tip: during local development you may want to disable **Confirm email**
> (Dashboard → Authentication → Providers → Email) so signup returns a session
> immediately. The signup page already handles both cases.

## Auth & routing

- Every `dashboard/*.html` page loads `auth-guard.js` first, which calls
  `supabase.auth.getSession()` and redirects to `/login.html` (with `?next=`)
  when there is no session.
- `login.html`/`signup.html` use Supabase email/password auth.
- Product-page **"Design yours"** CTAs resolve at runtime: to
  `dashboard/house-designer.html` when signed in, otherwise to `login.html`.
  The hint is a `localStorage` flag kept in sync by `auth.js`; the real gate is
  always `auth-guard.js`.

## Data model (Supabase)

| Table | Purpose |
|---|---|
| `house_designs` | Saved designs (`user_id`, `product_line`, `size`, `materials`, `interior_selections`, `created_at`) |
| `price_estimates` | Estimates linked to a `house_designs` row |
| `newsletter_signups` | Public newsletter captures (Phase 1 form destination) |
| `contact_submissions` | Public contact captures (Phase 1 form destination) |

## Run locally

```bash
python -m http.server 8124
# open http://localhost:8124
```

## AI assistant (floating chat widget)

The widget (`js/ai-agent.js`) is loaded on every page and calls the serverless
function `api/agent.js`, which answers with the **Groq** API (OpenAI-compatible).
The API key lives only in `GROQ_API_KEY` — never in client-side code.

- **Local dev:** copy `.env.example` → `.env`, paste your key, then
  `npx vercel dev` (reads `.env` automatically).
- **Vercel:** Project Settings → Environment Variables → `GROQ_API_KEY`
  (and optionally `GROQ_MODEL`, default `openai/gpt-oss-120b`).

The widget and the function speak Anthropic-shaped messages; `api/agent.js`
translates them to Groq's chat-completions format, so tool calls
(`set_house_option`, `navigate_to_page`, `get_current_estimate`) are executed
client-side exactly as before.

## Link audit (zero 404s)

```bash
python scripts/audit-links.py
# Checked 897 internal references across 24 pages. OK.
```

## Tests

- `scripts/guard-test.html` exercises `auth-guard.js` against stub clients in
  **both** states (logged-in and logged-out). Serve the site and open
  `/scripts/guard-test.html` to re-run it.
- The logged-out redirect (dashboard → login) is also verified end-to-end.

## Phase 1 forms

Newsletter and contact forms are still capture-only (log + confirmation). Point
them at `newsletter_signups` / `contact_submissions` (already in the schema) when
you want live capture.
