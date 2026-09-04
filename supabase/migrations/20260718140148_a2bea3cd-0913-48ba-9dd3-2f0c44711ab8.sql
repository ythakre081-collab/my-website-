ALTER TABLE public.broker_legality
  ADD COLUMN IF NOT EXISTS play_store_downloads text,
  ADD COLUMN IF NOT EXISTS play_store_rating numeric,
  ADD COLUMN IF NOT EXISTS play_store_url text;