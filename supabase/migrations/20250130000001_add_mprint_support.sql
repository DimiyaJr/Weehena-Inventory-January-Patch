/*
  # Add mPrint Mobile Printer Support
  
  ## Summary
  This migration adds support for tracking mobile bill printing method (mPrint vs local print).
*/

-- Add bill_print_method column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bill_print_method text DEFAULT 'local_print' CHECK (bill_print_method IN ('local_print', 'mprint', 'none'));

-- Add bill_print_method column to on_demand_orders table
ALTER TABLE on_demand_orders ADD COLUMN IF NOT EXISTS bill_print_method text DEFAULT 'local_print' CHECK (bill_print_method IN ('local_print', 'mprint', 'none'));

-- Create index for bill_print_method for faster queries
CREATE INDEX IF NOT EXISTS orders_bill_print_method_idx ON orders(bill_print_method);
CREATE INDEX IF NOT EXISTS on_demand_orders_bill_print_method_idx ON on_demand_orders(bill_print_method);

-- Optional: Create print_history table for analytics
CREATE TABLE IF NOT EXISTS print_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid,
  on_demand_order_id uuid,
  print_method text NOT NULL CHECK (print_method IN ('local_print', 'mprint')),
  printed_by uuid REFERENCES users(id),
  printed_at timestamptz DEFAULT now(),
  device_type text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT print_history_order_check CHECK (
    (order_id IS NOT NULL AND on_demand_order_id IS NULL) OR
    (order_id IS NULL AND on_demand_order_id IS NOT NULL)
  )
);

-- Enable RLS on print_history
ALTER TABLE print_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for print_history
CREATE POLICY "Users can view print history for their orders"
  ON print_history
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert print history"
  ON print_history
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
