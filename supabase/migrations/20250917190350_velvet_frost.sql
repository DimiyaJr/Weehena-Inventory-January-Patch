/*
  # Add vehicle number to orders

  1. Schema Changes
    - Add `vehicle_number` column to `orders` table
    - Add `vehicle_number` column to `on_demand_assignments` table

  2. Security
    - No changes to existing RLS policies
    - Vehicle number accessible based on existing order access rules

  3. Notes
    - Vehicle number is optional (nullable)
    - Used for tracking which vehicle is assigned to deliver orders
*/

-- Add vehicle_number to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'vehicle_number'
  ) THEN
    ALTER TABLE orders ADD COLUMN vehicle_number text;
  END IF;
END $$;

-- Add vehicle_number to on_demand_assignments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'on_demand_assignments' AND column_name = 'vehicle_number'
  ) THEN
    ALTER TABLE on_demand_assignments ADD COLUMN vehicle_number text;
  END IF;
END $$;