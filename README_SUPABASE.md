# Supabase setup — migrations and proxy

Files in `supabase/migrations/`:

- `001_create_leads_table.sql` — creates the `leads` table and indexes.
- `002_policies.sql` — applies Row-Level Security policies: allows anonymous `INSERT` and allows authenticated `SELECT`.

How to apply:

1. Open Supabase project → SQL editor.
2. Run the contents of `supabase/migrations/001_create_leads_table.sql` then `002_policies.sql` (in that order).

Notes on keys and security:

- The website can use the `Anon (public)` key to `INSERT` leads because the policy allows `anon` insert. Do NOT use the service role key in client-side code.
- For admin reads and realtime, prefer either:
  - protect `admin.html` behind authentication and use an authenticated Supabase user to `SELECT`, or
  - use a serverless proxy (example `api/leads-proxy.js`) that stores `SUPABASE_SERVICE_ROLE_KEY` in server env vars and performs reads/writes server-side.

Vercel deployment hints:

- Add environment variables in Vercel Project Settings:
  - `SUPABASE_URL` = https://<your-ref>.supabase.co
  - `SUPABASE_ANON_KEY` = <anon public key>
  - `SUPABASE_SERVICE_ROLE_KEY` = <service_role key> (set only for server-side functions, keep as secret)

Example flow using `api/leads-proxy.js`:

- Client posts lead details to `/api/leads-proxy` (no Supabase key in client)
- `api/leads-proxy` inserts into Supabase using `SERVICE_ROLE_KEY` and returns the DB response.
