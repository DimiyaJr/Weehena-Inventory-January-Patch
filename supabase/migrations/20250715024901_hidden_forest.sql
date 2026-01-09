/*
  # Fix generate_product_id function ambiguous column reference

  1. Function Updates
    - Drop and recreate the generate_product_id function
    - Fix ambiguous column reference by properly qualifying table columns
    - Ensure proper error handling and return type

  2. Changes Made
    - Qualify all column references with table names (e.g., products.product_id)
    - Use proper variable naming to avoid conflicts
    - Maintain the same function signature and behavior
*/

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS generate_product_id(uuid);

-- Recreate the function with proper column qualification
CREATE OR REPLACE FUNCTION generate_product_id(input_category_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    cat_code text;
    next_num integer;
    current_year text;
    new_product_id text;
BEGIN
    -- Get category code
    SELECT categories.category_code INTO cat_code
    FROM categories 
    WHERE categories.category_id = input_category_id;
    
    -- If category not found, raise exception
    IF cat_code IS NULL THEN
        RAISE EXCEPTION 'Category not found for ID: %', input_category_id;
    END IF;
    
    -- Get current year
    current_year := EXTRACT(YEAR FROM NOW())::text;
    
    -- Get next sequence number for this category and year
    SELECT COALESCE(MAX(
        CASE 
            WHEN products.product_id ~ ('^' || cat_code || '-[0-9]{5}-' || current_year || '$')
            THEN CAST(SUBSTRING(products.product_id FROM LENGTH(cat_code) + 2 FOR 5) AS integer)
            ELSE 0
        END
    ), 0) + 1 INTO next_num
    FROM products 
    WHERE products.product_id IS NOT NULL;
    
    -- Generate the new product ID
    new_product_id := cat_code || '-' || LPAD(next_num::text, 5, '0') || '-' || current_year;
    
    RETURN new_product_id;
END;
$$;