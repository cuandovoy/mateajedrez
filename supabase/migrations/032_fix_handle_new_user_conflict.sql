-- Fix signup failures caused by ON CONFLICT(user_id) after moving to a partial unique index
-- on user_profiles.user_id (WHERE user_id IS NOT NULL).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert profile only if it does not already exist.
  -- This avoids relying on ON CONFLICT(user_id), which can fail with partial unique indexes.
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

  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Safe guard for race conditions; if profile was created concurrently, continue signup.
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
