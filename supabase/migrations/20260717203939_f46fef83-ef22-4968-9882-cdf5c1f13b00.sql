
CREATE OR REPLACE FUNCTION public.get_leaderboard()
RETURNS TABLE (
  id uuid,
  full_name text,
  hr_code text,
  avatar_url text,
  points numeric,
  bonus numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    h.id,
    h.full_name,
    h.hr_code,
    h.avatar_url,
    (COALESCE(d.sum_amount, 0) + COALESCE(w.sum_amount, 0) + COALESCE(o.lifetime, 0))::numeric AS points,
    COALESCE(o.lifetime, 0)::numeric AS bonus
  FROM public.hr_profiles h
  LEFT JOIN (
    SELECT user_id, SUM(amount) AS sum_amount
    FROM public.daily_income
    GROUP BY user_id
  ) d ON d.user_id = h.id
  LEFT JOIN (
    SELECT user_id, SUM(amount) AS sum_amount
    FROM public.wallet_transactions
    WHERE type <> 'withdraw'
    GROUP BY user_id
  ) w ON w.user_id = h.id
  LEFT JOIN public.income_overrides o ON o.user_id = h.id
  WHERE h.status = 'approved'
  ORDER BY points DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard() TO authenticated;
