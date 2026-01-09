import React, { useState, useEffect } from 'react'
import { X, Save, DollarSign } from 'lucide-react'
import { supabase, Product } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { formatCurrency } from '../utils/formatters'
import { STATIC_PAYMENT_CATEGORIES } from '../utils/staticPaymentCategories'; // New import

interface ProductPricesModalProps {
  product: Product
  onClose: () => void
  onPricesUpdated: () => void
}

interface PriceAuditInfo {
  username: string;
  changedAt: string;
}

export const ProductPricesModal: React.FC<ProductPricesModalProps> = ({
  product,
  onClose,
  onPricesUpdated
}) => {
  // Remove: configuredPaymentCategories state
  // ✅ CORRECTION 1: prices state with correct seven price fields (including price_farm_shop)
  // CHANGE START: Initialize prices state directly from product, without || 0 fallback
  const [prices, setPrices] = useState({
    price_cash: product.price_cash,
    price_credit: product.price_credit,
    price_dealer_cash: product.price_dealer_cash,
    price_dealer_credit: product.price_dealer_credit,
    price_hotel_non_vat: product.price_hotel_non_vat,
    price_hotel_vat: product.price_hotel_vat,
    price_farm_shop: product.price_farm_shop // New field, directly use value
  })
  // CHANGE END
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()
  const canEditPrices = user?.role === 'Admin' || user?.role === 'Super Admin'
  const [auditInfo, setAuditInfo] = useState<Record<string, PriceAuditInfo | null>>({
    price_cash: null,
    price_credit: null,
    price_dealer_cash: null,
    price_dealer_credit: null,
    price_hotel_non_vat: null,
    price_hotel_vat: null,
    price_farm_shop: null, // New field
  })

  useEffect(() => {
    // Remove: fetchPaymentCategories()
  }, [])

  useEffect(() => {
    setPrices({
      price_cash: product.price_cash,
      price_credit: product.price_credit,
      price_dealer_cash: product.price_dealer_cash,
      price_dealer_credit: product.price_dealer_credit,
      price_hotel_non_vat: product.price_hotel_non_vat,
      price_hotel_vat: product.price_hotel_vat,
      price_farm_shop: product.price_farm_shop // New field
    })
  }, [product])

  // Remove: fetchPaymentCategories function

  // Format date without using date-fns
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (error) {
      return 'Unknown date';
    }
  }

  // ✅ CORRECTION 2: Fetch audit information for all seven fixed price columns (including price_farm_shop)
  useEffect(() => {
    const fetchAuditInfo = async () => {
      const priceFields = [
        'price_cash',
        'price_credit',
        'price_dealer_cash',
        'price_dealer_credit',
        'price_hotel_non_vat',
        'price_hotel_vat',
        'price_farm_shop' // New field
      ];
      const newAuditInfo: Record<string, PriceAuditInfo | null> = {};

      for (const field of priceFields) {
        try {
          // Query from products_audit table for the fixed price columns
          const { data, error } = await supabase
            .from('products_audit')
            .select('changed_by_username, modified_at')
            .eq('product_id', product.id)
            .contains('changed_columns', [field])
            .order('modified_at', { ascending: false })
            .limit(1);

          if (error) {
            console.error(`Error fetching audit info for ${field}:`, error);
            newAuditInfo[field] = null;
          } else if (data && data.length > 0) {
            // Use the first record if we get any results
            newAuditInfo[field] = {
              username: data[0].changed_by_username || 'Unknown',
              changedAt: data[0].modified_at,
            };
          } else {
            newAuditInfo[field] = null;
          }
        } catch (err) {
          console.error(`Unexpected error fetching audit info for ${field}:`, err);
          newAuditInfo[field] = null;
        }
      }
      setAuditInfo(newAuditInfo);
    };

    if (product.id) {
      fetchAuditInfo();
    }
  }, [product.id]);

  // ✅ CORRECTION 4: getPriceFieldKey function with correct mapping
  const getPriceFieldKey = (paymentCategory: string): keyof typeof prices => {
    const mapping: { [key: string]: keyof typeof prices } = {
      'Regular Cash': 'price_cash', // Updated to match static list
      'Regular Credit': 'price_credit', // Updated to match static list
      'Dealer Cash': 'price_dealer_cash',
      'Dealer Credit': 'price_dealer_credit',
      'Hotel Non-VAT': 'price_hotel_non_vat',
      'Hotel VAT': 'price_hotel_vat',
      'Farm Shop': 'price_farm_shop' // Mapped to new field
    }
    return mapping[paymentCategory] || 'price_cash'
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

  const handleSave = async () => {
    if (!canEditPrices) {
      alert('You do not have permission to edit prices.')
      return
    }

    setLoading(true)
    try {
      // First set the user context for trigger-based auditing
      const { error: sessionError } = await supabase.rpc('set_current_user_info', {
        user_id: user?.id,
        username: user?.username
      });

      if (sessionError) {
        console.error('Error setting user context:', sessionError);
        // Continue with manual audit approach as fallback
        await handleSaveWithManualAudit();
      } else {
        // Use trigger-based approach
        await handleSaveWithTrigger();
      }
    } catch (error) {
      console.error('Error updating prices:', error)
      alert('Failed to update prices. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Fallback: Manual audit approach
  const handleSaveWithManualAudit = async () => {
    // ✅ CORRECTION 3: Update all seven fixed price columns in the database (including price_farm_shop)
    const { error } = await supabase
      .from('products')
      .update({
        price_cash: prices.price_cash,
        price_credit: prices.price_credit,
        price_dealer_cash: prices.price_dealer_cash,
        price_dealer_credit: prices.price_dealer_credit,
        price_hotel_non_vat: prices.price_hotel_non_vat,
        price_hotel_vat: prices.price_hotel_vat,
        price_farm_shop: prices.price_farm_shop // New field
      })
      .eq('id', product.id)

    if (error) throw error

    // Determine which price fields actually changed
    const changedPriceFields = Object.keys(prices).filter(key => {
      const priceKey = key as keyof typeof prices;
      const productKey = key as keyof Product;
      return prices[priceKey] !== product[productKey];
    });

    // Only create audit record if there are actual changes
    if (changedPriceFields.length > 0) {
      // Then manually create an audit record with the correct user info
      const { error: auditError } = await supabase
        .from('products_audit')
        .insert({
          product_id: product.id,
          action: 'UPDATED',
          changed_by_user_id: user?.id,
          changed_by_username: user?.username,
          changed_columns: changedPriceFields,
          old_name: product.name,
          old_sku: product.sku,
          old_quantity: product.quantity,
          old_price_cash: product.price_cash,
          old_price_credit: product.price_credit,
          old_price_dealer_cash: product.price_dealer_cash,
          old_price_dealer_credit: product.price_dealer_credit,
          old_price_hotel_non_vat: product.price_hotel_non_vat,
          old_price_hotel_vat: product.price_hotel_vat,
          old_price_farm_shop: product.price_farm_shop, // New field
          new_name: product.name, // Name doesn't change in price modal
          new_sku: product.sku, // SKU doesn't change in price modal
          new_quantity: product.quantity, // Quantity doesn't change in price modal
          new_price_cash: prices.price_cash,
          new_price_credit: prices.price_credit,
          new_price_dealer_cash: prices.price_dealer_cash,
          new_price_dealer_credit: prices.price_dealer_credit,
          new_price_hotel_non_vat: prices.price_hotel_non_vat,
          new_price_hotel_vat: prices.price_hotel_vat,
          new_price_farm_shop: prices.price_farm_shop, // New field
        })

      if (auditError) {
        console.error('Error creating audit record:', auditError)
        console.log('Product prices updated, but audit record creation failed. This is non-critical.');
      } else {
        console.log('Manual audit record created successfully for price changes:', changedPriceFields);
      }
    } else {
      console.log('No price changes detected, skipping audit record creation.');
    }

    onPricesUpdated()
    onClose()
    alert('Prices updated successfully!')
  }

  // Primary: Trigger-based approach
  const handleSaveWithTrigger = async () => {
    // ✅ CORRECTION 3: Update all seven fixed price columns (this will use the trigger with session context)
    const { error } = await supabase
      .from('products')
      .update({
        price_cash: prices.price_cash,
        price_credit: prices.price_credit,
        price_dealer_cash: prices.price_dealer_cash,
        price_dealer_credit: prices.price_dealer_credit,
        price_hotel_non_vat: prices.price_hotel_non_vat,
        price_hotel_vat: prices.price_hotel_vat,
        price_farm_shop: prices.price_farm_shop // New field
      })
      .eq('id', product.id)

    if (error) throw error

    onPricesUpdated()
    onClose()
    alert('Prices updated successfully!')
  }

  const handlePriceChange = (field: keyof typeof prices, value: string) => {
    const numValue = parseFloat(value) // parseFloat will return NaN for empty string
    setPrices(prev => ({
      ...prev,
      [field]: isNaN(numValue) ? 0 : numValue // Ensure it's a number, default to 0 if NaN
    }))
  }

  const validatePrice = (value: number): string | null => {
    if (value <= 0) {
      return 'Price must be greater than 0'
    }
    if (value > 1000000) {
      return 'Price seems too high. Please verify the amount.'
    }
    return null
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      {/* ✅ CHANGE 1: Wider modal container without height restrictions */}
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Product Prices
              </h3>
              <p className="text-sm text-gray-500">Manage pricing for different customer categories</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* ✅ CHANGE 2: Remove internal scrolling container */}
        <div>
          <div className="p-6">
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 mb-1">Product Information</h4>
              <p className="text-sm text-gray-700 mb-1">
                <span className="font-medium">Name:</span> {product.name}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-medium">SKU:</span> {product.sku}
              </p>
            </div>
            
            {/* ✅ CHANGE 3: Two-column grid layout for price fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* ✅ Dynamic Price Field Rendering based on STATIC_PAYMENT_CATEGORIES */}
              {STATIC_PAYMENT_CATEGORIES.map((paymentCategory) => { // Use STATIC_PAYMENT_CATEGORIES
                const priceField = getPriceFieldKey(paymentCategory)
                const priceLabel = getPriceFieldLabel(paymentCategory)
                const validationError = validatePrice(prices[priceField])
                
                // Add console.log here to inspect the value and validation error
                console.log(`ProductPricesModal: Validating ${priceLabel} (${String(priceField)}): value = ${prices[priceField]}, validationError = ${validationError}`);
                
                return (
                  <div key={paymentCategory} className="border border-gray-200 rounded-lg p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {priceLabel} Price
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
                        value={prices[priceField]}
                        onChange={(e) => handlePriceChange(priceField, e.target.value)}
                        className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors ${
                          validationError 
                            ? 'border-red-300 bg-red-50' 
                            : 'border-gray-300'
                        } ${!canEditPrices ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        required
                        disabled={!canEditPrices}
                        placeholder="0.00"
                      />
                    </div>
                    
                    {validationError && (
                      <p className="text-xs text-red-600 mt-1 flex items-center">
                        <span className="w-1 h-1 bg-red-600 rounded-full mr-1"></span>
                        {validationError}
                      </p>
                    )}
                    
                    {/* ✅ Audit information continues to show for fixed price columns */}
                    {auditInfo[priceField] && (
                      <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                        <p className="text-xs text-blue-700">
                          <span className="font-medium">Last modified:</span> {formatDate(auditInfo[priceField]!.changedAt)}
                        </p>
                        <p className="text-xs text-blue-700">
                          <span className="font-medium">By:</span> {auditInfo[priceField]!.username}
                        </p>
                      </div>
                    )}
                    
                    {!auditInfo[priceField] && (
                      <p className="text-xs text-gray-400 mt-2 italic">
                        No modification history available
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            {!canEditPrices && (
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      View Only Access
                    </h3>
                    <div className="mt-1 text-sm text-yellow-700">
                      <p>
                        You have view-only access to prices. Contact an administrator to make changes.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex justify-end space-x-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors font-medium"
          >
            Close
          </button>
          {canEditPrices && (
            <button
              onClick={handleSave}
              disabled={loading || Object.keys(prices).some(field => {
                const priceField = field as keyof typeof prices;
                return validatePrice(prices[priceField]) !== null;
              })}
              className="flex items-center px-6 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Prices
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}