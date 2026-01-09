import React from 'react';
import { createRoot } from 'react-dom/client'; // Import createRoot
import { Order, OrderItem, Product, Customer, OrderPayment } from '../lib/supabase';
import { formatCurrency } from '../utils/formatters';

interface BillPrintLayoutProps {
  order: Order & {
    customers: Customer;
    order_items: (OrderItem & { products: Product })[];
    assigned_user: { username: string };
  };
  paymentMethod: 'Net' | 'Cash';
  receiptNo: string;
  transactionAmount: number;
  previouslyCollected: number;
  totalCollected: number;
  remainingBalance: number;
  paymentStatusText: string;
  vatRate: number;
  finalDeliveryWeights?: Record<string, number>; // ADDED: Final delivery weights
}

// New interface for specific payment receipt
interface PaymentReceiptLayoutProps {
  order: Order & {
    customers: Customer;
    order_items: (OrderItem & { products: Product })[];
    assigned_user: { username: string };
  };
  specificPayment?: OrderPayment & {
    collected_by_user?: string;
  };
  vatRate: number;
}

// Main component that can handle both cases
export const BillPrintLayout: React.FC<BillPrintLayoutProps> = ({
  order,
  paymentMethod,
  receiptNo,
  transactionAmount,
  previouslyCollected,
  totalCollected,
  remainingBalance,
  paymentStatusText,
  vatRate,
  finalDeliveryWeights, // ADDED: Final delivery weights
}) => {
  const subTotal = order.total_amount - order.vat_amount;

  return ( // Updated for 80mm thermal printer compatibility
    <div style={{ 
      fontFamily: 'Courier, monospace', 
      maxWidth: '80mm', 
      width: '80mm',
      margin: '0 auto', 
      padding: '10px', 
      color: '#000',
      fontSize: '12px',
      lineHeight: '1.6'
    }}>
      {/* Header - Optimized for 80mm thermal printer */}
      <div style={{ textAlign: 'center', marginBottom: '15px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 3px 0', letterSpacing: '1px' }}>WEEHENA FARM</h1>
        <p style={{ fontSize: '10px', margin: '0 0 8px 0', color: '#333' }}>A Taste with Quality</p>
        
        {/* ORDER TYPE INDICATOR */}
        <div style={{ 
          backgroundColor: '#f0f0f0', 
          padding: '6px 0', 
          margin: '8px 0',
          border: '1px solid #000',
          borderRadius: '3px'
        }}>
          <p style={{ fontSize: '13px', fontWeight: 'bold', margin: '0', letterSpacing: '0.5px' }}>SALES ORDER</p>
        </div>
        
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: '8px 0 5px 0' }}>SALES RECEIPT</h2>
        <p style={{ fontSize: '11px', margin: '3px 0' }}>Date: {new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
        <p style={{ fontSize: '11px', margin: '3px 0' }}>
          Receipt No: <span style={{ fontWeight: 'bold' }}>{receiptNo}</span>
        </p>
      </div>

      {/* Customer & Order Info - Single column for 80mm */}
      <div style={{ marginBottom: '15px', fontSize: '11px', lineHeight: '1.7' }}>
        <div style={{ marginBottom: '12px' }}>
          <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '0 0 5px 0', borderBottom: '1px dashed #000', paddingBottom: '3px' }}>BILL TO:</p>
          <p style={{ margin: '3px 0', fontWeight: 'bold' }}>{order.customers.name}</p>
          <p style={{ margin: '3px 0' }}>{order.customers.address}</p>
          <p style={{ margin: '3px 0' }}>Phone: {order.customers.phone_number}</p>
          {order.customers.email && <p style={{ margin: '3px 0' }}>Email: {order.customers.email}</p>}
          {order.customers.vat_status === 'VAT' && <p style={{ margin: '3px 0' }}>VAT Status: {order.customers.vat_status}</p>}
          {order.customers.vat_status === 'VAT' && order.customers.tin_number && (
            <p style={{ margin: '3px 0', fontWeight: 'bold' }}>TIN: {order.customers.tin_number}</p>
          )}
        </div>
        
        <div style={{ marginBottom: '12px' }}>
          <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '0 0 5px 0', borderBottom: '1px dashed #000', paddingBottom: '3px' }}>ORDER DETAILS:</p>
          <p style={{ margin: '3px 0' }}>
            Order ID: <span style={{ fontWeight: 'bold' }}>{order.order_display_id}</span>
          </p>
          <p style={{ margin: '3px 0' }}>
            Payment Method: <span style={{ fontWeight: 'bold' }}>{paymentMethod === null ? 'N/A' : paymentMethod}</span>
          </p>
          <p style={{ margin: '3px 0' }}>
            Sales Rep: <span style={{ fontWeight: 'bold' }}>{order.assigned_user?.username || 'N/A'}</span>
          </p>
          {order.vehicle_number && (
            <p style={{ margin: '3px 0' }}>
              Vehicle No: <span style={{ fontWeight: 'bold' }}>{order.vehicle_number}</span>
            </p>
          )}
        </div>
      </div>

      {/* Items Table - Optimized for 80mm */}
      <div style={{ marginBottom: '15px' }}>
        <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '0 0 8px 0', borderBottom: '2px solid #000', paddingBottom: '4px' }}>ORDER ITEMS:</p>
        
        {/* Items List */}
        {order.order_items?.map((item, index) => {
          const displayQuantity = finalDeliveryWeights && finalDeliveryWeights[item.id] > 0 
            ? finalDeliveryWeights[item.id] 
            : item.quantity;
          const itemTotal = finalDeliveryWeights && finalDeliveryWeights[item.id] > 0 
            ? finalDeliveryWeights[item.id] * item.price
            : item.quantity * item.price;
          
          return (
            <div key={item.id} style={{ 
              marginBottom: '10px', 
              paddingBottom: '8px', 
              borderBottom: index < order.order_items.length - 1 ? '1px dashed #ccc' : 'none'
            }}>
              <div style={{ marginBottom: '4px' }}>
                <p style={{ margin: '0', fontSize: '12px', fontWeight: 'bold' }}>
                  {item.products?.name || 'Product'}
                </p>
                <p style={{ margin: '0', fontSize: '10px', color: '#555' }}>
                  ID: {item.products?.product_id || item.products?.sku || 'N/A'}
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', lineHeight: '1.6' }}>
                <span>{displayQuantity} {item.products?.unit_type || 'Kg'} × {formatCurrency(item.price)}</span>
                <span style={{ fontWeight: 'bold' }}>{formatCurrency(itemTotal)}</span>
              </div>
            </div>
          );
        })}
        
        {/* Subtotal, VAT, Grand Total */}
        <div style={{ marginTop: '12px', borderTop: '2px solid #000', paddingTop: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0', fontSize: '11px' }}>
            <span>Subtotal:</span>
            <span style={{ fontWeight: 'bold', textAlign: 'right' }}>{formatCurrency(subTotal)}</span>
          </div>
          
          {order.is_vat_applicable && (
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0', fontSize: '11px' }}>
              <span>VAT ({vatRate * 100}%):</span>
              <span style={{ fontWeight: 'bold', textAlign: 'right' }}>{formatCurrency(order.vat_amount)}</span>
            </div>
          )}
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            margin: '8px 0', 
            padding: '8px 0',
            borderTop: '2px solid #000',
            borderBottom: '2px double #000',
            fontSize: '13px'
          }}>
            <span style={{ fontWeight: 'bold' }}>GRAND TOTAL:</span>
            <span style={{ fontWeight: 'bold', fontSize: '14px', textAlign: 'right' }}>{formatCurrency(order.total_amount)}</span>
          </div>
        </div>
      </div>

      {/* Payment Summary - Right Aligned */}
      <div style={{ 
        marginBottom: '15px', 
        padding: '10px', 
        backgroundColor: '#f9f9f9',
        border: '1px solid #ccc',
        borderRadius: '3px'
      }}>
        <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '0 0 8px 0', textAlign: 'center' }}>PAYMENT SUMMARY</p>
        
        {previouslyCollected > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '6px 0', fontSize: '11px', lineHeight: '1.7' }}>
            <span>Previously Collected:</span>
            <span style={{ fontWeight: 'bold', textAlign: 'right' }}>{formatCurrency(previouslyCollected)}</span>
          </div>
        )}
        
        {transactionAmount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '6px 0', fontSize: '11px', lineHeight: '1.7' }}>
            <span>Collected This Transaction:</span>
            <span style={{ fontWeight: 'bold', textAlign: 'right' }}>{formatCurrency(transactionAmount)}</span>
          </div>
        )}
        
        {totalCollected > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '6px 0', fontSize: '11px', lineHeight: '1.7' }}>
            <span>Total Collected:</span>
            <span style={{ fontWeight: 'bold', textAlign: 'right' }}>{formatCurrency(totalCollected)}</span>
          </div>
        )}
        
        {remainingBalance > 0 && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            margin: '8px 0 0 0', 
            padding: '6px 0',
            borderTop: '1px dashed #000',
            fontSize: '12px', 
            lineHeight: '1.7',
            color: '#c00'
          }}>
            <span style={{ fontWeight: 'bold' }}>Remaining Balance:</span>
            <span style={{ fontWeight: 'bold', fontSize: '13px', textAlign: 'right' }}>{formatCurrency(remainingBalance)}</span>
          </div>
        )}
        
        {paymentStatusText === 'Payment Not Collected' && (
          <div style={{ 
            textAlign: 'center', 
            padding: '8px', 
            margin: '8px 0 0 0',
            fontSize: '12px', 
            fontWeight: 'bold', 
            color: '#c00', 
            backgroundColor: '#ffe0e0',
            border: '1px solid #c00',
            borderRadius: '3px'
          }}>
            PAYMENT NOT COLLECTED
          </div>
        )}
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

// New component for specific payment receipt
export const PaymentReceiptLayout: React.FC<PaymentReceiptLayoutProps> = ({
  order,
  specificPayment,
  vatRate,
}) => {
  const subTotal = order.total_amount - order.vat_amount;
  const paymentDate = specificPayment ? new Date(specificPayment.payment_date).toLocaleDateString() : new Date(order.created_at).toLocaleDateString();
  const receiptNo = specificPayment ? specificPayment.receipt_no : 'N/A';
  const paymentAmount = specificPayment ? specificPayment.amount : 0;
  const paymentMethod = specificPayment ? specificPayment.payment_method : order.payment_method || 'N/A';
  const collectedBy = specificPayment?.collected_by_user || 'N/A';

  return (
    <div style={{ 
      fontFamily: 'Courier, monospace', 
      maxWidth: '80mm', 
      width: '80mm',
      margin: '0 auto', 
      padding: '10px', 
      color: '#000',
      fontSize: '12px',
      lineHeight: '1.6'
    }}>
      {/* Header - Optimized for 80mm thermal printer */}
      <div style={{ textAlign: 'center', marginBottom: '15px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 3px 0', letterSpacing: '1px' }}>WEEHENA FARMS</h1>
        <p style={{ fontSize: '10px', margin: '0 0 8px 0', color: '#333' }}>A Taste with Quality</p>
        
        {/* ORDER TYPE INDICATOR */}
        <div style={{ 
          backgroundColor: '#f0f0f0', 
          padding: '6px 0', 
          margin: '8px 0',
          border: '1px solid #000',
          borderRadius: '3px'
        }}>
          <p style={{ fontSize: '13px', fontWeight: 'bold', margin: '0', letterSpacing: '0.5px' }}>SALES ORDER - PAYMENT RECEIPT</p>
        </div>
        
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: '8px 0 5px 0' }}>PAYMENT RECEIPT</h2>
        <p style={{ fontSize: '11px', margin: '3px 0' }}>Payment Date: {paymentDate}</p>
        <p style={{ fontSize: '11px', margin: '3px 0' }}>
          Receipt No: <span style={{ fontWeight: 'bold' }}>{receiptNo}</span>
        </p>
        {specificPayment && (
          <p style={{ fontSize: '11px', margin: '3px 0' }}>
            Original Order Date: {new Date(order.created_at).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Customer & Order Info - Single column for 80mm */}
      <div style={{ marginBottom: '15px', fontSize: '11px', lineHeight: '1.7' }}>
        <div style={{ marginBottom: '12px' }}>
          <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '0 0 5px 0', borderBottom: '1px dashed #000', paddingBottom: '3px' }}>CUSTOMER:</p>
          <p style={{ margin: '3px 0', fontWeight: 'bold' }}>{order.customers.name}</p>
          <p style={{ margin: '3px 0' }}>{order.customers.address}</p>
          <p style={{ margin: '3px 0' }}>Phone: {order.customers.phone_number}</p>
          {order.customers.email && <p style={{ margin: '3px 0' }}>Email: {order.customers.email}</p>}
        </div>
        
        <div style={{ marginBottom: '12px' }}>
          <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '0 0 5px 0', borderBottom: '1px dashed #000', paddingBottom: '3px' }}>TRANSACTION DETAILS:</p>
          <p style={{ margin: '3px 0' }}>
            Order ID: <span style={{ fontWeight: 'bold' }}>{order.order_display_id}</span>
          </p>
          <p style={{ margin: '3px 0' }}>
            Payment Method: <span style={{ fontWeight: 'bold' }}>{paymentMethod}</span>
          </p>
          <p style={{ margin: '3px 0' }}>
            Collected By: <span style={{ fontWeight: 'bold' }}>{collectedBy}</span>
          </p>
          {order.vehicle_number && (
            <p style={{ margin: '3px 0' }}>
              Vehicle No: <span style={{ fontWeight: 'bold' }}>{order.vehicle_number}</span>
            </p>
          )}
        </div>
      </div>

      {/* Original Order Summary (Condensed) */}
      <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f9f9f9', border: '1px solid #ddd', borderRadius: '4px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 10px 0', textAlign: 'center' }}>Original Order Summary</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <tbody>
            <tr>
              <td style={{ padding: '5px', width: '70%' }}>Order Total:</td>
              <td style={{ textAlign: 'right', padding: '5px', fontWeight: 'bold' }}>{formatCurrency(order.total_amount)}</td>
            </tr>
            {order.order_items?.slice(0, 3).map((item, index) => (
              <tr key={item.id}>
                <td style={{ padding: '5px' }}>{item.products.name} ({item.quantity} kg)</td>
                <td style={{ textAlign: 'right', padding: '5px' }}>{formatCurrency(item.quantity * item.price)}</td>
              </tr>
            ))}
            {order.order_items && order.order_items.length > 3 && (
              <tr>
                <td style={{ padding: '5px', fontStyle: 'italic' }}>+ {order.order_items.length - 3} more items</td>
                <td style={{ textAlign: 'right', padding: '5px' }}></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Payment Details */}
      <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#e8f5e8', border: '1px solid #4caf50', borderRadius: '4px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 10px 0', color: '#2e7d32', textAlign: 'center' }}>
          Payment Details
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <tbody>
            <tr>
              <td style={{ padding: '8px', fontWeight: 'bold', width: '60%' }}>Payment Amount:</td>
              <td style={{ textAlign: 'right', padding: '8px', fontWeight: 'bold', fontSize: '16px', color: '#2e7d32' }}>
                {formatCurrency(paymentAmount)}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8px' }}>Payment Date:</td>
              <td style={{ textAlign: 'right', padding: '8px', fontWeight: 'bold' }}>{paymentDate}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px' }}>Payment Method:</td>
              <td style={{ textAlign: 'right', padding: '8px', fontWeight: 'bold' }}>{paymentMethod}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px' }}>Receipt Number:</td>
              <td style={{ textAlign: 'right', padding: '8px', fontWeight: 'bold' }}>{receiptNo}</td>
            </tr>
          </tbody>
        </table>
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
        <p style={{ margin: '4px 0', fontWeight: 'bold' }}>This is an official payment receipt.</p>
        <p style={{ margin: '4px 0', fontWeight: 'bold' }}>Thank you for your payment!</p>
        <p style={{ margin: '4px 0' }}>Weehena Farm - Quality Poultry Products</p>
        <p style={{ margin: '4px 0' }}>Contact: [Your Phone Number]</p>
        <p style={{ margin: '8px 0 0 0', fontSize: '9px' }}>
          Printed: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
};

// Helper function to determine which layout to use
export const getPrintLayout = (
  isSpecificPayment: boolean,
  props: BillPrintLayoutProps | PaymentReceiptLayoutProps
) => {
  if (isSpecificPayment && 'specificPayment' in props) {
    return <PaymentReceiptLayout {...props as PaymentReceiptLayoutProps} />;
  }
  return <BillPrintLayout {...props as BillPrintLayoutProps} />;
};