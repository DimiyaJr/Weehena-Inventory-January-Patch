/*
  # Email Tracking System

  1. New Tables
    - `email_logs`
      - `id` (uuid, primary key) - Unique identifier for each email log
      - `order_id` (uuid, nullable) - Reference to orders table
      - `on_demand_order_id` (uuid, nullable) - Reference to on_demand_orders table
      - `recipient_email` (text) - Email address of recipient
      - `recipient_name` (text) - Name of recipient
      - `email_type` (text) - Type of email (e.g., 'receipt', 'invoice')
      - `subject` (text) - Email subject line
      - `status` (text) - Email status ('pending', 'sent', 'failed', 'bounced')
      - `error_message` (text, nullable) - Error details if sending failed
      - `sent_at` (timestamptz, nullable) - Timestamp when email was successfully sent
      - `retry_count` (integer) - Number of retry attempts
      - `metadata` (jsonb) - Additional email metadata (payment method, receipt number, etc.)
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record last update timestamp

  2. Security
    - Enable RLS on `email_logs` table
    - Add policies for authenticated users to read their own email logs
    - Add policies for admin users to view all email logs
    - Add policies for system to insert and update email logs

  3. Indexes
    - Add index on order_id for faster lookups
    - Add index on on_demand_order_id for faster lookups
    - Add index on recipient_email for tracking
    - Add index on status for filtering
    - Add index on created_at for chronological queries
*/

-- Create email_logs table
CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  on_demand_order_id uuid REFERENCES on_demand_orders(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  recipient_name text NOT NULL,
  email_type text NOT NULL DEFAULT 'receipt',
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
  error_message text,
  sent_at timestamptz,
  retry_count integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view all email logs (for admin dashboard)
CREATE POLICY "Admin users can view all email logs"
  ON email_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('Super Admin', 'Admin', 'Finance Admin')
    )
  );

-- Policy: Sales reps can view email logs for their orders
CREATE POLICY "Sales reps can view their email logs"
  ON email_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = email_logs.order_id
      AND orders.created_by = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM on_demand_orders
      WHERE on_demand_orders.id = email_logs.on_demand_order_id
      AND on_demand_orders.sales_rep_id = auth.uid()
    )
  );

-- Policy: System can insert email logs
CREATE POLICY "System can insert email logs"
  ON email_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: System can update email logs
CREATE POLICY "System can update email logs"
  ON email_logs
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_logs_order_id ON email_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_on_demand_order_id ON email_logs(on_demand_order_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient_email ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at on every update
DROP TRIGGER IF EXISTS email_logs_updated_at_trigger ON email_logs;
CREATE TRIGGER email_logs_updated_at_trigger
  BEFORE UPDATE ON email_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_email_logs_updated_at();