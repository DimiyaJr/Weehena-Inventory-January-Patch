import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Search, Eye, Check, X, CheckCircle, RotateCcw, Filter, User, DollarSign, Truck, FileText, Calendar, ShieldOff, Download, Scale } from 'lucide-react' // Added Download and Scale icons
import { useAuth } from '../hooks/useAuth'
import { supabase, Order as SupabaseOrder, OrderItem as SupabaseOrderItem } from '../lib/supabase'
import { PaymentConfirmationModal } from './PaymentConfirmationModal'
import { BillPrintLayout } from './BillPrintLayout'
import { sendBillEmail } from '../lib/emailService'
import { useLocation } from 'react-router-dom'
import { isOffHoursSriLanka } from '../utils/timeUtils'
import { SecurityCheckModal } from './SecurityCheckModal'
import { FinalDeliveryWeightModal } from './FinalDeliveryWeightModal' // Added import for FinalDeliveryWeightModal
import { formatCurrency } from '../utils/formatters' // ADDED: Import formatCurrency utility

// Import file-saver for CSV export
import { saveAs } from 'file-saver'

// Import the new mPrint service and device detection
import { isMobileOrTablet } from '../utils/deviceDetection';
import { generateBillPDF, downloadBillForMprint, validateAndPrepareHTML, validatePDFBlob } from '../lib/mprintService';

// Helper function to generate a unique receipt number for individual payments
const generatePaymentReceiptNo = async (orderId: string, orderDisplayId: string): Promise<string> => {
  // Count existing payments for this order to determine sequence number
  const { count, error } = await supabase
    .from('order_payments')
    .select('*', { count: 'exact', head: true })
    .eq('order_id', orderId);
  
  if (error) {
    console.error('Error counting payments:', error);
    // Fallback to timestamp if count fails
    return `${orderDisplayId}-P${Date.now()}`;
  }
  
  const nextSequence = (count || 0) + 1;
  return `${orderDisplayId}-P${nextSequence}`;
};

interface OrderReturn {
  id: string
  order_item_id: string
  returned_quantity: number
  return_reason: string
  returned_by: string
  returned_at: string
  returned_by_user?: { username: string }
}

type Order = SupabaseOrder;
type OrderItem = SupabaseOrderItem;

// Predefined reasons for security check
const predefinedReasons = [
  'Missing Quantity',
  'Damaged Product',
  'Incorrect Labeling',
  'Unauthorized Product',
  'Documentation Mismatch',
  'Expired Product',
  'Overloaded/Improperly Loaded'
]

// Status priority map for custom sorting
const statusPriority: { [key: string]: number } = {
  'Assigned': 1,
  'Products Loaded': 2,
  'Product Reloaded': 3,
  'Security Check Incomplete': 4,
  'Security Checked': 4,
  'Security Check Bypassed Due to Off Hours': 4,
  'Departed Farm': 5,
  'Delivered - Payment Not Collected': 6,
  'Delivered - Payment Partially Collected': 7,
  'Delivered': 8,
  'Completed': 9,
  'Pending': 10,
  'Cancelled': 11,
};

// Price mapping based on payment category
const getPriceByPaymentCategory = (product: any, paymentCategory: string): number => {
  switch (paymentCategory) {
    case 'Dealer Cash':
      return product.price_dealer_cash || product.price || 0;
    case 'Dealer Credit':
      return product.price_dealer_credit || product.price || 0;
    case 'Distributor Cash':
      return product.price_distributor_cash || product.price || 0;
    case 'Distributor Credit':
      return product.price_distributor_credit || product.price || 0;
    case 'Walk-in Cash':
      return product.price_walkin_cash || product.price || 0;
    case 'Walk-in Credit':
      return product.price_walkin_credit || product.price || 0;
    default:
      return product.price || 0;
  }
};

// Helper function to aggregate quantities and determine unit type
const getAggregatedSecurityQuantities = (order: Order) => {
  let suggestedTotalQuantity = 0;
  let actualTotalQuantity = 0;

  let firstUnitType: string | null = null;
  let allSameUnit = true;
  let allPacksHaveWeight = true;

  order.order_items.forEach(item => {
    if (item.products.unit_type === 'Packs' && item.products.weight_per_pack_kg !== null) {
      suggestedTotalQuantity += item.quantity * item.products.weight_per_pack_kg;
    } else {
      suggestedTotalQuantity += item.quantity;
      if (item.products.unit_type === 'Packs') {
        allPacksHaveWeight = false;
      }
    }

    if (item.actual_quantity_after_security_check !== null) {
      if (item.products.unit_type === 'Packs' && item.products.weight_per_pack_kg !== null) {
        actualTotalQuantity += item.actual_quantity_after_security_check * item.products.weight_per_pack_kg;
      } else {
        actualTotalQuantity += item.actual_quantity_after_security_check;
      }
    }

    if (firstUnitType === null) {
      firstUnitType = item.products.unit_type;
    } else if (firstUnitType !== item.products.unit_type) {
      allSameUnit = false;
    }
  });

  const suggestedUnitType = (allSameUnit && firstUnitType === 'Packs' && allPacksHaveWeight) || (allSameUnit && firstUnitType === 'Kg') ? 'Kg' : (allSameUnit && firstUnitType ? firstUnitType : 'Units');
  const actualUnitType = 'Kg';

  return {
    suggestedTotalQuantity,
    actualTotalQuantity,
    suggestedUnitType,
    actualUnitType
  };
};

export const SalesOrders: React.FC = () => {
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const { isOnline } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState(user?.role === 'Sales Rep' ? 'Assigned' : 'all')
  const [deliveryDateFilter, setDeliveryDateFilter] = useState(user?.role === 'Sales Rep' ? new Date().toISOString().split('T')[0] : '')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [showSecurityModal, setShowSecurityModal] = useState(false)
  
  const [customerFilter, setCustomerFilter] = useState('all')
  const [salesRepFilter, setSalesRepFilter] = useState('all')
  const [customersList, setCustomersList] = useState<{ id: string; name: string; payment_category?: string }[]>([])
  const [selectedOrderForSecurity, setSelectedOrderForSecurity] = useState<Order | null>(null)
  const [securityNotes, setSecurityNotes] = useState('')
  const [selectedReasons, setSelectedReasons] = useState<string[]>([])
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [selectedOrderItem, setSelectedOrderItem] = useState<OrderItem | null>(null)
  const [returnQuantity, setReturnQuantity] = useState(0)
  const [returnReason, setReturnReason] = useState('')
  const [processingReturn, setProcessingReturn] = useState(false)
  const [processing, setProcessing] = useState(false)

  // Payment state variables
  const [showPaymentConfirmationModal, setShowPaymentConfirmationModal] = useState(false)
  const [currentOrderForPayment, setCurrentOrderForPayment] = useState<Order | null>(null)
  const [paymentCollectedAmount, setPaymentCollectedAmount] = useState<number | ''>('')
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Net' | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [processingPayment, setProcessingPayment] = useState(false)
  const [isSubsequentPayment, setIsSubsequentPayment] = useState(false)
  const [allowPartialPayment, setAllowPartialPayment] = useState(true)
  const [initialPaymentStatus, setInitialPaymentStatus] = useState<'full' | 'partial' | 'no_payment' | null>(null) // ADDED: New state variable

  const location = useLocation()
  const [salesRepsList, setSalesRepsList] = useState<{ id: string; username: string }[]>([])

  const [isOrdersFromCache, setIsOrdersFromCache] = useState(false)
  const [isFilterOptionsFromCache, setIsFilterOptionsFromCache] = useState(false)

  // New state for security check modal
  const [showSecurityCheckModal, setShowSecurityCheckModal] = useState(false)
  const [selectedOrderForSecurityCheck, setSelectedOrderForSecurityCheck] = useState<Order | null>(null)
  const [securityCheckLoading, setSecurityCheckLoading] = useState(false)

  // State to hold filtered orders for export
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])

  // State for final delivery weights
  const [finalDeliveryWeights, setFinalDeliveryWeights] = useState<Record<string, number>>({})

  // New state variables for weight management
  const [showWeightModal, setShowWeightModal] = useState(false)
  const [selectedOrderForWeights, setSelectedOrderForWeights] = useState<Order | null>(null)
  const [refreshWeights, setRefreshWeights] = useState(false)

  // NEW: Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage)

  // Function to get current page orders
  const getCurrentPageOrders = () => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredOrders.slice(startIndex, endIndex)
  }

  // Function to handle page changes
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage)
      // Optionally scroll to top of table
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filteredOrders.length])

  useEffect(() => {
    fetchOrders()
    fetchFilterOptions()
  }, [user, statusFilter, customerFilter, salesRepFilter, deliveryDateFilter, location.search])

  // Effect to refresh orders when weights are updated
  useEffect(() => {
    if (refreshWeights) {
      fetchOrders()
    }
  }, [refreshWeights])

  // Update filteredOrders when orders or filters change
  useEffect(() => {
    const filtered = getFilteredAndSearchedOrders();
    setFilteredOrders(filtered);
  }, [orders, searchTerm, statusFilter, customerFilter, salesRepFilter, deliveryDateFilter]);

  useEffect(() => {
    if (!isOnline) return
    const queryParams = new URLSearchParams(location.search)
    const orderId = queryParams.get('orderId')
    if (orderId && orders.length > 0) {
      const orderToOpen = orders.find(order => order.id === orderId)
      if (orderToOpen) {
        openOrderModal(orderToOpen)
      }
    }
  }, [orders, location.search])

  const fetchFilterOptions = async () => {
    try {
      setIsFilterOptionsFromCache(false)
      const cacheKeyCustomers = 'sales_orders_customers_filter'
      const cacheKeySalesReps = 'sales_orders_sales_reps_filter'

      if (!isOnline) {
        const cachedCustomers = localStorage.getItem(cacheKeyCustomers)
        const cachedSalesReps = localStorage.getItem(cacheKeySalesReps)
        if (cachedCustomers && cachedSalesReps) {
          setCustomersList(JSON.parse(cachedCustomers))
          setSalesRepsList(JSON.parse(cachedSalesReps))
          setIsFilterOptionsFromCache(true)
          return
        }
      }

      const { data: customersData, error: customersError } = await supabase.from('customers').select('id, name, payment_category, tin_number').order('name')
      if (customersError) throw customersError
      setCustomersList(customersData || [])
      localStorage.setItem(cacheKeyCustomers, JSON.stringify(customersData))

      const { data: salesRepsData, error: salesRepsError } = await supabase.from('users').select('id, username').eq('role', 'Sales Rep').order('username')
      if (salesRepsError) throw salesRepsError
      setSalesRepsList(salesRepsData || [])
      localStorage.setItem(cacheKeySalesReps, JSON.stringify(salesRepsData))
    } catch (error) {
      console.error('Error fetching filter options:', error)
      const cachedCustomers = localStorage.getItem('sales_orders_customers_filter')
      const cachedSalesReps = localStorage.getItem('sales_orders_sales_reps_filter')
      if (cachedCustomers && cachedSalesReps) {
        setCustomersList(JSON.parse(cachedCustomers))
        setSalesRepsList(JSON.parse(cachedSalesReps))
        setIsFilterOptionsFromCache(true)
      } else {
        setCustomersList([])
        setSalesRepsList([])
      }
    }
  }

  const getOrderTotal = (order: Order) => order.order_items.reduce((total, item) => total + item.quantity * item.price, 0)

  // Helper function to check if a product is a chicken product
  const isChickenProduct = (category_code: string | undefined): boolean => {
    if (!category_code) return false
    const chickenCategoryCodes = ['BT', 'LD', 'OC', 'PS', 'WT']
    return chickenCategoryCodes.includes(category_code.toUpperCase())
  }

  // Helper function to calculate order total with final weights
  const calculateOrderTotalWithFinalWeights = (order: Order, weights: Record<string, number>): number => {
    let newTotal = 0

    order.order_items.forEach(item => {
      let itemTotal = 0
      
      if (weights[item.id] !== undefined && weights[item.id] > 0) {
        // Use final weight for chicken products
        const finalWeight = weights[item.id]
        const pricePerUnit = item.price
        const discountFactor = item.discount ? (1 - item.discount / 100) : 1
        itemTotal = finalWeight * pricePerUnit * discountFactor
      } else {
        // Use original calculation for non-chicken or items without final weight
        const discountFactor = item.discount ? (1 - item.discount / 100) : 1
        itemTotal = item.quantity * item.price * discountFactor
      }
      
      newTotal += itemTotal
    })

    // Apply VAT if applicable
    if (order.is_vat_applicable) {
      newTotal *= (1 + 0.18) // 18% VAT
    }

    return Math.round(newTotal * 100) / 100 // Round to 2 decimal places
  }

  // Check if order has chicken products
  const hasChickenProducts = (order: Order): boolean => {
    const chickenCodes = ['BT', 'LD', 'OC', 'PS', 'WT']
    return order.order_items?.some(item => {
      const categoryCode = item.products?.categories?.category_code || item.category_id
      const categoryName = item.products?.categories?.category_name || item.category_name
      return chickenCodes.includes(categoryCode?.toUpperCase() || '') ||
             (categoryName?.toLowerCase().includes('chicken') || false)
    }) || false
  }

  // Open weight management modal
  const handleOpenWeightModal = (order: Order) => {
    if (user?.role !== 'Sales Rep') {
      alert('Only Sales Representatives can manage final delivery weights')
      return
    }
    setSelectedOrderForWeights(order)
    setShowWeightModal(true)
  }

  // Close weight management modal
  const handleCloseWeightModal = () => {
    setShowWeightModal(false)
    setSelectedOrderForWeights(null)
  }

  // Callback after weights are saved
  const handleWeightsSaved = () => {
    setShowWeightModal(false)
    setSelectedOrderForWeights(null)
    setRefreshWeights(prev => !prev) // Trigger re-fetch of orders
    alert('Final delivery weights saved successfully!')
  }

  const applyCustomSorting = (ordersData: Order[]): Order[] => {
    if (!ordersData || ordersData.length === 0) return ordersData;
  
    return [...ordersData].sort((a, b) => {
      // Sort only by status priority (removed delivery date sorting)
      const priorityA = statusPriority[a.status] || 999;
      const priorityB = statusPriority[b.status] || 999;
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // If same status priority, sort by created_at (newest first within same status)
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    })
  }

  const fetchOrders = async () => {
    if (!user) return
    setLoading(true)
    setIsOrdersFromCache(false)
    const cacheKey = `sales_orders_data_${user.id}_${statusFilter}_${customerFilter}_${salesRepFilter}_${deliveryDateFilter}`

    if (!isOnline) {
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        try {
          const parsedData = JSON.parse(cachedData)
          const sortedData = applyCustomSorting(parsedData)
          setOrders(sortedData)
          setIsOrdersFromCache(true)
          setLoading(false)
          return
        } catch (error) {
          console.error('Error parsing cached data:', error)
        }
      }
    }

    try {
      let query = supabase
        .from('orders')
        .select(`
          id, customer_id, status, created_by, assigned_to, completed_by, security_check_status,
          security_check_notes, vehicle_number, created_at, completed_at, order_display_id,
          purchase_order_id, payment_method, receipt_no, delivery_date, payment_status, collected_amount,
          total_amount, vat_amount, is_vat_applicable,
          customers(name, address, phone_number, email, vat_status, payment_category, tin_number),
          order_items(
            id,
            quantity,
            price,
            discount,
            returned_quantity,
            actual_quantity_after_security_check,
            final_delivery_weight_kg,
            item_id,
            products(id, name, unit_type, weight_per_pack_kg, price_cash, price_credit, price_dealer_cash, price_dealer_credit, price_hotel_non_vat, price_hotel_vat, category_id, product_id, sku, categories(category_id, category_name, category_code))
          ),
          assigned_user:users!orders_assigned_to_fkey(username),
          completed_user:users!orders_completed_by_fkey(username),
          order_payments(id, amount, payment_method, receipt_no, collected_by, payment_date, cheque_number, cheque_date)
        `)

      if (statusFilter !== 'all') query = query.eq('status', statusFilter)
      if (customerFilter !== 'all') query = query.eq('customer_id', customerFilter)
      if (salesRepFilter !== 'all') query = query.eq('assigned_to', salesRepFilter)
      if (deliveryDateFilter) query = query.eq('delivery_date', deliveryDateFilter)

      if (user.role === 'Sales Rep') query = query.eq('assigned_to', user.id)

      // CHANGE 1: Removed the conditional filter that excludes "Product Reloaded" orders for Security Guard
      // This allows Security Guard to see orders that have been reloaded by the Sales Rep

      const { data, error } = await query
      if (error) throw error
      
      const sortedData = applyCustomSorting(data || [])
      setOrders(sortedData)
      console.log("Fetched orders data (in fetchOrders):", sortedData)
      localStorage.setItem(cacheKey, JSON.stringify(sortedData))
    } catch (error) {
      console.error('Error fetching orders:', error)
      const cachedData = localStorage.getItem(`sales_orders_data_${user.id}_${statusFilter}_${customerFilter}_${salesRepFilter}_${deliveryDateFilter}`)
      if (cachedData) {
        try {
          const parsedData = JSON.parse(cachedData)
          const sortedData = applyCustomSorting(parsedData)
          setOrders(sortedData)
          setIsOrdersFromCache(true)
        } catch (parseError) {
          console.error('Error parsing cached data:', parseError)
          setOrders([])
        }
      } else {
        setOrders([])
      }
    } finally {
      setLoading(false)
    }
  }

  // Export to Excel/CSV function
  const handleExportToExcel = () => {
    if (filteredOrders.length === 0) {
      alert('No orders to export.');
      return;
    }

    const headers = [
      'Order ID',
      'Order Status',
      'Delivery Date',
      'Customer Name',
      'Customer Phone',
      'Customer Email',
      'Customer Address',
      'Customer VAT Status',
      'Customer TIN Number',
      'Sales Rep',
      'Vehicle Number',
      'Total Amount (Rs)',
      'VAT Amount (Rs)',
      'Is VAT Applicable',
      'Payment Status',
      'Collected Amount (Rs)',
      'Remaining Balance (Rs)',
      'Last Payment Method',
      'Last Payment Receipt No',
      'Last Payment Cheque No',
      'Last Payment Cheque Date',
      'Order Items',
      'Security Check Status',
      'Security Check Notes',
      'Created At',
    ];

    const csvRows = filteredOrders.map(order => {
      const customer = order.customers;
      const salesRep = order.assigned_user;
      
      // Get the last payment (most recent)
      const lastPayment = order.order_payments && order.order_payments.length > 0
        ? order.order_payments.reduce((latest, current) => {
            const latestDate = latest?.payment_date ? new Date(latest.payment_date).getTime() : 0;
            const currentDate = current?.payment_date ? new Date(current.payment_date).getTime() : 0;
            return currentDate > latestDate ? current : latest;
          })
        : null;

      // Summarize order items
      const orderItemsSummary = order.order_items
        .map(item => `${item.products?.name || 'N/A'} (${item.quantity} ${item.products?.unit_type || 'Unit'})`)
        .join('; ');

      const totalCollected = order.collected_amount || 0;
      const remainingBalance = (order.total_amount || getOrderTotal(order)) - totalCollected;

      // Helper function to escape CSV special characters
      const escapeCSV = (value: any) => {
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      };

      return [
        escapeCSV(order.order_display_id || ''),
        escapeCSV(order.status || ''),
        escapeCSV(order.delivery_date ? new Date(order.delivery_date).toLocaleDateString() : ''),
        escapeCSV(customer?.name || ''),
        escapeCSV(customer?.phone_number || ''),
        escapeCSV(customer?.email || ''),
        escapeCSV(customer?.address || ''),
        escapeCSV(customer?.vat_status || ''),
        escapeCSV(customer?.tin_number || ''),
        escapeCSV(salesRep?.username || ''),
        escapeCSV(order.vehicle_number || ''),
        escapeCSV((order.total_amount || getOrderTotal(order)).toFixed(2)),
        escapeCSV((order.vat_amount || 0).toFixed(2)),
        escapeCSV(order.is_vat_applicable ? 'Yes' : 'No'),
        escapeCSV(order.payment_status || ''),
        escapeCSV(totalCollected.toFixed(2)),
        escapeCSV(remainingBalance.toFixed(2)),
        escapeCSV(lastPayment?.payment_method || ''),
        escapeCSV(lastPayment?.receipt_no || ''),
        escapeCSV(lastPayment?.cheque_number || ''),
        escapeCSV(lastPayment?.cheque_date ? new Date(lastPayment.cheque_date).toLocaleDateString() : ''),
        escapeCSV(orderItemsSummary),
        escapeCSV(order.security_check_status || ''),
        escapeCSV(order.security_check_notes || ''),
        escapeCSV(new Date(order.created_at).toLocaleString()),
      ].join(',');
    });

    const csvString = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const today = new Date().toISOString().split('T')[0];
    saveAs(blob, `SalesOrders_Export_${today}.csv`);
  };

  const getAvailableStatusOptions = (order: Order) => {
    const currentStatus = order.status
    const userRole = user?.role

    if (!userRole) return []

    const allStatuses = [
      { value: 'Pending', label: 'Pending' },
      { value: 'Assigned', label: 'Assigned' },
      { value: 'Products Loaded', label: 'Products Loaded' },
      { value: 'Product Reloaded', label: 'Product Reloaded' },
      { value: 'Security Check Incomplete', label: 'Security Check Incomplete' },
      { value: 'Security Checked', label: 'Security Checked' },
      { value: 'Security Check Bypassed Due to Off Hours', label: 'Security Check Bypassed Due to Off Hours' },
      { value: 'Departed Farm', label: 'Departed Farm' },
      { value: 'Delivered', label: 'Delivered - Full Payment Collected' },
      { value: 'Delivered - Payment Partially Collected', label: 'Delivered - Partial Payment Collected' },
      { value: 'Delivered - Payment Not Collected', label: 'Delivered - No Payment Collected' },
      { value: 'Cancelled', label: 'Cancelled' },
      { value: 'Completed', label: 'Completed' }
    ]

    const baseOptions = userRole === 'Security Guard'
      ? allStatuses.filter(opt => opt.value !== 'Product Reloaded')
      : allStatuses

    switch (userRole) {
      case 'Sales Rep':
        switch (currentStatus) {
          case 'Assigned':
            return baseOptions.filter(opt => ['Assigned', 'Products Loaded'].includes(opt.value))
          case 'Products Loaded':
            return baseOptions.filter(opt => opt.value === 'Products Loaded')
          case 'Security Check Incomplete':
            return baseOptions.filter(opt => ['Security Check Incomplete', 'Product Reloaded'].includes(opt.value))
          case 'Security Checked':
            return baseOptions.filter(opt => ['Security Checked', 'Departed Farm'].includes(opt.value))
          case 'Security Check Bypassed Due to Off Hours':
            return baseOptions.filter(opt => ['Security Check Bypassed Due to Off Hours', 'Departed Farm'].includes(opt.value))
          case 'Departed Farm':
            return [
              { value: 'Departed Farm', label: 'Departed Farm' },
              { value: 'Delivered', label: 'Delivered - Full Payment Collected' },
              { value: 'Delivered - Payment Partially Collected', label: 'Delivered - Partial Payment Collected' },
              { value: 'Delivered - Payment Not Collected', label: 'Delivered - No Payment Collected' },
            ]
          case 'Delivered - Payment Not Collected':
          case 'Delivered - Payment Partially Collected':
            return baseOptions.filter(opt => [
              currentStatus,
              'Delivered',
              'Delivered - Payment Partially Collected',
            ].includes(opt.value))
          case 'Delivered':
            return baseOptions.filter(opt => opt.value === currentStatus)
          default:
            return baseOptions.filter(opt => opt.value === currentStatus)
        }

      case 'Security Guard':
        switch (currentStatus) {
          case 'Products Loaded':
          case 'Product Reloaded':
            return baseOptions.filter(opt => ['Products Loaded', 'Security Checked', 'Security Check Incomplete'].includes(opt.value))
          case 'Security Check Incomplete':
            return baseOptions.filter(opt => opt.value === 'Security Check Incomplete')
          default:
            return baseOptions.filter(opt => opt.value === currentStatus)
        }

      case 'Admin':
      case 'Super Admin':
      case 'Order Manager':
      case 'Finance Admin':
        return baseOptions

      default:
        return baseOptions.filter(opt => opt.value === currentStatus)
    }
  }

  const handleUpdateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    if (!user) return
    setProcessing(true)

    try {
      if (newStatus === 'Departed Farm') {
        const { error } = await supabase
          .from('orders')
          .update({ status: 'Departed Farm' })
          .eq('id', orderId)

        if (error) throw error
      } 
      else if (newStatus === 'Delivered - Payment Partially Collected') {
        const order = orders.find(o => o.id === orderId)
        if (order) {
          // Fetch fresh order data with final weights from database
          const { data: freshOrder, error } = await supabase
            .from('orders')
            .select(`
              *,
              customers(*),
              order_items(*, products(*)),
              assigned_user:users!orders_assigned_to_fkey(username)
            `)
            .eq('id', orderId)
            .single()
          
          if (!error && freshOrder) {
            setCurrentOrderForPayment(freshOrder as Order)
          } else {
            setCurrentOrderForPayment(order)
          }
          
          setPaymentCollectedAmount('')
          setAllowPartialPayment(true)
          setPaymentMethod(null)
          setPaymentError(null)
          setIsSubsequentPayment(true)
          setInitialPaymentStatus('partial')  // ADDED THIS LINE
          setShowPaymentConfirmationModal(true)
          setProcessing(false)
          return
        }
      }
      else if (newStatus === 'Delivered - Payment Not Collected') {
        const order = orders.find(o => o.id === orderId)
        if (order) {
          // Fetch fresh order data with final weights from database
          const { data: freshOrder, error } = await supabase
            .from('orders')
            .select(`
              *,
              customers(*),
              order_items(*, products(*)),
              assigned_user:users!orders_assigned_to_fkey(username)
            `)
            .eq('id', orderId)
            .single()
          
          if (!error && freshOrder) {
            setCurrentOrderForPayment(freshOrder as Order)
          } else {
            setCurrentOrderForPayment(order)
          }
          
          setPaymentCollectedAmount(0)
          setPaymentMethod('Net')
          setAllowPartialPayment(false)
          setPaymentError(null)
          setIsSubsequentPayment(false)
          setInitialPaymentStatus('no_payment')  // ADDED THIS LINE
          setShowPaymentConfirmationModal(true)
          setProcessing(false)
          return
        }
      }
      else if (newStatus === 'Delivered') {
        const order = orders.find(o => o.id === orderId)
        if (order) {
          // Fetch fresh order data with final weights from database
          const { data: freshOrder, error } = await supabase
            .from('orders')
            .select(`
              *,
              customers(*),
              order_items(*, products(*)),
              assigned_user:users!orders_assigned_to_fkey(username)
            `)
            .eq('id', orderId)
            .single()
          
          const orderToUse = (!error && freshOrder) ? freshOrder as Order : order
          const totalAmount = orderToUse.total_amount || getOrderTotal(orderToUse)
          
          setCurrentOrderForPayment(orderToUse)
          setPaymentCollectedAmount(totalAmount)
          setAllowPartialPayment(true)
          setPaymentMethod(null)
          setPaymentError(null)
          setIsSubsequentPayment(false)
          setInitialPaymentStatus('full')  // ADDED THIS LINE
          setShowPaymentConfirmationModal(true)
          setProcessing(false)
          return
        }
      }
      else if (newStatus === 'Security Checked') {
        const order = orders.find(o => o.id === orderId)
        if (order) {
          setSelectedOrderForSecurityCheck(order)
          setShowSecurityCheckModal(true)
          setProcessing(false)
          return
        }
      }
      else {
        const updateData: any = { status: newStatus }

        if (newStatus === 'Completed') {
          updateData.completed_by = user.id
          updateData.completed_at = new Date().toISOString()
        }

        if (newStatus === 'Security Check Incomplete') {
          const order = orders.find(o => o.id === orderId)
          if (order) {
            setSelectedOrderForSecurity(order)
            
            if (order.security_check_notes) {
              try {
                const parsedNotes = JSON.parse(order.security_check_notes)
                if (parsedNotes.reasons && Array.isArray(parsedNotes.reasons)) {
                  setSelectedReasons(parsedNotes.reasons)
                }
                if (parsedNotes.customNote) {
                  setSecurityNotes(parsedNotes.customNote)
                }
              } catch (error) {
                setSecurityNotes(order.security_check_notes)
                setSelectedReasons([])
              }
            } else {
              setSecurityNotes('')
              setSelectedReasons([])
            }
            
            setShowSecurityModal(true)
            setProcessing(false)
            return
          }
        }

        if (newStatus === 'Security Check Bypassed Due to Off Hours') {
          updateData.security_check_status = 'bypassed'
          const bypassNote = {
            bypassed: true,
            reason: 'Bypassed due to off-hours operation',
            timestamp: new Date().toISOString(),
            bypassedBy: user.id,
            note: 'Security check was bypassed as it is outside regular working hours (6:00 AM - 6:00 PM)'
          }
          updateData.security_check_notes = JSON.stringify(bypassNote)
        }

        const { error } = await supabase
          .from('orders')
          .update(updateData)
          .eq('id', orderId)

        if (error) throw error
      }

      await fetchOrders()
    } catch (error) {
      console.error('Error updating order status:', error)
      alert('Failed to update order status')
    } finally {
      setProcessing(false)
    }
  }

  const handleSecurityCheckConfirm = async (
    orderId: string,
    updatedQuantities: { itemId: string; actualQuantity: number }[],
    notes: string
  ) => {
    setSecurityCheckLoading(true)
    try {
      console.log("Updating order items with quantities:", updatedQuantities)
      const itemUpdates = updatedQuantities.map(async (item) => {
        const { error: itemError } = await supabase
          .from('order_items')
          .update({ actual_quantity_after_security_check: item.actualQuantity })
          .eq('id', item.itemId)
        if (itemError) {
          console.error('Supabase error updating order item:', itemError);
          throw itemError;
        }
      })
      await Promise.all(itemUpdates)

      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'Security Checked',
          security_check_status: 'completed',
          security_check_notes: notes,
        })
        .eq('id', orderId)

      if (orderError) {
        console.error('Supabase error updating order status:', orderError);
        throw orderError;
      }

      alert('Order successfully marked as Security Checked with updated quantities!')
      fetchOrders()
      setShowSecurityCheckModal(false)
      setSelectedOrderForSecurityCheck(null)
    } catch (error: any) {
      console.error('Error confirming security check:', error)
      alert(`Failed to confirm security check: ${error.message || 'Unknown error'}`)
      throw error
    } finally {
      setSecurityCheckLoading(false)
    }
  }

  const handleConfirmPayment = async (
    orderId: string, 
    method: 'Net' | 'Cash' | 'Cheque' | null,
    newlyCollectedAmount: number,
    isSubsequent: boolean,
    intendedStatus: Order['status'],
    chequeNumber?: string,
    chequeDate?: string,
    finalDeliveryWeightsData?: Record<string, number>
  ): Promise<string> => {
    setProcessingPayment(true)
    setIsSubsequentPayment(isSubsequent)
    setPaymentError(null)
    
    const paymentReceiptNo = await generatePaymentReceiptNo(orderId, orderToUpdate.order_display_id || 'SO-UNKNOWN');
    
    try {
      const orderToUpdate = orders.find(o => o.id === orderId);
      if (!orderToUpdate || orderToUpdate.total_amount === undefined) {
        throw new Error('Order not found or total amount is missing.')
      }
      
      // Recalculate total based on final delivery weights if provided
      let recalculatedTotal = orderToUpdate.total_amount
      let recalculatedVatAmount = orderToUpdate.vat_amount

      if (finalDeliveryWeightsData && Object.keys(finalDeliveryWeightsData).length > 0) {
        recalculatedTotal = calculateOrderTotalWithFinalWeights(orderToUpdate, finalDeliveryWeightsData)
        
        // Recalculate VAT amount
        if (orderToUpdate.is_vat_applicable) {
          const subtotal = recalculatedTotal / 1.18 // Remove VAT to get subtotal
          recalculatedVatAmount = recalculatedTotal - subtotal
        } else {
          recalculatedVatAmount = 0
        }
      }

      const currentCollected = orderToUpdate.collected_amount || 0;
      const newTotalCollectedAmount = currentCollected + newlyCollectedAmount;

      const finalPaymentStatus = newlyCollectedAmount === 0 ? 'unpaid' : (newTotalCollectedAmount >= recalculatedTotal ? 'fully_paid' : 'partially_paid');
      let newOrderStatus: Order['status'];
      
      if (newlyCollectedAmount === 0) {
        newOrderStatus = 'Delivered - Payment Not Collected';
        method = null;
      } else if (finalPaymentStatus === 'fully_paid') {
        newOrderStatus = 'Delivered';
      } else if (finalPaymentStatus === 'partially_paid') {
        newOrderStatus = 'Delivered - Payment Partially Collected';
      } else {
        newOrderStatus = 'Delivered';
      }

      const { data: updatedOrder, error: updateError } = await supabase
        .from('orders')
        .update({
          status: newOrderStatus,
          payment_status: finalPaymentStatus,
          collected_amount: newTotalCollectedAmount,
          payment_method: method,
          completed_at: new Date().toISOString(),
          completed_by: user?.id,
          total_amount: recalculatedTotal, // Update with recalculated total
          vat_amount: recalculatedVatAmount, // Update with recalculated VAT
        })
        .eq('id', orderId)
        .select('receipt_no')
        .single()

      if (updateError) throw updateError
      if (!updatedOrder || !updatedOrder.receipt_no) {
        throw new Error('Failed to get receipt number after update.')
      }

      if (newlyCollectedAmount > 0) {
        const { error: paymentInsertError } = await supabase
          .from('order_payments')
          .insert({
            order_id: orderId,
            amount: newlyCollectedAmount,
            payment_method: method || 'Cash',
            receipt_no: paymentReceiptNo,
            collected_by: user?.id,
            cheque_number: method === 'Cheque' ? chequeNumber : null,
            cheque_date: method === 'Cheque' ? chequeDate : null,
          });
        
        if (paymentInsertError) {
          console.error('Error inserting into order_payments:', paymentInsertError);
        }
      }

      // Update final delivery weights in order_items
      if (finalDeliveryWeightsData && Object.keys(finalDeliveryWeightsData).length > 0) {
        for (const [itemId, weight] of Object.entries(finalDeliveryWeightsData)) {
          const { error: updateItemError } = await supabase
            .from('order_items')
            .update({ final_delivery_weight_kg: weight })
            .eq('id', itemId)
          
          if (updateItemError) {
            console.error('Error updating final delivery weight for item:', itemId, updateItemError)
          }
        }
      }

      const updatedOrderForPrint = {
        ...orderToUpdate,
        collected_amount: newTotalCollectedAmount,
        payment_status: finalPaymentStatus,
        receipt_no: updatedOrder.receipt_no,
        total_amount: recalculatedTotal, // Add recalculated total
        vat_amount: recalculatedVatAmount, // Add recalculated VAT
      };
      
      const previouslyCollectedForPrint = currentCollected;
      const remainingBalanceForPrint = recalculatedTotal - newTotalCollectedAmount;

      console.log('=== Attempting to send bill email ===')
      
      if (orderToUpdate.customers.email) {
        const emailData = {
          customerEmail: orderToUpdate.customers.email,
          customerName: orderToUpdate.customers.name,
          orderDisplayId: orderToUpdate.order_display_id || 'N/A',
          receiptNo: updatedOrder.receipt_no,
          totalAmount: recalculatedTotal, // Use recalculated total
          paymentMethod: method || 'N/A',
          orderItems: orderToUpdate.order_items.map(item => ({
            productName: item.products.name,
            quantity: finalDeliveryWeightsData && finalDeliveryWeightsData[item.id] > 0 
              ? finalDeliveryWeightsData[item.id] 
              : item.quantity,
            price: item.price,
            total: finalDeliveryWeightsData && finalDeliveryWeightsData[item.id] > 0 
              ? finalDeliveryWeightsData[item.id] * item.price 
              : item.quantity * item.price,
            isFinalDeliveryWeight: finalDeliveryWeightsData && finalDeliveryWeightsData[item.id] > 0
          })),
          orderDate: new Date(orderToUpdate.created_at).toLocaleDateString(),
          salesRepName: orderToUpdate.assigned_user?.username || 'N/A',
          vehicleNumber: orderToUpdate.vehicle_number,
          orderId: orderToUpdate.id,
          subTotal: recalculatedTotal - recalculatedVatAmount,
          vatAmount: recalculatedVatAmount,
          isVatApplicable: orderToUpdate.is_vat_applicable || false,
          transactionAmount: newlyCollectedAmount,
          previouslyCollected: previouslyCollectedForPrint,
          remainingBalance: recalculatedTotal - newTotalCollectedAmount,
          finalDeliveryWeights: finalDeliveryWeightsData || {}
        }

        console.log('Sending email with data:', emailData)
        
        const emailResult = await sendBillEmail(emailData)
        
        if (emailResult.success) {
          console.log('✅ Email sent successfully')
          alert('Payment confirmed and receipt email sent to customer!')
        } else {
          console.error('❌ Email send failed:', emailResult.error)
          alert(`Payment confirmed, but email failed to send: ${emailResult.error}`)
        }
      } else {
        console.warn('⚠️ No customer email found, skipping email send')
        alert('Payment confirmed! Note: No email address found for customer.')
      }

      return paymentReceiptNo;
    } catch (err: any) {
      console.error('Error confirming payment:', err)
      setPaymentError(err.message || 'Failed to confirm payment.')
      throw err
    } finally {
      setProcessingPayment(false)
    }
  }

  const handleBypassSecurityCheck = async (orderId: string) => {
    if (!user || user.role !== 'Security Guard') return
    
    setProcessing(true)
    try {
      const bypassNote = {
        bypassed: true,
        reason: 'Bypassed due to off-hours operation',
        timestamp: new Date().toISOString(),
        bypassedBy: user.id,
        note: 'Security check was bypassed as it is outside regular working hours (6:00 AM - 6:00 PM)'
      }

      const { error } = await supabase
        .from('orders')
        .update({
          status: 'Security Check Bypassed Due to Off Hours',
          security_check_status: 'bypassed',
          security_check_notes: JSON.stringify(bypassNote)
        })
        .eq('id', orderId)

      if (error) throw error

      alert('Security check bypassed successfully due to off-hours operation.')
      await fetchOrders()
    } catch (error) {
      console.error('Error bypassing security check:', error)
      alert('Failed to bypass security check. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

    const handlePrintBill = async (
    order: Order,
    paymentMethod: 'Net' | 'Cash' | 'Cheque' | null,
    receiptNo: string,
    transactionAmount: number,
    previouslyCollected: number,
    totalCollected: number,
    remainingBalance: number,
    paymentStatusText?: string,
    subtotal?: number,
    discountAmount?: number,
    vatAmount?: number,
    grandTotal?: number,
    finalDeliveryWeights?: Record<string, number>
  ) => {
    try {
      // Determine if mobile/tablet and use mPrint
      const isMobile = isMobileOrTablet();
      
      // Recalculate totals if final delivery weights are provided
      let totalAmount = grandTotal || order.total_amount || getOrderTotal(order);
      let vatAmountValue = vatAmount || order.vat_amount || 0;
      let subtotalValue = subtotal || (totalAmount - vatAmountValue);

      if (finalDeliveryWeights && Object.keys(finalDeliveryWeights).length > 0) {
        let newSubtotal = 0;
        order.order_items.forEach(item => {
          const quantity = finalDeliveryWeights[item.id] > 0 
            ? finalDeliveryWeights[item.id] 
            : item.quantity;
          const discountFactor = item.discount ? (1 - item.discount / 100) : 1;
          newSubtotal += (quantity * item.price * discountFactor);
        });
        
        subtotalValue = newSubtotal;
        
        if (order.is_vat_applicable) {
          vatAmountValue = newSubtotal * 0.18;
          totalAmount = newSubtotal + vatAmountValue;
        } else {
          totalAmount = newSubtotal;
        }
      }
      
      const isSecurityGuard = user?.role === 'Security Guard';
      
      // Generate order items body
      const orderItemsBody = order.order_items.map((item, index) => {
        const displayQuantity = finalDeliveryWeights && finalDeliveryWeights[item.id] > 0 
          ? finalDeliveryWeights[item.id] 
          : item.quantity;
        const itemTotal = finalDeliveryWeights && finalDeliveryWeights[item.id] > 0 
          ? (finalDeliveryWeights[item.id] * item.price).toFixed(2)
          : (item.quantity * item.price).toFixed(2);
        const productId = item.products.product_id || item.products.sku || item.products?.id || 'N/A';
        const isLastItem = index === order.order_items.length - 1;
        
        return `
          <div style="margin-bottom: 10px; padding-bottom: 8px; ${!isLastItem ? 'border-bottom: 1px dashed #ccc;' : ''}">
            <div style="font-weight: bold; font-size: 11px;">${item.products.name}</div>
            <div style="font-size: 10px; color: #666;">ID: ${productId}</div>
            <div style="display: flex; justify-content: space-between; font-size: 10px; margin-top: 3px;">
              <span>${displayQuantity} ${item.products.unit_type || 'Kg'} × ${formatCurrency(item.price)}</span>
              <strong>${formatCurrency(parseFloat(itemTotal))}</strong>
            </div>
          </div>
        `;
      }).join('');

      // UNIFIED VERSION - Single 80mm layout for both mobile and desktop
      const billHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
          </head>
          <body style="font-family: 'Courier New', monospace; margin: 0; padding: 5px 3px; background: white; color: #000; font-size: 12px; line-height: 1.6; width: 80mm; box-sizing: border-box;">

            <div style="width: 80mm; margin: 0; padding: 0;">
              <div style="text-align: center; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 10px;">
                <h1 style="font-size: 18px; font-weight: bold; margin: 0 0 3px 0; letter-spacing: 1px;">WEEHENA FARMS</h1>
                <p style="margin: 0; font-size: 10px; color: #333;">A Taste with Quality</p>
                <div style="background-color: #f0f0f0; padding: 6px 0; margin: 8px 0; border: 1px solid #000; border-radius: 3px; font-size: 13px; font-weight: bold; letter-spacing: 0.5px;">SALES ORDER</div>
                <h2 style="font-size: 16px; font-weight: bold; margin: 8px 0 5px 0;">SALES RECEIPT</h2>
                <p style="font-size: 11px; margin: 3px 0;">Date: ${new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                <p style="font-size: 11px; margin: 3px 0;">Receipt No: <span style="font-weight: bold;">${order.receipt_no}</span></p>
              </div>

              <div style="margin-bottom: 15px; font-size: 11px; line-height: 1.7;">
                <p style="font-size: 12px; font-weight: bold; margin: 0 0 5px 0; border-bottom: 1px dashed #000; padding-bottom: 3px;">BILL TO:</p>
                <div style="margin: 3px 0; font-weight: bold;">${order.customers.name}</div>
                <div style="margin: 3px 0;">${order.customers.address}</div>
                <div style="margin: 3px 0;">Phone: ${order.customers.phone_number}</div>
                ${order.customers.email ? `<div style="margin: 3px 0;">Email: ${order.customers.email}</div>` : ''}
                ${order.customers.vat_status === 'VAT' ? `<div style="margin: 3px 0;">VAT Status: ${order.customers.vat_status}</div>` : ''}
                ${order.customers.vat_status === 'VAT' && order.customers.tin_number ? `<div style="margin: 3px 0; font-weight: bold;">TIN: ${order.customers.tin_number}</div>` : ''}
              </div>

              <div style="margin-bottom: 15px; font-size: 11px; line-height: 1.7;">
                <p style="font-size: 12px; font-weight: bold; margin: 0 0 5px 0; border-bottom: 1px dashed #000; padding-bottom: 3px;">ORDER DETAILS:</p>
                <div style="margin: 3px 0;">Order ID: <span style="font-weight: bold;">${order.order_display_id}</span></div>
                <div style="margin: 3px 0;">Payment Method: <span style="font-weight: bold;">${paymentMethod === null ? 'N/A' : paymentMethod}</span></div>
                <div style="margin: 3px 0;">Sales Rep: <span style="font-weight: bold;">${order.assigned_user?.username || 'N/A'}</span></div>
                ${order.vehicle_number ? `<div style="margin: 3px 0;">Vehicle No: <span style="font-weight: bold;">${order.vehicle_number}</span></div>` : ''}
              </div>

              <div style="margin-bottom: 15px;">
                <p style="font-size: 12px; font-weight: bold; margin: 0 0 8px 0; border-bottom: 2px solid #000; padding-bottom: 4px;">ORDER ITEMS:</p>
                ${orderItemsBody}
                
                <div style="margin-top: 12px; border-top: 2px solid #000; padding-top: 8px;">
                  <div style="display: flex; justify-content: space-between; margin: 5px 0; font-size: 11px;">
                    <span>Subtotal:</span>
                    <span style="font-weight: bold; text-align: right;">${formatCurrency(subtotalValue)}</span>
                  </div>
                  ${order.is_vat_applicable ? `
                    <div style="display: flex; justify-content: space-between; margin: 5px 0; font-size: 11px;">
                      <span>VAT (18%):</span>
                      <span style="font-weight: bold; text-align: right;">${formatCurrency(vatAmountValue)}</span>
                    </div>
                  ` : ''}
                  <div style="display: flex; justify-content: space-between; margin: 8px 0; padding: 8px 0; border-top: 2px solid #000; border-bottom: 2px double #000; font-size: 13px; font-weight: bold;">
                    <span>GRAND TOTAL:</span>
                    <span style="font-size: 14px; text-align: right;">${formatCurrency(totalAmount)}</span>
                  </div>
                </div>
              </div>

              <div style="margin-bottom: 15px; padding: 10px; background-color: #f9f9f9; border: 1px solid #ccc; border-radius: 3px;">
                <p style="font-size: 12px; font-weight: bold; margin: 0 0 8px 0; text-align: center;">PAYMENT SUMMARY</p>
                ${previouslyCollected > 0 ? `
                  <div style="display: flex; justify-content: space-between; margin: 6px 0; font-size: 11px; line-height: 1.7;">
                    <span>Previously Collected:</span>
                    <span style="font-weight: bold; text-align: right;">${formatCurrency(previouslyCollected)}</span>
                  </div>
                ` : ''}
                ${transactionAmount > 0 ? `
                  <div style="display: flex; justify-content: space-between; margin: 6px 0; font-size: 11px; line-height: 1.7;">
                    <span>Collected This Transaction:</span>
                    <span style="font-weight: bold; text-align: right;">${formatCurrency(transactionAmount)}</span>
                  </div>
                ` : ''}
                ${totalCollected > 0 ? `
                  <div style="display: flex; justify-content: space-between; margin: 6px 0; font-size: 11px; line-height: 1.7;">
                    <span>Total Collected:</span>
                    <span style="font-weight: bold; text-align: right;">${formatCurrency(totalCollected)}</span>
                  </div>
                ` : ''}
                ${remainingBalance > 0 ? `
                  <div style="display: flex; justify-content: space-between; margin: 6px 0; font-size: 11px; line-height: 1.7; border-top: 1px dashed #000; padding-top: 6px; color: #c00;">
                    <span style="font-weight: bold;">Remaining Balance:</span>
                    <span style="font-weight: bold; font-size: 12px; text-align: right;">${formatCurrency(remainingBalance)}</span>
                  </div>
                ` : ''}
                ${paymentStatusText === 'Payment Not Collected' ? `
                  <div style="text-align: center; padding: 8px; margin: 8px 0 0 0; font-size: 12px; font-weight: bold; color: #c00; background-color: #ffe0e0; border: 1px solid #c00; border-radius: 3px;">
                    PAYMENT NOT COLLECTED
                  </div>
                ` : ''}
              </div>

              <div style="text-align: center; font-size: 10px; color: #333; padding-top: 12px; margin-top: 12px; border-top: 2px dashed #000; line-height: 1.7;">
                <p style="margin: 4px 0; font-weight: bold;">Thank you for your business!</p>
                <p style="margin: 4px 0; font-weight: bold;">Weehena Farm - Quality Poultry Products</p>
                <p style="margin: 4px 0; font-weight: bold;">Contact: [Your Phone Number]</p>
                <p style="margin: 8px 0 0 0; font-size: 9px;">
                  Printed: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </body>
        </html>
      `;
  
      // ROUTE: Mobile/Tablet goes to mPrint, Desktop uses local print
      if (isMobile) {
        // Mobile/Tablet: Generate PDF and redirect to mPrint
        try {
          // Step 1: Validate HTML before PDF generation
          const htmlValidation = validateAndPrepareHTML(billHtml);
          if (!htmlValidation.isValid) {
            console.error('[Print] HTML validation failed:', htmlValidation.errors);
            alert('Bill content is invalid. Please try again.');
            return;
          }

          console.log('[Print Mobile] Starting PDF generation for mobile device');
          
          // Step 2: Generate PDF
          const pdfBlob = await generateBillPDF(billHtml, `bill-${receiptNo}`);
          
          // Step 3: Validate PDF blob
          const pdfValidation = validatePDFBlob(pdfBlob);
          if (!pdfValidation.isValid) {
            console.warn('[Print Mobile] PDF validation warning:', pdfValidation.reason);
            // If PDF is blank, fallback to local print instead
            if (pdfValidation.sizeKb < 8) {
              console.log('[Print Mobile] PDF appears blank, falling back to local print');
              const printWindow = window.open('', '_blank', 'width=380,height=600');
              if (printWindow) {
                printWindow.document.write(billHtml);
                printWindow.document.close();
                setTimeout(() => {
                  printWindow.focus();
                  printWindow.print();
                  setTimeout(() => {
                    printWindow.close();
                  }, 500);
                }, 500);
              }
              return;
            }
          }

          console.log('[Print Mobile] PDF generated successfully, size:', pdfValidation.sizeKb, 'KB');
          
          // Step 4: Track print method in database
          try {
            await supabase
              .from('orders')
              .update({ bill_print_method: 'mprint' })
              .eq('id', order.id);
          } catch (err) {
            console.warn('Warning: Could not update print method:', err);
          }

          // Step 5: Optional - Log to print_history table
          try {
            await supabase
              .from('print_history')
              .insert({
                order_id: order.id,
                print_method: 'mprint',
                printed_by: user?.id,
                device_type: 'mobile_or_tablet'
              });
          } catch (err) {
            console.warn('Warning: Could not log print history:', err);
          }

          // Step 6: Download the PDF which will trigger mPrint app on mobile
          downloadBillForMprint(pdfBlob, `bill-${receiptNo}`);
          
          alert('Bill PDF is ready. Opening mPrint app to print...');
        } catch (error) {
          console.error('[Print Mobile] Error:', error);
          alert('Failed to generate bill PDF. Using local print as fallback.');
          
          // Fallback to local print on any error
          const printWindow = window.open('', '_blank', 'width=380,height=600');
          if (printWindow) {
            printWindow.document.write(billHtml);
            printWindow.document.close();
            setTimeout(() => {
              printWindow.focus();
              printWindow.print();
              setTimeout(() => {
                printWindow.close();
              }, 500);
            }, 500);
          }
        }
      } else {
        // Desktop: Use existing print window behavior
        const printWindow = window.open('', '_blank', 'width=380,height=600');
        if (printWindow) {
          printWindow.document.write(billHtml);
          
          printWindow.document.close();

          setTimeout(() => {
            printWindow.focus();
            printWindow.print();
            
            // Track print method - using async IIFE to handle async operations
            (async () => {
              try {
                await supabase
                  .from('orders')
                  .update({ bill_print_method: 'local_print' })
                  .eq('id', order.id);
              } catch (err) {
                console.warn('Warning: Could not update print method:', err);
              }
            })();

            setTimeout(() => {
              printWindow.close();
            }, 500);
          }, 500);
        } else {
          alert('Please allow pop-ups to print the bill.');
        }
      }
    } catch (error) {
      console.error('Error in handlePrintBill:', error);
      alert('An error occurred while preparing the bill. Please try again.');
    }
  };
  
  const handleSecurityCheck = async (orderId: string, status: 'completed' | 'incomplete') => {
    if (!user || user.role !== 'Security Guard') return
    
    if (status === 'incomplete') {
      if (selectedReasons.length === 0 && !securityNotes.trim()) {
        alert('Please select at least one reason or provide custom notes for incomplete orders')
        return
      }
    }
    
    setProcessing(true)
    try {
      const securityStatus = status === 'completed' ? 'Security Checked' : 'Security Check Incomplete'
      
      const updateData: any = { 
        security_check_status: status,
        status: securityStatus
      }
      
      if (status === 'incomplete') {
        const securityData = {
          reasons: selectedReasons,
          customNote: securityNotes.trim()
        }
        updateData.security_check_notes = JSON.stringify(securityData)
      } else {
        updateData.security_check_notes = null
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId)
      if (error) throw error

      setShowSecurityModal(false)
      setSelectedOrderForSecurity(null)
      setSecurityNotes('')
      setSelectedReasons([])
      await fetchOrders()
    } catch (error) {
      console.error('Error updating security check:', error)
      alert('Failed to update security check')
    } finally {
      setProcessing(false)
    }
  }

  const handleReasonChange = (reason: string) => {
    setSelectedReasons(prev => 
      prev.includes(reason) 
        ? prev.filter(r => r !== reason)
        : [...prev, reason]
    )
  }

  const handleOpenReturnModal = (item: OrderItem) => {
    setSelectedOrderItem(item)
    setReturnQuantity(1)
    setReturnReason('')
    setShowReturnModal(true)
  }

  const handleProcessReturn = async () => {
    if (!selectedOrderItem || !user) return alert('Missing required information for return')
    if (returnQuantity <= 0) return alert('Return quantity must be greater than 0')
    if (!returnReason.trim()) return alert('Please provide a reason for the return')

    const availableToReturn = selectedOrderItem.quantity - (selectedOrderItem.returned_quantity || 0)
    if (returnQuantity > availableToReturn) {
      return alert(`Cannot return ${returnQuantity}. Only ${availableToReturn} available to return.`)
    }

    setProcessingReturn(true)
    try {
      const { data: currentOrderItem, error: fetchOrderItemError } = await supabase
        .from('order_items')
        .select('returned_quantity')
        .eq('id', selectedOrderItem.id)
        .single()

      if (fetchOrderItemError) throw fetchOrderItemError

      const currentReturnedQuantity = currentOrderItem?.returned_quantity || 0
      const newReturnedQuantity = currentReturnedQuantity + returnQuantity

      const { error: orderItemError } = await supabase
        .from('order_items')
        .update({ returned_quantity: newReturnedQuantity })
        .eq('id', selectedOrderItem.id)

      if (orderItemError) throw orderItemError

      const { error: returnError } = await supabase
        .from('order_returns')
        .insert([{
          order_item_id: selectedOrderItem.id,
          returned_quantity: returnQuantity,
          return_reason: returnReason.trim(),
          returned_by: user.id,
          returned_at: new Date().toISOString(),
          sales_rep_id: user.id
        }])
      if (returnError) throw returnError

      const { data: currentProduct, error: fetchProductError } = await supabase
        .from('products')
        .select('quantity')
        .eq('id', selectedOrderItem.products.id)
        .single()

      if (fetchProductError) throw fetchProductError

      const currentProductQuantity = currentProduct?.quantity || 0
      const newProductQuantity = currentProductQuantity + returnQuantity

      const { error: inventoryError } = await supabase
        .from('products')
        .update({ quantity: newProductQuantity })
        .eq('id', selectedOrderItem.products.id)

      if (inventoryError) throw inventoryError

      alert('Return processed successfully!')
      setShowReturnModal(false)
      setSelectedOrderItem(null)
      setReturnQuantity(0)
      setReturnReason('')
      await fetchOrders()
    } catch (error) {
      console.error('Error processing return:', error)
      alert('Failed to process return. Please try again.')
    } finally {
      setProcessingReturn(false)
    }
  }

  const openOrderModal = (order: Order) => {
    setSelectedOrder(order)
    setSecurityNotes(order.security_check_notes || '')
    setShowOrderModal(true)
  }

  const openSecurityModal = (order: Order) => {
    setSelectedOrderForSecurity(order)
    
    if (order.security_check_notes) {
      try {
        const parsedNotes = JSON.parse(order.security_check_notes)
        if (parsedNotes.reasons && Array.isArray(parsedNotes.reasons)) {
          setSelectedReasons(parsedNotes.reasons)
        }
        if (parsedNotes.customNote) {
          setSecurityNotes(parsedNotes.customNote)
        }
      } catch (error) {
        setSecurityNotes(order.security_check_notes)
        setSelectedReasons([])
      }
    } else {
      setSelectedReasons([])
      setSecurityNotes('')
    }
    
    setShowSecurityModal(true)
  }

  const getFilteredAndSearchedOrders = () => {
    let filtered = orders

    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase()
      filtered = filtered.filter(order =>
        order.order_display_id?.toLowerCase().includes(lowerCaseSearchTerm) ||
        order.customers.name.toLowerCase().includes(lowerCaseSearchTerm) ||
        order.purchase_order_id?.toLowerCase().includes(lowerCaseSearchTerm) ||
        order.assigned_user?.username?.toLowerCase().includes(lowerCaseSearchTerm) ||
        order.vehicle_number?.toLowerCase().includes(lowerCaseSearchTerm) ||
        (user?.role !== 'Security Guard' && (order.total_amount || getOrderTotal(order)).toFixed(2).includes(lowerCaseSearchTerm)) ||
        order.status.toLowerCase().includes(lowerCaseSearchTerm)
      )
    }

    return filtered
  }

  const getPendingBalance = (order: Order) => {
    const totalAmount = order.total_amount || getOrderTotal(order)
    const collectedAmount = order.collected_amount || 0
    return totalAmount - collectedAmount
  }

  const renderPaymentStatus = (order: Order) => {
    const paymentStatus = order.payment_status || 'unpaid'
    const pendingBalance = getPendingBalance(order)
    
    let badgeClass = ''
    let statusText = ''
    
    switch (paymentStatus) {
      case 'fully_paid':
        badgeClass = 'bg-green-100 text-green-800'
        statusText = 'Fully Paid'
        break
      case 'partially_paid':
        badgeClass = 'bg-blue-100 text-blue-800'
        statusText = 'Partially Paid'
        break
      case 'unpaid':
      default:
        badgeClass = 'bg-red-100 text-red-800'
        statusText = 'Unpaid'
        break
    }
    
    return (
      <div className="flex flex-col space-y-1">
        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${badgeClass}`}>
          {statusText}
        </span>
        {paymentStatus === 'partially_paid' && (
          <span className="text-xs text-gray-600">
            Pending: {formatCurrency(pendingBalance)}
          </span>
        )}
      </div>
    )
  }

  const renderSecurityCheckNotes = (notes: string | null | undefined) => {
    if (!notes) {
      return (
        <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
          No notes provided.
        </div>
      )
    }

    try {
      const parsedNotes = JSON.parse(notes)
      
      if (parsedNotes.bypassed) {
        return (
          <div className="mt-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-center mb-2">
              <ShieldOff className="w-4 h-4 text-yellow-600 mr-2" />
              <strong className="text-yellow-800">Security Check Bypassed</strong>
            </div>
            <p className="text-sm text-yellow-700 mb-1">{parsedNotes.note}</p>
            <p className="text-xs text-yellow-600">Reason: {parsedNotes.reason}</p>
            <p className="text-xs text-yellow-600">
              Bypassed at: ${new Date(parsedNotes.timestamp).toLocaleString()}
            </p>
            </div>
        )
      }

      return (
        <div className="mt-2 p-3 bg-gray-50 rounded-lg">
          {parsedNotes.reasons && parsedNotes.reasons.length > 0 && (
            <div className="mb-2">
              <strong>Reasons:</strong>
              <ul className="list-disc list-inside mt-1">
                {parsedNotes.reasons.map((reason: string, index: number) => (
                  <li key={index} className="text-sm text-gray-700">{reason}</li>
                ))}
              </ul>
            </div>
          )}
          {parsedNotes.customNote && (
            <div>
              <strong>Additional Notes:</strong>
              <p className="text-sm text-gray-700 mt-1">{parsedNotes.customNote}</p>
            </div>
          )}
        </div>
      )
    } catch (error) {
      return (
        <div className="mt-2 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-700">
            <strong>Notes:</strong> {notes}
          </p>
        </div>
      )
    }
  }

  if (loading && orders.length === 0) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-500">Loading orders...</div>
    </div>
  )

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Orders</h1>
          <p className="text-sm text-gray-600">Manage all orders and returns</p>
        </div>
        <button
          onClick={handleExportToExcel}
          disabled={filteredOrders.length === 0}
          className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4 mr-2" />
          Export to Excel
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              {['Pending', 'Assigned', 'Products Loaded', 'Product Reloaded', 'Security Check Incomplete', 'Security Checked', 'Security Check Bypassed Due to Off Hours', 'Departed Farm', 'Delivered', 'Cancelled', 'Completed', 'Delivered - Payment Partially Collected', 'Delivered - Payment Not Collected'].map(status => (
                <option key={status} value={status}>{status === 'Delivered' ? 'Delivered - Full Payment Collected' : status === 'Delivered - Payment Partially Collected' ? 'Delivered - Partial Payment Collected' : status === 'Delivered - Payment Not Collected' ? 'Delivered - No Payment Collected' : status}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="all">All Customers</option>
              {customersList.map(customer => (
                <option key={customer.id} value={customer.id}>{customer.name}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Truck className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select
              value={salesRepFilter}
              onChange={(e) => setSalesRepFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="all">All Sales Reps</option>
              {salesRepsList.map(rep => (
                <option key={rep.id} value={rep.id}>{rep.username}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="date"
              value={deliveryDateFilter}
              onChange={(e) => setDeliveryDateFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="Delivery Date"
            />
          </div>

          <div className="relative md:col-span-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search all fields..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="block md:hidden">
          <div className="space-y-2">
            {getCurrentPageOrders().map((order) => (
              <div key={order.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="flex items-start justify-between mb-3 pb-3 border-b border-gray-100">
                  <div className="flex items-start flex-1 min-w-0">
                    <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                      <FileText className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-900 mb-1">
                        Order {order.order_display_id}
                      </h3>
                      <div className="flex items-start mt-1">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] leading-tight font-medium max-w-full ${
                          order.status === 'Delivered' || order.status === 'Completed'
                            ? 'bg-green-100 text-green-800'
                            : order.status === 'Security Check Incomplete'
                            ? 'bg-red-100 text-red-800'
                            : order.status === 'Security Checked'
                            ? 'bg-blue-100 text-blue-800'
                            : order.status === 'Security Check Bypassed Due to Off Hours'
                            ? 'bg-yellow-100 text-yellow-800'
                            : order.status === 'Delivered - Payment Not Collected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {order.status === 'Delivered' ? 'Delivered - Full Payment Collected' : 
                           order.status === 'Delivered - Payment Partially Collected' ? 'Delivered - Partial Payment Collected' :
                           order.status === 'Delivered - Payment Not Collected' ? 'Delivered - No Payment Collected' :
                           order.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-3">
                    {hasChickenProducts(order) && user?.role === 'Sales Rep' && (
                      <button
                        onClick={() => handleOpenWeightModal(order)}
                        className="p-2.5 text-amber-600 bg-amber-100 rounded-full hover:bg-amber-200 touch-manipulation"
                        title="Manage Final Delivery Weights"
                      >
                        <Scale className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => openOrderModal(order)}
                      className="p-2.5 text-blue-600 bg-blue-100 rounded-full hover:bg-blue-200 touch-manipulation"
                      title="View Details"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2 text-xs">
                  <div className="flex items-start">
                    <span className="text-gray-500 font-medium w-24 flex-shrink-0">Customer:</span>
                    <span className="text-gray-700 flex-1 break-words">{order.customers.name}</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-gray-500 font-medium w-24 flex-shrink-0">Sales Rep:</span>
                    <span className="text-gray-700 flex-1 break-words">{order.assigned_user?.username || 'Unassigned'}</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-gray-500 font-medium w-24 flex-shrink-0">Vehicle:</span>
                    <span className="text-gray-700 flex-1">{order.vehicle_number || 'N/A'}</span>
                  </div>
                  {user?.role !== 'Security Guard' && (
                    <>
                      <div className="flex items-start">
                        <span className="text-gray-500 font-medium w-24 flex-shrink-0">Total:</span>
                        <span className="text-gray-700 flex-1 font-semibold">{formatCurrency(order.total_amount || getOrderTotal(order))}</span>
                      </div>
                      {(user?.role === 'Finance Admin' || user?.role === 'Admin' || user?.role === 'Super Admin') && (
                        <>
                          <div className="flex items-start">
                            <span className="text-gray-500 font-medium w-24 flex-shrink-0">Collected:</span>
                            <span className="text-gray-700 flex-1 font-semibold">{formatCurrency(order.collected_amount || 0)}</span>
                          </div>
                          <div className="flex items-start">
                            <span className="text-gray-500 font-medium w-24 flex-shrink-0">Pending:</span>
                            <span className="text-gray-700 flex-1 font-semibold">{formatCurrency(getPendingBalance(order))}</span>
                          </div>
                          <div className="flex items-start">
                            <span className="text-gray-500 font-medium w-24 flex-shrink-0">Payment:</span>
                            <div className="flex-1">
                              {renderPaymentStatus(order)}
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}
                  
                  <div className="flex items-start">
                    <span className="text-gray-500 font-medium w-24 flex-shrink-0">Delivery:</span>
                    <span className="text-gray-700 flex-1">{order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : 'N/A'}</span>
                  </div>
                  {order.completed_at && (
                    <div className="flex items-start">
                      <span className="text-gray-500 font-medium w-24 flex-shrink-0">Completed:</span>
                      <span className="text-gray-700 flex-1 text-[11px] leading-tight">{new Date(order.completed_at).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex items-start pt-3 border-t border-gray-200 mt-3">
                    <span className="text-gray-500 font-medium w-24 flex-shrink-0 pt-2">Status:</span>
                    <div className="flex-1">
                      <select
                        value={order.status}
                        onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value as Order['status'])}
                        disabled={processing}
                        className="w-full text-xs border border-gray-300 rounded-md px-2 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        {getAvailableStatusOptions(order).map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {user?.role === 'Security Guard' && order.status === 'Security Check Incomplete' && isOffHoursSriLanka() && (
                    <div className="pt-3 mt-3 border-t border-gray-200">
                      <button
                        onClick={() => handleBypassSecurityCheck(order.id)}
                        disabled={processing}
                        className="w-full flex items-center justify-center px-4 py-2.5 bg-yellow-500 text-white text-xs font-medium rounded-md hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ShieldOff className="w-4 h-4 mr-2" />
                        Bypass Security Check (Off Hours)
                      </button>
                    </div>
                  )}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purchase Order ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned Sales Rep</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle Number</th>
                  {user?.role !== 'Security Guard' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delivery Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {getCurrentPageOrders().map((order, index) => (
                  <tr key={order.id} className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-gray-100`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {order.order_display_id}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.customers.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.purchase_order_id || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.assigned_user?.username || 'Unassigned'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.vehicle_number || '-'}
                    </td>
                    {user?.role !== 'Security Guard' && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(order.total_amount || getOrderTotal(order))}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.delivery_date ? new Date(order.delivery_date).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
                        order.status === 'Delivered' || order.status === 'Completed'
                          ? 'bg-green-100 text-green-800'
                          : order.status === 'Security Check Incomplete'
                          ? 'bg-red-100 text-red-800'
                          : order.status === 'Security Checked'
                          ? 'bg-blue-100 text-blue-800'
                          : order.status === 'Security Check Bypassed Due to Off Hours'
                          ? 'bg-yellow-100 text-yellow-800'
                          : order.status === 'Delivered - Payment Not Collected'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {order.status === 'Delivered' ? 'Delivered - Full Payment Collected' : 
                         order.status === 'Delivered - Payment Partially Collected' ? 'Delivered - Partial Payment Collected' :
                         order.status === 'Delivered - Payment Not Collected' ? 'Delivered - No Payment Collected' :
                         order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2 items-center">
                        {hasChickenProducts(order) && user?.role === 'Sales Rep' && (
                          <button
                            onClick={() => handleOpenWeightModal(order)}
                            className="p-2 text-amber-600 hover:text-amber-900 rounded-full hover:bg-amber-100"
                            title="Manage Final Delivery Weights"
                          >
                            <Scale className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => openOrderModal(order)}
                          className="p-2 text-blue-600 hover:text-blue-900 rounded-full hover:bg-blue-100"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <select
                          value={order.status}
                          onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value as Order['status'])}
                          disabled={processing}
                          className="text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-500"
                        >
                          {getAvailableStatusOptions(order).map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>

                        {user?.role === 'Security Guard' && order.status === 'Security Check Incomplete' && isOffHoursSriLanka() && (
                          <button
                            onClick={() => handleBypassSecurityCheck(order.id)}
                            disabled={processing}
                            className="flex items-center px-3 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50 text-sm"
                            title="Bypass Security Check (Off Hours)"
                          >
                            <ShieldOff className="w-4 h-4 mr-1" />
                            Bypass
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="mt-6 flex items-center justify-between bg-white rounded-lg shadow p-4">
        <div className="text-sm text-gray-600">
          Showing {currentPage === 1 ? 1 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredOrders.length)} of {filteredOrders.length} orders
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Previous Page"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <div className="flex items-center space-x-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  currentPage === page
                    ? 'bg-red-500 text-white font-semibold'
                    : 'text-gray-700 border border-gray-300 hover:bg-gray-100'
                }`}
              >
                {page}
              </button>
            ))}
          </div>
          
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Next Page"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {showOrderModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Order Details {selectedOrder.order_display_id}</h2>
              <button onClick={() => setShowOrderModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>

            {/* Customer Information Section */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Customer Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div className="flex items-center">
                  <span className="font-medium text-gray-600 w-24 flex-shrink-0">Name:</span>
                  <span className="text-gray-800">{selectedOrder.customers.name}</span>
                </div>
                <div className="flex items-center">
                  <span className="font-medium text-gray-600 w-24 flex-shrink-0">Address:</span>
                  <span className="text-gray-800">{selectedOrder.customers.address}</span>
                </div>
                <div className="flex items-center">
                  <span className="font-medium text-gray-600 w-24 flex-shrink-0">Phone:</span>
                  <span className="text-gray-800">{selectedOrder.customers.phone_number}</span>
                </div>
                {selectedOrder.customers.email && (
                  <div className="flex items-center">
                    <span className="font-medium text-gray-600 w-24 flex-shrink-0">Email:</span>
                    <span className="text-gray-800">{selectedOrder.customers.email}</span>
                  </div>
                )}
                {user?.role !== 'Security Guard' && (
                  <>
                    <div className="flex items-center">
                      <span className="font-medium text-gray-600 w-24 flex-shrink-0">VAT Status:</span>
                      <span className="text-gray-800">{selectedOrder.customers.vat_status || 'Not specified'}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium text-gray-600 w-24 flex-shrink-0">Payment Category:</span>
                      <span className="text-gray-800">{selectedOrder.customers.payment_category || 'Not specified'}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Order General Details Section */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Order General Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {selectedOrder.purchase_order_id && (
                  <div className="flex items-center">
                    <span className="font-medium text-gray-600 w-24 flex-shrink-0">PO ID:</span>
                    <span className="text-gray-800">{selectedOrder.purchase_order_id}</span>
                  </div>
                )}
                {selectedOrder.vehicle_number && (
                  <div className="flex items-center">
                    <span className="font-medium text-gray-600 w-24 flex-shrink-0">Vehicle:</span>
                    <span className="text-gray-800">{selectedOrder.vehicle_number}</span>
                  </div>
                )}
                {selectedOrder.delivery_date && (
                  <div className="flex items-center">
                    <span className="font-medium text-gray-600 w-24 flex-shrink-0">Delivery Date:</span>
                    <span className="text-gray-800">{new Date(selectedOrder.delivery_date).toLocaleDateString()}</span>
                  </div>
                )}
                {selectedOrder.created_at && (
                  <div className="flex items-center">
                    <span className="font-medium text-gray-600 w-24 flex-shrink-0">Created At:</span>
                    <span className="text-gray-800">{new Date(selectedOrder.created_at).toLocaleString()}</span>
                  </div>
                )}
                {selectedOrder.completed_at && (
                  <div className="flex items-center">
                    <span className="font-medium text-gray-600 w-24 flex-shrink-0">Completed At:</span>
                    <span className="text-gray-800">{new Date(selectedOrder.completed_at).toLocaleString()}</span>
                  </div>
                )}
                {selectedOrder.assigned_user && (
                  <div className="flex items-center">
                    <span className="font-medium text-gray-600 w-24 flex-shrink-0">Sales Rep:</span>
                    <span className="text-gray-800">{selectedOrder.assigned_user.username}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Payment & VAT Information Section - Hidden for Security Guard */}
            {user?.role !== 'Security Guard' && (
              <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h3 className="text-lg font-semibold text-blue-800 mb-3">VAT Information</h3>
                  <div className="grid grid-cols-1 gap-y-2 text-sm">
                    <div className="flex items-center">
                      <span className="font-medium text-blue-700 w-32 flex-shrink-0">VAT Applicable:</span>
                      <span className="text-blue-900">{selectedOrder.is_vat_applicable ? 'Yes' : 'No'}</span>
                    </div>
                    {selectedOrder.is_vat_applicable && (
                      <>
                        <div className="flex items-center">
                          <span className="font-medium text-blue-700 w-32 flex-shrink-0">VAT Amount:</span>
                          <span className="text-blue-900">{formatCurrency(selectedOrder.vat_amount || 0)}</span>
                        </div>
                        <div className="flex items-center">
                          <span className="font-medium text-blue-700 w-32 flex-shrink-0">Subtotal:</span>
                          <span className="text-blue-900">{formatCurrency((selectedOrder.total_amount || getOrderTotal(selectedOrder)) - (selectedOrder.vat_amount || 0))}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h3 className="text-lg font-semibold text-green-800 mb-3">Payment Information</h3>
                  <div className="grid grid-cols-1 gap-y-2 text-sm">
                    <div className="flex items-center">
                      <span className="font-medium text-green-700 w-32 flex-shrink-0">Total Amount:</span>
                      <span className="text-green-900">{formatCurrency(selectedOrder.total_amount || getOrderTotal(selectedOrder))}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium text-green-700 w-32 flex-shrink-0">Collected Amount:</span>
                      <span className="text-green-900">{formatCurrency(selectedOrder.collected_amount || 0)}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium text-green-700 w-32 flex-shrink-0">Pending Balance:</span>
                      <span className="text-green-900">{formatCurrency(getPendingBalance(selectedOrder))}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium text-green-700 w-32 flex-shrink-0">Payment Method:</span>
                      <span className="text-green-900">{selectedOrder.payment_method || 'N/A'}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium text-green-700 w-32 flex-shrink-0">Receipt No:</span>
                      <span className="text-green-900">{selectedOrder.receipt_no || 'N/A'}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium text-green-700 w-32 flex-shrink-0">Payment Status:</span>
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        selectedOrder.payment_status === 'fully_paid' ? 'bg-green-100 text-green-800' :
                        selectedOrder.payment_status === 'partially_paid' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {selectedOrder.payment_status === 'fully_paid' ? 'Fully Paid' :
                         selectedOrder.payment_status === 'partially_paid' ? 'Partially Paid' : 'Unpaid'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Weight Verification Section */}
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-800 mb-3">Weight Verification</h3>
              <div className="flex items-center space-x-2 mb-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  selectedOrder.security_check_status === 'completed'
                    ? 'bg-green-100 text-green-800'
                    : selectedOrder.security_check_status === 'incomplete'
                    ? 'bg-red-100 text-red-800'
                    : selectedOrder.security_check_status === 'bypassed'
                    ? 'bg-orange-100 text-orange-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {selectedOrder.security_check_status === 'completed' ? 'Checked Complete' :
                   selectedOrder.security_check_status === 'incomplete' ? 'Checked Incomplete' :
                   selectedOrder.security_check_status === 'bypassed' ? 'Bypassed Due to Off Hours' :
                   'Pending Check'}
                </span>
              </div>
              {renderSecurityCheckNotes(selectedOrder.security_check_notes)}

              {/* Aggregated Security Check Quantities */}
              {selectedOrder.security_check_status && selectedOrder.security_check_status !== 'pending' && (
                <div className="mt-4 p-3 bg-gray-100 rounded-lg border border-gray-200">
                  <h4 className="text-md font-semibold text-gray-800 mb-2">Load Quantities</h4>
                  {(() => {
                    const { suggestedTotalQuantity, actualTotalQuantity, suggestedUnitType, actualUnitType } = getAggregatedSecurityQuantities(selectedOrder);
                    return (
                      <>
                        <p className="text-sm text-green-700 mb-1">
                          <span className="font-medium">Suggested Load Weight:</span> <span className="font-bold">{suggestedTotalQuantity.toFixed(2)} {suggestedUnitType}</span>
                        </p>
                        <p className="text-sm text-blue-700">
                          <span className="font-medium">Actual Load Weight:</span>{' '}
                          {actualTotalQuantity > 0 
                            ? `${actualTotalQuantity.toFixed(2)} ${actualUnitType}` 
                            : 'N/A'}
                        </p>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Order Items Section */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Order Items</h3>
              <div className="space-y-3">
                {selectedOrder.order_items.map(item => (
                  <div key={item.id} className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm border border-gray-100">
                    <div>
                      <div className="font-medium text-gray-900">{item.products.name}</div>
                      <div className="text-sm text-gray-600">
                        {user?.role !== 'Security Guard' ? (
                          <>
                            {formatCurrency(item.price)} × {item.quantity} {item.products.unit_type || 'Unit'}
                          </>
                        ) : (
                          <>
                            Quantity: {item.quantity} {item.products.unit_type || 'Unit'}
                          </>
                        )}
                        {item.returned_quantity > 0 && (
                          <span className="text-red-600 ml-2">
                            (Returned: {item.returned_quantity} {item.products.unit_type || 'Unit'})
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {user?.role !== 'Security Guard' && (
                        <span className="font-semibold text-gray-900">{formatCurrency(item.price * item.quantity)}</span>
                      )}
                      {user?.role === 'Sales Rep' && (
                        <button
                          onClick={() => handleOpenReturnModal(item)}
                          className="px-3 py-1 bg-orange-500 text-white rounded-md hover:bg-orange-600 text-sm transition-colors"
                        >
                          Return
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CHANGED: Modified the condition to include both 'partially_paid' and 'unpaid' statuses */}
            {user?.role === 'Sales Rep' && (selectedOrder.payment_status === 'partially_paid' || selectedOrder.payment_status === 'unpaid') && getPendingBalance(selectedOrder) > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setCurrentOrderForPayment(selectedOrder);
                    setIsSubsequentPayment(true);
                    setAllowPartialPayment(true);
                    setPaymentCollectedAmount('');
                    setPaymentMethod(null);
                    setPaymentError(null);
                    setInitialPaymentStatus('partial');  // ADDED THIS LINE
                    setShowPaymentConfirmationModal(true);
                    setShowOrderModal(false);
                  }}
                  className="w-full flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  <DollarSign className="w-5 h-5 mr-2" />
                  Collect Remaining Payment ({formatCurrency(getPendingBalance(selectedOrder))})
                </button>
              </div>
            )}

            {user?.role === 'Security Guard' && selectedOrder.status === 'Security Check Incomplete' && isOffHoursSriLanka() && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => handleBypassSecurityCheck(selectedOrder.id)}
                  disabled={processing}
                  className="w-full flex items-center justify-center px-4 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 transition-colors"
                >
                  <ShieldOff className="w-5 h-5 mr-2" />
                  Bypass Security Check (Off Hours Operation)
                </button>
                <p className="text-sm text-gray-600 mt-2 text-center">
                  This action is only available outside regular working hours (6:00 AM - 6:00 PM)
                </p>
              </div>
            )}

          </div>
        </div>
      )}

      {showSecurityModal && selectedOrderForSecurity && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Security Check</h2>
              <button
                onClick={() => setShowSecurityModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-4">
              <h3 className="font-medium text-gray-900 mb-2">
                Order {selectedOrderForSecurity.order_display_id}
              </h3>
              <p className="text-sm text-gray-600">Customer: {selectedOrderForSecurity.customers.name}</p>
              <p className="text-sm text-gray-600">Sales Rep: {selectedOrderForSecurity.assigned_user?.username || 'Unassigned'}</p>
              {selectedOrderForSecurity.vehicle_number && (
                <p className="text-sm text-gray-600">Vehicle: {selectedOrderForSecurity.vehicle_number}</p>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Reasons (for incomplete checks)
              </label>
              <div className="space-y-2">
                {predefinedReasons.map((reason) => (
                  <label key={reason} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedReasons.includes(reason)}
                      onChange={() => handleReasonChange(reason)}
                      className="mr-2"
                    />
                    <span className="text-sm">{reason}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Notes
              </label>
              <textarea
                value={securityNotes}
                onChange={(e) => setSecurityNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                rows={3}
                placeholder="Add any additional notes about the security check..."
              />
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowSecurityModal(false)
                  setSelectedOrderForSecurity(null)
                  setSecurityNotes('')
                  setSelectedReasons([])
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSecurityCheck(selectedOrderForSecurity.id, 'incomplete')}
                disabled={processing}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {processing ? 'Processing...' : 'Ok'}
              </button>
            </div>

            {user?.role === 'Security Guard' && isOffHoursSriLanka() && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowSecurityModal(false)
                    handleBypassSecurityCheck(selectedOrderForSecurity.id)
                  }}
                  disabled={processing}
                  className="w-full flex items-center justify-center px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 transition-colors"
                >
                  <ShieldOff className="w-4 h-4 mr-2" />
                  Bypass Security Check (Off Hours)
                </button>
                <p className="text-xs text-gray-600 mt-1 text-center">
                  Available outside 6:00 AM - 6:00 PM
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {showReturnModal && selectedOrderItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Return Product</h2>
            <p className="mb-2">{selectedOrderItem.products.name}</p>
            <p className="mb-2 text-sm text-gray-600">
              Available to return: {selectedOrderItem.quantity - (selectedOrderItem.returned_quantity || 0)} {selectedOrderItem.products.unit_type || 'Unit'}
              {selectedOrderItem.returned_quantity > 0 && (
                <span className="text-red-600 ml-1">
                  (Already returned: {selectedOrderItem.returned_quantity} {selectedOrderItem.products.unit_type || 'Unit'})
                </span>
              )}
            </p>

            <label className="block mb-2">Return Quantity ({selectedOrderItem.products.unit_type || 'Unit'}) *</label>
            <input
              type="number"
              step="0.1"
              value={returnQuantity}
              onChange={(e) => setReturnQuantity(parseFloat(e.target.value) || 0)}
              min="0.1"
              max={selectedOrderItem.quantity - (selectedOrderItem.returned_quantity || 0)}
              className="w-full mb-3 px-3 py-2 border rounded"
            />

            <label className="block mb-2">Return Reason *</label>
            <textarea
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              rows={3}
              className="w-full mb-3 px-3 py-2 border rounded"
              placeholder="Please explain why you are returning this product..."
            />

            <div className="flex space-x-2">
              <button onClick={() => setShowReturnModal(false)} className="flex-1 py-2 bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
              <button onClick={handleProcessReturn} className="flex-1 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">
                {processingReturn ? 'Processing...' : 'Process Return'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPaymentConfirmationModal && currentOrderForPayment && (
        <PaymentConfirmationModal
          order={currentOrderForPayment}
          onClose={() => {
            setShowPaymentConfirmationModal(false)
            setCurrentOrderForPayment(null)
            setPaymentCollectedAmount('')
            setPaymentMethod(null)
            setPaymentError(null)
            setIsSubsequentPayment(false)
            setInitialPaymentStatus(null)  // ADDED THIS LINE
          }}
          onConfirm={handleConfirmPayment}
          onPrintBill={handlePrintBill}
          loading={processingPayment}
          is_on_demand={false}
          paymentCollectedAmount={paymentCollectedAmount}
          setPaymentCollectedAmount={setPaymentCollectedAmount}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          paymentError={paymentError}
          allowPartialPayment={allowPartialPayment}
          isSubsequentPayment={isSubsequentPayment}
          orderDeliveryDate={currentOrderForPayment.delivery_date}
          initialPaymentStatus={initialPaymentStatus}  // ADDED THIS LINE
          onFinalDeliveryWeightChange={(itemId, weight) => {
            setFinalDeliveryWeights(prev => ({
              ...prev,
              [itemId]: weight
            }))
          }}
          finalDeliveryWeights={finalDeliveryWeights}
        />
      )}

      {/* Security Check Modal */}
      {showSecurityCheckModal && selectedOrderForSecurityCheck && (
        <SecurityCheckModal
          order={selectedOrderForSecurityCheck as any}
          onClose={() => setShowSecurityCheckModal(false)}
          onConfirm={handleSecurityCheckConfirm}
          loading={securityCheckLoading}
        />
      )}

      {/* Final Delivery Weight Modal */}
      {showWeightModal && selectedOrderForWeights && (
        <FinalDeliveryWeightModal
          order={selectedOrderForWeights}
          onClose={handleCloseWeightModal}
          onWeightsSaved={handleWeightsSaved}
          loading={processing}
        />
      )}
    </div>
  )
}