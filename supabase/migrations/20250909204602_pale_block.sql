/*
  # Add email column to users table

  1. Schema Changes
    - Add `email` column to `users` table
    - Set email as unique and not null
    - Add index for email lookups

  2. Data Migration
    - Generate placeholder emails for existing users
    - Update existing users with temporary email addresses

  3. Security
    - Maintain existing RLS policies
    - Email column will be used for Supabase authentication
*/

-- Add email column to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'email'
  ) THEN
    ALTER TABLE users ADD COLUMN email text;
  END IF;
END $$;

-- Update existing users with placeholder emails if they don't have one
UPDATE users 
SET email = COALESCE(email, username || '@weehena.local')
WHERE email IS NULL OR email = '';

-- Make email not null and unique after populating existing records
ALTER TABLE users ALTER COLUMN email SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'users' AND constraint_name = 'users_email_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
  END IF;
END $$;

-- Add index for email lookups
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'users' AND indexname = 'idx_users_email'
  ) THEN
    CREATE INDEX idx_users_email ON users (email);
  END IF;
END $$;