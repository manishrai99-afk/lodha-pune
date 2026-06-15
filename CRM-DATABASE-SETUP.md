# 24K Realtors CRM Lead Database

Recommended database: Supabase.

Supabase is a good fit because this website is static, but you still get a real Postgres database, REST APIs for your CRM, row-level security, and easy export later.

## Setup

1. Create a Supabase project.
2. Open the SQL editor and run `supabase-leads.sql`.
3. Go to Project Settings > API.
4. Copy the Project URL and anon public key.
5. Paste them in `script.js`:

```js
const SUPABASE_URL = "https://your-project.supabase.co";
const SUPABASE_ANON_KEY = "your-anon-public-key";
```

## CRM Integration

Your CRM can read from the `leads` table and filter by:

- `crm_stage`
- `lead_source`
- `lead_series`
- `utm_campaign`
- `created_at`

Use a private service-role key only inside your CRM backend. Do not put the service-role key in this website.

The public website is allowed to insert leads only. Visitors cannot read lead data from the browser.

## How the Website Saves Leads

The form posts directly to:

```text
https://your-project.supabase.co/rest/v1/leads
```

No extra JavaScript package is required.

## Live tracking (Admin)

You can monitor incoming enquiries in real time using the included `admin.html` page.

Steps:

1. Open `admin.html` in the browser after deploying (or via local server).
2. The page connects to Supabase and loads the most recent 50 leads, then subscribes to new inserts and displays them live.
3. By default this page uses the public anon key present in `script.js`. For production, prefer to restrict keys, use network policies, or serve admin access behind authentication.

Security note: The anon key allows inserts and realtime subscriptions. Do not expose a service-role key in client-side code.

## Local testing and admin protection

- For local testing, you can enable simple Basic Auth for the included preview server by setting two environment variables before running `server.js`:

	- `ADMIN_USER` — username for admin access
	- `ADMIN_PASS` — password for admin access

	Example (PowerShell):

	```powershell
	$env:ADMIN_USER = "admin"; $env:ADMIN_PASS = "s3cret"; node server.js
	```

	When these are set, requests to `/admin.html` (and paths starting with `/admin`) will require Basic Auth.

## Vercel / Production

- In Vercel, add the following Environment Variables in Project Settings → Environment Variables:

	- `SUPABASE_URL` = your project URL (e.g. `https://...supabase.co`)
	- `SUPABASE_ANON_KEY` = your anon public key
	- Optionally: `ADMIN_USER` and `ADMIN_PASS` if you deploy the preview server or use server-side auth

- Prefer gating `admin.html` behind a proper auth layer (serverless function, password-protect, or platform access controls) rather than relying only on a client-visible key.

If you want, I can add a simple serverless auth gateway or convert `admin.html` into a server-rendered admin UI behind login.
