/*
  # Fix Customer Type Constraint

  1. Schema Updates
    - Drop existing customers_type_check constraint
    - Add new constraint allowing Cash, Credit, Cheque, Bank Transfer

  2. Changes
    - Update customers table constraint to support all required customer types
    - Ensure backward compatibility with existing data

  3. Security
    - No RLS changes needed
*/

-- Drop the existing constraint if it exists
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_type_check;

-- Add the new constraint with all required customer types
ALTER TABLE customers ADD CONSTRAINT customers_type_check 
  CHECK (type IN ('Cash', 'Credit', 'Cheque', 'Bank Transfer'));