alter table public.contact_messages enable row level security;

-- Allow user to insert ONLY their own message
drop policy if exists "contact_insert_own" on public.contact_messages;
create policy "contact_insert_own"
on public.contact_messages
for insert
to authenticated
with check (user_id = auth.uid());

-- Optional: allow user to read only their messages (usually OK)
drop policy if exists "contact_select_own" on public.contact_messages;
create policy "contact_select_own"
on public.contact_messages
for select
to authenticated
using (user_id = auth.uid());
