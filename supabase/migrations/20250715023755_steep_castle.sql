/*
  # Add Product Categories and Update Product Schema

  1. New Tables
    - `categories`
      - `category_id` (uuid, primary key)
      - `category_name` (text, unique, 3-50 characters)
      - `category_code` (text, 2-3 uppercase letters, unique)
      - `description` (text, max 200 characters)
      - `status` (boolean, default true)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Schema Updates
    - Add `category_id` foreign key to `products` table
    - Add `product_id` field with format [CAT]-[00001]-[YYYY]
    - Create indexes for performance

  3. Security
    - Enable RLS on `categories` table
    - Add policies for authenticated and anonymous users
    - Create trigger for updated_at timestamp
*/

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  category_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name text UNIQUE NOT NULL,
  category_code text UNIQUE NOT NULL,
  description text DEFAULT '',
  status boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add constraints for categories
ALTER TABLE categories 
ADD CONSTRAINT categories_name_length CHECK (char_length(category_name) >= 3 AND char_length(category_name) <= 50);

ALTER TABLE categories 
ADD CONSTRAINT categories_code_format CHECK (category_code ~ '^[A-Z]{2,3}$');

ALTER TABLE categories 
ADD CONSTRAINT categories_description_length CHECK (char_length(description) <= 200);

-- Create indexes for categories
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(category_name);
CREATE INDEX IF NOT EXISTS idx_categories_code ON categories(category_code);
CREATE INDEX IF NOT EXISTS idx_categories_status ON categories(status);

-- Enable RLS for categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Create policies for categories
CREATE POLICY "Categories can be viewed by users"
  ON categories
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Categories can be inserted by users"
  ON categories
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Categories can be updated by users"
  ON categories
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Categories can be deleted by users"
  ON categories
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for categories
CREATE TRIGGER update_categories_updated_at 
  BEFORE UPDATE ON categories 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add category_id and product_id to products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE products ADD COLUMN category_id uuid REFERENCES categories(category_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'product_id'
  ) THEN
    ALTER TABLE products ADD COLUMN product_id text UNIQUE;
  END IF;
END $$;

-- Create index for product category relationship
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_product_id ON products(product_id);

-- Insert default categories
INSERT INTO categories (category_name, category_code, description) VALUES
  ('Electronics', 'ELC', 'Electronic products and accessories'),
  ('Feed', 'FED', 'Animal feed and nutrition products'),
  ('Equipment', 'EQP', 'Farm equipment and tools'),
  ('Medicine', 'MED', 'Veterinary medicines and supplements'),
  ('General', 'GEN', 'General products and miscellaneous items')
ON CONFLICT (category_name) DO NOTHING;

-- Create sequence for product numbering
CREATE SEQUENCE IF NOT EXISTS product_sequence START 1;

-- Function to generate product ID
CREATE OR REPLACE FUNCTION generate_product_id(category_code_param text)
RETURNS text AS $$
DECLARE
  next_number integer;
  current_year text;
  product_id_result text;
BEGIN
  -- Get next sequence number
  SELECT nextval('product_sequence') INTO next_number;
  
  -- Get current year
  SELECT EXTRACT(YEAR FROM now())::text INTO current_year;
  
  -- Format product ID
  product_id_result := category_code_param || '-' || 
                      LPAD(next_number::text, 5, '0') || '-' || 
                      current_year;
  
  RETURN product_id_result;
END;
$$ LANGUAGE plpgsql;