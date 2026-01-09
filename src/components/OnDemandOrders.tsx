import React, { useState, useEffect } from 'react'
import { Package, Calendar, User, FileText } from 'lucide-react'
import { supabase, OnDemandAssignmentItem, OnDemandOrder, Customer } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { formatCurrency } from '../utils/formatters'

interface ConsolidatedOnDemandOrder {
  receipt_no: string
  sale_date: string
  customer_name: string
  customer_phone: string | null
  payment_method: string | null
  sales_rep_id: string
  sales_rep_username: string | null
  total_quantity_sold: number
  total_amount_sum: number
  products: Array<{
    name: string
    product_id: string
    sku: string
    quantity_sold: number
    selling_price: number
    total_amount: number
  }>
}

export const OnDemandOrders: React.FC = () => {
  const { user, isOnline } = useAuth()
  const [completedOrders, setCompletedOrders] = useState<ConsolidatedOnDemandOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.role === 'Sales Rep' || user?.role === 'Finance Admin' || user?.role === 'Security Guard' || user?.role === 'Admin' || user?.role === 'Super Admin') {
      fetchCompletedOrders()
    }
  }, [user])

  const fetchCompletedOrders = async () => {
    try {
      const cacheKey = `on_demand_orders_data_${user?.id || 'all'}`
      if (!isOnline) {
        const cachedData = localStorage.getItem(cacheKey)
        if (cachedData) {
          setCompletedOrders(JSON.parse(cachedData))
          setLoading(false)
          return
        }
      }

      let query = supabase
        .from('on_demand_orders')
        .select(`
          id, 
          on_demand_order_display_id, 
          customer_name, 
          customer_phone, 
          quantity_sold, 
          total_amount, 
          sale_date, 
          selling_price, 
          on_demand_assignment_item_id,
          payment_method,
          receipt_no,
          sales_rep_id,
          sales_reps:users!on_demand_orders_sales_rep_id_fkey(
            username
          ),
          on_demand_assignment_items(
            products(
              name,
              product_id,
              sku,
              price_cash,
              price_credit,
              price_dealer_cash,
              price_dealer_credit,
              price_hotel_non_vat,
              price_hotel_vat,
              price_farm_shop
            )
          )
        `)
      
      // Apply filter only for Sales Reps
      if (user?.role === 'Sales Rep') {
        query = query.eq('sales_rep_id', user.id)
      }
      
      query = query.eq('payment_status', 'fully_paid')
      query = query.order('sale_date', { ascending: false })

      const { data, error } = await query
      if (error) throw error
      
      // Process and group data by receipt_no
      const consolidatedOrders = processAndGroupOrders(data || [])
      
      localStorage.setItem(cacheKey, JSON.stringify(consolidatedOrders))
      setCompletedOrders(consolidatedOrders)
    } catch (error) {
      console.error('Error fetching completed orders:', error)
      const cacheKey = `on_demand_orders_data_${user?.id || 'all'}`
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        setCompletedOrders(JSON.parse(cachedData))
      } else {
        setCompletedOrders([])
      }
    } finally {
      setLoading(false)
    }
  }

  const processAndGroupOrders = (orders: any[]): ConsolidatedOnDemandOrder[] => {
    const groupedByReceipt: Record<string, any[]> = {}
    
    // Group orders by receipt_no
    orders.forEach(order => {
      const receipt = order.receipt_no || 'no-receipt'
      if (!groupedByReceipt[receipt]) {
        groupedByReceipt[receipt] = []
      }
      groupedByReceipt[receipt].push(order)
    })
    
    // Create consolidated order objects
    const consolidatedOrders: ConsolidatedOnDemandOrder[] = []
    
    Object.entries(groupedByReceipt).forEach(([receiptNo, ordersInGroup]) => {
      if (ordersInGroup.length === 0) return
      
      const firstOrder = ordersInGroup[0]
      
      // Sum up quantities and amounts
      const totalQuantitySold = ordersInGroup.reduce((sum, order) => sum + (order.quantity_sold || 0), 0)
      const totalAmountSum = ordersInGroup.reduce((sum, order) => sum + (order.total_amount || 0), 0)
      
      // Collect all products
      const products = ordersInGroup.map(order => ({
        name: order.on_demand_assignment_items?.products?.name || 'Unknown Product',
        product_id: order.on_demand_assignment_items?.products?.product_id || '',
        sku: order.on_demand_assignment_items?.products?.sku || '', 
        quantity_sold: order.quantity_sold || 0,
        selling_price: order.selling_price || 0,
        total_amount: order.total_amount || 0
      }))
      
      consolidatedOrders.push({
        receipt_no: receiptNo,
        sale_date: firstOrder.sale_date,
        customer_name: firstOrder.customer_name,
        customer_phone: firstOrder.customer_phone,
        payment_method: firstOrder.payment_method,
        sales_rep_id: firstOrder.sales_rep_id,
        sales_rep_username: firstOrder.sales_reps?.username || null,
        total_quantity_sold: totalQuantitySold,
        total_amount_sum: totalAmountSum,
        products: products
      })
    })
    
    // Sort by sale date descending
    return consolidatedOrders.sort((a, b) => 
      new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime()
    )
  }

  // Price mapping based on payment category
  const getPriceByPaymentCategory = (product: any, paymentCategory: string): number => {
    switch (paymentCategory) {
      case 'Cash': return product.price_cash || 0;
      case 'Credit': return product.price_credit || 0;
      case 'Dealer Cash': return product.price_dealer_cash || 0;
      case 'Dealer Credit': return product.price_dealer_credit || 0;
      case 'Hotel Non-VAT': return product.price_hotel_non_vat || 0;
      case 'Hotel VAT': return product.price_hotel_vat || 0;
      case 'Farm Shop': return product.price_farm_shop || 0; // New case
      default: return 0;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading completed orders...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Completed On Demand Orders</h1>
      </div>

      {completedOrders.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Completed Orders</h2>
          <p className="text-gray-600">You haven't completed any On Demand orders yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Mobile Card Layout */}
          <div className="block md:hidden">
            <div className="space-y-2">
              {completedOrders.map((order) => (
                <div key={order.receipt_no} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center flex-1 min-w-0">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                        <FileText className="w-4 h-4 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          Receipt #{order.receipt_no}
                        </h3>
                        <div className="flex items-center mt-1">
                          <span className="inline-block inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            {order.products.length} product{order.products.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-1 text-xs ml-11">
                    <div className="flex items-start">
                      <span className="text-gray-500 font-medium w-16 flex-shrink-0">Customer:</span>
                      <span className="text-gray-700 flex-1">{order.customer_name}</span>
                    </div>
                    {order.customer_phone && (
                      <div className="flex items-start">
                        <span className="text-gray-500 font-medium w-16 flex-shrink-0">Phone:</span>
                        <span className="text-gray-700 flex-1">{order.customer_phone}</span>
                      </div>
                    )}
                    <div className="flex items-start">
                      <span className="text-gray-500 font-medium w-16 flex-shrink-0">Sales Rep:</span>
                      <span className="text-gray-700 flex-1">{order.sales_rep_username || 'N/A'}</span>
                    </div>
                    {user?.role !== 'Security Guard' && order.payment_method && (
                      <div className="flex items-start">
                        <span className="text-gray-500 font-medium w-16 flex-shrink-0">Payment Method:</span>
                        <span className="text-gray-700 flex-1">{order.payment_method}</span>
                      </div>
                    )}
                    <div className="flex items-start">
                      <span className="text-gray-500 font-medium w-16 flex-shrink-0">Products:</span>
                      <div className="text-gray-700 flex-1">
                        {order.products.map((product, index) => (
                          <div key={index} className="mb-1 last:mb-0">
                            {product.name} - {product.quantity_sold} kg
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-start">
                      <span className="text-gray-500 font-medium w-16 flex-shrink-0">Total Qty:</span>
                      <span className="text-gray-700 flex-1">{order.total_quantity_sold} kg</span>
                    </div>
                    {user?.role !== 'Security Guard' && (
                      <div className="flex items-start">
                        <span className="text-gray-500 font-medium w-16 flex-shrink-0">Total Amount:</span>
                        <span className="text-gray-700 flex-1">{formatCurrency(order.total_amount_sum)}</span>
                      </div>
                    )}
                    <div className="flex items-start">
                      <span className="text-gray-500 font-medium w-16 flex-shrink-0">Date:</span>
                      <span className="text-gray-700 flex-1">{new Date(order.sale_date).toLocaleString()}</span>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Receipt No
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sales Rep
                    </th>
                    {user?.role !== 'Security Guard' && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Payment Method
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Products
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Quantity
                    </th>
                    {user?.role !== 'Security Guard' && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Amount
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {completedOrders.map((order, index) => (
                    <tr key={order.receipt_no} className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-gray-100`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(order.sale_date).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            #{order.receipt_no}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>
                          <div className="font-medium">{order.customer_name}</div>
                          {order.customer_phone && (
                            <div className="text-xs text-gray-500">{order.customer_phone}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.sales_rep_username || 'N/A'}
                      </td>
                      {user?.role !== 'Security Guard' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                            order.payment_method ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {order.payment_method || 'Not specified'}
                          </span>
                        </td>
                      )}
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="space-y-1">
                          {order.products.map((product, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                              <span className="font-medium">{product.name}</span>
                              <span className="text-gray-500 ml-2">{product.quantity_sold} kg</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.total_quantity_sold} kg
                      </td>
                      {user?.role !== 'Security Guard' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(order.total_amount_sum)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}