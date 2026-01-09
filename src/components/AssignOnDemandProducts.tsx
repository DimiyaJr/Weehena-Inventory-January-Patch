import React, { useState, useEffect } from 'react'
import { Plus, Save, Trash2, X, Calendar, User, Package, Car, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

interface Product {
  id: string
  name: string
  quantity: number
  price_cash?: number
  price_credit?: number
  price_dealer_cash?: number
  price_dealer_credit?: number
  price_hotel_non_vat?: number
  price_hotel_vat?: number
  price_farm_shop?: number
  categories?: {
    category_name: string
  }
}

interface UserType {
  id: string
  username: string
  role: string
}

interface AssignmentItem {
  id: string
  on_demand_assignment_id: string
  product_id: string
  assigned_quantity: number
  sold_quantity: number
  returned_quantity: number
  products?: Product
}

interface OnDemandAssignment {
  id: string
  sales_rep_id: string
  assigned_by: string
  assignment_date: string
  notes: string
  status: 'active' | 'completed' | 'cancelled'
  vehicle_number: string
  assignment_type: 'admin_assigned' | 'sales_rep_requested'
  sales_rep?: UserType
  assigned_by_user?: UserType
  assignment_items?: AssignmentItem[]
  created_at?: string
}

interface ProductAssignment {
  id: string
  product_id: string
  product_name: string
  assigned_quantity: number
  available_stock: number
}

export const AssignOnDemandProducts: React.FC = () => {
  const { user } = useAuth()
  const [salesReps, setSalesReps] = useState<UserType[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [assignments, setAssignments] = useState<OnDemandAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filterSalesRepId, setFilterSalesRepId] = useState('')
  const [filterVehicleNumber, setFilterVehicleNumber] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all')
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')
  const [formData, setFormData] = useState({
    sales_rep_id: '',
    assignment_date: new Date().toISOString().split('T')[0],
    notes: '',
    vehicle_number: ''
  })
  const [productAssignments, setProductAssignments] = useState<ProductAssignment[]>([])
  const [saving, setSaving] = useState(false)
  const [expandedAssignmentId, setExpandedAssignmentId] = useState<string | null>(null)
  const [isAssignmentsFromCache, setIsAssignmentsFromCache] = useState(false)

  // Use a fallback weight unit
  const WEIGHT_UNIT = 'kg'

  useEffect(() => {
    fetchSalesReps()
    fetchProducts()
    fetchAssignments()
  }, [filterSalesRepId, filterVehicleNumber, statusFilter, filterStartDate, filterEndDate])

  const fetchSalesReps = async () => {
    try {
      const cacheKey = 'assign_on_demand_sales_reps'
      if (!navigator.onLine) {
        const cachedData = localStorage.getItem(cacheKey)
        if (cachedData) {
          setSalesReps(JSON.parse(cachedData))
          return
        }
      }

      const { data, error } = await supabase
        .from('users')
        .select('id, username, role')
        .eq('role', 'Sales Rep')
        .order('username')

      if (error) throw error

      localStorage.setItem(cacheKey, JSON.stringify(data))
      setSalesReps(data || [])
    } catch (error) {
      console.error('Error fetching sales reps:', error)
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        setSalesReps(JSON.parse(cachedData))
      } else {
        setSalesReps([])
      }
    }
  }

  const fetchProducts = async () => {
    try {
      const cacheKey = 'assign_on_demand_products'
      if (!navigator.onLine) {
        const cachedData = localStorage.getItem(cacheKey)
        if (cachedData) {
          setProducts(JSON.parse(cachedData))
          return
        }
      }

      const { data, error } = await supabase
        .from('products')
        .select(`
          id, 
          name, 
          quantity,
          price_cash,
          price_credit,
          price_dealer_cash,
          price_dealer_credit,
          price_hotel_non_vat,
          price_hotel_vat,
          price_farm_shop,
          categories (
            category_name
          )
        `)
        .gt('quantity', 0)
        .order('name')

      if (error) throw error

      localStorage.setItem(cacheKey, JSON.stringify(data))
      setProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        setProducts(JSON.parse(cachedData))
      } else {
        setProducts([])
      }
    }
  }

  const fetchAssignments = async () => {
    try {
      setIsAssignmentsFromCache(false)
      const cacheKey = `on_demand_assignments_${filterSalesRepId}_${filterVehicleNumber}_${statusFilter}_${filterStartDate}_${filterEndDate}`
      if (!navigator.onLine) {
        const cachedData = localStorage.getItem(cacheKey)
        if (cachedData) {
          setAssignments(JSON.parse(cachedData))
          setIsAssignmentsFromCache(true)
          setLoading(false)
          return
        }
      }

      let query = supabase
        .from('on_demand_assignments')
        .select(`
          id, 
          sales_rep_id, 
          assigned_by, 
          assignment_date, 
          notes, 
          status, 
          vehicle_number, 
          assignment_type,
          created_at,
          sales_rep:users!on_demand_assignments_sales_rep_id_fkey (
            id,
            username,
            role
          ),
          assigned_by_user:users!on_demand_assignments_assigned_by_fkey (
            id,
            username,
            role
          ),
          assignment_items:on_demand_assignment_items (
            id, 
            on_demand_assignment_id, 
            product_id, 
            assigned_quantity, 
            sold_quantity, 
            returned_quantity, 
            products (
              id,
              name,
              quantity,
              categories (
                category_name
              )
            )
          )
        `)

      // Apply filters
      if (filterSalesRepId) {
        query = query.eq('sales_rep_id', filterSalesRepId)
      }
      
      if (filterVehicleNumber) {
        query = query.ilike('vehicle_number', `%${filterVehicleNumber}%`)
      }
      
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }
      
      if (filterStartDate) {
        query = query.gte('assignment_date', filterStartDate)
      }
      
      if (filterEndDate) {
        query = query.lte('assignment_date', filterEndDate)
      }

      query = query.order('created_at', { ascending: false })

      const { data, error } = await query

      if (error) throw error

      localStorage.setItem(cacheKey, JSON.stringify(data))
      setAssignments(data || [])
    } catch (error) {
      console.error('Error fetching assignments:', error)
      const cacheKey = `on_demand_assignments_${filterSalesRepId}_${filterVehicleNumber}_${statusFilter}_${filterStartDate}_${filterEndDate}`
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        setAssignments(JSON.parse(cachedData))
        setIsAssignmentsFromCache(true)
      } else {
        setAssignments([])
      }
    } finally {
      setLoading(false)
    }
  }

  const addProductAssignment = () => {
    setProductAssignments([
      ...productAssignments,
      {
        id: `temp-${Date.now()}`,
        product_id: '',
        product_name: '',
        assigned_quantity: 0,
        available_stock: 0
      }
    ])
  }

  const updateProductAssignment = (id: string, field: keyof ProductAssignment, value: any) => {
    setProductAssignments(productAssignments.map(item => {
      if (item.id === id) {
        if (field === 'product_id') {
          const selectedProduct = products.find(p => p.id === value)
          return {
            ...item,
            product_id: value,
            product_name: selectedProduct?.name || '',
            available_stock: selectedProduct?.quantity || 0
          }
        }
        return { ...item, [field]: value }
      }
      return item
    }))
  }

  const removeProductAssignment = (id: string) => {
    setProductAssignments(productAssignments.filter(item => item.id !== id))
  }

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.sales_rep_id) {
      alert('Please select a sales rep')
      return
    }

    if (productAssignments.length === 0) {
      alert('Please add at least one product')
      return
    }

    const validAssignments = productAssignments.filter(item => 
      item.product_id && item.assigned_quantity > 0
    )

    if (validAssignments.length === 0) {
      alert('Please add valid product assignments')
      return
    }

    // Check if assigned quantities don't exceed available stock
    for (const assignment of validAssignments) {
      if (assignment.assigned_quantity > assignment.available_stock) {
        alert(`Cannot assign ${assignment.assigned_quantity} of ${assignment.product_name}. Only ${assignment.available_stock} available.`)
        return
      }
    }

    setSaving(true)
    try {
      // Create assignment
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('on_demand_assignments')
        .insert([{
          sales_rep_id: formData.sales_rep_id,
          assigned_by: user?.id,
          assignment_date: formData.assignment_date,
          notes: formData.notes,
          vehicle_number: formData.vehicle_number.trim() || null,
          assignment_type: 'admin_assigned',
          status: 'active'
        }])
        .select()
        .single()

      if (assignmentError) throw assignmentError

      // Create assignment items
      const assignmentItems = validAssignments.map(item => ({
        on_demand_assignment_id: assignmentData.id,
        product_id: item.product_id,
        assigned_quantity: item.assigned_quantity,
        sold_quantity: 0,
        returned_quantity: 0
      }))

      const { error: itemsError } = await supabase
        .from('on_demand_assignment_items')
        .insert(assignmentItems)

      if (itemsError) throw itemsError

      // Update product quantities (reduce from main inventory)
      for (const assignment of validAssignments) {
        const product = products.find(p => p.id === assignment.product_id)
        if (product) {
          const { error: updateError } = await supabase
            .from('products')
            .update({ 
              quantity: product.quantity - assignment.assigned_quantity 
            })
            .eq('id', assignment.product_id)

          if (updateError) throw updateError
        }
      }

      alert('Assignment created successfully!')
      setShowModal(false)
      setFormData({
        sales_rep_id: '',
        assignment_date: new Date().toISOString().split('T')[0],
        notes: '',
        vehicle_number: ''
      })
      setProductAssignments([])
      fetchAssignments()
      fetchProducts()
    } catch (error) {
      console.error('Error creating assignment:', error)
      alert('Failed to create assignment. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to cancel this assignment? This will return all unsold products to inventory.')) {
      return
    }

    try {
      // Get assignment items to return quantities to inventory
      const { data: items, error: itemsError } = await supabase
        .from('on_demand_assignment_items')
        .select('*, products(*)')
        .eq('on_demand_assignment_id', assignmentId)

      if (itemsError) throw itemsError

      // Return unsold quantities to inventory
      for (const item of items || []) {
        const unsoldQuantity = item.assigned_quantity - item.sold_quantity - item.returned_quantity
        if (unsoldQuantity > 0 && item.products) {
          const { error: updateError } = await supabase
            .from('products')
            .update({ 
              quantity: item.products.quantity + unsoldQuantity 
            })
            .eq('id', item.product_id)

          if (updateError) throw updateError
        }
      }

      // Update assignment status
      const { error: statusError } = await supabase
        .from('on_demand_assignments')
        .update({ status: 'cancelled' })
        .eq('id', assignmentId)

      if (statusError) throw statusError

      alert('Assignment cancelled successfully!')
      fetchAssignments()
      fetchProducts()
    } catch (error) {
      console.error('Error cancelling assignment:', error)
      alert('Failed to cancel assignment. Please try again.')
    }
  }

  const toggleAssignmentExpansion = (assignmentId: string) => {
    setExpandedAssignmentId(expandedAssignmentId === assignmentId ? null : assignmentId)
  }

  const getTotalAssignedQuantity = (assignment: OnDemandAssignment) => {
    return assignment.assignment_items?.reduce((total, item) => total + item.assigned_quantity, 0) || 0
  }

  const getTotalSoldQuantity = (assignment: OnDemandAssignment) => {
    return assignment.assignment_items?.reduce((total, item) => total + item.sold_quantity, 0) || 0
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'completed':
        return 'bg-blue-100 text-blue-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getConsolidatedAssignmentItems = (assignment: OnDemandAssignment) => {
    if (!assignment.assignment_items || assignment.assignment_items.length === 0) {
      return [];
    }

    // Group items by product_id
    const grouped = assignment.assignment_items.reduce((acc, item) => {
      const productId = item.product_id;
      if (!acc[productId]) {
        acc[productId] = {
          product_id: productId,
          product_name: item.products?.name || 'Unknown Product',
          category_name: item.products?.categories?.category_name || 'Uncategorized',
          assigned_quantity: 0,
          sold_quantity: 0,
          returned_quantity: 0,
          assignment_item_ids: [] as string[], // Track all item IDs for this product
        };
      }
      acc[productId].assigned_quantity += item.assigned_quantity;
      acc[productId].sold_quantity += item.sold_quantity;
      acc[productId].returned_quantity += item.returned_quantity;
      acc[productId].assignment_item_ids.push(item.id);
      return acc;
    }, {} as Record<string, any>);

    return Object.values(grouped);
  };

  if (!user?.role || !['Super Admin', 'Admin', 'Security Guard'].includes(user.role)) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">Only Admins can assign On Demand products.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading assignments...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Assign On Demand Products</h1>
        {['Super Admin', 'Admin'].includes(user?.role) && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Assignment
          </button>
        )}
      </div>

      {/* Cache Indicator */}
      {isAssignmentsFromCache && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="text-sm text-yellow-800">
            <strong>Offline Mode:</strong> Showing cached data. Some information may not be up to date.
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Sales Rep Filter */}
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select
              value={filterSalesRepId}
              onChange={(e) => setFilterSalesRepId(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="">All Sales Reps</option>
              {salesReps.map((rep) => (
                <option key={rep.id} value={rep.id}>
                  {rep.username}
                </option>
              ))}
            </select>
          </div>

          {/* Vehicle Number Filter */}
          <div className="relative">
            <Car className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Vehicle number..."
              value={filterVehicleNumber}
              onChange={(e) => setFilterVehicleNumber(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'completed' | 'cancelled')}
              className="w-full pl-4 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Start Date Filter */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="Start date"
            />
          </div>

          {/* End Date Filter */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="End date"
            />
          </div>
        </div>
      </div>

      {/* Assignments List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Mobile Card Layout */}
        <div className="block md:hidden">
          {assignments.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No assignments found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center flex-1 min-w-0">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {assignment.sales_rep?.username}
                        </h3>
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(assignment.status)}`}>
                            {assignment.status}
                          </span>
                          {assignment.assignment_type === 'sales_rep_requested' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              Self-Requested
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-3">
                      {assignment.status === 'active' && ['Super Admin', 'Admin'].includes(user?.role) && (
                        <button
                          onClick={() => handleCancelAssignment(assignment.id)}
                          className="p-2.5 text-red-600 bg-red-100 rounded-full hover:bg-red-200 touch-manipulation"
                          title="Cancel Assignment"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        onClick={() => toggleAssignmentExpansion(assignment.id)}
                        className="p-2.5 text-gray-600 bg-gray-100 rounded-full hover:bg-gray-200 touch-manipulation"
                        title="Toggle details"
                      >
                        {expandedAssignmentId === assignment.id ? (
                          <ChevronDown className="w-5 h-5" />
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs ml-11">
                    <div className="flex items-start">
                      <span className="text-gray-500 font-medium w-16 flex-shrink-0">Date:</span>
                      <span className="text-gray-700 flex-1">{new Date(assignment.assignment_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-gray-500 font-medium w-16 flex-shrink-0">Vehicle:</span>
                      <span className="text-gray-700 flex-1">{assignment.vehicle_number || 'N/A'}</span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-gray-500 font-medium w-16 flex-shrink-0">Assigned:</span>
                      <span className="text-gray-700 flex-1">{getTotalAssignedQuantity(assignment)} {WEIGHT_UNIT}</span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-gray-500 font-medium w-16 flex-shrink-0">Sold:</span>
                      <span className="text-gray-700 flex-1">{getTotalSoldQuantity(assignment)} {WEIGHT_UNIT}</span>
                    </div>
                    {expandedAssignmentId === assignment.id && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-900 mb-2">Products:</h4>
                        {getConsolidatedAssignmentItems(assignment).map((item) => {
                          const remaining = item.assigned_quantity - item.sold_quantity - item.returned_quantity;
                          return (
                            <div key={item.product_id} className="flex justify-between items-center text-xs py-1">
                              <span className="font-medium">{item.product_name}</span>
                              <span>{item.assigned_quantity} {WEIGHT_UNIT} assigned, {item.sold_quantity} {WEIGHT_UNIT} sold, {remaining} {WEIGHT_UNIT} remaining</span>
                            </div>
                          );
                        })}
                        <div className="flex items-start mt-2">
                          <span className="text-gray-500 font-medium w-16 flex-shrink-0">Notes:</span>
                          <span className="text-gray-700 flex-1">{assignment.notes || 'No notes'}</span>
                        </div>
                        <div className="flex items-start">
                          <span className="text-gray-500 font-medium w-16 flex-shrink-0">Assigned By:</span>
                          <span className="text-gray-700 flex-1">{assignment.assigned_by_user?.username}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desktop Table Layout */}
        <div className="hidden md:block">
          {assignments.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No assignments found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">
                      
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sales Rep
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assignment Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vehicle Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Assigned ({WEIGHT_UNIT})
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Sold ({WEIGHT_UNIT})
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assigned By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {assignments.map((assignment, index) => (
                    <React.Fragment key={assignment.id}>
                      <tr 
                        className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-gray-100 cursor-pointer`}
                        onClick={() => toggleAssignmentExpansion(assignment.id)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button className="text-gray-400 hover:text-gray-600">
                            {expandedAssignmentId === assignment.id ? (
                              <ChevronDown className="w-5 h-5" />
                            ) : (
                              <ChevronRight className="w-5 h-5" />
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <User className="w-8 h-8 text-blue-600 mr-3" />
                            <div className="text-sm font-medium text-gray-900">
                              {assignment.sales_rep?.username}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(assignment.assignment_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {assignment.vehicle_number || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {getTotalAssignedQuantity(assignment)} {WEIGHT_UNIT}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {getTotalSoldQuantity(assignment)} {WEIGHT_UNIT}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(assignment.status)}`}>
                              {assignment.status}
                            </span>
                            {assignment.assignment_type === 'sales_rep_requested' && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Self-Requested
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {assignment.assigned_by_user?.username}
                          {assignment.assignment_type === 'sales_rep_requested' && (
                            <span className="text-xs text-gray-500 block">(Self)</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {assignment.status === 'active' && ['Super Admin', 'Admin'].includes(user?.role) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCancelAssignment(assignment.id)
                              }}
                              className="p-2 text-red-600 hover:text-red-900 rounded-full hover:bg-red-100"
                              title="Cancel Assignment"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                      
                      {/* Expanded Details Row */}
                      {expandedAssignmentId === assignment.id && (
                        <tr>
                          <td colSpan={9} className="px-6 py-4 bg-gray-50">
                            <div className="space-y-4">
                              <h4 className="text-sm font-semibold text-gray-900 mb-3">Assignment Details</h4>
                              
                              {/* Assignment Info */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <div className="bg-white p-3 rounded-lg border">
                                  <div className="text-xs text-gray-500 mb-1">Vehicle Number</div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {assignment.vehicle_number || 'Not specified'}
                                  </div>
                                </div>
                                <div className="bg-white p-3 rounded-lg border">
                                  <div className="text-xs text-gray-500 mb-1">Assignment Date</div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {new Date(assignment.assignment_date).toLocaleDateString()}
                                  </div>
                                </div>
                                <div className="bg-white p-3 rounded-lg border">
                                  <div className="text-xs text-gray-500 mb-1">Notes</div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {assignment.notes || 'No notes'}
                                  </div>
                                </div>
                              </div>

                              {/* Products Table */}
                              <div className="bg-white rounded-lg border overflow-hidden">
                                <div className="px-4 py-3 bg-gray-100 border-b">
                                  <h5 className="text-sm font-medium text-gray-900">Assigned Products</h5>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full">
                                    <thead className="bg-gray-50">
                                      <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product Name</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Assigned ({WEIGHT_UNIT})</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sold ({WEIGHT_UNIT})</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Returned ({WEIGHT_UNIT})</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Remaining ({WEIGHT_UNIT})</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                      {getConsolidatedAssignmentItems(assignment).map((item, itemIndex) => {
                                        const remaining = item.assigned_quantity - item.sold_quantity - item.returned_quantity;
                                        return (
                                          <tr key={item.product_id} className={`${itemIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-gray-100`}>
                                            <td className="px-4 py-2 text-sm text-gray-900">
                                              <div className="flex items-center">
                                                <Package className="w-4 h-4 text-blue-600 mr-2" />
                                                {item.product_name}
                                              </div>
                                            </td>
                                            <td className="px-4 py-2 text-sm text-gray-900">
                                              {item.category_name}
                                            </td>
                                            <td className="px-4 py-2 text-sm text-gray-900">
                                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                {item.assigned_quantity}
                                              </span>
                                            </td>
                                            <td className="px-4 py-2 text-sm text-gray-900">
                                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                {item.sold_quantity}
                                              </span>
                                            </td>
                                            <td className="px-4 py-2 text-sm text-gray-900">
                                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                                {item.returned_quantity}
                                              </span>
                                            </td>
                                            <td className="px-4 py-2 text-sm text-gray-900">
                                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                                remaining > 0 ? 'bg-gray-100 text-gray-800' : 'bg-gray-50 text-gray-500'
                                              }`}>
                                                {remaining}
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Assignment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Create New Assignment</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSaveAssignment} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sales Rep *
                    </label>
                    <select
                      value={formData.sales_rep_id}
                      onChange={(e) => setFormData({ ...formData, sales_rep_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      required
                    >
                      <option value="">Select Sales Rep</option>
                      {salesReps.map((rep) => (
                        <option key={rep.id} value={rep.id}>
                          {rep.username}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Assignment Date *
                    </label>
                    <input
                      type="date"
                      value={formData.assignment_date}
                      onChange={(e) => setFormData({ ...formData, assignment_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vehicle Number
                  </label>
                  <input
                    type="text"
                    value={formData.vehicle_number}
                    onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Enter vehicle number (optional)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    rows={3}
                    placeholder="Optional notes about this assignment"
                  />
                </div>

                {/* Product Assignments */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Product Assignments</h3>
                    <button
                      type="button"
                      onClick={addProductAssignment}
                      className="flex items-center px-3 py-2 text-blue-600 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Product
                    </button>
                  </div>

                  <div className="space-y-3">
                    {productAssignments.map((assignment) => (
                      <div key={assignment.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <select
                            value={assignment.product_id}
                            onChange={(e) => updateProductAssignment(assignment.id, 'product_id', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                            required
                          >
                            <option value="">Select Product</option>
                            {products.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.name} (Available: {product.quantity} {WEIGHT_UNIT})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="w-32">
                          <input
                            type="number"
                            step="0.1"
                            value={assignment.assigned_quantity}
                            onChange={(e) => updateProductAssignment(assignment.id, 'assigned_quantity', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                            placeholder="Quantity"
                            min="0.1"
                            max={assignment.available_stock}
                            required
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeProductAssignment(assignment.id)}
                          className="p-2 text-red-600 hover:text-red-800 rounded-full hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {productAssignments.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No products assigned. Click "Add Product" to start.
                    </div>
                  )}
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? (
                      'Creating...'
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Create Assignment
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}