create or replace function public.create_contact_message(
  p_name text,
  p_email text,
  p_message text
)
returns public.contact_messages
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.contact_messages;
  v_name text;
  v_email text;
  v_message text;
begin
  v_name := trim(p_name);
  v_email := lower(trim(p_email));
  v_message := trim(p_message);

  if p_name is null or length(v_name) < 2 then
    raise exception using
      errcode = '22023',
      message = 'name is required';
  end if;

  if p_email is null
     or length(v_email) < 5
     or position('@' in v_email) = 0 then
    raise exception using
      errcode = '22023',
      message = 'email is invalid';
  end if;

  if p_message is null or length(v_message) < 5 then
    raise exception using
      errcode = '22023',
      message = 'message is required';
  end if;

  insert into public.contact_messages (name, email, message)
  values (v_name, v_email, v_message)
  returning * into v_row;

  return v_row;
end;
$$;
