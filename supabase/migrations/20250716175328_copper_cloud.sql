/*
  # Create generate_product_id function

  1. Function
    - `generate_product_id(category_code_param text)` - Generates unique product IDs
    - Returns format: {CATEGORY_CODE}-{5-digit-number}-{YEAR}
    - Example: CB-00001-2025, WC-00002-2025

  2. Logic
    - Gets the current year
    - Finds the highest existing product ID for the category
    - Increments the number and formats with leading zeros
    - Returns the complete product ID string
*/

CREATE OR REPLACE FUNCTION generate_product_id(category_code_param text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    current_year text;
    next_number integer;
    formatted_number text;
    new_product_id text;
BEGIN
    -- Get current year
    current_year := EXTRACT(YEAR FROM CURRENT_DATE)::text;
    
    -- Find the highest existing number for this category and year
    SELECT COALESCE(
        MAX(
            CAST(
                SPLIT_PART(
                    SPLIT_PART(product_id, '-', 2), 
                    '-', 
                    1
                ) AS integer
            )
        ), 
        0
    ) + 1
    INTO next_number
    FROM products 
    WHERE product_id LIKE category_code_param || '-%' || current_year;
    
    -- Format number with leading zeros (5 digits)
    formatted_number := LPAD(next_number::text, 5, '0');
    
    -- Create the product ID
    new_product_id := category_code_param || '-' || formatted_number || '-' || current_year;
    
    RETURN new_product_id;
END;
$$;