/*
  # Add Chicken Product Categories

  1. New Categories
    - `Whole Chicken` - Complete whole chicken products
    - `Specialized Chicken Products` - Premium and specialized chicken items
    - `Chicken Portions` - Individual chicken parts and cuts
    - `Miscellaneous Cuts` - Specialty cuts and by-products
    - `Industrial Products` - Processed and industrial chicken products

  2. Security
    - Uses existing RLS policies for categories table
*/

-- Insert new chicken product categories
INSERT INTO categories (category_name, category_code, description, status) VALUES
  ('Whole Chicken', 'WC', 'Complete whole chicken products', true),
  ('Specialized Chicken Products', 'SCP', 'Premium and specialized chicken items', true),
  ('Chicken Portions', 'CP', 'Individual chicken parts and cuts', true),
  ('Miscellaneous Cuts', 'MC', 'Specialty cuts and by-products', true),
  ('Industrial Products', 'IP', 'Processed and industrial chicken products', true)
ON CONFLICT (category_name) DO NOTHING;