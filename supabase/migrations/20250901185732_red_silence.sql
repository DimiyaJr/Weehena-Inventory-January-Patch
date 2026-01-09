/*
  # Disable RLS on Ad-hoc Tables

  This migration disables Row Level Security on the ad-hoc tables to match the existing
  pattern in the application where the users table also has RLS disabled.

  1. Security Changes
    - Disable RLS on `adhoc_assignments` table
    - Disable RLS on `adhoc_assignment_items` table  
    - Disable RLS on `adhoc_orders` table
    - Drop all existing RLS policies

  The application will handle role-based access control at the application level
  through the frontend components, similar to how other tables work.
*/

-- Drop all existing policies first
DROP POLICY IF EXISTS "Admins can insert assignments" ON adhoc_assignments;
DROP POLICY IF EXISTS "Admins can view all assignments" ON adhoc_assignments;
DROP POLICY IF EXISTS "Sales Reps can view their assignments" ON adhoc_assignments;
DROP POLICY IF EXISTS "Admins can update assignments" ON adhoc_assignments;

DROP POLICY IF EXISTS "Admins can manage assignment items" ON adhoc_assignment_items;
DROP POLICY IF EXISTS "Sales Reps can view and update their assignment items" ON adhoc_assignment_items;

DROP POLICY IF EXISTS "Admins can manage all adhoc orders" ON adhoc_orders;
DROP POLICY IF EXISTS "Sales Reps can manage their own adhoc orders" ON adhoc_orders;

-- Disable RLS on all adhoc tables
ALTER TABLE adhoc_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE adhoc_assignment_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE adhoc_orders DISABLE ROW LEVEL SECURITY;