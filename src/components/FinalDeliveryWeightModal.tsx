import React, { useState, useEffect } from 'react'
import { X, AlertCircle, CheckCircle } from 'lucide-react'
import { Order, OrderItem, Product } from '../lib/supabase'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../utils/formatters'

interface FinalDeliveryWeightModalProps {
  order: Order;
  onClose: () => void;
  onWeightsSaved: () => void;
  loading: boolean;
}

export const FinalDeliveryWeightModal: React.FC<FinalDeliveryWeightModalProps> = ({
  order,
  onClose,
  onWeightsSaved,
  loading
}) => {
  const [finalWeights, setFinalWeights] = useState<Record<string, number>>({});
  const [isCalculating, setIsCalculating] = useState(false);
  const [vatRate, setVatRate] = useState(0.18);
  const [originalTotal, setOriginalTotal] = useState(0);
  const [newTotal, setNewTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Chicken product category codes
  const chickenCategoryCodes = ['BT', 'LD', 'OC', 'PS', 'WT'];

  // Check if product is chicken
  const isChickenProduct = (item: OrderItem): boolean => {
    const categoryCode = item.products?.categories?.category_code || item.category_id;
    const categoryName = item.products?.categories?.category_name || item.category_name;
    
    return chickenCategoryCodes.includes(categoryCode?.toUpperCase() || '') ||
           (categoryName?.toLowerCase().includes('chicken') || false);
  };

  // Filter only chicken products
  const chickenProducts = order.order_items.filter(item => isChickenProduct(item));

  // Initialize weights and fetch VAT rate
  useEffect(() => {
    // Calculate chicken products inside useEffect to avoid dependency issues
    const chickenItems = order.order_items.filter(item => {
      const categoryCode = item.products?.categories?.category_code || item.category_id;
      const categoryName = item.products?.categories?.category_name || item.category_name;
      
      return chickenCategoryCodes.includes(categoryCode?.toUpperCase() || '') ||
             (categoryName?.toLowerCase().includes('chicken') || false);
    });

    const initializeWeights = () => {
      const weights: Record<string, number> = {};
      chickenItems.forEach(item => {
        weights[item.id] = item.final_delivery_weight_kg || 0;
      });
      setFinalWeights(weights);
      setOriginalTotal(order.total_amount);
      setNewTotal(order.total_amount);
    };

    const fetchVatRate = async () => {
      try {
        const { data, error: err } = await supabase
          .from('system_settings')
          .select('vat_rate')
          .maybeSingle();

        if (!err && data) {
          setVatRate(data.vat_rate || 0.18);
        }
      } catch (err) {
        console.error('Error fetching VAT rate:', err);
      }
    };

    initializeWeights();
    fetchVatRate();
  }, [order.id]); // Only depend on order.id, not the entire order or chickenProducts

  // Calculate new total when weights change
  const calculateNewTotal = (weights: Record<string, number>): number => {
    let subtotal = 0;

    order.order_items.forEach(item => {
      let itemTotal = 0;

      if (weights[item.id] !== undefined && weights[item.id] > 0) {
        // Use final weight for chicken products
        const finalWeight = weights[item.id];
        const pricePerKg = item.price;
        const discountFactor = item.discount ? (1 - item.discount / 100) : 1;
        itemTotal = finalWeight * pricePerKg * discountFactor;
      } else {
        // Use original calculation for non-chicken or items without weight
        const discountFactor = item.discount ? (1 - item.discount / 100) : 1;
        itemTotal = item.quantity * item.price * discountFactor;
      }

      subtotal += itemTotal;
    });

    // Apply VAT if applicable
    if (order.is_vat_applicable) {
      subtotal *= (1 + vatRate);
    }

    return Math.round(subtotal * 100) / 100; // Round to 2 decimal places
  };

  // Handle weight change
  const handleWeightChange = (itemId: string, weightStr: string) => {
    setError(null);
    
    if (weightStr === '') {
      const newWeights = { ...finalWeights, [itemId]: 0 };
      setFinalWeights(newWeights);
      const calculatedTotal = calculateNewTotal(newWeights);
      setNewTotal(calculatedTotal);
      return;
    }

    const weight = parseFloat(weightStr);
    
    if (isNaN(weight)) {
      setError('Please enter a valid number');
      return;
    }

    if (weight < 0) {
      setError('Weight cannot be negative');
      return;
    }

    const newWeights = { ...finalWeights, [itemId]: weight };
    setFinalWeights(newWeights);
    setIsCalculating(true);
    
    setTimeout(() => {
      const calculatedTotal = calculateNewTotal(newWeights);
      setNewTotal(calculatedTotal);
      setIsCalculating(false);
    }, 100);
  };

  // Save weights to database
  const handleSaveWeights = async () => {
    try {
      setError(null);
      setSuccess(null);
      setIsSaving(true);

      // Validate: at least one weight should be entered
      const hasAnyWeight = Object.values(finalWeights).some(w => w > 0);
      if (!hasAnyWeight) {
        setError('Please enter final weight for at least one chicken product');
        setIsSaving(false);
        return;
      }

      // Calculate final values
      const newTotal = calculateNewTotal(finalWeights);
      
      // Calculate VAT and subtotal
      let newSubtotal = newTotal;
      let newVatAmount = 0;
      
      if (order.is_vat_applicable) {
        newSubtotal = newTotal / (1 + vatRate);
        newVatAmount = newTotal - newSubtotal;
      } else {
        newVatAmount = 0;
      }

      // Update order with new total and VAT
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          total_amount: newTotal,
          vat_amount: Math.round(newVatAmount * 100) / 100
        })
        .eq('id', order.id);

      if (orderError) {
        throw new Error(`Failed to update order: ${orderError.message}`);
      }

      // Update each order item with final weight
      for (const [itemId, weight] of Object.entries(finalWeights)) {
        if (weight > 0) {
          const { error: itemError } = await supabase
            .from('order_items')
            .update({ final_delivery_weight_kg: weight })
            .eq('id', itemId);

          if (itemError) {
            throw new Error(`Failed to update item ${itemId}: ${itemError.message}`);
          }
        }
      }

      setSuccess('Final delivery weights saved successfully!');
      
      // Close modal after 1.5 seconds
      setTimeout(() => {
        onWeightsSaved();
      }, 1500);

    } catch (err: any) {
      console.error('Error saving weights:', err);
      setError(err.message || 'Failed to save final delivery weights. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const totalDifference = newTotal - originalTotal;
  const totalSavings = totalDifference < 0 ? Math.abs(totalDifference) : 0;
  const totalAdditional = totalDifference > 0 ? totalDifference : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Final Delivery Weights</h2>
          <button 
            onClick={onClose} 
            disabled={isSaving}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Order Info */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Order ID:</p>
              <p className="font-semibold text-gray-900">{order.order_display_id}</p>
            </div>
            <div>
              <p className="text-gray-600">Customer:</p>
              <p className="font-semibold text-gray-900">{order.customers?.name || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Chicken Products Section */}
        {chickenProducts.length > 0 ? (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Chicken Products - Enter Final Weights</h3>
            <div className="space-y-4">
              {chickenProducts.map(item => (
                <div key={item.id} className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex flex-col sm:flex-row sm:items-end sm:space-x-4 space-y-3 sm:space-y-0">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.products?.name || 'Product'}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        Original Ordered: {item.quantity} {item.products?.unit_type || 'Kg'}
                      </p>
                      {item.final_delivery_weight_kg ? (
                        <p className="text-sm text-amber-700 font-medium mt-1">
                          Previously Entered: {item.final_delivery_weight_kg} Kg
                        </p>
                      ) : null}
                    </div>
                    <div className="w-full sm:w-48">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Final Delivered Weight (Kg) *
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={finalWeights[item.id] || ''}
                          onChange={(e) => handleWeightChange(item.id, e.target.value)}
                          placeholder="0.00"
                          disabled={isSaving}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:bg-gray-100"
                        />
                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500 pointer-events-none">Kg</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Unit Price: Rs {item.price?.toFixed(2) || '0.00'}/Kg
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800">This order does not contain any chicken products.</p>
          </div>
        )}

        {/* Summary Section */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Total Amount Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Original Total Amount:</span>
              <span className="font-semibold text-gray-900">{formatCurrency(originalTotal)}</span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-gray-300">
              <span className="text-gray-700 font-medium">New Calculated Total:</span>
              <span className={`font-bold text-lg ${newTotal !== originalTotal ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(newTotal)}
              </span>
            </div>
            {totalDifference !== 0 && (
              <div className="flex justify-between items-center pt-2">
                <span className="text-gray-700">
                  {totalSavings > 0 ? 'Savings:' : 'Additional Cost:'}
                </span>
                <span className={`font-semibold ${totalSavings > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {totalSavings > 0 ? `-${formatCurrency(totalSavings)}` : `+${formatCurrency(totalAdditional)}`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start space-x-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-green-800 text-sm">{success}</p>
          </div>
        )}

        {/* Info Section */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Enter the actual final weight delivered for each chicken product in Kg. The payment total will be automatically recalculated based on these weights before payment is collected.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 font-medium"
          >
            Cancel
          </button>

          <button
            onClick={handleSaveWeights}
            disabled={isSaving || loading || chickenProducts.length === 0}
            className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 font-medium flex items-center justify-center"
          >
            {isSaving ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                Saving...
              </>
            ) : (
              'Save Final Weights & Update Total'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};