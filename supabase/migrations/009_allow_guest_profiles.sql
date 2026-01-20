-- Allow guest profiles (user_profiles without user_id)
-- This migration enables creating user profiles for guests who make purchases without authentication

-- First, allow user_id to be NULL in user_profiles table
ALTER TABLE user_profiles 
  ALTER COLUMN user_id DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS user_profiles_user_id_fkey;

-- Re-add foreign key constraint but allow NULL
ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- Remove UNIQUE constraint on user_id since we can have multiple guest profiles
ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_user_id_key;

-- Add a unique constraint that allows multiple NULLs but only one non-null per user
-- This is handled by the foreign key, but we can add a partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_user_id_unique 
  ON user_profiles (user_id) 
  WHERE user_id IS NOT NULL;

-- Update RLS policies to allow inserting guest profiles
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

CREATE POLICY "Users can insert own profile or guest profile"
  ON user_profiles FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    OR user_id IS NULL
  );

-- Update SELECT policy to allow viewing guest profiles
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;

CREATE POLICY "Users can view own profile, guest profiles, or admins can view all"
  ON user_profiles FOR SELECT
  USING (
    auth.uid() = user_id 
    OR user_id IS NULL
    OR public.is_admin(auth.uid())
  );

-- Update UPDATE policy
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

CREATE POLICY "Users can update own profile or guest profiles"
  ON user_profiles FOR UPDATE
  USING (
    auth.uid() = user_id 
    OR user_id IS NULL
  )
  WITH CHECK (
    auth.uid() = user_id 
    OR user_id IS NULL
  );
