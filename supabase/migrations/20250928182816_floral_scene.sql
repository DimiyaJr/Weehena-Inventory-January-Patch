/*
  # Add Request ID to Orders Table

  1. Schema Changes
    - Add `request_id` column to `orders` table
    - Column is optional (nullable) for backward compatibility
    - Add index for performance on request_id lookups

  2. Security
    - No changes to RLS policies needed as this is just adding a column
    - Existing policies will continue to work with the new column
*/

-- Add request_id column to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'request_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN request_id text;
  END IF;
END $$;

-- Add index for request_id for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_request_id ON orders USING btree (request_id);