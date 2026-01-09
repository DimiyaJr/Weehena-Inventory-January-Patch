import React, { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Search, Car, AlertCircle } from 'lucide-react'
import { supabase, Vehicle, User as UserType } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export const VehicleManagement: React.FC = () => {
  const { user } = useAuth()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [salesReps, setSalesReps] = useState<UserType[]>([]) // New state for sales reps
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [formData, setFormData] = useState({
    vehicle_number: '',
    vehicle_type: '',
    capacity_cbm: 0,
    status: 'Available' as 'Available' | 'In Use' | 'Maintenance',
    sales_rep_id: '' // New field for assigned sales rep
  })
  const [error, setError] = useState('')

  const vehicleTypes = ['Truck', 'Van', 'Motorcycle', 'Car', 'Other']
  const vehicleStatuses = ['Available', 'In Use', 'Maintenance']

  useEffect(() => {
    if (user?.role === 'Super Admin' || user?.role === 'Admin') {
      fetchVehicles()
      fetchSalesReps() // Fetch sales reps when component mounts
    }
  }, [user])

  const fetchVehicles = async () => {
    try {
      const cacheKey = 'vehicle_management_data'
      if (!navigator.onLine) {
        const cachedData = localStorage.getItem(cacheKey)
        if (cachedData) {
          setVehicles(JSON.parse(cachedData))
          setLoading(false)
          return
        }
      }

      const { data, error } = await supabase
        .from('vehicles')
        .select(`
          id, vehicle_number, vehicle_type, capacity_cbm, status, sales_rep_id,
          sales_rep:users!fk_sales_rep(username)
        `)
        .order('vehicle_number')

      if (error) throw error
      setVehicles(data || [])
      localStorage.setItem(cacheKey, JSON.stringify(data))
    } catch (error) {
      console.error('Error fetching vehicles:', error)
      setError('Failed to load vehicles. Please check your database connection.')
      const cachedData = localStorage.getItem('vehicle_management_data')
      if (cachedData) {
        setVehicles(JSON.parse(cachedData))
      } else {
        setVehicles([])
      }
    } finally {
      setLoading(false)
    }
  }

  // New function to fetch sales reps
  const fetchSalesReps = async () => {
    try {
      const cacheKey = 'sales_reps_data'
      if (!navigator.onLine) {
        const cachedData = localStorage.getItem(cacheKey)
        if (cachedData) {
          setSalesReps(JSON.parse(cachedData))
          return
        }
      }

      const { data, error } = await supabase
        .from('users')
        .select('id, username')
        .eq('role', 'Sales Rep')
        .order('username')

      if (error) throw error
      setSalesReps(data || [])
      localStorage.setItem(cacheKey, JSON.stringify(data))
    } catch (error) {
      console.error('Error fetching sales reps:', error)
      const cachedData = localStorage.getItem('sales_reps_data')
      if (cachedData) {
        setSalesReps(JSON.parse(cachedData))
      } else {
        setSalesReps([])
      }
    }
  }

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Basic validation
      if (!formData.vehicle_number.trim()) {
        throw new Error('Vehicle number is required.')
      }
      if (!formData.vehicle_type.trim()) {
        throw new Error('Vehicle type is required.')
      }
      if (formData.capacity_cbm < 0) {
        throw new Error('Capacity cannot be negative.')
      }

      if (editingVehicle) {
        const { error } = await supabase
          .from('vehicles')
          .update(formData)
          .eq('id', editingVehicle.id)
          .select() // Select to get the updated data back

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('vehicles')
          .insert([formData])
          .select() // Select to get the inserted data back

        if (error) throw error
      }

      await fetchVehicles()
      setShowModal(false)
      setEditingVehicle(null)
      setFormData({ vehicle_number: '', vehicle_type: '', capacity_cbm: 0, status: 'Available', sales_rep_id: '' })
    } catch (error: any) {
      console.error('Error saving vehicle:', error)
      if (error.code === '23505') { // Unique constraint violation
        setError('Vehicle number already exists.')
      } else {
        setError(error.message || 'Failed to save vehicle.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteVehicle = async (id: string) => {
    if (!confirm('Are you sure you want to delete this vehicle? This action cannot be undone.')) return

    try {
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', id)

      if (error) throw error
      await fetchVehicles()
    } catch (error) {
      console.error('Error deleting vehicle:', error)
      setError('Failed to delete vehicle. It might be assigned to active orders or assignments.')
    }
  }

  const handleEditVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle)
    setFormData({
      vehicle_number: vehicle.vehicle_number,
      vehicle_type: vehicle.vehicle_type,
      capacity_cbm: vehicle.capacity_cbm,
      status: vehicle.status,
      sales_rep_id: vehicle.sales_rep_id || '' // Set sales_rep_id for editing
    })
    setError('')
    setShowModal(true)
  }

  const filteredVehicles = vehicles.filter(vehicle =>
    vehicle.vehicle_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.vehicle_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.status.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (user?.role !== 'Super Admin' && user?.role !== 'Admin') {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Car className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">Only Super Admins and Admins can manage vehicles.</p>
        </div>
      </div>
    )
  }

  if (loading && vehicles.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading vehicles...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Vehicle Management</h1>
        <button
          onClick={() => {
            setShowModal(true)
            setEditingVehicle(null)
            setFormData({ vehicle_number: '', vehicle_type: '', capacity_cbm: 0, status: 'Available', sales_rep_id: '' })
            setError('')
          }}
          className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Vehicle
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search vehicles by number, type, or status..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />
      </div>

      {/* Vehicles Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Mobile Card Layout */}
        <div className="block md:hidden">
          <div className="space-y-2">
            {filteredVehicles.map((vehicle) => (
              <div key={vehicle.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center flex-1 min-w-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                      <Car className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {vehicle.vehicle_number}
                      </h3>
                      <div className="flex items-center mt-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          vehicle.status === 'Available'
                            ? 'bg-green-100 text-green-800'
                            : vehicle.status === 'In Use'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {vehicle.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-3">
                    <button
                      onClick={() => handleEditVehicle(vehicle)} // Increased padding for better touch target
                      className="p-2.5 text-blue-600 bg-blue-100 rounded-full hover:bg-blue-200 touch-manipulation"
                      title="Edit vehicle"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteVehicle(vehicle.id)} // Increased padding for better touch target
                      className="p-2.5 text-red-600 bg-red-100 rounded-full hover:bg-red-200 touch-manipulation"
                      title="Delete vehicle"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-1 text-xs ml-11">
                  <div className="flex items-start">
                    <span className="text-gray-500 font-medium w-16 flex-shrink-0">Type:</span>
                    <span className="text-gray-700 flex-1">{vehicle.vehicle_type}</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-gray-500 font-medium w-16 flex-shrink-0">Capacity:</span>
                    <span className="text-gray-700 flex-1">{vehicle.capacity_cbm} CBM</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-gray-500 font-medium w-16 flex-shrink-0">Assigned:</span>
                    <span className="text-gray-700 flex-1">{(vehicle as any).sales_rep?.username || 'Unassigned'}</span>
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
                    Vehicle Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Capacity (CBM)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned Sales Rep
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredVehicles.map((vehicle, index) => (
                  <tr key={vehicle.id} className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-gray-100`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Car className="w-8 h-8 text-blue-600 mr-3" />
                        <div className="text-sm font-medium text-gray-900">{vehicle.vehicle_number}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {vehicle.vehicle_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {vehicle.capacity_cbm} CBM
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        vehicle.status === 'Available'
                          ? 'bg-green-100 text-green-800'
                          : vehicle.status === 'In Use'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {vehicle.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {/* Assuming sales_rep is joined in fetchVehicles */}
                      {(vehicle as any).sales_rep?.username || 'Unassigned'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditVehicle(vehicle)} // Added padding for better touch target
                          className="p-2 text-blue-600 hover:text-blue-900 rounded-full hover:bg-blue-100"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteVehicle(vehicle.id)} // Added padding for better touch target
                          className="p-2 text-red-600 hover:text-red-900 rounded-full hover:bg-red-100"
                          title="Delete vehicle"
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

      {/* Add/Edit Vehicle Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              {editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}
            </h2>
            
            <form onSubmit={handleSaveVehicle} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vehicle Number *
                </label>
                <input
                  type="text"
                  value={formData.vehicle_number}
                  onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="e.g., WP ABC-1234"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vehicle Type *
                </label>
                <select
                  value={formData.vehicle_type}
                  onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                >
                  <option value="">Select Type</option>
                  {vehicleTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Capacity (CBM)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.capacity_cbm}
                  onChange={(e) => setFormData({ ...formData, capacity_cbm: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status *
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Available' | 'In Use' | 'Maintenance' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                >
                  {vehicleStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assigned Sales Rep
                </label>
                <select
                  value={formData.sales_rep_id}
                  onChange={(e) => setFormData({ ...formData, sales_rep_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  <option value="">Unassigned</option>
                  {salesReps.map((rep) => (
                    <option key={rep.id} value={rep.id}>
                      {rep.username}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                  <div className="text-sm text-red-700">{error}</div>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingVehicle(null)
                    setFormData({ vehicle_number: '', vehicle_type: '', capacity_cbm: 0, status: 'Available', sales_rep_id: '' })
                    setError('')
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
                  {loading ? 'Saving...' : editingVehicle ? 'Update Vehicle' : 'Add Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}