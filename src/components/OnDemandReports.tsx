import React, { useState, useEffect } from 'react'
import { BarChart3, Download, TrendingUp, Package, Users, DollarSign, Calendar, User } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { formatCurrency } from '../utils/formatters' // New import
import { WEIGHT_UNIT } from '../utils/units'

interface OnDemandReportData {
  sales_rep_name: string
  sales_rep_id: string
  total_assigned: number
  total_sold: number
  total_returned: number
  total_revenue: number
  orders_count: number
}

interface ProductSalesData {
  product_name: string
  total_assigned: number
  total_sold: number
  total_revenue: number
  avg_selling_price: number
}

interface DailySalesData {
  sale_date: string
  total_revenue: number
  orders_count: number
  products_sold: number
}

export const OnDemandReports: React.FC = () => {
  const { user } = useAuth()
  const [reportData, setReportData] = useState<OnDemandReportData[]>([])
  const [productSales, setProductSales] = useState<ProductSalesData[]>([])
  const [dailySales, setDailySales] = useState<DailySalesData[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'daily'>('overview')
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    fetchReportData()
  }, [dateRange])

  const fetchReportData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        fetchOverviewData(),
        fetchProductSalesData(),
        fetchDailySalesData()
      ])
    } catch (error) {
      console.error('Error fetching report data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchOverviewData = async () => {
    try {
      const cacheKey = `on_demand_overview_data_${dateRange.start}_${dateRange.end}`
      if (!isOnline) {
        const cachedData = localStorage.getItem(cacheKey)
        if (cachedData) {
          setReportData(JSON.parse(cachedData))
          return
        }
      }

      const { data, error } = await supabase
        .from('on_demand_assignments')
        .select(`
          id, sales_rep_id, 
          users!on_demand_assignments_sales_rep_id_fkey(username),
          assignment_items:on_demand_assignment_items(
            assigned_quantity, sold_quantity, returned_quantity, 
            on_demand_orders(total_amount, sale_date)
          )
        `)
        .gte('assignment_date', dateRange.start)
        .lte('assignment_date', dateRange.end)

      if (error) throw error

      const processedData: OnDemandReportData[] = []
      
      data?.forEach(assignment => {
        const existingRep = processedData.find(rep => rep.sales_rep_id === assignment.sales_rep_id)
        
        let totalAssigned = 0
        let totalSold = 0
        let totalReturned = 0
        let totalRevenue = 0
        let ordersCount = 0

        assignment.assignment_items?.forEach(item => {
          totalAssigned += item.assigned_quantity
          totalSold += item.sold_quantity
          totalReturned += item.returned_quantity
          
          item.on_demand_orders?.forEach(order => {
            if (order.sale_date >= dateRange.start && order.sale_date <= dateRange.end + 'T23:59:59') {
              totalRevenue += order.total_amount
              ordersCount += 1
            }
          })
        })

        if (existingRep) {
          existingRep.total_assigned += totalAssigned
          existingRep.total_sold += totalSold
          existingRep.total_returned += totalReturned
          existingRep.total_revenue += totalRevenue
          existingRep.orders_count += ordersCount
        } else {
          processedData.push({
            sales_rep_name: assignment.users?.username || 'Unknown',
            sales_rep_id: assignment.sales_rep_id,
            total_assigned: totalAssigned,
            total_sold: totalSold,
            total_returned: totalReturned,
            total_revenue: totalRevenue,
            orders_count: ordersCount
          })
        }
      })

      setReportData(processedData)
      localStorage.setItem(cacheKey, JSON.stringify(processedData))
    } catch (error) {
      console.error('Error fetching overview data:', error)
      const cacheKey = `on_demand_overview_data_${dateRange.start}_${dateRange.end}`
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        setReportData(JSON.parse(cachedData))
      } else {
        setReportData([])
      }
    }
  }

  const fetchProductSalesData = async () => {
    try {
      const cacheKey = `on_demand_product_sales_data_${dateRange.start}_${dateRange.end}`
      if (!isOnline) {
        const cachedData = localStorage.getItem(cacheKey)
        if (cachedData) {
          setProductSales(JSON.parse(cachedData))
          return
        }
      }

      const { data, error } = await supabase
        .from('on_demand_assignment_items')
        .select(`
          assigned_quantity, sold_quantity, 
          products(name),
          on_demand_orders(quantity_sold, selling_price, total_amount, sale_date)
        `)
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end + 'T23:59:59')

      if (error) throw error

      const productMap: { [key: string]: ProductSalesData } = {}

      data?.forEach(item => {
        const productName = item.products?.name || 'Unknown Product'
        
        if (!productMap[productName]) {
          productMap[productName] = {
            product_name: productName,
            total_assigned: 0,
            total_sold: 0,
            total_revenue: 0,
            avg_selling_price: 0
          }
        }

        productMap[productName].total_assigned += item.assigned_quantity
        productMap[productName].total_sold += item.sold_quantity

        item.on_demand_orders?.forEach(order => {
          if (order.sale_date >= dateRange.start && order.sale_date <= dateRange.end + 'T23:59:59') {
            productMap[productName].total_revenue += order.total_amount
          }
        })
      })

      // Calculate average selling price
      Object.values(productMap).forEach(product => {
        if (product.total_sold > 0) {
          product.avg_selling_price = product.total_revenue / product.total_sold
        }
      })

      const sortedProductSales = Object.values(productMap).sort((a, b) => b.total_revenue - a.total_revenue)
      setProductSales(sortedProductSales)
      localStorage.setItem(cacheKey, JSON.stringify(sortedProductSales))
    } catch (error) {
      console.error('Error fetching product sales data:', error)
      const cacheKey = `on_demand_product_sales_data_${dateRange.start}_${dateRange.end}`
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        setProductSales(JSON.parse(cachedData))
      } else {
        setProductSales([])
      }
    }
  }

  const fetchDailySalesData = async () => {
    try {
      const cacheKey = `on_demand_daily_sales_data_${dateRange.start}_${dateRange.end}`
      if (!isOnline) {
        const cachedData = localStorage.getItem(cacheKey)
        if (cachedData) {
          setDailySales(JSON.parse(cachedData))
          return
        }
      }

      const { data, error } = await supabase
        .from('on_demand_orders')
        .select('sale_date, total_amount, quantity_sold')
        .gte('sale_date', dateRange.start)
        .lte('sale_date', dateRange.end + 'T23:59:59')
        .order('sale_date')

      if (error) throw error

      const dailyMap: { [key: string]: DailySalesData } = {}

      data?.forEach(order => {
        const date = order.sale_date.split('T')[0]
        
        if (!dailyMap[date]) {
          dailyMap[date] = {
            sale_date: date,
            total_revenue: 0,
            orders_count: 0,
            products_sold: 0
          }
        }

        dailyMap[date].total_revenue += order.total_amount
        dailyMap[date].orders_count += 1
        dailyMap[date].products_sold += order.quantity_sold
      })

      const sortedDailySales = Object.values(dailyMap).sort((a, b) => a.sale_date.localeCompare(b.sale_date))
      setDailySales(sortedDailySales)
      localStorage.setItem(cacheKey, JSON.stringify(sortedDailySales))
    } catch (error) {
      console.error('Error fetching daily sales data:', error)
      const cacheKey = `on_demand_daily_sales_data_${dateRange.start}_${dateRange.end}`
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        setDailySales(JSON.parse(cachedData))
      } else {
        setDailySales([])
      }
    }
  }

  const exportToCSV = () => {
    let csvContent = ''
    let filename = ''

    if (activeTab === 'overview') {
      csvContent = [
        ['Sales Rep', `Total Assigned (${WEIGHT_UNIT})`, `Total Sold (${WEIGHT_UNIT})`, `Total Returned (${WEIGHT_UNIT})`, 'Total Revenue (Rs)', 'Orders Count'].join(','),
        ...reportData.map(row => [
          row.sales_rep_name,
          row.total_assigned,
          row.total_sold,
          row.total_returned,
          row.total_revenue.toFixed(2),
          row.orders_count
        ].join(','))
      ].join('\n')
      filename = `on_demand_overview_${dateRange.start}_to_${dateRange.end}.csv`
    } else if (activeTab === 'products') {
      csvContent = [
        ['Product', `Total Assigned (${WEIGHT_UNIT})`, `Total Sold (${WEIGHT_UNIT})`, 'Total Revenue (Rs)', 'Avg Selling Price (Rs)'].join(','),
        ...productSales.map(row => [
          row.product_name,
          row.total_assigned,
          row.total_sold,
          row.total_revenue.toFixed(2),
          row.avg_selling_price.toFixed(2)
        ].join(','))
      ].join('\n')
      filename = `on_demand_products_${dateRange.start}_to_${dateRange.end}.csv`
    } else {
      csvContent = [
        ['Date', 'Total Revenue (Rs)', 'Orders Count', `Products Sold (${WEIGHT_UNIT})`].join(','),
        ...dailySales.map(row => [
          row.sale_date,
          row.total_revenue.toFixed(2),
          row.orders_count,
          row.products_sold
        ].join(','))
      ].join('\n')
      filename = `on_demand_daily_${dateRange.start}_to_${dateRange.end}.csv`
    }

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const getTotalStats = () => {
    return reportData.reduce((totals, rep) => ({
      totalAssigned: totals.totalAssigned + rep.total_assigned,
      totalSold: totals.totalSold + rep.total_sold,
      totalReturned: totals.totalReturned + rep.total_returned,
      totalRevenue: totals.totalRevenue + rep.total_revenue,
      totalOrders: totals.totalOrders + rep.orders_count
    }), {
      totalAssigned: 0,
      totalSold: 0,
      totalReturned: 0,
      totalRevenue: 0,
      totalOrders: 0
    })
  }

  if (user?.role !== 'Super Admin' && user?.role !== 'Admin') {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">Only Admins can view On Demand reports.</p>
        </div>
      </div>
    )
  }

  const totalStats = getTotalStats()

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-900">On Demand Sales Reports</h1>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-gray-600" />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <button
            onClick={exportToCSV}
            className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Package className="w-8 h-8 text-blue-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Total Assigned</p>
              <p className="text-2xl font-bold text-gray-900">{totalStats.totalAssigned.toFixed(1)} {WEIGHT_UNIT}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <TrendingUp className="w-8 h-8 text-green-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Total Sold</p>
              <p className="text-2xl font-bold text-gray-900">{totalStats.totalSold.toFixed(1)} {WEIGHT_UNIT}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Package className="w-8 h-8 text-orange-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Total Returned</p>
              <p className="text-2xl font-bold text-gray-900">{totalStats.totalReturned.toFixed(1)} {WEIGHT_UNIT}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <DollarSign className="w-8 h-8 text-purple-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalStats.totalRevenue)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Users className="w-8 h-8 text-indigo-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">{totalStats.totalOrders}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'overview'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Sales Rep Overview
        </button>
        <button
          onClick={() => setActiveTab('products')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'products'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Product Performance
        </button>
        <button
          onClick={() => setActiveTab('daily')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'daily'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Daily Sales
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-500">Loading reports...</div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {activeTab === 'overview' && (
            <>
              {/* Mobile Card Layout for Sales Rep Overview */}
              <div className="block md:hidden">
                <div className="space-y-2">
                  {reportData.map((rep) => (
                    <div key={rep.sales_rep_id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center flex-1 min-w-0">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                            <User className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-gray-900 truncate">
                              {rep.sales_rep_name}
                            </h3>
                            <div className="flex items-center mt-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                rep.total_assigned > 0 && (rep.total_sold / rep.total_assigned) > 0.8
                                  ? 'bg-green-100 text-green-800'
                                  : rep.total_assigned > 0 && (rep.total_sold / rep.total_assigned) > 0.5
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {rep.total_assigned > 0 ? ((rep.total_sold / rep.total_assigned) * 100).toFixed(1) : 0}% Efficiency
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-1 text-xs ml-11">
                        <div className="flex items-start">
                          <span className="text-gray-500 font-medium w-16 flex-shrink-0">Assigned:</span>
                          <span className="text-gray-700 flex-1">{rep.total_assigned.toFixed(1)} {WEIGHT_UNIT}</span>
                        </div>
                        <div className="flex items-start">
                          <span className="text-gray-500 font-medium w-16 flex-shrink-0">Sold:</span>
                          <span className="text-gray-700 flex-1">{rep.total_sold.toFixed(1)} {WEIGHT_UNIT}</span>
                        </div>
                        <div className="flex items-start">
                          <span className="text-gray-500 font-medium w-16 flex-shrink-0">Returned:</span>
                          <span className="text-gray-700 flex-1">{rep.total_returned.toFixed(1)} {WEIGHT_UNIT}</span>
                        </div>
                        <div className="flex items-start">
                          <span className="text-gray-500 font-medium w-16 flex-shrink-0">Revenue:</span>
                          <span className="text-gray-700 flex-1">{formatCurrency(rep.total_revenue)}</span>
                        </div>
                        <div className="flex items-start">
                          <span className="text-gray-500 font-medium w-16 flex-shrink-0">Orders:</span>
                          <span className="text-gray-700 flex-1">{rep.orders_count}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Desktop Table Layout for Sales Rep Overview */}
              <div className="hidden md:block">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Sales Rep
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Assigned ({WEIGHT_UNIT})
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Sold ({WEIGHT_UNIT})
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Returned ({WEIGHT_UNIT})
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Revenue (Rs)
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Orders
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Efficiency
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.map((rep) => (
                        <tr key={rep.sales_rep_id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{rep.sales_rep_name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {rep.total_assigned.toFixed(1)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {rep.total_sold.toFixed(1)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {rep.total_returned.toFixed(1)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(rep.total_revenue)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {rep.orders_count}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              rep.total_assigned > 0 && (rep.total_sold / rep.total_assigned) > 0.8
                                ? 'bg-green-100 text-green-800'
                                : rep.total_assigned > 0 && (rep.total_sold / rep.total_assigned) > 0.5
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {rep.total_assigned > 0 ? ((rep.total_sold / rep.total_assigned) * 100).toFixed(1) : 0}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeTab === 'products' && (
            <>
              {/* Mobile Card Layout for Product Performance */}
              <div className="block md:hidden">
                <div className="space-y-2">
                  {productSales.map((product, index) => (
                    <div key={index} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center flex-1 min-w-0">
                          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                            <Package className="w-4 h-4 text-purple-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-gray-900 truncate">
                              {product.product_name}
                            </h3>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1 text-xs ml-11">
                        <div className="flex items-start">
                          <span className="text-gray-500 font-medium w-16 flex-shrink-0">Assigned:</span>
                          <span className="text-gray-700 flex-1">{product.total_assigned.toFixed(1)} {WEIGHT_UNIT}</span>
                        </div>
                        <div className="flex items-start">
                          <span className="text-gray-500 font-medium w-16 flex-shrink-0">Sold:</span>
                          <span className="text-gray-700 flex-1">{product.total_sold.toFixed(1)} {WEIGHT_UNIT}</span>
                        </div>
                        <div className="flex items-start">
                          <span className="text-gray-500 font-medium w-16 flex-shrink-0">Revenue:</span>
                          <span className="text-gray-700 flex-1">{formatCurrency(product.total_revenue)}</span>
                        </div>
                        <div className="flex items-start">
                          <span className="text-gray-500 font-medium w-16 flex-shrink-0">Avg Price:</span>
                          <span className="text-gray-700 flex-1">{formatCurrency(product.avg_selling_price)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Desktop Table Layout for Product Performance */}
              <div className="hidden md:block">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Product
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Assigned ({WEIGHT_UNIT})
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Sold ({WEIGHT_UNIT})
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Revenue (Rs)
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Avg Price (Rs)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {productSales.map((product, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{product.product_name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {product.total_assigned.toFixed(1)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {product.total_sold.toFixed(1)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(product.total_revenue)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(product.avg_selling_price)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeTab === 'daily' && (
            <>
              {/* Mobile Card Layout for Daily Sales */}
              <div className="block md:hidden">
                <div className="space-y-2">
                  {dailySales.map((day, index) => (
                    <div key={index} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center flex-1 min-w-0">
                          <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                            <Calendar className="w-4 h-4 text-orange-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-gray-900 truncate">
                              {new Date(day.sale_date).toLocaleDateString()}
                            </h3>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1 text-xs ml-11">
                        <div className="flex items-start">
                          <span className="text-gray-500 font-medium w-16 flex-shrink-0">Revenue:</span>
                          <span className="text-gray-700 flex-1">{formatCurrency(day.total_revenue)}</span>
                        </div>
                        <div className="flex items-start">
                          <span className="text-gray-500 font-medium w-16 flex-shrink-0">Orders:</span>
                          <span className="text-gray-700 flex-1">{day.orders_count}</span>
                        </div>
                        <div className="flex items-start">
                          <span className="text-gray-500 font-medium w-16 flex-shrink-0">Products Sold:</span>
                          <span className="text-gray-700 flex-1">{day.products_sold.toFixed(1)} {WEIGHT_UNIT}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Desktop Table Layout for Daily Sales */}
              <div className="hidden md:block">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Revenue (Rs)
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Orders
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Products Sold ({WEIGHT_UNIT})
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {dailySales.map((day, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {new Date(day.sale_date).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(day.total_revenue)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {day.orders_count}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {day.products_sold.toFixed(1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}