/*
  # Add assignment type tracking to on_demand_assignments

  1. Schema Changes
    - Add `assignment_type` column to `on_demand_assignments` table
      - Values: 'admin_assigned' (default) or 'sales_rep_requested'
      - Tracks whether products were assigned by admin or requested by sales rep
    
  2. Data Migration
    - Set default value 'admin_assigned' for all existing records
    
  3. Security
    - No changes to existing RLS policies
    - Assignment type accessible based on existing assignment access rules
    
  4. Notes
    - This enables tracking the source of product assignments
    - Sales reps can now request products themselves via the Product Request feature
    - Admins can filter and view assignments by type in the assignment management interface
*/

-- Add assignment_type column to on_demand_assignments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'on_demand_assignments' AND column_name = 'assignment_type'
  ) THEN
    ALTER TABLE on_demand_assignments 
    ADD COLUMN assignment_type text DEFAULT 'admin_assigned' CHECK (assignment_type IN ('admin_assigned', 'sales_rep_requested'));
  END IF;
END $$;

-- Update existing records to have the default value
UPDATE on_demand_assignments 
SET assignment_type = 'admin_assigned' 
WHERE assignment_type IS NULL;