/*
  # Fix RLS policies for adhoc assignments

  1. Security Updates
    - Drop existing policies that aren't working properly
    - Create new policies that correctly check user roles
    - Ensure Admin/Super Admin can INSERT, UPDATE, SELECT assignments
    - Ensure Sales Reps can only SELECT their own assignments
    - Fix policy logic to properly access current user's role

  2. Policy Structure
    - Use EXISTS subqueries to check user roles from users table
    - Use auth.uid() to get current authenticated user ID
    - Separate policies for different operations (INSERT, SELECT, UPDATE)
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage all assignments" ON adhoc_assignments;
DROP POLICY IF EXISTS "Sales reps can view their assignments" ON adhoc_assignments;

-- Create new INSERT policy for Admins and Super Admins
CREATE POLICY "Allow Admin and Super Admin to insert assignments"
  ON adhoc_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('Admin', 'Super Admin')
    )
  );

-- Create new SELECT policy for Admins and Super Admins (all records)
CREATE POLICY "Allow Admin and Super Admin to view all assignments"
  ON adhoc_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('Admin', 'Super Admin')
    )
  );

-- Create new SELECT policy for Sales Reps (only their own assignments)
CREATE POLICY "Allow Sales Reps to view their own assignments"
  ON adhoc_assignments
  FOR SELECT
  TO authenticated
  USING (
    sales_rep_id = auth.uid() 
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'Sales Rep'
    )
  );

-- Create new UPDATE policy for Admins and Super Admins
CREATE POLICY "Allow Admin and Super Admin to update assignments"
  ON adhoc_assignments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('Admin', 'Super Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('Admin', 'Super Admin')
    )
  );

-- Also fix the adhoc_assignment_items policies
DROP POLICY IF EXISTS "Admins can manage assignment items" ON adhoc_assignment_items;
DROP POLICY IF EXISTS "Sales reps can update their assignment items" ON adhoc_assignment_items;
DROP POLICY IF EXISTS "Users can view assignment items" ON adhoc_assignment_items;

-- Create new policies for adhoc_assignment_items
CREATE POLICY "Allow Admin and Super Admin to manage assignment items"
  ON adhoc_assignment_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('Admin', 'Super Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('Admin', 'Super Admin')
    )
  );

CREATE POLICY "Allow Sales Reps to view and update their assignment items"
  ON adhoc_assignment_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM adhoc_assignments 
      WHERE adhoc_assignments.id = adhoc_assignment_items.assignment_id 
      AND adhoc_assignments.sales_rep_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role = 'Sales Rep'
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM adhoc_assignments 
      WHERE adhoc_assignments.id = adhoc_assignment_items.assignment_id 
      AND adhoc_assignments.sales_rep_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role = 'Sales Rep'
      )
    )
  );

-- Fix adhoc_orders policies
DROP POLICY IF EXISTS "Admins can manage all orders" ON adhoc_orders;
DROP POLICY IF EXISTS "Sales reps can create their orders" ON adhoc_orders;
DROP POLICY IF EXISTS "Sales reps can view their orders" ON adhoc_orders;
DROP POLICY IF EXISTS "Users can view relevant orders" ON adhoc_orders;

CREATE POLICY "Allow Admin and Super Admin to manage all adhoc orders"
  ON adhoc_orders
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('Admin', 'Super Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('Admin', 'Super Admin')
    )
  );

CREATE POLICY "Allow Sales Reps to manage their own adhoc orders"
  ON adhoc_orders
  FOR ALL
  TO authenticated
  USING (
    sales_rep_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'Sales Rep'
    )
  )
  WITH CHECK (
    sales_rep_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'Sales Rep'
    )
  );