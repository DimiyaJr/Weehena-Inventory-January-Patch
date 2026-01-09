// src/components/SecurityCheckIncompleteOrders.tsx
import React, { useState, useEffect } from 'react'
import { Search, Eye, Calendar, User, Filter, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'

interface Order {
  id: string
  order_display_id?: string
  customer_id: string
  status: string
  created_by: string
  assigned_to: string | null
  security_check_status: string
  security_check_notes: string | null
  vehicle_number: string | null
  created_at: string
  customers: { name: string }
  assigned_user?: { username: string }
}

interface UserType {
  id: string
  username: string
}

export const SecurityCheckIncompleteOrders: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [incompleteOrders, setIncompleteOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter, setEndDateFilter] = useState('')
  const [salesRepFilter, setSalesRepFilter] = useState('all')
  const [salesRepsList, setSalesRepsList] = useState<UserType[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (user?.role === 'Super Admin' || user?.role === 'Admin') {
      fetchIncompleteOrders()
      fetchSalesReps()
    }
  }, [user, startDateFilter, endDateFilter, salesRepFilter])

  const fetchSalesReps = async () => {
    try {
      const cacheKey = 'security_incomplete_sales_reps'
      if (!navigator.onLine) {
        const cachedData = localStorage.getItem(cacheKey)
        if (cachedData) {
          setSalesRepsList(JSON.parse(cachedData))
          return
        }
      }

      const { data, error } = await supabase
        .from('users')
        .select('id, username') // Only need id and username for filter
        .eq('role', 'Sales Rep')
        .order('username')
      if (error) throw error

      localStorage.setItem(cacheKey, JSON.stringify(data))
      setSalesRepsList(data || [])
    } catch (error) {
      console.error('Error fetching sales reps:', error)
      const cacheKey = 'security_incomplete_sales_reps'
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        setSalesRepsList(JSON.parse(cachedData))
      } else {
        setSalesRepsList([])
      }
    }
  }

  const fetchIncompleteOrders = async () => {
    setLoading(true)
    const cacheKey = `security_incomplete_orders_${startDateFilter}_${endDateFilter}_${salesRepFilter}`
    if (!navigator.onLine) {
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        setIncompleteOrders(JSON.parse(cachedData))
        setLoading(false)
        return
      }
    }

    try {
      let query = supabase
        .from('orders')
        .select(`id, order_display_id, customer_id, status, created_by, assigned_to, security_check_status, security_check_notes, vehicle_number, created_at, customers (name), assigned_user:users!orders_assigned_to_fkey (username)`) // Select only necessary columns for display and linking

      if (startDateFilter) {
        query = query.gte('created_at', startDateFilter)
      }
      if (endDateFilter) {
        query = query.lte('created_at', endDateFilter + 'T23:59:59') // Include end of day
      }
      if (salesRepFilter !== 'all') {
        query = query.eq('assigned_to', salesRepFilter)
      }

      query = query.order('created_at', { ascending: false })

      const { data, error } = await query
      if (error) throw error

      localStorage.setItem(cacheKey, JSON.stringify(data))
      setIncompleteOrders(data || [])
    } catch (error) {
      console.error('Error fetching incomplete orders:', error)
      const cacheKey = `security_incomplete_orders_${startDateFilter}_${endDateFilter}_${salesRepFilter}`
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        setIncompleteOrders(JSON.parse(cachedData))
      } else {
        setIncompleteOrders([])
      }
    } finally {
      setLoading(false)
    }
  }

  const renderSecurityCheckNotes = (notes: string | null | undefined) => {
    if (!notes) return 'No notes provided.'
    try {
      const parsedNotes = JSON.parse(notes)
      return (
        <>
          {parsedNotes.reasons && parsedNotes.reasons.length > 0 && (
            <p><strong>Reasons:</strong> {parsedNotes.reasons.join(', ')}</p>
          )}
          {parsedNotes.customNote && (
            <p><strong>Notes:</strong> {parsedNotes.customNote}</p>
          )}
        </>
      )
    } catch (e) {
      return notes // Fallback if not JSON
    }
  }

  const getFilteredAndSearchedOrders = () => {
    let filtered = incompleteOrders
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase()
      filtered = filtered.filter(order =>
        order.order_display_id?.toLowerCase().includes(lowerCaseSearchTerm) ||
        order.customers.name.toLowerCase().includes(lowerCaseSearchTerm) ||
        order.assigned_user?.username?.toLowerCase().includes(lowerCaseSearchTerm) ||
        order.vehicle_number?.toLowerCase().includes(lowerCaseSearchTerm) ||
        order.security_check_notes?.toLowerCase().includes(lowerCaseSearchTerm)
      )
    }
    return filtered
  }

  if (!['Super Admin', 'Admin'].includes(user?.role)) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Filter className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">Only Super Admins and Admins can view security check incomplete orders.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading incomplete orders...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Security Check Incomplete Orders</h1>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Date Range Filter */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="Start Date"
            />
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="End Date"
            />
          </div>

          {/* Sales Rep Filter */}
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
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
        </div>

        {/* Search Bar */}
        <div className="relative">
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

      {getFilteredAndSearchedOrders().length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Filter className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Incomplete Orders Found</h2>
          <p className="text-gray-600">Adjust your filters or check back later.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Mobile Card Layout */}
          <div className="block md:hidden">
            <div className="space-y-2">
              {getFilteredAndSearchedOrders().map((order) => (
                <div key={order.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center flex-1 min-w-0">
                      <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                        <FileText className="w-4 h-4 text-red-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          Order {order.order_display_id}
                        </h3>
                        <div className="flex items-center mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            Security Check Incomplete
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-3">
                      <button
                        onClick={() => navigate(`/sales-orders?orderId=${order.id}`)}
                        className="p-2 text-blue-600 bg-blue-100 rounded-full hover:bg-blue-200 touch-manipulation"
                        title="View Details"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-1 text-xs ml-11">
                    <div className="flex items-start">
                      <span className="text-gray-500 font-medium w-16 flex-shrink-0">Customer:</span>
                      <span className="text-gray-700 flex-1">{order.customers.name}</span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-gray-500 font-medium w-16 flex-shrink-0">Sales Rep:</span>
                      <span className="text-gray-700 flex-1">{order.assigned_user?.username || 'N/A'}</span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-gray-500 font-medium w-16 flex-shrink-0">Vehicle:</span>
                      <span className="text-gray-700 flex-1">{order.vehicle_number || 'N/A'}</span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-gray-500 font-medium w-16 flex-shrink-0">Notes:</span>
                      <span className="text-gray-700 flex-1">
                        {renderSecurityCheckNotes(order.security_check_notes)}
                      </span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-gray-500 font-medium w-16 flex-shrink-0">Created:</span>
                      <span className="text-gray-700 flex-1">{new Date(order.created_at).toLocaleString()}</span>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sales Rep</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Security Notes</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {getFilteredAndSearchedOrders().map((order, index) => (
                    <tr key={order.id} className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-gray-100`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {order.order_display_id}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.customers.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.assigned_user?.username || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.vehicle_number || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                        {renderSecurityCheckNotes(order.security_check_notes)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(order.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => navigate(`/sales-orders?orderId=${order.id}`)} // Redirect to SalesOrders with orderId
                          className="text-blue-600 hover:text-blue-900"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
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
    </div>
  )
}