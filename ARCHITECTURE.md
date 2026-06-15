# Architecture & System Design

Comprehensive overview of the Lodha Pune website architecture, data flow, and deployment topology.

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Browser                           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ index.html (Landing Page)                                   ││
│  │ - Hero section with value proposition                        ││
│  │ - Lead capture form (name, phone, requirement, budget, etc) ││
│  │ - Featured projects, testimonials, FAQ, trust signals       ││
│  │                                                              ││
│  │ script.js (Client Logic)                                    ││
│  │ - Form submission handler                                   ││
│  │ - Tracking data collection (UTM, referrer, landing page)    ││
│  │ - Proxy fallback logic (try /api/leads-proxy first)        ││
│  │ - Direct Supabase REST insert as fallback                   ││
│  │ - WhatsApp fallback if both fail                            ││
│  │                                                              ││
│  │ admin.html (Realtime Admin Dashboard)                       ││
│  │ - Loads latest 50 leads via Supabase REST                   ││
│  │ - Subscribes to realtime inserts (postgres_changes)         ││
│  │ - Displays incoming leads live without page refresh         ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                    ↓ (POST form submission)
        ┌────────────────────────────────────┐
        │   Vercel Edge (Static + Functions) │
        ├────────────────────────────────────┤
        │ /api/leads-proxy (serverless fn)   │
        │ - Receives POST with lead data     │
        │ - Reads SUPABASE_SERVICE_ROLE_KEY  │
        │   from env (secret, server-only)   │
        │ - Forwards request to Supabase     │
        │ - Returns response to client       │
        └────────────────────────────────────┘
                    ↓ (HTTPS POST)
        ┌────────────────────────────────────┐
        │    Supabase REST API                │
        │ POST /rest/v1/leads                │
        │ Headers: apikey, Authorization     │
        │ (service_role_key or anon_key)     │
        └────────────────────────────────────┘
                    ↓
        ┌────────────────────────────────────┐
        │   Supabase PostgreSQL              │
        │   public.leads table               │
        │   - Stores lead records            │
        │   - RLS policies:                  │
        │     • anon can INSERT              │
        │     • authenticated can SELECT     │
        │   - Indexes on created_at,        │
        │     crm_stage, lead_series        │
        └────────────────────────────────────┘
        ↓ (postgres_changes event)
        ├─ admin.html subscription receives
        │  INSERT event for each new lead
        │  and displays it in realtime
```

## Technology Stack

### Frontend
- **HTML5** — semantic markup with Open Graph and JSON-LD schema
- **CSS3** — responsive design with mobile-first approach
  - Breakpoints: 480px (mobile), 720px (tablet), 1040px (desktop)
  - CSS variables for consistent theming
  - Flexbox and CSS Grid for layout
- **JavaScript (Vanilla)** — no framework dependencies
  - ES6+ features (async/await, arrow functions, destructuring)
  - Client-side form validation
  - Fetch API for HTTP requests
  - Event delegation for performance

### Backend (Serverless)
- **Node.js 18+** — Vercel serverless runtime
  - `/api/leads-proxy.js` — proxies POST requests to Supabase with service role key
  - Optional: `/server.js` for local development (not deployed to Vercel)

### Database
- **Supabase (PostgreSQL)** — managed Postgres with REST API
  - `leads` table with 15+ columns
  - Row-Level Security (RLS) for access control
  - Realtime subscriptions via WebSocket
  - Indexes for query performance

### Hosting & Deployment
- **Vercel** — static site hosting with serverless functions
  - Git auto-deployment
  - Environment variables for secrets
  - Function logs and analytics

## Data Flow

### 1. Lead Submission Flow

```
User fills form → Submit event → script.js
  ↓
Collect form data (name, phone, requirement, budget, timeline)
Collect tracking data (UTM params, referrer, landing_page)
Build lead object
  ↓
Try saveLeadViaProxy('/api/leads-proxy')
  ↓
  ┌─ Success → Reset form, show "Enquiry saved" message
  │
  └─ Failure (404/405) or Network Error
     ↓
     Try saveLead() with SUPABASE_ANON_KEY
     ├─ Success → Reset form, show message
     │
     └─ Failure (missing key or RLS denied)
        ↓
        Open WhatsApp fallback (919673000053)
        Show "Please call or WhatsApp" error
```

### 2. Lead Storage (Database)

```
POST /api/leads-proxy
  ↓
readJsonBody(req) → Parse request body
  ↓
Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env
  ↓
POST to Supabase REST API (/rest/v1/leads)
  Headers: apikey + Authorization Bearer <service_role_key>
  Body: { name, phone, requirement, budget, timeline, ... }
  ↓
Supabase validates RLS policy (anon allowed? no, but service_role bypasses)
  ↓
INSERT into public.leads table
  ↓
Return 201 Created to client
```

### 3. Realtime Admin Monitoring

```
admin.html loads
  ↓
Create Supabase client (SUPABASE_URL + SUPABASE_ANON_KEY)
  ↓
Query: SELECT * FROM leads ORDER BY created_at DESC LIMIT 50
  ↓
Render initial 50 leads in table
  ↓
Subscribe to postgres_changes (INSERT events on public.leads table)
  ↓
When new lead is inserted:
  - WebSocket event received in real-time
  - renderLead() adds row to top of table
  - Admin sees lead immediately without refresh
```

## Security Architecture

### Key Management

| Key Type | Scope | Usage | Storage | Risk |
|----------|-------|-------|---------|------|
| SUPABASE_ANON_KEY | Public | Client-side inserts via RLS | Browser localStorage (visible) | Low (restricted by RLS) |
| SUPABASE_SERVICE_ROLE_KEY | Secret | Server-side inserts (Vercel env only) | Vercel env vars (encrypted) | High if exposed |
| ADMIN_USER / ADMIN_PASS | Deployment | Local server Basic Auth | Env vars (optional) | Medium (reusable) |

### Row-Level Security (RLS) Policies

```sql
-- Anon users can only INSERT (not read)
CREATE POLICY "Allow public lead submissions"
  ON public.leads
  FOR INSERT TO anon
  WITH CHECK (true);

-- Authenticated users can SELECT
CREATE POLICY "Allow authenticated select"
  ON public.leads
  FOR SELECT TO authenticated
  USING (true);

-- Service role bypasses RLS entirely (for trusted server code)
```

### CORS & Network Security

- ✅ Vercel → Supabase: HTTPS only, no CORS (server-to-server)
- ✅ Browser → Vercel: HTTPS only (enforced by Vercel)
- ⚠️ Browser → Supabase (if direct): CORS allowed by Supabase for anon key
- ✅ No sensitive data in localStorage
- ✅ No API keys hardcoded in source (use env vars)

## Deployment Topology

```
GitHub (manishrai99-afk/lodha-pune)
  ↓
Vercel Auto-Deploy
  ├─ Static files (index.html, styles.css, admin.html)
  ├─ Serverless Function (/api/leads-proxy)
  └─ CDN Edge caching
  ↓
lodha-pune.vercel.app
  ├─ Instant global distribution (50+ regions)
  ├─ HTTPS/2, gzip compression
  └─ 99.99% uptime SLA
  ↓
Supabase Project (vfrctiuavawnteutblbd.supabase.co)
  ├─ PostgreSQL database
  ├─ REST API (auto-generated)
  ├─ Realtime subscriptions
  └─ Managed backups & monitoring
```

## Performance Optimization

- **Static Site**: No server rendering overhead
- **Minified CSS**: ~15KB gzipped
- **No JavaScript frameworks**: Vanilla JS + Fetch API
- **CDN Edge Caching**: Vercel caches static assets globally
- **Lazy Loading**: Images use native `loading="lazy"` (future)
- **Mobile-First**: Optimized for 480px and up
- **API Batching**: Single form submission = 1 HTTP POST

## Monitoring & Observability

### Vercel
- Function invocation metrics (calls, duration, memory)
- Build logs and deployment history
- Edge Function execution logs at `/api/leads-proxy`

### Supabase
- Query performance metrics
- Realtime connection stats
- Row-level security policy audit logs
- Database activity logs

### Application
- Browser console logs (searchable: `[leads-proxy]`)
- Sentry/LogRocket integration (optional, not yet added)
- Google Analytics (optional, not yet added)

## Future Enhancements

- [ ] Email notification on new lead
- [ ] SMS notification via Twilio
- [ ] Lead scoring based on budget/timeline
- [ ] Slack bot for realtime alerts
- [ ] CRM sync (HubSpot, Salesforce, Pipedrive)
- [ ] Advanced analytics dashboard
- [ ] A/B testing form variations
- [ ] Multi-language support (Hindi, English, Marathi)
