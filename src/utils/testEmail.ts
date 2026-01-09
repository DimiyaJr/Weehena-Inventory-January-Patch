// Create a test file: src/utils/testEmail.ts

import { supabase } from '../lib/supabase'

export const testEmailFunction = async () => {
  try {
    console.log('Testing email function...')
    
    const testData = {
      to: 'test@example.com', // Replace with your actual email
      customerName: 'Test Customer',
      orderDisplayId: 'TEST-001',
      receiptNo: 'RCPT-001',
      totalAmount: 1000,
      paymentMethod: 'Cash',
      orderItems: [
        {
          productName: 'Test Product',
          quantity: 10,
          price: 100,
          total: 1000
        }
      ],
      orderDate: new Date().toLocaleDateString(),
      salesRepName: 'Test Rep',
      vehicleNumber: 'TEST-123',
      orderId: 'test-order-id'
    }

    console.log('Calling edge function with data:', testData)

    const { data, error } = await supabase.functions.invoke('send-bill-email', {
      body: testData
    })

    if (error) {
      console.error('Edge function error:', error)
      return { success: false, error }
    }

    console.log('Edge function response:', data)
    return { success: true, data }

  } catch (error) {
    console.error('Test failed:', error)
    return { success: false, error }
  }
}

// To test, you can call this from browser console:
// import { testEmailFunction } from './utils/testEmail'
// testEmailFunction()