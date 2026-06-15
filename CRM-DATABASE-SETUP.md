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
