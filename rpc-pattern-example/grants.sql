-- Remove default and anonymous access before granting the intended role.
revoke execute on function public.create_note(text, text)
from public, anon;

grant execute on function public.create_note(text, text)
to authenticated;
