/*
  # Modify pricing system to use threshold pricing

  1. Schema Changes
    - Remove `min_price` and `max_price` columns from products table
    - Add `threshold_price` column to products table
    - Update existing data to use current price as threshold

  2. Security
    - Maintain existing RLS policies on products table

  3. Data Migration
    - Set threshold_price to current price for existing products
    - Ensure no data loss during migration
*/

-- Add threshold_price column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'threshold_price'
  ) THEN
    ALTER TABLE products ADD COLUMN threshold_price numeric(10,2) DEFAULT 0;
  END IF;
END $$;

-- Migrate existing data: set threshold_price to current price
UPDATE products 
SET threshold_price = price 
WHERE threshold_price = 0 OR threshold_price IS NULL;

-- Make threshold_price NOT NULL after data migration
ALTER TABLE products ALTER COLUMN threshold_price SET NOT NULL;

-- Add constraint to ensure threshold_price is positive
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'products' AND constraint_name = 'products_threshold_price_check'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_threshold_price_check CHECK (threshold_price > 0);
  END IF;
END $$;

-- Remove old price range constraints and columns
DO $$
BEGIN
  -- Drop the old price range check constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'products' AND constraint_name = 'products_price_range_check'
  ) THEN
    ALTER TABLE products DROP CONSTRAINT products_price_range_check;
  END IF;
END $$;

-- Remove min_price and max_price columns
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'min_price'
  ) THEN
    ALTER TABLE products DROP COLUMN min_price;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'max_price'
  ) THEN
    ALTER TABLE products DROP COLUMN max_price;
  END IF;
END $$;