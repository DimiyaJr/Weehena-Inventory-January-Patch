-- Rename 'reason' column to 'return_reason'
ALTER TABLE public.order_returns
RENAME COLUMN reason TO return_reason;

-- Add 'returned_by' column
ALTER TABLE public.order_returns
ADD COLUMN returned_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- Add 'returned_at' column
ALTER TABLE public.order_returns
ADD COLUMN returned_at timestamp with time zone DEFAULT now();

-- Update RLS Policy: Sales Reps can insert their own return records
-- Drop existing policy first if it conflicts with new columns
DROP POLICY IF EXISTS "Sales Rep Insert Own Order Returns" ON public.order_returns;
CREATE POLICY "Sales Rep Insert Own Order Returns" ON public.order_returns
FOR INSERT TO authenticated
WITH CHECK (sales_rep_id = auth.uid() AND returned_by = auth.uid());

-- Update RLS Policy: Sales Reps can view their own return records
-- No change needed for SELECT policy based on sales_rep_id

-- Update RLS Policy: Super Admins can do anything
DROP POLICY IF EXISTS "Super Admin All Order Returns" ON public.order_returns;
CREATE POLICY "Super Admin All Order Returns" ON public.order_returns
FOR ALL USING (get_user_role() = 'Super Admin') WITH CHECK (get_user_role() = 'Super Admin');

-- Update RLS Policy: Admins can do anything
DROP POLICY IF EXISTS "Admin All Order Returns" ON public.order_returns;
CREATE POLICY "Admin All Order Returns" ON public.order_returns
FOR ALL USING (get_user_role() = 'Admin') WITH CHECK (get_user_role() = 'Admin');
