import React, { useState, useEffect } from 'react'
import { X, Plus, Trash2, Save, Search, Package, AlertCircle } from 'lucide-react'
import { supabase, Product } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { WEIGHT_UNIT } from '../utils/units'

interface ProductRequestModalProps {
  onClose: () => void
  onRequestSubmitted: () => void
  currentInventory: Array<{
    product_id: string
    product_name: string
    available_quantity: number
  }>
}

interface RequestItem {
  id: string
  product_id: string
  product_name: string
  requested_quantity: number
  available_stock: number
  is_existing: boolean
}

export const ProductRequestModal: React.FC<ProductRequestModalProps> = ({
  onClose,
  onRequestSubmitted,
  currentInventory
}) => {
  const { user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [requestItems, setRequestItems] = useState<RequestItem[]>([])
  const [notes, setNotes] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id, name, quantity, sku,
          price_dealer_cash,
          price_dealer_credit,
          price_hotel_cash,
          price_hotel_credit,
          categories(category_name)
        `)
        .gt('quantity', 0)
        .order('name')

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
      alert('Failed to load products. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const addRequestItem = (product: Product) => {
    const existingItem = requestItems.find(item => item.product_id === product.id)
    if (existingItem) {
      alert('This product is already in your request list')
      return
    }

    const isExisting = (currentInventory || []).some(inv => inv.product_id === product.id)

    setRequestItems([
      ...requestItems,
      {
        id: `temp-${Date.now()}`,
        product_id: product.id,
        product_name: product.name,
        requested_quantity: 0,
        available_stock: product.quantity,
        is_existing: isExisting
      }
    ])
  }

  const updateRequestItem = (id: string, quantity: number) => {
    setRequestItems(requestItems.map(item => {
      if (item.id === id) {
        return { ...item, requested_quantity: quantity }
      }
      return item
    }))
  }

  const removeRequestItem = (id: string) => {
    setRequestItems(requestItems.filter(item => item.id !== id))
  }

  const handleSubmitRequest = async () => {
    if (requestItems.length === 0) {
      alert('Please add at least one product to your request')
      return
    }

    const validItems = requestItems.filter(item => item.requested_quantity > 0)
    if (validItems.length === 0) {
      alert('Please enter valid quantities for your requested products')
      return
    }

    for (const item of validItems) {
      if (item.requested_quantity > item.available_stock) {
        alert(`Cannot request ${item.requested_quantity} ${WEIGHT_UNIT} of ${item.product_name}. Only ${item.available_stock} ${WEIGHT_UNIT} available.`)
        return
      }
    }

    setSaving(true)
    try {
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('on_demand_assignments')
        .insert([{
          sales_rep_id: user?.id,
          assigned_by: user?.id,
          assignment_date: new Date().toISOString().split('T')[0],
          notes: notes || 'Self-requested by sales rep',
          vehicle_number: vehicleNumber.trim() || null,
          assignment_type: 'sales_rep_requested',
          status: 'active'
        }])
        .select()
        .single()

      if (assignmentError) throw assignmentError

      const assignmentItems = validItems.map(item => ({
        on_demand_assignment_id: assignmentData.id,
        product_id: item.product_id,
        assigned_quantity: item.requested_quantity
      }))

      const { error: itemsError } = await supabase
        .from('on_demand_assignment_items')
        .insert(assignmentItems)

      if (itemsError) throw itemsError

      for (const item of validItems) {
        const product = products.find(p => p.id === item.product_id)
        if (product) {
          const { error: updateError } = await supabase
            .from('products')
            .update({
              quantity: product.quantity - item.requested_quantity
            })
            .eq('id', item.product_id)

          if (updateError) throw updateError
        }
      }

      alert('Product request submitted successfully!')
      onRequestSubmitted()
      onClose()
    } catch (error) {
      console.error('Error submitting request:', error)
      alert('Failed to submit request. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6">
          <div className="text-center py-8">Loading products...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Request Products</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Available Products</h3>

              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredProducts.map((product) => {
                  const isInCurrentInventory = (currentInventory || []).some(inv => inv.product_id === product.id)
                  const isInRequest = requestItems.some(item => item.product_id === product.id)

                  return (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center">
                          <div className="font-medium text-gray-900">{product.name}</div>
                          {isInCurrentInventory && (
                            <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                              In My Inventory
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          Available: {product.quantity} {WEIGHT_UNIT}
                        </div>
                      </div>
                      <button
                        onClick={() => addRequestItem(product)}
                        disabled={isInRequest}
                        className="ml-3 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isInRequest ? 'Added' : 'Add'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Your Request</h3>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vehicle Number (Optional)
                </label>
                <input
                  type="text"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Enter vehicle number"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  rows={2}
                  placeholder="Add any notes about your request"
                />
              </div>

              {requestItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                  <Package className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p>No products added yet</p>
                  <p className="text-sm">Select products from the left to add to your request</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
                  {requestItems.map((item) => (
                    <div key={item.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center flex-1">
                          <div className="font-medium text-gray-900 text-sm">
                            {item.product_name}
                          </div>
                          {item.is_existing && (
                            <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">
                              Additional Qty
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => removeRequestItem(item.id)}
                          className="text-red-600 hover:text-red-800 text-sm ml-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">
                          Quantity ({WEIGHT_UNIT}) - Max: {item.available_stock} {WEIGHT_UNIT}
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={item.requested_quantity || ''}
                          onChange={(e) => updateRequestItem(item.id, parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                          min="0.1"
                          max={item.available_stock}
                          placeholder="Enter quantity"
                        />
                        {item.requested_quantity > item.available_stock && (
                          <div className="flex items-center mt-1 text-xs text-red-600">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Exceeds available stock
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex space-x-3 pt-4 border-t">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitRequest}
                  disabled={saving || requestItems.length === 0}
                  className="flex-1 flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    'Submitting...'
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Submit Request
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}