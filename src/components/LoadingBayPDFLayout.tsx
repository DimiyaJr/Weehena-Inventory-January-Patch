// src/components/LoadingBayPDFLayout.tsx
import React from 'react';
import { Order, OrderItem, Product, Customer, User } from '../lib/supabase';
import WeehenaLogo from '../assets/images/Weehena Logo(Ai) copy copy copy.png'; // Adjust path if needed
import { formatCurrency } from '../utils/formatters'; // Keep for consistency, though not used for payment

interface LoadingBayPDFLayoutProps {
  order: Order & {
    customers: Customer;
    order_items: (OrderItem & { products: Product })[];
    assigned_user: User;
  };
}

export const LoadingBayPDFLayout: React.FC<LoadingBayPDFLayoutProps> = ({ order }) => {
  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto', padding: '20px', color: '#000', fontSize: '12px' }}>
      {/* Header */}
      <table style={{ width: '100%', marginBottom: '20px', borderBottom: '1px solid #ccc' }}>
        <tbody>
          <tr>
            <td style={{ width: '50%', verticalAlign: 'top' }}>
              <img src={WeehenaLogo} alt="Weehena Farm Logo" style={{ height: '60px', width: 'auto', marginBottom: '5px' }} />
              <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0' }}>Weehena Farm</h1>
              <p style={{ fontSize: '10px', color: '#555', margin: '0' }}>A Taste with Quality</p>
            </td>
            <td style={{ width: '50%', textAlign: 'right', verticalAlign: 'top' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#c00', margin: '0 0 5px 0' }}>LOADING BAY ORDER</h2>
              <p style={{ fontSize: '10px', margin: '0' }}>Order Date: {new Date(order.created_at).toLocaleDateString()}</p>
              <p style={{ fontSize: '10px', margin: '0' }}>Delivery Date: {order.delivery_date ? new Date(order.delivery_date).toLocaleDateString() : 'N/A'}</p>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Customer & Order Info */}
      <table style={{ width: '100%', marginBottom: '20px' }}>
        <tbody>
          <tr>
            <td style={{ width: '50%', verticalAlign: 'top' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 10px 0' }}>Customer Details:</h3>
              <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>{order.customers.name}</p>
              <p style={{ margin: '0 0 5px 0', fontSize: '11px', color: '#333' }}>{order.customers.address}</p>
              <p style={{ margin: '0 0 5px 0', fontSize: '11px', color: '#333' }}>Phone: {order.customers.phone_number}</p>
              {order.customers.email && <p style={{ margin: '0', fontSize: '11px', color: '#333' }}>Email: {order.customers.email}</p>}
            </td>
            <td style={{ width: '50%', textAlign: 'right', verticalAlign: 'top' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 10px 0' }}>Order Information:</h3>
              <p style={{ margin: '0 0 5px 0', fontSize: '11px' }}>
                Order ID: <span style={{ fontWeight: 'bold' }}>{order.order_display_id}</span>
              </p>
              <p style={{ margin: '0 0 5px 0', fontSize: '11px' }}>
                Sales Rep: <span style={{ fontWeight: 'bold' }}>{order.assigned_user?.username || 'N/A'}</span>
              </p>
              {order.vehicle_number && (
                <p style={{ margin: '0', fontSize: '11px' }}>
                  Vehicle No: <span style={{ fontWeight: 'bold' }}>{order.vehicle_number}</span>
                </p>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Items Table */}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 10px 0' }}>Items for Loading:</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: '#f0f0f0' }}>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px', fontSize: '11px', borderBottom: '1px solid #ccc' }}>Product</th>
              <th style={{ textAlign: 'right', padding: '8px', fontSize: '11px', borderBottom: '1px solid #ccc' }}>Quantity (Kg)</th>
            </tr>
          </thead>
          <tbody>
            {order.order_items?.map((item) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px', fontSize: '11px' }}>{item.products.name}</td>
                <td style={{ textAlign: 'right', padding: '8px', fontSize: '11px' }}>{item.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', fontSize: '10px', color: '#555', paddingTop: '15px', borderTop: '1px solid #ccc' }}>
        <p style={{ margin: '0 0 5px 0' }}>This document is for loading bay use only. Do not use for billing.</p>
        <p style={{ margin: '0' }}>Weehena Farm, [Your Address], [Your Phone Number]</p>
      </div>
    </div>
  );
};