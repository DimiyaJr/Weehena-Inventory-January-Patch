/*
  # Add Payment Tracking Columns to Orders Tables

  1. Schema Changes
    - Add `payment_status` to orders table
    - Add `collected_amount` to orders table
    - Add `payment_status` to on_demand_orders table
    - Add `collected_amount` to on_demand_orders table

  2. Notes
    - payment_status tracks: 'fully_paid', 'partially_paid', 'unpaid'
    - collected_amount tracks total amount collected across all payments
    - These columns work together with payment tables for audit trail
*/

-- Add payment_status and collected_amount to orders table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN payment_status text DEFAULT 'unpaid' CHECK (payment_status IN ('fully_paid', 'partially_paid', 'unpaid'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'collected_amount'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN collected_amount numeric(10,2) DEFAULT 0 CHECK (collected_amount >= 0);
  END IF;
END $$;

-- Add payment_status and collected_amount to on_demand_orders table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'on_demand_orders' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE public.on_demand_orders ADD COLUMN payment_status text DEFAULT 'unpaid' CHECK (payment_status IN ('fully_paid', 'partially_paid', 'unpaid'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'on_demand_orders' AND column_name = 'collected_amount'
  ) THEN
    ALTER TABLE public.on_demand_orders ADD COLUMN collected_amount numeric(10,2) DEFAULT 0 CHECK (collected_amount >= 0);
  END IF;
END $$;

-- Create indexes for payment status filtering
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_on_demand_orders_payment_status ON public.on_demand_orders(payment_status);
