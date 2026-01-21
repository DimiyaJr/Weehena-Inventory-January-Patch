import React, { useState, useEffect } from 'react'
import { X, Search, Users, UserCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { SalesReportFilters } from '../../types/salesReportTypes'

interface FilterCustomer {
  id: string
  name: string
  customer_display_id: string
}

interface FilterSalesRep {
  id: string
  first_name: string
  last_name: string
  employee_id: string | null
}

interface Props {
  filters: SalesReportFilters
  onFiltersChange: (filters: SalesReportFilters) => void
}

export const SalesFilterSelector: React.FC<Props> = ({ filters, onFiltersChange }) => {
  const [customers, setCustomers] = useState<FilterCustomer[]>([])
  const [salesReps, setSalesReps] = useState<FilterSalesRep[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [loadingSalesReps, setLoadingSalesReps] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [salesRepSearch, setSalesRepSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [showSalesRepDropdown, setShowSalesRepDropdown] = useState(false)

  useEffect(() => {
    fetchCustomers()
    fetchSalesReps()
  }, [])

  const fetchCustomers = async () => {
    setLoadingCustomers(true)
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, customer_display_id')
        .order('name', { ascending: true })

      if (error) throw error
      setCustomers(data || [])
    } catch (err) {
      console.error('Error fetching customers:', err)
    } finally {
      setLoadingCustomers(false)
    }
  }

  const fetchSalesReps = async () => {
    setLoadingSalesReps(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, employee_id')
        .eq('role', 'Sales Rep')
        .order('first_name', { ascending: true })

      if (error) throw error
      setSalesReps(data || [])
    } catch (err) {
      console.error('Error fetching sales reps:', err)
    } finally {
      setLoadingSalesReps(false)
    }
  }

  const handleCustomerToggle = (customerId: string) => {
    const newSelected = filters.selectedCustomers.includes(customerId)
      ? filters.selectedCustomers.filter(id => id !== customerId)
      : [...filters.selectedCustomers, customerId]
    
    onFiltersChange({ ...filters, selectedCustomers: newSelected })
  }

  const handleSalesRepToggle = (salesRepId: string) => {
    const newSelected = filters.selectedSalesReps.includes(salesRepId)
      ? filters.selectedSalesReps.filter(id => id !== salesRepId)
      : [...filters.selectedSalesReps, salesRepId]
    
    onFiltersChange({ ...filters, selectedSalesReps: newSelected })
  }

  const handleSelectAllCustomers = () => {
    onFiltersChange({ ...filters, selectedCustomers: [] })
    setShowCustomerDropdown(false)
  }

  const handleSelectAllSalesReps = () => {
    onFiltersChange({ ...filters, selectedSalesReps: [] })
    setShowSalesRepDropdown(false)
  }

  const handleClearFilters = () => {
    onFiltersChange({
      ...filters,
      selectedCustomers: [],
      selectedSalesReps: [],
      paymentStatus: 'all',
      orderStatus: 'all'
    })
  }

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.customer_display_id.toLowerCase().includes(customerSearch.toLowerCase())
  )

  const filteredSalesReps = salesReps.filter(r =>
    `${r.first_name} ${r.last_name}`.toLowerCase().includes(salesRepSearch.toLowerCase()) ||
    r.employee_id?.toLowerCase().includes(salesRepSearch.toLowerCase())
  )

  const getSelectedCustomerNames = () => {
    if (filters.selectedCustomers.length === 0) return 'All Customers'
    if (filters.selectedCustomers.length === 1) {
      const customer = customers.find(c => c.id === filters.selectedCustomers[0])
      return customer?.name || '1 Customer'
    }
    return `${filters.selectedCustomers.length} Customers`
  }

  const getSelectedSalesRepNames = () => {
    if (filters.selectedSalesReps.length === 0) return 'All Sales Reps'
    if (filters.selectedSalesReps.length === 1) {
      const rep = salesReps.find(r => r.id === filters.selectedSalesReps[0])
      return rep ? `${rep.first_name} ${rep.last_name}` : '1 Sales Rep'
    }
    return `${filters.selectedSalesReps.length} Sales Reps`
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
        <button
          onClick={handleClearFilters}
          className="text-sm text-red-600 hover:text-red-700"
        >
          Clear All
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Customer Filter */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Users className="w-4 h-4 inline mr-1" />
            Customers
          </label>
          <button
            onClick={() => setShowCustomerDropdown(!showCustomerDropdown)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-left bg-white hover:bg-gray-50"
          >
            {getSelectedCustomerNames()}
          </button>
          
          {showCustomerDropdown && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search customers..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full pl-8 pr-2 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>
              <div className="p-2">
                <button
                  onClick={handleSelectAllCustomers}
                  className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded text-sm text-red-600 font-medium"
                >
                  All Customers
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filteredCustomers.map((customer) => (
                  <label
                    key={customer.id}
                    className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={filters.selectedCustomers.includes(customer.id)}
                      onChange={() => handleCustomerToggle(customer.id)}
                      className="mr-2"
                    />
                    <span className="text-sm">
                      {customer.name} ({customer.customer_display_id})
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sales Rep Filter */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <UserCheck className="w-4 h-4 inline mr-1" />
            Sales Reps
          </label>
          <button
            onClick={() => setShowSalesRepDropdown(!showSalesRepDropdown)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-left bg-white hover:bg-gray-50"
          >
            {getSelectedSalesRepNames()}
          </button>
          
          {showSalesRepDropdown && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search sales reps..."
                    value={salesRepSearch}
                    onChange={(e) => setSalesRepSearch(e.target.value)}
                    className="w-full pl-8 pr-2 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>
              <div className="p-2">
                <button
                  onClick={handleSelectAllSalesReps}
                  className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded text-sm text-red-600 font-medium"
                >
                  All Sales Reps
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filteredSalesReps.map((rep) => (
                  <label
                    key={rep.id}
                    className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={filters.selectedSalesReps.includes(rep.id)}
                      onChange={() => handleSalesRepToggle(rep.id)}
                      className="mr-2"
                    />
                    <span className="text-sm">
                      {rep.first_name} {rep.last_name}
                      {rep.employee_id && ` (${rep.employee_id})`}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Payment Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Payment Status
          </label>
          <select
            value={filters.paymentStatus}
            onChange={(e) => onFiltersChange({ ...filters, paymentStatus: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
          >
            <option value="all">All Statuses</option>
            <option value="fully_paid">Fully Paid</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </div>

        {/* Order Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Order Status
          </label>
          <select
            value={filters.orderStatus}
            onChange={(e) => onFiltersChange({ ...filters, orderStatus: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
          >
            <option value="all">All Orders</option>
            <option value="completed">Completed</option>
            <option value="delivered">Delivered</option>
          </select>
        </div>
      </div>

      {/* Selected Filters Chips */}
      {(filters.selectedCustomers.length > 0 || filters.selectedSalesReps.length > 0) && (
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          {filters.selectedCustomers.map(id => {
            const customer = customers.find(c => c.id === id)
            if (!customer) return null
            return (
              <span
                key={id}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-100 text-red-800"
              >
                {customer.name}
                <button
                  onClick={() => handleCustomerToggle(id)}
                  className="ml-1 hover:text-red-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )
          })}
          {filters.selectedSalesReps.map(id => {
            const rep = salesReps.find(r => r.id === id)
            if (!rep) return null
            return (
              <span
                key={id}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
              >
                {rep.first_name} {rep.last_name}
                <button
                  onClick={() => handleSalesRepToggle(id)}
                  className="ml-1 hover:text-blue-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
