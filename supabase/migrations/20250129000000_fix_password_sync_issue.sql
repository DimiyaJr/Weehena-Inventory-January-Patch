-- Migration to fix password synchronization issues
-- This ensures the reset_user_password function is updated correctly

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.reset_user_password(uuid, text);

-- Recreate the function (keeping it for database record keeping)
CREATE OR REPLACE FUNCTION public.reset_user_password(
  p_user_id uuid, 
  p_new_password text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update password and flag in public.users table
  -- Note: Supabase Auth password should be updated separately via auth.updateUser()
  UPDATE users
  SET 
    password = p_new_password,
    is_temporary_password = false
  WHERE id = p_user_id;
  
  RETURN FOUND;
END;
$$;

-- Add comment explaining the dual-update requirement
COMMENT ON FUNCTION public.reset_user_password IS 
'Updates password in public.users table. IMPORTANT: When calling this function, you must also update the Supabase Auth password using supabase.auth.updateUser() to maintain synchronization.';
