// src/utils/staticPaymentMethods.ts

export const STATIC_PAYMENT_METHODS = [
  'Cash',
  'Cheque',
  'Credit Card',
  'Bank Transfer',
  'Net' // Keep Net if it's a distinct payment method from Bank Transfer
];

// Define a type for consistency
export type PaymentMethodType = 'Cash' | 'Cheque' | 'Credit Card' | 'Bank Transfer' | 'Net';
