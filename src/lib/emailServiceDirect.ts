// src/lib/emailServiceDirect.ts
// WARNING: This exposes your API key in the frontend. Use only for testing!
// For production, you MUST use Edge Functions or a backend server

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
}

// TEMPORARY: Store API key in environment variable
// Add to your .env file: VITE_RESEND_API_KEY=your_key
const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY

export const sendBillEmailDirect = async (emailData: BillEmailData): Promise<boolean> => {
  try {
    console.log('=== Sending Email Directly ===')
    
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured')
      alert('Email service not configured. Please contact administrator.')
      return false
    }

    // Validate email
    if (!emailData.customerEmail || !emailData.customerEmail.includes('@')) {
      console.error('Invalid email address:', emailData.customerEmail)
      return false
    }

    // Format currency values
    const formattedTotalAmount = formatCurrency(parseFloat(emailData.totalAmount))
    const formattedOrderItems = emailData.orderItems.map(item => ({
      ...item,
      price: formatCurrency(parseFloat(item.price)),
      total: formatCurrency(parseFloat(item.total))
    }))

    // Generate HTML content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
            .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
            .info-label { font-weight: bold; color: #4b5563; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; background-color: white; }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
            th { background-color: #f3f4f6; font-weight: 600; }
            .total-row { background-color: #fef3c7; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Weehena Farm</h1>
            <p>A Taste with Quality</p>
            <h2>SALES RECEIPT</h2>
          </div>
          <div class="content">
            <p><span class="info-label">Receipt No:</span> ${emailData.receiptNo}</p>
            <p><span class="info-label">Order ID:</span> ${emailData.orderDisplayId}</p>
            <p><span class="info-label">Date:</span> ${emailData.orderDate}</p>
            <p><span class="info-label">Customer:</span> ${emailData.customerName}</p>
            <p><span class="info-label">Payment:</span> ${emailData.paymentMethod}</p>
            <h3>Order Items:</h3>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Quantity (kg)</th>
                  <th>Price (Rs)</th>
                  <th>Total (Rs)</th>
                </tr>
              </thead>
              <tbody>
                ${formattedOrderItems.map(item => `
                  <tr>
                    <td>${item.productName}</td>
                    <td>${item.quantity}</td>
                    <td>${item.price}</td>
                    <td>${item.total}</td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr class="total-row">
                  <td colspan="3" align="right"><strong>Grand Total:</strong></td>
                  <td><strong>${formattedTotalAmount}</strong></td>
                </tr>
              </tfoot>
            </table>
            <p style="text-align: center; margin-top: 30px;">Thank you for your business!</p>
          </div>
        </body>
      </html>
    `

    console.log('Calling Resend API...')

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'Weehena Farm <onboarding@resend.dev>', // Use Resend's test domain or your verified domain
        to: [emailData.customerEmail],
        subject: `Sales Receipt - Order ${emailData.orderDisplayId}`,
        html: htmlContent
      })
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('Resend API error:', result)
      alert(`Email failed: ${result.message || 'Unknown error'}`)
      return false
    }

    console.log('Email sent successfully:', result)
    return true

  } catch (error: any) {
    console.error('Error sending email:', error)
    alert(`Email error: ${error.message}`)
    return false
  }
}