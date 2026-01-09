/*
  # Fix RLS Policies for on_demand_order_payments table

  1. Problem
    - Only INSERT policy exists, missing SELECT, UPDATE, DELETE policies
    - Causes 403 Forbidden errors when trying to read or modify payment records

  2. Solution
    - Add SELECT policy for authenticated users to view payment records for their orders
    - Add UPDATE policy for authenticated users to update their payment records
    - Add DELETE policy for authenticated users to delete their payment records
    - Keep the existing INSERT policy
    - All policies use role-based access control through the collected_by field

  3. Security
    - Users can only view/update/delete payment records they collected
    - Authenticated users required for all operations
    - No public access to payment data
*/

-- Add SELECT policy for reading payment records
CREATE POLICY "Authenticated users can view on-demand order payments they collected"
  ON public.on_demand_order_payments
  FOR SELECT
  TO authenticated
  USING (collected_by = auth.uid());

-- Add UPDATE policy for modifying payment records
CREATE POLICY "Authenticated users can update on-demand order payments they collected"
  ON public.on_demand_order_payments
  FOR UPDATE
  TO authenticated
  USING (collected_by = auth.uid())
  WITH CHECK (collected_by = auth.uid());

-- Add DELETE policy for removing payment records
CREATE POLICY "Authenticated users can delete on-demand order payments they collected"
  ON public.on_demand_order_payments
  FOR DELETE
  TO authenticated
  USING (collected_by = auth.uid());
