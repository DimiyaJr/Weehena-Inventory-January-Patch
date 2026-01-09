/*
  # Add Order Tracking Columns

  1. New Columns
    - `assigned_to` (uuid, nullable) - References users table for order assignment
    - `completed_by` (uuid, nullable) - References users table for completion tracking  
    - `security_check_status` (text) - Tracks security verification status
    - `security_check_notes` (text, nullable) - Notes for security checks

  2. Foreign Keys
    - Add foreign key constraint for assigned_to -> users(id)
    - Add foreign key constraint for completed_by -> users(id)

  3. Security
    - No RLS changes needed as orders table already has RLS enabled
*/

-- Add assigned_to column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'assigned_to'
  ) THEN
    ALTER TABLE orders ADD COLUMN assigned_to uuid;
  END IF;
END $$;

-- Add completed_by column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'completed_by'
  ) THEN
    ALTER TABLE orders ADD COLUMN completed_by uuid;
  END IF;
END $$;

-- Add security_check_status column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'security_check_status'
  ) THEN
    ALTER TABLE orders ADD COLUMN security_check_status text DEFAULT 'pending';
  END IF;
END $$;

-- Add security_check_notes column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'security_check_notes'
  ) THEN
    ALTER TABLE orders ADD COLUMN security_check_notes text;
  END IF;
END $$;

-- Add foreign key constraint for assigned_to if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'orders_assigned_to_fkey'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_assigned_to_fkey 
    FOREIGN KEY (assigned_to) REFERENCES users(id);
  END IF;
END $$;

-- Add foreign key constraint for completed_by if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'orders_completed_by_fkey'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_completed_by_fkey 
    FOREIGN KEY (completed_by) REFERENCES users(id);
  END IF;
END $$;

-- Add check constraint for security_check_status if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'orders_security_check_status_check'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_security_check_status_check
    CHECK (security_check_status = ANY (ARRAY['pending'::text, 'completed'::text, 'incomplete'::text]));
  END IF;
END $$;