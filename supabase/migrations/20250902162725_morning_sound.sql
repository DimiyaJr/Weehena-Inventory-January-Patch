/*
  # Add price threshold system

  1. Schema Changes
    - Add `price_threshold` column to products table
    - Set default value to 0 for existing products
    - Add constraint to ensure threshold is non-negative

  2. Security
    - No changes to existing RLS policies needed
*/

-- Add price_threshold column to products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'price_threshold'
  ) THEN
    ALTER TABLE products ADD COLUMN price_threshold numeric(10,2) DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Add constraint to ensure threshold is non-negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'products_price_threshold_check'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_price_threshold_check CHECK (price_threshold >= 0);
  END IF;
END $$;