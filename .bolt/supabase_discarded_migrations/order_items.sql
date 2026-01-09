ALTER TABLE public.order_items
ADD COLUMN returned_quantity numeric(10,2) NOT NULL DEFAULT 0;
