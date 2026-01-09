import React, { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Search, Tag, AlertCircle } from 'lucide-react'
import { supabase, Category } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth' // Import useAuth to get isOnline status

export const Categories: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const { isOnline } = useAuth() // Get online status
  const [showModal, setShowModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [formData, setFormData] = useState({
    category_name: '',
    category_code: '',
    description: '',
    status: true
  })
  const [errors, setErrors] = useState<{[key: string]: string}>({})
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Generate unique category code from category name
  const generateUniqueCode = (categoryName: string): string => {
    if (!categoryName.trim()) return ''
    
    // Extract first letters of each word, up to 3 characters
    const words = categoryName.trim().split(/\s+/)
    let code = ''
    
    for (const word of words) {
      if (code.length < 3 && word.length > 0) {
        code += word.charAt(0).toUpperCase()
      }
    }
    
    // If still less than 2 characters, pad with more letters from first word
    if (code.length < 2 && words[0]) {
      const firstWord = words[0].toUpperCase()
      for (let i = 1; i < firstWord.length && code.length < 3; i++) {
        code += firstWord.charAt(i)
      }
    }
    
    // Ensure minimum 2 characters
    if (code.length < 2) {
      code = code.padEnd(2, 'X')
    }
    
    return code
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    setFetchError(null)
    const cacheKey = 'categories_data'
    if (!isOnline) {
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        setCategories(JSON.parse(cachedData))
        setLoading(false)
        return
      }
    }

    try {
      console.log('Fetching categories...')
      const { data, error } = await supabase
        .from('categories')
        .select('category_id, category_name, category_code, category_display_id, description, status, created_at')
        .order('category_name')

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }
      
      console.log('Categories fetched:', data)
      localStorage.setItem(cacheKey, JSON.stringify(data))
      setCategories(data || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
      setFetchError('Failed to load categories. Please check your database connection.')
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        setCategories(JSON.parse(cachedData))
      } else {
        setCategories([])
      }
    } finally {
      setLoading(false)
    }
  }

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {}

    // Category name validation
    if (!formData.category_name.trim()) {
      newErrors.category_name = 'Category name is required'
    } else if (formData.category_name.length < 3 || formData.category_name.length > 50) {
      newErrors.category_name = 'Category name must be between 3 and 50 characters'
    }

    // Category code validation
    if (!formData.category_code.trim()) {
      newErrors.category_code = 'Category code is required'
    } else if (!/^[A-Z]{2,3}$/.test(formData.category_code)) {
      newErrors.category_code = 'Category code must be 2-3 uppercase letters'
    }

    // Description validation
    if (formData.description.length > 200) {
      newErrors.description = 'Description must not exceed 200 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle category name change and auto-generate code
  const handleCategoryNameChange = (value: string) => {
    const generatedCode = generateUniqueCode(value)
    setFormData({ 
      ...formData, 
      category_name: value,
      category_code: !editingCategory ? generatedCode : formData.category_code
    })
  }
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      if (editingCategory) {
        const { error } = await supabase
          .from('categories')
          .update(formData)
          .eq('category_id', editingCategory.category_id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('categories')
          .insert([formData])

        if (error) throw error
      }

      await fetchCategories()
      setShowModal(false)
      setEditingCategory(null)
      setFormData({ category_name: '', category_code: '', description: '', status: true })
      setErrors({})
    } catch (error: any) {
      console.error('Error saving category:', error)
      if (error.code === '23505') {
        if (error.message.includes('category_name')) {
          setErrors({ category_name: 'Category name already exists' })
        } else if (error.message.includes('category_code')) {
          setErrors({ category_code: 'Category code already exists' })
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category? This action cannot be undone.')) return

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('category_id', categoryId)

      if (error) throw error
      await fetchCategories()
    } catch (error) {
      console.error('Error deleting category:', error)
      alert('Cannot delete category. It may be in use by existing products.')
    }
  }

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category)
    setFormData({
      category_name: category.category_name,
      category_code: category.category_code,
      description: category.description,
      status: category.status
    })
    setErrors({})
    setShowModal(true)
  }

  const filteredCategories = categories.filter(category =>
    category.category_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    category.category_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    category.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading && categories.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading categories...</div>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">{fetchError}</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Category Management</h1>
        <button
          onClick={() => {
            setShowModal(true)
            setEditingCategory(null)
            setFormData({ category_name: '', category_code: '', description: '', status: true })
            setErrors({})
          }}
          className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Category
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search categories..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />
      </div>

      {/* Categories Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Mobile Card Layout */}
        <div className="block md:hidden">
          <div className="space-y-2">
            {filteredCategories.map((category) => (
              <div key={category.category_id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center flex-1 min-w-0">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                      <Tag className="w-4 h-4 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {category.category_name}
                      </h3>
                      <div className="flex items-center mt-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          category.status
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {category.status ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-3">
                    <button
                      onClick={() => handleEditCategory(category)}
                      className="p-2 text-blue-600 bg-blue-100 rounded-full hover:bg-blue-200 touch-manipulation"
                      title="Edit category"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category.category_id)}
                      className="p-2 text-red-600 bg-red-100 rounded-full hover:bg-red-200 touch-manipulation"
                      title="Delete category"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-1 text-xs ml-11">
                  <div className="flex items-start">
                    <span className="text-gray-500 font-medium w-16 flex-shrink-0">ID:</span>
                    <span className="text-gray-700 flex-1">{category.category_display_id}</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-gray-500 font-medium w-16 flex-shrink-0">Code:</span>
                    <span className="text-gray-700 flex-1">{category.category_code}</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-gray-500 font-medium w-16 flex-shrink-0">Desc:</span>
                    <span className="text-gray-700 flex-1">{category.description || 'N/A'}</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-gray-500 font-medium w-16 flex-shrink-0">Created:</span>
                    <span className="text-gray-700 flex-1">{new Date(category.created_at).toLocaleDateString()}</span>
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
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredCategories.map((category, index) => (
                  <tr key={category.category_id} className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-gray-100`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Tag className="w-8 h-8 text-red-600 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{category.category_name}</div>
                          <div className="text-sm text-gray-500">
                            Created: {new Date(category.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {category.category_display_id}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {category.category_code}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {category.description || 'No description'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        category.status
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {category.status ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditCategory(category)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(category.category_id)}
                          className="text-red-600 hover:text-red-900"
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

      {/* Add/Edit Category Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              {editingCategory ? 'Edit Category' : 'Add New Category'}
            </h2>
            
            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  value={formData.category_name}
                  onChange={(e) => handleCategoryNameChange(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent ${
                    errors.category_name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter category name (3-50 characters)"
                />
                {errors.category_name && (
                  <div className="flex items-center mt-1 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.category_name}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category Code *
                </label>
                <input
                  type="text"
                  value={formData.category_code}
                  onChange={(e) => setFormData({ ...formData, category_code: e.target.value.toUpperCase() })}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent ${
                    errors.category_code ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Auto-generated (e.g., CB, WC)"
                  maxLength={3}
                />
                {errors.category_code && (
                  <div className="flex items-center mt-1 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.category_code}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent ${
                    errors.description ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter description (max 200 characters)"
                  rows={3}
                  maxLength={200}
                />
                <div className="flex justify-between items-center mt-1">
                  {errors.description && (
                    <div className="flex items-center text-red-600 text-sm">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {errors.description}
                    </div>
                  )}
                  <div className="text-sm text-gray-500 ml-auto">
                    {formData.description.length}/200
                  </div>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="status"
                  checked={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.checked })}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                />
                <label htmlFor="status" className="ml-2 block text-sm text-gray-900">
                  Active
                </label>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingCategory(null)
                    setFormData({ category_name: '', category_code: '', description: '', status: true })
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
                  {loading ? 'Saving...' : editingCategory ? 'Update' : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}