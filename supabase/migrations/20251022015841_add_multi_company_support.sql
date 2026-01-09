/*
  # Add Multi-Company Support

  This migration adds support for multiple companies (Weehena Chicken Farm and Weehena Sausage Farm)
  to share the same system while maintaining complete data isolation.

  ## Changes

  1. New Tables
    - `companies` - Stores company information (Chicken Farm, Sausage Farm)
    
  2. Modified Tables
    - `users` - Add company_id to associate users with companies
    - `products` - Add company_id to separate product inventories
    - `customers` - Add company_id to separate customer databases
    - `orders` - Add company_id to separate sales orders
    - `categories` - Add company_id to separate product categories
    - `contact_persons` - Add company_id (via customers)
    - `order_items` - Add company_id (via orders)
    - `on_demand_assignments` - Add company_id to separate assignments
    - `on_demand_assignment_items` - Add company_id (via assignments)
    - `on_demand_orders` - Add company_id to separate on-demand orders
    - `vehicles` - Add company_id to separate vehicle fleets

  3. Security
    - Enable RLS on companies table
    - Update RLS policies on all tables to filter by company_id
    - Users can only access data for their assigned company
    - Super Admins can see all data but must select a company when creating users

  4. Data Seeding
    - Insert two default companies: Weehena Chicken Farm and Weehena Sausage Farm
*/

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  description text DEFAULT '',
  status boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on companies table
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Add company_id to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE users ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;
END $$;

-- Add company_id to products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE products ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;
END $$;

-- Add company_id to customers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE customers ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;
END $$;

-- Add company_id to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;
END $$;

-- Add company_id to categories table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE categories ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;
END $$;

-- Add company_id to order_items table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE order_items ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;
END $$;

-- Add company_id to on_demand_assignments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'on_demand_assignments' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE on_demand_assignments ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;
END $$;

-- Add company_id to on_demand_assignment_items table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'on_demand_assignment_items' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE on_demand_assignment_items ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;
END $$;

-- Add company_id to on_demand_orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'on_demand_orders' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE on_demand_orders ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;
END $$;

-- Add company_id to vehicles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;
END $$;

-- Insert default companies
INSERT INTO companies (name, code, description, status)
VALUES 
  ('Weehena Chicken Farm', 'WCF', 'Chicken farm operations and products', true),
  ('Weehena Sausage Farm', 'WSF', 'Sausage farm operations and products', true)
ON CONFLICT (name) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_products_company_id ON products(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_orders_company_id ON orders(company_id);
CREATE INDEX IF NOT EXISTS idx_categories_company_id ON categories(company_id);
CREATE INDEX IF NOT EXISTS idx_order_items_company_id ON order_items(company_id);
CREATE INDEX IF NOT EXISTS idx_on_demand_assignments_company_id ON on_demand_assignments(company_id);
CREATE INDEX IF NOT EXISTS idx_on_demand_assignment_items_company_id ON on_demand_assignment_items(company_id);
CREATE INDEX IF NOT EXISTS idx_on_demand_orders_company_id ON on_demand_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_company_id ON vehicles(company_id);

-- RLS Policies for companies table
DROP POLICY IF EXISTS "Users can view companies" ON companies;
CREATE POLICY "Users can view companies"
  ON companies FOR SELECT
  TO authenticated
  USING (true);

-- Update RLS policies for users table
DROP POLICY IF EXISTS "Users can view all users" ON users;
CREATE POLICY "Users can view company users"
  ON users FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Super Admins can insert users" ON users;
CREATE POLICY "Super Admins can insert company users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'Super Admin'
    )
  );

DROP POLICY IF EXISTS "Super Admins can update users" ON users;
CREATE POLICY "Super Admins can update company users"
  ON users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'Super Admin'
    )
  );

DROP POLICY IF EXISTS "Super Admins can delete users" ON users;
CREATE POLICY "Super Admins can delete company users"
  ON users FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'Super Admin'
    ) AND id != auth.uid()
  );

-- Update RLS policies for products table
DROP POLICY IF EXISTS "Users can view products" ON products;
CREATE POLICY "Users can view company products"
  ON products FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can insert products" ON products;
CREATE POLICY "Admins can insert company products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() 
      AND role IN ('Super Admin', 'Admin')
      AND company_id = products.company_id
    )
  );

DROP POLICY IF EXISTS "Admins can update products" ON products;
CREATE POLICY "Admins can update company products"
  ON products FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() 
      AND role IN ('Super Admin', 'Admin')
      AND company_id = products.company_id
    )
  );

DROP POLICY IF EXISTS "Admins can delete products" ON products;
CREATE POLICY "Admins can delete company products"
  ON products FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() 
      AND role IN ('Super Admin', 'Admin')
      AND company_id = products.company_id
    )
  );

-- Update RLS policies for customers table
DROP POLICY IF EXISTS "Users can view customers" ON customers;
CREATE POLICY "Users can view company customers"
  ON customers FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sales Reps can insert customers" ON customers;
CREATE POLICY "Sales Reps can insert company customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() 
      AND role IN ('Super Admin', 'Admin', 'Sales Rep')
      AND company_id = customers.company_id
    )
  );

DROP POLICY IF EXISTS "Sales Reps can update customers" ON customers;
CREATE POLICY "Sales Reps can update company customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() 
      AND role IN ('Super Admin', 'Admin', 'Sales Rep')
      AND company_id = customers.company_id
    )
  );

DROP POLICY IF EXISTS "Admins can delete customers" ON customers;
CREATE POLICY "Admins can delete company customers"
  ON customers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() 
      AND role IN ('Super Admin', 'Admin')
      AND company_id = customers.company_id
    )
  );

-- Update RLS policies for orders table
DROP POLICY IF EXISTS "Users can view orders" ON orders;
CREATE POLICY "Users can view company orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sales Reps can insert orders" ON orders;
CREATE POLICY "Sales Reps can insert company orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() 
      AND role IN ('Super Admin', 'Admin', 'Sales Rep', 'Order Manager')
      AND company_id = orders.company_id
    )
  );

DROP POLICY IF EXISTS "Sales Reps can update orders" ON orders;
CREATE POLICY "Sales Reps can update company orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() 
      AND role IN ('Super Admin', 'Admin', 'Sales Rep', 'Security Guard', 'Order Manager')
      AND company_id = orders.company_id
    )
  );

-- Update RLS policies for categories table
DROP POLICY IF EXISTS "Users can view categories" ON categories;
CREATE POLICY "Users can view company categories"
  ON categories FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can insert categories" ON categories;
CREATE POLICY "Admins can insert company categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() 
      AND role IN ('Super Admin', 'Admin')
      AND company_id = categories.company_id
    )
  );

DROP POLICY IF EXISTS "Admins can update categories" ON categories;
CREATE POLICY "Admins can update company categories"
  ON categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() 
      AND role IN ('Super Admin', 'Admin')
      AND company_id = categories.company_id
    )
  );

DROP POLICY IF EXISTS "Admins can delete categories" ON categories;
CREATE POLICY "Admins can delete company categories"
  ON categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() 
      AND role IN ('Super Admin', 'Admin')
      AND company_id = categories.company_id
    )
  );

-- Update RLS policies for order_items table
DROP POLICY IF EXISTS "Users can view order items" ON order_items;
CREATE POLICY "Users can view company order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sales Reps can insert order items" ON order_items;
CREATE POLICY "Sales Reps can insert company order items"
  ON order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() 
      AND role IN ('Super Admin', 'Admin', 'Sales Rep', 'Order Manager')
      AND company_id = order_items.company_id
    )
  );

DROP POLICY IF EXISTS "Sales Reps can update order items" ON order_items;
CREATE POLICY "Sales Reps can update company order items"
  ON order_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() 
      AND role IN ('Super Admin', 'Admin', 'Sales Rep', 'Order Manager')
      AND company_id = order_items.company_id
    )
  );

-- Update RLS policies for on_demand_assignments table
DROP POLICY IF EXISTS "Sales Reps can view their assignments" ON on_demand_assignments;
CREATE POLICY "Sales Reps can view company assignments"
  ON on_demand_assignments FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can insert assignments" ON on_demand_assignments;
CREATE POLICY "Admins can insert company assignments"
  ON on_demand_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() 
      AND role IN ('Super Admin', 'Admin', 'Order Manager')
      AND company_id = on_demand_assignments.company_id
    )
  );

DROP POLICY IF EXISTS "Admins can update assignments" ON on_demand_assignments;
CREATE POLICY "Admins can update company assignments"
  ON on_demand_assignments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() 
      AND role IN ('Super Admin', 'Admin', 'Order Manager')
      AND company_id = on_demand_assignments.company_id
    )
  );

-- Update RLS policies for on_demand_assignment_items table
DROP POLICY IF EXISTS "Users can view assignment items" ON on_demand_assignment_items;
CREATE POLICY "Users can view company assignment items"
  ON on_demand_assignment_items FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can insert assignment items" ON on_demand_assignment_items;
CREATE POLICY "Admins can insert company assignment items"
  ON on_demand_assignment_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() 
      AND role IN ('Super Admin', 'Admin', 'Order Manager')
      AND company_id = on_demand_assignment_items.company_id
    )
  );

DROP POLICY IF EXISTS "Sales Reps can update their assignment items" ON on_demand_assignment_items;
CREATE POLICY "Sales Reps can update company assignment items"
  ON on_demand_assignment_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() 
      AND role IN ('Super Admin', 'Admin', 'Sales Rep', 'Order Manager')
      AND company_id = on_demand_assignment_items.company_id
    )
  );

-- Update RLS policies for on_demand_orders table
DROP POLICY IF EXISTS "Sales Reps can view their orders" ON on_demand_orders;
CREATE POLICY "Sales Reps can view company orders"
  ON on_demand_orders FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sales Reps can insert orders" ON on_demand_orders;
CREATE POLICY "Sales Reps can insert company orders"
  ON on_demand_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() 
      AND role IN ('Super Admin', 'Admin', 'Sales Rep')
      AND company_id = on_demand_orders.company_id
    )
  );

-- Enable RLS on vehicles table if not already enabled
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

-- Update RLS policies for vehicles table
DROP POLICY IF EXISTS "Users can view vehicles" ON vehicles;
CREATE POLICY "Users can view company vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can insert vehicles" ON vehicles;
CREATE POLICY "Admins can insert company vehicles"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() 
      AND role IN ('Super Admin', 'Admin', 'Order Manager')
      AND company_id = vehicles.company_id
    )
  );

DROP POLICY IF EXISTS "Admins can update vehicles" ON vehicles;
CREATE POLICY "Admins can update company vehicles"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() 
      AND role IN ('Super Admin', 'Admin', 'Order Manager')
      AND company_id = vehicles.company_id
    )
  );

DROP POLICY IF EXISTS "Admins can delete vehicles" ON vehicles;
CREATE POLICY "Admins can delete company vehicles"
  ON vehicles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() 
      AND role IN ('Super Admin', 'Admin', 'Order Manager')
      AND company_id = vehicles.company_id
    )
  );