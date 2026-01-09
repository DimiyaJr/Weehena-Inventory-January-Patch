import React, { useState, useEffect } from 'react'
import { ArrowRight, ShoppingCart, Receipt, Check, Search, Package, Edit, X, Download } from 'lucide-react' // Added Download icon
import { supabase, Customer, Product, User, Vehicle } from '../lib/supabase' // User is already imported
import { useAuth } from '../hooks/useAuth'
import { formatCurrency } from '../utils/formatters'
import { LoadingBayPDFLayout } from './LoadingBayPDFLayout' // Import the new layout component
import { createRoot } from 'react-dom/client' // Import createRoot for rendering
import html2pdf from 'html2pdf.js' // Import the library

// Define WEIGHT_UNIT locally since the utils/units file doesn't exist
const WEIGHT_UNIT = 'kg' // You can change this to 'lb' or other unit as needed

interface CartItem {
  product: Product
  quantity: number
  selectedPrice: number
  isCustomPrice: boolean
}

interface ServiceCustomerOrder {
  id: string;
  order_display_id: string;
  created_at: string;
  delivery_date: string | null;
  vehicle_number: string | null;
  customers: {
    name: string;
    address: string;
    phone_number: string;
    email?: string;
  };
  assigned_user: {
    username: string;
  };
  order_items: Array<{
    id: string;
    quantity: number;
    actual_quantity_after_security_check?: number | null;
    products: {
      name: string;
      unit_type: string;
    };
  }>;
  status: string;
  security_check_status?: string;
  security_check_notes?: string;
  purchase_order_id?: string;
  total_amount?: number;
  vat_amount?: number;
  is_vat_applicable?: boolean;
}

export const ServiceCustomer: React.FC = () => {
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(false)
  const [salesReps, setSalesReps] = useState<User[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [selectedSalesRepId, setSelectedSalesRepId] = useState<string>('') // Changed from selectedSalesRep to selectedSalesRepId
  const [vehicleInputText, setVehicleInputText] = useState('')
  const [selectedVehicleObject, setSelectedVehicleObject] = useState<Vehicle | null>(null)
  const [filteredVehicleSuggestions, setFilteredVehicleSuggestions] = useState<Vehicle[]>([])
  const [showVehicleSuggestions, setShowVehicleSuggestions] = useState(false)
  const [productSearchTerm, setProductSearchTerm] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [requestId, setRequestId] = useState('')
  const [isCustomersFromCache, setIsCustomersFromCache] = useState(false)
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0])
  const [isProductsFromCache, setIsProductsFromCache] = useState(false)
  const [isSalesRepsFromCache, setIsSalesRepsFromCache] = useState(false)
  const [isVehiclesFromCache, setIsVehiclesFromCache] = useState(false)
  const [vatRate, setVatRate] = useState(0.18)
  const [editingPriceProductId, setEditingPriceProductId] = useState<string | null>(null)
  const [editingPriceInputValue, setEditingPriceInputValue] = useState<string>('')
  const [currentOrder, setCurrentOrder] = useState<ServiceCustomerOrder | null>(null) // Added state for current order

  useEffect(() => {
    fetchCustomers()
    fetchProducts()
    fetchSalesReps()
    fetchVehicles()
    fetchVatRate()
  }, [])

  const fetchVatRate = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('vat_rate')
        .single();

      if (error) throw error;
      setVatRate(data.vat_rate);
    } catch (err) {
      console.error('Error fetching VAT rate, using default:', err);
      setVatRate(0.18);
    }
  };

  const fetchCustomers = async () => {
    try {
      setIsCustomersFromCache(false)
      const cacheKey = 'service_customers_data'
      
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name')

      if (error) throw error

      localStorage.setItem(cacheKey, JSON.stringify(data))
      setCustomers(data || [])
    } catch (error) {
      console.error('Error fetching customers:', error)
      const cacheKey = 'service_customers_data'
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        setCustomers(JSON.parse(cachedData))
        setIsCustomersFromCache(true)
      } else {
        setCustomers([])
      }
    }
  }

  const fetchProducts = async () => {
    try {
      setIsProductsFromCache(false)
      const cacheKey = 'service_products_data'
      
      const { data, error } = await supabase
        .from('products')
        .select(`
          id, name, quantity, sku,
          price_cash,
          price_credit,
          price_dealer_cash,
          price_dealer_credit,
          price_hotel_non_vat,
          price_hotel_vat,
          categories(category_name)
        `)
        .gt('quantity', 0)
        .order('name')

      if (error) throw error

      localStorage.setItem(cacheKey, JSON.stringify(data))
      setProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
      const cacheKey = 'service_products_data'
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        setProducts(JSON.parse(cachedData))
        setIsProductsFromCache(true)
      } else {
        setProducts([])
      }
    }
  }

  const fetchSalesReps = async () => {
    try {
      setIsSalesRepsFromCache(false)
      const cacheKey = 'service_sales_reps_data'
      
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, username') // Added first_name and last_name
        .eq('role', 'Sales Rep')
        .order('first_name') // Changed from username to first_name

      if (error) throw error

      localStorage.setItem(cacheKey, JSON.stringify(data))
      setSalesReps(data || [])
    } catch (error) {
      console.error('Error fetching sales reps:', error)
      const cacheKey = 'service_sales_reps_data'
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        setSalesReps(JSON.parse(cachedData))
        setIsSalesRepsFromCache(true)
      } else {
        setSalesReps([])
      }
    }
  }

  const fetchVehicles = async () => {
    try {
      setIsVehiclesFromCache(false)
      const cacheKey = 'service_vehicles_data'
      
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, vehicle_number, vehicle_type, status, sales_rep_id, sales_rep:users!fk_sales_rep(username)')
        .eq('status', 'Available')
        .order('vehicle_number')

      if (error) throw error

      localStorage.setItem(cacheKey, JSON.stringify(data))
      setVehicles(data || [])
    } catch (error) {
      console.error('Error fetching vehicles:', error)
      const cacheKey = 'service_vehicles_data'
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        setVehicles(JSON.parse(cachedData))
        setIsVehiclesFromCache(true)
      } else {
        setVehicles([])
      }
    }
  }

  const getCalculatedPrice = (product: Product, customerPaymentCategory: string): number => {
    if (!product || !customerPaymentCategory) return 0;
    
    switch (customerPaymentCategory) {
      case 'Cash':
        return product.price_cash || 0;
      case 'Credit':
        return product.price_credit || 0;
      case 'Dealer Cash':
        return product.price_dealer_cash || 0;
      case 'Dealer Credit':
        return product.price_dealer_credit || 0;
      case 'Hotel Non-VAT':
        return product.price_hotel_non_vat || 0;
      case 'Hotel VAT':
        return product.price_hotel_vat || 0;
      default:
        console.warn(`Unknown payment category: ${customerPaymentCategory}. Falling back to cash price.`);
        return product.price_cash || 0;
    }
  };

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer)
    setStep(2)
  }

  const handleAddToCart = (product: Product) => {
    if (!selectedCustomer) {
      alert('Please select a customer first.');
      return;
    }

    const existingItem = cart.find(item => item.product.id === product.id);
    const priceForCustomer = getCalculatedPrice(product, selectedCustomer.payment_category);

    if (existingItem) {
      // Limit to 2 decimal places for gram precision (e.g., 266.70 kg)
      const newQuantity = Math.round((existingItem.quantity + 1) * 100) / 100;
      
      if (newQuantity <= product.quantity) {
        setCart(cart.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: newQuantity }
            : item
        ));
      } else {
        alert('Not enough stock available');
      }
    } else {
      setCart([...cart, { 
        product, 
        quantity: 0,    // <-- Changed to 0
        selectedPrice: priceForCustomer,
        isCustomPrice: false
      }]);
    }
  }

  const handleQuantityChange = (productId: string, newQuantity: number) => {
    const product = products.find(p => p.id === productId)
    if (!product) return

    // Limit to 2 decimal places for gram precision (e.g., 266.70 kg)
    const roundedQuantity = Math.round(newQuantity * 100) / 100

    if (roundedQuantity < 0) {
      alert('Quantity cannot be negative');
      return;
    }
    
    if (roundedQuantity > 0 && roundedQuantity > product.quantity) {
      alert('Not enough stock available')
      return;
    }
    
    setCart(cart.map(item =>
      item.product.id === productId
        ? { ...item, quantity: roundedQuantity }
        : item
    ))
  }

  // Add New Function to Handle Explicit Product Removal
  const handleRemoveFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId))
  }

  const handlePriceChange = (productId: string, newPrice: number) => {
    setCart(cart.map(item =>
      item.product.id === productId
        ? { 
            ...item, 
            selectedPrice: newPrice,
            isCustomPrice: true
          }
        : item
    ));
  }

  const startEditingPrice = (productId: string) => {
    const cartItem = cart.find(item => item.product.id === productId);
    if (cartItem) {
      setEditingPriceProductId(productId);
      setEditingPriceInputValue(cartItem.selectedPrice.toString());
    }
  };

  const savePrice = (productId: string) => {
    const newPrice = parseFloat(editingPriceInputValue) || 0;
    if (newPrice < 0) {
      alert('Price cannot be negative');
      return;
    }
    handlePriceChange(productId, newPrice);
    setEditingPriceProductId(null);
    setEditingPriceInputValue('');
  };

  const cancelEditingPrice = () => {
    setEditingPriceProductId(null);
    setEditingPriceInputValue('');
  };

  useEffect(() => {
    if (selectedSalesRepId) {
      const assignedVehicle = vehicles.find(v => v.sales_rep_id === selectedSalesRepId);
      if (assignedVehicle) {
        setVehicleInputText(assignedVehicle.vehicle_number);
        setSelectedVehicleObject(assignedVehicle);
      }
    } else {
      setVehicleInputText('');
      setSelectedVehicleObject(null);
    }
  }, [selectedSalesRepId, vehicles]);

  useEffect(() => {
    if (vehicleInputText.trim()) {
      const lowerCaseInput = vehicleInputText.toLowerCase();
      const suggestions = vehicles.filter(v =>
        v.vehicle_number.toLowerCase().includes(lowerCaseInput) ||
        v.vehicle_type.toLowerCase().includes(lowerCaseInput)
      );
      setFilteredVehicleSuggestions(suggestions);

      const matchedVehicle = vehicles.find(v => v.vehicle_number === vehicleInputText);
      setSelectedVehicleObject(matchedVehicle || null);
    } else {
      setFilteredVehicleSuggestions([]);
      setSelectedVehicleObject(null);
    }
  }, [vehicleInputText, vehicles]);

  useEffect(() => {
    if (selectedVehicleObject && selectedVehicleObject.sales_rep_id && selectedVehicleObject.sales_rep_id !== selectedSalesRepId) {
      setSelectedSalesRepId(selectedVehicleObject.sales_rep_id);
    }
  }, [selectedVehicleObject, selectedSalesRepId]);

  const getSubtotal = () => {
    return cart.reduce((total, item) => total + (item.selectedPrice * item.quantity), 0);
  }

  const getVatAmount = () => {
    const subtotal = getSubtotal();
    if (selectedCustomer?.vat_status === 'VAT') {
      return subtotal * vatRate;
    }
    return 0;
  }

  const getTotalAmount = () => {
    return getSubtotal() + getVatAmount();
  }

  // Implement handleExportPDF function
  const handleExportPDF = async (orderToExport: ServiceCustomerOrder) => {
    // Create a temporary div to render the component into
    const printElement = document.createElement('div');
    document.body.appendChild(printElement);

    // Use createRoot to render the React component into the temporary div
    const root = createRoot(printElement);
    root.render(<LoadingBayPDFLayout order={orderToExport} />);

    // Wait for the component to render (a small delay might be necessary for complex layouts)
    await new Promise(resolve => setTimeout(resolve, 100));

    // Configure html2pdf options
    const pdfOptions = {
      margin: 10,
      filename: `LoadingBayOrder_${orderToExport.order_display_id}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, logging: true, dpi: 192, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    };

    // Generate the PDF
    html2pdf().from(printElement).set(pdfOptions).save();

    // Clean up the temporary div after a short delay
    setTimeout(() => {
      root.unmount(); // Unmount the React component
      document.body.removeChild(printElement);
    }, 1000); // Give some time for PDF generation to start
  };

  const handleFinalizeOrder = async () => {
    if (!selectedCustomer || !user || cart.length === 0) {
      alert('Please select a customer and add products')
      return
    }

    // Check if all items have quantity > 0
    const itemsWithoutQuantity = cart.filter(item => item.quantity === 0);
    if (itemsWithoutQuantity.length > 0) {
      alert('Please enter quantities for all products in cart. Remove products you don\'t need using the delete button.');
      return;
    }

    if (!selectedSalesRepId) {
      alert('Please select a sales representative');
      return;
    }

    setLoading(true)
    try {
      try {
        const { error: testError } = await supabase
          .from('orders')
          .select('count')
          .limit(1)
          .single()

        if (testError && testError.code !== 'PGRST116') {
          throw new Error(`Database connection failed: ${testError.message}`)
        }
      } catch (connectionError) {
        if (connectionError instanceof TypeError && connectionError.message.includes('Failed to fetch')) {
          throw new Error('Cannot connect to database. Please check your internet connection and try again.')
        }
        throw connectionError
      }

      const finalVehicleNumber = vehicleInputText.trim() || null;

      const subtotal = getSubtotal();
      const vatAmount = getVatAmount();
      const finalTotalAmount = getTotalAmount();
      const isVatApplicable = selectedCustomer?.vat_status === 'VAT';

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{
          customer_id: selectedCustomer.id,
          status: 'Assigned',
          purchase_order_id: requestId.trim() || null,
          created_by: user.id,
          assigned_to: selectedSalesRepId, // Use selectedSalesRepId here
          vehicle_number: finalVehicleNumber,
          delivery_date: deliveryDate,
          total_amount: finalTotalAmount,
          vat_amount: vatAmount,
          is_vat_applicable: isVatApplicable,
        }])
        .select()
        .single()

      if (orderError) {
        console.error('Order creation error:', orderError)
        if (orderError.message.includes('row-level security policy')) {
          throw new Error('Permission denied. Please ensure you have the necessary permissions to create orders.')
        }
        throw orderError
      }

      const orderItems = cart.map(item => ({
        order_id: order.id,
        item_id: item.product.id,
        quantity: item.quantity,
        price: item.selectedPrice,
        discount: 0
      }))

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems)

      if (itemsError) throw itemsError

      for (const item of cart) {
        const { error: updateError } = await supabase
          .from('products')
          .update({ quantity: Math.floor(item.product.quantity - item.quantity) })
          .eq('id', item.product.id)

        if (updateError) throw updateError
      }

      // After successful order creation, set the currentOrder state
      const createdOrder: ServiceCustomerOrder = {
        id: order.id,
        order_display_id: order.order_display_id || order.id,
        created_at: order.created_at,
        delivery_date: order.delivery_date,
        vehicle_number: order.vehicle_number,
        customers: {
          name: selectedCustomer.name,
          address: selectedCustomer.address,
          phone_number: selectedCustomer.phone_number,
          email: selectedCustomer.email || undefined
        },
        assigned_user: {
          username: salesReps.find(rep => rep.id === selectedSalesRepId)?.username || ''
        },
        order_items: cart.map(item => ({
          id: item.product.id,
          quantity: item.quantity,
          products: {
            name: item.product.name,
            unit_type: WEIGHT_UNIT
          }
        })),
        status: order.status,
        purchase_order_id: order.purchase_order_id,
        total_amount: order.total_amount,
        vat_amount: order.vat_amount,
        is_vat_applicable: order.is_vat_applicable
      };

      setCurrentOrder(createdOrder);

      alert('Order created successfully!')

      // Change setStep(1) to setStep(5)
      setStep(5) // Transition to the new confirmation step
    } catch (error) {
      console.error('Error finalizing order:', error)
      alert('Failed to complete order. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const resetFlow = () => {
    setStep(1)
    setSelectedCustomer(null)
    setCart([])
    setSelectedSalesRepId('') // Reset to empty string
    setVehicleInputText('')
    setSelectedVehicleObject(null)
    setRequestId('')
    setDeliveryDate(new Date().toISOString().split('T')[0])
    setEditingPriceProductId(null)
    setEditingPriceInputValue('')
    setCurrentOrder(null)
    fetchProducts()
  }

  const isProductInCart = (productId: string) => {
    return cart.some(item => item.product.id === productId);
  }

  const filteredCustomers = customers.filter(customer => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase()
    return (
      customer.name.toLowerCase().includes(lowerCaseSearchTerm) ||
      customer.address.toLowerCase().includes(lowerCaseSearchTerm) ||
      customer.phone_number.toLowerCase().includes(lowerCaseSearchTerm) ||
      customer.customer_display_id.toLowerCase().includes(lowerCaseSearchTerm) ||
      (customer.email && customer.email.toLowerCase().includes(lowerCaseSearchTerm)) ||
      customer.payment_category.toLowerCase().includes(lowerCaseSearchTerm) ||
      customer.vat_status.toLowerCase().includes(lowerCaseSearchTerm) ||
      (customer.tin_number && customer.tin_number.toLowerCase().includes(lowerCaseSearchTerm))
    )
  })

  const filteredProducts = products.filter(product => {
    const lowerCaseSearchTerm = productSearchTerm.toLowerCase()
    return (
      product.name.toLowerCase().includes(lowerCaseSearchTerm) ||
      (product.sku && product.sku.toLowerCase().includes(lowerCaseSearchTerm))
    )
  })

  if (step === 1) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Service Customer</h1>
          <div className="flex items-center text-sm text-gray-500">
            <span className="bg-red-100 text-red-700 px-2 py-1 rounded">Step 1 of 5</span>
          </div>
        </div>

        <div className="mb-8 flex items-center justify-between w-full max-w-4xl mx-auto">
          <div className="flex flex-col items-center relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg
              ${step >= 1 ? 'bg-red-600' : 'bg-gray-300'}`}>
              1
            </div>
            <span className={`text-sm mt-2 text-center ${step >= 1 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
              Select Customer
            </span>
          </div>

          <div className={`flex-1 h-1 mx-2 ${step > 1 ? 'bg-red-600' : 'bg-gray-300'}`}></div>

          <div className="flex flex-col items-center relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg
              ${step >= 2 ? 'bg-red-600' : 'bg-gray-300'}`}>
              2
            </div>
            <span className={`text-sm mt-2 text-center ${step >= 2 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
              Add Products
            </span>
          </div>

          <div className={`flex-1 h-1 mx-2 ${step > 2 ? 'bg-red-600' : 'bg-gray-300'}`}></div>

          <div className="flex flex-col items-center relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg
              ${step >= 3 ? 'bg-red-600' : 'bg-gray-300'}`}>
              3
            </div>
            <span className={`text-sm mt-2 text-center ${step >= 3 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
              View Cart
            </span>
          </div>

          <div className={`flex-1 h-1 mx-2 ${step > 3 ? 'bg-red-600' : 'bg-gray-300'}`}></div>

          <div className="flex flex-col items-center relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg
              ${step >= 4 ? 'bg-red-600' : 'bg-gray-300'}`}>
              4
            </div>
            <span className={`text-sm mt-2 text-center ${step >= 4 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
              Review Order
            </span>
          </div>

          <div className={`flex-1 h-1 mx-2 ${step > 4 ? 'bg-red-600' : 'bg-gray-300'}`}></div>

          <div className="flex flex-col items-center relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg
              ${step >= 5 ? 'bg-red-600' : 'bg-gray-300'}`}>
              5
            </div>
            <span className={`text-sm mt-2 text-center ${step >= 5 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
              Confirmation
            </span>
          </div>
        </div>

        {isCustomersFromCache && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">Customer data may be outdated (loaded from cache)</p>
          </div>
        )}

        {user?.role === 'Admin' || user?.role === 'Super Admin' ? (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Select Customer</h2>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search customers by ID, name, address, phone, category, or VAT status..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredCustomers.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No customers found matching your search.</p>
              ) : (
                filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => handleCustomerSelect(customer)}
                    className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-red-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{customer.name}</div>
                        <div className="text-sm text-gray-500">ID: {customer.customer_display_id}</div>
                        <div className="text-sm text-gray-500">{customer.address}</div>
                        <div className="text-sm text-gray-500">{customer.phone_number}</div>
                        <div className="flex items-center space-x-2 mt-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            customer.payment_category.includes('Dealer')
                              ? 'bg-indigo-100 text-indigo-800'
                              : customer.payment_category.includes('Hotel')
                              ? 'bg-pink-100 text-pink-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {customer.payment_category}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            customer.vat_status === 'VAT'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {customer.vat_status}
                          </span>
                          {customer.tin_number && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              TIN: {customer.tin_number}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center">
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Select Customer</h2>
            <div className="space-y-2">
              {customers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => handleCustomerSelect(customer)}
                  className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-red-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{customer.name}</div>
                      <div className="text-sm text-gray-500">{customer.address}</div>
                      <div className="text-sm text-gray-500">{customer.phone_number}</div>
                      <div className="flex items-center space-x-2 mt-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          customer.payment_category.includes('Dealer')
                            ? 'bg-indigo-100 text-indigo-800'
                            : customer.payment_category.includes('Hotel')
                            ? 'bg-pink-100 text-pink-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {customer.payment_category}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          customer.vat_status === 'VAT'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {customer.vat_status}
                        </span>
                        {customer.tin_number && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            TIN: {customer.tin_number}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center">
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (step === 2) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Add Products</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center text-sm text-gray-500">
              <span className="bg-red-100 text-red-700 px-2 py-1 rounded">Step 2 of 5</span>
            </div>
            <button
              onClick={resetFlow}
              className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Start Over
            </button>
          </div>
        </div>

        <div className="mb-8 flex items-center justify-between w-full max-w-4xl mx-auto">
          <div className="flex flex-col items-center relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg
              ${step >= 1 ? 'bg-red-600' : 'bg-gray-300'}`}>
              1
            </div>
            <span className={`text-sm mt-2 text-center ${step >= 1 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
              Select Customer
            </span>
          </div>

          <div className={`flex-1 h-1 mx-2 ${step > 1 ? 'bg-red-600' : 'bg-gray-300'}`}></div>

          <div className="flex flex-col items-center relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg
              ${step >= 2 ? 'bg-red-600' : 'bg-gray-300'}`}>
              2
            </div>
            <span className={`text-sm mt-2 text-center ${step >= 2 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
              Add Products
            </span>
          </div>

          <div className={`flex-1 h-1 mx-2 ${step > 2 ? 'bg-red-600' : 'bg-gray-300'}`}></div>

          <div className="flex flex-col items-center relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg
              ${step >= 3 ? 'bg-red-600' : 'bg-gray-300'}`}>
              3
            </div>
            <span className={`text-sm mt-2 text-center ${step >= 3 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
              View Cart
            </span>
          </div>

          <div className={`flex-1 h-1 mx-2 ${step > 3 ? 'bg-red-600' : 'bg-gray-300'}`}></div>

          <div className="flex flex-col items-center relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg
              ${step >= 4 ? 'bg-red-600' : 'bg-gray-300'}`}>
              4
            </div>
            <span className={`text-sm mt-2 text-center ${step >= 4 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
              Review Order
            </span>
          </div>

          <div className={`flex-1 h-1 mx-2 ${step > 4 ? 'bg-red-600' : 'bg-gray-300'}`}></div>

          <div className="flex flex-col items-center relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg
              ${step >= 5 ? 'bg-red-600' : 'bg-gray-300'}`}>
              5
            </div>
            <span className={`text-sm mt-2 text-center ${step >= 5 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
              Confirmation
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-2">Customer: {selectedCustomer?.name}</h2>
          <p className="text-sm text-gray-600">ID: {selectedCustomer?.customer_display_id}</p>
          <p className="text-sm text-gray-600">Address: {selectedCustomer?.address}</p>
          <p className="text-sm text-gray-600">Phone: {selectedCustomer?.phone_number}</p>
          <div className="flex items-center space-x-2 mt-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
              selectedCustomer?.payment_category.includes('Dealer')
                ? 'bg-indigo-100 text-indigo-800'
                : selectedCustomer?.payment_category.includes('Hotel')
                ? 'bg-pink-100 text-pink-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {selectedCustomer?.payment_category}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
              selectedCustomer?.vat_status === 'VAT'
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {selectedCustomer?.vat_status}
            </span>
            {selectedCustomer?.tin_number && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                TIN: {selectedCustomer.tin_number}
              </span>
            )}
          </div>
        </div>

        {isProductsFromCache && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">Product data may be outdated (loaded from cache)</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Available Products</h3>
            <button
              onClick={() => setStep(3)}
              disabled={cart.length === 0}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              View Cart ({cart.length})
            </button>
          </div>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search products by name or SKU..."
              value={productSearchTerm}
              onChange={(e) => setProductSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredProducts.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No products found matching your search.</p>
            ) : (
              filteredProducts.map((product) => {
                const isInCart = isProductInCart(product.id);
                return (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{product.name}</div>
                      <div className="text-sm text-gray-500">
                        {formatCurrency(getCalculatedPrice(product, selectedCustomer?.payment_category || 'Cash'))} • Stock: {product.quantity} {WEIGHT_UNIT}
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddToCart(product)}
                      disabled={isInCart}
                      className={`px-3 py-1 rounded transition-colors ${
                        isInCart
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-red-600 text-white hover:bg-red-700'
                      }`}
                    >
                      {isInCart ? 'Added' : 'Add'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    )
  }

  if (step === 3) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">View Cart</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center text-sm text-gray-500">
              <span className="bg-red-100 text-red-700 px-2 py-1 rounded">Step 3 of 5</span>
            </div>
            <button
              onClick={resetFlow}
              className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Start Over
            </button>
          </div>
        </div>

        <div className="mb-8 flex items-center justify-between w-full max-w-4xl mx-auto">
          <div className="flex flex-col items-center relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg
              ${step >= 1 ? 'bg-red-600' : 'bg-gray-300'}`}>
              1
            </div>
            <span className={`text-sm mt-2 text-center ${step >= 1 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
              Select Customer
            </span>
          </div>

          <div className={`flex-1 h-1 mx-2 ${step > 1 ? 'bg-red-600' : 'bg-gray-300'}`}></div>

          <div className="flex flex-col items-center relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg
              ${step >= 2 ? 'bg-red-600' : 'bg-gray-300'}`}>
              2
            </div>
            <span className={`text-sm mt-2 text-center ${step >= 2 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
              Add Products
            </span>
          </div>

          <div className={`flex-1 h-1 mx-2 ${step > 2 ? 'bg-red-600' : 'bg-gray-300'}`}></div>

          <div className="flex flex-col items-center relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg
              ${step >= 3 ? 'bg-red-600' : 'bg-gray-300'}`}>
              3
            </div>
            <span className={`text-sm mt-2 text-center ${step >= 3 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
              View Cart
            </span>
          </div>

          <div className={`flex-1 h-1 mx-2 ${step > 3 ? 'bg-red-600' : 'bg-gray-300'}`}></div>

          <div className="flex flex-col items-center relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg
              ${step >= 4 ? 'bg-red-600' : 'bg-gray-300'}`}>
              4
            </div>
            <span className={`text-sm mt-2 text-center ${step >= 4 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
              Review Order
            </span>
          </div>

          <div className={`flex-1 h-1 mx-2 ${step > 4 ? 'bg-red-600' : 'bg-gray-300'}`}></div>

          <div className="flex flex-col items-center relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg
              ${step >= 5 ? 'bg-red-600' : 'bg-gray-300'}`}>
              5
            </div>
            <span className={`text-sm mt-2 text-center ${step >= 5 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
              Confirmation
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-2">Customer: {selectedCustomer?.name}</h2>
          <p className="text-sm text-gray-600">ID: {selectedCustomer?.customer_display_id}</p>
          <p className="text-sm text-gray-600">Address: {selectedCustomer?.address}</p>
          <p className="text-sm text-gray-600">Phone: {selectedCustomer?.phone_number}</p>
          <div className="flex items-center space-x-2 mt-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
              selectedCustomer?.payment_category.includes('Dealer')
                ? 'bg-indigo-100 text-indigo-800'
                : selectedCustomer?.payment_category.includes('Hotel')
                ? 'bg-pink-100 text-pink-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {selectedCustomer?.payment_category}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
              selectedCustomer?.vat_status === 'VAT'
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {selectedCustomer?.vat_status}
            </span>
            {selectedCustomer?.tin_number && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                TIN: {selectedCustomer.tin_number}
              </span>
            )}
          </div>
        </div>

        {isSalesRepsFromCache && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">Sales reps data may be outdated (loaded from cache)</p>
          </div>
        )}

        {isVehiclesFromCache && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">Vehicles data may be outdated (loaded from cache)</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Cart Items</h3>
          {cart.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No items in cart</p>
          ) : (
            <div className="space-y-4">
              {cart.map((item) => {
                const autoCalculatedPrice = getCalculatedPrice(
                  item.product,
                  selectedCustomer?.payment_category || 'Cash'
                );
                const isEditing = editingPriceProductId === item.product.id;
                
                return (
                  <div key={item.product.id} className="flex items-center justify-between py-3 border-b border-gray-200">
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="font-medium text-gray-900">{item.product.name}</p>
                      <p className="text-sm text-gray-500">Stock: {item.product.quantity} {WEIGHT_UNIT}</p>
                    </div>

                    <div className="w-24 ml-2">
                      <input
                        type="number"
                        step="0.1"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(item.product.id, parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
                        min="0"
                        max={item.product.quantity}
                        placeholder="Enter Qty"
                        title="Enter quantity (e.g., 266.7 for 266kg 700g). Use delete button to remove."
                      />
                    </div>

                    <div className="flex items-center ml-2 flex-shrink-0 w-48">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editingPriceInputValue}
                          onChange={(e) => setEditingPriceInputValue(e.target.value)}
                          className="w-32 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
                          min="0"
                          autoFocus
                        />
                      ) : (
                        <span className="text-sm text-gray-700 text-right w-28 px-2 py-1.5">
                          {formatCurrency(item.selectedPrice)}
                        </span>
                      )}
                      
                      {isEditing ? (
                        <div className="flex items-center ml-2">
                          <button
                            onClick={() => savePrice(item.product.id)}
                            className="p-2 text-green-600 hover:text-green-800 rounded-full hover:bg-green-100 transition-colors"
                            title="Save changes"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEditingPrice}
                            className="p-2 text-red-600 hover:text-red-800 rounded-full hover:bg-red-100 transition-colors ml-1"
                            title="Cancel editing"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditingPrice(item.product.id)}
                          className="p-2 text-blue-600 hover:text-blue-800 rounded-full hover:bg-blue-100 transition-colors ml-2"
                          title="Edit price"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => handleRemoveFromCart(item.product.id)}
                      className="ml-2 p-2 text-red-600 hover:text-red-800 rounded-full hover:bg-red-100 transition-colors flex-shrink-0"
                      title="Remove from cart"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}

              <div className="space-y-3 mt-4 pt-4 border-t border-gray-200">
                {cart.map((item) => {
                  const autoCalculatedPrice = getCalculatedPrice(
                    item.product,
                    selectedCustomer?.payment_category || 'Cash'
                  );
                  const isEditing = editingPriceProductId === item.product.id;
                  
                  return (
                    <div key={item.product.id} className="space-y-1">
                      <div className="flex justify-between items-center text-sm font-medium">
                        <span className="text-gray-600">{item.product.name} Total:</span>
                        <span>{formatCurrency(item.selectedPrice * item.quantity)}</span>
                      </div>
                      
                      {item.isCustomPrice && item.selectedPrice !== autoCalculatedPrice && !isEditing && (
                        <div className="text-xs text-gray-500 flex justify-between">
                          <span>Auto price: {formatCurrency(autoCalculatedPrice)}</span>
                          {item.selectedPrice > autoCalculatedPrice ? (
                            <span className="text-red-600 ml-1">(+{formatCurrency(item.selectedPrice - autoCalculatedPrice)})</span>
                          ) : (
                            <span className="text-green-600 ml-1">(-{formatCurrency(autoCalculatedPrice - item.selectedPrice)})</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between items-center text-lg font-semibold">
                    <span>Total:</span>
                    <span>{formatCurrency(getTotalAmount())}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <label htmlFor="assignedSalesRep" className="block text-sm font-medium text-gray-700 mb-2">
                  Assign to Sales Rep *
                </label>
                <select
                  id="assignedSalesRep"
                  value={selectedSalesRepId}
                  onChange={(e) => setSelectedSalesRepId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  required
                >
                  <option value="">Select Sales Rep</option>
                  {salesReps.map((rep) => (
                    <option key={rep.id} value={rep.id}>
                      {rep.first_name} {rep.last_name} ({rep.username})
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Purchase Order ID
                </label>
                <input
                  type="text"
                  value={requestId}
                  onChange={(e) => setRequestId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Enter purchase order ID (optional)"
                />
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Order Delivery Date
                </label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vehicle Number
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={vehicleInputText}
                    onChange={(e) => {
                      setVehicleInputText(e.target.value);
                      setShowVehicleSuggestions(true);
                    }}
                    onFocus={() => setShowVehicleSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowVehicleSuggestions(false), 100)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="Enter vehicle number (optional)"
                  />
                  {showVehicleSuggestions && filteredVehicleSuggestions.length > 0 && (
                    <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
                      {filteredVehicleSuggestions.map((vehicle) => (
                        <li
                          key={vehicle.id}
                          onMouseDown={() => {
                            setVehicleInputText(vehicle.vehicle_number);
                            setSelectedVehicleObject(vehicle);
                            setShowVehicleSuggestions(false);
                          }}
                          className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                        >
                          {vehicle.vehicle_number} ({vehicle.vehicle_type}) - {vehicle.status}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="flex space-x-4 mt-6">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Back to Products
                </button>
                <button
                  onClick={() => setStep(4)}
                  disabled={cart.length === 0 || !selectedSalesRepId}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Review Order
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (step === 4) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Review Order</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center text-sm text-gray-500">
              <span className="bg-red-100 text-red-700 px-2 py-1 rounded">Step 4 of 5</span>
            </div>
            <button
              onClick={resetFlow}
              className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Start Over
            </button>
          </div>
        </div>

        <div className="mb-8 flex items-center justify-between w-full max-w-4xl mx-auto">
          <div className="flex flex-col items-center relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg
              ${step >= 1 ? 'bg-red-600' : 'bg-gray-300'}`}>
              1
            </div>
            <span className={`text-sm mt-2 text-center ${step >= 1 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
              Select Customer
            </span>
          </div>

          <div className={`flex-1 h-1 mx-2 ${step > 1 ? 'bg-red-600' : 'bg-gray-300'}`}></div>

          <div className="flex flex-col items-center relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg
              ${step >= 2 ? 'bg-red-600' : 'bg-gray-300'}`}>
              2
            </div>
            <span className={`text-sm mt-2 text-center ${step >= 2 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
              Add Products
            </span>
          </div>

          <div className={`flex-1 h-1 mx-2 ${step > 2 ? 'bg-red-600' : 'bg-gray-300'}`}></div>

          <div className="flex flex-col items-center relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg
              ${step >= 3 ? 'bg-red-600' : 'bg-gray-300'}`}>
              3
            </div>
            <span className={`text-sm mt-2 text-center ${step >= 3 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
              View Cart
            </span>
          </div>

          <div className={`flex-1 h-1 mx-2 ${step > 3 ? 'bg-red-600' : 'bg-gray-300'}`}></div>

          <div className="flex flex-col items-center relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg
              ${step >= 4 ? 'bg-red-600' : 'bg-gray-300'}`}>
              4
            </div>
            <span className={`text-sm mt-2 text-center ${step >= 4 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
              Review Order
            </span>
          </div>

          <div className={`flex-1 h-1 mx-2 ${step > 4 ? 'bg-red-600' : 'bg-gray-300'}`}></div>

          <div className="flex flex-col items-center relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg
              ${step >= 5 ? 'bg-red-600' : 'bg-gray-300'}`}>
              5
            </div>
            <span className={`text-sm mt-2 text-center ${step >= 5 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
              Confirmation
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-6">Review Order</h2>

          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Customer Details</h2>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="font-medium text-gray-900">{selectedCustomer?.name}</div>
              <div className="text-sm text-gray-600">{selectedCustomer?.address}</div>
              <div className="text-sm text-gray-600">{selectedCustomer?.phone_number}</div>
              <div className="flex items-center space-x-2 mt-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  selectedCustomer?.payment_category.includes('Dealer')
                    ? 'bg-indigo-100 text-indigo-800'
                    : selectedCustomer?.payment_category.includes('Hotel')
                    ? 'bg-pink-100 text-pink-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {selectedCustomer?.payment_category}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  selectedCustomer?.vat_status === 'VAT'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {selectedCustomer?.vat_status}
                </span>
                {selectedCustomer?.tin_number && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    TIN: {selectedCustomer.tin_number}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-2">Vehicle: {vehicleInputText || 'N/A'}</p>
              <p className="text-sm text-gray-600">Delivery Date: {deliveryDate}</p>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Order Items</h2>
            <div className="space-y-2">
              {cart.map((item) => {
                const autoCalculatedPrice = getCalculatedPrice(
                  item.product,
                  selectedCustomer?.payment_category || 'Cash'
                );
                
                return (
                  <div key={item.product.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{item.product.name}</div>
                      <div className="text-sm text-gray-500">Quantity: {item.quantity} {WEIGHT_UNIT}</div>
                      {item.isCustomPrice && item.selectedPrice !== autoCalculatedPrice && (
                        <div className="text-xs text-gray-500 mt-1">
                          Custom price (Auto: {formatCurrency(autoCalculatedPrice)})
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(item.selectedPrice * item.quantity)}</div>
                      <div className="text-sm text-gray-500">@ {formatCurrency(item.selectedPrice)}/{WEIGHT_UNIT}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t pt-4 mb-6">
            <div className="flex justify-between items-center text-base">
              <span>Subtotal:</span>
              <span>{formatCurrency(getSubtotal())}</span>
            </div>
            {selectedCustomer?.vat_status === 'VAT' && (
              <div className="flex justify-between items-center text-base mt-1">
                <span>VAT ({(vatRate * 100).toFixed(0)}%):</span>
                <span>{formatCurrency(getVatAmount())}</span>
            </div>
            )}
            <div className="flex justify-between items-center text-xl font-bold mt-2">
              <span>Total Amount:</span>
              <span>{formatCurrency(getTotalAmount())}</span>
            </div>
          </div>

          <div className="flex space-x-4">
            <button
              onClick={() => setStep(3)}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Back to Cart
            </button>
            <button
              onClick={handleFinalizeOrder}
              disabled={loading || !selectedSalesRepId}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Finalize Order
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 5) {
    if (!currentOrder) {
      // Handle case where currentOrder is not set (e.g., page refresh)
      return (
        <div className="p-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Order Not Found</h1>
          <p className="text-gray-600 mb-6">It seems like the order details were lost. Please start a new order.</p>
          <button
            onClick={resetFlow}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Start New Order
          </button>
        </div>
      );
    }

    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Order Confirmation</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center text-sm text-gray-500">
              <span className="bg-red-100 text-red-700 px-2 py-1 rounded">Step 5 of 5</span>
            </div>
            <button
              onClick={resetFlow}
              className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Start New Order
            </button>
          </div>
        </div>

        {/* Step Progress Bar for Step 5 */}
        <div className="mb-8 flex items-center justify-between w-full max-w-4xl mx-auto">
          <div className="flex flex-col items-center relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg
              ${step >= 1 ? 'bg-red-600' : 'bg-gray-300'}`}>
              1
            </div>
            <span className={`text-sm mt-2 text-center ${step >= 1 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
              Select Customer
            </span>
          </div>

          <div className={`flex-1 h-1 mx-2 ${step > 1 ? 'bg-red-600' : 'bg-gray-300'}`}></div>

          <div className="flex flex-col items-center relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg
              ${step >= 2 ? 'bg-red-600' : 'bg-gray-300'}`}>
              2
            </div>
            <span className={`text-sm mt-2 text-center ${step >= 2 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
              Add Products
            </span>
          </div>

          <div className={`flex-1 h-1 mx-2 ${step > 2 ? 'bg-red-600' : 'bg-gray-300'}`}></div>

          <div className="flex flex-col items-center relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg
              ${step >= 3 ? 'bg-red-600' : 'bg-gray-300'}`}>
              3
            </div>
            <span className={`text-sm mt-2 text-center ${step >= 3 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
              View Cart
            </span>
          </div>

          <div className={`flex-1 h-1 mx-2 ${step > 3 ? 'bg-red-600' : 'bg-gray-300'}`}></div>

          <div className="flex flex-col items-center relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg
              ${step >= 4 ? 'bg-red-600' : 'bg-gray-300'}`}>
              4
            </div>
            <span className={`text-sm mt-2 text-center ${step >= 4 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
              Review Order
            </span>
          </div>

          <div className={`flex-1 h-1 mx-2 ${step > 4 ? 'bg-red-600' : 'bg-gray-300'}`}></div>

          <div className="flex flex-col items-center relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg
              ${step >= 5 ? 'bg-red-600' : 'bg-gray-300'}`}>
              5
            </div>
            <span className={`text-sm mt-2 text-center ${step >= 5 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
              Confirmation
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-green-700">Order Successfully Placed!</h2>
            <button
              onClick={() => handleExportPDF(currentOrder)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Loading Bay PDF
            </button>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Order Details</h2>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-700 flex justify-between">
                <span>Order ID:</span>
                <span className="font-medium text-lg">{currentOrder.order_display_id}</span>
              </p>
              <p className="text-gray-700 flex justify-between">
                <span>Customer:</span>
                <span className="font-medium">{currentOrder.customers.name}</span>
              </p>
              <p className="text-gray-700 flex justify-between">
                <span>Sales Rep:</span>
                <span className="font-medium">{currentOrder.assigned_user.username}</span>
              </p>
              <p className="text-gray-700 flex justify-between">
                <span>Vehicle:</span>
                <span className="font-medium">{currentOrder.vehicle_number || 'N/A'}</span>
              </p>
              <p className="text-gray-700 flex justify-between">
                <span>Delivery Date:</span>
                <span className="font-medium">{currentOrder.delivery_date ? new Date(currentOrder.delivery_date).toLocaleDateString() : 'N/A'}</span>
              </p>
              <p className="text-gray-700 flex justify-between">
                <span>Total Amount:</span>
                <span className="font-medium">{formatCurrency(currentOrder.total_amount || 0)}</span>
              </p>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Items</h2>
            <div className="space-y-2">
              {currentOrder.order_items.map((item) => (
                <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">{item.products.name}</div>
                    <div className="text-sm text-gray-500">Quantity: {item.quantity} {item.products.unit_type}</div>
                  </div>
                  {/* Price details are not needed for loading bay PDF, but can be displayed here if desired */}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={resetFlow}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Start New Order
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null
}