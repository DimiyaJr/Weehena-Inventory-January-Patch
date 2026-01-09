/*
  # Add Product Price Control System

  1. Database Changes
    - Add `min_price` and `max_price` columns to products table
    - Update existing products with default values
    - Add validation constraints

  2. Security
    - Maintain existing RLS policies
    - Price control logic handled in application layer

  3. Data Migration
    - Set min_price to 90% of current price
    - Set max_price to 110% of current price
    - Ensures existing products have valid ranges
*/

-- Add min_price and max_price columns to products table
DO $$
BEGIN
  -- Add min_price column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'min_price'
  ) THEN
    ALTER TABLE products ADD COLUMN min_price numeric(10,2) DEFAULT 0;
  END IF;

  -- Add max_price column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'max_price'
  ) THEN
    ALTER TABLE products ADD COLUMN max_price numeric(10,2) DEFAULT 0;
  END IF;
END $$;

-- Update existing products with reasonable min/max price ranges
-- Set min_price to 90% of current price and max_price to 110% of current price
UPDATE products 
SET 
  min_price = ROUND(price * 0.9, 2),
  max_price = ROUND(price * 1.1, 2)
WHERE min_price = 0 OR max_price = 0;

-- Add constraints to ensure min_price <= max_price
DO $$
BEGIN
  -- Add constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'products' AND constraint_name = 'products_price_range_check'
  ) THEN
    ALTER TABLE products 
    ADD CONSTRAINT products_price_range_check 
    CHECK (min_price >= 0 AND max_price >= min_price);
  END IF;
END $$;

-- Create index for price range queries
CREATE INDEX IF NOT EXISTS idx_products_price_range ON products (min_price, max_price);

-- Add comment to document the new columns
COMMENT ON COLUMN products.min_price IS 'Minimum selling price that Sales Reps can use';
COMMENT ON COLUMN products.max_price IS 'Maximum selling price that Sales Reps can use';