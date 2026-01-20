/*
  # Fix Authentication Password Sync for Affected Users
  
  1. Problem
    - Two users (Sasmika_Devmith and quadexa_dev_team) have mismatched passwords
    - public.users table has correct plain text passwords
    - auth.users table has incorrect encrypted passwords
    - This causes "Invalid login credentials" error
  
  2. Solution
    - Update auth.users encrypted_password to match public.users password
    - Use crypt() function to properly hash passwords
    - Create helper function for future password syncing needs
  
  3. Security Notes
    - This is a one-time fix for existing users
    - Future password changes will use the updated resetPassword function
    - Both auth.users and public.users will stay synchronized
*/

-- Fix the two affected users immediately
UPDATE auth.users 
SET encrypted_password = crypt('1234@Devmith', gen_salt('bf')),
    updated_at = now()
WHERE email = 'sasmikad@gmail.com';

UPDATE auth.users 
SET encrypted_password = crypt('1234@Quadexa', gen_salt('bf')),
    updated_at = now()
WHERE email = 'quadexa@gmail.com';

-- Create a helper function for admins to manually sync passwords if needed in the future
CREATE OR REPLACE FUNCTION public.admin_sync_user_password(
  p_user_email text,
  p_new_password text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get user ID from email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_user_email;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found with email: %', p_user_email;
  END IF;
  
  -- Update auth.users encrypted password
  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
      updated_at = now()
  WHERE id = v_user_id;
  
  -- Update public.users password
  UPDATE public.users
  SET password = p_new_password,
      is_temporary_password = false
  WHERE id = v_user_id;
  
  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.admin_sync_user_password IS 
'Admin function to synchronize passwords in both auth.users and public.users tables. Use with caution. Only for emergency password recovery.';
