import React, { useState, useEffect } from 'react'
import { Calendar, Download, TrendingUp, Package, Users, DollarSign } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth' // Import useAuth to get isOnline status
import { formatCurrency } from '../utils/formatters' // New import
import { WEIGHT_UNIT } from '../utils/units' // New import
import { InventoryReportsTab } from './reports/InventoryReportsTab'

interface SalesData {
  date: string
  total_sales: number
  order_count: number
  customer_count: number
}

interface ProductSales {
  product_name: string
  total_quantity: number
  total_revenue: number
}

interface LowStockItem {
  name: string
  quantity: number
  threshold: number
  category: string
}

export const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sales' | 'inventory' | 'inventory-detailed'>('sales')
  const [dateRange, setDateRange] = useState<'day' | 'week' | 'month'>('day')
  const { isOnline } = useAuth() // Get online status
  const [salesData, setSalesData] = useState<SalesData[]>([])
  const [topProducts, setTopProducts] = useState<ProductSales[]>([])
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([])
  const [loading, setLoading] = useState(false)
  const [isSalesDataFromCache, setIsSalesDataFromCache] = useState(false)
  const [isInventoryDataFromCache, setIsInventoryDataFromCache] = useState(false)

  useEffect(() => {
    if (activeTab === 'sales') {
      fetchSalesData()
    } else {
      fetchInventoryData()
    }
  }, [activeTab, dateRange])

  const fetchSalesData = async () => {
    setLoading(true)
    setIsSalesDataFromCache(false)

    const cacheKey = `reports_sales_data_${dateRange}`
    if (!isOnline) {
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        const parsedData = JSON.parse(cachedData)
        setSalesData(parsedData.salesData)
        setTopProducts(parsedData.topProducts)
        setIsSalesDataFromCache(true)
        setLoading(false)
        return
      }
    }

    try {
      const endDate = new Date()
      let startDate = new Date()
      
      if (dateRange === 'day') {
        startDate.setDate(endDate.getDate() - 1)
      } else if (dateRange === 'week') {
        startDate.setDate(endDate.getDate() - 7)
      } else {
        startDate.setDate(endDate.getDate() - 30)
      }

      // Fetch sales data - using order_items.price for historical accuracy
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id, 
          created_at, 
          order_items (
            quantity, 
            price, 
            products (
              name
            )
          )
        `)
        .eq('status', 'completed')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())

      if (ordersError) throw ordersError

      // Process sales data using the actual price from order_items
      const salesByDate: { [key: string]: SalesData } = {}
      const productSales: { [key: string]: ProductSales } = {}

      orders?.forEach(order => {
        const date = new Date(order.created_at).toLocaleDateString()
        
        if (!salesByDate[date]) {
          salesByDate[date] = {
            date,
            total_sales: 0,
            order_count: 0,
            customer_count: 0
          }
        }

        salesByDate[date].order_count += 1
        
        order.order_items.forEach((item: any) => {
          // Use the actual price charged from order_items.price (historical data)
          const itemTotal = item.quantity * item.price
          salesByDate[date].total_sales += itemTotal

          const productName = item.products.name
          if (!productSales[productName]) {
            productSales[productName] = {
              product_name: productName,
              total_quantity: 0,
              total_revenue: 0
            }
          }
          productSales[productName].total_quantity += item.quantity
          productSales[productName].total_revenue += itemTotal
        })
      })

      const salesDataArray = Object.values(salesByDate)
      const topProductsArray = Object.values(productSales).sort((a, b) => b.total_revenue - a.total_revenue).slice(0, 5)
      
      setSalesData(salesDataArray)
      setTopProducts(topProductsArray)
      
      // Cache both sales data and top products together
      localStorage.setItem(cacheKey, JSON.stringify({
        salesData: salesDataArray,
        topProducts: topProductsArray
      }))
    } catch (error) {
      console.error('Error fetching sales data:', error)
      
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        const parsedData = JSON.parse(cachedData)
        setSalesData(parsedData.salesData)
        setTopProducts(parsedData.topProducts)
        setIsSalesDataFromCache(true)
      } else {
        setSalesData([])
        setTopProducts([])
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchInventoryData = async () => {
    setLoading(true)
    setIsInventoryDataFromCache(false)

    const cacheKey = 'reports_inventory_data'
    if (!isOnline) {
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        setLowStockItems(JSON.parse(cachedData))
        setIsInventoryDataFromCache(true)
        setLoading(false)
        return
      }
    }

    try {
      const { data: products, error } = await supabase
        .from('products')
        .select('name, quantity, threshold, category, price_dealer_cash, price_dealer_credit, price_distributor_cash, price_distributor_credit, price_walkin_cash, price_walkin_credit')
        .order('quantity', { ascending: true })

      if (error) throw error

      const lowStock = products?.filter(product => product.quantity < product.threshold) || []
      setLowStockItems(lowStock)
      localStorage.setItem(cacheKey, JSON.stringify(lowStock))
    } catch (error) {
      console.error('Error fetching inventory data:', error)
      
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        setLowStockItems(JSON.parse(cachedData))
        setIsInventoryDataFromCache(true)
      } else {
        setLowStockItems([])
      }
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = () => {
    if (activeTab === 'sales') {
      const csvContent = [
        ['Date', 'Total Sales', 'Order Count'].join(','),
        ...salesData.map(row => [
          row.date,
          row.total_sales.toFixed(2),
          row.order_count
        ].join(','))
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sales_report_${dateRange}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      const csvContent = [
        ['Product Name', 'Current Stock', 'Threshold', 'Category'].join(','),
        ...lowStockItems.map(item => [
          item.name,
          item.quantity,
          item.threshold,
          item.category
        ].join(','))
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'low_stock_report.csv'
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const getTotalSales = () => {
    return salesData.reduce((total, day) => total + day.total_sales, 0)
  }

  const getTotalOrders = () => {
    return salesData.reduce((total, day) => total + day.order_count, 0)
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
        <button
          onClick={exportToCSV}
          className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6">
        <button
          onClick={() => setActiveTab('sales')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'sales'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Sales Reports
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'inventory'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Inventory Reports
        </button>
        <button
          onClick={() => setActiveTab('inventory-detailed')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'inventory-detailed'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Inventory Analysis
        </button>
      </div>

      {activeTab === 'sales' && (
        <div className="space-y-6">
          {/* Date Range Filter */}
          <div className="flex items-center space-x-4">
            <Calendar className="w-5 h-5 text-gray-600" />
            <div className="flex space-x-2">
              {['day', 'week', 'month'].map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range as 'day' | 'week' | 'month')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    dateRange === range
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {isSalesDataFromCache && (
            <p className="text-sm text-gray-500 mt-4">Data may be outdated (from cache)</p>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <DollarSign className="w-8 h-8 text-green-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Sales</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(getTotalSales())}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <TrendingUp className="w-8 h-8 text-blue-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Orders</p>
                  <p className="text-2xl font-bold text-gray-900">{getTotalOrders()}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <Users className="w-8 h-8 text-purple-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg. Order Value</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {getTotalOrders() > 0 ? formatCurrency(getTotalSales() / getTotalOrders()) : formatCurrency(0)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Top Products */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Top Products</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Product</th>
                    <th className="text-left py-2">Quantity Sold</th>
                    <th className="text-left py-2">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((product, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-2 font-medium">{product.product_name}</td>
                      <td className="py-2">{product.total_quantity} {WEIGHT_UNIT}</td>
                      <td className="py-2">{formatCurrency(product.total_revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sales by Date */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Sales by Date</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Date</th>
                    <th className="text-left py-2">Total Sales</th>
                    <th className="text-left py-2">Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {salesData.map((day, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-2">{day.date}</td>
                      <td className="py-2">{formatCurrency(day.total_sales)}</td>
                      <td className="py-2">{day.order_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'inventory' && (
        <>
          {isInventoryDataFromCache && (
            <p className="text-sm text-gray-500 mt-4">Data may be outdated (from cache)</p>
          )}
          
          {/* Low Stock Alert */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Low Stock Items</h2>
            {lowStockItems.length === 0 ? (
              <p className="text-gray-500 text-center py-8">All products are adequately stocked</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Product</th>
                      <th className="text-left py-2">Category</th>
                      <th className="text-left py-2">Current Stock</th>
                      <th className="text-left py-2">Threshold</th>
                      <th className="text-left py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockItems.map((item, index) => (
                      <tr key={index} className="border-b">
                        <td className="py-2 font-medium">{item.name}</td>
                        <td className="py-2">{item.category}</td>
                        <td className="py-2">{item.quantity} {WEIGHT_UNIT}</td>
                        <td className="py-2">{item.threshold} {WEIGHT_UNIT}</td>
                        <td className="py-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <Package className="w-3 h-3 mr-1" />
                            Low Stock
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'inventory-detailed' && <InventoryReportsTab />}

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-500">Loading reports...</div>
        </div>
      )}
    </div>
  )
}