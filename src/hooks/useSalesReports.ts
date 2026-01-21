import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { 
  SalesReportData, 
  SalesReportFilters,
  SalesTransaction,
  CustomerSalesData,
  SalesRepSalesData,
  ProductSalesBreakdown,
  DailySalesData,
  SalesSummary
} from '../types/salesReportTypes'

export const useSalesReports = (filters: SalesReportFilters) => {
  const [reportData, setReportData] = useState<SalesReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Calculate cache key based on filters
  const getCacheKey = () => {
    const dateKey = `${filters.startDate.toISOString()}_${filters.endDate.toISOString()}`
    const custKey = filters.selectedCustomers.join(',')
    const repKey = filters.selectedSalesReps.join(',')
    const statusKey = `${filters.paymentStatus}_${filters.orderStatus}`
    return `sales_reports_${dateKey}_${custKey}_${repKey}_${statusKey}`
  }

  // Fetch sales data from database
  const fetchSalesData = useCallback(async () => {
    try {
      // Build base query
      let query = supabase
        .from('orders')
        .select(`
          id,
          order_display_id,
          created_at,
          customer_id,
          status,
          payment_status,
          total_amount,
          assigned_to,
          customers (
            id,
            name,
            customer_display_id
          ),
          assigned_user:users!orders_assigned_to_fkey (
            id,
            first_name,
            last_name,
            employee_id
          ),
          order_items (
            id,
            item_id,
            quantity,
            price,
            products (
              id,
              name
            )
          )
        `)
        .gte('created_at', filters.startDate.toISOString())
        .lte('created_at', filters.endDate.toISOString())

      // Apply order status filter
      if (filters.orderStatus !== 'all') {
        if (filters.orderStatus === 'completed') {
          query = query.eq('status', 'Completed')
        } else if (filters.orderStatus === 'delivered') {
          query = query.eq('status', 'Delivered')
        }
      } else {
        // Get both Completed and Delivered orders
        query = query.in('status', ['Completed', 'Delivered'])
      }

      // Apply payment status filter
      if (filters.paymentStatus !== 'all') {
        query = query.eq('payment_status', filters.paymentStatus)
      }

      // Apply customer filter
      if (filters.selectedCustomers.length > 0) {
        query = query.in('customer_id', filters.selectedCustomers)
      }

      // Apply sales rep filter
      if (filters.selectedSalesReps.length > 0) {
        query = query.in('assigned_to', filters.selectedSalesReps)
      }

      const { data: orders, error: ordersError } = await query

      if (ordersError) throw ordersError
      if (!orders) throw new Error('No orders found')

      return orders as any[]
    } catch (err) {
      console.error('Error fetching sales data:', err)
      throw err
    }
  }, [filters])

  // Calculate metrics from raw order data
  const calculateMetrics = useCallback((orders: any[]): SalesReportData => {
    // Initialize data structures
    const customerMap = new Map<string, CustomerSalesData>()
    const salesRepMap = new Map<string, SalesRepSalesData>()
    const productMap = new Map<string, ProductSalesBreakdown>()
    const dailySalesMap = new Map<string, DailySalesData>()
    const transactions: SalesTransaction[] = []
    
    let totalRevenue = 0
    let totalOrders = 0
    const uniqueCustomerIds = new Set<string>()
    const uniqueSalesRepIds = new Set<string>()

    // Process each order
    orders.forEach((order) => {
      totalOrders++
      totalRevenue += order.total_amount

      const customerId = order.customer_id
      const customerName = order.customers?.name || 'Unknown'
      const customerDisplayId = order.customers?.customer_display_id || ''
      
      const salesRepId = order.assigned_to
      const salesRepName = order.assigned_user 
        ? `${order.assigned_user.first_name} ${order.assigned_user.last_name}`
        : 'Unassigned'
      const employeeId = order.assigned_user?.employee_id || null

      uniqueCustomerIds.add(customerId)
      if (salesRepId) uniqueSalesRepIds.add(salesRepId)

      // Update customer breakdown
      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          customerId,
          customerName,
          customerDisplayId,
          orderCount: 0,
          totalRevenue: 0,
          averageOrderValue: 0,
          lastOrderDate: order.created_at
        })
      }
      const customerData = customerMap.get(customerId)!
      customerData.orderCount++
      customerData.totalRevenue += order.total_amount
      customerData.averageOrderValue = customerData.totalRevenue / customerData.orderCount
      if (new Date(order.created_at) > new Date(customerData.lastOrderDate)) {
        customerData.lastOrderDate = order.created_at
      }

      // Update sales rep breakdown
      if (salesRepId) {
        if (!salesRepMap.has(salesRepId)) {
          salesRepMap.set(salesRepId, {
            salesRepId,
            salesRepName,
            employeeId,
            orderCount: 0,
            totalRevenue: 0,
            averageOrderValue: 0,
            uniqueCustomers: 0
          })
        }
        const repData = salesRepMap.get(salesRepId)!
        repData.orderCount++
        repData.totalRevenue += order.total_amount
        repData.averageOrderValue = repData.totalRevenue / repData.orderCount
      }

      // Update daily sales
      const orderDate = new Date(order.created_at).toISOString().split('T')[0]
      if (!dailySalesMap.has(orderDate)) {
        dailySalesMap.set(orderDate, {
          date: orderDate,
          revenue: 0,
          orderCount: 0
        })
      }
      const dailyData = dailySalesMap.get(orderDate)!
      dailyData.revenue += order.total_amount
      dailyData.orderCount++

      // Build transaction items and update product breakdown
      const items: SalesTransactionItem[] = []
      order.order_items.forEach((item: any) => {
        const subtotal = item.quantity * item.price
        items.push({
          productId: item.item_id,
          productName: item.products?.name || 'Unknown',
          quantity: item.quantity,
          price: item.price,
          subtotal
        })

        // Update product breakdown
        if (!productMap.has(item.item_id)) {
          productMap.set(item.item_id, {
            productId: item.item_id,
            productName: item.products?.name || 'Unknown',
            quantitySold: 0,
            totalRevenue: 0,
            orderCount: 0
          })
        }
        const prodData = productMap.get(item.item_id)!
        prodData.quantitySold += item.quantity
        prodData.totalRevenue += subtotal
        prodData.orderCount++
      })

      // Add transaction
      transactions.push({
        orderId: order.id,
        orderDisplayId: order.order_display_id,
        orderDate: order.created_at,
        customerId,
        customerName,
        customerDisplayId,
        salesRepId,
        salesRepName,
        totalAmount: order.total_amount,
        paymentStatus: order.payment_status,
        orderStatus: order.status,
        items
      })
    })

    // Calculate unique customers per sales rep
    salesRepMap.forEach((repData) => {
      const repCustomers = new Set<string>()
      transactions
        .filter(t => t.salesRepId === repData.salesRepId)
        .forEach(t => repCustomers.add(t.customerId))
      repData.uniqueCustomers = repCustomers.size
    })

    // Sort arrays
    const customerBreakdown = Array.from(customerMap.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
    
    const salesRepBreakdown = Array.from(salesRepMap.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
    
    const productBreakdown = Array.from(productMap.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
    
    const dailySales = Array.from(dailySalesMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))

    // Create summary
    const summary: SalesSummary = {
      totalRevenue,
      totalOrders,
      averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      uniqueCustomers: uniqueCustomerIds.size,
      activeSalesReps: uniqueSalesRepIds.size
    }

    return {
      summary,
      customerBreakdown,
      salesRepBreakdown,
      transactions,
      productBreakdown,
      dailySales
    }
  }, [])

  // Main fetch function
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Check cache first
      const cacheKey = getCacheKey()
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const { data: cachedData, timestamp } = JSON.parse(cached)
        const age = Date.now() - timestamp
        if (age < 5 * 60 * 1000) { // 5 minutes cache
          setReportData(cachedData)
          setLoading(false)
          return
        }
      }

      // Fetch fresh data
      const orders = await fetchSalesData()
      const metrics = calculateMetrics(orders)

      // Cache the results
      localStorage.setItem(cacheKey, JSON.stringify({
        data: metrics,
        timestamp: Date.now()
      }))

      setReportData(metrics)
    } catch (err: any) {
      console.error('useSalesReports error:', err)
      setError(err.message || 'Failed to fetch sales data')
      
      // Try to use cached data on error
      const cacheKey = getCacheKey()
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const { data: cachedData } = JSON.parse(cached)
        setReportData(cachedData)
      }
    } finally {
      setLoading(false)
    }
  }, [filters, fetchSalesData, calculateMetrics, getCacheKey])

  // Fetch data when filters change
  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    reportData,
    loading,
    error,
    refetch: fetchData
  }
}
