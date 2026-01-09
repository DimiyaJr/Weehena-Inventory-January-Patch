-- File: supabase/migrations/20250929223000_add_sequential_receipt_no.sql

-- Create a sequence for receipt numbers
CREATE SEQUENCE public.receipt_no_seq
    INCREMENT 1
    START 1
    MINVALUE 1
    MAXVALUE 999999999999999999
    CACHE 1;

-- Create a function to generate sequential receipt numbers
CREATE OR REPLACE FUNCTION public.generate_receipt_no()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    next_val BIGINT;
    receipt_prefix TEXT := 'REC';
BEGIN
    SELECT nextval('public.receipt_no_seq') INTO next_val;
    RETURN receipt_prefix || LPAD(next_val::TEXT, 4, '0');
END;
$$;

-- Set the default value for receipt_no column to use the new function
ALTER TABLE public.orders
ALTER COLUMN receipt_no SET DEFAULT public.generate_receipt_no();

-- Optional: If you have existing orders without receipt_no, you can update them
-- UPDATE public.orders
-- SET receipt_no = public.generate_receipt_no()
-- WHERE receipt_no IS NULL;
