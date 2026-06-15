-- 002_policies.sql
-- Policy: allow anonymous inserts only (used by public website)
drop policy if exists "Allow public lead submissions" on public.leads;
create policy "Allow public lead submissions"
on public.leads
for insert
to anon
with check (true);

-- Policy: allow authenticated users to select leads (admin users)
drop policy if exists "Allow authenticated select" on public.leads;
create policy "Allow authenticated select"
on public.leads
for select
to authenticated
using (true);

-- Note: keep service_role key in server-only environment; do not add service_role policies here.
