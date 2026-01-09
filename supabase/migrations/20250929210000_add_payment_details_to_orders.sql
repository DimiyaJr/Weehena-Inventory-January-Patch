-- supabase/migrations/20250929210000_add_payment_details_to_orders.sql

-- Add payment_method column
ALTER TABLE public.orders
ADD COLUMN payment_method TEXT;

-- Add receipt_no column with a unique constraint
ALTER TABLE public.orders
ADD COLUMN receipt_no TEXT UNIQUE;

-- Optional: Add an index to receipt_no for faster lookups
CREATE INDEX idx_orders_receipt_no ON public.orders (receipt_no);
