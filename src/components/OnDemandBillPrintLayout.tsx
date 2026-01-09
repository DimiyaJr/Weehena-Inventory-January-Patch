import React from 'react'
import { OnDemandOrder, OnDemandAssignmentItem, Product, Customer } from '../lib/supabase'
// Logo removed for 80mm thermal printer compatibility
import { formatCurrency } from '../utils/formatters'
import { WEIGHT_UNIT } from '../utils/units'
import { PaymentMethodType } from '../utils/staticPaymentMethods'

interface OnDemandBillPrintLayoutProps {
  order: OnDemandOrder & {
    customer_details?: Customer;
    product_details?: (OnDemandAssignmentItem & { products: Product })[];
    sales_rep_username?: string;
  };
  paymentMethod: PaymentMethodType | null;
  receiptNo: string;
  transactionAmount: number;
  previouslyCollected: number;
  totalCollected: number;
  remainingBalance: number;
  paymentStatusText: string;
}

export const OnDemandBillPrintLayout: React.FC<OnDemandBillPrintLayoutProps> = ({
  order,
  paymentMethod,
  receiptNo,
  transactionAmount,
  previouslyCollected,
  totalCollected,
  remainingBalance,
  paymentStatusText,
}) => {
  const getTotalAmount = () => {
    return order.total_amount;
  };

  return (
    <div
      style={{
        fontFamily: 'Courier, monospace',
        maxWidth: '80mm',
        width: '80mm',
        margin: '0 auto',
        padding: '10px',
        backgroundColor: '#fff',
        color: '#000',
        fontSize: '12px',
        lineHeight: '1.6',
      }}
    >
      {/* Header - Optimized for 80mm thermal printer */}
      <div style={{ textAlign: 'center', marginBottom: '15px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 3px 0', letterSpacing: '1px', textAlign: 'center' }}>WEEHENA FARMS</h1>
        <p style={{ fontSize: '10px', margin: '0 0 8px 0', color: '#333', textAlign: 'center' }}>A Taste with Quality</p>
        
        {/* ORDER TYPE INDICATOR */}
        <div style={{ 
          backgroundColor: '#f0f0f0', 
          padding: '6px 0', 
          margin: '8px 0',
          border: '1px solid #000',
          borderRadius: '3px'
        }}>
          <p style={{ fontSize: '13px', fontWeight: 'bold', margin: '0', letterSpacing: '0.5px', textAlign: 'center' }}>ON DEMAND ORDER</p>
        </div>
        
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: '8px 0 5px 0', textAlign: 'center' }}>SALES RECEIPT</h2>
        <p style={{ fontSize: '11px', margin: '3px 0', textAlign: 'center' }}>Date: {new Date(order.sale_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
        <p style={{ fontSize: '11px', margin: '3px 0', textAlign: 'center' }}>
          Receipt No: <span style={{ fontWeight: 'bold' }}>{receiptNo}</span>
        </p>
      </div>


      {/* Bill To - Enhanced spacing */}
      <div style={{ marginBottom: '15px', fontSize: '11px', lineHeight: '1.7' }}>
        <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '0 0 5px 0', borderBottom: '1px dashed #000', paddingBottom: '3px' }}>BILL TO:</p>
        <p style={{ margin: '3px 0', fontWeight: 'bold' }}>{order.customer_name}</p>
        {order.customer_details?.address && (
          <p style={{ margin: '3px 0' }}>{order.customer_details.address}</p>
        )}
        <p style={{ margin: '3px 0' }}>Phone: {order.customer_phone || order.customer_details?.phone_number || 'N/A'}</p>
        {order.customer_details?.vat_status && (
          <p style={{ margin: '3px 0' }}>VAT Status: {order.customer_details.vat_status}</p>
        )}
        {order.customer_details?.vat_status === 'VAT' && order.customer_details?.tin_number && (
          <p style={{ margin: '3px 0', fontWeight: 'bold' }}>TIN: {order.customer_details.tin_number}</p>
        )}
      </div>

      {/* Order Details - Enhanced spacing */}
      <div style={{ marginBottom: '15px', fontSize: '11px', lineHeight: '1.7' }}>
        <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '0 0 5px 0', borderBottom: '1px dashed #000', paddingBottom: '3px' }}>ORDER DETAILS:</p>
        <p style={{ margin: '3px 0' }}>
          Order ID: <span style={{ fontWeight: 'bold' }}>{order.on_demand_order_display_id}</span>
        </p>
        <p style={{ margin: '3px 0' }}>
          Sales Rep: <span style={{ fontWeight: 'bold' }}>{order.sales_rep_username || 'N/A'}</span>
        </p>
        <p style={{ margin: '3px 0' }}>
          Payment Method: <span style={{ fontWeight: 'bold' }}>{paymentMethod?.label || paymentMethod?.value || 'N/A'}</span>
        </p>
      </div>

      {/* Order Items - Optimized layout */}
      <div style={{ marginBottom: '15px' }}>
        <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '0 0 8px 0', borderBottom: '2px solid #000', paddingBottom: '4px' }}>ORDER ITEMS:</p>
        
        {order.product_details?.map((item, index) => (
          <div key={index} style={{ 
            marginBottom: '10px', 
            paddingBottom: '8px', 
            borderBottom: index < (order.product_details?.length || 0) - 1 ? '1px dashed #ccc' : 'none'
          }}>
            <div style={{ marginBottom: '4px' }}>
              <p style={{ margin: '0', fontSize: '12px', fontWeight: 'bold' }}>
                {item.products.name}
              </p>
              <p style={{ margin: '0', fontSize: '10px', color: '#555' }}>
                ID: {item.products.product_id || item.products.sku || 'N/A'}
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', lineHeight: '1.6' }}>
              <span>{item.sold_quantity} × {formatCurrency(item.selling_price)}</span>
              <span style={{ fontWeight: 'bold', textAlign: 'right' }}>{formatCurrency(item.sold_quantity * item.selling_price)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Payment Summary - Right aligned amounts with enhanced spacing */}
      <div style={{ 
        marginBottom: '15px',
        padding: '10px',
        backgroundColor: '#f9f9f9',
        border: '1px solid #ccc',
        borderRadius: '3px'
      }}>
        <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '0 0 8px 0', textAlign: 'center' }}>PAYMENT SUMMARY</p>
        
        <div style={{ fontSize: '11px', lineHeight: '1.8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0', paddingBottom: '5px', borderBottom: '1px dashed #ccc' }}>
            <span>Total Order Value:</span>
            <span style={{ fontWeight: 'bold', textAlign: 'right' }}>{formatCurrency(getTotalAmount())}</span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0' }}>
            <span>Amount Paid Now:</span>
            <span style={{ fontWeight: 'bold', textAlign: 'right' }}>{formatCurrency(transactionAmount)}</span>
          </div>
          
          {previouslyCollected > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0' }}>
              <span>Previously Collected:</span>
              <span style={{ fontWeight: 'bold', textAlign: 'right' }}>{formatCurrency(previouslyCollected)}</span>
            </div>
          )}
          
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0' }}>
            <span>Total Collected:</span>
            <span style={{ fontWeight: 'bold', textAlign: 'right' }}>{formatCurrency(totalCollected)}</span>
          </div>
          
          {remainingBalance > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0', paddingTop: '5px', borderTop: '1px dashed #000', color: '#c00' }}>
              <span style={{ fontWeight: 'bold' }}>Remaining Balance:</span>
              <span style={{ fontWeight: 'bold', fontSize: '12px', textAlign: 'right' }}>{formatCurrency(remainingBalance)}</span>
            </div>
          )}
          
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0 5px 0', paddingTop: '8px', borderTop: '1px solid #000' }}>
            <span>Payment Method:</span>
            <span style={{ fontWeight: 'bold', textAlign: 'right' }}>{paymentMethod?.label || paymentMethod?.value || 'N/A'}</span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0' }}>
            <span>Payment Status:</span>
            <span style={{ fontWeight: 'bold', textAlign: 'right' }}>{paymentStatusText}</span>
          </div>
        </div>
      </div>

      {/* Grand Total - Bold and prominent */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        marginBottom: '15px',
        padding: '10px',
        backgroundColor: '#000',
        color: '#fff',
        borderRadius: '3px'
      }}>
        <span style={{ fontWeight: 'bold', fontSize: '14px', letterSpacing: '0.5px' }}>GRAND TOTAL:</span>
        <span style={{ fontWeight: 'bold', fontSize: '16px', textAlign: 'right' }}>{formatCurrency(getTotalAmount())}</span>
      </div>

      {/* Footer - Optimized for thermal printer */}
      <div style={{ 
        textAlign: 'center', 
        fontSize: '10px', 
        color: '#333', 
        paddingTop: '12px', 
        marginTop: '12px',
        borderTop: '2px dashed #000',
        lineHeight: '1.7'
      }}>
        <p style={{ margin: '4px 0', fontWeight: 'bold' }}>Thank you for your business!</p>
        <p style={{ margin: '4px 0' }}>Weehena Farm - Quality Poultry Products</p>
        <p style={{ margin: '4px 0' }}>Contact: [Your Phone Number]</p>
        <p style={{ margin: '8px 0 0 0', fontSize: '9px' }}>
          Printed: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
};