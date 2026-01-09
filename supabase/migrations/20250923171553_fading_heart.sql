/*
  # Add Sequential Display IDs with Prefixes

  1. New Sequences
    - `products_seq` for PRO0001 format
    - `categories_seq` for CAT0001 format  
    - `customers_seq` for CUS0001 format
    - `orders_seq` for SAL0001 format
    - `on_demand_orders_seq` for OND0001 format

  2. New Functions
    - `generate_product_id_func()` for products
    - `generate_category_display_id()` for categories
    - `generate_customer_display_id()` for customers
    - `generate_order_display_id()` for orders
    - `generate_on_demand_order_display_id()` for on-demand orders

  3. Schema Changes
    - Update `products.product_id` to use new format with NOT NULL constraint
    - Add `category_display_id` to categories table
    - Add `customer_display_id` to customers table
    - Add `order_display_id` to orders table
    - Add `on_demand_order_display_id` to on_demand_orders table

  4. Data Migration
    - Backfill existing records with generated IDs
    - Set appropriate constraints and defaults
*/

-- Create sequences for new display IDs
CREATE SEQUENCE IF NOT EXISTS products_seq;
CREATE SEQUENCE IF NOT EXISTS categories_seq;
CREATE SEQUENCE IF NOT EXISTS customers_seq;
CREATE SEQUENCE IF NOT EXISTS orders_seq;
CREATE SEQUENCE IF NOT EXISTS on_demand_orders_seq;

-- Drop existing generate_product_id function if it exists and has the old signature
DROP FUNCTION IF EXISTS generate_product_id(text);

-- Create new ID generation functions
CREATE OR REPLACE FUNCTION generate_product_id_func()
RETURNS TEXT AS $$
DECLARE
    next_id INT;
    prefix TEXT := 'PRO';
BEGIN
    SELECT nextval('products_seq') INTO next_id;
    RETURN prefix || LPAD(next_id::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_category_display_id()
RETURNS TEXT AS $$
DECLARE
    next_id INT;
    prefix TEXT := 'CAT';
BEGIN
    SELECT nextval('categories_seq') INTO next_id;
    RETURN prefix || LPAD(next_id::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_customer_display_id()
RETURNS TEXT AS $$
DECLARE
    next_id INT;
    prefix TEXT := 'CUS';
BEGIN
    SELECT nextval('customers_seq') INTO next_id;
    RETURN prefix || LPAD(next_id::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_order_display_id()
RETURNS TEXT AS $$
DECLARE
    next_id INT;
    prefix TEXT := 'SAL';
BEGIN
    SELECT nextval('orders_seq') INTO next_id;
    RETURN prefix || LPAD(next_id::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_on_demand_order_display_id()
RETURNS TEXT AS $$
DECLARE
    next_id INT;
    prefix TEXT := 'OND';
BEGIN
    SELECT nextval('on_demand_orders_seq') INTO next_id;
    RETURN prefix || LPAD(next_id::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Update products table: modify existing product_id column
-- First, update any existing NULL product_id values to avoid NOT NULL constraint violation
UPDATE products SET product_id = generate_product_id_func() WHERE product_id IS NULL;

-- Update existing non-null product_id values to new format
UPDATE products SET product_id = generate_product_id_func() WHERE product_id IS NOT NULL;

-- Set constraints and default for products.product_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'products' AND constraint_name = 'products_product_id_unique'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_product_id_unique UNIQUE (product_id);
  END IF;
END $$;

ALTER TABLE products 
ALTER COLUMN product_id SET NOT NULL,
ALTER COLUMN product_id SET DEFAULT generate_product_id_func();

-- Add category_display_id to categories table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'categories' AND column_name = 'category_display_id'
  ) THEN
    ALTER TABLE categories ADD COLUMN category_display_id TEXT;
  END IF;
END $$;

-- Update existing rows with generated IDs before setting NOT NULL
UPDATE categories SET category_display_id = generate_category_display_id() WHERE category_display_id IS NULL;

-- Set constraints and default for categories.category_display_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'categories' AND constraint_name = 'categories_category_display_id_unique'
  ) THEN
    ALTER TABLE categories ADD CONSTRAINT categories_category_display_id_unique UNIQUE (category_display_id);
  END IF;
END $$;

ALTER TABLE categories 
ALTER COLUMN category_display_id SET NOT NULL,
ALTER COLUMN category_display_id SET DEFAULT generate_category_display_id();

-- Add customer_display_id to customers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'customer_display_id'
  ) THEN
    ALTER TABLE customers ADD COLUMN customer_display_id TEXT;
  END IF;
END $$;

-- Update existing rows with generated IDs before setting NOT NULL
UPDATE customers SET customer_display_id = generate_customer_display_id() WHERE customer_display_id IS NULL;

-- Set constraints and default for customers.customer_display_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'customers' AND constraint_name = 'customers_customer_display_id_unique'
  ) THEN
    ALTER TABLE customers ADD CONSTRAINT customers_customer_display_id_unique UNIQUE (customer_display_id);
  END IF;
END $$;

ALTER TABLE customers 
ALTER COLUMN customer_display_id SET NOT NULL,
ALTER COLUMN customer_display_id SET DEFAULT generate_customer_display_id();

-- Add order_display_id to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'order_display_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN order_display_id TEXT;
  END IF;
END $$;

-- Update existing rows with generated IDs before setting NOT NULL
UPDATE orders SET order_display_id = generate_order_display_id() WHERE order_display_id IS NULL;

-- Set constraints and default for orders.order_display_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'orders' AND constraint_name = 'orders_order_display_id_unique'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_order_display_id_unique UNIQUE (order_display_id);
  END IF;
END $$;

ALTER TABLE orders 
ALTER COLUMN order_display_id SET NOT NULL,
ALTER COLUMN order_display_id SET DEFAULT generate_order_display_id();

-- Add on_demand_order_display_id to on_demand_orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'on_demand_orders' AND column_name = 'on_demand_order_display_id'
  ) THEN
    ALTER TABLE on_demand_orders ADD COLUMN on_demand_order_display_id TEXT;
  END IF;
END $$;

-- Update existing rows with generated IDs before setting NOT NULL
UPDATE on_demand_orders SET on_demand_order_display_id = generate_on_demand_order_display_id() WHERE on_demand_order_display_id IS NULL;

-- Set constraints and default for on_demand_orders.on_demand_order_display_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'on_demand_orders' AND constraint_name = 'on_demand_orders_on_demand_order_display_id_unique'
  ) THEN
    ALTER TABLE on_demand_orders ADD CONSTRAINT on_demand_orders_on_demand_order_display_id_unique UNIQUE (on_demand_order_display_id);
  END IF;
END $$;

ALTER TABLE on_demand_orders 
ALTER COLUMN on_demand_order_display_id SET NOT NULL,
ALTER COLUMN on_demand_order_display_id SET DEFAULT generate_on_demand_order_display_id();