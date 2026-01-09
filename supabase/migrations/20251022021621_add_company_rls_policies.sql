/*
  # Add Row Level Security Policies for Multi-Tenant Company Isolation
  
  ## Summary
  This migration implements comprehensive Row Level Security (RLS) policies to enforce
  strict data isolation between Weehena Chicken Farm and Weehena Sausage Farm.
  
  ## Changes Made
  
  ### 1. Products Table
  - SELECT: Users can only view products from their assigned company
  - INSERT: Users can only create products for their assigned company
  - UPDATE: Users can only update products from their assigned company
  - DELETE: Users can only delete products from their assigned company
  
  ### 2. Customers Table
  - SELECT: Users can only view customers from their assigned company
  - INSERT: Users can only create customers for their assigned company
  - UPDATE: Users can only update customers from their assigned company
  - DELETE: Users can only delete customers from their assigned company
  
  ### 3. Orders Table
  - SELECT: Users can only view orders from their assigned company
  - INSERT: Users can only create orders for their assigned company
  - UPDATE: Users can only update orders from their assigned company
  - DELETE: Users can only delete orders from their assigned company
  
  ### 4. Order Items Table
  - SELECT: Users can only view order items from their assigned company
  - INSERT: Users can only create order items for their assigned company
  - UPDATE: Users can only update order items from their assigned company
  - DELETE: Users can only delete order items from their assigned company
  
  ### 5. Categories Table
  - SELECT: Users can only view categories from their assigned company
  - INSERT: Users can only create categories for their assigned company
  - UPDATE: Users can only update categories from their assigned company
  - DELETE: Users can only delete categories from their assigned company
  
  ### 6. Vehicles Table
  - SELECT: Users can only view vehicles from their assigned company
  - INSERT: Users can only create vehicles for their assigned company
  - UPDATE: Users can only update vehicles from their assigned company
  - DELETE: Users can only delete vehicles from their assigned company
  
  ### 7. On-Demand Assignments Table
  - SELECT: Users can only view assignments from their assigned company
  - INSERT: Users can only create assignments for their assigned company
  - UPDATE: Users can only update assignments from their assigned company
  - DELETE: Users can only delete assignments from their assigned company
  
  ### 8. On-Demand Assignment Items Table
  - SELECT: Users can only view assignment items from their assigned company
  - INSERT: Users can only create assignment items for their assigned company
  - UPDATE: Users can only update assignment items from their assigned company
  - DELETE: Users can only delete assignment items from their assigned company
  
  ### 9. On-Demand Orders Table
  - SELECT: Users can only view on-demand orders from their assigned company
  - INSERT: Users can only create on-demand orders for their assigned company
  - UPDATE: Users can only update on-demand orders from their assigned company
  - DELETE: Users can only delete on-demand orders from their assigned company
  
  ### 10. Contact Persons Table
  - Inherits company isolation through customer_id foreign key relationship
  
  ## Security Model
  - All policies check that the user's company_id matches the record's company_id
  - Uses auth.uid() to get the current user's ID
  - Joins with users table to retrieve the authenticated user's company_id
  - Policies are RESTRICTIVE by default - no access without explicit permission
  - Super Admins still need to authenticate with company-specific accounts
  
  ## Important Notes
  - These policies enforce strict data isolation at the database level
  - Application-level checks should be implemented as a secondary validation layer
  - All queries must include company_id to benefit from efficient index usage
  - Users without a company_id assignment will have NO access to company data
*/

-- Drop existing policies if they exist to avoid conflicts
DO $$ 
BEGIN
  -- Products policies
  DROP POLICY IF EXISTS "Users can view products from their company" ON products;
  DROP POLICY IF EXISTS "Users can insert products for their company" ON products;
  DROP POLICY IF EXISTS "Users can update products from their company" ON products;
  DROP POLICY IF EXISTS "Users can delete products from their company" ON products;
  
  -- Customers policies
  DROP POLICY IF EXISTS "Users can view customers from their company" ON customers;
  DROP POLICY IF EXISTS "Users can insert customers for their company" ON customers;
  DROP POLICY IF EXISTS "Users can update customers from their company" ON customers;
  DROP POLICY IF EXISTS "Users can delete customers from their company" ON customers;
  
  -- Orders policies
  DROP POLICY IF EXISTS "Users can view orders from their company" ON orders;
  DROP POLICY IF EXISTS "Users can insert orders for their company" ON orders;
  DROP POLICY IF EXISTS "Users can update orders from their company" ON orders;
  DROP POLICY IF EXISTS "Users can delete orders from their company" ON orders;
  
  -- Order items policies
  DROP POLICY IF EXISTS "Users can view order items from their company" ON order_items;
  DROP POLICY IF EXISTS "Users can insert order items for their company" ON order_items;
  DROP POLICY IF EXISTS "Users can update order items from their company" ON order_items;
  DROP POLICY IF EXISTS "Users can delete order items from their company" ON order_items;
  
  -- Categories policies
  DROP POLICY IF EXISTS "Users can view categories from their company" ON categories;
  DROP POLICY IF EXISTS "Users can insert categories for their company" ON categories;
  DROP POLICY IF EXISTS "Users can update categories from their company" ON categories;
  DROP POLICY IF EXISTS "Users can delete categories from their company" ON categories;
  
  -- Vehicles policies
  DROP POLICY IF EXISTS "Users can view vehicles from their company" ON vehicles;
  DROP POLICY IF EXISTS "Users can insert vehicles for their company" ON vehicles;
  DROP POLICY IF EXISTS "Users can update vehicles from their company" ON vehicles;
  DROP POLICY IF EXISTS "Users can delete vehicles from their company" ON vehicles;
  
  -- On-demand assignments policies
  DROP POLICY IF EXISTS "Users can view assignments from their company" ON on_demand_assignments;
  DROP POLICY IF EXISTS "Users can insert assignments for their company" ON on_demand_assignments;
  DROP POLICY IF EXISTS "Users can update assignments from their company" ON on_demand_assignments;
  DROP POLICY IF EXISTS "Users can delete assignments from their company" ON on_demand_assignments;
  
  -- On-demand assignment items policies
  DROP POLICY IF EXISTS "Users can view assignment items from their company" ON on_demand_assignment_items;
  DROP POLICY IF EXISTS "Users can insert assignment items for their company" ON on_demand_assignment_items;
  DROP POLICY IF EXISTS "Users can update assignment items from their company" ON on_demand_assignment_items;
  DROP POLICY IF EXISTS "Users can delete assignment items from their company" ON on_demand_assignment_items;
  
  -- On-demand orders policies
  DROP POLICY IF EXISTS "Users can view on-demand orders from their company" ON on_demand_orders;
  DROP POLICY IF EXISTS "Users can insert on-demand orders for their company" ON on_demand_orders;
  DROP POLICY IF EXISTS "Users can update on-demand orders from their company" ON on_demand_orders;
  DROP POLICY IF EXISTS "Users can delete on-demand orders from their company" ON on_demand_orders;
  
  -- Contact persons policies
  DROP POLICY IF EXISTS "Users can view contact persons from their company" ON contact_persons;
  DROP POLICY IF EXISTS "Users can insert contact persons for their company" ON contact_persons;
  DROP POLICY IF EXISTS "Users can update contact persons from their company" ON contact_persons;
  DROP POLICY IF EXISTS "Users can delete contact persons from their company" ON contact_persons;
END $$;

-- =====================================================
-- PRODUCTS TABLE RLS POLICIES
-- =====================================================

CREATE POLICY "Users can view products from their company"
  ON products
  FOR SELECT
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert products for their company"
  ON products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update products from their company"
  ON products
  FOR UPDATE
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete products from their company"
  ON products
  FOR DELETE
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- =====================================================
-- CUSTOMERS TABLE RLS POLICIES
-- =====================================================

CREATE POLICY "Users can view customers from their company"
  ON customers
  FOR SELECT
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert customers for their company"
  ON customers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update customers from their company"
  ON customers
  FOR UPDATE
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete customers from their company"
  ON customers
  FOR DELETE
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- =====================================================
-- ORDERS TABLE RLS POLICIES
-- =====================================================

CREATE POLICY "Users can view orders from their company"
  ON orders
  FOR SELECT
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert orders for their company"
  ON orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update orders from their company"
  ON orders
  FOR UPDATE
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete orders from their company"
  ON orders
  FOR DELETE
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- =====================================================
-- ORDER ITEMS TABLE RLS POLICIES
-- =====================================================

CREATE POLICY "Users can view order items from their company"
  ON order_items
  FOR SELECT
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert order items for their company"
  ON order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update order items from their company"
  ON order_items
  FOR UPDATE
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete order items from their company"
  ON order_items
  FOR DELETE
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- =====================================================
-- CATEGORIES TABLE RLS POLICIES
-- =====================================================

CREATE POLICY "Users can view categories from their company"
  ON categories
  FOR SELECT
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert categories for their company"
  ON categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update categories from their company"
  ON categories
  FOR UPDATE
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete categories from their company"
  ON categories
  FOR DELETE
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- =====================================================
-- VEHICLES TABLE RLS POLICIES
-- =====================================================

CREATE POLICY "Users can view vehicles from their company"
  ON vehicles
  FOR SELECT
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert vehicles for their company"
  ON vehicles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update vehicles from their company"
  ON vehicles
  FOR UPDATE
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete vehicles from their company"
  ON vehicles
  FOR DELETE
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- =====================================================
-- ON-DEMAND ASSIGNMENTS TABLE RLS POLICIES
-- =====================================================

CREATE POLICY "Users can view assignments from their company"
  ON on_demand_assignments
  FOR SELECT
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert assignments for their company"
  ON on_demand_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update assignments from their company"
  ON on_demand_assignments
  FOR UPDATE
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete assignments from their company"
  ON on_demand_assignments
  FOR DELETE
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- =====================================================
-- ON-DEMAND ASSIGNMENT ITEMS TABLE RLS POLICIES
-- =====================================================

CREATE POLICY "Users can view assignment items from their company"
  ON on_demand_assignment_items
  FOR SELECT
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert assignment items for their company"
  ON on_demand_assignment_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update assignment items from their company"
  ON on_demand_assignment_items
  FOR UPDATE
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete assignment items from their company"
  ON on_demand_assignment_items
  FOR DELETE
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- =====================================================
-- ON-DEMAND ORDERS TABLE RLS POLICIES
-- =====================================================

CREATE POLICY "Users can view on-demand orders from their company"
  ON on_demand_orders
  FOR SELECT
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert on-demand orders for their company"
  ON on_demand_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update on-demand orders from their company"
  ON on_demand_orders
  FOR UPDATE
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete on-demand orders from their company"
  ON on_demand_orders
  FOR DELETE
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- =====================================================
-- CONTACT PERSONS TABLE RLS POLICIES
-- =====================================================
-- Contact persons inherit company isolation through customer relationship

CREATE POLICY "Users can view contact persons from their company"
  ON contact_persons
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = contact_persons.customer_id
      AND customers.company_id = (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert contact persons for their company"
  ON contact_persons
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = contact_persons.customer_id
      AND customers.company_id = (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update contact persons from their company"
  ON contact_persons
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = contact_persons.customer_id
      AND customers.company_id = (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = contact_persons.customer_id
      AND customers.company_id = (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete contact persons from their company"
  ON contact_persons
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = contact_persons.customer_id
      AND customers.company_id = (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- =====================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =====================================================
-- These indexes optimize the company_id lookups in RLS policies

CREATE INDEX IF NOT EXISTS idx_products_company_id ON products(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_orders_company_id ON orders(company_id);
CREATE INDEX IF NOT EXISTS idx_order_items_company_id ON order_items(company_id);
CREATE INDEX IF NOT EXISTS idx_categories_company_id ON categories(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_company_id ON vehicles(company_id);
CREATE INDEX IF NOT EXISTS idx_on_demand_assignments_company_id ON on_demand_assignments(company_id);
CREATE INDEX IF NOT EXISTS idx_on_demand_assignment_items_company_id ON on_demand_assignment_items(company_id);
CREATE INDEX IF NOT EXISTS idx_on_demand_orders_company_id ON on_demand_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_contact_persons_customer_id ON contact_persons(customer_id);