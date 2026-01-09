/*
  # Create Categories Table and Product Relationships

  1. New Tables
    - `categories`
      - `category_id` (uuid, primary key)
      - `category_name` (text, unique, 3-50 characters)
      - `category_code` (text, unique, 2-3 uppercase letters)
      - `description` (text, max 200 characters)
      - `status` (boolean, default true)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Table Updates
    - Add `category_id` foreign key to `products` table

  3. Security
    - Enable RLS on `categories` table
    - Add policies for authenticated and anonymous users

  4. Data
    - Insert default categories for immediate use
*/

-- Create categories table if it doesn't exist
CREATE TABLE IF NOT EXISTS categories (
  category_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name text NOT NULL,
  category_code text NOT NULL,
  description text DEFAULT '',
  status boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add constraints using DO blocks to check existence
DO $$
BEGIN
  -- Add unique constraint for category_name if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'categories_category_name_key' 
    AND table_name = 'categories'
  ) THEN
    ALTER TABLE categories ADD CONSTRAINT categories_category_name_key UNIQUE (category_name);
  END IF;

  -- Add unique constraint for category_code if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'categories_category_code_key' 
    AND table_name = 'categories'
  ) THEN
    ALTER TABLE categories ADD CONSTRAINT categories_category_code_key UNIQUE (category_code);
  END IF;

  -- Add check constraint for category name length
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'categories_name_length' 
    AND table_name = 'categories'
  ) THEN
    ALTER TABLE categories ADD CONSTRAINT categories_name_length 
    CHECK (char_length(category_name) >= 3 AND char_length(category_name) <= 50);
  END IF;

  -- Add check constraint for category code format
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'categories_code_format' 
    AND table_name = 'categories'
  ) THEN
    ALTER TABLE categories ADD CONSTRAINT categories_code_format 
    CHECK (category_code ~ '^[A-Z]{2,3}$');
  END IF;

  -- Add check constraint for description length
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'categories_description_length' 
    AND table_name = 'categories'
  ) THEN
    ALTER TABLE categories ADD CONSTRAINT categories_description_length 
    CHECK (char_length(description) <= 200);
  END IF;
END $$;

-- Add category_id column to products table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE products ADD COLUMN category_id uuid;
  END IF;
END $$;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'products_category_id_fkey' 
    AND table_name = 'products'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_category_id_fkey 
    FOREIGN KEY (category_id) REFERENCES categories(category_id);
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories (category_name);
CREATE INDEX IF NOT EXISTS idx_categories_code ON categories (category_code);
CREATE INDEX IF NOT EXISTS idx_categories_status ON categories (status);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products (category_id);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Categories can be viewed by users" ON categories;
CREATE POLICY "Categories can be viewed by users"
  ON categories
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Categories can be inserted by users" ON categories;
CREATE POLICY "Categories can be inserted by users"
  ON categories
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Categories can be updated by users" ON categories;
CREATE POLICY "Categories can be updated by users"
  ON categories
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Categories can be deleted by users" ON categories;
CREATE POLICY "Categories can be deleted by users"
  ON categories
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- Create product ID generation function
CREATE OR REPLACE FUNCTION generate_product_id(category_code_param text)
RETURNS text AS $$
DECLARE
  next_number integer;
  current_year text;
  product_id text;
BEGIN
  -- Get current year
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::text;
  
  -- Get next sequence number for this category and year
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(
        product_id FROM POSITION('-' IN product_id) + 1 
        FOR POSITION('-' IN SUBSTRING(product_id FROM POSITION('-' IN product_id) + 1)) - 1
      ) AS integer
    )
  ), 0) + 1
  INTO next_number
  FROM products 
  WHERE product_id LIKE category_code_param || '-%' || current_year;
  
  -- Format the product ID
  product_id := category_code_param || '-' || LPAD(next_number::text, 5, '0') || '-' || current_year;
  
  RETURN product_id;
END;
$$ LANGUAGE plpgsql;

-- Insert default categories if they don't exist
INSERT INTO categories (category_name, category_code, description, status)
SELECT * FROM (VALUES
  ('Electronics', 'ELC', 'Electronic equipment and devices', true),
  ('Feed', 'FED', 'Animal feed and nutrition products', true),
  ('Equipment', 'EQP', 'Farm equipment and machinery', true),
  ('Medicine', 'MED', 'Veterinary medicines and treatments', true),
  ('General', 'GEN', 'General farm supplies and miscellaneous items', true)
) AS v(category_name, category_code, description, status)
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE categories.category_code = v.category_code
);