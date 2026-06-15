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
