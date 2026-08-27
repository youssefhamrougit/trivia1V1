-- ============================================================================
--  username-validation.sql — server-side username validation
--
--  The client validates usernames with a regex, but the anon key is public:
--  anyone can call PostgREST directly and bypass client-side checks. This
--  trigger enforces the same rules on the database so bad usernames never
--  make it into the profiles table.
--
--  Rules (must match app.js USERNAME_RE):
--    • 3–20 characters
--    • letters (a-z, A-Z), digits (0-9), underscore only
--    • no leading/trailing whitespace (trimmed by the trigger)
--
--  Safe to re-run (idempotent).
-- ============================================================================

-- the validation function — runs on every INSERT or UPDATE of profiles.username
create or replace function public.validate_username()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  clean text;
begin
  -- trim whitespace and lowercase (matches the JS client behavior)
  clean := lower(btrim(coalesce(NEW.username, '')));

  -- reject empty usernames (guests get auto-generated names, never empty)
  if length(clean) = 0 then
    raise exception 'Username cannot be empty';
  end if;

  -- enforce length
  if length(clean) < 3 or length(clean) > 20 then
    raise exception 'Username must be 3–20 characters (got %)', length(clean);
  end if;

  -- enforce character set: letters, digits, underscore only
  if clean !~ '^[a-z0-9_]+$' then
    raise exception 'Username can only contain letters, numbers, and underscores';
  end if;

  -- reject reserved / bot prefixes that could impersonate system accounts
  if clean like 'player\_%' or clean like 'bot\_%' then
    raise exception 'Username cannot start with "player_" or "bot_"';
  end if;

  -- write the cleaned value back so the DB never stores whitespace or mixed case
  NEW.username := clean;
  return NEW;
end;
$$;

-- drop + recreate so the trigger always reflects the latest function body
drop trigger if exists validate_username on public.profiles;
create trigger validate_username
  before insert or update of username on public.profiles
  for each row execute procedure public.validate_username();
