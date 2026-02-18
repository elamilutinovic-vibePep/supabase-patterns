create or replace function public.create_contact_message(
  p_name text,
  p_email text,
  p_message text
)
returns public.contact_messages
language plpgsql
security invoker
as $$
declare
  v_row public.contact_messages;
  v_email text;
begin
  if p_name is null or length(trim(p_name)) < 2 then
    raise exception 'name is required';
  end if;

  if p_email is null or length(trim(p_email)) < 5 then
    raise exception 'email is required';
  end if;

  v_email := lower(trim(p_email));

  if p_message is null or length(trim(p_message)) < 5 then
    raise exception 'message is required';
  end if;

  insert into public.contact_messages (name, email, message)
  values (trim(p_name), v_email, trim(p_message))
  returning * into v_row;

  return v_row;
end;
$$;
