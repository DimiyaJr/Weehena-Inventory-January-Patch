// src/lib/emailService.ts

import { supabase } from './supabase'
import { formatCurrency } from '../utils/formatters' // New import

interface BillEmailData {
  customerEmail: string
  customerName: string
  orderDisplayId: string
  receiptNo: string
  totalAmount: string // Changed from number to string
  paymentMethod: 'Net' | 'Cash'
  orderItems: Array<{
    productName: string
    quantity: number
    price: string // Changed from number to string
    total: string // Changed from number to string
  }>
  orderDate: string
  salesRepName: string
  vehicleNumber?: string
  orderId: string
  subTotal: string // Changed from number to string
  vatAmount: string // Changed from number to string
  isVatApplicable: boolean
}

export const sendBillEmail = async (emailData: BillEmailData): Promise<{success: boolean; error?: string}> => {
  try {
    console.log('=== Starting Email Send Process ===')
    console.log('Email data:', emailData)

    // Validate email
    if (!emailData.customerEmail || !emailData.customerEmail.includes('@')) {
      const errorMsg = 'Invalid email address: ' + emailData.customerEmail
      console.error(errorMsg)
      return { success: false, error: errorMsg }
    }

    console.log('Email validation passed, calling edge function...')

    // Retrieve internal token from environment
    const INTERNAL_SEND_TOKEN = import.meta.env.VITE_INTERNAL_SEND_TOKEN
    
    if (!INTERNAL_SEND_TOKEN) {
      const errorMsg = 'VITE_INTERNAL_SEND_TOKEN is not configured'
      console.error(errorMsg)
      return { success: false, error: errorMsg }
    }

    console.log("Frontend: Using VITE_INTERNAL_SEND_TOKEN:", INTERNAL_SEND_TOKEN ? '***' + INTERNAL_SEND_TOKEN.slice(-4) : 'NOT FOUND');

    // Prepare the request body with formatted currency values
    const requestBody = {
      to: emailData.customerEmail,
      customerName: emailData.customerName,
      orderDisplayId: emailData.orderDisplayId,
      receiptNo: emailData.receiptNo,
      totalAmount: formatCurrency(parseFloat(emailData.totalAmount)), // Format here
      paymentMethod: emailData.paymentMethod,
      orderItems: emailData.orderItems.map(item => ({
        ...item,
        price: formatCurrency(parseFloat(item.price)), // Format here
        total: formatCurrency(parseFloat(item.total)) // Format here
      })),
      orderDate: emailData.orderDate,
      salesRepName: emailData.salesRepName,
      vehicleNumber: emailData.vehicleNumber,
      orderId: emailData.orderId,
      subTotal: formatCurrency(parseFloat(emailData.subTotal)), // Format here
      vatAmount: formatCurrency(parseFloat(emailData.vatAmount)), // Format here
      isVatApplicable: emailData.isVatApplicable,
    }

    console.log('Request body prepared:', requestBody)

    // Option 1: Using supabase.functions.invoke (recommended)
    console.log('Calling edge function via supabase.functions.invoke...')
    
    const { data, error } = await supabase.functions.invoke('send-receipt-email', {
      body: requestBody,
      headers: {
        'x-internal-send-token': INTERNAL_SEND_TOKEN
      }
    })

    if (error) {
      console.error('=== Edge Function Error ===')
      console.error('Error details:', error)
      console.error('Error message:', error.message)
      
      // If supabase.functions.invoke fails, try direct fetch as fallback
      console.log('Trying fallback with direct fetch...')
      return await sendEmailDirectFetch(requestBody, INTERNAL_SEND_TOKEN)
    }

    console.log('=== Email Sent Successfully via Supabase Invoke ===')
    console.log('Response data:', data)
    
    return { success: true }

  } catch (error: any) {
    console.error('=== Exception in sendBillEmail ===')
    console.error('Error:', error)
    console.error('Error message:', error?.message)
    
    return { 
      success: false, 
      error: error?.message || 'Unknown error occurred' 
    }
  }
}

// Fallback function using direct fetch
async function sendEmailDirectFetch(requestBody: any, token: string): Promise<{success: boolean; error?: string}> {
  try {
    console.log('=== Trying Direct Fetch Fallback ===')
    
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    if (!supabaseUrl) {
      return { success: false, error: 'VITE_SUPABASE_URL not configured' }
    }

    const functionUrl = `${supabaseUrl}/functions/v1/send-receipt-email`
    console.log('Calling function URL:', functionUrl)

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-send-token': token,
        // Add CORS headers that might be needed
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })

    console.log('Direct fetch response status:', response.status)
    console.log('Direct fetch response ok:', response.ok)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Direct fetch error response:', errorText)
      
      let errorMessage = `HTTP ${response.status}`
      try {
        const errorData = JSON.parse(errorText)
        errorMessage = errorData.error || errorData.message || errorText
      } catch {
        errorMessage = errorText || `HTTP ${response.status}`
      }
      
      return { success: false, error: errorMessage }
    }

    const data = await response.json()
    console.log('=== Email Sent Successfully via Direct Fetch ===')
    console.log('Response data:', data)

    return { success: true }

  } catch (fetchError: any) {
    console.error('=== Direct Fetch Fallback Failed ===')
    console.error('Fetch error:', fetchError)
    console.error('Fetch error message:', fetchError?.message)
    
    return { 
      success: false, 
      error: `Direct fetch failed: ${fetchError?.message || 'Unknown error'}` 
    }
  }
}

// Alternative function using fetch directly (if you prefer this approach)
export const sendBillEmailDirect = async (emailData: BillEmailData): Promise<{success: boolean; error?: string}> => {
  try {
    console.log('=== Starting Direct Email Send ===')
    
    const INTERNAL_SEND_TOKEN = import.meta.env.VITE_INTERNAL_SEND_TOKEN
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

    if (!INTERNAL_SEND_TOKEN || !SUPABASE_URL) {
      return { 
        success: false, 
        error: 'Missing environment variables: VITE_INTERNAL_SEND_TOKEN or VITE_SUPABASE_URL' 
      }
    }

    // Prepare the request body with formatted currency values
    const requestBody = {
      to: emailData.customerEmail,
      customerName: emailData.customerName,
      orderDisplayId: emailData.orderDisplayId,
      receiptNo: emailData.receiptNo,
      totalAmount: formatCurrency(parseFloat(emailData.totalAmount)), // Format here
      paymentMethod: emailData.paymentMethod,
      orderItems: emailData.orderItems.map(item => ({
        ...item,
        price: formatCurrency(parseFloat(item.price)), // Format here
        total: formatCurrency(parseFloat(item.total)) // Format here
      })),
      orderDate: emailData.orderDate,
      salesRepName: emailData.salesRepName,
      vehicleNumber: emailData.vehicleNumber,
      orderId: emailData.orderId,
      subTotal: formatCurrency(parseFloat(emailData.subTotal)), // Format here
      vatAmount: formatCurrency(parseFloat(emailData.vatAmount)), // Format here
      isVatApplicable: emailData.isVatApplicable,
    }

    const functionUrl = `${SUPABASE_URL}/functions/v1/send-receipt-email`
    
    console.log('Sending direct request to:', functionUrl)
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-send-token': INTERNAL_SEND_TOKEN,
      },
      body: JSON.stringify(requestBody)
    })

    console.log('Response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Error response:', errorText)
      
      let errorMessage = `HTTP ${response.status}`
      try {
        const errorData = JSON.parse(errorText)
        errorMessage = errorData.error || errorData.message || errorText
      } catch {
        errorMessage = errorText
      }
      
      return { success: false, error: errorMessage }
    }

    const data = await response.json()
    console.log('=== Direct Email Send Successful ===')
    console.log('Response:', data)

    return { success: true }

  } catch (error: any) {
    console.error('=== Direct Email Send Failed ===')
    console.error('Error:', error)
    
    return { 
      success: false, 
      error: error?.message || 'Direct send failed' 
    }
  }
}