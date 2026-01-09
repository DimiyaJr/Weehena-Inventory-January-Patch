// src/components/CustomerAreas.tsx
import React, { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Search, MapPin, AlertCircle } from 'lucide-react'
import { supabase, CustomerArea } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export const CustomerAreas: React.FC = () => {
  const { user, isOnline } = useAuth()
  const [customerAreas, setCustomerAreas] = useState<CustomerArea[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingArea, setEditingArea] = useState<CustomerArea | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [formData, setFormData] = useState({
    area_name: '',
    area_code: ''
  })
  const [errors, setErrors] = useState<{[key: string]: string}>({})
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    if (user?.role === 'Super Admin' || user?.role === 'Admin') {
      fetchCustomerAreas()
    }
  }, [user])

  const fetchCustomerAreas = async () => {
    setFetchError(null)
    const cacheKey = 'customer_areas_data'
    
    if (!isOnline) {
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        setCustomerAreas(JSON.parse(cachedData))
        setLoading(false)
        return
      }
    }

    try {
      console.log('Fetching customer areas...')
      const { data, error } = await supabase
        .from('customer_areas')
        .select('id, area_name, area_code, created_at, updated_at')
        .order('area_name')

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }
      
      console.log('Customer areas fetched:', data)
      localStorage.setItem(cacheKey, JSON.stringify(data))
      setCustomerAreas(data || [])
    } catch (error: any) {
      console.error('Error fetching customer areas:', error)
      setFetchError('Failed to load customer areas. Please check your database connection.')
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        setCustomerAreas(JSON.parse(cachedData))
      } else {
        setCustomerAreas([])
      }
    } finally {
      setLoading(false)
    }
  }

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {}

    if (!formData.area_name.trim()) {
      newErrors.area_name = 'Area name is required'
    } else if (formData.area_name.length < 2 || formData.area_name.length > 50) {
      newErrors.area_name = 'Area name must be between 2 and 50 characters'
    }

    if (!formData.area_code.trim()) {
      newErrors.area_code = 'Area code is required'
    } else if (!/^[A-Z0-9]{2,5}$/.test(formData.area_code)) {
      newErrors.area_code = 'Area code must be 2-5 uppercase letters or numbers'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSaveArea = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      if (editingArea) {
        const { error } = await supabase
          .from('customer_areas')
          .update(formData)
          .eq('id', editingArea.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('customer_areas')
          .insert([formData])

        if (error) throw error
      }

      await fetchCustomerAreas()
      setShowModal(false)
      setEditingArea(null)
      setFormData({ area_name: '', area_code: '' })
      setErrors({})
    } catch (error: any) {
      console.error('Error saving customer area:', error)
      if (error.code === '23505') { // Unique constraint violation
        if (error.message.includes('area_name')) {
          setErrors({ area_name: 'Area name already exists' })
        } else if (error.message.includes('area_code')) {
          setErrors({ area_code: 'Area code already exists' })
        }
      } else {
        alert(`Failed to save customer area: ${error.message}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteArea = async (areaId: string) => {
    if (!confirm('Are you sure you want to delete this customer area? This will remove it from any associated customers.')) return

    try {
      const { error } = await supabase
        .from('customer_areas')
        .delete()
        .eq('id', areaId)

      if (error) throw error
      await fetchCustomerAreas()
    } catch (error: any) {
      console.error('Error deleting customer area:', error)
      alert('Failed to delete customer area. It might be referenced by other data.')
    }
  }

  const handleEditArea = (area: CustomerArea) => {
    setEditingArea(area)
    setFormData({
      area_name: area.area_name,
      area_code: area.area_code
    })
    setErrors({})
    setShowModal(true)
  }

  const filteredAreas = customerAreas.filter(area =>
    area.area_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    area.area_code.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!user || !['Super Admin', 'Admin'].includes(user?.role || '')) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">Only Super Admins and Admins can manage customer areas.</p>
        </div>
      </div>
    )
  }

  if (loading && customerAreas.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading customer areas...</div>
      </div>
    )
  }

  if (fetchError && customerAreas.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">{fetchError}</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Customer Area Management</h1>
        <button
          onClick={() => {
            setShowModal(true)
            setEditingArea(null)
            setFormData({ area_name: '', area_code: '' })
            setErrors({})
          }}
          className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Area
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search areas by name or code..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />
      </div>

      {/* Customer Areas Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Mobile Card Layout */}
        <div className="block md:hidden">
          <div className="space-y-2">
            {filteredAreas.map((area) => (
              <div key={area.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center flex-1 min-w-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                      <MapPin className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {area.area_name}
                      </h3>
                      <div className="flex items-center mt-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          {area.area_code}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-3">
                    <button
                      onClick={() => handleEditArea(area)}
                      className="p-2.5 text-blue-600 bg-blue-100 rounded-full hover:bg-blue-200 touch-manipulation"
                      title="Edit area"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteArea(area.id)}
                      className="p-2.5 text-red-600 bg-red-100 rounded-full hover:bg-red-200 touch-manipulation"
                      title="Delete area"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-1 text-xs ml-11">
                  <div className="flex items-start">
                    <span className="text-gray-500 font-medium w-16 flex-shrink-0">Created:</span>
                    <span className="text-gray-700 flex-1">{new Date(area.created_at).toLocaleDateString()}</span>
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
                    Area Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Area Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredAreas.map((area, index) => (
                  <tr key={area.id} className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-gray-100`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <MapPin className="w-8 h-8 text-blue-600 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{area.area_name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {area.area_code}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(area.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditArea(area)}
                          className="p-2 text-blue-600 hover:text-blue-900 rounded-full hover:bg-blue-100"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteArea(area.id)}
                          className="p-2 text-red-600 hover:text-red-900 rounded-full hover:bg-red-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredAreas.length === 0 && !loading && (
        <div className="text-center py-12">
          <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No customer areas found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm ? 'Try adjusting your search terms' : 'Get started by creating your first customer area'}
          </p>
          {!searchTerm && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors mx-auto"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Area
            </button>
          )}
        </div>
      )}

      {/* Add/Edit Area Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              {editingArea ? 'Edit Customer Area' : 'Add New Customer Area'}
            </h2>
            
            <form onSubmit={handleSaveArea} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Area Name *
                </label>
                <input
                  type="text"
                  value={formData.area_name}
                  onChange={(e) => setFormData({ ...formData, area_name: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent ${
                    errors.area_name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter area name"
                  required
                />
                {errors.area_name && (
                  <div className="flex items-center mt-1 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.area_name}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Area Code *
                </label>
                <input
                  type="text"
                  value={formData.area_code}
                  onChange={(e) => setFormData({ ...formData, area_code: e.target.value.toUpperCase() })}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent ${
                    errors.area_code ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter area code (e.g., COL, KAN)"
                  maxLength={5}
                  required
                />
                {errors.area_code && (
                  <div className="flex items-center mt-1 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.area_code}
                  </div>
                )}
              </div>

              {fetchError && (
                <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                  <div className="text-sm text-red-700">{fetchError}</div>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingArea(null)
                    setFormData({ area_name: '', area_code: '' })
                    setErrors({})
                  }}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Saving...' : editingArea ? 'Update Area' : 'Add Area'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}