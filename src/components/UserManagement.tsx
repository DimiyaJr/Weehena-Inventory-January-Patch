import React, { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Search, User, Shield, UserCheck, Eye } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

interface User {
  id: string
  username: string
  role: string
  first_login: boolean
  created_at: string
  email?: string
  title: 'Mr' | 'Mrs' | 'Ms' | 'Dr'
  first_name: string
  last_name: string
  employee_id?: string
  phone_number: string
}

export const UserManagement: React.FC = () => {
  const { user, isOnline } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'Sales Rep',
    title: 'Mr' as 'Mr' | 'Mrs' | 'Ms' | 'Dr',
    first_name: '',
    last_name: '',
    employee_id: '',
    phone_number: ''
  })
  const [error, setError] = useState('')

  const roles = ['Super Admin', 'Admin', 'Sales Rep', 'Security Guard', 'Order Manager', 'Finance Admin']
  const titles = ['Mr', 'Mrs', 'Ms', 'Dr']

  // Add the internal token environment variable
  const INTERNAL_USER_MANAGEMENT_TOKEN = import.meta.env.VITE_INTERNAL_USER_MANAGEMENT_TOKEN
  console.log('UserManagement: VITE_INTERNAL_USER_MANAGEMENT_TOKEN is set:', !!INTERNAL_USER_MANAGEMENT_TOKEN);

  // Username auto-generation effect
  useEffect(() => {
    // Only auto-generate username if adding a new user
    if (!editingUser) {
      const firstName = formData.first_name.trim();
      const lastName = formData.last_name.trim();

      if (firstName && lastName) {
        // Combine first and last name, convert to lowercase, replace spaces with dots, and remove special characters
        const generatedUsername = `${firstName}.${lastName}`
          .toLowerCase()
          .replace(/\s+/g, '.') // Replace multiple spaces with a single dot
          .replace(/[^a-z0-9.]/g, ''); // Remove any characters that are not a-z, 0-9, or a dot

        setFormData(prev => ({ ...prev, username: generatedUsername }));
      } else if (formData.username && (!firstName || !lastName)) {
        // Clear username if first or last name is removed and username was auto-generated
        setFormData(prev => ({ ...prev, username: '' }));
      }
    }
  }, [formData.first_name, formData.last_name, editingUser]);

  useEffect(() => {
    if (user?.role === 'Super Admin') {
      fetchUsers()
    }
  }, [user])

  const fetchUsers = async () => {
    try {
      const cacheKey = 'user_management_data'
      if (!isOnline) {
        const cachedData = localStorage.getItem(cacheKey)
        if (cachedData) {
          setUsers(JSON.parse(cachedData))
          setLoading(false)
          return
        }
      }

      const { data, error } = await supabase
        .from('users')
        .select('id, username, role, first_login, created_at, email, title, first_name, last_name, employee_id, phone_number')
        .order('created_at', { ascending: false })

      if (error) throw error
      
      localStorage.setItem(cacheKey, JSON.stringify(data))
      setUsers(data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
      const cachedData = localStorage.getItem('user_management_data')
      if (cachedData) {
        setUsers(JSON.parse(cachedData))
      } else {
        setUsers([])
      }
    } finally {
      setLoading(false)
    }
  }

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long'
    }
    if (!/[a-zA-Z]/.test(password)) {
      return 'Password must contain at least one letter'
    }
    if (!/\d/.test(password)) {
      return 'Password must contain at least one number'
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return 'Password must contain at least one symbol'
    }
    return null
  }

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Validate password if provided (for new users or when changing password)
      if ((!editingUser || formData.password.trim()) && formData.password) {
        const passwordError = validatePassword(formData.password)
        if (passwordError) {
          throw new Error(passwordError)
        }
      }

      if (!INTERNAL_USER_MANAGEMENT_TOKEN) {
        throw new Error("Internal user management token is not configured.")
      }

      let response
      if (editingUser) {
        // Call Edge Function for update
        response = await supabase.functions.invoke('manage-users', {
          body: {
            action: 'update',
            userId: editingUser.id,
            userData: {
              username: formData.username,
              email: formData.email || null,
              password: formData.password.trim() || undefined,
              role: formData.role,
              title: formData.title,
              first_name: formData.first_name,
              last_name: formData.last_name,
              employee_id: formData.employee_id || null,
              phone_number: formData.phone_number,
            },
          },
          headers: {
            'X-Internal-Function-Token': INTERNAL_USER_MANAGEMENT_TOKEN,
          },
        })
      } else {
        // Call Edge Function for create
        response = await supabase.functions.invoke('manage-users', {
          body: {
            action: 'create',
            userData: {
              username: formData.username,
              email: formData.email || null,
              password: formData.password,
              role: formData.role,
              title: formData.title,
              first_name: formData.first_name,
              last_name: formData.last_name,
              employee_id: formData.employee_id || null,
              phone_number: formData.phone_number,
            },
          },
          headers: {
            'X-Internal-Function-Token': INTERNAL_USER_MANAGEMENT_TOKEN,
          },
        })
      }

      if (response.error) {
        throw new Error(response.error.message || 'Edge function error')
      }
      if (!response.data.success) {
        throw new Error(response.data.error || 'User operation failed via Edge Function')
      }

      await fetchUsers()
      setShowModal(false)
      setEditingUser(null)
      setFormData({ 
        username: '', 
        email: '', 
        password: '', 
        role: 'Sales Rep',
        title: 'Mr',
        first_name: '',
        last_name: '',
        employee_id: '',
        phone_number: ''
      })
    } catch (error: any) {
      console.error('Error saving user:', error)
      setError(error.message || 'Failed to save user')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return

    try {
      if (!INTERNAL_USER_MANAGEMENT_TOKEN) {
        throw new Error("Internal user management token is not configured.")
      }

      // Call Edge Function for delete
      const response = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'delete',
          userId: id,
        },
        headers: {
          'X-Internal-Function-Token': INTERNAL_USER_MANAGEMENT_TOKEN,
        },
      })

      if (response.error) {
        throw new Error(response.error.message || 'Edge function error')
      }
      if (!response.data.success) {
        throw new Error(response.data.error || 'User deletion failed via Edge Function')
      }

      await fetchUsers()
    } catch (error: any) {
      console.error('Error deleting user:', error)
      setError(error.message || 'Failed to delete user')
    }
  }

  const handleEditUser = (userToEdit: User) => {
    setEditingUser(userToEdit)
    setFormData({
      username: userToEdit.username,
      email: userToEdit.email || '',
      password: '',
      role: userToEdit.role,
      title: userToEdit.title,
      first_name: userToEdit.first_name,
      last_name: userToEdit.last_name,
      employee_id: userToEdit.employee_id || '',
      phone_number: userToEdit.phone_number
    })
    setError('')
    setShowModal(true)
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'Super Admin': return <Shield className="w-5 h-5 text-purple-600" />
      case 'Admin': return <UserCheck className="w-5 h-5 text-blue-600" />
      case 'Sales Rep': return <User className="w-5 h-5 text-green-600" />
      case 'Security Guard': return <Eye className="w-5 h-5 text-orange-600" />
      default: return <User className="w-5 h-5 text-gray-600" />
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Super Admin': return 'bg-purple-100 text-purple-800'
      case 'Admin': return 'bg-blue-100 text-blue-800'
      case 'Sales Rep': return 'bg-green-100 text-green-800'
      case 'Security Guard': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.employee_id?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (user?.role !== 'Super Admin') {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">Only Super Admins can manage users.</p>
        </div>
      </div>
    )
  }

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading users...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <button
          onClick={() => {
            setShowModal(true)
            setEditingUser(null)
            setFormData({ 
              username: '', 
              email: '', 
              password: '', 
              role: 'Sales Rep',
              title: 'Mr',
              first_name: '',
              last_name: '',
              employee_id: '',
              phone_number: ''
            })
            setError('')
          }}
          className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add User
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search users by name, role, or employee ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Mobile Card Layout */}
        <div className="block md:hidden">
          <div className="space-y-2">
            {filteredUsers.map((u) => (
              <div key={u.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center flex-1 min-w-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                      {getRoleIcon(u.role)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {u.title} {u.first_name} {u.last_name}
                      </h3>
                      <div className="flex items-center mt-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getRoleColor(u.role)}`}>
                          {u.role}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-3">
                    <button
                      onClick={() => handleEditUser(u)}
                      className="p-2.5 text-blue-600 bg-blue-100 rounded-full hover:bg-blue-200 touch-manipulation"
                      title="Edit user"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    {u.id !== user?.id && (
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        className="p-2.5 text-red-600 bg-red-100 rounded-full hover:bg-red-200 touch-manipulation"
                        title="Delete user"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="space-y-1 text-xs ml-11">
                  <div className="flex items-start">
                    <span className="text-gray-500 font-medium w-16 flex-shrink-0">Username:</span>
                    <span className="text-gray-700 flex-1">{u.username}</span>
                  </div>
                  {u.email && (
                    <div className="flex items-start">
                      <span className="text-gray-500 font-medium w-16 flex-shrink-0">Email:</span>
                      <span className="text-gray-700 flex-1">{u.email}</span>
                    </div>
                  )}
                  {u.employee_id && (
                    <div className="flex items-start">
                      <span className="text-gray-500 font-medium w-16 flex-shrink-0">Emp ID:</span>
                      <span className="text-gray-700 flex-1">{u.employee_id}</span>
                    </div>
                  )}
                  <div className="flex items-start">
                    <span className="text-gray-500 font-medium w-16 flex-shrink-0">Phone:</span>
                    <span className="text-gray-700 flex-1">{u.phone_number}</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-gray-500 font-medium w-16 flex-shrink-0">Status:</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.first_login ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {u.first_login ? 'First Login' : 'Active'}
                    </span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-gray-500 font-medium w-16 flex-shrink-0">Created:</span>
                    <span className="text-gray-700 flex-1">{new Date(u.created_at).toLocaleDateString()}</span>
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
                    User Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact Info
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers.map((u, index) => (
                  <tr key={u.id} className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-gray-100`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getRoleIcon(u.role)}
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {u.title} {u.first_name} {u.last_name}
                          </div>
                          <div className="text-sm text-gray-500">@{u.username}</div>
                          {u.employee_id && (
                            <div className="text-xs text-gray-400">ID: {u.employee_id}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(u.role)}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        {u.email && <div className="text-gray-900">{u.email}</div>}
                        <div className="text-gray-500">{u.phone_number}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        u.first_login ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {u.first_login ? 'First Login' : 'Active'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditUser(u)}
                          className="p-2 text-blue-600 hover:text-blue-900 rounded-full hover:bg-blue-100"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {u.id !== user?.id && (
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-2 text-red-600 hover:text-red-900 rounded-full hover:bg-red-100"
                            title="Delete user"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              {editingUser ? 'Edit User' : 'Add New User'}
            </h2>
            
            <form onSubmit={handleSaveUser} className="space-y-4">
              {/* Title Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <select
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value as 'Mr' | 'Mrs' | 'Ms' | 'Dr' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                >
                  {titles.map((title) => (
                    <option key={title} value={title}>
                      {title}
                    </option>
                  ))}
                </select>
              </div>

              {/* First Name Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Last Name Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                />
                {!editingUser && (
                  <p className="text-xs text-gray-500 mt-1">
                    Username will be auto-generated from first and last name
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  disabled={!!editingUser}
                />
                {editingUser && (
                  <p className="text-xs text-gray-500 mt-1">Email cannot be changed after user creation</p>
                )}
              </div>

              {/* Employee ID Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee ID (Optional)
                </label>
                <input
                  type="text"
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>

              {/* Phone Number Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password {editingUser && '(leave blank to keep current)'}
                  {!editingUser && (
                    <span className="text-xs text-gray-500 ml-1">
                      (min 8 chars, letters, numbers, symbols)
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required={!editingUser}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingUser(null)
                    setFormData({ 
                      username: '', 
                      email: '', 
                      password: '', 
                      role: 'Sales Rep',
                      title: 'Mr',
                      first_name: '',
                      last_name: '',
                      employee_id: '',
                      phone_number: ''
                    })
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
                  {loading ? 'Saving...' : editingUser ? 'Update' : 'Add User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}