// src/components/OngoingOnDemandOrders.tsx
import React, { useState, useEffect } from 'react';
import { Search, FileText } from 'lucide-react';
import { supabase, OnDemandOrder, OnDemandOrderPayment, Customer } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency } from '../utils/formatters';
import { PaymentConfirmationModal } from './PaymentConfirmationModal';
import { OnDemandBillPrintLayout } from './OnDemandBillPrintLayout';
import { createRoot } from 'react-dom/client';
import { PaymentMethodType } from '../utils/staticPaymentMethods';
import { isMobileOrTablet } from '../utils/deviceDetection';
import { validateAndPrepareHTML, validatePDFBlob } from '../lib/mprintService';

interface ConsolidatedOnDemandOrder {
  id: string;
  on_demand_order_display_id: string;
  total_amount: number;
  collected_amount: number;
  payment_status: 'unpaid' | 'partially_paid' | 'fully_paid';
  sale_date: string;
  customer_name: string;
  customer_phone: string | null;
  customer_type: string;
  existing_customer_id: string | null;
  sales_rep_id: string;
  sales_rep?: { username: string };
  product_details: Array<{
    id: string;
    products: { id: string; name: string; unit_type: string; product_id: string; sku: string };
    sold_quantity: number;
    selling_price: number;
    total_amount: number;
  }>;
  on_demand_order_payments?: OnDemandOrderPayment[];
  customer_details?: Customer;
  receipt_no: string; // Added: Store receipt_no for grouping
  order_ids: string[]; // Added: Store all individual order IDs
}

export const OngoingOnDemandOrders: React.FC = () => {
  const { user, isOnline } = useAuth();
  const [ongoingOrders, setOngoingOrders] = useState<ConsolidatedOnDemandOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<ConsolidatedOnDemandOrder | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false); // For PaymentConfirmationModal

  useEffect(() => {
    if (user) {
      fetchOngoingOrders();
    }
  }, [user, isOnline]);

  const processAndGroupOngoingOrders = (orders: any[]): ConsolidatedOnDemandOrder[] => {
    // Group orders by receipt_no (which acts as the consolidated order identifier)
    const orderGroups = new Map<string, any[]>();
    
    orders.forEach(order => {
      const receiptNo = order.receipt_no;
      if (!orderGroups.has(receiptNo)) {
        orderGroups.set(receiptNo, []);
      }
      orderGroups.get(receiptNo)!.push(order);
    });

    // Create consolidated orders from each group
    const consolidatedOrders: ConsolidatedOnDemandOrder[] = [];
    
    orderGroups.forEach((groupOrders, receiptNo) => {
      if (groupOrders.length === 0) return;

      // Use the first order as the base for shared properties
      const firstOrder = groupOrders[0];
      
      // Calculate aggregated totals
      let totalAmount = 0;
      let collectedAmount = 0;
      const allProductDetails: any[] = [];
      const allPayments: any[] = [];
      const allOrderIds: string[] = [];
      
      groupOrders.forEach(order => {
        totalAmount += order.total_amount || 0;
        collectedAmount += order.collected_amount || 0;
        allOrderIds.push(order.id); // Store all individual order IDs
        
        // Collect all product details
        if (order.on_demand_assignment_items) {
          // Directly push the single item's details to the array
          allProductDetails.push({
            id: order.on_demand_assignment_items.id,
            products: order.on_demand_assignment_items.products,
            sold_quantity: order.quantity_sold,  // Use order's quantity, not assignment's cumulative quantity
            selling_price: order.selling_price, // Take selling_price from the order object
            total_amount: (order.quantity_sold || 0) * (order.selling_price || 0), // Use order.selling_price
          });
        }
        
        // Collect all payments
        if (order.on_demand_order_payments) {
          allPayments.push(...order.on_demand_order_payments);
        }
      });

      // Determine overall payment status
      // [FIXED] Updated payment status calculation with floating-point tolerance
      let paymentStatus: 'unpaid' | 'partially_paid' | 'fully_paid' = 'unpaid';
      if (collectedAmount >= totalAmount - 0.01) {
        paymentStatus = 'fully_paid';
      } else if (collectedAmount > 0) {
        paymentStatus = 'partially_paid';
      }

      // Create consolidated order
      const consolidatedOrder: ConsolidatedOnDemandOrder = {
        id: firstOrder.id,
        on_demand_order_display_id: firstOrder.on_demand_order_display_id,
        total_amount: totalAmount,
        collected_amount: collectedAmount,
        payment_status: paymentStatus,
        sale_date: firstOrder.sale_date,
        customer_name: firstOrder.customer_name,
        customer_phone: firstOrder.customer_phone,
        customer_type: firstOrder.customer_type,
        existing_customer_id: firstOrder.existing_customer_id,
        sales_rep_id: firstOrder.sales_rep_id,
        sales_rep: firstOrder.sales_rep,
        product_details: allProductDetails,
        on_demand_order_payments: allPayments,
        customer_details: firstOrder.customers ? {
          id: firstOrder.customers.id,
          name: firstOrder.customers.name,
          phone_number: firstOrder.customers.phone_number || firstOrder.customer_phone || '',
          address: firstOrder.customers.address || '',
          email: firstOrder.customers.email || '',
          vat_status: firstOrder.customers.vat_status || 'Non-VAT',
          tin_number: firstOrder.customers.tin_number || '',
          customer_display_id: '',
          payment_category: '',
          created_at: ''
        } : undefined,
        receipt_no: receiptNo, // Store receipt_no for grouping
        order_ids: allOrderIds, // Store all individual order IDs
      };
      
      consolidatedOrders.push(consolidatedOrder);
    });

    return consolidatedOrders;
  };

  const fetchOngoingOrders = async () => {
    setLoading(true);
    let cacheKey = `ongoing_on_demand_orders_${user?.id}_${user?.role}`;
    try {
      if (!isOnline) {
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
          setOngoingOrders(JSON.parse(cachedData));
          setLoading(false);
          return;
        }
      }

      // Start building the query
      let query = supabase
        .from('on_demand_orders')
        .select(`
          id, 
          on_demand_order_display_id, 
          total_amount, 
          collected_amount, 
          payment_status, 
          sale_date,
          customer_name, 
          customer_phone, 
          customer_type, 
          existing_customer_id, 
          selling_price,
          quantity_sold,
          receipt_no,
          sales_rep_id,
          sales_rep:users!on_demand_orders_sales_rep_id_fkey(username),
          customers(id, name, phone_number, address, email, vat_status, tin_number),
          on_demand_assignment_items(
            id,
            products(id, name, unit_type, product_id, sku),
            sold_quantity
          ),
          on_demand_order_payments(id, amount, payment_method, payment_date, receipt_no, collected_by, cheque_number, cheque_date, users!on_demand_order_payments_collected_by_fkey(username))
        `)
        .in('payment_status', ['unpaid', 'partially_paid'])
        .order('sale_date', { ascending: false });

      // Apply sales_rep_id filter only if user is a Sales Rep
      if (user?.role === 'Sales Rep') {
        query = query.eq('sales_rep_id', user?.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Process and group orders by receipt_no
      const processedOrders = processAndGroupOngoingOrders(data || []);

      localStorage.setItem(cacheKey, JSON.stringify(processedOrders));
      setOngoingOrders(processedOrders);
    } catch (err) {
      console.error('Error fetching ongoing on-demand orders:', err);
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        setOngoingOrders(JSON.parse(cachedData));
      } else {
        setOngoingOrders([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCollectPayment = (order: ConsolidatedOnDemandOrder) => {
    setSelectedOrderForPayment(order);
  };

  const handlePrintBill = async (
    orderToPrint: ConsolidatedOnDemandOrder,
    paymentMethodToPrint: PaymentMethodType,
    receiptNoToPrint: string,
    transactionAmount: number,
    previouslyCollected: number,
    totalCollected: number,
    remainingBalance: number,
    paymentStatusText: string
  ) => {
    const printMethod = isMobileOrTablet() ? 'mprint' : 'local_print';
    
    try {
      // Update all orders with the same receipt_no
      const { error: updateError } = await supabase
        .from('on_demand_orders')
        .update({ bill_print_method: printMethod })
        .in('id', orderToPrint.order_ids);

      if (updateError) {
        console.error('Error updating bill print method:', updateError);
      }
    } catch (err) {
      console.error('Error updating bill print method:', err);
    }

    // Handle printing based on device type
    if (isMobileOrTablet()) {
      // MOBILE: Generate PDF HTML and download for mPrint
      try {
        console.log('[OnDemand Print Mobile] Starting PDF generation');
        
        // Import the helper function
        const { generateOnDemandBillHTML, downloadBillForMprint, generateBillPDF } = await import('../lib/mprintService');
        
        // Step 1: Generate HTML string (no database operations)
        const billHtml = generateOnDemandBillHTML({
          order: orderToPrint,
          paymentMethod: paymentMethodToPrint,
          receiptNo: receiptNoToPrint,
          transactionAmount,
          previouslyCollected,
          totalCollected,
          remainingBalance,
          paymentStatusText,
        });

        // Step 2: Validate HTML before PDF generation
        const htmlValidation = validateAndPrepareHTML(billHtml);
        if (!htmlValidation.isValid) {
          console.error('[OnDemand Print Mobile] HTML validation failed:', htmlValidation.errors);
          alert('Bill content is invalid. Using local print instead.');
          openLocalPrintWindow(
            orderToPrint,
            paymentMethodToPrint,
            receiptNoToPrint,
            transactionAmount,
            previouslyCollected,
            totalCollected,
            remainingBalance,
            paymentStatusText
          );
          return;
        }

        console.log('[OnDemand Print Mobile] HTML valid, length:', billHtml.length, 'bytes');

        // Step 3: Convert HTML to PDF with timeout protection
        const pdfPromise = generateBillPDF(billHtml, `on-demand-${receiptNoToPrint}`);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('PDF generation timeout')), 15000)
        );

        const pdfBlob = await Promise.race([pdfPromise, timeoutPromise]) as Blob;

        // Step 4: Validate PDF blob
        const pdfValidation = validatePDFBlob(pdfBlob);
        console.log('[OnDemand Print Mobile] PDF validation - Size:', pdfValidation.sizeKb, 'KB, Valid:', pdfValidation.isValid);

        if (!pdfValidation.isValid) {
          console.warn('[OnDemand Print Mobile] PDF validation failed:', pdfValidation.reason);
          // Fallback to local print if PDF is blank
          console.log('[OnDemand Print Mobile] Falling back to local print');
          openLocalPrintWindow(
            orderToPrint,
            paymentMethodToPrint,
            receiptNoToPrint,
            transactionAmount,
            previouslyCollected,
            totalCollected,
            remainingBalance,
            paymentStatusText
          );
          return;
        }

        // Step 5: Download for mPrint
        await downloadBillForMprint(pdfBlob, `on-demand-${receiptNoToPrint}`);
        console.log('[OnDemand Print Mobile] PDF downloaded successfully');
        
        alert('Bill PDF downloaded successfully. Please open with mPrint app to print.');
      } catch (err: any) {
        console.error('[OnDemand Print Mobile] Error:', err.message || err);
        console.log('[OnDemand Print Mobile] Falling back to local print due to error');
        alert('Failed to generate PDF. Using local print instead.');
        
        // Fallback to local print if PDF generation fails
        openLocalPrintWindow(
          orderToPrint,
          paymentMethodToPrint,
          receiptNoToPrint,
          transactionAmount,
          previouslyCollected,
          totalCollected,
          remainingBalance,
          paymentStatusText
        );
      }
    } else {
      // DESKTOP: Use existing local print window behavior
      openLocalPrintWindow(
        orderToPrint,
        paymentMethodToPrint,
        receiptNoToPrint,
        transactionAmount,
        previouslyCollected,
        totalCollected,
        remainingBalance,
        paymentStatusText
      );
    }
  };

  const openLocalPrintWindow = (
    orderToPrint: ConsolidatedOnDemandOrder,
    paymentMethodToPrint: PaymentMethodType,
    receiptNoToPrint: string,
    transactionAmount: number,
    previouslyCollected: number,
    totalCollected: number,
    remainingBalance: number,
    paymentStatusText: string
  ) => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (printWindow) {
      const root = createRoot(printWindow.document.body);
      root.render(
        <OnDemandBillPrintLayout
          order={{
            ...orderToPrint as any,
            sales_rep_username: orderToPrint.sales_rep?.username,
            product_details: orderToPrint.product_details
          }}
          paymentMethod={paymentMethodToPrint}
          receiptNo={receiptNoToPrint}
          transactionAmount={transactionAmount}
          previouslyCollected={previouslyCollected}
          totalCollected={totalCollected}
          remainingBalance={remainingBalance}
          paymentStatusText={paymentStatusText}
        />
      );
      setTimeout(() => {
        printWindow.print();
      }, 500);
    } else {
      alert('Please allow pop-ups to print the receipt.');
    }
  };

  const handleConfirmPayment = async (
    onDemandOrderId: string,
    paymentMethod: PaymentMethodType,
    newlyCollectedAmount: number,
    isSubsequentPayment: boolean,
    intendedStatus: 'fully_paid' | 'partially_paid' | 'unpaid',
    chequeNumber?: string,
    chequeDate?: string
  ): Promise<string> => {
    setPaymentLoading(true);
    try {
      // Find the consolidated order to get receipt_no and all order IDs
      const consolidatedOrder = ongoingOrders.find(order => order.id === onDemandOrderId);
      if (!consolidatedOrder) {
        throw new Error('Order not found');
      }

      const { receipt_no, order_ids } = consolidatedOrder;

      // Fetch ALL orders with the same receipt_no
      const { data: allOrders, error: fetchError } = await supabase
        .from('on_demand_orders')
        .select('id, collected_amount, total_amount')
        .in('id', order_ids);

      if (fetchError) throw fetchError;

      if (!allOrders || allOrders.length === 0) {
        throw new Error('No orders found with the given receipt number');
      }

      // Calculate total amount and collected amount across all orders
      let totalAmount = 0;
      let currentCollectedAmount = 0;
      
      allOrders.forEach(order => {
        totalAmount += order.total_amount || 0;
        currentCollectedAmount += order.collected_amount || 0;
      });

      // Calculate proportional distribution for each order
      const orderUpdates = allOrders.map(order => {
        const orderProportion = (order.total_amount || 0) / totalAmount;
        const orderNewCollectedAmount = (order.collected_amount || 0) + (newlyCollectedAmount * orderProportion);
        
        // [FIXED] Updated payment status calculation with floating-point tolerance and proper unpaid case handling
        return {
          id: order.id,
          collected_amount: orderNewCollectedAmount,
          payment_status: orderNewCollectedAmount >= order.total_amount - 0.01 
            ? 'fully_paid' 
            : orderNewCollectedAmount > 0 
              ? 'partially_paid' 
              : 'unpaid'
        };
      });

      // Verify the sum of distributed amounts equals the total newly collected amount
      const totalDistributedAmount = orderUpdates.reduce((sum, update) => 
        sum + (update.collected_amount - (allOrders.find(o => o.id === update.id)?.collected_amount || 0)), 0);
      
      // Handle rounding differences
      if (Math.abs(totalDistributedAmount - newlyCollectedAmount) > 0.01) {
        // Adjust the last order to account for rounding differences
        const difference = newlyCollectedAmount - totalDistributedAmount;
        if (orderUpdates.length > 0) {
          orderUpdates[orderUpdates.length - 1].collected_amount += difference;
        }
      }

      // Calculate new consolidated totals for state update
      const newCollectedAmount = currentCollectedAmount + newlyCollectedAmount;
      // [FIXED] Updated payment status calculation with floating-point tolerance and proper unpaid case handling
      const newPaymentStatus = newCollectedAmount >= totalAmount - 0.01 
        ? 'fully_paid' 
        : newCollectedAmount > 0 
          ? 'partially_paid' 
          : 'unpaid';

      // Update State Before Database Call (Change 4)
      // Proactively remove fully paid orders from UI for immediate visual feedback
      if (newPaymentStatus === 'fully_paid') {
        setOngoingOrders(prevOrders => 
          prevOrders.filter(order => order.receipt_no !== receipt_no)
        );
      } else {
        // Update partially paid orders in state
        setOngoingOrders(prevOrders => 
          prevOrders.map(order => {
            if (order.receipt_no === receipt_no) {
              return {
                ...order,
                collected_amount: newCollectedAmount,
                payment_status: newPaymentStatus,
              };
            }
            return order;
          })
        );
      }

      // Update ALL order rows with their proportional amounts
      const updatePromises = orderUpdates.map(update =>
        supabase
          .from('on_demand_orders')
          .update({
            collected_amount: update.collected_amount,
            payment_status: update.payment_status,
          })
          .eq('id', update.id)
      );

      const updateResults = await Promise.all(updatePromises);
      
      // Check for any update errors
      const updateErrors = updateResults.filter(result => result.error);
      if (updateErrors.length > 0) {
        console.error('Errors updating orders:', updateErrors);
        throw new Error('Failed to update some orders');
      }

      // Generate a new receipt number for this payment transaction
      const { data: generatedReceiptNoData, error: receiptNoError } = await supabase.rpc('generate_on_demand_receipt_no');
      if (receiptNoError) throw receiptNoError;
      const transactionReceiptNo = generatedReceiptNoData;

      // Insert payment record using the consolidated receipt_no
      const { error: paymentInsertError } = await supabase
        .from('on_demand_order_payments')
        .insert({
          on_demand_order_id: onDemandOrderId, // Still store the selected order ID for reference
          amount: newlyCollectedAmount,
          payment_method: paymentMethod,
          receipt_no: transactionReceiptNo,
          collected_by: user!.id,
          cheque_number: paymentMethod === 'Cheque' ? chequeNumber : null,
          cheque_date: paymentMethod === 'Cheque' ? chequeDate : null,
        });

      if (paymentInsertError) console.error('Error inserting on-demand payment record:', paymentInsertError);

      // Filter Out Fully Paid Orders from State (Change 1)
      // Remove orders that transitioned to 'fully_paid' from ongoingOrders
      setOngoingOrders(prevOrders => 
        prevOrders.filter(order => order.receipt_no !== receipt_no || order.payment_status !== 'fully_paid')
      );

      // Refetch Ongoing Orders After Full Payment (Change 2)
      // If the order is now fully_paid, refresh the list to ensure database and UI sync
      if (newPaymentStatus === 'fully_paid') {
        await fetchOngoingOrders();
      }

      // Clear Cache for Completed Orders Section (Change 3)
      // Force OnDemandOrders.tsx to refetch and display the newly completed order
      const completedOrdersCacheKey = `on_demand_orders_data_${user?.id || 'all'}`;
      localStorage.removeItem(completedOrdersCacheKey);

      return transactionReceiptNo;

    } catch (err: any) {
      console.error('Error confirming subsequent payment:', err);
      // Re-fetch orders to restore correct state in case of error
      await fetchOngoingOrders();
      throw err;
    } finally {
      setPaymentLoading(false);
    }
  };

  const getPaymentStatusColor = (status: 'fully_paid' | 'partially_paid' | 'unpaid') => {
    switch (status) {
      case 'fully_paid': return 'bg-green-100 text-green-800';
      case 'partially_paid': return 'bg-yellow-100 text-yellow-800';
      case 'unpaid': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredOrders = ongoingOrders.filter(order =>
    order.on_demand_order_display_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.sales_rep?.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading ongoing orders...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Ongoing On-Demand Orders</h1>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search orders..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Ongoing Orders Found</h2>
          <p className="text-gray-600">All on-demand orders are fully paid or completed.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Mobile Card Layout */}
          <div className="block md:hidden">
            <div className="space-y-3">
              {filteredOrders.map((order) => (
                <div key={order.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center flex-1 min-w-0">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                        <FileText className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          Order {order.on_demand_order_display_id}
                        </h3>
                        <div className="flex items-center mt-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getPaymentStatusColor(order.payment_status || 'unpaid')}`}>
                            {order.payment_status?.replace('_', ' ') || 'Unpaid'}
                          </span>
                          {order.sales_rep?.username && (
                            <span className="ml-2 text-xs text-gray-500">
                              Sales Rep: {order.sales_rep.username}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleCollectPayment(order)}
                      className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                    >
                      Collect Payment
                    </button>
                  </div>
                  
                  <div className="space-y-1 text-xs ml-11">
                    <div className="flex items-start">
                      <span className="text-gray-500 font-medium w-16 flex-shrink-0">Customer:</span>
                      <span className="text-gray-700 flex-1">{order.customer_name}</span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-gray-500 font-medium w-16 flex-shrink-0">Products:</span>
                      <span className="text-gray-700 flex-1">
                        {order.product_details.map(p => `${p.products.name} (${p.sold_quantity} ${p.products.unit_type})`).join(', ')}
                      </span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-gray-500 font-medium w-16 flex-shrink-0">Total:</span>
                      <span className="text-gray-700 flex-1">{formatCurrency(order.total_amount)}</span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-gray-500 font-medium w-16 flex-shrink-0">Collected:</span>
                      <span className="text-gray-700 flex-1">{formatCurrency(order.collected_amount || 0)}</span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-gray-500 font-medium w-16 flex-shrink-0">Remaining:</span>
                      <span className="text-gray-700 flex-1">{formatCurrency(order.total_amount - (order.collected_amount || 0))}</span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-gray-500 font-medium w-16 flex-shrink-0">Date:</span>
                      <span className="text-gray-700 flex-1">{new Date(order.sale_date).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Desktop Table Layout */}
          <div className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Products</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Collected</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remaining</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sales Rep</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredOrders.map((order, index) => (
                    <tr key={order.id} className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-gray-100`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {order.on_demand_order_display_id}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.customer_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                        {order.product_details.map(p => (
                          <div key={p.id} className="mb-1 last:mb-0">
                            {p.products.name} ({p.sold_quantity} {p.products.unit_type}) @ {formatCurrency(p.selling_price)}
                          </div>
                        ))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(order.total_amount)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(order.collected_amount || 0)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(order.total_amount - (order.collected_amount || 0))}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(order.payment_status || 'unpaid')}`}>
                          {order.payment_status?.replace('_', ' ') || 'Unpaid'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.sales_rep?.username || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(order.sale_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleCollectPayment(order)}
                          className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                        >
                          Collect Payment
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {selectedOrderForPayment && (
        <PaymentConfirmationModal
          order={selectedOrderForPayment}
          onClose={() => setSelectedOrderForPayment(null)}
          onConfirm={handleConfirmPayment}
          onPrintBill={handlePrintBill}
          loading={paymentLoading}
          is_on_demand={true}
          isSubsequentPayment={true} // Indicate this is a subsequent payment
        />
      )}
    </div>
  );
};