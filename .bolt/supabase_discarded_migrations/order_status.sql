-- Remove the existing CHECK constraint
ALTER TABLE public.orders
DROP CONSTRAINT orders_status_check;

-- Add the new CHECK constraint with the additional status
ALTER TABLE public.orders
ADD CONSTRAINT orders_status_check CHECK (status = ANY (ARRAY['Pending'::text, 'In Progress'::text, 'Assigned'::text, 'Products Loaded'::text, 'Product Reloaded'::text, 'Security Check Incomplete'::text, 'Security Checked'::text, 'Departed Farm'::text, 'Delivered'::text, 'Cancelled'::text, 'Completed'::text, 'Security Check Bypassed Due to Off Hours'::text]));
