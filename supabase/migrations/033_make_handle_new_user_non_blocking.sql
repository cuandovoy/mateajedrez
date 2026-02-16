-- Ensure profile side-effects never break auth signup.
-- If profile insert fails for any reason (RLS, trigger, constraint), keep auth.users creation.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    INSERT INTO public.user_profiles (user_id, role, full_name)
    SELECT
      NEW.id,
      'user',
      COALESCE(NEW.raw_user_meta_data->>'full_name', NULL)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.user_id = NEW.id
    );
  EXCEPTION
    WHEN unique_violation THEN
      -- Ignore races: profile already exists.
      NULL;
    WHEN OTHERS THEN
      -- Never block signup because of profile/audit side-effects.
      RAISE WARNING 'handle_new_user failed for auth user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
