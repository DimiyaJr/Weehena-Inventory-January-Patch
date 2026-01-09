/*
  # Add Product Master Categories

  1. New Categories
    - `Breast & Thighs` - Chicken breast and thigh products
    - `Legs & Drumsticks` - Chicken legs and drumstick products  
    - `Organs & Cuts` - Chicken organs and specialty cuts
    - `Pack & Specials` - Special packaged products
    - `Wings & Tulip` - Chicken wings and tulip products

  2. Security
    - Uses existing RLS policies for categories table
*/

-- Insert new product master categories
INSERT INTO categories (category_name, category_code, description, status) VALUES
  ('Breast & Thighs', 'BT', 'Chicken breast and thigh products', true),
  ('Legs & Drumsticks', 'LD', 'Chicken legs and drumstick products', true),
  ('Organs & Cuts', 'OC', 'Chicken organs and specialty cuts', true),
  ('Pack & Specials', 'PS', 'Special packaged products', true),
  ('Wings & Tulip', 'WT', 'Chicken wings and tulip products', true)
ON CONFLICT (category_name) DO NOTHING;