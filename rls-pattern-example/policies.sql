alter table public.notes enable row level security;

-- Read: only your rows
drop policy if exists "notes_select_own" on public.notes;
create policy "notes_select_own"
on public.notes
for select
to authenticated
using (user_id = auth.uid());

-- Insert: only as yourself
drop policy if exists "notes_insert_own" on public.notes;
create policy "notes_insert_own"
on public.notes
for insert
to authenticated
with check (user_id = auth.uid());

-- Update: only your rows, and must remain yours
drop policy if exists "notes_update_own" on public.notes;
create policy "notes_update_own"
on public.notes
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Delete: only your rows
drop policy if exists "notes_delete_own" on public.notes;
create policy "notes_delete_own"
on public.notes
for delete
to authenticated
using (user_id = auth.uid());
