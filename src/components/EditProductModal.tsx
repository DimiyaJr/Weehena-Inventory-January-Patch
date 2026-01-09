import React, { useState, useEffect } from 'react'
import { X, Save, AlertCircle } from 'lucide-react'
import { supabase, Product, Category } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { GRAMS_PER_KG } from '../utils/units' // NEW IMPORT

interface EditProductModalProps {
  product: Product
  onClose: () => void
  onProductUpdated: () => void
}

export const EditProductModal: React.FC<EditProductModalProps> = ({ 
  product, 
  onClose, 
  onProductUpdated 
}) => {
  const { isOnline } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: product.name,
    category_id: product.category_id || '',
    initial_quantity: product.unit_type === 'Kg' ? product.quantity : // Initial quantity in native units
                      product.unit_type === 'Packs' && product.weight_per_pack_kg ? product.quantity / product.weight_per_pack_kg :
                      product.unit_type === 'g' && product.grams_per_unit ? (product.quantity * GRAMS_PER_KG) / product.grams_per_unit :
                      product.quantity, // Fallback to raw quantity if conversion not possible
    threshold: product.threshold,
    unit_type: product.unit_type,
    weight_per_pack_kg: product.weight_per_pack_kg ?? null,
    grams_per_unit: product.grams_per_unit ?? null // NEW FIELD
  })

  const unitTypes = ['Kg', 'g', 'Packs']; // Define available unit types

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const cacheKey = 'edit_product_modal_categories'
      if (!isOnline) {
        const cachedData = localStorage.getItem(cacheKey)
        if (cachedData) {
          setCategories(JSON.parse(cachedData))
          return
        }
      }

      const { data, error } = await supabase
        .from('categories')
        .select('category_id, category_name, status')
        .eq('status', true)
        .order('category_name')

      if (error) throw error

      localStorage.setItem(cacheKey, JSON.stringify(data))
      setCategories(data || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
      const cachedData = localStorage.getItem('edit_product_modal_categories')
      if (cachedData) {
        setCategories(JSON.parse(cachedData))
      } else {
        setCategories([])
      }
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Validation
      if (!formData.name.trim()) {
        throw new Error('Product name is required')
      }
      if (!formData.category_id) {
        throw new Error('Category is required')
      }
      if (formData.initial_quantity !== null && formData.initial_quantity < 0) { // Use initial_quantity
        throw new Error('Initial quantity cannot be negative')
      }
      if (formData.threshold < 0) {
        throw new Error('Threshold cannot be negative')
      }
      if (!formData.unit_type) {
        throw new Error('Unit Type is required');
      }
      if (formData.unit_type === 'Packs' && (formData.weight_per_pack_kg === null || formData.weight_per_pack_kg <= 0)) {
        throw new Error('Weight per Pack (Kg) must be greater than 0 for Packs unit type');
      }
      if (formData.unit_type === 'g' && (formData.grams_per_unit === null || formData.grams_per_unit <= 0)) {
        throw new Error('Grams per Unit must be greater than 0 for Grams unit type');
      }

      let calculatedQuantityInKg: number = 0;
      if (formData.initial_quantity !== null) {
        if (formData.unit_type === 'Kg') {
          calculatedQuantityInKg = formData.initial_quantity;
        } else if (formData.unit_type === 'Packs' && formData.weight_per_pack_kg !== null) {
          calculatedQuantityInKg = formData.initial_quantity * formData.weight_per_pack_kg;
        } else if (formData.unit_type === 'g' && formData.grams_per_unit !== null) {
          calculatedQuantityInKg = formData.initial_quantity * (formData.grams_per_unit / GRAMS_PER_KG);
        }
      }

      const { error } = await supabase
        .from('products')
        .update({
          name: formData.name,
          category_id: formData.category_id,
          quantity: calculatedQuantityInKg, // Use calculated quantity in Kg
          threshold: formData.threshold,
          unit_type: formData.unit_type,
          weight_per_pack_kg: formData.unit_type === 'Packs' ? formData.weight_per_pack_kg : null,
          grams_per_unit: formData.unit_type === 'g' ? formData.grams_per_unit : null, // NEW FIELD
        })
        .eq('id', product.id)

      if (error) throw error

      onProductUpdated()
      onClose()
    } catch (error: any) {
      console.error('Error updating product:', error)
      setError(error.message || 'Failed to update product')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Edit Product</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category *
            </label>
            <select
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              required
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.category_id} value={category.category_id}>
                  {category.category_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Initial Quantity (Units) *
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.initial_quantity}
              onChange={(e) => setFormData({ ...formData, initial_quantity: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              min="0"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Threshold *
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.threshold}
              onChange={(e) => setFormData({ ...formData, threshold: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              min="0"
              required
            />
          </div>

          {/* NEW FIELD: Unit Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unit Type *
            </label>
            <select
              value={formData.unit_type}
              onChange={(e) => setFormData({ ...formData, unit_type: e.target.value as 'Kg' | 'g' | 'Packs' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              required
            >
              {unitTypes.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </div>

          {/* New field: Weight per Pack (Kg) - only for Packs */}
          {formData.unit_type === 'Packs' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Weight per Pack (Kg) (Optional)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.weight_per_pack_kg ?? ''}
                  onChange={(e) => setFormData({ ...formData, weight_per_pack_kg: parseFloat(e.target.value) || null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="e.g., 0.5"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  Kg
                </span>
              </div>
            </div>
          )}

          {/* NEW FIELD: Grams per Unit - only for 'g' */}
          {formData.unit_type === 'g' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Grams per Unit (g) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.grams_per_unit ?? ''}
                  onChange={(e) => setFormData({ ...formData, grams_per_unit: parseFloat(e.target.value) || null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="e.g., 200"
                  required
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  g
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {loading ? (
                'Saving...'
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}