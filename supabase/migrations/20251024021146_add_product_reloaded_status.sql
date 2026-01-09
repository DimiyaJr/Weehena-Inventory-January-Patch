/*
  # Add Product Reloaded Status

  1. Changes
    - Add "Product Reloaded" status to orders table constraint
    - This allows sales reps to mark products as reloaded after security check incomplete

  2. Status Flow
    - Security Check Incomplete → Product Reloaded (sales rep reloads products)
    - Product Reloaded → Security Checked or Security Check Incomplete (security re-checks)

  3. Security
    - No changes to RLS policies
    - Existing role-based permissions remain unchanged
*/

-- Drop existing constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'orders_status_check'
    AND table_name = 'orders'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT orders_status_check;
  END IF;
END $$;

-- Add updated constraint with "Product Reloaded" status
ALTER TABLE orders
ADD CONSTRAINT orders_status_check
CHECK (status = ANY (ARRAY[
  'Pending'::text,
  'In Progress'::text,
  'Assigned'::text,
  'Products Loaded'::text,
  'Product Reloaded'::text,
  'Security Check Incomplete'::text,
  'Security Checked'::text,
  'Departed Farm'::text,
  'Delivered'::text,
  'Cancelled'::text,
  'Completed'::text
]));