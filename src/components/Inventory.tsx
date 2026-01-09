// src/components/Inventory.tsx
import React, { useState, useEffect } from 'react'
import { Plus, Search, Package, DollarSign, Edit, X, Save, Trash2, AlertTriangle } from 'lucide-react'
import { supabase, Product } from '../lib/supabase'
import { ProductEntryForm } from './ProductEntryForm'
import { ProductPricesModal } from './ProductPricesModal'
import { EditProductModal } from './EditProductModal'
import { useAuth } from '../hooks/useAuth'
import { formatCurrency } from '../utils/formatters'
import { GRAMS_PER_KG } from '../utils/units' // NEW IMPORT

export const Inventory: React.FC = () => {
  const { user, isOnline } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showProductEntry, setShowProductEntry] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPriceModal, setShowPriceModal] = useState(false)
  const [selectedProductForPrices, setSelectedProductForPrices] = useState<Product | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedProductForEdit, setSelectedProductForEdit] = useState<Product | null>(null)
  const [isEditingTabular, setIsEditingTabular] = useState(false)
  const [editedProducts, setEditedProducts] = useState<Product[]>([])
  const [showStockUpdateModal, setShowStockUpdateModal] = useState(false)
  const [selectedProductForStockUpdate, setSelectedProductForStockUpdate] = useState<Product | null>(null)
  const [stockAdditionQuantity, setStockAdditionQuantity] = useState<string>('')

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    setError(null)
    const cacheKey = 'inventory_products_data'
    if (!isOnline) {
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        setProducts(JSON.parse(cachedData))
        setEditedProducts(JSON.parse(cachedData))
        setLoading(false)
        return
      }
    }

    try {
      console.log('Inventory: Fetching products from Supabase for Master Inventory...')
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          product_id,
          category,
          category_id,
          sku,
          quantity,
          threshold,
          created_at,
          price_cash,
          price_credit,
          price_dealer_cash,
          price_dealer_credit,
          price_hotel_non_vat,
          price_hotel_vat,
          price_farm_shop,
          weight_per_pack_kg,
          grams_per_unit,
          unit_type,
          categories (
            category_id,
            category_name,
            category_display_id,
            category_code,
            description,
            status,
            created_at,
            updated_at
          )
        `)
        .order('name', { ascending: true })

      if (error) {
        console.error('Inventory: Supabase error during fetch:', error)
        throw error
      }
      
      console.log('Inventory: Products data received from Supabase:', data)
      localStorage.setItem(cacheKey, JSON.stringify(data))
      setProducts(data || [])
      setEditedProducts(data || [])
    } catch (error) {
      console.error('Inventory: Error fetching products:', error)
      setError('Failed to load products. Please check your database connection.')
      
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        setProducts(JSON.parse(cachedData))
        setEditedProducts(JSON.parse(cachedData))
      } else {
        setProducts([])
        setEditedProducts([])
      }
    } finally {
      setLoading(false)
    }
  }

  const handleViewEditPrices = (product: Product) => {
    setSelectedProductForPrices(product)
    setShowPriceModal(true)
  }

  const handleEditProduct = (product: Product) => {
    setSelectedProductForEdit(product)
    setShowEditModal(true)
  }

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)

      if (error) throw error
      await fetchProducts()
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23503') {
        alert('Cannot delete this product because it is associated with existing sales orders. Please remove it from all orders first.')
      } else {
        console.error('Error deleting product:', error)
        alert('An error occurred while deleting the product. Please try again.')
      }
    }
  }

  const handleUpdateStock = (product: Product) => {
    setSelectedProductForStockUpdate(product)
    setStockAdditionQuantity('')
    setShowStockUpdateModal(true)
  }

  const handleSaveStockUpdate = async () => {
    if (!selectedProductForStockUpdate || !stockAdditionQuantity) return

    const additionQuantityNative = parseFloat(stockAdditionQuantity)
    if (isNaN(additionQuantityNative) || additionQuantityNative < 0) {
      alert('Please enter a valid positive number for stock quantity to add.')
      return
    }

    try {
      let additionQuantityInKg: number = 0;
      if (selectedProductForStockUpdate.unit_type === 'Kg') {
        additionQuantityInKg = additionQuantityNative;
      } else if (selectedProductForStockUpdate.unit_type === 'Packs' && selectedProductForStockUpdate.weight_per_pack_kg !== null) {
        additionQuantityInKg = additionQuantityNative * selectedProductForStockUpdate.weight_per_pack_kg;
      } else if (selectedProductForStockUpdate.unit_type === 'g' && selectedProductForStockUpdate.grams_per_unit !== null) {
        additionQuantityInKg = additionQuantityNative * (selectedProductForStockUpdate.grams_per_unit / GRAMS_PER_KG);
      } else {
        // Fallback if conversion factors are missing, treat as Kg
        additionQuantityInKg = additionQuantityNative;
      }

      const newQuantity = selectedProductForStockUpdate.quantity + additionQuantityInKg; // Add in Kg

      const { error } = await supabase
        .from('products')
        .update({ quantity: newQuantity })
        .eq('id', selectedProductForStockUpdate.id)

      if (error) throw error

      alert(`Stock quantity updated successfully! Added ${additionQuantityNative} ${selectedProductForStockUpdate.unit_type} to inventory.`)
      setShowStockUpdateModal(false)
      setSelectedProductForStockUpdate(null)
      setStockAdditionQuantity('')
      fetchProducts()
    } catch (error) {
      console.error('Error updating stock:', error)
      alert('Failed to update stock quantity. Please try again.')
    }
  }

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.categories?.category_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.product_id?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleEditTabularToggle = () => {
    if (isEditingTabular) {
      setEditedProducts(products)
    } else {
      setEditedProducts(JSON.parse(JSON.stringify(products)))
    }
    setIsEditingTabular(!isEditingTabular)
  }

  const handleFieldChange = (
    productId: string,
    field: keyof Product,
    value: string | number
  ) => {
    setEditedProducts(prev =>
      prev.map(product =>
        product.id === productId
          ? { ...product, [field]: value }
          : product
      )
    )
  }

  const handleSaveTabularChanges = async () => {
    setLoading(true)
    setError(null)
    try {
      const updates = []
      for (const editedProduct of editedProducts) {
        const originalProduct = products.find(p => p.id === editedProduct.id)
        if (originalProduct) {
          const changedFields: Partial<Product> = {}
          let hasChanges = false

          if (editedProduct.name !== originalProduct.name) {
            changedFields.name = editedProduct.name
            hasChanges = true
          }
          if (editedProduct.quantity !== originalProduct.quantity) {
            changedFields.quantity = Number(editedProduct.quantity)
            hasChanges = true
          }
          if (editedProduct.price_cash !== originalProduct.price_cash) {
            changedFields.price_cash = Number(editedProduct.price_cash)
            hasChanges = true
          }
          if (editedProduct.price_credit !== originalProduct.price_credit) {
            changedFields.price_credit = Number(editedProduct.price_credit)
            hasChanges = true
          }
          if (editedProduct.price_dealer_cash !== originalProduct.price_dealer_cash) {
            changedFields.price_dealer_cash = Number(editedProduct.price_dealer_cash)
            hasChanges = true
          }
          if (editedProduct.price_dealer_credit !== originalProduct.price_dealer_credit) {
            changedFields.price_dealer_credit = Number(editedProduct.price_dealer_credit)
            hasChanges = true
          }
          if (editedProduct.price_hotel_non_vat !== originalProduct.price_hotel_non_vat) {
            changedFields.price_hotel_non_vat = Number(editedProduct.price_hotel_non_vat)
            hasChanges = true
          }
          if (editedProduct.price_hotel_vat !== originalProduct.price_hotel_vat) {
            changedFields.price_hotel_vat = Number(editedProduct.price_hotel_vat)
            hasChanges = true
          }
          if (editedProduct.price_farm_shop !== originalProduct.price_farm_shop) {
            changedFields.price_farm_shop = Number(editedProduct.price_farm_shop)
            hasChanges = true
          }
          if (editedProduct.weight_per_pack_kg !== originalProduct.weight_per_pack_kg) {
            changedFields.weight_per_pack_kg = Number(editedProduct.weight_per_pack_kg)
            hasChanges = true
          }
          if (editedProduct.grams_per_unit !== originalProduct.grams_per_unit) { // NEW FIELD
            changedFields.grams_per_unit = Number(editedProduct.grams_per_unit)
            hasChanges = true
          }

          if (hasChanges) {
            updates.push(
              supabase
                .from('products')
                .update(changedFields)
                .eq('id', editedProduct.id)
            )
          }
        }
      }

      if (updates.length > 0) {
        await Promise.all(updates)
        alert('Product changes saved successfully!')
        fetchProducts()
      } else {
        alert('No changes detected to save.')
      }
      setIsEditingTabular(false)
    } catch (err: any) {
      console.error('Error saving tabular changes:', err)
      setError(err.message || 'Failed to save changes.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelTabularChanges = () => {
    setEditedProducts(products)
    setIsEditingTabular(false)
    setError(null)
  }

  if (loading && products.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading products...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">{error}</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Master Inventory</h1>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowProductEntry(true)}
            className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </button>
          <button
            onClick={handleEditTabularToggle}
            className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
              isEditingTabular ? 'bg-yellow-500 text-white hover:bg-yellow-600' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isEditingTabular ? <X className="w-4 h-4 mr-2" /> : <Edit className="w-4 h-4 mr-2" />}
            {isEditingTabular ? 'Exit Edit Mode' : 'Edit Tabular Format'}
          </button>
        </div>
      </div>

      {showProductEntry && (
        <ProductEntryForm 
          onClose={() => setShowProductEntry(false)}
          onProductAdded={fetchProducts}
        />
      )}

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />
      </div>

      {error && (
        <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">{error}</div>
      )}

      {isEditingTabular && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex justify-between items-center">
          <p className="text-sm text-blue-800">
            Editing mode active. Make changes directly in the table.
          </p>
          <div className="flex space-x-2">
            <button
              onClick={handleSaveTabularChanges}
              disabled={loading}
              className="flex items-center px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </button>
            <button
              onClick={handleCancelTabularChanges}
              disabled={loading}
              className="flex items-center px-3 py-1 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Mobile Card Layout */}
      <div className="block md:hidden">
        <div className="space-y-4">
          {filteredProducts.map((product) => (
            <div key={product.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center mb-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {product.name}
                    </h3>
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    <span className="font-medium">Product ID: {product.product_id || 'N/A'}</span>
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    <span className="font-medium">Category: {product.categories?.category_name || 'N/A'}</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                {/* Current Stock */}
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Current Stock:</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        product.quantity < product.threshold
                          ? 'bg-red-100 text-red-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {product.quantity} Kg
                        {product.quantity < product.threshold && (
                        <AlertTriangle className="w-4 h-4 ml-1" />
                        )}
                      </span>
                    <button
                      onClick={() => handleUpdateStock(product)}
                      className="text-blue-600 hover:text-blue-800 transition-colors"
                      title="Update Stock Quantity"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Weight per Pack */}
                {product.unit_type === 'Packs' && product.weight_per_pack_kg && (
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Weight/Pack:</span>
                    </div>
                    <div className="text-sm font-medium text-gray-900">
                      {product.weight_per_pack_kg} Kg
                    </div>
                  </div>
                )}

                {/* Prices */}
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Prices:</span>
                  </div>
                  <div className="text-sm font-medium text-gray-900">
                    <button
                      onClick={() => handleViewEditPrices(product)}
                      className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 transition-colors"
                      title="View/Edit Prices"
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>View/Edit</span>
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => handleEditProduct(product)}
                    className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 transition-colors"
                    title="Edit product"
                  >
                    <Edit className="w-4 h-4" />
                    <span className="text-sm">Edit</span>
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(product.id)}
                    className="flex items-center space-x-1 text-red-600 hover:text-red-800 transition-colors"
                    title="Delete product"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm">Delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop Table Layout */}
      <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">
                  Current Stock (Kg)
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">
                  Current Stock (Units)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Regular Cash Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Regular Credit Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dealer Cash Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dealer Credit Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hotel (Non-VAT) Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hotel (VAT) Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Farm Shop Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Weight/Pack (Kg)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Grams/Unit (g)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.map((product, index) => {
                const currentProduct = isEditingTabular
                  ? editedProducts.find(p => p.id === product.id) || product
                  : product

                // Calculate initial quantity in native units for display
                let initialQuantityNative: number | string = 'N/A';
                if (product.unit_type === 'Kg') {
                  initialQuantityNative = 'N/A'; // Or could show Kg quantity here too if desired
                } else if (product.unit_type === 'Packs' && product.weight_per_pack_kg !== null && product.weight_per_pack_kg > 0) {
                  initialQuantityNative = (product.quantity / product.weight_per_pack_kg).toFixed(1);
                } else if (product.unit_type === 'g' && product.grams_per_unit !== null && product.grams_per_unit > 0) {
                  initialQuantityNative = (product.quantity * GRAMS_PER_KG / product.grams_per_unit).toFixed(1);
                }

                return (
                  <tr key={product.id} className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-gray-100`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 hover:text-blue-800 cursor-pointer">
                      <span onClick={() => handleViewEditPrices(product)}>
                        {product.product_id || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {isEditingTabular ? (
                        <input
                          type="text"
                          value={currentProduct.name}
                          onChange={(e) => handleFieldChange(product.id, 'name', e.target.value)}
                          className="w-full border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                        />
                      ) : (
                        <div className="flex items-center">
                          <Package className="w-5 h-5 text-blue-600 mr-2" />
                          {product.name}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.categories?.category_name || product.category || 'Uncategorized'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {isEditingTabular ? (
                        <input
                          type="number"
                          step="0.1"
                          value={currentProduct.quantity}
                          onChange={(e) => handleFieldChange(product.id, 'quantity', parseFloat(e.target.value))}
                          className="w-24 border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm text-right"
                        />
                      ) : (
                        <div className="flex items-center justify-end space-x-1">
                          <span className={`text-sm font-medium ${
                            product.quantity <= 0 ? 'text-red-600' : 
                            product.quantity < product.threshold ? 'text-yellow-600' : 'text-green-600'
                          }`}>
                            {product.quantity || 0} Kg
                          </span>
                          <button
                            onClick={() => handleUpdateStock(product)}
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                            title="Update Stock Quantity"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                    {/* NEW COLUMN: Current Stock (Units) */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {product.unit_type === 'Kg' ? 'N/A' : initialQuantityNative}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.sku || 'N/A'}
                    </td>
                    {/* Price Columns */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {isEditingTabular ? (
                        <input
                          type="number"
                          step="0.01"
                          value={currentProduct.price_cash}
                          onChange={(e) => handleFieldChange(product.id, 'price_cash', parseFloat(e.target.value) || 0)}
                          className="w-24 border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                        />
                      ) : (
                        formatCurrency(product.price_cash)
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {isEditingTabular ? (
                        <input
                          type="number"
                          step="0.01"
                          value={currentProduct.price_credit}
                          onChange={(e) => handleFieldChange(product.id, 'price_credit', parseFloat(e.target.value) || 0)}
                          className="w-24 border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                        />
                      ) : (
                        formatCurrency(product.price_credit)
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {isEditingTabular ? (
                        <input
                          type="number"
                          step="0.01"
                          value={currentProduct.price_dealer_cash}
                          onChange={(e) => handleFieldChange(product.id, 'price_dealer_cash', parseFloat(e.target.value) || 0)}
                          className="w-24 border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                        />
                      ) : (
                        formatCurrency(product.price_dealer_cash)
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {isEditingTabular ? (
                        <input
                          type="number"
                          step="0.01"
                          value={currentProduct.price_dealer_credit}
                          onChange={(e) => handleFieldChange(product.id, 'price_dealer_credit', parseFloat(e.target.value) || 0)}
                          className="w-24 border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                        />
                      ) : (
                        formatCurrency(product.price_dealer_credit)
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {isEditingTabular ? (
                        <input
                          type="number"
                          step="0.01"
                          value={currentProduct.price_hotel_non_vat}
                          onChange={(e) => handleFieldChange(product.id, 'price_hotel_non_vat', parseFloat(e.target.value) || 0)}
                          className="w-24 border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                        />
                      ) : (
                        formatCurrency(product.price_hotel_non_vat)
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {isEditingTabular ? (
                        <input
                          type="number"
                          step="0.01"
                          value={currentProduct.price_hotel_vat}
                          onChange={(e) => handleFieldChange(product.id, 'price_hotel_vat', parseFloat(e.target.value) || 0)}
                          className="w-24 border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                        />
                      ) : (
                        formatCurrency(product.price_hotel_vat)
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {isEditingTabular ? (
                        <input
                          type="number"
                          step="0.01"
                          value={currentProduct.price_farm_shop}
                          onChange={(e) => handleFieldChange(product.id, 'price_farm_shop', parseFloat(e.target.value) || 0)}
                          className="w-24 border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                        />
                      ) : (
                        formatCurrency(product.price_farm_shop)
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.unit_type === 'Packs' ? (
                        isEditingTabular ? (
                          <input
                            type="number"
                            step="0.01"
                            value={currentProduct.weight_per_pack_kg ?? ''}
                            onChange={(e) => handleFieldChange(product.id, 'weight_per_pack_kg', parseFloat(e.target.value) || null)}
                            className="w-24 border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                          />
                        ) : `${product.weight_per_pack_kg ?? 'N/A'} Kg`
                      ) : 'N/A'}
                    </td>
                    {/* NEW COLUMN: Grams per Unit */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.unit_type === 'g' ? (
                        isEditingTabular ? (
                          <input
                            type="number"
                            step="0.01"
                            value={currentProduct.grams_per_unit ?? ''}
                            onChange={(e) => handleFieldChange(product.id, 'grams_per_unit', parseFloat(e.target.value) || null)}
                            className="w-24 border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                          />
                        ) : `${product.grams_per_unit ?? 'N/A'} g`
                      ) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      {!isEditingTabular && (
                        <>
                          <button
                            onClick={() => handleEditProduct(product)}
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product.id)}
                            className="text-red-600 hover:text-red-800 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-8">
            <div className="text-gray-500">No products found</div>
            <button
              onClick={() => setShowProductEntry(true)}
              className="mt-2 text-red-600 hover:text-red-700 text-sm font-medium"
            >
              Add your first product
            </button>
          </div>
        )}
      </div>

      {/* Empty State */}
      {filteredProducts.length === 0 && !loading && (
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm ? 'No products match your search criteria.' : 'Get started by adding your first product.'}
          </p>
          {!searchTerm && (
            <button
              onClick={() => setShowProductEntry(true)}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors mx-auto"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </button>
          )}
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditModal && selectedProductForEdit && (
        <EditProductModal
          product={selectedProductForEdit}
          onClose={() => setShowEditModal(false)}
          onProductUpdated={fetchProducts}
        />
      )}

      {/* Product Prices Modal */}
      {showPriceModal && selectedProductForPrices && (
        <ProductPricesModal
          product={selectedProductForPrices}
          onClose={() => setShowPriceModal(false)}
          onPricesUpdated={fetchProducts}
        />
      )}

      {/* Stock Update Modal */}
      {showStockUpdateModal && selectedProductForStockUpdate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                Update Stock Quantity
              </h3>
              <button
                onClick={() => setShowStockUpdateModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  Product: <span className="font-medium text-gray-900">{selectedProductForStockUpdate.name}</span>
                </p>
                <p className="text-sm text-gray-600">
                  Current Stock: <span className="font-medium text-gray-900">{selectedProductForStockUpdate.quantity} Kg</span>
                </p>
                {selectedProductForStockUpdate.unit_type !== 'Kg' && (
                  <p className="text-sm text-gray-600">
                    Current Stock (Units): <span className="font-medium text-gray-900">
                      {selectedProductForStockUpdate.unit_type === 'Packs' && selectedProductForStockUpdate.weight_per_pack_kg !== null
                        ? (selectedProductForStockUpdate.quantity / selectedProductForStockUpdate.weight_per_pack_kg).toFixed(1)
                        : selectedProductForStockUpdate.unit_type === 'g' && selectedProductForStockUpdate.grams_per_unit !== null
                        ? (selectedProductForStockUpdate.quantity * GRAMS_PER_KG / selectedProductForStockUpdate.grams_per_unit).toFixed(1)
                        : 'N/A'
                      } {selectedProductForStockUpdate.unit_type}
                    </span>
                  </p>
                )}
              </div>
              <div className="space-y-3">
                <label htmlFor="stockAddition" className="block text-sm font-medium text-gray-700">
                  Enter Quantity to Add ({selectedProductForStockUpdate.unit_type})
                </label>
                <input
                  type="number"
                  id="stockAddition"
                  step="0.1"
                  min="0"
                  value={stockAdditionQuantity}
                  onChange={(e) => setStockAdditionQuantity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter quantity to add"
                />
                <p className="text-xs text-gray-500">
                  This amount will be converted to Kg and added to the current stock quantity.
                </p>
              </div>
            </div>
            <div className="flex justify-end space-x-3 p-6 border-t bg-gray-50">
              <button
                onClick={() => setShowStockUpdateModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveStockUpdate}
                disabled={!stockAdditionQuantity || parseFloat(stockAdditionQuantity) <= 0}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Update Stock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}