import React, { useState, useEffect } from 'react'
import { Search, Package, Plus, DollarSign, Edit } from 'lucide-react'
import { supabase, Product } from '../lib/supabase'
import { ProductEntryForm } from './ProductEntryForm'
import { ProductPricesModal } from './ProductPricesModal'
import { EditProductModal } from './EditProductModal'
import { useAuth } from '../hooks/useAuth'
import { GRAMS_PER_KG } from '../utils/units' // NEW IMPORT

export const ProductList: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const { isOnline } = useAuth()
  const [showProductEntry, setShowProductEntry] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPriceModal, setShowPriceModal] = useState(false)
  const [selectedProductForPrices, setSelectedProductForPrices] = useState<Product | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedProductForEdit, setSelectedProductForEdit] = useState<Product | null>(null)

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    setError(null)
    const cacheKey = 'product_list_data'
    if (!isOnline) {
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        setProducts(JSON.parse(cachedData))
        setLoading(false)
        return
      }
    }

    try {
      console.log('Fetching products...')
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
          weight_per_pack_kg,
          grams_per_unit, 
          unit_type,
          created_at,
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
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }
      
      console.log('Products fetched:', data)
      localStorage.setItem(cacheKey, JSON.stringify(data))
      setProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
      setError('Failed to load products. Please check your database connection.')
      
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        setProducts(JSON.parse(cachedData))
      } else {
        setProducts([])
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

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.categories?.category_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
        <h1 className="text-2xl font-bold text-gray-900">Product List</h1>
        <button
          onClick={() => setShowProductEntry(true)}
          className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </button>
      </div>

      {/* Product Entry Form Modal */}
      {showProductEntry && (
        <ProductEntryForm 
          onClose={() => setShowProductEntry(false)}
          onProductAdded={fetchProducts}
        />
      )}

      {/* Search */}
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

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Mobile Card Layout */}
        <div className="block md:hidden">
          <div className="space-y-3">
            {filteredProducts.map((product) => (
              <div key={product.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {product.name}
                    </h3>
                    <div className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">Product ID: {product.product_id ? (() => {
                        const match = String(product.product_id).match(/(\d+)/);
                        return match ? String(match[1]).padStart(3, '0') : 'N/A';
                      })() : 'N/A'}</span>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Package className="w-8 h-8 text-blue-600 mr-3" />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 font-medium">Category:</span>
                    <div className="text-gray-700">{product.categories?.category_name || product.category || 'Uncategorized'}</div>
                  </div>
                  <div>
                    <span className="text-gray-500 font-medium">SKU:</span>
                    <div className="text-gray-700">{product.sku || 'N/A'}</div>
                  </div>
                  <div>
                    <span className="text-gray-500 font-medium">Quantity (Kg):</span> {/* RENAMED */}
                    <div className="text-gray-700">{product.quantity || 0} Kg</div> {/* Always display in Kg */}
                  </div>
                  <div>
                    <span className="text-gray-500 font-medium">Quantity (Units):</span> {/* NEW FIELD */}
                    <div className="text-gray-700">
                      {product.unit_type === 'Kg' ? 'N/A' :
                       product.unit_type === 'Packs' && product.weight_per_pack_kg !== null
                         ? (product.quantity / product.weight_per_pack_kg).toFixed(1)
                         : product.unit_type === 'g' && product.grams_per_unit !== null
                         ? (product.quantity * GRAMS_PER_KG / product.grams_per_unit).toFixed(1)
                         : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500 font-medium">Threshold:</span>
                    <div className="text-gray-700">{product.threshold || 0} Kg</div> {/* Threshold also in Kg */}
                  </div>
                  {product.unit_type === 'Packs' && (
                    <div>
                      <span className="text-gray-500 font-medium">Weight/Pack:</span>
                      <div className="text-gray-700">{product.weight_per_pack_kg ?? 'N/A'} Kg</div>
                    </div>
                  )}
                  {product.unit_type === 'g' && (
                    <div>
                      <span className="text-gray-500 font-medium">Grams/Unit:</span> {/* NEW FIELD */}
                      <div className="text-gray-700">{product.grams_per_unit ?? 'N/A'} g</div>
                    </div>
                  )}
                </div>

                {/* Edit Details Button for Mobile */}
                <div className="flex justify-end mt-3">
                  <button
                    onClick={() => handleEditProduct(product)}
                    className="flex items-center px-3 py-2 text-blue-600 bg-blue-100 rounded-lg hover:bg-blue-200 touch-manipulation text-sm font-medium"
                    title="Edit Product Details"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit Details
                  </button>
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
                    Product ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity (Kg) {/* RENAMED */}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity (Units) {/* NEW HEADER */}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Weight/Pack (Kg)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Grams/Unit (g) {/* NEW HEADER */}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredProducts.map((product, index) => (
                  <tr key={product.id} className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-gray-100`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.product_id || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Package className="w-8 h-8 text-blue-600 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{product.name}</div>
                          <div className="text-xs text-gray-500">Threshold: {product.threshold || 0} Kg</div> {/* Threshold also in Kg */}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.categories?.category_name || product.category || 'Uncategorized'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className={`font-medium ${(product.quantity || 0) <= (product.threshold || 0) ? 'text-red-600' : 'text-green-600'}`}>
                        {product.quantity || 0} Kg {/* Always display in Kg */}
                      </div>
                    </td>
                    {/* NEW COLUMN: Quantity (Units) */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="font-medium text-gray-900">
                        {product.unit_type === 'Kg' ? 'N/A' :
                         product.unit_type === 'Packs' && product.weight_per_pack_kg !== null
                           ? (product.quantity / product.weight_per_pack_kg).toFixed(1)
                           : product.unit_type === 'g' && product.grams_per_unit !== null
                           ? (product.quantity * GRAMS_PER_KG / product.grams_per_unit).toFixed(1)
                           : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.sku || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.unit_type === 'Packs' ? `${product.weight_per_pack_kg ?? 'N/A'} Kg` : 'N/A'}
                    </td>
                    {/* NEW COLUMN: Grams per Unit */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.unit_type === 'g' ? `${product.grams_per_unit ?? 'N/A'} g` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEditProduct(product)}
                        className="flex items-center px-3 py-2 text-blue-600 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
                        title="Edit Product Details"
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
    </div>
  )
}