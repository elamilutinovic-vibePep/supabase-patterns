create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),

  name text not null,
  email text not null,
  message text not null,

  created_at timestamptz not null default now()
);
