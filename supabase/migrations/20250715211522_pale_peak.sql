/*
  # Fix ambiguous column reference in generate_product_id function

  1. Updates
    - Fix ambiguous column reference by qualifying product_id with table name
    - Ensure the function correctly references products.product_id column

  2. Changes
    - Replace ambiguous product_id references with products.product_id
    - Maintain existing function logic and behavior
*/

-- Drop and recreate the function with fixed column references
DROP FUNCTION IF EXISTS generate_product_id(text);

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