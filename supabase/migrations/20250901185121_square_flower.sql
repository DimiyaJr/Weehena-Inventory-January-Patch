/*
  # Fix RLS policies for ad-hoc assignments

  1. Security Updates
    - Add INSERT policy for adhoc_assignments table
    - Allow Admins and Super Admins to create assignments
    - Allow Sales Reps to create orders for their assignments
  
  2. Policy Changes
    - Enable INSERT permissions for Admin/Super Admin roles
    - Enable INSERT permissions for Sales Reps on adhoc_orders
    - Maintain existing SELECT policies
*/

-- Fix INSERT policy for adhoc_assignments
DROP POLICY IF EXISTS "Admins can manage all assignments" ON adhoc_assignments;

CREATE POLICY "Admins can manage all assignments"
  ON adhoc_assignments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('Super Admin', 'Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('Super Admin', 'Admin')
    )
  );

-- Fix INSERT policy for adhoc_orders
DROP POLICY IF EXISTS "Sales reps can create their orders" ON adhoc_orders;

CREATE POLICY "Sales reps can create their orders"
  ON adhoc_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sales_rep_id = auth.uid() 
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'Sales Rep'
    )
  );

-- Ensure proper SELECT policies exist
CREATE POLICY "Sales reps can view their orders" 
  ON adhoc_orders
  FOR SELECT
  TO authenticated
  USING (
    sales_rep_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('Super Admin', 'Admin')
    )
  );

-- Fix INSERT policy for adhoc_assignment_items
DROP POLICY IF EXISTS "Admins can manage assignment items" ON adhoc_assignment_items;

CREATE POLICY "Admins can manage assignment items"
  ON adhoc_assignment_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('Super Admin', 'Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('Super Admin', 'Admin')
    )
  );