/*
  # Fix ambiguous column reference in generate_product_id function

  1. Updates
    - Drop and recreate the generate_product_id function to fix ambiguous column reference
    - Ensure all column references are properly qualified with table names
    - Use distinct variable names to avoid conflicts

  2. Changes
    - Explicitly qualify product_id column as products.product_id
    - Use product_id_result as the return variable name
    - Maintain existing function logic and behavior
*/

-- Drop the existing function completely
DROP FUNCTION IF EXISTS generate_product_id(text);

-- Recreate the function with proper column qualification
CREATE OR REPLACE FUNCTION generate_product_id(category_code_param text)
RETURNS text AS $$
DECLARE
  next_number integer;
  current_year text;
  product_id_result text;
BEGIN
  -- Get current year
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::text;
  
  -- Get next sequence number for this category and year
  -- Explicitly qualify the product_id column with the table name
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(
        products.product_id FROM POSITION('-' IN products.product_id) + 1 
        FOR POSITION('-' IN SUBSTRING(products.product_id FROM POSITION('-' IN products.product_id) + 1)) - 1
      ) AS integer
    )
  ), 0) + 1
  INTO next_number
  FROM products 
  WHERE products.product_id LIKE category_code_param || '-%' || current_year;
  
  -- Format the product ID
  product_id_result := category_code_param || '-' || LPAD(next_number::text, 5, '0') || '-' || current_year;
  
  RETURN product_id_result;
END;
$$ LANGUAGE plpgsql;