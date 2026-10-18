-- Give every account a permanent, unique 14-digit artist ID.
-- Existing accounts receive an ID only when artist_id is currently NULL.
CREATE SEQUENCE IF NOT EXISTS public.user_artist_id_seq AS bigint
  START WITH 10000000000000
  INCREMENT BY 1
  MINVALUE 10000000000000
  MAXVALUE 99999999999999
  NO CYCLE;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS artist_id text;

SELECT setval(
  'public.user_artist_id_seq'::regclass,
  GREATEST(
    COALESCE(MAX(artist_id::numeric) FILTER (WHERE artist_id ~ '^[0-9]{14}$'), 10000000000000),
    10000000000000
  )::bigint,
  MAX(artist_id) FILTER (WHERE artist_id ~ '^[0-9]{14}$') IS NOT NULL
)
FROM public.users;

UPDATE public.users
SET artist_id = nextval('public.user_artist_id_seq')::text
WHERE artist_id IS NULL OR btrim(artist_id) = '';

ALTER TABLE public.users
  ALTER COLUMN artist_id SET DEFAULT nextval('public.user_artist_id_seq'::regclass)::text,
  ALTER COLUMN artist_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND conname = 'users_artist_id_format_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_artist_id_format_check CHECK (artist_id ~ '^[0-9]{14}$');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS users_artist_id_unique_idx ON public.users (artist_id);

CREATE OR REPLACE FUNCTION public.prevent_user_artist_id_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.artist_id IS DISTINCT FROM OLD.artist_id THEN
    RAISE EXCEPTION 'artist_id is immutable' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_artist_id_immutable ON public.users;
CREATE TRIGGER users_artist_id_immutable
  BEFORE UPDATE OF artist_id ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_user_artist_id_change();
