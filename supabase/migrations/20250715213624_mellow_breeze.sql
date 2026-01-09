/*
  # Fix ambiguous product_id column reference in generate_product_id function

  1. Problem
    - The generate_product_id function has ambiguous column reference
    - PostgreSQL cannot distinguish between local variable and table column
    - Error: "column reference 'product_id' is ambiguous"

  2. Solution
    - Force drop existing function with CASCADE
    - Recreate with explicit table qualification (products.product_id)
    - Use distinct variable name (product_id_result) to avoid conflicts
    - Maintain exact same function logic and behavior

  3. Changes
    - DROP FUNCTION with CASCADE to ensure clean removal
    - Explicit table qualification: products.product_id
    - Distinct variable naming: product_id_result
    - Same category_code_param input parameter
    - Same return format: [CATEGORY_CODE]-[00001]-[YYYY]
*/

-- Force drop the existing function with CASCADE to remove any dependencies
DROP FUNCTION IF EXISTS generate_product_id(text) CASCADE;

-- Recreate the function with proper column qualification and distinct variable names
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
  -- CRITICAL: Explicitly qualify the product_id column with table name to avoid ambiguity
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
  
  -- Format the product ID using the distinct variable name
  product_id_result := category_code_param || '-' || LPAD(next_number::text, 5, '0') || '-' || current_year;
  
  RETURN product_id_result;
END;
$$ LANGUAGE plpgsql;