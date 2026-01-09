import React, { useState, useEffect } from 'react'
import { X, Printer } from 'lucide-react'
import { Order, OnDemandOrder, OnDemandAssignmentItem, Product, Customer, OnDemandOrderPayment } from '../lib/supabase'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../utils/formatters'
import { WEIGHT_UNIT } from '../utils/units'
import { STATIC_PAYMENT_METHODS, PaymentMethodType } from '../utils/staticPaymentMethods'
import { createRoot } from 'react-dom/client';

interface PaymentConfirmationModalProps {
  order: Order | (OnDemandOrder & {
    customer_details?: Customer;
    product_details?: (OnDemandAssignmentItem & { products: Product })[];
    sales_rep_username?: string;
    on_demand_order_payments?: OnDemandOrderPayment[];
  });
  onClose: () => void;
  onConfirm: (
    orderId: string,
    paymentMethod: PaymentMethodType,
    newlyCollectedAmount: number,
    isSubsequentPayment: boolean,
    intendedStatus: any,
    chequeNumber?: string,
    chequeDate?: string,
    finalDeliveryWeights?: Record<string, number> // Added parameter
  ) => Promise<string>;
  onPrintBill: (
    order: Order | (OnDemandOrder & { customer_details?: Customer; product_details?: (OnDemandAssignmentItem & { products: Product })[]; sales_rep_username?: string; }),
    paymentMethod: PaymentMethodType,
    receiptNo: string,
    transactionAmount: number,
    previouslyCollected: number,
    totalCollected: number,
    remainingBalance: number,
    paymentStatusText: string,
    subtotal?: number,
    discountAmount?: number,
    vatAmount?: number,
    grandTotal?: number,
    finalDeliveryWeights?: Record<string, number> // Added parameter
  ) => void;
  loading: boolean;
  is_on_demand?: boolean;
  paymentError?: string | null;
  allowPartialPayment?: boolean;
  isSubsequentPayment?: boolean;
  orderDeliveryDate?: string | null;
  initialPaymentStatus?: 'full' | 'partial' | 'no_payment' | null;
  // Removed: onFinalDeliveryWeightChange and finalDeliveryWeights props
}

export const PaymentConfirmationModal: React.FC<PaymentConfirmationModalProps> = ({
  order,
  onClose,
  onConfirm,
  onPrintBill,
  loading,
  is_on_demand = false,
  paymentError = null,
  allowPartialPayment = true,
  isSubsequentPayment = false,
  orderDeliveryDate = null,
  initialPaymentStatus = null,
  // Removed: onFinalDeliveryWeightChange and finalDeliveryWeights props
}) => {
  const [error, setError] = useState<string | null>(null)
  const [vatRate, setVatRate] = useState(0.18)
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeDate, setChequeDate] = useState('');
  const [chequeDateError, setChequeDateError] = useState<string | null>(null);

  const [internalPaymentMethod, setInternalPaymentMethod] = useState<PaymentMethodType | null>(null);
  const [internalPaymentCollectedAmount, setInternalPaymentCollectedAmount] = useState<number | ''>('');

  // Removed: internalFinalDeliveryWeights state

  // Removed: isChickenProduct helper function

  // Removed: useEffect for initializing weights

  // Function to calculate total amount
  const calculateTotalAmount = () => {
    if (is_on_demand) {
      return (order as OnDemandOrder).total_amount;
    } else {
      // Use the order's total_amount directly from database
      // It already includes final weight calculations if weights were entered
      return (order as Order).total_amount;
    }
  };

  const totalAmount = calculateTotalAmount();
  const orderAsOrder = order as Order;
  const onDemandOrderAsOrder = order as OnDemandOrder;

  // Correctly calculate currentCollected based on order type and whether it's a subsequent payment
  // For on-demand, if it's a subsequent payment, use the collected_amount from the order object.
  // If it's the initial payment, previouslyCollected is 0.
  const currentCollected = is_on_demand
    ? (isSubsequentPayment ? (onDemandOrderAsOrder.collected_amount || 0) : 0)
    : (orderAsOrder.collected_amount || 0);

  const totalOrderAmount = is_on_demand ? totalAmount : (orderAsOrder.total_amount || 0);
  const remainingDue = totalOrderAmount - currentCollected;

  useEffect(() => {
    if (initialPaymentStatus === 'full') {
      setInternalPaymentCollectedAmount(totalAmount);
      setInternalPaymentMethod('Cash');
    } else if (initialPaymentStatus === 'partial') {
      setInternalPaymentCollectedAmount('');
      setInternalPaymentMethod(null);
    } else if (initialPaymentStatus === 'no_payment') {
      setInternalPaymentCollectedAmount(0);
      setInternalPaymentMethod('Net');
    } else if (isSubsequentPayment) {
      setInternalPaymentCollectedAmount('');
      setInternalPaymentMethod(null);
    } else {
      setInternalPaymentCollectedAmount(totalAmount);
      setInternalPaymentMethod('Cash');
    }
  }, [initialPaymentStatus, totalAmount, isSubsequentPayment]);

  useEffect(() => {
    const fetchVatRate = async () => {
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('vat_rate')
          .maybeSingle();

        if (error) throw error;
        setVatRate(data?.vat_rate || 0.18);
      } catch (err) {
        console.error('Error fetching VAT rate, using default:', err);
        setVatRate(0.18);
      }
    };
    fetchVatRate();
  }, []);

  useEffect(() => {
    if (internalPaymentMethod === 'Cheque' && chequeDate && orderDeliveryDate) {
      const deliveryDate = new Date(orderDeliveryDate);
      const selectedChequeDate = new Date(chequeDate);

      deliveryDate.setHours(0, 0, 0, 0);
      selectedChequeDate.setHours(0, 0, 0, 0);

      const fourteenDaysAfterDelivery = new Date(deliveryDate);
      fourteenDaysAfterDelivery.setDate(deliveryDate.getDate() + 14);

      if (selectedChequeDate > fourteenDaysAfterDelivery) {
        setChequeDateError(`Cheque date cannot be more than 14 days after delivery date (${new Date(orderDeliveryDate).toLocaleDateString()}).`);
      } else {
        setChequeDateError(null);
      }
    } else {
      setChequeDateError(null);
    }
  }, [chequeDate, orderDeliveryDate, internalPaymentMethod]);

  // Removed: handleFinalDeliveryWeightChange function

  const handleConfirmAndPrint = async () => {
    setError(null);

    if (internalPaymentMethod === null || internalPaymentMethod === '') {
      setError('Please select a payment method.');
      return;
    }

    if (internalPaymentMethod === 'Cheque') {
      if (!chequeNumber.trim()) {
        setError('Cheque number is required.');
        return;
      }
      if (!chequeDate) {
        setError('Cheque date is required.');
        return;
      }
      if (chequeDateError) {
        setError(chequeDateError);
        return;
      }
    }

    let newlyCollectedAmount = Number(internalPaymentCollectedAmount);

    if (initialPaymentStatus !== 'no_payment' && (isNaN(newlyCollectedAmount) || newlyCollectedAmount <= 0)) {
      setError('Please enter a valid positive amount.');
      return;
    }

    if (initialPaymentStatus === 'no_payment') {
      newlyCollectedAmount = 0;
    }

    if (isSubsequentPayment) {
      if (newlyCollectedAmount > remainingDue) {
        setError(`Collected amount cannot exceed remaining balance of ${formatCurrency(remainingDue)}.`);
        return;
      }
    } else {
      if (newlyCollectedAmount > totalOrderAmount) {
        setError(`Collected amount cannot exceed total order amount of ${formatCurrency(totalOrderAmount)}.`);
        return;
      }
    }

    try {
      const intendedStatus = (() => {
        if (is_on_demand) {
          const totalCollectedAfterThisTransaction = currentCollected + newlyCollectedAmount;
          if (totalCollectedAfterThisTransaction >= totalOrderAmount) {
            return 'fully_paid';
          } else if (totalCollectedAfterThisTransaction > 0) {
            return 'partially_paid';
          } else {
            return 'unpaid';
          }
        }
        
        const totalAfterPayment = currentCollected + newlyCollectedAmount;
        if (totalAfterPayment >= totalOrderAmount) {
          return 'Completed' as Order['status'];
        } else if (totalAfterPayment > 0) {
          return 'Delivered - Payment Partially Collected' as Order['status'];
        } else {
          return 'Delivered - Payment Not Collected' as Order['status'];
        }
      })();
      
      // Extract final delivery weights from order items for printing
      const finalWeightsToPass: Record<string, number> = {};
      if (!is_on_demand && (order as Order).order_items) {
        (order as Order).order_items.forEach(item => {
          if (item.final_delivery_weight_kg && item.final_delivery_weight_kg > 0) {
            finalWeightsToPass[item.id] = item.final_delivery_weight_kg;
          }
        });
      }
      
      const generatedReceiptNo = await onConfirm(
        order.id,
        internalPaymentMethod as PaymentMethodType,
        newlyCollectedAmount,
        isSubsequentPayment,
        intendedStatus as any,
        internalPaymentMethod === 'Cheque' ? chequeNumber : undefined,
        internalPaymentMethod === 'Cheque' ? chequeDate : undefined,
        finalWeightsToPass // Pass final delivery weights
      );
      
      // For on-demand orders, calculate total collected from payment history if available
      let previousCollected = currentCollected;
      if (is_on_demand) {
        // Use the order's collected_amount directly for on-demand orders
        previousCollected = (order as OnDemandOrder).collected_amount || 0;
      } else if ((order as Order & { on_demand_order_payments?: OnDemandOrderPayment[] }).on_demand_order_payments) {
        const payments = (order as Order & { on_demand_order_payments?: OnDemandOrderPayment[] }).on_demand_order_payments || [];
        previousCollected = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
      }
      
      const totalCollectedAfterTransaction = previousCollected + newlyCollectedAmount;
      const remainingBalanceAfterTransaction = totalOrderAmount - totalCollectedAfterTransaction;
      
      // [FIXED] Update payment status text calculation logic with more explicit conditions
      const paymentStatusText = (() => {
        // Case 1: No payment collected at all
        if (newlyCollectedAmount === 0 && previousCollected === 0) {
          return 'Unpaid';
        }
        
        // Case 2: Order is completely paid (within margin of floating point errors)
        if (totalCollectedAfterTransaction >= totalOrderAmount - 0.01) {
          return 'Fully Paid';
        }
        
        // Case 3: Partial payment made
        return 'Partially Paid';
      })();
      
      // Calculate payment summary values
      let subtotal = 0;
      let discountAmount = 0;
      let vatAmount = 0;
      let grandTotal = 0;
      
      // Prepare order object with correct product_details for printing
      let orderForPrinting = order;
      
      if (is_on_demand) {
        const onDemandOrder = order as OnDemandOrder;
        subtotal = onDemandOrder.subtotal || 0;
        discountAmount = onDemandOrder.discount_amount || 0;
        vatAmount = onDemandOrder.vat_amount || 0;
        grandTotal = onDemandOrder.total_amount || 0;
      } else {
        const regularOrder = order as Order;
        // Use values from order (already calculated with final weights if applicable)
        subtotal = regularOrder.total_amount - regularOrder.vat_amount;
        vatAmount = regularOrder.vat_amount || 0;
        grandTotal = regularOrder.total_amount || 0;
        discountAmount = 0;
        
        // For regular orders, ensure the order object has the correct product_details with quantity_sold
        // The order object should already contain this data from the consolidated order with proper quantities
        orderForPrinting = {
          ...order,
          // Ensure product_details is available with correct quantity_sold values
          // This assumes the parent component passed the order with proper product_details
        } as Order;
      }
      
      // [FIXED] Add debug logging for payment calculations
      console.log('Payment Debug:', {
        previousCollected,
        newlyCollectedAmount,
        totalOrderAmount,
        totalCollectedAfterTransaction,
        remainingBalanceAfterTransaction
      });
      
      // [ADDED] Detailed logging for payment status calculation
      console.log('Payment Status Calculation:', {
        paymentStatusText,
        totalCollectedAfterTransaction,
        totalOrderAmount,
        comparison: totalCollectedAfterTransaction >= totalOrderAmount - 0.01,
        is_on_demand,
        initialPaymentStatus,
        newlyCollectedAmount,
        intendedStatus // [ADDED] Log intendedStatus to verify alignment
      });
      
      // [ADDED] Verify alignment between intendedStatus and paymentStatusText
      console.log('Status Alignment Check:', {
        intendedStatus,
        paymentStatusText,
        isAligned: (
          (intendedStatus === 'fully_paid' && paymentStatusText === 'Fully Paid') ||
          (intendedStatus === 'partially_paid' && paymentStatusText === 'Partially Paid') ||
          (intendedStatus === 'unpaid' && paymentStatusText === 'Unpaid') ||
          (!is_on_demand && intendedStatus === 'Completed' && paymentStatusText === 'Fully Paid') ||
          (!is_on_demand && intendedStatus === 'Delivered - Payment Partially Collected' && paymentStatusText === 'Partially Paid') ||
          (!is_on_demand && intendedStatus === 'Delivered - Payment Not Collected' && paymentStatusText === 'Unpaid')
        )
      });
      
      onPrintBill(
        orderForPrinting, // Use the prepared order object with correct product_details
        internalPaymentMethod as PaymentMethodType,
        generatedReceiptNo,
        newlyCollectedAmount,
        previousCollected,
        totalCollectedAfterTransaction,
        remainingBalanceAfterTransaction,
        paymentStatusText,
        subtotal,
        discountAmount,
        vatAmount,
        grandTotal,
        finalWeightsToPass // Pass final delivery weights to print bill
      );
      onClose()
    } catch (err: any) {
      console.error('Error confirming payment or printing:', err)
      setError(err.message || 'Failed to confirm payment and print bill.')
    }
  }

  const handleCollectedAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value === '') {
      setInternalPaymentCollectedAmount('')
      return
    }
    const amount = parseFloat(value)
    if (!isNaN(amount) && amount >= 0) {
      setInternalPaymentCollectedAmount(amount)
    }
  }

  // Removed: chickenProducts variable

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Confirm Payment & Print Bill</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-4 space-y-2 p-4 bg-gray-50 rounded-lg">
          <p className="text-gray-700 flex justify-between">
            <span>{is_on_demand ? 'On-Demand Order ID:' : 'Order ID:'}</span>
            <span className="font-medium">
              {is_on_demand
                ? (order as OnDemandOrder).on_demand_order_display_id || 'PENDING'
                : (order as Order).order_display_id}
            </span>
          </p>

          {is_on_demand ? (
            <p className="text-gray-700 flex justify-between">
              <span>Customer:</span>
              <span className="font-medium">
                {(order as OnDemandOrder & { customer_details?: Customer }).customer_name ||
                  (order as OnDemandOrder & { customer_details?: Customer }).customer_details?.name ||
                  'N/A'}
              </span>
            </p>
          ) : (
            'customers' in order && (
              <p className="text-gray-700 flex justify-between">
                <span>Customer:</span>
                <span className="font-medium">{(order as Order).customers?.name || 'N/A'}</span>
              </p>
            )
          )}

          {!is_on_demand && (order as Order).is_vat_applicable && (
            <>
              <p className="text-gray-700 flex justify-between">
                <span>Subtotal:</span>
                <span className="font-medium">{formatCurrency(((order as Order).total_amount - (order as Order).vat_amount))}</span>
              </p>
              <p className="text-gray-700 flex justify-between">
                <span>VAT ({(vatRate * 100).toFixed(0)}%):</span>
                <span className="font-medium">{formatCurrency((order as Order).vat_amount)}</span>
              </p>
            </>
          )}
          <p className="text-gray-700 flex justify-between">
            <span>Total Amount:</span>
            <span className="font-medium text-green-600">{formatCurrency(totalAmount)}</span>
          </p>

          {isSubsequentPayment && (
            <>
              <p className="text-gray-700 flex justify-between">
                <span>Previously Collected:</span>
                <span className="font-medium">{formatCurrency(currentCollected)}</span>
              </p>
              <p className="text-gray-700 flex justify-between">
                <span>Remaining Due:</span>
                <span className="font-medium text-red-600">{formatCurrency(remainingDue)}</span>
              </p>
            </>
          )}
        </div>

        {/* Removed: Final Delivery Weights Section */}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {isSubsequentPayment ? 'Amount to Collect Now *' : 'Collected Amount *'}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">Rs.</span>
            <input
              type="number"
              step="0.01"
              min="0"
              max={isSubsequentPayment ? remainingDue : totalAmount}
              value={internalPaymentCollectedAmount}
              onChange={handleCollectedAmountChange}
              disabled={initialPaymentStatus === 'no_payment' || (is_on_demand && initialPaymentStatus === 'full')}
              placeholder="0.00"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
          <div className="flex justify-between text-sm text-gray-500 mt-1">
            <span>
              {isSubsequentPayment
                ? 'Enter amount customer is paying now'
                : 'Enter amount collected from customer'}
            </span>
            <span>
              Max:{' '}
              {isSubsequentPayment
                ? formatCurrency(remainingDue)
                : formatCurrency(totalAmount)}
            </span>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Payment Method *
          </label>
          <div className="grid grid-cols-2 gap-4">
            {STATIC_PAYMENT_METHODS.map((method) => (
              <label key={method} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  value={method}
                  checked={internalPaymentMethod === method}
                  onChange={() => {
                    setInternalPaymentMethod(method as PaymentMethodType);
                    if (method !== 'Cheque') {
                      setChequeNumber('');
                      setChequeDate('');
                      setChequeDateError(null);
                    }
                  }}
                  className="form-radio h-4 w-4 text-red-600 focus:ring-red-500"
                  disabled={initialPaymentStatus === 'no_payment'}
                />
                <span className="text-gray-700">{method}</span>
              </label>
            ))}
          </div>
        </div>

        {internalPaymentMethod === 'Cheque' && (
          <div className="mb-4 p-4 border border-blue-200 rounded-lg bg-blue-50">
            <h3 className="text-md font-semibold text-blue-800 mb-3">Cheque Details</h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="chequeNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  Cheque Number *
                </label>
                <input
                  type="text"
                  id="chequeNumber"
                  value={chequeNumber}
                  onChange={(e) => setChequeNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter cheque number"
                  required
                />
              </div>
              <div>
                <label htmlFor="chequeDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Cheque Date *
                </label>
                <input
                  type="date"
                  id="chequeDate"
                  value={chequeDate}
                  onChange={(e) => setChequeDate(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${chequeDateError ? 'border-red-500' : 'border-gray-300'}`}
                  required
                />
                {chequeDateError && (
                  <p className="text-sm text-red-600 mt-1">{chequeDateError}</p>
                )}
                {orderDeliveryDate && (
                  <p className="text-xs text-gray-500 mt-1">
                    Order delivery date: {new Date(orderDeliveryDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {(error || paymentError || chequeDateError) && (
          <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">
            {error || paymentError || chequeDateError}
          </div>
        )}

        <div className="flex space-x-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            disabled={loading}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirmAndPrint}
            disabled={
              loading ||
              !internalPaymentMethod ||
              (initialPaymentStatus !== 'no_payment' && (Number(internalPaymentCollectedAmount) <= 0 || isNaN(Number(internalPaymentCollectedAmount)))) ||
              (internalPaymentMethod === 'Cheque' && (!chequeNumber.trim() || !chequeDate || chequeDateError !== null))
            }
            className="flex-1 flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {loading ? (
              'Processing...'
            ) : (
              <>
                <Printer className="w-4 h-4 mr-2" />
                Confirm & Print Bill
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}