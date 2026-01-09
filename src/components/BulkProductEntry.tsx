import React, { useState, useEffect } from 'react'
import { Plus, Save, Trash2, X, Upload, Download, Search, AlertCircle } from 'lucide-react'
import { supabase, Category, Product } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { GRAMS_PER_KG } from '../utils/units' // NEW IMPORT

interface ProductEntry {
  id: string
  name: string
  category_id: string
  initial_quantity: number | null // RENAMED from quantity
  price_cash: number | null
  price_credit: number | null
  price_dealer_cash: number | null
  price_dealer_credit: number | null
  price_hotel_non_vat: number | null
  price_hotel_vat: number | null
  price_farm_shop: number | null
  description: string
  unit_type: 'Kg' | 'g' | 'Packs' | ''
  weight_per_pack_kg?: number | null
  grams_per_unit?: number | null // NEW FIELD
  errors?: string[]
}

interface BulkProductEntryProps {
  onClose: () => void
  onProductsAdded: () => void
}

interface InputPosition {
  top: number
  left: number
  width: number
}

interface ProductSuggestion {
  id: string
  name: string
  categoryName: string
  price: number
}

export const BulkProductEntry: React.FC<BulkProductEntryProps> = ({ onClose, onProductsAdded }) => {
  const { isOnline } = useAuth()
  const [products, setProducts] = useState<ProductEntry[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [showFileImport, setShowFileImport] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [existingDbProducts, setExistingDbProducts] = useState<Product[]>([])
  const [error, setError] = useState<string | null>(null)

  const unitTypes = ['Kg', 'g', 'Packs']; // Define available unit types

  useEffect(() => {
    fetchCategories()
    fetchExistingProducts()
    initializeProducts()
  }, [])

  const fetchCategories = async () => {
    try {
      const cacheKey = 'bulk_product_entry_categories'
      if (!isOnline) {
        const cachedData = localStorage.getItem(cacheKey)
        if (cachedData) {
          setCategories(JSON.parse(cachedData))
          return
        }
      }

      const { data: testData, error: testError } = await supabase
        .from('categories')
        .select('count')
        .limit(1)
        .single()
      
      if (testError && testError.code !== 'PGRST116') {
        throw new Error(`Database connection failed: ${testError.message}`)
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
      const cachedData = localStorage.getItem('bulk_product_entry_categories')
      if (cachedData) {
        setCategories(JSON.parse(cachedData))
      } else {
        setCategories([])
      }

      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.error('Supabase connection failed. Please check:')
        console.error('1. VITE_SUPABASE_URL is correct in .env file')
        console.error('2. VITE_SUPABASE_ANON_KEY is correct in .env file')
        console.error('3. Your Supabase project is active')
        console.error('4. Your internet connection is working')
        console.error('5. No firewall is blocking supabase.co')
      }
    }
  }

  const fetchExistingProducts = async () => {
    try {
      const cacheKey = 'bulk_product_entry_existing_products'
      if (!isOnline) {
        const cachedData = localStorage.getItem(cacheKey)
        if (cachedData) {
          setExistingDbProducts(JSON.parse(cachedData))
          return
        }
      }

      const { data, error } = await supabase
        .from('products')
        .select('id, name, category_id')
        .order('name')

      if (error) throw error

      localStorage.setItem(cacheKey, JSON.stringify(data))
      setExistingDbProducts(data || [])
    } catch (error) {
      console.error('Error fetching existing products:', error)
      const cachedData = localStorage.getItem('bulk_product_entry_existing_products')
      if (cachedData) {
        setExistingDbProducts(JSON.parse(cachedData))
      } else {
        setExistingDbProducts([])
      }
    }
  }

  const initializeProducts = () => {
    const initialProduct: ProductEntry = {
      id: 'product-0',
      name: '',
      category_id: '',
      price_cash: null,
      price_credit: null,
      price_dealer_cash: null,
      price_dealer_credit: null,
      price_hotel_non_vat: null,
      price_hotel_vat: null,
      price_farm_shop: null,
      initial_quantity: null, // RENAMED
      description: '',
      unit_type: 'Kg',
      weight_per_pack_kg: null,
      grams_per_unit: null, // NEW FIELD
    }
    setProducts([initialProduct])
  }

  const addRows = (count: number = 1) => {
    if (products.length >= 10) {
      alert('Maximum of 10 product rows allowed.')
      return
    }
    const newRows: ProductEntry[] = Array.from({ length: count }, (_, index) => ({
      id: `product-${products.length + index}`,
      name: '',
      category_id: '',
      price_cash: null,
      price_credit: null,
      price_dealer_cash: null,
      price_dealer_credit: null,
      price_hotel_non_vat: null,
      price_hotel_vat: null,
      price_farm_shop: null,
      initial_quantity: null, // RENAMED
      description: '',
      unit_type: 'Kg',
      weight_per_pack_kg: null,
      grams_per_unit: null, // NEW FIELD
    }))
    const updatedProducts = [...products, ...newRows]
    setProducts(updatedProducts)
    
    setTimeout(() => {
      const newProductIndex = products.length
      const newProductElement = document.querySelector(`[data-product-index="${newProductIndex}"]`)
      if (newProductElement && window.innerWidth < 768) {
        newProductElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        })
      }
    }, 100)
  }

  const updateProduct = (id: string, field: keyof ProductEntry, value: any) => {
    setProducts(products.map(product => {
      if (product.id === id) {
        const updatedProduct = { ...product, [field]: value, errors: undefined }
        return updatedProduct
      }
      return product
    }))
  }

  const removeProduct = (id: string) => {
    if (products.length > 1) {
      setProducts(products.filter(product => product.id !== id))
    }
  }

  const validateProducts = (): ProductEntry[] => {
    return products.map(product => {
      const errors: string[] = []
      
      if (product.name && !product.category_id) {
        errors.push('Category is required')
      }
      if (product.name && !product.unit_type) {
        errors.push('Unit Type is required');
      }
      if (product.unit_type === 'Packs' && (product.weight_per_pack_kg === null || product.weight_per_pack_kg <= 0)) {
        errors.push('Weight per Pack (Kg) must be greater than 0 for Packs unit type');
      }
      if (product.unit_type === 'g' && (product.grams_per_unit === null || product.grams_per_unit <= 0)) { // NEW VALIDATION
        errors.push('Grams per Unit must be greater than 0 for Grams unit type');
      }
      if (product.name && (
        product.price_cash === null || product.price_cash <= 0 ||
        product.price_credit === null || product.price_credit <= 0 ||
        product.price_dealer_cash === null || product.price_dealer_cash <= 0 ||
        product.price_dealer_credit === null || product.price_dealer_credit <= 0 ||
        product.price_hotel_non_vat === null || product.price_hotel_non_vat <= 0 ||
        product.price_hotel_vat === null || product.price_hotel_vat <= 0 ||
        product.price_farm_shop === null || product.price_farm_shop <= 0
      )) {
        errors.push('All prices must be greater than 0');
      }
      if (product.name && product.initial_quantity !== null && product.initial_quantity < 0) { // Use initial_quantity
        errors.push('Initial quantity cannot be negative')
      }

      return { ...product, errors: errors.length > 0 ? errors : undefined }
    })
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      try {
        const { data: testData, error: testError } = await supabase
          .from('categories')
          .select('count')
          .limit(1)
          .single()
        
        if (testError && testError.code !== 'PGRST116') {
          throw new Error(`Database connection failed: ${testError.message}`)
        }
      } catch (connectionError) {
        if (connectionError instanceof TypeError && connectionError.message.includes('Failed to fetch')) {
          throw new Error('Cannot connect to Supabase. Please verify your database connection and try again.')
        }
        throw connectionError
      }

      const validatedProducts = validateProducts()
      const productsToSave = validatedProducts.filter(p => 
        p.name.trim() !== '' && (!p.errors || p.errors.length === 0)
      )

      if (productsToSave.length === 0) {
        alert('No valid products to save')
        setLoading(false)
        return
      }

      let savedCount = 0
      let errorCount = 0
      const errors: string[] = []

      for (const product of productsToSave) {
        try {
          const selectedCategory = categories.find(c => c.category_id === product.category_id)
          if (!selectedCategory) {
            errors.push(`Product "${product.name}": Invalid category selected`)
            errorCount++
            continue
          }

          let calculatedQuantityInKg: number = 0;
          if (product.initial_quantity !== null) {
            if (product.unit_type === 'Kg') {
              calculatedQuantityInKg = product.initial_quantity;
            } else if (product.unit_type === 'Packs' && product.weight_per_pack_kg !== null) {
              calculatedQuantityInKg = product.initial_quantity * product.weight_per_pack_kg;
            } else if (product.unit_type === 'g' && product.grams_per_unit !== null) {
              calculatedQuantityInKg = product.initial_quantity * (product.grams_per_unit / GRAMS_PER_KG);
            }
          }

          const existingProduct = existingDbProducts.find(p => 
            p.name.toLowerCase() === product.name.toLowerCase() && 
            p.category_id === product.category_id
          )
          
          if (existingProduct) {
            const { error } = await supabase
              .from('products')
              .update({ 
                quantity: calculatedQuantityInKg, // Use calculated quantity in Kg
                price_cash: product.price_cash || 0,
                price_credit: product.price_credit || 0,
                price_dealer_cash: product.price_dealer_cash || 0,
                price_dealer_credit: product.price_dealer_credit || 0,
                price_hotel_non_vat: product.price_hotel_non_vat || 0,
                price_hotel_vat: product.price_hotel_vat || 0,
                price_farm_shop: product.price_farm_shop || 0,
                unit_type: product.unit_type,
                weight_per_pack_kg: product.unit_type === 'Packs' ? product.weight_per_pack_kg : null,
                grams_per_unit: product.unit_type === 'g' ? product.grams_per_unit : null, // NEW FIELD
              })
              .eq('id', existingProduct.id)

            if (error) {
              console.error(`Error updating product "${product.name}":`, error)
              errors.push(`Product "${product.name}": ${error.message}`)
              errorCount++
            } else {
              savedCount++
            }
          } else {
            const { error } = await supabase
              .from('products')
              .insert([{
                name: product.name,
                category_id: product.category_id,
                sku: `SKU-${product.name.substring(0, 3).toUpperCase()}`,
                quantity: calculatedQuantityInKg, // Use calculated quantity in Kg
                price_cash: product.price_cash || 0,
                price_credit: product.price_credit || 0,
                price_dealer_cash: product.price_dealer_cash || 0,
                price_dealer_credit: product.price_dealer_credit || 0,
                price_hotel_non_vat: product.price_hotel_non_vat || 0,
                price_hotel_vat: product.price_hotel_vat || 0,
                price_farm_shop: product.price_farm_shop || 0,
                unit_type: product.unit_type,
                weight_per_pack_kg: product.unit_type === 'Packs' ? product.weight_per_pack_kg : null,
                grams_per_unit: product.unit_type === 'g' ? product.grams_per_unit : null, // NEW FIELD
                threshold: Math.max(1, Math.floor((calculatedQuantityInKg || 0) * 0.1)), // Threshold based on Kg
              }])

            if (error) {
              console.error(`Error inserting product "${product.name}":`, error)
              errors.push(`Product "${product.name}": ${error.message}`)
              errorCount++
            } else {
              savedCount++
            }
          }
        } catch (productError) {
          console.error(`Unexpected error processing product "${product.name}":`, productError)
          errors.push(`Product "${product.name}": Unexpected error occurred`)
          errorCount++
        }
      }

      if (savedCount > 0 && errorCount === 0) {
        alert(`Successfully saved ${savedCount} products`)
        onProductsAdded()
        initializeProducts()
        setError(null)
      } else if (savedCount > 0 && errorCount > 0) {
        alert(`Partially completed: ${savedCount} products saved, ${errorCount} failed.\n\nErrors:\n${errors.join('\n')}`)
        onProductsAdded()
        initializeProducts()
        setError(null)
      } else {
        alert(`Failed to save products.\n\nErrors:\n${errors.join('\n')}`)
      }
    } catch (error) {
      console.error('Error saving products:', error)
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        alert('Cannot connect to database. Please check your Supabase connection and try again.')
      } else {
        alert(`Failed to save products: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  const handleFile = async (selectedFile: File) => {
    if (!selectedFile.name.match(/\.(csv|xlsx|xls)$/)) {
      alert('Please select a CSV or Excel file')
      return
    }

    setFile(selectedFile)
    
    try {
      const text = await selectedFile.text()
      const lines = text.split('\n').filter(line => line.trim())
      
      if (lines.length < 2) {
        alert('File must contain at least a header row and one data row')
        return
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      const requiredHeaders = ['product name', 'category', 'initial quantity', 'unit type', 'weight per pack kg', 'grams per unit', 'cash price', 'credit price', 'dealer cash price', 'dealer credit price', 'hotel non-vat price', 'hotel vat price', 'farm shop price', 'description'] // Updated header
      
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h))
      if (missingHeaders.length > 0) {
        // Allow 'weight per pack kg' and 'grams per unit' to be optional in CSV
        alert(`Missing required columns: ${missingHeaders.filter(h => h !== 'weight per pack kg' && h !== 'grams per unit').join(', ')}`)
        return
      }

      const parsedProducts: ProductEntry[] = lines.slice(1).map((line, index) => {
        const values = line.split(',').map(v => v.trim())
        const categoryName = values[headers.indexOf('category')] || ''
        const category = categories.find(c => c.category_name.toLowerCase() === categoryName.toLowerCase())
        const unitTypeValue = values[headers.indexOf('unit type')] || 'Kg';

        return {
          id: `import-${index}`,
          name: values[headers.indexOf('product name')] || '',
          category_id: category?.category_id || '',
          initial_quantity: parseFloat(values[headers.indexOf('initial quantity')]) || null, // RENAMED
          unit_type: unitTypeValue as 'Kg' | 'g' | 'Packs',
          weight_per_pack_kg: parseFloat(values[headers.indexOf('weight per pack kg')]) || null,
          grams_per_unit: parseFloat(values[headers.indexOf('grams per unit')]) || null, // NEW FIELD
          price_cash: parseFloat(values[headers.indexOf('cash price')]) || null,
          price_credit: parseFloat(values[headers.indexOf('credit price')]) || null,
          price_dealer_cash: parseFloat(values[headers.indexOf('dealer cash price')]) || null,
          price_dealer_credit: parseFloat(values[headers.indexOf('dealer credit price')]) || null,
          price_hotel_non_vat: parseFloat(values[headers.indexOf('hotel non-vat price')]) || null,
          price_hotel_vat: parseFloat(values[headers.indexOf('hotel vat price')]) || null,
          price_farm_shop: parseFloat(values[headers.indexOf('farm shop price')]) || null,
          description: values[headers.indexOf('description')] || ''
        }
      })

      setProducts(parsedProducts)
      setShowFileImport(false)
      setFile(null)
    } catch (error) {
      console.error('Error parsing file:', error)
      alert('Error parsing file. Please check the format.')
    }
  }

  const downloadTemplate = () => {
    const headers = ['Product Name', 'Category', 'Initial Quantity', 'Unit Type', 'Weight per Pack (Kg)', 'Grams per Unit', 'Cash Price', 'Credit Price', 'Dealer Cash Price', 'Dealer Credit Price', 'Hotel Non-VAT Price', 'Hotel VAT Price', 'Farm Shop Price', 'Description'] // Updated header
    const sampleData = [
      'Premium Chicken Feed,Feed,50,Kg,,4500.00,4550.00,4600.00,4650.00,4700.00,4750.00,4800.00,High-quality feed for adult chickens',
      'Automatic Water Dispenser,Equipment,2,Packs,10,12000.00,12100.00,12500.00,12600.00,12700.00,12800.00,12900.00,Automatic water dispensing system',
      'Vitamin Supplement,Medicine,250,g,,200,1250.00,1275.00,1300.00,1325.00,1350.00,1375.00,1400.00,Essential vitamins for poultry health'
    ]
    
    const csvContent = [headers.join(','), ...sampleData].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'product_import_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>, productId: string, index: number) => {
    const rect = e.target.getBoundingClientRect()
  }

  const filledProducts = products.filter(p => p.name.trim() !== '').length
  const hasErrors = products.some(p => p.errors && p.errors.length > 0)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[95vh] overflow-hidden">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Bulk Product Entry</h2>
              <p className="text-sm text-gray-600">
                {filledProducts} products ready 
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              
              <button
                onClick={() => setShowFileImport(true)}
                className="flex items-center px-3 py-2 text-green-600 bg-green-100 rounded-lg hover:bg-green-200 transition-colors"
              >
                <Upload className="w-4 h-4 mr-2" />
                File Import
              </button>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => addRows()}
                disabled={products.length >= 10}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add More Products
              </button>
              <button
                onClick={handleSave}
                disabled={loading || hasErrors || filledProducts === 0}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  'Saving...'
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Products
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Bulk Entry Table */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Mobile Card Layout */}
            <div className="block md:hidden">
              <div className="space-y-4 pb-4">
                {products.map((product, index) => (
                  <div key={product.id} className={`bg-white border rounded-lg p-4 ${product.errors ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-medium text-gray-500">Product #{index + 1}</span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => removeProduct(product.id)}
                          className="p-2.5 text-red-600 bg-red-100 rounded-full hover:bg-red-200 touch-manipulation"
                          disabled={products.length === 1}
                          title="Remove product"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      {/* Product Name */}
                      <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Product Name *
                        </label>
                        <input
                          type="text"
                          value={product.name}
                          onChange={(e) => updateProduct(product.id, 'name', e.target.value)}
                          className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
                          placeholder="Enter product name"
                        />
                      </div>

                      {/* Category */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Category *
                        </label>
                        <select
                          value={product.category_id}
                          onChange={(e) => updateProduct(product.id, 'category_id', e.target.value)}
                          className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
                        >
                          <option value="">Select category</option>
                          {categories.map((category) => (
                            <option key={category.category_id} value={category.category_id}>
                              {category.category_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Unit Type */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Unit Type *
                        </label>
                        <select
                          value={product.unit_type}
                          onChange={(e) => updateProduct(product.id, 'unit_type', e.target.value as 'Kg' | 'g' | 'Packs')}
                          className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
                        >
                          {unitTypes.map((unit) => (
                            <option key={unit} value={unit}>
                              {unit}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Weight per Pack (Kg) - only for Packs */}
                      {product.unit_type === 'Packs' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Weight per Pack (Kg) (Optional)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={product.weight_per_pack_kg ?? ''}
                              onChange={(e) => updateProduct(product.id, 'weight_per_pack_kg', parseFloat(e.target.value) || null)}
                              className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
                              placeholder="e.g., 0.5"
                            />
                            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                              Kg
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Grams per Unit - only for g */}
                      {product.unit_type === 'g' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Grams per Unit (Optional)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={product.grams_per_unit ?? ''}
                              onChange={(e) => updateProduct(product.id, 'grams_per_unit', parseFloat(e.target.value) || null)}
                              className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
                              placeholder="e.g., 100"
                            />
                            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                              g
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Initial Quantity */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Initial Quantity
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={product.initial_quantity ?? ''}
                          onChange={(e) => updateProduct(product.id, 'initial_quantity', parseFloat(e.target.value) || null)}
                          className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
                          min="0"
                          placeholder="0.0"
                        />
                      </div>

                      {/* Price Fields */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Cash Price (Rs) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={product.price_cash ?? ''}
                            onChange={(e) => updateProduct(product.id, 'price_cash', parseFloat(e.target.value) || null)}
                            className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
                            min="0"
                            placeholder="Rs. 0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Credit Price (Rs) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={product.price_credit ?? ''}
                            onChange={(e) => updateProduct(product.id, 'price_credit', parseFloat(e.target.value) || null)}
                            className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
                            min="0"
                            placeholder="Rs. 0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Dealer Cash Price (Rs) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={product.price_dealer_cash ?? ''}
                            onChange={(e) => updateProduct(product.id, 'price_dealer_cash', parseFloat(e.target.value) || null)}
                            className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
                            min="0"
                            placeholder="Rs. 0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Dealer Credit Price (Rs) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={product.price_dealer_credit ?? ''}
                            onChange={(e) => updateProduct(product.id, 'price_dealer_credit', parseFloat(e.target.value) || null)}
                            className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
                            min="0"
                            placeholder="Rs. 0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Hotel Non-VAT Price (Rs) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={product.price_hotel_non_vat ?? ''}
                            onChange={(e) => updateProduct(product.id, 'price_hotel_non_vat', parseFloat(e.target.value) || null)}
                            className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
                            min="0"
                            placeholder="Rs. 0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Hotel VAT Price (Rs) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={product.price_hotel_vat ?? ''}
                            onChange={(e) => updateProduct(product.id, 'price_hotel_vat', parseFloat(e.target.value) || null)}
                            className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
                            min="0"
                            placeholder="Rs. 0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Farm Shop Price (Rs) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={product.price_farm_shop ?? ''}
                            onChange={(e) => updateProduct(product.id, 'price_farm_shop', parseFloat(e.target.value) || null)}
                            className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
                            min="0"
                            placeholder="Rs. 0.00"
                          />
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description
                        </label>
                        <textarea
                          value={product.description}
                          onChange={(e) => updateProduct(product.id, 'description', e.target.value)}
                          className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
                          placeholder="Product description"
                          rows={2}
                        />
                      </div>

                      {/* Error Display */}
                      {product.errors && (
                        <div className="p-3 bg-red-100 border border-red-300 rounded-lg">
                          <div className="flex items-center">
                            <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                            <div className="text-sm text-red-700">
                              {product.errors.join(', ')}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden md:block">
              <div className="overflow-x-auto pb-4">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-8">#</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase min-w-48">Product Name *</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase min-w-40">Category *</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">Initial Quantity</th> {/* RENAMED */}
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">Unit Type *</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">Weight/Pack (Kg)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">Grams/Unit (g)</th> {/* NEW HEADER */}
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">Cash *</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">Credit *</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">Dealer Cash *</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">Dealer Credit *</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">Hotel Non-VAT *</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">Hotel VAT *</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">Farm Shop *</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase min-w-48">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-16">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {products.map((product, index) => (
                      <tr key={product.id} className={`hover:bg-gray-50 ${product.errors ? 'bg-red-50' : ''}`}>
                        <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                        <td className="px-4 py-3 relative">
                          <input
                            type="text"
                            value={product.name}
                            onChange={(e) => updateProduct(product.id, 'name', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Enter product name"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={product.category_id}
                            onChange={(e) => updateProduct(product.id, 'category_id', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">Select category</option>
                            {categories.map((category) => (
                              <option key={category.category_id} value={category.category_id}>
                                {category.category_name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.1"
                            value={product.initial_quantity ?? ''} // RENAMED
                            onChange={(e) => updateProduct(product.id, 'initial_quantity', parseFloat(e.target.value) || null)} // RENAMED
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            min="0"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={product.unit_type}
                            onChange={(e) => updateProduct(product.id, 'unit_type', e.target.value as 'Kg' | 'g' | 'Packs')}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            {unitTypes.map((unit) => (
                              <option key={unit} value={unit}>
                                {unit}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          {product.unit_type === 'Packs' ? (
                            <input
                              type="number"
                              step="0.01"
                              value={product.weight_per_pack_kg ?? ''}
                              onChange={(e) => updateProduct(product.id, 'weight_per_pack_kg', parseFloat(e.target.value) || null)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              min="0"
                            />
                          ) : 'N/A'}
                        </td>
                        {/* NEW COLUMN: Grams per Unit */}
                        <td className="px-4 py-3">
                          {product.unit_type === 'g' ? (
                            <input
                              type="number"
                              step="0.01"
                              value={product.grams_per_unit ?? ''}
                              onChange={(e) => updateProduct(product.id, 'grams_per_unit', parseFloat(e.target.value) || null)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              min="0"
                            />
                          ) : 'N/A'}
                        </td>

                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.01"
                            value={product.price_cash ?? ''}
                            onChange={(e) => updateProduct(product.id, 'price_cash', parseFloat(e.target.value) || null)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            min="0"
                            placeholder="Rs. 0.00"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.01"
                            value={product.price_credit ?? ''}
                            onChange={(e) => updateProduct(product.id, 'price_credit', parseFloat(e.target.value) || null)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            min="0"
                            placeholder="Rs. 0.00"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.01"
                            value={product.price_dealer_cash ?? ''}
                            onChange={(e) => updateProduct(product.id, 'price_dealer_cash', parseFloat(e.target.value) || null)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            min="0"
                            placeholder="Rs. 0.00"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.01"
                            value={product.price_dealer_credit ?? ''}
                            onChange={(e) => updateProduct(product.id, 'price_dealer_credit', parseFloat(e.target.value) || null)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            min="0"
                            placeholder="Rs. 0.00"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.01"
                            value={product.price_hotel_non_vat ?? ''}
                            onChange={(e) => updateProduct(product.id, 'price_hotel_non_vat', parseFloat(e.target.value) || null)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            min="0"
                            placeholder="Rs. 0.00"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.01"
                            value={product.price_hotel_vat ?? ''}
                            onChange={(e) => updateProduct(product.id, 'price_hotel_vat', parseFloat(e.target.value) || null)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            min="0"
                            placeholder="Rs. 0.00"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.01"
                            value={product.price_farm_shop ?? ''}
                            onChange={(e) => updateProduct(product.id, 'price_farm_shop', parseFloat(e.target.value) || null)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            min="0"
                            placeholder="Rs. 0.00"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={product.description}
                            onChange={(e) => updateProduct(product.id, 'description', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Product description"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => removeProduct(product.id)}
                              className="p-2 text-red-600 hover:text-red-800 rounded-full hover:bg-red-50"
                              disabled={products.length === 1}
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

            {hasErrors && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                  <h3 className="text-sm font-medium text-red-800">Validation Errors</h3>
                </div>
                <div className="mt-2 text-sm text-red-700">
                  Please fix the highlighted errors before saving.
                </div>
              </div>
            )}
          </div>

          {/* File Import Modal */}
          {showFileImport && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">File Import</h3>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={downloadTemplate}
                      className="flex items-center px-3 py-2 text-blue-600 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Template
                    </button>
                    <button
                      onClick={() => setShowFileImport(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragActive 
                      ? 'border-blue-400 bg-blue-50' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">
                    Upload your file
                  </h4>
                  <p className="text-gray-600 mb-4">
                    Drag and drop your CSV or Excel file here, or click to browse
                  </p>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileInput}
                    className="hidden"
                    id="file-input"
                  />
                  <label
                    htmlFor="file-input"
                    className="cursor-pointer px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Choose File
                  </label>
                  <p className="text-sm text-gray-500 mt-4">
                    Required columns: Product Name, Category, Initial Quantity, Unit Type, Weight per Pack (Kg), Grams per Unit, Cash Price, Credit Price, Dealer Cash Price, Dealer Credit Price, Hotel Non-VAT Price, Hotel VAT Price, Farm Shop Price, Description
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}