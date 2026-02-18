-- Controlled insert via RPC
create or replace function public.create_note(p_title text, p_body text default null)
returns public.notes
language plpgsql
security invoker
as $$
declare
  v_row public.notes;
begin
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'title is required';
  end if;

  insert into public.notes (title, body)
  values (trim(p_title), p_body)
  returning * into v_row;

  return v_row;
end;
$$;
