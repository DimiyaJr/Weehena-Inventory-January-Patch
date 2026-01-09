import { createClient } from '@supabase/supabase-js'

let supabase: any = null
let supabaseInitError: string | null = null

try {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    const errorMessage = 'Missing Supabase environment variables. Please check your .env file and ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set correctly.'
    console.error('Missing Supabase environment variables:', {
      url: supabaseUrl ? 'Present' : 'Missing',
      key: supabaseAnonKey ? 'Present' : 'Missing'
    })
    throw new Error(errorMessage)
  }

  // Validate URL format
  try {
    new URL(supabaseUrl)
  } catch (error) {
    const errorMessage = `Invalid Supabase URL format: ${supabaseUrl}. Please ensure VITE_SUPABASE_URL is a valid URL (e.g., https://your-project-ref.supabase.co)`
    console.error('Invalid Supabase URL:', supabaseUrl)
    throw new Error(errorMessage)
  }

  // Validate API key format (basic check)
  if (supabaseAnonKey.length < 50) {
    const errorMessage = `Invalid Supabase ANON key format. Expected 50+ characters, got ${supabaseAnonKey.length}. Please ensure your Supabase ANON key is correct.`
    console.error('Invalid Supabase API key length:', supabaseAnonKey.length)
    console.error('Expected length: 50+ characters, got:', supabaseAnonKey.length)
    console.error('Current key starts with:', supabaseAnonKey.substring(0, 20) + '...')
    throw new Error(errorMessage)
  }

  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce'
    },
    db: {
      schema: 'public'
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    },
  })
} catch (error) {
  console.error('Failed to initialize Supabase client:', error)
  supabaseInitError = error instanceof Error ? error.message : 'Unknown error occurred during Supabase initialization'
  supabase = null
}

export { supabase, supabaseInitError }

// =======================
// === Type Interfaces ===
// =======================

// src/lib/supabase.ts
export interface Product {
  id: string
  product_id?: string
  name: string
  category: string
  category_id?: string
  sku: string
  quantity: number
  price_cash: number
  price_credit: number
  price_dealer_cash: number
  price_dealer_credit: number
  price_hotel_non_vat: number
  price_hotel_vat: number
  price_farm_shop: number
  threshold: number
  created_at: string
  unit_type: 'Kg' | 'g' | 'Packs'
  weight_per_pack_kg?: number | null
  grams_per_unit?: number | null // NEW FIELD
  categories?: {
    category_id: string;
    category_name: string;
    category_display_id: string;
    category_code: string;
    description: string;
    status: boolean;
    created_at: string;
    updated_at: string;
  };
  // Added category property as requested
  category?: {
    category_id: string;
    category_name: string;
    category_code: string;
  };
}

export interface Category {
  category_id: string
  category_name: string
  category_display_id: string
  category_code: string
  description: string
  status: boolean
  created_at: string
  updated_at: string
}

export interface CustomerArea {
  id: string
  area_name: string
  area_code: string
  created_at: string
  updated_at: string
}

export interface Customer {
  id: string
  name: string
  customer_display_id: string
  address: string
  email?: string
  phone_number: string
  payment_category: string
  created_at: string
  vat_status: 'VAT' | 'Non-VAT'
  tin_number?: string | null
  customer_area_id?: string | null
  customer_areas?: CustomerArea // ADDED: Relation to CustomerArea
}

export interface ContactPerson {
  id: string
  customer_id: string
  name: string
  phone_number: string
  created_at: string
}

export interface Order {
  id: string
  customer_id: string
  order_display_id: string
  purchase_order_id?: string | null
  status:
    | 'Pending'
    | 'Assigned'
    | 'Products Loaded'
    | 'Product Reloaded'
    | 'Security Check Incomplete'
    | 'Security Checked'
    | 'Departed Farm'
    | 'Delivered'
    | 'Cancelled'
    | 'Completed'
    | 'Security Check Bypassed Due to Off Hours'
    | 'Delivered - Payment Partially Collected'
    | 'Delivered - Payment Not Collected'
  created_by: string
  created_at: string
  completed_at?: string
  assigned_to: string | null
  completed_by: string | null
  security_check_status: 'pending' | 'completed' | 'incomplete' | 'bypassed'
  security_check_notes: string | null
  vehicle_number: string | null
  payment_method?: 'Net' | 'Cash' | 'Cheque' | 'Credit Card' | 'Bank Transfer' | null
  receipt_no?: string | null
  payment_status?: 'fully_paid' | 'partially_paid' | 'unpaid'
  collected_amount?: number | null
  total_amount: number
  vat_amount: number
  is_vat_applicable: boolean
  order_items: OrderItem[];
  assigned_user?: { username: string };
  completed_user?: { username: string };
  order_payments?: OrderPayment[];
}

// Extended OrderItem interface as requested
export interface OrderItem {
  id: string
  order_id: string
  item_id: string
  quantity: number
  price: number
  discount: number
  actual_quantity_after_security_check?: number | null
  final_delivery_weight_kg?: number | null
  category_id?: string | null
  category_name?: string | null
  products?: Product
}

// New interface: OrderItemWithDeliveryWeight as requested
export interface OrderItemWithDeliveryWeight extends OrderItem {
  final_delivery_weight_kg?: number | null
  category_id?: string | null
  category_name?: string | null
  products?: Product & {
    categories?: {
      category_id: string
      category_name: string
      category_code: string
    }
  }
}

export interface User {
  id: string
  username: string
  password_hash: string
  role: 'Super Admin' | 'Admin' | 'Sales Rep' | 'Security Guard' | 'Order Manager' | 'Finance Admin'
  device_id: string
  first_login: boolean
  created_at: string
  email?: string
  title: 'Mr' | 'Mrs' | 'Ms' | 'Dr'
  first_name: string
  last_name: string
  employee_id?: string
  phone_number: string
}

export interface BatchRecord {
  id: string
  product_id: string
  batch_number: string
  quantity: number
  expiry_date?: string
  created_at: string
}

export interface PriceHistory {
  id: string
  product_id: string
  old_price: number
  new_price: number
  changed_by: string
  changed_at: string
}

export interface OnDemandAssignment {
  id: string
  sales_rep_id: string
  assigned_by: string
  assignment_date: string
  notes: string
  status: 'active' | 'completed' | 'cancelled'
  vehicle_number: string | null
  assignment_type: 'admin_assigned' | 'sales_rep_requested'
  created_at: string
  updated_at: string
  sales_rep?: {
    username: string
  }
  assigned_by_user?: {
    username: string
  }
  assignment_items?: OnDemandAssignmentItem[]
}

export interface OnDemandAssignmentItem {
  id: string
  on_demand_assignment_id: string
  product_id: string
  assigned_quantity: number
  sold_quantity: number
  returned_quantity: number
  created_at: string
  products?: Product
  on_demand_orders?: OnDemandOrder[]
}

export interface OnDemandOrder {
  id: string
  on_demand_assignment_item_id: string
  sales_rep_id: string
  customer_name: string
  customer_phone?: string
  customer_type: 'existing' | 'walk-in'
  existing_customer_id?: string
  quantity_sold: number
  selling_price: number
  total_amount: number
  sale_date: string
  on_demand_order_display_id: string
  notes: string
  created_at: string
  customers?: Customer
  payment_method?: 'Net' | 'Cash' | 'Cheque' | 'Credit Card' | 'Bank Transfer' | null
  receipt_no?: string | null
  payment_status?: 'fully_paid' | 'partially_paid' | 'unpaid'
  collected_amount?: number
  on_demand_order_payments?: OnDemandOrderPayment[]
}

export interface Vehicle {
  id: string
  vehicle_number: string
  vehicle_type: string
  capacity_cbm: number
  status: 'Available' | 'In Use' | 'Maintenance'
  sales_rep_id?: string | null
  created_at: string
  updated_at: string
}

export interface SystemSettings {
  id: string;
  vat_rate: number;
  customer_categories: string[];
  created_at: string;
  updated_at: string;
}

export interface OrderPayment {
  id: string;
  order_id: string;
  payment_date: string;
  amount: number;
  payment_method: 'Cash' | 'Net' | 'Cheque' | 'Credit Card' | 'Bank Transfer';
  receipt_no: string;
  collected_by: string;
  created_at: string;
  updated_at: string;
  cheque_number?: string | null;
  cheque_date?: string | null;
}

export interface OnDemandOrderPayment {
  id: string;
  on_demand_order_id: string;
  payment_date: string;
  amount: number;
  payment_method: 'Cash' | 'Net' | 'Cheque' | 'Credit Card' | 'Bank Transfer';
  receipt_no: string;
  collected_by: string;
  created_at: string;
  updated_at: string;
  cheque_number?: string | null;
  cheque_date?: string | null;
}

// ============================================
// === Consolidated On-Demand Order Types ===
// ============================================

export interface ConsolidatedOnDemandProduct {
  id: string;
  product_id: string;
  product_name: string;
  unit_type: 'Kg' | 'g' | 'Packs';
  sold_quantity: number;
  selling_price: number;
  total_amount: number;
}

export interface ConsolidatedOnDemandOrder {
  id: string;
  consolidated_order_display_id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  sales_rep_id: string;
  sales_rep_username: string;
  total_amount: number;
  collected_amount: number;
  remaining_amount: number;
  payment_status: 'fully_paid' | 'partially_paid' | 'unpaid';
  consolidated_date: string;
  created_at: string;
  updated_at: string;
  products: ConsolidatedOnDemandProduct[];
  on_demand_orders: OnDemandOrder[]; // Original on-demand orders included in consolidation
  customer_details?: Customer;
  sales_rep?: { username: string };
}