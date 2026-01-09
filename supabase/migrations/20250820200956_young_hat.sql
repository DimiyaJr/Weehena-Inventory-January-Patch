/*
  # Enhance Customer Schema for Company Management

  1. Schema Updates
    - Add email field to customers table
    - Add company_name field (rename from name conceptually)
    - Add company_address field (rename from address conceptually)
    - Update customer type to support Cash, Credit, Cheque, Bank Transfer
    - Create contact_persons table for multiple contacts per company

  2. New Tables
    - `contact_persons` table for managing multiple contact persons per company
      - `id` (uuid, primary key)
      - `customer_id` (uuid, foreign key to customers)
      - `name` (text, contact person name)
      - `phone_number` (text, contact person phone)
      - `created_at` (timestamp)

  3. Security
    - Enable RLS on contact_persons table
    - Add policies for authenticated and anonymous users
*/

-- Add new columns to customers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'email'
  ) THEN
    ALTER TABLE customers ADD COLUMN email text;
  END IF;
END $$;

-- Update customer type constraint to include new options
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_type_check;
ALTER TABLE customers ADD CONSTRAINT customers_type_check 
  CHECK (type IN ('Cash', 'Credit', 'Cheque', 'Bank Transfer'));

-- Create contact_persons table
CREATE TABLE IF NOT EXISTS contact_persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone_number text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for contact_persons
CREATE INDEX IF NOT EXISTS idx_contact_persons_customer_id ON contact_persons(customer_id);
CREATE INDEX IF NOT EXISTS idx_contact_persons_name ON contact_persons(name);

-- Enable RLS for contact_persons
ALTER TABLE contact_persons ENABLE ROW LEVEL SECURITY;

-- Create policies for contact_persons
CREATE POLICY "Contact persons can be viewed by users"
  ON contact_persons
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Contact persons can be inserted by users"
  ON contact_persons
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Contact persons can be updated by users"
  ON contact_persons
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Contact persons can be deleted by users"
  ON contact_persons
  FOR DELETE
  TO anon, authenticated
  USING (true);