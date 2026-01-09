/*
  # Create Ad-hoc Sales Orders Tables

  1. New Tables
    - `adhoc_assignments`
      - `id` (uuid, primary key)
      - `sales_rep_id` (uuid, foreign key to users)
      - `assigned_by` (uuid, foreign key to users)
      - `assignment_date` (date)
      - `notes` (text, optional)
      - `status` (text: 'active', 'completed', 'cancelled')
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `adhoc_assignment_items`
      - `id` (uuid, primary key)
      - `assignment_id` (uuid, foreign key to adhoc_assignments)
      - `product_id` (uuid, foreign key to products)
      - `assigned_quantity` (numeric)
      - `sold_quantity` (numeric, default 0)
      - `returned_quantity` (numeric, default 0)
      - `created_at` (timestamp)
    
    - `adhoc_orders`
      - `id` (uuid, primary key)
      - `assignment_item_id` (uuid, foreign key to adhoc_assignment_items)
      - `sales_rep_id` (uuid, foreign key to users)
      - `customer_name` (text)
      - `customer_phone` (text, optional)
      - `customer_type` (text: 'existing', 'walk-in')
      - `existing_customer_id` (uuid, optional foreign key to customers)
      - `quantity_sold` (numeric)
      - `selling_price` (numeric)
      - `total_amount` (numeric)
      - `sale_date` (timestamp)
      - `notes` (text, optional)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for role-based access
    - Admins can manage assignments
    - Sales reps can view their assignments and create orders
*/

-- Create adhoc_assignments table
CREATE TABLE IF NOT EXISTS adhoc_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_rep_id uuid NOT NULL REFERENCES users(id),
  assigned_by uuid NOT NULL REFERENCES users(id),
  assignment_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create adhoc_assignment_items table
CREATE TABLE IF NOT EXISTS adhoc_assignment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES adhoc_assignments(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  assigned_quantity numeric(10,2) NOT NULL CHECK (assigned_quantity > 0),
  sold_quantity numeric(10,2) NOT NULL DEFAULT 0 CHECK (sold_quantity >= 0),
  returned_quantity numeric(10,2) NOT NULL DEFAULT 0 CHECK (returned_quantity >= 0),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_quantities CHECK (sold_quantity + returned_quantity <= assigned_quantity)
);

-- Create adhoc_orders table
CREATE TABLE IF NOT EXISTS adhoc_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_item_id uuid NOT NULL REFERENCES adhoc_assignment_items(id),
  sales_rep_id uuid NOT NULL REFERENCES users(id),
  customer_name text NOT NULL,
  customer_phone text,
  customer_type text NOT NULL CHECK (customer_type IN ('existing', 'walk-in')),
  existing_customer_id uuid REFERENCES customers(id),
  quantity_sold numeric(10,2) NOT NULL CHECK (quantity_sold > 0),
  selling_price numeric(10,2) NOT NULL CHECK (selling_price > 0),
  total_amount numeric(10,2) NOT NULL CHECK (total_amount > 0),
  sale_date timestamptz NOT NULL DEFAULT now(),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE adhoc_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE adhoc_assignment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE adhoc_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for adhoc_assignments
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

CREATE POLICY "Sales reps can view their assignments"
  ON adhoc_assignments
  FOR SELECT
  TO authenticated
  USING (
    sales_rep_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('Super Admin', 'Admin')
    )
  );

-- RLS Policies for adhoc_assignment_items
CREATE POLICY "Users can view assignment items"
  ON adhoc_assignment_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM adhoc_assignments 
      WHERE adhoc_assignments.id = assignment_id 
      AND (
        adhoc_assignments.sales_rep_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM users 
          WHERE users.id = auth.uid() 
          AND users.role IN ('Super Admin', 'Admin')
        )
      )
    )
  );

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

CREATE POLICY "Sales reps can update their assignment items"
  ON adhoc_assignment_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM adhoc_assignments 
      WHERE adhoc_assignments.id = assignment_id 
      AND adhoc_assignments.sales_rep_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM adhoc_assignments 
      WHERE adhoc_assignments.id = assignment_id 
      AND adhoc_assignments.sales_rep_id = auth.uid()
    )
  );

-- RLS Policies for adhoc_orders
CREATE POLICY "Users can view relevant orders"
  ON adhoc_orders
  FOR SELECT
  TO authenticated
  USING (
    sales_rep_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('Super Admin', 'Admin')
    )
  );

CREATE POLICY "Sales reps can create their orders"
  ON adhoc_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sales_rep_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'Sales Rep'
    )
  );

CREATE POLICY "Admins can manage all orders"
  ON adhoc_orders
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_adhoc_assignments_sales_rep ON adhoc_assignments(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_adhoc_assignments_date ON adhoc_assignments(assignment_date);
CREATE INDEX IF NOT EXISTS idx_adhoc_assignment_items_assignment ON adhoc_assignment_items(assignment_id);
CREATE INDEX IF NOT EXISTS idx_adhoc_assignment_items_product ON adhoc_assignment_items(product_id);
CREATE INDEX IF NOT EXISTS idx_adhoc_orders_assignment_item ON adhoc_orders(assignment_item_id);
CREATE INDEX IF NOT EXISTS idx_adhoc_orders_sales_rep ON adhoc_orders(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_adhoc_orders_date ON adhoc_orders(sale_date);

-- Create trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_adhoc_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_adhoc_assignments_updated_at
  BEFORE UPDATE ON adhoc_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_adhoc_assignments_updated_at();