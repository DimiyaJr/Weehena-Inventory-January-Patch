-- One-time migration to sync passwords for affected users
-- This updates Supabase Auth passwords to match the public.users table

-- NOTE: This migration requires manual execution of auth updates
-- You'll need to run the following for each affected user after this migration:

-- For Sasmika_Devmith:
-- UPDATE auth.users SET encrypted_password = crypt('1234@Devmith', gen_salt('bf')) 
-- WHERE email = 'sasmikad@gmail.com';

-- For quadexa_dev_team:
-- UPDATE auth.users SET encrypted_password = crypt('1234@Quadexa', gen_salt('bf')) 
-- WHERE email = 'quadexa@gmail.com';

-- Add a helper function for admins to manually sync passwords if needed
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
'Admin function to synchronize passwords in both auth.users and public.users tables. Use with caution.';
