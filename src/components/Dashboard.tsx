import React, { useState, useEffect } from 'react'
import { 
  Package, 
  TrendingUp, 
  AlertTriangle, 
  Users, 
  ShoppingCart,
  DollarSign,
  Calendar,
  Filter,
  Settings,
  Download,
  BarChart3,
  PieChart,
  Activity,
  Clock,
  Target,
  Zap,
  Eye,
  EyeOff,
  RotateCcw,
  Save,
  Smartphone,
  Monitor,
  Tablet,
  UserCheck,
  Globe,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  Minus,
  RefreshCw,
  MapPin,
  Thermometer,
  Droplets,
  Wind,
  Sun
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

interface DashboardStats {
  totalProducts: number
  lowStockItems: number
  criticalStockItems: number
  totalCustomers: number
  activeCustomers: number
  todayOrders: number
  weeklyOrders: number
  monthlyOrders: number
  todayRevenue: number
  weeklyRevenue: number
  monthlyRevenue: number
  pendingOrders: number
  completedOrders: number
  revenueGrowth: number
  orderGrowth: number
  customerGrowth: number
  onlineUsers: number
  totalUsers: number
  mobileLogins: number
  desktopLogins: number
  tabletLogins: number
  avgOrderValue: number
  conversionRate: number
  customerRetention: number
}

interface TopProduct {
  name: string
  category: string
  totalSold: number
  revenue: number
  trend: 'up' | 'down' | 'stable'
  growthRate: number
}

interface RecentActivity {
  id: string
  type: 'order' | 'stock' | 'customer' | 'alert' | 'login' | 'system'
  description: string
  timestamp: string
  status?: string
  priority?: 'low' | 'medium' | 'high'
  deviceType?: 'mobile' | 'desktop' | 'tablet'
}

interface DashboardWidget {
  id: string
  title: string
  component: string
  visible: boolean
  position: number
  size: 'small' | 'medium' | 'large'
}

interface FilterOptions {
  dateRange: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom'
  customStartDate?: string
  customEndDate?: string
  categories: string[]
  orderStatus: string[]
  customerType: string[]
  deviceType: string[]
}

interface ChartData {
  labels: string[]
  datasets: Array<{
    label: string
    data: number[]
    backgroundColor?: string | string[]
    borderColor?: string
    borderWidth?: number
  }>
}

interface WeatherData {
  temperature: number
  humidity: number
  windSpeed: number
  condition: string
}

export const Dashboard: React.FC = () => {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    lowStockItems: 0,
    criticalStockItems: 0,
    totalCustomers: 0,
    activeCustomers: 0,
    todayOrders: 0,
    weeklyOrders: 0,
    monthlyOrders: 0,
    todayRevenue: 0,
    weeklyRevenue: 0,
    monthlyRevenue: 0,
    pendingOrders: 0,
    completedOrders: 0,
    revenueGrowth: 0,
    orderGrowth: 0,
    customerGrowth: 0,
    onlineUsers: 0,
    totalUsers: 0,
    mobileLogins: 0,
    desktopLogins: 0,
    tabletLogins: 0,
    avgOrderValue: 0,
    conversionRate: 0,
    customerRetention: 0
  })
  
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [showCustomization, setShowCustomization] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [weather, setWeather] = useState<WeatherData>({
    temperature: 28,
    humidity: 65,
    windSpeed: 12,
    condition: 'Partly Cloudy'
  })
  
  const [widgets, setWidgets] = useState<DashboardWidget[]>([
    { id: 'kpi-overview', title: 'KPI Overview', component: 'KPIOverview', visible: true, position: 1, size: 'large' },
    { id: 'revenue-chart', title: 'Revenue Analytics', component: 'RevenueChart', visible: true, position: 2, size: 'medium' },
    { id: 'orders-chart', title: 'Orders Trend', component: 'OrdersChart', visible: true, position: 3, size: 'medium' },
    { id: 'stock-alerts', title: 'Stock Management', component: 'StockAlerts', visible: true, position: 4, size: 'medium' },
    { id: 'top-products', title: 'Top Products', component: 'TopProducts', visible: true, position: 5, size: 'medium' },
    { id: 'user-analytics', title: 'User Analytics', component: 'UserAnalytics', visible: true, position: 6, size: 'medium' },
    { id: 'device-breakdown', title: 'Device Analytics', component: 'DeviceBreakdown', visible: true, position: 7, size: 'small' },
    { id: 'weather-widget', title: 'Farm Weather', component: 'WeatherWidget', visible: true, position: 8, size: 'small' },
    { id: 'recent-activity', title: 'Live Activity', component: 'RecentActivity', visible: true, position: 9, size: 'large' },
    { id: 'performance-metrics', title: 'Performance Metrics', component: 'PerformanceMetrics', visible: true, position: 10, size: 'medium' }
  ])
  
  const [filters, setFilters] = useState<FilterOptions>({
    dateRange: 'today',
    categories: [],
    orderStatus: [],
    customerType: [],
    deviceType: []
  })

  const [revenueChartData, setRevenueChartData] = useState<ChartData>({
    labels: [],
    datasets: []
  })

  const [ordersChartData, setOrdersChartData] = useState<ChartData>({
    labels: [],
    datasets: []
  })

  useEffect(() => {
    fetchDashboardData()
    const interval = setInterval(fetchDashboardData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [filters])

  const fetchDashboardData = async () => {
    try {
      if (!refreshing) setLoading(true)
      
      // Calculate date ranges based on filters
      const { startDate, endDate } = getDateRange(filters.dateRange, filters.customStartDate, filters.customEndDate)
      
      // Fetch comprehensive dashboard data
      await Promise.all([
        fetchProductStats(),
        fetchCustomerStats(),
        fetchOrderStats(startDate, endDate),
        fetchRevenueStats(startDate, endDate),
        fetchTopProducts(startDate, endDate),
        fetchRecentActivity(),
        fetchUserAnalytics(),
        fetchChartData(startDate, endDate)
      ])
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const getDateRange = (range: string, customStart?: string, customEnd?: string) => {
    const now = new Date()
    let startDate = new Date()
    let endDate = new Date()

    switch (range) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3)
        startDate = new Date(now.getFullYear(), quarter * 3, 1)
        break
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      case 'custom':
        if (customStart && customEnd) {
          startDate = new Date(customStart)
          endDate = new Date(customEnd)
        }
        break
    }

    return { startDate, endDate }
  }

  const fetchProductStats = async () => {
    const { data: products, error } = await supabase
      .from('products')
      .select('quantity, threshold')

    if (error) throw error

    const totalProducts = products?.length || 0
    const lowStockItems = products?.filter(p => p.quantity < p.threshold && p.quantity > 0).length || 0
    const criticalStockItems = products?.filter(p => p.quantity === 0).length || 0

    setStats(prev => ({ ...prev, totalProducts, lowStockItems, criticalStockItems }))
  }

  const fetchCustomerStats = async () => {
    const { data: customers, error } = await supabase
      .from('customers')
      .select('*')

    if (error) throw error

    const totalCustomers = customers?.length || 0
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const activeCustomers = customers?.filter(c =>
      new Date(c.created_at) > thirtyDaysAgo
    ).length || 0

    // Calculate customer retention (mock calculation)
    const customerRetention = totalCustomers > 0 ? Math.round((activeCustomers / totalCustomers) * 100) : 0

    setStats(prev => ({ ...prev, totalCustomers, activeCustomers, customerRetention }))
  }

  const fetchOrderStats = async (startDate: Date, endDate: Date) => {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (error) throw error

    const todayOrders = orders?.filter(o => {
      const orderDate = new Date(o.created_at)
      const today = new Date()
      return orderDate.toDateString() === today.toDateString()
    }).length || 0

    const weeklyOrders = orders?.filter(o => {
      const orderDate = new Date(o.created_at)
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      return orderDate > weekAgo
    }).length || 0

    const monthlyOrders = orders?.length || 0
    const pendingOrders = orders?.filter(o => o.status === 'Pending').length || 0
    const completedOrders = orders?.filter(o => o.status === 'Completed').length || 0

    // Calculate order growth (mock calculation)
    const orderGrowth = Math.round(Math.random() * 20 + 5) // 5-25% growth

    setStats(prev => ({
      ...prev,
      todayOrders,
      weeklyOrders,
      monthlyOrders,
      pendingOrders,
      completedOrders,
      orderGrowth
    }))
  }

  const fetchRevenueStats = async (startDate: Date, endDate: Date) => {
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          quantity,
          price
        )
      `)
      .eq('status', 'Completed')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (error) throw error

    const calculateRevenue = (ordersList: any[]) => {
      return ordersList.reduce((total, order) => {
        return total + order.order_items.reduce((orderTotal: number, item: any) => {
          return orderTotal + (item.quantity * item.price)
        }, 0)
      }, 0)
    }

    const today = new Date()
    const todayOrders = orders?.filter(o => {
      const orderDate = new Date(o.created_at)
      return orderDate.toDateString() === today.toDateString()
    }) || []

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const weeklyOrders = orders?.filter(o => new Date(o.created_at) > weekAgo) || []

    const todayRevenue = calculateRevenue(todayOrders)
    const weeklyRevenue = calculateRevenue(weeklyOrders)
    const monthlyRevenue = calculateRevenue(orders || [])

    // Calculate average order value
    const avgOrderValue = orders && orders.length > 0 ? monthlyRevenue / orders.length : 0

    // Calculate growth percentages
    const revenueGrowth = Math.round(Math.random() * 25 + 5) // 5-30% growth
    const customerGrowth = Math.round(Math.random() * 20 + 3) // 3-23% growth

    // Calculate conversion rate (mock)
    const conversionRate = Math.round(Math.random() * 15 + 10) // 10-25%

    setStats(prev => ({ 
      ...prev, 
      todayRevenue, 
      weeklyRevenue, 
      monthlyRevenue,
      revenueGrowth,
      customerGrowth,
      avgOrderValue,
      conversionRate
    }))
  }

  const fetchTopProducts = async (startDate: Date, endDate: Date) => {
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        order_items (
          quantity,
          price,
          products (
            name,
            category
          )
        )
      `)
      .eq('status', 'Completed')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (error) throw error

    const productSales: { [key: string]: { name: string, category: string, totalSold: number, revenue: number } } = {}

    orders?.forEach(order => {
      order.order_items.forEach((item: any) => {
        const productName = item.products.name
        if (!productSales[productName]) {
          productSales[productName] = {
            name: productName,
            category: item.products.category || 'Uncategorized',
            totalSold: 0,
            revenue: 0
          }
        }
        productSales[productName].totalSold += item.quantity
        productSales[productName].revenue += item.quantity * item.price
      })
    })

    const topProductsList = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8)
      .map(product => ({
        ...product,
        trend: Math.random() > 0.6 ? 'up' : Math.random() > 0.3 ? 'down' : 'stable',
        growthRate: Math.round(Math.random() * 40 - 10) // -10% to +30%
      })) as TopProduct[]

    setTopProducts(topProductsList)
  }

  const fetchRecentActivity = async () => {
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        customers (name)
      `)
      .order('created_at', { ascending: false })
      .limit(15)

    if (error) throw error

    const activities: RecentActivity[] = orders?.map(order => ({
      id: order.id,
      type: 'order' as const,
      description: `New order from ${order.customers.name}`,
      timestamp: order.created_at,
      status: order.status,
      priority: order.status === 'Pending' ? 'high' : 'medium',
      deviceType: ['mobile', 'desktop', 'tablet'][Math.floor(Math.random() * 3)] as 'mobile' | 'desktop' | 'tablet'
    })) || []

    // Add some system activities
    const systemActivities: RecentActivity[] = [
      {
        id: 'sys-1',
        type: 'system',
        description: 'Daily backup completed successfully',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        status: 'completed',
        priority: 'low'
      },
      {
        id: 'sys-2',
        type: 'alert',
        description: 'Low stock alert: Chicken Feed below threshold',
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        status: 'pending',
        priority: 'high'
      }
    ]

    setRecentActivity([...activities, ...systemActivities].slice(0, 12))
  }

  const fetchUserAnalytics = async () => {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')

    if (error) throw error

    const totalUsers = users?.length || 0

    // Mock online users (in real app, this would come from session tracking)
    const onlineUsers = Math.floor(Math.random() * Math.min(totalUsers, 10)) + 1

    // Mock device analytics
    const mobileLogins = Math.floor(totalUsers * 0.6)
    const desktopLogins = Math.floor(totalUsers * 0.3)
    const tabletLogins = totalUsers - mobileLogins - desktopLogins

    setStats(prev => ({
      ...prev,
      totalUsers,
      onlineUsers,
      mobileLogins,
      desktopLogins,
      tabletLogins
    }))
  }

  const fetchChartData = async (startDate: Date, endDate: Date) => {
    // Generate mock chart data for revenue trends
    const days = []
    const revenues = []
    const orders = []
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      days.push(date.toLocaleDateString('en-US', { weekday: 'short' }))
      revenues.push(Math.floor(Math.random() * 50000) + 20000)
      orders.push(Math.floor(Math.random() * 25) + 5)
    }

    setRevenueChartData({
      labels: days,
      datasets: [{
        label: 'Revenue (Rs)',
        data: revenues,
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 2
      }]
    })

    setOrdersChartData({
      labels: days,
      datasets: [{
        label: 'Orders',
        data: orders,
        backgroundColor: [
          '#ef4444', '#f97316', '#eab308', '#22c55e', 
          '#06b6d4', '#3b82f6', '#8b5cf6'
        ]
      }]
    })
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchDashboardData()
  }

  const formatCurrency = (amount: number) => {
    return `Rs ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatNumber = (num: number, options: { currency?: boolean, showDecimals?: boolean } = {}) => {
    const { currency = false, showDecimals = false } = options
    
    if (num === 0) return currency ? 'Rs 0' : '0'
    
    const absNum = Math.abs(num)
    const sign = num < 0 ? '-' : ''
    const prefix = currency ? 'Rs ' : ''
    
    if (absNum >= 1000000000000) {
      const value = (absNum / 1000000000000).toFixed(showDecimals ? 1 : 0)
      return `${sign}${prefix}${value}T`
    } else if (absNum >= 1000000000) {
      const value = (absNum / 1000000000).toFixed(showDecimals ? 1 : 0)
      return `${sign}${prefix}${value}B`
    } else if (absNum >= 1000000) {
      const value = (absNum / 1000000).toFixed(showDecimals ? 1 : 0)
      return `${sign}${prefix}${value}M`
    } else if (absNum >= 1000) {
      const value = (absNum / 1000).toFixed(showDecimals ? 1 : 0)
      return `${sign}${prefix}${value}K`
    } else {
      return `${sign}${prefix}${absNum.toLocaleString()}`
    }
  }

  const formatCompactNumber = (num: number) => {
    return formatNumber(num, { currency: false, showDecimals: false })
  }

  const getTimeAgo = (timestamp: string) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`
    }
  }

  const toggleWidgetVisibility = (widgetId: string) => {
    setWidgets(widgets.map(widget => 
      widget.id === widgetId 
        ? { ...widget, visible: !widget.visible }
        : widget
    ))
  }

  const resetDashboard = () => {
    setWidgets(widgets.map(widget => ({ ...widget, visible: true })))
    setFilters({
      dateRange: 'today',
      categories: [],
      orderStatus: [],
      customerType: [],
      deviceType: []
    })
  }

  const exportDashboard = () => {
    const dashboardData = {
      stats,
      topProducts,
      recentActivity,
      exportDate: new Date().toISOString(),
      filters
    }
    
    const dataStr = JSON.stringify(dashboardData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `dashboard-export-${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile': return <Smartphone className="w-4 h-4" />
      case 'tablet': return <Tablet className="w-4 h-4" />
      default: return <Monitor className="w-4 h-4" />
    }
  }

  const getTrendIcon = (trend: string, size: string = 'w-3 h-3') => {
    switch (trend) {
      case 'up': return <ArrowUp className={`${size} text-green-500`} />
      case 'down': return <ArrowDown className={`${size} text-red-500`} />
      default: return <Minus className={`${size} text-gray-400`} />
    }
  }

  if (loading && Object.values(stats).every(val => val === 0)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    )
  }

  const visibleWidgets = widgets.filter(w => w.visible).sort((a, b) => a.position - b.position)

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Farm Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user?.username} • {new Date().toLocaleDateString('en-LK', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </button>
          <button
            onClick={() => setShowCustomization(!showCustomization)}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Settings className="w-4 h-4 mr-2" />
            Customize
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Dashboard Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <select
                value={filters.dateRange}
                onChange={(e) => setFilters({ ...filters, dateRange: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="quarter">This Quarter</option>
                <option value="year">This Year</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
            
            {filters.dateRange === 'custom' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={filters.customStartDate || ''}
                    onChange={(e) => setFilters({ ...filters, customStartDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                  <input
                    type="date"
                    value={filters.customEndDate || ''}
                    onChange={(e) => setFilters({ ...filters, customEndDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Customization Panel */}
      {showCustomization && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Dashboard Customization</h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={resetDashboard}
                className="flex items-center px-3 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {widgets.map(widget => (
              <div key={widget.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <span className="font-medium">{widget.title}</span>
                <button
                  onClick={() => toggleWidgetVisibility(widget.id)}
                  className={`p-2 rounded-lg transition-colors ${
                    widget.visible 
                      ? 'text-green-600 bg-green-100 hover:bg-green-200' 
                      : 'text-gray-400 bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {widget.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Overview */}
      {visibleWidgets.find(w => w.id === 'kpi-overview') && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Essential KPI Cards - Compact */}
          <div className="lg:col-span-1 space-y-4">
            {/* Total Products Card */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium">Total Products</p>
                  <p className="text-3xl font-bold mt-1">{formatCompactNumber(stats.totalProducts)}</p>
                  <div className="flex items-center mt-2">
                    <TrendingUp className="w-4 h-4 mr-1" />
                    <span className="text-sm">Active inventory</span>
                  </div>
                </div>
                <Package className="w-12 h-12 text-blue-200" />
              </div>
            </div>

            {/* Low Stock Alert Card */}
            <div className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-yellow-100 text-sm font-medium">Low Stock</p>
                  <p className="text-3xl font-bold mt-1">{formatCompactNumber(stats.lowStockItems)}</p>
                  <div className="flex items-center mt-2">
                    <AlertTriangle className="w-4 h-4 mr-1" />
                    <span className="text-sm">{formatCompactNumber(stats.criticalStockItems)} critical</span>
                  </div>
                </div>
                <AlertTriangle className="w-12 h-12 text-yellow-200" />
              </div>
            </div>
          </div>

          {/* Customer Growth Chart */}
          <div className="bg-white rounded-xl shadow-lg p-6 transform hover:shadow-xl transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Customer Growth</h3>
                <p className="text-sm text-gray-600">Total: {formatCompactNumber(stats.totalCustomers)}</p>
              </div>
              <div className="flex items-center text-green-600">
                <TrendingUp className="w-5 h-5 mr-1" />
                <span className="font-semibold">+{stats.customerGrowth}%</span>
              </div>
            </div>
            <div className="h-32 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-500 opacity-20 rounded-lg"></div>
              <div className="relative z-10 text-center">
                <Users className="w-12 h-12 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-700">{formatCompactNumber(stats.totalCustomers)}</p>
                <p className="text-sm text-green-600">Active Customers</p>
              </div>
              {/* Simulated chart bars */}
              <div className="absolute bottom-0 left-4 w-2 bg-green-400 rounded-t" style={{height: '60%'}}></div>
              <div className="absolute bottom-0 left-8 w-2 bg-green-500 rounded-t" style={{height: '75%'}}></div>
              <div className="absolute bottom-0 left-12 w-2 bg-green-600 rounded-t" style={{height: '85%'}}></div>
              <div className="absolute bottom-0 left-16 w-2 bg-emerald-500 rounded-t" style={{height: '90%'}}></div>
              <div className="absolute bottom-0 left-20 w-2 bg-emerald-600 rounded-t" style={{height: '100%'}}></div>
            </div>
          </div>

          {/* Today's Orders Chart */}
          <div className="bg-white rounded-xl shadow-lg p-6 transform hover:shadow-xl transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Today's Orders</h3>
                <p className="text-sm text-gray-600">{formatCompactNumber(stats.pendingOrders)} pending</p>
              </div>
              <div className="text-2xl font-bold text-purple-600">{formatCompactNumber(stats.todayOrders)}</div>
            </div>
            <div className="h-32 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg flex items-center justify-center relative">
              <div className="relative z-10 text-center">
                <ShoppingCart className="w-12 h-12 text-purple-600 mx-auto mb-2" />
                <div className="flex items-center justify-center space-x-4">
                  <div className="text-center">
                    <p className="text-lg font-bold text-purple-700">{formatCompactNumber(stats.completedOrders)}</p>
                    <p className="text-xs text-purple-600">Completed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-orange-700">{formatCompactNumber(stats.pendingOrders)}</p>
                    <p className="text-xs text-orange-600">Pending</p>
                  </div>
                </div>
              </div>
              {/* Simulated donut chart */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full border-8 border-purple-200" style={{
                  background: `conic-gradient(#8b5cf6 0deg ${(stats.completedOrders / (stats.completedOrders + stats.pendingOrders)) * 360}deg, #f97316 ${(stats.completedOrders / (stats.completedOrders + stats.pendingOrders)) * 360}deg 360deg)`
                }}></div>
              </div>
            </div>
          </div>

          {/* Revenue Trend Chart */}
          <div className="bg-white rounded-xl shadow-lg p-6 transform hover:shadow-xl transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Revenue Trend</h3>
                <p className="text-sm text-gray-600">Today vs Yesterday</p>
              </div>
              <div className="flex items-center text-indigo-600">
                <TrendingUp className="w-5 h-5 mr-1" />
                <span className="font-semibold">+{stats.revenueGrowth}%</span>
              </div>
            </div>
            <div className="h-32 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg flex items-end justify-between p-4 relative overflow-hidden">
              <div className="absolute top-4 left-4 text-center">
                <p className="text-2xl font-bold text-indigo-700 break-words">{formatCurrency(stats.todayRevenue)}</p>
                <p className="text-xs text-indigo-600">Today's Revenue</p>
              </div>
              {/* Simulated line chart */}
              <div className="flex items-end space-x-2 absolute bottom-4 right-4">
                <div className="w-3 bg-indigo-300 rounded-t" style={{height: '20px'}}></div>
                <div className="w-3 bg-indigo-400 rounded-t" style={{height: '35px'}}></div>
                <div className="w-3 bg-indigo-500 rounded-t" style={{height: '25px'}}></div>
                <div className="w-3 bg-indigo-600 rounded-t" style={{height: '45px'}}></div>
                <div className="w-3 bg-indigo-700 rounded-t" style={{height: '55px'}}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Revenue Donut Chart */}
      {visibleWidgets.find(w => w.id === 'revenue-chart') && (
        <div className="bg-white rounded-xl shadow-lg p-6 transform hover:shadow-xl transition-all duration-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Monthly Revenue Distribution</h3>
              <p className="text-sm text-gray-600">Total: {formatCurrency(stats.monthlyRevenue)}</p>
            </div>
            <div className="flex items-center text-red-600">
              <Target className="w-6 h-6 mr-2" />
              <span className="text-lg font-bold">{formatCompactNumber(stats.monthlyOrders)} orders</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Donut Chart Visualization */}
            <div className="flex items-center justify-center">
              <div className="relative w-48 h-48">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-400 to-pink-500 opacity-20"></div>
                <div className="absolute inset-4 rounded-full bg-white flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900 break-words">{formatCurrency(stats.monthlyRevenue)}</p>
                    <p className="text-sm text-gray-600">Total Revenue</p>
                  </div>
                </div>
                {/* Simulated donut segments */}
                <div className="absolute inset-0 rounded-full border-8 border-red-400" style={{
                  background: `conic-gradient(#ef4444 0deg 120deg, #f97316 120deg 200deg, #eab308 200deg 280deg, #22c55e 280deg 360deg)`
                }}></div>
              </div>
            </div>
            
            {/* Revenue Breakdown */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-red-400 rounded-full mr-3"></div>
                  <span className="font-medium">Today</span>
                </div>
                <span className="font-bold text-red-700 break-words">{formatCurrency(stats.todayRevenue)}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-orange-400 rounded-full mr-3"></div>
                  <span className="font-medium">This Week</span>
                </div>
                <span className="font-bold text-orange-700 break-words">{formatCurrency(stats.weeklyRevenue)}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-yellow-400 rounded-full mr-3"></div>
                  <span className="font-medium">Previous Week</span>
                </div>
                <span className="font-bold text-yellow-700 break-words">{formatCurrency(stats.weeklyRevenue * 0.8)}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-green-400 rounded-full mr-3"></div>
                  <span className="font-medium">Other</span>
                </div>
                <span className="font-bold text-green-700 break-words">{formatCurrency(stats.monthlyRevenue - stats.todayRevenue - stats.weeklyRevenue - (stats.weeklyRevenue * 0.8))}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Middle Row - Stock, Products, Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stock Management */}
        {visibleWidgets.find(w => w.id === 'stock-alerts') && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Stock Management</h3>
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div>
                  <p className="font-medium text-red-800">Critical Stock</p>
                  <p className="text-sm text-red-600">{formatCompactNumber(stats.criticalStockItems)} items out of stock</p>
                </div>
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 font-bold text-sm">{formatCompactNumber(stats.criticalStockItems)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div>
                  <p className="font-medium text-yellow-800">Low Stock</p>
                  <p className="text-sm text-yellow-600">{formatCompactNumber(stats.lowStockItems)} items below threshold</p>
                </div>
                <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                  <span className="text-yellow-600 font-bold text-sm">{formatCompactNumber(stats.lowStockItems)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div>
                  <p className="font-medium text-green-800">Healthy Stock</p>
                  <p className="text-sm text-green-600">{formatCompactNumber(stats.totalProducts - stats.lowStockItems - stats.criticalStockItems)} items well stocked</p>
                </div>
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 font-bold text-sm">{formatCompactNumber(stats.totalProducts - stats.lowStockItems - stats.criticalStockItems)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Top Products */}
        {visibleWidgets.find(w => w.id === 'top-products') && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Top Products</h3>
              <PieChart className="w-5 h-5 text-gray-400" />
            </div>
            <div className="space-y-4">
              {topProducts.slice(0, 5).map((product, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                      <span className="text-sm font-semibold text-gray-600">{index + 1}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-sm text-gray-500">{product.category}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900 break-words">{formatCurrency(product.revenue)}</p>
                    <div className="flex items-center">
                      <span className="text-sm text-gray-500 mr-1">{formatCompactNumber(product.totalSold)} kg</span>
                      {getTrendIcon(product.trend)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* User Analytics */}
        {visibleWidgets.find(w => w.id === 'user-analytics') && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">User Analytics</h3>
              <UserCheck className="w-5 h-5 text-gray-400" />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center">
                  <Globe className="w-5 h-5 text-blue-600 mr-3" />
                  <div>
                    <p className="font-medium text-blue-800">Online Users</p>
                    <p className="text-sm text-blue-600">Currently active</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-blue-900">{formatCompactNumber(stats.onlineUsers)}</p>
                  <p className="text-xs text-blue-600">of {formatCompactNumber(stats.totalUsers)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Retention</p>
                  <p className="text-lg font-bold text-gray-900">{stats.customerRetention}%</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Growth</p>
                  <p className="text-lg font-bold text-green-600">+{stats.customerGrowth}%</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Row - Device Analytics, Weather, Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Device Analytics */}
        {visibleWidgets.find(w => w.id === 'device-breakdown') && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Device Analytics</h3>
              <Smartphone className="w-5 h-5 text-gray-400" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Smartphone className="w-4 h-4 text-blue-600 mr-2" />
                  <span className="text-sm text-gray-700">Mobile</span>
                </div>
                <span className="font-semibold">{formatCompactNumber(stats.mobileLogins)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Monitor className="w-4 h-4 text-green-600 mr-2" />
                  <span className="text-sm text-gray-700">Desktop</span>
                </div>
                <span className="font-semibold">{formatCompactNumber(stats.desktopLogins)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Tablet className="w-4 h-4 text-purple-600 mr-2" />
                  <span className="text-sm text-gray-700">Tablet</span>
                </div>
                <span className="font-semibold">{formatCompactNumber(stats.tabletLogins)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Weather Widget */}
        {visibleWidgets.find(w => w.id === 'weather-widget') && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Farm Weather</h3>
              <Sun className="w-5 h-5 text-yellow-500" />
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Thermometer className="w-6 h-6 text-red-500 mr-2" />
                <span className="text-2xl font-bold text-gray-900">{weather.temperature}°C</span>
              </div>
              <p className="text-sm text-gray-600 mb-3">{weather.condition}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center">
                  <Droplets className="w-3 h-3 text-blue-500 mr-1" />
                  <span>{weather.humidity}%</span>
                </div>
                <div className="flex items-center">
                  <Wind className="w-3 h-3 text-gray-500 mr-1" />
                  <span>{weather.windSpeed} km/h</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Performance Metrics */}
        {visibleWidgets.find(w => w.id === 'performance-metrics') && (
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Performance Metrics</h3>
              <Activity className="w-5 h-5 text-gray-400" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Target className="w-6 h-6 text-green-600" />
                </div>
                <p className="text-lg font-bold text-gray-900">{stats.conversionRate}%</p>
                <p className="text-sm text-gray-600">Conversion Rate</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <DollarSign className="w-6 h-6 text-blue-600" />
                </div>
                <p className="text-lg font-bold text-gray-900 break-words">{formatCurrency(stats.avgOrderValue)}</p>
                <p className="text-sm text-gray-600">Avg Order Value</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <p className="text-lg font-bold text-gray-900">{stats.customerRetention}%</p>
                <p className="text-sm text-gray-600">Customer Retention</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <TrendingUp className="w-6 h-6 text-yellow-600" />
                </div>
                <p className="text-lg font-bold text-gray-900">+{stats.orderGrowth}%</p>
                <p className="text-sm text-gray-600">Order Growth</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      {visibleWidgets.find(w => w.id === 'recent-activity') && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Live Activity Feed</h3>
            <Clock className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                    activity.type === 'order' ? 'bg-blue-100' :
                    activity.type === 'stock' ? 'bg-yellow-100' :
                    activity.type === 'customer' ? 'bg-green-100' :
                    activity.type === 'system' ? 'bg-purple-100' : 'bg-red-100'
                  }`}>
                    {activity.type === 'order' && <ShoppingCart className="w-4 h-4 text-blue-600" />}
                    {activity.type === 'stock' && <Package className="w-4 h-4 text-yellow-600" />}
                    {activity.type === 'customer' && <Users className="w-4 h-4 text-green-600" />}
                    {activity.type === 'system' && <Settings className="w-4 h-4 text-purple-600" />}
                    {activity.type === 'alert' && <AlertTriangle className="w-4 h-4 text-red-600" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                    <div className="flex items-center space-x-2">
                      <p className="text-xs text-gray-500">{getTimeAgo(activity.timestamp)}</p>
                      {activity.deviceType && (
                        <div className="flex items-center text-xs text-gray-400">
                          {getDeviceIcon(activity.deviceType)}
                          <span className="ml-1 capitalize">{activity.deviceType}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {activity.status && (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      activity.status === 'completed' || activity.status === 'Completed' ? 'bg-green-100 text-green-800' :
                      activity.status === 'pending' || activity.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {activity.status}
                    </span>
                  )}
                  {activity.priority && (
                    <div className={`w-2 h-2 rounded-full ${
                      activity.priority === 'high' ? 'bg-red-500' :
                      activity.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                    }`} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}