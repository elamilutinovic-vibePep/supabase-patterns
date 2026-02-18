-- Allow authenticated users to call the function
grant execute on function public.create_note(text, text) to authenticated;
