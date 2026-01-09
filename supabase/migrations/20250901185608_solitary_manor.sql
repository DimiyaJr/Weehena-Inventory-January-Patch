/*
  # Fix RLS policies for adhoc assignments

  1. Security Updates
    - Drop existing problematic policies
    - Create proper INSERT, SELECT, UPDATE policies for adhoc_assignments
    - Create proper policies for adhoc_assignment_items and adhoc_orders
    - Ensure Admin/Super Admin can manage assignments
    - Ensure Sales Reps can view their own assignments and create orders

  2. Policy Structure
    - Use proper role checking from users table
    - Include both USING and WITH CHECK clauses where needed
    - Separate policies by operation type for clarity
*/

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Allow Admin and Super Admin to insert assignments" ON adhoc_assignments;
DROP POLICY IF EXISTS "Allow Admin and Super Admin to update assignments" ON adhoc_assignments;
DROP POLICY IF EXISTS "Allow Admin and Super Admin to view all assignments" ON adhoc_assignments;
DROP POLICY IF EXISTS "Allow Sales Reps to view their own assignments" ON adhoc_assignments;

DROP POLICY IF EXISTS "Allow Admin and Super Admin to manage assignment items" ON adhoc_assignment_items;
DROP POLICY IF EXISTS "Allow Sales Reps to view and update their assignment items" ON adhoc_assignment_items;

DROP POLICY IF EXISTS "Allow Admin and Super Admin to manage all adhoc orders" ON adhoc_orders;
DROP POLICY IF EXISTS "Allow Sales Reps to manage their own adhoc orders" ON adhoc_orders;

-- Adhoc Assignments Policies
CREATE POLICY "Admins can insert assignments"
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

CREATE POLICY "Admins can view all assignments"
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

CREATE POLICY "Sales Reps can view their assignments"
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

CREATE POLICY "Admins can update assignments"
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

-- Adhoc Assignment Items Policies
CREATE POLICY "Admins can manage assignment items"
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

CREATE POLICY "Sales Reps can view and update their assignment items"
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

-- Adhoc Orders Policies
CREATE POLICY "Admins can manage all adhoc orders"
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

CREATE POLICY "Sales Reps can manage their own adhoc orders"
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