// src/components/PaymentInformation.tsx
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase, Order, OnDemandOrder, OrderPayment, Product, Customer } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency } from '../utils/formatters';
import { DollarSign, Calendar, Filter, Search, FileText, Package, X, Eye } from 'lucide-react';
import { PaymentReceiptLayout } from './BillPrintLayout';
import { OnDemandBillPrintLayout } from './OnDemandBillPrintLayout';
import WeehenaLogo from '../assets/images/Weehena Logo(Ai) copy copy copy.png';

interface PaymentRecord {
  id: string;
  type: 'regular' | 'on_demand';
  display_id: string;
  customer_name: string;
  total_amount: number;
  collected_amount: number;
  remaining_balance: number;
  payment_status: 'fully_paid' | 'partially_paid' | 'unpaid';
  payment_method: string | null;
  date: string;
  sales_rep_username: string | null;
  customer_address?: string;
  customer_phone?: string;
  customer_email?: string;
  customer_vat_status?: string;
  customer_tin_number?: string;
  order_items_details?: Array<{
    id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    unit_type: string;
  }>;
  payment_history?: (OrderPayment & {
    collected_by_user?: string;
    cheque_number?: string; // Added for cheque details
    cheque_date?: string;   // Added for cheque details
  })[];
}

export const PaymentInformation: React.FC = () => {
  const { user, isOnline } = useAuth();
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'fully_paid' | 'partially_paid' | 'unpaid'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<PaymentRecord | null>(null);

  useEffect(() => {
    if (user?.role === 'Finance Admin') {
      fetchPaymentData();
    }
  }, [user, paymentStatusFilter, startDate, endDate]);

  const fetchPaymentData = async () => {
    console.log('PaymentInformation: Current user role:', user?.role);
    setLoading(true);
    setFetchError(null);
    const cacheKey = `payment_information_data_${paymentStatusFilter}_${startDate}_${endDate}`;

    if (!isOnline) {
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        setPaymentRecords(JSON.parse(cachedData));
        setLoading(false);
        return;
      }
    }

    try {
      // Fetch Regular Orders
      let regularOrdersQuery = supabase
        .from('orders')
        .select(`
          id, order_display_id, total_amount, collected_amount, payment_status, payment_method, created_at, vat_amount, is_vat_applicable,
          customers(name, address, phone_number, email, vat_status, tin_number),
          assigned_user:users!orders_assigned_to_fkey(username),
          order_items(id, quantity, price, products(name, unit_type)),
          order_payments(id, payment_date, amount, payment_method, receipt_no, collected_by, cheque_number, cheque_date) // ADDED cheque_number, cheque_date
        `);

      if (paymentStatusFilter !== 'all') {
        regularOrdersQuery = regularOrdersQuery.eq('payment_status', paymentStatusFilter);
      }
      if (startDate) {
        regularOrdersQuery = regularOrdersQuery.gte('created_at', startDate);
      }
      if (endDate) {
        regularOrdersQuery = regularOrdersQuery.lte('created_at', endDate + 'T23:59:59');
      }

      const { data: regularOrders, error: regularOrdersError } = await regularOrdersQuery;
      if (regularOrdersError) throw regularOrdersError;

      // Fetch On-Demand Orders
      let onDemandOrdersQuery = supabase
        .from('on_demand_orders')
        .select(`
          id, on_demand_order_display_id, customer_name, customer_phone, total_amount, payment_method, sale_date, quantity_sold, selling_price, payment_status, collected_amount,
          sales_rep:users!on_demand_orders_sales_rep_id_fkey(username),
          on_demand_assignment_items(assigned_quantity, sold_quantity, products(name, unit_type, product_id, sku)),
          on_demand_order_payments(id, payment_date, amount, payment_method, receipt_no, collected_by, cheque_number, cheque_date)
        `);

      if (paymentStatusFilter === 'fully_paid') {
        onDemandOrdersQuery = onDemandOrdersQuery.gt('total_amount', 0);
      } else if (paymentStatusFilter === 'partially_paid' || paymentStatusFilter === 'unpaid') {
        onDemandOrdersQuery = onDemandOrdersQuery.eq('total_amount', 0);
      }
      if (startDate) {
        onDemandOrdersQuery = onDemandOrdersQuery.gte('sale_date', startDate);
      }
      if (endDate) {
        onDemandOrdersQuery = onDemandOrdersQuery.lte('sale_date', endDate + 'T23:59:59');
      }

      const { data: onDemandOrders, error: onDemandOrdersError } = await onDemandOrdersQuery;
      if (onDemandOrdersError) throw onDemandOrdersError;

      const combinedRecords: PaymentRecord[] = [];

      regularOrders?.forEach((order: Order) => {
        const total = order.total_amount || 0;
        const collected = order.collected_amount || 0;
        const remaining = total - collected;
        const paymentStatus = order.payment_status || 'unpaid';

        combinedRecords.push({
          id: order.id,
          type: 'regular',
          display_id: order.order_display_id || 'N/A',
          customer_name: order.customers?.name || 'Unknown Customer',
          total_amount: total,
          collected_amount: collected,
          remaining_balance: remaining,
          payment_status: paymentStatus,
          payment_method: order.payment_method || null,
          date: order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A',
          sales_rep_username: order.assigned_user?.username || 'N/A',
          customer_address: order.customers?.address || 'N/A',
          customer_phone: order.customers?.phone_number || 'N/A',
          customer_email: order.customers?.email || 'N/A',
          customer_vat_status: order.customers?.vat_status || 'N/A',
          customer_tin_number: order.customers?.tin_number || 'N/A',
          order_items_details: order.order_items?.map(item => ({
            id: item.id,
            product_name: item.products?.name || 'N/A',
            quantity: item.quantity, // Ensure quantity is number
            unit_price: item.price,
            total_price: item.quantity * item.price,
            unit_type: item.products?.unit_type || 'Units'
          })) || [],
          payment_history: order.order_payments?.map((payment: any) => ({
            ...payment,
            collected_by_user: undefined, // Will be fetched separately if needed
            cheque_number: payment.cheque_number, // ADDED
            cheque_date: payment.cheque_date,     // ADDED
          })) || [], // Ensure payment_history is always an array
        });
      });

      onDemandOrders?.forEach((order: OnDemandOrder) => {
        const total = order.total_amount || 0;
        const orderItemsDetails = order.on_demand_assignment_items?.[0] ? [{
          product_name: order.on_demand_assignment_items[0].products?.name || 'N/A',
          quantity: order.quantity_sold,
          unit_price: order.selling_price,
          total_price: order.total_amount,
          unit_type: order.on_demand_assignment_items[0].products?.unit_type || 'Units'
        }] : [];

        combinedRecords.push({
          id: order.id,
          type: 'on_demand',
          display_id: order.on_demand_order_display_id || 'N/A',
          customer_name: order.customer_name || 'Unknown Customer',
          total_amount: total,
          collected_amount: order.collected_amount || 0,
          remaining_balance: total - (order.collected_amount || 0),
          payment_status: order.payment_status || 'unpaid',
          payment_method: order.payment_method || null,
          date: order.sale_date ? new Date(order.sale_date).toLocaleDateString() : 'N/A',
          sales_rep_username: order.sales_rep?.username || 'N/A',
          customer_phone: order.customer_phone || 'N/A',
          order_items_details: orderItemsDetails,
          payment_history: order.on_demand_order_payments?.map((payment: any) => ({
            ...payment,
            collected_by_user: undefined, // Will be fetched separately
            cheque_number: payment.cheque_number,
            cheque_date: payment.cheque_date,
          })) || [],
        });
      });

      // Fetch usernames for collected_by in payment history
      const regularOrderIdsWithPayments = combinedRecords
        .filter(record => record.type === 'regular' && record.payment_history && record.payment_history.length > 0)
        .map(record => record.id);
      
      if (regularOrderIdsWithPayments.length > 0) {
        const { data: paymentUsers, error: paymentUsersError } = await supabase
          .from('order_payments')
          .select(`
            id,
            collected_by,
            users!order_payments_collected_by_fkey(username)
          `)
          .in('order_id', regularOrderIdsWithPayments);
        
        if (!paymentUsersError && paymentUsers) {
          // Create a map of collected_by user ID to username
          const collectedByUserMap = new Map<string, string>();
          paymentUsers.forEach(payment => { // payment here is from the order_payments table, not the paymentUsers array
            if (payment.collected_by) {
              collectedByUserMap.set(payment.collected_by, payment.users?.username || 'N/A');
            }
          });
          
          // Update payment_history with usernames
          combinedRecords.forEach(record => {
            if (record.type === 'regular' && record.payment_history) {
              record.payment_history.forEach((payment: any) => { // Cast to any to access collected_by
                if (payment.collected_by) {
                  payment.collected_by_user = collectedByUserMap.get(payment.collected_by) || 'N/A';
                }
              });
            }
          });
        }
      }

      // Fetch usernames for collected_by in on-demand payment history
      const onDemandOrderIdsWithPayments = combinedRecords
        .filter(record => record.type === 'on_demand' && record.payment_history && record.payment_history.length > 0)
        .map(record => record.id);

      if (onDemandOrderIdsWithPayments.length > 0) {
        const { data: onDemandPaymentUsers, error: onDemandPaymentUsersError } = await supabase
          .from('on_demand_order_payments')
          .select(`
            id,
            collected_by,
            users!on_demand_order_payments_collected_by_fkey(username)
          `)
          .in('on_demand_order_id', onDemandOrderIdsWithPayments);
        
        if (!onDemandPaymentUsersError && onDemandPaymentUsers) {
          // Create a map of collected_by user ID to username
          const onDemandCollectedByUserMap = new Map<string, string>();
          onDemandPaymentUsers.forEach(payment => {
            if (payment.collected_by) {
              onDemandCollectedByUserMap.set(payment.collected_by, payment.users?.username || 'N/A');
            }
          });
          
          // Update payment_history with usernames for on-demand orders
          combinedRecords.forEach(record => {
            if (record.type === 'on_demand' && record.payment_history) {
              record.payment_history.forEach((payment: any) => {
                if (payment.collected_by) {
                  payment.collected_by_user = onDemandCollectedByUserMap.get(payment.collected_by) || 'N/A';
                }
              });
            }
          });
        }
      }

      // Sort by date descending
      combinedRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      localStorage.setItem(cacheKey, JSON.stringify(combinedRecords));
      setPaymentRecords(combinedRecords);
    } catch (error: any) {
      console.error('Error fetching payment data:', error);
      setFetchError(error.message || 'Failed to load payment information.');
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        setPaymentRecords(JSON.parse(cachedData));
      } else {
        setPaymentRecords([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Function to handle printing a specific payment receipt
  const handlePrintSpecificPaymentReceipt = async (
    orderRecord: PaymentRecord,
    specificPayment: OrderPayment & { collected_by_user?: string }
  ) => {
    const { data: fullOrderData, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        customers(*),
        order_items(id, quantity, price, products(name, unit_type)),
        assigned_user:users!orders_assigned_to_fkey(username) // Ensure assigned_user is fetched
      `)
      .eq('id', orderRecord.id)
      .single();

    if (orderError || !fullOrderData) {
      console.error('Error fetching full order for specific payment receipt:', orderError);
      alert('Failed to fetch full order details for printing.');
      return;
    }

    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('vat_rate')
      .maybeSingle(); // Use maybeSingle in case settings table is empty

    const vatRate = settings?.vat_rate || 0.18;

    if (settingsError) {
      console.warn('Could not fetch system settings for VAT rate, using default.', settingsError);
    }

    const printWindow = window.open('', '_blank', 'width=800,height=600'); // Adjusted size for better view
    if (printWindow) {
      const root = createRoot(printWindow.document.body);
      root.render(
        <PaymentReceiptLayout
          order={fullOrderData as any}
          specificPayment={{
            ...specificPayment,
            collected_by_user: specificPayment.collected_by_user || 'N/A'
          }}
          vatRate={vatRate}
        />
      );
      setTimeout(() => {
        printWindow.print();
      }, 500);
    } else {
      alert('Please allow pop-ups to print the receipt.');
    }
  };

  // Function to handle printing on-demand order payment receipts
  const handlePrintOnDemandPaymentReceipt = async (
    orderRecord: PaymentRecord,
    specificPayment: OrderPayment & { collected_by_user?: string }
  ) => {
    // Fetch full on-demand order data with all related information
    const { data: fullOrderData, error: orderError } = await supabase
      .from('on_demand_orders')
      .select(`
        *,
        customers(*),
        on_demand_assignment_items(
          id, 
          assigned_quantity, 
          sold_quantity, 
          selling_price,
          products(id, name, unit_type, product_id, sku)
        ),
        sales_rep:users!on_demand_orders_sales_rep_id_fkey(username)
      `)
      .eq('id', orderRecord.id)
      .single();

    if (orderError || !fullOrderData) {
      console.error('Error fetching full on-demand order for receipt:', orderError);
      alert('Failed to fetch full order details for printing.');
      return;
    }

    // Calculate payment details for this specific transaction
    const transactionAmount = specificPayment.amount;
    const totalAmount = fullOrderData.total_amount || 0;
    
    // Calculate previously collected (all payments before this one)
    const { data: allPayments } = await supabase
      .from('on_demand_order_payments')
      .select('amount, payment_date')
      .eq('on_demand_order_id', orderRecord.id)
      .order('payment_date', { ascending: true });

    let previouslyCollected = 0;
    if (allPayments) {
      for (const payment of allPayments) {
        if (new Date(payment.payment_date) < new Date(specificPayment.payment_date)) {
          previouslyCollected += payment.amount;
        }
      }
    }

    const totalCollected = previouslyCollected + transactionAmount;
    const remainingBalance = totalAmount - totalCollected;
    
    // Determine payment status
    let paymentStatusText = 'Unpaid';
    if (totalCollected >= totalAmount) {
      paymentStatusText = 'Fully Paid';
    } else if (totalCollected > 0) {
      paymentStatusText = 'Partially Paid';
    }

    // Format product details - match structure from OngoingOnDemandOrders.tsx
    const productDetails = fullOrderData.on_demand_assignment_items?.map((item: any) => ({
      id: item.id,
      products: item.products,
      sold_quantity: fullOrderData.quantity_sold,  // Always use order-level quantity
      selling_price: fullOrderData.selling_price,  // Always use order-level price
      total_amount: (fullOrderData.quantity_sold || 0) * (fullOrderData.selling_price || 0), // Add total_amount
    })) || [];

    // Prepare order object for bill generation
    const orderForBill = {
      ...fullOrderData,
      product_details: productDetails,
      sales_rep_username: fullOrderData.sales_rep?.username || 'N/A',
      customer_details: fullOrderData.customers,
    };

    // Import bill generation functions
    const { generateOnDemandBillHTML, downloadBillForMprint, generateBillPDF } = await import('../lib/mprintService');
    const { isMobileOrTablet } = await import('../utils/deviceDetection');
    const { validateAndPrepareHTML, validatePDFBlob } = await import('../lib/mprintService');
    
    const isMobile = isMobileOrTablet();

    if (isMobile) {
      // MOBILE: Generate PDF and download for mPrint
      try {
        console.log('[Finance Admin OnDemand] Mobile detected, using mPrint flow');
        
        // Generate HTML bill
        const billHtml = generateOnDemandBillHTML({
          order: orderForBill,
          paymentMethod: { label: specificPayment.payment_method, value: specificPayment.payment_method },
          receiptNo: specificPayment.receipt_no,
          transactionAmount,
          previouslyCollected,
          totalCollected,
          remainingBalance,
          paymentStatusText,
        });

        // Validate HTML
        const htmlValidation = validateAndPrepareHTML(billHtml);
        if (!htmlValidation.isValid) {
          console.error('[Finance Admin OnDemand] HTML validation failed');
          alert('Bill content is invalid. Using local print instead.');
          // Fallback to desktop print
          openOnDemandDesktopPrint(orderForBill, specificPayment, transactionAmount, previouslyCollected, totalCollected, remainingBalance, paymentStatusText);
          return;
        }

        // Generate PDF
        const pdfPromise = generateBillPDF(billHtml, `on-demand-${specificPayment.receipt_no}`);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('PDF generation timeout')), 15000)
        );

        const pdfBlob = await Promise.race([pdfPromise, timeoutPromise]) as Blob;

        // Validate PDF
        const pdfValidation = validatePDFBlob(pdfBlob);
        if (!pdfValidation.isValid) {
          console.warn('[Finance Admin OnDemand] PDF validation failed');
          openOnDemandDesktopPrint(orderForBill, specificPayment, transactionAmount, previouslyCollected, totalCollected, remainingBalance, paymentStatusText);
          return;
        }

        // Download for mPrint
        await downloadBillForMprint(pdfBlob, `on-demand-${specificPayment.receipt_no}`);
        alert('Bill PDF downloaded successfully. Please open with mPrint app to print.');
        
      } catch (err: any) {
        console.error('[Finance Admin OnDemand] Error:', err);
        alert('Failed to generate PDF. Using local print instead.');
        openOnDemandDesktopPrint(orderForBill, specificPayment, transactionAmount, previouslyCollected, totalCollected, remainingBalance, paymentStatusText);
      }
    } else {
      // DESKTOP: Use local print window
      openOnDemandDesktopPrint(orderForBill, specificPayment, transactionAmount, previouslyCollected, totalCollected, remainingBalance, paymentStatusText);
    }
  };

  // Helper function for desktop on-demand receipt printing
  const openOnDemandDesktopPrint = (
    order: any,
    specificPayment: any,
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
          order={order}
          paymentMethod={{ label: specificPayment.payment_method, value: specificPayment.payment_method }}
          receiptNo={specificPayment.receipt_no}
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

  const getPaymentStatusColor = (status: 'fully_paid' | 'partially_paid' | 'unpaid') => {
    switch (status) {
      case 'fully_paid': return 'bg-green-100 text-green-800';
      case 'partially_paid': return 'bg-yellow-100 text-yellow-800';
      case 'unpaid': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredRecords = paymentRecords.filter(record =>
    record.display_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.sales_rep_username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.payment_method?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (user?.role !== 'Finance Admin') {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">Only Finance Admins can view payment information.</p>
        </div>
      </div>
    );
  }

  if (loading && paymentRecords.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading payment information...</div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">{fetchError}</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Payment Information</h1>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value as 'all' | 'fully_paid' | 'partially_paid' | 'unpaid')}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              <option value="fully_paid">Fully Paid</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="Start Date"
            />
          </div>

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="End Date"
            />
          </div>

          <div className="relative md:col-span-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {paymentRecords.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Payment Records Found</h2>
          <p className="text-gray-600">Adjust your filters or check back later.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="block md:hidden">
            <div className="space-y-3">
              {filteredRecords.map((record) => (
                <div key={record.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm cursor-pointer hover:bg-gray-50" onClick={() => setSelectedRecord(record)}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center flex-1 min-w-0">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                        <FileText className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {record.display_id} ({record.type === 'regular' ? 'Regular Order' : 'On-Demand Sale'})
                        </h3>
                        <div className="flex items-center mt-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getPaymentStatusColor(record.payment_status)}`}>
                            {record.payment_status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-1 text-xs ml-11">
                    <div className="flex items-start">
                      <span className="text-gray-500 font-medium w-16 flex-shrink-0">Customer:</span>
                      <span className="text-gray-700 flex-1">{record.customer_name}</span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-gray-500 font-medium w-16 flex-shrink-0">Sales Rep:</span>
                      <span className="text-gray-700 flex-1">{record.sales_rep_username || 'N/A'}</span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-gray-500 font-medium w-16 flex-shrink-0">Total:</span>
                      <span className="text-gray-700 flex-1">{formatCurrency(record.total_amount)}</span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-gray-500 font-medium w-16 flex-shrink-0">Collected:</span>
                      <span className="text-gray-700 flex-1">{formatCurrency(record.collected_amount)}</span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-gray-500 font-medium w-16 flex-shrink-0">Remaining:</span>
                      <span className="text-gray-700 flex-1">{formatCurrency(record.remaining_balance)}</span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-gray-500 font-medium w-16 flex-shrink-0">Method:</span>
                      <span className="text-gray-700 flex-1">{record.payment_method || 'N/A'}</span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-gray-500 font-medium w-16 flex-shrink-0">Date:</span>
                      <span className="text-gray-700 flex-1">{record.date}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sales Rep</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Collected</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remaining</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 cursor-pointer">
                  {filteredRecords.map((record, index) => (
                    <tr key={record.id} className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-gray-100`} onClick={() => setSelectedRecord(record)}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {record.display_id}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.type === 'regular' ? 'Regular Order' : 'On-Demand Sale'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.customer_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.sales_rep_username || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(record.total_amount)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(record.collected_amount)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(record.remaining_balance)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(record.payment_status)}`}>
                          {record.payment_status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.payment_method || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.date}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRecord(record);
                          }}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded-full hover:bg-blue-100"
                        >
                          <Eye className="w-5 h-5" />
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

      {selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Payment Details: {selectedRecord.display_id}</h2>
              <button onClick={() => setSelectedRecord(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="text-lg font-semibold text-blue-800 mb-3">Customer Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="flex items-center">
                    <span className="font-medium text-blue-700 w-24 flex-shrink-0">Name:</span>
                    <span className="text-blue-900">{selectedRecord.customer_name}</span>
                  </div>
                  {selectedRecord.customer_address && (
                    <div className="flex items-center">
                      <span className="font-medium text-blue-700 w-24 flex-shrink-0">Address:</span>
                      <span className="text-blue-900">{selectedRecord.customer_address}</span>
                    </div>
                  )}
                  {selectedRecord.customer_phone && (
                    <div className="flex items-center">
                      <span className="font-medium text-blue-700 w-24 flex-shrink-0">Phone:</span>
                      <span className="text-blue-900">{selectedRecord.customer_phone}</span>
                    </div>
                  )}
                  {selectedRecord.customer_email && (
                    <div className="flex items-center">
                      <span className="font-medium text-blue-700 w-24 flex-shrink-0">Email:</span>
                      <span className="text-blue-900">{selectedRecord.customer_email}</span>
                    </div>
                  )}
                  {selectedRecord.customer_vat_status && (
                    <div className="flex items-center">
                      <span className="font-medium text-blue-700 w-24 flex-shrink-0">VAT Status:</span>
                      <span className="text-blue-900">{selectedRecord.customer_vat_status}</span>
                    </div>
                  )}
                  {selectedRecord.customer_tin_number && (
                    <div className="flex items-center">
                      <span className="font-medium text-blue-700 w-24 flex-shrink-0">TIN:</span>
                      <span className="text-blue-900">{selectedRecord.customer_tin_number}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h3 className="text-lg font-semibold text-green-800 mb-3">Payment Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="flex items-center">
                    <span className="font-medium text-green-700 w-32 flex-shrink-0">Total Amount:</span>
                    <span className="text-green-900">{formatCurrency(selectedRecord.total_amount)}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium text-green-700 w-32 flex-shrink-0">Collected:</span>
                    <span className="text-green-900">{formatCurrency(selectedRecord.collected_amount)}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium text-green-700 w-32 flex-shrink-0">Remaining:</span>
                    <span className="text-green-900">{formatCurrency(selectedRecord.remaining_balance)}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium text-green-700 w-32 flex-shrink-0">Status:</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(selectedRecord.payment_status)}`}>
                      {selectedRecord.payment_status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium text-green-700 w-32 flex-shrink-0">Method:</span>
                    <span className="text-green-900">{selectedRecord.payment_method || 'N/A'}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium text-green-700 w-32 flex-shrink-0">Date:</span>
                    <span className="text-green-900">{selectedRecord.date}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium text-green-700 w-32 flex-shrink-0">Sales Rep:</span>
                    <span className="text-green-900">{selectedRecord.sales_rep_username || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {selectedRecord.order_items_details && selectedRecord.order_items_details.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Order Items</h3>
                  <div className="space-y-3">
                    {selectedRecord.order_items_details.map((item, index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm border border-gray-100">
                        <div>
                          <div className="font-medium text-gray-900">{item.product_name}</div>
                          <div className="text-sm text-gray-600">
                            {item.quantity} {item.unit_type} @ {formatCurrency(item.unit_price)}/unit
                          </div>
                        </div>
                        <span className="font-semibold text-gray-900">{formatCurrency(item.total_price)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedRecord.payment_history && selectedRecord.payment_history.length > 0 && (
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <h3 className="text-lg font-semibold text-purple-800 mb-3">Payment History</h3>
                  <div className="space-y-3">
                    {selectedRecord.payment_history
                      .sort((a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime())
                      .map((payment, index) => (
                        <div key={payment.id} className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm border border-gray-100">
                          <div>
                            <div className="font-medium text-gray-900">
                              {index + 1}. {new Date(payment.payment_date).toLocaleDateString()} - {formatCurrency(payment.amount)}
                            </div>
                            <div className="text-sm text-gray-600">
                              Method: {payment.payment_method} | Receipt: {payment.receipt_no || 'N/A'}
                            </div>
                            {payment.payment_method === 'Cheque' && (
                              <div className="text-sm text-gray-800 mt-1"> {/* Changed text-xs to text-sm, text-gray-500 to text-gray-800 */}
                                <span className="font-semibold">Cheque No:</span> {payment.cheque_number || 'N/A'} | <span className="font-semibold">Cheque Date:</span> {payment.cheque_date ? new Date(payment.cheque_date).toLocaleDateString() : 'N/A'}
                              </div>
                            )}
                            <div className="text-xs text-gray-500">
                              Collected by: {payment.collected_by_user || 'N/A'}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              if (selectedRecord.type === 'on_demand') {
                                handlePrintOnDemandPaymentReceipt(selectedRecord, payment);
                              } else {
                                handlePrintSpecificPaymentReceipt(selectedRecord, payment);
                              }
                            }}
                            className="px-3 py-1 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm"
                          >
                            View/Print Receipt
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end p-6 border-t bg-gray-50">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};