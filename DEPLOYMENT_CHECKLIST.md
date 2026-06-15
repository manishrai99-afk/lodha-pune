# Deployment Checklist — Lodha Pune Website

Production-ready deployment verification steps for Vercel, Supabase, and client deployment.

## Pre-Deployment (Local)

- [ ] Clone the repository: `git clone https://github.com/manishrai99-afk/lodha-pune.git`
- [ ] Run local server: `node server.js`
- [ ] Open http://127.0.0.1:4173/ and test form submission
- [ ] Verify responsive design on mobile (480px, 720px, 1040px+)
- [ ] Test all CTAs and navigation links
- [ ] Verify form fields: name, phone, requirement, budget, timeline

## Supabase Setup

- [ ] Create a Supabase project at https://supabase.com
- [ ] Copy Project URL and Project Reference ID
- [ ] Copy the Anon (public) and Service Role keys
- [ ] **Never commit** keys to Git — use environment variables only
- [ ] In Supabase SQL Editor, run migrations from `supabase/migrations/`:
  - [ ] `001_create_leads_table.sql` (creates `leads` table and indexes)
  - [ ] `002_policies.sql` (applies Row-Level Security for anon insert + authenticated read)
- [ ] Verify table exists: Supabase → Table Editor → `leads`
- [ ] Test RLS: anon user can INSERT, authenticated users can SELECT

## Vercel Deployment

1. **Connect Repository**
   - [ ] Sign in to Vercel: https://vercel.com/dashboard
   - [ ] Click "New Project" → Import from Git
   - [ ] Select `manishrai99-afk/lodha-pune` repository
   - [ ] Confirm Git integration

2. **Configure Project**
   - [ ] Root Directory: `/`
   - [ ] Framework Preset: `Other` (static site)
   - [ ] Build Command: leave blank (none)
   - [ ] Output Directory: `.`

3. **Add Environment Variables**
   - [ ] Go to Project Settings → Environment Variables
   - [ ] Add for Production, Preview, and Development:
     - `SUPABASE_URL` = `https://<your-project-ref>.supabase.co`
     - `SUPABASE_SERVICE_ROLE_KEY` = `<your-service-role-key>` (used only by `/api/leads-proxy`)
     - `SUPABASE_ANON_KEY` = `<your-anon-public-key>` (optional fallback for client)
     - `ADMIN_USER` = `<username>` (optional, for `/admin.html` Basic Auth)
     - `ADMIN_PASS` = `<password>` (optional, for `/admin.html` Basic Auth)
   - [ ] **Warning**: service_role_key is sensitive — mark as secret if available

4. **Deploy**
   - [ ] Click "Deploy" on the Vercel dashboard
   - [ ] Wait for deployment to complete (usually 1-2 minutes)
   - [ ] Open the production URL (e.g., https://lodha-pune.vercel.app)

## Post-Deployment Verification

- [ ] Site is accessible at production URL
- [ ] Form submission works: fill out lead form and submit
- [ ] Check Supabase → Table Editor → `leads` table for new rows
- [ ] Admin page accessible: `/admin.html` shows realtime leads (if SUPABASE_ANON_KEY is configured)
- [ ] Verify API proxy `/api/leads-proxy` logs in Vercel Functions
- [ ] Test on mobile device (iOS Safari, Android Chrome)
- [ ] Verify all images load correctly
- [ ] Test hero CTA buttons and navigation links
- [ ] Check that form error messages are clear and visible

## Monitoring & Maintenance

### Vercel
- [ ] Monitor Vercel dashboard for deployment errors
- [ ] Check Function logs for `/api/leads-proxy` errors
- [ ] Review visit analytics and Core Web Vitals

### Supabase
- [ ] Monitor `leads` table for incoming submissions
- [ ] Review RLS policies monthly to ensure security
- [ ] Set up Supabase alerts for unusual insertion patterns (optional)
- [ ] Export leads regularly for CRM or analysis

### Security Checklist
- [ ] **Never expose service_role_key in client code** (use Vercel env vars only)
- [ ] **Never hardcode SUPABASE_ANON_KEY in Git** — use env vars or `.env.local` locally
- [ ] Verify `/admin.html` requires authentication if `ADMIN_USER` and `ADMIN_PASS` are set
- [ ] Periodically rotate Supabase keys if compromised
- [ ] Use HTTPS only (Vercel enforces this automatically)
- [ ] Monitor referrer logs in `leads.referrer` to detect spam

## Troubleshooting

### Form submissions fail (500 error)
1. Check Vercel Function logs for `/api/leads-proxy`
2. Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in Vercel
3. Verify Supabase RLS policy allows `anon` INSERT: `ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY`
4. Test proxy directly: `curl -X POST https://lodha-pune.vercel.app/api/leads-proxy -H "Content-Type: application/json" -d '{"name":"Test","phone":"9999999999"}'`

### Admin page shows "Could not load leads"
1. Verify `SUPABASE_ANON_KEY` is set in Vercel or hardcoded in `admin.html`
2. Check Supabase project URL is correct in `admin.html`
3. Verify RLS policy allows authenticated SELECT: `CREATE POLICY "Allow authenticated select" ON public.leads FOR SELECT TO authenticated USING (true)`
4. Open browser DevTools → Network tab and inspect the Supabase API response

### WhatsApp fallback triggered
1. Check Supabase proxy is not responding (check Vercel logs)
2. Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel env
3. Test by submitting form again after proxy is fixed

## Rollback Plan

If deployment issues occur:
1. Revert to previous commit: `git revert <commit-hash>`
2. Push to GitHub: `git push`
3. Vercel automatically re-deploys from the new commit
4. Or manually redeploy from Vercel dashboard

## Support & Documentation

- Supabase Docs: https://supabase.com/docs
- Vercel Docs: https://vercel.com/docs
- Repository Issues: https://github.com/manishrai99-afk/lodha-pune/issues
- CRM Setup: See `CRM-DATABASE-SETUP.md`
