-- The RPC requires an authenticated caller so auth.uid() and RLS
-- can enforce ownership in the caller's database context.
revoke execute on function public.create_contact_message(text, text, text)
from public, anon;

grant execute on function public.create_contact_message(text, text, text)
to authenticated;
