import React, { useState, useEffect } from 'react'
import { X, Save, AlertCircle, Package, Check } from 'lucide-react'
import { supabase, Category } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { STATIC_PAYMENT_CATEGORIES } from '../utils/staticPaymentCategories'
import { GRAMS_PER_KG } from '../utils/units' // NEW IMPORT

interface ProductEntryFormProps {
  onClose: () => void
  onProductAdded: () => void
}

export const ProductEntryForm: React.FC<ProductEntryFormProps> = ({ onClose, onProductAdded }) => {
  const { user } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [productsAddedCount, setProductsAddedCount] = useState(0)
  const [showSuccessPopout, setShowSuccessPopout] = useState(false)
  
  const [formData, setFormData] = useState({
    name: '',
    category_id: '',
    initial_quantity: null as number | null, // RENAMED from quantity to initial_quantity
    price_cash: null as number | null,
    price_credit: null as number | null,
    price_dealer_cash: null as number | null,
    price_dealer_credit: null as number | null,
    price_hotel_non_vat: null as number | null,
    price_hotel_vat: null as number | null,
    price_farm_shop: null as number | null,
    threshold: 10,
    unit_type: 'Packs' as 'Kg' | 'g' | 'Packs',
    weight_per_pack_kg: null as number | null,
    grams_per_unit: null as number | null // NEW FIELD
  })

  const unitTypes = ['Kg', 'g', 'Packs']; // Define available unit types

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const cacheKey = 'product_entry_form_categories'
      if (!navigator.onLine) {
        const cachedData = localStorage.getItem(cacheKey)
        if (cachedData) {
          setCategories(JSON.parse(cachedData))
          return
        }
      }

      const { data, error } = await supabase
        .from('categories')
        .select('category_id, category_name, category_code, status')
        .eq('status', true)
        .order('category_name')

      if (error) throw error

      localStorage.setItem(cacheKey, JSON.stringify(data))
      setCategories(data || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
      const cacheKey = 'product_entry_form_categories'
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        setCategories(JSON.parse(cachedData))
      } else {
        setCategories([])
      }
    }
  }

  const generateSKU = (productName: string, categoryId: string): string => {
    const category = categories.find(c => c.category_id === categoryId)
    const categoryCode = category?.category_code?.substring(0, 3).toUpperCase() || 'GEN'
    const productCode = productName.substring(0, 3).toUpperCase().replace(/\s/g, '')
    const timestamp = Date.now().toString().slice(-4)
    return `${categoryCode}-${productCode}-${timestamp}`
  }

  const getFieldNameForCategory = (categoryName: string): keyof typeof formData => {
    const mapping: { [key: string]: keyof typeof formData } = {
      'Regular Cash': 'price_cash',
      'Regular Credit': 'price_credit',
      'Dealer Cash': 'price_dealer_cash',
      'Dealer Credit': 'price_dealer_credit',
      'Hotel Non-VAT': 'price_hotel_non_vat',
      'Hotel VAT': 'price_hotel_vat',
      'Farm Shop': 'price_farm_shop'
    }
    return mapping[categoryName] || 'price_cash'
  }

  const getPriceFieldLabel = (paymentCategory: string): string => {
    const labelMapping: { [key: string]: string } = {
      'Regular Cash': 'Regular Cash',
      'Regular Credit': 'Regular Credit',
      'Dealer Cash': 'Dealer Cash',
      'Dealer Credit': 'Dealer Credit',
      'Hotel Non-VAT': 'Hotel (Non-VAT)',
      'Hotel VAT': 'Hotel (VAT)',
      'Farm Shop': 'Farm Shop'
    }
    return labelMapping[paymentCategory] || paymentCategory
  }

  const validateForm = (): string => {
    if (!formData.name.trim()) {
      return 'Product name is required'
    }
    if (!formData.category_id) {
      return 'Category is required'
    }
    if (formData.initial_quantity !== null && formData.initial_quantity < 0) {
      return 'Quantity cannot be negative'
    }
    if (formData.threshold < 0) {
      return 'Threshold cannot be negative'
    }
    if (!formData.unit_type) {
      return 'Unit Type is required';
    }

    if (formData.unit_type === 'Packs' && (formData.weight_per_pack_kg === null || formData.weight_per_pack_kg <= 0)) {
      return 'Weight per Pack (Kg) must be greater than 0 for Packs unit type'
    }

    if (formData.unit_type === 'g' && (formData.grams_per_unit === null || formData.grams_per_unit <= 0)) {
      return 'Grams per Unit must be greater than 0 for Grams unit type'
    }

    for (const paymentCategory of STATIC_PAYMENT_CATEGORIES) {
      const priceField = getFieldNameForCategory(paymentCategory)
      const value = formData[priceField]
      const label = getPriceFieldLabel(paymentCategory)
      
      console.log(`ProductEntryForm: Validating ${label} (${String(priceField)}): value = ${value}, type = ${typeof value}`);

      if (value === null || value === undefined) {
        return `${label} is required`
      }
      if (value <= 0) {
        return `${label} must be greater than 0`
      }
      if (value > 1000000) {
        return `${label} seems too high. Please verify the amount.`
      }
    }

    return ''
  }

  const getAllPriceFields = () => {
    const allPriceFields = {
      price_cash: formData.price_cash || 0,
      price_credit: formData.price_credit || 0,
      price_dealer_cash: formData.price_dealer_cash || 0,
      price_dealer_credit: formData.price_dealer_credit || 0,
      price_hotel_non_vat: formData.price_hotel_non_vat || 0,
      price_hotel_vat: formData.price_hotel_vat || 0,
      price_farm_shop: formData.price_farm_shop!,
    }

    for (const paymentCategory of STATIC_PAYMENT_CATEGORIES) {
      const fieldName = getFieldNameForCategory(paymentCategory)
      const value = formData[fieldName]
      if (value !== null && value !== undefined) {
        allPriceFields[fieldName] = value
      }
    }

    return allPriceFields
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const validationError = validateForm()
      if (validationError) {
        throw new Error(validationError)
      }

      const selectedCategory = categories.find(c => c.category_id === formData.category_id)
      if (!selectedCategory) {
        throw new Error('Invalid category selected')
      }

      const sku = generateSKU(formData.name, formData.category_id)

      const allPriceFields = getAllPriceFields()

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

      console.log('ProductEntryForm: Payload being sent to Supabase:', {
        name: formData.name.trim(),
        category_id: formData.category_id,
        sku: sku,
        quantity: calculatedQuantityInKg, // Use calculated quantity in Kg
        price_cash: allPriceFields.price_cash,
        price_credit: allPriceFields.price_credit,
        price_dealer_cash: allPriceFields.price_dealer_cash,
        price_dealer_credit: allPriceFields.price_dealer_credit,
        price_hotel_non_vat: allPriceFields.price_hotel_non_vat,
        price_hotel_vat: allPriceFields.price_hotel_vat,
        price_farm_shop: allPriceFields.price_farm_shop,
        threshold: formData.threshold,
        unit_type: formData.unit_type,
        weight_per_pack_kg: formData.unit_type === 'Packs' ? formData.weight_per_pack_kg : null,
        grams_per_unit: formData.unit_type === 'g' ? formData.grams_per_unit : null, // NEW FIELD
        created_at: new Date().toISOString(),
      });

      const { data, error } = await supabase
        .from('products')
        .insert([{
          name: formData.name.trim(),
          category_id: formData.category_id,
          sku: sku,
          quantity: calculatedQuantityInKg, // Use calculated quantity in Kg
          price_cash: allPriceFields.price_cash,
          price_credit: allPriceFields.price_credit,
          price_dealer_cash: allPriceFields.price_dealer_cash,
          price_dealer_credit: allPriceFields.price_dealer_credit,
          price_hotel_non_vat: allPriceFields.price_hotel_non_vat,
          price_hotel_vat: allPriceFields.price_hotel_vat,
          price_farm_shop: allPriceFields.price_farm_shop,
          threshold: formData.threshold,
          unit_type: formData.unit_type,
          weight_per_pack_kg: formData.unit_type === 'Packs' ? formData.weight_per_pack_kg : null,
          grams_per_unit: formData.unit_type === 'g' ? formData.grams_per_unit : null, // NEW FIELD
          created_at: new Date().toISOString(),
        }])
        .select()

      if (error) {
        if (error.code === '23505') {
          throw new Error('A product with similar details already exists. Please check the product name and SKU.')
        }
        throw error
      }

      setProductsAddedCount(prevCount => prevCount + 1)
      setShowSuccessPopout(true)
      setError('')

      setFormData({
        name: '',
        category_id: '',
        initial_quantity: null, // Reset
        price_cash: null,
        price_credit: null,
        price_dealer_cash: null,
        price_dealer_credit: null,
        price_hotel_non_vat: null,
        price_hotel_vat: null,
        price_farm_shop: null,
        threshold: 10,
        unit_type: 'Kg',
        weight_per_pack_kg: null,
        grams_per_unit: null // Reset
      })

      onProductAdded()

    } catch (error: any) {
      console.error('Error saving product:', error)
      setError(error.message || 'Failed to save product. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handlePriceChange = (field: keyof typeof formData, value: string) => {
    const numValue = value === '' ? null : parseFloat(value)
    setFormData(prev => ({
      ...prev,
      [field]: numValue
    }))
  }

  const handleNumberChange = (field: keyof typeof formData, value: string) => {
    const numValue = value === '' ? null : parseFloat(value) // Use parseFloat for quantity and grams_per_unit
    setFormData(prev => ({
      ...prev,
      [field]: numValue
    }))
  }

  const handleCategoryChange = (categoryId: string) => {
    setFormData(prev => ({
      ...prev,
      category_id: categoryId
    }))
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Package className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Add New Product</h2>
              <p className="text-sm text-gray-600">Enter product details and pricing for different customer categories</p>
              
              {showSuccessPopout && (
                <div className="mt-4 bg-green-50 border border-green-300 text-green-800 px-4 py-3 rounded-lg flex items-center space-x-3">
                  <Check className="w-5 h-5" />
                  <span className="text-base font-semibold">
                    {productsAddedCount} product{productsAddedCount > 1 ? 's' : ''} added to the system!
                  </span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
              setShowSuccessPopout(false);
              setProductsAddedCount(0);
            }}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSave} className="p-6">
            <div className="space-y-6 mb-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                  Basic Information
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors"
                      placeholder="Enter product name"
                      required
                      maxLength={100}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category *
                    </label>
                    <select
                      value={formData.category_id}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors"
                      required
                    >
                      <option value="">Select a category</option>
                      {categories.map((category) => (
                        <option key={category.category_id} value={category.category_id}>
                          {category.category_name} {category.category_code && `(${category.category_code})`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Initial Quantity and Unit Type side-by-side */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Initial Quantity (Units)
                      </label>
                      <input
                        type="number"
                        value={formData.initial_quantity ?? ''}
                        onChange={(e) => handleNumberChange('initial_quantity', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors"
                        min="0"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Unit Type *
                      </label>
                      <select
                        value={formData.unit_type}
                        onChange={(e) => setFormData({ ...formData, unit_type: e.target.value as 'Kg' | 'g' | 'Packs' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors"
                        required
                      >
                        {unitTypes.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* New field: Weight per Pack (Kg) - only for Packs */}
                  {formData.unit_type === 'Packs' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Weight per Pack (Kg) *
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.weight_per_pack_kg ?? ''}
                          onChange={(e) => handleNumberChange('weight_per_pack_kg', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors"
                          placeholder="e.g., 0.5"
                          required
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Grams per Unit (g) *
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.grams_per_unit ?? ''}
                          onChange={(e) => handleNumberChange('grams_per_unit', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors"
                          placeholder="e.g., 200"
                          required
                        />
                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                          g
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Low Stock Threshold */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Low Stock Threshold
                    </label>
                    <input
                      type="number"
                      value={formData.threshold}
                      onChange={(e) => handleNumberChange('threshold', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors"
                      min="0"
                      placeholder="10"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing Section */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                  Pricing (Rs) *
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {STATIC_PAYMENT_CATEGORIES.map((paymentCategory) => {
                    const priceField = getFieldNameForCategory(paymentCategory)
                    const label = getPriceFieldLabel(paymentCategory)
                    
                    return (
                      <div key={paymentCategory} className="bg-gray-50 p-4 rounded-lg">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {label}
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                            Rs.
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            max="1000000"
                            value={formData[priceField] ?? ''}
                            onChange={(e) => handlePriceChange(priceField, e.target.value)}
                            className="w-full pl-12 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors"
                            required
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mt-6 flex items-start p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-6 mt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  setShowSuccessPopout(false);
                  setProductsAddedCount(0);
                }}
                disabled={loading}
                className="flex-1 px-6 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 font-medium"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Adding Product...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Add Product
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}