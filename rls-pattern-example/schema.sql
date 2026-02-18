-- notes schema (owner-only)
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  title text not null,
  body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- optional: keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_notes_set_updated_at on public.notes;
create trigger trg_notes_set_updated_at
before update on public.notes
for each row execute function public.set_updated_at();
