/*
  # Update Order Status Workflow

  1. Schema Changes
    - Update orders table status constraint to include new status values
    - Add "Products Loaded" status for when sales rep loads products
    - Keep existing statuses and add new workflow statuses

  2. Status Flow
    - Pending → Assigned (when assigned to sales rep)
    - Assigned → Products Loaded (when sales rep loads products)
    - Products Loaded → Security Checked (when security approves)
    - Products Loaded → Security Check Incomplete (when security finds issues)
    - Security Checked → Departed Farm (automatic transition)
    - Departed Farm → Delivered (when sales rep delivers)

  3. Security
    - Maintain existing RLS policies
    - No changes to user permissions
*/

-- Drop existing constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'orders_status_check' 
    AND table_name = 'orders'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT orders_status_check;
  END IF;
END $$;

-- Add updated constraint with new status values
ALTER TABLE orders 
ADD CONSTRAINT orders_status_check 
CHECK (status = ANY (ARRAY[
  'Pending'::text, 
  'In Progress'::text, 
  'Assigned'::text, 
  'Products Loaded'::text, 
  'Security Check Incomplete'::text, 
  'Departed Farm'::text, 
  'Delivered'::text, 
  'Cancelled'::text, 
  'Completed'::text
]));