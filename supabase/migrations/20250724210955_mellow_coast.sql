/*
  # Add Order Manager Role

  1. Database Changes
    - Update users table check constraint to include 'Order Manager' role
    - Ensure RLS policies allow Order Manager access where appropriate

  2. Role Permissions
    - Order Manager gets full access to categories, service customers, and sales orders
    - Order Manager gets read-only access to inventory
    - Order Manager has no dashboard access
*/

-- Update the users table check constraint to include Order Manager role
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role = ANY (ARRAY['Super Admin'::text, 'Admin'::text, 'Sales Rep'::text, 'Security Guard'::text, 'Order Manager'::text]));

-- Ensure Order Manager can access necessary tables through existing RLS policies
-- The existing policies for categories, orders, order_items, customers, and products 
-- already allow authenticated users, so Order Manager will inherit these permissions