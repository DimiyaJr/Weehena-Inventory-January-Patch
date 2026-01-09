/*
  # Add Final Delivery Weight to Order Items

  1. New Columns
    - Add `final_delivery_weight_kg` to `order_items` table
      - Type: numeric(10,2)
      - Nullable (optional)
      - Default: NULL
      - Used for chicken category products to track final delivery weight for billing

  2. Indexes
    - Create index on final_delivery_weight_kg for query performance

  3. Notes
    - This field is used only for chicken category products (BT, LD, OC, PS, WT)
    - When populated, it replaces quantity in price calculation
    - Optional field - payments work without it
*/

-- Add final_delivery_weight_kg column to order_items if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'final_delivery_weight_kg'
  ) THEN
    ALTER TABLE public.order_items ADD COLUMN final_delivery_weight_kg numeric(10,2) DEFAULT NULL;
  END IF;
END $$;

-- Create index for final_delivery_weight_kg for faster queries
CREATE INDEX IF NOT EXISTS idx_order_items_final_delivery_weight ON public.order_items(final_delivery_weight_kg);

-- Add comment to explain the column purpose
COMMENT ON COLUMN public.order_items.final_delivery_weight_kg IS 'Final delivery weight in Kg for chicken products. Used to recalculate payment amounts. Optional field.';
