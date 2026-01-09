-- Create a sequence for on_demand_receipt_no
CREATE SEQUENCE IF NOT EXISTS on_demand_receipt_no_seq;

-- Create a function to generate a unique receipt number for on_demand_orders
CREATE OR REPLACE FUNCTION generate_on_demand_receipt_no()
RETURNS TEXT AS $$
DECLARE
    next_id BIGINT;
    receipt_prefix TEXT := 'ODR-'; -- On Demand Receipt
BEGIN
    SELECT nextval('on_demand_receipt_no_seq') INTO next_id;
    RETURN receipt_prefix || LPAD(next_id::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Add payment_method and receipt_no columns to on_demand_orders table
ALTER TABLE public.on_demand_orders
ADD COLUMN payment_method TEXT NULL,
ADD COLUMN receipt_no TEXT DEFAULT generate_on_demand_receipt_no();

-- Add a check constraint for payment_method
ALTER TABLE public.on_demand_orders
ADD CONSTRAINT on_demand_orders_payment_method_check
CHECK (payment_method = ANY (ARRAY['Net'::text, 'Cash'::text]));

-- Add a unique constraint for receipt_no
ALTER TABLE public.on_demand_orders
ADD CONSTRAINT on_demand_orders_receipt_no_key UNIQUE (receipt_no);

-- Create an index for receipt_no for faster lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_on_demand_orders_receipt_no ON public.on_demand_orders USING btree (receipt_no);
