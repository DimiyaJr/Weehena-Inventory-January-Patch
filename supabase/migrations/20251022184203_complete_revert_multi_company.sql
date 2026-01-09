/*
  # Complete Revert of Multi-Company Support
  
  Returns the system to single-company operation by:
  1. Dropping ALL company-related RLS policies
  2. Restoring original RLS policies
  3. Removing company_id columns
  4. Dropping companies table
*/

-- Drop ALL company-related policies from ALL tables
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE policyname LIKE '%company%' 
           OR policyname LIKE '%their company%'
           OR policyname LIKE '%from their company%'
           OR policyname LIKE '%for their company%'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
            pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- Restore original RLS policies

-- Users table
CREATE POLICY "Users can view all users" ON users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super Admins can insert users" ON users FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'Super Admin'));
CREATE POLICY "Super Admins can update users" ON users FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'Super Admin'));
CREATE POLICY "Super Admins can delete users" ON users FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'Super Admin') AND id != auth.uid());

-- Products table
CREATE POLICY "Users can view products" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert products" ON products FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Super Admin', 'Admin')));
CREATE POLICY "Admins can update products" ON products FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Super Admin', 'Admin')));
CREATE POLICY "Admins can delete products" ON products FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Super Admin', 'Admin')));

-- Customers table
CREATE POLICY "Users can view customers" ON customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Sales Reps can insert customers" ON customers FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Super Admin', 'Admin', 'Sales Rep')));
CREATE POLICY "Sales Reps can update customers" ON customers FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Super Admin', 'Admin', 'Sales Rep')));
CREATE POLICY "Admins can delete customers" ON customers FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Super Admin', 'Admin')));

-- Contact persons table
CREATE POLICY "Users can view contact persons" ON contact_persons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Sales Reps can insert contact persons" ON contact_persons FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Super Admin', 'Admin', 'Sales Rep')));
CREATE POLICY "Sales Reps can update contact persons" ON contact_persons FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Super Admin', 'Admin', 'Sales Rep')));
CREATE POLICY "Admins can delete contact persons" ON contact_persons FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Super Admin', 'Admin')));

-- Orders table
CREATE POLICY "Users can view orders" ON orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Sales Reps can insert orders" ON orders FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Super Admin', 'Admin', 'Sales Rep', 'Order Manager')));
CREATE POLICY "Sales Reps can update orders" ON orders FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Super Admin', 'Admin', 'Sales Rep', 'Security Guard', 'Order Manager')));

-- Categories table
CREATE POLICY "Users can view categories" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert categories" ON categories FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Super Admin', 'Admin')));
CREATE POLICY "Admins can update categories" ON categories FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Super Admin', 'Admin')));
CREATE POLICY "Admins can delete categories" ON categories FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Super Admin', 'Admin')));

-- Order items table
CREATE POLICY "Users can view order items" ON order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Sales Reps can insert order items" ON order_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Super Admin', 'Admin', 'Sales Rep', 'Order Manager')));
CREATE POLICY "Sales Reps can update order items" ON order_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Super Admin', 'Admin', 'Sales Rep', 'Order Manager')));

-- Vehicles table
CREATE POLICY "Users can view vehicles" ON vehicles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert vehicles" ON vehicles FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Super Admin', 'Admin', 'Order Manager')));
CREATE POLICY "Admins can update vehicles" ON vehicles FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Super Admin', 'Admin', 'Order Manager')));
CREATE POLICY "Admins can delete vehicles" ON vehicles FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Super Admin', 'Admin', 'Order Manager')));

-- On-demand assignments table
CREATE POLICY "Sales Reps can view their assignments" ON on_demand_assignments FOR SELECT TO authenticated USING (sales_rep_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Super Admin', 'Admin', 'Order Manager')));
CREATE POLICY "Admins can insert assignments" ON on_demand_assignments FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Super Admin', 'Admin', 'Order Manager')));
CREATE POLICY "Admins can update assignments" ON on_demand_assignments FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Super Admin', 'Admin', 'Order Manager')));

-- On-demand assignment items table
CREATE POLICY "Users can view assignment items" ON on_demand_assignment_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert assignment items" ON on_demand_assignment_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Super Admin', 'Admin', 'Order Manager')));
CREATE POLICY "Sales Reps can update their assignment items" ON on_demand_assignment_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM on_demand_assignments WHERE id = on_demand_assignment_items.on_demand_assignment_id AND sales_rep_id = auth.uid()) OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Super Admin', 'Admin', 'Order Manager')));

-- On-demand orders table
CREATE POLICY "Sales Reps can view their orders" ON on_demand_orders FOR SELECT TO authenticated USING (sales_rep_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Super Admin', 'Admin', 'Order Manager')));
CREATE POLICY "Sales Reps can insert orders" ON on_demand_orders FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Super Admin', 'Admin', 'Sales Rep')));

-- Drop indexes
DROP INDEX IF EXISTS idx_users_company_id;
DROP INDEX IF EXISTS idx_products_company_id;
DROP INDEX IF EXISTS idx_customers_company_id;
DROP INDEX IF EXISTS idx_orders_company_id;
DROP INDEX IF EXISTS idx_categories_company_id;
DROP INDEX IF EXISTS idx_order_items_company_id;
DROP INDEX IF EXISTS idx_on_demand_assignments_company_id;
DROP INDEX IF EXISTS idx_on_demand_assignment_items_company_id;
DROP INDEX IF EXISTS idx_on_demand_orders_company_id;
DROP INDEX IF EXISTS idx_vehicles_company_id;

-- Remove company_id columns
ALTER TABLE users DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE products DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE customers DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE orders DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE categories DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE order_items DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE on_demand_assignments DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE on_demand_assignment_items DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE on_demand_orders DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE vehicles DROP COLUMN IF EXISTS company_id CASCADE;

-- Drop companies table
DROP TABLE IF EXISTS companies CASCADE;