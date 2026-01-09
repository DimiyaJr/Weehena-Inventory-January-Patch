// src/components/CreateOnDemandSaleModal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, User, Phone, Mail, MapPin, DollarSign, Save, Package, AlertCircle, ShoppingCart, Check } from 'lucide-react';
import { supabase, Customer, Product, OnDemandAssignmentItem, OnDemandOrder } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency } from '../utils/formatters';
import { WEIGHT_UNIT } from '../utils/units';
import { STATIC_PAYMENT_METHODS, PaymentMethodType } from '../utils/staticPaymentMethods';
import { STATIC_PAYMENT_CATEGORIES } from '../utils/staticPaymentCategories';
import { PaymentConfirmationModal } from './PaymentConfirmationModal';
import { OnDemandBillPrintLayout } from './OnDemandBillPrintLayout';
import { createRoot } from 'react-dom/client';
import { OnDemandPaymentStatusModal } from './OnDemandPaymentStatusModal';
import { isMobileOrTablet } from '../utils/deviceDetection';
import { validateAndPrepareHTML, validatePDFBlob } from '../lib/mprintService';

// Define a type for the products selected for sale within the modal
interface SaleItem {
  on_demand_assignment_item_id: string; // The ID of the assignment item
  product_id: string; // The actual product ID
  product_name: string;
  unit_type: 'Kg' | 'g' | 'Packs';
  remaining_assigned_quantity: number; // Current stock available to sell from assignment
  quantity_to_sell: number;
  selling_price: number;
  total_amount: number;
}

// Props for the modal
interface CreateOnDemandSaleModalProps {
  onClose: () => void;
  onSaleCreated: () => void;
  assignedProducts: Array<{
    id: string; // on_demand_assignment_item.id
    product_id: string; // actual product.id
    name: string; // product.name
    unit_type: 'Kg' | 'g' | 'Packs';
    remaining_quantity: number; // calculated remaining from assignment
    on_demand_assignment_id: string; // parent assignment ID
    sales_rep_id?: string; // NEW: Add sales_rep_id for ownership verification
    // NEW: Include price fields from the product for defaulting selling price
    price_cash?: number;
    price_credit?: number;
    price_dealer_cash?: number;
    price_dealer_credit?: number;
    price_hotel_non_vat?: number;
    price_hotel_vat?: number;
    price_farm_shop?: number;
  }>;
}

export const CreateOnDemandSaleModal: React.FC<CreateOnDemandSaleModalProps> = ({
  onClose,
  onSaleCreated,
  assignedProducts,
}) => {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({
    name: '',
    phone_number: '',
    address: '',
    email: '',
    customer_type: 'walk-in' as 'existing' | 'walk-in', // Default to walk-in for new
    payment_category: 'Cash', // Default payment category for new customers
    vat_status: 'Non-VAT' as 'VAT' | 'Non-VAT',
    tin_number: '',
  });
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerSearchSuggestions, setCustomerSearchSuggestions] = useState<Customer[]>([]);
  const [showPaymentConfirmation, setShowPaymentConfirmation] = useState(false);
  const [transactionSummary, setTransactionSummary] = useState<any>(null); // To hold consolidated order data
  const [showPaymentStatusModal, setShowPaymentStatusModal] = useState(false); // NEW: State for intermediate modal
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<'full' | 'partial' | 'no_payment' | null>(null); // NEW: State for selected payment status
  const [productDetailsCache, setProductDetailsCache] = useState<Record<string, { product_id: string; sku: string }>>({}); // Cache for product details

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Fetch product details for all assigned products to get product_id and sku
  useEffect(() => {
    const fetchProductDetails = async () => {
      if (assignedProducts.length === 0) return;
      
      try {
        const productIds = assignedProducts.map(p => p.product_id);
        const { data, error } = await supabase
          .from('products')
          .select('id, product_id, sku')
          .in('id', productIds);
        
        if (error) throw error;
        
        const cache: Record<string, { product_id: string; sku: string }> = {};
        data?.forEach(product => {
          cache[product.id] = {
            product_id: product.product_id || '',
            sku: product.sku || ''
          };
        });
        
        setProductDetailsCache(cache);
      } catch (err) {
        console.error('Error fetching product details:', err);
      }
    };
    
    fetchProductDetails();
  }, [assignedProducts]);

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, phone_number, address, email, payment_category, vat_status, tin_number')
        .order('name');
      if (error) throw error;
      setCustomers(data || []);
    } catch (err) {
      console.error('Error fetching customers:', err);
      setError('Failed to load customers.');
    }
  };

  // Filter assigned products to only show those not yet added to the sale
  const availableProductsForSale = useMemo(() => {
    return assignedProducts.filter(
      (p) => {
        // Only show products assigned to the current user
        if (p.sales_rep_id !== user?.id) {
          return false;
        }
        // Don't show products already added to this sale
        return !saleItems.some((item) => item.product_id === p.product_id);
      }
    );
  }, [assignedProducts, saleItems, user?.id]);

  // Function to get the default selling price based on customer's payment category
  const getDefaultSellingPrice = (product: typeof assignedProducts[0], customerPaymentCategory: string): number => {
    switch (customerPaymentCategory) {
      case 'Regular Cash': return product.price_cash || 0;
      case 'Regular Credit': return product.price_credit || 0;
      case 'Dealer Cash': return product.price_dealer_cash || 0;
      case 'Dealer Credit': return product.price_dealer_credit || 0;
      case 'Hotel Non-VAT': return product.price_hotel_non_vat || 0;
      case 'Hotel VAT': return product.price_hotel_vat || 0;
      case 'Farm Shop': return product.price_farm_shop || 0;
      case 'Walk-in': return product.price_cash || 0; // Default to cash price for walk-in
      default: return 0;
    }
  };

  // NEW: Helper function to verify a sales rep owns an assignment item
  const verifyAssignmentOwnership = async (assignmentItemId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('on_demand_assignment_items')
        .select('on_demand_assignments(sales_rep_id)')
        .eq('id', assignmentItemId)
        .single();

      if (error) {
        console.error('Error verifying assignment ownership:', error);
        return false;
      }

      return data?.on_demand_assignments?.sales_rep_id === user?.id;
    } catch (err) {
      console.error('Error in verifyAssignmentOwnership:', err);
      return false;
    }
  };

  const handleCustomerSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    if (term.length > 2) {
      setCustomerSearchSuggestions(
        customers.filter((c) =>
          c.name.toLowerCase().includes(term.toLowerCase()) ||
          c.phone_number.includes(term)
        )
      );
    } else {
      setCustomerSearchSuggestions([]);
    }
  };

  const selectExistingCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setSearchTerm(customer.name);
    setIsNewCustomer(false);
    setCustomerSearchSuggestions([]);
    // When customer changes, update prices for existing sale items
    const customerPaymentCategory = customer.payment_category;
    setSaleItems(prevItems => prevItems.map(item => {
      const productInAssigned = assignedProducts.find(p => p.product_id === item.product_id);
      if (productInAssigned) {
        const newSellingPrice = getDefaultSellingPrice(productInAssigned, customerPaymentCategory);
        return {
          ...item,
          selling_price: newSellingPrice,
          total_amount: item.quantity_to_sell * newSellingPrice,
        };
      }
      return item;
    }));
  };

  const toggleNewCustomer = () => {
    setIsNewCustomer(!isNewCustomer);
    setSelectedCustomer(null);
    setSearchTerm('');
    setNewCustomerData({
      name: '',
      phone_number: '',
      address: '',
      email: '',
      customer_type: 'walk-in',
      payment_category: 'Cash',
      vat_status: 'Non-VAT',
      tin_number: '',
    });
    // Clear sale items if customer type changes, or re-evaluate prices
    setSaleItems([]);
  };

  const handleNewCustomerChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewCustomerData(prev => ({ ...prev, [name]: value }));

    // If payment_category changes for a new customer, update prices for existing sale items
    if (name === 'payment_category') {
      setSaleItems(prevItems => prevItems.map(item => {
        const productInAssigned = assignedProducts.find(p => p.product_id === item.product_id);
        if (productInAssigned) {
          const newSellingPrice = getDefaultSellingPrice(productInAssigned, value);
          return {
            ...item,
            selling_price: newSellingPrice,
            total_amount: item.quantity_to_sell * newSellingPrice,
          };
        }
        return item;
      }));
    }
  };

  const addProductToSale = (product: typeof assignedProducts[0]) => {
    const customerPaymentCategory = selectedCustomer?.payment_category || newCustomerData.payment_category;
    const sellingPrice = getDefaultSellingPrice(product, customerPaymentCategory);

    setSaleItems((prev) => [
      ...prev,
      {
        on_demand_assignment_item_id: product.id, // This is the assignment item ID
        product_id: product.product_id,
        product_name: product.name,
        unit_type: product.unit_type,
        remaining_assigned_quantity: product.remaining_quantity,
        quantity_to_sell: 0,
        selling_price: sellingPrice,
        total_amount: 0,
      },
    ]);
  };

  const updateSaleItem = (
    index: number,
    field: keyof SaleItem,
    value: any
  ) => {
    setSaleItems((prev) =>
      prev.map((item, i) => {
        if (i === index) {
          const updatedItem = { ...item, [field]: value };
          if (field === 'quantity_to_sell' || field === 'selling_price') {
            // Only quantity_to_sell can be changed by user, selling_price is read-only
            updatedItem.total_amount = updatedItem.quantity_to_sell * updatedItem.selling_price;
          }
          return updatedItem;
        }
        return item;
      })
    );
  };

  const removeSaleItem = (index: number) => {
    setSaleItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Helper function for desktop printing (extracted from inline code)
  const openDesktopPrintWindow = (
    orderToPrint: any,
    paymentMethodToPrint: PaymentMethodType | null,
    receiptNoToPrint: string,
    transactionAmount: number,
    previouslyCollected: number,
    totalCollected: number,
    remainingBalance: number,
    paymentStatusText: string
  ) => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (printWindow) {
      const root = createRoot(printWindow.document.body);
      root.render(
        <OnDemandBillPrintLayout
          order={{
            ...orderToPrint as any,
            paymentMethod: paymentMethodToPrint,
            receiptNo: receiptNoToPrint,
          }}
          paymentMethod={paymentMethodToPrint}
          receiptNo={receiptNoToPrint}
          transactionAmount={transactionAmount}
          previouslyCollected={previouslyCollected}
          totalCollected={totalCollected}
          remainingBalance={remainingBalance}
          paymentStatusText={paymentStatusText}
        />
      );
      setTimeout(() => {
        printWindow.print();
      }, 500);
    } else {
      alert('Please allow pop-ups to print the receipt.');
    }
  };

  // NEW: Function to handle the initial "Create Sale" click
  const handleInitiateSale = async () => {
    setLoading(true);
    setError(null);

    if (!user?.id) {
      setError('User not authenticated.');
      setLoading(false);
      return;
    }

    // Validate customer selection
    let customerId: string | null = null;
    let customerName: string = '';
    let customerPhone: string = '';
    let customerType: 'existing' | 'walk-in' = 'walk-in';

    if (isNewCustomer) {
      if (!newCustomerData.name.trim() || !newCustomerData.phone_number.trim()) {
        setError('New customer name and phone number are required.');
        setLoading(false);
        return;
      }
      if (!/^\d{10}$/.test(newCustomerData.phone_number.trim())) {
        setError('New customer phone number must be 10 digits.');
        setLoading(false);
        return;
      }
      customerName = newCustomerData.name.trim();
      customerPhone = newCustomerData.phone_number.trim();
      customerType = 'walk-in';
    } else if (selectedCustomer) {
      customerId = selectedCustomer.id;
      customerName = selectedCustomer.name;
      customerPhone = selectedCustomer.phone_number;
      customerType = 'existing';
    } else {
      setError('Please select an existing customer or add a new walk-in customer.');
      setLoading(false);
      return;
    }

    if (saleItems.length === 0) {
      setError('Please add at least one product to the sale.');
      setLoading(false);
      return;
    }

    // Validate sale items
    for (const item of saleItems) {
      if (item.quantity_to_sell <= 0) {
        setError(`Quantity to sell for ${item.product_name} must be greater than 0.`);
        setLoading(false);
        return;
      }
      if (item.quantity_to_sell > item.remaining_assigned_quantity) {
        setError(`Quantity to sell for ${item.product_name} exceeds remaining assigned quantity (${item.remaining_assigned_quantity} ${item.unit_type}).`);
        setLoading(false);
        return;
      }
      if (item.selling_price <= 0) {
        setError(`Selling price for ${item.product_name} must be greater than 0.`);
        setLoading(false);
        return;
      }
    }

    // SECURITY: Re-verify all products belong to the current sales rep
    for (const item of saleItems) {
      const assignedProduct = assignedProducts.find(p => p.product_id === item.product_id);
      if (!assignedProduct || assignedProduct.sales_rep_id !== user?.id) {
        setError(`Security error: Product ${item.product_name} is not assigned to your account. Please refresh and try again.`);
        setLoading(false);
        return;
      }
    }

    // All validations passed, prepare transaction summary and show payment status modal
    const totalSaleAmount = saleItems.reduce((sum, item) => sum + item.total_amount, 0);

    const consolidatedOrderForSummary = {
        id: 'temp-on-demand-id', // Temporary ID, actual IDs will be generated on insert
        on_demand_order_display_id: 'PENDING', // This will be updated after actual order creation
        customer_name: customerName,
        customer_phone: customerPhone,
        total_amount: totalSaleAmount,
        sale_date: new Date().toISOString(),
        notes: notes,
        sales_rep_username: user.username,
        customer_details: {
          id: customerId,
          name: customerName,
          phone_number: customerPhone,
          address: selectedCustomer?.address || newCustomerData.address || '',
          email: selectedCustomer?.email || newCustomerData.email || '',
          vat_status: selectedCustomer?.vat_status || newCustomerData.vat_status || 'Non-VAT',
          tin_number: selectedCustomer?.tin_number || newCustomerData.tin_number || '',
          payment_category: selectedCustomer?.payment_category || newCustomerData.payment_category || 'Cash',
          customer_display_id: selectedCustomer?.customer_display_id || '',
          created_at: selectedCustomer?.created_at || new Date().toISOString()
        },
        product_details: saleItems.map(item => {
          const productCache = productDetailsCache[item.product_id] || { product_id: '', sku: '' };
          return {
            id: item.on_demand_assignment_item_id,
            products: {
                name: item.product_name,
                unit_type: item.unit_type,
                product_id: productCache.product_id || item.product_id, // Use actual product_id or fallback
                sku: productCache.sku || item.product_id, // Use actual sku or fallback
                id: item.product_id,
            },
            sold_quantity: item.quantity_to_sell,
            selling_price: item.selling_price,
            total_amount: item.total_amount,
          };
        }),
        vat_amount: 0,
        is_vat_applicable: false,
        collected_amount: 0, // Will be set in PaymentConfirmationModal
        payment_status: 'unpaid', // Will be set in PaymentConfirmationModal
        // NEW: Add these fields for printing
        paymentMethod: null,
        newlyCollectedAmount: 0,
        previouslyCollected: 0,
        totalCollected: 0,
        remainingBalance: 0,
        paymentStatusText: '',
    };

    setTransactionSummary(consolidatedOrderForSummary);
    setShowPaymentStatusModal(true); // Show the intermediate payment status modal
    setLoading(false);
  };

  // NEW: Function to handle payment status selection
  const handlePaymentStatusSelected = (status: 'full' | 'partial' | 'no_payment') => {
    setSelectedPaymentStatus(status);
    setShowPaymentStatusModal(false); // Close intermediate modal
    setShowPaymentConfirmation(true); // Open PaymentConfirmationModal
  };

  // NEW: Function to finalize the sale (create orders and update assignment items)
  const finalizeOnDemandSale = async (
    orderId: string, // This orderId is from PaymentConfirmationModal, but for on-demand, we use transactionSummary.id
    paymentMethod: PaymentMethodType,
    newlyCollectedAmount: number,
    isSubsequentPayment: boolean,
    intendedStatus: 'fully_paid' | 'partially_paid' | 'unpaid', // Explicitly type intendedStatus
    chequeNumber?: string,
    chequeDate?: string
  ): Promise<string> => {
    setLoading(true);
    setError(null);

    try {
      if (!paymentMethod && newlyCollectedAmount > 0) {
        throw new Error('Payment method is required when collecting payment.');
      }

      const validatedPaymentMethod: PaymentMethodType = paymentMethod;

      let customerId: string | null = null;
      let customerName: string = '';
      let customerPhone: string = '';
      let customerType: 'existing' | 'walk-in' = 'walk-in';

      // Re-validate customer data from transactionSummary
      if (transactionSummary.customer_details) {
        if (isNewCustomer) {
          const { data: newCust, error: newCustError } = await supabase
            .from('customers')
            .insert({
              name: transactionSummary.customer_details.name.trim(),
              phone_number: transactionSummary.customer_details.phone_number.trim(),
              address: transactionSummary.customer_details.address.trim() || 'Walk-in Customer',
              email: transactionSummary.customer_details.email.trim() || null,
              payment_category: transactionSummary.customer_details.payment_category,
              vat_status: transactionSummary.customer_details.vat_status,
              tin_number: transactionSummary.customer_details.vat_status === 'VAT' ? transactionSummary.customer_details.tin_number.trim() : null,
            })
            .select('id')
            .single();

          if (newCustError) throw newCustError;
          customerId = newCust.id;
          customerType = 'walk-in';
        } else {
          customerId = transactionSummary.customer_details.id;
          customerType = 'existing';
        }
        customerName = transactionSummary.customer_details.name;
        customerPhone = transactionSummary.customer_details.phone_number;
      } else {
        throw new Error('Customer details missing from transaction summary.');
      }

      // Generate a single receipt_no for the entire transaction
      const { data: generatedReceiptNoData, error: receiptNoError } = await supabase.rpc('generate_on_demand_receipt_no');
      if (receiptNoError) throw receiptNoError;
      const transactionReceiptNo = generatedReceiptNoData;

      const createdOnDemandOrders: OnDemandOrder[] = [];

      for (const item of saleItems) {
        // NEW: Verify ownership before processing
        const ownsAssignment = await verifyAssignmentOwnership(item.on_demand_assignment_item_id);
        if (!ownsAssignment) {
          throw new Error(`Unauthorized: You do not own assignment for product ${item.product_name}`);
        }

        console.log('Finalizing on-demand order: payment_method being inserted:', validatedPaymentMethod, 'Type:', typeof validatedPaymentMethod);

        // Calculate the amount to collect for this specific order item
        const itemTotalAmount = item.total_amount;
        const totalSaleAmount = saleItems.reduce((sum, i) => sum + i.total_amount, 0);
        
        // Determine the collected_amount for this specific order item
        // If newlyCollectedAmount is 0 (no payment), set collected_amount to 0
        // If full/partial payment, calculate proportionally based on item's share of total
        let itemCollectedAmount = 0;
        if (newlyCollectedAmount > 0 && totalSaleAmount > 0) {
          itemCollectedAmount = Math.round((itemTotalAmount / totalSaleAmount) * newlyCollectedAmount * 100) / 100;
        }

        // Determine the payment_status for this specific order item
        let itemPaymentStatus: 'fully_paid' | 'partially_paid' | 'unpaid';
        if (newlyCollectedAmount === 0) {
          itemPaymentStatus = 'unpaid';
        } else if (newlyCollectedAmount >= totalSaleAmount) {
          itemPaymentStatus = 'fully_paid';
        } else {
          itemPaymentStatus = 'partially_paid';
        }

        const { data: newOnDemandOrder, error: orderError } = await supabase
          .from('on_demand_orders')
          .insert({
            on_demand_assignment_item_id: item.on_demand_assignment_item_id,
            sales_rep_id: user!.id,
            customer_name: customerName,
            customer_phone: customerPhone,
            customer_type: customerType,
            existing_customer_id: customerId,
            quantity_sold: item.quantity_to_sell,
            selling_price: item.selling_price,
            total_amount: item.total_amount,
            sale_date: new Date().toISOString(),
            notes: notes,
            payment_method: validatedPaymentMethod || null,
            receipt_no: transactionReceiptNo,
            payment_status: itemPaymentStatus, // Set calculated payment status for this item
            collected_amount: itemCollectedAmount, // Set calculated collected amount for this item
          })
          .select('id, receipt_no')
          .single();

        if (orderError) throw orderError;
        createdOnDemandOrders.push(newOnDemandOrder);

        // Insert into on_demand_order_payments if amount collected
        if (newlyCollectedAmount > 0) {
          const { error: paymentInsertError } = await supabase
            .from('on_demand_order_payments')
            .insert({
              on_demand_order_id: newOnDemandOrder.id,
              amount: newlyCollectedAmount,
              payment_method: validatedPaymentMethod,
              receipt_no: transactionReceiptNo,
              collected_by: user!.id, // FIX: Ensure collected_by is explicitly set to the current user's ID
              cheque_number: validatedPaymentMethod === 'Cheque' ? chequeNumber : null,
              cheque_date: validatedPaymentMethod === 'Cheque' ? chequeDate : null,
            });
          if (paymentInsertError) console.error('Error inserting on-demand payment record:', paymentInsertError);
        }

        // VALIDATION: Verify the assignment item belongs to the current sales rep AND fetch quantities
        const { data: assignmentItemWithAssignment, error: fetchItemError } = await supabase
          .from('on_demand_assignment_items')
          .select(`
            sold_quantity,
            assigned_quantity,
            returned_quantity,
            on_demand_assignments(id, sales_rep_id)
          `)
          .eq('id', item.on_demand_assignment_item_id)
          .single();

        if (fetchItemError) throw fetchItemError;

        // SECURITY CHECK: Ensure this assignment belongs to the current user
        if (assignmentItemWithAssignment.on_demand_assignments?.sales_rep_id !== user?.id) {
          throw new Error('Unauthorized: This product assignment does not belong to your account. You can only create orders from your own assigned inventory.');
        }

        const currentAssignmentItem = assignmentItemWithAssignment;
        const newSoldQuantity = currentAssignmentItem.sold_quantity + item.quantity_to_sell;
        
        // CONSTRAINT VALIDATION: Check if new sold quantity will violate the constraint
        // Constraint: sold_quantity + returned_quantity <= assigned_quantity
        const totalAccountedQuantity = newSoldQuantity + currentAssignmentItem.returned_quantity;
        if (totalAccountedQuantity > currentAssignmentItem.assigned_quantity) {
          throw new Error(
            `Cannot sell ${item.quantity_to_sell} ${item.product_name}. ` +
            `Available: ${currentAssignmentItem.assigned_quantity - currentAssignmentItem.sold_quantity - currentAssignmentItem.returned_quantity}. ` +
            `(Assigned: ${currentAssignmentItem.assigned_quantity}, Sold: ${currentAssignmentItem.sold_quantity}, Returned: ${currentAssignmentItem.returned_quantity})`
          );
        }

        const { error: updateItemError } = await supabase
          .from('on_demand_assignment_items')
          .update({ sold_quantity: newSoldQuantity })
          .eq('id', item.on_demand_assignment_item_id);

        if (updateItemError) throw updateItemError;
      }

      // Update transactionSummary with the single receipt number and payment details for printing
      const updatedTransactionSummary = {
        ...transactionSummary,
        receipt_no: transactionReceiptNo, // Add the single receipt number to transactionSummary
        paymentMethod: validatedPaymentMethod,
        newlyCollectedAmount: newlyCollectedAmount,
        previouslyCollected: 0, // For on-demand, always 0 since it's the first payment
        totalCollected: newlyCollectedAmount,
        remainingBalance: transactionSummary.total_amount - newlyCollectedAmount,
        paymentStatusText: intendedStatus || (newlyCollectedAmount === transactionSummary.total_amount ? 'Fully Paid' : 'Partially Paid'),
      };
      setTransactionSummary(updatedTransactionSummary);

      // Return the single transaction receipt number for printing
      return transactionReceiptNo || 'N/A';

    } catch (err: any) {
      console.error('Error finalizing on-demand sale:', err);
      setError(err.message || 'Failed to finalize on-demand sale.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <ShoppingCart className="w-6 h-6 text-green-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">Create On-Demand Sale</h2>
              <p className="text-sm text-gray-600">Record a direct sale from your assigned inventory.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Customer Selection */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                Customer Information
              </h3>
              <div className="flex items-center mb-4">
                <label className="flex items-center mr-4">
                  <input
                    type="radio"
                    name="customerType"
                    checked={!isNewCustomer}
                    onChange={toggleNewCustomer}
                    className="form-radio text-blue-600"
                  />
                  <span className="ml-2 text-gray-700">Existing Customer</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="customerType"
                    checked={isNewCustomer}
                    onChange={toggleNewCustomer}
                    className="form-radio text-blue-600"
                  />
                  <span className="ml-2 text-gray-700">New Walk-in Customer</span>
                </label>
              </div>

              {!isNewCustomer ? (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search existing customers by name or phone..."
                    value={searchTerm}
                    onChange={handleCustomerSearch}
                    onFocus={() => searchTerm.length > 2 && setCustomerSearchSuggestions(customers.filter((c) =>
                      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      c.phone_number.includes(searchTerm)
                    ))}
                    onBlur={() => setTimeout(() => setCustomerSearchSuggestions([]), 100)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {customerSearchSuggestions.length > 0 && (
                    <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                      {customerSearchSuggestions.map((customer) => (
                        <li
                          key={customer.id}
                          onMouseDown={() => selectExistingCustomer(customer)}
                          className="px-4 py-2 cursor-pointer hover:bg-gray-100 flex justify-between items-center"
                        >
                          <div>
                            <div className="font-medium text-gray-900">{customer.name}</div>
                            <div className="text-sm text-gray-500">{customer.phone_number}</div>
                          </div>
                          {selectedCustomer?.id === customer.id && <Check className="w-4 h-4 text-green-500" />}
                        </li>
                      ))}
                    </ul>
                  )}
                  {selectedCustomer && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="font-semibold text-blue-800">{selectedCustomer.name}</p>
                      <p className="text-sm text-blue-700">{selectedCustomer.phone_number}</p>
                      <p className="text-sm text-blue-700">{selectedCustomer.address}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={newCustomerData.name}
                      onChange={handleNewCustomerChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                    <input
                      type="tel"
                      name="phone_number"
                      value={newCustomerData.phone_number}
                      onChange={handleNewCustomerChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <input
                      type="text"
                      name="address"
                      value={newCustomerData.address}
                      onChange={handleNewCustomerChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={newCustomerData.email}
                      onChange={handleNewCustomerChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Category</label>
                    <select
                      name="payment_category"
                      value={newCustomerData.payment_category}
                      onChange={handleNewCustomerChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      {STATIC_PAYMENT_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">VAT Status</label>
                    <select
                      name="vat_status"
                      value={newCustomerData.vat_status}
                      onChange={handleNewCustomerChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="Non-VAT">Non-VAT</option>
                      <option value="VAT">VAT</option>
                    </select>
                  </div>
                  {newCustomerData.vat_status === 'VAT' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">TIN Number</label>
                      <input
                        type="text"
                        name="tin_number"
                        value={newCustomerData.tin_number}
                        onChange={handleNewCustomerChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Products for Sale */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                Products for Sale
              </h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Add Product</label>
                <select
                  onChange={(e) => {
                    const productId = e.target.value;
                    const product = assignedProducts.find(p => p.product_id === productId);
                    if (product) {
                      addProductToSale(product);
                      e.target.value = ''; // Reset select
                    }
                  }}
                  value="" // Controlled component, reset value after selection
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!selectedCustomer && !isNewCustomer}
                >
                  <option value="">Select a product from your assigned inventory</option>
                  {availableProductsForSale.map((product) => (
                    <option key={product.product_id} value={product.product_id}>
                      {product.name} (Remaining: {product.remaining_quantity} {product.unit_type})
                    </option>
                  ))}
                </select>
              </div>

              {saleItems.length > 0 && (
                <div className="space-y-4">
                  {saleItems.map((item, index) => (
                    <div key={item.on_demand_assignment_item_id} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium text-gray-900">{item.product_name}</h4>
                        <button
                          onClick={() => removeSaleItem(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Quantity ({item.unit_type}) * (Max: {item.remaining_assigned_quantity})
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max={item.remaining_assigned_quantity}
                            value={item.quantity_to_sell}
                            onChange={(e) =>
                              updateSaleItem(index, 'quantity_to_sell', parseFloat(e.target.value) || 0)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Selling Price (Rs) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={item.selling_price}
                            // NEW: Make this input read-only
                            readOnly
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Total Amount
                          </label>
                          <input
                            type="text"
                            value={formatCurrency(item.total_amount)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                            readOnly
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* NEW: Notes section (moved from above) */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                Notes
              </h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Add any relevant notes for this sale"
                ></textarea>
              </div>
            </div>

            {error && (
              <div className="flex items-center p-3 mt-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-3 p-6 border-t bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleInitiateSale} // Changed to handleInitiateSale
            className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            disabled={loading || saleItems.length === 0 || (!selectedCustomer && !isNewCustomer)} // Removed paymentMethod from disabled check
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating Sale...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Create Sale
              </>
            )}
          </button>
        </div>
      </div>

      {/* NEW: OnDemandPaymentStatusModal */}
      {showPaymentStatusModal && transactionSummary && (
        <OnDemandPaymentStatusModal
          onClose={() => {
            setShowPaymentStatusModal(false);
            setLoading(false); // Reset loading if user cancels
          }}
          onSelectPaymentStatus={handlePaymentStatusSelected}
          totalAmount={transactionSummary.total_amount}
        />
      )}

      {/* PaymentConfirmationModal (now triggered after payment status selection) */}
      {showPaymentConfirmation && transactionSummary && selectedPaymentStatus && (
        <PaymentConfirmationModal
          order={transactionSummary}
          onClose={() => {
            setShowPaymentConfirmation(false);
            setTransactionSummary(null);
            setSelectedPaymentStatus(null);
            onSaleCreated(); // Refresh parent data
            onClose(); // Close this modal
          }}
          onConfirm={finalizeOnDemandSale} // Pass the new finalize function
          onPrintBill={async (orderToPrint, paymentMethodToPrint, receiptNoToPrint, transactionAmount, previouslyCollected, totalCollected, remainingBalance, paymentStatusText) => {
            const isMobile = isMobileOrTablet();

            if (isMobile) {
              // MOBILE: Use generateOnDemandBillHTML + mPrint (same as ongoing bills)
              try {
                console.log('[OnDemand First Transaction] Mobile detected, using mPrint flow');
                
                // Step 1: Import functions
                const { generateOnDemandBillHTML, downloadBillForMprint, generateBillPDF } = await import('../lib/mprintService');
                
                // Step 2: Generate HTML string (same function as ongoing bills)
                const billHtml = generateOnDemandBillHTML({
                  order: orderToPrint,
                  paymentMethod: paymentMethodToPrint,
                  receiptNo: receiptNoToPrint,
                  transactionAmount,
                  previouslyCollected,
                  totalCollected,
                  remainingBalance,
                  paymentStatusText,
                });

                // Step 3: Validate HTML before PDF generation
                const htmlValidation = validateAndPrepareHTML(billHtml);
                if (!htmlValidation.isValid) {
                  console.error('[OnDemand First Transaction] HTML validation failed:', htmlValidation.errors);
                  alert('Bill content is invalid. Using local print instead.');
                  // Fallback to desktop print
                  openDesktopPrintWindow(orderToPrint, paymentMethodToPrint, receiptNoToPrint, transactionAmount, previouslyCollected, totalCollected, remainingBalance, paymentStatusText);
                  return;
                }

                console.log('[OnDemand First Transaction] HTML valid, generating PDF');

                // Step 4: Convert HTML to PDF with timeout protection
                const pdfPromise = generateBillPDF(billHtml, `on-demand-${receiptNoToPrint}`);
                const timeoutPromise = new Promise((_, reject) =>
                  setTimeout(() => reject(new Error('PDF generation timeout')), 15000)
                );

                const pdfBlob = await Promise.race([pdfPromise, timeoutPromise]) as Blob;

                // Step 5: Validate PDF blob
                const pdfValidation = validatePDFBlob(pdfBlob);
                console.log('[OnDemand First Transaction] PDF validation - Size:', pdfValidation.sizeKb, 'KB, Valid:', pdfValidation.isValid);

                if (!pdfValidation.isValid) {
                  console.warn('[OnDemand First Transaction] PDF validation failed:', pdfValidation.reason);
                  console.log('[OnDemand First Transaction] Falling back to local print');
                  // Fallback to desktop print
                  openDesktopPrintWindow(orderToPrint, paymentMethodToPrint, receiptNoToPrint, transactionAmount, previouslyCollected, totalCollected, remainingBalance, paymentStatusText);
                  return;
                }

                // Step 6: Download for mPrint
                await downloadBillForMprint(pdfBlob, `on-demand-${receiptNoToPrint}`);
                console.log('[OnDemand First Transaction] PDF downloaded successfully');
                
                alert('Bill PDF downloaded successfully. Please open with mPrint app to print.');
                
              } catch (err: any) {
                console.error('[OnDemand First Transaction] Error:', err.message || err);
                alert('Failed to generate PDF. Using local print instead.');
                // Fallback to desktop print
                openDesktopPrintWindow(orderToPrint, paymentMethodToPrint, receiptNoToPrint, transactionAmount, previouslyCollected, totalCollected, remainingBalance, paymentStatusText);
              }
            } else {
              // DESKTOP: Use existing React component print window
              openDesktopPrintWindow(orderToPrint, paymentMethodToPrint, receiptNoToPrint, transactionAmount, previouslyCollected, totalCollected, remainingBalance, paymentStatusText);
            }
          }}
          loading={loading}
          is_on_demand={true}
          // Configure based on selectedPaymentStatus
          initialPaymentStatus={selectedPaymentStatus} // NEW PROP
          // paymentCollectedAmount and paymentMethod will be handled internally by PaymentConfirmationModal based on initialPaymentStatus
          allowPartialPayment={selectedPaymentStatus === 'partial'}
          isSubsequentPayment={false} // Always false for initial on-demand sale
        />
      )}
    </div>
  );
};