import React, { useState, useEffect } from 'react'
import { Plus, CreditCard as Edit, Trash2, Search, User, Phone, Mail, X, MapPin } from 'lucide-react'
import { supabase, Customer, ContactPerson, CustomerArea } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { STATIC_PAYMENT_CATEGORIES } from '../utils/staticPaymentCategories'; // New import

interface ContactPersonEntry {
  id: string
  name: string
  phone_number: string
}

interface FormErrors {
  name?: string
  phone_number?: string
  email?: string
  payment_category?: string
  tin_number?: string
  contact_persons?: string
  [key: string]: string | undefined
}

// Contact Details Modal Component
const CustomerContactDetailsModal: React.FC<{ 
  customer: Customer & { contact_persons: ContactPerson[] };
  onClose: () => void;
}> = ({ customer, onClose }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Contact Details for {customer.name}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="space-y-6">
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-800 mb-3">Primary Contact Info</h3>
          <div className="grid grid-cols-1 gap-y-2 text-base">
            {customer.email && (
              <div className="flex items-center">
                <Mail className="w-5 h-5 text-blue-600 mr-3" />
                <span className="font-medium text-blue-700">Email:</span>
                <span className="ml-2 text-blue-900 break-all">{customer.email}</span>
              </div>
            )}
            <div className="flex items-center">
              <Phone className="w-5 h-5 text-blue-600 mr-3" />
              <span className="font-medium text-blue-700">Phone:</span>
              <span className="ml-2 text-blue-900">{customer.phone_number}</span>
            </div>
          </div>
        </div>

        {customer.contact_persons.length > 0 && (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Additional Contact Persons</h3>
            <div className="space-y-3">
              {customer.contact_persons.map((contact, index) => (
                <div key={contact.id} className="p-3 bg-white rounded-lg shadow-sm border border-gray-100">
                  <p className="font-medium text-gray-900 text-base mb-1">{contact.name}</p>
                  <div className="flex items-center text-sm">
                    <Phone className="w-4 h-4 text-gray-500 mr-2" />
                    <span className="text-gray-700">{contact.phone_number}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 text-right border-t pt-6">
        <button onClick={onClose} className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-lg font-semibold">
          Close
        </button>
      </div>
    </div>
  </div>
);

export const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [contactPersons, setContactPersons] = useState<ContactPerson[]>([])
  const [loading, setLoading] = useState(true)
  const { isOnline } = useAuth()
  const [showModal, setShowModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  // Remove: availablePaymentCategories state
  const [availableCustomerAreas, setAvailableCustomerAreas] = useState<CustomerArea[]>([])
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone_number: '',
    email: '',
    payment_category: '' as string,
    vat_status: 'Non-VAT' as 'VAT' | 'Non-VAT',
    tin_number: '',
    customer_area_id: null as string | null
  })
  const [contactPersonsData, setContactPersonsData] = useState<ContactPersonEntry[]>([
    { id: 'temp-1', name: '', phone_number: '' }
  ])
  const [isCustomersFromCache, setIsCustomersFromCache] = useState(false)
  const [isContactPersonsFromCache, setIsContactPersonsFromCache] = useState(false)
  const [isCustomerAreasFromCache, setIsCustomerAreasFromCache] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [showContactDetailsModal, setShowContactDetailsModal] = useState(false)
  const [selectedCustomerForContactDetails, setSelectedCustomerForContactDetails] = useState<(Customer & { contact_persons: ContactPerson[] }) | null>(null)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [customerAreaSearchTerm, setCustomerAreaSearchTerm] = useState('');
  const [filteredCustomerAreas, setFilteredCustomerAreas] = useState<CustomerArea[]>([]);
  const [showCustomerAreaSuggestions, setShowCustomerAreaSuggestions] = useState(false);

  useEffect(() => {
    fetchCustomers()
    fetchContactPersons()
    // Remove: fetchPaymentCategories()
    fetchCustomerAreas()
  }, [])

  // Remove: fetchPaymentCategories function

  const fetchCustomerAreas = async () => {
    setIsCustomerAreasFromCache(false)
    const cacheKey = 'customer_areas_data_customers_component'

    if (!isOnline) {
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        setAvailableCustomerAreas(JSON.parse(cachedData))
        setIsCustomerAreasFromCache(true)
        return
      }
    }

    try {
      console.log('Fetching customer areas for dropdown...')
      const { data, error } = await supabase
        .from('customer_areas')
        .select('id, area_name')
        .order('area_name')

      if (error) throw error
      
      console.log('Customer areas fetched for dropdown:', data)
      localStorage.setItem(cacheKey, JSON.stringify(data))
      setAvailableCustomerAreas(data || [])
    } catch (error) {
      console.error('Error fetching customer areas for dropdown:', error)
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        setAvailableCustomerAreas(JSON.parse(cachedData))
        setIsCustomerAreasFromCache(true)
      } else {
        setAvailableCustomerAreas([])
      }
    }
  }

  const fetchCustomers = async () => {
    setFetchError(null)
    setIsCustomersFromCache(false)
    const cacheKey = 'customers_data'

    if (!isOnline) {
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        setCustomers(JSON.parse(cachedData))
        setIsCustomersFromCache(true)
        setLoading(false)
        return
      }
    }

    try {
      console.log('Fetching customers...')
      const { data, error } = await supabase
        .from('customers')
        .select(`
          id, name, address, phone_number, email, customer_display_id, payment_category, vat_status, tin_number,
          customer_area_id, customer_areas(area_name)
        `)
        .order('name')

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }
      
      console.log('Customers fetched:', data)
      localStorage.setItem(cacheKey, JSON.stringify(data))
      setCustomers(data || [])
    } catch (error) {
      console.error('Error fetching customers:', error)
      setFetchError('Failed to load customers. Please check your database connection.')
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        setCustomers(JSON.parse(cachedData))
        setIsCustomersFromCache(true)
      } else {
        setCustomers([])
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchContactPersons = async () => {
    setIsContactPersonsFromCache(false)
    const cacheKey = 'contact_persons_data'

    if (!isOnline) {
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        setContactPersons(JSON.parse(cachedData))
        setIsContactPersonsFromCache(true)
        return
      }
    }

    try {
      console.log('Fetching contact persons...')
      const { data, error } = await supabase
        .from('contact_persons')
        .select('id, customer_id, name, phone_number')
        .order('name')

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }
      
      console.log('Contact persons fetched:', data)
      localStorage.setItem(cacheKey, JSON.stringify(data))
      setContactPersons(data || [])
    } catch (error) {
      console.error('Error fetching contact persons:', error)
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        setContactPersons(JSON.parse(cachedData))
        setIsContactPersonsFromCache(true)
      } else {
        setContactPersons([])
      }
    }
  }

  const addContactPerson = () => {
    const newId = `temp-${Date.now()}`
    setContactPersonsData([...contactPersonsData, { id: newId, name: '', phone_number: '' }])
  }

  const removeContactPerson = (id: string) => {
    if (contactPersonsData.length > 1) {
      setContactPersonsData(contactPersonsData.filter(cp => cp.id !== id))
    }
  }

  const updateContactPerson = (id: string, field: 'name' | 'phone_number', value: string) => {
    setContactPersonsData(contactPersonsData.map(cp => 
      cp.id === id ? { ...cp, [field]: value } : cp
    ))
  }

  const handleCustomerAreaSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomerAreaSearchTerm(value);
    if (value.length > 0) {
      setFilteredCustomerAreas(
        availableCustomerAreas.filter(area =>
          area.area_name.toLowerCase().includes(value.toLowerCase())
        )
      );
      setShowCustomerAreaSuggestions(true);
    } else {
      setFilteredCustomerAreas([]);
      setShowCustomerAreaSuggestions(false);
      setFormData(prev => ({ ...prev, customer_area_id: null })); // Clear ID if search term is empty
    }
  };

  const handleSelectCustomerArea = (area: CustomerArea) => {
    setCustomerAreaSearchTerm(area.area_name);
    setFormData(prev => ({ ...prev, customer_area_id: area.id }));
    setShowCustomerAreaSuggestions(false);
    setFilteredCustomerAreas([]); // Clear suggestions after selection
  };

  const handleClearCustomerArea = () => {
    setCustomerAreaSearchTerm('');
    setFormData(prev => ({ ...prev, customer_area_id: null }));
    setFilteredCustomerAreas([]);
    setShowCustomerAreaSuggestions(false);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    const newErrors: FormErrors = {}

    try {
      if (!/^[a-zA-Z\s]+$/.test(formData.name.trim())) {
        newErrors.name = 'Company Name must contain only alphabetic characters and spaces.'
      }

      if (!/^\d{10}$/.test(formData.phone_number.trim())) {
        newErrors.phone_number = 'Main Phone Number must be exactly 10 digits.'
      }

      if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Please enter a valid email address.'
      }

      if (!formData.payment_category) {
        newErrors.payment_category = 'Payment Category is required'
      }

      const validContactPersons = contactPersonsData.filter(cp => cp.name.trim() && cp.phone_number.trim())
      if (validContactPersons.length === 0) {
        newErrors.contact_persons = 'At least one contact person is required'
      }

      for (const cp of validContactPersons) {
        if (!/^\d{10}$/.test(cp.phone_number.trim())) {
          newErrors[`contact_phone_${cp.id}`] = `Contact Person "${cp.name}" Phone Number must be exactly 10 digits.`
        }
      }

      if (formData.vat_status === 'VAT' && !formData.tin_number.trim()) {
        newErrors.tin_number = 'TIN number is required for VAT customers'
      }

      if (Object.keys(newErrors).length > 0) {
        setFormErrors(newErrors)
        setLoading(false)
        return
      }

      const customerData = {
        name: formData.name,
        address: formData.address,
        phone_number: formData.phone_number,
        email: formData.email,
        payment_category: formData.payment_category,
        vat_status: formData.vat_status,
        tin_number: formData.vat_status === 'VAT' ? formData.tin_number : null,
        customer_area_id: formData.customer_area_id
      }

      if (editingCustomer) {
        const { error } = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', editingCustomer.id)

        if (error) throw error

        await supabase
          .from('contact_persons')
          .delete()
          .eq('customer_id', editingCustomer.id)

        if (validContactPersons.length > 0) {
          const contactPersonsToInsert = validContactPersons.map(cp => ({
            customer_id: editingCustomer.id,
            name: cp.name,
            phone_number: cp.phone_number
          }))

          await supabase
            .from('contact_persons')
            .insert(contactPersonsToInsert)
        }
      } else {
        const { data: newCustomerData, error } = await supabase
          .from('customers')
          .insert([customerData])
          .select()
          .single()

        if (error) throw error

        if (validContactPersons.length > 0) {
          const contactPersonsToInsert = validContactPersons.map(cp => ({
            customer_id: newCustomerData.id,
            name: cp.name,
            phone_number: cp.phone_number
          }))

          await supabase
            .from('contact_persons')
            .insert(contactPersonsToInsert)
        }
      }

      setFormErrors({})
      
      await fetchCustomers()
      await fetchContactPersons()
      setShowModal(false)
      setEditingCustomer(null)
      setFormData({ 
        name: '', 
        address: '', 
        phone_number: '', 
        email: '',
        payment_category: '',
        vat_status: 'Non-VAT',
        tin_number: '',
        customer_area_id: null
      })
      setContactPersonsData([{ id: 'temp-1', name: '', phone_number: '' }])
      setCustomerAreaSearchTerm('');
      setFilteredCustomerAreas([]);
      setShowCustomerAreaSuggestions(false);
    } catch (error) {
      console.error('Error saving customer:', error)
      if (error && typeof error === 'object' && 'message' in error) {
        alert(`Failed to save customer: ${error.message}`)
      } else {
        alert('Failed to save customer. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm('Are you sure you want to delete this customer?')) return

    try {
      await supabase
        .from('contact_persons')
        .delete()
        .eq('customer_id', id)

      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id)

      if (error) throw error
      await fetchCustomers()
      await fetchContactPersons()
    } catch (error) {
      console.error('Error deleting customer:', error)
      alert('Cannot delete customer. It may be in use by existing orders.')
    }
  }

  const handleEditCustomer = async (customer: Customer) => {
    setEditingCustomer(customer)
    setFormData({
      name: customer.name,
      address: customer.address,
      phone_number: customer.phone_number,
      email: customer.email || '',
      payment_category: customer.payment_category,
      vat_status: customer.vat_status,
      tin_number: customer.tin_number || '',
      customer_area_id: customer.customer_area_id
    })

    // Set the search term for the type-ahead
    if (customer.customer_area_id && customer.customer_areas?.area_name) {
      setCustomerAreaSearchTerm(customer.customer_areas.area_name);
    } else {
      setCustomerAreaSearchTerm('');
    }

    setFormErrors({})

    try {
      const { data: customerContactPersons, error } = await supabase
        .from('contact_persons')
        .select('id, name, phone_number')
        .eq('customer_id', customer.id)
        .order('name')

      if (error) throw error

      if (customerContactPersons && customerContactPersons.length > 0) {
        setContactPersonsData(customerContactPersons.map(cp => ({
          id: cp.id,
          name: cp.name,
          phone_number: cp.phone_number
        })))
      } else {
        setContactPersonsData([{ id: 'temp-1', name: '', phone_number: '' }])
      }
    } catch (error) {
      console.error('Error fetching contact persons:', error)
      setContactPersonsData([{ id: 'temp-1', name: '', phone_number: '' }])
    }

    setShowModal(true)
  }

  const getCustomerContactPersons = (customerId: string) => {
    return contactPersons.filter(cp => cp.customer_id === customerId)
  }

  const handleViewContactDetails = (customer: Customer) => {
    const customerWithContacts = {
      ...customer,
      contact_persons: getCustomerContactPersons(customer.id)
    }
    setSelectedCustomerForContactDetails(customerWithContacts)
    setShowContactDetailsModal(true)
  }

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.customer_display_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    customer.payment_category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.vat_status.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (customer.tin_number && customer.tin_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (customer.customer_areas?.area_name && customer.customer_areas.area_name.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  if (loading && customers.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading customers...</div>
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
        <h1 className="text-2xl font-bold text-gray-900">Customer Management</h1>
        <button
          onClick={() => {
            setShowModal(true)
            setEditingCustomer(null)
            setFormData({
              name: '',
              address: '',
              phone_number: '',
              email: '',
              payment_category: '',
              vat_status: 'Non-VAT',
              tin_number: '',
              customer_area_id: null
            })
            setContactPersonsData([{ id: 'temp-1', name: '', phone_number: '' }])
            setFormErrors({})
            setCustomerAreaSearchTerm('');
            setFilteredCustomerAreas([]);
            setShowCustomerAreaSuggestions(false);
          }}
          className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Customer
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search customers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />
      </div>

      {isCustomersFromCache && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center">
            <span className="text-yellow-800 text-sm">
              Data may be outdated (from cache)
            </span>
          </div>
        </div>
      )}

      {/* Customers Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Mobile Card Layout */}
        <div className="block md:hidden">
          <div className="space-y-2">
            {filteredCustomers.map((customer) => (
              <div key={customer.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center flex-1 min-w-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                      <User className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {customer.name}
                      </h3>
                      <div className="flex items-center mt-1 space-x-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800`}>
                          {customer.payment_category}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          customer.vat_status === 'VAT'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {customer.vat_status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-3">
                    <button
                      onClick={() => handleViewContactDetails(customer)}
                      className="p-2.5 text-purple-600 bg-purple-100 rounded-full hover:bg-purple-200 touch-manipulation"
                      title="View Contact Info"
                    >
                      <Phone className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleEditCustomer(customer)}
                      className="p-2.5 text-blue-600 bg-blue-100 rounded-full hover:bg-blue-200 touch-manipulation"
                      title="Edit customer"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteCustomer(customer.id)}
                      className="p-2.5 text-red-600 bg-red-100 rounded-full hover:bg-red-200 touch-manipulation"
                      title="Delete customer"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-1 text-xs ml-11">
                  <div className="flex items-start">
                    <span className="text-gray-500 font-medium w-16 flex-shrink-0">Company:</span>
                    <span className="text-gray-700 flex-1">{customer.address}</span>
                  </div>
                  {customer.tin_number && (
                    <div className="flex items-start">
                      <span className="text-gray-500 font-medium w-16 flex-shrink-0">TIN:</span>
                      <span className="text-gray-700 flex-1">{customer.tin_number}</span>
                    </div>
                  )}
                  {customer.customer_areas?.area_name && (
                    <div className="flex items-start">
                      <span className="text-gray-500 font-medium w-16 flex-shrink-0">Area:</span>
                      <span className="text-gray-700 flex-1">{customer.customer_areas.area_name}</span>
                    </div>
                  )}
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
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    VAT Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    TIN Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer Area
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredCustomers.map((customer, index) => (
                  <tr key={customer.id} className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-gray-100`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="w-8 h-8 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {customer.customer_display_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {customer.address}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800`}>
                        {customer.payment_category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        customer.vat_status === 'VAT'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {customer.vat_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {customer.tin_number || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {customer.customer_areas?.area_name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleViewContactDetails(customer)}
                          className="p-2 text-purple-600 hover:text-purple-900 rounded-full hover:bg-purple-100"
                          title="View Contact Info"
                        >
                          <Phone className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEditCustomer(customer)}
                          className="p-2 text-blue-600 hover:text-blue-900 rounded-full hover:bg-blue-100"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCustomer(customer.id)}
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

      {/* Add/Edit Customer Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
            </h2>
            
            <form onSubmit={handleSaveCustomer} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Column 1 Fields */}
                <div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent ${
                        formErrors.name ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter company name"
                      required
                    />
                    {formErrors.name && (
                      <div className="mt-1 text-sm text-red-600">{formErrors.name}</div>
                    )}
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent ${
                        formErrors.email ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter company email"
                    />
                    {formErrors.email && (
                      <div className="mt-1 text-sm text-red-600">{formErrors.email}</div>
                    )}
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Category
                    </label>
                    <select
                      value={formData.payment_category}
                      onChange={(e) => setFormData({ ...formData, payment_category: e.target.value })}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent ${
                        formErrors.payment_category ? 'border-red-500' : 'border-gray-300'
                      }`}
                      required
                    >
                      <option value="">Select Payment Category</option>
                      {STATIC_PAYMENT_CATEGORIES.map(category => ( // Use STATIC_PAYMENT_CATEGORIES
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                    {formErrors.payment_category && (
                      <div className="mt-1 text-sm text-red-600">{formErrors.payment_category}</div>
                    )}
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      VAT Status
                    </label>
                    <div className="flex space-x-4">
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          value="VAT"
                          checked={formData.vat_status === 'VAT'}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            vat_status: e.target.value as 'VAT' | 'Non-VAT'
                          })}
                          className="text-red-600 focus:ring-red-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">VAT</span>
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          value="Non-VAT"
                          checked={formData.vat_status === 'Non-VAT'}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            vat_status: e.target.value as 'VAT' | 'Non-VAT',
                            tin_number: e.target.value === 'Non-VAT' ? '' : formData.tin_number
                          })}
                          className="text-red-600 focus:ring-red-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">Non-VAT</span>
                      </label>
                    </div>
                  </div>

                  {formData.vat_status === 'VAT' && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        TIN Number
                      </label>
                      <input
                        type="text"
                        value={formData.tin_number}
                        onChange={(e) => setFormData({ ...formData, tin_number: e.target.value })}
                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent ${
                          formErrors.tin_number ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="Enter TIN number"
                        required={formData.vat_status === 'VAT'}
                      />
                      {formErrors.tin_number && (
                        <div className="mt-1 text-sm text-red-600">{formErrors.tin_number}</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Column 2 Fields */}
                <div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company Address
                    </label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      placeholder="Enter company address"
                      required
                    />
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Main Phone Number
                    </label>
                    <input
                      type="tel"
                      value={formData.phone_number}
                      onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent ${
                        formErrors.phone_number ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter main phone number"
                      required
                    />
                    {formErrors.phone_number && (
                      <div className="mt-1 text-sm text-red-600">{formErrors.phone_number}</div>
                    )}
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Customer Area (Optional)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={customerAreaSearchTerm}
                        onChange={handleCustomerAreaSearchChange}
                        onFocus={() => setShowCustomerAreaSuggestions(true)}
                        // Use onMouseDown on suggestions to prevent onBlur from closing before click
                        onBlur={() => setTimeout(() => setShowCustomerAreaSuggestions(false), 100)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        placeholder="Search or select customer area"
                      />
                      {customerAreaSearchTerm && (
                        <button
                          type="button"
                          onClick={handleClearCustomerArea}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          title="Clear selected area"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      {showCustomerAreaSuggestions && filteredCustomerAreas.length > 0 && (
                        <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
                          {filteredCustomerAreas.map(area => (
                            <li
                              key={area.id}
                              onMouseDown={() => handleSelectCustomerArea(area)} // Use onMouseDown
                              className="px-4 py-2 cursor-pointer hover:bg-gray-100 text-gray-800"
                            >
                              {area.area_name}
                            </li>
                          ))}
                        </ul>
                      )}
                      {showCustomerAreaSuggestions && customerAreaSearchTerm.length > 0 && filteredCustomerAreas.length === 0 && (
                        <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg shadow-lg mt-1 px-4 py-2 text-gray-500">
                          No matching areas found.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Persons Section */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Contact Persons
                  </label>
                  <button
                    type="button"
                    onClick={addContactPerson}
                    className="px-2 py-1 text-sm text-blue-600 hover:text-blue-800 font-medium rounded-md hover:bg-blue-50"
                  >
                    + Add Another Contact
                  </button>
                </div>
                {formErrors.contact_persons && (
                  <div className="mb-3 text-sm text-red-600">{formErrors.contact_persons}</div>
                )}
                <div className="space-y-3">
                  {contactPersonsData.map((contact, index) => (
                    <div key={contact.id} className="p-3 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Contact {index + 1}</span>
                        {contactPersonsData.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeContactPerson(contact.id)}
                            className="px-2 py-1 text-sm text-red-600 hover:text-red-800 rounded-md hover:bg-red-50"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Contact Person's Name
                          </label>
                          <input
                            type="text"
                            value={contact.name}
                            onChange={(e) => updateContactPerson(contact.id, 'name', e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            placeholder="Enter contact person's name"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Contact Person's Phone
                          </label>
                          <input
                            type="tel"
                            value={contact.phone_number}
                            onChange={(e) => updateContactPerson(contact.id, 'phone_number', e.target.value)}
                            className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent ${
                              formErrors[`contact_phone_${contact.id}`] ? 'border-red-500' : 'border-gray-300'
                            }`}
                            placeholder="Enter contact person's phone"
                            required
                          />
                          {formErrors[`contact_phone_${contact.id}`] && (
                            <div className="mt-1 text-sm text-red-600">{formErrors[`contact_phone_${contact.id}`]}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingCustomer(null)
                    setFormData({ 
                      name: '', 
                      address: '', 
                      phone_number: '', 
                      email: '',
                      payment_category: '',
                      vat_status: 'Non-VAT',
                      tin_number: '',
                      customer_area_id: null
                    })
                    setContactPersonsData([{ id: 'temp-1', name: '', phone_number: '' }])
                    setFormErrors({})
                    setCustomerAreaSearchTerm('');
                    setFilteredCustomerAreas([]);
                    setShowCustomerAreaSuggestions(false);
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
                  {loading ? 'Saving...' : editingCustomer ? 'Update Company' : 'Add Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contact Details Modal */}
      {showContactDetailsModal && selectedCustomerForContactDetails && (
        <CustomerContactDetailsModal
          customer={selectedCustomerForContactDetails}
          onClose={() => setShowContactDetailsModal(false)}
        />
      )}
    </div>
  )
}