-- Remove the existing CHECK constraint
ALTER TABLE public.orders
DROP CONSTRAINT orders_security_check_status_check;

-- Add the new CHECK constraint with the additional status
ALTER TABLE public.orders
ADD CONSTRAINT orders_security_check_status_check CHECK (security_check_status = ANY (ARRAY['pending'::text, 'completed'::text, 'incomplete'::text, 'bypassed'::text]));
